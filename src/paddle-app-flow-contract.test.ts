import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const app = () => readFileSync(join(process.cwd(), "src", "app", "ProductionApp.tsx"), "utf8");

describe("Paddle app flow contract", () => {
  it("keeps interval selection local and prepares the selected checkout only on subscribe", () => {
    const text = app();
    expect(text).toContain("prepareProviderCheckout");
    expect(text).toContain("pricingRequestRef");
    expect(text).toContain("requestId !== pricingRequestRef.current");
    expect(text).toContain("onIntervalChange={changeBillingInterval}");
    expect(text).toContain('async function subscribeToPreview(interval: "monthly" | "yearly")');
    expect(text).toContain("checkoutPreview.interval !== interval");
    expect(text).toContain("setSelectedBillingInterval(interval)");
    expect(text).toContain('useState<ProductionBillingProviderPreference>("auto")');
    expect(text).toContain("providerPreference: billingProviderPreference");
    expect(text).toContain("onProviderChange={changeBillingProvider}");
  });

  it("opens the provider checkout through the billing service", () => {
    const text = app();
    expect(text).toContain("openProviderCheckout");
  });

  it("treats the Paddle session-storage checkout id only as a welcome lookup hint", () => {
    const text = app();
    expect(text).toContain('window.location.pathname === "/welcome"');
    expect(text).toContain('sessionStorage.getItem("ordersounds.paddleCheckoutSessionId")');
    expect(text).toContain("checkoutSessionId: pointer.slice");
  });
});
