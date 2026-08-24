# Payment confirmation realtime implementation plan

1. Add a focused app-shell test proving a checkout-row event triggers immediate canonical status revalidation and navigation.
2. Extend the billing service with an optional checkout-status subscription backed by Supabase Postgres Changes.
3. Wire the payment-return screen to that subscription and shorten the polling recovery cadence.
4. Add an idempotent migration that publishes `billing_checkout_sessions` to Supabase Realtime; rely on existing owner-only RLS.
5. Run the focused test and production build, apply pending migrations to the linked production project, push to `origin/main`, and verify the deployed bundle.
