-- Lease-own background action decisions and fail closed when an approved
-- external effect is abandoned with an unknown provider outcome.

alter table public.manager_action_candidates
  add column if not exists lease_token uuid;

drop function if exists public.claim_manager_action_candidate_v1(uuid);
create function public.claim_manager_action_candidate_v1(p_candidate_id uuid)
returns table (
  id uuid,
  account_id uuid,
  artist_workspace_id uuid,
  artist_id uuid,
  mission_id uuid,
  action_kind text,
  target_type text,
  target_id uuid,
  effect_fingerprint text,
  attempt_count integer,
  context_payload jsonb,
  lease_token uuid
)
language plpgsql security definer set search_path=public as $$
begin
  return query
  update public.manager_action_candidates as candidate
  set status='running',
      attempt_count=least(8,candidate.attempt_count+1),
      claimed_at=now(),
      lease_token=gen_random_uuid(),
      last_error=null,
      updated_at=now()
  where candidate.id=p_candidate_id
    and candidate.status='due'
    and candidate.available_at<=now()
    and coalesce((
      select limits.background_ai_enabled
      from public.manager_runtime_limits as limits
      where limits.account_id=candidate.account_id
        and limits.artist_workspace_id=candidate.artist_workspace_id
        and limits.artist_id=candidate.artist_id
    ),true)
  returning candidate.id,candidate.account_id,candidate.artist_workspace_id,
    candidate.artist_id,candidate.mission_id,candidate.action_kind,
    candidate.target_type,candidate.target_id,candidate.effect_fingerprint,
    candidate.attempt_count,candidate.context_payload,candidate.lease_token;
end;
$$;
revoke all on function public.claim_manager_action_candidate_v1(uuid) from public,anon,authenticated;
grant execute on function public.claim_manager_action_candidate_v1(uuid) to service_role;

create or replace function public.persist_manager_action_candidate_intent_v1(
  p_candidate_id uuid,
  p_lease_token uuid,
  p_run_id uuid,
  p_reason text
) returns uuid
language plpgsql security definer set search_path=public as $$
declare candidate public.manager_action_candidates%rowtype;action_id uuid;
begin
  select * into candidate
  from public.manager_action_candidates
  where id=p_candidate_id
  for update;
  if candidate.id is null or candidate.status<>'running' or candidate.lease_token is distinct from p_lease_token then
    raise exception 'Manager action candidate lease is no longer owned by this worker.';
  end if;
  if not exists(
    select 1 from public.manager_synthesis_runs as run
    where run.id=p_run_id
      and run.account_id=candidate.account_id
      and run.artist_workspace_id=candidate.artist_workspace_id
      and run.artist_id=candidate.artist_id
      and run.status='running'
  ) then raise exception 'Manager action decision run is not active for this candidate.';end if;

  insert into public.manager_run_actions(
    account_id,artist_workspace_id,artist_id,manager_synthesis_run_id,
    order_index,action_type,target_type,status,approval_required,payload,result_payload
  ) values(
    candidate.account_id,candidate.artist_workspace_id,candidate.artist_id,p_run_id,
    0,'prepare_split_confirmations_for_approval','focused_music_item','pending',false,
    jsonb_build_object(
      'actionType','prepare_split_confirmations_for_approval',
      'targetType','focused_music_item',
      'title','Prepare split confirmations',
      'body',left(coalesce(p_reason,''),600),
      'approvalRequired',false
    ),'{}'::jsonb
  ) returning id into action_id;
  return action_id;
end;
$$;
revoke all on function public.persist_manager_action_candidate_intent_v1(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.persist_manager_action_candidate_intent_v1(uuid,uuid,uuid,text) to service_role;

create or replace function public.complete_manager_action_candidate_v2(
  p_candidate_id uuid,
  p_lease_token uuid,
  p_run_id uuid,
  p_decision text,
  p_reason text
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare candidate public.manager_action_candidates%rowtype;
begin
  select * into candidate
  from public.manager_action_candidates
  where id=p_candidate_id
  for update;
  if candidate.id is null or candidate.status<>'running' or candidate.lease_token is distinct from p_lease_token then
    raise exception 'Manager action candidate lease is no longer owned by this worker.';
  end if;
  return public.complete_manager_action_candidate_v1(p_candidate_id,p_run_id,p_decision,p_reason);
end;
$$;
revoke all on function public.complete_manager_action_candidate_v2(uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.complete_manager_action_candidate_v2(uuid,uuid,uuid,text,text) to service_role;
revoke execute on function public.complete_manager_action_candidate_v1(uuid,uuid,text,text) from service_role;

create or replace function public.requeue_manager_action_candidate_v2(
  p_candidate_id uuid,
  p_lease_token uuid,
  p_error text
) returns text
language plpgsql security definer set search_path=public as $$
declare candidate public.manager_action_candidates%rowtype;
begin
  select * into candidate
  from public.manager_action_candidates
  where id=p_candidate_id
  for update;
  if candidate.id is null then return 'missing';end if;
  if candidate.status='completed' then return 'completed';end if;
  if candidate.status<>'running' or candidate.lease_token is distinct from p_lease_token then return 'stale_lease';end if;
  return public.requeue_manager_action_candidate_v1(p_candidate_id,p_error);
end;
$$;
revoke all on function public.requeue_manager_action_candidate_v2(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.requeue_manager_action_candidate_v2(uuid,uuid,text) to service_role;
revoke execute on function public.requeue_manager_action_candidate_v1(uuid,text) from service_role;

create or replace function public.defer_manager_action_candidate_v1(
  p_candidate_id uuid,
  p_lease_token uuid,
  p_reason text
) returns text
language plpgsql security definer set search_path=public as $$
begin
  update public.manager_action_candidates as candidate
  set status='due',
      attempt_count=greatest(0,candidate.attempt_count-1),
      claimed_at=null,
      lease_token=null,
      last_error=left(coalesce(p_reason,'Manager runtime admission deferred.'),1000),
      available_at=now()+interval '2 minutes',
      updated_at=now()
  where candidate.id=p_candidate_id
    and candidate.status='running'
    and candidate.lease_token=p_lease_token;
  return case when found then 'due' else 'stale_lease' end;
end;
$$;
revoke all on function public.defer_manager_action_candidate_v1(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.defer_manager_action_candidate_v1(uuid,uuid,text) to service_role;

create or replace function public.reap_stale_manager_action_candidates_v1()
returns integer
language plpgsql security definer set search_path=public as $$
declare recovered integer;
begin
  update public.manager_action_candidates
  set status=case when attempt_count>=5 then 'cancelled' else 'due' end,
      claimed_at=null,
      lease_token=null,
      last_error='Manager action candidate claim expired before completion.',
      available_at=case when attempt_count>=5 then available_at else now() end,
      updated_at=now()
  where status='running'
    and claimed_at is not null
    and claimed_at<now()-interval '10 minutes';
  get diagnostics recovered=row_count;
  return recovered;
end;
$$;
revoke all on function public.reap_stale_manager_action_candidates_v1() from public,anon,authenticated;
grant execute on function public.reap_stale_manager_action_candidates_v1() to service_role;

create or replace function public.recover_stale_manager_action_executions_v1(batch_size integer default 20)
returns integer
language plpgsql security definer set search_path=public as $$
declare receipt record;recovered integer:=0;
begin
  for receipt in
    select execution.id
    from public.manager_action_execution_receipts as execution
    where execution.status='claimed'
      and execution.claimed_at<now()-interval '10 minutes'
    order by execution.claimed_at,execution.id
    for update skip locked
    limit greatest(1,least(coalesce(batch_size,20),100))
  loop
    perform public.fail_manager_action_execution_v1(
      receipt.id,
      'Approved external action claim expired before Desk could confirm the provider outcome.',
      jsonb_build_object('recoveredAt',now(),'automaticRetryAllowed',false),
      true
    );
    recovered:=recovered+1;
  end loop;
  return recovered;
end;
$$;
revoke all on function public.recover_stale_manager_action_executions_v1(integer) from public,anon,authenticated;
grant execute on function public.recover_stale_manager_action_executions_v1(integer) to service_role;

do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname='manager-external-action-recovery';
  perform cron.schedule(
    'manager-external-action-recovery',
    '* * * * *',
    'select public.recover_stale_manager_action_executions_v1(20);'
  );
end;
$$;
