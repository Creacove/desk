-- Canonical evidence is durable workspace state. It must not be converted into
-- repeated artist confirmation work by model wording changes or concurrent
-- requests.

-- A task-result review is one logical operation per task at a time. The Edge
-- Function may be called twice by a double-click, a retry, or two tabs;
-- Postgres owns the concurrency boundary instead of a check-then-insert.
create unique index if not exists manager_task_result_one_running_review_idx
on public.manager_synthesis_runs (
  account_id,
  artist_workspace_id,
  (context_payload #>> '{input,taskId}')
)
where trigger_type = 'task_result'
  and status = 'running'
  and nullif(context_payload #>> '{input,taskId}', '') is not null;

-- The invariant is being introduced after older deployments already allowed
-- duplicate terminal rows. Preserve that history, but mark later replays as
-- superseded and retain only the first task-completion event for each task.
with ranked as (
  select id,
         row_number() over (partition by task_id order by created_at asc, id asc) as duplicate_rank
  from public.task_results
  where status = 'completed'
)
update public.task_results as result
set status = 'superseded'
from ranked
where result.id = ranked.id
  and ranked.duplicate_rank > 1;

with ranked as (
  select id,
         row_number() over (partition by task_id, event_type order by created_at asc, id asc) as duplicate_rank
  from public.operating_events
  where source_type = 'task_result'
    and event_type = 'task_completed'
    and task_id is not null
)
update public.operating_events as event
set event_type = 'task_completion_replayed',
    summary = coalesce(event.summary, 'Duplicate task completion replay retained as history.')
from ranked
where event.id = ranked.id
  and ranked.duplicate_rank > 1;

with ranked as (
  select id,
         row_number() over (partition by task_id, event_type order by created_at asc, id asc) as duplicate_rank
  from public.task_state_events
  where event_type = 'task_completed'
    and task_id is not null
)
update public.task_state_events as event
set event_type = 'task_completion_replayed',
    reason = coalesce(event.reason, 'Duplicate task completion replay retained as history.')
from ranked
where event.id = ranked.id
  and ranked.duplicate_rank > 1;

-- A task has one terminal completed result. Revisions remain historical rows,
-- but a duplicate accepted submission cannot create another adaptation review,
-- continuation chain, or permission side effect.
create unique index if not exists task_results_one_completed_per_task_idx
on public.task_results (task_id)
where status = 'completed';

create unique index if not exists operating_events_one_task_completion_idx
on public.operating_events (task_id, event_type)
where source_type = 'task_result'
  and event_type = 'task_completed'
  and task_id is not null;

create unique index if not exists task_state_events_one_task_completion_idx
on public.task_state_events (task_id, event_type)
where event_type = 'task_completed'
  and task_id is not null;

-- Follow-up task generation is a second persistence boundary. Keep Manager
-- work, but never turn an accepted result into another human confirmation of
-- the same evidence merely because the model changed the wording/title.
create or replace function public.manager_follow_up_repeats_source_v1(
  p_source_task_id uuid,
  p_follow_up jsonb
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  source_text text;
  follow_up_text text := lower(concat_ws(
    ' ',
    p_follow_up ->> 'title',
    p_follow_up ->> 'purpose',
    p_follow_up ->> 'completionExpectation',
    p_follow_up ->> 'userResponsibility',
    array_to_string(
      array(select jsonb_array_elements_text(coalesce(p_follow_up -> 'evidenceNeeded', '[]'::jsonb))),
      ' '
    )
  ));
begin
  if p_source_task_id is null or p_follow_up is null or jsonb_typeof(p_follow_up) <> 'object' then
    return false;
  end if;

  select lower(concat_ws(
    ' ',
    task.title,
    task.purpose,
    task.completion_expectation,
    task.user_responsibility,
    array_to_string(task.evidence_needed, ' ')
  ))
  into source_text
  from public.tasks as task
  where task.id = p_source_task_id;

  if source_text is null
     or follow_up_text !~ '\m(confirm|verify|re-?verify|attach|upload|replace|re-?submit|file[[:space:]]*id|one[[:space:]-]*line)\M' then
    return false;
  end if;

  return (
    (source_text ~ '\m(audio|final[_ -]*master|working[_ -]*master|rough[_ -]*mix|demo|instrumental|stems?)\M'
      and follow_up_text ~ '\m(audio|final[_ -]*master|working[_ -]*master|rough[_ -]*mix|demo|instrumental|stems?)\M')
    or
    (source_text ~ '\m(artwork|cover|photo|image|visual)\M'
      and follow_up_text ~ '\m(artwork|cover|photo|image|visual)\M')
    or
    (source_text ~ '\m(lyrics?)\M' and follow_up_text ~ '\m(lyrics?)\M')
    or
    (source_text ~ '\m(metadata|isrc|upc|distributor|release[[:space:]]+date)\M'
      and follow_up_text ~ '\m(metadata|isrc|upc|distributor|release[[:space:]]+date)\M')
    or
    (source_text ~ '\m(split|credit|royalt(y|ies)|rights|publishing)\M'
      and follow_up_text ~ '\m(split|credit|royalt(y|ies)|rights|publishing)\M')
    or
    (source_text ~ '\m(document|report|brief|sheet|export|contract|epk|pitch)\M'
      and follow_up_text ~ '\m(document|report|brief|sheet|export|contract|epk|pitch)\M')
    or
    (source_text ~ '\m(campaign|performance|metric|conversion|audience)\M'
      and follow_up_text ~ '\m(campaign|performance|metric|conversion|audience)\M')
  );
end;
$$;

revoke all on function public.manager_follow_up_repeats_source_v1(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.manager_follow_up_repeats_source_v1(uuid, jsonb) to service_role;

create or replace function public.suppress_redundant_human_follow_ups_v1()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  follow_up_tasks jsonb;
  filtered_tasks jsonb;
begin
  if new.source_type <> 'task_result'
     or new.actor_type <> 'manager'
     or new.event_type <> 'task_completed'
     or new.task_id is null
     or jsonb_typeof(coalesce(new.payload -> 'followUpTasks', '[]'::jsonb)) <> 'array' then
    return new;
  end if;

  follow_up_tasks := coalesce(new.payload -> 'followUpTasks', '[]'::jsonb);
  select coalesce(jsonb_agg(entry.item order by entry.ordinality), '[]'::jsonb)
  into filtered_tasks
  from jsonb_array_elements(follow_up_tasks) with ordinality as entry(item, ordinality)
  where not (
    lower(trim(coalesce(entry.item ->> 'ownerRole', entry.item ->> 'owner_role', ''))) not in ('manager', 'desk', 'ai', 'ai manager')
    and public.manager_follow_up_repeats_source_v1(new.task_id, entry.item)
  );

  new.payload := jsonb_set(coalesce(new.payload, '{}'::jsonb), '{followUpTasks}', filtered_tasks, true);
  return new;
end;
$$;

revoke all on function public.suppress_redundant_human_follow_ups_v1() from public, anon, authenticated;
grant execute on function public.suppress_redundant_human_follow_ups_v1() to service_role;

drop trigger if exists suppress_redundant_human_follow_ups on public.operating_events;
create trigger suppress_redundant_human_follow_ups
before insert on public.operating_events
for each row
execute function public.suppress_redundant_human_follow_ups_v1();
