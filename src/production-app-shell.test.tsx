import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProductionApp, shouldPollManagerDiscoveryEvents } from "./app/ProductionApp";
import { ConversationWorkspace } from "./features/manager/ManagerScreens";
import { productionFixtureData } from "./services/fixtureRepositories";
import type { ArtistProfileViewModel, CleanProductionRepositories, ConversationViewModel, MissionViewModel, MusicObjectViewModel, TodayBriefViewModel } from "./types/cleanProduction";
import type {
  ProductionAuthAdapter,
  ProductionBillingService,
  ProductionProfileSetupService,
  ProductionSpotifyArtistAdapter,
  ProductionWorkspace,
  ProductionWorkspaceLoader,
} from "./types/productionApp";

const supabaseDiscoveryPoll = vi.hoisted(() => ({
  responses: [] as Array<{ data: Array<{ summary: string; created_at: string }>; error: null }>,
}));

vi.mock("./lib/supabaseClient", () => ({
  createBrowserSupabaseClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          like: () => ({
            order: async () => supabaseDiscoveryPoll.responses[supabaseDiscoveryPoll.responses.length - 1] ?? { data: [], error: null },
          }),
        }),
      }),
    }),
  }),
}));

const session = {
  user: {
    id: "user-1",
    email: "artist@example.com",
    displayName: "Operator",
  },
};

const workspace = {
  accountId: "account-1",
  artistId: "artist-1",
  artistWorkspaceId: "workspace-1",
  artistName: "Nova Vale",
  workspaceName: "Nova Vale Desk",
  status: "active" as const,
  spotifyConnected: true,
  spotifyArtistId: "spotify-artist-1",
  spotifyArtistName: "Nova Vale",
  spotifyArtistUrl: "https://open.spotify.com/artist/spotify-artist-1",
  contextComplete: true,
  latestCatalogSyncStatus: "completed",
} satisfies ProductionWorkspace;

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
  vi.useRealTimers();
  supabaseDiscoveryPoll.responses = [];
});

describe("Clean production prototype-match shell", () => {
  it("only polls manager discovery events for real Supabase workspace ids in setup", () => {
    expect(shouldPollManagerDiscoveryEvents({ fixtureRuntime: false, view: "setup", artistWorkspaceId: "workspace-1" })).toBe(false);
    expect(shouldPollManagerDiscoveryEvents({ fixtureRuntime: false, view: "setup", artistWorkspaceId: "fixture-workspace" })).toBe(false);
    expect(shouldPollManagerDiscoveryEvents({ fixtureRuntime: true, view: "setup", artistWorkspaceId: "11111111-1111-4111-8111-111111111111" })).toBe(false);
    expect(shouldPollManagerDiscoveryEvents({ fixtureRuntime: false, view: "labelHQ", artistWorkspaceId: "11111111-1111-4111-8111-111111111111" })).toBe(false);
    expect(shouldPollManagerDiscoveryEvents({ fixtureRuntime: false, view: "setup", artistWorkspaceId: "11111111-1111-4111-8111-111111111111" })).toBe(true);
  });

  it("renders auth in the Ordersounds visual system without loading workspace data", async () => {
    const workspaceLoader = workspaceLoaderWith(workspace);

    const { container } = render(<ProductionApp authAdapter={authWithoutSession()} workspaceLoader={workspaceLoader} />);

    expect(await screen.findByRole("heading", { name: "Sign in to Ordersounds" })).toBeInTheDocument();
    expect(screen.getByTestId("auth-shell")).toBeInTheDocument();
    expect(screen.getByTestId("auth-brand-logo")).toBeInTheDocument();
    expect(container.querySelector('img[src="/logo.png"]')).toBeInTheDocument();
    expect(screen.getAllByText("Artist operating desk").length).toBeGreaterThan(0);
    expect(screen.getByText("Open the artist's operating read.")).toBeInTheDocument();
    expect(screen.getByText("Return to the signals, blockers, tasks, and Manager decisions that need the team's attention today.")).toBeInTheDocument();
    expect(screen.queryByText("Account")).not.toBeInTheDocument();
    expect(screen.queryByText("Manager basics")).not.toBeInTheDocument();
    expect(screen.queryByText("Desk ready")).not.toBeInTheDocument();
    expect(screen.queryByText("Session required")).not.toBeInTheDocument();
    expect(screen.queryByText("Use your account to open the production workspace.")).not.toBeInTheDocument();
    expect(screen.queryByText("Secure desk")).not.toBeInTheDocument();
    expect(screen.queryByText(/provider login options/i)).not.toBeInTheDocument();
    expect(screen.getByTestId("auth-mode-switch")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create account" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /google/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /sso/i })).not.toBeInTheDocument();
    expect(workspaceLoader.calls).toBe(0);
  });

  it("uses the branded loader while checking the signed-in session", async () => {
    render(<ProductionApp authAdapter={authWithPendingSession()} workspaceLoader={workspaceLoaderWith(workspace)} />);

    expect(screen.getByTestId("branded-loader")).toBeInTheDocument();
    expect(screen.getByTestId("auth-brand-logo")).toBeInTheDocument();
    expect(screen.getByText("Loading Ordersounds")).toBeInTheDocument();
    expect(screen.getByText("Checking session and active artist workspace.")).toBeInTheDocument();
  });

  it("keeps Paystack returns isolated from any existing browser workspace session", async () => {
    window.history.pushState({}, "", "/?reference=ors_paid_return&trxref=ors_paid_return");
    const workspaceLoader = workspaceLoaderWith({
      ...workspace,
      artistName: "Wrong Browser Artist",
      workspaceName: "Wrong Browser Desk",
    });
    const billingChecks: string[] = [];
    const billingService = {
      async createCheckoutPreview() {
        throw new Error("Checkout preview should not be created on a payment return.");
      },
      async loadBillingStatus({ reference }) {
        billingChecks.push(reference);
        return {
          checkoutStatus: "missing",
          subscriptionStatus: "none",
          entitlementActive: false,
          setupStatus: "not_started",
          message: "This payment is not linked to the signed-in session in this browser.",
        };
      },
    } satisfies ProductionBillingService;

    render(
      <ProductionApp
        authAdapter={authWithSession(session)}
        workspaceLoader={workspaceLoader}
        billingService={billingService}
        repositories={repositoriesFor("Wrong Browser Artist")}
      />,
    );

    expect(await screen.findByRole("heading", { name: "Confirming payment" })).toBeInTheDocument();
    expect(screen.getByText("This payment is not linked to the signed-in session in this browser.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Desk HQ" })).not.toBeInTheDocument();
    expect(screen.queryByText("Wrong Browser Desk")).not.toBeInTheDocument();
    expect(workspaceLoader.calls).toBe(0);
    expect(billingChecks).toEqual(["ors_paid_return"]);
  });

  it("uses the branded loader while preparing workspace view data", async () => {
    const repositories = repositoriesFor("Nova Vale");
    repositories.artistProfile.loadProfile = async () => new Promise(() => undefined);

    render(
      <ProductionApp
        authAdapter={authWithSession(session)}
        workspaceLoader={workspaceLoaderWith(workspace)}
        repositories={repositories}
        initialView="labelHQ"
      />,
    );

    expect(await screen.findByText("Loading workspace data")).toBeInTheDocument();
    expect(screen.getByTestId("branded-loader")).toBeInTheDocument();
    expect(screen.getByTestId("auth-brand-logo")).toBeInTheDocument();
    expect(screen.getByText("Loading workspace data")).toBeInTheDocument();
    expect(screen.getByText("Preparing artist, music, mission, and manager views.")).toBeInTheDocument();
  });

  it("does not continuously restart workspace polling while catalog sync is running", async () => {
    const runningWorkspace = {
      ...workspace,
      latestCatalogSyncStatus: "running" as const,
    };
    const workspaceLoader = workspaceLoaderWithClonedResults(runningWorkspace);

    render(
      <ProductionApp
        authAdapter={authWithSession(session)}
        workspaceLoader={workspaceLoader}
        repositories={repositoriesFor("Nova Vale")}
        initialView="labelHQ"
      />,
    );

    expect(await screen.findByRole("heading", { name: "Desk HQ" })).toBeInTheDocument();

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(workspaceLoader.calls).toBe(2);
  });

  it("disables sign-in submission while signing in", async () => {
    const signIns: string[] = [];
    render(<ProductionApp authAdapter={authWithPendingPasswordSignIn(signIns)} workspaceLoader={workspaceLoaderWith(workspace)} />);

    expect(await screen.findByRole("heading", { name: "Sign in to Ordersounds" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "artist@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "super-secret" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(signIns).toEqual(["artist@example.com|super-secret"]);
    expect(screen.getByRole("button", { name: /signing in/i })).toBeDisabled();
  });

  it("keeps a fixture runtime available for demo and parity verification", async () => {
    render(<ProductionApp fixtureMode initialView="connectArtist" />);

    expect(await screen.findByRole("heading", { name: "Connect artist profile" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Sign in to Ordersounds" })).not.toBeInTheDocument();
    expect(screen.getByText("Sable Day")).toBeInTheDocument();
    expect(screen.getAllByText("Spotify identity").length).toBeGreaterThan(0);
    expect(screen.queryByText("Account")).not.toBeInTheDocument();
    expect(screen.queryByText("Manager basics")).not.toBeInTheDocument();
    expect(screen.queryByText("Desk ready")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue to artist context" })).toHaveClass("rounded-[10px]");
  });

  it("searches Spotify and opens the paid Desk preview without creating workspace state", async () => {
    const createdWorkspaces: Array<{ artistName: string; workspaceName?: string }> = [];
    const connectedArtists: Array<{ workspace: ProductionWorkspace; artist: string }> = [];
    const checkoutArtists: string[] = [];
    const selectionActions: string[] = [];
    const workspaceLoader = {
      calls: 0,
      async loadActiveWorkspace() {
        this.calls += 1;
        return null;
      },
      async createInitialWorkspace(_user, draft) {
        createdWorkspaces.push(draft);
        return {
          ...workspace,
          status: "setup",
          spotifyConnected: false,
          contextComplete: false,
          artistName: draft.artistName,
          workspaceName: draft.workspaceName ?? `${draft.artistName} Desk`,
        };
      },
    } satisfies ProductionWorkspaceLoader & { calls: number };
    let resolveCatalogPreview: ((value: {
      artist: { spotifyArtistId: string; name: string };
      latestProject: {
        spotifyAlbumId: string;
        name: string;
        tracks: Array<{ spotifyTrackId: string; name: string }>;
      };
      standaloneSingles: [];
    }) => void) | null = null;
    const spotifyArtistAdapter = {
      ...spotifyAdapterWithAsyncConnect(connectedArtists),
      async previewCatalog(candidate) {
        selectionActions.push(`preview:${candidate.name}`);
        return new Promise<{
          artist: { spotifyArtistId: string; name: string };
          latestProject: {
            spotifyAlbumId: string;
            name: string;
            tracks: Array<{ spotifyTrackId: string; name: string }>;
          };
          standaloneSingles: [];
        }>((resolve) => {
          resolveCatalogPreview = resolve;
        });
      },
    } satisfies ProductionSpotifyArtistAdapter;
    const billingService = {
      async createCheckoutPreview({ candidate }) {
        selectionActions.push(`checkout:${candidate.name}`);
        checkoutArtists.push(candidate.name);
        return {
          checkoutSessionId: "checkout-1",
          reference: "ors_test",
          status: "initialized",
          artist: candidate,
          amount: 20,
          amountMinor: 2000,
          currency: "USD",
          interval: "monthly",
          authorizationUrl: "https://checkout.paystack.test/ors_test",
        };
      },
      async loadBillingStatus() {
        return {
          checkoutSessionId: "checkout-1",
          checkoutStatus: "initialized",
          subscriptionStatus: "none",
          entitlementActive: false,
          setupStatus: "not_started",
        };
      },
    } satisfies ProductionBillingService;

    render(
      <ProductionApp
        authAdapter={authWithSession(session)}
        workspaceLoader={workspaceLoader}
        billingService={billingService}
        spotifyArtistAdapter={spotifyArtistAdapter}
        repositories={repositoriesFor("Nova Vale")}
        initialView="connectArtist"
      />,
    );

    expect(await screen.findByRole("heading", { name: "Connect artist profile" })).toBeInTheDocument();
    expect(screen.getByLabelText("Search Spotify artist")).toBeInTheDocument();
    expect(screen.queryByText("Step 1 / Identity")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search Spotify artist"), { target: { value: "Nova" } });
    expect(screen.getByTestId("spotify-search-loader")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Select Spotify artist Nova Vale" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Select Spotify artist Nova Vale" }));
    expect(await screen.findByRole("heading", { name: "Preparing Nova Vale Desk" })).toBeInTheDocument();
    expect(screen.getByText("Reading public catalog before checkout.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Connect artist profile" })).not.toBeInTheDocument();

    await act(async () => {
      resolveCatalogPreview?.({
        artist: { spotifyArtistId: "spotify-artist-1", name: "Nova Vale" },
        latestProject: {
          spotifyAlbumId: "album-1",
          name: "Nova Season",
          tracks: [{ spotifyTrackId: "track-1", name: "First Move" }],
        },
        standaloneSingles: [],
      });
    });

    await screen.findByRole("heading", { name: "Unlock Nova Vale Desk" });
    expect(selectionActions).toEqual(["preview:Nova Vale", "checkout:Nova Vale"]);
    expect(checkoutArtists).toEqual(["Nova Vale"]);
    expect(createdWorkspaces).toEqual([]);
    expect(connectedArtists).toEqual([]);
    expect(screen.getAllByAltText("Nova Vale artist image").length).toBeGreaterThan(0);
    expect(screen.getByText("$20/month")).toBeInTheDocument();
    expect(screen.getByText("Nova Season")).toBeInTheDocument();
    expect(screen.getByText("First Move")).toBeInTheDocument();
    expect(screen.getByText(/your desk opens with catalog import, audience intelligence, manager brief, and music reads/i)).toBeInTheDocument();
    expect(screen.queryByText("Sable Day")).not.toBeInTheDocument();
    expect(screen.queryByText("Night Bus")).not.toBeInTheDocument();
  }, 20000);

  it("opens Desk HQ by default when the workspace setup is already complete", async () => {
    render(
      <ProductionApp
        authAdapter={authWithSession(session)}
        workspaceLoader={workspaceLoaderWith(workspace)}
        repositories={repositoriesFor("Nova Vale")}
        initialView="connectArtist"
      />,
    );

    expect(await screen.findByRole("heading", { name: "Desk HQ" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Connect artist profile" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Manager Basics" })).not.toBeInTheDocument();
  }, 20000);

  it("blocks Desk HQ until required artist context is saved", async () => {
    const setupWorkspace = {
      ...workspace,
      status: "setup",
      contextComplete: false,
    } satisfies ProductionWorkspace;
    const saves: string[] = [];
    const profileSetupService: ProductionProfileSetupService = {
      async saveSetupContext(_workspace, profile) {
        saves.push(`${profile.stage}|${profile.market}|${profile.genre}|${profile.goal}|${profile.budget}`);
        return {
          ...setupWorkspace,
          status: "active",
          contextComplete: true,
        };
      },
    };

    render(
      <ProductionApp
        authAdapter={authWithSession(session)}
        workspaceLoader={workspaceLoaderWith(setupWorkspace)}
        profileSetupService={profileSetupService}
        repositories={repositoriesFor("Nova Vale", {
          stage: "",
          market: "",
          genre: "",
          goal: "",
          budget: "",
        })}
        initialView="labelHQ"
      />,
    );

    expect(await screen.findByRole("heading", { name: "Manager Basics" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enter Desk HQ" })).toBeDisabled();
    expect(screen.getByText("Add artist direction and monthly budget to enter Desk HQ.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back to profile" })).toHaveClass("rounded-[10px]");
    expect(screen.queryByLabelText("Artist stage")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Home market")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Genre")).not.toBeInTheDocument();
    expect(screen.queryByText("Manager Discovery")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Artist Direction"), { target: { value: "Build Nova Vale around precise catalog proof before scale spend." } });
    fireEvent.change(screen.getByLabelText("Monthly budget"), { target: { value: "$3,000" } });

    fireEvent.click(screen.getByRole("button", { name: "Enter Desk HQ" }));
    await screen.findByRole("heading", { name: "Desk HQ" });
    expect(saves).toEqual(["|||Build Nova Vale around precise catalog proof before scale spend.|$3,000"]);
  }, 20000);

  it("saves artist context and enters Desk HQ while catalog import is still running", async () => {
    const setupWorkspace = {
      ...workspace,
      status: "setup",
      contextComplete: false,
      latestCatalogSyncStatus: "running",
    } satisfies ProductionWorkspace;
    const saves: string[] = [];
    let resolveSave: ((workspace: ProductionWorkspace) => void) | null = null;
    const profileSetupService: ProductionProfileSetupService = {
      async saveSetupContext(_workspace, profile) {
        saves.push(`${profile.stage}|${profile.market}|${profile.genre}|${profile.goal}|${profile.budget}`);
        return new Promise<ProductionWorkspace>((resolve) => {
          resolveSave = resolve;
        });
      },
    };

    render(
      <ProductionApp
        authAdapter={authWithSession(session)}
        workspaceLoader={workspaceLoaderWith(setupWorkspace)}
        profileSetupService={profileSetupService}
        repositories={repositoriesFor("Nova Vale")}
        initialView="labelHQ"
      />,
    );

    expect(await screen.findByRole("heading", { name: "Manager Basics" })).toBeInTheDocument();
    expect(screen.getByText(/catalog import is running in the background/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Enter Desk HQ" }));
    expect(screen.getByTestId("setup-save-loader")).toBeInTheDocument();
    resolveSave?.({
      ...setupWorkspace,
      status: "active",
      contextComplete: true,
      latestCatalogSyncStatus: "running",
    });

    await screen.findByRole("heading", { name: "Desk HQ" });
    expect(saves).toEqual([
      "Emerging artist with catalog traction|Lagos|Afro-fusion|Build the artist operating plan from public catalog context and user-supplied constraints.|$3,000",
    ]);
  }, 20000);

  it("runs contextual paid setup after saving Manager basics without restarting Spotify", async () => {
    const paidSetupWorkspace = {
      ...workspace,
      status: "setup",
      contextComplete: false,
      entitlementActive: true,
      subscriptionStatus: "active",
      setupStatus: "running",
      setupStage: "setup_brief",
      billingCheckoutSessionId: "checkout-1",
      latestCatalogSyncStatus: "completed",
    } satisfies ProductionWorkspace;
    const bootstraps: string[] = [];
    const setupPhases: string[] = [];
    const spotifyArtistAdapter = {
      async searchArtists() {
        return [];
      },
      async connectArtist() {
        throw new Error("Paid setup must not reconnect Spotify through the prepay path.");
      },
      async bootstrapCatalog(nextWorkspace, candidate) {
        bootstraps.push(`${nextWorkspace.artistWorkspaceId}|${candidate.spotifyArtistId}|${candidate.name}`);
        return {
          status: "completed_with_limits",
          sourceSyncJobId: "source-sync-paid-setup",
        };
      },
    } satisfies ProductionSpotifyArtistAdapter;
    const profileSetupService: ProductionProfileSetupService = {
      async saveSetupContext() {
        return {
          ...paidSetupWorkspace,
          status: "active",
          contextComplete: true,
        };
      },
    };
    const billingService: ProductionBillingService = {
      async createCheckoutPreview() { throw new Error("not used"); },
      async loadBillingStatus() { throw new Error("not used"); },
      async runSetupPhase(input) {
        setupPhases.push(`${input.checkoutSessionId}:${input.phase}`);
        return {
          status: "completed",
          phase: "contextualize",
          setupMusicReadTargets: [],
          brief: {
            headlineRead: "Nova Vale has a context-aware opening read.",
            intelligenceSnapshot: [],
            snapshotSummary: "The opening setup packet is ready.",
            managerRead: "The saved direction and budget now shape the opening management focus.",
            sourceLine: "Based on saved setup context and discovery evidence.",
            confidence: "medium",
            generatedAt: "2026-07-10T12:00:00.000Z",
            state: "fresh",
          },
        };
      },
    };

    render(
      <ProductionApp
        authAdapter={authWithSession(session)}
        workspaceLoader={workspaceLoaderWith(paidSetupWorkspace)}
        billingService={billingService}
        spotifyArtistAdapter={spotifyArtistAdapter}
        profileSetupService={profileSetupService}
        repositories={repositoriesFor("Nova Vale")}
        initialView="labelHQ"
      />,
    );

    expect(await screen.findByRole("heading", { name: "Manager Basics" })).toBeInTheDocument();
    expect(screen.queryByText(/spotify catalog import failed/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Enter Desk HQ" }));

    await screen.findByRole("heading", { name: "Desk HQ" });
    expect(setupPhases).toEqual(["checkout-1:contextualize"]);
    expect(bootstraps).toEqual([]);
  }, 20000);

  it("keeps polling when setup reports completion before the live brief payload is available", async () => {
    const paidSetupWorkspace = {
      ...workspace,
      status: "setup",
      contextComplete: false,
      entitlementActive: true,
      subscriptionStatus: "active",
      setupStatus: "running",
      setupStage: "setup_brief",
      billingCheckoutSessionId: "checkout-1",
      latestCatalogSyncStatus: "completed",
    } satisfies ProductionWorkspace;
    let contextualizeCalls = 0;
    const profileSetupService: ProductionProfileSetupService = {
      async saveSetupContext() {
        return { ...paidSetupWorkspace, status: "active", contextComplete: true };
      },
    };
    const billingService: ProductionBillingService = {
      async createCheckoutPreview() { throw new Error("not used"); },
      async loadBillingStatus() { throw new Error("not used"); },
      async runSetupPhase() {
        contextualizeCalls += 1;
        if (contextualizeCalls === 1) {
          return { status: "completed", phase: "contextualize", setupMusicReadTargets: [] };
        }
        return {
          status: "completed",
          phase: "contextualize",
          setupMusicReadTargets: [],
          brief: {
            headlineRead: "Nova Vale has a context-aware opening read.",
            intelligenceSnapshot: [],
            snapshotSummary: "The opening setup packet is ready.",
            managerRead: "The saved direction and budget now shape the opening management focus.",
            sourceLine: "Based on saved setup context and discovery evidence.",
            confidence: "medium",
            generatedAt: "2026-07-10T12:00:00.000Z",
            state: "fresh",
          },
        };
      },
    };

    render(
      <ProductionApp
        authAdapter={authWithSession(session)}
        workspaceLoader={workspaceLoaderWith(paidSetupWorkspace)}
        billingService={billingService}
        profileSetupService={profileSetupService}
        repositories={repositoriesFor("Nova Vale")}
        initialView="labelHQ"
      />,
    );

    expect(await screen.findByRole("heading", { name: "Manager Basics" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Enter Desk HQ" }));

    await screen.findByRole("heading", { name: "Desk HQ" }, { timeout: 5000 });
    expect(contextualizeCalls).toBe(2);
    expect(screen.queryByRole("button", { name: "Retry setup" })).not.toBeInTheDocument();
  }, 20000);

  it("keeps setup in progress beyond the old 30-poll deadline and completes without a manual retry", async () => {
    const paidSetupWorkspace = {
      ...workspace,
      status: "setup",
      contextComplete: false,
      entitlementActive: true,
      subscriptionStatus: "active",
      setupStatus: "running",
      setupStage: "manager_discovery",
      billingCheckoutSessionId: "checkout-1",
      latestCatalogSyncStatus: "completed",
    } satisfies ProductionWorkspace;
    let contextualizeCalls = 0;
    const profileSetupService: ProductionProfileSetupService = {
      async saveSetupContext() {
        return { ...paidSetupWorkspace, status: "active", contextComplete: true };
      },
    };
    const billingService: ProductionBillingService = {
      async createCheckoutPreview() { throw new Error("not used"); },
      async loadBillingStatus() { throw new Error("not used"); },
      async runSetupPhase() {
        contextualizeCalls += 1;
        if (contextualizeCalls <= 30) {
          return { status: "waiting_for_discovery", phase: "contextualize" };
        }
        return {
          status: "completed",
          phase: "contextualize",
          setupMusicReadTargets: [],
          brief: {
            headlineRead: "Nova Vale has a context-aware opening read.",
            intelligenceSnapshot: [],
            snapshotSummary: "The opening setup packet is ready.",
            managerRead: "The saved direction and budget now shape the opening management focus.",
            sourceLine: "Based on saved setup context and discovery evidence.",
            confidence: "medium",
            generatedAt: "2026-07-10T12:00:00.000Z",
            state: "fresh",
          },
        };
      },
    };

    render(
      <ProductionApp
        authAdapter={authWithSession(session)}
        workspaceLoader={workspaceLoaderWith(paidSetupWorkspace)}
        billingService={billingService}
        profileSetupService={profileSetupService}
        repositories={repositoriesFor("Nova Vale")}
        initialView="labelHQ"
      />,
    );

    expect(await screen.findByRole("heading", { name: "Manager Basics" })).toBeInTheDocument();
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Enter Desk HQ" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(65_000);
    });
    vi.useRealTimers();

    expect(contextualizeCalls).toBe(31);
    expect(await screen.findByRole("heading", { name: "Desk HQ" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry setup" })).not.toBeInTheDocument();
  }, 20000);

  it("shows Manager setup activity until the setup map and queued song/project reads are ready", async () => {
    const setupWorkspace = {
      ...workspace,
      artistWorkspaceId: "11111111-1111-4111-8111-111111111111",
      status: "setup",
      contextComplete: false,
      latestCatalogSyncStatus: "completed",
    } satisfies ProductionWorkspace;
    const activeWorkspace = {
      ...setupWorkspace,
      status: "active" as const,
      contextComplete: true,
    };
    const setupMapBrief: TodayBriefViewModel = {
      headlineRead: "Nova Vale's first setup map is ready from the full packet.",
      intelligenceSnapshot: [
        {
          title: "Chartmetric KPI Read",
          insight: "The KPI interpretation is part of the Manager read, not a side panel.",
          metrics: [{ label: "Artist score", value: "92", context: "manager intelligence", evidenceIds: ["ev-kpi"] }],
        },
      ],
      snapshotSummary: "Chartmetric KPI interpretation and current music are loaded together.",
      managerRead: "Nova Vale's setup map waits for the important intelligence before calling the brief ready.",
      sourceLine: "Based on your saved artist profile, current music in view, public audience signals, and source limits.",
      confidence: "medium",
      generatedAt: "2026-06-26T08:00:00.000Z",
      managerSynthesisRunId: "setup-map-run",
      state: "fresh",
    };
    const generationModes: string[] = [];
    let resolveGeneration: ((value: TodayBriefGenerationResponse) => void) | null = null;
    let loadMusicCalls = 0;
    const repositories = repositoriesFor("Nova Vale");
    repositories.desk = {
      ...repositories.desk,
      generateTodaysBrief: async (mode = "operating") => {
        generationModes.push(mode);
        return new Promise<TodayBriefGenerationResponse>((resolve) => {
          resolveGeneration = resolve;
        });
      },
    };
    repositories.music = {
      ...repositories.music,
      loadMusic: async () => {
        loadMusicCalls += 1;
        return [
          {
            id: "song-setup",
            kind: "song" as const,
            title: "Setup Song",
            lifecycle: "Released",
            lifecycleStage: "Released",
            blocker: "No active blocker",
            sourceKind: "spotify_public_catalog",
            sourceLimit: "Public catalog connected.",
            managerReadState: loadMusicCalls > 1 ? "fresh" : "fallback",
            managerRead: loadMusicCalls > 1 ? "Setup Song has a generated Manager Read." : undefined,
            nextMove: "Wait for setup intelligence.",
            linkedMissionIds: [],
            linkedTaskCount: 0,
          },
          {
            id: "project-setup",
            kind: "project" as const,
            title: "Setup Project",
            lifecycle: "Released",
            lifecycleStage: "Released",
            blocker: "No active blocker",
            sourceKind: "spotify_public_catalog",
            sourceLimit: "Public catalog connected.",
            managerReadState: loadMusicCalls > 1 ? "fresh" : "fallback",
            managerRead: loadMusicCalls > 1 ? "Setup Project has a generated Manager Read." : undefined,
            nextMove: "Wait for setup intelligence.",
            linkedMissionIds: [],
            linkedTaskCount: 0,
            songIds: ["song-setup"],
          },
        ];
      },
    };
    const profileSetupService: ProductionProfileSetupService = {
      async saveSetupContext() {
        return activeWorkspace;
      },
    };
    supabaseDiscoveryPoll.responses = [
      {
        data: [
          {
            summary: "Running chartmetric_track_enrich.",
            created_at: "2026-07-06T08:00:00.000Z",
          },
          {
            summary: "save_public_evidence saved; evidence 3225fdc2-c4e7-4072-8593-9ab9586c4915.",
            created_at: "2026-07-06T08:00:02.000Z",
          },
          {
            summary: "chartmetric_track_enrich completed; 18 evidence items; snapshot ecc65292-152a-4a75-b6ec-01f035df7b11.",
            created_at: "2026-07-06T08:00:04.000Z",
          },
        ],
        error: null,
      },
    ];

    render(
      <ProductionApp
        authAdapter={authWithSession(session)}
        workspaceLoader={workspaceLoaderWith(setupWorkspace)}
        profileSetupService={profileSetupService}
        repositories={repositories}
        initialView="labelHQ"
      />,
    );

    expect(await screen.findByRole("heading", { name: "Manager Basics" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Enter Desk HQ" }));

    expect(await screen.findByRole("heading", { name: "Manager is preparing Desk HQ" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Desk HQ" })).not.toBeInTheDocument();
    expect(await screen.findByText("Finishing up your track data…")).toBeInTheDocument();
    expect(screen.getByTestId("setup-activity-progress")).toBeInTheDocument();
    expect(screen.queryByText(/earlier update/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/chartmetric/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/snapshot/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Saved manager basics")).not.toBeInTheDocument();
    expect(screen.queryByText("Building operating map")).not.toBeInTheDocument();
    expect(screen.queryByText("Preparing music reads")).not.toBeInTheDocument();
    expect(screen.queryByText("Opening Desk HQ")).not.toBeInTheDocument();
    expect(screen.queryByText("Discovery is complete; the Manager is turning the saved packet into the opening read.")).not.toBeInTheDocument();
    expect(screen.queryByText("Generating the first Setup Operating Map brief.")).not.toBeInTheDocument();
    expect(screen.queryByText("Refreshing the first song and project Manager Reads.")).not.toBeInTheDocument();
    await waitFor(() => expect(generationModes).toEqual(["setup-map"]));

    resolveGeneration?.({
      brief: setupMapBrief,
      setupMusicReadTargets: [
        { subjectType: "music_project", subjectId: "project-setup" },
        { subjectType: "music_item", subjectId: "song-setup" },
      ],
    });

    await waitFor(() => expect(screen.getAllByText(setupMapBrief.headlineRead).length).toBeGreaterThan(0));
    await waitFor(() => expect(loadMusicCalls).toBeGreaterThan(1));
  }, 20000);

  it("automatically generates the setup map and refreshes queued song/project reads after setup is saved", async () => {
    const setupWorkspace = {
      ...workspace,
      status: "setup",
      contextComplete: false,
      latestCatalogSyncStatus: "completed",
    } satisfies ProductionWorkspace;
    const activeWorkspace = {
      ...setupWorkspace,
      status: "active" as const,
      contextComplete: true,
    };
    const setupMapBrief: TodayBriefViewModel = {
      headlineRead: "Nova Vale's first setup map is ready from the full packet.",
      intelligenceSnapshot: [
        {
          title: "Chartmetric KPI Read",
          insight: "The KPI interpretation is part of the Manager read, not a side panel.",
          metrics: [{ label: "Artist score", value: "92", context: "manager intelligence", evidenceIds: ["ev-kpi"] }],
        },
      ],
      snapshotSummary: "Chartmetric KPI interpretation and current music are loaded together.",
      managerRead: "Nova Vale's setup map waits for the important intelligence before calling the brief ready.",
      sourceLine: "Based on your saved artist profile, current music in view, public audience signals, and source limits.",
      confidence: "medium",
      generatedAt: "2026-06-26T08:00:00.000Z",
      managerSynthesisRunId: "setup-map-run",
      state: "fresh",
    };
    const generationModes: string[] = [];
    let loadMusicCalls = 0;
    const repositories = repositoriesFor("Nova Vale");
    repositories.desk = {
      ...repositories.desk,
      generateTodaysBrief: async (mode = "operating") => {
        generationModes.push(mode);
        return {
          brief: setupMapBrief,
          setupMusicReadTargets: [
            { subjectType: "music_project", subjectId: "project-setup" },
            { subjectType: "music_item", subjectId: "song-setup" },
          ],
        } as any;
      },
    };
    repositories.music = {
      ...repositories.music,
      loadMusic: async () => {
        loadMusicCalls += 1;
        return [
          {
            id: "song-setup",
            kind: "song" as const,
            title: "Setup Song",
            lifecycle: "Released",
            lifecycleStage: "Released",
            blocker: "No active blocker",
            sourceKind: "spotify_public_catalog",
            sourceLimit: "Public catalog connected.",
            managerReadState: loadMusicCalls > 1 ? "fresh" : "fallback",
            managerRead: loadMusicCalls > 1 ? "Setup Song has a generated Manager Read." : undefined,
            nextMove: "Wait for setup intelligence.",
            linkedMissionIds: [],
            linkedTaskCount: 0,
          },
          {
            id: "project-setup",
            kind: "project" as const,
            title: "Setup Project",
            lifecycle: "Released",
            lifecycleStage: "Released",
            blocker: "No active blocker",
            sourceKind: "spotify_public_catalog",
            sourceLimit: "Public catalog connected.",
            managerReadState: loadMusicCalls > 1 ? "fresh" : "fallback",
            managerRead: loadMusicCalls > 1 ? "Setup Project has a generated Manager Read." : undefined,
            nextMove: "Wait for setup intelligence.",
            linkedMissionIds: [],
            linkedTaskCount: 0,
            songIds: ["song-setup"],
          },
        ];
      },
    };
    const profileSetupService: ProductionProfileSetupService = {
      async saveSetupContext() {
        return activeWorkspace;
      },
    };

    render(
      <ProductionApp
        authAdapter={authWithSession(session)}
        workspaceLoader={workspaceLoaderWith(setupWorkspace)}
        profileSetupService={profileSetupService}
        repositories={repositories}
        initialView="labelHQ"
      />,
    );

    expect(await screen.findByRole("heading", { name: "Manager Basics" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Enter Desk HQ" }));

    await waitFor(() => expect(screen.getAllByText(setupMapBrief.headlineRead).length).toBeGreaterThan(0));
    await waitFor(() => expect(generationModes).toEqual(["setup-map"]));
    await waitFor(() => expect(loadMusicCalls).toBeGreaterThan(1));
  }, 20000);

  it("keeps the setup activity screen visible with a retry path when setup map generation fails", async () => {
    const setupWorkspace = {
      ...workspace,
      status: "setup",
      contextComplete: false,
      latestCatalogSyncStatus: "completed",
    } satisfies ProductionWorkspace;
    const activeWorkspace = {
      ...setupWorkspace,
      status: "active" as const,
      contextComplete: true,
    };
    const repositories = repositoriesFor("Nova Vale");
    repositories.desk = {
      ...repositories.desk,
      generateTodaysBrief: async () => {
        throw new Error("OpenAI setup map failed");
      },
    };
    const profileSetupService: ProductionProfileSetupService = {
      async saveSetupContext() {
        return activeWorkspace;
      },
    };

    render(
      <ProductionApp
        authAdapter={authWithSession(session)}
        workspaceLoader={workspaceLoaderWith(setupWorkspace)}
        profileSetupService={profileSetupService}
        repositories={repositories}
        initialView="labelHQ"
      />,
    );

    expect(await screen.findByRole("heading", { name: "Manager Basics" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Enter Desk HQ" }));

    expect(await screen.findByRole("heading", { name: "Manager is preparing Desk HQ" })).toBeInTheDocument();
    expect(await screen.findByText("OpenAI setup map failed")).toBeInTheDocument();
    expect(screen.getByText("Something interrupted setup. You can retry.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry setup" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Desk HQ" })).not.toBeInTheDocument();
  }, 20000);

  it("keeps setup on a retry path when setup map generation returns fallback", async () => {
    const setupWorkspace = {
      ...workspace,
      status: "setup",
      contextComplete: false,
      latestCatalogSyncStatus: "completed",
    } satisfies ProductionWorkspace;
    const activeWorkspace = {
      ...setupWorkspace,
      status: "active" as const,
      contextComplete: true,
    };
    const repositories = repositoriesFor("Nova Vale");
    repositories.desk = {
      ...repositories.desk,
      generateTodaysBrief: async () => ({
        brief: {
          headlineRead: "Fallback setup read.",
          intelligenceSnapshot: [
            {
              title: "Artist Intelligence",
              insight: "Fallback packet read.",
              metrics: [{ label: "Audience", value: "Saved", context: "fallback", evidenceIds: ["ev-1"] }],
            },
          ],
          snapshotSummary: "Fallback packet read.",
          managerRead: "Fallback packet read.",
          sourceLine: "Based on your saved artist profile, current music in view, public audience signals, and source limits.",
          confidence: "medium",
          state: "fallback",
        },
        setupMusicReadTargets: [],
      }),
    };
    const profileSetupService: ProductionProfileSetupService = {
      async saveSetupContext() {
        return activeWorkspace;
      },
    };

    render(
      <ProductionApp
        authAdapter={authWithSession(session)}
        workspaceLoader={workspaceLoaderWith(setupWorkspace)}
        profileSetupService={profileSetupService}
        repositories={repositories}
        initialView="labelHQ"
      />,
    );

    expect(await screen.findByRole("heading", { name: "Manager Basics" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Enter Desk HQ" }));

    expect(await screen.findByText("Setup map needs a live Manager read. Retry to regenerate it.")).toBeInTheDocument();
    expect(screen.getByText("Something interrupted setup. You can retry.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry setup" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Desk HQ" })).not.toBeInTheDocument();
  }, 20000);

  it("lets a signed-in user sign out from setup and Desk HQ", async () => {
    const signOutFromSetup = vi.fn(async () => undefined);
    const setupWorkspace = {
      ...workspace,
      status: "setup",
      contextComplete: false,
    } satisfies ProductionWorkspace;

    const { unmount } = render(
      <ProductionApp
        authAdapter={authWithSessionAndSignOut(session, signOutFromSetup)}
        workspaceLoader={workspaceLoaderWith(setupWorkspace)}
        repositories={repositoriesFor("Nova Vale")}
        initialView="labelHQ"
      />,
    );

    expect(await screen.findByRole("heading", { name: "Manager Basics" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    await screen.findByRole("heading", { name: "Sign in to Ordersounds" });
    expect(signOutFromSetup).toHaveBeenCalledTimes(1);

    unmount();

    const signOutFromDesk = vi.fn(async () => undefined);
    render(
      <ProductionApp
        authAdapter={authWithSessionAndSignOut(session, signOutFromDesk)}
        workspaceLoader={workspaceLoaderWith(workspace)}
        repositories={repositoriesFor("Nova Vale")}
        initialView="labelHQ"
      />,
    );

    expect(await screen.findByRole("heading", { name: "Desk HQ" })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Sign out" })[0]);
    await screen.findByRole("heading", { name: "Sign in to Ordersounds" });
    expect(signOutFromDesk).toHaveBeenCalledTimes(1);
  }, 20000);

  it("opens Desk HQ from real repositories without Sable Day or Night Bus fallback copy", async () => {
    render(
      <ProductionApp
        authAdapter={authWithSession(session)}
        workspaceLoader={workspaceLoaderWith(workspace)}
        repositories={repositoriesFor("Nova Vale")}
        initialView="labelHQ"
      />,
    );

    expect(await screen.findByRole("heading", { name: "Desk HQ" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Ordersounds Desk navigation" })).toBeInTheDocument();
    expect(screen.getAllByText("Today's Brief").length).toBeGreaterThan(0);
    expect(screen.getByRole("form", { name: "Ask your manager" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Ask your manager anything...")).toBeInTheDocument();
    expect(screen.getAllByTestId("desk-signal-metric-card")).toHaveLength(4);
    expect(screen.queryByRole("button", { name: "Generate Today's Brief" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Workspace" })).not.toBeInTheDocument();
    expect(screen.getByTestId("desk-todays-focus-lead")).toHaveTextContent("Manager Update");
    expect(screen.getByTestId("desk-todays-focus-lead")).toHaveTextContent("Spotify public catalog connected");
    expect(screen.getByRole("button", { name: /Open Activity Center/i })).toBeInTheDocument();
    expect(screen.queryByText("Today's Attention")).not.toBeInTheDocument();
    expect(screen.queryByText("Activity log")).not.toBeInTheDocument();
    expect(screen.queryByText("Private analytics missing")).not.toBeInTheDocument();
    expect(screen.getByTestId("desk-todays-focus-lead")).toHaveTextContent("Source / Just now");
    expect(screen.queryByTestId("desk-agent-card")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ask Manager.*Get a decision.*Use today's read/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Music Focus.*Open music reads/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Mission Path.*Create first mission.*Turn read into work/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Team Agents.*0 specialist desks.*Open operating team/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Source.*Public catalog only/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/active AI units/i)).not.toBeInTheDocument();
    expect(screen.queryByText("0 specialist desks")).not.toBeInTheDocument();
    expect(screen.queryByText("Sable Day")).not.toBeInTheDocument();
    expect(screen.queryByText("Night Bus")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Open Activity Center/i }));
    const activityCenter = await screen.findByRole("dialog", { name: "Activity Center" });
    expect(activityCenter).toHaveTextContent("Needs You");
    expect(activityCenter).toHaveTextContent("Autopilot Log");
    expect(activityCenter).toHaveTextContent("No action needed");
    expect(activityCenter).toHaveTextContent("Spotify public catalog connected");

    fireEvent.click(within(screen.getByRole("navigation", { name: "Ordersounds Desk navigation" })).getByRole("button", { name: "Settings" }));
    expect(screen.getByRole("heading", { name: "Artist profile." })).toBeInTheDocument();
    expect(screen.getByAltText("Nova Vale artist image")).toBeInTheDocument();
  }, 20000);

  it("renders a generated Manager-language Today's Brief and refreshes it from saved sources", async () => {
    const initialBrief: TodayBriefViewModel = {
      headlineRead: "The UK is already behaving like Nova Vale's business center.",
      intelligenceSnapshot: [
        {
          title: "Market Power",
          insight: "London is ahead of every other saved city signal, so the first management read starts there.",
          metrics: [
            { label: "London", value: "1.21M", context: "listeners", evidenceIds: ["ev-london"] },
            { label: "UK rank", value: "#18", context: "artist rank", evidenceIds: ["ev-uk-rank"] },
          ],
        },
      ],
      snapshotSummary: "London is the lead signal; Lagos gives the story cultural weight.",
      managerRead:
        "The UK is not a growth experiment for Nova Vale. London is the strongest city in the read, and the UK rank gives that city signal a business shape. Today, I would choose the first management focus around the record or story that best explains why London is already leaning in.",
      managerEvidenceReads: [
        {
          label: "Artist Score",
          value: "92",
          read: "Artist Score is a broad strength input for the Manager read, not a separate visible section.",
          category: "kpi",
          evidenceIds: ["ev-artist-score"],
        },
      ],
      sourceLine: "Based on your saved artist profile, current music in view, public audience signals, and source limits.",
      confidence: "medium",
      generatedAt: "2026-06-17T08:30:00.000Z",
      managerSynthesisRunId: "brief-run-1",
      state: "fresh",
    };
    const refreshedBrief: TodayBriefViewModel = {
      ...initialBrief,
      headlineRead: "X is larger than Instagram and TikTok combined for Nova Vale.",
      managerSynthesisRunId: "brief-run-2",
    };
    const setupMapBrief: TodayBriefViewModel = {
      ...initialBrief,
      headlineRead: "Nova Vale's operating map starts with London, then explains the catalog that can carry it.",
      snapshotSummary: "The setup map reads the artist's city power, public surface, and current music together.",
      managerRead: "Nova Vale is not a blank setup profile; the first map is London-led and record-aware.",
      managerSynthesisRunId: "brief-run-setup-map",
    };
    const generationModes: string[] = [];
    const repositories = repositoriesFor("Nova Vale");
    repositories.desk = {
      loadDesk: async () => ({
        priority: [],
        attention: [],
        movement: [],
        todayBrief: initialBrief,
      }),
      generateTodaysBrief: async (mode = "operating") => {
        generationModes.push(mode);
        return mode === "setup-map" ? setupMapBrief : refreshedBrief;
      },
    };

    render(
      <ProductionApp
        authAdapter={authWithSession(session)}
        workspaceLoader={workspaceLoaderWith(workspace)}
        repositories={repositories}
        initialView="labelHQ"
      />,
    );

    expect(await screen.findByRole("heading", { name: "Desk HQ" })).toBeInTheDocument();
    expect(screen.getAllByText(initialBrief.headlineRead).length).toBeGreaterThan(0);
    expect(screen.getByTestId("desk-signal-metric-strip")).toBeInTheDocument();
    expect(screen.getAllByTestId("desk-signal-metric-card")).toHaveLength(4);
    expect(screen.getAllByText("1.21M").length).toBeGreaterThan(0);
    expect(screen.getAllByText("London").length).toBeGreaterThan(0);
    expect(screen.getAllByText("UK rank").length).toBeGreaterThan(0);
    expect(screen.queryByText(initialBrief.snapshotSummary)).not.toBeInTheDocument();
    expect(screen.getByTestId("desk-desktop-manager-read")).toHaveTextContent("Momentum Peak");
    expect(screen.queryByText("Evidence read")).not.toBeInTheDocument();
    expect(screen.queryByText("Artist Score is a broad strength input for the Manager read, not a separate visible section.")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "View supporting evidence" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("form", { name: "Ask your manager" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Generate setup map" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Refresh public context" })).not.toBeInTheDocument();
    expect(screen.queryByText(initialBrief.sourceLine)).not.toBeInTheDocument();
    expect(screen.queryByText(/Generated by AI Manager/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Manager brief ·/i)).toBeInTheDocument();
    expect(screen.queryByText("What I'm seeing")).not.toBeInTheDocument();
    expect(screen.queryByText("Today's Directive")).not.toBeInTheDocument();
    expect(screen.queryByText("Still missing")).not.toBeInTheDocument();
    expect(screen.queryByText(/Chartmetric|provider|API|normalized|database|evidence row|third-party/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Ask your manager anything..."), {
      target: { value: "What should I do with the UK signal today?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send manager question" }));

    expect(await screen.findByText("What should I do with the UK signal today?")).toBeInTheDocument();
    expect(generationModes).toEqual([]);
  }, 20000);

  it("keeps Today's Attention in the active visual mode instead of inverting the primary card", async () => {
    const repositories = repositoriesFor("Nova Vale");
    repositories.desk = {
      ...repositories.desk,
      loadDesk: async () => ({
        priority: [],
        movement: [],
        todayBrief: await repositoriesFor("Nova Vale").desk.loadDesk().then((desk) => desk.todayBrief),
        attention: [
          {
            title: "Catalog import running",
            body: "Desk is still pulling public Spotify catalog records.",
            tone: "accent",
            target: "musicWorkspace",
          },
        ],
      }),
    };

    render(
      <ProductionApp
        authAdapter={authWithSession(session)}
        workspaceLoader={workspaceLoaderWith(workspace)}
        repositories={repositories}
        initialView="labelHQ"
      />,
    );

    expect(await screen.findByRole("heading", { name: "Desk HQ" })).toBeInTheDocument();
    expect(screen.queryByTestId("desk-desktop-attention-rail")).not.toBeInTheDocument();
    const focusLead = screen.getByTestId("desk-todays-focus-lead");
    expect(focusLead).toHaveTextContent("Manager Update");
    expect(focusLead).toHaveTextContent("Catalog import running");
    expect(focusLead).not.toHaveTextContent("No action needed");
  }, 20000);

  it("turns Desk HQ command brief clicks into Manager and mission destinations without exposing the old command strip", async () => {
    const repositories = repositoriesFor("Nova Vale");
    repositories.staff.loadAgents = async () => productionFixtureData.agents;
    repositories.music.loadMusic = async () => [
      {
        id: "song-jam",
        kind: "song",
        title: "Jam",
        lifecycle: "Released",
        lifecycleStage: "Released",
        blocker: "No active blocker",
        sourceLimit: "Public context available.",
        nextMove: "Open record read.",
        managerRead: "Jam is the priority record.",
        snapshotSummary: "Jam has the clearest current public pressure.",
        linkedMissionIds: [],
        linkedTaskCount: 0,
      },
    ];
    repositories.missions.loadMissions = async () => [
      {
        id: "mission-jam",
        title: "Push Jam",
        status: "active",
        progress: 20,
        review: "First pass",
        summary: "Turn Jam into the first focused operating lane.",
        recommendation: "Start with Jam.",
        musicSubject: "Jam",
        nextTask: "Choose first lane",
      },
    ];

    render(
      <ProductionApp
        authAdapter={authWithSession(session)}
        workspaceLoader={workspaceLoaderWith(workspace)}
        repositories={repositories}
        initialView="labelHQ"
      />,
    );

    expect(await screen.findByRole("heading", { name: "Desk HQ" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Music Focus.*Jam.*Open record read/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Mission Path.*1 active.*Turn read into work/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Team Agents.*5 specialist desks.*Open operating team/i })).not.toBeInTheDocument();
    expect(screen.getByTestId("desk-todays-focus")).toHaveTextContent("Top Focus");
    expect(screen.getByTestId("desk-todays-focus")).toHaveTextContent("Push Jam");

    fireEvent.change(screen.getByPlaceholderText("Ask your manager anything..."), {
      target: { value: "Turn this into a manager conversation" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send manager question" }));
    expect(await screen.findByText("Turn this into a manager conversation")).toBeInTheDocument();

    fireEvent.click(within(screen.getByRole("navigation", { name: "Ordersounds Desk navigation" })).getByRole("button", { name: "Desk HQ" }));
    fireEvent.click(screen.getByRole("button", { name: "Open focus mission Push Jam" }));
    expect(await screen.findByRole("heading", { name: "Push Jam" })).toBeInTheDocument();
  }, 20000);

  it("keeps Desk HQ artist-facing sections compact and low-overload", async () => {
    const repositories = repositoriesFor("Nova Vale");
    repositories.staff.loadAgents = async () => productionFixtureData.agents;
    repositories.missions.loadMissions = async () => [1, 2, 3, 4, 5].map((index) => ({
      id: `mission-density-${index}`,
      title: `Mission Density ${index}`,
      status: index === 2 ? "blocked" : "active",
      progress: index * 12,
      review: `Review ${index}`,
      summary: `This long mission description ${index} should stay off Desk HQ so artists do not have to parse paragraph cards before deciding where to go.`,
      recommendation: `Keep mission ${index} moving.`,
      musicSubject: "Artist-wide",
      nextTask: `Next action ${index}`,
    }));

    render(
      <ProductionApp
        authAdapter={authWithSession(session)}
        workspaceLoader={workspaceLoaderWith(workspace)}
        repositories={repositories}
        initialView="labelHQ"
      />,
    );

    expect(await screen.findByRole("heading", { name: "Desk HQ" })).toBeInTheDocument();

    const managerReadCard = screen.getByTestId("desk-manager-read-card");
    expect(managerReadCard.className).toContain("manager-read-card");
    expect(managerReadCard.className).not.toContain("border-l-brand-accent");

    expect(screen.queryByTestId("desk-agent-card")).not.toBeInTheDocument();
    expect(screen.queryByText("A compact operating team for decisions, rollout, rights, deals, and live work.")).not.toBeInTheDocument();

    const missionCards = screen.getAllByTestId("desk-focus-mission-card");
    expect(missionCards).toHaveLength(3);
    expect(within(missionCards[0]).getByText("Mission Density 1")).toBeInTheDocument();
    expect(within(missionCards[2]).getByText("Mission Density 3")).toBeInTheDocument();
    expect(screen.queryByText("Mission Density 4")).not.toBeInTheDocument();
    expect(screen.queryByText("Mission Density 5")).not.toBeInTheDocument();
    expect(screen.queryByText(/This long mission description/)).not.toBeInTheDocument();
    expect(screen.queryByText("Open mission")).not.toBeInTheDocument();
    expect(within(missionCards[0]).getByText("12%")).toBeInTheDocument();

    fireEvent.click(missionCards[2]);
    expect(await screen.findByRole("heading", { name: "Mission Density 3" })).toBeInTheDocument();
    expect(screen.queryByTestId("missions-desktop-list")).not.toBeInTheDocument();
  }, 20000);

  it("puts mobile Desk HQ attention and movement behind a notification sheet", async () => {
    render(
      <ProductionApp
        authAdapter={authWithSession(session)}
        workspaceLoader={workspaceLoaderWith(workspace)}
        repositories={repositoriesFor("Nova Vale")}
        initialView="labelHQ"
      />,
    );

    expect(await screen.findByRole("heading", { name: "Desk HQ" })).toBeInTheDocument();
    expect(screen.getByTestId("desk-mobile-home")).toBeInTheDocument();
    expect(screen.queryByTestId("desk-mobile-generate-brief")).not.toBeInTheDocument();
    expect(screen.getByRole("form", { name: "Ask your manager on mobile" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Ask your manager...")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open Manager from brief" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("desk-mobile-command-row")).not.toBeInTheDocument();
    expect(screen.queryByTestId("desk-desktop-attention-rail")).not.toBeInTheDocument();
    expect(screen.getByTestId("mobile-app-topbar")).toHaveClass("backdrop-blur-xl");
    expect(screen.getByTestId("mobile-tabbar")).toHaveClass("rounded-[18px]");
    expect(screen.getByTestId("mobile-tab-label-HQ")).toHaveTextContent("HQ");
    expect(screen.queryByTestId("mobile-tab-label-Settings")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("mobile-notification-trigger"));
    const notificationSheet = await screen.findByRole("dialog", { name: "Activity Center" });
    expect(notificationSheet).toHaveTextContent("Needs You");
    expect(notificationSheet).toHaveTextContent("Autopilot Log");
    expect(notificationSheet).toHaveTextContent("No action needed");
    expect(notificationSheet).not.toHaveTextContent("Private analytics missing");
    expect(notificationSheet).toHaveTextContent("Spotify public catalog connected");
  }, 20000);

  it("keeps Desk HQ movement compact and moves older activity into history", async () => {
    const longMovement =
      "The assignee reports the work is done, but there is no verifiable evidence in the mission folder or in the task payload, so the decision rule still requires private exports plus a Data Lead power check.";
    const repositories = repositoriesFor("Nova Vale");
    repositories.desk.loadDesk = async () => ({
      priority: [],
      attention: [
        {
          title: "Commission Data Lead power check",
          body: "The market proof mission cannot advance until the Data Lead validates export quality.",
          tone: "warning",
          target: "missionsWorkspace",
        },
      ],
      movement: [
        { label: "Task", title: longMovement, time: "2d ago" },
        { label: "Music", title: "Generated Manager Read for GBESUNMO.", time: "3m ago" },
        { label: "System", title: "Stored Chartmetric enrichment snapshot for GBESUNMO.", time: "5m ago" },
        { label: "System", title: "Started Chartmetric enrichment for GBESUNMO.", time: "6m ago" },
      ],
      todayBrief: await repositoriesFor("Nova Vale").desk.loadDesk().then((desk) => desk.todayBrief),
    });

    render(
      <ProductionApp
        authAdapter={authWithSession(session)}
        workspaceLoader={workspaceLoaderWith(workspace)}
        repositories={repositories}
        initialView="labelHQ"
      />,
    );

    expect(await screen.findByRole("heading", { name: "Desk HQ" })).toBeInTheDocument();
    const focusLead = screen.getByTestId("desk-todays-focus-lead");
    expect(focusLead).toHaveTextContent("Needs You");
    expect(focusLead).toHaveTextContent("Commission Data Lead power check");
    expect(screen.queryByText(longMovement)).not.toBeInTheDocument();
    expect(screen.queryByText("Started Chartmetric enrichment for GBESUNMO.")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Open Activity Center/i }));
    const activityCenter = await screen.findByRole("dialog", { name: "Activity Center" });
    expect(activityCenter).toHaveTextContent("Needs You");
    expect(activityCenter).toHaveTextContent("Autopilot Log");
    expect(activityCenter).toHaveTextContent(longMovement);
    expect(activityCenter).toHaveTextContent("Started Chartmetric enrichment for GBESUNMO.");
  }, 20000);

  it("keeps duplicate Desk movement titles from producing React key warnings", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const baseRepositories = repositoriesFor("Nova Vale");
    const repositories: CleanProductionRepositories = {
      ...baseRepositories,
      desk: {
        ...baseRepositories.desk,
        loadDesk: async () => ({
          priority: [],
          attention: [],
          movement: [
            { label: "Manager", title: "Generated Manager Read for Chanel (feat. Asake).", time: "14h ago" },
            { label: "Manager", title: "Generated Manager Read for Chanel (feat. Asake).", time: "14h ago" },
          ],
          todayBrief: await baseRepositories.desk.loadDesk().then((desk) => desk.todayBrief),
        }),
      },
    };

    try {
      render(
        <ProductionApp
          authAdapter={authWithSession(session)}
          workspaceLoader={workspaceLoaderWith(workspace)}
          repositories={repositories}
          initialView="labelHQ"
        />,
      );

      expect(await screen.findByRole("heading", { name: "Desk HQ" })).toBeInTheDocument();
      expect(consoleError).not.toHaveBeenCalledWith(expect.stringContaining("Encountered two children with the same key"), expect.anything(), expect.anything());
    } finally {
      consoleError.mockRestore();
    }
  }, 20000);

  it("keeps mobile Desk HQ useful with titled expandable manager read, paragraphs, full metrics, and team agents", async () => {
    const managerReadEnding = "The final check is that mobile keeps the full operating read available instead of making desktop the only serious surface.";
    const evidenceTaggedSentence = "The read should not expose EV-204 or evidence-1 inside the Manager copy.";
    const richBrief: TodayBriefViewModel = {
      headlineRead: "Nova Vale should protect the London signal before opening new lanes.",
      intelligenceSnapshot: [
        {
          title: "Audience Center",
          insight: "The working read has enough audience, budget, catalog, and channel facts to support the same decision quality on mobile.",
          metrics: [
            { label: "Monthly listeners", value: "1.21M", context: "Spotify", evidenceIds: ["metric-1"] },
            { label: "London rank", value: "#4", context: "city signal", evidenceIds: ["metric-2"] },
            { label: "Budget", value: "$3K", context: "monthly", evidenceIds: ["metric-3"] },
            { label: "Catalog tracks", value: "18", context: "imported", evidenceIds: ["metric-4"] },
            { label: "Save rate", value: "11%", context: "private export", evidenceIds: ["metric-5"] },
            { label: "Skip rate", value: "21%", context: "quality watch", evidenceIds: ["metric-6"] },
          ],
        },
      ],
      snapshotSummary: "London, catalog, budget, and quality signals are all part of the same first operating read.",
      managerRead:
        "Power center: London is the first management center because the city signal is strong enough to shape the operating read.\n\n" +
        "Hidden second lane: Nova Vale needs the mobile read to carry the same management usefulness as the desktop read: the strongest city, the budget constraint, the record focus, and the quality watch all need to stay available.\n\n" +
        `Evidence handling: ${evidenceTaggedSentence}\n\n` +
        managerReadEnding,
      sourceLine: "Based on saved profile, catalog, audience, and source limits.",
      confidence: "medium",
      generatedAt: "2026-06-17T08:30:00.000Z",
      managerSynthesisRunId: "rich-brief-run",
      state: "fresh",
    };
    const baseRepositories = repositoriesFor("Nova Vale");
    const repositories: CleanProductionRepositories = {
      ...baseRepositories,
      desk: {
        ...baseRepositories.desk,
        loadDesk: async () => ({
          priority: [],
          attention: [],
          movement: [],
          todayBrief: richBrief,
        }),
        generateTodaysBrief: async () => richBrief,
      },
      staff: {
        loadAgents: async () => productionFixtureData.agents,
      },
      missions: {
        loadMissions: async () => productionFixtureData.missions,
        approveTask: async () => undefined,
        completeTask: baseRepositories.missions.completeTask,
      },
    };

    render(
      <ProductionApp
        authAdapter={authWithSession(session)}
        workspaceLoader={workspaceLoaderWith(workspace)}
        repositories={repositories}
        initialView="labelHQ"
      />,
    );

    expect(await screen.findByRole("heading", { name: "Desk HQ" })).toBeInTheDocument();
    const desk = screen.getByTestId("desk-mobile-home");
    expect(within(desk).queryByTestId("desk-mobile-command-row")).not.toBeInTheDocument();
    expect(within(desk).getByTestId("desk-mobile-command-surface")).toBeInTheDocument();
    expect(within(desk).getByTestId("desk-mobile-signal-rail")).toBeInTheDocument();
    expect(within(desk).getByTestId("desk-mobile-current-work")).toBeInTheDocument();
    expect(within(desk).queryByText(richBrief.snapshotSummary)).not.toBeInTheDocument();
    expect(within(desk).queryByText(/confidence/i)).not.toBeInTheDocument();
    expect(within(desk).getByTestId("desk-mobile-manager-read-card")).toHaveClass("manager-read-card");
    expect(within(desk).getByTestId("desk-mobile-manager-read-card")).not.toHaveClass("border-l-brand-accent");
    expect(within(desk).getByText("Manager's Read")).toBeInTheDocument();
    expect(within(desk).getByTestId("desk-mobile-manager-read")).toHaveTextContent(managerReadEnding);
    expect(within(desk).getByTestId("desk-mobile-manager-read")).not.toHaveTextContent("EV-204");
    expect(within(desk).getByTestId("desk-mobile-manager-read")).not.toHaveTextContent("evidence-1");
    expect(within(desk).getByTestId("desk-mobile-manager-read").querySelectorAll("p")).toHaveLength(4);
    expect(within(desk).getAllByTestId("desk-mobile-manager-read-segment")).toHaveLength(4);
    expect(within(desk).getByText("01")).toBeInTheDocument();
    expect(within(desk).getByText("04")).toBeInTheDocument();

    expect(screen.getAllByText("Manager's Read").length).toBeGreaterThan(0);
    expect(screen.getByTestId("desk-desktop-manager-read")).toHaveTextContent(managerReadEnding);
    expect(screen.getByTestId("desk-desktop-manager-read")).not.toHaveTextContent("EV-204");
    expect(screen.getByTestId("desk-desktop-manager-read")).not.toHaveTextContent("evidence-1");
    expect(screen.getByTestId("desk-desktop-manager-read")).not.toHaveClass("overflow-hidden");
    expect(screen.getAllByTestId("desk-manager-read-segment")).toHaveLength(4);

    const mobileMetrics = within(desk).getByTestId("desk-mobile-metrics-grid");
    expect(mobileMetrics).toHaveTextContent("Monthly listeners");
    expect(within(mobileMetrics).getAllByTestId("desk-mobile-metric-card")).toHaveLength(4);
    expect(mobileMetrics).not.toHaveTextContent("Spotify");
    expect(mobileMetrics).not.toHaveTextContent("city signal");
    expect(within(mobileMetrics).queryByText("Skip rate")).not.toBeInTheDocument();
    expect(within(desk).queryByRole("button", { name: "See all 6 metrics" })).not.toBeInTheDocument();

    expect(within(desk).queryByTestId("desk-mobile-team-agents")).not.toBeInTheDocument();
    expect(within(desk).getByRole("form", { name: "Ask your manager on mobile" })).toBeInTheDocument();
  }, 20000);

  it("renders saved Today's Brief copy instead of dropping it for style-policy terms", async () => {
    const savedBrief: TodayBriefViewModel = {
      headlineRead: "Nova Vale has a clear campaign starting point.",
      intelligenceSnapshot: [
        {
          title: "Artist Intelligence",
          insight: "The campaign read is centered on London.",
          metrics: [{ label: "Campaign signal", value: "1.2M", context: "campaign context", evidenceIds: ["ev-1"] }],
        },
      ],
      snapshotSummary: "The first campaign read has a usable shape.",
      managerRead: "The campaign should start with London because the artist already has public pull there.",
      sourceLine: "Based on your saved artist profile, current music in view, public audience signals, and source limits.",
      confidence: "medium",
      generatedAt: "2026-06-17T08:30:00.000Z",
      managerSynthesisRunId: "style-term-brief",
      state: "fresh",
    };
    const repositories = repositoriesFor("Nova Vale");
    repositories.desk = {
      loadDesk: async () => ({
        priority: [],
        attention: [],
        movement: [],
        todayBrief: savedBrief,
      }),
      generateTodaysBrief: async () => savedBrief,
    };

    render(
      <ProductionApp
        authAdapter={authWithSession(session)}
        workspaceLoader={workspaceLoaderWith(workspace)}
        repositories={repositories}
        initialView="labelHQ"
      />,
    );

    expect(await screen.findByRole("heading", { name: "Desk HQ" })).toBeInTheDocument();
    expect(screen.getAllByText(savedBrief.headlineRead).length).toBeGreaterThan(0);
    expect(screen.getByTestId("desk-desktop-manager-read")).toHaveTextContent("London");
    expect(screen.queryByText(/generation failed/i)).not.toBeInTheDocument();
  }, 20000);

  it("expands a long Manager's Read at paragraph boundaries without losing the full read", async () => {
    const finalParagraph = "Today, use the remaining budget context to make M$NEY the operating center first.";
    const longBrief: TodayBriefViewModel = {
      headlineRead: "Asake owns a complete operating read with enough room for a full sentence.",
      intelligenceSnapshot: [
        {
          title: "Artist Intelligence",
          insight: "The read has enough paragraph depth to need an intentional expansion state.",
          metrics: [{ label: "Monthly listeners", value: "8.7M", context: "public audience", evidenceIds: ["ev-1"] }],
        },
      ],
      snapshotSummary: "The summary should remain readable and complete instead of disappearing into a clipped line.",
      managerRead: [
        "Power center: Lagos is the first operating center because it has the strongest visible audience base.",
        "Hidden second lane: Abuja and Port Harcourt combine into a second market lane that should not be treated like noise.",
        "Public leverage: BADMAN GANGSTA gives the team a clear public-story asset because the social proof is already visible.",
        "Current music focus: M$NEY has enough playlist surface to organize the first workstream around a specific record.",
        finalParagraph,
      ].join("\n\n"),
      sourceLine: "Based on saved profile, catalog, audience, and source limits.",
      confidence: "medium",
      generatedAt: "2026-06-17T08:30:00.000Z",
      managerSynthesisRunId: "long-brief-run",
      state: "fresh",
    };
    const repositories = repositoriesFor("Nova Vale");
    repositories.desk = {
      loadDesk: async () => ({
        priority: [],
        attention: [],
        movement: [],
        todayBrief: longBrief,
      }),
      generateTodaysBrief: async () => longBrief,
    };

    render(
      <ProductionApp
        authAdapter={authWithSession(session)}
        workspaceLoader={workspaceLoaderWith(workspace)}
        repositories={repositories}
        initialView="labelHQ"
      />,
    );

    expect(await screen.findByRole("heading", { name: "Desk HQ" })).toBeInTheDocument();
    expect(screen.getAllByText(longBrief.headlineRead).length).toBeGreaterThan(0);
    expect(screen.queryByText(longBrief.snapshotSummary)).not.toBeInTheDocument();
    expect(screen.queryByText(finalParagraph)).not.toBeInTheDocument();

    expect(screen.queryByRole("button", { name: "See full Manager's Read" })).not.toBeInTheDocument();
    expect(screen.getByTestId("desk-desktop-manager-read").querySelectorAll("p")).toHaveLength(4);
  }, 20000);

  it("keeps Artist Intelligence metric labels and values readable instead of truncating them", async () => {
    const metricBrief: TodayBriefViewModel = {
      headlineRead: "Make Them Run has enough signal detail for a readable intelligence grid.",
      intelligenceSnapshot: [
        {
          title: "Artist Intelligence",
          insight: "The grid should carry long labels and values without hiding the fact the Manager is using.",
          metrics: [
            {
              label: "Track score - Make Them Run",
              value: "97.886",
              context: "track-level score",
              evidenceIds: ["ev-1"],
            },
            {
              label: "Top TikTok video - Make Them Run",
              value: "1.3M views",
              context: "single top clip",
              evidenceIds: ["ev-2"],
            },
          ],
        },
      ],
      snapshotSummary: "Metric labels and values should wrap cleanly, not disappear behind ellipses.",
      managerRead: "Power center: Make Them Run has enough public behavior to deserve the first operating read.",
      managerEvidenceReads: [
        {
          label: "Track score - Make Them Run",
          value: "97.886",
          category: "signal",
          read: "Treat this as track-level exposure context, not proof of owned fan conversion.",
          evidenceIds: ["ev-1"],
          confidence: "Medium",
        },
      ],
      sourceLine: "Based on saved profile, catalog, audience, and source limits.",
      confidence: "medium",
      state: "fresh",
    };
    const repositories = repositoriesFor("Nova Vale");
    repositories.desk = {
      loadDesk: async () => ({
        priority: [],
        attention: [],
        movement: [],
        todayBrief: metricBrief,
      }),
      generateTodaysBrief: async () => metricBrief,
    };

    render(
      <ProductionApp
        authAdapter={authWithSession(session)}
        workspaceLoader={workspaceLoaderWith(workspace)}
        repositories={repositories}
        initialView="labelHQ"
      />,
    );

    expect(await screen.findByRole("heading", { name: "Desk HQ" })).toBeInTheDocument();
    const intelligenceStrip = screen.getByTestId("desk-signal-metric-strip");
    expect(intelligenceStrip).toHaveTextContent("Track score - Make Them Run");
    expect(intelligenceStrip).toHaveTextContent("Top TikTok video - Make Them Run");
    expect(intelligenceStrip).toHaveTextContent("1.3M views");
    expect(screen.getByTestId("desk-desktop-manager-read")).not.toHaveTextContent("Treat this as track-level exposure context");
    expect(screen.queryByText("Evidence read")).not.toBeInTheDocument();
    expect(readFileSync(join(process.cwd(), "src", "features", "desk", "DeskHQ.tsx"), "utf8")).not.toContain("metric.label}</p>");
    expect(readFileSync(join(process.cwd(), "src", "features", "desk", "DeskHQ.tsx"), "utf8")).not.toContain("metric.value}</p>");
  }, 20000);

  it("keeps mobile navigation to four items and moves Settings into the top bar", async () => {
    render(
      <ProductionApp
        authAdapter={authWithSession(session)}
        workspaceLoader={workspaceLoaderWith(workspace)}
        repositories={repositoriesFor("Nova Vale")}
        initialView="labelHQ"
      />,
    );

    expect(await screen.findByRole("heading", { name: "Desk HQ" })).toBeInTheDocument();
    const topbar = screen.getByTestId("mobile-app-topbar");
    expect(within(topbar).getByRole("button", { name: "Open settings" })).toBeInTheDocument();
    expect(within(topbar).queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();

    const mobileNav = screen.getByRole("navigation", { name: "Mobile desk navigation" });
    expect(within(mobileNav).getAllByRole("button")).toHaveLength(4);
    expect(within(mobileNav).queryByText("Profile")).not.toBeInTheDocument();
    expect(within(mobileNav).queryByText("Settings")).not.toBeInTheDocument();

    fireEvent.click(within(topbar).getByRole("button", { name: "Open settings" }));
    expect(screen.getByRole("heading", { name: "Artist profile." })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Sign out" }).length).toBeGreaterThan(0);
  }, 20000);

  it("keeps Desk HQ icon hover states high contrast instead of purple-on-purple", () => {
    const source = readFileSync(join(process.cwd(), "src", "features", "desk", "DeskHQ.tsx"), "utf8");

    expect(source).not.toContain("group-hover:bg-brand-accent");
    expect(source).not.toContain("group-hover:bg-brand-accent/10 group-hover:text-brand-accent");
    expect(source).toContain("hover:bg-foreground/[0.04]");
    expect(source).toContain("hover:text-foreground");
  });

  it("keeps a paid workspace in setup until its contextual brief phase completes", async () => {
    const waitingWorkspace = {
      ...workspace,
      contextComplete: true,
      entitlementActive: true,
      subscriptionStatus: "active",
      setupStatus: "running",
      setupStage: "setup_brief",
      billingCheckoutSessionId: "checkout-1",
    } satisfies ProductionWorkspace;

    render(
      <ProductionApp
        authAdapter={authWithSession(session)}
        workspaceLoader={workspaceLoaderWith(waitingWorkspace)}
        repositories={repositoriesFor("Nova Vale")}
        initialView="labelHQ"
      />,
    );

    expect(await screen.findByRole("heading", { name: "Manager Basics" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Desk HQ" })).not.toBeInTheDocument();
  });

  it("keeps Manager conversations persistent and links created work", async () => {
    await enterDeskHq();

    openManagerFromDesk();
    expect(screen.getByRole("heading", { name: "Manager's Office." })).toBeInTheDocument();
    expect(screen.getByText("Conversation History")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Night Bus release planning" }));
    expect(screen.getByText("Direct message")).toBeInTheDocument();
    expect(screen.getByText("I want to drop a new song next week.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open created mission" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open created mission" }));
    expect((await screen.findAllByText("Release Night Bus on June 12")).length).toBeGreaterThan(0);
    expect(await screen.findByText("Mission pulse")).toBeInTheDocument();
  }, 20000);

  it("continues Manager chat messages in place with a pending manager reply", async () => {
    const repositories = repositoriesFor("Nova Vale");
    const existingConversation = {
      id: "conv-1",
      topic: "Night Bus release planning",
      status: "Manager responded",
      summary: "Release planning thread.",
      prompt: "I want to drop a new song next week.",
      lastUpdate: "14h ago",
      messages: [
        { id: "msg-1", speaker: "artist" as const, label: "You", body: "I want to drop a new song next week." },
        { id: "msg-2", speaker: "manager" as const, label: "Manager", body: "Validate the hook first, then build the release room." },
      ],
      createdWork: [],
    };
    repositories.manager.loadConversations = vi.fn(async () => [existingConversation]);
    let resolveSend: (conversation: Awaited<ReturnType<CleanProductionRepositories["manager"]["sendMessage"]>>) => void = () => {};
    repositories.manager.sendMessage = vi.fn(() => new Promise((resolve) => {
      resolveSend = resolve;
    }));

    render(
      <ProductionApp
        authAdapter={authWithSession(session)}
        workspaceLoader={workspaceLoaderWith(workspace)}
        repositories={repositories}
        initialView="labelHQ"
      />,
    );

    expect(await screen.findByRole("heading", { name: "Desk HQ" })).toBeInTheDocument();
    openManagerFromDesk();
    fireEvent.click(await screen.findByRole("button", { name: "Night Bus release planning" }));

    const messageBox = await screen.findByPlaceholderText("Message the Manager…");
    fireEvent.change(messageBox, { target: { value: "What changed after the campaign result?" } });
    fireEvent.click(screen.getByRole("button", { name: "Send Manager message" }));

    expect(screen.getByText("What changed after the campaign result?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send Manager message" })).toBeDisabled();
    expect(repositories.manager.sendMessage).toHaveBeenCalledWith({
      conversationId: "conv-1",
      body: "What changed after the campaign result?",
    });

    await act(async () => {
      resolveSend({
        id: "conv-1",
        topic: "Night Bus release planning",
        status: "Manager responded",
        summary: "The Manager answered the follow-up.",
        prompt: "I want to drop a new song next week.",
        lastUpdate: "Just now",
        messages: [
          { id: "msg-1", speaker: "artist", label: "You", body: "I want to drop a new song next week." },
          { id: "msg-2", speaker: "manager", label: "Manager", body: "Validate the hook first, then build the release room." },
          { id: "msg-3", speaker: "artist", label: "You", body: "What changed after the campaign result?" },
          { id: "msg-4", speaker: "manager", label: "Manager", body: "The result changes the workstream from release prep to audience ownership." },
        ],
        createdWork: [],
      });
    });

    expect(await screen.findByText("The result changes the workstream from release prep to audience ownership.")).toBeInTheDocument();
    expect(repositories.manager.sendMessage).toHaveBeenCalledTimes(1);
  }, 20000);

  it("opens a new Manager conversation immediately and streams the reply in place", async () => {
    const repositories = repositoriesFor("Nova Vale");
    let handlers: any = null;
    repositories.manager.sendMessageStream = vi.fn(async (_input, nextHandlers) => {
      handlers = nextHandlers;
    }) as any;

    render(
      <ProductionApp
        authAdapter={authWithSession(session)}
        workspaceLoader={workspaceLoaderWith(workspace)}
        repositories={repositories}
        initialView="labelHQ"
      />,
    );

    expect(await screen.findByRole("heading", { name: "Desk HQ" })).toBeInTheDocument();
    openManagerFromDesk();
    const askBox = await screen.findByPlaceholderText("Ask the Manager for a directive or review...");
    fireEvent.change(askBox, { target: { value: "We have $5,000. What should we do this month?" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask Manager" }));

    expect(await screen.findByText("We have $5,000. What should we do this month?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send Manager message" })).toBeDisabled();
    expect(screen.queryByText("Manager is reading the workspace packet.")).not.toBeInTheDocument();
    expect(repositories.manager.sendMessageStream).toHaveBeenCalledWith(
      { body: "We have $5,000. What should we do this month?" },
      expect.any(Object),
    );

    await act(async () => {
      handlers.onEvent({ type: "conversation.started", conversation: { id: "conv-stream", topic: "We have $5,000. What should we do this month?" }, run: { id: "run-1", status: "running" } });
      handlers.onEvent({ type: "run.step", runId: "run-1", label: "Reading workspace packet", status: "completed" });
      handlers.onEvent({ type: "assistant.delta", conversationId: "conv-stream", delta: "Run a capped" });
    });

    expect(screen.getByRole("button", { name: /Details/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Details/i }));
    expect(screen.getByText("Reading workspace packet")).toBeInTheDocument();
    expect(screen.getByText(/Run a capped/)).toBeInTheDocument();

    await act(async () => {
      handlers.onEvent({ type: "assistant.delta", conversationId: "conv-stream", delta: " proof loop." });
      handlers.onEvent({
        type: "conversation.completed",
        conversation: {
          id: "conv-stream",
          topic: "Budget validation",
          status: "Manager responded",
          summary: "Manager created a validation thread.",
          prompt: "We have $5,000. What should we do this month?",
          lastUpdate: "Just now",
          messages: [
            { id: "msg-user", speaker: "artist", label: "You", body: "We have $5,000. What should we do this month?" },
            { id: "msg-manager", speaker: "manager", label: "Manager", body: "Run a capped proof loop." },
          ],
          createdWork: [],
        },
        refresh: {},
      });
    });

    expect(await screen.findByRole("heading", { name: /Budget validation/i })).toBeInTheDocument();
    expect(screen.getByText("Run a capped proof loop.")).toBeInTheDocument();
    expect(screen.queryByText("The Manager is cross-referencing context, source limits, and mission risk.")).not.toBeInTheDocument();
  }, 20000);

  it("keeps a completed streamed Manager reply when the stream closes with a late error", async () => {
    const repositories = repositoriesFor("Nova Vale");
    repositories.manager.sendMessageStream = vi.fn(async (_input, handlers) => {
      handlers.onEvent({ type: "conversation.started", conversation: { id: "conv-late-error", topic: "Promotion priority" }, run: { id: "run-late-error", status: "running" } });
      handlers.onEvent({ type: "assistant.delta", conversationId: "conv-late-error", runId: "run-late-error", delta: "Focus on Night Bus and M$NEY." });
      handlers.onEvent({
        type: "conversation.completed",
        conversation: {
          id: "conv-late-error",
          topic: "Promotion priority",
          status: "Manager responded",
          summary: "Manager chose the songs to promote.",
          prompt: "what two songs should we focus on promoting as much as possible",
          lastUpdate: "Just now",
          messages: [
            { id: "msg-user", speaker: "artist", label: "You", body: "what two songs should we focus on promoting as much as possible" },
            { id: "msg-manager", speaker: "manager", label: "Manager", body: "Focus on Night Bus and M$NEY." },
          ],
          createdWork: [],
        },
      });
      throw new Error("Manager conversation failed.");
    }) as any;

    render(
      <ProductionApp
        authAdapter={authWithSession(session)}
        workspaceLoader={workspaceLoaderWith(workspace)}
        repositories={repositories}
        initialView="labelHQ"
      />,
    );

    expect(await screen.findByRole("heading", { name: "Desk HQ" })).toBeInTheDocument();
    openManagerFromDesk();
    fireEvent.change(await screen.findByPlaceholderText("Ask the Manager for a directive or review..."), { target: { value: "what two songs should we focus on promoting as much as possible" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask Manager" }));

    expect(await screen.findByText("Focus on Night Bus and M$NEY.")).toBeInTheDocument();
    expect(screen.queryByText("Manager conversation failed.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry Manager message" })).not.toBeInTheDocument();
  }, 20000);

  it("renders Manager mission context questions in chat and submits structured answers", async () => {
    const repositories = repositoriesFor("Nova Vale");
    let handlers: any = null;
    repositories.manager.sendMessageStream = vi.fn(async (_input, nextHandlers) => {
      handlers = nextHandlers;
    }) as any;

    render(
      <ProductionApp
        authAdapter={authWithSession(session)}
        workspaceLoader={workspaceLoaderWith(workspace)}
        repositories={repositories}
        initialView="labelHQ"
      />,
    );

    expect(await screen.findByRole("heading", { name: "Desk HQ" })).toBeInTheDocument();
    openManagerFromDesk();
    fireEvent.change(await screen.findByPlaceholderText("Ask the Manager for a directive or review..."), { target: { value: "Create the next mission." } });
    fireEvent.click(screen.getByRole("button", { name: "Ask Manager" }));

    await act(async () => {
      handlers.onEvent({
        type: "conversation.completed",
        conversation: {
          id: "conv-context",
          topic: "Mission context",
          status: "Manager needs context",
          summary: "Manager needs context before creating work.",
          prompt: "Create the next mission.",
          lastUpdate: "Just now",
          messages: [
            { id: "msg-user", speaker: "artist", label: "You", body: "Create the next mission." },
            {
              id: "msg-manager",
              speaker: "manager",
              label: "Manager",
              body: "I need one boundary before I create the mission graph.",
              contextRequestId: "ctx-1",
              contextQuestions: [
                {
                  key: "budget_boundary",
                  question: "What budget should the Manager protect before asking for approval?",
                  reason: "Spend changes the task plan and permission gate.",
                  answerKind: "money_range",
                  options: [],
                },
              ],
            },
          ],
          createdWork: [],
        },
      });
    });

    expect(await screen.findByText("What budget should the Manager protect before asking for approval?")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("What budget should the Manager protect before asking for approval?"), { target: { value: "$5,000" } });
    fireEvent.click(screen.getByRole("button", { name: "Send Manager context answers" }));

    expect(repositories.manager.sendMessageStream).toHaveBeenLastCalledWith(
      {
        conversationId: "conv-context",
        body: "Context answers for Manager mission decision.",
        contextRequestId: "ctx-1",
        contextAnswers: [{ questionKey: "budget_boundary", answer: "$5,000" }],
      },
      expect.any(Object),
    );
  }, 20000);

  it("preserves existing Manager thread history when a streamed follow-up starts with a partial conversation event", async () => {
    const repositories = repositoriesFor("Nova Vale");
    let handlers: any = null;
    repositories.manager.loadConversations = vi.fn(async () => [
      {
        id: "conv-history",
        topic: "Night Bus release planning",
        status: "Manager responded",
        summary: "Release planning thread.",
        prompt: "Should we release Night Bus this month?",
        lastUpdate: "14h ago",
        messages: [
          { id: "msg-1", speaker: "artist" as const, label: "You", body: "Should we release Night Bus this month?" },
          { id: "msg-2", speaker: "manager" as const, label: "Manager", body: "Only if the rights packet and city proof are ready." },
          { id: "msg-3", speaker: "artist" as const, label: "You", body: "The rights packet is complete." },
          { id: "msg-4", speaker: "manager" as const, label: "Manager", body: "Then move the work to rollout validation." },
        ],
        createdWork: [],
      },
    ]);
    repositories.manager.sendMessageStream = vi.fn(async (_input, nextHandlers) => {
      handlers = nextHandlers;
    }) as any;

    render(
      <ProductionApp
        authAdapter={authWithSession(session)}
        workspaceLoader={workspaceLoaderWith(workspace)}
        repositories={repositories}
        initialView="labelHQ"
      />,
    );

    expect(await screen.findByRole("heading", { name: "Desk HQ" })).toBeInTheDocument();
    openManagerFromDesk();
    fireEvent.click(await screen.findByRole("button", { name: "Night Bus release planning" }));

    const messageBox = await screen.findByPlaceholderText("Message the Manager…");
    fireEvent.change(messageBox, { target: { value: "What changed after the campaign result?" } });
    fireEvent.click(screen.getByRole("button", { name: "Send Manager message" }));

    await act(async () => {
      handlers.onEvent({
        type: "conversation.started",
        conversation: {
          id: "conv-history",
          status: "Manager is thinking",
          messages: [
            { id: "msg-5", speaker: "artist", label: "You", body: "What changed after the campaign result?", status: "sent" },
          ],
          createdWork: [],
        },
        run: { id: "run-history", status: "running" },
      });
    });

    expect(screen.getByText("Should we release Night Bus this month?")).toBeInTheDocument();
    expect(screen.getByText("Only if the rights packet and city proof are ready.")).toBeInTheDocument();
    expect(screen.getByText("The rights packet is complete.")).toBeInTheDocument();
    expect(screen.getByText("Then move the work to rollout validation.")).toBeInTheDocument();
    expect(screen.getByText("What changed after the campaign result?")).toBeInTheDocument();

    await act(async () => {
      handlers.onEvent({ type: "assistant.delta", conversationId: "conv-history", runId: "run-history", delta: "The result shifts the plan" });
      handlers.onEvent({
        type: "conversation.completed",
        conversation: {
          id: "conv-history",
          topic: "Campaign result follow-up",
          status: "Manager responded",
          summary: "Manager answered the follow-up.",
          prompt: "Should we release Night Bus this month?",
          lastUpdate: "Just now",
          messages: [
            { id: "msg-5", speaker: "artist", label: "You", body: "What changed after the campaign result?" },
            { id: "msg-6", speaker: "manager", label: "Manager", body: "The result shifts the plan from release prep to audience ownership." },
          ],
          createdWork: [],
        },
      });
    });

    expect(await screen.findByText("The result shifts the plan from release prep to audience ownership.")).toBeInTheDocument();
    expect(screen.getByText("Then move the work to rollout validation.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Night Bus release planning/i })).toBeInTheDocument();
  }, 20000);

  it("opens Manager-created task artifacts in the parent mission Tasks tab", async () => {
    const repositories = repositoriesFor("Nova Vale");
    const managerMission = {
      id: "mission-manager-created",
      title: "Build manager-created audience loop",
      status: "active" as const,
      progress: 12,
      review: "Audience loop review",
      summary: "A mission created by Manager chat should be reachable from the task card.",
      recommendation: "Use the first task to confirm the audience loop.",
      musicSubject: "Artist-wide",
      nextTask: "Confirm task routing",
      checkpoints: [
        {
          id: "checkpoint-manager-created",
          phase: 1,
          title: "Route chat-created tasks",
          status: "Watching signal" as const,
          question: "Can the created task open inside its canonical mission?",
          requiredTaskIds: ["task-manager-created"],
          dependsOnCheckpointIds: [],
          unlocks: [],
          blockedReason: "",
          dependencyImpact: "The team cannot execute work that only exists in chat.",
          watchedSignals: ["task-route"],
          decisionRule: "Pass when task opens from chat.",
          recommendation: "Keep task artifacts connected to Missions.",
          resultSummary: "",
          nextAction: "Open the task from chat.",
        },
      ],
      tasks: [
        {
          id: "task-manager-created",
          checkpointId: "checkpoint-manager-created",
          title: "Confirm task routing",
          owner: "Manager",
          deadline: "2026-07-05",
          approvalState: "not_required" as const,
          purpose: "Make sure Manager-created task cards resolve to canonical mission work.",
          steps: ["Open chat card", "Open parent mission", "Review task"],
          evidenceIds: ["task-route"],
          dependency: "Manager chat persistence",
          riskIfLate: "The created task is invisible outside the conversation.",
        },
      ],
    };
    repositories.missions.loadMissions = vi.fn(async () => [managerMission]);
    repositories.manager.loadConversations = vi.fn(async () => [
      {
        id: "conv-task-artifact",
        topic: "Canonical task routing",
        status: "Manager responded",
        summary: "Manager created a task artifact.",
        prompt: "Create a task.",
        lastUpdate: "Just now",
        messages: [
          { id: "msg-user", speaker: "artist" as const, label: "You", body: "Create a task." },
          {
            id: "msg-manager",
            speaker: "manager" as const,
            label: "Manager",
            body: "I created a task under the audience mission.",
            createdWork: [
              {
                type: "task" as const,
                id: "task-manager-created",
                parentMissionId: "mission-manager-created",
                title: "Confirm task routing",
                body: "This task is attached to the canonical mission.",
                status: "created" as const,
              },
            ],
          },
        ],
        createdWork: [
          {
            type: "task" as const,
            id: "task-manager-created",
            parentMissionId: "mission-manager-created",
            title: "Confirm task routing",
            body: "This task is attached to the canonical mission.",
            status: "created" as const,
          },
        ],
      },
    ]);

    render(
      <ProductionApp
        authAdapter={authWithSession(session)}
        workspaceLoader={workspaceLoaderWith(workspace)}
        repositories={repositories}
        initialView="labelHQ"
      />,
    );

    expect(await screen.findByRole("heading", { name: "Desk HQ" })).toBeInTheDocument();
    openManagerFromDesk();
    fireEvent.click(await screen.findByRole("button", { name: "Canonical task routing" }));
    fireEvent.click(screen.getByRole("button", { name: "Open task: Confirm task routing" }));

    expect(await screen.findByRole("heading", { name: "Build manager-created audience loop" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Tasks/i }).find((button) => button.getAttribute("aria-pressed") === "true")).toBeTruthy();
    expect(screen.getByText("Confirm task routing")).toBeInTheDocument();
  }, 20000);

  it("keeps Manager activity subtle with detailed steps collapsed by default", async () => {
    const repositories = repositoriesFor("Nova Vale");
    let handlers: any = null;
    repositories.manager.sendMessageStream = vi.fn(async (_input, nextHandlers) => {
      handlers = nextHandlers;
    }) as any;

    render(
      <ProductionApp
        authAdapter={authWithSession(session)}
        workspaceLoader={workspaceLoaderWith(workspace)}
        repositories={repositories}
        initialView="labelHQ"
      />,
    );

    expect(await screen.findByRole("heading", { name: "Desk HQ" })).toBeInTheDocument();
    openManagerFromDesk();
    fireEvent.change(await screen.findByPlaceholderText("Ask the Manager for a directive or review..."), { target: { value: "Plan the next mission." } });
    fireEvent.click(screen.getByRole("button", { name: "Ask Manager" }));

    await act(async () => {
      handlers.onEvent({ type: "conversation.started", conversation: { id: "conv-activity", topic: "Plan the next mission" }, run: { id: "run-activity", status: "running" } });
      handlers.onEvent({ type: "run.step", runId: "run-activity", label: "Reading workspace packet", status: "completed" });
      handlers.onEvent({ type: "run.step", runId: "run-activity", label: "Matching missions and evidence", status: "running" });
      handlers.onEvent({ type: "assistant.delta", conversationId: "conv-activity", delta: "Draft the mission" });
    });

    expect(screen.getByText("Planning next steps…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Details/i })).toBeInTheDocument();
    expect(screen.queryByText("Manager activity")).not.toBeInTheDocument();
    expect(screen.queryByText("Reading workspace packet")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Details/i }));
    expect(screen.getByText("Reading workspace packet")).toBeInTheDocument();
    expect(screen.getByText("Matching missions and evidence")).toBeInTheDocument();
  }, 20000);

  it("keeps an existing Manager thread title stable after streamed follow-up completion", async () => {
    const repositories = repositoriesFor("Nova Vale");
    const existingConversation = {
      id: "conv-stable-title",
      topic: "Night Bus release planning",
      status: "Manager responded",
      summary: "Release planning thread.",
      prompt: "I want to drop a new song next week.",
      lastUpdate: "14h ago",
      messages: [
        { id: "msg-1", speaker: "artist" as const, label: "You", body: "I want to drop a new song next week." },
        { id: "msg-2", speaker: "manager" as const, label: "Manager", body: "Validate the hook first, then build the release room." },
      ],
      createdWork: [],
    };
    repositories.manager.loadConversations = vi.fn(async () => [existingConversation]);
    let handlers: any = null;
    repositories.manager.sendMessageStream = vi.fn(async (_input, nextHandlers) => {
      handlers = nextHandlers;
    }) as any;

    render(
      <ProductionApp
        authAdapter={authWithSession(session)}
        workspaceLoader={workspaceLoaderWith(workspace)}
        repositories={repositories}
        initialView="labelHQ"
      />,
    );

    expect(await screen.findByRole("heading", { name: "Desk HQ" })).toBeInTheDocument();
    openManagerFromDesk();
    fireEvent.click(await screen.findByRole("button", { name: "Night Bus release planning" }));
    const messageBox = await screen.findByPlaceholderText("Message the Manager…");
    fireEvent.change(messageBox, { target: { value: "What changed after the campaign result?" } });
    fireEvent.click(screen.getByRole("button", { name: "Send Manager message" }));

    await act(async () => {
      handlers.onEvent({
        type: "conversation.completed",
        conversation: {
          ...existingConversation,
          topic: "Audience ownership pivot",
          status: "Manager responded",
          messages: [
            ...existingConversation.messages,
            { id: "msg-3", speaker: "artist", label: "You", body: "What changed after the campaign result?" },
            { id: "msg-4", speaker: "manager", label: "Manager", body: "The result changes the workstream from release prep to audience ownership." },
          ],
          createdWork: [],
        },
        refresh: {},
      });
    });

    expect(await screen.findByRole("heading", { name: /Night Bus release planning/i })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Audience ownership pivot" })).not.toBeInTheDocument();
    expect(screen.getByText("I want to drop a new song next week.")).toBeInTheDocument();
    expect(screen.getByText("The result changes the workstream from release prep to audience ownership.")).toBeInTheDocument();
  }, 20000);

  it("renders streamed Manager failures as recoverable chat messages", async () => {
    const repositories = repositoriesFor("Nova Vale");
    let handlers: any = null;
    repositories.manager.sendMessageStream = vi.fn(async (_input, nextHandlers) => {
      handlers = nextHandlers;
    }) as any;

    render(
      <ProductionApp
        authAdapter={authWithSession(session)}
        workspaceLoader={workspaceLoaderWith(workspace)}
        repositories={repositories}
        initialView="labelHQ"
      />,
    );

    expect(await screen.findByRole("heading", { name: "Desk HQ" })).toBeInTheDocument();
    openManagerFromDesk();
    fireEvent.change(await screen.findByPlaceholderText("Ask the Manager for a directive or review..."), { target: { value: "Should we move the release?" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask Manager" }));

    await act(async () => {
      handlers.onEvent({ type: "error", message: "Manager conversation failed." });
    });

    expect(await screen.findByText("Manager conversation failed.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry Manager message" })).toBeInTheDocument();
  }, 20000);

  it("starts a persisted Manager conversation from the prototype-style directive composer", async () => {
    const repositories = repositoriesFor("Nova Vale");
    const createdConversation = {
      id: "conv-manager-new",
      topic: "Budget validation",
      status: "Manager responded",
      summary: "Manager created a validation thread from the current workspace packet.",
      prompt: "We have $5,000. What should we do this month?",
      lastUpdate: "Just now",
      messages: [
        { id: "msg-user", speaker: "artist" as const, label: "You", body: "We have $5,000. What should we do this month?" },
        {
          id: "msg-manager",
          speaker: "manager" as const,
          label: "Manager",
          body: "Hold scale spend and run a capped proof loop tied to verified city response, rights clearance, and conversion proof.",
          createdWork: [
            {
              type: "task" as const,
              title: "Define capped spend proof loop",
              body: "Create the test before committing the full budget.",
              id: "task-proof-loop",
            },
          ],
        },
      ],
      createdWork: [
        {
          type: "task" as const,
          title: "Define capped spend proof loop",
          body: "Create the test before committing the full budget.",
          id: "task-proof-loop",
        },
      ],
    };
    repositories.manager.sendMessage = vi.fn(async () => createdConversation);

    render(
      <ProductionApp
        authAdapter={authWithSession(session)}
        workspaceLoader={workspaceLoaderWith(workspace)}
        repositories={repositories}
        initialView="labelHQ"
      />,
    );

    expect(await screen.findByRole("heading", { name: "Desk HQ" })).toBeInTheDocument();
    openManagerFromDesk();
    const askBox = await screen.findByPlaceholderText("Ask the Manager for a directive or review...");
    fireEvent.change(askBox, { target: { value: "We have $5,000. What should we do this month?" } });
    fireEvent.click(screen.getByRole("button", { name: "Ask Manager" }));

    expect(repositories.manager.sendMessage).toHaveBeenCalledWith({
      body: "We have $5,000. What should we do this month?",
    });
    expect(await screen.findByRole("heading", { name: /Budget validation/i })).toBeInTheDocument();
    expect(screen.getByText("Hold scale spend and run a capped proof loop tied to verified city response, rights clearance, and conversion proof.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open task: Define capped spend proof loop" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Investigation" })).not.toBeInTheDocument();
  }, 20000);

  it("renders Manager-created work as separate mission artifacts instead of collapsing every task into one lane", () => {
    const conversation: ConversationViewModel = {
      id: "conv-multi-mission-artifacts",
      topic: "Build two missions",
      status: "Manager responded",
      summary: "Manager created two mission lanes.",
      prompt: "Create the plan.",
      messages: [
        { id: "msg-user", speaker: "artist", label: "You", body: "Create the plan." },
        {
          id: "msg-manager",
          speaker: "manager",
          label: "Manager",
          body: "I created two mission lanes.",
          createdWork: [
            {
              type: "mission",
              id: "mission-a",
              title: "Validate Lagos audience pull",
              body: "Use public and saved signals to test the first audience lane.",
              status: "created",
            },
            {
              type: "task",
              id: "task-a",
              parentMissionId: "mission-a",
              title: "Audit Lagos listener evidence",
              body: "Confirm the audience signal before spend.",
              status: "created",
            },
            {
              type: "mission",
              id: "mission-b",
              title: "Tighten release rights readiness",
              body: "Clear the operational blockers before campaign decisions.",
              status: "created",
            },
            {
              type: "task",
              id: "task-b",
              parentMissionId: "mission-b",
              title: "Confirm split and master proof",
              body: "Collect rights evidence before approving release activity.",
              status: "created",
            },
          ],
        },
      ],
      createdWork: [],
    };

    render(
      <ConversationWorkspace
        conversation={conversation}
        onBack={() => undefined}
        onOpenCreatedWork={() => undefined}
        onSendMessage={() => undefined}
        onSendContextAnswers={() => undefined}
        sendPending={false}
        sendError={null}
      />,
    );

    expect(screen.getByText("Validate Lagos audience pull")).toBeInTheDocument();
    expect(screen.getByText("Tighten release rights readiness")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Open created mission" })).toHaveLength(2);
    expect(screen.getAllByText("1 task")).toHaveLength(2);
    expect(screen.queryByText("2 tasks")).not.toBeInTheDocument();
  });

  it("shows Manager-created missions on the Missions page without a page reload", async () => {
    const repositories = repositoriesFor("Nova Vale");
    let missionRows = [] as Awaited<ReturnType<CleanProductionRepositories["missions"]["loadMissions"]>>;
    let loadMissionsCalls = 0;
    repositories.missions = {
      ...repositories.missions,
      loadMissions: async () => {
        loadMissionsCalls += 1;
        return missionRows;
      },
    };
    repositories.manager.sendMessage = vi.fn(async () => {
      missionRows = [
        {
          id: "mission-manager-created",
          title: "Build Blaqbonez's manager-created mission",
          status: "active",
          progress: 0,
          review: "Manager-created work quality",
          summary: "A mission created from a Manager chat should appear in Missions immediately.",
          recommendation: "Review the created mission and assign the first task.",
          musicSubject: "Artist-wide",
          nextTask: "Confirm the Manager-created mission scope",
          checkpoints: [
            {
              id: "checkpoint-manager-created",
              phase: 1,
              title: "Manager-created work quality",
              status: "Watching signal",
              question: "Is the created mission visible and actionable on the Missions page?",
              requiredTaskIds: ["task-manager-created"],
              dependsOnCheckpointIds: [],
              unlocks: [],
              blockedReason: "",
              dependencyImpact: "The team cannot act on hidden work.",
              watchedSignals: ["mission-visible"],
              decisionRule: "Pass only if the mission is visible after the chat reply.",
              recommendation: "Keep Manager-created work visible.",
              resultSummary: "",
              nextAction: "Open the mission from Missions.",
            },
          ],
          tasks: [
            {
              id: "task-manager-created",
              checkpointId: "checkpoint-manager-created",
              title: "Confirm the Manager-created mission scope",
              owner: "Manager",
              deadline: "2026-07-05",
              approvalState: "not_required",
              purpose: "Make sure chat-created mission work is durable in the mission system.",
              steps: ["Open Missions", "Confirm the mission appears", "Review the first checkpoint"],
              evidenceIds: ["mission-visible"],
              dependency: "Manager chat persistence",
              riskIfLate: "Created work exists in chat but not in the operating mission page.",
            },
          ],
        },
      ];
      return {
        id: "conv-manager-created-mission",
        topic: "Manager-created mission",
        status: "Manager responded",
        summary: "Manager created mission work from chat.",
        prompt: "Create the mission from this chat.",
        lastUpdate: "Just now",
        messages: [
          { id: "msg-user", speaker: "artist" as const, label: "You", body: "Create the mission from this chat." },
          {
            id: "msg-manager",
            speaker: "manager" as const,
            label: "Manager",
            body: "I created a durable mission and attached the first checkpoint.",
            createdWork: [
              {
                type: "mission" as const,
                id: "mission-manager-created",
                title: "Build Blaqbonez's manager-created mission",
                body: "Mission work is persisted and ready for the Missions page.",
              },
            ],
          },
        ],
        createdWork: [
          {
            type: "mission" as const,
            id: "mission-manager-created",
            title: "Build Blaqbonez's manager-created mission",
            body: "Mission work is persisted and ready for the Missions page.",
          },
        ],
      };
    });

    render(
      <ProductionApp
        authAdapter={authWithSession(session)}
        workspaceLoader={workspaceLoaderWith(workspace)}
        repositories={repositories}
        initialView="labelHQ"
      />,
    );

    expect(await screen.findByRole("heading", { name: "Desk HQ" })).toBeInTheDocument();
    openManagerFromDesk();
    const askBox = await screen.findByPlaceholderText("Ask the Manager for a directive or review...");
    fireEvent.change(askBox, { target: { value: "Create the mission from this chat." } });
    fireEvent.click(screen.getByRole("button", { name: "Ask Manager" }));

    expect(await screen.findByRole("heading", { name: "Manager-created mission." })).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("navigation", { name: "Ordersounds Desk navigation" })).getByRole("button", { name: "Missions" }));

    expect(await screen.findByRole("heading", { name: "Missions" })).toBeInTheDocument();
    expect(screen.getAllByText("Build Blaqbonez's manager-created mission").length).toBeGreaterThan(0);
    expect(loadMissionsCalls).toBeGreaterThanOrEqual(2);
  }, 20000);

  it("rebuilds Music as a durable recorded-work area with song/project rooms", async () => {
    await enterDeskHq();

    const rail = screen.getByRole("navigation", { name: "Ordersounds Desk navigation" });
    fireEvent.click(within(rail).getByRole("button", { name: "Open Catalog workspace" }));

    expect(screen.getByRole("heading", { name: "Catalog" })).toBeInTheDocument();
    expect(screen.queryByText("CATALOG")).not.toBeInTheDocument();
    expect(screen.getByText("Songs and projects connected to active work.")).toBeInTheDocument();
    expect(screen.queryByText("Artist objects")).not.toBeInTheDocument();
    expect(screen.queryByText("Recorded work under management")).not.toBeInTheDocument();
    expect(screen.queryByText("Songs stay atomic; projects collect songs without duplicating their state.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Songs" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Projects" })).toBeInTheDocument();
    expect(screen.getAllByText("01").length).toBeGreaterThan(0);
    expect(screen.getAllByAltText("Night Bus cover artwork").length).toBeGreaterThan(0);
    // The catalog list is intentionally lean: no per-row readiness signals or manager read.
    expect(screen.queryByText(/Record read:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Next:/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open song Night Bus" }));
    let songRoom = screen.getByTestId("music-song-detail");
    expect(songRoom).toHaveTextContent("Song room");
    expect(songRoom).toHaveTextContent("Confirm split sheet");
    expect(within(songRoom).getByRole("button", { name: "details" })).toBeInTheDocument();
    expect(
      within(songRoom)
        .getByRole("button", { name: "details" })
        .compareDocumentPosition(within(songRoom).getByRole("button", { name: "files" })) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(within(songRoom).getByRole("button", { name: "rights" })).toBeInTheDocument();

    fireEvent.click(within(songRoom).getByRole("button", { name: "details" }));
    expect(songRoom).toHaveTextContent("Song identity");
    expect(songRoom).toHaveTextContent("ISRC");

    fireEvent.click(within(songRoom).getByRole("button", { name: "rights" }));
    expect(songRoom).toHaveTextContent("Collaborator ledger");
    expect(songRoom).toHaveTextContent("Add collaborator");

    fireEvent.click(screen.getByRole("button", { name: "Back to Catalog" }));
    fireEvent.click(screen.getByRole("button", { name: "Projects" }));
    fireEvent.click(screen.getByRole("button", { name: "Open project Glass Room EP" }));
    const projectRoom = screen.getByTestId("music-project-detail");
    expect(projectRoom).toHaveTextContent("Tracklist");
    expect(projectRoom).toHaveTextContent("Songs stay atomic");
    expect(projectRoom).not.toHaveTextContent("Inherited blocker");
    expect(projectRoom).toHaveTextContent("1 needs split proof");
    expect(within(projectRoom).getAllByText("Needs split proof").length).toBeGreaterThan(0);
    fireEvent.click(within(projectRoom).getByRole("button", { name: "Open song Night Bus" }));
    songRoom = screen.getByTestId("music-song-detail");
    expect(songRoom).toHaveTextContent("Night Bus");
    fireEvent.click(screen.getByRole("button", { name: "Back to Catalog" }));
    expect(screen.getByRole("button", { name: "Projects" })).toHaveAttribute("aria-pressed", "true");
  }, 20000);

  it("uses compact mobile Music rows instead of tall stacked cards", async () => {
    await enterDeskHq();

    const rail = screen.getByRole("navigation", { name: "Ordersounds Desk navigation" });
    fireEvent.click(within(rail).getByRole("button", { name: "Open Catalog workspace" }));

    expect(await screen.findByRole("heading", { name: "Catalog" })).toBeInTheDocument();
    expect(screen.getByTestId("workspace-header-Catalog")).toHaveClass("hidden", "lg:flex");
    expect(screen.getByTestId("music-mobile-controls")).toHaveClass("flex-row");
    const mobileLibrary = screen.getByTestId("music-mobile-library");
    const mobileRow = within(mobileLibrary).getByTestId("music-mobile-song-row-Night Bus");
    expect(mobileLibrary).toHaveClass("lg:hidden");
    expect(mobileRow).toHaveClass("min-h-0");
    expect(mobileRow).not.toHaveClass("rounded-[20px]");
    // The row is now just number + artwork + title + status, with no readiness signals.
    expect(within(mobileRow).queryByTestId("music-mobile-readiness-strip")).not.toBeInTheDocument();
    expect(within(mobileRow).queryByText("Files")).not.toBeInTheDocument();
    expect(within(mobileRow).queryByText("Details")).not.toBeInTheDocument();
    expect(within(mobileRow).queryByText("Rights")).not.toBeInTheDocument();
    expect(within(mobileRow).queryByText(/strongest current focus asset/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Projects" }));
    const mobileProjectRow = within(mobileLibrary).getByTestId("music-mobile-project-row-Glass Room EP");
    expect(within(mobileProjectRow).getByText(/\d+ tracks?/i)).toBeInTheDocument();
    expect(within(mobileProjectRow).queryByText("Ready tracks")).not.toBeInTheDocument();
    expect(within(mobileProjectRow).queryByText("Issues")).not.toBeInTheDocument();
    expect(within(mobileProjectRow).queryByText(/project context is ready|mapped track|project read/i)).not.toBeInTheDocument();
  }, 20000);

  it("uses mobile-native song and project room layouts after opening Music items", async () => {
    await enterDeskHq();

    const rail = screen.getByRole("navigation", { name: "Ordersounds Desk navigation" });
    fireEvent.click(within(rail).getByRole("button", { name: "Open Catalog workspace" }));

    fireEvent.click(await screen.findByRole("button", { name: "Open mobile song Night Bus" }));
    let songRoom = screen.getByTestId("music-song-detail");
    expect(within(songRoom).getByTestId("music-detail-mobile-top")).toHaveClass("lg:hidden");
    expect(within(songRoom).getByTestId("music-detail-desktop-top")).toHaveClass("hidden", "lg:block");
    expect(within(songRoom).getByTestId("song-room-mobile-tabs")).toHaveClass("grid-cols-4");
    expect(within(songRoom).getByTestId("song-room-mobile-overview")).toHaveClass("rounded-[16px]");
    expect(within(songRoom).getByTestId("song-room-mobile-overview")).not.toHaveClass("rounded-[22px]");

    fireEvent.click(within(songRoom).getByRole("button", { name: "details" }));
    const mobileDetails = within(songRoom).getByTestId("song-room-mobile-details");
    expect(mobileDetails).toHaveClass("lg:hidden");
    expect(mobileDetails).toHaveClass("rounded-[16px]");
    expect(mobileDetails).not.toHaveClass("rounded-[22px]");
    expect(within(songRoom).getByTestId("song-room-desktop-details")).toHaveClass("hidden", "lg:block");
    expect(within(mobileDetails).getByText("ISRC")).toBeInTheDocument();
    expect(within(mobileDetails).getByTestId("song-mobile-detail-field-ISRC")).toHaveClass("grid-cols-[minmax(0,1fr)_auto]");

    fireEvent.click(screen.getByRole("button", { name: "Back to Catalog" }));
    fireEvent.click(screen.getByRole("button", { name: "Projects" }));
    fireEvent.click(screen.getByRole("button", { name: "Open mobile project Glass Room EP" }));

    const projectRoom = screen.getByTestId("music-project-detail");
    expect(within(projectRoom).getByTestId("music-detail-mobile-top")).toHaveClass("lg:hidden");
    const mobileTracklist = within(projectRoom).getByTestId("project-room-mobile-tracklist");
    const nightBusTrack = within(mobileTracklist).getByTestId("project-mobile-track-Night Bus");
    expect(mobileTracklist).toHaveClass("lg:hidden");
    expect(nightBusTrack).toHaveClass("grid-cols-[28px_44px_minmax(0,1fr)_auto]");
    expect(nightBusTrack).not.toHaveClass("gap-3 px-5 py-4");
    expect(within(nightBusTrack).getByText("Night Bus")).toBeInTheDocument();

    fireEvent.click(within(projectRoom).getByRole("button", { name: "Open song Night Bus" }));
    songRoom = screen.getByTestId("music-song-detail");
    expect(within(songRoom).getByTestId("music-detail-mobile-top")).toHaveTextContent("Night Bus");
  }, 20000);

  it("gives Missions, Team, Manager, and Profile dedicated compact mobile surfaces", async () => {
    await enterDeskHq();

    const rail = screen.getByRole("navigation", { name: "Ordersounds Desk navigation" });

    fireEvent.click(within(rail).getByRole("button", { name: "Missions" }));
    expect(screen.getByTestId("missions-mobile-picker")).toHaveClass("lg:hidden");
    expect(screen.getByTestId("missions-desktop-list")).toHaveClass("hidden", "lg:block");

    fireEvent.click(within(rail).getByRole("button", { name: "Team Agents" }));
    expect(screen.getByTestId("staff-mobile-list")).toHaveClass("md:hidden");
    expect(screen.getByTestId("staff-desktop-list")).toHaveClass("hidden", "md:grid");

    fireEvent.click(within(rail).getByRole("button", { name: "Desk HQ" }));
    openManagerFromDesk();
    expect(screen.getByRole("heading", { name: "Manager's Office." })).toBeInTheDocument();

    fireEvent.click(within(rail).getByRole("button", { name: "Settings" }));
    expect(screen.getByTestId("settings-mobile-profile-summary")).toHaveClass("sm:hidden");
    expect(screen.getByTestId("settings-desktop-profile-summary")).toHaveClass("hidden", "sm:flex");
  }, 20000);

  it("puts AI Manager first and presents locked team agents as coming-soon placeholders", async () => {
    const repositories = repositoriesFor("Nova Vale");
    repositories.staff = {
      ...repositories.staff,
      loadAgents: async () => [
        productionFixtureData.agents.find((agent) => agent.id === "marketing")!,
        productionFixtureData.agents.find((agent) => agent.id === "manager")!,
        productionFixtureData.agents.find((agent) => agent.id === "finance")!,
      ],
    };

    render(
      <ProductionApp
        authAdapter={authWithSession(session)}
        workspaceLoader={workspaceLoaderWith(workspace)}
        repositories={repositories}
        initialView="staffWorkspace"
      />,
    );

    expect(await screen.findByRole("heading", { name: "Artist Team Agents" })).toBeInTheDocument();
    const desktopList = screen.getByTestId("staff-desktop-list");
    const desktopAgents = within(desktopList).getAllByRole("button");
    expect(desktopAgents[0]).toHaveAccessibleName("AI Manager");
    expect(desktopAgents[0]).toHaveTextContent("Available now");
    expect(desktopAgents[1]).toHaveAccessibleName("Marketing Lead");
    expect(desktopAgents[1]).toHaveTextContent("Coming soon");
    expect(desktopAgents[2]).toHaveAccessibleName("Finance/Rights");
    expect(desktopAgents[2]).toHaveTextContent("Coming soon");

    fireEvent.click(desktopAgents[1]);
    expect(screen.getByRole("heading", { name: "Marketing Lead is not live yet." })).toBeInTheDocument();
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
    expect(screen.getByText("This specialist desk is locked while the first AI Manager experience is being tested.")).toBeInTheDocument();
    expect(screen.queryByText("Campaign command board")).not.toBeInTheDocument();
    expect(screen.queryByText("Source rail")).not.toBeInTheDocument();
  }, 20000);

  it("runs the first Manager plan from the empty Missions page and keeps Manager chat available for context questions", async () => {
    const repositories = repositoriesFor("Nova Vale");
    let missions = [] as Awaited<ReturnType<CleanProductionRepositories["missions"]["loadMissions"]>>;
    let resolveRun: ((value: Awaited<ReturnType<CleanProductionRepositories["missionGenesis"]["runMissionGenesis"]>>) => void) | undefined;
    repositories.missions = {
      ...repositories.missions,
      loadMissions: async () => missions,
    };
    repositories.missionGenesis = {
      ...repositories.missionGenesis,
      runMissionGenesis: async () => new Promise((resolve) => {
        resolveRun = resolve;
      }),
      answerMissionGenesisContext: async () => {
        missions = [
          {
            id: "mission-generated",
            title: "Validate whether a rising market deserves focused operating attention",
            status: "active",
            progress: 0,
            review: "Market signal quality",
            summary: "Use saved context, audience signal, and team capacity to test whether the rising market deserves focused work.",
            recommendation: "Use source-backed evidence before spend.",
            musicSubject: "Artist-wide",
            nextTask: "Verify geography signal quality",
            checkpoints: [
              {
                id: "checkpoint-1",
                phase: 1,
                title: "Market signal quality",
                status: "Watching signal",
                question: "Is this market signal real enough?",
                requiredTaskIds: ["task-1"],
                dependsOnCheckpointIds: [],
                unlocks: [],
                blockedReason: "",
                dependencyImpact: "Impact warning if delayed",
                watchedSignals: ["signal-london"],
                decisionRule: "Check Spotify listener count in London",
                recommendation: "Verify target geography",
                resultSummary: "Confirmed geography relevance",
                nextAction: "Perform audience check",
              }
            ],
            tasks: [
              {
                id: "task-1",
                checkpointId: "checkpoint-1",
                title: "Verify geography signal quality",
                owner: "Manager",
                deadline: "2026-07-01",
                approvalState: "not_required",
                purpose: "Confirm the city metrics are correct",
                steps: [
                  "Open Spotify for Artists",
                  "Filter by London monthly listeners",
                  "Compare with historical baseline"
                ],
                evidenceIds: ["signal-london"],
                dependency: "None",
                riskIfLate: "We might launch in a stale region"
              }
            ]
          },
        ];
        return {
          outcome: "activate_mission",
          title: "Mission activated",
          body: "The Manager used the new context to activate a personalized operating mission.",
          reasons: ["Context was answered."],
          questions: [],
          evidenceNeeded: [],
          activatedMissionId: "mission-generated",
        };
      },
    };

    render(
      <ProductionApp
        authAdapter={authWithSession(session)}
        workspaceLoader={workspaceLoaderWith(workspace)}
        repositories={repositories}
        initialView="missionsWorkspace"
      />,
    );

    expect(await screen.findByRole("heading", { name: "Missions" })).toBeInTheDocument();
    expect(screen.getByText("No active missions yet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Test mission page" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Get first Manager plan" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Get first Manager plan" }));
    expect(screen.getByRole("button", { name: "Getting first Manager plan" })).toBeInTheDocument();

    resolveRun?.({
      outcome: "candidate_needs_context",
      title: "Mission candidate needs context",
      body: "The Manager needs operating context before activating work.",
      reasons: ["Budget and team capacity are missing."],
      questions: [
        {
          key: "current_priority",
          question: "What should the Manager optimize for over the next 90 days?",
          reason: "The mission changes based on the artist's current priority.",
          answerKind: "single_select",
          options: ["Market entry", "Revenue"],
        },
        {
          key: "budget_boundary",
          question: "What budget range can the Manager plan around before asking for explicit spend approval?",
          reason: "Budget posture controls the recommended plan.",
          answerKind: "money_range",
        },
      ],
      evidenceNeeded: [],
      candidateMissionId: "candidate-generated",
    });

    expect(await screen.findByRole("heading", { name: "Manager's Office." })).toBeInTheDocument();
    expect(screen.getByText("Mission candidate needs context")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Ask the Manager for a directive or review...")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(await screen.findByRole("heading", { name: "Desk HQ" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Mission Genesis needs context/i }));
    expect(await screen.findByRole("heading", { name: "Manager's Office." })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("What should the Manager optimize for over the next 90 days?"), { target: { value: "Market entry" } });
    fireEvent.change(screen.getByLabelText("What budget range can the Manager plan around before asking for explicit spend approval?"), { target: { value: "$5,000" } });
    fireEvent.click(screen.getByRole("button", { name: /continue mission genesis/i }));

    expect(await screen.findByRole("heading", { name: "Missions" })).toBeInTheDocument();
    expect(screen.getAllByText("Validate whether a rising market deserves focused operating attention").length).toBeGreaterThan(0);

    // Click the mission card to open the Mission Room
    const headings = screen.getAllByRole("heading", { name: "Validate whether a rising market deserves focused operating attention" });
    fireEvent.click(headings[0]);

    // Verify Pulse tab recommendation & summary
    expect(await screen.findByText("Use source-backed evidence before spend.")).toBeInTheDocument();
    expect(screen.getAllByText("Use saved context, audience signal, and team capacity to test whether the rising market deserves focused work.").length).toBeGreaterThan(0);

    // Navigate to the Tasks tab
    fireEvent.click(screen.getByRole("button", { name: /Tasks/i }));
    expect(screen.getByText("Verify geography signal quality")).toBeInTheDocument();
    expect(screen.getByText(/Confirm the city metrics are correct/i)).toBeInTheDocument();

    // Open task details and verify steps
    fireEvent.click(screen.getByRole("button", { name: /Show task details/i }));
    expect(screen.getByText(/Open Spotify for Artists/i)).toBeInTheDocument();
    expect(screen.getByText(/Filter by London monthly listeners/i)).toBeInTheDocument();
    expect(screen.getByText(/Compare with historical baseline/i)).toBeInTheDocument();
    expect(screen.getByText(/We might launch in a stale region/i)).toBeInTheDocument();

    // Navigate to the Checkpoints tab
    fireEvent.click(screen.getByRole("button", { name: /Checkpoints/i }));
    expect(screen.getAllByText("Market signal quality").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Is this market signal real enough?").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Verify geography signal quality").length).toBeGreaterThan(0);
  }, 20000);

  it("submits Mission Genesis context answers for the selected candidate lane", async () => {
    const repositories = repositoriesFor("Nova Vale");
    const answeredCandidates: string[] = [];
    repositories.missions = {
      ...repositories.missions,
      loadMissions: async () => [],
    };
    repositories.missionGenesis = {
      ...repositories.missionGenesis,
      runMissionGenesis: async () => ({
        outcome: "candidate_needs_context",
        title: "Two candidate missions need context",
        body: "The Manager needs you to choose which candidate lane to continue.",
        reasons: ["Multiple lanes are viable."],
        questions: [
          {
            key: "lane_priority",
            question: "Which lane should continue?",
            reason: "The continuation must target the selected candidate mission.",
            answerKind: "short_text",
          },
        ],
        evidenceNeeded: [],
        candidateMissionId: "candidate-a",
        candidateMissionIds: ["candidate-a", "candidate-b"],
      }),
      answerMissionGenesisContext: async (input) => {
        answeredCandidates.push(input.candidateMissionId);
        return {
          outcome: "no_mission",
          title: "No mission created",
          body: "The selected lane was reviewed.",
          reasons: ["No durable mission yet."],
          questions: [],
          evidenceNeeded: [],
        };
      },
    };

    render(
      <ProductionApp
        authAdapter={authWithSession(session)}
        workspaceLoader={workspaceLoaderWith(workspace)}
        repositories={repositories}
        initialView="missionsWorkspace"
      />,
    );

    expect(await screen.findByRole("heading", { name: "Missions" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Get first Manager plan" }));
    expect(await screen.findByText("Candidate mission lanes")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Candidate 2" }));
    fireEvent.change(screen.getByLabelText("Which lane should continue?"), { target: { value: "Continue the second lane" } });
    fireEvent.click(screen.getByRole("button", { name: /continue mission genesis/i }));

    await waitFor(() => expect(answeredCandidates).toEqual(["candidate-b"]));
  }, 20000);

  it("renders a directly activated Mission Genesis workstream after the mission graph reloads", async () => {
    const repositories = repositoriesFor("Nova Vale");
    let missions = [] as Awaited<ReturnType<CleanProductionRepositories["missions"]["loadMissions"]>>;
    let loadMissionsCalls = 0;
    let resolveRun: ((value: Awaited<ReturnType<CleanProductionRepositories["missionGenesis"]["runMissionGenesis"]>>) => void) | undefined;
    repositories.missions = {
      ...repositories.missions,
      loadMissions: async () => {
        loadMissionsCalls += 1;
        return missions;
      },
    };
    repositories.missionGenesis = {
      ...repositories.missionGenesis,
      runMissionGenesis: async () => new Promise((resolve) => {
        resolveRun = resolve;
      }),
    };

    render(
      <ProductionApp
        authAdapter={authWithSession(session)}
        workspaceLoader={workspaceLoaderWith(workspace)}
        repositories={repositories}
        initialView="missionsWorkspace"
      />,
    );

    expect(await screen.findByRole("heading", { name: "Missions" })).toBeInTheDocument();
    expect(screen.getByText("No active missions yet")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Get first Manager plan" }));
    expect(screen.getByRole("button", { name: "Getting first Manager plan" })).toBeInTheDocument();

    missions = [
      {
        id: "mission-feature-leverage",
        title: "Turn the Asake feature into Blaqbonez-owned leverage",
        status: "active",
        progress: 0,
        review: "Feature leverage quality",
        summary: "Use the feature moment to strengthen Blaqbonez's own public position.",
        recommendation: "Only scale activity that transfers attention back to Blaqbonez.",
        musicSubject: "Blaqbonez x Asake feature",
        nextTask: "Map the feature attention back to Blaqbonez",
        checkpoints: [
          {
            id: "checkpoint-feature-leverage",
            phase: 1,
            title: "Feature leverage quality",
            status: "Watching signal",
            question: "If the song grows but Blaqbonez's profile does not, should spend stop and the story reframe around artist identity?",
            requiredTaskIds: ["task-feature-leverage"],
            dependsOnCheckpointIds: [],
            unlocks: [],
            blockedReason: "",
            dependencyImpact: "Overshadowing risk increases if the feature story outruns Blaqbonez's identity.",
            watchedSignals: ["blaqbonez-profile-lift"],
            decisionRule: "Continue only if Blaqbonez-owned attention rises with the feature.",
            recommendation: "Protect Blaqbonez-owned leverage before scaling the collaboration.",
            resultSummary: "",
            nextAction: "Reframe around Blaqbonez's artist position if profile lift is weak.",
          },
        ],
        tasks: [
          {
            id: "task-feature-leverage",
            checkpointId: "checkpoint-feature-leverage",
            title: "Map the feature attention back to Blaqbonez",
            owner: "Manager",
            deadline: "2026-07-05",
            approvalState: "not_required",
            purpose: "Separate song-level momentum from Blaqbonez-owned audience and narrative gains.",
            steps: [
              "Compare song-level traction with Blaqbonez profile lift",
              "Identify the strongest Blaqbonez-owned story angle",
              "Choose whether to scale or reframe the feature moment",
            ],
            evidenceIds: ["blaqbonez-profile-lift"],
            dependency: "Public collaboration data",
            riskIfLate: "The feature can become Asake-led momentum without Blaqbonez-owned leverage.",
          },
        ],
      },
    ];
    resolveRun?.({
      outcome: "activate_mission",
      title: "Mission activated",
      body: "The Manager activated a focused feature leverage workstream.",
      reasons: ["The collaboration moment needs Blaqbonez-owned leverage."],
      questions: [],
      evidenceNeeded: [],
      activatedMissionId: "mission-feature-leverage",
      activatedMissionIds: ["mission-feature-leverage"],
    });

    expect(await screen.findByRole("heading", { name: "Missions" })).toBeInTheDocument();
    expect((await screen.findAllByText("Turn the Asake feature into Blaqbonez-owned leverage")).length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole("heading", { name: "Turn the Asake feature into Blaqbonez-owned leverage" })[0]);
    fireEvent.click(screen.getByRole("button", { name: /Tasks/i }));
    expect(screen.getByText("Map the feature attention back to Blaqbonez")).toBeInTheDocument();
    expect(screen.getByText(/Separate song-level momentum from Blaqbonez-owned audience/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Checkpoints/i }));
    expect(screen.getAllByText("Feature leverage quality").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/If the song grows but Blaqbonez's profile does not/i).length).toBeGreaterThan(0);
    expect(loadMissionsCalls).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText("Mission Genesis failed")).not.toBeInTheDocument();
  }, 20000);

  it("renders split Mission Genesis missions when the result only returns missionIds", async () => {
    const repositories = repositoriesFor("Nova Vale");
    let missions = [] as Awaited<ReturnType<CleanProductionRepositories["missions"]["loadMissions"]>>;
    let loadMissionsCalls = 0;
    repositories.missions = {
      ...repositories.missions,
      loadMissions: async () => {
        loadMissionsCalls += 1;
        return missions;
      },
    };
    repositories.missionGenesis = {
      ...repositories.missionGenesis,
      runMissionGenesis: async () => {
        missions = [
          {
            id: "mission-position",
            title: "Define Blaqbonez's 90-day career position",
            status: "active",
            progress: 0,
            review: "Career position quality",
            summary: "Resolve the artist position before scaling the feature moment.",
            recommendation: "Choose the career thesis that Blaqbonez should own this quarter.",
            musicSubject: "Blaqbonez",
            nextTask: "Choose the 90-day Blaqbonez position",
            checkpoints: [
              {
                id: "checkpoint-position",
                phase: 1,
                title: "Career position quality",
                status: "Watching signal",
                question: "Can the team choose Blaqbonez's owned position before campaign scale?",
                requiredTaskIds: ["task-position"],
                dependsOnCheckpointIds: [],
                unlocks: [],
                blockedReason: "",
                dependencyImpact: "Feature scale stays unfocused until the position is chosen.",
                watchedSignals: ["position-choice"],
                decisionRule: "Pass only if one owned position is chosen.",
                recommendation: "Decide the position before spend.",
                resultSummary: "",
                nextAction: "Approve the chosen position.",
              },
            ],
            tasks: [
              {
                id: "task-position",
                checkpointId: "checkpoint-position",
                title: "Choose the 90-day Blaqbonez position",
                owner: "Manager",
                deadline: "2026-07-05",
                approvalState: "not_required",
                purpose: "Make the career thesis explicit before the team scales activity.",
                steps: ["Choose the position", "Write the examples", "Reject off-thesis angles"],
                evidenceIds: ["position-choice"],
                dependency: "Artist/team approval",
                riskIfLate: "The feature moment can turn into unfocused campaign work.",
              },
            ],
          },
          {
            id: "mission-feature",
            title: "Turn the Asake feature into Blaqbonez-owned leverage",
            status: "active",
            progress: 0,
            review: "Feature leverage quality",
            summary: "Use the feature without letting the collaborator own the whole narrative.",
            recommendation: "Scale only if attention transfers back to Blaqbonez.",
            musicSubject: "Blaqbonez x Asake feature",
            nextTask: "Measure whether the feature lifts Blaqbonez",
            checkpoints: [
              {
                id: "checkpoint-feature",
                phase: 1,
                title: "Feature leverage quality",
                status: "Watching signal",
                question: "If the song grows but Blaqbonez's profile does not, should the feature plan stop or reframe?",
                requiredTaskIds: ["task-feature"],
                dependsOnCheckpointIds: [],
                unlocks: [],
                blockedReason: "",
                dependencyImpact: "The collaboration can grow without Blaqbonez-owned leverage.",
                watchedSignals: ["profile-lift"],
                decisionRule: "Continue only if Blaqbonez-owned attention rises.",
                recommendation: "Watch profile lift before scaling.",
                resultSummary: "",
                nextAction: "Reframe the story if profile lift is weak.",
              },
            ],
            tasks: [
              {
                id: "task-feature",
                checkpointId: "checkpoint-feature",
                title: "Measure whether the feature lifts Blaqbonez",
                owner: "Manager",
                deadline: "2026-07-05",
                approvalState: "not_required",
                purpose: "Separate song-level lift from Blaqbonez-owned career leverage.",
                steps: ["Compare song lift", "Compare profile lift", "Decide scale or reframe"],
                evidenceIds: ["profile-lift"],
                dependency: "Public collaboration data",
                riskIfLate: "The collaborator can own the moment.",
              },
            ],
          },
        ];
        return {
          outcome: "activate_mission",
          title: "Missions activated",
          body: "The Manager split career position and feature leverage into separate missions.",
          reasons: ["The objectives should not live in one mission."],
          questions: [],
          evidenceNeeded: [],
          missionIds: ["mission-position", "mission-feature"],
        } as any;
      },
    };

    render(
      <ProductionApp
        authAdapter={authWithSession(session)}
        workspaceLoader={workspaceLoaderWith(workspace)}
        repositories={repositories}
        initialView="missionsWorkspace"
      />,
    );

    expect(await screen.findByRole("heading", { name: "Missions" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Get first Manager plan" }));

    expect((await screen.findAllByText("Define Blaqbonez's 90-day career position")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Turn the Asake feature into Blaqbonez-owned leverage").length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole("heading", { name: "Define Blaqbonez's 90-day career position" })[0]);
    fireEvent.click(screen.getByRole("button", { name: /Tasks/i }));
    expect(screen.getByText("Choose the 90-day Blaqbonez position")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Checkpoints/i }));
    expect(screen.getAllByText("Career position quality").length).toBeGreaterThan(0);
    expect(loadMissionsCalls).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText("Mission Genesis failed")).not.toBeInTheDocument();
  }, 20000);

  it("shows the real Mission Genesis error on the Missions page when the run fails", async () => {
    const repositories = repositoriesFor("Nova Vale");
    repositories.missions = {
      ...repositories.missions,
      loadMissions: async () => [],
    };
    repositories.missionGenesis = {
      ...repositories.missionGenesis,
      runMissionGenesis: async () => {
        throw new Error("permission denied for table agent_reports");
      },
    };

    render(
      <ProductionApp
        authAdapter={authWithSession(session)}
        workspaceLoader={workspaceLoaderWith(workspace)}
        repositories={repositories}
        initialView="missionsWorkspace"
      />,
    );

    expect(await screen.findByRole("heading", { name: "Missions" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Get first Manager plan" }));

    expect(await screen.findByText("Mission Genesis failed")).toBeInTheDocument();
    expect(screen.getByText("permission denied for table agent_reports")).toBeInTheDocument();
  }, 20000);

  it("keeps unlinked Music projects quiet instead of explaining mission absence", async () => {
    const music: MusicObjectViewModel[] = [
      {
        id: "song-unlinked",
        kind: "song",
        title: "Unlinked Track",
        lifecycle: "Released",
        lifecycleStage: "Released",
        blocker: "Missing split proof",
        sourceKind: "manual",
        sourceLimit: "Test song.",
        nextMove: "Upload split proof.",
        linkedMissionIds: [],
        linkedTaskIds: [],
        linkedTaskCount: 0,
      },
      {
        id: "project-unlinked",
        kind: "project",
        title: "Unlinked Project",
        lifecycle: "Released",
        lifecycleStage: "Released",
        blocker: "Missing split proof",
        sourceKind: "manual",
        sourceLimit: "Test project.",
        nextMove: "Confirm splits.",
        linkedMissionIds: [],
        linkedTaskIds: [],
        linkedTaskCount: 0,
        songIds: ["song-unlinked"],
      },
    ];
    const repositories = repositoriesFor("Nova Vale");
    repositories.music = {
      ...repositories.music,
      loadMusic: async () => music,
    };

    render(
      <ProductionApp
        authAdapter={authWithSession(session)}
        workspaceLoader={workspaceLoaderWith(workspace)}
        repositories={repositories}
        initialView="musicWorkspace"
      />,
    );

    await screen.findByRole("heading", { name: "Catalog" });
    fireEvent.click(screen.getByRole("button", { name: "Projects" }));
    fireEvent.click(screen.getByRole("button", { name: "Open project Unlinked Project" }));
    const projectRoom = screen.getByTestId("music-project-detail");

    expect(projectRoom).toHaveTextContent("No mission linked");
    expect(projectRoom).not.toHaveTextContent("missions remain objective-first");
    expect(projectRoom).not.toHaveTextContent("Inherited blocker");
  }, 20000);

  it("shows missions in Catalog rooms when old mission data names the linked song or project", async () => {
    const music: MusicObjectViewModel[] = [
      {
        id: "song-linked-by-subject",
        kind: "song",
        title: "Signal Song",
        lifecycle: "Released",
        lifecycleStage: "Released",
        blocker: "No active blocker",
        sourceKind: "manual",
        sourceLimit: "Test song.",
        nextMove: "Open mission work.",
        linkedMissionIds: [],
        linkedTaskIds: [],
        linkedTaskCount: 0,
      },
      {
        id: "project-linked-by-track",
        kind: "project",
        title: "Signal Project",
        lifecycle: "Released",
        lifecycleStage: "Released",
        blocker: "No active blocker",
        sourceKind: "manual",
        sourceLimit: "Test project.",
        nextMove: "Open project mission work.",
        linkedMissionIds: [],
        linkedTaskIds: [],
        linkedTaskCount: 0,
        songIds: ["song-linked-by-subject"],
      },
    ];
    const missions: MissionViewModel[] = [
      {
        id: "mission-signal-song",
        title: "Push Signal Song",
        status: "active",
        progress: 35,
        review: "Song launch review",
        summary: "Move the song into active release work.",
        recommendation: "Keep Signal Song attached to this mission.",
        musicSubject: "Signal Song",
        nextTask: "Confirm launch lane.",
        tasks: [
          {
            id: "task-signal-song",
            checkpointId: "checkpoint-signal-song",
            title: "Confirm launch lane",
            owner: "Manager",
            deadline: "Next review",
            approvalState: "active",
            purpose: "Attach the mission to the song.",
            steps: [],
            evidenceIds: [],
            dependency: "None",
            riskIfLate: "Launch work becomes detached from the record.",
          },
        ],
      },
      {
        id: "mission-signal-project",
        title: "Package Signal Project",
        status: "active",
        progress: 45,
        review: "Project review",
        summary: "Move the project into a coordinated rollout.",
        recommendation: "Keep Signal Project attached to this mission.",
        musicSubject: "Signal Project",
        nextTask: "Confirm project lane.",
        tasks: [
          {
            id: "task-signal-project-1",
            checkpointId: "checkpoint-signal-project",
            title: "Confirm project lane",
            owner: "Manager",
            deadline: "Next review",
            approvalState: "active",
            purpose: "Attach the mission to the project.",
            steps: [],
            evidenceIds: [],
            dependency: "None",
            riskIfLate: "Project work becomes detached from the release.",
          },
          {
            id: "task-signal-project-2",
            checkpointId: "checkpoint-signal-project",
            title: "Prepare project proof",
            owner: "Manager",
            deadline: "Next review",
            approvalState: "active",
            purpose: "Collect the project evidence.",
            steps: [],
            evidenceIds: [],
            dependency: "None",
            riskIfLate: "Project work has no proof packet.",
          },
        ],
      },
    ];
    const repositories = repositoriesFor("Nova Vale");
    repositories.music = {
      ...repositories.music,
      loadMusic: async () => music,
    };
    repositories.missions = {
      ...repositories.missions,
      loadMissions: async () => missions,
    };

    render(
      <ProductionApp
        authAdapter={authWithSession(session)}
        workspaceLoader={workspaceLoaderWith(workspace)}
        repositories={repositories}
        initialView="musicWorkspace"
      />,
    );

    await screen.findByRole("heading", { name: "Catalog" });
    fireEvent.click(screen.getByRole("button", { name: "Open song Signal Song" }));
    const songLinkedWork = within(screen.getByTestId("music-song-detail")).getByTestId("music-linked-work");
    expect(songLinkedWork).toHaveTextContent("Push Signal Song");
    expect(songLinkedWork).toHaveTextContent("1 task attached");
    expect(songLinkedWork).not.toHaveTextContent("3 tasks");

    fireEvent.click(within(songLinkedWork).getByRole("button", { name: /Push Signal Song/i }));
    expect(await screen.findByRole("heading", { name: "Push Signal Song" })).toBeInTheDocument();
    expect(screen.queryByTestId("missions-desktop-list")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Back to Missions" }));
    fireEvent.click(within(screen.getByRole("navigation", { name: "Ordersounds Desk navigation" })).getByRole("button", { name: "Open Catalog workspace" }));
    await screen.findByRole("heading", { name: "Catalog" });
    fireEvent.click(screen.getByRole("button", { name: "Projects" }));
    fireEvent.click(screen.getByRole("button", { name: "Open project Signal Project" }));
    const projectLinkedWork = within(screen.getByTestId("music-project-detail")).getByTestId("music-linked-work");
    expect(projectLinkedWork).toHaveTextContent("Push Signal Song");
    expect(projectLinkedWork).toHaveTextContent("1 task attached");
    expect(projectLinkedWork).toHaveTextContent("Package Signal Project");
    expect(projectLinkedWork).toHaveTextContent("2 tasks attached");
    expect(projectLinkedWork).not.toHaveTextContent("3 tasks");

    fireEvent.click(within(projectLinkedWork).getByRole("button", { name: /Package Signal Project/i }));
    expect(await screen.findByRole("heading", { name: "Package Signal Project" })).toBeInTheDocument();
    expect(screen.queryByTestId("missions-desktop-list")).not.toBeInTheDocument();
  }, 20000);

  it("uses empty-state Manager read copy before a song or project has a saved read", async () => {
    const music: MusicObjectViewModel[] = [
      {
        id: "song-no-read",
        kind: "song",
        title: "No Read Song",
        lifecycle: "Ready",
        lifecycleStage: "Ready",
        blocker: "No active blocker",
        sourceKind: "manual",
        sourceLimit: "Test song.",
        nextMove: "Ask Manager for a view.",
        managerReadState: "loading",
        linkedMissionIds: [],
        linkedTaskIds: [],
        linkedTaskCount: 0,
      },
      {
        id: "project-no-read",
        kind: "project",
        title: "No Read Project",
        lifecycle: "Ready",
        lifecycleStage: "Ready",
        blocker: "No active blocker",
        sourceKind: "manual",
        sourceLimit: "Test project.",
        nextMove: "Ask Manager for a project view.",
        managerReadState: "loading",
        linkedMissionIds: [],
        linkedTaskIds: [],
        linkedTaskCount: 0,
        songIds: ["song-no-read"],
      },
    ];
    const repositories = repositoriesFor("Nova Vale");
    repositories.music = {
      ...repositories.music,
      loadMusic: async () => music,
    };

    render(
      <ProductionApp
        authAdapter={authWithSession(session)}
        workspaceLoader={workspaceLoaderWith(workspace)}
        repositories={repositories}
        initialView="musicWorkspace"
      />,
    );

    await screen.findByRole("heading", { name: "Catalog" });
    fireEvent.click(screen.getByRole("button", { name: "Open song No Read Song" }));
    const songRoom = screen.getByTestId("music-song-detail");
    expect(within(songRoom).getByRole("button", { name: "Ask Manager for a read" })).toBeInTheDocument();
    expect(songRoom).toHaveTextContent("No Manager read yet");
    expect(songRoom).toHaveTextContent("Ask Manager for a plain-English view of this song before making a move.");
    expect(songRoom).not.toHaveTextContent("Regenerate brief");

    fireEvent.click(screen.getByRole("button", { name: "Back to Catalog" }));
    fireEvent.click(screen.getByRole("button", { name: "Projects" }));
    fireEvent.click(screen.getByRole("button", { name: "Open project No Read Project" }));
    const projectRoom = screen.getByTestId("music-project-detail");
    expect(within(projectRoom).getByRole("button", { name: "Ask Manager for a project read" })).toBeInTheDocument();
    expect(projectRoom).toHaveTextContent("No Manager read yet");
    expect(projectRoom).toHaveTextContent("Ask Manager for a project-level view before turning this release into work.");
    expect(projectRoom).not.toHaveTextContent("Regenerate brief");
  }, 20000);

  it("renders a project brief under the tracklist and regenerates it from the project subject", async () => {
    const calls: Array<{ subjectId: string; subjectType: "music_item" | "music_project" }> = [];
    const music: MusicObjectViewModel[] = [
      {
        id: "song-project-1",
        kind: "song",
        title: "Focus Track",
        lifecycle: "Released",
        lifecycleStage: "Released",
        blocker: "No active blocker",
        sourceKind: "Spotify public catalog",
        sourceLimit: "Song source.",
        nextMove: "Inspect the song.",
        linkedMissionIds: [],
        linkedTaskIds: [],
        linkedTaskCount: 0,
      },
      {
        id: "project-brief-1",
        kind: "project",
        title: "Brief Project",
        lifecycle: "Released",
        lifecycleStage: "Released",
        blocker: "No inherited blockers",
        sourceKind: "manual",
        sourceLimit: "Project source.",
        situationLine: "Released EP · Focus Track is carrying the first project read",
        snapshotSummary: "We do not yet have distributor proof of listeners, saves, or source limits.",
        managerRead:
          "The project has playlist exposure, but we do not yet have distributor proof of listeners or saves, and source limits are blocking the read.",
        managerReadState: "fresh",
        confidence: "medium",
        nextMove: "Use Focus Track as the first project focus before widening the release plan.",
        intelligenceSnapshot: [
          {
            title: "Project Intelligence",
            insight: "Brief Project has a clear first track to inspect.",
            metrics: [
              {
                label: "Missing proof",
                value: "Private documents are still missing",
                context: "Spotify for Artists export",
                evidenceIds: ["bad-gap"],
              },
              { label: "Playlist count", value: "5.7K", context: "EP playlists", evidenceIds: ["playlist-count"] },
              { label: "Editorial placements", value: "24", context: "editorial playlists", evidenceIds: ["editorial"] },
              { label: "Playlist reach", value: "16.2M", context: "playlist total reach", evidenceIds: ["playlist-reach"] },
              { label: "Track count", value: "1", context: "track mapped into release", evidenceIds: ["catalog-setup"] },
            ],
          },
        ],
        linkedMissionIds: [],
        linkedTaskIds: [],
        linkedTaskCount: 0,
        songIds: ["song-project-1"],
      },
    ];
    const repositories = repositoriesFor("Nova Vale");
    repositories.music = {
      ...repositories.music,
      loadMusic: async () => music,
      generateMusicSummary: async (subjectId, subjectType) => {
        calls.push({ subjectId, subjectType });
        return {
          ...music.find((item) => item.id === subjectId)!,
          situationLine: "Generated project read - Focus Track is now the release lever.",
          managerRead: "Generated read: Brief Project should be managed around Focus Track because the project evidence now points to one clear lead record.",
          nextMove: "Move the project plan around Focus Track before widening spend.",
          managerReadState: "fresh",
          snapshotSummary: "Generated project summary from the latest packet.",
          intelligenceSnapshot: [
            {
              title: "Generated Project Read",
              insight: "Focus Track is now the project's lead management lever.",
              metrics: [{ label: "Lead track", value: "Focus Track", context: "generated read", evidenceIds: ["generated-ev"] }],
            },
          ],
        };
      },
    };

    render(
      <ProductionApp
        authAdapter={authWithSession(session)}
        workspaceLoader={workspaceLoaderWith(workspace)}
        repositories={repositories}
        initialView="musicWorkspace"
      />,
    );

    await screen.findByRole("heading", { name: "Catalog" });
    fireEvent.click(screen.getByRole("button", { name: "Projects" }));
    fireEvent.click(screen.getByRole("button", { name: "Open project Brief Project" }));
    const projectRoom = screen.getByTestId("music-project-detail");

    const tracklistLabel = within(projectRoom).getByText("Tracklist");
    const briefLabel = within(projectRoom).getByText("Project Intelligence");
    expect(tracklistLabel.compareDocumentPosition(briefLabel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(projectRoom).toHaveTextContent("Released EP · Focus Track is carrying the first project read");
    expect(projectRoom).toHaveTextContent("No Manager read yet");
    expect(projectRoom).toHaveTextContent("Ask Manager for a project-level view before turning this release into work.");
    expect(projectRoom).toHaveTextContent("Playlist count");
    expect(projectRoom).toHaveTextContent("5.7K");
    expect(projectRoom).toHaveTextContent("Editorial placements");
    expect(projectRoom).toHaveTextContent("24");
    expect(projectRoom).toHaveTextContent("Playlist reach");
    expect(projectRoom).toHaveTextContent("16.2M");
    expect(projectRoom).toHaveTextContent("Track count");
    expect(projectRoom).toHaveTextContent("1");
    expect(projectRoom).toHaveTextContent("Fresh");
    expect(projectRoom).not.toHaveTextContent("The Manager read is being refreshed");
    expect(projectRoom).not.toHaveTextContent("Spotify public catalog");
    expect(within(projectRoom).getByTestId("music-linked-work")).toHaveClass("self-start", "lg:sticky", "lg:top-8");
    expect(projectRoom).not.toHaveTextContent("Missing proof");
    expect(projectRoom).not.toHaveTextContent("Private documents");
    expect(projectRoom).not.toHaveTextContent("Spotify for Artists");
    expect(projectRoom).not.toHaveTextContent("distributor proof");
    expect(projectRoom).not.toHaveTextContent("source limits");

    fireEvent.click(within(projectRoom).getByRole("button", { name: "Ask Manager for a project read" }));

    await waitFor(() => {
      expect(calls).toEqual([{ subjectId: "project-brief-1", subjectType: "music_project" }]);
    });
    expect(projectRoom).toHaveTextContent("Generated read: Brief Project should be managed around Focus Track");
    expect(projectRoom).toHaveTextContent("Generated project summary from the latest packet.");
  }, 20000);

  it("exposes production Catalog create and upload actions in context", async () => {
    await enterDeskHq();

    const rail = screen.getByRole("navigation", { name: "Ordersounds Desk navigation" });
    fireEvent.click(within(rail).getByRole("button", { name: "Open Catalog workspace" }));

    expect(screen.getByRole("button", { name: "Add song" })).toHaveTextContent("");
    expect(screen.queryByRole("button", { name: "Create music" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Back to Desk HQ" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add project" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add song" }));
    // The Add action first offers a choice between manual creation and Spotify import.
    expect(screen.getByRole("dialog", { name: "Add song to catalogue" })).toBeInTheDocument();
    expect(screen.getByTestId("music-workspace-content")).toHaveClass("blur-[6px]");
    expect(screen.getByRole("button", { name: "Import from Spotify" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Create manually" }));

    expect(screen.getByRole("dialog", { name: "Add song" })).toBeInTheDocument();
    expect(screen.getByTestId("music-workspace-content")).toHaveClass("blur-[6px]");
    expect(screen.getByLabelText("Song title")).toBeInTheDocument();
    expect(screen.getByLabelText("Song type")).toBeInTheDocument();
    expect(screen.getByLabelText("Lifecycle stage")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByTestId("music-workspace-content")).not.toHaveClass("blur-[6px]");
    fireEvent.click(screen.getByRole("button", { name: "Projects" }));
    expect(screen.getByRole("button", { name: "Add project" })).toHaveTextContent("");
    expect(screen.queryByRole("button", { name: "Add song" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Songs" }));
    fireEvent.click(screen.getByRole("button", { name: "Open song Night Bus" }));
    fireEvent.click(within(screen.getByTestId("music-song-detail")).getByRole("button", { name: "files" }));
    expect(screen.getByRole("button", { name: "Replace Final master" })).toHaveTextContent("");
    expect(screen.getByRole("button", { name: "Upload Split sheet document" })).toHaveTextContent("");

    fireEvent.click(screen.getByRole("button", { name: "Upload Split sheet document" }));
    expect(screen.getByRole("dialog", { name: "Upload Split sheet document" })).toBeInTheDocument();
    expect(screen.queryByText("File")).not.toBeInTheDocument();
    expect(screen.getByTestId("music-workspace-content")).toHaveClass("blur-[6px]");
    fireEvent.change(screen.getByLabelText("File"), {
      target: { files: [new File(["split"], "night-bus-splits.pdf", { type: "application/pdf" })] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Upload" }));
    expect(await screen.findByText("3/3 ready")).toBeInTheDocument();

    fireEvent.click(within(screen.getByTestId("music-song-detail")).getByRole("button", { name: "details" }));
    expect(screen.queryByRole("button", { name: "Edit Genre" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit ISRC" })).toHaveTextContent("");
    expect(screen.getByRole("button", { name: "Edit Mix engineer" })).toHaveTextContent("");
  }, 20000);

  it("opens the Spotify import dialog from the Add chooser", async () => {
    await enterDeskHq();

    const rail = screen.getByRole("navigation", { name: "Ordersounds Desk navigation" });
    fireEvent.click(within(rail).getByRole("button", { name: "Open Catalog workspace" }));

    fireEvent.click(screen.getByRole("button", { name: "Add song" }));
    fireEvent.click(screen.getByRole("button", { name: "Import from Spotify" }));

    // The import dialog mounts and loads the (fixture-empty) catalogue.
    expect(await screen.findByRole("dialog", { name: "Import song from Spotify" })).toBeInTheDocument();
    expect(await screen.findByText("No Spotify releases found for this artist.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog", { name: "Import song from Spotify" })).not.toBeInTheDocument();
  }, 20000);

  it("keeps upload failures visible inside the Catalog upload modal", async () => {
    const failingSong: MusicObjectViewModel = {
      id: "song-upload-failure",
      kind: "song",
      title: "Upload Failure",
      lifecycle: "Ready",
      lifecycleStage: "Ready",
      blocker: "Missing split proof",
      sourceKind: "manual",
      sourceLimit: "Test song.",
      nextMove: "Upload split proof.",
      linkedMissionIds: [],
      linkedTaskCount: 0,
      fileAssets: [
        { group: "Splits", label: "Split sheet document", status: "Missing", action: "Upload split sheet", assetType: "split_sheet", canUpload: true },
      ],
      files: [{ label: "Split sheet document", status: "Missing" }],
    };
    const repositories = repositoriesFor("Nova Vale");
    repositories.music = {
      ...repositories.music,
      loadMusic: async () => [failingSong],
      uploadAsset: async () => {
        throw new Error("Storage upload failed");
      },
    };

    render(
      <ProductionApp
        authAdapter={authWithSession(session)}
        workspaceLoader={workspaceLoaderWith(workspace)}
        repositories={repositories}
        initialView="musicWorkspace"
      />,
    );

    await screen.findByRole("heading", { name: "Catalog" });
    fireEvent.click(screen.getByRole("button", { name: "Open song Upload Failure" }));
    fireEvent.click(within(screen.getByTestId("music-song-detail")).getByRole("button", { name: "files" }));
    fireEvent.click(screen.getByRole("button", { name: "Upload Split sheet document" }));
    fireEvent.change(screen.getByLabelText("File"), {
      target: { files: [new File(["split"], "split.pdf", { type: "application/pdf" })] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Upload" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Storage upload failed");
    expect(screen.getByRole("dialog", { name: "Upload Split sheet document" })).toBeInTheDocument();
  }, 20000);

  it("keeps the song overview as a prose read without duplicating the Details tab", async () => {
    const summarySong: MusicObjectViewModel = {
      id: "song-summary",
      kind: "song",
      title: "Source Proof",
      lifecycle: "released",
      lifecycleStage: "Released",
      blocker: "No active blocker",
      sourceKind: "spotify_public_catalog",
      sourceLimit: "Spotify public catalog supports identity, catalog, and public metadata only.",
      situationLine: "Released song · Listening increased this week · Split proof is clear",
      managerRead:
        "Source Proof is the record with the clearest playlist doorway right now: 12,500 people can be reached from the current playlist base, and the release spine is clean enough to make the read about audience behavior instead of setup hygiene. I would use this record as the first music focus and watch whether the playlist lift keeps creating real listening over the next week.",
      nextMove: "Use Source Proof as the first music focus and watch whether the playlist lift keeps creating real listening over the next week.",
      watchNext: "Check whether listening stays up next week.",
      managerReadState: "fresh",
      intelligenceSnapshot: [
        {
          title: "Record Intelligence",
          insight: "Chartmetric third-party APIs say Source Proof has a playlist doorway worth watching this week.",
          metrics: [
            {
              label: "Missing proof",
              value: "Territory streaming and save behavior still needs the private document",
              context: "Spotify for Artists export",
              evidenceIds: ["bad-source-gap"],
            },
            {
              label: "Features and releases",
              value: "Career help across releases and collaborations",
              context: "long sentence value that does not belong in a compact metric table",
              evidenceIds: ["bad-long-copy"],
            },
            { label: "Playlist reach", value: "12.5K", context: "people reachable from current playlists", evidenceIds: ["evidence-1"] },
            { label: "Release state", value: "Live", context: "public record is available", evidenceIds: ["catalog-setup"] },
          ],
        },
      ],
      snapshotSummary: "Chartmetric third-party APIs say Source Proof has a playlist doorway worth watching this week.",
      linkedMissionIds: [],
      linkedTaskCount: 0,
      sourceSummary: {
        headline: "Source Proof is a Released song backed by Spotify public catalog and Chartmetric evidence.",
        badges: ["Spotify", "Chartmetric"],
        facts: [
          { label: "Spotify track ID", value: "spotify-track-1", source: "Spotify", status: "Confirmed" },
          { label: "ISRC", value: "USNV12600010", source: "Spotify", status: "Confirmed" },
        ],
        evidence: [
          {
            label: "Spotify playlist reach",
            value: "12500 listeners",
            source: "Chartmetric",
            window: "Last 7 days",
            limitation: "Chartmetric public/social intelligence can report supported platform metrics, but does not prove private saves, source-of-stream, revenue, conversion, or campaign ROI.",
          },
        ],
        limitations: [
          "Private analytics are still missing: streams, saves, listeners, source-of-stream, revenue, conversion, and campaign ROI are not proven by these sources.",
        ],
      },
    };
    const repositories = repositoriesFor("Nova Vale");
    repositories.music = {
      ...repositories.music,
      loadMusic: async () => [summarySong],
    };

    render(
      <ProductionApp
        authAdapter={authWithSession(session)}
        workspaceLoader={workspaceLoaderWith(workspace)}
        repositories={repositories}
        initialView="musicWorkspace"
      />,
    );

    await screen.findByRole("heading", { name: "Catalog" });
    fireEvent.click(screen.getByRole("button", { name: "Open song Source Proof" }));
    const songRoom = screen.getByTestId("music-song-detail");

    expect(songRoom).toHaveTextContent("Manager's Read");
    expect(songRoom).toHaveTextContent("Record Intelligence");
    expect(songRoom).toHaveTextContent("Source Proof is the record with the clearest playlist doorway");
    expect(songRoom).toHaveTextContent("12.5K");
    expect(songRoom).toHaveTextContent("Released song · Listening increased this week · Split proof is clear");
    expect(songRoom).toHaveTextContent("Fresh");
    expect(within(songRoom).getByTestId("music-linked-work")).toHaveClass("self-start", "lg:sticky", "lg:top-8");
    expect(songRoom.querySelectorAll('[data-testid="manager-read-copy"]')).toHaveLength(1);
    expect(songRoom).not.toHaveTextContent("Chartmetric");
    expect(songRoom).not.toHaveTextContent("third-party");
    expect(songRoom).not.toHaveTextContent("APIs");
    expect(songRoom).not.toHaveTextContent("Missing proof");
    expect(songRoom).not.toHaveTextContent("Territory streaming");
    expect(songRoom).not.toHaveTextContent("Spotify for Artists");
    expect(songRoom).not.toHaveTextContent("Features and releases");
    expect(songRoom).not.toHaveTextContent("Career help");
    expect(songRoom).not.toHaveTextContent("What I am watching");
    expect(songRoom).not.toHaveTextContent("Next Move");
    expect(songRoom).not.toHaveTextContent("Chartmetric adds public movement context");
    expect(songRoom).not.toHaveTextContent("Source-backed song summary");
    expect(songRoom).not.toHaveTextContent("Spotify track ID");
    expect(songRoom).not.toHaveTextContent("spotify-track-1");
    expect(songRoom).not.toHaveTextContent("Private analytics are still missing");
    expect(songRoom).not.toHaveTextContent("source-of-stream");
    expect(songRoom).not.toHaveTextContent("repeat listeners");
    expect(songRoom).not.toHaveTextContent("Spotify streams 12500");
    expect(songRoom).not.toHaveTextContent("Campaign ROI proven");
  }, 20000);

  it("uses the production split ledger flow in the Music rights tab", async () => {
    const actions: string[] = [];
    let music: MusicObjectViewModel[] = [
      {
        id: "song-splits",
        kind: "song",
        title: "Split Ready",
        lifecycle: "Ready",
        lifecycleStage: "Ready",
        blocker: "Missing split proof",
        sourceKind: "manual",
        sourceLimit: "Test song.",
        nextMove: "Confirm split details.",
        linkedMissionIds: [],
        linkedTaskCount: 0,
        splits: {
          status: "Draft",
          summary: "Balance shares before sending.",
          publishingTotal: "100%",
          masterTotal: "100%",
          contributors: [
            { id: "contributor-1", name: "Nova Vale", role: "Artist / writer", email: "nova@example.com", publishingShare: "50%", masterShare: "70%", approval: "Draft" },
            { id: "contributor-2", name: "Mara Vale", role: "Producer / writer", email: "mara@example.com", publishingShare: "50%", masterShare: "30%", approval: "Draft" },
          ],
        },
      },
    ];
    const repositories = repositoriesFor("Nova Vale");
    repositories.music = {
      ...repositories.music,
      loadMusic: async () => music,
      saveSplitContributor: async (_songId, input) => {
        actions.push(`save:${input.name}:${input.email}:${input.publishingShare}:${input.masterShare}`);
        music = music.map((item) => item.id === "song-splits" ? {
          ...item,
          splits: {
            ...item.splits!,
            contributors: [...item.splits!.contributors, {
              id: "contributor-3",
              name: input.name,
              role: input.role,
              email: input.email,
              publishingShare: `${input.publishingShare}%`,
              masterShare: `${input.masterShare}%`,
              approval: "Draft",
            }],
          },
        } : item);
      },
      removeSplitContributor: async (_songId, contributorId) => {
        actions.push(`remove:${contributorId}`);
      },
      sendSplitConfirmationLinks: async () => {
        actions.push("send");
        music = music.map((item) => item.id === "song-splits" ? {
          ...item,
          splits: {
            ...item.splits!,
            status: "Pending Confirmation",
            summary: "Split confirmation links sent. Waiting for collaborators to confirm their shares.",
            contributors: item.splits!.contributors.map((contributor) => ({ ...contributor, approval: "Pending" })),
          },
        } : item);
      },
    };

    render(
      <ProductionApp
        authAdapter={authWithSession(session)}
        workspaceLoader={workspaceLoaderWith(workspace)}
        repositories={repositories}
        initialView="musicWorkspace"
      />,
    );

    await screen.findByRole("heading", { name: "Catalog" });
    fireEvent.click(screen.getByRole("button", { name: "Open song Split Ready" }));
    fireEvent.click(within(screen.getByTestId("music-song-detail")).getByRole("button", { name: "rights" }));

    expect(screen.getByText("Publishing / composition 100% / 100%")).toBeInTheDocument();
    expect(screen.getByText("Master recording 100% / 100%")).toBeInTheDocument();
    expect(screen.getByText("nova@example.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send split confirmation links" })).toBeEnabled();

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Lena Cruz" } });
    fireEvent.change(screen.getByLabelText("Email (for signature request)"), { target: { value: "lena@example.com" } });
    fireEvent.change(screen.getByLabelText("Publishing / composition %"), { target: { value: "0" } });
    fireEvent.change(screen.getByLabelText("Master recording %"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Add collaborator" }));
    await waitFor(() => expect(actions).toContain("save:Lena Cruz:lena@example.com:0:0"));

    fireEvent.click(screen.getByRole("button", { name: "Send split confirmation links" }));
    await waitFor(() => expect(actions).toContain("send"));
    expect(await screen.findByText("Split confirmation links sent. Waiting for collaborators to confirm their shares.")).toBeInTheDocument();
    expect(screen.getAllByText("Pending").length).toBeGreaterThan(0);
  }, 20000);

  it("renders Staff, Missions, Settings, and contextual evidence without top-level evidence navigation", async () => {
    await enterDeskHq();

    const rail = screen.getByRole("navigation", { name: "Ordersounds Desk navigation" });
    expect(within(rail).queryByRole("button", { name: "Evidence" })).not.toBeInTheDocument();

    fireEvent.click(within(rail).getByRole("button", { name: "Team Agents" }));
    expect(screen.getByRole("heading", { name: "Artist Team Agents" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Marketing Lead" }));
    expect(screen.getByRole("heading", { name: "Marketing Lead is not live yet." })).toBeInTheDocument();
    expect(screen.getByText("This specialist desk is locked while the first AI Manager experience is being tested.")).toBeInTheDocument();
    expect(screen.queryByText("Source rail")).not.toBeInTheDocument();

    fireEvent.click(within(rail).getByRole("button", { name: "Missions" }));
    expect(screen.getByRole("heading", { name: "Missions" })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: /Release Night Bus on June 12/i })[0]);
    expect(screen.getByText("What is happening")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Tasks/i }));
    expect(screen.getAllByText("Tasks under this checkpoint").length).toBeGreaterThan(0);
    expect(screen.getByText("Confirm split sheet")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Checkpoints/i }));
    expect(screen.getByTestId("checkpoint-inspector")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mission recap" }));
    expect(screen.getByText(/living recap of the mission/i)).toBeInTheDocument();

    fireEvent.click(within(rail).getByRole("button", { name: "Settings" }));
    expect(screen.getByRole("heading", { name: "Artist profile." })).toBeInTheDocument();
  }, 20000);

  it("opens Missions from the sidebar when no missions exist yet", async () => {
    const repositories = repositoriesFor("Nova Vale");

    render(
      <ProductionApp
        authAdapter={authWithSession(session)}
        workspaceLoader={workspaceLoaderWith(workspace)}
        repositories={repositories}
        initialView="labelHQ"
      />,
    );

    expect(await screen.findByRole("heading", { name: "Desk HQ" })).toBeInTheDocument();

    const rail = screen.getByRole("navigation", { name: "Ordersounds Desk navigation" });
    fireEvent.click(within(rail).getByRole("button", { name: "Missions" }));

    expect(screen.getByRole("heading", { name: "Missions" })).toBeInTheDocument();
    expect(screen.getByText("No active missions yet")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Get first Manager plan" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /Run Mission Genesis/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Test mission page" })).not.toBeInTheDocument();
  }, 20000);

  it("reduces Mission Pulse to recommendation and next required action", async () => {
    const mission: MissionViewModel = {
      id: "mission-market-proof",
      title: "Touring Plan - Market Selection & Low-Risk Live Test",
      status: "blocked",
      progress: 5,
      review: "Nigeria Market Proof (Lagos + Abuja)",
      summary: "Validate city-level demand before any promoter deposit is released.",
      recommendation: "Keep mission active. Manager and Label Liaison must produce export confirmation before Touring Ops collects promoter quotes.",
      musicSubject: "No linked music subject",
      nextTask: "Commission Data Lead power check & smartlink mapping",
      checkpoints: [
        {
          id: "checkpoint-market-proof",
          phase: 1,
          title: "Nigeria Market Proof (Lagos + Abuja)",
          status: "Needs revision",
          question: "Is city demand strong enough to unlock touring quotes?",
          requiredTaskIds: ["task-power-check"],
          dependsOnCheckpointIds: [],
          unlocks: ["Promoter quote collection"],
          blockedReason: "Private exports and Shazam heatmap snapshots are missing.",
          dependencyImpact: "Touring Ops should not collect promoter quotes until this proof exists.",
          watchedSignals: ["Spotify city export", "Shazam heatmap", "Smartlink geography"],
          decisionRule: "Do not advance without verifiable geography evidence.",
          recommendation: "Keep the checkpoint blocked until export proof exists.",
          resultSummary: "The blocker is still open.",
          nextAction: "Commission Data Lead power check & smartlink mapping",
        },
      ],
      tasks: [],
      notes: [],
      events: [],
    };
    const repositories = repositoriesFor("Nova Vale");
    repositories.missions.loadMissions = async () => [mission];

    render(
      <ProductionApp
        authAdapter={authWithSession(session)}
        workspaceLoader={workspaceLoaderWith(workspace)}
        repositories={repositories}
        initialView="missionsWorkspace"
      />,
    );

    expect(await screen.findByRole("heading", { name: "Missions" })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: /Touring Plan - Market Selection/i })[0]);

    const pulse = await screen.findByTestId("mission-pulse");
    expect(pulse).toHaveTextContent("Recommendation");
    expect(pulse).toHaveTextContent("Next Required Action");
    expect(pulse).toHaveTextContent("Commission Data Lead power check & smartlink mapping");
    expect(pulse).toHaveTextContent("Private exports and Shazam heatmap snapshots are missing.");
    expect(pulse).not.toHaveTextContent("What changed");
    expect(pulse).not.toHaveTextContent("Mission state");
    expect(within(pulse).queryByRole("button", { name: "Mission recap" })).not.toBeInTheDocument();
    expect(within(pulse).queryByRole("button", { name: "View evidence" })).not.toBeInTheDocument();
  }, 20000);

  it("renders mission cards as compact task-first entries", async () => {
    const mission: MissionViewModel = {
      id: "mission-compact-list",
      title: "Define the first repeatable release lane",
      status: "active",
      progress: 35,
      review: "Approve release lane before external pitching",
      summary: "This long mission summary should not make the mission list feel like a dashboard card.",
      recommendation: "Keep the lane active and finish owner-ready task setup.",
      musicSubject: "Release lane",
      nextTask: "Confirm the release owner",
      checkpoints: [
        {
          id: "checkpoint-release-lane",
          phase: 1,
          title: "Release lane clarity",
          status: "Waiting on tasks",
          question: "Is the release lane clear enough to brief the team?",
          requiredTaskIds: ["task-owner", "task-assets"],
          dependsOnCheckpointIds: [],
          unlocks: ["Pitch package"],
          blockedReason: "",
          dependencyImpact: "External pitching waits for owner clarity.",
          watchedSignals: ["owner", "assets"],
          decisionRule: "Advance only after owner and asset tasks are done.",
          recommendation: "Finish the release lane tasks.",
          resultSummary: "The lane still needs task results.",
          nextAction: "Confirm the release owner",
        },
      ],
      tasks: [
        {
          id: "task-owner",
          checkpointId: "checkpoint-release-lane",
          title: "Confirm the release owner",
          owner: "Manager",
          deadline: "Today",
          approvalState: "active",
          purpose: "Make sure the lane has a single accountable owner.",
          steps: ["Name owner"],
          evidenceIds: [],
          dependency: "Manager decision",
          riskIfLate: "The lane remains unclear.",
        },
        {
          id: "task-assets",
          checkpointId: "checkpoint-release-lane",
          title: "Collect release assets",
          owner: "Creative Lead",
          deadline: "Tomorrow",
          approvalState: "active",
          purpose: "Make sure pitching has usable assets.",
          steps: ["Collect assets"],
          evidenceIds: [],
          dependency: "Owner clarity",
          riskIfLate: "Pitching slips.",
        },
      ],
      notes: [
        {
          id: "note-release-lane",
          route: "Manager -> Creative Lead",
          subject: "Release lane setup",
          message: "Assets are needed.",
          status: "active",
          sourceBasis: "Manager review",
          recommendedAction: "Collect assets",
          resultingChange: "Created task",
          briefType: "handoff",
        },
      ],
      events: [],
    };
    const repositories = repositoriesFor("Nova Vale");
    repositories.missions.loadMissions = async () => [mission];

    render(
      <ProductionApp
        authAdapter={authWithSession(session)}
        workspaceLoader={workspaceLoaderWith(workspace)}
        repositories={repositories}
        initialView="missionsWorkspace"
      />,
    );

    expect(await screen.findByRole("heading", { name: "Missions" })).toBeInTheDocument();
    const missionCard = screen.getAllByRole("button", { name: /Define the first repeatable release lane/i })[0];

    expect(within(missionCard).getByText("2 open tasks")).toBeInTheDocument();
    expect(within(missionCard).getByText("35%")).toBeInTheDocument();
    expect(within(missionCard).queryByText("Checkpoints")).not.toBeInTheDocument();
    expect(within(missionCard).queryByText("Handoffs")).not.toBeInTheDocument();
  }, 20000);

  it("keeps the mission room mobile masthead and tabs compact", async () => {
    const mission: MissionViewModel = {
      id: "mission-mobile-compact",
      title: "Build the compact mobile mission room",
      status: "active",
      progress: 40,
      review: "Confirm mobile hierarchy",
      summary: "This summary should live in Pulse, not in the compact mobile masthead.",
      recommendation: "Keep the mobile room focused on the next action.",
      musicSubject: "Mobile room",
      nextTask: "Ship mobile hierarchy",
      checkpoints: [
        {
          id: "checkpoint-mobile-one",
          phase: 1,
          title: "Mobile hierarchy",
          status: "Waiting on tasks",
          question: "Does mobile show useful work quickly?",
          requiredTaskIds: ["task-mobile-one"],
          dependsOnCheckpointIds: [],
          unlocks: ["Review"],
          blockedReason: "",
          dependencyImpact: "The room stays heavy until this is fixed.",
          watchedSignals: ["layout"],
          decisionRule: "Pass when content is reachable without wrapped tabs.",
          recommendation: "Compact the header.",
          resultSummary: "Needs layout work.",
          nextAction: "Ship mobile hierarchy",
        },
        {
          id: "checkpoint-mobile-two",
          phase: 2,
          title: "Follow-up review",
          status: "Waiting on tasks",
          question: "Does the second checkpoint stay out of the mobile task dump?",
          requiredTaskIds: ["task-mobile-two"],
          dependsOnCheckpointIds: [],
          unlocks: ["Done"],
          blockedReason: "",
          dependencyImpact: "Mobile should not show every task group at once.",
          watchedSignals: ["task list"],
          decisionRule: "Pass when inactive groups are hidden on mobile.",
          recommendation: "Show one group on mobile.",
          resultSummary: "Waiting.",
          nextAction: "Review the second group",
        },
      ],
      tasks: [
        {
          id: "task-mobile-one",
          checkpointId: "checkpoint-mobile-one",
          title: "Ship mobile hierarchy",
          owner: "Manager",
          deadline: "Today",
          approvalState: "active",
          purpose: "Make the first task reachable.",
          steps: ["Compact header"],
          evidenceIds: [],
          dependency: "Mission room",
          riskIfLate: "Mobile remains hard to scan.",
        },
        {
          id: "task-mobile-two",
          checkpointId: "checkpoint-mobile-two",
          title: "Review the second group",
          owner: "Manager",
          deadline: "Tomorrow",
          approvalState: "active",
          purpose: "Confirm the hidden group remains reachable through the stepper.",
          steps: ["Open checkpoint"],
          evidenceIds: [],
          dependency: "Checkpoint one",
          riskIfLate: "The task view stays cluttered.",
        },
      ],
      notes: [],
      events: [],
    };
    const repositories = repositoriesFor("Nova Vale");
    repositories.missions.loadMissions = async () => [mission];

    render(
      <ProductionApp
        authAdapter={authWithSession(session)}
        workspaceLoader={workspaceLoaderWith(workspace)}
        repositories={repositories}
        initialView="missionsWorkspace"
      />,
    );

    expect(await screen.findByRole("heading", { name: "Missions" })).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: /Build the compact mobile mission room/i })[0]);

    const commandBar = screen.getByTestId("mission-command-bar");
    expect(commandBar).toHaveTextContent("40% / 2 open tasks");
    expect(commandBar).toHaveTextContent("Build the compact mobile mission room");

    const tabRail = screen.getByTestId("mobile-mission-tabs");
    expect(tabRail).toHaveClass("overflow-x-auto");
    expect(tabRail).not.toHaveClass("flex-wrap");

    fireEvent.click(screen.getByRole("button", { name: /Tasks/i }));
    expect(screen.getByTestId("task-group-checkpoint-mobile-one")).not.toHaveClass("max-lg:hidden");
    expect(screen.getByTestId("task-group-checkpoint-mobile-two")).toHaveClass("max-lg:hidden");
  }, 20000);

  it("keeps production code prototype-parity styled without independent os-* UI classes", () => {
    const productionFiles = readProductionFiles();

    for (const file of productionFiles) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/\bos-[a-z0-9-]+/);
    }
  });

  it("removes prototype-specific test coverage from the production suite", () => {
    const testFiles = readSourceTestFiles().filter((file) => !file.endsWith("production-app-shell.test.tsx"));
    const prototypeComponentPattern = new RegExp(["AiLabel", "Prototype"].join(""));
    const prototypeImportPattern = new RegExp(["prototype", "AiLabel", "Prototype"].join(".*"));

    for (const file of testFiles) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(prototypeComponentPattern);
      expect(source, file).not.toMatch(prototypeImportPattern);
    }
  });

  it("keeps fixture repositories opt-in for production runtime", () => {
    const source = readFileSync(join(process.cwd(), "src", "app", "ProductionApp.tsx"), "utf8");

    expect(source).not.toContain("repositories ?? createFixtureRepositories()");
    expect(source).toContain("shouldUseFixtureRuntime");
  });

  it("defines light and dark values for production semantic tokens", () => {
    const css = readFileSync(join(process.cwd(), "src", "index.css"), "utf8");

    for (const token of [
      "--os-bg",
      "--os-foreground",
      "--os-muted",
      "--os-panel",
      "--os-line",
      "--os-accent",
      "--os-success",
      "--os-warning",
      "--os-danger",
      "--os-radius-panel",
      "--os-shadow-soft",
    ]) {
      expect(css).toContain(token);
    }

    expect(css).toContain(".dark");
    expect(css).toContain("--os-bg:");
  });
});

async function enterDeskHq() {
  render(<ProductionApp fixtureMode initialView="connectArtist" />);

  await screen.findByRole("heading", { name: "Connect artist profile" });
  fireEvent.click(screen.getByRole("button", { name: "Continue to artist context" }));
  fireEvent.click(screen.getByRole("button", { name: "Enter Desk HQ" }));
}

function openManagerFromDesk() {
  fireEvent.click(within(screen.getByRole("navigation", { name: "Ordersounds Desk navigation" })).getByRole("button", { name: "Team Agents" }));
  fireEvent.click(screen.getByRole("button", { name: "AI Manager" }));
}

function authWithSession(result: Awaited<ReturnType<ProductionAuthAdapter["getSession"]>>): ProductionAuthAdapter {
  return {
    getSession: async () => result,
  };
}

function authWithPendingSession(): ProductionAuthAdapter {
  return {
    getSession: async () => new Promise(() => undefined),
  };
}

function authWithPendingPasswordSignIn(signIns: string[]): ProductionAuthAdapter {
  return {
    getSession: async () => ({ user: null }),
    async signInWithPassword({ email, password }) {
      signIns.push(`${email}|${password}`);
      return new Promise(() => undefined);
    },
  };
}

function authWithSessionAndSignOut(
  result: Awaited<ReturnType<ProductionAuthAdapter["getSession"]>>,
  signOut: () => Promise<void>,
): ProductionAuthAdapter {
  return {
    getSession: async () => result,
    signOut,
  };
}

function authWithoutSession(): ProductionAuthAdapter {
  return {
    getSession: async () => ({ user: null }),
  };
}

function workspaceLoaderWith(workspaceResult: Awaited<ReturnType<ProductionWorkspaceLoader["loadActiveWorkspace"]>>) {
  return {
    calls: 0,
    async loadActiveWorkspace() {
      this.calls += 1;
      return workspaceResult;
    },
  } satisfies ProductionWorkspaceLoader & { calls: number };
}

function workspaceLoaderWithClonedResults(workspaceResult: ProductionWorkspace) {
  return {
    calls: 0,
    async loadActiveWorkspace() {
      this.calls += 1;
      return { ...workspaceResult };
    },
  } satisfies ProductionWorkspaceLoader & { calls: number };
}

function spotifyAdapterWithAsyncConnect(connectedArtists: Array<{ workspace: ProductionWorkspace; artist: string }>): ProductionSpotifyArtistAdapter {
  return {
    async searchArtists(query) {
      if (query.trim().toLowerCase() !== "nova") {
        return [];
      }

      return [
        {
          spotifyArtistId: "spotify-artist-1",
          name: "Nova Vale",
          spotifyUrl: "https://open.spotify.com/artist/spotify-artist-1",
          spotifyUri: "spotify:artist:spotify-artist-1",
          followers: 42000,
          genres: ["afro-fusion"],
          imageUrl: "https://i.scdn.co/image/nova",
        },
      ];
    },
    async previewCatalog(candidate) {
      return {
        artist: {
          spotifyArtistId: candidate.spotifyArtistId,
          name: candidate.name,
          spotifyUrl: candidate.spotifyUrl,
          imageUrl: candidate.imageUrl,
        },
        standaloneSingles: [],
      };
    },
    async connectArtist(nextWorkspace, candidate) {
      connectedArtists.push({ workspace: nextWorkspace, artist: candidate.name });
      return {
        ...nextWorkspace,
        artistName: candidate.name,
        spotifyConnected: true,
        spotifyArtistId: candidate.spotifyArtistId,
        spotifyArtistName: candidate.name,
        spotifyArtistUrl: candidate.spotifyUrl,
        spotifyImageUrl: candidate.imageUrl,
        contextComplete: false,
        latestCatalogSyncStatus: "running",
      };
    },
    async bootstrapCatalog(nextWorkspace, candidate) {
      throw new Error(`Catalog import should not block artist selection for ${candidate.name} in ${nextWorkspace.workspaceName}.`);
    },
  };
}

function repositoriesFor(
  artistName: string,
  overrides: Partial<ArtistProfileViewModel> = {},
): CleanProductionRepositories {
  const profile = {
    name: artistName,
    spotify: `${artistName} - Spotify public catalog`,
    genre: "Afro-fusion",
    market: "Lagos",
    release: "Spotify catalog import",
    goal: "Build the artist operating plan from public catalog context and user-supplied constraints.",
    budget: "$3,000",
    stage: "Emerging artist with catalog traction",
    tiktok: "",
    instagram: "",
    youtube: "",
    x: "",
    imageUrl: "https://i.scdn.co/image/nova",
    ...overrides,
  };
  const todayBrief = (state: "fresh" | "fallback" = "fallback"): TodayBriefViewModel => ({
    headlineRead: `${artistName}'s first management read has a clear starting point.`,
    intelligenceSnapshot: [
      {
        title: "Current Music In View",
        insight: "The saved setup gives the team enough context to choose a first management focus.",
        metrics: [
          { label: "Artist profile", value: "Saved", context: "setup context", evidenceIds: ["profile"] },
          { label: "Working catalog", value: "In view", context: "current focus", evidenceIds: ["catalog"] },
        ],
      },
    ],
    snapshotSummary: "The first read is ready to organize the workspace around one focused lane.",
    managerRead: `This is the first operating read for ${artistName}. The useful move is to choose one management focus from the saved profile and current music in view, then let the team build the next work from that center.`,
    sourceLine: "Based on your saved artist profile, current music in view, public audience signals, and source limits.",
    confidence: "limited",
    generatedAt: "2026-06-17T08:30:00.000Z",
    managerSynthesisRunId: "test-brief-run",
    state,
  });

  return {
    artistProfile: {
      loadProfile: async () => profile,
    },
    desk: {
      loadDesk: async () => ({
        priority: [
          {
            label: "Focus",
            value: "Spotify catalog imported",
            meta: "Music",
            actionLabel: "Open imported catalog",
            target: "musicWorkspace",
          },
        ],
        attention: [
          {
            title: "Private analytics missing",
            body: "Spotify public catalog is connected, but private saves, source-of-stream, revenue, and conversion remain unavailable.",
            tone: "accent",
          },
        ],
        movement: [{ label: "Source", title: "Spotify public catalog connected", time: "Just now" }],
        todayBrief: todayBrief("fallback"),
      }),
      generateTodaysBrief: async () => todayBrief("fresh"),
    },
    staff: {
      loadAgents: async () => productionFixtureData.agents,
    },
    music: {
      loadMusic: async () => [],
      createSong: async (input) => ({
        id: "test-song",
        kind: "song" as const,
        title: input.title,
        lifecycle: input.lifecycleStage,
        lifecycleStage: input.lifecycleStage,
        blocker: "No active blocker",
        sourceLimit: "Test song",
        nextMove: "Add files.",
        linkedMissionIds: [],
        linkedTaskCount: 0,
      }),
      createProject: async (input) => ({
        id: "test-project",
        kind: "project" as const,
        title: input.title,
        lifecycle: input.lifecycleStage,
        lifecycleStage: input.lifecycleStage,
        blocker: "No inherited blockers",
        sourceLimit: "Test project",
        nextMove: "Add songs.",
        linkedMissionIds: [],
        linkedTaskCount: 0,
      }),
      generateMusicSummary: async () => {
        throw new Error("generateMusicSummary is not configured in this test.");
      },
      updateLifecycleStage: async () => undefined,
      saveDetail: async () => undefined,
      saveCredit: async () => undefined,
      saveIdentifier: async () => undefined,
      saveSplitContributor: async () => undefined,
      removeSplitContributor: async () => undefined,
      sendSplitConfirmationLinks: async () => undefined,
      loadSplitConfirmation: async () => {
        throw new Error("No split confirmation fixture configured.");
      },
      submitSplitConfirmation: async () => undefined,
      uploadAsset: async (_musicItemId, input) => ({
        group: "Audio" as const,
        label: input.title,
        status: "Uploaded",
        action: "Uploaded",
        assetType: input.assetType,
      }),
    },
    manager: {
      loadConversations: async () => [],
    },
    missions: {
      loadMissions: async () => [],
      approveTask: async () => undefined,
      completeTask: async (_taskId, input) => ({
        id: "completed-mission",
        title: "Completed test mission",
        status: input.status === "blocked" ? "blocked" : "active",
        progress: input.status === "completed" ? 100 : 0,
        review: "Test review",
        summary: "A test mission was updated.",
        recommendation: "Review the test mission.",
        musicSubject: "Artist-wide",
        nextTask: "Review test task",
      }),
    },
    missionGenesis: {
      runMissionGenesis: async () => ({
        outcome: "no_mission",
        title: "Mission Genesis completed",
        body: "No durable mission was created.",
        reasons: ["No mission pressure was detected."],
        questions: [],
        evidenceNeeded: [],
      }),
      answerMissionGenesisContext: async () => ({
        outcome: "no_mission",
        title: "Mission Genesis completed",
        body: "No durable mission was created.",
        reasons: ["No mission pressure was detected."],
        questions: [],
        evidenceNeeded: [],
      }),
    },
    evidence: {
      loadEvidence: async () => [],
    },
  };
}

function readProductionFiles() {
  const roots = ["src/app", "src/design-system", "src/features"];
  const files: string[] = [];

  for (const root of roots) {
    walk(join(process.cwd(), root), files);
  }

  return files.filter((file) => /\.(ts|tsx)$/.test(file));
}

function readSourceTestFiles() {
  const files: string[] = [];
  walk(join(process.cwd(), "src"), files);
  return files.filter((file) => /\.(test|spec)\.(ts|tsx)$/.test(file));
}

function walk(path: string, files: string[]) {
  for (const entry of readdirSync(path)) {
    const next = join(path, entry);
    if (statSync(next).isDirectory()) {
      walk(next, files);
    } else {
      files.push(next);
    }
  }
}
