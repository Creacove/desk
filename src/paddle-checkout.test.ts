import { describe, expect, it, vi } from "vitest";
import {
  openPaddleCheckout,
  previewLocalizedPaddlePrice,
  resolveBillingProvider,
  validatePaddleClientConfig,
} from "./lib/paddleBilling";

describe("Paddle browser checkout", () => {
  it("fails closed when environment and client token disagree", () => {
    expect(() => validatePaddleClientConfig({ environment: "sandbox", clientToken: "live_abc" })).toThrow(/test_/);
    expect(() => validatePaddleClientConfig({ environment: "production", clientToken: "test_abc" })).toThrow(/live_/);
  });

  it("omits an unknown country and returns Paddle's formatted total unchanged", async () => {
    const PricePreview = vi.fn(async (input) => ({
      data: {
        address: { countryCode: "GB" },
        details: { lineItems: [{ price: { id: "pri_month" }, formattedTotals: { total: "£16.00" } }] },
      },
    }));
    const result = await previewLocalizedPaddlePrice({ PricePreview } as never, "pri_month");

    expect(PricePreview).toHaveBeenCalledWith({ items: [{ priceId: "pri_month", quantity: 1 }] });
    expect(result).toEqual({ priceId: "pri_month", formattedTotal: "£16.00", countryCode: "GB" });
  });

  it("passes a validated server country to Paddle preview", async () => {
    const PricePreview = vi.fn(async () => ({
      data: {
        address: { countryCode: "AU" },
        details: { lineItems: [{ price: { id: "pri_year" }, formattedTotals: { total: "A$300.00" } }] },
      },
    }));
    await previewLocalizedPaddlePrice({ PricePreview } as never, "pri_year", "AU");
    expect(PricePreview).toHaveBeenCalledWith({
      items: [{ priceId: "pri_year", quantity: 1 }],
      address: { countryCode: "AU" },
    });
  });

  it("routes Nigeria to Paystack including when Paddle detects it", () => {
    expect(resolveBillingProvider("NG")).toBe("paystack");
    expect(resolveBillingProvider(undefined, "NG")).toBe("paystack");
    expect(resolveBillingProvider("GB")).toBe("paddle");
  });

  it("opens the exact displayed price as a one-page overlay and prefills email", () => {
    const open = vi.fn();
    openPaddleCheckout({ Checkout: { open } } as never, {
      displayedPriceId: "pri_month",
      checkoutPriceId: "pri_month",
      email: "artist@example.com",
      customData: { version: 1, checkoutSessionId: "checkout-1", correlationToken: "token" },
    });
    expect(open).toHaveBeenCalledWith({
      items: [{ priceId: "pri_month", quantity: 1 }],
      customer: { email: "artist@example.com" },
      customData: { version: 1, checkoutSessionId: "checkout-1", correlationToken: "token" },
      settings: { displayMode: "overlay", variant: "one-page", successUrl: `${window.location.origin}/welcome` },
    });
  });

  it("refuses to open checkout when a stale preview shows another price", () => {
    expect(() => openPaddleCheckout({ Checkout: { open: vi.fn() } } as never, {
      displayedPriceId: "pri_month",
      checkoutPriceId: "pri_year",
      email: "artist@example.com",
      customData: {},
    })).toThrow(/refresh/i);
  });
});
