export type MusicOperatingMode = "pre_release" | "release_window" | "released";

export type ManagerReadControlStatus =
  | "not_generated"
  | "fresh"
  | "stale"
  | "running"
  | "refreshing"
  | "failed"
  | "refresh_failed"
  | "unknown";

export type ManagerReadEvent =
  | "audio_analysis_completed"
  | "audio_analysis_failed"
  | "asset_changed"
  | "delivery_status_changed"
  | "lifecycle_changed"
  | "metadata_material_changed"
  | "metadata_title_casing_changed"
  | "mission_state_changed"
  | "post_release_evidence_changed"
  | "release_brief_changed"
  | "split_confirmation_changed";

type ManagerReadControlsInput = {
  status: ManagerReadControlStatus;
  hasConversation: boolean;
};

type ManagerReadControls = {
  readAction: "ask" | "refresh" | "retry" | null;
  readActionPriority: "primary" | "secondary" | null;
  conversationAction: "continue" | null;
};

export function managerReadControls(input: ManagerReadControlsInput): ManagerReadControls {
  const conversationAction = input.hasConversation ? "continue" as const : null;

  if (input.status === "running" || input.status === "refreshing") {
    return { readAction: null, readActionPriority: null, conversationAction };
  }

  const readAction = input.status === "not_generated"
    ? "ask" as const
    : input.status === "failed" || input.status === "refresh_failed"
      ? "retry" as const
      : "refresh" as const;

  return {
    readAction,
    readActionPriority: conversationAction ? "secondary" : "primary",
    conversationAction,
  };
}

const PRE_RELEASE_EVENTS = new Set<ManagerReadEvent>([
  "audio_analysis_completed",
  "audio_analysis_failed",
  "asset_changed",
  "delivery_status_changed",
  "lifecycle_changed",
  "metadata_material_changed",
  "mission_state_changed",
  "release_brief_changed",
  "split_confirmation_changed",
]);

const RELEASE_WINDOW_EVENTS = new Set<ManagerReadEvent>([
  "asset_changed",
  "delivery_status_changed",
  "lifecycle_changed",
  "mission_state_changed",
  "release_brief_changed",
  "split_confirmation_changed",
]);

const RELEASED_EVENTS = new Set<ManagerReadEvent>([
  "asset_changed",
  "lifecycle_changed",
  "metadata_material_changed",
  "mission_state_changed",
  "post_release_evidence_changed",
]);

export function shouldRefreshManagerRead(input: { mode: MusicOperatingMode; event: ManagerReadEvent }) {
  if (input.event === "metadata_title_casing_changed") return false;

  const relevantEvents = input.mode === "pre_release"
    ? PRE_RELEASE_EVENTS
    : input.mode === "release_window"
      ? RELEASE_WINDOW_EVENTS
      : RELEASED_EVENTS;

  return relevantEvents.has(input.event);
}
