-- Prevent a slow adaptive compiler from overwriting a newer plan.
--
-- The runner stores the active plan it actually read in manager_synthesis_runs
-- context_payload. The finalizer inserts its replacement graph in one database
-- transaction and eventually swaps missions.active_plan_version_id. This trigger
-- checks that the old value at that exact swap is still the plan the runner read.
-- Raising here rolls the entire finalizer transaction back, including the newly
-- inserted plan/tasks/checkpoints.

create unique index if not exists reviews_one_running_adaptive_replan_per_mission_uidx
on public.reviews (mission_id)
where trigger_type = 'adaptive_replan'
  and status = 'running'
  and mission_id is not null;

create or replace function public.guard_adaptive_replan_plan_swap_v1()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  generated_run_id uuid;
  run_classification text;
  expected_plan_id uuid;
begin
  if new.active_plan_version_id is not distinct from old.active_plan_version_id then
    return new;
  end if;

  if new.active_plan_version_id is null then
    return new;
  end if;

  select plan.generated_from_run_id
  into generated_run_id
  from public.mission_plan_versions as plan
  where plan.id = new.active_plan_version_id
    and plan.mission_id = new.id;

  if generated_run_id is null then
    return new;
  end if;

  select
    run.classification,
    nullif(run.context_payload -> 'mission' ->> 'active_plan_version_id', '')::uuid
  into run_classification, expected_plan_id
  from public.manager_synthesis_runs as run
  where run.id = generated_run_id;

  if run_classification <> 'adaptive_plan_compiler_v1' then
    return new;
  end if;

  if expected_plan_id is distinct from old.active_plan_version_id then
    raise exception 'Adaptive replan became stale before atomic plan swap';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_adaptive_replan_plan_swap on public.missions;
create trigger guard_adaptive_replan_plan_swap
before update of active_plan_version_id on public.missions
for each row execute function public.guard_adaptive_replan_plan_swap_v1();
