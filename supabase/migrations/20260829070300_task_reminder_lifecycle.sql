-- Make accountability part of task lifecycle rather than a separate feature.
-- Mission activation and meaningful task changes create reminder intents; terminal
-- task states cancel them. One global dispatcher delivers due intents.

create or replace function public._queue_task_reminder(
  target_task public.tasks,
  target_user_id uuid,
  target_kind text,
  target_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_at is null or target_user_id is null then return; end if;
  insert into public.reminder_queue (
    account_id, artist_workspace_id, artist_id, user_id, mission_id, task_id,
    kind, scheduled_for, channel, status, dedupe_key, payload
  ) values (
    target_task.account_id,
    target_task.artist_workspace_id,
    target_task.artist_id,
    target_user_id,
    target_task.mission_id,
    target_task.id,
    target_kind,
    target_at,
    'in_app',
    'queued',
    'task:' || target_task.id::text || ':' || target_kind || ':' || to_char(target_at at time zone 'UTC', 'YYYYMMDDHH24MI'),
    jsonb_build_object(
      'taskTitle', target_task.title,
      'purpose', coalesce(target_task.purpose, ''),
      'riskIfLate', coalesce(target_task.risk_if_late, ''),
      'estimatedMinutes', target_task.estimated_minutes,
      'availableFrom', target_task.available_from,
      'deadline', target_task.deadline
    )
  ) on conflict (artist_workspace_id, dedupe_key) do nothing;
end;
$$;

create or replace function public.queue_reminders_for_task(target_task_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  task_row public.tasks%rowtype;
  recipient_id uuid;
  intensity text := 'standard';
  in_app_enabled boolean := true;
  start_at timestamptz;
  duration interval;
begin
  select * into task_row from public.tasks where id = target_task_id;
  if not found then return; end if;

  if task_row.status in ('completed', 'rejected', 'archived', 'superseded') then
    update public.reminder_queue
    set status = 'cancelled', last_error = 'task_is_terminal'
    where task_id = task_row.id and status in ('queued', 'processing');
    return;
  end if;

  if lower(trim(coalesce(task_row.owner_role, ''))) in ('manager', 'desk', 'ai', 'ai manager')
     or coalesce(task_row.work_mode, '') = 'manager_work' then
    update public.reminder_queue
    set status = 'cancelled', last_error = 'manager_owned_work'
    where task_id = task_row.id and status in ('queued', 'processing');
    return;
  end if;

  recipient_id := task_row.assignee_user_id;
  if recipient_id is null then
    select membership.user_id into recipient_id
    from public.account_memberships as membership
    where membership.account_id = task_row.account_id and membership.status = 'active'
    order by case when membership.role = 'owner' then 0 else 1 end, membership.created_at asc
    limit 1;
  end if;
  if recipient_id is null then return; end if;

  select coalesce(pref.reminder_intensity, 'standard'), coalesce(pref.in_app_enabled, true)
  into intensity, in_app_enabled
  from public.notification_preferences as pref
  where pref.artist_workspace_id = task_row.artist_workspace_id
    and pref.user_id = recipient_id;

  intensity := coalesce(intensity, 'standard');
  in_app_enabled := coalesce(in_app_enabled, true);
  if not in_app_enabled then return; end if;

  update public.reminder_queue
  set status = 'cancelled', last_error = 'task_schedule_rebuilt'
  where task_id = task_row.id and status in ('queued', 'processing');

  if task_row.status = 'blocked' then
    perform public._queue_task_reminder(task_row, recipient_id, 'blocked_followup', now() + interval '30 minutes');
    return;
  end if;

  start_at := greatest(now(), coalesce(task_row.available_from, now()));
  perform public._queue_task_reminder(
    task_row,
    recipient_id,
    case when task_row.available_from is not null and task_row.available_from > now() + interval '1 minute' then 'task_start' else 'task_ready' end,
    start_at
  );

  if task_row.deadline is null then return; end if;

  if intensity = 'light' then
    perform public._queue_task_reminder(task_row, recipient_id, 'due_soon', greatest(now(), task_row.deadline - interval '2 hours'));
    return;
  end if;

  duration := task_row.deadline - start_at;
  if intensity = 'stay_on_me' and duration >= interval '4 hours' then
    perform public._queue_task_reminder(
      task_row,
      recipient_id,
      'check_in',
      start_at + least(duration / 2, interval '6 hours')
    );
  end if;

  perform public._queue_task_reminder(task_row, recipient_id, 'due_soon', greatest(now(), task_row.deadline - interval '2 hours'));
  perform public._queue_task_reminder(task_row, recipient_id, 'due_now', greatest(now(), task_row.deadline));
  perform public._queue_task_reminder(
    task_row,
    recipient_id,
    'overdue',
    task_row.deadline + case when intensity = 'stay_on_me' then interval '1 hour' else interval '3 hours' end
  );
end;
$$;

create or replace function public._queue_active_plan_task_reminders()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  task_row record;
begin
  if new.status <> 'active' or new.active_plan_version_id is null then return new; end if;
  if tg_op = 'UPDATE'
     and old.status = 'active'
     and old.active_plan_version_id is not distinct from new.active_plan_version_id then
    return new;
  end if;

  for task_row in
    select task.id
    from public.tasks as task
    where task.mission_id = new.id
      and task.mission_plan_version_id = new.active_plan_version_id
      and task.status in ('proposed', 'open', 'approved', 'in_progress', 'blocked')
  loop
    perform public.queue_reminders_for_task(task_row.id);
  end loop;
  return new;
end;
$$;

drop trigger if exists queue_active_plan_task_reminders on public.missions;
create trigger queue_active_plan_task_reminders
after insert or update of status, active_plan_version_id on public.missions
for each row execute function public._queue_active_plan_task_reminders();

create or replace function public._sync_task_reminder_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if exists (
      select 1 from public.missions as mission
      where mission.id = new.mission_id and mission.status = 'active'
        and mission.active_plan_version_id = new.mission_plan_version_id
    ) then
      perform public.queue_reminders_for_task(new.id);
    end if;
    return new;
  end if;

  if new.status is distinct from old.status
     or new.deadline is distinct from old.deadline
     or new.available_from is distinct from old.available_from
     or new.assignee_user_id is distinct from old.assignee_user_id
     or new.reminder_policy is distinct from old.reminder_policy then
    perform public.queue_reminders_for_task(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists sync_task_reminder_lifecycle on public.tasks;
create trigger sync_task_reminder_lifecycle
after insert or update of status, deadline, available_from, assignee_user_id, reminder_policy on public.tasks
for each row execute function public._sync_task_reminder_lifecycle();

grant execute on function public.queue_reminders_for_task(uuid) to service_role;
