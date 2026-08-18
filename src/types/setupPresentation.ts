export type SetupPresentationPhase = "catalogue" | "discovery" | "synthesis" | "ready";

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
