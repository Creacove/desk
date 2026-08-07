-- Private, revocable release delivery links. The public capability is held only
-- by a SHA-256 token hash; the raw token is returned once by the Edge Function.

create table public.music_share_links (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  music_item_id uuid references public.music_items(id) on delete cascade,
  music_project_id uuid references public.music_projects(id) on delete cascade,
  label text not null default 'Shared release package',
  access_mode text not null default 'link' check (access_mode in ('link', 'email_restricted')),
  recipient_email text,
  preset text not null default 'custom' check (preset in ('listen', 'epk_press', 'delivery', 'custom')),
  asset_manifest jsonb not null default '[]'::jsonb,
  token_hash text not null unique,
  state text not null default 'active' check (state in ('active', 'revoked', 'expired')),
  expires_at timestamptz,
  last_accessed_at timestamptz,
  access_count integer not null default 0 check (access_count >= 0),
  created_by_id uuid,
  created_from_run_id uuid references public.manager_synthesis_runs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((music_item_id is not null) <> (music_project_id is not null)),
  check (access_mode <> 'email_restricted' or recipient_email is not null)
);

create index music_share_links_subject_idx
  on public.music_share_links (artist_workspace_id, music_item_id, music_project_id, state, created_at desc);

create index music_share_links_token_idx
  on public.music_share_links (token_hash, state);

create trigger music_share_links_set_updated_at
  before update on public.music_share_links
  for each row execute function public.set_updated_at();

create or replace function public.record_music_share_link_access(target_share_link_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.music_share_links
  set
    access_count = access_count + 1,
    last_accessed_at = now()
  where id = target_share_link_id
    and state = 'active';
end;
$$;

revoke all on function public.record_music_share_link_access(uuid) from public;
grant execute on function public.record_music_share_link_access(uuid) to service_role;

alter table public.music_share_links enable row level security;
create policy music_share_links_account_members_select
  on public.music_share_links for select using (public.is_account_member(account_id));
create policy music_share_links_account_members_modify
  on public.music_share_links for all using (public.is_account_member(account_id)) with check (public.is_account_member(account_id));

grant select, insert, update on public.music_share_links to authenticated;
grant select, insert, update on public.music_share_links to service_role;
