import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildMissionGenesisInstructions,
  missionGenesisJsonSchema,
  parseMissionGenesisOutput,
  type MissionGenesisMode,
  type MissionGenesisOutput,
  type MissionGenesisQuestion,
} from "../_shared/openaiMissionGenesis.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type MissionGenesisInput = {
  accountId: string;
  artistWorkspaceId: string;
  artistId: string;
  mode: MissionGenesisMode;
  candidateMissionId?: string;
  answers?: Array<{ questionKey: string; answer: string }>;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  let input: MissionGenesisInput | null = null;
  let runId: string | null = null;
  let usageId: string | null = null;

  try {
    input = (await request.json()) as MissionGenesisInput;
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

    const db = createClient(supabaseUrl, serviceRoleKey);
    await assertWorkspace(db, input);

    let contextAnswers: Array<{ questionKey: string; answer: string }> = [];
    let priorCandidate: Record<string, unknown> | null = null;
    if (input.mode === "continuation") {
      priorCandidate = await loadCandidate(db, input);
      contextAnswers = await persistContextAnswers(db, input);
    }

    const packet = await buildArtistOperatingPacket(db, input);
    runId = await createManagerRun(db, input, packet, contextAnswers, priorCandidate);
    usageId = await createUsageEvent(db, input, runId);

    const { output, usage } = await callOpenAIMissionGenesis({ packet, contextAnswers, priorCandidate }, input.mode);
    const persisted = await persistDecision(db, input, runId, output);
    await completeManagerRun(db, runId, output, persisted.missionId);
    await completeUsageEvent(db, usageId, usage);

    return json(toViewModel(output, persisted));
  } catch (error) {
    const message = describeError(error, "Mission Genesis failed.");
    if (runId) await markRunFailedSafe(runId, message);
    if (usageId) await markUsageFailedSafe(usageId, message);
    return json({ error: message }, 500);
  }
});

function validateInput(input: MissionGenesisInput) {
  if (!input?.accountId || !input.artistWorkspaceId || !input.artistId) throw new Error("Mission Genesis workspace input is incomplete.");
  if (input.mode !== "initial" && input.mode !== "continuation") throw new Error("Mission Genesis mode is invalid.");
  if (input.mode === "continuation") {
    if (!input.candidateMissionId) throw new Error("Mission Genesis continuation requires a candidate mission.");
    if (!Array.isArray(input.answers) || input.answers.length < 2) throw new Error("Mission Genesis continuation requires the complete context answer batch.");
  }
}

async function assertWorkspace(db: any, input: MissionGenesisInput) {
  const { data, error } = await db
    .from("artist_workspaces")
    .select("id,account_id,artist_id")
    .eq("id", input.artistWorkspaceId)
    .eq("account_id", input.accountId)
    .eq("artist_id", input.artistId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Mission Genesis workspace was not found.");
}

async function loadCandidate(db: any, input: MissionGenesisInput) {
  const { data, error } = await db
    .from("missions")
    .select("id,title,objective,reason,summary,pattern_name,current_recommendation,required_evidence,missing_evidence,change_conditions,status")
    .eq("id", input.candidateMissionId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("artist_id", input.artistId)
    .eq("status", "candidate")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Mission Genesis candidate is missing or is no longer awaiting context.");
  return data as Record<string, unknown>;
}

async function persistContextAnswers(db: any, input: MissionGenesisInput) {
  const answers = (input.answers ?? []).map((item) => ({ questionKey: item.questionKey.trim(), answer: item.answer.trim() }));
  if (answers.some((item) => !item.questionKey || !item.answer)) throw new Error("Every Mission Genesis context question must be answered.");

  const prefix = questionPrefix(input.candidateMissionId!);
  const { data: questionRows, error: questionError } = await db
    .from("manager_context_questions")
    .select("id,question_key,question")
    .like("question_key", `${prefix}%`)
    .eq("status", "active");
  if (questionError) throw questionError;

  const questions = (questionRows ?? []) as Array<{ id: string; question_key: string; question: string }>;
  const answerMap = new Map(answers.map((item) => [item.questionKey, item.answer]));
  if (questions.length < 2 || questions.some((question) => !answerMap.get(question.question_key))) {
    throw new Error("Mission Genesis did not receive the complete context answer batch.");
  }

  for (const question of questions) {
    const answer = answerMap.get(question.question_key)!;
    const { data: memory, error: memoryError } = await db
      .from("memory_entries")
      .insert({
        account_id: input.accountId,
        artist_workspace_id: input.artistWorkspaceId,
        artist_id: input.artistId,
        mission_id: input.candidateMissionId,
        scope: "artist",
        kind: memoryKind(question.question),
        content: `${question.question} ${answer}`,
        source_type: "manager_context_answer",
        confidence: "high",
        reason: "Saved because this user-controlled context materially affects Mission Genesis decisions.",
      })
      .select("id")
      .single();
    if (memoryError) throw memoryError;

    const { error: answerError } = await db.from("manager_context_answers").insert({
      account_id: input.accountId,
      artist_workspace_id: input.artistWorkspaceId,
      artist_id: input.artistId,
      question_id: question.id,
      answer,
      source: "typed",
      memory_entry_id: memory.id,
    });
    if (answerError) throw answerError;
  }

  return questions.map((question) => ({ questionKey: question.question_key, answer: answerMap.get(question.question_key)! }));
}

async function buildArtistOperatingPacket(db: any, input: MissionGenesisInput) {
  const [profile, evidence, musicItems, musicProjects, memory, agentReports, missions, tasks, sources] = await Promise.all([
    selectMany(db, "artist_profiles", "id,display_name,genres,home_market,stage,current_goal,artist_direction,budget_context,social_handles", input, 1),
    selectMany(db, "evidence_items", "id,source,source_kind,evidence_type,subject_type,subject_id,subject_label,metric_name,metric_value,metric_unit,freshness,confidence,provenance,limitation,raw_ref", input, 240),
    selectMany(db, "music_items", "id,title,item_type,lifecycle_stage,released_at,source_kind,source_limit,metadata", input, 120),
    selectMany(db, "music_projects", "id,title,project_type,lifecycle_stage,released_at,source_kind,source_limit,metadata", input, 80),
    selectMany(db, "memory_entries", "id,scope,kind,content,source_type,confidence,reason,mission_id,created_at", input, 160),
    selectMany(db, "agent_reports", "id,agent_key,mission_id,mission_pattern_key,summary,confidence,limitations,finding,evidence_missing,risk_or_opportunity,recommended_internal_action,permission_required,suggested_follow_up,created_at", input, 40),
    selectMany(db, "missions", "id,title,objective,reason,status,priority,progress,summary,pattern_name,current_recommendation,required_evidence,missing_evidence,change_conditions,review_point,created_at", input, 80),
    selectMany(db, "tasks", "id,mission_id,primary_checkpoint_id,title,owner_role,status,purpose,evidence_needed,completion_expectation,risk_if_late", input, 160),
    selectMany(db, "source_connections", "id,provider_id,handle_or_external_ref,status,last_sync_at,next_sync_at,freshness_target,limitations,created_at", input, 80),
  ]);

  return {
    packetVersion: "mission_genesis_v2",
    generatedAt: new Date().toISOString(),
    artist: {
      id: input.artistId,
      name: profile[0]?.display_name ?? "Artist",
      stage: profile[0]?.stage ?? "unknown",
      goals: compact([profile[0]?.current_goal, profile[0]?.artist_direction]),
      genres: profile[0]?.genres ?? [],
      homeMarket: profile[0]?.home_market ?? "",
      budgetContext: profile[0]?.budget_context ?? "",
      socialHandles: profile[0]?.social_handles ?? {},
      profileRef: profile[0]?.id ?? "",
    },
    evidence: evidence.map((row: any) => ({
      id: row.id,
      source: row.source,
      kind: row.evidence_type,
      subjectId: row.subject_id,
      subject: row.subject_label,
      label: row.metric_name,
      value: row.metric_value == null ? "" : `${row.metric_value}${row.metric_unit ? ` ${row.metric_unit}` : ""}`,
      freshness: row.freshness,
      confidence: row.confidence,
      provenance: row.provenance,
      limitation: row.limitation,
    })),
    music: {
      items: musicItems,
      projects: musicProjects,
    },
    memory,
    recentAgentReports: agentReports,
    existingMissions: missions,
    existingTasks: tasks,
    sources,
    rules: {
      userContextIsNotThirdPartyEvidence: true,
      externalActionsRequirePermission: true,
      noDuplicateActiveMission: true,
      noMissionIsValid: true,
    },
  };
}

async function selectMany(db: any, table: string, columns: string, input: MissionGenesisInput, limit: number) {
  const { data, error } = await db
    .from(table)
    .select(columns)
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("artist_id", input.artistId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

async function callOpenAIMissionGenesis(
  context: { packet: unknown; contextAnswers: unknown[]; priorCandidate: Record<string, unknown> | null },
  mode: MissionGenesisMode,
) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${requireEnv("OPENAI_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: Deno.env.get("OPENAI_MISSION_GENESIS_MODEL") || Deno.env.get("OPENAI_SUMMARY_MODEL") || "gpt-5-mini",
      instructions: buildMissionGenesisInstructions(mode),
      input: JSON.stringify(context),
      text: { format: { type: "json_schema", ...missionGenesisJsonSchema } },
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI Mission Genesis request failed with status ${response.status}: ${body.slice(0, 500)}`);
  }
  const payload = await response.json();
  return {
    output: parseMissionGenesisOutput(readOutputText(payload), context.packet, mode),
    usage: isRecord(payload.usage) ? payload.usage : {},
  };
}

async function createManagerRun(db: any, input: MissionGenesisInput, packet: unknown, contextAnswers: unknown[], priorCandidate: unknown) {
  const { data, error } = await db
    .from("manager_synthesis_runs")
    .insert({
      account_id: input.accountId,
      artist_workspace_id: input.artistWorkspaceId,
      artist_id: input.artistId,
      trigger_type: "mission",
      mission_id: input.candidateMissionId ?? null,
      status: "running",
      classification: "mission_genesis_v2",
      confidence: "unknown",
      context_payload: { mode: input.mode, packet, contextAnswers, priorCandidate },
      steps_payload: [{ step: "packet_built", status: "completed" }, { step: "openai_synthesis", status: "running" }],
      action_plan: [],
      limitations: [],
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function createUsageEvent(db: any, input: MissionGenesisInput, runId: string) {
  const { data, error } = await db
    .from("ai_run_usage_events")
    .insert({
      account_id: input.accountId,
      artist_workspace_id: input.artistWorkspaceId,
      artist_id: input.artistId,
      workflow_key: "mission_run",
      run_type: "manager_synthesis",
      manager_synthesis_run_id: runId,
      subject_type: "artist",
      subject_id: input.artistId,
      provider: "openai",
      model_or_tool: Deno.env.get("OPENAI_MISSION_GENESIS_MODEL") || Deno.env.get("OPENAI_SUMMARY_MODEL") || "gpt-5-mini",
      operation_key: input.mode === "continuation" ? "mission_genesis_continue_v2" : "mission_genesis_initial_v2",
      status: "started",
      provider_request_count: 1,
      metadata: { mode: input.mode },
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function persistDecision(db: any, input: MissionGenesisInput, runId: string, output: MissionGenesisOutput) {
  let missionId: string | undefined;
  let questions = output.questions;

  const { data: action, error: actionError } = await db
    .from("manager_run_actions")
    .insert({
      account_id: input.accountId,
      artist_workspace_id: input.artistWorkspaceId,
      artist_id: input.artistId,
      manager_synthesis_run_id: runId,
      order_index: 1,
      action_type: output.outcome,
      target_type: output.outcome === "no_mission" || output.outcome === "request_evidence" ? "artist" : "mission",
      target_id: output.existingMissionId || input.candidateMissionId || null,
      status: output.outcome === "request_evidence" ? "skipped" : "pending",
      approval_required: false,
      payload: output,
      result_payload: {},
    })
    .select("id")
    .single();
  if (actionError) throw actionError;

  if (output.outcome === "candidate_needs_context") {
    missionId = await createCandidate(db, input, runId, action.id, output);
    questions = await persistQuestions(db, missionId, output.questions);
  } else if (output.outcome === "activate_mission") {
    missionId = input.candidateMissionId
      ? await activateCandidate(db, input, runId, action.id, output)
      : await createActiveMission(db, input, runId, action.id, output);
    await writeMissionPlan(db, input, runId, action.id, missionId, output);
    await finalizeMissionActivation(db, input, missionId);
  } else if (output.outcome === "update_existing_mission") {
    missionId = output.existingMissionId;
    const { error } = await db.from("missions").update({
      current_recommendation: output.mission.currentRecommendation || output.decisionSummary,
      change_conditions: output.mission.changeConditions,
      review_point: output.checkpoints[0]?.title ?? "Manager review",
      updated_at: new Date().toISOString(),
    }).eq("id", missionId).eq("artist_workspace_id", input.artistWorkspaceId);
    if (error) throw error;
  } else if (input.candidateMissionId) {
    const { error } = await db.from("missions").update({
      status: "archived",
      archived_at: new Date().toISOString(),
      current_recommendation: output.decisionSummary,
      updated_at: new Date().toISOString(),
    }).eq("id", input.candidateMissionId).eq("artist_workspace_id", input.artistWorkspaceId).eq("status", "candidate");
    if (error) throw error;
  }

  await writeOperatingEvent(db, input, runId, missionId, output);
  const { error: completeActionError } = await db.from("manager_run_actions").update({
    target_id: missionId || output.existingMissionId || null,
    status: output.outcome === "request_evidence" ? "skipped" : "applied",
    result_payload: { outcome: output.outcome, missionId: missionId ?? null },
  }).eq("id", action.id);
  if (completeActionError) throw completeActionError;

  return { missionId, questions };
}

async function createCandidate(db: any, input: MissionGenesisInput, runId: string, actionId: string, output: MissionGenesisOutput) {
  const { data, error } = await db.from("missions").insert(missionRow(input, runId, actionId, output, "candidate")).select("id").single();
  if (error) throw error;
  return data.id as string;
}

async function createActiveMission(db: any, input: MissionGenesisInput, runId: string, actionId: string, output: MissionGenesisOutput) {
  const { data, error } = await db.from("missions").insert(missionRow(input, runId, actionId, output, "candidate")).select("id").single();
  if (error) throw error;
  return data.id as string;
}

async function activateCandidate(db: any, input: MissionGenesisInput, runId: string, actionId: string, output: MissionGenesisOutput) {
  const { data, error } = await db.from("missions").update({
    ...missionRow(input, runId, actionId, output, "candidate"),
    updated_at: new Date().toISOString(),
  }).eq("id", input.candidateMissionId).eq("artist_workspace_id", input.artistWorkspaceId).eq("status", "candidate").select("id").single();
  if (error) throw error;
  return data.id as string;
}

async function finalizeMissionActivation(db: any, input: MissionGenesisInput, missionId: string) {
  const { error } = await db.from("missions").update({
    status: "active",
    priority: 1,
    updated_at: new Date().toISOString(),
  }).eq("id", missionId).eq("artist_workspace_id", input.artistWorkspaceId).eq("status", "candidate");
  if (error) throw error;
}

function missionRow(input: MissionGenesisInput, runId: string, actionId: string, output: MissionGenesisOutput, status: "candidate" | "active") {
  return {
    account_id: input.accountId,
    artist_workspace_id: input.artistWorkspaceId,
    artist_id: input.artistId,
    title: output.mission.title,
    objective: output.mission.objective,
    reason: output.mission.reason,
    status,
    priority: status === "active" ? 1 : 0,
    progress: 0,
    summary: output.mission.summary,
    pattern_name: output.mission.patternName,
    pattern_confidence: output.confidence === "limited" ? "low" : output.confidence,
    originating_trigger: "manual_mission_genesis_openai",
    required_evidence: unique(output.checkpoints.flatMap((checkpoint) => checkpoint.requiredEvidence)),
    missing_evidence: unique([...output.evidenceNeeded, ...output.checkpoints.flatMap((checkpoint) => checkpoint.missingEvidence)]),
    current_recommendation: output.mission.currentRecommendation,
    change_conditions: output.mission.changeConditions,
    review_point: output.checkpoints[0]?.title ?? (status === "candidate" ? "Awaiting Manager context" : "Manager review"),
    created_from_run_id: runId,
    created_from_action_id: actionId,
  };
}

async function persistQuestions(db: any, missionId: string, questions: MissionGenesisQuestion[]) {
  const prefix = questionPrefix(missionId);
  const rows = questions.map((question, index) => ({
    question_key: `${prefix}${slug(question.key || `question_${index + 1}`)}`,
    question: question.question,
    suggested_answer: null,
    required_for: ["mission_genesis"],
    order_index: index + 1,
    status: "active",
  }));
  const { data, error } = await db.from("manager_context_questions").insert(rows).select("question_key,question,order_index");
  if (error) throw error;
  return (data ?? []).sort((a: any, b: any) => a.order_index - b.order_index).map((row: any, index: number) => ({ ...questions[index], key: row.question_key }));
}

async function writeMissionPlan(db: any, input: MissionGenesisInput, runId: string, actionId: string, missionId: string, output: MissionGenesisOutput) {
  const { data: plan, error: planError } = await db.from("mission_plan_versions").insert({
    account_id: input.accountId,
    artist_workspace_id: input.artistWorkspaceId,
    artist_id: input.artistId,
    mission_id: missionId,
    version: 1,
    status: "active",
    generated_from_run_id: runId,
    generated_from_action_id: actionId,
    summary: `${output.mission.timeline}. ${output.mission.summary}`,
  }).select("id").single();
  if (planError) throw planError;

  const checkpointIds = new Map<string, string>();
  for (const [index, checkpoint] of output.checkpoints.entries()) {
    const { data, error } = await db.from("checkpoints").insert({
      account_id: input.accountId,
      artist_workspace_id: input.artistWorkspaceId,
      artist_id: input.artistId,
      mission_id: missionId,
      mission_plan_version_id: plan.id,
      title: checkpoint.title,
      status: "waiting",
      question: checkpoint.question,
      reason_for_checkpoint: checkpoint.question,
      watched_signals: checkpoint.sourceRefs,
      decision_rule: checkpoint.decisionRule,
      recommendation: output.mission.currentRecommendation,
      required_evidence: checkpoint.requiredEvidence,
      missing_evidence: checkpoint.missingEvidence,
      custom_reason: `Authored by OpenAI Mission Genesis from packet refs: ${checkpoint.sourceRefs.join(", ")}`,
      created_from_run_id: runId,
      created_from_action_id: actionId,
    }).select("id").single();
    if (error) throw error;
    checkpointIds.set(checkpoint.key, data.id);
    const { error: linkError } = await db.from("mission_plan_checkpoints").insert({
      account_id: input.accountId,
      artist_workspace_id: input.artistWorkspaceId,
      artist_id: input.artistId,
      mission_plan_version_id: plan.id,
      mission_id: missionId,
      checkpoint_id: data.id,
      order_index: index + 1,
      phase_label: checkpoint.title,
      unlock_rule: checkpoint.decisionRule,
    });
    if (linkError) throw linkError;
  }

  for (const task of output.tasks) {
    const { error } = await db.from("tasks").insert({
      account_id: input.accountId,
      artist_workspace_id: input.artistWorkspaceId,
      artist_id: input.artistId,
      scope: "mission",
      mission_id: missionId,
      mission_plan_version_id: plan.id,
      primary_checkpoint_id: checkpointIds.get(task.primaryCheckpointKey),
      title: task.title,
      owner_role: task.ownerRole,
      priority: 1,
      status: "proposed",
      approval_state: "not_required",
      purpose: task.purpose,
      evidence_needed: task.evidenceNeeded,
      completion_expectation: task.completionExpectation,
      risk_if_late: task.riskIfLate,
      created_from_run_id: runId,
      created_from_action_id: actionId,
    });
    if (error) throw error;
  }

  for (const permission of output.permissionRequests) {
    const { error } = await db.from("permission_requests").insert({
      account_id: input.accountId,
      artist_workspace_id: input.artistWorkspaceId,
      artist_id: input.artistId,
      mission_id: missionId,
      request_type: permission.requestType,
      title: permission.title,
      body: permission.body,
      risk: permission.risk,
      status: "pending",
      created_from_run_id: runId,
      created_from_action_id: actionId,
    });
    if (error) throw error;
  }

  const { error: missionError } = await db.from("missions").update({ active_plan_version_id: plan.id }).eq("id", missionId);
  if (missionError) throw missionError;
}

async function writeOperatingEvent(db: any, input: MissionGenesisInput, runId: string, missionId: string | undefined, output: MissionGenesisOutput) {
  const eventType = output.outcome === "activate_mission" ? "mission_activated" : output.outcome === "candidate_needs_context" ? "mission_candidate_created" : `mission_genesis_${output.outcome}`;
  const { error } = await db.from("operating_events").insert({
    account_id: input.accountId,
    artist_workspace_id: input.artistWorkspaceId,
    artist_id: input.artistId,
    event_type: eventType,
    actor_type: "manager",
    target_type: missionId ? "mission" : "artist",
    target_id: missionId ?? input.artistId,
    source_type: "manager_synthesis_run",
    source_id: runId,
    manager_synthesis_run_id: runId,
    mission_id: missionId ?? null,
    summary: output.decisionSummary,
    payload: { outcome: output.outcome, reasons: output.reasons, evidenceNeeded: output.evidenceNeeded },
  });
  if (error) throw error;
}

async function completeManagerRun(db: any, runId: string, output: MissionGenesisOutput, missionId?: string) {
  const { error } = await db.from("manager_synthesis_runs").update({
    mission_id: missionId ?? null,
    status: "completed",
    classification: `mission_genesis_v2_${output.outcome}`,
    confidence: output.confidence === "limited" ? "low" : output.confidence,
    steps_payload: [{ step: "packet_built", status: "completed" }, { step: "openai_synthesis", status: "completed" }, { step: "decision_persisted", status: "completed" }],
    action_plan: output.tasks,
    limitations: output.evidenceNeeded,
    completed_at: new Date().toISOString(),
  }).eq("id", runId);
  if (error) throw error;
}

async function completeUsageEvent(db: any, usageId: string, usage: Record<string, unknown>) {
  const inputDetails = isRecord(usage.input_tokens_details) ? usage.input_tokens_details : {};
  const outputDetails = isRecord(usage.output_tokens_details) ? usage.output_tokens_details : {};
  const { error } = await db.from("ai_run_usage_events").update({
    status: "succeeded",
    input_tokens: numberOrNull(usage.input_tokens),
    cached_input_tokens: numberOrNull(inputDetails.cached_tokens),
    output_tokens: numberOrNull(usage.output_tokens),
    reasoning_tokens: numberOrNull(outputDetails.reasoning_tokens),
    completed_at: new Date().toISOString(),
  }).eq("id", usageId);
  if (error) throw error;
}

function toViewModel(output: MissionGenesisOutput, persisted: { missionId?: string; questions: MissionGenesisQuestion[] }) {
  const titles: Record<MissionGenesisOutput["outcome"], string> = {
    activate_mission: "Mission activated",
    candidate_needs_context: "The Manager needs context",
    request_evidence: "Mission was not created",
    update_existing_mission: "Existing mission should be updated",
    no_mission: "Mission was not created",
  };
  return {
    outcome: output.outcome,
    title: titles[output.outcome],
    body: output.decisionSummary,
    reasons: output.reasons,
    questions: persisted.questions,
    evidenceNeeded: output.evidenceNeeded,
    ...(output.outcome === "candidate_needs_context" ? { candidateMissionId: persisted.missionId } : {}),
    ...(output.outcome === "activate_mission" ? { activatedMissionId: persisted.missionId } : {}),
  };
}

async function markRunFailedSafe(runId: string, message: string) {
  try {
    const db = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"));
    await db.from("manager_synthesis_runs").update({ status: "failed", error: message, completed_at: new Date().toISOString() }).eq("id", runId);
  } catch { /* preserve original error */ }
}

async function markUsageFailedSafe(usageId: string, message: string) {
  try {
    const db = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"));
    await db.from("ai_run_usage_events").update({ status: "failed", failure_reason: message, completed_at: new Date().toISOString() }).eq("id", usageId);
  } catch { /* preserve original error */ }
}

function readOutputText(payload: any) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) return payload.output_text;
  for (const item of payload?.output ?? []) {
    for (const content of item?.content ?? []) {
      if (typeof content?.text === "string" && content.text.trim()) return content.text;
    }
  }
  throw new Error("OpenAI Mission Genesis response did not contain structured output text.");
}

function memoryKind(question: string) {
  if (/avoid|never|do not|boundary|budget|capacity|deadline/i.test(question)) return "constraint";
  if (/goal|priority|optimizing|want/i.test(question)) return "preference";
  return "fact";
}

function questionPrefix(missionId: string) {
  return `mission_genesis_${missionId.replaceAll("-", "_")}_`;
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60) || "context";
}

function compact(values: unknown[]) {
  return values.filter((value): value is string => typeof value === "string" && Boolean(value.trim())).map((value) => value.trim());
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function requireEnv(key: string) {
  const value = Deno.env.get(key);
  if (!value) throw new Error(`Missing required environment variable: ${key}.`);
  return value;
}

function describeError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (isRecord(error) && typeof error.message === "string" && error.message.trim()) return error.message;
  return fallback;
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
