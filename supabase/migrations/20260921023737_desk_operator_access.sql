-- PR2 operator gateway. This migration adds a kill switch and append-only
-- audit trail without changing customer membership, billing, or entitlement
-- truth.

create schema if not exists private;

create table private.operator_access_config (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users(id) on delete set null
);

insert into private.operator_access_config (singleton, enabled)
values (true, false)
on conflict (singleton) do nothing;

revoke all on table private.operator_access_config from public, anon, authenticated;
grant all on table private.operator_access_config to service_role;

create table public.operator_workspace_events (
  id uuid primary key default gen_random_uuid(),
  operator_user_id uuid not null references public.users(id) on delete restrict,
  artist_workspace_id uuid references public.artist_workspaces(id) on delete set null,
  target_type text not null default 'artist_workspace',
  target_id text,
  action text not null check (action in (
    'workspace_opened',
    'meeting_processed_for_review',
    'meeting_applied',
    'meeting_declined',
    'meeting_processing_failed'
  )),
  ops_meeting_id uuid references public.ops_meetings(id) on delete set null,
  manager_synthesis_run_id uuid references public.manager_synthesis_runs(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index operator_workspace_events_operator_created_idx
  on public.operator_workspace_events (operator_user_id, created_at desc);
create index operator_workspace_events_workspace_created_idx
  on public.operator_workspace_events (artist_workspace_id, created_at desc);

alter table public.operator_workspace_events enable row level security;
revoke all on table public.operator_workspace_events from public, anon;
revoke all on table public.operator_workspace_events from authenticated;
grant select on table public.operator_workspace_events to authenticated;
grant all on table public.operator_workspace_events to service_role;

create policy operator_workspace_events_self_select
on public.operator_workspace_events
for select to authenticated
using (operator_user_id = (select auth.uid()));

create or replace function private.prevent_operator_workspace_event_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'operator_workspace_events_are_append_only' using errcode = '42501';
end;
$$;

revoke all on function private.prevent_operator_workspace_event_mutation() from public, anon, authenticated;

create trigger operator_workspace_events_immutable_guard
before update or delete on public.operator_workspace_events
for each row execute function private.prevent_operator_workspace_event_mutation();

create or replace function private.can_operator_access_workspace(p_artist_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.operator_access_config config
    join public.ordersounds_operators operator_row
      on operator_row.user_id = (select auth.uid())
     and operator_row.active = true
    join public.artist_workspaces workspace
      on workspace.id = p_artist_workspace_id
    where config.singleton = true
      and config.enabled = true
  );
$$;

revoke all on function private.can_operator_access_workspace(uuid) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.can_operator_access_workspace(uuid) to authenticated;

-- The Edge gateway cannot query the private schema through PostgREST directly.
-- Expose only the boolean kill-switch state to the service role; authenticated
-- clients never receive this function.
create or replace function public.operator_access_enabled_v1()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.operator_access_config
    where singleton = true
      and enabled = true
  );
$$;

revoke all on function public.operator_access_enabled_v1() from public, anon, authenticated;
grant execute on function public.operator_access_enabled_v1() to service_role;

-- Operator inspection is deliberately additive. These policies are SELECT-only
-- and are guarded by the kill-switched, exact-workspace helper above. Customer
-- membership policies remain unchanged and continue to own all customer access.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'artist_profiles',
    'source_sync_jobs',
    'operating_events',
    'evidence_items',
    'artifact_links',
    'manager_outputs',
    'manager_synthesis_runs',
    'manager_run_actions',
    'missions',
    'mission_plan_versions',
    'checkpoints',
    'mission_plan_checkpoints',
    'tasks',
    'task_steps',
    'task_state_events',
    'task_results',
    'reviews',
    'memory_entries',
    'conversations',
    'conversation_messages',
    'music_items',
    'music_projects',
    'music_project_items',
    'music_identifiers',
    'music_assets',
    'music_credits',
    'music_splits',
    'music_split_contributors',
    'documents',
    'document_versions',
    'uploaded_files',
    'release_opportunities',
    'release_date_change_requests'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format(
      'create index if not exists %I on public.%I (artist_workspace_id)',
      table_name || '_operator_workspace_idx',
      table_name
    );
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select private.can_operator_access_workspace(artist_workspace_id)))',
      table_name || '_operator_workspace_select',
      table_name
    );
  end loop;
end;
$$;
