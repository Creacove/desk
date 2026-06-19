import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProductionApp } from "./app/ProductionApp";
import { productionFixtureData } from "./services/fixtureRepositories";
import type { ArtistProfileViewModel, CleanProductionRepositories, MusicObjectViewModel, TodayBriefViewModel } from "./types/cleanProduction";
import type {
  ProductionAuthAdapter,
  ProductionProfileSetupService,
  ProductionSpotifyArtistAdapter,
  ProductionWorkspace,
  ProductionWorkspaceLoader,
} from "./types/productionApp";

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
  vi.useRealTimers();
});

describe("Clean production prototype-match shell", () => {
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

  it("searches Spotify, saves identity, and lets catalog import continue in the background", async () => {
    const createdWorkspaces: Array<{ artistName: string; workspaceName?: string }> = [];
    const connectedArtists: Array<{ workspace: ProductionWorkspace; artist: string }> = [];
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
    const spotifyArtistAdapter = spotifyAdapterWithAsyncConnect(connectedArtists);

    render(
      <ProductionApp
        authAdapter={authWithSession(session)}
        workspaceLoader={workspaceLoader}
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

    await screen.findByRole("heading", { name: "Manager Basics" });
    expect(createdWorkspaces).toEqual([{ artistName: "Nova Vale", workspaceName: "Nova Vale Desk" }]);
    expect(connectedArtists).toEqual([{ workspace: expect.objectContaining({ artistName: "Nova Vale" }), artist: "Nova Vale" }]);
    expect(screen.getByAltText("Nova Vale artist image")).toBeInTheDocument();
    expect(screen.getByText(/spotify catalog import is running in the background/i)).toBeInTheDocument();
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
    expect(screen.getByText("Complete artist stage, home market, genre, artist direction, and monthly budget to enter Desk HQ.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back to profile" })).toHaveClass("rounded-[10px]");

    fireEvent.change(screen.getByLabelText("Artist stage"), { target: { value: "Emerging artist with catalog traction" } });
    fireEvent.change(screen.getByLabelText("Home market"), { target: { value: "Lagos" } });
    fireEvent.change(screen.getByLabelText("Genre"), { target: { value: "Afro-fusion" } });
    fireEvent.change(screen.getByLabelText("Artist Direction"), { target: { value: "Build Nova Vale around precise catalog proof before scale spend." } });
    fireEvent.change(screen.getByLabelText("Monthly budget"), { target: { value: "$3,000" } });

    fireEvent.click(screen.getByRole("button", { name: "Enter Desk HQ" }));
    await screen.findByRole("heading", { name: "Desk HQ" });
    expect(saves).toEqual(["Emerging artist with catalog traction|Lagos|Afro-fusion|Build Nova Vale around precise catalog proof before scale spend.|$3,000"]);
  }, 20000);

  it("saves artist context and enters Desk HQ while Spotify catalog import is still running", async () => {
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
    expect(screen.getByText(/spotify catalog import is running in the background/i)).toBeInTheDocument();
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
    expect(screen.getByText("Today's Brief")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate Today's Brief" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Workspace" })).not.toBeInTheDocument();
    expect(screen.getByText("Needs Attention")).toBeInTheDocument();
    expect(screen.getByText("Recent Movement")).toBeInTheDocument();
    expect(screen.getByText("Source / Just now")).toBeInTheDocument();
    expect(screen.getAllByText("Team Agents").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Ask Manager.*Get a decision.*Use today's read/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Music Focus.*Open music reads/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Mission Path.*Create first mission.*Turn read into work/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Team Agents.*0 specialist desks.*Open operating team/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Source.*Public catalog only/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/active AI units/i)).not.toBeInTheDocument();
    expect(screen.getAllByText("0 specialist desks").length).toBeGreaterThan(0);
    expect(screen.queryByText("Sable Day")).not.toBeInTheDocument();
    expect(screen.queryByText("Night Bus")).not.toBeInTheDocument();

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
    expect(screen.getByText("Artist Intelligence")).toBeInTheDocument();
    expect(screen.getAllByText("1.21M").length).toBeGreaterThan(0);
    expect(screen.getAllByText("London").length).toBeGreaterThan(0);
    expect(screen.getAllByText("UK rank").length).toBeGreaterThan(0);
    expect(screen.getAllByText(initialBrief.snapshotSummary).length).toBeGreaterThan(0);
    expect(screen.getAllByText(initialBrief.managerRead).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "View supporting evidence" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate setup map" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ask Manager" })).not.toBeInTheDocument();
    expect(screen.queryByText(initialBrief.sourceLine)).not.toBeInTheDocument();
    expect(screen.queryByText(/Generated by AI Manager/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Manager brief ·/i)).toBeInTheDocument();
    expect(screen.queryByText("What I'm seeing")).not.toBeInTheDocument();
    expect(screen.queryByText("Today's Directive")).not.toBeInTheDocument();
    expect(screen.queryByText("Still missing")).not.toBeInTheDocument();
    expect(screen.queryByText(/Chartmetric|provider|API|normalized|database|evidence row|third-party/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Generate Today's Brief" }));

    expect((await screen.findAllByText(refreshedBrief.headlineRead)).length).toBeGreaterThan(0);
    expect(generationModes).toEqual(["operating"]);

    fireEvent.click(screen.getByRole("button", { name: "Generate setup map" }));

    expect((await screen.findAllByText(setupMapBrief.headlineRead)).length).toBeGreaterThan(0);
    expect(generationModes).toEqual(["operating", "setup-map"]);
    expect(screen.queryByRole("button", { name: "Talk to Manager" })).not.toBeInTheDocument();
  }, 20000);

  it("turns Desk HQ command strip clicks into Manager, Music, Missions, and Team destinations", async () => {
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
    expect(screen.getByRole("button", { name: /Music Focus.*Jam.*Open record read/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Mission Path.*1 active.*Turn read into work/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Team Agents.*5 specialist desks.*Open operating team/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Ask Manager.*Get a decision.*Use today's read/i }));
    expect(screen.getByText("Manager Office")).toBeInTheDocument();

    fireEvent.click(within(screen.getByRole("navigation", { name: "Ordersounds Desk navigation" })).getByRole("button", { name: "Desk HQ" }));
    fireEvent.click(screen.getByRole("button", { name: /Music Focus.*Jam.*Open record read/i }));
    expect(screen.getByRole("heading", { name: "Jam" })).toBeInTheDocument();

    fireEvent.click(within(screen.getByRole("navigation", { name: "Ordersounds Desk navigation" })).getByRole("button", { name: "Desk HQ" }));
    fireEvent.click(screen.getByRole("button", { name: /Mission Path.*1 active.*Turn read into work/i }));
    expect(screen.getByRole("heading", { name: "Missions" })).toBeInTheDocument();

    fireEvent.click(within(screen.getByRole("navigation", { name: "Ordersounds Desk navigation" })).getByRole("button", { name: "Desk HQ" }));
    fireEvent.click(screen.getByRole("button", { name: /Team Agents.*5 specialist desks.*Open operating team/i }));
    expect(screen.getByRole("heading", { name: "Artist Team Agents" })).toBeInTheDocument();
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
    expect(screen.getByTestId("desk-mobile-generate-brief")).toHaveAttribute("aria-label", "Generate today's brief");
    expect(screen.queryByTestId("desk-mobile-command-row")).not.toBeInTheDocument();
    expect(screen.getByTestId("desk-desktop-attention-rail")).toHaveClass("hidden", "xl:grid");

    fireEvent.click(screen.getByTestId("mobile-notification-trigger"));
    const notificationSheet = await screen.findByRole("dialog", { name: "Desk notifications" });
    expect(notificationSheet).toHaveTextContent("Needs Attention");
    expect(notificationSheet).toHaveTextContent("Recent Movement");
    expect(notificationSheet).toHaveTextContent("Private analytics missing");
    expect(notificationSheet).toHaveTextContent("Spotify public catalog connected");
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
    expect(within(desk).getByTestId("desk-mobile-manager-read-card")).toHaveClass("border-l-brand-accent");
    expect(within(desk).getByTestId("desk-mobile-manager-read-card")).not.toHaveClass("border-l-foreground");
    expect(within(desk).getByText("Manager's Read")).toBeInTheDocument();
    expect(within(desk).getByTestId("desk-mobile-manager-read")).toHaveTextContent(managerReadEnding);
    expect(within(desk).getByTestId("desk-mobile-manager-read")).not.toHaveTextContent("EV-204");
    expect(within(desk).getByTestId("desk-mobile-manager-read")).not.toHaveTextContent("evidence-1");
    expect(within(desk).getByTestId("desk-mobile-manager-read").querySelectorAll("p")).toHaveLength(4);

    expect(screen.getAllByText("Manager's Read").length).toBeGreaterThan(0);
    expect(screen.getByTestId("desk-desktop-manager-read")).toHaveTextContent(managerReadEnding);
    expect(screen.getByTestId("desk-desktop-manager-read")).not.toHaveTextContent("EV-204");
    expect(screen.getByTestId("desk-desktop-manager-read")).not.toHaveTextContent("evidence-1");
    expect(screen.getByTestId("desk-desktop-manager-read")).not.toHaveClass("overflow-hidden");
    expect(screen.getByTestId("desk-desktop-manager-read").querySelectorAll("p")).toHaveLength(4);

    const mobileMetrics = within(desk).getByTestId("desk-mobile-metrics-grid");
    expect(mobileMetrics).toHaveTextContent("Monthly listeners");
    expect(within(mobileMetrics).queryByText("Skip rate")).not.toBeInTheDocument();
    fireEvent.click(within(desk).getByRole("button", { name: "See all 6 metrics" }));
    expect(within(mobileMetrics).getByText("Skip rate")).toBeInTheDocument();

    const teamAgents = within(desk).getByTestId("desk-mobile-team-agents");
    expect(teamAgents).toHaveTextContent("Team Agents");
    expect(teamAgents).toHaveTextContent("AI Manager");
    expect(teamAgents).toHaveTextContent("Marketing Lead");
    expect(within(teamAgents).getByRole("button", { name: "Open team" })).toBeInTheDocument();
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
    expect(screen.getAllByText(longBrief.snapshotSummary).length).toBeGreaterThan(0);
    expect(screen.queryByText(finalParagraph)).not.toBeInTheDocument();

    const expandButtons = screen.getAllByRole("button", { name: "See full Manager's Read" });
    expect(expandButtons).toHaveLength(2);
    fireEvent.click(expandButtons[1]);

    expect(screen.getByText(finalParagraph)).toBeInTheDocument();
    expect(screen.getByTestId("desk-desktop-manager-read").querySelectorAll("p")).toHaveLength(5);
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
    const intelligenceCard = screen.getByTestId("artist-intelligence-card");
    expect(intelligenceCard).toHaveTextContent("Track score - Make Them Run");
    expect(intelligenceCard).toHaveTextContent("Top TikTok video - Make Them Run");
    expect(intelligenceCard).toHaveTextContent("1.3M views");
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
    expect(source).toContain("group-hover:bg-foreground group-hover:text-background");
  });

  it("keeps Manager conversations persistent and links created work", async () => {
    await enterDeskHq();

    fireEvent.click(screen.getByRole("button", { name: /Ask Manager.*Get a decision.*Use today's read/i }));
    expect(screen.getByText("Manager Office")).toBeInTheDocument();

    for (let index = 0; index < 3; index += 1) {
      fireEvent.click(screen.getByRole("button", { name: "Use suggested context" }));
      await waitFor(() => expect(screen.getByRole("textbox")).toHaveValue());
      fireEvent.click(screen.getByRole("button", { name: /Next Question|Submit Context/ }));
    }

    expect(await screen.findByText("Context synchronized")).toBeInTheDocument();
    expect(screen.getByText("Conversation History")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Night Bus release planning" }));
    expect(screen.getByText("Direct message")).toBeInTheDocument();
    expect(screen.getByText("I want to drop a new song next week.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open created mission" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open created mission" }));
    expect(screen.getByRole("heading", { name: "Missions" })).toBeInTheDocument();
    expect(screen.getByText("Mission pulse")).toBeInTheDocument();
  }, 20000);

  it("rebuilds Music as a durable recorded-work area with song/project rooms", async () => {
    await enterDeskHq();

    const rail = screen.getByRole("navigation", { name: "Ordersounds Desk navigation" });
    fireEvent.click(within(rail).getByRole("button", { name: "Open Music workspace" }));

    expect(screen.getByRole("heading", { name: "Music" })).toBeInTheDocument();
    expect(screen.getByText("Recorded work under management")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Songs" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Projects" })).toBeInTheDocument();
    expect(screen.getAllByText("01").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Files").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Details").length).toBeGreaterThan(0);
    expect(screen.getAllByAltText("Night Bus cover artwork").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Record read:/i).length).toBeGreaterThan(0);
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

    fireEvent.click(screen.getByRole("button", { name: "Back to Music" }));
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
    fireEvent.click(screen.getByRole("button", { name: "Back to Music" }));
    expect(screen.getByRole("button", { name: "Projects" })).toHaveAttribute("aria-pressed", "true");
  }, 20000);

  it("uses compact mobile Music rows instead of tall stacked cards", async () => {
    await enterDeskHq();

    const rail = screen.getByRole("navigation", { name: "Ordersounds Desk navigation" });
    fireEvent.click(within(rail).getByRole("button", { name: "Open Music workspace" }));

    expect(await screen.findByRole("heading", { name: "Music" })).toBeInTheDocument();
    expect(screen.getByTestId("workspace-header-Music")).toHaveClass("hidden", "lg:flex");
    expect(screen.getByTestId("music-mobile-controls")).toHaveClass("flex-row");
    const mobileLibrary = screen.getByTestId("music-mobile-library");
    const mobileRow = within(mobileLibrary).getByTestId("music-mobile-song-row-Night Bus");
    expect(mobileLibrary).toHaveClass("lg:hidden");
    expect(mobileRow).toHaveClass("min-h-0");
    expect(mobileRow).not.toHaveClass("rounded-[20px]");
    expect(within(mobileRow).getByTestId("music-mobile-readiness-strip")).toHaveClass("grid-cols-3");
    expect(within(mobileRow).getByText("Files")).toBeInTheDocument();
    expect(within(mobileRow).getByText("Details")).toBeInTheDocument();
    expect(within(mobileRow).getByText("Rights")).toBeInTheDocument();
    expect(within(mobileRow).queryByText(/strongest current focus asset/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Projects" }));
    const mobileProjectRow = within(mobileLibrary).getByTestId("music-mobile-project-row-Glass Room EP");
    expect(within(mobileProjectRow).getByText("Tracks")).toBeInTheDocument();
    expect(within(mobileProjectRow).getByText("Ready")).toBeInTheDocument();
    expect(within(mobileProjectRow).getByText("Issues")).toBeInTheDocument();
    expect(within(mobileProjectRow).queryByText(/project context is ready|mapped track|project read/i)).not.toBeInTheDocument();
  }, 20000);

  it("uses mobile-native song and project room layouts after opening Music items", async () => {
    await enterDeskHq();

    const rail = screen.getByRole("navigation", { name: "Ordersounds Desk navigation" });
    fireEvent.click(within(rail).getByRole("button", { name: "Open Music workspace" }));

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

    fireEvent.click(screen.getByRole("button", { name: "Back to Music" }));
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
    fireEvent.click(screen.getByRole("button", { name: /Ask Manager.*Get a decision.*Use today's read/i }));
    expect(screen.getByTestId("manager-mobile-progress")).toHaveClass("lg:hidden");
    expect(screen.getByTestId("manager-desktop-progress")).toHaveClass("hidden", "lg:block");

    fireEvent.click(within(rail).getByRole("button", { name: "Settings" }));
    expect(screen.getByTestId("settings-mobile-profile-summary")).toHaveClass("sm:hidden");
    expect(screen.getByTestId("settings-desktop-profile-summary")).toHaveClass("hidden", "sm:flex");
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

    await screen.findByRole("heading", { name: "Music" });
    fireEvent.click(screen.getByRole("button", { name: "Projects" }));
    fireEvent.click(screen.getByRole("button", { name: "Open project Unlinked Project" }));
    const projectRoom = screen.getByTestId("music-project-detail");

    expect(projectRoom).toHaveTextContent("No mission linked");
    expect(projectRoom).not.toHaveTextContent("missions remain objective-first");
    expect(projectRoom).not.toHaveTextContent("Inherited blocker");
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
        return music.find((item) => item.id === subjectId)!;
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

    await screen.findByRole("heading", { name: "Music" });
    fireEvent.click(screen.getByRole("button", { name: "Projects" }));
    fireEvent.click(screen.getByRole("button", { name: "Open project Brief Project" }));
    const projectRoom = screen.getByTestId("music-project-detail");

    const tracklistLabel = within(projectRoom).getByText("Tracklist");
    const briefLabel = within(projectRoom).getByText("Project Intelligence");
    expect(tracklistLabel.compareDocumentPosition(briefLabel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(projectRoom).toHaveTextContent("Released EP · Focus Track is carrying the first project read");
    expect(projectRoom).toHaveTextContent("Brief Project has 1 mapped track");
    expect(projectRoom).toHaveTextContent("Focus Track is the first song to inspect");
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

    fireEvent.click(within(projectRoom).getByRole("button", { name: "Regenerate brief" }));

    await waitFor(() => {
      expect(calls).toEqual([{ subjectId: "project-brief-1", subjectType: "music_project" }]);
    });
  }, 20000);

  it("exposes production Music create and upload actions in context", async () => {
    await enterDeskHq();

    const rail = screen.getByRole("navigation", { name: "Ordersounds Desk navigation" });
    fireEvent.click(within(rail).getByRole("button", { name: "Open Music workspace" }));

    expect(screen.getByRole("button", { name: "Add song" })).toHaveTextContent("");
    expect(screen.queryByRole("button", { name: "Create music" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Back to Desk HQ" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add project" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add song" }));
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

  it("keeps upload failures visible inside the Music upload modal", async () => {
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

    await screen.findByRole("heading", { name: "Music" });
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

    await screen.findByRole("heading", { name: "Music" });
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

    await screen.findByRole("heading", { name: "Music" });
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
    expect(screen.getAllByText("Campaign command board").length).toBeGreaterThan(0);
    expect(screen.getByText("Source rail")).toBeInTheDocument();

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
    fireEvent.click(screen.getByRole("button", { name: "Test mission page" }));
    expect(screen.getByText("Mission pulse")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Test mission: Release readiness" })).toBeInTheDocument();
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
      loadAgents: async () => [],
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
