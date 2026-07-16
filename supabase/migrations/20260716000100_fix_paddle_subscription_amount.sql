create or replace function public.set_billing_subscription_amount_from_minor()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.amount_minor is null then
    raise exception 'billing subscription amount_minor is required';
  end if;

  new.amount := new.amount_minor::numeric / 100;
  return new;
end;
$$;

drop trigger if exists billing_subscriptions_set_amount_from_minor
  on public.billing_subscriptions;

create trigger billing_subscriptions_set_amount_from_minor
before insert or update of amount, amount_minor
on public.billing_subscriptions
for each row
execute function public.set_billing_subscription_amount_from_minor();
