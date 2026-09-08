export const MANAGER_CONVERSATION_WORKFLOW_VERSION = "manager_conversation_v1";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACTIVE_RUN_MAX_AGE_MS = 15 * 60 * 1_000;

export type ManagerConversationRequest = {
  accountId: string;
  artistWorkspaceId: string;
  artistId: string;
  requestId?: string;
  conversationId?: string;
  retryMessageId?: string;
  taskId?: string;
  musicSubject?: unknown;
  body: string;
  contextRequestId?: string;
  contextAnswers?: unknown;
  attachmentIds?: string[];
};

export type ManagerConversationRunRow = {
  id: string;
  status: string;
  conversation_id?: string | null;
  request_id?: string | null;
  request_payload?: unknown;
  result_payload?: unknown;
  started_at?: string | null;
  completed_at?: string | null;
  error?: string | null;
  attempt_count?: number | null;
};

export type ManagerConversationRunHandle = {
  runId: string;
  state: "started" | "completed" | "in_progress";
};

export function normalizeManagerConversationRequestId(
  input: ManagerConversationRequest,
  headerRequestId?: string | null,
) {
  const bodyRequestId = cleanRequestId(input?.requestId);
  const headerId = cleanRequestId(headerRequestId);
  if (bodyRequestId && headerId && bodyRequestId !== headerId) {
    throw new Error("Manager request ID does not match the request header.");
  }
  const requestId = bodyRequestId || headerId || crypto.randomUUID();
  if (!UUID_PATTERN.test(requestId)) throw new Error("Manager request ID is invalid.");
  input.requestId = requestId;
  return requestId;
}

export function managerConversationRequestPayload(input: ManagerConversationRequest) {
  return {
    accountId: input.accountId,
    artistWorkspaceId: input.artistWorkspaceId,
    artistId: input.artistId,
    requestId: input.requestId ?? null,
    conversationId: input.conversationId ?? null,
    retryMessageId: input.retryMessageId ?? null,
    taskId: input.taskId ?? null,
    musicSubject: input.musicSubject ?? null,
    body: input.body.trim(),
    contextRequestId: input.contextRequestId ?? null,
    contextAnswers: Array.isArray(input.contextAnswers) ? input.contextAnswers : [],
    attachmentIds: Array.isArray(input.attachmentIds) ? input.attachmentIds : [],
  };
}

export async function findManagerConversationRun(db: any, input: ManagerConversationRequest) {
  if (!input.requestId) return null;
  const { data, error } = await db
    .from("manager_synthesis_runs")
    .select("id,status,conversation_id,request_id,request_payload,result_payload,started_at,completed_at,error,attempt_count")
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("artist_id", input.artistId)
    .eq("workflow_version", MANAGER_CONVERSATION_WORKFLOW_VERSION)
    .eq("idempotency_key", input.requestId)
    .maybeSingle();
  if (error) throw error;
  return (data as ManagerConversationRunRow | null) ?? null;
}

export function managerConversationRunIsActive(run: ManagerConversationRunRow, now = Date.now()) {
  if (run.status !== "running") return false;
  if (!run.started_at) return true;
  const startedAt = Date.parse(run.started_at);
  return !Number.isFinite(startedAt) || now - startedAt < ACTIVE_RUN_MAX_AGE_MS;
}

export async function resumeManagerConversationRun(
  db: any,
  run: ManagerConversationRunRow,
  input: ManagerConversationRequest,
) {
  const { error } = await db
    .from("manager_synthesis_runs")
    .update({
      status: "running",
      request_payload: managerConversationRequestPayload(input),
      result_payload: {},
      error: null,
      completed_at: null,
      started_at: new Date().toISOString(),
      available_at: new Date().toISOString(),
      last_attempt_started_at: new Date().toISOString(),
      attempt_count: Number(run.attempt_count ?? 0) + 1,
    })
    .eq("id", run.id)
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId);
  if (error) throw error;
}

export async function ensureManagerConversationRun(
  db: any,
  input: ManagerConversationRequest,
  conversationId: string,
  packet: unknown,
  existingRun?: ManagerConversationRunRow | null,
  requestPayload = managerConversationRequestPayload(input),
): Promise<ManagerConversationRunHandle> {
  const now = new Date().toISOString();
  if (existingRun) {
    if (existingRun.status === "completed") return { runId: existingRun.id, state: "completed" };
    if (managerConversationRunIsActive(existingRun)) return { runId: existingRun.id, state: "in_progress" };
    await resumeManagerConversationRun(db, existingRun, input);
    return { runId: existingRun.id, state: "started" };
  }

  const { data, error } = await db
    .from("manager_synthesis_runs")
    .insert({
      account_id: input.accountId,
      artist_workspace_id: input.artistWorkspaceId,
      artist_id: input.artistId,
      trigger_type: "conversation",
      conversation_id: conversationId,
      status: "running",
      classification: "manager_conversation_router_v1",
      confidence: "unknown",
      workflow_version: MANAGER_CONVERSATION_WORKFLOW_VERSION,
      idempotency_key: input.requestId,
      request_id: input.requestId,
      request_payload: requestPayload,
      context_payload: packet,
      steps_payload: [{ step: "packet_built", status: "completed" }, { step: "manager_synthesis", status: "running" }],
      action_plan: [],
      limitations: [],
      started_at: now,
      available_at: now,
      last_attempt_started_at: now,
    })
    .select("id")
    .single();
  if (!error && data?.id) return { runId: data.id as string, state: "started" };
  if (!isUniqueViolation(error)) throw error ?? new Error("Manager request could not be registered.");

  const concurrentRun = await findManagerConversationRun(db, input);
  if (!concurrentRun) throw new Error("Manager request registration raced and could not be recovered.");
  if (concurrentRun.status === "completed") return { runId: concurrentRun.id, state: "completed" };
  if (managerConversationRunIsActive(concurrentRun)) return { runId: concurrentRun.id, state: "in_progress" };
  await resumeManagerConversationRun(db, concurrentRun, input);
  return { runId: concurrentRun.id, state: "started" };
}

function cleanRequestId(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim().toLowerCase() : "";
}

function isUniqueViolation(error: unknown) {
  if (!error) return false;
  if (typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "23505") return true;
  return /duplicate key|unique constraint/i.test(String(error));
}
