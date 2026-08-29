import { withAppErrorCapture } from "../_shared/appFunction.ts";
import { captureAppError } from "../_shared/appError.ts";
import {
  adaptivePlanCompilerJsonSchema,
  buildAdaptivePlanCompilerInstructions,
  parseAdaptivePlanOutput,
  type AdaptivePlanOutput,
  type AdaptivePlanStrategyState,
} from "../_shared/openaiAdaptivePlanCompiler.ts";
import {
  buildManagerTaskQualityReviewInstructions,
  buildManagerTaskRepairInstructions,
  managerTaskQualityReviewJsonSchema,
  parseManagerTaskQualityReview,
  type ManagerTaskQualityReview,
} from "../_shared/openaiManagerTaskQuality.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MODEL = () => Deno.env.get("OPENAI_MANAGER_REASONING_MODEL")
  || Deno.env.get("OPENAI_MANAGER_TASK_REVIEW_MODEL")
  || Deno.env.get("OPENAI_SUMMARY_MODEL")
  || "gpt-5-mini";

const TASK_REVIEW_MODEL = () => Deno.env.get("OPENAI_MANAGER_TASK_REVIEW_MODEL") || MODEL();
const TERMINAL_MISSION_STATUSES = new Set(["complete", "archived", "cancelled"]);

type RunnerInput = {
  reviewId: string;
  source?: string;
};

type ClaimedReview = {
  id: string;
  account_id: string;
  artist_workspace_id: string;
  artist_id: string;
  mission_id: string | null;
  checkpoint_id: string | null;
  trigger_type: string;
  trigger_object_type: string | null;
  trigger_object_id: string | null;
  current_read: string | null;
  what_changed: string | null;
  next_action: string | null;
  created_from_run_id: string | null;
  runtime_attempt_count: number;
};

type RuntimeContext = {
  packetVersion: "adaptive_manager_runtime_v2";
  generatedAt: string;
  review: ClaimedReview;
  artist: Record<string, unknown>;
  mission: Record<string, any>;
  activePlan: Record<string, any> | null;
  triggerTask: Record<string, any> | null;
  checkpoints: Record<string, unknown>[];
  tasks: Record<string, any>[];
  taskSteps: Record<string, unknown>[];
  recentTaskResults: Record<string, unknown>[];
  freshMemory: Record<string, unknown>[];
  operatingFacts: Record<string, unknown>[];
  questionHistory: Record<string, unknown>[];
  recentOperatingEvents: Record<string, unknown>[];
  pendingPermissions: Record<string, unknown>[];
  latestManagerPacket: Record<string, unknown> | null;
  validation: {
    allowedDeadlines: string[];
    allowedAvailability: string[];
    allowedFactScopes: string[];
  };
  policy: Record<string, unknown>;
};

Deno.serve(withAppErrorCapture("manager-runtime-runner", async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  let input: RunnerInput | null = null;
  let claimedReview: ClaimedReview | null = null;
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
    failureStage = "claim_review";
    claimedReview = await claimReview(db, input.reviewId);
    if (!claimedReview) {
      return json({ status: "not_claimed", reviewId: input.reviewId });
    }

    failureStage = "load_context";
    const context = await buildRuntimeContext(db, claimedReview);

    failureStage = "create_run";
    runId = await createManagerRun(db, context, input.source);

    const deterministic = deterministicNoChange(context);
    if (deterministic) {
      failureStage = "finalize_no_change";
      const result = await finalizeReplan(db, claimedReview.id, runId, deterministic);
      return json({ status: "completed", source: input.source ?? "runtime", ...result });
    }

    failureStage = "create_usage";
    usageId = await createUsageEvent(db, context, runId);

    failureStage = "compile_plan";
    const { output, usage } = await callAdaptivePlanCompiler(context);

    if (output.decision === "needs_context") {
      failureStage = "persist_context_question";
      const questionResult = await persistContextQuestion(db, claimedReview.id, runId, output);
      await completeUsageEventSafe(db, usageId, usage);
      return json({
        status: "needs_context",
        source: input.source ?? "runtime",
        reviewId: claimedReview.id,
        ...questionResult,
      });
    }

    failureStage = "finalize_plan";
    const result = await finalizeReplan(db, claimedReview.id, runId, output);

    // Telemetry is downstream of the user-visible state transition. Once the
    // atomic finalizer succeeds, accounting failure must not requeue the replan
    // or make the caller believe the Mission did not change.
    await completeUsageEventSafe(db, usageId, usage);

    return json({ status: "completed", source: input.source ?? "runtime", ...result });
  } catch (error) {
    const message = describeError(error, "Manager runtime could not safely update the plan.");

    if (runId && db) await failRunSafe(db, runId, message);
    if (usageId && db) await failUsageSafe(db, usageId, message);
    if (claimedReview?.id && db) await requeueReviewSafe(db, claimedReview.id, message);

    const errorEventId = await captureAppError(error, {
      functionName: "manager-runtime-runner",
      operation: "adaptive_replan",
      source: failureStage === "finalize_plan" || failureStage === "finalize_no_change" || failureStage === "persist_context_question" ? "database" : "worker",
      publicMessage: "Manager runtime could not safely update the plan.",
      requestId: request.headers.get("x-request-id") ?? undefined,
      accountId: claimedReview?.account_id,
      artistWorkspaceId: claimedReview?.artist_workspace_id,
      artistId: claimedReview?.artist_id,
      provider: failureStage === "compile_plan" ? "openai" : undefined,
      refs: {
        manager_run_id: runId,
        review_id: claimedReview?.id ?? input?.reviewId,
        mission_id: claimedReview?.mission_id,
        stage: failureStage,
      },
      context: {
        source: input?.source,
        currentPlanPreserved: true,
        runtimeAttempt: claimedReview?.runtime_attempt_count,
      },
    });

    return json({
      error: message,
      errorEventId,
      reviewId: claimedReview?.id ?? input?.reviewId,
      currentPlanPreserved: true,
    }, 500);
  }
}));

function validateInput(input: RunnerInput) {
  if (!input?.reviewId || typeof input.reviewId !== "string" || !input.reviewId.trim()) {
    throw new Error("Manager runtime requires a review ID.");
  }
  if (input.source != null && typeof input.source !== "string") {
    throw new Error("Manager runtime source must be text.");
  }
}

async function claimReview(db: any, reviewId: string): Promise<ClaimedReview | null> {
  const { data, error } = await db.rpc("claim_manager_runtime_review_v2", { p_review_id: reviewId });
  // A concurrent adaptive review for the same Mission owns the runtime slot.
  // The still-due review will be picked up after that run finishes.
  if (error?.code === "23505") return null;
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row?.id ? row as ClaimedReview : null;
}

async function buildRuntimeContext(db: any, review: ClaimedReview): Promise<RuntimeContext> {
  if (!review.mission_id) throw new Error("Adaptive Manager review is missing its Mission.");
  const now = new Date().toISOString();

  const missionResult = await db.from("missions")
    .select("id,title,objective,reason,status,progress,health,summary,current_recommendation,change_conditions,review_point,active_plan_version_id,required_evidence,missing_evidence,updated_at")
    .eq("id", review.mission_id)
    .eq("account_id", review.account_id)
    .eq("artist_workspace_id", review.artist_workspace_id)
    .eq("artist_id", review.artist_id)
    .maybeSingle();
  if (missionResult.error) throw missionResult.error;
  if (!missionResult.data) throw new Error("Adaptive Manager Mission was not found.");
  const mission = missionResult.data as Record<string, any>;
  const activePlanId = stringOrNull(mission.active_plan_version_id);

  const [
    profileResult,
    planResult,
    triggerTaskResult,
    checkpointResult,
    taskResult,
    stepResult,
    resultResult,
    memoryResult,
    operatingFactResult,
    questionHistoryResult,
    eventResult,
    permissionResult,
    packetResult,
  ] = await Promise.all([
    db.from("artist_profiles")
      .select("display_name,genres,home_market,stage,current_goal,artist_direction,budget_context,social_handles,updated_at")
      .eq("account_id", review.account_id)
      .eq("artist_workspace_id", review.artist_workspace_id)
      .eq("artist_id", review.artist_id)
      .limit(1).maybeSingle(),
    activePlanId
      ? db.from("mission_plan_versions")
        .select("id,version,status,summary,strategy_state,created_at")
        .eq("id", activePlanId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    review.trigger_object_type === "task" && review.trigger_object_id
      ? db.from("tasks")
        .select("id,mission_id,mission_plan_version_id,primary_checkpoint_id,title,owner_role,work_mode,status,purpose,dependency,deadline,available_from,estimated_minutes,completion_expectation,completion_mode,manager_responsibility,user_responsibility,risk_if_late,updated_at")
        .eq("id", review.trigger_object_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    activePlanId
      ? db.from("checkpoints")
        .select("id,mission_plan_version_id,title,status,question,reason_for_checkpoint,watched_signals,decision_rule,recommendation,next_action,blocked_reason,dependency_impact,created_at")
        .eq("mission_id", review.mission_id)
        .eq("mission_plan_version_id", activePlanId)
        .order("created_at", { ascending: true }).limit(20)
      : Promise.resolve({ data: [], error: null }),
    activePlanId
      ? db.from("tasks")
        .select("id,mission_plan_version_id,primary_checkpoint_id,title,owner_role,work_mode,status,purpose,dependency,deadline,available_from,estimated_minutes,approval_state,completion_expectation,completion_mode,deliverable_title,deliverable_requirements,manager_responsibility,user_responsibility,risk_if_late,created_at,updated_at")
        .eq("mission_id", review.mission_id)
        .eq("mission_plan_version_id", activePlanId)
        .order("created_at", { ascending: true }).limit(80)
      : Promise.resolve({ data: [], error: null }),
    db.from("task_steps")
      .select("task_id,order_index,body")
      .eq("artist_workspace_id", review.artist_workspace_id)
      .eq("artist_id", review.artist_id)
      .order("order_index", { ascending: true }).limit(240),
    db.from("task_results")
      .select("task_id,mission_id,checkpoint_id,status,summary,user_note,manager_interpretation,mission_effect,checkpoint_effect,downstream_effect,recommended_follow_up,confidence,created_at")
      .eq("mission_id", review.mission_id)
      .order("created_at", { ascending: false }).limit(60),
    db.from("memory_entries")
      .select("scope,kind,content,source_type,confidence,mission_id,task_id,checkpoint_id,valid_until,last_confirmed_at,metadata,created_at")
      .eq("artist_workspace_id", review.artist_workspace_id)
      .eq("artist_id", review.artist_id)
      .or(`valid_until.is.null,valid_until.gt.${now}`)
      .order("created_at", { ascending: false }).limit(60),
    db.from("artist_operating_facts")
      .select("id,domain,fact_key,scope_type,scope_key,value_json,display_value,source_type,confidence,valid_from,valid_until,last_confirmed_at,metadata,created_at")
      .eq("artist_workspace_id", review.artist_workspace_id)
      .eq("artist_id", review.artist_id)
      .eq("status", "active")
      .or(`valid_until.is.null,valid_until.gt.${now}`)
      .order("created_at", { ascending: false }).limit(80),
    db.from("manager_question_requests")
      .select("id,review_id,task_id,conversation_id,context_request_id,question_key,status,question,reason,answer_kind,options,hypothesis,fallback_if_no,fact_domain,fact_key,fact_scope_type,fact_scope_key,valid_for_hours,answer,answered_at,expires_at,created_at")
      .eq("artist_workspace_id", review.artist_workspace_id)
      .eq("artist_id", review.artist_id)
      .eq("mission_id", review.mission_id)
      .order("created_at", { ascending: false }).limit(20),
    db.from("operating_events")
      .select("event_type,target_type,target_id,source_type,mission_id,checkpoint_id,task_id,summary,payload,created_at")
      .eq("artist_workspace_id", review.artist_workspace_id)
      .eq("artist_id", review.artist_id)
      .eq("mission_id", review.mission_id)
      .order("created_at", { ascending: false }).limit(60),
    db.from("permission_requests")
      .select("request_type,title,body,risk,status,task_id,checkpoint_id,created_at")
      .eq("artist_workspace_id", review.artist_workspace_id)
      .eq("artist_id", review.artist_id)
      .eq("mission_id", review.mission_id)
      .eq("status", "pending")
      .order("created_at", { ascending: false }).limit(20),
    db.from("manager_intelligence_packets")
      .select("packet_type,profile_projection_json,strategic_diagnosis_json,mission_seed_json,conversation_memory_seed_json,supporting_evidence_json,created_at")
      .eq("artist_workspace_id", review.artist_workspace_id)
      .eq("artist_id", review.artist_id)
      .order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  for (const result of [
    profileResult,
    planResult,
    triggerTaskResult,
    checkpointResult,
    taskResult,
    stepResult,
    resultResult,
    memoryResult,
    operatingFactResult,
    questionHistoryResult,
    eventResult,
    permissionResult,
    packetResult,
  ]) {
    if (result.error) throw result.error;
  }

  const tasks = asRows(taskResult.data);
  const currentTaskIds = new Set(tasks.map((task) => String(task.id ?? "")).filter(Boolean));
  const taskSteps = asRows(stepResult.data).filter((step) => currentTaskIds.has(String(step.task_id ?? "")));
  const allowedDeadlines = uniqueIso(tasks.map((task) => task.deadline));
  const allowedAvailability = uniqueIso([
    ...tasks.map((task) => task.available_from),
    triggerTaskResult.data && typeof triggerTaskResult.data === "object"
      ? (triggerTaskResult.data as Record<string, unknown>).available_from
      : null,
  ]);
  const allowedFactScopes = [
    "artist",
    `mission:${review.mission_id}`,
    ...(review.trigger_object_type === "task" && review.trigger_object_id ? [`task:${review.trigger_object_id}`] : []),
  ];
  const operatingFacts = asRows(operatingFactResult.data).filter((fact) => allowedFactScopes.includes(String(fact.scope_key ?? "")));

  return {
    packetVersion: "adaptive_manager_runtime_v2",
    generatedAt: now,
    review,
    artist: record(profileResult.data),
    mission,
    activePlan: recordOrNull(planResult.data),
    triggerTask: recordOrNull(triggerTaskResult.data),
    checkpoints: asRows(checkpointResult.data),
    tasks,
    taskSteps,
    recentTaskResults: asRows(resultResult.data),
    freshMemory: asRows(memoryResult.data),
    operatingFacts,
    questionHistory: asRows(questionHistoryResult.data),
    recentOperatingEvents: asRows(eventResult.data),
    pendingPermissions: asRows(permissionResult.data),
    latestManagerPacket: recordOrNull(packetResult.data),
    validation: { allowedDeadlines, allowedAvailability, allowedFactScopes },
    policy: {
      managerWorkDoesNotConsumeCalendarTime: true,
      currentPlanMustRemainUntouchedUntilAtomicFinalize: true,
      doNotRecreateCompletedWorkUnlessTheChangeInvalidatedItsResult: true,
      externalActionsRequirePermission: true,
      datesMustComeFromValidationAllowLists: true,
      changedHumanAvailabilityIsNotANewDeadline: true,
      artistShouldNotNeedToAskWhatHappensNext: true,
      askOnlyWhenAnswerMateriallyChangesCurrentPlan: true,
      askOneQuestionByDefault: true,
      freshOperatingFactsBeatGenericProfileAssumptions: true,
      expiredQuestionUsesFallbackInsteadOfRepeating: true,
      visibleHumanTasksRequireIndependentSemanticReview: true,
      semanticReviewMustNotUseKeywordMatching: true,
      oneBoundedQualityRepairAttempt: true,
    },
  };
}

function deterministicNoChange(context: RuntimeContext): AdaptivePlanOutput | null {
  const missionStatus = String(context.mission.status ?? "").toLowerCase();
  if (TERMINAL_MISSION_STATUSES.has(missionStatus)) {
    return buildNoChangeOutput(context, "The Mission is no longer active, so this older replan trigger is obsolete.");
  }

  const activePlanId = stringOrNull(context.mission.active_plan_version_id);
  const triggerPlanId = stringOrNull(context.triggerTask?.mission_plan_version_id);
  if (triggerPlanId && activePlanId && triggerPlanId !== activePlanId) {
    return buildNoChangeOutput(context, "A newer Mission plan is already active, so Desk discarded this stale replan trigger.");
  }

  if (!activePlanId) {
    return buildNoChangeOutput(context, "There is no active plan to replace. Desk preserved the Mission and skipped an unsafe replan.");
  }

  return null;
}

function buildNoChangeOutput(context: RuntimeContext, reason: string): AdaptivePlanOutput {
  return {
    decision: "no_change",
    reason,
    whatChanged: context.review.what_changed ?? "Operating reality changed after this review was queued.",
    missionRecommendation: String(context.mission.current_recommendation ?? ""),
    planSummary: String(context.activePlan?.summary ?? ""),
    strategyState: existingStrategyState(context),
    questions: [],
    checkpoints: [],
    tasks: [],
    permissionRequests: [],
  };
}

function existingStrategyState(context: RuntimeContext): AdaptivePlanStrategyState {
  const strategy = record(context.activePlan?.strategy_state);
  return {
    objective: stringValue(strategy.objective) || String(context.mission.objective ?? ""),
    strategicThesis: stringValue(strategy.strategicThesis),
    desiredAudienceBehavior: stringValue(strategy.desiredAudienceBehavior),
    creativePillars: stringArray(strategy.creativePillars),
    culturalMeaning: stringArray(strategy.culturalMeaning),
    constraints: stringArray(strategy.constraints),
    scopedBudget: stringValue(strategy.scopedBudget),
    availableResources: stringArray(strategy.availableResources),
    horizon: stringValue(strategy.horizon),
    successIndicators: stringArray(strategy.successIndicators),
    rejectedDirections: stringArray(strategy.rejectedDirections),
    guardrails: stringArray(strategy.guardrails),
    updatedBecause: stringValue(strategy.updatedBecause),
  };
}

async function createManagerRun(db: any, context: RuntimeContext, source?: string) {
  const { data, error } = await db.from("manager_synthesis_runs").insert({
    account_id: context.review.account_id,
    artist_workspace_id: context.review.artist_workspace_id,
    artist_id: context.review.artist_id,
    trigger_type: "review",
    mission_id: context.review.mission_id,
    status: "running",
    classification: "adaptive_plan_compiler_v1",
    confidence: "unknown",
    context_payload: { ...context, dispatchSource: source ?? "manager-runtime" },
    steps_payload: [
      { step: "review_claimed", status: "completed" },
      { step: "adaptive_plan_compiled", status: "running" },
      { step: "plan_finalized", status: "pending" },
    ],
    action_plan: [],
    limitations: [],
    started_at: new Date().toISOString(),
  }).select("id").single();
  if (error) throw error;
  return String(data.id);
}

async function callAdaptivePlanCompiler(context: RuntimeContext) {
  const usages: Record<string, unknown>[] = [];
  const initial = await requestAdaptivePlan(context);
  usages.push(initial.usage);
  let output = initial.output;

  if (output.decision !== "replan" || output.tasks.length === 0) {
    return { output, usage: combineUsage(usages, { qualityReview: "not_required" }) };
  }

  const firstReview = await callManagerTaskQualityReview(context, output);
  usages.push(firstReview.usage);
  if (firstReview.review.verdict === "pass") {
    return { output, usage: combineUsage(usages, { qualityReview: firstReview.review }) };
  }

  const repair = await requestAdaptivePlan(context, buildManagerTaskRepairInstructions(firstReview.review, output));
  usages.push(repair.usage);
  output = repair.output;

  if (output.decision === "needs_context" || output.tasks.length === 0) {
    return {
      output,
      usage: combineUsage(usages, {
        qualityReview: firstReview.review,
        qualityRepair: output.decision === "needs_context" ? "converted_to_context_question" : "no_visible_tasks_after_repair",
      }),
    };
  }

  const finalReview = await callManagerTaskQualityReview(context, output);
  usages.push(finalReview.usage);
  if (finalReview.review.verdict !== "pass") {
    throw new Error(`Manager Task quality repair failed closed: ${qualityFailureSummary(finalReview.review)}`);
  }

  return {
    output,
    usage: combineUsage(usages, {
      qualityReview: firstReview.review,
      qualityRepair: "repaired_once_and_passed",
      finalQualityReview: finalReview.review,
    }),
  };
}

async function requestAdaptivePlan(context: RuntimeContext, repairInstructions?: string) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireEnv("OPENAI_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL(),
      reasoning: { effort: "medium" },
      instructions: [
        buildAdaptivePlanCompilerInstructions(),
        "Before returning structured output, audit every visible human Task semantically. Do not rely on the presence of particular words. Ask whether the artist can execute it without making the Manager decisions themselves.",
        "Runtime rule: do not recreate work already completed and accepted unless the changed reality invalidates that exact result; if it does, explain the invalidation in whatChanged.",
        "Runtime rule: the persistence layer will supersede every nonterminal task in the old active plan. A replan output must therefore be a complete coherent replacement route for remaining human work, not a patch list.",
        "Runtime rule: current task deadlines and availability are supplied in validation allow-lists. Empty date strings mean the work can be ready immediately; never manufacture sequencing dates.",
        "Runtime rule: operatingFacts are canonical current operating context. Do not ask for a fact that is already fresh there.",
        "Runtime rule: questionHistory contains prior proactive questions. An expired unanswered question must use its fallbackIfNo rather than being repeated.",
        repairInstructions || "",
      ].filter(Boolean).join("\n"),
      input: JSON.stringify(context),
      text: { format: { type: "json_schema", ...adaptivePlanCompilerJsonSchema } },
    }),
  });

  const { raw, usage } = await readStructuredOpenAIResponse(response, "Adaptive Plan Compiler");
  const output = parseAdaptivePlanOutput(raw, context.validation);
  return { output, usage };
}

async function callManagerTaskQualityReview(context: RuntimeContext, output: AdaptivePlanOutput) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireEnv("OPENAI_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: TASK_REVIEW_MODEL(),
      reasoning: { effort: "medium" },
      instructions: buildManagerTaskQualityReviewInstructions(),
      input: JSON.stringify({
        runtimeContext: context,
        proposedPlan: output,
      }),
      text: { format: { type: "json_schema", ...managerTaskQualityReviewJsonSchema } },
    }),
  });

  const { raw, usage } = await readStructuredOpenAIResponse(response, "Manager Task quality reviewer");
  const review = parseManagerTaskQualityReview(raw, output.tasks.length);
  return { review, usage };
}

async function readStructuredOpenAIResponse(response: Response, label: string) {
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${label} failed with status ${response.status}: ${body.slice(0, 500)}`);
  }

  const payload = await response.json();
  const rawText = readOutputText(payload, label);
  let raw: unknown;
  try {
    raw = JSON.parse(rawText);
  } catch {
    throw new Error(`${label} returned invalid JSON.`);
  }
  return { raw, usage: record(payload.usage) };
}

async function persistContextQuestion(db: any, reviewId: string, runId: string, output: AdaptivePlanOutput) {
  const question = output.questions[0];
  if (output.decision !== "needs_context" || !question) throw new Error("Adaptive context question is missing.");
  const { data, error } = await db.rpc("persist_manager_question_request_v1", {
    p_review_id: reviewId,
    p_run_id: runId,
    p_question: question,
  });
  if (error) throw error;
  return record(data);
}

async function finalizeReplan(db: any, reviewId: string, runId: string, output: AdaptivePlanOutput) {
  if (output.decision === "needs_context") throw new Error("Context questions must be persisted before plan finalization.");
  const { data, error } = await db.rpc("finalize_manager_replan_v1", {
    p_review_id: reviewId,
    p_run_id: runId,
    p_output: output,
  });
  if (error) throw error;
  return record(data);
}

async function createUsageEvent(db: any, context: RuntimeContext, runId: string) {
  const { data, error } = await db.from("ai_run_usage_events").insert({
    account_id: context.review.account_id,
    artist_workspace_id: context.review.artist_workspace_id,
    artist_id: context.review.artist_id,
    workflow_key: "review_run",
    run_type: "manager_synthesis",
    manager_synthesis_run_id: runId,
    subject_type: "mission",
    subject_id: context.review.mission_id,
    provider: "openai",
    model_or_tool: MODEL(),
    operation_key: "adaptive_plan_compile",
    status: "started",
    provider_request_count: 1,
  }).select("id").single();
  if (error) throw error;
  return String(data.id);
}

async function completeUsageEvent(db: any, usageId: string, usage: Record<string, unknown>) {
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
}

async function completeUsageEventSafe(db: any, usageId: string, usage: Record<string, unknown>) {
  try {
    await completeUsageEvent(db, usageId, usage);
  } catch (error) {
    const message = describeError(error, "Adaptive plan usage accounting failed after completion.");
    console.warn("manager-runtime-runner: usage accounting failed after successful finalize", message);
    await failUsageSafe(db, usageId, message);
  }
}

async function failRunSafe(db: any, runId: string, message: string) {
  try {
    await db.from("manager_synthesis_runs").update({
      status: "failed",
      error: message.slice(0, 1_000),
      completed_at: new Date().toISOString(),
    }).eq("id", runId).eq("status", "running");
  } catch {
    // Best effort: the current Mission plan is still untouched.
  }
}

async function failUsageSafe(db: any, usageId: string, message: string) {
  try {
    await db.from("ai_run_usage_events").update({
      status: "failed",
      failure_reason: message.slice(0, 1_000),
      completed_at: new Date().toISOString(),
    }).eq("id", usageId).eq("status", "started");
  } catch {
    // Best effort only.
  }
}

async function requeueReviewSafe(db: any, reviewId: string, message: string) {
  try {
    await db.rpc("requeue_manager_runtime_review_v1", {
      p_review_id: reviewId,
      p_error: message,
    });
  } catch {
    // A stale-running reaper is the final recovery path.
  }
}

function readOutputText(payload: Record<string, unknown>, label = "OpenAI structured response") {
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
  throw new Error(`${label} returned no structured output.`);
}

function combineUsage(usages: Record<string, unknown>[], metadata: Record<string, unknown>) {
  let inputTokens = 0;
  let outputTokens = 0;
  let reasoningTokens = 0;
  for (const usage of usages) {
    inputTokens += numericUsage(usage.input_tokens) ?? 0;
    outputTokens += numericUsage(usage.output_tokens) ?? 0;
    reasoningTokens += numericUsage(record(usage.output_tokens_details).reasoning_tokens) ?? 0;
  }
  return {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    output_tokens_details: { reasoning_tokens: reasoningTokens },
    provider_request_count: usages.length,
    calls: usages,
    ...metadata,
  };
}

function qualityFailureSummary(review: ManagerTaskQualityReview) {
  const issues = [
    ...review.globalIssues,
    ...review.taskFindings.flatMap((finding) => finding.verdict === "repair_required" ? finding.issues : []),
  ].filter(Boolean);
  return (issues.join(" | ") || review.summary || "semantic Task quality did not pass").slice(0, 1_000);
}

function uniqueIso(values: unknown[]) {
  const normalized = values
    .map((value) => typeof value === "string" && value.trim() ? normalizeIso(value) : "")
    .filter(Boolean);
  return [...new Set(normalized)];
}

function normalizeIso(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

function asRows(value: unknown): Record<string, any>[] {
  return Array.isArray(value)
    ? value.filter((item) => item && typeof item === "object" && !Array.isArray(item)) as Record<string, any>[]
    : [];
}

function record(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
}

function recordOrNull(value: unknown): Record<string, any> | null {
  const row = record(value);
  return Object.keys(row).length ? row : null;
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean) : [];
}

function numericUsage(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : null;
}

function describeError(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
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
