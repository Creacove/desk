import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";

const { paddle, getPaddle } = vi.hoisted(() => {
  const instance = {
    PricePreview: vi.fn(async ({ items }: any) => ({
      data: { address: { countryCode: "GB" }, details: { lineItems: [{ price: { id: items[0].priceId }, formattedTotals: { total: "£16.00" } }] } },
    })),
    Checkout: { open: vi.fn() },
  };
  return { paddle: instance, getPaddle: vi.fn(async () => instance) };
});

vi.mock("./lib/paddleBilling", async () => {
  const actual = await vi.importActual<typeof import("./lib/paddleBilling")>("./lib/paddleBilling");
  return { ...actual, getPaddle };
});

import { createSupabaseBillingService } from "./services/productionSupabase";

const user = { id: "user-1", email: "artist@example.com" };
const candidate = { spotifyArtistId: "artist-1", name: "Sable Day", spotifyUrl: "https://open.spotify.com/artist/artist-1", genres: [] };
const pricing = {
  paddle: { environment: "sandbox", clientToken: "test_abcdefghijklmnopqrstuvwxyz1", productId: "pro_1", priceId: { monthly: "pri_month", yearly: "pri_year" } },
  paystack: { currency: "NGN", planCode: { monthly: "PLN_month", yearly: "PLN_year" }, amountMinor: { monthly: 3_000_000, yearly: 30_000_000 } },
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  sessionStorage.clear();
});

describe("provider-aware billing service", () => {
  it("does not reconstruct a Paddle checkout after its one-time correlation token is gone", async () => {
    const client = { functions: { invoke: async () => ({ data: { preview: {
      checkoutSessionId: "checkout-old", reference: "checkout-old", provider: "paddle", status: "open",
      artist: candidate, interval: "monthly", productId: "pro_1", priceId: "pri_month",
    } }, error: null }) } } as unknown as SupabaseClient;
    await expect(createSupabaseBillingService(client).loadLatestCheckoutPreview!()).resolves.toBeNull();
  });

  it("routes a server-detected Nigerian visitor to canonical Paystack yearly checkout", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ countryCode: "NG" }))));
    const calls: Array<{ name: string; body: any }> = [];
    const client = { functions: { invoke: async (name: string, options?: { body?: any }) => {
      calls.push({ name, body: options?.body });
      if (name === "billing-pricing-config") return { data: pricing, error: null };
      return { data: { checkoutSessionId: "checkout-ng", reference: "ors_ng", status: "initialized", artist: candidate, amount: 300000, amountMinor: 30000000, currency: "NGN", interval: "yearly", authorizationUrl: "https://checkout.paystack.test/ng" }, error: null };
    } } } as unknown as SupabaseClient;

    const preview = await createSupabaseBillingService(client).prepareProviderCheckout!({ user, candidate, interval: "yearly" });
    expect(preview.provider).toBe("paystack");
    expect(calls.at(-1)).toEqual({
      name: "paystack-initialize-checkout",
      body: expect.objectContaining({
        selectedArtist: candidate,
        interval: "yearly",
        clientRequestId: expect.stringMatching(/^[0-9a-f-]{36}$/i),
      }),
    });
    expect(getPaddle).not.toHaveBeenCalled();
  });

  it("lets a Nigerian visitor explicitly prepare canonical Paddle checkout", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ countryCode: "NG" }))));
    const calls: Array<{ name: string; body: any }> = [];
    const client = { functions: { invoke: async (name: string, options?: { body?: any }) => {
      calls.push({ name, body: options?.body });
      if (name === "billing-pricing-config") return { data: pricing, error: null };
      if (name === "paddle-create-checkout") {
        return { data: {
          checkoutSessionId: "checkout-ng-usd", productId: "pro_1", priceId: "pri_month", interval: "monthly",
          expiresAt: "2026-07-16T18:00:00Z",
          customData: { version: 1, checkoutSessionId: "checkout-ng-usd", correlationToken: "secret" },
        }, error: null };
      }
      throw new Error(`Unexpected function: ${name}`);
    } } } as unknown as SupabaseClient;

    const preview = await createSupabaseBillingService(client).prepareProviderCheckout!({
      user,
      candidate,
      interval: "monthly",
      providerPreference: "paddle",
    });

    expect(preview).toMatchObject({ provider: "paddle", checkoutSessionId: "checkout-ng-usd", priceId: "pri_month" });
    expect(calls.map((call) => call.name)).toContain("paddle-create-checkout");
    expect(calls.map((call) => call.name)).not.toContain("paystack-initialize-checkout");
  });

  it("uses Paddle IP detection when the server country is absent and preserves its total", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}")));
    const client = { functions: { invoke: async (name: string) => {
      if (name === "billing-pricing-config") return { data: pricing, error: null };
      return { data: { checkoutSessionId: "checkout-gb", productId: "pro_1", priceId: "pri_month", interval: "monthly", expiresAt: "2026-07-14T18:00:00Z", customData: { version: 1, checkoutSessionId: "checkout-gb", correlationToken: "secret" } }, error: null };
    } } } as unknown as SupabaseClient;

    const preview = await createSupabaseBillingService(client).prepareProviderCheckout!({ user, candidate, interval: "monthly" });
    expect(preview).toMatchObject({ provider: "paddle", formattedTotal: "£16.00", priceId: "pri_month", interval: "monthly" });
  });

  it("stores only the checkout hint before opening Paddle for the signed-in email", async () => {
    const service = createSupabaseBillingService({} as SupabaseClient);
    await service.openProviderCheckout!({ user, preview: {
      checkoutSessionId: "checkout-gb", reference: "checkout-gb", provider: "paddle", status: "open",
      artist: candidate, interval: "monthly", formattedTotal: "£16.00", productId: "pro_1", priceId: "pri_month",
      paddleConfig: { environment: "sandbox", clientToken: "test_abcdefghijklmnopqrstuvwxyz1" },
      customData: { version: 1, checkoutSessionId: "checkout-gb", correlationToken: "raw-once" },
    } });

    expect(sessionStorage.getItem("ordersounds.paddleCheckoutSessionId")).toBe("checkout-gb");
    expect(paddle.Checkout.open).toHaveBeenCalledWith(expect.objectContaining({
      customer: { email: "artist@example.com" },
      items: [{ priceId: "pri_month", quantity: 1 }],
    }));
  });

  it("passes the Paddle checkout session id to billing status", async () => {
    const calls: Array<{ name: string; body: unknown }> = [];
    const client = { functions: { invoke: async (name: string, options?: { body?: unknown }) => {
      calls.push({ name, body: options?.body });
      return { data: {
        checkoutSessionId: "checkout-paddle",
        checkoutStatus: "paid",
        subscriptionStatus: "active",
        entitlementActive: true,
        setupStatus: "running",
      }, error: null };
    } } } as unknown as SupabaseClient;

    await createSupabaseBillingService(client).loadBillingStatus({ checkoutSessionId: "checkout-paddle" });

    expect(calls).toEqual([{
      name: "billing-status",
      body: { checkoutSessionId: "checkout-paddle" },
    }]);
  });

  it("rejects an unexpected customer portal origin", async () => {
    const client = { functions: { invoke: async () => ({ data: { url: "https://evil.example/session" }, error: null }) } } as unknown as SupabaseClient;
    await expect(createSupabaseBillingService(client).openCustomerPortal!({ artistWorkspaceId: "workspace-1" } as any))
      .rejects.toThrow(/unexpected/i);
  });
});
