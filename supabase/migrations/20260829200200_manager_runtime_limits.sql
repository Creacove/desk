-- Configurable, service-role-owned limits for background Manager AI.
create table if not exists public.manager_runtime_limits (
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  background_ai_enabled boolean not null default true,
  max_active_slots integer not null default 4 check(max_active_slots between 1 and 20),
  max_provider_slots_hour integer not null default 40 check(max_provider_slots_hour between 1 and 500),
  max_provider_slots_day integer not null default 160 check(max_provider_slots_day between 1 and 2000),
  max_tokens_hour bigint not null default 1000000 check(max_tokens_hour between 10000 and 100000000),
  max_tokens_day bigint not null default 5000000 check(max_tokens_day between 50000 and 500000000),
  max_cost_usd_day numeric not null default 50 check(max_cost_usd_day between 1 and 10000),
  operation_burst_slots_10m integer not null default 12 check(operation_burst_slots_10m between 1 and 100),
  updated_at timestamptz not null default now(),
  primary key(account_id,artist_workspace_id,artist_id)
);
alter table public.manager_runtime_limits enable row level security;
revoke all on public.manager_runtime_limits from public,anon,authenticated;
grant all on public.manager_runtime_limits to service_role;

insert into public.manager_runtime_limits(account_id,artist_workspace_id,artist_id)
select account_id,id,artist_id from public.artist_workspaces on conflict do nothing;

create or replace function public.ensure_manager_runtime_limits_v1()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.manager_runtime_limits(account_id,artist_workspace_id,artist_id)
  values(new.account_id,new.id,new.artist_id) on conflict do nothing;
  return new;
end$$;
drop trigger if exists ensure_manager_runtime_limits on public.artist_workspaces;
create trigger ensure_manager_runtime_limits after insert on public.artist_workspaces for each row execute function public.ensure_manager_runtime_limits_v1();

create or replace function public.claim_manager_runtime_admission_v1(p_account_id uuid,p_artist_workspace_id uuid,p_artist_id uuid,p_operation_key text,p_request_slots integer default 1,p_ttl_seconds integer default 180) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  v_id uuid;v_hour integer;v_day integer;v_operation_burst integer;v_active integer;
  v_tokens_hour bigint;v_tokens_day bigint;v_cost_day numeric;v_slots integer:=greatest(1,least(coalesce(p_request_slots,1),8));
  v_ttl integer:=greatest(30,least(coalesce(p_ttl_seconds,180),900));v_limits public.manager_runtime_limits%rowtype;
begin
  if p_operation_key is null or length(trim(p_operation_key))=0 then raise exception 'Manager runtime admission requires an operation key';end if;
  if not exists(select 1 from public.artist_workspaces w where w.id=p_artist_workspace_id and w.account_id=p_account_id and w.artist_id=p_artist_id and w.status='active') then return jsonb_build_object('allowed',false,'reason','workspace_not_active');end if;
  insert into public.manager_runtime_limits(account_id,artist_workspace_id,artist_id) values(p_account_id,p_artist_workspace_id,p_artist_id) on conflict do nothing;
  select * into v_limits from public.manager_runtime_limits where account_id=p_account_id and artist_workspace_id=p_artist_workspace_id and artist_id=p_artist_id for update;
  if not v_limits.background_ai_enabled then return jsonb_build_object('allowed',false,'reason','background_ai_disabled');end if;
  perform pg_advisory_xact_lock(hashtextextended(p_artist_workspace_id::text,918273));
  update public.manager_runtime_admissions set status='expired',completed_at=now(),failure_reason='Admission lease expired before completion.' where artist_workspace_id=p_artist_workspace_id and status='active' and expires_at<=now();
  select coalesce(sum(request_slots),0)::int into v_active from public.manager_runtime_admissions where artist_workspace_id=p_artist_workspace_id and status='active';
  select coalesce(sum(request_slots),0)::int into v_hour from public.manager_runtime_admissions where artist_workspace_id=p_artist_workspace_id and claimed_at>=now()-interval '1 hour';
  select coalesce(sum(request_slots),0)::int into v_day from public.manager_runtime_admissions where artist_workspace_id=p_artist_workspace_id and claimed_at>=now()-interval '24 hours';
  select coalesce(sum(request_slots),0)::int into v_operation_burst from public.manager_runtime_admissions where artist_workspace_id=p_artist_workspace_id and operation_key=p_operation_key and claimed_at>=now()-interval '10 minutes';
  select coalesce(sum(coalesce(input_tokens,0)+coalesce(output_tokens,0)+coalesce(reasoning_tokens,0)),0)::bigint into v_tokens_hour from public.ai_run_usage_events where artist_workspace_id=p_artist_workspace_id and started_at>=now()-interval '1 hour';
  select coalesce(sum(coalesce(input_tokens,0)+coalesce(output_tokens,0)+coalesce(reasoning_tokens,0)),0)::bigint,coalesce(sum(coalesce(provider_cost_estimate,0)),0) into v_tokens_day,v_cost_day from public.ai_run_usage_events where artist_workspace_id=p_artist_workspace_id and started_at>=now()-interval '24 hours';
  if v_active+v_slots>v_limits.max_active_slots then return jsonb_build_object('allowed',false,'reason','workspace_concurrency_limit','activeSlots',v_active);end if;
  if v_operation_burst+v_slots>v_limits.operation_burst_slots_10m then return jsonb_build_object('allowed',false,'reason','operation_burst_limit','burstSlots',v_operation_burst);end if;
  if v_hour+v_slots>v_limits.max_provider_slots_hour then return jsonb_build_object('allowed',false,'reason','hourly_provider_limit','hourSlots',v_hour);end if;
  if v_day+v_slots>v_limits.max_provider_slots_day then return jsonb_build_object('allowed',false,'reason','daily_provider_limit','daySlots',v_day);end if;
  if v_tokens_hour>=v_limits.max_tokens_hour then return jsonb_build_object('allowed',false,'reason','hourly_token_limit','tokens',v_tokens_hour);end if;
  if v_tokens_day>=v_limits.max_tokens_day then return jsonb_build_object('allowed',false,'reason','daily_token_limit','tokens',v_tokens_day);end if;
  if v_cost_day>=v_limits.max_cost_usd_day then return jsonb_build_object('allowed',false,'reason','daily_cost_limit','costUsd',v_cost_day);end if;
  insert into public.manager_runtime_admissions(account_id,artist_workspace_id,artist_id,operation_key,request_slots,expires_at) values(p_account_id,p_artist_workspace_id,p_artist_id,left(trim(p_operation_key),160),v_slots,now()+make_interval(secs=>v_ttl)) returning id into v_id;
  return jsonb_build_object('allowed',true,'admissionId',v_id,'expiresAt',now()+make_interval(secs=>v_ttl));
end$$;
revoke all on function public.claim_manager_runtime_admission_v1(uuid,uuid,uuid,text,integer,integer) from public,anon,authenticated;
grant execute on function public.claim_manager_runtime_admission_v1(uuid,uuid,uuid,text,integer,integer) to service_role;
