-- Recurring renewals are transactions on an existing subscription, not new
-- checkout fulfillments. A checkout may therefore own many provider charges.
alter table public.billing_transactions
  drop constraint if exists billing_transactions_checkout_session_id_key;

create index if not exists billing_transactions_checkout_idx
  on public.billing_transactions (checkout_session_id, provider_occurred_at desc);

create or replace function public.record_verified_subscription_renewal(
  p_provider text,
  p_provider_transaction_id text,
  p_provider_subscription_id text,
  p_provider_customer_id text,
  p_provider_product_id text,
  p_provider_price_id text,
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
  subscription public.billing_subscriptions%rowtype;
  renewal public.billing_transactions%rowtype;
begin
  if p_provider not in ('paystack', 'paddle') then
    raise exception 'unsupported billing provider';
  end if;
  if nullif(trim(p_provider_transaction_id), '') is null
     or nullif(trim(p_provider_subscription_id), '') is null then
    raise exception 'verified renewal identifiers are required';
  end if;
  if p_subscription_status not in ('active', 'trialing', 'non-renewing') then
    raise exception 'verified renewal status is not entitled';
  end if;
  if p_current_period_start is not null and p_current_period_end is not null
     and p_current_period_end <= p_current_period_start then
    raise exception 'verified renewal period is invalid';
  end if;

  select * into subscription
  from public.billing_subscriptions
  where provider = p_provider
    and provider_subscription_code = p_provider_subscription_id
  for update;

  if not found then raise exception 'billing subscription not found'; end if;
  if subscription.provider_customer_code is distinct from p_provider_customer_id then
    raise exception 'renewal customer does not match subscription';
  end if;
  if subscription.provider_product_id is distinct from p_provider_product_id then
    raise exception 'renewal product does not match subscription';
  end if;
  if subscription.provider_price_id is distinct from p_provider_price_id then
    raise exception 'renewal price does not match subscription';
  end if;
  if upper(subscription.currency) is distinct from upper(p_currency) then
    raise exception 'renewal currency does not match subscription';
  end if;
  if subscription.amount_minor is distinct from p_total_minor then
    raise exception 'renewal amount does not match subscription';
  end if;

  insert into public.billing_transactions (
    provider, provider_transaction_id, checkout_session_id,
    account_id, artist_workspace_id, user_id,
    provider_customer_id, provider_subscription_id, provider_product_id,
    provider_price_id, status, currency, subtotal_minor, tax_minor,
    total_minor, provider_occurred_at, completed_at
  ) values (
    p_provider, p_provider_transaction_id, subscription.checkout_session_id,
    subscription.account_id, subscription.artist_workspace_id, subscription.user_id,
    p_provider_customer_id, p_provider_subscription_id, p_provider_product_id,
    p_provider_price_id, 'completed', upper(p_currency), p_subtotal_minor, p_tax_minor,
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
        provider_occurred_at = excluded.provider_occurred_at,
        completed_at = coalesce(public.billing_transactions.completed_at, excluded.completed_at)
  returning * into renewal;

  if renewal.artist_workspace_id is distinct from subscription.artist_workspace_id
     or renewal.provider_subscription_id is distinct from subscription.provider_subscription_code then
    raise exception 'verified renewal transaction is linked to another subscription';
  end if;

  update public.billing_subscriptions
  set status = p_subscription_status,
      current_period_start = p_current_period_start,
      current_period_end = p_current_period_end,
      cancel_at_period_end = p_scheduled_change_action = 'cancel',
      scheduled_change_action = p_scheduled_change_action,
      scheduled_change_at = p_scheduled_change_at,
      provider_updated_at = greatest(
        coalesce(provider_updated_at, '-infinity'::timestamptz),
        coalesce(p_provider_occurred_at, '-infinity'::timestamptz)
      ),
      last_event_occurred_at = greatest(
        coalesce(last_event_occurred_at, '-infinity'::timestamptz),
        coalesce(p_provider_occurred_at, '-infinity'::timestamptz)
      ),
      last_payment_failed_at = null,
      disabled_at = null,
      metadata = metadata || jsonb_build_object('last_source', 'verified_subscription_renewal')
  where id = subscription.id;

  return query select
    subscription.account_id,
    subscription.artist_workspace_id,
    subscription.id,
    renewal.id;
end;
$$;

alter function public.record_verified_subscription_renewal(
  text, text, text, text, text, text, text, text,
  bigint, bigint, bigint, timestamptz, timestamptz, timestamptz, text, timestamptz
) owner to postgres;
revoke all on function public.record_verified_subscription_renewal(
  text, text, text, text, text, text, text, text,
  bigint, bigint, bigint, timestamptz, timestamptz, timestamptz, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.record_verified_subscription_renewal(
  text, text, text, text, text, text, text, text,
  bigint, bigint, bigint, timestamptz, timestamptz, timestamptz, text, timestamptz
) to service_role;

-- Reusing a prepared workspace for a paid reactivation must not enqueue the
-- first-run setup pipeline again. The checkout still gets an audit row, but it
-- is complete before entitlement becomes visible to the client.
create or replace function public.complete_reactivation_setup_run()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  previous_stage_status jsonb;
begin
  if new.status <> 'queued' then return new; end if;

  select existing_setup.stage_status
  into previous_stage_status
  from public.workspace_setup_runs existing_setup
  where existing_setup.artist_workspace_id = new.artist_workspace_id
    and existing_setup.status = 'completed'
  order by existing_setup.completed_at desc nulls last, existing_setup.updated_at desc
  limit 1;

  if found then
    new.status := 'completed';
    new.current_stage := 'music_reads';
    new.stage_status := coalesce(previous_stage_status, '{}'::jsonb)
      || jsonb_build_object('music_reads', 'completed');
    new.started_at := coalesce(new.started_at, now());
    new.completed_at := now();
    new.last_error := null;
  end if;
  return new;
end;
$$;

drop trigger if exists workspace_setup_runs_complete_reactivation on public.workspace_setup_runs;
create trigger workspace_setup_runs_complete_reactivation
  before insert on public.workspace_setup_runs
  for each row execute function public.complete_reactivation_setup_run();

alter function public.complete_reactivation_setup_run() owner to postgres;
revoke all on function public.complete_reactivation_setup_run() from public, anon, authenticated;
grant execute on function public.complete_reactivation_setup_run() to service_role;
