-- Gate 7 closure: the continuation event writer must match the existing partial
-- unique index on operating_events(artist_workspace_id, dedupe_key).
-- Without the predicate, PostgreSQL cannot infer the index and a completed
-- adaptive review fails exactly when Desk should publish the next executable work.

create or replace function public.apply_manager_review_continuation_v1()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  mission_row public.missions%rowtype;
  next_task record;
  continuation_kind text;
  continuation_text text;
begin
  if new.trigger_type <> 'adaptive_replan'
     or new.status <> 'completed'
     or old.status = 'completed'
     or new.mission_id is null
     or new.outcome not in ('no_change', 'replanned') then
    return new;
  end if;

  select * into mission_row
  from public.missions
  where id = new.mission_id
    and account_id = new.account_id
    and artist_workspace_id = new.artist_workspace_id
    and artist_id = new.artist_id;

  if not found or mission_row.active_plan_version_id is null then
    return new;
  end if;

  select * into next_task
  from public.manager_next_executable_task_v1(
    mission_row.id,
    mission_row.active_plan_version_id,
    case when new.outcome = 'no_change' then new.trigger_object_id else null end
  );

  if next_task.task_id is not null then
    continuation_kind := 'next_task';
    continuation_text := 'Next: ' || next_task.title;
  elsif exists (
    select 1
    from public.checkpoints as checkpoint
    where checkpoint.mission_id = mission_row.id
      and checkpoint.mission_plan_version_id = mission_row.active_plan_version_id
      and checkpoint.status in ('waiting', 'blocked', 'ready_for_manager_check', 'watching_signal', 'needs_revision')
  ) then
    continuation_kind := 'manager_checkpoint';
    continuation_text := 'No human action is required right now. Desk is holding the route at the next Manager decision gate.';
  else
    continuation_kind := 'no_human_work';
    continuation_text := 'No further human action is currently required for this Mission.';
  end if;

  update public.reviews
  set next_action = continuation_text
  where id = new.id;

  update public.operating_events
  set refresh_scope = (
        select array_agg(distinct scope order by scope)
        from unnest(coalesce(refresh_scope, '{}'::text[]) || array['missions', 'tasks', 'today', 'activity']::text[]) as scope
      ),
      payload = coalesce(payload, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
        'continuationKind', continuation_kind,
        'nextTaskId', next_task.task_id,
        'nextTaskTitle', next_task.title,
        'nextTaskStatus', next_task.status,
        'continuation', continuation_text
      ))
  where manager_synthesis_run_id = new.created_from_run_id
    and mission_id = new.mission_id
    and event_type in ('manager_replan_not_needed', 'manager_replanned_mission');

  insert into public.operating_events (
    account_id, artist_workspace_id, artist_id, event_type, actor_type,
    target_type, target_id, source_type, source_id, manager_synthesis_run_id,
    mission_id, checkpoint_id, task_id, dedupe_key, display_mode, refresh_scope,
    summary, payload
  ) values (
    new.account_id,
    new.artist_workspace_id,
    new.artist_id,
    'manager_continuation_ready',
    'manager',
    case when next_task.task_id is not null then 'task' else 'mission' end,
    coalesce(next_task.task_id, mission_row.id),
    'manager_runtime_review',
    new.id,
    new.created_from_run_id,
    mission_row.id,
    new.checkpoint_id,
    next_task.task_id,
    'manager-continuation:' || new.id::text,
    case when next_task.task_id is not null then 'action' else 'activity' end,
    array['missions', 'tasks', 'today', 'activity']::text[],
    continuation_text,
    jsonb_strip_nulls(jsonb_build_object(
      'reviewId', new.id,
      'reviewOutcome', new.outcome,
      'planId', mission_row.active_plan_version_id,
      'continuationKind', continuation_kind,
      'nextTaskId', next_task.task_id,
      'nextTaskTitle', next_task.title,
      'nextTaskStatus', next_task.status
    ))
  )
  on conflict (artist_workspace_id, dedupe_key)
  where dedupe_key is not null
  do nothing;

  return new;
end;
$$;

revoke all on function public.apply_manager_review_continuation_v1() from public, anon, authenticated;
