import { markErrorCaptured, withAppErrorCapture } from "../_shared/appFunction.ts";
import { captureAppError } from "../_shared/appError.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { assertActiveWorkspaceEntitlement } from "../_shared/entitlements.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ReviewInput = {
  accountId: string;
  artistWorkspaceId: string;
  artistId: string;
  taskId: string;
  status: "completed" | "blocked";
  note: string;
  documentIds?: string[];
  managerOutputId?: string;
};

type ManagerTaskReview = {
  outcome: "accepted" | "needs_revision" | "blocked";
  summary: string;
  managerInterpretation: string;
  missionEffect: string;
  checkpointEffect: string;
  recommendedFollowUp: string;
  checkpointStatus: "waiting" | "blocked" | "ready_for_manager_check" | "watching_signal" | "needs_revision" | "met" | "skipped";
  checkpointRecommendation: string;
  missionStatus: "active" | "blocked" | "review" | "paused" | "complete";
  missionProgress: number;
  missionRecommendation: string;
  memoryEntries: string[];
  followUpTasks: Array<{
    title: string;
    purpose: string;
    ownerRole: string;
    workMode: "artist_action" | "collaborative";
    steps: string[];
    evidenceNeeded: string[];
    completionExpectation: string;
    completionMode: "result_note" | "manager_draft";
    managerResponsibility: string;
    userResponsibility: string;
    riskIfLate: string;
    estimatedMinutes: number;
  }>;
  permissionRequests: Array<{ title: string; requestType: string; body: string; risk: string }>;
};

Deno.serve(withAppErrorCapture("manager-review-task-result", async (request) => {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  let runId: string | null = null;
  let usageId: string | null = null;
  let input: ReviewInput | undefined;
  let failureStage = "validate_request";

  try {
    input = (await request.json()) as ReviewInput;
    validateInput(input);

    const authHeader = request.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header." }, 401);

    const supabaseUrl = requireEnv("SUPABASE_URL");
    const anonKey = requireEnv("SUPABASE_ANON_KEY");
    const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await authClient.auth.getUser();
    if (userError || !user) return json({ error: "Unauthorized." }, 401);

    const { data: membership, error: membershipError } = await authClient.rpc("is_account_member", { target_account_id: input.accountId });
    if (membershipError) throw membershipError;
    if (!membership) return json({ error: "Forbidden." }, 403);
    await assertActiveWorkspaceEntitlement(authClient, input);

    const db = createClient(supabaseUrl, serviceRoleKey);
    failureStage = "load_review_context";
    const context = await loadReviewContext(db, input, user.id);
    failureStage = "create_manager_run";
    runId = await createManagerRun(db, input, context);
    failureStage = "create_usage_event";
    usageId = await createUsageEvent(db, input, runId);

    failureStage = "openai_review";
    const { review, usage } = await callOpenAIManagerReview(context);
    failureStage = "validate_review_continuation";
    await preflightReviewContinuation(db, context, runId, review);
    failureStage = "persist_review";
    await applyManagerReview(db, input, context, runId, review);
    failureStage = "complete_run";
    await completeManagerRun(db, runId, review);
    await completeUsageEvent(db, usageId, usage);

    const mission = await selectMission(db, input, context.task.mission_id);
    return json({ mission, review });
  } catch (error) {
    const message = describeError(error, "Manager task review failed.");
    const errorEventId = await captureAppError(error, {
      functionName: "manager-review-task-result",
      operation: "review_task_result",
      source: failureStage === "persist_review" ? "database" : "edge",
      publicMessage: message,
      requestId: request.headers.get("x-request-id") ?? undefined,
      accountId: input?.accountId,
      artistWorkspaceId: input?.artistWorkspaceId,
      artistId: input?.artistId,
      provider: failureStage === "openai_review" ? "openai" : undefined,
      refs: {
        manager_run_id: runId,
        usage_event_id: usageId,
        task_id: input?.taskId,
        stage: failureStage,
      },
    });
    if (runId) await markRunFailedSafe(runId, message);
    if (usageId) await markUsageFailedSafe(usageId, message);
    return markErrorCaptured(json({ error: message, errorEventId }, 500), errorEventId);
  }
}));

function validateInput(input: ReviewInput) {
  if (!input?.accountId || !input.artistWorkspaceId || !input.artistId || !input.taskId) throw new Error("Manager task review input is incomplete.");
  if (input.status !== "completed" && input.status !== "blocked") throw new Error("Manager task review status must be completed or blocked.");
  if (typeof input.note !== "string") throw new Error("Manager task review note must be a string.");
  if (input.documentIds && !Array.isArray(input.documentIds)) throw new Error("Manager task review document IDs must be an array.");
}

async function loadReviewContext(db: any, input: ReviewInput, submittedByUserId: string) {
  const { data: workspace, error: workspaceError } = await db
    .from("artist_workspaces")
    .select("id,account_id,artist_id")
    .eq("id", input.artistWorkspaceId)
    .eq("account_id", input.accountId)
    .eq("artist_id", input.artistId)
    .maybeSingle();
  if (workspaceError) throw workspaceError;
  if (!workspace) throw new Error("Manager task review workspace was not found.");

  const { data: task, error: taskError } = await db
    .from("tasks")
    .select("id,mission_id,primary_checkpoint_id,title,status,owner_role,work_mode,purpose,evidence_needed,completion_expectation,completion_mode,deliverable_title,deliverable_requirements,manager_responsibility,user_responsibility,risk_if_late")
    .eq("id", input.taskId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("artist_id", input.artistId)
    .maybeSingle();
  if (taskError) throw taskError;
  if (!task?.mission_id) throw new Error("Manager task review task was not found.");
  assertTaskCanBeReviewed(task);

  const [profile, mission, checkpoint, missionTasks, taskSteps, previousResults, memory, events, managerPackets, submittedDocuments, submittedManagerDraft, canonicalMusicPackage] = await Promise.all([
    selectMany(db, "artist_profiles", "id,display_name,genres,home_market,stage,current_goal,artist_direction,budget_context", input, 1),
    selectMission(db, input, task.mission_id),
    task.primary_checkpoint_id ? selectCheckpoint(db, input, task.primary_checkpoint_id) : null,
    selectByMission(db, "tasks", "id,mission_id,primary_checkpoint_id,title,status,owner_role,work_mode,purpose,evidence_needed,completion_expectation,completion_mode,deliverable_title,deliverable_requirements,manager_responsibility,user_responsibility,risk_if_late", input, task.mission_id, 80),
    selectMany(db, "task_steps", "id,task_id,order_index,body", input, 160),
    selectMany(db, "task_results", "id,task_id,mission_id,checkpoint_id,status,summary,user_note,manager_interpretation,mission_effect,recommended_follow_up,created_at", input, 80),
    selectMany(db, "memory_entries", "id,scope,kind,content,source_type,confidence,mission_id,task_id,checkpoint_id,created_at", input, 120),
    selectMany(db, "operating_events", "id,event_type,target_type,target_id,mission_id,checkpoint_id,task_id,summary,payload,created_at", input, 80),
    selectMany(db, "manager_intelligence_packets", "id,packet_type,profile_projection_json,strategic_diagnosis_json,mission_seed_json,conversation_memory_seed_json,supporting_evidence_json,created_at", input, 1),
    loadSubmittedDocuments(db, input),
    loadSubmittedManagerDraft(db, input),
    loadTaskMusicPackage(db, input, task.mission_id),
  ]);

  if (input.status === "completed" && task.completion_mode === "manager_draft" && !submittedManagerDraft) {
    throw new Error("This task needs a Manager draft before it can be submitted for review.");
  }
  if (!input.note.trim() && (input.status === "blocked" || !task.completion_mode || task.completion_mode === "result_note")) {
    throw new Error("Manager task review requires the task result note.");
  }

  return {
    packetVersion: "manager_task_result_review_v1",
    submittedByUserId,
    generatedAt: new Date().toISOString(),
    input: { taskId: input.taskId, status: input.status, note: input.note.trim(), documentIds: input.documentIds ?? [] },
    profile: profile[0] ?? {},
    mission,
    checkpoint,
    task,
    missionTasks,
    taskSteps,
    previousResults,
    memory,
    recentOperatingEvents: events,
    latestManagerIntelligencePacket: managerPackets[0] ?? null,
    submittedDocuments,
    submittedManagerDraft,
    canonicalMusicPackage,
    policy: {
      internalWorkspaceUpdatesAllowed: true,
      externalExpensiveLegalFinancialPublicActionsRequirePermission: true,
      reviewMustUpdateMissionState: true,
      memoryAfterMeaningfulResult: true,
      submittedDocumentsAreOptionalContext: true,
    },
  };
}

function assertTaskCanBeReviewed(task: { status?: unknown }) {
  if (task.status === "superseded") {
    throw new Error("This task belongs to an earlier mission plan. Refresh Missions and use the current task instead.");
  }
}

async function callOpenAIManagerReview(context: unknown) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${requireEnv("OPENAI_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: Deno.env.get("OPENAI_MANAGER_TASK_REVIEW_MODEL") || Deno.env.get("OPENAI_MANAGER_REASONING_MODEL") || Deno.env.get("OPENAI_SUMMARY_MODEL") || "gpt-5-mini",
      reasoning: { effort: "low" },
      instructions: [
        "You are the AI Manager reviewing a completed or blocked mission task result.",
        "Decide what the task result means for the checkpoint and mission. Update internal workspace state only; permission-required external actions must be returned as permissionRequests.",
        "Optional documents can raise confidence when present. Their absence must not prevent task completion; state the evidence limit and choose a safe recommendation from the available packet.",
        "When submittedManagerDraft is present, review that exact immutable version against every deliverableRequirement and completionExpectation.",
        "canonicalMusicPackage is the current persisted Song Room state for this task's Mission. An uploaded or processed canonical Song Room asset is valid evidence even when documentIds is empty. Do not require the artist to reattach, rename, or restate a file that canonicalMusicPackage already proves exists.",
        "Return outcome accepted only when the completion contract is met, needs_revision when the same task should continue with concrete edits, or blocked when an external dependency prevents progress.",
        "After the final required task, choose met, needs_revision, or watching_signal and explain the decision through checkpointRecommendation.",
        "Do not create busywork. Add follow-up work only when the result changes what the mission needs next.",
        "Every human follow-up must be immediately executable: provide at least two distinct ordered steps (at least four for content/video execution), a concrete completion expectation, the exact work Desk will do, the exact work the artist/team must do, and the risk of delay. Desk must complete the Manager responsibility itself; never assign research, analysis, drafting, interpretation, or planning back to the artist.",
      ].join("\n"),
      input: JSON.stringify(context),
      text: { format: { type: "json_schema", ...reviewJsonSchema } },
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Manager task review request failed with status ${response.status}: ${body.slice(0, 500)}`);
  }
  const payload = await response.json();
  return {
    review: normalizeReview(readOutputText(payload)),
    usage: isRecord(payload.usage) ? payload.usage : {},
  };
}

const reviewJsonSchema = {
  name: "manager_task_result_review_v1",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "summary",
      "outcome",
      "managerInterpretation",
      "missionEffect",
      "checkpointEffect",
      "recommendedFollowUp",
      "checkpointStatus",
      "checkpointRecommendation",
      "missionStatus",
      "missionProgress",
      "missionRecommendation",
      "memoryEntries",
      "followUpTasks",
      "permissionRequests",
    ],
    properties: {
      outcome: { type: "string", enum: ["accepted", "needs_revision", "blocked"] },
      summary: { type: "string" },
      managerInterpretation: { type: "string" },
      missionEffect: { type: "string" },
      checkpointEffect: { type: "string" },
      recommendedFollowUp: { type: "string" },
      checkpointStatus: { type: "string", enum: ["waiting", "blocked", "ready_for_manager_check", "watching_signal", "needs_revision", "met", "skipped"] },
      checkpointRecommendation: { type: "string" },
      missionStatus: { type: "string", enum: ["active", "blocked", "review", "paused", "complete"] },
      missionProgress: { type: "integer", minimum: 0, maximum: 100 },
      missionRecommendation: { type: "string" },
      memoryEntries: { type: "array", maxItems: 6, items: { type: "string" } },
      followUpTasks: {
        type: "array",
        maxItems: 4,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "purpose", "ownerRole", "workMode", "steps", "evidenceNeeded", "completionExpectation", "completionMode", "managerResponsibility", "userResponsibility", "riskIfLate", "estimatedMinutes"],
          properties: {
            title: { type: "string" },
            purpose: { type: "string" },
            ownerRole: { type: "string" },
            workMode: { type: "string", enum: ["artist_action", "collaborative"] },
            steps: { type: "array", minItems: 2, maxItems: 8, items: { type: "string" } },
            evidenceNeeded: { type: "array", items: { type: "string" } },
            completionExpectation: { type: "string" },
            completionMode: { type: "string", enum: ["result_note", "manager_draft"] },
            managerResponsibility: { type: "string" },
            userResponsibility: { type: "string" },
            riskIfLate: { type: "string" },
            estimatedMinutes: { type: "integer", minimum: 5, maximum: 240 },
          },
        },
      },
      permissionRequests: {
        type: "array",
        maxItems: 4,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "requestType", "body", "risk"],
          properties: {
            title: { type: "string" },
            requestType: { type: "string" },
            body: { type: "string" },
            risk: { type: "string" },
          },
        },
      },
    },
  },
};

async function applyManagerReview(db: any, input: ReviewInput, context: any, runId: string, review: ManagerTaskReview) {
  const now = new Date().toISOString();
  const checkpointId = context.task.primary_checkpoint_id ?? null;
  const outcome = input.status === "blocked" ? "blocked" : review.outcome;
  const taskState = outcome === "accepted"
    ? { status: "completed", resultStatus: "completed", eventType: "task_completed" }
    : outcome === "needs_revision"
      ? { status: "in_progress", resultStatus: "revised", eventType: "task_needs_revision" }
      : { status: "blocked", resultStatus: "blocked", eventType: "task_blocked" };
  const checkpointStatus = resolveCheckpointStatus(context, checkpointId, input.taskId, outcome, review.checkpointStatus);

  const { error: taskError } = await db
    .from("tasks")
    .update({
      status: taskState.status,
      updated_at: now,
    })
    .eq("id", input.taskId)
    .eq("artist_workspace_id", input.artistWorkspaceId);
  if (taskError) throw taskError;

  const { error: eventError } = await db.from("task_state_events").insert({
    account_id: input.accountId,
    artist_workspace_id: input.artistWorkspaceId,
    artist_id: input.artistId,
    mission_id: context.task.mission_id,
    checkpoint_id: checkpointId,
    task_id: input.taskId,
    event_type: taskState.eventType,
    from_status: context.task.status,
    to_status: taskState.status,
    actor_type: "user",
    reason: input.note.trim(),
    payload: { manager_review: review.summary },
    created_from_run_id: runId,
  });
  if (eventError) throw eventError;

  const { data: result, error: resultError } = await db.from("task_results").insert({
    account_id: input.accountId,
    artist_workspace_id: input.artistWorkspaceId,
    artist_id: input.artistId,
    mission_id: context.task.mission_id,
    checkpoint_id: checkpointId,
    task_id: input.taskId,
    status: taskState.resultStatus,
    user_note: input.note.trim(),
    submitted_manager_output_id: context.submittedManagerDraft?.id ?? null,
    submitted_by_user_id: context.submittedByUserId,
    raw_event: { source: "manager-review-task-result", input },
    summary: review.summary,
    manager_interpretation: review.managerInterpretation,
    mission_effect: review.missionEffect,
    checkpoint_effect: review.checkpointEffect,
    recommended_follow_up: review.recommendedFollowUp,
    confidence: "medium",
    created_from_run_id: runId,
  }).select("id").single();
  if (resultError) throw resultError;

  if (checkpointId) {
    const { error } = await db.from("checkpoints").update({
      status: checkpointStatus,
      recommendation: review.checkpointRecommendation,
      dependency_impact: review.checkpointEffect,
      next_action: review.recommendedFollowUp,
      blocked_reason: checkpointStatus === "needs_revision" || checkpointStatus === "blocked"
        ? review.checkpointEffect : null,
      updated_at: now,
    }).eq("id", checkpointId).eq("artist_workspace_id", input.artistWorkspaceId);
    if (error) throw error;
  }

  const { error: missionError } = await db.from("missions").update({
    status: outcome === "needs_revision" ? "active" : outcome === "blocked" ? "blocked" : review.missionStatus,
    progress: clampProgress(review.missionProgress),
    review_point: context.checkpoint?.title ?? context.mission.review_point ?? "Manager task review",
    current_recommendation: review.missionRecommendation,
    updated_at: now,
  }).eq("id", context.task.mission_id).eq("artist_workspace_id", input.artistWorkspaceId);
  if (missionError) throw missionError;

  const { data: existingMemory, error: existingMemoryError } = await db
    .from("memory_entries")
    .select("content")
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("task_id", input.taskId)
    .limit(100);
  if (existingMemoryError) throw existingMemoryError;
  const knownMemory = new Set((existingMemory ?? []).map((item: any) => normalizeMemoryContent(item.content)));

  for (const content of review.memoryEntries.slice(0, 6)) {
    const normalizedContent = normalizeMemoryContent(content);
    if (!normalizedContent || knownMemory.has(normalizedContent)) continue;
    const { error } = await db.from("memory_entries").insert({
      account_id: input.accountId,
      artist_workspace_id: input.artistWorkspaceId,
      artist_id: input.artistId,
      mission_id: context.task.mission_id,
      checkpoint_id: checkpointId,
      task_id: input.taskId,
      scope: "mission",
      kind: outcome === "blocked" ? "blocker" : "outcome_note",
      content: content.trim(),
      source_type: "manager_review_task_result",
      source_id: result.id,
      confidence: "medium",
      reason: review.managerInterpretation,
      created_from_run_id: runId,
    });
    if (error) throw error;
    knownMemory.add(normalizedContent);
  }

  const { data: operatingEvent, error: operatingEventError } = await db.from("operating_events").insert({
    account_id: input.accountId,
    artist_workspace_id: input.artistWorkspaceId,
    artist_id: input.artistId,
    event_type: taskState.eventType,
    actor_type: "manager",
    target_type: "task",
    target_id: input.taskId,
    source_type: "task_result",
    source_id: result.id,
    manager_synthesis_run_id: runId,
    mission_id: context.task.mission_id,
    checkpoint_id: checkpointId,
    task_id: input.taskId,
    display_mode: "activity",
    refresh_scope: ["missions", "activity"],
    summary: review.managerInterpretation,
    payload: { review, permissionRequests: review.permissionRequests, followUpTasks: review.followUpTasks },
  }).select("id").single();
  if (operatingEventError) throw operatingEventError;

  if (context.submittedManagerDraft?.id) {
    const render = isRecord(context.submittedManagerDraft.render_json) ? context.submittedManagerDraft.render_json : {};
    const { error: draftStatusError } = await db.from("manager_outputs").update({
      render_json: { ...render, status: outcome === "accepted" ? "accepted" : "needs_revision" },
    }).eq("id", context.submittedManagerDraft.id);
    if (draftStatusError) throw draftStatusError;
  }

  const { data: previousOutputs, error: previousOutputError } = await db
    .from("manager_outputs")
    .select("id")
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("subject_type", "task")
    .eq("subject_id", input.taskId)
    .eq("output_type", "review_read")
    .eq("is_current", true)
    .limit(1);
  if (previousOutputError) throw previousOutputError;
  const previousOutputId = previousOutputs?.[0]?.id ?? null;
  if (previousOutputId) {
    const { error: staleOutputError } = await db
      .from("manager_outputs")
      .update({ is_current: false })
      .eq("id", previousOutputId);
    if (staleOutputError) throw staleOutputError;
  }

  const { error: outputError } = await db.from("manager_outputs").insert({
    account_id: input.accountId,
    artist_workspace_id: input.artistWorkspaceId,
    artist_id: input.artistId,
    mission_id: context.task.mission_id,
    subject_type: "task",
    subject_id: input.taskId,
    output_type: "review_read",
    summary: review.summary,
    primary_recommendation_json: { recommendation: review.missionRecommendation },
    confidence_json: { confidence: "medium" },
    render_json: {
      taskId: input.taskId,
      missionId: context.task.mission_id,
      checkpointId,
      taskResultId: result.id,
      operatingEventId: operatingEvent.id,
      review,
    },
    created_from_run_id: runId,
    supersedes_output_id: previousOutputId,
    is_current: true,
  });
  if (outputError) throw outputError;
}

async function preflightReviewContinuation(db: any, context: any, runId: string, review: ManagerTaskReview) {
  const planVersionId = typeof context.mission?.active_plan_version_id === "string"
    ? context.mission.active_plan_version_id
    : "";
  if (!planVersionId || !context.checkpoint?.id) return;

  for (const task of review.followUpTasks) {
    const owner = task.ownerRole.trim().toLowerCase();
    if (["manager", "desk", "ai", "ai manager"].includes(owner)) continue;
    const { error } = await db.rpc("assert_generated_human_task_execution_contract_v1", {
      p_task: {
        scope: "mission",
        missionPlanVersionId: planVersionId,
        createdFromRunId: runId,
        title: task.title,
        ownerRole: task.ownerRole,
        workMode: task.workMode,
        purpose: task.purpose,
        completionExpectation: task.completionExpectation,
        completionMode: task.completionMode,
        managerResponsibility: task.managerResponsibility,
        userResponsibility: task.userResponsibility,
        riskIfLate: task.riskIfLate,
      },
      p_steps: task.steps,
    });
    if (error) throw error;
  }
}

function resolveCheckpointStatus(
  context: any,
  checkpointId: string | null,
  taskId: string,
  outcome: ManagerTaskReview["outcome"],
  modelStatus: ManagerTaskReview["checkpointStatus"],
) {
  if (outcome === "needs_revision") return "needs_revision";
  if (outcome === "blocked") return "blocked";
  if (!checkpointId) return modelStatus;

  const checkpointTasks = Array.isArray(context.missionTasks)
    ? context.missionTasks.filter((task: any) => task.primary_checkpoint_id === checkpointId && isBlockingMissionTask(task))
    : [];
  const allCheckpointTasksCompleted = checkpointTasks.length === 0 || checkpointTasks.every((task: any) =>
    task.id === taskId || task.status === "completed",
  );
  if (modelStatus === "met" && !allCheckpointTasksCompleted) return "ready_for_manager_check";
  return modelStatus;
}

async function createManagerRun(db: any, input: ReviewInput, context: unknown) {
  const { data, error } = await db.from("manager_synthesis_runs").insert({
    account_id: input.accountId,
    artist_workspace_id: input.artistWorkspaceId,
    artist_id: input.artistId,
    trigger_type: "task_result",
    mission_id: (context as any).task?.mission_id,
    status: "running",
    classification: "manager_task_result_review_v1",
    confidence: "unknown",
    context_payload: context,
    steps_payload: [{ step: "task_result_received", status: "completed" }, { step: "manager_review", status: "running" }],
    action_plan: [],
    limitations: [],
    started_at: new Date().toISOString(),
  }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

async function completeManagerRun(db: any, runId: string, review: ManagerTaskReview) {
  const { error } = await db.from("manager_synthesis_runs").update({
    status: "completed",
    classification: "manager_task_result_review_v1",
    confidence: "medium",
    steps_payload: [{ step: "task_result_received", status: "completed" }, { step: "manager_review", status: "completed" }],
    action_plan: [...review.followUpTasks, ...review.permissionRequests],
    limitations: [],
    completed_at: new Date().toISOString(),
  }).eq("id", runId);
  if (error) throw error;
}

async function createUsageEvent(db: any, input: ReviewInput, runId: string) {
  const { data, error } = await db.from("ai_run_usage_events").insert({
    account_id: input.accountId,
    artist_workspace_id: input.artistWorkspaceId,
    artist_id: input.artistId,
    workflow_key: "task_result_run",
    run_type: "manager_synthesis",
    manager_synthesis_run_id: runId,
    subject_type: "task",
    subject_id: input.taskId,
    provider: "openai",
    model_or_tool: Deno.env.get("OPENAI_MANAGER_TASK_REVIEW_MODEL") || Deno.env.get("OPENAI_MANAGER_REASONING_MODEL") || Deno.env.get("OPENAI_SUMMARY_MODEL") || "gpt-5-mini",
    operation_key: "manager_review_task_result",
    status: "started",
    provider_request_count: 1,
  }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

async function completeUsageEvent(db: any, usageId: string, usage: Record<string, unknown>) {
  const { error } = await db.from("ai_run_usage_events").update({
    status: "succeeded",
    input_tokens: numericUsage(usage.input_tokens),
    output_tokens: numericUsage(usage.output_tokens),
    reasoning_tokens: numericUsage(usage.output_tokens_details && isRecord(usage.output_tokens_details) ? usage.output_tokens_details.reasoning_tokens : undefined),
    completed_at: new Date().toISOString(),
    metadata: usage,
  }).eq("id", usageId);
  if (error) throw error;
}

async function markRunFailedSafe(runId: string, message: string) {
  try {
    const db = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"));
    await db.from("manager_synthesis_runs").update({ status: "failed", error: message, completed_at: new Date().toISOString() }).eq("id", runId);
  } catch {
    // Best effort only.
  }
}

async function markUsageFailedSafe(usageId: string, message: string) {
  try {
    const db = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"));
    await db.from("ai_run_usage_events").update({ status: "failed", failure_reason: message, completed_at: new Date().toISOString() }).eq("id", usageId);
  } catch {
    // Best effort only.
  }
}

async function loadSubmittedManagerDraft(db: any, input: ReviewInput) {
  if (!input.managerOutputId) return null;
  const { data, error } = await db.from("manager_outputs")
    .select("id,subject_id,mission_id,summary,render_json,created_at")
    .eq("id", input.managerOutputId)
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("artist_id", input.artistId)
    .eq("output_type", "task_draft")
    .eq("subject_type", "task")
    .eq("subject_id", input.taskId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("The submitted Manager draft version was not found.");
  return data;
}

async function loadSubmittedDocuments(db: any, input: ReviewInput) {
  const submittedIds = Array.isArray(input.documentIds) ? input.documentIds.filter((id) => typeof id === "string" && id.trim()).map((id) => id.trim()) : [];
  const { data: linkRows, error: linkError } = await db.from("artifact_links")
    .select("source_id,target_id,relationship")
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("artist_id", input.artistId)
    .eq("source_type", "document")
    .eq("target_type", "task")
    .eq("target_id", input.taskId);
  if (linkError) throw linkError;

  const linkedIds = Array.isArray(linkRows)
    ? linkRows.map((row) => isRecord(row) ? readString(row.source_id, "") : "").filter(Boolean)
    : [];
  const documentIds = [...new Set([...submittedIds, ...linkedIds])];
  if (!documentIds.length) return [];

  const [{ data: documentRows, error: documentError }, { data: versionRows, error: versionError }, { data: validationRows, error: validationError }] = await Promise.all([
    db.from("documents")
      .select("id,title,document_type,origin,status,summary,current_version_id,metadata,created_at")
      .eq("account_id", input.accountId)
      .eq("artist_workspace_id", input.artistWorkspaceId)
      .eq("artist_id", input.artistId)
      .in("id", documentIds),
    db.from("document_versions")
      .select("id,document_id,version_number,uploaded_file_id,file_name,file_type,storage_bucket,storage_ref,extraction_status,extracted_text_ref,metadata,created_at")
      .eq("account_id", input.accountId)
      .eq("artist_workspace_id", input.artistWorkspaceId)
      .eq("artist_id", input.artistId)
      .in("document_id", documentIds),
    db.from("document_validation_results")
      .select("id,document_id,document_version_id,verdict,missing_items,extracted_facts,manager_reasoning,confidence,created_at")
      .eq("account_id", input.accountId)
      .eq("artist_workspace_id", input.artistWorkspaceId)
      .eq("artist_id", input.artistId)
      .in("document_id", documentIds),
  ]);
  if (documentError) throw documentError;
  if (versionError) throw versionError;
  if (validationError) throw validationError;

  return ((documentRows ?? []) as Array<Record<string, unknown>>).map((document) => {
    const versions = ((versionRows ?? []) as Array<Record<string, unknown>>).filter((version) => version.document_id === document.id);
    const currentVersion = versions.find((version) => version.id === document.current_version_id) ?? versions[0] ?? null;
    const latestValidation = ((validationRows ?? []) as Array<Record<string, unknown>>).find((validation) => validation.document_id === document.id) ?? null;
    return {
      ...document,
      currentVersion,
      latestValidation,
    };
  });
}

async function loadTaskMusicPackage(db: any, input: ReviewInput, missionId: string) {
  const { data: linkRows, error: linkError } = await db.from("artifact_links")
    .select("target_type,target_id,relationship")
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("artist_id", input.artistId)
    .eq("source_type", "mission")
    .eq("source_id", missionId)
    .in("target_type", ["music_item", "music_project"])
    .eq("relationship", "references")
    .order("created_at", { ascending: true })
    .limit(8);
  if (linkError) throw linkError;

  const links = ((linkRows ?? []) as Array<Record<string, unknown>>)
    .map((row) => ({ targetType: readString(row.target_type, ""), targetId: readString(row.target_id, "") }))
    .filter((row) => row.targetId && (row.targetType === "music_item" || row.targetType === "music_project"));
  if (!links.length) return { subjects: [], assets: [] };

  const itemIds = links.filter((row) => row.targetType === "music_item").map((row) => row.targetId);
  const projectIds = links.filter((row) => row.targetType === "music_project").map((row) => row.targetId);
  const [itemResult, projectResult, itemAssetResult, projectAssetResult] = await Promise.all([
    itemIds.length
      ? db.from("music_items").select("id,title,item_type,lifecycle_stage,released_at").eq("account_id", input.accountId).eq("artist_workspace_id", input.artistWorkspaceId).eq("artist_id", input.artistId).in("id", itemIds)
      : Promise.resolve({ data: [], error: null }),
    projectIds.length
      ? db.from("music_projects").select("id,title,project_type,lifecycle_stage,released_at").eq("account_id", input.accountId).eq("artist_workspace_id", input.artistWorkspaceId).eq("artist_id", input.artistId).in("id", projectIds)
      : Promise.resolve({ data: [], error: null }),
    itemIds.length
      ? db.from("music_assets").select("id,music_item_id,asset_type,title,status,uploaded_file_id,version_label,created_at,updated_at").eq("account_id", input.accountId).eq("artist_workspace_id", input.artistWorkspaceId).eq("artist_id", input.artistId).in("music_item_id", itemIds).in("status", ["uploaded", "confirmed"])
      : Promise.resolve({ data: [], error: null }),
    projectIds.length
      ? db.from("music_assets").select("id,music_project_id,asset_type,title,status,uploaded_file_id,version_label,created_at,updated_at").eq("account_id", input.accountId).eq("artist_workspace_id", input.artistWorkspaceId).eq("artist_id", input.artistId).in("music_project_id", projectIds).in("status", ["uploaded", "confirmed"])
      : Promise.resolve({ data: [], error: null }),
  ]);
  for (const result of [itemResult, projectResult, itemAssetResult, projectAssetResult]) {
    if (result.error) throw result.error;
  }

  const assets = [
    ...((itemAssetResult.data ?? []) as Array<Record<string, unknown>>),
    ...((projectAssetResult.data ?? []) as Array<Record<string, unknown>>),
  ];
  const uploadedFileIds = [...new Set(assets.map((asset) => readString(asset.uploaded_file_id, "")).filter(Boolean))];
  const fileResult = uploadedFileIds.length
    ? await db.from("uploaded_files")
      .select("id,file_name,file_type,classification,status,created_at,updated_at")
      .eq("account_id", input.accountId)
      .eq("artist_workspace_id", input.artistWorkspaceId)
      .eq("artist_id", input.artistId)
      .in("id", uploadedFileIds)
      .in("status", ["uploaded", "processed"])
    : { data: [], error: null };
  if (fileResult.error) throw fileResult.error;
  const fileById = new Map(((fileResult.data ?? []) as Array<Record<string, unknown>>).map((file) => [readString(file.id, ""), file]));

  return {
    subjects: [
      ...((itemResult.data ?? []) as Array<Record<string, unknown>>).map((row) => ({ ...row, subjectType: "music_item" })),
      ...((projectResult.data ?? []) as Array<Record<string, unknown>>).map((row) => ({ ...row, subjectType: "music_project" })),
    ],
    assets: assets.map((asset) => ({
      ...asset,
      uploadedFile: fileById.get(readString(asset.uploaded_file_id, "")) ?? null,
    })),
  };
}

function isBlockingMissionTask(task: Record<string, unknown>) {
  if (task.work_mode === "manager_work") return false;
  if (task.work_mode === "artist_action" || task.work_mode === "collaborative") return true;
  if (task.completion_mode === "manager_draft") return true;
  const owner = typeof task.owner_role === "string" ? task.owner_role.trim().toLowerCase() : "";
  const userResponsibility = typeof task.user_responsibility === "string" ? task.user_responsibility.trim() : "";
  const hasUserParticipation = Boolean(userResponsibility) && !/^(none|n\/?a|nothing(?: needed|required)?\.?|not required)$/i.test(userResponsibility);
  return owner !== "manager" || hasUserParticipation;
}

async function selectMany(db: any, table: string, columns: string, input: ReviewInput, limit: number) {
  const { data, error } = await db.from(table)
    .select(columns)
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("artist_id", input.artistId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

async function selectByMission(db: any, table: string, columns: string, input: ReviewInput, missionId: string, limit: number) {
  const { data, error } = await db.from(table)
    .select(columns)
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("artist_id", input.artistId)
    .eq("mission_id", missionId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

async function selectMission(db: any, input: ReviewInput, missionId: string) {
  const { data, error } = await db.from("missions")
    .select("id,title,objective,reason,status,priority,progress,summary,pattern_name,current_recommendation,required_evidence,missing_evidence,change_conditions,review_point,active_plan_version_id,created_at")
    .eq("id", missionId)
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("artist_id", input.artistId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Manager task review mission was not found.");
  return data;
}

async function selectCheckpoint(db: any, input: ReviewInput, checkpointId: string) {
  const { data, error } = await db.from("checkpoints")
    .select("id,mission_id,title,question,status,recommendation,decision_rule,next_action,blocked_reason,dependency_impact,required_evidence,missing_evidence,reason_for_checkpoint")
    .eq("id", checkpointId)
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("artist_id", input.artistId)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

function normalizeReview(raw: string): ManagerTaskReview {
  const value = JSON.parse(raw);
  if (!isRecord(value)) throw new Error("Manager task review returned invalid JSON.");
  return {
    outcome: readEnum(value.outcome, ["accepted", "needs_revision", "blocked"], "needs_revision"),
    summary: readString(value.summary, "Manager reviewed the task result."),
    managerInterpretation: readString(value.managerInterpretation, "The task result has been recorded for mission review."),
    missionEffect: readString(value.missionEffect, "Mission progress was reviewed."),
    checkpointEffect: readString(value.checkpointEffect, "Checkpoint state was reviewed."),
    recommendedFollowUp: readString(value.recommendedFollowUp, "Continue with the next mission decision."),
    checkpointStatus: readEnum(value.checkpointStatus, ["waiting", "blocked", "ready_for_manager_check", "watching_signal", "needs_revision", "met", "skipped"], "ready_for_manager_check"),
    checkpointRecommendation: readString(value.checkpointRecommendation, "Review the checkpoint with the latest task result."),
    missionStatus: readEnum(value.missionStatus, ["active", "blocked", "review", "paused", "complete"], "active"),
    missionProgress: clampProgress(typeof value.missionProgress === "number" ? value.missionProgress : 0),
    missionRecommendation: readString(value.missionRecommendation, "Continue mission review with the latest task result."),
    memoryEntries: readStringArray(value.memoryEntries).slice(0, 6),
    followUpTasks: Array.isArray(value.followUpTasks) ? value.followUpTasks.filter(isRecord).map((item) => ({
      title: readString(item.title, ""),
      purpose: readString(item.purpose, ""),
      ownerRole: readString(item.ownerRole, "Manager"),
      workMode: readEnum(item.workMode, ["artist_action", "collaborative"], "collaborative"),
      steps: readStringArray(item.steps).slice(0, 8),
      evidenceNeeded: readStringArray(item.evidenceNeeded).slice(0, 8),
      completionExpectation: readString(item.completionExpectation, ""),
      completionMode: readEnum(item.completionMode, ["result_note", "manager_draft"], "result_note"),
      managerResponsibility: readString(item.managerResponsibility, ""),
      userResponsibility: readString(item.userResponsibility, ""),
      riskIfLate: readString(item.riskIfLate, ""),
      estimatedMinutes: Math.max(5, Math.min(240, Number.isFinite(item.estimatedMinutes) ? Math.round(Number(item.estimatedMinutes)) : 30)),
    })).filter((item) =>
      item.title && item.purpose && item.steps.length >= 2 && item.completionExpectation &&
      item.managerResponsibility && item.userResponsibility && item.riskIfLate
    ) : [],
    permissionRequests: Array.isArray(value.permissionRequests) ? value.permissionRequests.filter(isRecord).map((item) => ({
      title: readString(item.title, ""),
      requestType: readString(item.requestType, "sensitive_commitment"),
      body: readString(item.body, ""),
      risk: readString(item.risk, ""),
    })).filter((item) => item.title && item.body) : [],
  };
}

function readOutputText(payload: unknown): string {
  if (!isRecord(payload)) return "";
  if (typeof payload.output_text === "string") return payload.output_text;
  const output = Array.isArray(payload.output) ? payload.output : [];
  return output.flatMap((item) => {
    if (!isRecord(item) || !Array.isArray(item.content)) return [];
    return item.content.flatMap((content) => isRecord(content) && typeof content.text === "string" ? [content.text] : []);
  }).join("\n").trim();
}

function readString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function readStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim())
    : [];
}

function readEnum<T extends string>(value: unknown, allowed: T[], fallback: T): T {
  return allowed.includes(value as T) ? value as T : fallback;
}

function clampProgress(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeMemoryContent(value: unknown) {
  return typeof value === "string"
    ? value.trim().toLocaleLowerCase().replace(/\s+/g, " ")
    : "";
}

function numericUsage(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requireEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

function describeError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (isRecord(error) && typeof error.message === "string" && error.message.trim()) return error.message.trim();
  return typeof error === "string" && error.trim() ? error.trim() : fallback;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
