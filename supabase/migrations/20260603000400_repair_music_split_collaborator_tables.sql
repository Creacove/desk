do $$
begin
  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'music_split_contributor_status') then
    create type public.music_split_contributor_status as enum ('draft', 'pending', 'confirmed', 'rejected', 'disputed', 'revoked');
  end if;

  if not exists (select 1 from pg_type where typnamespace = 'public'::regnamespace and typname = 'music_split_confirmation_status') then
    create type public.music_split_confirmation_status as enum ('created', 'sent', 'opened', 'confirmed', 'rejected', 'expired', 'revoked', 'superseded');
  end if;
end $$;

create table if not exists public.music_split_contributors (
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

create table if not exists public.music_split_confirmations (
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

create unique index if not exists music_split_confirmations_unique_active_token
on public.music_split_confirmations (confirmation_token_hash)
where status in ('created', 'sent', 'opened');

create index if not exists music_split_contributors_split_idx
on public.music_split_contributors (music_split_id, approval_status);

create index if not exists music_split_confirmations_contributor_idx
on public.music_split_confirmations (music_split_contributor_id, status);

drop trigger if exists music_split_contributors_set_updated_at on public.music_split_contributors;
create trigger music_split_contributors_set_updated_at
before update on public.music_split_contributors
for each row execute function public.set_updated_at();

drop trigger if exists music_split_confirmations_set_updated_at on public.music_split_confirmations;
create trigger music_split_confirmations_set_updated_at
before update on public.music_split_confirmations
for each row execute function public.set_updated_at();

alter table public.music_split_contributors enable row level security;
alter table public.music_split_confirmations enable row level security;

drop policy if exists music_split_contributors_account_members_select on public.music_split_contributors;
create policy music_split_contributors_account_members_select
on public.music_split_contributors
for select using (public.is_account_member(account_id));

drop policy if exists music_split_contributors_account_members_modify on public.music_split_contributors;
create policy music_split_contributors_account_members_modify
on public.music_split_contributors
for all using (public.is_account_member(account_id))
with check (public.is_account_member(account_id));

drop policy if exists music_split_confirmations_account_members_select on public.music_split_confirmations;
create policy music_split_confirmations_account_members_select
on public.music_split_confirmations
for select using (public.is_account_member(account_id));

drop policy if exists music_split_confirmations_account_members_modify on public.music_split_confirmations;
create policy music_split_confirmations_account_members_modify
on public.music_split_confirmations
for all using (public.is_account_member(account_id))
with check (public.is_account_member(account_id));

grant select, insert, update, delete on public.music_split_contributors to authenticated;
grant select, insert, update, delete on public.music_split_confirmations to authenticated;

notify pgrst, 'reload schema';
