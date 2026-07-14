import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

const catalogPreview = {
  artist: {
    spotifyArtistId: "spotify-artist-1",
    name: "Sable Day",
    spotifyUrl: "https://open.spotify.com/artist/spotify-artist-1",
    imageUrl: "https://i.scdn.co/image/artist",
  },
  latestProject: {
    spotifyAlbumId: "album-1",
    name: "Midnight Signals",
    releaseType: "album",
    releaseDate: "2026-06-01",
    artworkUrl: "https://i.scdn.co/image/album-1",
    spotifyUrl: "https://open.spotify.com/album/album-1",
    tracks: [
      { spotifyTrackId: "track-1", name: "After Dark", durationMs: 180000 },
      { spotifyTrackId: "track-2", name: "First Train", durationMs: 190000 },
    ],
  },
  standaloneSingles: [{
    spotifyAlbumId: "single-1",
    name: "Open Window",
    releaseType: "single",
    releaseDate: "2026-05-01",
    tracks: [{ spotifyTrackId: "track-3", name: "Open Window", durationMs: 175000 }],
  }],
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

  it("stores only canonical artist identity in the checkout session", () => {
    const functionSource = readFileSync(
      join(process.cwd(), "supabase", "functions", "paystack-initialize-checkout", "index.ts"),
      "utf8",
    );
    expect(functionSource).toContain("normalizeSelectedArtist(input.selectedArtist)");
    expect(functionSource).toContain("spotifyArtistId: artist.spotifyArtistId");
    expect(functionSource).toContain("imageUrl: artist.imageUrl");
    expect(functionSource).not.toContain("followers: artist.followers");
    expect(functionSource).not.toContain("genres: artist.genres");
  });

  it("renders a locked Desk HQ preview with real artist identity and no fake generated insights", () => {
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
        catalogPreview={catalogPreview}
        pending={false}
        onSubscribe={onSubscribe}
        onBack={() => undefined}
        onSignOut={() => undefined}
      />,
    );

    expect(screen.getByRole("heading", { name: "Unlock Sable Day Desk" })).toBeInTheDocument();
    expect(screen.getByText("Sable Day")).toBeInTheDocument();

    const lockedCatalog = screen.getByLabelText("Locked catalog preview");
    expect(within(lockedCatalog).getByText("Midnight Signals")).toBeInTheDocument();
    expect(within(lockedCatalog).getByText(/After Dark · First Train/)).toBeInTheDocument();
    expect(within(screen.getByLabelText("Manager queue preview")).getByText("Open Window")).toBeInTheDocument();

    const subscriptionCard = screen.getByLabelText("Subscription checkout");
    expect(within(subscriptionCard).getByText("$20/month")).toBeInTheDocument();
    expect(within(subscriptionCard).getByRole("button", { name: /subscribe/i })).toBeInTheDocument();
    expect(within(subscriptionCard).queryByText("Midnight Signals")).not.toBeInTheDocument();
    expect(within(subscriptionCard).queryByText("After Dark")).not.toBeInTheDocument();
    expect(within(subscriptionCard).queryByText("Open Window")).not.toBeInTheDocument();

    expect(screen.queryByText(/followers/i)).not.toBeInTheDocument();
    expect(screen.getByText(/your desk opens with catalog import, audience intelligence, manager brief, and music reads/i)).toBeInTheDocument();
    expect(screen.queryByText(/Spotify|Chartmetric|Paystack|webhook|API|AI setup/i)).not.toBeInTheDocument();
    expect(screen.getAllByLabelText(/locked/i).length).toBeGreaterThan(2);
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

  it("renders a fixed-viewport, image-led catalog glimpse with blurred artwork", () => {
    const sixSingles = Array.from({ length: 6 }, (_, index) => ({
      spotifyAlbumId: `single-${index + 1}`,
      name: `Queue release ${index + 1}`,
      releaseType: "single",
      releaseDate: `2026-0${Math.min(index + 1, 9)}-01`,
      artworkUrl: index === 4 ? undefined : `https://i.scdn.co/image/single-${index + 1}`,
      tracks: [{ spotifyTrackId: `queue-track-${index + 1}`, name: `Queue release ${index + 1}` }],
    }));

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
        }}
        catalogPreview={{ ...catalogPreview, standaloneSingles: sixSingles }}
        onSubscribe={() => undefined}
        onBack={() => undefined}
      />,
    );

    expect(screen.getByLabelText("Paywall viewport")).toHaveClass("h-dvh", "overflow-hidden");
    expect(screen.getByLabelText("Locked Desk navigation preview")).toHaveClass("hidden", "lg:flex");
    expect(screen.queryByLabelText(/mobile.*navigation/i)).not.toBeInTheDocument();

    const projectArtwork = screen.getByRole("img", { name: "Midnight Signals artwork preview" });
    expect(projectArtwork).toHaveClass("blur-[3px]");
    expect(screen.getByText("Midnight Signals")).toBeVisible();

    const managerQueue = screen.getByLabelText("Manager queue preview");
    expect(within(managerQueue).getAllByRole("article")).toHaveLength(5);
    expect(within(managerQueue).queryByText("Queue release 6")).not.toBeInTheDocument();
    expect(within(managerQueue).getByRole("img", { name: "Queue release 1 artwork preview" })).toHaveClass("blur-[3px]");
    expect(within(managerQueue).getByLabelText("Queue release 5 artwork unavailable")).toBeInTheDocument();
    expect(within(managerQueue).getByText("Queue release 1")).toBeVisible();

    const checkout = screen.getByLabelText("Subscription checkout");
    expect(within(checkout).getByLabelText("Blurred catalog artwork background")).toHaveClass("blur-xl");
    expect(container.querySelector("[data-paywall-scroll-region]")).not.toBeInTheDocument();
  });

  it("softens every locked preview layer except the latest project title", () => {
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
        }}
        catalogPreview={catalogPreview}
        onSubscribe={() => undefined}
        onBack={() => undefined}
      />,
    );

    expect(screen.getByTestId("paywall-locked-nav-identity")).toHaveClass("blur-[2px]", "opacity-60");
    expect(screen.getByTestId("paywall-locked-nav-label-Desk-HQ")).toHaveClass("blur-[2px]", "opacity-60");
    expect(screen.getByTestId("paywall-project-section-label")).toHaveClass("blur-[2px]", "opacity-60");
    expect(screen.getByTestId("paywall-project-metadata")).toHaveClass("blur-[2px]", "opacity-60");
    expect(screen.getByTestId("paywall-project-track-names")).toHaveClass("blur-[2px]", "opacity-60");
    expect(screen.getByTestId("paywall-project-title")).not.toHaveClass("blur-[2px]");
    expect(screen.getByTestId("paywall-queue-section-label")).toHaveClass("blur-[2px]", "opacity-60");
    expect(screen.getByTestId("paywall-queue-title")).toHaveClass("blur-[2px]", "opacity-60");
    expect(screen.getByLabelText("Subscription checkout")).not.toHaveClass("blur-[2px]");
  });

  it("contains unusually long artist and catalog names inside the viewport", () => {
    const longName = "LONGTITLEWITHOUTBREAKS".repeat(18);
    render(
      <PaywallPreviewScreen
        preview={{
          checkoutSessionId: "checkout-long",
          reference: "ors_long",
          status: "open",
          artist: { ...candidate, name: longName },
          amount: 20,
          amountMinor: 2000,
          currency: "USD",
          interval: "monthly",
        }}
        catalogPreview={{
          ...catalogPreview,
          latestProject: catalogPreview.latestProject ? {
            ...catalogPreview.latestProject,
            name: longName,
            tracks: [{ spotifyTrackId: "track-long", name: longName }],
          } : null,
          standaloneSingles: [{
            spotifyAlbumId: "single-long",
            name: longName,
            releaseType: "single",
            releaseDate: "2026-05-01",
            tracks: [{ spotifyTrackId: "single-track-long", name: longName }],
          }],
        }}
        onSubscribe={() => undefined}
        onBack={() => undefined}
      />,
    );

    expect(screen.getByLabelText("Paywall viewport")).toHaveClass("max-w-full", "overflow-x-hidden");
    expect(screen.getByTestId("paywall-content-grid")).toHaveClass("min-w-0", "max-w-full", "overflow-hidden");
    expect(screen.getByTestId("paywall-checkout-title")).toHaveClass("break-words");
    expect(screen.getByTestId("paywall-project-title")).toHaveClass("truncate");
    expect(screen.getByTestId("paywall-queue-title")).toHaveClass("truncate");
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
