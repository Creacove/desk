-- Schedule one bounded Manager response review after a real content post result.
--
-- This reuses the existing durable reviews queue and global adaptive-runtime
-- dispatcher. There is no per-artist cron and no claim that a public URL alone
-- gives Desk automatic platform metrics. At the response window the Manager must
-- use only reliable evidence already present; if none exists, it may ask one
-- narrow task-scoped result question through the existing Question Engine.

alter table public.reviews
  add column if not exists runtime_key text;

create unique index if not exists reviews_runtime_key_uidx
on public.reviews (artist_workspace_id, runtime_key)
where runtime_key is not null;

create index if not exists reviews_content_response_due_idx
on public.reviews (review_at, created_at, id)
where trigger_type = 'adaptive_replan'
  and runtime_key like 'content-response:%'
  and status in ('scheduled', 'due');

create or replace function public.queue_content_response_review_v1()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  mission_row public.missions%rowtype;
  task_row public.tasks%rowtype;
  observation_boundary text;
  primary_ref text;
  review_key text;
begin
  if new.event_type <> 'content_post_result_recorded'
     or new.mission_id is null
     or new.task_id is null
     or new.source_id is null then
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

  -- A late result from superseded work must not reopen an old route.
  if not found
     or task_row.mission_plan_version_id is distinct from mission_row.active_plan_version_id then
    return new;
  end if;

  observation_boundary := coalesce(nullif(new.payload ->> 'observationBoundary', ''), 'artist_report_only');
  primary_ref := nullif(new.payload -> 'externalRefs' ->> 0, '');
  review_key := 'content-response:' || new.source_id::text;

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
      'Content response-window review. Observation boundary: ', observation_boundary,
      case when primary_ref is not null then '. Public post reference: ' || primary_ref else '. No public post URL was supplied.' end,
      ' A public reference is not proof that Desk can inspect the media, comments, or platform metrics.'
    ),
    'The artist completed a content publishing action. Re-evaluate the route after the first response window using only reliable evidence that exists at review time.',
    'At the response window, compare any reliable observed or artist-reported response against the Mission hypothesis and baseline. Never invent views, engagement, comment sentiment, or visual critique. If no decision-grade response evidence exists, ask one narrow task-scoped result question through the existing Question Engine. Make the best next-route decision from that answer; do not require the artist to type continue.',
    'scheduled',
    coalesce(new.created_at, now()) + interval '24 hours',
    new.manager_synthesis_run_id,
    review_key
  )
  on conflict (artist_workspace_id, runtime_key)
    where runtime_key is not null
  do nothing;

  return new;
end;
$$;

revoke all on function public.queue_content_response_review_v1() from public, anon, authenticated;

drop trigger if exists queue_content_response_review on public.operating_events;
create trigger queue_content_response_review
after insert on public.operating_events
for each row
execute function public.queue_content_response_review_v1();
