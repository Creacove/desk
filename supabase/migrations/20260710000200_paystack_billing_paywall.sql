-- Paystack MVP paywall: verified subscription before costly artist setup.

create table public.billing_checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.accounts(id) on delete set null,
  user_id uuid not null references public.users(id) on delete cascade,
  provider text not null default 'paystack',
  provider_reference text not null,
  provider_plan_code text not null,
  provider_customer_code text,
  provider_subscription_code text,
  amount_minor integer not null,
  amount numeric(12, 2) not null,
  currency text not null default 'USD',
  interval text not null default 'monthly' check (interval = 'monthly'),
  status text not null default 'open' check (status in ('open', 'initialized', 'paid', 'expired', 'failed', 'abandoned')),
  selected_artist jsonb not null,
  authorization_url text,
  access_code text,
  artist_workspace_id uuid references public.artist_workspaces(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null default (now() + interval '45 minutes'),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_reference)
);

create table public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  checkout_session_id uuid references public.billing_checkout_sessions(id) on delete set null,
  provider text not null default 'paystack',
  provider_subscription_code text not null,
  provider_customer_code text,
  provider_email_token text,
  provider_plan_code text not null,
  amount_minor integer not null,
  amount numeric(12, 2) not null,
  currency text not null default 'USD',
  status text not null default 'active' check (status in ('active', 'non-renewing', 'attention', 'completed', 'cancelled', 'past_due', 'inactive')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  cancelled_at timestamptz,
  disabled_at timestamptz,
  last_payment_failed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_subscription_code)
);

create table public.billing_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'paystack',
  provider_event_key text not null,
  provider_reference text,
  event_type text not null,
  signature_valid boolean not null default false,
  processing_status text not null default 'received' check (processing_status in ('received', 'processed', 'ignored', 'failed')),
  payload jsonb not null,
  error text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, provider_event_key)
);

create table public.workspace_setup_runs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  checkout_session_id uuid not null references public.billing_checkout_sessions(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed')),
  current_stage text not null default 'workspace_created' check (current_stage in ('checkout', 'workspace_created', 'spotify_connected', 'catalog_bootstrap', 'manager_discovery', 'setup_brief', 'music_reads')),
  stage_status jsonb not null default '{}'::jsonb,
  last_error text,
  retry_count integer not null default 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (checkout_session_id)
);

create index if not exists billing_checkout_sessions_user_status_idx
  on public.billing_checkout_sessions (user_id, status, expires_at desc);
create index if not exists billing_subscriptions_workspace_status_idx
  on public.billing_subscriptions (artist_workspace_id, status, current_period_end desc);
create index if not exists workspace_setup_runs_workspace_idx
  on public.workspace_setup_runs (artist_workspace_id, updated_at desc);

drop trigger if exists billing_checkout_sessions_set_updated_at on public.billing_checkout_sessions;
create trigger billing_checkout_sessions_set_updated_at
  before update on public.billing_checkout_sessions
  for each row execute function public.set_updated_at();

drop trigger if exists billing_subscriptions_set_updated_at on public.billing_subscriptions;
create trigger billing_subscriptions_set_updated_at
  before update on public.billing_subscriptions
  for each row execute function public.set_updated_at();

drop trigger if exists workspace_setup_runs_set_updated_at on public.workspace_setup_runs;
create trigger workspace_setup_runs_set_updated_at
  before update on public.workspace_setup_runs
  for each row execute function public.set_updated_at();

create or replace function public.has_active_workspace_entitlement(p_artist_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
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
  );
$$;

create or replace function public.activate_paid_artist_workspace(p_checkout_session_id uuid)
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
  setup_stage text
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_checkout public.billing_checkout_sessions%rowtype;
  v_artist_name text;
  v_spotify_artist_id text;
  v_spotify_url text;
  v_spotify_uri text;
  v_spotify_image_url text;
  v_genres text[];
  v_account_id uuid;
  v_artist_id uuid;
  v_artist_workspace_id uuid;
  v_setup public.workspace_setup_runs%rowtype;
  v_email text;
begin
  select *
  into v_checkout
  from public.billing_checkout_sessions
  where id = p_checkout_session_id
  for update;

  if not found then
    raise exception 'checkout session not found';
  end if;

  if v_checkout.status <> 'paid' then
    raise exception 'checkout session is not paid';
  end if;

  v_artist_name := nullif(trim(v_checkout.selected_artist ->> 'name'), '');
  v_spotify_artist_id := nullif(trim(v_checkout.selected_artist ->> 'spotifyArtistId'), '');
  v_spotify_url := nullif(trim(v_checkout.selected_artist ->> 'spotifyUrl'), '');
  v_spotify_uri := nullif(trim(v_checkout.selected_artist ->> 'spotifyUri'), '');
  v_spotify_image_url := nullif(trim(v_checkout.selected_artist ->> 'imageUrl'), '');
  select coalesce(array_agg(value), '{}'::text[])
  into v_genres
  from jsonb_array_elements_text(coalesce(v_checkout.selected_artist -> 'genres', '[]'::jsonb)) as genres(value);

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
    select email
    into v_email
    from public.users
    where id = v_checkout.user_id;

    select membership.account_id
    into v_account_id
    from public.account_memberships membership
    where membership.user_id = v_checkout.user_id
      and membership.status = 'active'
    order by membership.created_at asc
    limit 1;

    if v_account_id is null then
      insert into public.accounts (name)
      values (v_artist_name || ' Desk')
      returning id into v_account_id;
    end if;

    insert into public.account_memberships (account_id, user_id, role, status)
    values (v_account_id, v_checkout.user_id, 'owner', 'active')
    on conflict (account_id, user_id) do update
      set status = 'active';

    insert into public.artists (
      account_id,
      display_name,
      canonical_spotify_artist_id,
      canonical_spotify_url
    )
    values (
      v_account_id,
      v_artist_name,
      v_spotify_artist_id,
      v_spotify_url
    )
    returning id into v_artist_id;

    insert into public.artist_workspaces (account_id, artist_id, name, status)
    values (v_account_id, v_artist_id, v_artist_name || ' Desk', 'setup')
    returning id into v_artist_workspace_id;

    insert into public.artist_profiles (
      account_id,
      artist_workspace_id,
      artist_id,
      display_name,
      spotify_identity,
      genres,
      updated_by_user_id
    )
    values (
      v_account_id,
      v_artist_workspace_id,
      v_artist_id,
      v_artist_name,
      jsonb_build_object(
        'spotifyArtistId', v_spotify_artist_id,
        'spotifyUrl', v_spotify_url,
        'spotifyUri', v_spotify_uri,
        'imageUrl', v_spotify_image_url,
        'source', 'paywall_activation'
      ),
      v_genres,
      v_checkout.user_id
    );

    update public.billing_checkout_sessions
    set account_id = v_account_id,
        artist_workspace_id = v_artist_workspace_id
    where id = v_checkout.id;

    insert into public.operating_events (
      account_id,
      artist_workspace_id,
      artist_id,
      event_type,
      actor_type,
      actor_id,
      target_type,
      target_id,
      summary,
      payload
    )
    values (
      v_account_id,
      v_artist_workspace_id,
      v_artist_id,
      'paid_workspace_activation_started',
      'system',
      v_checkout.user_id,
      'artist_workspace',
      v_artist_workspace_id,
      'Started paid artist workspace activation.',
      jsonb_build_object('checkout_session_id', v_checkout.id, 'provider', v_checkout.provider)
    );
  end if;

  insert into public.workspace_setup_runs (
    account_id,
    artist_workspace_id,
    artist_id,
    checkout_session_id,
    status,
    current_stage,
    stage_status,
    started_at
  )
  values (
    v_account_id,
    v_artist_workspace_id,
    v_artist_id,
    v_checkout.id,
    'queued',
    'spotify_connected',
    jsonb_build_object('workspace_created', 'completed', 'spotify_connected', 'queued'),
    now()
  )
  on conflict (checkout_session_id) do update
    set status = case when public.workspace_setup_runs.status = 'failed' then 'queued' else public.workspace_setup_runs.status end,
        current_stage = case when public.workspace_setup_runs.status = 'failed' then public.workspace_setup_runs.current_stage else public.workspace_setup_runs.current_stage end,
        retry_count = case when public.workspace_setup_runs.status = 'failed' then public.workspace_setup_runs.retry_count + 1 else public.workspace_setup_runs.retry_count end
  returning * into v_setup;

  return query
    select
      workspace.account_id,
      workspace.id as artist_workspace_id,
      artist.id as artist_id,
      artist.display_name as artist_name,
      workspace.name as workspace_name,
      workspace.status,
      (artist.canonical_spotify_artist_id is not null) as spotify_connected,
      artist.canonical_spotify_artist_id as spotify_artist_id,
      artist.display_name as spotify_artist_name,
      artist.canonical_spotify_url as spotify_artist_url,
      v_spotify_image_url as spotify_image_url,
      (coalesce(profile.artist_direction, '') <> '' or coalesce(profile.current_goal, '') <> '' or coalesce(profile.budget_context, '') <> '') as context_complete,
      null::text as latest_catalog_sync_status,
      public.has_active_workspace_entitlement(workspace.id) as entitlement_active,
      subscription.status as subscription_status,
      v_setup.status as setup_status,
      v_setup.current_stage as setup_stage
    from public.artist_workspaces workspace
    join public.artists artist on artist.id = workspace.artist_id
    left join public.artist_profiles profile on profile.artist_workspace_id = workspace.id
    left join lateral (
      select status
      from public.billing_subscriptions subscription
      where subscription.artist_workspace_id = workspace.id
      order by subscription.updated_at desc
      limit 1
    ) subscription on true
    where workspace.id = v_artist_workspace_id;
end;
$$;

alter table public.billing_checkout_sessions enable row level security;
alter table public.billing_subscriptions enable row level security;
alter table public.billing_webhook_events enable row level security;
alter table public.workspace_setup_runs enable row level security;

create policy billing_checkout_sessions_user_select
  on public.billing_checkout_sessions for select
  using (user_id = auth.uid() or public.is_account_member(account_id));

create policy billing_checkout_sessions_user_insert
  on public.billing_checkout_sessions for insert
  with check (user_id = auth.uid());

create policy billing_subscriptions_account_members_select
  on public.billing_subscriptions for select
  using (public.is_account_member(account_id));

create policy workspace_setup_runs_account_members_select
  on public.workspace_setup_runs for select
  using (public.is_account_member(account_id));

revoke all on table public.billing_checkout_sessions from public;
revoke all on table public.billing_subscriptions from public;
revoke all on table public.billing_webhook_events from public;
revoke all on table public.workspace_setup_runs from public;
grant select, insert on public.billing_checkout_sessions to authenticated;
grant select on public.billing_subscriptions to authenticated;
grant select on public.workspace_setup_runs to authenticated;
grant all on public.billing_checkout_sessions to service_role;
grant all on public.billing_subscriptions to service_role;
grant all on public.billing_webhook_events to service_role;
grant all on public.workspace_setup_runs to service_role;

revoke all on function public.has_active_workspace_entitlement(uuid) from public;
grant execute on function public.has_active_workspace_entitlement(uuid) to authenticated, service_role;
revoke all on function public.activate_paid_artist_workspace(uuid) from public;
grant execute on function public.activate_paid_artist_workspace(uuid) to service_role;
