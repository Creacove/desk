-- Personal reminder addressing and worker-owned delivery.

alter table public.operating_events
  add column if not exists recipient_user_id uuid references auth.users(id) on delete set null;

create index if not exists operating_events_workspace_recipient_cursor_idx
  on public.operating_events (artist_workspace_id, recipient_user_id, created_at desc, id)
  where recipient_user_id is not null;

alter table public.reminder_queue
  add column if not exists assignment_version integer not null default 0;

alter table public.reminder_queue
  drop constraint if exists reminder_queue_assignment_version_check,
  add constraint reminder_queue_assignment_version_check check (assignment_version >= 0);

-- Existing rows produced before the Team rollout did not carry a recipient
-- snapshot. Recover only an unambiguous assignee/owner and quarantine the rest.
update public.reminder_queue reminder
set user_id = task.assignee_user_id
from public.tasks task
where reminder.user_id is null
  and reminder.task_id = task.id
  and task.assignee_user_id is not null;

update public.reminder_queue reminder
set user_id = owner_membership.user_id
from public.tasks task
cross join lateral (
  select membership.user_id
  from public.account_memberships membership
  where membership.account_id = task.account_id
    and membership.status = 'active'
    and membership.role = 'owner'
  order by membership.created_at asc
  limit 1
) owner_membership
where reminder.user_id is null
  and reminder.task_id = task.id;

update public.reminder_queue reminder
set assignment_version = task.assignment_version,
    payload = coalesce(reminder.payload, '{}'::jsonb)
      || jsonb_build_object('assignmentVersion', task.assignment_version)
from public.tasks task
where reminder.task_id = task.id;

update public.reminder_queue
set status = 'skipped', last_error = 'recipient_validation_failed'
where status in ('queued', 'processing')
  and user_id is null;

create or replace function public.snapshot_reminder_assignment_version_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  task_version integer;
begin
  if new.task_id is not null then
    select task.assignment_version into task_version
    from public.tasks task
    where task.id = new.task_id
      and task.account_id = new.account_id
      and task.artist_workspace_id = new.artist_workspace_id
      and task.artist_id = new.artist_id;
    if task_version is not null then
      new.assignment_version := task_version;
      new.payload := coalesce(new.payload, '{}'::jsonb)
        || pg_catalog.jsonb_build_object(
          'assignmentVersion', task_version,
          'expectedAssignmentVersion', task_version
        );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists reminder_queue_snapshot_assignment_version on public.reminder_queue;
create trigger reminder_queue_snapshot_assignment_version
before insert on public.reminder_queue
for each row execute function public.snapshot_reminder_assignment_version_v1();

-- Authenticated users may read their own preferences and personal queue rows;
-- only the worker/service role may write queue entries or delivery state.
drop policy if exists notification_preferences_account_members_select on public.notification_preferences;
drop policy if exists notification_preferences_account_members_modify on public.notification_preferences;
drop policy if exists reminder_queue_account_members_select on public.reminder_queue;
drop policy if exists reminder_queue_account_members_modify on public.reminder_queue;

create policy notification_preferences_self_select
on public.notification_preferences for select
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.account_memberships membership
    where membership.account_id = notification_preferences.account_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
      and membership.role in ('owner', 'member')
  )
);

create policy notification_preferences_self_modify
on public.notification_preferences for all
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.account_memberships membership
    where membership.account_id = notification_preferences.account_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
      and membership.role in ('owner', 'member')
  )
)
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.account_memberships membership
    where membership.account_id = notification_preferences.account_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
      and membership.role in ('owner', 'member')
  )
);

create policy reminder_queue_recipient_select
on public.reminder_queue for select
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.account_memberships membership
    where membership.account_id = reminder_queue.account_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
      and membership.role in ('owner', 'member')
  )
);

revoke insert, update, delete on public.reminder_queue from public, anon, authenticated;
revoke insert, update, delete on public.notification_preferences from public, anon;
grant select on public.reminder_queue to authenticated;
grant select, insert, update, delete on public.notification_preferences to authenticated;
grant select, insert, update, delete on public.reminder_queue to service_role;
grant select, insert, update, delete on public.notification_preferences to service_role;

-- Shared activity remains visible to eligible members. Personal events are
-- addressable only by their recipient; owner recovery remains available when a
-- configured Team is disabled or lapsed.
drop policy if exists operating_events_account_members_select on public.operating_events;
create policy operating_events_personal_select
on public.operating_events for select
using (
  public.is_account_member(account_id)
  and (recipient_user_id is null or recipient_user_id = auth.uid())
  and (
    not exists (
      select 1 from public.workspace_team_settings settings
      where settings.account_id = operating_events.account_id
        and settings.artist_workspace_id = operating_events.artist_workspace_id
        and settings.artist_id = operating_events.artist_id
    )
    or exists (
      select 1 from public.account_memberships membership
      where membership.account_id = operating_events.account_id
        and membership.user_id = auth.uid()
        and membership.status = 'active'
        and membership.role = 'owner'
    )
    or public.has_active_workspace_entitlement(operating_events.artist_workspace_id)
  )
);

create or replace function public.deliver_in_app_task_reminder_v1(p_reminder_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  reminder_row public.reminder_queue%rowtype;
  task_row public.tasks%rowtype;
  pref_row public.notification_preferences%rowtype;
  membership_role text;
  target_user_id uuid;
  owner_user_id uuid;
  capability jsonb;
  configured boolean;
  account_id_value uuid;
  local_clock time;
  timezone_value text;
  expected_version integer;
  event_summary text;
  event_payload jsonb;
begin
  if p_reminder_id is null then raise exception 'TEAM_BAD_INPUT'; end if;

  -- Read the account without locking, then enforce account -> task -> reminder
  -- order. Removal and reassignment use the same order.
  select reminder.account_id into account_id_value
  from public.reminder_queue reminder
  where reminder.id = p_reminder_id;
  if account_id_value is null then raise exception 'TEAM_NOT_FOUND'; end if;
  perform 1 from public.accounts account_row where account_row.id = account_id_value for update;

  select * into reminder_row
  from public.reminder_queue reminder
  where reminder.id = p_reminder_id;
  if not found then raise exception 'TEAM_NOT_FOUND'; end if;

  if reminder_row.status not in ('queued', 'processing') then
    return pg_catalog.jsonb_build_object('status', reminder_row.status, 'reminderId', p_reminder_id);
  end if;
  if reminder_row.channel <> 'in_app' then
    update public.reminder_queue reminder
    set status = 'skipped', last_error = 'channel_unavailable'
    where reminder.id = p_reminder_id and reminder.status in ('queued', 'processing');
    return pg_catalog.jsonb_build_object('status', 'skipped', 'reason', 'channel_unavailable', 'reminderId', p_reminder_id);
  end if;

  select * into task_row
  from public.tasks task
  where task.id = reminder_row.task_id
    and task.account_id = reminder_row.account_id
    and task.artist_workspace_id = reminder_row.artist_workspace_id
    and task.artist_id = reminder_row.artist_id
  for update;
  if not found then
    update public.reminder_queue reminder
    set status = 'skipped', last_error = 'task_missing'
    where reminder.id = p_reminder_id and reminder.status in ('queued', 'processing');
    return pg_catalog.jsonb_build_object('status', 'skipped', 'reason', 'task_missing', 'reminderId', p_reminder_id);
  end if;
  select * into reminder_row
  from public.reminder_queue reminder
  where reminder.id = p_reminder_id
  for update;
  if not found then raise exception 'TEAM_NOT_FOUND'; end if;

  if task_row.status in ('completed', 'rejected', 'missed', 'archived', 'superseded')
     or lower(coalesce(task_row.work_mode, '')) = 'manager_work' then
    update public.reminder_queue reminder
    set status = 'skipped', last_error = 'task_not_actionable'
    where reminder.id = p_reminder_id and reminder.status in ('queued', 'processing');
    return pg_catalog.jsonb_build_object('status', 'skipped', 'reason', 'task_not_actionable', 'reminderId', p_reminder_id);
  end if;

  if task_row.mission_id is not null and not exists (
    select 1
    from public.missions mission
    where mission.id = task_row.mission_id
      and mission.status = 'active'
      and mission.active_plan_version_id = task_row.mission_plan_version_id
  ) then
    update public.reminder_queue reminder
    set status = 'skipped', last_error = 'task_not_in_active_plan'
    where reminder.id = p_reminder_id and reminder.status in ('queued', 'processing');
    return pg_catalog.jsonb_build_object('status', 'skipped', 'reason', 'task_not_in_active_plan', 'reminderId', p_reminder_id);
  end if;

  expected_version := reminder_row.assignment_version;
  if expected_version <> task_row.assignment_version then
    update public.reminder_queue reminder
    set status = 'skipped', last_error = 'assignment_changed'
    where reminder.id = p_reminder_id and reminder.status in ('queued', 'processing');
    return pg_catalog.jsonb_build_object('status', 'skipped', 'reason', 'assignment_changed', 'reminderId', p_reminder_id);
  end if;

  target_user_id := reminder_row.user_id;
  if target_user_id is null then
    target_user_id := task_row.assignee_user_id;
  end if;
  if target_user_id is null then
    select membership.user_id into owner_user_id
    from public.account_memberships membership
    where membership.account_id = task_row.account_id
      and membership.status = 'active'
      and membership.role = 'owner'
    order by membership.created_at asc
    limit 1;
    target_user_id := owner_user_id;
  end if;
  if target_user_id is null then
    update public.reminder_queue reminder
    set status = 'skipped', last_error = 'recipient_missing'
    where reminder.id = p_reminder_id and reminder.status in ('queued', 'processing');
    return pg_catalog.jsonb_build_object('status', 'skipped', 'reason', 'recipient_missing', 'reminderId', p_reminder_id);
  end if;
  if task_row.assignee_user_id is not null and task_row.assignee_user_id is distinct from target_user_id then
    update public.reminder_queue reminder
    set status = 'skipped', last_error = 'assignment_changed'
    where reminder.id = p_reminder_id and reminder.status in ('queued', 'processing');
    return pg_catalog.jsonb_build_object('status', 'skipped', 'reason', 'assignment_changed', 'reminderId', p_reminder_id);
  end if;

  select membership.role into membership_role
  from public.account_memberships membership
  join public.users app_user on app_user.id = membership.user_id
  where membership.account_id = task_row.account_id
    and membership.user_id = target_user_id
    and membership.status = 'active'
    and membership.role in ('owner', 'member')
    and app_user.status = 'active';
  if membership_role is null then
    update public.reminder_queue reminder
    set status = 'skipped', last_error = 'recipient_inactive'
    where reminder.id = p_reminder_id and reminder.status in ('queued', 'processing');
    return pg_catalog.jsonb_build_object('status', 'skipped', 'reason', 'recipient_inactive', 'reminderId', p_reminder_id);
  end if;

  configured := public._team_scope_is_configured_v1(task_row.account_id, task_row.artist_workspace_id, task_row.artist_id);
  capability := public._workspace_team_capability_v1(task_row.artist_workspace_id);
  if not public._workspace_has_base_access_v1(task_row.artist_workspace_id)
     or (configured and membership_role = 'member'
         and (not coalesce((capability->>'enabled')::boolean, false)
              or not coalesce((capability->>'entitled')::boolean, false))) then
    update public.reminder_queue reminder
    set status = 'skipped', last_error = 'workspace_ineligible'
    where reminder.id = p_reminder_id and reminder.status in ('queued', 'processing');
    return pg_catalog.jsonb_build_object('status', 'skipped', 'reason', 'workspace_ineligible', 'reminderId', p_reminder_id);
  end if;

  select * into pref_row
  from public.notification_preferences preference
  where preference.artist_workspace_id = task_row.artist_workspace_id
    and preference.user_id = target_user_id;
  if found and not coalesce(pref_row.in_app_enabled, true) then
    update public.reminder_queue reminder
    set status = 'skipped', last_error = 'in_app_disabled'
    where reminder.id = p_reminder_id and reminder.status in ('queued', 'processing');
    return pg_catalog.jsonb_build_object('status', 'skipped', 'reason', 'in_app_disabled', 'reminderId', p_reminder_id);
  end if;

  if found and pref_row.quiet_hours_start is not null and pref_row.quiet_hours_end is not null
     and pref_row.quiet_hours_start <> pref_row.quiet_hours_end then
    timezone_value := coalesce(nullif(pref_row.timezone, ''), 'UTC');
    if not exists (select 1 from pg_catalog.pg_timezone_names zone where zone.name = timezone_value) then
      timezone_value := 'UTC';
    end if;
    local_clock := (pg_catalog.now() at time zone timezone_value)::time;
    if (pref_row.quiet_hours_start < pref_row.quiet_hours_end
        and local_clock >= pref_row.quiet_hours_start and local_clock < pref_row.quiet_hours_end)
       or (pref_row.quiet_hours_start > pref_row.quiet_hours_end
           and (local_clock >= pref_row.quiet_hours_start or local_clock < pref_row.quiet_hours_end)) then
      update public.reminder_queue reminder
      set status = 'queued', scheduled_for = pg_catalog.now() + interval '15 minutes', last_error = 'quiet_hours'
      where reminder.id = p_reminder_id and reminder.status in ('queued', 'processing');
      return pg_catalog.jsonb_build_object('status', 'deferred', 'reason', 'quiet_hours', 'reminderId', p_reminder_id);
    end if;
  end if;

  if reminder_row.status = 'queued' then
    update public.reminder_queue reminder
    set status = 'processing', attempt_count = reminder.attempt_count + 1
    where reminder.id = p_reminder_id and reminder.status = 'queued';
  end if;

  event_summary := case
    when task_row.assignee_user_id is null then 'A task needs an owner: ' || task_row.title
    else 'Your task is ready: ' || task_row.title
  end;
  event_payload := coalesce(reminder_row.payload, '{}'::jsonb)
    || pg_catalog.jsonb_build_object(
      'reminderId', p_reminder_id,
      'recipientUserId', target_user_id,
      'assignmentVersion', task_row.assignment_version
    );
  insert into public.operating_events(
    account_id, artist_workspace_id, artist_id, event_type, actor_type,
    target_type, target_id, source_type, source_id, task_id, recipient_user_id,
    dedupe_key, display_mode, refresh_scope, summary, payload
  ) values (
    task_row.account_id, task_row.artist_workspace_id, task_row.artist_id,
    'task_reminder', 'system', 'task', task_row.id, 'reminder_queue', p_reminder_id,
    task_row.id, target_user_id,
    'task-reminder:' || p_reminder_id::text, 'toast',
    array['today', 'activity']::text[], event_summary, event_payload
  ) on conflict (artist_workspace_id, dedupe_key) where dedupe_key is not null do nothing;

  update public.reminder_queue reminder
  set status = 'sent', sent_at = coalesce(reminder.sent_at, pg_catalog.now()), last_error = null
  where reminder.id = p_reminder_id
    and reminder.status = 'processing'
    and reminder.assignment_version = task_row.assignment_version;
  return pg_catalog.jsonb_build_object(
    'status', 'sent',
    'reminderId', p_reminder_id,
    'recipientUserId', target_user_id,
    'assignmentVersion', task_row.assignment_version
  );
end;
$$;

-- Existing queue producers are worker paths. Lock down their helper execution
-- and normalize their security-definer settings without changing solo logic.
alter function public._queue_task_reminder(public.tasks, uuid, text, timestamptz)
  set search_path = '';
alter function public._queue_task_reminder(public.tasks, uuid, text, timestamptz)
  set row_security = off;
alter function public.queue_reminders_for_task(uuid)
  set search_path = '';
alter function public.queue_reminders_for_task(uuid)
  set row_security = off;
alter function public._queue_active_plan_task_reminders()
  set search_path = '';
alter function public._queue_active_plan_task_reminders()
  set row_security = off;
alter function public._sync_task_reminder_lifecycle()
  set search_path = '';
alter function public._sync_task_reminder_lifecycle()
  set row_security = off;

revoke all on function public.snapshot_reminder_assignment_version_v1() from public, anon, authenticated;
revoke all on function public.deliver_in_app_task_reminder_v1(uuid) from public, anon, authenticated;
revoke all on function public._queue_task_reminder(public.tasks, uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.queue_reminders_for_task(uuid) from public, anon, authenticated;
revoke all on function public._queue_active_plan_task_reminders() from public, anon, authenticated;
revoke all on function public._sync_task_reminder_lifecycle() from public, anon, authenticated;
grant execute on function public.snapshot_reminder_assignment_version_v1() to service_role;
grant execute on function public.deliver_in_app_task_reminder_v1(uuid) to service_role;
grant execute on function public._queue_task_reminder(public.tasks, uuid, text, timestamptz) to service_role;
grant execute on function public.queue_reminders_for_task(uuid) to service_role;
grant execute on function public._queue_active_plan_task_reminders() to service_role;
grant execute on function public._sync_task_reminder_lifecycle() to service_role;

alter function public.snapshot_reminder_assignment_version_v1() owner to postgres;
alter function public.deliver_in_app_task_reminder_v1(uuid) owner to postgres;
alter function public._queue_task_reminder(public.tasks, uuid, text, timestamptz) owner to postgres;
alter function public.queue_reminders_for_task(uuid) owner to postgres;
alter function public._queue_active_plan_task_reminders() owner to postgres;
alter function public._sync_task_reminder_lifecycle() owner to postgres;

notify pgrst, 'reload schema';
