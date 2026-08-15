# Desk Production Release Runbook

This is the release gate for the production Desk app. Passing GitHub CI is necessary but does not replace hosted Supabase, provider, and real-browser verification.

## Release rule

Do not expose a new release broadly until all automated gates are green and the canary flow below has passed on the hosted environment.

A release is identified by the exact deployed git SHA in `APP_RELEASE`. Every Edge/browser failure should therefore be attributable to one release.

## 1. Automated entry gate

The PR must have all of these green on the exact release head:

- Browser TypeScript regression check: no new root-browser diagnostics versus `main`.
- Manager, sharing, and telemetry Deno typecheck.
- Fresh Supabase migration smoke from an empty local state.
- Real Postgres tests for narrative-first document persistence/versioning.
- Real Postgres test for Manager-prepared private packages.
- Real Postgres authenticated RLS isolation test.
- Real Postgres quality-gated document approval test.
- Focused Release Success / Campaign / record-servicing tests.
- Raw full repository `npm test` with no compatibility allowlist.
- Production-only dependency audit with no high/critical runtime vulnerability.
- Production environment contract.
- Real Chromium production-shell smoke.
- Production Vite build.

Do not waive one of these checks just to make the PR green.

## 2. Hosted production environment gate

Before deployment, set the real hosted values and run:

```bash
npm run env:check:production
```

Required production invariants:

- `VITE_APP_MODE` is not `prototype`.
- `VITE_SUPABASE_URL` is the production HTTPS project URL.
- `VITE_SUPABASE_ANON_KEY` is present.
- `SUPABASE_SERVICE_ROLE_KEY` is present only in server/Edge secrets.
- `OPENAI_API_KEY` is present only in server/Edge secrets.
- `PUBLIC_APP_URL` (preferred) or `APP_ORIGIN` is the real HTTPS app origin.
- `APP_ENVIRONMENT=production`.
- `APP_RELEASE=<exact deployed git SHA>`.
- Spotify client id/secret are configured server-side and `SPOTIFY_REDIRECT_URI` is the real HTTPS callback.
- Supabase Auth redirect allow-list contains the real production URLs.
- Resend sender/reply-to are production-valid if transactional email is enabled.
- Paddle is `production` when live Paddle credentials are enabled.
- Paystack callback is HTTPS when Paystack production billing is enabled.
- No localhost URL, placeholder secret, or sandbox billing mode is mixed into the production release.

## 3. Database deployment order

Database first, application second.

1. Confirm the hosted Supabase project is the intended Desk production project.
2. Inspect the hosted migration history before changing anything.
3. Apply every missing migration in repository order through the current release.
4. Confirm these release-hardening migrations are present:
   - `20260815000100_structured_campaign_documents.sql`
   - `20260815000200_campaign_document_staleness.sql`
   - `20260815000300_manager_prepared_release_packages.sql`
   - `20260815000400_song_document_approval.sql`
5. Verify the RPCs exist with the intended grants:
   - `persist_focused_song_document_v2`
   - `mark_song_campaign_documents_stale` (service role only)
   - `prepare_focused_release_share_package_v1` (service role only)
   - `approve_song_document_for_sharing_v1` (authenticated + service role; membership checked inside)
6. Do not roll back a production migration after users have written data unless the rollback has been explicitly designed and tested. Prefer a forward-fix migration.

## 4. Edge deployment order

After database migrations are live, deploy or verify the Edge functions whose runtime behavior or shared imports changed:

1. `manager-conversation`
2. `music-share-links`
3. `public-music-share`
4. `capture-browser-error`

Then verify functions used by the canary path are still deployed and healthy, including song workspace initialization, release plan changes, Spotify catalog flows, Chartmetric refresh where enabled, and transactional email where enabled.

Do not deploy the frontend before the required database RPCs exist.

## 5. Frontend deployment

Deploy the exact commit that passed CI.

Set `APP_RELEASE` to that commit SHA in Edge/runtime secrets and expose the same release identifier in the deployment metadata used by the frontend/error capture path.

After deploy, hard-refresh one internal session and verify there is no prototype/fixture content in production.

## 6. Canary artist flow

Run this on one internal/test artist first. Do not use a broad beta cohort yet.

### Released-record servicing

1. Sign in normally.
2. Open an actual released/catalog song.
3. Ask Manager: `Find playlist opportunities for this song.`
4. Confirm release-date mutation tools are not invoked.
5. Confirm targets show decision-first `PITCH NOW / WATCH / SKIP` behavior.
6. Confirm public provenance/contact evidence is visible and no paid-placement claim is invented.

### Unreleased release campaign

1. Create/open a real unreleased song.
2. Ask Manager: `I want to release this song in 14 days.`
3. Confirm the release-management flow resolves correctly and does not silently mutate the release date without the existing approval flow.
4. Ask Manager to build the release campaign/release kit.
5. Confirm the internal Release Narrative is created first.
6. Confirm recipient-facing collateral cannot exist before the narrative.
7. Build at least an EPK plus one pitch/press artifact.
8. Introduce one genuinely unknown fact and confirm Manager surfaces it as a missing/verification input rather than hallucinating it.

### Artifact approval and sharing

1. Open a Manager-built recipient-facing artifact in Files.
2. Confirm it opens read-first.
3. Confirm `Approve for sharing` is present only for a quality-ready external artifact.
4. Confirm the internal Release Narrative never offers approval/share.
5. Confirm a needs-review or stale document cannot be approved/shared.
6. Approve the external artifact and confirm its exact canonical version remains unchanged.
7. Ask Manager: `Prepare the package for this curator/press target.`
8. Confirm Manager prepares a private link but does not email, submit, DM, post, spend, or contact anyone.
9. Confirm the package is linked to the opportunity.
10. Open the package logged out in a separate/private browser session.
11. Confirm only the intended frozen content is visible.
12. Confirm the internal Release Narrative is absent.
13. Revoke the package and confirm the public URL stops working.

### Staleness / immutable snapshot

1. Create and open one valid share package.
2. Change a source-of-truth release fact such as release date, title, credits, identifier, artwork/master asset, or splits.
3. Confirm affected canonical Manager campaign documents move to `needs_revision`.
4. Confirm the already-created recipient package remains frozen and unchanged.
5. Refresh/rebuild the canonical artifact and confirm the stale flag clears only on the new version.

### Recovery behavior

During the canary, deliberately exercise:

- one page refresh during Manager work;
- browser back/forward between Manager and Song Room;
- double-click prevention on save/approve actions;
- offline/online transition where practical;
- one failed or interrupted Manager/provider call;
- expired/re-authenticated session;
- mobile/narrow layout for Song Overview, Campaign, Files, document preview, and share dialog.

The product should preserve the last good state and surface a recoverable error rather than losing work or creating duplicates.

## 7. Real account-isolation gate

The local CI RLS test is mandatory but hosted isolation still needs a real test once Supabase access is available.

Use two authenticated accounts/workspaces:

- Account A cannot read Account B songs, projects, conversations, missions, opportunities, documents, document versions, or share-link management records.
- Account A cannot write/update/delete Account B records by supplying ids directly.
- Public share access works only through the intended capability token and returns only the frozen package manifest.
- Revocation immediately disables the public token.

Any cross-account read/write is a release blocker.

## 8. Monitoring gate

Immediately after deployment, verify real failures can reach `app_error_events`.

Monitor open `error` and `critical` events grouped by:

- `release_version = APP_RELEASE`
- fingerprint
- source/function/operation
- account/workspace
- Manager run / conversation / music item refs
- provider and HTTP status where applicable

A new repeated fingerprint on the canary release is a stop signal until understood.

Never expose `app_error_events` to customer activity feeds; it remains service-role-only.

## 9. Rollout stages

Use progressive exposure:

1. Internal/test artist only.
2. 1–3 trusted canary users with real catalog/release data.
3. Small beta cohort.
4. Broader beta only after the previous cohort has completed meaningful Manager/Campaign work without release-blocking errors.

Do not use time alone as the promotion criterion. Promote when the workflows are actually exercised.

### Stop conditions

Stop/hold rollout for any of these:

- cross-account/RLS failure;
- migration or RPC mismatch;
- internal Release Narrative leaking into a share package;
- unapproved/stale Manager document becoming shareable;
- capability token stored in plaintext;
- Manager sends/submits/contacts externally without the intended user action/permission;
- duplicate canonical documents or duplicate share packages from one action;
- repeated uncaught browser crash in the critical Song/Manager flow;
- repeated Manager failure that destroys or corrupts saved campaign state;
- release-date mutation bypassing the approval path;
- unexplained high/critical production dependency vulnerability.

## 10. Rollback / forward-fix

### Frontend

Redeploy the previous known-good commit immediately if the frontend introduces a release blocker.

### Edge Functions

Redeploy the previous known-good function source when the function contract remains compatible with the live database. Keep `APP_RELEASE` accurate for the rollback release.

### Database

Prefer a tested forward-fix migration. Do not destructively reverse migrations after new production data depends on them.

### Data integrity

Before any corrective operation that could mutate user data, preserve the affected ids and inspect the durable records: canonical document/version ids, share-link ids, opportunity ids, Manager run ids, operating events, and error-event fingerprints.

## Hosted checks still requiring the Supabase connection

These cannot be honestly closed by repository CI alone:

- confirming the production project migration state;
- applying the migrations to the hosted project;
- verifying/deploying the Edge functions on the hosted project;
- verifying real hosted secrets and auth redirect configuration;
- real OpenAI/Spotify/Chartmetric calls with production credentials;
- the two-real-account hosted isolation test;
- the full canary journey on the deployed URL;
- verification that production `app_error_events` is receiving failures for the deployed `APP_RELEASE`.

Until those are complete, keep the PR/release in the production-gate state rather than treating CI green as proof of the hosted system.
