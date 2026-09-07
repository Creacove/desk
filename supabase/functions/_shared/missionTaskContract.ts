export const MISSION_TASK_INTENTS = [
  "manager_work",
  "human_action",
  "collaborative_draft",
  "review_approval",
] as const;

export type MissionTaskIntent = (typeof MISSION_TASK_INTENTS)[number];

export const MISSION_TASK_COMPLETION_MODES = [
  "result_note",
  "manager_draft",
  "evidence",
  "approval",
] as const;

export type MissionTaskCompletionMode = (typeof MISSION_TASK_COMPLETION_MODES)[number];

export const MISSION_TASK_READINESS = [
  "preparing",
  "ready",
  "needs_revision",
  "completed",
  "blocked",
] as const;

export type MissionTaskReadiness = (typeof MISSION_TASK_READINESS)[number];

export type ReviewTargetInput = {
  artifactType: "manager_output" | "song_document";
  artifactId: string;
  versionId?: string | null;
  status: "draft" | "ready_for_review" | "accepted" | "needs_revision";
};

export type MissionTaskInput = {
  title: string;
  purpose: string;
  steps: string[];
  ownerRole: string;
  workMode: "artist_action" | "collaborative" | "manager_work";
  completionMode: MissionTaskCompletionMode | "attestation";
  intent?: MissionTaskIntent | string | null;
  readiness?: MissionTaskReadiness | string | null;
  reviewTarget?: ReviewTargetInput | null;
};

export type NormalizedMissionTask = Omit<MissionTaskInput, "intent" | "completionMode" | "readiness" | "reviewTarget"> & {
  intent: MissionTaskIntent;
  completionMode: MissionTaskCompletionMode;
  readiness: MissionTaskReadiness;
  reviewTarget?: ReviewTargetInput;
};

export class MissionTaskContractError extends Error {
  readonly code = "MISSION_TASK_CONTRACT_INVALID";

  constructor(message: string) {
    super(message);
    this.name = "MissionTaskContractError";
  }
}

export function normalizeMissionTask(input: MissionTaskInput): NormalizedMissionTask {
  const intent = input.intent;
  if (!isMissionTaskIntent(intent)) {
    throw new MissionTaskContractError("Every visible task requires an explicit intent.");
  }

  const completionMode = normalizeCompletionMode(input.completionMode);
  const reviewTarget = normalizeReviewTarget(input.reviewTarget);

  if (intent === "manager_work") {
    throw new MissionTaskContractError("Manager work must remain in the Manager read and cannot be a visible human task.");
  }

  if (completionMode === "approval" && intent !== "review_approval") {
    throw new MissionTaskContractError("Approval completion requires the review_approval intent and a versioned review target.");
  }

  if (intent !== "review_approval" && reviewTarget) {
    throw new MissionTaskContractError("Only review_approval tasks may carry a review target.");
  }

  if (intent === "collaborative_draft") {
    if (input.workMode !== "collaborative") {
      throw new MissionTaskContractError("Collaborative drafts require collaborative workMode.");
    }
    if (completionMode !== "manager_draft") {
      throw new MissionTaskContractError("Collaborative drafts require manager_draft completionMode.");
    }
  }

  if (intent === "review_approval") {
    if (!reviewTarget) {
      throw new MissionTaskContractError("Review tasks require a review target.");
    }
    if (reviewTarget.status !== "ready_for_review") {
      throw new MissionTaskContractError("Review tasks require a review target that is ready_for_review.");
    }
    if (completionMode !== "approval") {
      throw new MissionTaskContractError("Review tasks require approval completionMode.");
    }
  }

  const readiness = normalizeReadiness(input.readiness, intent);
  if (intent === "review_approval" && readiness !== "ready") {
    throw new MissionTaskContractError("Review tasks require ready readiness.");
  }

  return {
    title: input.title,
    purpose: input.purpose,
    steps: input.steps,
    ownerRole: input.ownerRole,
    workMode: input.workMode,
    completionMode,
    intent,
    readiness,
    ...(reviewTarget ? { reviewTarget } : {}),
  };
}

function isMissionTaskIntent(value: unknown): value is MissionTaskIntent {
  return typeof value === "string" && (MISSION_TASK_INTENTS as readonly string[]).includes(value);
}

function normalizeCompletionMode(value: MissionTaskInput["completionMode"]): MissionTaskCompletionMode {
  if (value === "attestation") return "result_note";
  if (typeof value === "string" && (MISSION_TASK_COMPLETION_MODES as readonly string[]).includes(value)) {
    return value as MissionTaskCompletionMode;
  }
  throw new MissionTaskContractError("Every visible task requires a valid completionMode.");
}

function normalizeReadiness(value: MissionTaskInput["readiness"], intent: MissionTaskIntent): MissionTaskReadiness {
  if (value && (MISSION_TASK_READINESS as readonly string[]).includes(value)) return value as MissionTaskReadiness;
  return intent === "collaborative_draft" ? "preparing" : "ready";
}

function normalizeReviewTarget(value: ReviewTargetInput | null | undefined): ReviewTargetInput | undefined {
  if (!value) return undefined;
  if (!value.artifactId.trim() || !value.artifactType || !value.versionId?.trim() || !value.status) {
    throw new MissionTaskContractError("Review target must include artifact type, artifact ID, immutable version, and status.");
  }
  return {
    artifactType: value.artifactType,
    artifactId: value.artifactId,
    versionId: value.versionId,
    status: value.status,
  };
}
