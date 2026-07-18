# Paddle Live Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the verified Paddle sandbox integration to a fully configured live account while keeping checkout unavailable until Paddle approves the business and domain.

**Architecture:** Keep the existing environment-driven Paddle integration unchanged and create matching live resources additively. Improve the public Desk sign-in surface first, then create live catalog/credentials/webhooks, submit verification, and finally swap the complete Supabase Paddle secret set as one coordinated release.

**Tech Stack:** React, TypeScript, Vitest, static HTML, Supabase Edge Functions and secrets, Netlify, Paddle Billing dashboard/API.

---

### Task 1: Add live-domain legal readiness

**Files:**
- Create: `public/refund-cancellation.html`
- Modify: `src/app/ProductionApp.tsx`
- Test: `src/production-app-shell.test.tsx`

- [ ] **Step 1: Write the failing auth-shell assertions**

Add assertions to the signed-out shell test for links named `Terms`, `Privacy`, `Refunds and cancellation`, and `Contact`, including their exact destinations.

- [ ] **Step 2: Run the focused test to verify failure**

Run: `npm test -- src/production-app-shell.test.tsx -t "renders auth"`

Expected: FAIL because the four links are not rendered.

- [ ] **Step 3: Add the signed-out legal link row**

Render the four links below the authentication form. Use normal anchors so they remain accessible before JavaScript authentication succeeds.

- [ ] **Step 4: Create the refund/cancellation page**

Create a self-contained HTML page at `/refund-cancellation.html` that identifies OrderSOUNDS Desk, states the monthly/yearly renewal model, explains end-of-period cancellation and access, directs refund requests through Paddle buyer support and `ordersoundsapp@gmail.com`, and preserves statutory rights.

- [ ] **Step 5: Run the focused test**

Run: `npm test -- src/production-app-shell.test.tsx -t "renders auth"`

Expected: PASS.

### Task 2: Verify repository payment boundaries

**Files:**
- Verify: `src/lib/paddleBilling.ts`
- Verify: `supabase/functions/_shared/paddle.ts`
- Verify: `supabase/functions/paddle-webhook/index.ts`
- Verify: `.env.example`
- Test: `src/paddle-checkout.test.ts`
- Test: `src/paddle-backend-contract.test.ts`
- Test: `src/payment-deployment-config.test.ts`

- [ ] **Step 1: Run payment contract tests**

Run: `npm test -- src/paddle-checkout.test.ts src/paddle-backend-contract.test.ts src/payment-deployment-config.test.ts`

Expected: PASS, confirming explicit environment selection, `live_` validation, official SDK use, raw-body webhook verification, and documented secret names.

- [ ] **Step 2: Confirm no runtime sandbox literals or hard-coded catalog IDs**

Run: `rg -n -S -g '!node_modules' -g '!.git' 'Paddle.Environment.set|sandbox-api.paddle.com|pri_[a-z0-9]{20,}|pro_[a-z0-9]{20,}' src supabase netlify`

Expected: no runtime sandbox environment call, no direct sandbox API URL, and no production catalog IDs embedded in source.

### Task 3: Create the additive live Paddle catalog

**External state:** Paddle live dashboard and sandbox dashboard.

- [ ] **Step 1: Read each sandbox price detail**

Record the exact GB, IE, and AU overrides for the USD 20 monthly and USD 200 yearly prices. Do not modify sandbox.

- [ ] **Step 2: Create the live Pro product**

Create `Pro` with the standard digital-goods tax category.

- [ ] **Step 3: Create the monthly live price**

Create a USD 20 monthly recurring price and copy its GB, IE, and AU overrides exactly.

- [ ] **Step 4: Create the yearly live price**

Create a USD 200 yearly recurring price and copy its GB, IE, and AU overrides exactly.

- [ ] **Step 5: Record the ID mapping**

Capture sandbox and live `pro_`/`pri_` IDs without committing any credential or signing secret.

### Task 4: Create live credentials and notification destination

**External state:** Paddle live dashboard and Supabase project `bbwbxmnanccwottrmkqu`.

- [ ] **Step 1: Create a live API key**

Create one least-privilege key for the server operations used by `_shared/paddle.ts`, webhook processing, and customer portal creation. Capture the value once.

- [ ] **Step 2: Create a live client-side token**

Create one token and verify that it starts with `live_`.

- [ ] **Step 3: Create the live notification destination**

Use `https://bbwbxmnanccwottrmkqu.supabase.co/functions/v1/paddle-webhook` and subscribe to the six events listed in the design. Capture both destination ID and signing secret.

- [ ] **Step 4: Stage the complete Supabase secret command locally**

Prepare one `supabase secrets set --project-ref bbwbxmnanccwottrmkqu` invocation containing all eight Paddle values. Do not print secret values to logs.

### Task 5: Submit domain and account verification

**External state:** Paddle live dashboard and public website.

- [ ] **Step 1: Deploy the legal readiness change**

Run the full verification in Task 6, commit, and deploy through the existing Netlify production workflow.

- [ ] **Step 2: Verify the public URLs**

Confirm successful responses for `https://desk.ordersounds.com`, `https://desk.ordersounds.com/refund-cancellation.html`, `https://ordersounds.com/terms`, `https://ordersounds.com/privacy`, and `https://ordersounds.com/contact`.

- [ ] **Step 3: Submit the checkout domain**

Submit `desk.ordersounds.com` under Checkout > Website Approval.

- [ ] **Step 4: Set the default payment link**

Set `https://desk.ordersounds.com` under Checkout > Checkout Settings.

- [ ] **Step 5: Start account verification**

Complete Paddle's domain review, business identification, and identity verification using the account owner's legal documents. Do not enable customer checkout until Paddle reports completion.

### Task 6: Verify code and build before deployment

**Files:**
- Verify: all files changed by Task 1

- [ ] **Step 1: Run focused payment and auth tests**

Run: `npm test -- src/production-app-shell.test.tsx src/paddle-checkout.test.ts src/paddle-backend-contract.test.ts src/payment-deployment-config.test.ts`

Expected: PASS.

- [ ] **Step 2: Run the full suite**

Run: `npm test`

Expected: PASS.

- [ ] **Step 3: Build production assets**

Run: `npm run build`

Expected: exit code 0 with production assets emitted.

### Task 7: Perform the coordinated secret cutover

**External state:** Supabase project `bbwbxmnanccwottrmkqu`.

- [ ] **Step 1: Confirm gates**

Require an approved `desk.ordersounds.com` checkout domain and completed Paddle business/identity verification.

- [ ] **Step 2: Set all live Paddle secrets together**

Set `PADDLE_ENVIRONMENT=production`, live API key, `live_` client token, webhook signing secret, notification destination ID, live product ID, and both live price IDs in one operation.

- [ ] **Step 3: Redeploy Paddle functions**

Deploy `billing-pricing-config`, `paddle-create-checkout`, `paddle-webhook`, `paddle-process-webhooks`, and `paddle-customer-portal` to project `bbwbxmnanccwottrmkqu`.

- [ ] **Step 4: Verify production configuration**

From an authenticated OrderSOUNDS account, confirm the pricing function reports `production`, a `live_` client token, the live product ID, and both live price IDs.

### Task 8: Run controlled live checkout and lifecycle verification

**External state:** Paddle live account and production Supabase database.

- [ ] **Step 1: Create a single-use 100% live discount**

Limit it to the Pro product and one redemption where supported.

- [ ] **Step 2: Hand checkout to the account owner**

The owner applies the discount and completes checkout with their real card on `desk.ordersounds.com`.

- [ ] **Step 3: Verify fulfillment**

Confirm completed transaction, 2xx webhook deliveries, processed queue events, customer/subscription/transaction rows, and active entitlement.

- [ ] **Step 4: Verify lifecycle operations**

Test immediate no-charge plan change, end-of-period cancellation with continued access, and immediate cancellation with denied access.

- [ ] **Step 5: Clean up**

Confirm the test subscription is canceled and archive only the temporary live-test discount.

