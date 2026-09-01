# Fast Subscription Pricing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make subscription prices resolve once in the background and appear immediately and consistently in Setup, Settings, beta-expiry recovery, and the beta-ending plan dialog without creating checkout sessions before Pay.

**Architecture:** Add a pricing-only `ProductionBillingService.loadProviderPricing` method that returns both interval prices and caches/deduplicates its request. Warm that cache after the signed-in workspace is loaded. The shared plan dialog consumes pricing for display and calls `prepareProviderCheckout` only after Pay; Setup continues using its existing complete-preview flow and therefore keeps its current UX.

**Tech Stack:** React, TypeScript, Vitest, Supabase Edge Functions, Paddle.js, Paystack.

---

### Task 1: Define the shared pricing contract and write the service regression

**Files:**
- Modify: `src/types/productionApp.ts:279-361` to add shared price/pricing types and the pricing-only service method.
- Test: `src/paddle-billing-service.test.ts` to prove pricing loading has no checkout side effect and is cached.

- [ ] **Step 1: Add the failing service test**

Add this behavior to `src/paddle-billing-service.test.ts`: stub `/api/billing-country`, return the existing pricing config from `billing-pricing-config`, throw if `paddle-create-checkout` is called, call `loadProviderPricing` twice, and assert both interval totals are returned while config and Paddle `PricePreview` run once.

```ts
  it("loads and caches interval pricing without creating a checkout session", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ countryCode: "GB" }))));
    const calls: string[] = [];
    const client = { functions: { invoke: async (name: string) => {
      calls.push(name);
      if (name === "billing-pricing-config") return { data: pricing, error: null };
      if (name === "paddle-create-checkout") throw new Error("Pricing must not create checkout sessions.");
      throw new Error(`Unexpected function: ${name}`);
    } } } as unknown as SupabaseClient;
    const service = createSupabaseBillingService(client);
    const first = await service.loadProviderPricing!({ providerPreference: "auto" });
    const second = await service.loadProviderPricing!({ providerPreference: "auto" });
    expect(first).toMatchObject({
      provider: "paddle",
      intervalOptions: {
        monthly: { formattedTotal: "£16.00", priceId: "pri_month" },
        yearly: { formattedTotal: "£160.00", priceId: "pri_year" },
      },
    });
    expect(second.intervalOptions).toEqual(first.intervalOptions);
    expect(calls.filter((name) => name === "billing-pricing-config")).toHaveLength(1);
    expect(calls).not.toContain("paddle-create-checkout");
    expect(paddle.PricePreview).toHaveBeenCalledTimes(1);
  });
```

- [ ] **Step 2: Run the test and verify the expected red failure**

Run:

```powershell
npm test -- src/paddle-billing-service.test.ts -t "loads and caches interval pricing"
```

Expected: FAIL because the current service does not expose `loadProviderPricing`.

- [ ] **Step 3: Add shared types**

In `src/types/productionApp.ts`, add `ProductionBillingPrice`, `ProductionPaddleConfig`, and `ProductionBillingPricing`. Use `Record<"monthly" | "yearly", ProductionBillingPrice>` for interval options, update the checkout-preview interval option to use the shared price type, and add:

```ts
  loadProviderPricing?(input: {
    existingWorkspace?: ProductionWorkspace;
    providerPreference?: ProductionBillingProviderPreference;
  }): Promise<ProductionBillingPricing>;
```

- [ ] **Step 4: Run the same test and confirm it still fails at the unimplemented method**

Run the same command. Expected: the type is recognized but the service call still fails because implementation is not present.

### Task 2: Implement cached pricing-only loading and reuse it for checkout preparation

**Files:**
- Modify: `src/services/productionSupabase.ts:515-580` to cache config, country, provider pricing, and deduplicate concurrent requests.
- Modify: `src/services/productionSupabase.ts:794-838` to return the shared price shape.
- Test: `src/paddle-billing-service.test.ts` existing provider-preparation tests.

- [ ] **Step 1: Add retryable cached loaders**

Inside `createSupabaseBillingService`, cache the pricing-config and country promises and clear each rejected promise so a later attempt can retry. Add a provider-pricing map keyed by provider preference, workspace ID, and Paddle customer ID; remove a rejected map entry. This prevents duplicate work when the app prefetch and dialog open happen together.

- [ ] **Step 2: Implement `loadProviderPricing` without database checkout creation**

For Paystack, return the existing `paystackIntervalOptions`. For Paddle, initialize Paddle with the existing customer when available, call `previewLocalizedPaddlePrices` for both canonical prices, and return provider, product ID, Paddle config, and both totals. Keep `resolveBillingProvider` and default Paddle routing unchanged.

- [ ] **Step 3: Refactor `prepareProviderCheckout` to consume cached pricing**

Have `prepareProviderCheckout` call the pricing loader first, then create a Paystack or Paddle checkout only when explicitly called by a Pay action or Setup. Build the full checkout preview from the cached interval price plus the server response, retaining artist, interval, correlation token, customer config, and all existing validation.

- [ ] **Step 4: Run focused service tests**

Run:

```powershell
npm test -- src/paddle-billing-service.test.ts src/paddle-checkout.test.ts
```

Expected: all service and Paddle checkout tests pass, including the no-checkout pricing regression.

### Task 3: Refactor the shared plan dialog around cached pricing

**Files:**
- Modify: `src/features/billing/workspaceCheckout.ts:1-48` to expose workspace pricing loading and one shared price formatter.
- Modify: `src/features/billing/SubscriptionPlanDialog.tsx:1-115` to display pricing and defer checkout until Pay.
- Test: `src/subscription-plan-dialog.test.tsx` to cover the pricing/checkout boundary.

- [ ] **Step 1: Rewrite the dialog test first**

Provide `loadProviderPricing` with monthly `$24` and yearly `$240`, and provide a separate `prepareProviderCheckout` spy returning the complete yearly preview. Assert opening displays `Pay $24`, changing interval does not call checkout preparation, and clicking `Pay $240` calls preparation before opening checkout.

```ts
    const loadProviderPricing = vi.fn().mockResolvedValue({
      provider: "paddle",
      intervalOptions: {
        monthly: { formattedTotal: "$24", priceId: "pri_month" },
        yearly: { formattedTotal: "$240", priceId: "pri_year" },
      },
      productId: "pro_1",
      paddleConfig: { environment: "sandbox", clientToken: "test_token" },
    });
    const prepareProviderCheckout = vi.fn().mockResolvedValue(preview("paddle", "yearly"));
```

- [ ] **Step 2: Run the dialog test and verify the old behavior fails**

Run:

```powershell
npm test -- src/subscription-plan-dialog.test.tsx
```

Expected: FAIL because the current dialog prepares a complete checkout on open and has no pricing-only path.

- [ ] **Step 3: Add the shared workspace pricing helper and formatter**

In `workspaceCheckout.ts`, add `loadWorkspaceSubscriptionPricing` that passes `existingWorkspace` and `workspace.billingProvider ?? "auto"` to `loadProviderPricing`, with the existing billing-unavailable error when unavailable. Add `formatSubscriptionPrice` that preserves Paddle `formattedTotal` and formats amount/currency using `en-NG` for NGN and `en-US` otherwise.

- [ ] **Step 4: Refactor `SubscriptionPlanDialog`**

Replace full-preview state with pricing state. Load pricing on open, invalidate stale requests on cleanup, render the selected interval’s cached total, and switch intervals locally. On Pay, call `prepareWorkspaceSubscriptionCheckout`, then `openProviderCheckout`, then the existing `onCheckoutOpened` callback. Preserve inline errors, opening state, and provider-switch removal.

- [ ] **Step 5: Run the dialog tests**

Run the same command. Expected: both dialog tests pass, including the no-provider-switch Paystack case.

### Task 4: Warm the shared pricing cache for all in-app billing entry points

**Files:**
- Modify: `src/app/ProductionApp.tsx:205-230` to prefetch pricing after a workspace is ready.
- Modify: `src/production-app-shell.test.tsx:470-555` to assert Settings uses pricing-only load and deferred checkout.
- Verify: `src/features/billing/SubscriptionRecoveryGate.tsx` continues using the same dialog and confirmation callback.

- [ ] **Step 1: Update the Settings regression before production code**

Add `loadProviderPricing` to the Settings billing mock. Assert `Pay $24` is available without `prepareProviderCheckout`; click Pay and assert preparation/opening still happen, then retain the existing real-time confirmation assertion returning Home.

- [ ] **Step 2: Run the Settings regression and verify red**

Run:

```powershell
npm test -- src/production-app-shell.test.tsx -t "confirms a Paddle payment started from Settings"
```

Expected: FAIL because the current dialog has no pricing-only path.

- [ ] **Step 3: Add non-blocking app prefetch**

Add a `ProductionApp` effect that runs when `sessionUser` and `workspace.artistWorkspaceId` exist and `loadProviderPricing` is available. Pass the workspace and its provider preference. Swallow only this background request’s error; the dialog remains responsible for displaying an actionable error.

- [ ] **Step 4: Run Settings and beta recovery tests**

Run:

```powershell
npm test -- src/production-app-shell.test.tsx -t "confirms a Paddle payment started from Settings"
npm test -- src/subscription-recovery-gate.test.tsx
```

Expected: Settings confirmation and all beta recovery tests pass.

### Task 5: Verify homogeneous billing behavior and finish

**Files:** Verify `src/app/ProductionApp.tsx`, `src/features/billing/SubscriptionPlanDialog.tsx`, `src/features/billing/SubscriptionRecoveryGate.tsx`, `src/features/billing/BetaAccessEndingNotice.tsx`, `src/features/settings/SettingsScreen.tsx`, `src/features/onboarding/FrontDoorScreens.tsx`, and `src/services/productionSupabase.ts`.

- [ ] **Step 1: Run the complete focused payment suite**

Run:

```powershell
npm test -- src/subscription-renewal-schema.test.ts src/subscription-recovery-gate.test.tsx src/subscription-plan-dialog.test.tsx src/paystack-paywall-contract.test.tsx src/paystack-fulfillment.test.ts src/paystack-customer-portal.test.ts src/payment-deployment-config.test.ts src/paddle-worker-schedule.test.ts src/paddle-paywall-ui.test.tsx src/paddle-checkout.test.ts src/paddle-billing-service.test.ts src/paddle-billing-security-contract.test.ts src/paddle-backend-contract.test.ts src/paddle-app-flow-contract.test.ts
```

Expected: all focused payment tests pass with zero failures.

- [ ] **Step 2: Run build and whitespace verification**

Run:

```powershell
npm run build
git diff --check
```

Expected: build exits 0 and whitespace check reports no errors; the existing Vite large-chunk warning may remain.

- [ ] **Step 3: Review and commit only implementation files**

Stage only the shared types/service, workspace helper, dialog/app changes, and their tests. Do not stage `.codex-recovery/`, `.playwright-cli/`, or `AGENTS.md`.

```powershell
git add -- src/types/productionApp.ts src/services/productionSupabase.ts src/features/billing/workspaceCheckout.ts src/features/billing/SubscriptionPlanDialog.tsx src/app/ProductionApp.tsx src/paddle-billing-service.test.ts src/subscription-plan-dialog.test.tsx src/production-app-shell.test.tsx src/subscription-recovery-gate.test.tsx
git diff --cached --check
git commit -m "fix: preload subscription pricing"
```

- [ ] **Step 4: Push and verify the remote**

```powershell
git push origin main
git status --short --branch
git rev-parse HEAD
git rev-parse origin/main
```

Expected: `HEAD` and `origin/main` match; only the pre-existing untracked user files remain.
