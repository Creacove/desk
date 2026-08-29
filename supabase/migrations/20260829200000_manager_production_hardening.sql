-- Gate 8: production hardening for the proven Manager runtime.
-- Protect background AI from runaway loops, expose service-role diagnostics,
-- and make derived Manager intelligence read-only to authenticated clients.

create table if not exists public.manager_runtime_admissions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  operation_key text not null,
  status text not null default 'active' check (status in ('active','completed','failed','expired')),
  request_slots integer not null default 1 check (request_slots between 1 and 8),
  claimed_at timestamptz not null default now(),
  expires_at timestamptz not null,
  completed_at timestamptz,
  failure_reason text,
  metadata jsonb not null default '{}'::jsonb,
  check ((status in ('completed','failed','expired')) = (completed_at is not null))
);
create index if not exists manager_runtime_admissions_workspace_time_idx on public.manager_runtime_admissions(artist_workspace_id,claimed_at desc);
create index if not exists manager_runtime_admissions_active_idx on public.manager_runtime_admissions(artist_workspace_id,expires_at) where status='active';
alter table public.manager_runtime_admissions enable row level security;
revoke all on public.manager_runtime_admissions from public,anon,authenticated;grant all on public.manager_runtime_admissions to service_role;

create or replace function public.claim_manager_runtime_admission_v1(p_account_id uuid,p_artist_workspace_id uuid,p_artist_id uuid,p_operation_key text,p_request_slots integer default 1,p_ttl_seconds integer default 180) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_id uuid;v_hour integer;v_day integer;v_operation_burst integer;v_active integer;v_slots integer:=greatest(1,least(coalesce(p_request_slots,1),8));v_ttl integer:=greatest(30,least(coalesce(p_ttl_seconds,180),900));
begin
  if p_operation_key is null or length(trim(p_operation_key))=0 then raise exception 'Manager runtime admission requires an operation key';end if;
  if not exists(select 1 from public.artist_workspaces w where w.id=p_artist_workspace_id and w.account_id=p_account_id and w.artist_id=p_artist_id and w.status='active') then return jsonb_build_object('allowed',false,'reason','workspace_not_active');end if;
  perform pg_advisory_xact_lock(hashtextextended(p_artist_workspace_id::text,918273));
  update public.manager_runtime_admissions set status='expired',completed_at=now(),failure_reason='Admission lease expired before completion.' where artist_workspace_id=p_artist_workspace_id and status='active' and expires_at<=now();
  select coalesce(sum(request_slots),0)::int into v_active from public.manager_runtime_admissions where artist_workspace_id=p_artist_workspace_id and status='active';
  select coalesce(sum(request_slots),0)::int into v_hour from public.manager_runtime_admissions where artist_workspace_id=p_artist_workspace_id and claimed_at>=now()-interval '1 hour';
  select coalesce(sum(request_slots),0)::int into v_day from public.manager_runtime_admissions where artist_workspace_id=p_artist_workspace_id and claimed_at>=now()-interval '24 hours';
  select coalesce(sum(request_slots),0)::int into v_operation_burst from public.manager_runtime_admissions where artist_workspace_id=p_artist_workspace_id and operation_key=p_operation_key and claimed_at>=now()-interval '10 minutes';
  if v_active+v_slots>4 then return jsonb_build_object('allowed',false,'reason','workspace_concurrency_limit','activeSlots',v_active);end if;
  if v_operation_burst+v_slots>8 then return jsonb_build_object('allowed',false,'reason','operation_burst_limit','burstSlots',v_operation_burst);end if;
  if v_hour+v_slots>40 then return jsonb_build_object('allowed',false,'reason','hourly_provider_limit','hourSlots',v_hour);end if;
  if v_day+v_slots>160 then return jsonb_build_object('allowed',false,'reason','daily_provider_limit','daySlots',v_day);end if;
  insert into public.manager_runtime_admissions(account_id,artist_workspace_id,artist_id,operation_key,request_slots,expires_at) values(p_account_id,p_artist_workspace_id,p_artist_id,left(trim(p_operation_key),160),v_slots,now()+make_interval(secs=>v_ttl)) returning id into v_id;
  return jsonb_build_object('allowed',true,'admissionId',v_id,'expiresAt',now()+make_interval(secs=>v_ttl));
end$$;
revoke all on function public.claim_manager_runtime_admission_v1(uuid,uuid,uuid,text,integer,integer) from public,anon,authenticated;grant execute on function public.claim_manager_runtime_admission_v1(uuid,uuid,uuid,text,integer,integer) to service_role;

create or replace function public.finish_manager_runtime_admission_v1(p_admission_id uuid,p_status text,p_failure_reason text default null) returns boolean language plpgsql security definer set search_path=public as $$
begin if p_status not in('completed','failed') then return false;end if;update public.manager_runtime_admissions set status=p_status,completed_at=now(),failure_reason=case when p_status='failed' then left(p_failure_reason,1000) else null end where id=p_admission_id and status='active';return found;end$$;
revoke all on function public.finish_manager_runtime_admission_v1(uuid,text,text) from public,anon,authenticated;grant execute on function public.finish_manager_runtime_admission_v1(uuid,text,text) to service_role;

-- Reserve the maximum bounded provider calls for an adaptive review before the
-- review can become running. Denial leaves the review due so the normal dispatcher
-- can retry after the admission window clears; the current plan remains untouched.
create or replace function public.claim_manager_runtime_review_v2(p_review_id uuid)
returns table(id uuid,account_id uuid,artist_workspace_id uuid,artist_id uuid,mission_id uuid,checkpoint_id uuid,trigger_type text,trigger_object_type text,trigger_object_id uuid,current_read text,what_changed text,next_action text,created_from_run_id uuid,runtime_attempt_count integer)
language plpgsql security definer set search_path=public as $$
declare candidate public.reviews%rowtype;admission jsonb;
begin
  select * into candidate from public.reviews r where r.id=p_review_id and r.trigger_type='adaptive_replan' and r.status in('due','scheduled') and coalesce(r.snoozed_until,r.review_at,now())<=now() for update;
  if not found then return;end if;
  admission:=public.claim_manager_runtime_admission_v1(candidate.account_id,candidate.artist_workspace_id,candidate.artist_id,'adaptive_replan',3,300);
  if coalesce((admission->>'allowed')::boolean,false) is not true then
    update public.reviews set review_at=now()+interval '2 minutes',runtime_last_error='Manager runtime admission deferred: '||coalesce(admission->>'reason','capacity_limit') where reviews.id=p_review_id;
    return;
  end if;
  return query update public.reviews r set status='running',runtime_claimed_at=now(),runtime_attempt_count=least(12,r.runtime_attempt_count+1),runtime_last_error=null where r.id=p_review_id returning r.id,r.account_id,r.artist_workspace_id,r.artist_id,r.mission_id,r.checkpoint_id,r.trigger_type,r.trigger_object_type,r.trigger_object_id,r.current_read,r.what_changed,r.next_action,r.created_from_run_id,r.runtime_attempt_count;
end$$;
revoke all on function public.claim_manager_runtime_review_v2(uuid) from public,anon,authenticated;grant execute on function public.claim_manager_runtime_review_v2(uuid) to service_role;

create or replace function public.manager_runtime_diagnostics_v1(p_account_id uuid default null) returns jsonb language sql stable security definer set search_path=public as $$
select jsonb_build_object('generatedAt',now(),'runningAdaptiveReviews',(select count(*) from public.reviews r where r.trigger_type='adaptive_replan' and r.status='running' and(p_account_id is null or r.account_id=p_account_id)),'staleAdaptiveReviews',(select count(*) from public.reviews r where r.trigger_type='adaptive_replan' and r.status='running' and r.runtime_claimed_at<now()-interval '10 minutes' and(p_account_id is null or r.account_id=p_account_id)),'failedManagerRuns24h',(select count(*) from public.manager_synthesis_runs r where r.status='failed' and r.created_at>=now()-interval '24 hours' and(p_account_id is null or r.account_id=p_account_id)),'openCriticalErrors',(select count(*) from public.app_error_events e where e.status<>'resolved' and e.severity='critical' and(p_account_id is null or e.account_id=p_account_id)),'openErrors24h',(select count(*) from public.app_error_events e where e.status<>'resolved' and e.occurred_at>=now()-interval '24 hours' and(p_account_id is null or e.account_id=p_account_id)),'providerRequests24h',(select coalesce(sum(u.provider_request_count),0) from public.ai_run_usage_events u where u.started_at>=now()-interval '24 hours' and(p_account_id is null or u.account_id=p_account_id)),'inputTokens24h',(select coalesce(sum(u.input_tokens),0) from public.ai_run_usage_events u where u.started_at>=now()-interval '24 hours' and(p_account_id is null or u.account_id=p_account_id)),'outputTokens24h',(select coalesce(sum(u.output_tokens),0) from public.ai_run_usage_events u where u.started_at>=now()-interval '24 hours' and(p_account_id is null or u.account_id=p_account_id)),'activeBackgroundAdmissions',(select count(*) from public.manager_runtime_admissions a where a.status='active' and a.expires_at>now() and(p_account_id is null or a.account_id=p_account_id)),'indeterminateExternalActions',(select count(*) from public.manager_action_execution_receipts x where x.status='indeterminate' and(p_account_id is null or x.account_id=p_account_id)),'cancelledRuntimeReviews',(select count(*) from public.reviews r where r.trigger_type='adaptive_replan' and r.status='cancelled' and(p_account_id is null or r.account_id=p_account_id)))$$;
revoke all on function public.manager_runtime_diagnostics_v1(uuid) from public,anon,authenticated;grant execute on function public.manager_runtime_diagnostics_v1(uuid) to service_role;

drop policy if exists manager_intelligence_packets_account_members_modify on public.manager_intelligence_packets;drop policy if exists manager_outputs_account_members_modify on public.manager_outputs;
revoke insert,update,delete on public.manager_intelligence_packets from authenticated;revoke insert,update,delete on public.manager_outputs from authenticated;grant select on public.manager_intelligence_packets to authenticated;grant select on public.manager_outputs to authenticated;grant select,insert,update,delete on public.manager_intelligence_packets to service_role;grant select,insert,update,delete on public.manager_outputs to service_role;
