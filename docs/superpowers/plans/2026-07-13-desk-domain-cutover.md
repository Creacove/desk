# Desk Domain Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move `desk.ordersounds.com` from Royalty Tracker on Vercel to the replacement Ordersounds Desk on Netlify while preserving Royalty Tracker and uninterrupted Paystack webhook processing.

**Architecture:** Treat the frontend hostname, browser callback, and webhook endpoint as separate concerns. Validate the Netlify deployment first, preserve and record every old value, transfer only the custom hostname and browser-facing callback, then verify production before declaring success. Rollback restores the previous Vercel domain association, DNS CNAME, and callback value without touching either deployment or the Supabase-hosted webhook.

**Tech Stack:** Netlify, Netlify DNS, Vercel, Supabase Auth and Edge Functions, Paystack, Vite/React, PowerShell

---

## File Map

- Reference: `docs/superpowers/specs/2026-07-13-desk-domain-cutover-design.md` — approved migration contract and safety boundaries.
- Create: `docs/operations/desk-domain-cutover-2026-07-13.md` — sanitized execution record containing project identifiers, non-secret URL values, verification results, and rollback state.
- No application source file is expected to change. `src/services/productionSupabase.ts` already derives split-confirmation links from `window.location.origin`, and `src/app/ProductionApp.tsx` already accepts Paystack return references at the application root.
- Do not modify `supabase/config.toml` for production. Its `site_url` is local-development configuration.
- Do not replace `.env.example`'s localhost Spotify callback unless browser OAuth is actually enabled; the current production Spotify flow uses server-side artist search.

### Task 1: Capture a Sanitized Baseline

**Files:**
- Create: `docs/operations/desk-domain-cutover-2026-07-13.md`

- [ ] **Step 1: Record repository and deployment identifiers**

Create the execution record with this initial content, adding command results only when they contain no credentials:

```markdown
# Desk Domain Cutover Execution Record — 2026-07-13

## Projects

- Replacement Netlify project: `ordersounds-desk`
- Replacement Netlify project ID: `004c7152-3e14-4085-afe9-738f7cfc55c4`
- Replacement fallback URL: `https://ordersounds-desk.netlify.app`
- Supabase project ref: `bbwbxmnanccwottrmkqu`
- Custom domain: `https://desk.ordersounds.com`

## Pre-cutover state

- DNS: `desk.ordersounds.com CNAME e795fdefaa10432c.vercel-dns-017.com`
- Existing app title: `OrderSounds`
- Replacement app title: `Desk`
- Royalty Tracker fallback URL: recorded privately during Vercel inspection; no project was deleted

## Integration decisions

- Paystack callback target: `https://desk.ordersounds.com`
- Paystack webhook: unchanged Supabase `paystack-webhook` Edge Function URL
- Netlify fallback URL retained

## Verification log

- Pending

## Rollback state

- Previous DNS CNAME: `e795fdefaa10432c.vercel-dns-017.com`
- Previous Paystack callback: record privately before changing; do not commit secrets
- Previous Vercel domain association: record project name and project ID after inspection
```

- [ ] **Step 2: Confirm the repository audit has no production frontend hostname embedded in source**

Run:

```powershell
rg -n -i --hidden -g '!node_modules' -g '!.git' '(ordersounds-desk\.netlify\.app|desk\.ordersounds\.com|vercel-dns)' .
```

Expected: references appear only in the approved specification, implementation plan, and execution record. Any unexpected source occurrence must be reviewed before proceeding.

- [ ] **Step 3: Confirm current public endpoints and DNS**

Run:

```powershell
Resolve-DnsName desk.ordersounds.com -Type CNAME
Invoke-WebRequest https://desk.ordersounds.com -UseBasicParsing | Select-Object StatusCode
Invoke-WebRequest https://ordersounds-desk.netlify.app -UseBasicParsing | Select-Object StatusCode
npx netlify status
```

Expected: the custom domain still resolves to the recorded Vercel target, both endpoints return HTTP 200, and the linked Netlify project is `ordersounds-desk`.

- [ ] **Step 4: Commit only the sanitized execution record**

Run:

```powershell
git add -- docs/operations/desk-domain-cutover-2026-07-13.md
git commit -m "docs: record Desk domain cutover baseline"
```

Expected: one commit containing only the execution record; existing unrelated working-tree changes remain unstaged.

### Task 2: Verify the Replacement Before Cutover

**Files:**
- Modify: `docs/operations/desk-domain-cutover-2026-07-13.md`

- [ ] **Step 1: Run the production build**

Run:

```powershell
npm run build
```

Expected: exit code 0 and a production bundle in `dist`.

- [ ] **Step 2: Run domain-sensitive automated tests**

Run:

```powershell
npx vitest run src/supabase-client.test.ts src/split-confirmation-functions.test.ts src/split-confirmation-env.test.ts src/paystack-paywall-contract.test.tsx src/production-app-shell.test.tsx --environment jsdom --pool=vmThreads
```

Expected: all selected test files pass. If unrelated dirty files cause failures, record the failure and distinguish it from the checked-in baseline before continuing.

- [ ] **Step 3: Verify the Netlify fallback app in a browser**

Open `https://ordersounds-desk.netlify.app` and confirm:

```text
1. The page loads over HTTPS.
2. The Ordersounds Desk sign-in experience appears.
3. A deep link such as /split-confirmation?token=invalid returns the SPA, not Netlify 404.
4. Browser console has no missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY error.
```

Expected: all four checks pass before any domain mutation.

- [ ] **Step 4: Inspect Royalty Tracker without mutating it**

In the authenticated Vercel project list, locate the project currently associated with `desk.ordersounds.com`. Record its project name, project ID, and default `.vercel.app` URL in the execution record, then open the default URL.

Expected: Royalty Tracker loads at its default URL. Stop if it has no working fallback URL.

### Task 3: Prepare Hosting and Integration State

**Files:**
- Modify: `docs/operations/desk-domain-cutover-2026-07-13.md`

- [ ] **Step 1: Record the current Paystack callback value privately**

Inspect the Supabase project's `PAYSTACK_CALLBACK_URL` setting without copying secret values into the repository or terminal transcript. Record only whether it exists and its hostname in the execution record.

Expected: the variable exists. If absent, stop and verify the active billing environment before changing anything.

- [ ] **Step 2: Confirm the Paystack webhook target**

In Paystack dashboard settings, verify the webhook points to:

```text
https://bbwbxmnanccwottrmkqu.supabase.co/functions/v1/paystack-webhook
```

Expected: it uses the Supabase function URL. Do not edit it during the hostname cutover.

- [ ] **Step 3: Add the custom domain to the replacement Netlify project**

In Netlify project `ordersounds-desk`, add `desk.ordersounds.com` as the primary production domain without deleting the default Netlify URL.

Expected: Netlify displays the domain on the replacement project. TLS may remain pending until DNS changes.

- [ ] **Step 4: Prepare Supabase Auth redirect coverage**

Set the hosted Supabase Auth Site URL to:

```text
https://desk.ordersounds.com
```

Retain this redirect allowlist entry for rollback:

```text
https://ordersounds-desk.netlify.app/**
```

Add this production allowlist entry:

```text
https://desk.ordersounds.com/**
```

Expected: the custom and fallback hosts are accepted for confirmation, recovery, and future OAuth redirects.

### Task 4: Execute the Live Domain Transfer

**Files:**
- Modify: `docs/operations/desk-domain-cutover-2026-07-13.md`

- [ ] **Step 1: Detach only the custom domain from Royalty Tracker**

Remove `desk.ordersounds.com` from the identified Vercel project. Do not delete the Vercel project, deployments, environment variables, storage, or default `.vercel.app` domain.

Expected: Royalty Tracker still loads from its recorded `.vercel.app` URL.

- [ ] **Step 2: Replace the DNS record in Netlify DNS**

Remove the existing record:

```text
desk.ordersounds.com CNAME e795fdefaa10432c.vercel-dns-017.com
```

Create the exact CNAME or Netlify-managed record shown by the `ordersounds-desk` domain setup screen. Do not guess the target.

Expected: Netlify reports correct DNS configuration for `desk.ordersounds.com`.

- [ ] **Step 3: Wait for DNS and TLS readiness**

Run repeatedly, without changing other records:

```powershell
Resolve-DnsName desk.ordersounds.com -Type CNAME,A
Invoke-WebRequest https://desk.ordersounds.com -UseBasicParsing | Select-Object StatusCode
```

Expected: DNS no longer returns the Vercel target, HTTPS returns 200, and the certificate is valid for `desk.ordersounds.com`.

- [ ] **Step 4: Update the Paystack browser callback**

Set Supabase Edge Function secret `PAYSTACK_CALLBACK_URL` to exactly:

```text
https://desk.ordersounds.com
```

Expected: future Paystack checkout initializations send the custom domain as `callback_url`. Do not change `PAYSTACK_SECRET_KEY`, `PAYSTACK_PLAN_CODE`, price, currency, or webhook signing behavior.

### Task 5: Verify Production and Decide Acceptance

**Files:**
- Modify: `docs/operations/desk-domain-cutover-2026-07-13.md`

- [ ] **Step 1: Verify routing and public application state**

Open these URLs:

```text
https://desk.ordersounds.com
https://desk.ordersounds.com/split-confirmation?token=invalid
https://ordersounds-desk.netlify.app
```

Expected: the custom domain serves the replacement Desk, the deep link serves the SPA, and the fallback remains available.

- [ ] **Step 2: Verify authentication and workspace loading**

Use an existing non-destructive account to sign in at the custom domain, load Desk HQ, refresh the page, and sign out.

Expected: session creation, workspace data, refresh persistence, and sign-out work without redirecting to Vercel or the Netlify fallback.

- [ ] **Step 3: Verify payment return behavior without making a charge**

Open:

```text
https://desk.ordersounds.com/?reference=domain-cutover-smoke-test
```

Expected: the application recognizes payment-return mode and reports a missing or unmatched reference; it does not ignore the query or fail to load. Do not submit a real payment.

- [ ] **Step 4: Verify Paystack initialization configuration**

From the authenticated onboarding flow, initiate checkout only far enough to inspect the Paystack authorization request or function response. Do not approve a real charge.

Expected: the initialized transaction contains `callback_url=https://desk.ordersounds.com`.

- [ ] **Step 5: Verify unaffected integrations**

Confirm:

```text
1. Paystack dashboard webhook still targets the Supabase paystack-webhook function.
2. Royalty Tracker still loads at its default Vercel URL.
3. A newly generated split-confirmation email/link uses desk.ordersounds.com when a safe test workspace is available.
4. PostHog receives an event whose current_url/host is desk.ordersounds.com when analytics consent permits it.
```

Expected: all applicable checks pass; an unavailable safe split-email test is recorded as not executed rather than sending to a real collaborator.

- [ ] **Step 6: Record acceptance or run rollback**

Accept the cutover only if custom-domain TLS, app loading, authentication, workspace loading, Paystack callback configuration, and unchanged webhook configuration pass.

If a critical check fails, restore in this order:

```text
1. Restore the previous Netlify DNS CNAME to e795fdefaa10432c.vercel-dns-017.com.
2. Reattach desk.ordersounds.com to the recorded Vercel Royalty Tracker project.
3. Restore the privately recorded PAYSTACK_CALLBACK_URL value if it was changed.
4. Leave ordersounds-desk.netlify.app and the Supabase webhook untouched.
```

Expected: the execution record states either `ACCEPTED` with timestamps and evidence or `ROLLED BACK` with the failed check and restored values.

- [ ] **Step 7: Commit the completed sanitized execution record**

Run:

```powershell
git add -- docs/operations/desk-domain-cutover-2026-07-13.md
git commit -m "docs: complete Desk domain cutover record"
```

Expected: the commit contains no tokens, secret values, private customer data, or unrelated working-tree changes.
