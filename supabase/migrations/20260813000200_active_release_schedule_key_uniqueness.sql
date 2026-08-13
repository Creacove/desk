-- Canonical release schedule keys are unique only among actionable tasks.
-- A superseded plan version must release its keys so the next version can
-- reuse the same deterministic schedule vocabulary.

drop index if exists public.tasks_release_schedule_key_unique;

create unique index tasks_release_schedule_key_unique
  on public.tasks (mission_id, schedule_key)
  where schedule_key is not null
    and status not in (
      'superseded'::public.task_status,
      'archived'::public.task_status,
      'rejected'::public.task_status
    );
