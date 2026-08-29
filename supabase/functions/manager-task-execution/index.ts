import { withAppErrorCapture } from "../_shared/appFunction.ts";
import { assertActiveWorkspaceEntitlement } from "../_shared/entitlements.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TERMINAL_TASK_STATUSES = new Set(["completed", "rejected", "archived", "superseded"]);
const MANAGER_OWNERS = new Set(["manager", "desk", "ai", "ai manager"]);

type TaskExecutionInput = {
  taskId: string;
  action: "start" | "move";
  availableFrom?: string;
  note?: string;
};

type TaskRow = {
  id: string;
  account_id: string;
  artist_workspace_id: string;
  artist_id: string;
  mission_id: string | null;
  mission_plan_version_id: string | null;
  primary_checkpoint_id: string | null;
  title: string;
  owner_role: string | null;
  work_mode: string | null;
  status: string;
  approval_state: string;
  purpose: string | null;
  dependency: string | null;
  deadline: string | null;
  available_from: string | null;
  estimated_minutes: number | null;
  risk_if_late: string | null;
};

type MoveReview = {
  planImpact: "no_change" | "local_change" | "downstream_risk";
  summary: string;
  managerInterpretation: string;
  missionRecommendation: string;
  nextHumanMove: string;
  requiresReplan: boolean;
};

Deno.serve(withAppErrorCapture("manager-task-execution", async (request) => {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const input = (await request.json()) as TaskExecutionInput;
  validateInput(input);

  const authHeader = request.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing Authorization header." }, 401);

  const supabaseUrl = requireEnv("SUPABASE_URL");
  const anonKey = requireEnv("SUPABASE_ANON_KEY");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: userError } = await authClient.auth.getUser();
  if (userError || !user) return json({ error: "Unauthorized." }, 401);

  const db = createClient(supabaseUrl, serviceRoleKey);
  const task = await loadTask(db, input.taskId);
  if (!task) return json({ error: "Task not found." }, 404);

  const { data: membership, error: membershipError } = await authClient.rpc("is_account_member", { target_account_id: task.account_id });
  if (membershipError) throw membershipError;
  if (!membership) return json({ error: "Forbidden." }, 403);
  await assertActiveWorkspaceEntitlement(authClient, {
    accountId: task.account_id,
    artistWorkspaceId: task.artist_workspace_id,
    artistId: task.artist_id,
  });

  assertHumanExecutableTask(task);
  if (TERMINAL_TASK_STATUSES.has(task.status)) {
    return json({ error: "This task is no longer active. Refresh the Mission and use the current work." }, 409);
  }

  if (input.action === "start") {
    return json(await startTask(db, task, user.id));
  }

  return json(await moveTask(db, task, user.id, input));
}));

function validateInput(input: TaskExecutionInput) {
  if (!input?.taskId || typeof input.taskId !== "string") throw new Error("Task execution requires a task ID.");
  if (input.action !== "start" && input.action !== "move") throw new Error("Task execution action must be start or move.");
  if (input.note != null && typeof input.note !== "string") throw new Error("Task execution note must be text.");
  if (input.action === "move") {
    if (!input.availableFrom) throw new Error("Move requires a new availability time.");
    const parsed = new Date(input.availableFrom);
    if (Number.isNaN(parsed.getTime())) throw new Error("Move availability must be a valid date and time.");
    if (parsed.getTime() < Date.now() - 60_000) throw new Error("Move availability must be in the future.");
    if (parsed.getTime() > Date.now() + 366 * 86_400_000) throw new Error("Move availability cannot be more than one year away.");
  }
}

function assertHumanExecutableTask(task: TaskRow) {
  const workMode = String(task.work_mode ?? "").trim().toLowerCase();
  const owner = String(task.owner_role ?? "").trim().toLowerCase();
  if (workMode === "manager_work" || (!workMode && MANAGER_OWNERS.has(owner))) {
    throw new Error("Manager-owned work runs inside Desk and cannot be scheduled as artist work.");
  }
}

async function loadTask(db: any, taskId: string): Promise<TaskRow | null> {
  const { data, error } = await db.from("tasks")
    .select("id,account_id,artist_workspace_id,artist_id,mission_id,mission_plan_version_id,primary_checkpoint_id,title,owner_role,work_mode,status,approval_state,purpose,dependency,deadline,available_from,estimated_minutes,risk_if_late")
    .eq("id", taskId)
    .maybeSingle();
  if (error) throw error;
  return data as TaskRow | null;
}

async function startTask(db: any, task: TaskRow, userId: string) {
  if (task.approval_state === "needs_approval") {
    return { error: "This task needs approval before it can start.", status: 409 };
  }
  if (task.status === "blocked") {
    return { error: "This task is blocked. Resolve the blocker or move the work first.", status: 409 };
  }
  if (task.status === "in_progress") {
    return { task: executionState(task), managerReview: null, idempotent: true };
  }

  const { data: updated, error } = await db.from("tasks")
    .update({ status: "in_progress", available_from: null, updated_at: new Date().toISOString() })
    .eq("id", task.id)
    .eq("artist_workspace_id", task.artist_workspace_id)
    .select("id,status,available_from,deadline,estimated_minutes")
    .single();
  if (error) throw error;

  await recordTaskStateEvent(db, task, userId, "task_started", task.status, "in_progress", "Artist started the task.", {});
  await writeOperatingEvent(db, task, {
    eventType: "task_started",
    actorType: "user",
    actorId: userId,
    dedupeKey: `task-started:${task.id}`,
    displayMode: "activity",
    summary: `Started: ${task.title}`,
    payload: { action: "start" },
  });

  return { task: executionState({ ...task, ...updated }), managerReview: null };
}

async function moveTask(db: any, task: TaskRow, userId: string, input: TaskExecutionInput) {
  const availableFrom = new Date(input.availableFrom!).toISOString();
  const note = input.note?.trim().slice(0, 2_000) ?? "";
  const fromStatus = task.status;
  const nextStatus = fromStatus === "blocked" || fromStatus === "in_progress" ? "open" : fromStatus;

  const { data: updated, error } = await db.from("tasks")
    .update({
      available_from: availableFrom,
      status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", task.id)
    .eq("artist_workspace_id", task.artist_workspace_id)
    .select("id,status,available_from,deadline,estimated_minutes")
    .single();
  if (error) throw error;

  await recordTaskStateEvent(
    db,
    task,
    userId,
    "task_moved",
    fromStatus,
    nextStatus,
    note || `Artist moved the task to ${availableFrom}.`,
    { availableFrom, previousAvailableFrom: task.available_from },
  );
  await writeOperatingEvent(db, task, {
    eventType: "task_moved",
    actorType: "user",
    actorId: userId,
    dedupeKey: `task-moved:${task.id}:${availableFrom}`,
    displayMode: "activity",
    summary: `Moved: ${task.title}`,
    payload: { action: "move", availableFrom, note },
  });

  if (note) await rememberMoveContext(db, task, userId, note, availableFrom);

  const context = await loadMoveReviewContext(db, { ...task, ...updated }, note);
  const runId = await createMoveManagerRun(db, task, context);

  try {
    const review = await callOpenAIMoveReview(context);
    await applyMoveReview(db, task, runId, review, availableFrom);
    await completeMoveManagerRun(db, runId, review);
    return { task: executionState({ ...task, ...updated }), managerReview: review, managerRunId: runId };
  } catch (reviewError) {
    const message = reviewError instanceof Error ? reviewError.message : "Manager could not review the moved task.";
    await failMoveManagerRun(db, runId, message);
    await queueDeferredMoveReview(db, task, runId, availableFrom, message);
    await writeOperatingEvent(db, task, {
      eventType: "task_move_review_deferred",
      actorType: "manager",
      managerRunId: runId,
      dedupeKey: `task-move-review-deferred:${task.id}:${availableFrom}`,
      displayMode: "activity",
      summary: `Desk saved the new timing for ${task.title}. Manager review is queued.`,
      payload: { action: "move", availableFrom, reviewDeferred: true },
    });
    return {
      task: executionState({ ...task, ...updated }),
      managerReview: null,
      managerRunId: runId,
      reviewDeferred: true,
    };
  }
}

async function loadMoveReviewContext(db: any, task: TaskRow, note: string) {
  const [profileResult, missionResult, checkpointResult, tasksResult, planResult, memoryResult, eventsResult] = await Promise.all([
    db.from("artist_profiles")
      .select("display_name,stage,current_goal,artist_direction,home_market,budget_context")
      .eq("artist_workspace_id", task.artist_workspace_id).eq("artist_id", task.artist_id).limit(1).maybeSingle(),
    task.mission_id
      ? db.from("missions").select("id,title,objective,status,progress,summary,current_recommendation,change_conditions,review_point,active_plan_version_id")
        .eq("id", task.mission_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    task.primary_checkpoint_id
      ? db.from("checkpoints").select("id,title,status,question,decision_rule,recommendation,next_action,dependency_impact,blocked_reason")
        .eq("id", task.primary_checkpoint_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    task.mission_id
      ? db.from("tasks").select("id,title,owner_role,work_mode,status,deadline,available_from,dependency,risk_if_late,primary_checkpoint_id")
        .eq("mission_id", task.mission_id).order("created_at", { ascending: true }).limit(80)
      : Promise.resolve({ data: [], error: null }),
    task.mission_plan_version_id
      ? db.from("mission_plan_versions").select("id,version,status,summary,strategy_state").eq("id", task.mission_plan_version_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    db.from("memory_entries").select("id,scope,kind,content,confidence,valid_until,last_confirmed_at,created_at")
      .eq("artist_workspace_id", task.artist_workspace_id).eq("artist_id", task.artist_id)
      .or(`valid_until.is.null,valid_until.gt.${new Date().toISOString()}`)
      .order("created_at", { ascending: false }).limit(30),
    db.from("operating_events").select("event_type,summary,created_at")
      .eq("artist_workspace_id", task.artist_workspace_id).eq("artist_id", task.artist_id)
      .order("created_at", { ascending: false }).limit(20),
  ]);

  for (const result of [profileResult, missionResult, checkpointResult, tasksResult, planResult, memoryResult, eventsResult]) {
    if (result.error) throw result.error;
  }

  return {
    packetVersion: "manager_task_execution_change_v1",
    generatedAt: new Date().toISOString(),
    change: {
      type: "task_moved",
      taskId: task.id,
      title: task.title,
      newAvailableFrom: task.available_from,
      deadline: task.deadline,
      note,
    },
    artist: profileResult.data ?? {},
    mission: missionResult.data ?? null,
    checkpoint: checkpointResult.data ?? null,
    missionTasks: tasksResult.data ?? [],
    activePlan: planResult.data ?? null,
    memory: memoryResult.data ?? [],
    recentOperatingEvents: eventsResult.data ?? [],
    policy: {
      managerWorkDoesNotConsumeCalendarTime: true,
      doNotInventDeadlines: true,
      moveChangesAvailabilityNotArtisticIntent: true,
      externalActionsStillRequirePermission: true,
    },
  };
}

async function callOpenAIMoveReview(context: unknown): Promise<MoveReview> {
  const model = Deno.env.get("OPENAI_MANAGER_TASK_REVIEW_MODEL")
    || Deno.env.get("OPENAI_MANAGER_REASONING_MODEL")
    || Deno.env.get("OPENAI_SUMMARY_MODEL")
    || "gpt-5-mini";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${requireEnv("OPENAI_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      reasoning: { effort: "low" },
      instructions: [
        "You are Desk, the operating Manager for the artist. The artist moved one human task to a new availability time.",
        "Decide immediately what this changes for the current Mission. The artist must not have to ask what happens next.",
        "Manager work is machine work and does not consume calendar days. Never create or imply a future-day task for research, analysis, drafting, comparison, review, or replanning that Desk can do now.",
        "Do not invent or silently change any deadline, release date, external commitment, spend, or artistic intent.",
        "Treat availableFrom as when the human can next do the work, not as a new deadline.",
        "Use no_change when the move is harmless, local_change when the immediate task timing changes but the Mission route still holds, and downstream_risk when a known downstream dependency or fixed date is now materially threatened.",
        "Set requiresReplan true only when the current plan needs a real route change. A later runtime will compile the revised plan; do not fabricate one here.",
        "nextHumanMove must be one concrete thing the artist/team should know or do next, or explicitly say no additional action is needed until the moved task becomes available.",
        "Be concise, specific to the supplied task/Mission, and do not create generic project-management advice.",
      ].join("\n"),
      input: JSON.stringify(context),
      text: {
        format: {
          type: "json_schema",
          name: "manager_task_execution_change_v1",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["planImpact", "summary", "managerInterpretation", "missionRecommendation", "nextHumanMove", "requiresReplan"],
            properties: {
              planImpact: { type: "string", enum: ["no_change", "local_change", "downstream_risk"] },
              summary: { type: "string" },
              managerInterpretation: { type: "string" },
              missionRecommendation: { type: "string" },
              nextHumanMove: { type: "string" },
              requiresReplan: { type: "boolean" },
            },
          },
        },
      },
    }),
  });
  if (!response.ok) throw new Error(`Manager move review failed with status ${response.status}.`);
  const payload = await response.json();
  return parseMoveReview(readOutputText(payload));
}

async function applyMoveReview(db: any, task: TaskRow, runId: string, review: MoveReview, availableFrom: string) {
  if (task.mission_id && review.missionRecommendation.trim()) {
    const { error } = await db.from("missions")
      .update({ current_recommendation: review.missionRecommendation.trim(), updated_at: new Date().toISOString() })
      .eq("id", task.mission_id).eq("artist_workspace_id", task.artist_workspace_id);
    if (error) throw error;
  }

  await writeOperatingEvent(db, task, {
    eventType: review.requiresReplan ? "plan_replan_required" : "task_move_reviewed",
    actorType: "manager",
    managerRunId: runId,
    dedupeKey: `task-move-reviewed:${task.id}:${availableFrom}`,
    displayMode: review.planImpact === "downstream_risk" ? "action" : "activity",
    summary: review.summary || review.nextHumanMove,
    payload: {
      planImpact: review.planImpact,
      managerInterpretation: review.managerInterpretation,
      missionRecommendation: review.missionRecommendation,
      nextHumanMove: review.nextHumanMove,
      requiresReplan: review.requiresReplan,
      availableFrom,
    },
  });
}

async function createMoveManagerRun(db: any, task: TaskRow, context: unknown) {
  const { data, error } = await db.from("manager_synthesis_runs").insert({
    account_id: task.account_id,
    artist_workspace_id: task.artist_workspace_id,
    artist_id: task.artist_id,
    trigger_type: "review",
    mission_id: task.mission_id,
    status: "running",
    classification: "manager_task_execution_change_v1",
    confidence: "unknown",
    context_payload: context,
    steps_payload: [
      { step: "task_timing_saved", status: "completed" },
      { step: "manager_impact_review", status: "running" },
    ],
    action_plan: [],
    limitations: [],
    started_at: new Date().toISOString(),
  }).select("id").single();
  if (error) throw error;
  return String(data.id);
}

async function completeMoveManagerRun(db: any, runId: string, review: MoveReview) {
  const { error } = await db.from("manager_synthesis_runs").update({
    status: "completed",
    confidence: "medium",
    steps_payload: [
      { step: "task_timing_saved", status: "completed" },
      { step: "manager_impact_review", status: "completed" },
    ],
    action_plan: [review],
    completed_at: new Date().toISOString(),
  }).eq("id", runId);
  if (error) throw error;
}

async function failMoveManagerRun(db: any, runId: string, message: string) {
  await db.from("manager_synthesis_runs").update({
    status: "failed",
    error: message.slice(0, 1_000),
    completed_at: new Date().toISOString(),
  }).eq("id", runId);
}

async function queueDeferredMoveReview(db: any, task: TaskRow, runId: string, availableFrom: string, errorMessage: string) {
  if (!task.mission_id) return;
  await db.from("reviews").insert({
    account_id: task.account_id,
    artist_workspace_id: task.artist_workspace_id,
    artist_id: task.artist_id,
    mission_id: task.mission_id,
    checkpoint_id: task.primary_checkpoint_id,
    trigger_type: "task_move",
    trigger_object_type: "task",
    trigger_object_id: task.id,
    current_read: "Task timing was saved but Manager impact review did not finish.",
    what_changed: `Human availability moved to ${availableFrom}.`,
    next_action: "Retry Manager impact review before changing downstream commitments.",
    status: "due",
    review_at: new Date().toISOString(),
    created_from_run_id: runId,
  });
  console.warn("manager-task-execution: move review deferred", errorMessage);
}

async function rememberMoveContext(db: any, task: TaskRow, userId: string, note: string, availableFrom: string) {
  const validUntil = new Date(new Date(availableFrom).getTime() + 7 * 86_400_000).toISOString();
  const { error } = await db.from("memory_entries").insert({
    account_id: task.account_id,
    artist_workspace_id: task.artist_workspace_id,
    artist_id: task.artist_id,
    mission_id: task.mission_id,
    task_id: task.id,
    checkpoint_id: task.primary_checkpoint_id,
    scope: "task",
    kind: "fact",
    content: note,
    source_type: "user",
    source_id: userId,
    confidence: "high",
    reason: "Artist-provided operating context while moving a task.",
    valid_until: validUntil,
    last_confirmed_at: new Date().toISOString(),
    metadata: { sourceAction: "task_move", availableFrom },
  });
  if (error) throw error;
}

async function recordTaskStateEvent(
  db: any,
  task: TaskRow,
  userId: string,
  eventType: string,
  fromStatus: string,
  toStatus: string,
  reason: string,
  payload: Record<string, unknown>,
) {
  const { error } = await db.from("task_state_events").insert({
    account_id: task.account_id,
    artist_workspace_id: task.artist_workspace_id,
    artist_id: task.artist_id,
    task_id: task.id,
    mission_id: task.mission_id,
    checkpoint_id: task.primary_checkpoint_id,
    event_type: eventType,
    from_status: fromStatus,
    to_status: toStatus,
    actor_type: "user",
    actor_id: userId,
    reason,
    payload,
  });
  if (error) throw error;
}

async function writeOperatingEvent(db: any, task: TaskRow, input: {
  eventType: string;
  actorType: "user" | "manager";
  actorId?: string;
  managerRunId?: string;
  dedupeKey: string;
  displayMode: "activity" | "action";
  summary: string;
  payload: Record<string, unknown>;
}) {
  const { error } = await db.from("operating_events").insert({
    account_id: task.account_id,
    artist_workspace_id: task.artist_workspace_id,
    artist_id: task.artist_id,
    event_type: input.eventType,
    actor_type: input.actorType,
    actor_id: input.actorId ?? null,
    target_type: "task",
    target_id: task.id,
    source_type: "task_execution",
    source_id: task.id,
    manager_synthesis_run_id: input.managerRunId ?? null,
    mission_id: task.mission_id,
    checkpoint_id: task.primary_checkpoint_id,
    task_id: task.id,
    dedupe_key: input.dedupeKey,
    display_mode: input.displayMode,
    refresh_scope: task.mission_id ? ["missions", `mission:${task.mission_id}`, "activity"] : ["activity"],
    summary: input.summary,
    payload: input.payload,
  });
  if (error && error.code !== "23505") throw error;
}

function executionState(task: any) {
  return {
    id: String(task.id ?? ""),
    status: String(task.status ?? "open"),
    availableFrom: task.available_from ?? null,
    deadline: task.deadline ?? null,
    estimatedMinutes: typeof task.estimated_minutes === "number" ? task.estimated_minutes : null,
  };
}

function parseMoveReview(text: string): MoveReview {
  const parsed = JSON.parse(text) as Partial<MoveReview>;
  const impact = parsed.planImpact;
  if (impact !== "no_change" && impact !== "local_change" && impact !== "downstream_risk") {
    throw new Error("Manager move review returned an invalid plan impact.");
  }
  return {
    planImpact: impact,
    summary: String(parsed.summary ?? "").trim(),
    managerInterpretation: String(parsed.managerInterpretation ?? "").trim(),
    missionRecommendation: String(parsed.missionRecommendation ?? "").trim(),
    nextHumanMove: String(parsed.nextHumanMove ?? "").trim(),
    requiresReplan: Boolean(parsed.requiresReplan),
  };
}

function readOutputText(payload: any) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) return payload.output_text;
  for (const item of Array.isArray(payload?.output) ? payload.output : []) {
    for (const content of Array.isArray(item?.content) ? item.content : []) {
      if (typeof content?.text === "string" && content.text.trim()) return content.text;
    }
  }
  throw new Error("Manager move review returned no structured output.");
}

function requireEnv(key: string) {
  const value = Deno.env.get(key);
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

function json(body: unknown, status = 200) {
  if (body && typeof body === "object" && "status" in (body as Record<string, unknown>) && "error" in (body as Record<string, unknown>)) {
    const maybeStatus = Number((body as Record<string, unknown>).status);
    if (Number.isFinite(maybeStatus)) {
      const { status: _status, ...rest } = body as Record<string, unknown>;
      return new Response(JSON.stringify(rest), { status: maybeStatus, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
