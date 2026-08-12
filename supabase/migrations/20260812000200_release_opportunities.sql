-- Source-backed playlist and press opportunities.
--
-- This is a song-scoped shortlist record. It stores public provenance and
-- preparation state only; it does not send messages or create private contact
-- records.

create table public.release_opportunities (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  music_item_id uuid not null references public.music_items(id) on delete cascade,
  mission_id uuid references public.missions(id) on delete set null,
  opportunity_type text not null
    check (opportunity_type in ('playlist', 'press')),
  platform text,
  target_name text not null,
  source_url text not null,
  target_url text,
  public_organization text,
  contact_kind text
    check (contact_kind is null or contact_kind in ('email', 'submission_form', 'contact_page')),
  public_contact_value text,
  public_contact_source_url text,
  contact_verified_at timestamptz,
  fit_json jsonb not null default '{}'::jsonb,
  evidence_json jsonb not null default '[]'::jsonb,
  confidence text not null default 'unknown',
  limitations_json jsonb not null default '[]'::jsonb,
  safety_state text not null default 'caution'
    check (safety_state in ('clear', 'caution', 'excluded')),
  requirements_json jsonb not null default '[]'::jsonb,
  package_json jsonb not null default '{}'::jsonb,
  pitch_document_id uuid references public.documents(id) on delete set null,
  manager_output_id uuid references public.manager_outputs(id) on delete set null,
  status text not null default 'watch'
    check (status in ('watch', 'shortlisted', 'approved', 'submitted_manually', 'replied', 'accepted', 'declined', 'skipped')),
  manual_outcome text,
  dedupe_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (music_item_id, opportunity_type, dedupe_key)
);

create index release_opportunities_song_idx
  on public.release_opportunities (account_id, artist_workspace_id, artist_id, music_item_id, opportunity_type, status);

create index release_opportunities_mission_idx
  on public.release_opportunities (mission_id, updated_at desc)
  where mission_id is not null;

create trigger release_opportunities_set_updated_at
before update on public.release_opportunities
for each row execute function public.set_updated_at();

alter table public.release_opportunities enable row level security;

create policy release_opportunities_account_members_select
on public.release_opportunities for select
using (public.is_account_member(account_id));

revoke all on public.release_opportunities from public, anon;
grant select on public.release_opportunities to authenticated;
grant select, insert, update, delete on public.release_opportunities to service_role;

notify pgrst, 'reload schema';
