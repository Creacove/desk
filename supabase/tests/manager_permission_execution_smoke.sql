\set ON_ERROR_STOP on

do $$
declare
  definition text;
  complete_definition text;
  fail_definition text;
  prepare_definition text;
begin
  if to_regclass('public.manager_action_execution_receipts') is null then
    raise exception 'manager_action_execution_receipts is missing';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'permission_requests' and column_name = 'resolved_at'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'permission_requests' and column_name = 'resolved_by_user_id'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'permission_requests' and column_name = 'decision_note'
  ) then
    raise exception 'permission resolution metadata is incomplete';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'music_split_confirmations' and column_name = 'provider_message_id'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'music_split_confirmations' and column_name = 'manager_action_execution_id'
  ) then
    raise exception 'split confirmation execution receipt columns are missing';
  end if;

  if to_regprocedure('public.prepare_split_confirmation_manager_permission_v1(uuid,uuid,uuid,text,text,text)') is null then
    raise exception 'prepare_split_confirmation_manager_permission_v1 is missing';
  end if;
  if to_regprocedure('public.resolve_manager_permission_v1(uuid,uuid,text,text)') is null then
    raise exception 'resolve_manager_permission_v1 is missing';
  end if;
  if to_regprocedure('public.complete_manager_action_execution_v1(uuid,jsonb)') is null then
    raise exception 'complete_manager_action_execution_v1 is missing';
  end if;
  if to_regprocedure('public.fail_manager_action_execution_v1(uuid,text,jsonb,boolean)') is null then
    raise exception 'fail_manager_action_execution_v1 is missing';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'protect_permission_bound_manager_action' and not tgisinternal
  ) then
    raise exception 'permission-bound action mutation guard is missing';
  end if;
  if not exists (
    select 1 from pg_trigger
    where tgname = 'rebind_legacy_manager_permission' and not tgisinternal
  ) then
    raise exception 'legacy permission safety rebind trigger is missing';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'manager_action_execution_receipts'
      and indexdef ilike '%UNIQUE%manager_run_action_id%'
  ) then
    raise exception 'manager action execution is not unique per Manager action';
  end if;
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'manager_action_execution_receipts'
      and indexdef ilike '%UNIQUE%permission_request_id%'
  ) then
    raise exception 'manager action execution is not unique per permission request';
  end if;
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'manager_action_execution_receipts'
      and indexdef ilike '%UNIQUE%execution_key%'
  ) then
    raise exception 'manager action execution key is not unique';
  end if;

  select pg_get_functiondef('public.resolve_manager_permission_v1(uuid,uuid,text,text)'::regprocedure)
  into definition;
  if position('permission_row.parameters' in definition) = 0
     or position('action_row.payload' in definition) = 0
     or position('manager_action_execution_receipts' in definition) = 0
     or position('prepared_only' in definition) = 0
     or position('shouldExecute' in definition) = 0
     or position('rejected_move' in definition) = 0
     or position('adaptive_replan' in definition) = 0
     or position('runtime_key' in definition) = 0 then
    raise exception 'permission resolution is missing immutable binding, one-shot claim, unsupported-action safety, rejection memory, or Manager continuation';
  end if;

  -- Approval is only authorization. The external action may become applied only
  -- after the execution receipt is completed with a real result.
  if position('set status = ''applied''' in lower(definition)) > 0 then
    raise exception 'permission approval incorrectly marks the Manager action applied';
  end if;

  select pg_get_functiondef('public.complete_manager_action_execution_v1(uuid,jsonb)'::regprocedure)
  into complete_definition;
  if position('permission_row.status <> ''approved''' in lower(complete_definition)) = 0
     or position('set status = ''applied''' in lower(complete_definition)) = 0
     or position('manager_external_action_executed' in complete_definition) = 0
     or position('adaptive_replan' in complete_definition) = 0
     or position('runtime_key' in complete_definition) = 0 then
    raise exception 'successful execution does not require approval, persist completion, or continue the Manager loop';
  end if;

  select pg_get_functiondef('public.fail_manager_action_execution_v1(uuid,text,jsonb,boolean)'::regprocedure)
  into fail_definition;
  if position('indeterminate' in fail_definition) = 0
     or position('automaticRetryAllowed' in fail_definition) = 0
     or position('false' in lower(fail_definition)) = 0
     or position('manager_external_action_failed' in fail_definition) = 0
     or position('manager_external_action_indeterminate' in fail_definition) = 0
     or position('set status = ''failed''' in lower(fail_definition)) = 0 then
    raise exception 'failed/indeterminate execution is not safely persisted';
  end if;

  select pg_get_functiondef('public.prepare_split_confirmation_manager_permission_v1(uuid,uuid,uuid,text,text,text)'::regprocedure)
  into prepare_definition;
  if position('split.status = ''draft''' in lower(prepare_definition)) = 0
     or position('publishing_sum' in prepare_definition) = 0
     or position('master_sum' in prepare_definition) = 0
     or position('recipients' in prepare_definition) = 0
     or position('send_split_confirmations' in prepare_definition) = 0
     or position('approval_required' in prepare_definition) = 0 then
    raise exception 'split confirmation permission does not freeze a decision-ready executable effect';
  end if;

  -- The existing global Manager review dispatcher is the continuation path.
  -- This slice must not introduce a permission-specific cron.
  if not exists (
    select 1 from cron.job
    where jobname = 'manager-runtime-review-recovery' and active
  ) then
    raise exception 'permission continuation cannot reuse the Manager runtime review dispatcher';
  end if;
end;
$$;
