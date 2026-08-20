# Vercel Zero-Downtime Migration Design

## Objective

Move the Desk frontend from the current Netlify production deployment to a new Vercel project without planned downtime, without changing the Supabase backend, and without overwriting the existing legacy Vercel projects.

## User constraints

- The current production application must remain available until the Vercel deployment is fully verified.
- There should be one production cutover only: the final DNS/domain switch.
- The existing Netlify deployment remains available as an emergency rollback target after cutover.
- Do not delete or repurpose the existing `royaltytracker` or `ordersoundsw` Vercel projects.
- Do not move the Supabase database, Auth, Storage, Edge Functions, billing webhooks, or provider credentials.

## Current state

- Netlify site: `ordersounds-desk`, site id `004c7152-3e14-4085-afe9-738f7cfc55c4`.
- Current production origin: `https://desk.ordersounds.com`.
- Netlify fallback origin: `https://ordersounds-desk.netlify.app`.
- DNS currently resolves `desk.ordersounds.com` to Netlify addresses and serves HTTP 200 with the `Netlify` server header.
- Vercel is authenticated under team `creacoveofficial-3023s-projects`.
- Existing Vercel projects are `royaltytracker` and `ordersoundsw`; neither is the new Desk target.
- The Vite app uses `npm run build` and publishes `dist`.
- Netlify-specific behavior consists of the SPA fallback, browser security headers, and `/api/billing-country`, which reads Netlify geo data and the Vercel country header.

## Selected approach

Create a separate Vercel project named `ordersounds-desk` under the authenticated Vercel team. Deploy the current workspace directly to Vercel first so Netlify's exhausted build quota is not involved. Configure the Vercel project with the production browser environment values needed by the Vite build, while leaving server-only secrets in Supabase.

Add a root `vercel.json` for the Vite build, SPA fallback, and security headers. Add `api/billing-country.ts` as a Vercel Edge Function that preserves the existing response contract and validates the two-letter country code from `x-vercel-ip-country`. Keep the existing Netlify files unchanged for rollback.

## Cutover sequence

1. Add the Vercel configuration and function adapter locally.
2. Add contract tests for the Vercel configuration and endpoint behavior.
3. Run focused tests, the full Vitest suite, and the production Vite build locally.
4. Create the new Vercel project and deploy the verified workspace to its default Vercel URL.
5. Configure Vercel production and preview environment variables without exposing their values in logs.
6. Validate the Vercel deployment with signed-out shell, deep links, `/api/billing-country`, Supabase connectivity, auth redirects, billing return handling, sharing, uploads, and browser error telemetry.
7. Attach `desk.ordersounds.com` to the new Vercel project, but do not change DNS until the Vercel domain configuration is ready.
8. Make the one DNS change required by Vercel. Verify DNS, TLS, the application shell, authenticated access, and the critical browser flows.
9. Leave Netlify and its custom-domain configuration intact for a short rollback window. Disable old automatic Netlify builds only after the Vercel cutover is stable.

## Routing and environment behavior

- Requests under `/api/*` must reach Vercel Functions; all other SPA paths must serve `index.html` without changing the browser URL.
- The Vercel function must return `{ "countryCode": "XX" }` for a valid two-letter country header and `{}` otherwise, with `Content-Type: application/json`, `Cache-Control: private, no-store`, and `Vary: Cookie`.
- `VITE_APP_MODE` must remain `production`.
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` must be present in Vercel production and preview environments.
- `VITE_PRIVATE_BETA_ENABLED=true` must be set for production, matching the current Netlify production behavior; local defaults remain unchanged.
- PostHog browser variables are copied only if they are configured in the current Netlify production environment.
- Supabase service-role, OpenAI, payment, email, Spotify secret, and provider refresh credentials remain server-side in Supabase and are not copied to Vercel.
- The production hostname remains `https://desk.ordersounds.com`, so Paystack's callback root and the Supabase production Site URL do not change. The temporary Vercel preview URL may be added to Supabase Auth's allowed redirect URLs for testing and removed later.

## Failure handling and rollback

- If local tests or the Vercel preview fail, do not attach the domain or change DNS.
- If DNS or TLS verification fails, leave the current Netlify DNS records in place and diagnose the Vercel project.
- If a critical production flow fails after cutover, restore the recorded Netlify DNS target and keep the Vercel deployment available for diagnosis.
- Do not delete the Netlify site, the Vercel legacy projects, the domain registration, or any Supabase resource as part of this migration.
- Do not claim zero risk: DNS/TLS propagation and external provider behavior can still fail. The design prevents planned downtime and makes rollback possible without rebuilding the application.

## Acceptance criteria

- The new Vercel project serves the exact verified Desk build.
- SPA deep links and `/api/billing-country` work on Vercel.
- Supabase authentication, workspace loading, uploads, sharing, and billing return handling work before cutover.
- `desk.ordersounds.com` serves Vercel after the single DNS switch with valid TLS.
- No database, Auth, Storage, Edge Function, payment webhook, or provider secret migration is required.
- Netlify remains available as a rollback target during the stabilization window.
