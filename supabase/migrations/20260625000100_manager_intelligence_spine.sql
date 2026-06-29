-- Manager Intelligence spine.
-- Adds one internal packet object and one user-facing output object while reusing
-- the existing source, evidence, memory, run, mission, music, and event tables.

create table public.manager_intelligence_packets (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  packet_date date not null default current_date,
  packet_type text not null default 'manual_refresh'
    check (packet_type in ('setup', 'daily', 'manual_refresh', 'campaign')),
  status public.run_status not null default 'completed',
  profile_projection_json jsonb not null default '{}'::jsonb,
  signal_snapshot_json jsonb not null default '{}'::jsonb,
  data_freshness_json jsonb not null default '{}'::jsonb,
  executive_read_json jsonb not null default '{}'::jsonb,
  strategic_diagnosis_json jsonb not null default '{}'::jsonb,
  kpi_read_json jsonb not null default '{}'::jsonb,
  signal_map_json jsonb not null default '[]'::jsonb,
  management_insights_json jsonb not null default '[]'::jsonb,
  asset_reads_json jsonb not null default '[]'::jsonb,
  market_reads_json jsonb not null default '[]'::jsonb,
  mission_seed_json jsonb not null default '{}'::jsonb,
  conversation_memory_seed_json jsonb not null default '{}'::jsonb,
  supporting_evidence_json jsonb not null default '[]'::jsonb,
  internal_only_json jsonb not null default '{}'::jsonb,
  schema_version text not null default 'manager-intelligence-packet-v1',
  created_from_run_id uuid references public.manager_synthesis_runs(id) on delete set null,
  supersedes_packet_id uuid references public.manager_intelligence_packets(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.manager_outputs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  source_packet_id uuid references public.manager_intelligence_packets(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  mission_id uuid references public.missions(id) on delete set null,
  subject_type text not null
    check (subject_type in ('artist', 'music_item', 'music_project', 'mission', 'task', 'checkpoint', 'conversation')),
  subject_id uuid,
  output_type text not null
    check (output_type in ('setup_first_manager_read', 'recurring_todays_brief', 'song_manager_read', 'project_manager_read', 'chat_answer', 'decision_package', 'review_read')),
  output_date date not null default current_date,
  dominant_situation text,
  layout_pattern text,
  tone text,
  hero_json jsonb not null default '{}'::jsonb,
  blocks_json jsonb not null default '[]'::jsonb,
  summary text,
  primary_recommendation_json jsonb not null default '{}'::jsonb,
  avoid_json jsonb not null default '[]'::jsonb,
  confidence_json jsonb not null default '{}'::jsonb,
  what_changed_json jsonb not null default '[]'::jsonb,
  supporting_evidence_json jsonb not null default '[]'::jsonb,
  render_json jsonb not null default '{}'::jsonb,
  internal_render_notes_json jsonb not null default '{}'::jsonb,
  schema_version text not null default 'manager-output-v1',
  created_from_run_id uuid references public.manager_synthesis_runs(id) on delete set null,
  supersedes_output_id uuid references public.manager_outputs(id) on delete set null,
  is_current boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.memory_entries
  add column if not exists payload jsonb not null default '{}'::jsonb;

alter table public.artist_profiles
  add column if not exists current_manager_packet_id uuid,
  add column if not exists manager_profile_summary_json jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'artist_profiles_current_manager_packet_fk'
  ) then
    alter table public.artist_profiles
      add constraint artist_profiles_current_manager_packet_fk
      foreign key (current_manager_packet_id)
      references public.manager_intelligence_packets(id)
      on delete set null;
  end if;
end;
$$;

alter table public.manager_intelligence_packets enable row level security;
create policy manager_intelligence_packets_account_members_select
on public.manager_intelligence_packets
for select using (public.is_account_member(account_id));
create policy manager_intelligence_packets_account_members_modify
on public.manager_intelligence_packets
for all using (public.is_account_member(account_id))
with check (public.is_account_member(account_id));

alter table public.manager_outputs enable row level security;
create policy manager_outputs_account_members_select
on public.manager_outputs
for select using (public.is_account_member(account_id));
create policy manager_outputs_account_members_modify
on public.manager_outputs
for all using (public.is_account_member(account_id))
with check (public.is_account_member(account_id));

grant select, insert, update on public.manager_intelligence_packets to authenticated, service_role;
grant select, insert, update on public.manager_outputs to authenticated, service_role;
grant select, update on public.memory_entries to authenticated, service_role;
grant select, update on public.artist_profiles to authenticated, service_role;

create index manager_intelligence_packets_workspace_idx
on public.manager_intelligence_packets (account_id, artist_workspace_id, artist_id, created_at desc);

create index manager_intelligence_packets_run_idx
on public.manager_intelligence_packets (created_from_run_id);

create index manager_outputs_workspace_idx
on public.manager_outputs (account_id, artist_workspace_id, artist_id, output_type, created_at desc);

create index manager_outputs_current_subject_idx
on public.manager_outputs (artist_workspace_id, output_type, subject_type, subject_id, is_current, created_at desc);

create unique index manager_outputs_current_unique_idx
on public.manager_outputs (artist_workspace_id, output_type, subject_type, subject_id)
where is_current;

create index manager_outputs_source_packet_idx
on public.manager_outputs (source_packet_id, output_type, created_at desc);

create index memory_entries_manager_source_idx
on public.memory_entries (artist_workspace_id, source_type, source_id, created_at desc)
where source_type in ('manager_intelligence_packet', 'manager_output');

create index evidence_links_manager_target_idx
on public.evidence_links (artist_workspace_id, target_type, target_id, usage)
where target_type in ('manager_intelligence_packet', 'manager_output');

notify pgrst, 'reload schema';
