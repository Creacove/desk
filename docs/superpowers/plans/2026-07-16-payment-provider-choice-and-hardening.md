# Payment Provider Choice and Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an explicit Nigerian USD/Paddle checkout choice, restore exact Paystack verification, and document the final payment security posture.

**Architecture:** Country detection remains the automatic default. A typed, in-memory provider preference selects the existing Paystack or Paddle server checkout boundary, while both providers continue through signed webhooks and atomic fulfillment. Paystack verification fails closed on status, amount, currency, reference, and any returned plan code.

**Tech Stack:** React 18, TypeScript 5, Vitest, Paddle.js, Paystack API, Supabase Edge Functions (Deno), PostgreSQL RPC

---

## File map

- Modify `src/types/productionApp.ts`: add the provider-preference contract to checkout preparation.
- Modify `src/lib/paddleBilling.ts`: validate and resolve explicit provider preferences.
- Modify `src/services/productionSupabase.ts`: honor the provider preference while retaining canonical server pricing.
- Modify `src/app/ProductionApp.tsx`: keep the provider preference in paywall interaction state and preserve it across interval changes.
- Modify `src/features/onboarding/OnboardingScreens.tsx`: render the Nigerian USD secondary action.
- Modify `supabase/functions/_shared/paystackFulfillment.ts`: require exact verified Paystack transaction values while preserving the existing `p_scheduled_change_action: "none"` worktree change.
- Modify `src/paddle-checkout.test.ts`: cover provider-preference validation.
- Modify `src/paddle-billing-service.test.ts`: cover explicit Paddle routing from Nigeria.
- Modify `src/paddle-paywall-ui.test.tsx`: cover the USD action and its visibility rules.
- Modify `src/paddle-app-flow-contract.test.ts`: cover provider preference propagation through the app.
- Create `src/paystack-fulfillment.test.ts`: unit-test exact Paystack fulfillment validation.
- Create `security_best_practices_report.md`: record payment findings, fixes, and remaining live-mode checks.

### Task 1: Restore exact Paystack verification

**Files:**
- Create: `src/paystack-fulfillment.test.ts`
- Modify: `supabase/functions/_shared/paystackFulfillment.ts`

- [ ] **Step 1: Write failing validator tests**

Create `src/paystack-fulfillment.test.ts` with direct tests of the pure validator:

```ts
import { describe, expect, it } from "vitest";
import { validatePaystackTransaction } from "../supabase/functions/_shared/paystackFulfillment";

const checkout = {
  amount_minor: 3_200_000,
  currency: "NGN",
  provider_price_id: "PLN_monthly",
};

function transaction(overrides: Record<string, unknown> = {}) {
  return {
    status: "success",
    amount: 3_200_000,
    currency: "NGN",
    reference: "ors_reference",
    customer: { customer_code: "CUS_customer", email: "artist@example.com" },
    subscription: { subscription_code: "SUB_subscription" },
    plan: { plan_code: "PLN_monthly" },
    ...overrides,
  };
}

describe("Paystack verified transaction boundary", () => {
  it("accepts the exact successful canonical transaction", () => {
    expect(validatePaystackTransaction(checkout, transaction())).toMatchObject({
      amountMinor: 3_200_000,
      currency: "NGN",
      transactionId: "ors_reference",
      subscriptionId: "SUB_subscription",
    });
  });

  it.each([3_199_999, 3_200_001])("rejects any amount mismatch: %s", (amount) => {
    expect(() => validatePaystackTransaction(checkout, transaction({ amount }))).toThrow(/amount/i);
  });

  it("requires an explicit successful status", () => {
    expect(() => validatePaystackTransaction(checkout, transaction({ status: "" }))).toThrow(/successful/i);
  });

  it("rejects currency and returned plan mismatches", () => {
    expect(() => validatePaystackTransaction(checkout, transaction({ currency: "USD" }))).toThrow(/currency/i);
    expect(() => validatePaystackTransaction(checkout, transaction({ plan: { plan_code: "PLN_other" } }))).toThrow(/plan/i);
  });
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `npm test -- src/paystack-fulfillment.test.ts`

Expected: FAIL because the current validator accepts one-kobo mismatches, an empty status, and a returned mismatched plan.

- [ ] **Step 3: Implement the minimal strict validator**

In `validatePaystackTransaction`:

```ts
const status = String(transaction.status ?? "").toLowerCase();
if (!["success", "successful"].includes(status)) {
  throw new Error("Paystack transaction is not successful.");
}

const amountMinor = Number(transaction.amount);
const expectedAmount = Number(checkout.amount_minor);
if (!Number.isSafeInteger(amountMinor) || amountMinor !== expectedAmount) {
  throw new Error(`Paystack amount ${amountMinor} did not match checkout session ${expectedAmount}.`);
}

const expectedPlanCode = String(checkout.provider_price_id ?? checkout.provider_plan_code ?? "").trim();
const returnedPlanCode = String(transaction.plan_code ?? transaction.plan?.plan_code ?? "").trim();
if (returnedPlanCode && returnedPlanCode !== expectedPlanCode) {
  throw new Error("Paystack plan did not match checkout session.");
}
```

Keep the existing user-owned line `p_scheduled_change_action: "none"` unchanged.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm test -- src/paystack-fulfillment.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the isolated Paystack hardening**

```bash
git add src/paystack-fulfillment.test.ts supabase/functions/_shared/paystackFulfillment.ts
git commit -m "security: require exact Paystack transaction verification"
```

### Task 2: Add a validated provider preference

**Files:**
- Modify: `src/types/productionApp.ts`
- Modify: `src/lib/paddleBilling.ts`
- Modify: `src/paddle-checkout.test.ts`
- Modify: `src/paddle-billing-service.test.ts`
- Modify: `src/services/productionSupabase.ts`

- [ ] **Step 1: Write failing provider-resolution tests**

Extend `src/paddle-checkout.test.ts`:

```ts
it("lets an explicit Paddle choice override Nigerian auto-routing", () => {
  expect(resolveBillingProvider("NG", undefined, "auto")).toBe("paystack");
  expect(resolveBillingProvider("NG", undefined, "paddle")).toBe("paddle");
  expect(() => resolveBillingProvider("NG", undefined, "invalid" as never)).toThrow(/provider/i);
});
```

Extend `src/paddle-billing-service.test.ts` with a Nigerian explicit-Paddle case that stubs `/api/billing-country` to return `NG`, calls:

```ts
await service.prepareProviderCheckout!({
  user,
  candidate,
  interval: "monthly",
  providerPreference: "paddle",
});
```

and asserts the final function invocation is `paddle-create-checkout`, the preview provider is `paddle`, and `paystack-initialize-checkout` was not called.

- [ ] **Step 2: Run the tests and verify RED**

Run: `npm test -- src/paddle-checkout.test.ts src/paddle-billing-service.test.ts`

Expected: TypeScript/test failures because the preference parameter and service input do not exist.

- [ ] **Step 3: Add the type and resolver**

In `src/types/productionApp.ts` add:

```ts
export type ProductionBillingProviderPreference = "auto" | "paddle" | "paystack";
```

and add `providerPreference?: ProductionBillingProviderPreference` to `prepareProviderCheckout`.

In `src/lib/paddleBilling.ts`, extend `resolveBillingProvider`:

```ts
export type BillingProviderPreference = "auto" | BillingProvider;

export function resolveBillingProvider(
  serverCountryCode?: string,
  paddleCountryCode?: string,
  preference: BillingProviderPreference = "auto",
): BillingProvider {
  if (!(["auto", "paddle", "paystack"] as const).includes(preference)) {
    throw new Error("Billing provider preference is invalid.");
  }
  if (preference !== "auto") return preference;
  const serverCountry = normalizeCountryCode(serverCountryCode);
  const paddleCountry = normalizeCountryCode(paddleCountryCode);
  return (serverCountry ?? paddleCountry) === "NG" ? "paystack" : "paddle";
}
```

- [ ] **Step 4: Route through canonical provider functions**

Update `prepareProviderCheckout` to accept `providerPreference = "auto"`. Resolve the initial provider before Paddle initialization. If it is Paystack, call `initializePaystackCheckout`. If it is Paddle, use the existing pricing config, Paddle price preview, and `paddle-create-checkout`. Only allow the localized Paddle country to fall back to Paystack when the preference remains `auto`.

Do not accept product IDs, price IDs, amounts, or currencies from the caller.

- [ ] **Step 5: Run the focused tests and verify GREEN**

Run: `npm test -- src/paddle-checkout.test.ts src/paddle-billing-service.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit provider resolution**

```bash
git add src/types/productionApp.ts src/lib/paddleBilling.ts src/services/productionSupabase.ts src/paddle-checkout.test.ts src/paddle-billing-service.test.ts
git commit -m "feat: support explicit billing provider choice"
```

### Task 3: Add the Nigerian USD paywall action

**Files:**
- Modify: `src/paddle-paywall-ui.test.tsx`
- Modify: `src/features/onboarding/OnboardingScreens.tsx`

- [ ] **Step 1: Write failing paywall tests**

Add tests that render a Paystack preview with `currency: "NGN"` and assert:

```ts
const onProviderChange = vi.fn();
expect(screen.getByRole("button", { name: "Pay in USD with an international card" })).toBeInTheDocument();
fireEvent.click(screen.getByRole("button", { name: "Pay in USD with an international card" }));
expect(onProviderChange).toHaveBeenCalledWith("paddle");
```

Add a second test rendering a Paddle preview and assert the USD action is absent.

- [ ] **Step 2: Run the UI test and verify RED**

Run: `npm test -- src/paddle-paywall-ui.test.tsx`

Expected: FAIL because the callback and action do not exist.

- [ ] **Step 3: Add the presentation-only callback and action**

Add this optional prop:

```ts
onProviderChange?: (provider: "paddle" | "paystack") => void | Promise<void>;
```

After the primary subscription button, render only when `preview.provider === "paystack" && preview.currency === "NGN"`:

```tsx
<button
  type="button"
  onClick={() => void onProviderChange?.("paddle")}
  disabled={pending}
  className="mt-2 w-full text-center text-[10px] font-bold text-muted-foreground underline decoration-foreground/20 underline-offset-4 transition-colors hover:text-foreground disabled:opacity-50 lg:text-[11px]"
>
  Pay in USD with an international card
</button>
```

- [ ] **Step 4: Run the UI test and verify GREEN**

Run: `npm test -- src/paddle-paywall-ui.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit the paywall UI**

```bash
git add src/paddle-paywall-ui.test.tsx src/features/onboarding/OnboardingScreens.tsx
git commit -m "feat: add Nigerian USD checkout choice"
```

### Task 4: Preserve the choice across paywall pricing changes

**Files:**
- Modify: `src/paddle-app-flow-contract.test.ts`
- Modify: `src/app/ProductionApp.tsx`

- [ ] **Step 1: Write the failing app-flow contract**

Extend the existing contract test to require:

```ts
expect(text).toContain('useState<ProductionBillingProviderPreference>("auto")');
expect(text).toContain("providerPreference: billingProviderPreference");
expect(text).toContain("onProviderChange={changeBillingProvider}");
```

- [ ] **Step 2: Run the app-flow test and verify RED**

Run: `npm test -- src/paddle-app-flow-contract.test.ts`

Expected: FAIL because provider preference is not tracked or passed.

- [ ] **Step 3: Implement in-memory orchestration**

Import `ProductionBillingProviderPreference`, add:

```ts
const [billingProviderPreference, setBillingProviderPreference] =
  useState<ProductionBillingProviderPreference>("auto");
```

Reset it to `auto` when selecting a new artist or returning to search. Pass it to both initial and interval checkout preparation.

Add `changeBillingProvider(provider)` using the same request ID, pending, error, candidate, interval, and workspace safeguards as `changeBillingInterval`. Set the preference only after the replacement preview succeeds, then pass it as `onProviderChange` to `PaywallPreviewScreen`.

- [ ] **Step 4: Run app and payment tests and verify GREEN**

Run: `npm test -- src/paddle-app-flow-contract.test.ts src/paddle-paywall-ui.test.tsx src/paddle-billing-service.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit orchestration**

```bash
git add src/paddle-app-flow-contract.test.ts src/app/ProductionApp.tsx
git commit -m "feat: preserve checkout provider preference"
```

### Task 5: Record the payment security audit

**Files:**
- Create: `security_best_practices_report.md`

- [ ] **Step 1: Write the evidence-based report**

Create the report with:

- executive summary;
- `PAY-001` High: Paystack amount tolerance, its access impact, exact file/line evidence, and the strict fix;
- `PAY-002` Medium: Paddle sandbox default payment link and subdomain were missing, dashboard evidence, and corrected state;
- `PAY-003` Low: CSP is report-only, with the current Netlify file location and a staged enforcement recommendation after checkout observation;
- confirmed controls: raw-body webhook signatures, durable Paddle queue, service-only atomic fulfillment, HTTPS destination validation, server-owned pricing, and entitlement checks;
- live-mode checklist that explicitly separates sandbox and live Paddle assets.

Do not include secrets, secret digests, customer data, or full browser/session identifiers.

- [ ] **Step 2: Verify report evidence and commit**

Run: `rg -n "PAY-001|PAY-002|PAY-003|supabase/functions/_shared/paystackFulfillment.ts|netlify.toml" security_best_practices_report.md`

Expected: all three findings and their evidence locations are present.

```bash
git add security_best_practices_report.md
git commit -m "docs: record payment security audit"
```

### Task 6: Verify the complete payment system

**Files:**
- Verify only; modify earlier files only if a failing test exposes a requirement gap.

- [ ] **Step 1: Run focused payment tests**

Run:

```bash
npm test -- src/paystack-fulfillment.test.ts src/paystack-paywall-contract.test.tsx src/paddle-checkout.test.ts src/paddle-billing-service.test.ts src/paddle-paywall-ui.test.tsx src/paddle-backend-contract.test.ts src/paddle-billing-security-contract.test.ts src/paddle-app-flow-contract.test.ts src/payment-deployment-config.test.ts
```

Expected: all focused tests pass with zero failures.

- [ ] **Step 2: Run the full test suite**

Run: `npm test`

Expected: all test files pass with zero failures.

- [ ] **Step 3: Build the production bundle**

Run: `npm run build`

Expected: Vite exits 0 and produces `dist` without TypeScript/build errors.

- [ ] **Step 4: Recheck dependency security**

Run: `npm audit --omit=dev --audit-level=high`

Expected: zero high or critical production dependency vulnerabilities.

- [ ] **Step 5: Inspect the final diff**

Run: `git status --short && git diff HEAD~4 --check`

Expected: no whitespace errors; only planned payment files and the pre-existing preserved Paystack line are present.

- [ ] **Step 6: Browser smoke test**

On `https://desk.ordersounds.com` with an unpaid Nigerian test account:

1. confirm Paystack/NGN is the default;
2. select `Pay in USD with an international card`;
3. confirm the displayed preview changes to Paddle pricing;
4. open Paddle sandbox checkout;
5. confirm the checkout form loads with the Test Mode indicator and no generic error;
6. stop before submitting a payment unless the user chooses to complete the sandbox test payment.

- [ ] **Step 7: Final handoff**

Report the exact test/build results, link the security report, identify the remaining live Paddle account setup, and note that no live payment was submitted.
