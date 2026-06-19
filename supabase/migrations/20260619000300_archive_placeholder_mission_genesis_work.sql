with placeholder_missions as (
  select m.id
  from public.missions m
  where m.status = 'active'
    and m.originating_trigger = 'manual_mission_genesis'
    and m.title = 'Test whether current attention is becoming repeatable audience behavior'
    and (
      m.review_point = 'Objective quality'
      or m.pattern_name = 'Audience Development'
      or exists (
        select 1
        from public.checkpoints c
        where c.mission_id = m.id
          and c.title = 'Objective quality'
      )
      or exists (
        select 1
        from public.tasks t
        where t.mission_id = m.id
          and t.title = 'Prepare first Manager read'
      )
    )
)
update public.missions m
set status = 'archived',
    archived_at = coalesce(m.archived_at, now()),
    current_recommendation = 'Archived because this Mission Genesis row came from the removed placeholder fallback path. Rerun Mission Genesis to create source-backed production work.',
    updated_at = now()
where m.id in (select id from placeholder_missions);

with placeholder_missions as (
  select m.id
  from public.missions m
  where m.status = 'archived'
    and m.originating_trigger = 'manual_mission_genesis'
    and m.title = 'Test whether current attention is becoming repeatable audience behavior'
    and m.current_recommendation like 'Archived because this Mission Genesis row came from the removed placeholder fallback path.%'
)
update public.mission_plan_versions mpv
set status = 'archived'
where mpv.mission_id in (select id from placeholder_missions)
  and mpv.status = 'active';

with placeholder_missions as (
  select m.id
  from public.missions m
  where m.status = 'archived'
    and m.originating_trigger = 'manual_mission_genesis'
    and m.title = 'Test whether current attention is becoming repeatable audience behavior'
    and m.current_recommendation like 'Archived because this Mission Genesis row came from the removed placeholder fallback path.%'
)
update public.tasks t
set status = 'archived',
    archived_at = coalesce(t.archived_at, now()),
    updated_at = now()
where t.mission_id in (select id from placeholder_missions)
  and t.status not in ('completed', 'archived', 'rejected', 'superseded');

with placeholder_missions as (
  select m.id
  from public.missions m
  where m.status = 'archived'
    and m.originating_trigger = 'manual_mission_genesis'
    and m.title = 'Test whether current attention is becoming repeatable audience behavior'
    and m.current_recommendation like 'Archived because this Mission Genesis row came from the removed placeholder fallback path.%'
)
update public.checkpoints c
set status = 'skipped',
    recommendation = 'Archived because this checkpoint came from the removed placeholder Mission Genesis fallback.',
    updated_at = now()
where c.mission_id in (select id from placeholder_missions)
  and c.status in ('waiting', 'blocked', 'ready_for_manager_check', 'watching_signal', 'needs_revision');

notify pgrst, 'reload schema';
