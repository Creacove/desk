# Subscription Renewal and Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement invisible successful renewals and a provider-affine, blocking recovery flow for failed, expired, and beta access without rerunning workspace setup.

**Architecture:** Add a dedicated renewal database RPC and route recurring Paystack/Paddle transactions through it. Add a reusable workspace subscription checkout hook plus a blocking recovery component, and make workspace access changes live through billing-table subscriptions. Extend Settings with provider-neutral billing management and a Paystack hosted-management function.

**Tech Stack:** React 18, TypeScript, Vitest/Testing Library, Supabase/Postgres, Supabase Edge Functions, Paystack Subscriptions, Paddle Billing.

---

### Task 1: Lock the database renewal contract

**Files:**
- Create: `supabase/migrations/20260831000100_subscription_renewal_recovery.sql`
- Create: `src/subscription-renewal-schema.test.ts`

- [ ] **Step 1: Write the failing schema contract test**

Assert that the migration drops `billing_transactions_checkout_session_id_key`, creates `record_verified_subscription_renewal`, validates provider/customer/price/currency/amount, upserts by `(provider, provider_transaction_id)`, updates `current_period_start` and `current_period_end`, and adds a setup-run trigger that completes reactivation rows when the workspace already has completed setup.

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm test -- src/subscription-renewal-schema.test.ts`

Expected: FAIL because the migration does not exist.

- [ ] **Step 3: Implement the migration**

Create `public.record_verified_subscription_renewal(...) returns table (account_id uuid, artist_workspace_id uuid, subscription_id uuid, transaction_id uuid)`. Lock the existing subscription by provider and subscription code, reject mismatched immutable billing identifiers, insert the completed transaction idempotently, and advance the subscription. Add a `before insert` trigger on `workspace_setup_runs` that changes a new queued run to completed/music-reads when another completed run already exists for that workspace.

- [ ] **Step 4: Run the schema test**

Run: `npm test -- src/subscription-renewal-schema.test.ts`

Expected: PASS.

### Task 2: Separate provider renewals from initial fulfillment

**Files:**
- Modify: `supabase/functions/paystack-webhook/index.ts`
- Modify: `supabase/functions/paddle-process-webhooks/index.ts`
- Modify: `supabase/functions/paddle-webhook/index.ts`
- Modify: `src/paystack-fulfillment.test.ts`
- Modify: `src/paddle-backend-contract.test.ts`

- [ ] **Step 1: Add failing provider contract tests**

Require Paystack recurring `charge.success` to call `record_verified_subscription_renewal`, require invoice updates to mirror period/status, require Paddle already-paid checkout transactions to call the renewal RPC, and require neither recurring path to dispatch `paid-workspace-setup`.

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `npm test -- src/paystack-fulfillment.test.ts src/paddle-backend-contract.test.ts`

Expected: FAIL on the new renewal assertions.

- [ ] **Step 3: Implement provider routing**

Paystack distinguishes an open/initialized correlated checkout from an existing subscription renewal. Initial payments retain verified checkout fulfillment; recurring charges call the renewal RPC. Paddle checks the correlated checkout status: open/initialized uses initial fulfillment, while paid uses the renewal RPC. Expand Paddle subscription event support to include activated, resumed, paused, and past-due status events. Query the setup row after initial fulfillment and dispatch setup only when it is not already completed.

- [ ] **Step 4: Run the focused provider tests**

Run: `npm test -- src/paystack-fulfillment.test.ts src/paddle-backend-contract.test.ts`

Expected: PASS.

### Task 3: Add provider-neutral billing management

**Files:**
- Create: `supabase/functions/paystack-customer-portal/index.ts`
- Modify: `src/services/productionSupabase.ts`
- Modify: `src/types/productionApp.ts`
- Modify: `src/paddle-billing-service.test.ts`
- Create: `src/paystack-customer-portal.test.ts`

- [ ] **Step 1: Add failing service and function tests**

Assert that `openCustomerPortal` invokes `paddle-customer-portal` for Paddle and `paystack-customer-portal` for Paystack, accepts only the providers' expected HTTPS hosts, and that the Paystack function authenticates membership, selects the workspace's latest Paystack subscription, and calls `/subscription/{code}/manage/link`.

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- src/paddle-billing-service.test.ts src/paystack-customer-portal.test.ts`

Expected: FAIL because Paystack management is absent.

- [ ] **Step 3: Implement provider-neutral management and access subscriptions**

Route the service by `workspace.billingProvider`. Add `subscribeWorkspaceAccess(workspace, onChange)` to listen to `billing_subscriptions` and `workspace_access_grants` changes for the current workspace. Validate `customer-portal.paddle.com` and `paystack.com` subdomains before assigning `window.location`.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- src/paddle-billing-service.test.ts src/paystack-customer-portal.test.ts`

Expected: PASS.

### Task 4: Preserve historical access and provider affinity

**Files:**
- Modify: `src/types/productionApp.ts`
- Modify: `src/services/productionSupabase.ts`
- Modify: `src/production-supabase-service.test.ts`

- [ ] **Step 1: Add failing workspace mapping tests**

Assert that an expired beta grant still maps to `accessType: "private_beta"`, an expired paid subscription keeps its `billingProvider`, and `billingInterval` is read from the subscription's checkout session.

- [ ] **Step 2: Run the mapping tests and verify failure**

Run: `npm test -- src/production-supabase-service.test.ts`

Expected: FAIL on historical access type and interval.

- [ ] **Step 3: Implement mapping changes**

Select each subscription's related checkout `plan_interval`, add `billingInterval?: "monthly" | "yearly"`, and derive access type from the latest historical paid subscription or beta grant rather than only active access.

- [ ] **Step 4: Run the mapping tests**

Run: `npm test -- src/production-supabase-service.test.ts`

Expected: PASS.

### Task 5: Build the recovery lock and confirmation flow

**Files:**
- Create: `src/features/billing/SubscriptionRecoveryGate.tsx`
- Create: `src/features/billing/useWorkspaceSubscriptionCheckout.ts`
- Create: `src/subscription-recovery-gate.test.tsx`
- Modify: `src/app/ProductionApp.tsx`
- Modify: `src/production-app-shell.test.tsx`

- [ ] **Step 1: Write failing UI tests**

Cover paid-expired copy, beta-expired copy, disabled/inert workspace backdrop, explicit previous-provider checkout preparation, monthly/yearly interval preservation, database-confirmed unlock, failed confirmation staying locked, and no call to setup methods.

- [ ] **Step 2: Run UI tests and verify failure**

Run: `npm test -- src/subscription-recovery-gate.test.tsx src/production-app-shell.test.tsx`

Expected: FAIL because inactive workspaces still render `SpotifyIdentityGate`.

- [ ] **Step 3: Implement the gate and checkout hook**

Replace the inactive-entitlement branch with `SubscriptionRecoveryGate`. Build the artist candidate from the retained workspace, call `prepareProviderCheckout` with `providerPreference: workspace.billingProvider ?? "auto"` and `interval: workspace.billingInterval ?? "monthly"`, then open the provider checkout. Subscribe to the checkout session and poll `billing-status`; call `onRecovered` only when the returned workspace has active entitlement. Keep checkout errors inside the gate.

- [ ] **Step 4: Add live access refresh**

In `ProductionApp`, subscribe to workspace billing/grant changes and schedule a refresh at `renewalAt` or `accessEndsAt`. A successful automatic renewal leaves the app unchanged; a failure or expiry updates the workspace into the recovery gate; recovery changes it back without setup.

- [ ] **Step 5: Run UI tests**

Run: `npm test -- src/subscription-recovery-gate.test.tsx src/production-app-shell.test.tsx`

Expected: PASS.

### Task 6: Phase out beta redemption and expose Billing in Settings

**Files:**
- Create: `src/features/billing/BetaAccessEndingNotice.tsx`
- Modify: `src/features/onboarding/FrontDoorScreens.tsx`
- Modify: `src/features/settings/SettingsScreen.tsx`
- Modify: `src/app/ProductionApp.tsx`
- Modify: `src/private-beta-ui.test.tsx`
- Modify: `src/settings-screen.test.tsx`

- [ ] **Step 1: Add failing beta and Settings tests**

Assert that no access-code field is rendered, the final-seven-day beta notice appears globally with a paid-subscription action, Settings has a Billing tab, both paid providers receive `Manage billing`, and beta access receives `Choose a plan`.

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- src/private-beta-ui.test.tsx src/settings-screen.test.tsx`

Expected: FAIL on the access-code removal, Billing tab, and Paystack action.

- [ ] **Step 3: Implement the beta notice and Settings actions**

Remove the beta redemption section from the paywall. Render `BetaAccessEndingNotice` at the top of the authenticated workspace during the final seven days. Rename the Settings Workspace tab to Billing, show billing details there, route `Manage billing` for either paid provider, and expose `Choose a plan` for active beta access.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- src/private-beta-ui.test.tsx src/settings-screen.test.tsx`

Expected: PASS.

### Task 7: Verify the complete lifecycle

**Files:**
- Modify only if verification reveals a scoped defect.

- [ ] **Step 1: Run all billing and access tests**

Run: `npm test -- src/subscription-renewal-schema.test.ts src/paystack-fulfillment.test.ts src/paystack-paywall-contract.test.tsx src/paddle-backend-contract.test.ts src/paddle-billing-service.test.ts src/paddle-app-flow-contract.test.ts src/production-supabase-service.test.ts src/subscription-recovery-gate.test.tsx src/production-app-shell.test.tsx src/private-beta-ui.test.tsx src/settings-screen.test.tsx`

Expected: PASS.

- [ ] **Step 2: Run type/build verification**

Run: `npm run build`

Expected: Vite production build completes successfully.

- [ ] **Step 3: Run the full test suite**

Run: `npm test`

Expected: PASS.

- [ ] **Step 4: Review the final diff**

Run: `git diff --check` and `git status --short`.

Expected: no whitespace errors and only subscription-renewal/recovery files are modified.

### Task 8: Delegate Paystack subscription collection to Paystack

**Files:**
- Modify: `src/paystack-fulfillment.test.ts`
- Modify: `supabase/functions/paystack-initialize-checkout/index.ts`
- Modify: `supabase/functions/paystack-webhook/index.ts`
- Modify: `supabase/functions/billing-status/index.ts`
- Modify: `supabase/functions/_shared/paystackFulfillment.ts`

- [ ] **Step 1: Write the failing provider contract test**

Require Paystack initialization to send `plan: planCode` without a forced `channels` list, and require initial fulfillment to consume the subscription identifier returned by Paystack rather than creating a subscription after a separate card-only charge.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npm test -- src/paystack-fulfillment.test.ts`

Expected: FAIL because checkout currently forces Card and omits the plan.

- [ ] **Step 3: Restore provider-managed subscription checkout**

Send the recurring plan code to Paystack, remove the forced channel list, and remove the post-charge card-subscription creation helper and its call sites. Preserve verified atomic fulfillment, recurring webhook routing, and setup suppression for workspace reactivation.

- [ ] **Step 4: Run focused billing tests**

Run: `npm test -- src/paystack-fulfillment.test.ts src/paystack-paywall-contract.test.tsx src/paddle-backend-contract.test.ts src/paddle-billing-service.test.ts`

Expected: PASS.

- [ ] **Step 5: Run build and deploy the changed Paystack functions**

Run: `npm run build`, then deploy `paystack-initialize-checkout`, `paystack-webhook`, and `billing-status` to the linked Supabase project.

Expected: the build exits successfully and each deployment reports success.
