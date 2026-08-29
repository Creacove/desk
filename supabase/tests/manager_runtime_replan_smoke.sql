\set ON_ERROR_STOP on

-- This smoke intentionally validates the durable runtime contract without
-- depending on fixture artists. Fresh migration application is the main signal:
-- the functions, triggers and cron routes must all resolve in a new database.

do $$
declare
  definition text;
  cron_command text;
begin
  if to_regprocedure('public.finalize_manager_replan_v1(uuid,uuid,jsonb)') is null then
    raise exception 'finalize_manager_replan_v1 is missing';
  end if;
  if to_regprocedure('public.claim_manager_runtime_review_v2(uuid)') is null then
    raise exception 'claim_manager_runtime_review_v2 is missing';
  end if;
  if to_regprocedure('public.requeue_manager_runtime_review_v1(uuid,text)') is null then
    raise exception 'requeue_manager_runtime_review_v1 is missing';
  end if;
  if to_regprocedure('public.reap_stale_manager_runtime_reviews_v1()') is null then
    raise exception 'reap_stale_manager_runtime_reviews_v1 is missing';
  end if;
  if to_regprocedure('public.dispatch_due_manager_runtime_reviews_v1()') is null then
    raise exception 'dispatch_due_manager_runtime_reviews_v1 is missing';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'reviews'
      and column_name = 'runtime_claimed_at'
  ) then
    raise exception 'reviews.runtime_claimed_at is missing';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'reviews'
      and column_name = 'runtime_attempt_count'
  ) then
    raise exception 'reviews.runtime_attempt_count is missing';
  end if;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'reviews_one_running_adaptive_replan_per_mission_uidx'
  ) then
    raise exception 'adaptive replan per-Mission serialization index is missing';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname = 'queue_adaptive_replan_review'
      and not tgisinternal
  ) then
    raise exception 'plan_replan_required trigger is missing';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname = 'guard_adaptive_replan_plan_swap'
      and not tgisinternal
  ) then
    raise exception 'adaptive plan swap concurrency guard is missing';
  end if;

  select pg_get_functiondef('public._queue_adaptive_replan_review()'::regprocedure)
  into definition;
  if position('/functions/v1/workflow-recovery' in definition) = 0
     or position('adaptive_replan' in definition) = 0 then
    raise exception 'adaptive replan trigger bypasses workflow-recovery';
  end if;

  select pg_get_functiondef('public.guard_adaptive_replan_plan_swap_v1()'::regprocedure)
  into definition;
  if position('active_plan_version_id' in definition) = 0
     or position('adaptive_plan_compiler_v1' in definition) = 0 then
    raise exception 'adaptive plan swap guard does not validate compiler plan context';
  end if;

  select command into cron_command
  from cron.job
  where jobname = 'manager-runtime-review-recovery'
  limit 1;
  if cron_command is null or position('dispatch_due_manager_runtime_reviews_v1' in cron_command) = 0 then
    raise exception 'manager-runtime-review-recovery cron is not hardened';
  end if;

  select command into cron_command
  from cron.job
  where jobname = 'manager-reminder-dispatcher'
  limit 1;
  if cron_command is null
     or position('/functions/v1/workflow-recovery' in cron_command) = 0
     or position('dispatch_reminders' in cron_command) = 0 then
    raise exception 'manager-reminder-dispatcher does not route through workflow-recovery';
  end if;
end;
$$;
