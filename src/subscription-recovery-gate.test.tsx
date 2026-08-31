import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SubscriptionRecoveryGate } from "./features/billing/SubscriptionRecoveryGate";
import type { ProductionBillingService, ProductionWorkspace } from "./types/productionApp";

const user = { id: "user-1", email: "artist@example.com" };

function workspace(overrides: Partial<ProductionWorkspace> = {}): ProductionWorkspace {
  return {
    accountId: "account-1",
    artistWorkspaceId: "workspace-1",
    artistId: "artist-1",
    artistName: "Sable Day",
    workspaceName: "Sable Day Desk",
    status: "active",
    spotifyConnected: true,
    spotifyArtistId: "spotify-1",
    spotifyArtistUrl: "https://open.spotify.com/artist/spotify-1",
    spotifyImageUrl: "https://images.example/sable.jpg",
    contextComplete: true,
    entitlementActive: false,
    accessType: "paid_subscription",
    accessStatus: "expired",
    billingProvider: "paddle",
    billingInterval: "yearly",
    ...overrides,
  };
}

describe("subscription recovery gate", () => {
  it("locks an expired paid workspace and reuses its provider and interval", async () => {
    const preview = {
      checkoutSessionId: "checkout-2",
      reference: "checkout-2",
      provider: "paddle" as const,
      status: "open" as const,
      artist: { spotifyArtistId: "spotify-1", name: "Sable Day", spotifyUrl: "https://open.spotify.com/artist/spotify-1", genres: [] },
      interval: "yearly" as const,
    };
    const prepareProviderCheckout = vi.fn().mockResolvedValue(preview);
    const openProviderCheckout = vi.fn().mockResolvedValue(undefined);
    const billingService = { prepareProviderCheckout, openProviderCheckout } as ProductionBillingService;

    render(<SubscriptionRecoveryGate user={user} workspace={workspace()} billingService={billingService} onRecovered={vi.fn()} onSignOut={vi.fn()} />);

    expect(screen.getByRole("dialog", { name: "Subscription expired" })).toBeTruthy();
    expect(screen.getByText(/everything is saved exactly where you left it/i)).toBeTruthy();
    expect(screen.getByTestId("locked-workspace-backdrop").getAttribute("aria-hidden")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Restore access" }));
    await waitFor(() => expect(openProviderCheckout).toHaveBeenCalledWith({ user, preview }));
    expect(prepareProviderCheckout).toHaveBeenCalledWith(expect.objectContaining({
      existingWorkspace: expect.objectContaining({ artistWorkspaceId: "workspace-1" }),
      providerPreference: "paddle",
      interval: "yearly",
    }));
  });

  it("opens plan selection for expired beta access without another code", async () => {
    const prepareProviderCheckout = vi.fn().mockResolvedValue({
      checkoutSessionId: "checkout-beta", reference: "checkout-beta", provider: "paystack", status: "initialized",
      artist: { spotifyArtistId: "spotify-1", name: "Sable Day", spotifyUrl: "https://open.spotify.com/artist/spotify-1", genres: [] },
      interval: "monthly", amount: 32_000, currency: "NGN", authorizationUrl: "https://checkout.paystack.com/test",
    });
    const openProviderCheckout = vi.fn();
    render(<SubscriptionRecoveryGate
      user={user}
      workspace={workspace({ accessType: "private_beta", billingProvider: undefined, billingInterval: undefined })}
      billingService={{ prepareProviderCheckout, openProviderCheckout } as unknown as ProductionBillingService}
      onRecovered={vi.fn()}
      onSignOut={vi.fn()}
    />);

    expect(screen.getByRole("dialog", { name: "Your beta access has ended" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Choose a plan" }));
    expect(await screen.findByRole("dialog", { name: "Choose a plan" })).toBeTruthy();
    expect(openProviderCheckout).not.toHaveBeenCalled();
    expect(screen.queryByText(/access code/i)).toBeNull();
  });
});
