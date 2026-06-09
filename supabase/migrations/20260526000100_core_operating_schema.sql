-- Ordersounds V1 core operating schema.
-- Phase 1 scope: ownership, source/evidence, Music, operating traceability,
-- conversations, Manager run placeholders, missions, tasks, reviews, permissions,
-- memory, and usage accounting.

create extension if not exists pgcrypto;

create type public.created_by_type as enum ('user', 'manager', 'agent', 'system', 'admin', 'integration');
create type public.workspace_status as enum ('setup', 'active', 'paused', 'archived');
create type public.source_kind as enum ('official_api', 'third_party_provider', 'public_web', 'uploaded_file', 'user_supplied', 'manual');
create type public.source_connection_status as enum ('not_configured', 'candidate', 'resolved', 'unresolved', 'ambiguous', 'connected', 'disconnected', 'unavailable', 'failed');
create type public.source_sync_trigger_type as enum ('scheduled', 'manual', 'setup', 'evidence_gap', 'review', 'agent_run');
create type public.run_status as enum ('queued', 'running', 'needs_context', 'completed', 'completed_with_limits', 'failed', 'cancelled');
create type public.evidence_confidence as enum ('high', 'medium', 'low', 'unknown');
create type public.evidence_link_usage as enum ('supports_claim', 'supports_limitation', 'missing_evidence', 'conflicting_evidence', 'source_basis');
create type public.music_lifecycle_stage as enum ('idea', 'recording', 'production', 'mixing', 'mastering', 'ready', 'scheduled', 'released', 'catalog', 'archived');
create type public.music_item_type as enum ('song', 'demo', 'released_track', 'catalog_track', 'alternate_version');
create type public.music_project_type as enum ('single', 'ep', 'album', 'mixtape', 'compilation', 'deluxe', 'unreleased_body', 'other');
create type public.music_asset_type as enum ('demo', 'rough_mix', 'final_master', 'clean_version', 'instrumental', 'stems', 'cover_art', 'alternate_artwork', 'metadata_export', 'split_sheet', 'pitch_asset', 'lyrics', 'epk', 'press_photo', 'royalty_statement', 'distributor_export', 'campaign_report', 'other');
create type public.music_asset_status as enum ('missing', 'draft', 'uploaded', 'confirmed', 'replaced', 'revoked', 'failed');
create type public.music_identifier_type as enum ('isrc', 'upc', 'spotify_artist_id', 'spotify_track_id', 'spotify_album_id', 'spotify_track_uri', 'spotify_album_uri', 'spotify_track_url', 'spotify_album_url', 'apple_music_id', 'youtube_video_id', 'tiktok_sound_id', 'distributor_id', 'chartmetric_id', 'soundcharts_id', 'custom');
create type public.music_credit_status as enum ('missing', 'draft', 'confirmed', 'disputed', 'superseded');
create type public.music_split_status as enum ('missing', 'draft', 'pending_confirmation', 'partially_confirmed', 'cleared', 'disputed', 'superseded', 'revoked');
create type public.music_split_contributor_status as enum ('draft', 'pending', 'confirmed', 'rejected', 'disputed', 'revoked');
create type public.music_split_confirmation_status as enum ('created', 'sent', 'opened', 'confirmed', 'rejected', 'expired', 'revoked', 'superseded');
create type public.agent_status as enum ('available', 'locked');
create type public.agent_run_trigger_type as enum ('artist_wide', 'mission_specific', 'conversation', 'task_result', 'evidence_triggered', 'daily', 'weekly', 'review', 'manual', 'agent_inbox');
create type public.manager_trigger_type as enum ('daily', 'weekly', 'mission', 'evidence_triggered', 'task_result', 'conversation', 'review', 'manual');
create type public.manager_action_status as enum ('pending', 'applied', 'approval_required', 'failed', 'skipped');
create type public.usage_workflow_key as enum ('daily_operating_run', 'manager_conversation_run', 'mission_run', 'task_result_run', 'checkpoint_review_run', 'review_run', 'music_readiness_run', 'music_source_match', 'evidence_extraction', 'agent_run', 'draft_generation', 'source_sync');
create type public.usage_run_type as enum ('manager_synthesis', 'agent', 'review', 'source_sync', 'evidence_extraction', 'music_readiness', 'draft_generation', 'tool_call');
create type public.usage_status as enum ('started', 'succeeded', 'failed', 'cancelled', 'rate_limited', 'partial');
create type public.conversation_speaker as enum ('artist', 'manager', 'system');
create type public.mission_status as enum ('candidate', 'active', 'blocked', 'review', 'paused', 'complete', 'archived', 'cancelled');
create type public.mission_plan_status as enum ('draft', 'active', 'superseded', 'archived');
create type public.checkpoint_status as enum ('waiting', 'blocked', 'ready_for_manager_check', 'watching_signal', 'needs_revision', 'met', 'skipped');
create type public.task_scope as enum ('mission', 'setup_source');
create type public.task_status as enum ('proposed', 'open', 'needs_approval', 'approved', 'in_progress', 'blocked', 'completed', 'rejected', 'missed', 'archived', 'superseded');
create type public.task_approval_state as enum ('not_required', 'needs_approval', 'approved', 'rejected', 'blocked');
create type public.task_result_status as enum ('completed', 'blocked', 'rejected', 'revised', 'missed', 'superseded');
create type public.review_status as enum ('scheduled', 'due', 'running', 'completed', 'snoozed', 'cancelled');
create type public.permission_request_type as enum ('spend', 'external_outreach', 'submission', 'publish', 'schedule', 'release_plan_change', 'legal_finance_rights', 'sensitive_commitment', 'draft_export', 'source_connection');
create type public.permission_request_status as enum ('pending', 'approved', 'rejected', 'edited', 'expired', 'revoked', 'superseded');
create type public.memory_scope as enum ('artist', 'mission', 'conversation', 'task', 'checkpoint', 'source', 'run', 'music_item', 'music_project');
create type public.memory_kind as enum ('fact', 'interpretation', 'preference', 'constraint', 'risk', 'blocker', 'hypothesis', 'rejected_move', 'outcome_note', 'open_question');
create type public.artifact_link_relationship as enum ('created', 'updated', 'references', 'supersedes', 'depends_on', 'blocks', 'unblocks', 'review_of', 'response_to');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan text not null default 'prototype',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.users (
  id uuid primary key,
  email text not null unique,
  display_name text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.account_memberships (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null check (role in ('owner', 'member', 'admin_support')),
  status text not null default 'active',
  created_at timestamptz not null default now(),
  unique (account_id, user_id)
);

create or replace function public.is_account_member(target_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.account_memberships membership
    where membership.account_id = target_account_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
  );
$$;

create table public.artists (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  display_name text not null,
  canonical_spotify_artist_id text,
  canonical_spotify_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.artist_workspaces (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  name text not null,
  status public.workspace_status not null default 'setup',
  active_profile_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.artist_profiles (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  current_version_id uuid,
  display_name text not null,
  spotify_identity jsonb not null default '{}'::jsonb,
  genres text[] not null default '{}',
  home_market text,
  stage text,
  current_goal text,
  active_focus_object_id uuid,
  budget_context text,
  social_handles jsonb not null default '{}'::jsonb,
  artist_direction text,
  updated_by_user_id uuid references public.users(id),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.artist_profile_versions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  profile_id uuid not null references public.artist_profiles(id) on delete cascade,
  version integer not null,
  profile_payload jsonb not null,
  change_reason text,
  source text not null check (source in ('setup', 'settings', 'approved_manager_suggestion', 'import')),
  created_by_type public.created_by_type not null default 'user',
  created_by_id uuid,
  created_from_run_id uuid,
  created_at timestamptz not null default now(),
  unique (profile_id, version)
);

create table public.source_providers (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null unique,
  display_name text not null,
  source_kind public.source_kind not null,
  default_confidence public.evidence_confidence not null default 'unknown',
  claim_boundaries jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.source_connections (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  provider_id uuid not null references public.source_providers(id),
  handle_or_external_ref text,
  status public.source_connection_status not null default 'not_configured',
  last_sync_at timestamptz,
  next_sync_at timestamptz,
  freshness_target interval,
  limitations text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.source_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  source_connection_id uuid references public.source_connections(id) on delete set null,
  job_type text not null,
  trigger_type public.source_sync_trigger_type not null default 'manual',
  status public.run_status not null default 'queued',
  started_at timestamptz,
  completed_at timestamptz,
  error text,
  snapshot_ids uuid[] not null default '{}',
  created_from_run_id uuid,
  created_at timestamptz not null default now()
);

create table public.source_snapshots (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  source_connection_id uuid references public.source_connections(id) on delete set null,
  uploaded_file_id uuid,
  provider_id uuid references public.source_providers(id),
  source_kind public.source_kind not null,
  captured_at timestamptz not null default now(),
  time_window_start timestamptz,
  time_window_end timestamptz,
  raw_ref text,
  raw_hash text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.evidence_items (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  source_snapshot_id uuid references public.source_snapshots(id) on delete set null,
  uploaded_file_id uuid,
  provider_id uuid references public.source_providers(id),
  source text not null,
  source_kind public.source_kind not null,
  evidence_type text not null,
  subject_type text,
  subject_id uuid,
  subject_label text,
  time_window_start timestamptz,
  time_window_end timestamptz,
  metric_name text,
  metric_value numeric,
  metric_unit text,
  lens text,
  freshness text,
  confidence public.evidence_confidence not null default 'unknown',
  provenance text,
  limitation text,
  raw_ref text,
  created_from_run_id uuid,
  created_at timestamptz not null default now()
);

create table public.evidence_links (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  evidence_item_id uuid not null references public.evidence_items(id) on delete cascade,
  target_type text not null,
  target_id uuid not null,
  usage public.evidence_link_usage not null,
  claim_text text,
  created_from_run_id uuid,
  created_at timestamptz not null default now()
);

create table public.music_items (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  title text not null,
  item_type public.music_item_type not null default 'song',
  lifecycle_stage public.music_lifecycle_stage not null default 'idea',
  status text not null default 'active',
  is_active_focus boolean not null default false,
  manager_read text,
  manager_next_move text,
  manager_stage_suggestion public.music_lifecycle_stage,
  blocker text,
  rights_state text,
  source_kind text,
  source_limit text,
  planned_release_date date,
  released_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_by_type public.created_by_type not null default 'user',
  created_by_id uuid,
  created_from_run_id uuid,
  created_from_action_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.music_projects (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  title text not null,
  project_type public.music_project_type not null default 'other',
  lifecycle_stage public.music_lifecycle_stage not null default 'idea',
  status text not null default 'active',
  is_active_focus boolean not null default false,
  manager_read text,
  manager_next_move text,
  blocker text,
  source_kind text,
  source_limit text,
  planned_release_date date,
  released_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_by_type public.created_by_type not null default 'user',
  created_by_id uuid,
  created_from_run_id uuid,
  created_from_action_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.music_project_items (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  music_project_id uuid not null references public.music_projects(id) on delete cascade,
  music_item_id uuid not null references public.music_items(id) on delete cascade,
  order_index integer not null,
  disc_number integer not null default 1,
  display_title text,
  relationship text not null default 'contains_track',
  created_from_run_id uuid,
  created_from_action_id uuid,
  created_at timestamptz not null default now(),
  unique (music_project_id, music_item_id)
);

create table public.music_identifiers (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  music_item_id uuid references public.music_items(id) on delete cascade,
  music_project_id uuid references public.music_projects(id) on delete cascade,
  identifier_type public.music_identifier_type not null,
  identifier_value text not null,
  provider_id uuid references public.source_providers(id),
  source_snapshot_id uuid references public.source_snapshots(id) on delete set null,
  confidence public.evidence_confidence not null default 'medium',
  created_from_run_id uuid,
  created_at timestamptz not null default now(),
  check ((music_item_id is not null) <> (music_project_id is not null)),
  unique (account_id, identifier_type, identifier_value)
);

create table public.music_assets (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  music_item_id uuid references public.music_items(id) on delete cascade,
  music_project_id uuid references public.music_projects(id) on delete cascade,
  asset_type public.music_asset_type not null,
  title text not null,
  uploaded_file_id uuid,
  status public.music_asset_status not null default 'missing',
  version_label text,
  notes text,
  source_snapshot_id uuid references public.source_snapshots(id) on delete set null,
  created_by_type public.created_by_type not null default 'user',
  created_by_id uuid,
  created_from_run_id uuid,
  created_from_action_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (music_item_id is not null or music_project_id is not null)
);

create table public.music_credits (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  music_item_id uuid references public.music_items(id) on delete cascade,
  music_project_id uuid references public.music_projects(id) on delete cascade,
  role text not null,
  name text not null,
  status public.music_credit_status not null default 'draft',
  source_snapshot_id uuid references public.source_snapshots(id) on delete set null,
  created_by_type public.created_by_type not null default 'user',
  created_by_id uuid,
  created_from_run_id uuid,
  created_from_action_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (music_item_id is not null or music_project_id is not null)
);

create table public.music_splits (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  music_item_id uuid not null references public.music_items(id) on delete cascade,
  status public.music_split_status not null default 'missing',
  summary text,
  publishing_total numeric,
  master_total numeric,
  document_asset_id uuid references public.music_assets(id) on delete set null,
  source_snapshot_id uuid references public.source_snapshots(id) on delete set null,
  linked_task_id uuid,
  created_by_type public.created_by_type not null default 'user',
  created_by_id uuid,
  created_from_run_id uuid,
  created_from_action_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.music_split_contributors (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  music_split_id uuid not null references public.music_splits(id) on delete cascade,
  name text not null,
  role text not null,
  email text not null,
  publishing_share numeric not null default 0 check (publishing_share >= 0 and publishing_share <= 100),
  master_share numeric not null default 0 check (master_share >= 0 and master_share <= 100),
  approval_status public.music_split_contributor_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.music_split_confirmations (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  music_split_id uuid not null references public.music_splits(id) on delete cascade,
  music_split_contributor_id uuid not null references public.music_split_contributors(id) on delete cascade,
  confirmation_token_hash text not null,
  status public.music_split_confirmation_status not null default 'created',
  confirmed_at timestamptz,
  rejected_at timestamptz,
  expires_at timestamptz not null,
  ip_hash text,
  user_agent_hash text,
  confirmation_text text,
  created_from_run_id uuid,
  created_from_action_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index music_split_confirmations_unique_active_token
on public.music_split_confirmations (confirmation_token_hash)
where status in ('created', 'sent', 'opened');

create index music_split_contributors_split_idx on public.music_split_contributors (music_split_id, approval_status);
create index music_split_confirmations_contributor_idx on public.music_split_confirmations (music_split_contributor_id, status);

create table public.operating_events (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  event_type text not null,
  actor_type public.created_by_type not null,
  actor_id uuid,
  target_type text,
  target_id uuid,
  source_type text,
  source_id uuid,
  manager_synthesis_run_id uuid,
  manager_run_action_id uuid,
  agent_run_id uuid,
  mission_id uuid,
  checkpoint_id uuid,
  task_id uuid,
  summary text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.artifact_links (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  source_type text not null,
  source_id uuid not null,
  target_type text not null,
  target_id uuid not null,
  relationship public.artifact_link_relationship not null,
  created_from_run_id uuid,
  created_from_action_id uuid,
  created_at timestamptz not null default now()
);

create table public.agent_profiles (
  id uuid primary key default gen_random_uuid(),
  agent_key text not null unique,
  name text not null,
  title text,
  status_default public.agent_status not null default 'locked',
  purpose text,
  tools text[] not null default '{}',
  evidence_needs jsonb not null default '{}'::jsonb,
  required_source_capabilities text[] not null default '{}',
  optional_source_capabilities text[] not null default '{}',
  manager_can_prepare text[] not null default '{}',
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  topic text not null,
  status text not null default 'active',
  summary text,
  last_update_at timestamptz,
  linked_mission_id uuid,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.manager_context_questions (
  id uuid primary key default gen_random_uuid(),
  question_key text not null unique,
  question text not null,
  suggested_answer text,
  required_for text[] not null default '{}',
  order_index integer not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.manager_synthesis_runs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  trigger_type public.manager_trigger_type not null,
  conversation_id uuid references public.conversations(id) on delete set null,
  mission_id uuid,
  status public.run_status not null default 'queued',
  classification text,
  confidence public.evidence_confidence,
  context_payload jsonb not null default '{}'::jsonb,
  steps_payload jsonb not null default '[]'::jsonb,
  action_plan jsonb not null default '[]'::jsonb,
  limitations text[] not null default '{}',
  started_at timestamptz,
  completed_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);

create table public.manager_run_actions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  manager_synthesis_run_id uuid not null references public.manager_synthesis_runs(id) on delete cascade,
  order_index integer not null,
  action_type text not null,
  target_type text,
  target_id uuid,
  status public.manager_action_status not null default 'pending',
  approval_required boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  result_payload jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now()
);

create table public.mission_patterns (
  id uuid primary key default gen_random_uuid(),
  pattern_key text not null unique,
  name text not null,
  management_domains text[] not null default '{}',
  status text not null default 'active',
  current_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.mission_pattern_versions (
  id uuid primary key default gen_random_uuid(),
  mission_pattern_id uuid not null references public.mission_patterns(id) on delete cascade,
  version integer not null,
  description text,
  when_to_use text,
  likely_agent_keys text[] not null default '{}',
  artist_specific_inputs_required text[] not null default '{}',
  evidence_needs text[] not null default '{}',
  common_task_types text[] not null default '{}',
  checkpoint_questions text[] not null default '{}',
  permission_boundaries text[] not null default '{}',
  review_triggers text[] not null default '{}',
  success_state text,
  blockage_state text,
  change_conditions text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (mission_pattern_id, version)
);

create table public.missions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  title text not null,
  objective text not null,
  reason text,
  status public.mission_status not null default 'candidate',
  priority integer not null default 0,
  progress integer not null default 0 check (progress between 0 and 100),
  health text,
  summary text,
  pattern_id uuid references public.mission_patterns(id) on delete set null,
  pattern_version_id uuid references public.mission_pattern_versions(id) on delete set null,
  pattern_name text,
  pattern_confidence public.evidence_confidence,
  originating_trigger text,
  originating_run_id uuid,
  originating_report_id uuid,
  originating_conversation_id uuid references public.conversations(id) on delete set null,
  required_evidence text[] not null default '{}',
  missing_evidence text[] not null default '{}',
  current_recommendation text,
  change_conditions text[] not null default '{}',
  review_point text,
  active_plan_version_id uuid,
  archived_at timestamptz,
  created_from_run_id uuid,
  created_from_action_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.conversations
  add constraint conversations_linked_mission_fk foreign key (linked_mission_id) references public.missions(id) on delete set null;

alter table public.manager_synthesis_runs
  add constraint manager_synthesis_runs_mission_fk foreign key (mission_id) references public.missions(id) on delete set null;

create table public.mission_plan_versions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  mission_id uuid not null references public.missions(id) on delete cascade,
  version integer not null,
  status public.mission_plan_status not null default 'draft',
  generated_from_run_id uuid,
  generated_from_action_id uuid,
  pattern_id uuid references public.mission_patterns(id) on delete set null,
  pattern_version_id uuid references public.mission_pattern_versions(id) on delete set null,
  summary text,
  superseded_by_plan_id uuid,
  superseded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (mission_id, version)
);

alter table public.missions
  add constraint missions_active_plan_version_fk foreign key (active_plan_version_id) references public.mission_plan_versions(id) on delete set null;

create table public.checkpoints (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  mission_id uuid not null references public.missions(id) on delete cascade,
  mission_plan_version_id uuid references public.mission_plan_versions(id) on delete set null,
  title text not null,
  status public.checkpoint_status not null default 'waiting',
  question text not null,
  reason_for_checkpoint text,
  watched_signals text[] not null default '{}',
  decision_rule text,
  recommendation text,
  next_action text,
  blocked_reason text,
  dependency_impact text,
  required_evidence text[] not null default '{}',
  missing_evidence text[] not null default '{}',
  generated_from_pattern_id uuid references public.mission_patterns(id) on delete set null,
  custom_reason text,
  created_from_run_id uuid,
  created_from_action_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.mission_plan_checkpoints (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  mission_plan_version_id uuid not null references public.mission_plan_versions(id) on delete cascade,
  mission_id uuid not null references public.missions(id) on delete cascade,
  checkpoint_id uuid not null references public.checkpoints(id) on delete cascade,
  order_index integer not null,
  phase_label text,
  unlock_rule text,
  blocked_reason text,
  created_at timestamptz not null default now(),
  unique (mission_plan_version_id, checkpoint_id)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  scope public.task_scope not null default 'mission',
  mission_id uuid references public.missions(id) on delete cascade,
  mission_plan_version_id uuid references public.mission_plan_versions(id) on delete set null,
  primary_checkpoint_id uuid references public.checkpoints(id) on delete set null,
  title text not null,
  owner_role text,
  deadline timestamptz,
  priority integer not null default 0,
  status public.task_status not null default 'proposed',
  approval_state public.task_approval_state not null default 'not_required',
  purpose text,
  dependency text,
  evidence_needed text[] not null default '{}',
  completion_expectation text,
  risk_if_late text,
  risk_if_skipped text,
  created_from_run_id uuid,
  created_from_action_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  check (scope = 'setup_source' or (mission_id is not null and primary_checkpoint_id is not null))
);

create table public.task_steps (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  order_index integer not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table public.task_state_events (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  mission_id uuid references public.missions(id) on delete set null,
  checkpoint_id uuid references public.checkpoints(id) on delete set null,
  event_type text not null,
  from_status public.task_status,
  to_status public.task_status,
  actor_type public.created_by_type not null,
  actor_id uuid,
  reason text,
  payload jsonb not null default '{}'::jsonb,
  created_from_run_id uuid,
  created_from_action_id uuid,
  created_at timestamptz not null default now()
);

create table public.task_results (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  mission_id uuid references public.missions(id) on delete set null,
  checkpoint_id uuid references public.checkpoints(id) on delete set null,
  status public.task_result_status not null,
  user_note text,
  raw_event jsonb not null default '{}'::jsonb,
  summary text,
  manager_interpretation text,
  mission_effect text,
  checkpoint_effect text,
  downstream_effect text,
  recommended_follow_up text,
  confidence public.evidence_confidence not null default 'unknown',
  created_from_run_id uuid,
  created_from_action_id uuid,
  created_at timestamptz not null default now()
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  mission_id uuid references public.missions(id) on delete cascade,
  checkpoint_id uuid references public.checkpoints(id) on delete set null,
  decision_package_id uuid,
  trigger_type text,
  trigger_object_type text,
  trigger_object_id uuid,
  previous_recommendation text,
  current_read text,
  what_changed text,
  what_did_not_change text,
  recommendation_changed boolean not null default false,
  outcome text,
  next_action text,
  status public.review_status not null default 'scheduled',
  review_at timestamptz,
  snoozed_until timestamptz,
  quality_gate_result_id uuid,
  created_from_run_id uuid,
  created_from_action_id uuid,
  created_at timestamptz not null default now()
);

create table public.permission_requests (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  mission_id uuid references public.missions(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  checkpoint_id uuid references public.checkpoints(id) on delete set null,
  draft_id uuid,
  decision_package_id uuid,
  request_type public.permission_request_type not null,
  title text not null,
  body text,
  risk text,
  parameters jsonb not null default '{}'::jsonb,
  status public.permission_request_status not null default 'pending',
  expires_at timestamptz,
  created_from_run_id uuid,
  created_from_action_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memory_entries (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  mission_id uuid references public.missions(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  checkpoint_id uuid references public.checkpoints(id) on delete set null,
  source_connection_id uuid references public.source_connections(id) on delete set null,
  agent_run_id uuid,
  scope public.memory_scope not null,
  kind public.memory_kind not null,
  content text not null,
  source_type text,
  source_id uuid,
  operating_event_id uuid references public.operating_events(id) on delete set null,
  confidence public.evidence_confidence not null default 'unknown',
  mission_pattern_key text,
  reason text,
  supersedes_memory_entry_id uuid references public.memory_entries(id) on delete set null,
  created_from_run_id uuid,
  created_from_action_id uuid,
  created_at timestamptz not null default now()
);

create table public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  speaker public.conversation_speaker not null,
  label text,
  body text not null,
  manager_synthesis_run_id uuid references public.manager_synthesis_runs(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.manager_context_answers (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  question_id uuid not null references public.manager_context_questions(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  answer text not null,
  source text not null check (source in ('typed', 'suggestion_confirmed', 'imported')),
  created_by_user_id uuid references public.users(id),
  memory_entry_id uuid references public.memory_entries(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_run_usage_events (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  workflow_key public.usage_workflow_key not null,
  run_type public.usage_run_type not null,
  manager_synthesis_run_id uuid references public.manager_synthesis_runs(id) on delete set null,
  agent_run_id uuid,
  review_id uuid references public.reviews(id) on delete set null,
  source_sync_job_id uuid references public.source_sync_jobs(id) on delete set null,
  created_from_action_id uuid,
  subject_type text,
  subject_id uuid,
  provider text,
  model_or_tool text,
  operation_key text not null,
  status public.usage_status not null default 'started',
  input_tokens integer,
  cached_input_tokens integer,
  output_tokens integer,
  reasoning_tokens integer,
  tool_call_count integer,
  provider_request_count integer,
  provider_cost_estimate numeric,
  billable_units numeric,
  currency text not null default 'USD',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  failure_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.validate_task_transition()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'completed' and new.approval_state in ('needs_approval', 'blocked', 'rejected') then
    raise exception 'approval-gated task cannot be completed before approval';
  end if;

  if old.status in ('completed', 'rejected', 'archived', 'superseded')
    and new.status <> old.status then
    raise exception 'terminal task status cannot transition without superseding through a new task';
  end if;

  return new;
end;
$$;

create trigger tasks_validate_transition
before update of status, approval_state on public.tasks
for each row execute function public.validate_task_transition();

create trigger accounts_set_updated_at before update on public.accounts for each row execute function public.set_updated_at();
create trigger users_set_updated_at before update on public.users for each row execute function public.set_updated_at();
create trigger artists_set_updated_at before update on public.artists for each row execute function public.set_updated_at();
create trigger artist_workspaces_set_updated_at before update on public.artist_workspaces for each row execute function public.set_updated_at();
create trigger artist_profiles_set_updated_at before update on public.artist_profiles for each row execute function public.set_updated_at();
create trigger source_connections_set_updated_at before update on public.source_connections for each row execute function public.set_updated_at();
create trigger music_items_set_updated_at before update on public.music_items for each row execute function public.set_updated_at();
create trigger music_projects_set_updated_at before update on public.music_projects for each row execute function public.set_updated_at();
create trigger music_assets_set_updated_at before update on public.music_assets for each row execute function public.set_updated_at();
create trigger music_credits_set_updated_at before update on public.music_credits for each row execute function public.set_updated_at();
create trigger music_splits_set_updated_at before update on public.music_splits for each row execute function public.set_updated_at();
create trigger music_split_contributors_set_updated_at before update on public.music_split_contributors for each row execute function public.set_updated_at();
create trigger music_split_confirmations_set_updated_at before update on public.music_split_confirmations for each row execute function public.set_updated_at();
create trigger conversations_set_updated_at before update on public.conversations for each row execute function public.set_updated_at();
create trigger manager_context_answers_set_updated_at before update on public.manager_context_answers for each row execute function public.set_updated_at();
create trigger missions_set_updated_at before update on public.missions for each row execute function public.set_updated_at();
create trigger checkpoints_set_updated_at before update on public.checkpoints for each row execute function public.set_updated_at();
create trigger tasks_set_updated_at before update on public.tasks for each row execute function public.set_updated_at();
create trigger permission_requests_set_updated_at before update on public.permission_requests for each row execute function public.set_updated_at();

alter table public.accounts enable row level security;
alter table public.users enable row level security;
alter table public.account_memberships enable row level security;

create policy accounts_member_select on public.accounts for select using (public.is_account_member(id));
create policy users_self_select on public.users for select using (id = auth.uid());
create policy account_memberships_member_select on public.account_memberships for select using (public.is_account_member(account_id));

alter table public.artist_profiles enable row level security;
create policy artist_profiles_account_members_select on public.artist_profiles for select using (public.is_account_member(account_id));
create policy artist_profiles_account_members_modify on public.artist_profiles for all using (public.is_account_member(account_id)) with check (public.is_account_member(account_id));

alter table public.source_connections enable row level security;
create policy source_connections_account_members_select on public.source_connections for select using (public.is_account_member(account_id));
create policy source_connections_account_members_modify on public.source_connections for all using (public.is_account_member(account_id)) with check (public.is_account_member(account_id));

alter table public.music_items enable row level security;
create policy music_items_account_members_select on public.music_items for select using (public.is_account_member(account_id));
create policy music_items_account_members_modify on public.music_items for all using (public.is_account_member(account_id)) with check (public.is_account_member(account_id));

alter table public.missions enable row level security;
create policy missions_account_members_select on public.missions for select using (public.is_account_member(account_id));
create policy missions_account_members_modify on public.missions for all using (public.is_account_member(account_id)) with check (public.is_account_member(account_id));

alter table public.tasks enable row level security;
create policy tasks_account_members_select on public.tasks for select using (public.is_account_member(account_id));
create policy tasks_account_members_modify on public.tasks for all using (public.is_account_member(account_id)) with check (public.is_account_member(account_id));

alter table public.manager_synthesis_runs enable row level security;
create policy manager_synthesis_runs_account_members_select on public.manager_synthesis_runs for select using (public.is_account_member(account_id));
create policy manager_synthesis_runs_account_members_modify on public.manager_synthesis_runs for all using (public.is_account_member(account_id)) with check (public.is_account_member(account_id));

alter table public.music_split_contributors enable row level security;
create policy music_split_contributors_account_members_select on public.music_split_contributors for select using (public.is_account_member(account_id));
create policy music_split_contributors_account_members_modify on public.music_split_contributors for all using (public.is_account_member(account_id)) with check (public.is_account_member(account_id));

alter table public.music_split_confirmations enable row level security;
create policy music_split_confirmations_account_members_select on public.music_split_confirmations for select using (public.is_account_member(account_id));
create policy music_split_confirmations_account_members_modify on public.music_split_confirmations for all using (public.is_account_member(account_id)) with check (public.is_account_member(account_id));

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'artists',
    'artist_workspaces',
    'artist_profile_versions',
    'source_sync_jobs',
    'source_snapshots',
    'evidence_items',
    'evidence_links',
    'music_projects',
    'music_project_items',
    'music_identifiers',
    'music_assets',
    'music_credits',
    'music_splits',
    'operating_events',
    'artifact_links',
    'conversations',
    'conversation_messages',
    'manager_context_answers',
    'manager_run_actions',
    'mission_plan_versions',
    'mission_plan_checkpoints',
    'checkpoints',
    'task_steps',
    'task_state_events',
    'task_results',
    'reviews',
    'permission_requests',
    'memory_entries',
    'ai_run_usage_events'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('create policy %I on public.%I for select using (public.is_account_member(account_id))', table_name || '_account_members_select', table_name);
    execute format('create policy %I on public.%I for all using (public.is_account_member(account_id)) with check (public.is_account_member(account_id))', table_name || '_account_members_modify', table_name);
  end loop;
end;
$$;

alter table public.source_providers enable row level security;
create policy source_providers_read_all on public.source_providers for select using (true);

alter table public.agent_profiles enable row level security;
create policy agent_profiles_read_all on public.agent_profiles for select using (true);

alter table public.manager_context_questions enable row level security;
create policy manager_context_questions_read_all on public.manager_context_questions for select using (status = 'active');

alter table public.mission_patterns enable row level security;
create policy mission_patterns_read_all on public.mission_patterns for select using (status = 'active');

alter table public.mission_pattern_versions enable row level security;
create policy mission_pattern_versions_read_all on public.mission_pattern_versions for select using (true);

create index source_connections_artist_idx on public.source_connections (artist_workspace_id, provider_id);
create index source_snapshots_connection_idx on public.source_snapshots (source_connection_id, captured_at desc);
create index evidence_items_artist_idx on public.evidence_items (artist_workspace_id, subject_type, subject_id);
create index music_items_artist_idx on public.music_items (artist_workspace_id, lifecycle_stage);
create index music_projects_artist_idx on public.music_projects (artist_workspace_id, lifecycle_stage);
create index music_identifiers_lookup_idx on public.music_identifiers (identifier_type, identifier_value);
create index operating_events_artist_idx on public.operating_events (artist_workspace_id, created_at desc);
create index conversations_artist_idx on public.conversations (artist_workspace_id, last_update_at desc);
create index missions_artist_idx on public.missions (artist_workspace_id, status, priority desc);
create index tasks_mission_idx on public.tasks (mission_id, primary_checkpoint_id, status);
create index checkpoints_mission_idx on public.checkpoints (mission_id, status);
create index usage_events_artist_idx on public.ai_run_usage_events (artist_workspace_id, workflow_key, created_at desc);

grant select, insert, update, delete on public.music_split_contributors to authenticated;
grant select, insert, update, delete on public.music_split_confirmations to authenticated;
