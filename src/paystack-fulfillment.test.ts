import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { validatePaystackTransaction } from "../supabase/functions/_shared/paystackFulfillment";

const checkout = {
  id: "checkout-1",
  amount_minor: 3_200_000,
  currency: "NGN",
  provider_price_id: "PLN_monthly",
  provider_plan_code: "PLN_monthly",
  interval: "monthly",
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

  it("routes recurring charges through the renewal ledger without setup", () => {
    const webhook = readFileSync(join(process.cwd(), "supabase", "functions", "paystack-webhook", "index.ts"), "utf8");

    expect(webhook).toContain("recordPaystackRenewal");
    expect(webhook).toContain('rpc("record_verified_subscription_renewal"');
    expect(webhook).toContain("mirrorSuccessfulInvoice");
    expect(webhook).toContain("shouldDispatchSetup");
    expect(webhook).toContain('setup.status !== "completed"');
  });

  it("lets Paystack collect the recurring plan with its supported subscription methods", () => {
    const initialize = readFileSync(join(process.cwd(), "supabase", "functions", "paystack-initialize-checkout", "index.ts"), "utf8");

    expect(initialize).toContain("plan: planCode");
    expect(initialize).not.toContain("channels:");
  });
});
