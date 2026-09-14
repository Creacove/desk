import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PaywallPreviewScreen } from "./features/onboarding/FrontDoorScreens";
import { createSupabaseAuthAdapter, createSupabaseBillingService } from "./services/productionSupabase";

const preview = {
  checkoutSessionId: "checkout-1",
  reference: "ors_123",
  status: "open" as const,
  artist: {
    spotifyArtistId: "artist-1",
    name: "Sable Day",
    spotifyUrl: "https://open.spotify.com/artist/artist-1",
    genres: [],
  },
  amount: 20,
  amountMinor: 2000,
  currency: "USD",
  interval: "monthly" as const,
};

afterEach(cleanup);

describe("private-beta product flow", () => {
  it("hides the beta affordance when private beta is disabled", () => {
    const onSubscribe = vi.fn();
    render(
      <PaywallPreviewScreen
        preview={preview}
        onSubscribe={onSubscribe}
        onBack={() => undefined}
        privateBetaEnabled={false}
        onRedeemPrivateBeta={() => undefined}
      />,
    );

    expect(screen.getByRole("button", { name: /start my desk/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "BETA" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/beta code|access code/i)).not.toBeInTheDocument();
  });

  it("restores the historical beta form behind the faint BETA trigger", () => {
    const onRedeemPrivateBeta = vi.fn().mockResolvedValue(undefined);
    render(
      <PaywallPreviewScreen
        preview={preview}
        onSubscribe={() => undefined}
        onBack={() => undefined}
        privateBetaEnabled
        onRedeemPrivateBeta={onRedeemPrivateBeta}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "BETA" }));

    expect(screen.getByPlaceholderText("Access code")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /activate access/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start my desk/i })).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Access code"), { target: { value: " beta-abcd-1234 " } });
    fireEvent.click(screen.getByRole("button", { name: /activate access/i }));

    expect(onRedeemPrivateBeta).toHaveBeenCalledWith("BETA-ABCD-1234");
  });

  it("invokes the isolated beta endpoint without changing paid service methods", async () => {
    const calls: Array<{ name: string; body: unknown }> = [];
    const client = {
      functions: {
        invoke: vi.fn(async (name: string, options: { body: unknown }) => {
          calls.push({ name, body: options.body });
          return {
            data: {
              workspace: {
                accountId: "account-1",
                artistWorkspaceId: "workspace-1",
                artistId: "artist-1",
                artistName: "Sable Day",
                workspaceName: "Sable Day Desk",
                status: "setup",
                spotifyConnected: true,
                contextComplete: false,
                entitlementActive: true,
                accessType: "private_beta",
                accessStatus: "active",
                accessEndsAt: "2026-08-12T00:00:00.000Z",
              },
              setupStatus: "running",
              accessEndsAt: "2026-08-12T00:00:00.000Z",
            },
            error: null,
          };
        }),
      },
    } as unknown as SupabaseClient;

    const result = await createSupabaseBillingService(client).redeemPrivateBetaCode!({
      checkoutSessionId: "checkout-1",
      code: "BETA-ABCD-1234",
    });

    expect(calls).toEqual([{ name: "redeem-private-beta-code", body: { checkoutSessionId: "checkout-1", code: "BETA-ABCD-1234" } }]);
    expect(result.workspace.accessType).toBe("private_beta");
    expect(result.workspace.billingCheckoutSessionId).toBe("checkout-1");
  });

  it("supports request and completion of password recovery", async () => {
    const resetPasswordForEmail = vi.fn().mockResolvedValue({ error: null });
    const updateUser = vi.fn().mockResolvedValue({ error: null });
    const client = { auth: { resetPasswordForEmail, updateUser } } as unknown as SupabaseClient;
    const auth = createSupabaseAuthAdapter(client);

    await auth.requestPasswordReset!({ email: "artist@example.com", redirectTo: "https://app.ordersounds.com/update-password" });
    await auth.updatePassword!({ password: "a-secure-new-password" });

    expect(resetPasswordForEmail).toHaveBeenCalledWith("artist@example.com", { redirectTo: "https://app.ordersounds.com/update-password" });
    expect(updateUser).toHaveBeenCalledWith({ password: "a-secure-new-password" });
  });
});
