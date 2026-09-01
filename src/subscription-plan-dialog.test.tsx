import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SubscriptionPlanDialog } from "./features/billing/SubscriptionPlanDialog";
import type { ProductionBillingCheckoutPreview, ProductionBillingPricing, ProductionBillingService, ProductionWorkspace } from "./types/productionApp";

afterEach(cleanup);

describe("SubscriptionPlanDialog", () => {
  it("loads prices before creating checkout and keeps interval switching instant", async () => {
    const openProviderCheckout = vi.fn().mockResolvedValue(undefined);
    const loadProviderPricing = vi.fn().mockResolvedValue(pricing("paddle"));
    const prepareProviderCheckout = vi.fn().mockResolvedValue(preview("paddle", "yearly"));
    const billingService = { loadProviderPricing, prepareProviderCheckout, openProviderCheckout } as unknown as ProductionBillingService;

    render(<SubscriptionPlanDialog
      open
      onClose={vi.fn()}
      user={{ id: "user-1", email: "artist@example.com" }}
      workspace={workspace()}
      billingService={billingService}
    />);

    expect(await screen.findByRole("dialog", { name: "Choose a plan" })).toBeInTheDocument();
    await waitFor(() => expect(loadProviderPricing).toHaveBeenCalledWith(expect.objectContaining({
      existingWorkspace: expect.objectContaining({ artistWorkspaceId: "workspace-1" }),
      providerPreference: "auto",
    })));
    expect(prepareProviderCheckout).not.toHaveBeenCalled();
    expect(openProviderCheckout).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Pay $24" })).toBeEnabled();
    expect(screen.getByText("Secure recurring payment. Cancel from Billing.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Yearly" }));
    expect(await screen.findByRole("button", { name: "Pay $240" })).toBeEnabled();
    expect(prepareProviderCheckout).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Pay in USD" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pay in NGN" })).not.toBeInTheDocument();
    expect(openProviderCheckout).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Pay $240" }));
    await waitFor(() => expect(prepareProviderCheckout).toHaveBeenCalledWith(expect.objectContaining({
      existingWorkspace: expect.objectContaining({ artistWorkspaceId: "workspace-1" }),
      interval: "yearly",
      providerPreference: "auto",
    })));
    await waitFor(() => expect(openProviderCheckout).toHaveBeenCalledWith(expect.objectContaining({
      preview: expect.objectContaining({ provider: "paddle", interval: "yearly" }),
    })));
  });

  it("does not expose a provider switch when an existing Paystack preview is returned", async () => {
    const loadProviderPricing = vi.fn().mockResolvedValue(pricing("paystack"));
    render(<SubscriptionPlanDialog
      open
      onClose={vi.fn()}
      user={{ id: "user-1", email: "artist@example.com" }}
      workspace={workspace()}
      billingService={{ loadProviderPricing, prepareProviderCheckout: vi.fn(), openProviderCheckout: vi.fn() } as unknown as ProductionBillingService}
    />);

    expect(await screen.findByRole("button", { name: "Pay ₦32,000" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Pay in USD" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pay in NGN" })).not.toBeInTheDocument();
  });
});

function pricing(provider: "paddle" | "paystack"): ProductionBillingPricing {
  return provider === "paddle"
    ? {
        provider,
        productId: "pro_1",
        paddleConfig: { environment: "sandbox", clientToken: "test_abcdefghijklmnopqrstuvwxyz1" },
        intervalOptions: {
          monthly: { formattedTotal: "$24", priceId: "pri_month" },
          yearly: { formattedTotal: "$240", priceId: "pri_year" },
        },
      }
    : {
        provider,
        intervalOptions: {
          monthly: { amount: 32_000, amountMinor: 3_200_000, currency: "NGN" },
          yearly: { amount: 320_000, amountMinor: 32_000_000, currency: "NGN" },
        },
      };
}

function preview(provider: "paddle" | "paystack", interval: "monthly" | "yearly"): ProductionBillingCheckoutPreview {
  const yearly = interval === "yearly";
  return {
    checkoutSessionId: `${provider}-${interval}`,
    reference: `${provider}-${interval}`,
    provider,
    status: provider === "paystack" ? "initialized" : "open",
    artist: { spotifyArtistId: "spotify-1", name: "Sable Day", spotifyUrl: "https://open.spotify.com/artist/spotify-1", genres: [] },
    interval,
    ...(provider === "paddle"
      ? { formattedTotal: yearly ? "$240" : "$24", priceId: `pri_${interval}`, customData: { checkoutSessionId: `${provider}-${interval}` } }
      : { amount: yearly ? 320_000 : 32_000, amountMinor: yearly ? 32_000_000 : 3_200_000, currency: "NGN", authorizationUrl: "https://checkout.paystack.com/test" }),
  };
}

function workspace(): ProductionWorkspace {
  return {
    accountId: "account-1", artistWorkspaceId: "workspace-1", artistId: "artist-1",
    artistName: "Sable Day", workspaceName: "Sable Day Desk", status: "active",
    spotifyConnected: true, spotifyArtistId: "spotify-1", spotifyArtistName: "Sable Day",
    spotifyArtistUrl: "https://open.spotify.com/artist/spotify-1", contextComplete: true,
    entitlementActive: true, accessType: "private_beta", accessStatus: "active",
  };
}
