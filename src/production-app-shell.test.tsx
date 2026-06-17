import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProductionApp } from "./app/ProductionApp";
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

    render(<ProductionApp authAdapter={authWithoutSession()} workspaceLoader={workspaceLoader} />);

    expect(await screen.findByRole("heading", { name: "Sign in to Ordersounds" })).toBeInTheDocument();
    expect(screen.getByText("Artist operating desk")).toBeInTheDocument();
    expect(screen.getByText("Use your account to open the production workspace.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create account" })).toBeInTheDocument();
    expect(workspaceLoader.calls).toBe(0);
  });

  it("keeps a fixture runtime available for demo and parity verification", async () => {
    render(<ProductionApp fixtureMode initialView="connectArtist" />);

    expect(await screen.findByRole("heading", { name: "Connect artist profile" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Sign in to Ordersounds" })).not.toBeInTheDocument();
    expect(screen.getByText("Sable Day")).toBeInTheDocument();
    expect(screen.getByText("Artist Setup")).toHaveClass("text-brand-accent");
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue to artist context" })).toHaveClass("rounded-[12px]");
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

    fireEvent.change(screen.getByLabelText("Search Spotify artist"), { target: { value: "Nova" } });
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
    expect(screen.getByRole("button", { name: "Back to profile" })).toHaveClass("rounded-full");

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
    const profileSetupService: ProductionProfileSetupService = {
      async saveSetupContext(_workspace, profile) {
        saves.push(`${profile.stage}|${profile.market}|${profile.genre}|${profile.goal}|${profile.budget}`);
        return {
          ...setupWorkspace,
          status: "active",
          contextComplete: true,
          latestCatalogSyncStatus: "running",
        };
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
    expect(screen.getByText("Needs Attention")).toBeInTheDocument();
    expect(screen.getByText("Recent Movement")).toBeInTheDocument();
    expect(screen.getByText("Source / Just now")).toBeInTheDocument();
    expect(screen.getAllByText("Team Agents").length).toBeGreaterThan(0);
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
    const repositories = repositoriesFor("Nova Vale");
    repositories.desk = {
      loadDesk: async () => ({
        priority: [],
        attention: [],
        movement: [],
        todayBrief: initialBrief,
      }),
      generateTodaysBrief: async () => refreshedBrief,
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
    expect(screen.getByText(initialBrief.headlineRead)).toBeInTheDocument();
    expect(screen.getByText("Artist Intelligence")).toBeInTheDocument();
    expect(screen.getByText("Market Power")).toBeInTheDocument();
    expect(screen.getByText("1.21M")).toBeInTheDocument();
    expect(screen.getByText("London")).toBeInTheDocument();
    expect(screen.getByText("UK rank")).toBeInTheDocument();
    expect(screen.getByText(initialBrief.snapshotSummary)).toBeInTheDocument();
    expect(screen.getByText(initialBrief.managerRead)).toBeInTheDocument();
    expect(screen.getByText(initialBrief.sourceLine)).toBeInTheDocument();
    expect(screen.queryByText("What I'm seeing")).not.toBeInTheDocument();
    expect(screen.queryByText("Today's Directive")).not.toBeInTheDocument();
    expect(screen.queryByText("Still missing")).not.toBeInTheDocument();
    expect(screen.queryByText(/Chartmetric|provider|API|normalized|database|evidence row|third-party/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Generate Today's Brief" }));

    expect(await screen.findByText(refreshedBrief.headlineRead)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Talk to Manager" })).not.toBeInTheDocument();
  }, 20000);

  it("keeps Manager conversations persistent and links created work", async () => {
    await enterDeskHq();

    fireEvent.click(screen.getByRole("button", { name: "Ask Manager" }));
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
    expect(screen.getByText("01")).toBeInTheDocument();
    expect(screen.getAllByText("Files").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Details").length).toBeGreaterThan(0);
    expect(screen.getByAltText("Night Bus cover artwork")).toBeInTheDocument();

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
      managerRead: "I found Source Proof with a confirmed public release spine and 12,500 listeners from Spotify playlist reach over Last 7 days. I would treat that as exposure, not demand, until we see saves, repeat listeners, and source-of-stream.",
      nextMove: "Review imported public catalog metadata, then connect private analytics.",
      watchNext: "Check whether listening stays up next week.",
      managerReadState: "fresh",
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

    expect(songRoom).toHaveTextContent("Manager read");
    expect(songRoom).toHaveTextContent("I found Source Proof");
    expect(songRoom).toHaveTextContent("12,500 listeners");
    expect(songRoom).toHaveTextContent("Released song · Listening increased this week · Split proof is clear");
    expect(songRoom).toHaveTextContent("Check whether listening stays up next week.");
    expect(songRoom).toHaveTextContent("Fresh");
    expect(songRoom.querySelectorAll('[data-testid="manager-read-copy"]')).toHaveLength(1);
    expect(songRoom).not.toHaveTextContent("Chartmetric adds public movement context");
    expect(songRoom).not.toHaveTextContent("Source-backed song summary");
    expect(songRoom).not.toHaveTextContent("Spotify track ID");
    expect(songRoom).not.toHaveTextContent("spotify-track-1");
    expect(songRoom).not.toHaveTextContent("Private analytics are still missing");
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
    expect(screen.getByText("What is happening")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tasks" }));
    expect(screen.getByText("Release tasks")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mission recap" }));
    expect(screen.getByText("Living recap of the mission")).toBeInTheDocument();

    fireEvent.click(within(rail).getByRole("button", { name: "Settings" }));
    expect(screen.getByRole("heading", { name: "Artist profile." })).toBeInTheDocument();
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
