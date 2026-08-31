# Workspace Plan Selector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an in-app monthly/yearly plan selector with NGN card payment and a USD alternative before provider checkout.

**Architecture:** A focused `SubscriptionPlanDialog` owns pricing preview, interval changes, provider switching, and explicit checkout opening. ProductionApp owns the active-beta dialog state; the expired-beta gate embeds the same component. Existing billing service methods remain the provider boundary.

**Tech Stack:** React, TypeScript, Supabase Edge Functions, Paystack Transaction API, Vitest, Testing Library.

---

### Task 1: Card-only Paystack subscription initialization

**Files:**
- Modify: `supabase/functions/paystack-initialize-checkout/index.ts`
- Test: `src/paystack-fulfillment.test.ts`

- [ ] Add a failing source-contract assertion requiring `channels: ["card"]` in the Paystack transaction initialization body.
- [ ] Run `npm test -- src/paystack-fulfillment.test.ts` and confirm the new assertion fails.
- [ ] Add `channels: ["card"]` beside `plan` and `callback_url` in the server-side initialization payload.
- [ ] Rerun the test and confirm it passes.

### Task 2: Reusable compact plan dialog

**Files:**
- Create: `src/features/billing/SubscriptionPlanDialog.tsx`
- Modify: `src/features/billing/workspaceCheckout.ts`
- Test: `src/subscription-plan-dialog.test.tsx`

- [ ] Write tests proving opening prepares pricing but does not open checkout, interval changes prepare the requested interval, USD switching requests Paddle, and the payment button opens only the prepared preview.
- [ ] Run `npm test -- src/subscription-plan-dialog.test.tsx` and confirm it fails because the component does not exist.
- [ ] Split workspace checkout preparation from explicit opening and implement the accessible modal with loading, error, interval, price, payment, provider-switch, and close states.
- [ ] Rerun the dialog tests and confirm they pass.

### Task 3: Wire every beta conversion entry point

**Files:**
- Modify: `src/app/ProductionApp.tsx`
- Modify: `src/features/billing/BetaAccessEndingNotice.tsx`
- Modify: `src/features/billing/SubscriptionRecoveryGate.tsx`
- Test: `src/beta-access-ending-notice.test.tsx`
- Test: `src/subscription-recovery-gate.test.tsx`

- [ ] Update tests so beta actions request the selector rather than opening checkout directly, while paid expiry still reuses its provider and interval.
- [ ] Run the two tests and confirm the beta expectations fail.
- [ ] Centralize the active-beta selector in ProductionApp, pass `onChoosePlan` to Settings and the notice, and embed the selector in the expired-beta recovery gate.
- [ ] Rerun the tests and confirm they pass.

### Task 4: Verify and deploy

**Files:**
- Verify all files above.

- [ ] Run `npm test -- src/subscription-plan-dialog.test.tsx src/beta-access-ending-notice.test.tsx src/subscription-recovery-gate.test.tsx src/settings-screen.test.tsx src/paystack-fulfillment.test.ts src/paddle-billing-service.test.ts`.
- [ ] Run `npm run build` and `git diff --check`.
- [ ] Commit and push `main`.
- [ ] Deploy `paystack-initialize-checkout`.
- [ ] Verify in production that `Choose a plan` opens the selector, `Pay in USD` switches currency, and the NGN payment action opens card entry.
