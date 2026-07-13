-- Invite-only private beta access. Billing records remain Paystack-only.

create extension if not exists pgcrypto;

create table public.private_beta_batches (
  id uuid primary key default gen_random_uuid(),
  partner_name text not null check (length(trim(partner_name)) > 0),
  recipient_email text not null check (position('@' in recipient_email) > 1),
  quantity integer not null check (quantity between 1 and 100),
  access_days integer not null default 30 check (access_days = 30),
  status text not null default 'active' check (status in ('active', 'revoked', 'expired')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.private_beta_codes (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.private_beta_batches(id) on delete cascade,
  code_hash text not null unique,
  code_hint text not null,
  status text not null default 'active' check (status in ('active', 'redeemed', 'revoked')),
  redeemed_by_user_id uuid references public.users(id) on delete set null,
  redeemed_checkout_session_id uuid references public.billing_checkout_sessions(id) on delete set null,
  redeemed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_access_grants (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  checkout_session_id uuid not null references public.billing_checkout_sessions(id) on delete cascade,
  private_beta_code_id uuid not null unique references public.private_beta_codes(id) on delete restrict,
  access_type text not null default 'private_beta' check (access_type = 'private_beta'),
  status text not null default 'active' check (status in ('active', 'expired', 'revoked')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, checkout_session_id)
);

create table public.transactional_email_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  template text not null,
  recipient_email text not null,
  user_id uuid,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  provider_message_id text,
  attempts integer not null default 0,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index private_beta_codes_batch_status_idx
  on public.private_beta_codes (batch_id, status);
create index workspace_access_grants_workspace_status_idx
  on public.workspace_access_grants (artist_workspace_id, status, ends_at desc);
create index workspace_access_grants_user_status_idx
  on public.workspace_access_grants (user_id, status, ends_at desc);

create trigger private_beta_batches_set_updated_at
  before update on public.private_beta_batches
  for each row execute function public.set_updated_at();
create trigger private_beta_codes_set_updated_at
  before update on public.private_beta_codes
  for each row execute function public.set_updated_at();
create trigger workspace_access_grants_set_updated_at
  before update on public.workspace_access_grants
  for each row execute function public.set_updated_at();
create trigger transactional_email_deliveries_set_updated_at
  before update on public.transactional_email_deliveries
  for each row execute function public.set_updated_at();

create or replace function public.has_active_workspace_entitlement(p_artist_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.billing_subscriptions subscription
      join public.artist_workspaces workspace on workspace.id = subscription.artist_workspace_id
      where subscription.artist_workspace_id = p_artist_workspace_id
        and subscription.status in ('active', 'non-renewing', 'attention')
        and (subscription.current_period_end is null or subscription.current_period_end > now())
        and (
          public.is_account_member(workspace.account_id)
          or current_setting('request.jwt.claim.role', true) = 'service_role'
        )
    )
    or exists (
      select 1
      from public.workspace_access_grants grant_record
      join public.artist_workspaces workspace on workspace.id = grant_record.artist_workspace_id
      where grant_record.artist_workspace_id = p_artist_workspace_id
        and grant_record.access_type = 'private_beta'
        and grant_record.status = 'active'
        and grant_record.starts_at <= now()
        and grant_record.ends_at > now()
        and (
          grant_record.user_id = auth.uid()
          or public.is_account_member(workspace.account_id)
          or current_setting('request.jwt.claim.role', true) = 'service_role'
        )
    );
$$;

create or replace function public.activate_beta_artist_workspace(
  p_checkout_session_id uuid,
  p_code text,
  p_user_id uuid
)
returns table (
  account_id uuid,
  artist_workspace_id uuid,
  artist_id uuid,
  artist_name text,
  workspace_name text,
  status public.workspace_status,
  spotify_connected boolean,
  spotify_artist_id text,
  spotify_artist_name text,
  spotify_artist_url text,
  spotify_image_url text,
  context_complete boolean,
  latest_catalog_sync_status text,
  entitlement_active boolean,
  subscription_status text,
  setup_status text,
  setup_stage text,
  access_type text,
  access_status text,
  access_starts_at timestamptz,
  access_ends_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_checkout public.billing_checkout_sessions%rowtype;
  v_code public.private_beta_codes%rowtype;
  v_batch public.private_beta_batches%rowtype;
  v_grant public.workspace_access_grants%rowtype;
  v_setup public.workspace_setup_runs%rowtype;
  v_artist_name text;
  v_spotify_artist_id text;
  v_spotify_url text;
  v_spotify_uri text;
  v_spotify_image_url text;
  v_genres text[];
  v_account_id uuid;
  v_artist_id uuid;
  v_artist_workspace_id uuid;
begin
  if p_user_id is null then
    raise exception 'authenticated user is required';
  end if;

  select * into v_checkout
  from public.billing_checkout_sessions
  where id = p_checkout_session_id
  for update;

  if not found or v_checkout.user_id <> p_user_id then
    raise exception 'checkout session not found';
  end if;
  if v_checkout.expires_at <= now() then
    raise exception 'checkout session has expired';
  end if;
  if v_checkout.status not in ('open', 'initialized') then
    raise exception 'checkout session is not eligible for beta access';
  end if;

  if exists (
    select 1 from public.billing_subscriptions subscription
    where subscription.user_id = p_user_id
      and subscription.status in ('active', 'non-renewing', 'attention')
      and (subscription.current_period_end is null or subscription.current_period_end > now())
  ) then
    raise exception 'your subscription is already active';
  end if;

  select code_record.* into v_code
  from public.private_beta_codes code_record
  where code_record.code_hash = encode(digest(upper(trim(p_code)), 'sha256'), 'hex')
  for update;

  if not found then
    raise exception 'invalid, expired, or already used invitation code';
  end if;

  select * into v_batch
  from public.private_beta_batches
  where id = v_code.batch_id
  for share;

  if v_code.status <> 'active'
    or v_batch.status <> 'active'
    or (v_batch.expires_at is not null and v_batch.expires_at <= now()) then
    raise exception 'invalid, expired, or already used invitation code';
  end if;

  v_artist_name := nullif(trim(v_checkout.selected_artist ->> 'name'), '');
  v_spotify_artist_id := nullif(trim(v_checkout.selected_artist ->> 'spotifyArtistId'), '');
  v_spotify_url := nullif(trim(v_checkout.selected_artist ->> 'spotifyUrl'), '');
  v_spotify_uri := nullif(trim(v_checkout.selected_artist ->> 'spotifyUri'), '');
  v_spotify_image_url := nullif(trim(v_checkout.selected_artist ->> 'imageUrl'), '');
  select coalesce(array_agg(value), '{}'::text[]) into v_genres
  from jsonb_array_elements_text(coalesce(v_checkout.selected_artist -> 'genres', '[]'::jsonb)) genres(value);

  if v_artist_name is null or v_spotify_artist_id is null then
    raise exception 'checkout session selected artist is incomplete';
  end if;

  if v_checkout.artist_workspace_id is not null then
    v_artist_workspace_id := v_checkout.artist_workspace_id;
    select workspace.account_id, workspace.artist_id
      into v_account_id, v_artist_id
    from public.artist_workspaces workspace
    where workspace.id = v_artist_workspace_id;
  else
    select membership.account_id into v_account_id
    from public.account_memberships membership
    where membership.user_id = p_user_id and membership.status = 'active'
    order by membership.created_at asc limit 1;

    if v_account_id is null then
      insert into public.accounts (name) values (v_artist_name || ' Desk')
      returning id into v_account_id;
    end if;

    insert into public.account_memberships (account_id, user_id, role, status)
    values (v_account_id, p_user_id, 'owner', 'active')
    on conflict (account_id, user_id) do update set status = 'active';

    insert into public.artists (account_id, display_name, canonical_spotify_artist_id, canonical_spotify_url)
    values (v_account_id, v_artist_name, v_spotify_artist_id, v_spotify_url)
    returning id into v_artist_id;

    insert into public.artist_workspaces (account_id, artist_id, name, status)
    values (v_account_id, v_artist_id, v_artist_name || ' Desk', 'setup')
    returning id into v_artist_workspace_id;

    insert into public.artist_profiles (
      account_id, artist_workspace_id, artist_id, display_name, spotify_identity, genres, updated_by_user_id
    ) values (
      v_account_id, v_artist_workspace_id, v_artist_id, v_artist_name,
      jsonb_build_object(
        'spotifyArtistId', v_spotify_artist_id,
        'spotifyUrl', v_spotify_url,
        'spotifyUri', v_spotify_uri,
        'imageUrl', v_spotify_image_url,
        'source', 'private_beta_activation'
      ),
      v_genres, p_user_id
    );

    update public.billing_checkout_sessions
    set account_id = v_account_id, artist_workspace_id = v_artist_workspace_id
    where id = v_checkout.id;

    insert into public.operating_events (
      account_id, artist_workspace_id, artist_id, event_type, actor_type, actor_id,
      target_type, target_id, summary, payload
    ) values (
      v_account_id, v_artist_workspace_id, v_artist_id,
      'private_beta_workspace_activation_started', 'system', p_user_id,
      'artist_workspace', v_artist_workspace_id,
      'Started private-beta artist workspace activation.',
      jsonb_build_object('checkout_session_id', v_checkout.id, 'batch_id', v_batch.id)
    );
  end if;

  insert into public.workspace_setup_runs (
    account_id, artist_workspace_id, artist_id, checkout_session_id,
    status, current_stage, stage_status, started_at
  ) values (
    v_account_id, v_artist_workspace_id, v_artist_id, v_checkout.id,
    'queued', 'spotify_connected',
    jsonb_build_object('workspace_created', 'completed', 'spotify_connected', 'queued'), now()
  )
  on conflict (checkout_session_id) do update
    set status = case when public.workspace_setup_runs.status = 'failed' then 'queued' else public.workspace_setup_runs.status end,
        retry_count = case when public.workspace_setup_runs.status = 'failed' then public.workspace_setup_runs.retry_count + 1 else public.workspace_setup_runs.retry_count end
  returning * into v_setup;

  insert into public.workspace_access_grants (
    account_id, artist_workspace_id, user_id, checkout_session_id,
    private_beta_code_id, access_type, status, starts_at, ends_at
  ) values (
    v_account_id, v_artist_workspace_id, p_user_id, v_checkout.id,
    v_code.id, 'private_beta', 'active', now(), now() + interval '30 days'
  ) returning * into v_grant;

  update public.private_beta_codes
  set status = 'redeemed', redeemed_by_user_id = p_user_id,
      redeemed_checkout_session_id = v_checkout.id, redeemed_at = now()
  where id = v_code.id;

  return query
  select
    workspace.account_id, workspace.id, artist.id, artist.display_name,
    workspace.name, workspace.status,
    artist.canonical_spotify_artist_id is not null,
    artist.canonical_spotify_artist_id, artist.display_name,
    artist.canonical_spotify_url, v_spotify_image_url,
    (coalesce(profile.artist_direction, '') <> '' or coalesce(profile.current_goal, '') <> '' or coalesce(profile.budget_context, '') <> ''),
    null::text, true, null::text, v_setup.status, v_setup.current_stage,
    'private_beta'::text, v_grant.status, v_grant.starts_at, v_grant.ends_at
  from public.artist_workspaces workspace
  join public.artists artist on artist.id = workspace.artist_id
  left join public.artist_profiles profile on profile.artist_workspace_id = workspace.id
  where workspace.id = v_artist_workspace_id;
end;
$$;

alter table public.private_beta_batches enable row level security;
alter table public.private_beta_codes enable row level security;
alter table public.workspace_access_grants enable row level security;
alter table public.transactional_email_deliveries enable row level security;

create policy workspace_access_grants_user_select
  on public.workspace_access_grants for select
  using (user_id = auth.uid() or public.is_account_member(account_id));

revoke all on table public.private_beta_batches from public;
revoke all on table public.private_beta_codes from public;
revoke all on table public.workspace_access_grants from public;
revoke all on table public.transactional_email_deliveries from public;
grant select on public.workspace_access_grants to authenticated;
grant all on public.private_beta_batches to service_role;
grant all on public.private_beta_codes to service_role;
grant all on public.workspace_access_grants to service_role;
grant all on public.transactional_email_deliveries to service_role;

revoke all on function public.activate_beta_artist_workspace(uuid, text, uuid) from public;
grant execute on function public.activate_beta_artist_workspace(uuid, text, uuid) to service_role;
