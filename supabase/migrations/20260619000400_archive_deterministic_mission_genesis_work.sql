-- Every mission created by the retired client-side Mission Genesis engine was
-- deterministic. Archive the complete graph so only OpenAI-authored Genesis
-- work can appear in the production mission workspace.
with retired_missions as (
  select id
  from public.missions
  where originating_trigger = 'manual_mission_genesis'
    and status in ('candidate', 'active', 'blocked', 'review', 'paused')
)
update public.tasks
set status = 'archived',
    archived_at = coalesce(archived_at, now()),
    updated_at = now()
where mission_id in (select id from retired_missions)
  and status not in ('completed', 'archived', 'rejected', 'superseded');

with retired_missions as (
  select id
  from public.missions
  where originating_trigger = 'manual_mission_genesis'
    and status in ('candidate', 'active', 'blocked', 'review', 'paused')
)
update public.checkpoints
set status = 'skipped',
    recommendation = 'Archived because this checkpoint came from the retired deterministic Mission Genesis engine.',
    updated_at = now()
where mission_id in (select id from retired_missions)
  and status in ('waiting', 'blocked', 'ready_for_manager_check', 'watching_signal', 'needs_revision');

with retired_missions as (
  select id
  from public.missions
  where originating_trigger = 'manual_mission_genesis'
    and status in ('candidate', 'active', 'blocked', 'review', 'paused')
)
update public.mission_plan_versions
set status = 'archived'
where mission_id in (select id from retired_missions)
  and status in ('draft', 'active');

update public.missions
set status = 'archived',
    archived_at = coalesce(archived_at, now()),
    active_plan_version_id = null,
    current_recommendation = 'Archived because this mission came from the retired deterministic Mission Genesis engine. Run Mission Genesis again for an OpenAI-authored decision.',
    updated_at = now()
where originating_trigger = 'manual_mission_genesis'
  and status in ('candidate', 'active', 'blocked', 'review', 'paused');

notify pgrst, 'reload schema';
