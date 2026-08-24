-- Wake the signed-in checkout owner as soon as backend fulfillment updates the row.
-- Realtime is only a hint; billing-status remains the canonical entitlement check.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'billing_checkout_sessions'
  ) then
    alter publication supabase_realtime add table public.billing_checkout_sessions;
  end if;
end
$$;
