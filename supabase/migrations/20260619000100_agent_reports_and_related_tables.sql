-- Migration: agent_reports, agent_runs, agent_notes, agent_inbox_items
-- These tables support specialist agent output, handoffs, and inbox management.
-- Required by the Mission Genesis workflow and Artist Operating Packet assembly.
-- The live deployed code queries agent_reports but this table was never migrated.

-- agent_runs: tracks a single specialist agent execution
create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  agent_profile_id uuid references public.agent_profiles(id) on delete set null,
  agent_key text not null,
  mission_id uuid references public.missions(id) on delete set null,
  trigger_type public.agent_run_trigger_type not null,
  status public.run_status not null default 'queued',
  context_payload jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);

-- agent_reports: append-only specialist agent findings
-- Client reads: id, agent_key, summary, confidence, limitations (for Artist Operating Packet)
create table if not exists public.agent_reports (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  agent_run_id uuid references public.agent_runs(id) on delete set null,
  agent_profile_id uuid references public.agent_profiles(id) on delete set null,
  agent_key text not null,
  mission_id uuid references public.missions(id) on delete set null,
  mission_pattern_key text,
  summary text not null,
  confidence public.evidence_confidence not null default 'unknown',
  limitations text[] not null default '{}',
  finding text,
  evidence_missing text[] not null default '{}',
  risk_or_opportunity text,
  recommended_internal_action text,
  permission_required boolean not null default false,
  suggested_follow_up text,
  created_from_run_id uuid references public.manager_synthesis_runs(id) on delete set null,
  created_from_action_id uuid,
  created_at timestamptz not null default now()
);

-- agent_notes: agent-to-agent operational handoffs
create table if not exists public.agent_notes (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  mission_id uuid references public.missions(id) on delete set null,
  sender_agent_profile_id uuid references public.agent_profiles(id) on delete set null,
  recipient_agent_profile_id uuid references public.agent_profiles(id) on delete set null,
  agent_report_id uuid references public.agent_reports(id) on delete set null,
  agent_run_id uuid references public.agent_runs(id) on delete set null,
  note_type text not null default 'handoff',
  subject text not null,
  message text not null,
  source_basis text,
  recommended_action text,
  resulting_change text not null default 'no_action'
    check (resulting_change in ('filed_to_memory','created_task','updated_checkpoint','created_referral','source_request','no_action','superseded')),
  status text not null default 'open'
    check (status in ('open','filed_to_memory','created_task','updated_checkpoint','no_action','superseded')),
  created_from_run_id uuid references public.manager_synthesis_runs(id) on delete set null,
  created_from_action_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- agent_inbox_items: queued items for future agent consumption
create table if not exists public.agent_inbox_items (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  target_agent_profile_id uuid references public.agent_profiles(id) on delete set null,
  target_agent_key text not null,
  source_note_id uuid references public.agent_notes(id) on delete set null,
  mission_id uuid references public.missions(id) on delete set null,
  subject text not null,
  body text not null,
  consume_mode text not null default 'next_run'
    check (consume_mode in ('next_run','on_event','manual')),
  status text not null default 'pending'
    check (status in ('pending','consumed','skipped','expired')),
  consumed_at timestamptz,
  created_from_run_id uuid references public.manager_synthesis_runs(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Triggers
create trigger agent_notes_set_updated_at
  before update on public.agent_notes
  for each row execute function public.set_updated_at();

-- Indexes
create index agent_runs_workspace_idx on public.agent_runs (artist_workspace_id, agent_key, status);
create index agent_reports_workspace_idx on public.agent_reports (artist_workspace_id, created_at desc);
create index agent_reports_agent_key_idx on public.agent_reports (artist_workspace_id, agent_key);
create index agent_notes_workspace_idx on public.agent_notes (artist_workspace_id, status);
create index agent_inbox_workspace_idx on public.agent_inbox_items (artist_workspace_id, target_agent_key, status);

-- RLS: authenticated users may read records belonging to their account workspace
alter table public.agent_runs enable row level security;
create policy agent_runs_account_members_select on public.agent_runs
  for select using (public.is_account_member(account_id));
create policy agent_runs_account_members_modify on public.agent_runs
  for all using (public.is_account_member(account_id))
  with check (public.is_account_member(account_id));

alter table public.agent_reports enable row level security;
create policy agent_reports_account_members_select on public.agent_reports
  for select using (public.is_account_member(account_id));
create policy agent_reports_account_members_modify on public.agent_reports
  for all using (public.is_account_member(account_id))
  with check (public.is_account_member(account_id));

alter table public.agent_notes enable row level security;
create policy agent_notes_account_members_select on public.agent_notes
  for select using (public.is_account_member(account_id));
create policy agent_notes_account_members_modify on public.agent_notes
  for all using (public.is_account_member(account_id))
  with check (public.is_account_member(account_id));

alter table public.agent_inbox_items enable row level security;
create policy agent_inbox_account_members_select on public.agent_inbox_items
  for select using (public.is_account_member(account_id));
create policy agent_inbox_account_members_modify on public.agent_inbox_items
  for all using (public.is_account_member(account_id))
  with check (public.is_account_member(account_id));

-- Grant service_role explicit access (edge functions write these records)
grant select, insert, update on public.agent_runs to service_role;
grant select, insert, update on public.agent_reports to service_role;
grant select, insert, update on public.agent_notes to service_role;
grant select, insert, update on public.agent_inbox_items to service_role;

-- Notify PostgREST to reload schema cache
notify pgrst, 'reload schema';
