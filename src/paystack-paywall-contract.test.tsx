import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PaywallPreviewScreen } from "./features/onboarding/OnboardingScreens";
import { createSupabaseBillingService } from "./services/productionSupabase";
import type { ProductionSpotifyArtistCandidate, ProductionUser } from "./types/productionApp";

const candidate: ProductionSpotifyArtistCandidate = {
  spotifyArtistId: "spotify-artist-1",
  name: "Sable Day",
  spotifyUrl: "https://open.spotify.com/artist/spotify-artist-1",
  spotifyUri: "spotify:artist:spotify-artist-1",
  followers: 25000,
  genres: ["alt-pop", "indie soul", "lagos"],
  imageUrl: "https://i.scdn.co/image/artist",
};

const user: ProductionUser = {
  id: "user-1",
  email: "artist@example.com",
};

afterEach(() => {
  cleanup();
});

describe("Paystack paywall contract", () => {
  it("creates a checkout preview without creating a workspace or connecting Spotify", async () => {
    const calls: Array<{ name: string; body: unknown }> = [];
    const client = {
      functions: {
        invoke: async (name: string, options: { body: unknown }) => {
          calls.push({ name, body: options.body });
          return {
            data: {
              checkoutSessionId: "checkout-1",
              reference: "ors_123",
              status: "open",
              artist: candidate,
              amount: 20,
              amountMinor: 2000,
              currency: "USD",
              interval: "monthly",
              expiresAt: "2026-07-10T13:00:00.000Z",
            },
            error: null,
          };
        },
      },
    } as unknown as SupabaseClient;

    const preview = await createSupabaseBillingService(client).createCheckoutPreview({ user, candidate });

    expect(preview).toMatchObject({
      checkoutSessionId: "checkout-1",
      reference: "ors_123",
      status: "open",
      amount: 20,
      currency: "USD",
      interval: "monthly",
      artist: expect.objectContaining({ name: "Sable Day", followers: 25000 }),
    });
    expect(calls).toEqual([
      {
        name: "paystack-initialize-checkout",
        body: {
          selectedArtist: candidate,
        },
      },
    ]);
    expect(calls.map((call) => call.name)).not.toContain("connect-spotify-artist");
    expect(calls.map((call) => call.name)).not.toContain("spotify-catalog-bootstrap");
  });

  it("renders a locked Desk HQ preview with real Spotify identity and no fake generated insights", () => {
    const onSubscribe = vi.fn();

    render(
      <PaywallPreviewScreen
        preview={{
          checkoutSessionId: "checkout-1",
          reference: "ors_123",
          status: "open",
          artist: candidate,
          amount: 20,
          amountMinor: 2000,
          currency: "USD",
          interval: "monthly",
          expiresAt: "2026-07-10T13:00:00.000Z",
        }}
        pending={false}
        onSubscribe={onSubscribe}
        onBack={() => undefined}
        onSignOut={() => undefined}
      />,
    );

    expect(screen.getByRole("heading", { name: /unlock the operating desk/i })).toBeInTheDocument();
    expect(screen.getByText("Sable Day")).toBeInTheDocument();
    expect(screen.getByText("25,000 followers")).toBeInTheDocument();
    expect(screen.getByText("alt-pop / indie soul")).toBeInTheDocument();
    expect(screen.getByText("$20/month")).toBeInTheDocument();
    expect(screen.getByText(/setup starts after payment is confirmed/i)).toBeInTheDocument();
    expect(screen.getAllByText(/locked/i).length).toBeGreaterThan(2);
    expect(screen.queryByText(/London is the clearest pressure point/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /subscribe/i }));

    expect(onSubscribe).toHaveBeenCalledTimes(1);
  });

  it("keeps the paywall compact and gives the locked skeleton a dark-mode surface", () => {
    const { container } = render(
      <PaywallPreviewScreen
        preview={{
          checkoutSessionId: "checkout-1",
          reference: "ors_123",
          status: "open",
          artist: candidate,
          amount: 20,
          amountMinor: 2000,
          currency: "USD",
          interval: "monthly",
          expiresAt: "2026-07-10T13:00:00.000Z",
        }}
        pending={false}
        onSubscribe={() => undefined}
        onBack={() => undefined}
      />,
    );

    const lockedPreview = screen.getByLabelText("Locked Desk navigation preview");
    expect(lockedPreview.className).toContain("dark:");

    const classNames = Array.from(container.querySelectorAll("[class]")).map((element) => element.getAttribute("class") ?? "");
    expect(classNames.join(" ")).toContain("dark:bg-");
    expect(classNames.some((className) => className.includes("min-h-[680px]"))).toBe(false);
    expect(classNames.some((className) => className.includes("min-h-[620px]"))).toBe(false);
  });

  it("defines durable billing tables, setup runs, RLS, and activation RPC in a migration", () => {
    const migrationPath = join(process.cwd(), "supabase", "migrations", "20260710000200_paystack_billing_paywall.sql");
    expect(existsSync(migrationPath)).toBe(true);
    const migration = readFileSync(migrationPath, "utf8");

    expect(migration).toContain("create table public.billing_checkout_sessions");
    expect(migration).toContain("create table public.billing_subscriptions");
    expect(migration).toContain("create table public.billing_webhook_events");
    expect(migration).toContain("create table public.workspace_setup_runs");
    expect(migration).toContain("activate_paid_artist_workspace");
    expect(migration).toContain("has_active_workspace_entitlement");
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("unique (provider, provider_reference)");
    expect(migration).toContain("unique (provider, provider_subscription_code)");
  });

  it("keeps paid setup and AI functions behind a shared entitlement guard", () => {
    const guardedFunctionPaths = [
      ["supabase", "functions", "spotify-catalog-bootstrap", "index.ts"],
      ["supabase", "functions", "manager-artist-discovery", "index.ts"],
      ["supabase", "functions", "generate-todays-brief", "index.ts"],
      ["supabase", "functions", "generate-music-summary", "index.ts"],
      ["supabase", "functions", "mission-genesis", "index.ts"],
      ["supabase", "functions", "manager-conversation", "index.ts"],
      ["supabase", "functions", "manager-conversation-stream", "index.ts"],
      ["supabase", "functions", "chartmetric-artist-enrichment", "index.ts"],
      ["supabase", "functions", "chartmetric-track-enrichment", "index.ts"],
      ["supabase", "functions", "chartmetric-project-enrichment", "index.ts"],
    ];

    for (const functionPath of guardedFunctionPaths) {
      const source = readFileSync(join(process.cwd(), ...functionPath), "utf8");
      expect(source, functionPath.join("/")).toContain("assertActiveWorkspaceEntitlement");
    }
  });

  it("verifies Paystack webhooks before processing and persists events idempotently", () => {
    const webhookPath = join(process.cwd(), "supabase", "functions", "paystack-webhook", "index.ts");
    expect(existsSync(webhookPath)).toBe(true);
    const webhookSource = readFileSync(webhookPath, "utf8");

    expect(webhookSource).toContain("x-paystack-signature");
    expect(webhookSource).toContain("HMAC");
    expect(webhookSource).toContain("SHA-512");
    expect(webhookSource).toContain("billing_webhook_events");
    expect(webhookSource).toContain("onConflict");
    expect(webhookSource).toContain("charge.success");
    expect(webhookSource).toContain("subscription.create");
    expect(webhookSource).toContain("invoice.payment_failed");
    expect(webhookSource).toContain("subscription.disable");
    expect(webhookSource).toContain("activate_paid_artist_workspace");
  });

  it("polls billing status after checkout return without granting access from callback alone", async () => {
    const calls: Array<{ name: string; body: unknown }> = [];
    const client = {
      functions: {
        invoke: async (name: string, options: { body: unknown }) => {
          calls.push({ name, body: options.body });
          return {
            data: {
              checkoutSessionId: "checkout-1",
              checkoutStatus: "paid",
              subscriptionStatus: "active",
              entitlementActive: true,
              setupStatus: "running",
              setupStage: "catalog_bootstrap",
            },
            error: null,
          };
        },
      },
    } as unknown as SupabaseClient;

    const status = await createSupabaseBillingService(client).loadBillingStatus({ reference: "ors_123" });

    await waitFor(() => expect(status).toMatchObject({ entitlementActive: true, setupStatus: "running" }));
    expect(calls).toEqual([{ name: "billing-status", body: { reference: "ors_123" } }]);
  });
});
