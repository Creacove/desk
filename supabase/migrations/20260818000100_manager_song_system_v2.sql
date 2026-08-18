-- Manager + Song System V2
-- Additive foundation only. Existing music/split rows remain valid while the app migrates.

create table if not exists public.music_contributors (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  display_name text not null,
  legal_name text,
  email text,
  metadata jsonb not null default '{}'::jsonb,
  created_by_type public.created_by_type not null default 'user'::public.created_by_type,
  created_by_id uuid,
  created_from_run_id uuid,
  created_from_action_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint music_contributors_display_name_nonempty check (length(btrim(display_name)) > 0)
);

create index if not exists music_contributors_workspace_idx
  on public.music_contributors (artist_workspace_id, artist_id, lower(display_name));
create index if not exists music_contributors_email_idx
  on public.music_contributors (artist_workspace_id, lower(email))
  where email is not null and btrim(email) <> '';

alter table public.music_credits
  add column if not exists contributor_id uuid references public.music_contributors(id) on delete set null;

alter table public.music_split_contributors
  add column if not exists contributor_id uuid references public.music_contributors(id) on delete set null;

create index if not exists music_credits_contributor_idx
  on public.music_credits (contributor_id)
  where contributor_id is not null;
create index if not exists music_split_contributors_contributor_idx
  on public.music_split_contributors (contributor_id)
  where contributor_id is not null;

-- One canonical person per existing split contributor. We intentionally do not
-- globally deduplicate on name alone; identity resolution happens in the app.
insert into public.music_contributors (
  account_id,
  artist_workspace_id,
  artist_id,
  display_name,
  email,
  created_by_type,
  created_at,
  updated_at
)
select
  sc.account_id,
  sc.artist_workspace_id,
  sc.artist_id,
  sc.name,
  nullif(btrim(sc.email), ''),
  'system'::public.created_by_type,
  sc.created_at,
  sc.updated_at
from public.music_split_contributors sc
where sc.contributor_id is null
  and not exists (
    select 1
    from public.music_contributors c
    where c.artist_workspace_id = sc.artist_workspace_id
      and c.artist_id = sc.artist_id
      and lower(btrim(c.display_name)) = lower(btrim(sc.name))
      and coalesce(lower(btrim(c.email)), '') = coalesce(lower(btrim(nullif(sc.email, ''))), '')
  );

update public.music_split_contributors sc
set contributor_id = c.id
from public.music_contributors c
where sc.contributor_id is null
  and c.artist_workspace_id = sc.artist_workspace_id
  and c.artist_id = sc.artist_id
  and lower(btrim(c.display_name)) = lower(btrim(sc.name))
  and coalesce(lower(btrim(c.email)), '') = coalesce(lower(btrim(nullif(sc.email, ''))), '');

-- Durable Manager operations are separate from synthesis runs. This is the
-- cross-turn idempotency boundary for artifact actions such as prepare_pitch.
create table if not exists public.manager_operations (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete cascade,
  manager_synthesis_run_id uuid references public.manager_synthesis_runs(id) on delete set null,
  subject_type text,
  subject_id uuid,
  artifact_id text,
  target_id text,
  operation_type text not null,
  operation_key text not null,
  status text not null default 'pending' check (status in ('pending','running','completed','failed','cancelled')),
  input_payload jsonb not null default '{}'::jsonb,
  result_payload jsonb not null default '{}'::jsonb,
  error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint manager_operations_operation_type_nonempty check (length(btrim(operation_type)) > 0),
  constraint manager_operations_operation_key_nonempty check (length(btrim(operation_key)) > 0)
);

create unique index if not exists manager_operations_active_key_unique
  on public.manager_operations (account_id, artist_workspace_id, operation_key)
  where status in ('pending','running','completed');
create index if not exists manager_operations_conversation_idx
  on public.manager_operations (conversation_id, created_at desc)
  where conversation_id is not null;
create index if not exists manager_operations_subject_idx
  on public.manager_operations (subject_type, subject_id, created_at desc)
  where subject_id is not null;

alter table public.music_contributors enable row level security;
alter table public.manager_operations enable row level security;

grant select, insert, update, delete on public.music_contributors to authenticated;
grant select, insert, update, delete on public.manager_operations to authenticated;
grant all on public.music_contributors to service_role;
grant all on public.manager_operations to service_role;

create policy "music_contributors_workspace_member_select"
  on public.music_contributors for select to authenticated
  using (public.is_account_member(account_id));
create policy "music_contributors_workspace_member_insert"
  on public.music_contributors for insert to authenticated
  with check (public.is_account_member(account_id));
create policy "music_contributors_workspace_member_update"
  on public.music_contributors for update to authenticated
  using (public.is_account_member(account_id))
  with check (public.is_account_member(account_id));
create policy "music_contributors_workspace_member_delete"
  on public.music_contributors for delete to authenticated
  using (public.is_account_member(account_id));

create policy "manager_operations_workspace_member_select"
  on public.manager_operations for select to authenticated
  using (public.is_account_member(account_id));
create policy "manager_operations_workspace_member_insert"
  on public.manager_operations for insert to authenticated
  with check (public.is_account_member(account_id));
create policy "manager_operations_workspace_member_update"
  on public.manager_operations for update to authenticated
  using (public.is_account_member(account_id))
  with check (public.is_account_member(account_id));
create policy "manager_operations_workspace_member_delete"
  on public.manager_operations for delete to authenticated
  using (public.is_account_member(account_id));
