import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SubscriptionPlanDialog } from "./features/billing/SubscriptionPlanDialog";
import type { ProductionBillingCheckoutPreview, ProductionBillingService, ProductionWorkspace } from "./types/productionApp";

afterEach(cleanup);

describe("SubscriptionPlanDialog", () => {
  it("previews plans before opening checkout and supports interval and currency switching", async () => {
    const openProviderCheckout = vi.fn().mockResolvedValue(undefined);
    const prepareProviderCheckout = vi.fn(async ({ interval, providerPreference }: { interval: "monthly" | "yearly"; providerPreference: "auto" | "paddle" | "paystack" }) => {
      if (providerPreference === "paddle") return preview("paddle", interval);
      return preview("paystack", interval);
    });
    const billingService = { prepareProviderCheckout, openProviderCheckout } as unknown as ProductionBillingService;

    render(<SubscriptionPlanDialog
      open
      onClose={vi.fn()}
      user={{ id: "user-1", email: "artist@example.com" }}
      workspace={workspace()}
      billingService={billingService}
    />);

    expect(await screen.findByRole("dialog", { name: "Choose a plan" })).toBeInTheDocument();
    await waitFor(() => expect(prepareProviderCheckout).toHaveBeenCalledWith(expect.objectContaining({
      existingWorkspace: expect.objectContaining({ artistWorkspaceId: "workspace-1" }),
      interval: "monthly",
      providerPreference: "auto",
    })));
    expect(openProviderCheckout).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Pay ₦32,000" })).toBeEnabled();
    expect(screen.getByText("Secure recurring payment. Cancel from Billing.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Yearly" }));
    await waitFor(() => expect(prepareProviderCheckout).toHaveBeenCalledWith(expect.objectContaining({ interval: "yearly" })));
    expect(await screen.findByRole("button", { name: "Pay ₦320,000" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Pay in USD" }));
    await waitFor(() => expect(prepareProviderCheckout).toHaveBeenCalledWith(expect.objectContaining({
      interval: "yearly",
      providerPreference: "paddle",
    })));
    expect(await screen.findByRole("button", { name: "Pay $240" })).toBeEnabled();
    expect(openProviderCheckout).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Pay $240" }));
    await waitFor(() => expect(openProviderCheckout).toHaveBeenCalledWith(expect.objectContaining({
      preview: expect.objectContaining({ provider: "paddle", interval: "yearly" }),
    })));
  });
});

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
