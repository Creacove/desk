-- Manager Runtime foundation.
-- Adds the smallest durable primitives needed for proactive management without
-- replacing Missions, Tasks, Reviews, operating_events, or source infrastructure.

alter table public.evidence_items
  add column if not exists metadata jsonb not null default '{}'::jsonb;

alter table public.memory_entries
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists valid_until timestamptz,
  add column if not exists last_confirmed_at timestamptz;

alter table public.mission_plan_versions
  add column if not exists strategy_state jsonb not null default '{}'::jsonb;

alter table public.tasks
  add column if not exists available_from timestamptz,
  add column if not exists estimated_minutes integer,
  add column if not exists assignee_user_id uuid references public.users(id) on delete set null,
  add column if not exists reminder_policy jsonb not null default '{}'::jsonb;

alter table public.tasks
  drop constraint if exists tasks_estimated_minutes_check;
alter table public.tasks
  add constraint tasks_estimated_minutes_check
  check (estimated_minutes is null or estimated_minutes between 1 and 1440);

create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  timezone text not null default 'UTC',
  reminder_intensity text not null default 'standard'
    check (reminder_intensity in ('light', 'standard', 'stay_on_me')),
  quiet_hours_start time,
  quiet_hours_end time,
  in_app_enabled boolean not null default true,
  email_enabled boolean not null default false,
  push_enabled boolean not null default false,
  whatsapp_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (artist_workspace_id, user_id)
);

create table if not exists public.reminder_queue (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  mission_id uuid references public.missions(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  kind text not null check (kind in (
    'task_ready', 'task_start', 'check_in', 'due_soon', 'due_now',
    'overdue', 'blocked_followup', 'plan_at_risk'
  )),
  scheduled_for timestamptz not null,
  channel text not null default 'in_app'
    check (channel in ('in_app', 'email', 'push', 'whatsapp')),
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'sent', 'acknowledged', 'cancelled', 'failed', 'skipped')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  sent_at timestamptz,
  acknowledged_at timestamptz,
  dedupe_key text not null,
  payload jsonb not null default '{}'::jsonb,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (artist_workspace_id, dedupe_key)
);

create index if not exists reminder_queue_due_idx
on public.reminder_queue (scheduled_for, id)
where status = 'queued';

create index if not exists reminder_queue_task_idx
on public.reminder_queue (task_id, status, scheduled_for)
where task_id is not null;

create index if not exists memory_entries_current_artist_idx
on public.memory_entries (artist_workspace_id, kind, created_at desc)
where valid_until is null or valid_until > now();

create index if not exists evidence_items_public_context_idx
on public.evidence_items (artist_workspace_id, evidence_type, created_at desc)
where source_kind = 'public_web';

create trigger notification_preferences_set_updated_at
before update on public.notification_preferences
for each row execute function public.set_updated_at();

create trigger reminder_queue_set_updated_at
before update on public.reminder_queue
for each row execute function public.set_updated_at();

alter table public.notification_preferences enable row level security;
create policy notification_preferences_account_members_select
on public.notification_preferences for select
using (public.is_account_member(account_id));
create policy notification_preferences_account_members_modify
on public.notification_preferences for all
using (public.is_account_member(account_id))
with check (public.is_account_member(account_id));

alter table public.reminder_queue enable row level security;
create policy reminder_queue_account_members_select
on public.reminder_queue for select
using (public.is_account_member(account_id));
create policy reminder_queue_account_members_modify
on public.reminder_queue for all
using (public.is_account_member(account_id))
with check (public.is_account_member(account_id));

grant select, insert, update, delete on public.notification_preferences to authenticated, service_role;
grant select, insert, update, delete on public.reminder_queue to authenticated, service_role;

notify pgrst, 'reload schema';
