import {
  BadgeDollarSign,
  BriefcaseBusiness,
  Headphones,
  Megaphone,
  Route,
} from "lucide-react";
import type { CleanProductionRepositories, ProductionFixtureData } from "../types/cleanProduction";
import type { ProductionAuthAdapter, ProductionUser, ProductionWorkspace, ProductionWorkspaceLoader } from "../types/productionApp";

export const productionFixtureData: ProductionFixtureData = {
  profile: {
    name: "Sable Day",
    spotify: "Sable Day - verified artist",
    genre: "Alternative R&B",
    market: "Atlanta",
    release: "Night Bus",
    goal:
      "Transition Sable Day from Atlanta's underground R&B scene to a national breakout act. Establish a dominant foothold on key DSPs by targeting Alternative R&B charts and editorial playlist support, aiming to scale monthly active listeners from 180k to 500k over the next 6 months while securing creative autonomy and solidifying her data sovereignty.",
    budget: "$5,000",
    stage: "Developing artist with breakout signals",
    tiktok: "@sableday",
    instagram: "@sableday",
    youtube: "@sableday",
    x: "@sableday",
  },
  priority: [
    { label: "Focus", value: "Night Bus", meta: "Music", actionLabel: "Open active music focus", target: "musicWorkspace" },
    { label: "Attention", value: "Split approval", meta: "Rights", actionLabel: "Open blocked rights task", target: "missionsWorkspace" },
    { label: "Next Move", value: "Clear rights", meta: "Today", actionLabel: "Open next task", target: "missionsWorkspace" },
    { label: "Missions", value: "3", meta: "Active", actionLabel: "Open active missions", target: "missionsWorkspace" },
  ],
  attention: [
    {
      title: "Split approval",
      body: "The Manager is waiting on the signed split sheet before the June 12 release can be treated as clean.",
      tone: "warning",
    },
    {
      title: "Distributor package",
      body: "Distributor confirmation is still needed before the June 12 delivery path can be treated as clean.",
      tone: "accent",
    },
  ],
  movement: [
    { label: "Milestone", title: "Started content testing", time: "2h ago" },
    { label: "Team Agents", title: "Creative brief sent to Marketing", time: "5h ago" },
    { label: "System", title: "Nigeria signal verified by Manager", time: "Yesterday" },
  ],
  agents: [
    {
      id: "manager",
      name: "AI Manager",
      status: "available",
      readiness: "Available now",
      purpose: "Keeps the artist moving: priorities, decisions, missions, check-ins, and team briefs.",
      icon: BriefcaseBusiness,
      workspaceTitle: "Manager command desk",
      workspaceSubtitle: "Turns artist replies, specialist notes, and source limits into decisions and mission work.",
      sections: [
        {
          eyebrow: "Operating queue",
          title: "Manager decisions",
          actionLabel: "Open decision package",
          items: [
            {
              title: "Night Bus release call",
              meta: "Active mission",
              status: "Needs rights gate",
              detail: "Keep campaign work moving while split approval remains the next management blocker.",
              value: "June 12",
            },
          ],
        },
      ],
      sources: [
        {
          label: "Artist profile",
          action: "Open Artist Direction",
          detail: "Goals, budget, release focus, and constraints are already in the workspace.",
          state: "active",
        },
      ],
    },
    {
      id: "marketing",
      name: "Marketing Lead",
      status: "locked",
      readiness: "Needs source",
      purpose: "Campaign planning, creator tests, paid/organic growth, and platform strategy.",
      icon: Megaphone,
      workspaceTitle: "Campaign command board",
      workspaceSubtitle: "Plans tests, creator targets, budget guardrails, and future ad generation.",
      sections: [
        {
          eyebrow: "Campaign tests",
          title: "Campaign command board",
          actionLabel: "Draft test plan",
          items: [
            {
              title: "Late-night transit hook",
              meta: "Organic test",
              status: "Ready to brief",
              detail: "Use Night Bus story, hook timestamp, and short-form captions for creator outreach.",
              value: "$500 cap",
            },
            {
              title: "AI ad lab",
              meta: "Future tool",
              status: "Conditional",
              detail: "Prepare audio-led ad concepts once campaign and conversion reports are available.",
            },
          ],
        },
      ],
      sources: [
        {
          label: "Spotify for Artists export",
          action: "Upload Spotify for Artists CSV",
          detail: "Needed for saves, source-of-stream, and listener behavior.",
          state: "needs_upload",
        },
        {
          label: "smart-link report",
          action: "Upload smart-link report",
          detail: "Needed for click paths and campaign-source evidence.",
          state: "needs_upload",
        },
      ],
    },
    {
      id: "syncDeals",
      name: "Sync & Deals",
      status: "locked",
      readiness: "Needs source",
      purpose: "Finds sync, brand, partnership, and deal opportunities when rights and pitch materials are credible.",
      icon: Headphones,
      workspaceTitle: "Sync deal pipeline",
      workspaceSubtitle: "Tracks licensing opportunities, submitted songs, rights gates, and manual deal leads.",
      sections: [
        {
          eyebrow: "Deal tracking",
          title: "Sync deal pipeline",
          actionLabel: "Track new deal",
          items: [
            {
              title: "Indie film night-drive cue",
              meta: "music supervisor brief",
              status: "Rights check",
              detail: "Night Bus matches tone, but split approval blocks submission.",
              value: "Deadline Jun 4",
            },
          ],
        },
      ],
      sources: [
        {
          label: "signed split sheet or rights document",
          action: "Upload rights document",
          detail: "Needed before outreach or availability can be treated as credible.",
          state: "needs_upload",
        },
      ],
    },
    {
      id: "touring",
      name: "Touring Agent",
      status: "locked",
      readiness: "Needs source",
      purpose: "Booking, routing, venue fit, promoter conversations, and live readiness.",
      icon: Route,
      workspaceTitle: "Booking and tour desk",
      workspaceSubtitle: "Connects live history, venue notes, demand signals, and calendar constraints.",
      sections: [
        {
          eyebrow: "Show holds",
          title: "Booking and tour desk",
          items: [
            {
              title: "The Masquerade",
              meta: "Atlanta hold",
              status: "$3,500 guarantee",
              detail: "Local demand is strong, but routing and availability need confirmation.",
            },
          ],
        },
      ],
      sources: [
        {
          label: "Google Calendar availability",
          action: "Connect calendar",
          detail: "Needed before holds and travel windows can be treated as real.",
          state: "needs_upload",
        },
      ],
    },
    {
      id: "finance",
      name: "Finance/Rights",
      status: "locked",
      readiness: "Needs source",
      purpose: "Revenue, rights, recoupment, budgets, royalty statements, and split safety.",
      icon: BadgeDollarSign,
      workspaceTitle: "Finance investigation desk",
      workspaceSubtitle: "Compares royalty statements, payouts, splits, distributor reports, and rights state.",
      sections: [
        {
          eyebrow: "Rights review",
          title: "Royalty statement comparison",
          actionLabel: "Compare statement to splits",
          items: [
            {
              title: "Night Bus split gate",
              meta: "song-level rights state",
              status: "Blocking",
              detail: "Revenue or rights conclusions require signed split sheets and distributor payout reports.",
            },
          ],
        },
      ],
      sources: [
        {
          label: "royalty statements",
          action: "Upload royalty statement",
          detail: "Needed for revenue and payout claims.",
          state: "needs_upload",
        },
        {
          label: "signed split sheets",
          action: "Upload split sheet",
          detail: "Needed before release confidence can be treated as clean.",
          state: "needs_upload",
        },
      ],
    },
  ],
  missions: [
    {
      id: "mission-night-bus",
      title: "Release Night Bus on June 12",
      status: "blocked",
      progress: 42,
      review: "Rights & Metadata Gate",
      summary: "Coordinate every release-critical step for Night Bus without treating the rushed next-Friday drop as safe.",
      recommendation: "Move the release to Friday, June 12, 2026 and keep the rights gate active.",
      musicSubject: "Night Bus",
      nextTask: "Confirm split sheet",
    },
    {
      id: "mission-validation",
      title: "Validate Night Bus before scale spend",
      status: "active",
      progress: 64,
      review: "72-hour signal review",
      summary: "Use $1,850 for a 10-day validation test while holding back $2,250 until private signals are cleaner.",
      recommendation: "Run a capped test, then review saves, clicks, follows, and demand comments.",
      musicSubject: "Night Bus",
      nextTask: "Approve capped campaign test budget",
    },
  ],
  music: [
    {
      id: "song-night-bus",
      kind: "song",
      title: "Night Bus",
      lifecycle: "Ready",
      blocker: "Confirm split sheet",
      status: "Active focus",
      lifecycleStage: "Ready",
      sourceKind: "User-supplied + public catalog setup",
      sourceLimit: "Public catalog and user-supplied details do not include private Spotify analytics.",
      managerRead: "This is the strongest current focus asset because story, hook response, and release intent are lining up.",
      nextMove: "Clear rights and delivery gaps before increasing spend or making public commitments.",
      rightsState: "Split sheet holding release clearance",
      coverImageUrl: "/logo.png",
      assets: ["Final master", "Artwork", "Metadata draft"],
      fileAssets: [
        { group: "Audio", label: "Final master", status: "Uploaded", action: "Upload final master", assetType: "final_master", canReplace: true },
        { group: "Artwork", label: "Cover art", status: "Confirmed", action: "Upload artwork", assetType: "cover_art", canReplace: true },
        { group: "Splits", label: "Split sheet document", status: "Missing", action: "Upload split sheet", assetType: "split_sheet", canUpload: true },
      ],
      linkedMissionIds: ["mission-night-bus"],
      linkedTaskIds: ["confirm-split-sheet", "submit-distributor-package", "submit-spotify-pitch"],
      linkedTaskCount: 3,
      files: [
        { label: "Final master", status: "Uploaded" },
        { label: "Cover art", status: "Confirmed" },
        { label: "Rights documents", status: "Missing" },
      ],
      details: [
        { label: "ISRC", value: "Missing", status: "Missing" },
        { label: "Producer", value: "Mara Vale", status: "Confirmed" },
        { label: "Mix engineer", value: "Lena Cruz", status: "Draft" },
      ],
      splits: {
        status: "No splits started",
        summary: "Release confidence is blocked until publishing and master splits balance and collaborators confirm.",
        contributors: [],
      },
    },
    {
      id: "song-after-hours",
      kind: "song",
      title: "After Hours Static",
      lifecycle: "Catalog",
      blocker: "None",
      status: "Released catalog",
      lifecycleStage: "Catalog",
      sourceKind: "Spotify public catalog",
      sourceLimit: "Spotify public catalog supports identity and public metadata only.",
      nextMove: "Use as a safer fit hypothesis for pitch packages once assets are confirmed.",
      linkedMissionIds: [],
      linkedTaskIds: [],
      linkedTaskCount: 0,
      splits: {
        status: "Split sheet confirmed",
        summary: "Split sheet confirmed by all collaborators.",
        contributors: [
          { name: "Sable Day", role: "Artist / writer", publishingShare: "50%", masterShare: "70%", approval: "Cleared" },
          { name: "Mara Vale", role: "Producer / writer", publishingShare: "50%", masterShare: "30%", approval: "Cleared" },
        ],
      },
    },
    {
      id: "project-glass-room",
      kind: "project",
      title: "Glass Room EP",
      lifecycle: "Scheduled",
      lifecycleStage: "Scheduled",
      status: "Unreleased body of work",
      sourceKind: "User-supplied",
      blocker: "Night Bus split sheet",
      sourceLimit: "Projects roll up blockers from their songs without duplicating song state.",
      nextMove: "Resolve inherited blocker before final release packaging.",
      coverImageUrl: "/logo.png",
      linkedMissionIds: ["mission-night-bus"],
      linkedTaskIds: ["confirm-split-sheet"],
      linkedTaskCount: 3,
      songs: ["Night Bus", "Southbound Blue"],
      songIds: ["song-night-bus"],
    },
  ],
  conversations: [
    {
      id: "conv-release",
      topic: "Night Bus release planning",
      status: "Music record and release mission prepared",
      summary: "Release-song thread that creates a Music record first, then links mission work to it.",
      prompt: "I want to drop a new song next week.",
      messages: [
        { id: "m1", speaker: "artist", label: "You asked", body: "I want to drop a new song next week." },
        {
          id: "m2",
          speaker: "manager",
          label: "Manager answered",
          body: "Treat the song as the durable recorded-work object first. Create the song record, keep files, rights, source limits, and lifecycle in Music, then create a release mission linked to that song.",
        },
      ],
      createdWork: [
        { type: "music_item", title: "Night Bus", body: "Music record for lifecycle, files, details, rights, and source limits.", id: "song-night-bus" },
        { type: "mission", title: "Release Night Bus on June 12", body: "Coordinated release mission linked to Night Bus.", id: "mission-night-bus" },
      ],
    },
  ],
  evidence: [
    {
      id: "EV-204",
      source: "Manager synthesis",
      sourceKind: "operating read",
      subject: "Night Bus momentum",
      metric: "128.4k tracked streams",
      window: "Current read",
      confidence: "Medium",
      limitation: "Private Spotify saves, source-of-stream, smart-link clicks, royalty statements, and rights metadata are missing.",
    },
  ],
};

export function createFixtureRepositories(): CleanProductionRepositories {
  let music = productionFixtureData.music.map((item) => ({
    ...item,
    files: item.files?.map((file) => ({ ...file })),
    fileAssets: item.fileAssets?.map((asset) => ({ ...asset })),
    details: item.details?.map((detail) => ({ ...detail })),
    metadataFields: item.metadataFields?.map((field) => ({ ...field })),
    releaseFields: item.releaseFields?.map((field) => ({ ...field })),
    credits: item.credits?.map((credit) => ({ ...credit })),
    identifiers: item.identifiers?.map((identifier) => ({ ...identifier })),
  }));

  return {
    artistProfile: {
      async loadProfile() {
        return productionFixtureData.profile;
      },
    },
    desk: {
      async loadDesk() {
        return {
          priority: productionFixtureData.priority,
          attention: productionFixtureData.attention,
          movement: productionFixtureData.movement,
        };
      },
    },
    staff: {
      async loadAgents() {
        return productionFixtureData.agents;
      },
    },
    music: {
      async loadMusic() {
        return music;
      },
      async createSong(input) {
        const created = {
          id: `fixture-song-${Date.now()}`,
          kind: "song" as const,
          title: input.title,
          lifecycle: input.lifecycleStage,
          lifecycleStage: input.lifecycleStage,
          blocker: "No active blocker",
          sourceKind: "manual",
          sourceLimit: "Fixture-created song.",
          nextMove: "Add files, credits, and rights details.",
          linkedMissionIds: [],
          linkedTaskCount: 0,
        };
        music = [created, ...music];
        return created;
      },
      async createProject(input) {
        const created = {
          id: `fixture-project-${Date.now()}`,
          kind: "project" as const,
          title: input.title,
          status: input.projectType,
          lifecycle: input.lifecycleStage,
          lifecycleStage: input.lifecycleStage,
          blocker: "No inherited blockers",
          sourceKind: "manual",
          sourceLimit: "Fixture-created project.",
          nextMove: "Add songs to this project.",
          linkedMissionIds: [],
          linkedTaskCount: 0,
        };
        music = [created, ...music];
        return created;
      },
      async updateLifecycleStage() {},
      async saveDetail() {},
      async saveCredit() {},
      async saveIdentifier() {},
      async saveSplitContributor(musicItemId, input) {
        music = music.map((item) => {
          if (item.id !== musicItemId || item.kind !== "song") return item;
          const currentSplits = item.splits ?? {
            status: "Draft",
            summary: "Split proposal started. Balance shares before sending confirmation links.",
            contributors: [],
          };
          const contributors = [
            ...(currentSplits.contributors ?? []),
            {
              id: `fixture-contributor-${Date.now()}`,
              name: input.name,
              role: input.role,
              email: input.email,
              publishingShare: `${input.publishingShare}%`,
              masterShare: `${input.masterShare}%`,
              approval: "Draft",
            },
          ];
          return {
            ...item,
            splits: {
              ...currentSplits,
              status: "Draft",
              publishingTotal: `${sumFixtureShares(contributors.map((contributor) => contributor.publishingShare))}%`,
              masterTotal: `${sumFixtureShares(contributors.map((contributor) => contributor.masterShare))}%`,
              contributors,
            },
          };
        });
      },
      async removeSplitContributor(musicItemId, contributorId) {
        music = music.map((item) => {
          if (item.id !== musicItemId || item.kind !== "song" || !item.splits) return item;
          const contributors = item.splits.contributors.filter((contributor) => contributor.id !== contributorId);
          return {
            ...item,
            splits: {
              ...item.splits,
              status: contributors.length ? "Draft" : "Missing",
              publishingTotal: `${sumFixtureShares(contributors.map((contributor) => contributor.publishingShare))}%`,
              masterTotal: `${sumFixtureShares(contributors.map((contributor) => contributor.masterShare))}%`,
              contributors,
            },
          };
        });
      },
      async sendSplitConfirmationLinks(musicItemId) {
        music = music.map((item) => {
          if (item.id !== musicItemId || item.kind !== "song" || !item.splits) return item;
          return {
            ...item,
            splits: {
              ...item.splits,
              status: "Pending Confirmation",
              summary: "Split confirmation links sent. Waiting for collaborators to confirm their shares.",
              approvalLog: [...(item.splits.approvalLog ?? []), "Split confirmation links sent to collaborators."],
              contributors: item.splits.contributors.map((contributor) => ({ ...contributor, approval: "Pending" })),
            },
          };
        });
      },
      async loadSplitConfirmation() {
        throw new Error("Fixture split confirmations are opened from emailed links in production.");
      },
      async submitSplitConfirmation() {},
      async uploadAsset(_musicItemId, input) {
        const uploaded = {
          group: input.assetType === "cover_art" ? "Artwork" as const : input.assetType === "split_sheet" ? "Splits" as const : "Audio" as const,
          label: input.title,
          status: "Uploaded",
          action: "Uploaded",
          assetType: input.assetType,
          canReplace: true,
          canUpload: false,
        };
        music = music.map((item) => {
          if (item.id !== _musicItemId || item.kind !== "song") return item;
          const nextFileAssets = [...(item.fileAssets ?? [])];
          const existingIndex = nextFileAssets.findIndex((asset) => asset.assetType === input.assetType || asset.label === input.title);
          if (existingIndex >= 0) {
            nextFileAssets[existingIndex] = { ...nextFileAssets[existingIndex], ...uploaded };
          } else {
            nextFileAssets.push(uploaded);
          }
          return {
            ...item,
            fileAssets: nextFileAssets,
            files: nextFileAssets.map((asset) => ({ label: asset.label, status: asset.status })),
          };
        });
        return uploaded;
      },
    },
    manager: {
      async loadConversations() {
        return productionFixtureData.conversations;
      },
    },
    missions: {
      async loadMissions() {
        return productionFixtureData.missions;
      },
    },
    evidence: {
      async loadEvidence() {
        return productionFixtureData.evidence;
      },
    },
  };
}

export function createFixtureProductionRuntime(): {
  authAdapter: ProductionAuthAdapter;
  workspaceLoader: ProductionWorkspaceLoader;
} {
  const user: ProductionUser = {
    id: "fixture-user",
    email: "sable@example.com",
    displayName: productionFixtureData.profile.name,
  };
  const workspace: ProductionWorkspace = {
    accountId: "fixture-account",
    artistId: "fixture-artist",
    artistWorkspaceId: "fixture-workspace",
    artistName: productionFixtureData.profile.name,
    workspaceName: `${productionFixtureData.profile.name} Desk`,
    status: "active",
    spotifyConnected: true,
    spotifyArtistId: "fixture-spotify-artist",
    spotifyArtistName: productionFixtureData.profile.name,
    spotifyArtistUrl: "https://open.spotify.com/artist/fixture-spotify-artist",
    contextComplete: true,
    latestCatalogSyncStatus: "completed",
  };

  return {
    authAdapter: {
      async getSession() {
        return { user };
      },
      async signInWithPassword() {
        return { user, message: "Signed in with fixture data." };
      },
      async signUpWithPassword() {
        return { user, message: "Fixture account ready." };
      },
      async signOut() {
        return undefined;
      },
    },
    workspaceLoader: {
      async loadActiveWorkspace() {
        return workspace;
      },
      async createInitialWorkspace(_user, draft) {
        return {
          ...workspace,
          artistName: draft.artistName.trim() || workspace.artistName,
          workspaceName: draft.workspaceName?.trim() || workspace.workspaceName,
        };
      },
    },
  };
}

function sumFixtureShares(values: string[]) {
  return Number(values.reduce((sum, value) => {
    const parsed = Number.parseFloat(value.replace("%", ""));
    return sum + (Number.isFinite(parsed) ? parsed : 0);
  }, 0).toFixed(2));
}
