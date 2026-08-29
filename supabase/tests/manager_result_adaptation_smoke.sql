\set ON_ERROR_STOP on

do $$
declare
  definition text;
  trigger_definition text;
begin
  if to_regprocedure('public.queue_completed_task_result_adaptation_v1()') is null then
    raise exception 'queue_completed_task_result_adaptation_v1 is missing';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'queue_completed_task_result_adaptation'
      and not tgisinternal
  ) then
    raise exception 'completed Task result adaptation trigger is missing';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'reviews'
      and indexname = 'reviews_task_result_adaptation_due_idx'
  ) then
    raise exception 'Task result adaptation due-review index is missing';
  end if;

  select pg_get_functiondef('public.queue_completed_task_result_adaptation_v1()'::regprocedure)
  into definition;

  if position('mission_row.active_plan_version_id' in definition) = 0
     or position('task_row.mission_plan_version_id is distinct from mission_row.active_plan_version_id' in definition) = 0 then
    raise exception 'result adaptation does not protect the current canonical plan from stale Task results';
  end if;

  if position('content_post_result' in definition) = 0
     or position('task-result:' in definition) = 0 then
    raise exception 'result adaptation does not separate delayed content response reviews from generic immediate results';
  end if;

  if position('repeat the approach' in definition) = 0
     or position('change the route' in definition) = 0
     or position('stop the approach' in definition) = 0
     or position('collect one genuinely decision-changing piece of evidence' in definition) = 0 then
    raise exception 'result review does not require an explicit operating decision';
  end if;

  if position('do not wait for the artist to ask what next' in lower(definition)) = 0 then
    raise exception 'result adaptation does not enforce automatic continuation';
  end if;

  select pg_get_triggerdef(t.oid)
  into trigger_definition
  from pg_trigger t
  where t.tgname = 'queue_completed_task_result_adaptation'
    and not t.tgisinternal;

  if position('AFTER INSERT' in upper(trigger_definition)) = 0 then
    raise exception 'result adaptation trigger must run after durable result insertion';
  end if;
end;
$$;
