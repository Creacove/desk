# Desk Domain Cutover Design

## Objective

Move `desk.ordersounds.com` from the existing Royalty Tracker deployment on Vercel to the replacement Ordersounds Desk deployment on Netlify without deleting Royalty Tracker or interrupting payment processing.

## Current State

- `desk.ordersounds.com` resolves through a CNAME to Vercel and serves Royalty Tracker.
- Royalty Tracker must remain available on its default Vercel `.vercel.app` address after the custom domain is detached.
- The replacement Desk is the Netlify project `ordersounds-desk`, project ID `004c7152-3e14-4085-afe9-738f7cfc55c4`.
- The replacement is currently available at `https://ordersounds-desk.netlify.app`.
- The DNS zone for `ordersounds.com` uses Netlify DNS nameservers.
- The frontend uses Supabase for authentication and backend functions.
- Billing uses Paystack. The checkout return is processed by the frontend, while webhook processing is hosted independently by a Supabase Edge Function.

## Selected Approach

Use a staged, reversible cutover:

1. Verify the replacement build and its production environment at the Netlify URL.
2. Record the current Vercel and DNS state required for rollback.
3. Confirm Royalty Tracker remains reachable at its default Vercel URL.
4. Attach `desk.ordersounds.com` to the `ordersounds-desk` Netlify project.
5. Remove the custom-domain association from Royalty Tracker without deleting or redeploying it.
6. Replace the existing Vercel CNAME for `desk.ordersounds.com` with the Netlify target required for `ordersounds-desk`.
7. Wait for DNS resolution and TLS certificate readiness.
8. Update integrations whose browser-facing URLs depend on the frontend origin.
9. Run production smoke tests and either accept the cutover or execute rollback.

## URL and Integration Changes

### Paystack

Set the Supabase Edge Function secret `PAYSTACK_CALLBACK_URL` to:

`https://desk.ordersounds.com`

Paystack appends transaction reference query parameters to this root callback. The frontend accepts `reference`, `trxref`, `checkout_ref`, and `paystack_reference`.

Do not move or replace the Paystack webhook URL. It is the deployed Supabase Edge Function endpoint for `paystack-webhook`, independent of the frontend hostname. Confirm that the Paystack dashboard still points to that function.

### Supabase authentication

Email/password login does not require an OAuth callback. Add `https://desk.ordersounds.com` to the production Site URL and allowed redirect URLs if the hosted Supabase project uses confirmation emails or later enables password recovery or OAuth. Retain the Netlify URL temporarily as a rollback redirect.

### Spotify

The current production flow uses server-side artist search rather than a browser OAuth redirect. Do not introduce a Spotify production callback solely for this cutover. If a Spotify developer-dashboard callback already exists for this app, add `https://desk.ordersounds.com/auth/spotify/callback` before removing any older callback.

### Split confirmations

New split-confirmation links derive their base origin from the running frontend. Once users initiate them from `desk.ordersounds.com`, new links will automatically use `https://desk.ordersounds.com/split-confirmation?token=...`. Previously issued links remain valid at their original host while the Netlify fallback URL is retained.

### Analytics and browser policies

Confirm PostHog receives events from the new hostname. Update any external allowlists, CSP rules, CORS rules, or analytics domain filters only when an existing configuration explicitly restricts the old Netlify or Vercel hostname.

## Verification

Before changing DNS:

- Run the production build and focused automated tests.
- Verify the Netlify deployment loads and has the required public Supabase configuration.
- Verify sign-in and the signed-out screen.
- Record the existing DNS value and Royalty Tracker fallback URL.

After changing DNS:

- Confirm `desk.ordersounds.com` resolves to Netlify and serves a valid TLS certificate.
- Confirm SPA deep links return the application rather than a 404.
- Confirm sign-in and authenticated workspace loading.
- Confirm a Paystack checkout initializes with the new callback URL.
- Confirm a payment-return URL with a reference is recognized by the frontend.
- Confirm the Paystack webhook remains configured at Supabase and continues recording events.
- Confirm a new split-confirmation link uses the custom domain.
- Confirm Royalty Tracker remains reachable at its default Vercel URL.

No real charge will be submitted solely for smoke testing unless the user separately authorizes a live payment.

## Failure Handling and Rollback

If DNS, TLS, authentication, or critical application loading fails:

1. Restore the previous `desk.ordersounds.com` CNAME to its recorded Vercel target.
2. Reattach `desk.ordersounds.com` to Royalty Tracker if Vercel requires the association to serve it again.
3. Restore `PAYSTACK_CALLBACK_URL` to its recorded previous value if checkout was already updated.
4. Keep `ordersounds-desk.netlify.app` available for diagnosis.

Webhook processing must not be rolled back because its Supabase URL does not change.

## Safety Boundaries

- Do not delete the Royalty Tracker project, deployment, data, or default domain.
- Do not alter billing plan codes, secret keys, prices, or webhook signing secrets.
- Do not overwrite unrelated local modifications already present in the repository.
- Do not remove fallback URLs until the custom domain has been stable and verified.
- Do not expose secret values in logs or documentation.

## Success Criteria

- `https://desk.ordersounds.com` serves the replacement Netlify Desk with valid TLS.
- Royalty Tracker remains reachable on its default Vercel URL.
- Authentication and workspace loading work on the custom domain.
- Paystack returns customers to the custom domain and the Supabase webhook continues processing events.
- New split-confirmation links use the custom domain.
- The Netlify fallback remains available for rollback.
