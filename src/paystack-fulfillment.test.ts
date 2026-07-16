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
