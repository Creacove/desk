import { withAppErrorCapture } from "../_shared/appFunction.ts";
import { captureAppError } from "../_shared/appError.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MODEL = () => Deno.env.get("OPENAI_MANAGER_REASONING_MODEL")
  || Deno.env.get("OPENAI_SUMMARY_MODEL")
  || "gpt-5-mini";

type RunnerInput = {
  candidateId: string;
  source?: string;
};

type ClaimedCandidate = {
  id: string;
  account_id: string;
  artist_workspace_id: string;
  artist_id: string;
  mission_id: string | null;
  action_kind: "prepare_split_confirmations_for_approval";
  target_type: "music_item";
  target_id: string;
  effect_fingerprint: string;
  attempt_count: number;
  context_payload: Record<string, unknown>;
};

type ManagerActionDecision = {
  decision: "prepare" | "hold";
  reason: string;
};

const decisionSchema = {
  name: "manager_external_action_decision_v1",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["decision", "reason"],
    properties: {
      decision: { type: "string", enum: ["prepare", "hold"] },
      reason: { type: "string", minLength: 1, maxLength: 600 },
    },
  },
} as const;

const decisionInstructions = [
  "You are the operating Manager for an artist. Decide whether one server-built external-action candidate should now be prepared for the artist's approval.",
  "You are NOT authorizing or executing the external effect. A prepare decision only asks Desk to freeze the exact canonical effect and show a separate approval transaction to the artist.",
  "The server has already validated the target, recipients, shares, ownership tuple, current Mission plan, and technical send readiness. You must not invent, repeat, transform, or request any executable IDs, emails, shares, or recipients.",
  "Choose prepare only when this action is genuinely the next sensible management move for the current Mission and does not conflict with the Mission state or known operating context.",
  "Choose hold when the action is technically ready but strategically premature, contradictory, unnecessary, or should wait for another current move.",
  "Do not ask a question. Do not create Tasks. Do not rewrite the plan. This is a bounded action-decision step over exactly one trusted candidate.",
  "A prior or pending approval for the exact effect is handled by the server's idempotency boundary; do not claim anything was sent.",
  "Return only the structured decision and a concise management reason.",
].join("\n");

Deno.serve(withAppErrorCapture("manager-action-intent-runner", async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  let input: RunnerInput | null = null;
  let candidate: ClaimedCandidate | null = null;
  let runId: string | null = null;
  let usageId: string | null = null;
  let db: any = null;
  let failureStage = "validate_request";

  try {
    input = (await request.json()) as RunnerInput;
    validateInput(input);

    const supabaseUrl = requireEnv("SUPABASE_URL");
    const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const authHeader = request.headers.get("Authorization") ?? "";
    if (!constantTimeEqual(authHeader, `Bearer ${serviceRoleKey}`)) {
      return json({ error: "Unauthorized." }, 401);
    }

    db = createClient(supabaseUrl, serviceRoleKey);

    failureStage = "claim_candidate";
    candidate = await claimCandidate(db, input.candidateId);
    if (!candidate) {
      return json({ status: "not_claimed", candidateId: input.candidateId });
    }

    failureStage = "load_context";
    const context = await loadDecisionContext(db, candidate);

    failureStage = "create_run";
    runId = await createManagerRun(db, candidate, context, input.source);

    failureStage = "create_usage";
    usageId = await createUsageEvent(db, candidate, runId);

    failureStage = "decide_action";
    const { decision, usage } = await requestDecision(context);

    if (decision.decision === "prepare") {
      failureStage = "persist_typed_intent";
      await persistPreparationIntent(db, candidate, runId, decision);
    }

    failureStage = "complete_candidate";
    const completed = await completeCandidate(db, candidate.id, runId, decision);
    await completeUsageEventSafe(db, usageId, usage);

    return json({
      status: "completed",
      source: input.source ?? "manager-action-intent",
      ...completed,
    });
  } catch (error) {
    const message = describeError(error, "Manager could not safely decide the external action.");
    if (runId && db) await failRunSafe(db, runId, message);
    if (usageId && db) await failUsageSafe(db, usageId, message);
    if (candidate?.id && db) await requeueCandidateSafe(db, candidate.id, message);

    const errorEventId = await captureAppError(error, {
      functionName: "manager-action-intent-runner",
      operation: "external_action_decision",
      source: failureStage === "persist_typed_intent" || failureStage === "complete_candidate" ? "database" : "worker",
      publicMessage: "Manager could not safely decide the external action.",
      requestId: request.headers.get("x-request-id") ?? undefined,
      accountId: candidate?.account_id,
      artistWorkspaceId: candidate?.artist_workspace_id,
      artistId: candidate?.artist_id,
      provider: failureStage === "decide_action" ? "openai" : undefined,
      refs: {
        manager_run_id: runId,
        mission_id: candidate?.mission_id,
        stage: failureStage,
      },
      context: {
        candidateId: candidate?.id ?? input?.candidateId,
        actionKind: candidate?.action_kind,
        currentCanonicalStatePreserved: true,
      },
    });

    return json({
      error: message,
      errorEventId,
      candidateId: candidate?.id ?? input?.candidateId,
      currentCanonicalStatePreserved: true,
    }, 500);
  }
}));

function validateInput(input: RunnerInput) {
  if (!input?.candidateId || typeof input.candidateId !== "string" || !input.candidateId.trim()) {
    throw new Error("Manager action decision requires a candidate ID.");
  }
  if (input.source != null && typeof input.source !== "string") {
    throw new Error("Manager action decision source must be text.");
  }
}

async function claimCandidate(db: any, candidateId: string): Promise<ClaimedCandidate | null> {
  const { data, error } = await db.rpc("claim_manager_action_candidate_v1", { p_candidate_id: candidateId });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row?.id ? row as ClaimedCandidate : null;
}

async function loadDecisionContext(db: any, candidate: ClaimedCandidate) {
  if (!candidate.mission_id) throw new Error("External action candidate is missing its Mission.");

  const [missionResult, taskResult, permissionResult, eventResult] = await Promise.all([
    db.from("missions")
      .select("id,title,objective,status,current_recommendation,review_point,active_plan_version_id,updated_at")
      .eq("id", candidate.mission_id)
      .eq("account_id", candidate.account_id)
      .eq("artist_workspace_id", candidate.artist_workspace_id)
      .eq("artist_id", candidate.artist_id)
      .maybeSingle(),
    db.from("tasks")
      .select("title,status,purpose,completion_expectation,manager_responsibility,user_responsibility,updated_at")
      .eq("mission_id", candidate.mission_id)
      .eq("artist_workspace_id", candidate.artist_workspace_id)
      .eq("artist_id", candidate.artist_id)
      .in("status", ["proposed", "open", "needs_approval", "approved", "in_progress", "blocked", "missed"])
      .order("updated_at", { ascending: false })
      .limit(20),
    db.from("permission_requests")
      .select("request_type,title,status,created_at")
      .eq("mission_id", candidate.mission_id)
      .eq("artist_workspace_id", candidate.artist_workspace_id)
      .eq("artist_id", candidate.artist_id)
      .in("status", ["pending", "approved"])
      .order("created_at", { ascending: false })
      .limit(10),
    db.from("operating_events")
      .select("event_type,summary,payload,created_at")
      .eq("mission_id", candidate.mission_id)
      .eq("artist_workspace_id", candidate.artist_workspace_id)
      .eq("artist_id", candidate.artist_id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  for (const result of [missionResult, taskResult, permissionResult, eventResult]) {
    if (result.error) throw result.error;
  }
  if (!missionResult.data) throw new Error("External action candidate Mission was not found.");

  return {
    packetVersion: "manager_external_action_decision_v1",
    candidate: candidate.context_payload,
    mission: missionResult.data,
    currentHumanWork: Array.isArray(taskResult.data) ? taskResult.data : [],
    pendingApprovals: Array.isArray(permissionResult.data) ? permissionResult.data : [],
    recentOperatingEvents: Array.isArray(eventResult.data) ? eventResult.data : [],
    policy: {
      candidateWasConstructedAndValidatedByServer: true,
      canonicalReadinessIsNotAuthorization: true,
      prepareCreatesApprovalButDoesNotExecute: true,
      externalEffectStillRequiresHumanApproval: true,
      modelMustNotSupplyExecutableTargetIds: true,
      realProviderReceiptRequiredBeforeClaimingSent: true,
    },
  };
}

async function createManagerRun(
  db: any,
  candidate: ClaimedCandidate,
  context: Record<string, unknown>,
  source?: string,
) {
  const { data, error } = await db.from("manager_synthesis_runs").insert({
    account_id: candidate.account_id,
    artist_workspace_id: candidate.artist_workspace_id,
    artist_id: candidate.artist_id,
    trigger_type: "review",
    mission_id: candidate.mission_id,
    status: "running",
    classification: "manager_external_action_decider_v1",
    confidence: "unknown",
    context_payload: {
      scope: {
        accountId: candidate.account_id,
        artistWorkspaceId: candidate.artist_workspace_id,
        artistId: candidate.artist_id,
        musicSubject: { type: "music_item", id: candidate.target_id },
      },
      externalActionDecision: context,
      dispatchSource: source ?? "manager-action-intent",
    },
    steps_payload: [
      { step: "candidate_claimed", status: "completed" },
      { step: "manager_action_decided", status: "running" },
      { step: "decision_persisted", status: "pending" },
    ],
    action_plan: [],
    limitations: [],
    started_at: new Date().toISOString(),
  }).select("id").single();
  if (error) throw error;
  return String(data.id);
}

async function createUsageEvent(db: any, candidate: ClaimedCandidate, runId: string) {
  const { data, error } = await db.from("ai_run_usage_events").insert({
    account_id: candidate.account_id,
    artist_workspace_id: candidate.artist_workspace_id,
    artist_id: candidate.artist_id,
    workflow_key: "review_run",
    run_type: "manager_synthesis",
    manager_synthesis_run_id: runId,
    subject_type: "music_item",
    subject_id: candidate.target_id,
    provider: "openai",
    model_or_tool: MODEL(),
    operation_key: "manager_external_action_decision",
    status: "started",
    provider_request_count: 1,
  }).select("id").single();
  if (error) throw error;
  return String(data.id);
}

async function requestDecision(context: Record<string, unknown>) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireEnv("OPENAI_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL(),
      reasoning: { effort: "medium" },
      instructions: decisionInstructions,
      input: JSON.stringify(context),
      text: { format: { type: "json_schema", ...decisionSchema } },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Manager external action decision failed with status ${response.status}: ${body.slice(0, 500)}`);
  }

  const payload = await response.json();
  const rawText = readOutputText(payload);
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error("Manager external action decision returned invalid JSON.");
  }

  const row = record(parsed);
  const decision = row.decision;
  const reason = typeof row.reason === "string" ? row.reason.trim() : "";
  if ((decision !== "prepare" && decision !== "hold") || !reason) {
    throw new Error("Manager external action decision violated its structured contract.");
  }

  return {
    decision: { decision, reason: reason.slice(0, 600) } as ManagerActionDecision,
    usage: record(payload.usage),
  };
}

async function persistPreparationIntent(
  db: any,
  candidate: ClaimedCandidate,
  runId: string,
  decision: ManagerActionDecision,
) {
  const { data: inserted, error: insertError } = await db.from("manager_run_actions").insert({
    account_id: candidate.account_id,
    artist_workspace_id: candidate.artist_workspace_id,
    artist_id: candidate.artist_id,
    manager_synthesis_run_id: runId,
    order_index: 0,
    action_type: "prepare_split_confirmations_for_approval",
    target_type: "focused_music_item",
    status: "pending",
    approval_required: false,
    payload: {
      actionType: "prepare_split_confirmations_for_approval",
      targetType: "focused_music_item",
      title: "Prepare split confirmations",
      body: decision.reason,
      approvalRequired: false,
    },
    result_payload: {},
  }).select("id").single();
  if (insertError) throw insertError;

  // PostgreSQL RETURNING does not promise visibility of a separate UPDATE issued
  // by an AFTER trigger. Re-read after the insert transaction settles so the
  // runner verifies the actual durable trigger result instead of stale pending
  // state and accidentally requeuing a successfully prepared permission.
  const actionId = String(inserted?.id ?? "");
  if (!actionId) throw new Error("Typed split-confirmation preparation action was not persisted.");

  const { data, error } = await db.from("manager_run_actions")
    .select("id,status,target_type,target_id,result_payload,error")
    .eq("id", actionId)
    .eq("manager_synthesis_run_id", runId)
    .eq("account_id", candidate.account_id)
    .eq("artist_workspace_id", candidate.artist_workspace_id)
    .eq("artist_id", candidate.artist_id)
    .single();
  if (error) throw error;

  const action = record(data);
  const result = record(action.result_payload);
  if (action.status !== "applied" || !["prepared", "replayed"].includes(String(result.status ?? ""))) {
    throw new Error(`Typed split-confirmation preparation did not safely resolve: ${String(action.error ?? result.reason ?? action.status ?? "unknown")}`);
  }
}

async function completeCandidate(
  db: any,
  candidateId: string,
  runId: string,
  decision: ManagerActionDecision,
) {
  const { data, error } = await db.rpc("complete_manager_action_candidate_v1", {
    p_candidate_id: candidateId,
    p_run_id: runId,
    p_decision: decision.decision,
    p_reason: decision.reason,
  });
  if (error) throw error;
  return record(data);
}

async function completeUsageEventSafe(db: any, usageId: string, usage: Record<string, unknown>) {
  try {
    const outputDetails = record(usage.output_tokens_details);
    const { error } = await db.from("ai_run_usage_events").update({
      status: "succeeded",
      input_tokens: numericUsage(usage.input_tokens),
      output_tokens: numericUsage(usage.output_tokens),
      reasoning_tokens: numericUsage(outputDetails.reasoning_tokens),
      provider_request_count: numericUsage(usage.provider_request_count) ?? 1,
      completed_at: new Date().toISOString(),
      metadata: usage,
    }).eq("id", usageId);
    if (error) throw error;
  } catch (error) {
    console.warn("manager-action-intent-runner: usage accounting failed after completion", describeError(error, "usage accounting failed"));
    await failUsageSafe(db, usageId, describeError(error, "usage accounting failed"));
  }
}

async function failRunSafe(db: any, runId: string, message: string) {
  try {
    await db.from("manager_synthesis_runs").update({
      status: "failed",
      error: message.slice(0, 1000),
      completed_at: new Date().toISOString(),
    }).eq("id", runId).eq("status", "running");
  } catch {
    // Best effort. Candidate recovery remains authoritative.
  }
}

async function failUsageSafe(db: any, usageId: string, message: string) {
  try {
    await db.from("ai_run_usage_events").update({
      status: "failed",
      failure_reason: message.slice(0, 1000),
      completed_at: new Date().toISOString(),
    }).eq("id", usageId).eq("status", "started");
  } catch {
    // Best effort only.
  }
}

async function requeueCandidateSafe(db: any, candidateId: string, message: string) {
  try {
    await db.rpc("requeue_manager_action_candidate_v1", {
      p_candidate_id: candidateId,
      p_error: message,
    });
  } catch {
    // The stale-claim reaper is the final recovery path.
  }
}

function readOutputText(payload: Record<string, unknown>) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) return payload.output_text.trim();
  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    const row = record(item);
    const content = Array.isArray(row.content) ? row.content : [];
    for (const contentItem of content) {
      const contentRow = record(contentItem);
      if (typeof contentRow.text === "string" && contentRow.text.trim()) return contentRow.text.trim();
    }
  }
  throw new Error("Manager external action decision returned no structured output.");
}

function numericUsage(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : null;
}

function record(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
}

function describeError(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim() ? error.message.trim() : fallback;
}

function constantTimeEqual(left: string, right: string) {
  const length = Math.max(left.length, right.length, 1);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index % Math.max(left.length, 1)) || 0) ^
      (right.charCodeAt(index % Math.max(right.length, 1)) || 0);
  }
  return difference === 0;
}

function requireEnv(key: string) {
  const value = Deno.env.get(key);
  if (!value) throw new Error(`Missing ${key}.`);
  return value;
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
