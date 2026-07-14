-- Harden the existing Paystack billing boundary and extend it for Paddle.
-- All provider writes remain service-side; browser clients receive read access only.

drop policy if exists billing_checkout_sessions_user_insert on public.billing_checkout_sessions;
revoke insert, update, delete on public.billing_checkout_sessions from authenticated;
revoke all on public.billing_checkout_sessions from anon;
grant select on public.billing_checkout_sessions to authenticated;

alter table public.billing_checkout_sessions
  drop constraint if exists billing_checkout_sessions_interval_check;
alter table public.billing_checkout_sessions
  add constraint billing_checkout_sessions_interval_check
  check (interval in ('monthly', 'yearly'));

alter table public.billing_checkout_sessions
  drop constraint if exists billing_checkout_sessions_status_check;
alter table public.billing_checkout_sessions
  add constraint billing_checkout_sessions_status_check
  check (status in ('open', 'initialized', 'processing', 'paid', 'expired', 'failed', 'abandoned'));

alter table public.billing_checkout_sessions
  alter column amount_minor type bigint,
  alter column amount_minor drop not null,
  alter column amount drop not null,
  alter column currency drop not null,
  add column if not exists provider_product_id text,
  add column if not exists provider_price_id text,
  add column if not exists provider_transaction_id text,
  add column if not exists client_request_id uuid,
  add column if not exists checkout_correlation_hash text;

create unique index if not exists billing_checkout_sessions_provider_transaction_uidx
  on public.billing_checkout_sessions (provider, provider_transaction_id)
  where provider_transaction_id is not null;
create unique index if not exists billing_checkout_sessions_user_request_uidx
  on public.billing_checkout_sessions (user_id, client_request_id)
  where client_request_id is not null;

create table public.billing_customers (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_customer_id text not null,
  user_id uuid references public.users(id) on delete set null,
  email text,
  provider_created_at timestamptz,
  provider_updated_at timestamptz,
  last_event_occurred_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_customer_id)
);

create table public.billing_transactions (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_transaction_id text not null,
  checkout_session_id uuid not null references public.billing_checkout_sessions(id) on delete restrict,
  account_id uuid references public.accounts(id) on delete set null,
  artist_workspace_id uuid references public.artist_workspaces(id) on delete set null,
  user_id uuid references public.users(id) on delete set null,
  provider_customer_id text,
  provider_subscription_id text,
  provider_product_id text,
  provider_price_id text,
  status text not null check (status in ('completed', 'failed', 'refunded', 'disputed')),
  currency text,
  subtotal_minor bigint,
  tax_minor bigint,
  total_minor bigint,
  provider_occurred_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_transaction_id),
  unique (checkout_session_id)
);

drop trigger if exists billing_customers_set_updated_at on public.billing_customers;
create trigger billing_customers_set_updated_at
  before update on public.billing_customers
  for each row execute function public.set_updated_at();

drop trigger if exists billing_transactions_set_updated_at on public.billing_transactions;
create trigger billing_transactions_set_updated_at
  before update on public.billing_transactions
  for each row execute function public.set_updated_at();

alter table public.billing_customers enable row level security;
alter table public.billing_transactions enable row level security;
revoke all on public.billing_customers from public;
revoke all on public.billing_transactions from public;
revoke all on public.billing_customers from anon, authenticated;
revoke all on public.billing_transactions from anon, authenticated;
grant all on public.billing_customers to service_role;
grant all on public.billing_transactions to service_role;

alter table public.billing_subscriptions
  drop constraint if exists billing_subscriptions_status_check;
alter table public.billing_subscriptions
  add constraint billing_subscriptions_status_check
  check (status in (
    'active', 'trialing', 'non-renewing', 'attention', 'completed',
    'cancelled', 'canceled', 'paused', 'past_due', 'inactive'
  ));

alter table public.billing_subscriptions
  alter column account_id drop not null,
  alter column artist_workspace_id drop not null,
  alter column provider_plan_code drop not null,
  alter column amount_minor type bigint,
  alter column amount_minor drop not null,
  alter column amount drop not null,
  alter column currency drop not null,
  add column if not exists provider_product_id text,
  add column if not exists provider_price_id text,
  add column if not exists scheduled_change_action text,
  add column if not exists scheduled_change_at timestamptz,
  add column if not exists provider_created_at timestamptz,
  add column if not exists provider_updated_at timestamptz,
  add column if not exists last_event_occurred_at timestamptz;

alter table public.billing_webhook_events
  drop constraint if exists billing_webhook_events_processing_status_check;
alter table public.billing_webhook_events
  add constraint billing_webhook_events_processing_status_check
  check (processing_status in ('received', 'processing', 'processed', 'ignored', 'failed'));

alter table public.billing_webhook_events
  add column if not exists notification_id text,
  add column if not exists occurred_at timestamptz,
  add column if not exists attempt_count integer not null default 0,
  add column if not exists next_attempt_at timestamptz,
  add column if not exists claimed_at timestamptz;

create index if not exists billing_webhook_events_queue_idx
  on public.billing_webhook_events (processing_status, next_attempt_at, created_at)
  where processing_status in ('received', 'failed');

create or replace function public.claim_billing_webhook_events(p_limit integer default 10)
returns setof public.billing_webhook_events
language sql
security definer
set search_path = public
set row_security = off
as $$
  with candidates as (
    select event.id
    from public.billing_webhook_events event
    where event.provider = 'paddle'
      and event.processing_status in ('received', 'failed')
      and coalesce(event.next_attempt_at, now()) <= now()
    order by event.created_at asc
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 10), 50))
  ), claimed as (
    update public.billing_webhook_events event
    set processing_status = 'processing',
        claimed_at = now(),
        attempt_count = event.attempt_count + 1,
        error = null
    from candidates
    where event.id = candidates.id
    returning event.*
  )
  select * from claimed;
$$;

revoke all on function public.claim_billing_webhook_events(integer) from public, anon, authenticated;
grant execute on function public.claim_billing_webhook_events(integer) to service_role;

-- Backfill durable evidence for legitimate Paystack payments created before this migration.
insert into public.billing_customers (
  provider, provider_customer_id, user_id, email, last_event_occurred_at
)
select distinct on (subscription.provider, subscription.provider_customer_code)
  subscription.provider,
  subscription.provider_customer_code,
  subscription.user_id,
  app_user.email,
  subscription.updated_at
from public.billing_subscriptions subscription
left join public.users app_user on app_user.id = subscription.user_id
where subscription.provider_customer_code is not null
order by subscription.provider, subscription.provider_customer_code, subscription.updated_at desc
on conflict (provider, provider_customer_id) do nothing;

insert into public.billing_transactions (
  provider,
  provider_transaction_id,
  checkout_session_id,
  account_id,
  artist_workspace_id,
  user_id,
  provider_customer_id,
  provider_subscription_id,
  provider_price_id,
  status,
  currency,
  total_minor,
  completed_at,
  provider_occurred_at
)
select
  checkout.provider,
  checkout.provider_reference,
  checkout.id,
  checkout.account_id,
  checkout.artist_workspace_id,
  checkout.user_id,
  checkout.provider_customer_code,
  checkout.provider_subscription_code,
  checkout.provider_plan_code,
  'completed',
  checkout.currency,
  checkout.amount_minor,
  checkout.paid_at,
  checkout.paid_at
from public.billing_checkout_sessions checkout
where checkout.provider = 'paystack'
  and checkout.status = 'paid'
on conflict (provider, provider_transaction_id) do nothing;

update public.billing_checkout_sessions checkout
set provider_transaction_id = transaction.provider_transaction_id,
    provider_price_id = coalesce(checkout.provider_price_id, checkout.provider_plan_code)
from public.billing_transactions transaction
where transaction.checkout_session_id = checkout.id
  and checkout.provider_transaction_id is null;

create or replace function public.fulfill_verified_checkout(
  p_checkout_session_id uuid,
  p_provider text,
  p_provider_transaction_id text,
  p_provider_customer_id text,
  p_provider_subscription_id text,
  p_provider_product_id text,
  p_provider_price_id text,
  p_correlation_hash text,
  p_customer_email text,
  p_subscription_status text,
  p_currency text,
  p_subtotal_minor bigint,
  p_tax_minor bigint,
  p_total_minor bigint,
  p_current_period_start timestamptz,
  p_current_period_end timestamptz,
  p_provider_occurred_at timestamptz,
  p_scheduled_change_action text,
  p_scheduled_change_at timestamptz
)
returns table (
  checkout_session_id uuid,
  account_id uuid,
  artist_workspace_id uuid,
  subscription_id uuid,
  transaction_id uuid
)
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_checkout public.billing_checkout_sessions%rowtype;
  v_workspace record;
  v_subscription public.billing_subscriptions%rowtype;
  v_transaction public.billing_transactions%rowtype;
begin
  select * into v_checkout
  from public.billing_checkout_sessions
  where id = p_checkout_session_id
  for update;

  if not found then raise exception 'checkout session not found'; end if;
  if v_checkout.provider <> p_provider then
    raise exception 'checkout provider does not match verified transaction';
  end if;
  if v_checkout.provider_price_id is distinct from p_provider_price_id then
    raise exception 'checkout price does not match verified transaction';
  end if;
  if v_checkout.provider_product_id is distinct from p_provider_product_id then
    raise exception 'checkout product does not match verified transaction';
  end if;
  if v_checkout.checkout_correlation_hash is distinct from p_correlation_hash then
    raise exception 'checkout correlation does not match verified transaction';
  end if;
  if nullif(trim(p_provider_transaction_id), '') is null
     or nullif(trim(p_provider_subscription_id), '') is null then
    raise exception 'verified recurring transaction identifiers are required';
  end if;
  if v_checkout.provider_transaction_id is not null
     and v_checkout.provider_transaction_id <> p_provider_transaction_id then
    raise exception 'checkout is already linked to a different transaction';
  end if;

  insert into public.billing_customers (
    provider, provider_customer_id, user_id, email,
    last_event_occurred_at, provider_updated_at
  ) values (
    p_provider, p_provider_customer_id, v_checkout.user_id, p_customer_email,
    p_provider_occurred_at, p_provider_occurred_at
  )
  on conflict (provider, provider_customer_id) do update
    set user_id = coalesce(public.billing_customers.user_id, excluded.user_id),
        email = coalesce(excluded.email, public.billing_customers.email),
        last_event_occurred_at = greatest(
          coalesce(public.billing_customers.last_event_occurred_at, '-infinity'::timestamptz),
          coalesce(excluded.last_event_occurred_at, '-infinity'::timestamptz)
        ),
        provider_updated_at = greatest(
          coalesce(public.billing_customers.provider_updated_at, '-infinity'::timestamptz),
          coalesce(excluded.provider_updated_at, '-infinity'::timestamptz)
        );

  insert into public.billing_transactions (
    provider, provider_transaction_id, checkout_session_id, user_id,
    provider_customer_id, provider_subscription_id, provider_product_id,
    provider_price_id, status, currency, subtotal_minor, tax_minor,
    total_minor, provider_occurred_at, completed_at
  ) values (
    p_provider, p_provider_transaction_id, v_checkout.id, v_checkout.user_id,
    p_provider_customer_id, p_provider_subscription_id, p_provider_product_id,
    p_provider_price_id, 'completed', p_currency, p_subtotal_minor, p_tax_minor,
    p_total_minor, p_provider_occurred_at, now()
  )
  on conflict (provider, provider_transaction_id) do update
    set status = 'completed',
        provider_customer_id = excluded.provider_customer_id,
        provider_subscription_id = excluded.provider_subscription_id,
        provider_product_id = excluded.provider_product_id,
        provider_price_id = excluded.provider_price_id,
        currency = excluded.currency,
        subtotal_minor = excluded.subtotal_minor,
        tax_minor = excluded.tax_minor,
        total_minor = excluded.total_minor,
        provider_occurred_at = excluded.provider_occurred_at
  returning * into v_transaction;

  if v_transaction.checkout_session_id <> v_checkout.id then
    raise exception 'verified transaction is linked to another checkout';
  end if;

  update public.billing_checkout_sessions
  set status = 'paid',
      provider_transaction_id = p_provider_transaction_id,
      provider_customer_code = p_provider_customer_id,
      provider_subscription_code = p_provider_subscription_id,
      paid_at = coalesce(paid_at, now())
  where id = v_checkout.id;

  select * into v_workspace
  from public.activate_paid_artist_workspace(v_checkout.id);

  if v_workspace.account_id is null or v_workspace.artist_workspace_id is null then
    raise exception 'activate_paid_artist_workspace did not return a workspace';
  end if;

  insert into public.billing_subscriptions (
    account_id, artist_workspace_id, user_id, checkout_session_id,
    provider, provider_subscription_code, provider_customer_code,
    provider_plan_code, provider_product_id, provider_price_id,
    amount_minor, amount, currency, status, current_period_start,
    current_period_end, cancel_at_period_end, scheduled_change_action,
    scheduled_change_at, provider_updated_at, last_event_occurred_at, metadata
  ) values (
    v_workspace.account_id, v_workspace.artist_workspace_id, v_checkout.user_id, v_checkout.id,
    p_provider, p_provider_subscription_id, p_provider_customer_id,
    p_provider_price_id, p_provider_product_id, p_provider_price_id,
    p_total_minor, null, p_currency, p_subscription_status, p_current_period_start,
    p_current_period_end, p_scheduled_change_action = 'cancel', p_scheduled_change_action,
    p_scheduled_change_at, p_provider_occurred_at, p_provider_occurred_at,
    jsonb_build_object('source', 'verified_checkout_fulfillment')
  )
  on conflict (provider, provider_subscription_code) do update
    set account_id = excluded.account_id,
        artist_workspace_id = excluded.artist_workspace_id,
        user_id = excluded.user_id,
        checkout_session_id = excluded.checkout_session_id,
        provider_customer_code = excluded.provider_customer_code,
        provider_plan_code = excluded.provider_plan_code,
        provider_product_id = excluded.provider_product_id,
        provider_price_id = excluded.provider_price_id,
        amount_minor = excluded.amount_minor,
        currency = excluded.currency,
        status = excluded.status,
        current_period_start = excluded.current_period_start,
        current_period_end = excluded.current_period_end,
        cancel_at_period_end = excluded.cancel_at_period_end,
        scheduled_change_action = excluded.scheduled_change_action,
        scheduled_change_at = excluded.scheduled_change_at,
        provider_updated_at = excluded.provider_updated_at,
        last_event_occurred_at = excluded.last_event_occurred_at,
        metadata = public.billing_subscriptions.metadata || excluded.metadata
  returning * into v_subscription;

  update public.billing_transactions
  set account_id = v_workspace.account_id,
      artist_workspace_id = v_workspace.artist_workspace_id
  where id = v_transaction.id;

  return query select
    v_checkout.id,
    v_workspace.account_id,
    v_workspace.artist_workspace_id,
    v_subscription.id,
    v_transaction.id;
end;
$$;

revoke all on function public.fulfill_verified_checkout(
  uuid, text, text, text, text, text, text, text, text, text, text,
  bigint, bigint, bigint, timestamptz, timestamptz, timestamptz, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.fulfill_verified_checkout(
  uuid, text, text, text, text, text, text, text, text, text, text,
  bigint, bigint, bigint, timestamptz, timestamptz, timestamptz, text, timestamptz
) to service_role;

create or replace function public.has_active_workspace_entitlement(p_artist_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select
    exists (
      select 1
      from public.billing_subscriptions subscription
      join public.artist_workspaces workspace on workspace.id = subscription.artist_workspace_id
      where subscription.artist_workspace_id = p_artist_workspace_id
        and (
          (subscription.provider = 'paddle' and subscription.status in ('active', 'trialing'))
          or
          (subscription.provider = 'paystack' and subscription.status in ('active', 'non-renewing', 'attention'))
        )
        and (subscription.current_period_end is null or subscription.current_period_end > now())
        and (
          public.is_account_member(workspace.account_id)
          or auth.role() = 'service_role'
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
          or auth.role() = 'service_role'
        )
    );
$$;

alter function public.has_active_workspace_entitlement(uuid) owner to postgres;
revoke all on function public.has_active_workspace_entitlement(uuid) from public;
grant execute on function public.has_active_workspace_entitlement(uuid) to authenticated, service_role;
