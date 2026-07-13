import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PaywallPreviewScreen } from "./features/onboarding/OnboardingScreens";
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
  it("keeps paid checkout primary and reveals a separate invite-code form", async () => {
    const onSubscribe = vi.fn();
    const onRedeemPrivateBeta = vi.fn().mockResolvedValue(undefined);
    render(
      <PaywallPreviewScreen
        preview={preview}
        onSubscribe={onSubscribe}
        onRedeemPrivateBeta={onRedeemPrivateBeta}
        privateBetaEnabled
        onBack={() => undefined}
      />,
    );

    expect(screen.getByRole("button", { name: /subscribe \$20\/month/i })).toBeInTheDocument();
    expect(screen.queryByLabelText("Private-beta access code")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /have a private-beta code/i }));
    fireEvent.change(screen.getByLabelText("Private-beta access code"), { target: { value: "beta-abcd-1234" } });
    fireEvent.click(screen.getByRole("button", { name: /activate beta access/i }));

    await waitFor(() => expect(onRedeemPrivateBeta).toHaveBeenCalledWith("BETA-ABCD-1234"));
    expect(onSubscribe).not.toHaveBeenCalled();
    expect(screen.getByText(/no card is required/i)).toBeInTheDocument();
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
