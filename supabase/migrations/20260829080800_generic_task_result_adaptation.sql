-- Close the generic Task result -> Manager review handoff.
--
-- A completed human Task is operating reality. Desk must react without waiting for
-- the artist to type "what next?". Content posts keep their existing bounded
-- response-window review because a public URL is not immediate performance data;
-- every other completed current-plan Task queues an immediate adaptive review.

create index if not exists reviews_task_result_adaptation_due_idx
on public.reviews (review_at, created_at, id)
where trigger_type = 'adaptive_replan'
  and runtime_key like 'task-result:%'
  and status in ('scheduled', 'due');

create or replace function public.queue_completed_task_result_adaptation_v1()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  mission_row public.missions%rowtype;
  task_row public.tasks%rowtype;
  result_kind text;
  result_confidence text;
  review_key text;
begin
  if new.status <> 'completed'::public.task_result_status
     or new.mission_id is null
     or new.task_id is null then
    return new;
  end if;

  -- Content publishing has a deliberately delayed response-window review. Do not
  -- create a second immediate review for the same result.
  result_kind := coalesce(new.raw_event ->> 'result_kind', '');
  if result_kind = 'content_post_result' then
    return new;
  end if;

  select * into mission_row
  from public.missions
  where id = new.mission_id
    and account_id = new.account_id
    and artist_workspace_id = new.artist_workspace_id
    and artist_id = new.artist_id;

  if not found
     or mission_row.status in ('complete', 'archived', 'cancelled')
     or mission_row.active_plan_version_id is null then
    return new;
  end if;

  select * into task_row
  from public.tasks
  where id = new.task_id
    and account_id = new.account_id
    and artist_workspace_id = new.artist_workspace_id
    and artist_id = new.artist_id
    and mission_id = new.mission_id;

  -- Late evidence from superseded work is retained as history but cannot mutate
  -- the current route.
  if not found
     or task_row.mission_plan_version_id is distinct from mission_row.active_plan_version_id then
    return new;
  end if;

  result_confidence := coalesce(nullif(new.confidence::text, ''), 'unknown');
  review_key := 'task-result:' || new.id::text;

  insert into public.reviews (
    account_id,
    artist_workspace_id,
    artist_id,
    mission_id,
    checkpoint_id,
    trigger_type,
    trigger_object_type,
    trigger_object_id,
    previous_recommendation,
    current_read,
    what_changed,
    next_action,
    status,
    review_at,
    created_from_run_id,
    runtime_key
  ) values (
    new.account_id,
    new.artist_workspace_id,
    new.artist_id,
    new.mission_id,
    new.checkpoint_id,
    'adaptive_replan',
    'task',
    new.task_id,
    mission_row.current_recommendation,
    concat(
      'Human Task completed. Result confidence: ', result_confidence,
      '. Result summary: ', coalesce(nullif(new.summary, ''), 'No structured summary supplied.'),
      case when nullif(btrim(coalesce(new.user_note, '')), '') is not null
        then ' Artist result note: ' || left(btrim(new.user_note), 1200)
        else '' end
    ),
    'A current-plan human Task produced a real result. The Manager must compare that result with the active hypothesis, checkpoint decision rule, and success indicators.',
    'Make the operating decision now: repeat the approach, change the route, stop the approach, or collect one genuinely decision-changing piece of evidence. If the current route still holds, confirm it and release the next existing work. If reality invalidates remaining work, install a coherent replacement plan. Do not recreate completed accepted work and do not wait for the artist to ask what next.',
    'due',
    now(),
    new.created_from_run_id,
    review_key
  )
  on conflict (artist_workspace_id, runtime_key)
    where runtime_key is not null
  do nothing;

  return new;
end;
$$;

revoke all on function public.queue_completed_task_result_adaptation_v1() from public, anon, authenticated;

drop trigger if exists queue_completed_task_result_adaptation on public.task_results;
create trigger queue_completed_task_result_adaptation
after insert on public.task_results
for each row
execute function public.queue_completed_task_result_adaptation_v1();
