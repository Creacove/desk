export type PublicWorkflowFailure = {
  code: string;
  message: string;
  retryable: boolean;
};

const TEMPORARY_FAILURE: PublicWorkflowFailure = {
  code: "workflow_temporarily_unavailable",
  message: "We couldn't finish this work right now. Your completed work is safe.",
  retryable: true,
};

export function publicWorkflowFailure(error: unknown): PublicWorkflowFailure {
  if (isPublicWorkflowFailure(error)) return error;
  if (error && typeof error === "object" && "publicFailure" in error) {
    const projected = (error as { publicFailure?: unknown }).publicFailure;
    if (isPublicWorkflowFailure(projected)) return projected;
  }
  return { ...TEMPORARY_FAILURE };
}

export function workflowFailureBody(error: unknown) {
  const failure = publicWorkflowFailure(error);
  return { error: failure.message, failure };
}

function isPublicWorkflowFailure(value: unknown): value is PublicWorkflowFailure {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.code === "string"
    && typeof candidate.message === "string"
    && typeof candidate.retryable === "boolean";
}
