import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildManagerConversationInstructions,
  managerConversationJsonSchema,
  parseManagerConversationOutput,
  type ManagerConversationOutput,
} from "../_shared/openaiManagerConversation.ts";
import { persistManagerMissionGraphDecisions } from "../_shared/missionGraphPersistence.ts";
import {
  getMissionPatternRegistry,
  selectMissionPatternsForPacket,
} from "../_shared/mission-patterns/missionPatternRegistry.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ManagerConversationInput = {
  accountId: string;
  artistWorkspaceId: string;
  artistId: string;
  conversationId?: string;
  body: string;
  contextRequestId?: string;
  contextAnswers?: Array<{ questionKey: string; answer: string }>;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  let input: ManagerConversationInput | null = null;
  let runId: string | null = null;
  let usageId: string | null = null;

  try {
    input = (await request.json()) as ManagerConversationInput;
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
    const conversationId = await ensureConversation(db, input);
    const artistMessage = await insertConversationMessage(db, input, conversationId, {
      speaker: "artist",
      label: "You",
      body: input.body.trim(),
      metadata: managerArtistMessageMetadata(input),
    });

    const packet = await buildManagerConversationPacket(db, input, conversationId, artistMessage.id);
    runId = await createManagerRun(db, input, conversationId, packet);
    usageId = await createUsageEvent(db, input, runId);

    const { output, usage } = await callOpenAIManagerConversation(managerConversationModelContext(input, packet));
    const persistedWork = await persistManagerMissionGraphDecisions(db, input, {
      conversationId,
      runId,
      sourceType: "manager_conversation",
      trigger: "manager_conversation",
    }, output);
    output.createdWork = persistedWork;
    await persistActions(db, input, runId, output);
    await persistMemory(db, input, conversationId, runId, output);
    const managerMessage = await insertConversationMessage(db, input, conversationId, {
      speaker: "manager",
      label: "Manager",
      body: output.responseBody,
      manager_synthesis_run_id: runId,
      metadata: {
        classification: output.classification,
        confidence: output.confidence,
        evidenceIds: output.evidenceIds,
        limitations: output.limitations,
        createdWork: output.createdWork,
        contextQuestions: output.contextQuestions,
        contextRequestId: output.contextQuestions.length ? `manager-context-${runId}` : "",
        proposedActions: output.proposedActions,
      },
    });
    await updateConversation(db, input, conversationId, output);
    await completeManagerRun(db, runId, output);
    await completeUsageEvent(db, usageId, usage);
    const messages = await selectConversationMessages(db, input, conversationId);

    return json(toConversationViewModel({
      id: conversationId,
      topic: input.conversationId ? undefined : output.topic,
      status: output.status || "Manager responded",
      summary: output.summary,
      last_update_at: new Date().toISOString(),
    }, messages.length ? messages : [artistMessage, managerMessage]));
  } catch (error) {
    const message = describeError(error, "Manager conversation failed.");
    if (runId) await markRunFailedSafe(runId, message);
    if (usageId) await markUsageFailedSafe(usageId, message);
    return json({ error: message }, 500);
  }
});

function validateInput(input: ManagerConversationInput) {
  if (!input?.accountId || !input.artistWorkspaceId || !input.artistId) throw new Error("Manager conversation workspace input is incomplete.");
  if (!input.body || input.body.trim().length < 3) throw new Error("Manager conversation requires a directive or question.");
}

async function assertWorkspace(db: any, input: ManagerConversationInput) {
  const { data, error } = await db
    .from("artist_workspaces")
    .select("id,account_id,artist_id")
    .eq("id", input.artistWorkspaceId)
    .eq("account_id", input.accountId)
    .eq("artist_id", input.artistId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Manager conversation workspace was not found.");
}

async function ensureConversation(db: any, input: ManagerConversationInput) {
  if (input.conversationId) {
    const { data, error } = await db
      .from("conversations")
      .select("id")
      .eq("id", input.conversationId)
      .eq("account_id", input.accountId)
      .eq("artist_workspace_id", input.artistWorkspaceId)
      .eq("artist_id", input.artistId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("Manager conversation was not found.");
    return input.conversationId;
  }

  const { data, error } = await db
    .from("conversations")
    .insert({
      account_id: input.accountId,
      artist_workspace_id: input.artistWorkspaceId,
      artist_id: input.artistId,
      topic: titleFromBody(input.body),
      status: "active",
      summary: input.body.trim().slice(0, 220),
      last_update_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function buildManagerConversationPacket(db: any, input: ManagerConversationInput, conversationId: string, messageId: string) {
  const [profile, evidence, musicItems, musicProjects, memory, agentReports, missions, tasks, conversations, messages, managerPackets] = await Promise.all([
    selectMany(db, "artist_profiles", "id,display_name,genres,home_market,stage,current_goal,artist_direction,budget_context,social_handles", input, 1),
    selectMany(db, "evidence_items", "id,source,source_kind,evidence_type,subject_type,subject_id,subject_label,metric_name,metric_value,metric_unit,freshness,confidence,provenance,limitation,raw_ref", input, 240),
    selectMany(db, "music_items", "id,title,item_type,lifecycle_stage,released_at,source_kind,source_limit,metadata", input, 120),
    selectMany(db, "music_projects", "id,title,project_type,lifecycle_stage,released_at,source_kind,source_limit,metadata", input, 80),
    selectMany(db, "memory_entries", "id,scope,kind,content,source_type,confidence,reason,mission_id,conversation_id,created_at", input, 160),
    selectMany(db, "agent_reports", "id,agent_key,mission_id,mission_pattern_key,summary,confidence,limitations,finding,evidence_missing,risk_or_opportunity,recommended_internal_action,permission_required,suggested_follow_up,created_at", input, 40),
    selectMany(db, "missions", "id,title,objective,reason,status,priority,progress,summary,pattern_name,current_recommendation,required_evidence,missing_evidence,change_conditions,review_point,created_at", input, 80),
    selectMany(db, "tasks", "id,mission_id,primary_checkpoint_id,title,owner_role,status,purpose,evidence_needed,completion_expectation,risk_if_late", input, 160),
    selectMany(db, "conversations", "id,topic,status,summary,last_update_at,created_at", input, 30),
    selectMany(db, "conversation_messages", "id,conversation_id,speaker,label,body,metadata,created_at", input, 120),
    selectMany(db, "manager_intelligence_packets", "id,packet_type,profile_projection_json,signal_snapshot_json,strategic_diagnosis_json,asset_reads_json,market_reads_json,mission_seed_json,conversation_memory_seed_json,supporting_evidence_json,created_at", input, 1),
  ]);
  const latestManagerIntelligencePacket = managerPackets[0] ?? null;
  return {
    packetVersion: "manager_conversation_router_v1",
    generatedAt: new Date().toISOString(),
    conversationId,
    newMessageId: messageId,
    artist: {
      id: input.artistId,
      name: profile[0]?.display_name ?? "Artist",
      stage: profile[0]?.stage ?? "unknown",
      goals: compact([profile[0]?.current_goal, profile[0]?.artist_direction]),
      genres: profile[0]?.genres ?? [],
      homeMarket: profile[0]?.home_market ?? "",
      budgetContext: profile[0]?.budget_context ?? "",
      socialHandles: profile[0]?.social_handles ?? {},
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
    music: { items: musicItems, projects: musicProjects },
    memory,
    recentAgentReports: agentReports,
    existingMissions: missions,
    existingTasks: tasks,
    recentConversations: conversations,
    recentMessages: messages,
    latestManagerIntelligencePacket,
    managerIntelligenceProfileProjection: latestManagerIntelligencePacket?.profile_projection_json ?? {},
    managerIntelligenceMissionSeed: latestManagerIntelligencePacket?.mission_seed_json ?? {},
    managerIntelligenceAssetReads: latestManagerIntelligencePacket?.asset_reads_json ?? [],
    managerIntelligenceMarketReads: latestManagerIntelligencePacket?.market_reads_json ?? [],
    missionPatternRegistry: getMissionPatternRegistry(),
    recommendedMissionPatterns: selectMissionPatternsForPacket({
      artist: {
        homeMarket: profile[0]?.home_market ?? "",
        goals: compact([profile[0]?.current_goal, profile[0]?.artist_direction]),
      },
      managerIntelligenceMissionSeed: latestManagerIntelligencePacket?.mission_seed_json ?? {},
      evidence,
    } as any),
    rules: {
      userContextIsNotThirdPartyEvidence: true,
      externalActionsRequirePermission: true,
      noSeparateEvidenceReadSection: true,
      createdWorkMustBeConcrete: true,
    },
  };
}

async function selectMany(db: any, table: string, columns: string, input: ManagerConversationInput, limit: number) {
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

async function insertConversationMessage(db: any, input: ManagerConversationInput, conversationId: string, message: Record<string, unknown>) {
  const { data, error } = await db
    .from("conversation_messages")
    .insert({
      account_id: input.accountId,
      artist_workspace_id: input.artistWorkspaceId,
      artist_id: input.artistId,
      conversation_id: conversationId,
      ...message,
    })
    .select("id,conversation_id,speaker,label,body,metadata,created_at")
    .single();
  if (error) throw error;
  return data;
}

async function callOpenAIManagerConversation(context: unknown) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${requireEnv("OPENAI_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: Deno.env.get("OPENAI_MANAGER_CONVERSATION_MODEL") || Deno.env.get("OPENAI_SUMMARY_MODEL") || "gpt-5-mini",
      instructions: buildManagerConversationInstructions(),
      input: JSON.stringify(context),
      text: { format: { type: "json_schema", ...managerConversationJsonSchema } },
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Manager conversation request failed with status ${response.status}: ${body.slice(0, 500)}`);
  }
  const payload = await response.json();
  return {
    output: parseManagerConversationOutput(readOutputText(payload)),
    usage: isRecord(payload.usage) ? payload.usage : {},
  };
}

async function createManagerRun(db: any, input: ManagerConversationInput, conversationId: string, packet: unknown) {
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
      context_payload: managerConversationModelContext(input, packet),
      steps_payload: [{ step: "packet_built", status: "completed" }, { step: "manager_synthesis", status: "running" }],
      action_plan: [],
      limitations: [],
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function persistActions(db: any, input: ManagerConversationInput, runId: string, output: ManagerConversationOutput) {
  for (const [index, action] of output.proposedActions.entries()) {
    const { error } = await db.from("manager_run_actions").insert({
      account_id: input.accountId,
      artist_workspace_id: input.artistWorkspaceId,
      artist_id: input.artistId,
      manager_synthesis_run_id: runId,
      order_index: index,
      action_type: action.actionType,
      target_type: action.targetType,
      status: action.approvalRequired ? "approval_required" : "pending",
      approval_required: action.approvalRequired,
      payload: action,
    });
    if (error) throw error;
  }
}

async function persistMemory(db: any, input: ManagerConversationInput, conversationId: string, runId: string, output: ManagerConversationOutput) {
  for (const item of output.durableMemory) {
    const { error } = await db.from("memory_entries").insert({
      account_id: input.accountId,
      artist_workspace_id: input.artistWorkspaceId,
      artist_id: input.artistId,
      conversation_id: conversationId,
      scope: "conversation",
      kind: "fact",
      content: item,
      source_type: "manager_conversation",
      source_id: conversationId,
      confidence: output.confidence === "unknown" ? "medium" : output.confidence,
      reason: "Saved from Manager conversation because it can affect future decisions.",
      created_from_run_id: runId,
    });
    if (error) throw error;
  }
}

async function updateConversation(db: any, input: ManagerConversationInput, conversationId: string, output: ManagerConversationOutput) {
  const patch: Record<string, unknown> = {
    status: output.status || "Manager responded",
    summary: output.summary,
    last_update_at: new Date().toISOString(),
  };
  if (!input.conversationId) {
    patch.topic = output.topic || titleFromBody(input.body);
  }
  const { error } = await db
    .from("conversations")
    .update(patch)
    .eq("id", conversationId)
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("artist_id", input.artistId);
  if (error) throw error;
}

async function selectConversationMessages(db: any, input: ManagerConversationInput, conversationId: string) {
  const { data, error } = await db
    .from("conversation_messages")
    .select("id,conversation_id,speaker,label,body,metadata,created_at")
    .eq("conversation_id", conversationId)
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("artist_id", input.artistId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

async function completeManagerRun(db: any, runId: string, output: ManagerConversationOutput) {
  const { error } = await db
    .from("manager_synthesis_runs")
    .update({
      status: "completed",
      classification: output.classification,
      confidence: output.confidence,
      steps_payload: [{ step: "packet_built", status: "completed" }, { step: "manager_synthesis", status: "completed" }],
      action_plan: output.proposedActions,
      limitations: output.limitations,
      completed_at: new Date().toISOString(),
    })
    .eq("id", runId);
  if (error) throw error;
}

async function createUsageEvent(db: any, input: ManagerConversationInput, runId: string) {
  const { data, error } = await db
    .from("ai_run_usage_events")
    .insert({
      account_id: input.accountId,
      artist_workspace_id: input.artistWorkspaceId,
      artist_id: input.artistId,
      workflow_key: "manager_conversation_run",
      run_type: "manager_synthesis",
      manager_synthesis_run_id: runId,
      provider: "openai",
      model_or_tool: Deno.env.get("OPENAI_MANAGER_CONVERSATION_MODEL") || Deno.env.get("OPENAI_SUMMARY_MODEL") || "gpt-5-mini",
      operation_key: "manager_conversation_router",
      status: "started",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function completeUsageEvent(db: any, usageId: string, usage: Record<string, unknown>) {
  const inputDetails = isRecord(usage.input_tokens_details) ? usage.input_tokens_details : {};
  const outputDetails = isRecord(usage.output_tokens_details) ? usage.output_tokens_details : {};
  const { error } = await db
    .from("ai_run_usage_events")
    .update({
      status: "succeeded",
      input_tokens: numberOrNull(usage.input_tokens),
      cached_input_tokens: numberOrNull(inputDetails.cached_tokens),
      output_tokens: numberOrNull(usage.output_tokens),
      reasoning_tokens: numberOrNull(outputDetails.reasoning_tokens),
      provider_request_count: 1,
      completed_at: new Date().toISOString(),
    })
    .eq("id", usageId);
  if (error) throw error;
}

async function markRunFailedSafe(runId: string, errorMessage: string) {
  try {
    const db = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"));
    await db.from("manager_synthesis_runs").update({ status: "failed", error: errorMessage, completed_at: new Date().toISOString() }).eq("id", runId);
  } catch {
    // Failure marking must not mask the original error.
  }
}

async function markUsageFailedSafe(usageId: string, errorMessage: string) {
  try {
    const db = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"));
    await db.from("ai_run_usage_events").update({ status: "failed", error: errorMessage, completed_at: new Date().toISOString() }).eq("id", usageId);
  } catch {
    // Failure marking must not mask the original error.
  }
}

function toConversationViewModel(conversation: any, messages: any[]) {
  const normalizedMessages = messages.map((message) => {
    const metadata = isRecord(message.metadata) ? message.metadata : {};
    return {
      id: message.id,
      speaker: message.speaker === "artist" ? "artist" : "manager",
      label: message.label || (message.speaker === "artist" ? "You" : "Manager"),
      body: message.body,
      createdWork: normalizeCreatedWork(metadata.createdWork),
      contextQuestions: normalizeContextQuestions(metadata.contextQuestions),
      contextRequestId: typeof metadata.contextRequestId === "string" && metadata.contextRequestId.trim() ? metadata.contextRequestId.trim() : undefined,
    };
  });
  return {
    id: conversation.id,
    topic: conversation.topic || titleFromBody(normalizedMessages.find((message) => message.speaker === "artist")?.body || ""),
    status: conversation.status,
    summary: conversation.summary || "Manager conversation.",
    prompt: normalizedMessages.find((message) => message.speaker === "artist")?.body || "",
    lastUpdate: conversation.last_update_at || "",
    messages: normalizedMessages,
    createdWork: normalizedMessages.flatMap((message) => message.createdWork ?? []),
  };
}

function managerConversationModelContext(input: ManagerConversationInput, packet: unknown) {
  return {
    packet,
    userMessage: input.body.trim(),
    contextRequestId: input.contextRequestId ?? "",
    contextAnswers: normalizeContextAnswers(input.contextAnswers),
  };
}

function managerArtistMessageMetadata(input: ManagerConversationInput) {
  return {
    contextRequestId: input.contextRequestId ?? "",
    contextAnswers: normalizeContextAnswers(input.contextAnswers),
  };
}

function normalizeCreatedWork(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === "object")
    .map((item: any) => ({
      type: item.type === "music_item" || item.type === "mission" || item.type === "task" ? item.type : "task",
      title: String(item.title || "").trim(),
      body: String(item.body || "").trim(),
      id: item.id ? String(item.id) : undefined,
      parentMissionId: item.parentMissionId ? String(item.parentMissionId) : undefined,
      status: item.status === "updated" || item.status === "approval_required" || item.status === "failed" || item.status === "pending" ? item.status : "created",
    }))
    .filter((item) => item.title && item.body);
}

function normalizeContextQuestions(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === "object")
    .map((item: any) => ({
      key: String(item.key || "").trim(),
      question: String(item.question || "").trim(),
      reason: String(item.reason || "").trim(),
      answerKind: item.answerKind === "single_select" || item.answerKind === "multi_select" || item.answerKind === "money_range" ? item.answerKind : "short_text",
      options: Array.isArray(item.options) ? item.options.map((option: unknown) => String(option || "").trim()).filter(Boolean) : [],
    }))
    .filter((item) => item.key && item.question);
}

function normalizeContextAnswers(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && typeof item === "object")
    .map((item: any) => ({
      questionKey: String(item.questionKey || "").trim(),
      answer: String(item.answer || "").trim(),
    }))
    .filter((item) => item.questionKey && item.answer);
}

function readOutputText(payload: any) {
  if (typeof payload.output_text === "string") return payload.output_text;
  const fromOutput = payload.output?.flatMap((item: any) => item.content ?? []).find((item: any) => typeof item.text === "string")?.text;
  if (typeof fromOutput === "string") return fromOutput;
  throw new Error("Manager conversation response did not include output text.");
}

function titleFromBody(body: string) {
  const cleaned = body.trim().replace(/\s+/g, " ");
  return cleaned.length > 72 ? `${cleaned.slice(0, 69)}...` : cleaned || "Manager conversation";
}

function compact(values: unknown[]) {
  return values.filter((value): value is string => typeof value === "string" && value.trim().length > 0);
}

function requireEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function describeError(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
