import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ensurePaystackCardSubscription, validatePaystackTransaction } from "../supabase/functions/_shared/paystackFulfillment";

const checkout = {
  id: "checkout-1",
  amount_minor: 3_200_000,
  currency: "NGN",
  provider_price_id: "PLN_monthly",
  provider_plan_code: "PLN_monthly",
  interval: "monthly",
};

afterEach(() => vi.unstubAllGlobals());

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

  it("collects a reusable card for recurring subscription checkout", () => {
    const initialize = readFileSync(join(process.cwd(), "supabase", "functions", "paystack-initialize-checkout", "index.ts"), "utf8");

    expect(initialize).toContain('channels: ["card"]');
    expect(initialize).not.toContain("plan: planCode");
  });

  it("creates renewal only after the first card payment returns a reusable authorization", async () => {
    const update = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }));
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ status: true, data: { subscription_code: "SUB_created" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await ensurePaystackCardSubscription({
      db: { from: vi.fn(() => ({ update })) },
      checkout,
      transaction: transaction({
        subscription: undefined,
        plan: undefined,
        paid_at: "2026-08-31T12:00:00.000Z",
        authorization: { channel: "card", reusable: true, authorization_code: "AUTH_card" },
      }),
      secretKey: "sk_test_secret",
    });

    expect(result).toMatchObject({
      subscription_code: "SUB_created",
      period_start: "2026-08-31T12:00:00.000Z",
      period_end: "2026-09-30T12:00:00.000Z",
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      customer: "CUS_customer",
      plan: "PLN_monthly",
      authorization: "AUTH_card",
      start_date: "2026-09-30T12:00:00.000Z",
    });
    expect(update).toHaveBeenCalledWith({ provider_subscription_code: "SUB_created" });
  });
});
