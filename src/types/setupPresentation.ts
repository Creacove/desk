export type SetupPresentationStatus = "queued" | "running" | "completed" | "failed";

export type SetupPresentationPhase = "catalogue" | "discovery" | "synthesis" | "ready";

export type SetupPresentationFindingPhase = Exclude<SetupPresentationPhase, "ready">;

export type SetupPresentationFindingKind =
  | "identity"
  | "catalogue"
  | "audience"
  | "playlist"
  | "market"
  | "momentum"
  | "music"
  | "public_context"
  | "manager_read";

export type SetupPresentationFindingDestination =
  | "catalogue"
  | "audience"
  | "markets"
  | "momentum"
  | "manager_read";

export type SetupPresentationPlatform =
  | "spotify"
  | "apple_music"
  | "tiktok"
  | "instagram"
  | "youtube"
  | "shazam"
  | "deezer";

export type SetupPresentationArtwork = {
  url: string;
  alt: string;
};

export type SetupPresentationFinding = {
  id: string;
  dedupeKey: string;
  revision: string;
  persistedAt: string;
  phase: SetupPresentationFindingPhase;
  kind: SetupPresentationFindingKind;
  destination: SetupPresentationFindingDestination;
  platform?: SetupPresentationPlatform;
  title: string;
  value?: string;
  detail?: string;
  artwork?: SetupPresentationArtwork;
};

export type SetupPresentationFeed = {
  version: 2;
  observedAt: string;
  setup: {
    runId: string;
    artistWorkspaceId: string;
    status: SetupPresentationStatus;
    phase: SetupPresentationPhase;
    startedAt?: string;
    phaseStartedAt?: string;
    updatedAt: string;
  };
  artist?: {
    name: string;
    imageUrl?: string;
    genres: string[];
  };
  findings: SetupPresentationFinding[];
  projection: {
    bounded: true;
    maxFindings: 32;
    omittedMalformed: number;
  };
};

export type SetupPresentationActivityKind =
  | "catalogue"
  | "audience"
  | "public_context"
  | "focus_music"
  | "project"
  | "synthesis"
  | "manager";

export type SetupPresentationSnapshot = {
  version: 1;
  observedAt: string;
  setup: {
    status: "queued" | "running" | "completed" | "failed";
    phase: SetupPresentationPhase;
    startedAt?: string;
    phaseStartedAt?: string;
    updatedAt?: string;
  };
  artist?: {
    name: string;
    imageUrl?: string;
    genres: string[];
  };
  catalogue?: {
    state: "working" | "complete";
    trackCount?: number;
    releaseCount?: number;
    covers: Array<{
      title: string;
      imageUrl?: string;
    }>;
  };
  activity?: {
    kind: SetupPresentationActivityKind;
    state: "working" | "complete";
    label: string;
    occurredAt?: string;
  };
  intelligence?: {
    primaryMetric?: {
      label: string;
      value: string;
    };
    markets: string[];
    publicSources: Array<{
      name: string;
      domain?: string;
    }>;
    focusMusic?: {
      title: string;
      imageUrl?: string;
    };
  };
  manager?: {
    state: "waiting" | "working" | "ready";
    insight?: string;
  };
  musicReads?: {
    target?: number;
    completed?: number;
    running?: number;
    failed?: number;
  };
};
