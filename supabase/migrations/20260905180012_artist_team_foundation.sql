-- Additive foundation for one-artist Team workspaces.
-- No workspace is enabled by this migration; rollout requires an explicit
-- settings row and a verified base entitlement or pilot.

-- The identity-boundary migration is normally earlier in migration order. Keep
-- this guard so a copied migration set fails clearly instead of creating an
-- unscoped Team foreign key.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.artist_workspaces'::regclass
      and conname = 'artist_workspaces_identity_scope_key'
  ) then
    alter table public.artist_workspaces
      add constraint artist_workspaces_identity_scope_key
      unique (id, account_id, artist_id);
  end if;
end;
$$;

create or replace function public._team_tags_valid_v1(p_tags text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    cardinality(p_tags) <= 12
      and coalesce((
        select bool_and(
          tag is not null
          and tag = pg_catalog.btrim(tag)
          and pg_catalog.char_length(tag) between 1 and 48
        )
        from pg_catalog.unnest(p_tags) as item(tag)
      ), true)
      and cardinality(p_tags) = (
        select count(distinct tag)
        from pg_catalog.unnest(p_tags) as item(tag)
      ),
    false
  );
$$;

alter table public.account_memberships
  add column if not exists operating_title text,
  add column if not exists responsibility_tags text[] not null default '{}'::text[],
  add column if not exists updated_at timestamptz not null default now();

alter table public.account_memberships
  drop constraint if exists account_memberships_operating_title_check,
  add constraint account_memberships_operating_title_check check (
    operating_title is null
      or (operating_title = btrim(operating_title) and char_length(operating_title) between 1 and 80)
  ),
  drop constraint if exists account_memberships_responsibility_tags_check,
  add constraint account_memberships_responsibility_tags_check check (
    public._team_tags_valid_v1(responsibility_tags)
  );

drop trigger if exists account_memberships_set_updated_at on public.account_memberships;
create trigger account_memberships_set_updated_at
before update on public.account_memberships
for each row execute function public.set_updated_at();

alter table public.tasks
  add column if not exists assignee_user_id uuid references public.users(id) on delete set null,
  add column if not exists assignment_reason text,
  add column if not exists assignment_source text,
  add column if not exists assignment_version integer not null default 0;

alter table public.tasks
  drop constraint if exists tasks_assignment_reason_check,
  add constraint tasks_assignment_reason_check check (
    assignment_reason is null
      or (assignment_reason = btrim(assignment_reason) and char_length(assignment_reason) <= 240)
  ),
  drop constraint if exists tasks_assignment_source_check,
  add constraint tasks_assignment_source_check check (
    assignment_source is null or assignment_source in ('manager', 'owner', 'solo_fallback')
  ),
  drop constraint if exists tasks_assignment_version_check,
  add constraint tasks_assignment_version_check check (assignment_version >= 0);

create index if not exists tasks_workspace_assignee_active_idx
  on public.tasks (artist_workspace_id, assignee_user_id)
  where archived_at is null;

-- The provider identity is persisted on both checkout and subscription rows.
-- Legacy rows retain solo behavior until a verified catalog mapping marks them
-- as Team.
alter table public.billing_checkout_sessions
  add column if not exists plan_key text not null default 'solo';
alter table public.billing_checkout_sessions
  drop constraint if exists billing_checkout_sessions_plan_key_check,
  add constraint billing_checkout_sessions_plan_key_check
    check (plan_key in ('solo', 'team_6'));

alter table public.billing_subscriptions
  add column if not exists plan_key text not null default 'solo';
alter table public.billing_subscriptions
  drop constraint if exists billing_subscriptions_plan_key_check,
  add constraint billing_subscriptions_plan_key_check
    check (plan_key in ('solo', 'team_6'));

create table if not exists public.workspace_team_settings (
  account_id uuid primary key references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null unique,
  artist_id uuid not null,
  enabled boolean not null default false,
  pilot_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspace_team_settings_scope_fkey
    foreign key (artist_workspace_id, account_id, artist_id)
    references public.artist_workspaces(id, account_id, artist_id)
    on delete cascade
);

create table if not exists public.billing_plan_catalog (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_product_id text not null,
  provider_price_id text not null,
  plan_key text not null check (plan_key in ('solo', 'team_6')),
  billing_interval text not null check (billing_interval in ('monthly', 'yearly')),
  seat_limit integer not null check (seat_limit in (1, 6)),
  artist_limit integer not null default 1 check (artist_limit = 1),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_product_id, provider_price_id)
);

create table if not exists public.account_invitations (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null,
  email text not null,
  invited_by_user_id uuid not null references public.users(id) on delete restrict,
  token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired', 'revoked')),
  expires_at timestamptz not null,
  accepted_by_user_id uuid references public.users(id) on delete set null,
  accepted_at timestamptz,
  operating_title text,
  responsibility_tags text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint account_invitations_workspace_scope_fkey
    foreign key (artist_workspace_id, account_id, artist_id)
    references public.artist_workspaces(id, account_id, artist_id)
    on delete cascade,
  constraint account_invitations_email_normalized_check
    check (email = lower(btrim(email)) and email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'),
  constraint account_invitations_token_hash_check
    check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint account_invitations_title_check
    check (operating_title is null or (operating_title = btrim(operating_title) and char_length(operating_title) between 1 and 80)),
  constraint account_invitations_tags_check
    check (public._team_tags_valid_v1(responsibility_tags))
);

-- Repair the first draft of this migration if it was applied in a disposable
-- database before the scope column was added.
alter table public.account_invitations
  add column if not exists artist_id uuid;
update public.account_invitations invitation
set artist_id = workspace.artist_id
from public.artist_workspaces workspace
where workspace.id = invitation.artist_workspace_id
  and invitation.artist_id is null;
alter table public.account_invitations
  alter column artist_id set not null;
alter table public.account_invitations
  drop constraint if exists account_invitations_artist_workspace_id_fkey,
  drop constraint if exists account_invitations_workspace_scope_fkey;
alter table public.account_invitations
  add constraint account_invitations_workspace_scope_fkey
    foreign key (artist_workspace_id, account_id, artist_id)
    references public.artist_workspaces(id, account_id, artist_id)
    on delete cascade;

create unique index if not exists account_invitations_pending_email_uidx
  on public.account_invitations (account_id, lower(email))
  where status = 'pending';
create index if not exists account_invitations_account_status_expiry_idx
  on public.account_invitations (account_id, status, expires_at);

create table if not exists public.account_team_request_log (
  id bigint generated always as identity primary key,
  account_id uuid not null references public.accounts(id) on delete cascade,
  normalized_email_hash text,
  operation text not null check (operation in ('invite', 'rotate_invite')),
  created_at timestamptz not null default now(),
  check (normalized_email_hash is null or normalized_email_hash ~ '^[0-9a-f]{64}$')
);
create index if not exists account_team_request_log_rate_idx
  on public.account_team_request_log (account_id, created_at desc);

drop trigger if exists workspace_team_settings_set_updated_at on public.workspace_team_settings;
create trigger workspace_team_settings_set_updated_at
before update on public.workspace_team_settings
for each row execute function public.set_updated_at();
drop trigger if exists billing_plan_catalog_set_updated_at on public.billing_plan_catalog;
create trigger billing_plan_catalog_set_updated_at
before update on public.billing_plan_catalog
for each row execute function public.set_updated_at();
drop trigger if exists account_invitations_set_updated_at on public.account_invitations;
create trigger account_invitations_set_updated_at
before update on public.account_invitations
for each row execute function public.set_updated_at();

-- Fact-only base access. It deliberately does not inspect auth.uid() or
-- memberships, so entitlement wrappers can add their own caller checks
-- without recursing through is_account_member.
create or replace function public._workspace_has_base_access_v1(p_artist_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select exists (
    select 1
    from public.billing_subscriptions subscription
    where subscription.artist_workspace_id = p_artist_workspace_id
      and (
        (subscription.provider = 'paddle' and subscription.status in ('active', 'trialing'))
        or
        (subscription.provider = 'paystack' and subscription.status in ('active', 'non-renewing', 'attention'))
      )
      and (subscription.current_period_end is null or subscription.current_period_end > pg_catalog.now())
  )
  or exists (
    select 1
    from public.workspace_access_grants grant_record
    where grant_record.artist_workspace_id = p_artist_workspace_id
      and grant_record.access_type = 'private_beta'
      and grant_record.status = 'active'
      and grant_record.starts_at <= pg_catalog.now()
      and grant_record.ends_at > pg_catalog.now()
  );
$$;

create or replace function public._workspace_team_capability_v1(p_artist_workspace_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  with workspace as (
    select
      workspace.id,
      workspace.account_id,
      workspace.artist_id,
      settings.enabled,
      settings.pilot_ends_at,
      (settings.account_id is not null) as configured
    from public.artist_workspaces workspace
    left join public.workspace_team_settings settings
      on settings.artist_workspace_id = workspace.id
    where workspace.id = p_artist_workspace_id
  ),
  team_subscription as (
    select
      coalesce(bool_or(true), false) as paid,
      max(subscription.current_period_end) as ends_at
    from public.billing_subscriptions subscription
    join public.billing_plan_catalog catalog
      on catalog.provider = subscription.provider
      and catalog.provider_product_id = subscription.provider_product_id
      and catalog.provider_price_id = subscription.provider_price_id
      and catalog.plan_key = 'team_6'
      and catalog.active = true
    where subscription.artist_workspace_id = p_artist_workspace_id
      and subscription.plan_key = 'team_6'
      and (
        (subscription.provider = 'paddle' and subscription.status in ('active', 'trialing'))
        or
        (subscription.provider = 'paystack' and subscription.status in ('active', 'non-renewing', 'attention'))
      )
      and (subscription.current_period_end is null or subscription.current_period_end > pg_catalog.now())
  ),
  capability as (
    select
      workspace.*,
      public._workspace_has_base_access_v1(workspace.id) as base_access,
      team_subscription.paid,
      team_subscription.ends_at as paid_ends_at,
      (workspace.pilot_ends_at is not null and workspace.pilot_ends_at > pg_catalog.now()) as pilot_active
    from workspace
    cross join team_subscription
  )
  select pg_catalog.jsonb_build_object(
    'accountId', capability.account_id,
    'artistWorkspaceId', capability.id,
    'artistId', capability.artist_id,
    -- A Team plan is a verified provider catalog mapping (or an explicit,
    -- time-bound pilot). A settings row alone never upgrades an account.
    'planKey', case when capability.paid or capability.pilot_active then 'team_6' else 'solo' end,
    'enabled', coalesce(capability.enabled, false),
    'entitled', capability.base_access and (capability.paid or capability.pilot_active),
    'source', case when capability.paid then 'subscription' when capability.pilot_active then 'pilot' else 'none' end,
    'seatLimit', case when capability.paid or capability.pilot_active then 6 else 1 end,
    'occupiedSeats', (
      select count(*)
      from public.account_memberships membership
      where membership.account_id = capability.account_id
        and membership.status = 'active'
        and membership.role in ('owner', 'member')
    ),
    'reservedSeats', (
      select count(*)
      from public.account_invitations invitation
      where invitation.account_id = capability.account_id
        and invitation.status = 'pending'
        and invitation.expires_at > pg_catalog.now()
    ),
    'endsAt', case
      when capability.paid then capability.paid_ends_at
      when capability.pilot_active then capability.pilot_ends_at
      else null
    end
  )
  from capability;
$$;

create or replace function public.has_active_workspace_entitlement(p_artist_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  with workspace as (
    select workspace.id, workspace.account_id
    from public.artist_workspaces workspace
    where workspace.id = p_artist_workspace_id
  ),
  caller_membership as (
    select membership.role
    from public.account_memberships membership
    join workspace on workspace.account_id = membership.account_id
    where membership.user_id = auth.uid()
      and membership.status = 'active'
      and membership.role in ('owner', 'member', 'admin_support')
    limit 1
  ),
  capability as (
    select public._workspace_team_capability_v1(p_artist_workspace_id) as value
  )
  select public._workspace_has_base_access_v1(p_artist_workspace_id)
    and (
      coalesce(auth.jwt()->>'role', '') = 'service_role'
      or exists (select 1 from caller_membership)
    )
    and (
      coalesce(auth.jwt()->>'role', '') = 'service_role'
      or not exists (
        select 1
        from public.workspace_team_settings settings
        join workspace on workspace.account_id = settings.account_id
        where settings.artist_workspace_id = p_artist_workspace_id
      )
      or exists (
        select 1
        from caller_membership
        where caller_membership.role = 'owner'
      )
      or (
        coalesce((select (value->>'enabled')::boolean from capability), false)
        and coalesce((select (value->>'entitled')::boolean from capability), false)
      )
    );
$$;

create or replace function public.get_workspace_team_capability_v1(p_artist_workspace_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  workspace_account_id uuid;
  caller_role text;
  capability jsonb;
begin
  select workspace.account_id
  into workspace_account_id
  from public.artist_workspaces workspace
  where workspace.id = p_artist_workspace_id;
  if workspace_account_id is null then
    raise exception 'TEAM_NOT_FOUND';
  end if;

  caller_role := coalesce(auth.jwt()->>'role', '');
  if caller_role <> 'service_role' and not exists (
    select 1
    from public.account_memberships membership
    where membership.account_id = workspace_account_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
      and membership.role in ('owner', 'member')
  ) then
    raise exception 'TEAM_FORBIDDEN';
  end if;

  capability := public._workspace_team_capability_v1(p_artist_workspace_id);
  if caller_role <> 'service_role'
     and exists (
       select 1 from public.account_memberships membership
       where membership.account_id = workspace_account_id
         and membership.user_id = auth.uid()
         and membership.status = 'active'
         and membership.role = 'member'
     )
     and (not coalesce((capability->>'enabled')::boolean, false)
          or not coalesce((capability->>'entitled')::boolean, false)) then
    raise exception 'TEAM_FORBIDDEN';
  end if;
  return capability;
end;
$$;

create or replace function public.get_workspace_roster_v1(p_artist_workspace_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  workspace_row public.artist_workspaces%rowtype;
  members jsonb;
  capability jsonb;
  caller_role text;
begin
  select *
  into workspace_row
  from public.artist_workspaces workspace
  where workspace.id = p_artist_workspace_id;
  if not found then
    raise exception 'TEAM_NOT_FOUND';
  end if;

  caller_role := coalesce(auth.jwt()->>'role', '');
  if caller_role <> 'service_role' and not exists (
    select 1
    from public.account_memberships membership
    where membership.account_id = workspace_row.account_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
      and membership.role in ('owner', 'member')
  ) then
    raise exception 'TEAM_FORBIDDEN';
  end if;
  capability := public._workspace_team_capability_v1(p_artist_workspace_id);
  if caller_role <> 'service_role'
     and exists (
       select 1 from public.account_memberships membership
       where membership.account_id = workspace_row.account_id
         and membership.user_id = auth.uid()
         and membership.status = 'active'
         and membership.role = 'member'
     )
     and (not coalesce((capability->>'enabled')::boolean, false)
          or not coalesce((capability->>'entitled')::boolean, false)) then
    raise exception 'TEAM_FORBIDDEN';
  end if;

  select coalesce(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'userId', membership.user_id,
      'displayName', coalesce(nullif(pg_catalog.btrim(app_user.display_name), ''), 'Team member'),
      'accessRole', membership.role,
      'operatingTitle', membership.operating_title,
      'responsibilityTags', membership.responsibility_tags
    )
    order by case when membership.role = 'owner' then 0 else 1 end,
      membership.created_at,
      membership.user_id
  ), '[]'::jsonb)
  into members
  from public.account_memberships membership
  join public.users app_user on app_user.id = membership.user_id
  where membership.account_id = workspace_row.account_id
    and membership.status = 'active'
    and membership.role in ('owner', 'member')
    and app_user.status = 'active';

  return pg_catalog.jsonb_build_object(
    'scope', pg_catalog.jsonb_build_object(
      'accountId', workspace_row.account_id,
      'artistWorkspaceId', workspace_row.id,
      'artistId', workspace_row.artist_id
    ),
    'members', members,
    'loadedAt', pg_catalog.now()
  );
end;
$$;

create or replace function public.list_account_invitations_v1(p_artist_workspace_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
set row_security = off
as $$
declare
  workspace_account_id uuid;
  caller_role text;
  result jsonb;
begin
  select workspace.account_id
  into workspace_account_id
  from public.artist_workspaces workspace
  where workspace.id = p_artist_workspace_id;
  if workspace_account_id is null then
    raise exception 'TEAM_NOT_FOUND';
  end if;

  caller_role := coalesce(auth.jwt()->>'role', '');
  if caller_role <> 'service_role' and not exists (
    select 1
    from public.account_memberships membership
    where membership.account_id = workspace_account_id
      and membership.user_id = auth.uid()
      and membership.role = 'owner'
      and membership.status = 'active'
  ) then
    raise exception 'TEAM_FORBIDDEN';
  end if;

  select coalesce(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'id', invitation.id,
      'artistWorkspaceId', invitation.artist_workspace_id,
      'email', invitation.email,
      'status', case
        when invitation.status = 'pending' and invitation.expires_at <= pg_catalog.now() then 'expired'
        else invitation.status
      end,
      'expiresAt', invitation.expires_at,
      'operatingTitle', invitation.operating_title,
      'responsibilityTags', invitation.responsibility_tags
    ) order by invitation.created_at desc
  ), '[]'::jsonb)
  into result
  from public.account_invitations invitation
  where invitation.account_id = workspace_account_id
    and invitation.artist_workspace_id = p_artist_workspace_id;
  return result;
end;
$$;

-- A Team binding is an account-wide invariant. The account lock serializes
-- concurrent artist/workspace creation before the count is checked.
create or replace function public.enforce_single_workspace_team_account_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  account_id_value uuid := new.account_id;
  settings_row public.workspace_team_settings%rowtype;
begin
  perform 1 from public.accounts account_row where account_row.id = account_id_value for update;
  select * into settings_row
  from public.workspace_team_settings settings
  where settings.account_id = account_id_value;

  if not found then
    return new;
  end if;

  if not exists (
    select 1 from public.artist_workspaces workspace
    where workspace.id = settings_row.artist_workspace_id
      and workspace.account_id = settings_row.account_id
      and workspace.artist_id = settings_row.artist_id
  ) then
    raise exception 'TEAM_CONFLICT: Team workspace scope is invalid';
  end if;
  if (select count(*) from public.artist_workspaces workspace where workspace.account_id = account_id_value) > 1
     or (select count(*) from public.artists artist where artist.account_id = account_id_value) > 1 then
    raise exception 'TEAM_CONFLICT: a Team account is limited to one artist workspace';
  end if;
  return new;
end;
$$;

drop trigger if exists artist_workspaces_team_singleton_guard on public.artist_workspaces;
create trigger artist_workspaces_team_singleton_guard
after insert or update of account_id, artist_id on public.artist_workspaces
for each row execute function public.enforce_single_workspace_team_account_v1();
drop trigger if exists artists_team_singleton_guard on public.artists;
create trigger artists_team_singleton_guard
after insert or update of account_id on public.artists
for each row execute function public.enforce_single_workspace_team_account_v1();
drop trigger if exists workspace_team_settings_singleton_guard on public.workspace_team_settings;
create trigger workspace_team_settings_singleton_guard
after insert or update of account_id, artist_workspace_id, artist_id, enabled on public.workspace_team_settings
for each row execute function public.enforce_single_workspace_team_account_v1();

alter table public.workspace_team_settings enable row level security;
alter table public.billing_plan_catalog enable row level security;
alter table public.account_invitations enable row level security;
alter table public.account_team_request_log enable row level security;
revoke all on public.workspace_team_settings, public.billing_plan_catalog,
  public.account_invitations, public.account_team_request_log
  from public, anon, authenticated;
grant all on public.workspace_team_settings, public.billing_plan_catalog,
  public.account_invitations, public.account_team_request_log to service_role;

revoke all on function public._workspace_has_base_access_v1(uuid),
  public._workspace_team_capability_v1(uuid)
  from public, anon, authenticated;
grant execute on function public._workspace_has_base_access_v1(uuid),
  public._workspace_team_capability_v1(uuid) to service_role;

revoke all on function public.get_workspace_team_capability_v1(uuid),
  public.get_workspace_roster_v1(uuid), public.list_account_invitations_v1(uuid)
  from public, anon;
grant execute on function public.get_workspace_team_capability_v1(uuid),
  public.get_workspace_roster_v1(uuid), public.list_account_invitations_v1(uuid)
  to authenticated, service_role;

revoke all on function public.enforce_single_workspace_team_account_v1() from public, anon, authenticated;
revoke all on function public._team_tags_valid_v1(text[]) from public, anon, authenticated;
grant execute on function public._team_tags_valid_v1(text[]) to service_role;

alter function public._workspace_has_base_access_v1(uuid) owner to postgres;
alter function public._workspace_team_capability_v1(uuid) owner to postgres;
alter function public.has_active_workspace_entitlement(uuid) owner to postgres;
alter function public.get_workspace_team_capability_v1(uuid) owner to postgres;
alter function public.get_workspace_roster_v1(uuid) owner to postgres;
alter function public.list_account_invitations_v1(uuid) owner to postgres;
alter function public.enforce_single_workspace_team_account_v1() owner to postgres;

notify pgrst, 'reload schema';
