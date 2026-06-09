-- Auth and RLS permission fixes.
--
-- The core schema migration enables RLS correctly but relies on Supabase's
-- automatic default privileges for the authenticated/anon roles to have
-- table-level access. On some hosted project configurations those grants are
-- not inherited by tables created in migrations, which produces the
-- "permission denied for table <name>" error even when a valid session exists.
--
-- This migration makes all grants explicit so the behaviour is deterministic
-- regardless of how the project was provisioned.

-- ─── Schema usage ─────────────────────────────────────────────────────────────

grant usage on schema public to anon, authenticated, service_role;

-- ─── Public / read-only reference tables ──────────────────────────────────────
-- anon can read these; no write needed from the client.

grant select on public.source_providers          to anon, authenticated;
grant select on public.agent_profiles            to anon, authenticated;
grant select on public.manager_context_questions to anon, authenticated;
grant select on public.mission_patterns          to anon, authenticated;
grant select on public.mission_pattern_versions  to anon, authenticated;

-- ─── Identity / membership tables ─────────────────────────────────────────────
-- authenticated users read their own rows; writes go through security-definer
-- RPCs (create_initial_artist_workspace) so no client INSERT needed here.

grant select on public.accounts            to authenticated;
grant select on public.users               to authenticated;
grant select on public.account_memberships to authenticated;

-- ─── Workspace & artist tables ────────────────────────────────────────────────

grant select, insert, update        on public.artists               to authenticated;
grant select, insert, update        on public.artist_workspaces     to authenticated;
grant select, insert, update, delete on public.artist_profiles      to authenticated;
grant select, insert, update, delete on public.artist_profile_versions to authenticated;

-- ─── Source tables ────────────────────────────────────────────────────────────

grant select, insert, update, delete on public.source_connections  to authenticated;
grant select, insert, update, delete on public.source_sync_jobs    to authenticated;
grant select, insert, update, delete on public.source_snapshots    to authenticated;

-- ─── Evidence tables ──────────────────────────────────────────────────────────

grant select, insert, update, delete on public.evidence_items to authenticated;
grant select, insert, update, delete on public.evidence_links to authenticated;

-- ─── Music tables ─────────────────────────────────────────────────────────────

grant select, insert, update, delete on public.music_items         to authenticated;
grant select, insert, update, delete on public.music_projects      to authenticated;
grant select, insert, update, delete on public.music_project_items to authenticated;
grant select, insert, update, delete on public.music_identifiers   to authenticated;
grant select, insert, update, delete on public.music_assets        to authenticated;
grant select, insert, update, delete on public.music_credits       to authenticated;
grant select, insert, update, delete on public.music_splits        to authenticated;
grant select, insert, update, delete on public.music_split_contributors to authenticated;
grant select, insert, update, delete on public.music_split_confirmations to authenticated;

-- ─── Operating / event tables ─────────────────────────────────────────────────

grant select, insert               on public.operating_events    to authenticated;
grant select, insert, update       on public.artifact_links      to authenticated;

-- ─── Conversation tables ──────────────────────────────────────────────────────

grant select, insert, update, delete on public.conversations         to authenticated;
grant select, insert                 on public.conversation_messages to authenticated;

-- ─── Manager tables ───────────────────────────────────────────────────────────

grant select, insert, update, delete on public.manager_context_answers  to authenticated;
grant select, insert, update         on public.manager_synthesis_runs   to authenticated;
grant select, insert, update         on public.manager_run_actions      to authenticated;

-- ─── Mission / task tables ────────────────────────────────────────────────────

grant select, insert, update, delete on public.missions               to authenticated;
grant select, insert, update, delete on public.mission_plan_versions   to authenticated;
grant select, insert, update, delete on public.mission_plan_checkpoints to authenticated;
grant select, insert, update, delete on public.checkpoints            to authenticated;
grant select, insert, update, delete on public.tasks                  to authenticated;
grant select, insert                 on public.task_steps             to authenticated;
grant select, insert                 on public.task_state_events      to authenticated;
grant select, insert, update         on public.task_results           to authenticated;

-- ─── Review / permission tables ───────────────────────────────────────────────

grant select, insert, update         on public.reviews             to authenticated;
grant select, insert, update         on public.permission_requests to authenticated;

-- ─── Memory / usage tables ────────────────────────────────────────────────────

grant select, insert, update         on public.memory_entries       to authenticated;
grant select, insert, update         on public.ai_run_usage_events  to authenticated;

-- ─── Sequence grants ──────────────────────────────────────────────────────────
-- Needed for any serial/sequence-backed columns (none here since we use gen_random_uuid(),
-- but included for completeness in case sequences are added later).

grant usage on all sequences in schema public to authenticated;

-- ─── RLS: self-service user row upsert ────────────────────────────────────────
-- The create_initial_artist_workspace RPC inserts/updates the users row via
-- security definer, so no additional policy is needed for that path.
-- However, allow an authenticated user to update their own display_name/email
-- directly if needed (e.g. profile settings future work).

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'users'
      and policyname = 'users_self_upsert'
  ) then
    execute $policy$
      create policy users_self_upsert on public.users
        for all
        using (id = auth.uid())
        with check (id = auth.uid())
    $policy$;
  end if;
end;
$$;

-- ─── RLS: accounts insert for initial onboarding ──────────────────────────────
-- The create_initial_artist_workspace RPC (security definer) handles account
-- creation, so direct client inserts are NOT needed and should stay blocked.
-- This comment documents the intentional design: accounts are always created
-- through the RPC, never directly from the client.

-- ─── RLS: artists / workspaces ────────────────────────────────────────────────
-- The bulk-loop policy in the core schema covers artist_workspaces but not
-- artists itself with explicit modify policies. Verify both exist.

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'artists'
      and policyname = 'artists_account_members_select'
  ) then
    execute $policy$
      create policy artists_account_members_select on public.artists
        for select using (public.is_account_member(account_id))
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'artists'
      and policyname = 'artists_account_members_modify'
  ) then
    execute $policy$
      create policy artists_account_members_modify on public.artists
        for all
        using (public.is_account_member(account_id))
        with check (public.is_account_member(account_id))
    $policy$;
  end if;
end;
$$;

-- Enable RLS on artists if it wasn't already (the bulk loop in the core
-- migration did not include artists explicitly).
alter table public.artists enable row level security;

-- ─── Re-grant execute on the onboarding RPC ───────────────────────────────────
-- Belt-and-suspenders: ensure the grant survives any re-run of migrations.

grant execute on function public.create_initial_artist_workspace(text, text) to authenticated;

-- ─── is_account_member: ensure function is stable security definer ─────────────
-- Re-create to make certain the definition is exactly as intended; idempotent.

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
      and membership.user_id    = auth.uid()
      and membership.status     = 'active'
  );
$$;
