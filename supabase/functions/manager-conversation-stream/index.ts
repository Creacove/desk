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
import { getPlaybooksInstructions } from "../_shared/manager-intelligence/playbooks/playbookDefinitions.ts";
import type { PlaybookKey } from "../_shared/manager-intelligence/types.ts";
import {
  managerConversationTools,
  runManagerAgentLoop,
  type ManagerAgentToolTrace,
} from "../_shared/manager-conversation/agentLoop.ts";
import { executeManagerConversationTool } from "../_shared/manager-conversation/toolExecutor.ts";
import { qualifyManagerMemoryCandidates } from "../_shared/manager-conversation/memory.ts";
import { assertActiveWorkspaceEntitlement } from "../_shared/entitlements.ts";

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
  taskId?: string;
  body: string;
  contextRequestId?: string;
  contextAnswers?: Array<{ questionKey: string; answer: string }>;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const encoder = new TextEncoder();
  let eventIndex = 0;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: unknown) => {
        eventIndex += 1;
        controller.enqueue(encoder.encode(`id: ${eventIndex}\ndata: ${JSON.stringify(event)}\n\n`));
      };

      let input: ManagerConversationInput | null = null;
      let runId: string | null = null;
      let usageId: string | null = null;

      try {
        input = (await request.json()) as ManagerConversationInput;
        validateInput(input);

        const authHeader = request.headers.get("Authorization");
        if (!authHeader) throw new HttpError("Missing Authorization header.", 401);

        const supabaseUrl = requireEnv("SUPABASE_URL");
        const anonKey = requireEnv("SUPABASE_ANON_KEY");
        const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
        const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
        const { data: { user }, error: userError } = await authClient.auth.getUser();
        if (userError || !user) throw new HttpError("Unauthorized.", 401);

        const { data: membership, error: membershipError } = await authClient.rpc("is_account_member", { target_account_id: input.accountId });
        if (membershipError) throw membershipError;
        if (!membership) throw new HttpError("Forbidden.", 403);

        const db = createClient(supabaseUrl, serviceRoleKey);
        await assertActiveWorkspaceEntitlement(db, input);
        await assertWorkspace(db, input);
        const conversationId = await ensureConversation(db, input);
        const artistMessage = await insertConversationMessage(db, input, conversationId, {
          speaker: "artist",
          label: "You",
          body: input.body.trim(),
          metadata: managerArtistMessageMetadata(input),
        });

        emit({
          type: "conversation.started",
          conversation: {
            id: conversationId,
            topic: input.conversationId ? undefined : titleFromBody(input.body),
            status: "Manager is thinking",
            prompt: input.body.trim(),
            messages: [toMessageViewModel(artistMessage)],
            createdWork: [],
          },
        });

        emit({ type: "run.step", label: "Reading workspace packet", status: "running" });
        const packet = await buildManagerConversationPacket(db, input, conversationId, artistMessage.id);
        emit({ type: "run.step", label: "Reading workspace packet", status: "completed" });

        runId = await createManagerRun(db, input, conversationId, packet);
        usageId = await createUsageEvent(db, input, runId);
        emit({ type: "run.step", runId, label: "Matching missions and evidence", status: "running" });

        const previousResponseId = await loadPreviousOpenAIResponseId(db, input, conversationId);
        const { output, usage, responseId, toolTrace } = await callOpenAIManagerConversation(
          db,
          input,
          managerConversationModelContext(input, packet, previousResponseId),
          previousResponseId,
          (event) => {
            emit({
              type: event.status === "started" ? "tool.started" : "tool.completed",
              runId: runId ?? undefined,
              tool: event.tool,
              label: managerToolLabel(event.tool),
              status: event.status === "failed" ? "failed" : event.status === "completed" ? "completed" : "running",
              detail: event.summary,
            });
          },
        );
        emit({ type: "run.step", runId, label: "Matching missions and evidence", status: "completed" });
        emit({ type: "tool.started", runId, tool: "manager-router", label: "Preparing Manager answer", status: "running" });

        for (const delta of chunkText(output.responseBody)) {
          emit({ type: "assistant.delta", conversationId, runId, delta });
          await delay(8);
        }
        emit({ type: "tool.completed", runId, tool: "manager-router", label: "Preparing Manager answer", status: "completed" });

        const persistedWork = await persistManagerMissionGraphDecisions(db, input, {
          conversationId,
          runId,
          sourceType: "manager_conversation",
          trigger: "manager_conversation",
        }, output);
        const taskDraftWork = await persistTaskDraftOutput(db, input, conversationId, runId, output);
        output.createdWork = taskDraftWork ? [...persistedWork, taskDraftWork] : persistedWork;

        await persistActions(db, input, runId, output);
        await persistMemory(db, input, conversationId, runId, output);
        const decisionPackage = await persistDecisionPackageOutput(db, input, conversationId, runId, output);
        const managerMessage = await insertConversationMessage(db, input, conversationId, {
          speaker: "manager",
          label: "Manager",
          body: output.responseBody,
          manager_synthesis_run_id: runId,
          metadata: {
            classification: output.classification,
            actionPolicy: output.actionPolicy,
            confidence: output.confidence,
            evidenceIds: output.evidenceIds,
            limitations: output.limitations,
            createdWork: output.createdWork,
            contextQuestions: output.contextQuestions,
            contextRequestId: output.contextQuestions.length ? `manager-context-${runId}` : "",
            proposedActions: output.proposedActions,
            decisionPackageId: decisionPackage?.id ?? "",
            openaiResponseId: responseId,
            toolTraceSummary: safeToolTraceSummary(toolTrace),
          },
        });
        for (const work of output.createdWork) {
          emit({ type: "artifact.changed", runId, artifact: normalizeCreatedWorkItem(work), refresh: refreshHintForCreatedWork(work) });
        }

        await updateConversation(db, input, conversationId, output);
        await completeManagerRun(db, runId, output);
        await completeUsageEvent(db, usageId, usage);
        const messages = await selectConversationMessages(db, input, conversationId);

        emit({
          type: "conversation.completed",
          conversation: toConversationViewModel({
            id: conversationId,
            topic: input.conversationId ? undefined : output.topic,
            status: output.status || "Manager responded",
            summary: output.summary,
            last_update_at: new Date().toISOString(),
          }, messages.length ? messages : [artistMessage, managerMessage], input.taskId),
          refresh: output.createdWork.some((work) => work.type === "mission" || work.type === "task")
            ? refreshHintForCreatedWorkItems(output.createdWork)
            : { conversations: false },
        });
      } catch (error) {
        const message = describeError(error, "Manager conversation failed.");
        if (runId) await markRunFailedSafe(runId, message);
        if (usageId) await markUsageFailedSafe(usageId, message);
        emit({ type: "error", message, runId });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
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
  if (input.taskId) return ensureTaskConversation(db, input);
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

async function ensureTaskConversation(db: any, input: ManagerConversationInput) {
  const { data: task, error: taskError } = await db
    .from("tasks")
    .select("id,title,mission_id")
    .eq("id", input.taskId)
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("artist_id", input.artistId)
    .maybeSingle();
  if (taskError) throw taskError;
  if (!task) throw new Error("Manager task context was not found.");

  if (input.conversationId) {
    const { data: conversation, error } = await db.from("conversations")
      .select("id")
      .eq("id", input.conversationId)
      .eq("account_id", input.accountId)
      .eq("artist_workspace_id", input.artistWorkspaceId)
      .eq("artist_id", input.artistId)
      .maybeSingle();
    if (error) throw error;
    if (!conversation) throw new Error("Manager conversation was not found.");
    await ensureTaskConversationLink(db, input, conversation.id);
    return conversation.id as string;
  }

  const { data: links, error: linkError } = await db.from("artifact_links")
    .select("source_id")
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("source_type", "conversation")
    .eq("target_type", "task")
    .eq("target_id", input.taskId)
    .eq("relationship", "references")
    .limit(1);
  if (linkError) throw linkError;
  if (links?.[0]?.source_id) return links[0].source_id as string;

  let conversationId = "";
  if (task.mission_id) {
    const { data: mission, error: missionError } = await db.from("missions")
      .select("originating_conversation_id")
      .eq("id", task.mission_id)
      .maybeSingle();
    if (missionError) throw missionError;
    conversationId = mission?.originating_conversation_id ?? "";
  }
  if (!conversationId) {
    const { data: conversation, error } = await db.from("conversations").insert({
      account_id: input.accountId,
      artist_workspace_id: input.artistWorkspaceId,
      artist_id: input.artistId,
      topic: `Task: ${task.title}`,
      status: "active",
      summary: `Manager working session for ${task.title}.`,
      linked_mission_id: task.mission_id,
      last_update_at: new Date().toISOString(),
    }).select("id").single();
    if (error) throw error;
    conversationId = conversation.id;
  }
  await ensureTaskConversationLink(db, input, conversationId);
  return conversationId;
}

async function ensureTaskConversationLink(db: any, input: ManagerConversationInput, conversationId: string) {
  const { data: existing, error: existingError } = await db.from("artifact_links")
    .select("id")
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("source_type", "conversation")
    .eq("source_id", conversationId)
    .eq("target_type", "task")
    .eq("target_id", input.taskId)
    .eq("relationship", "references")
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return;
  const { error } = await db.from("artifact_links").insert({
    account_id: input.accountId,
    artist_workspace_id: input.artistWorkspaceId,
    artist_id: input.artistId,
    source_type: "conversation",
    source_id: conversationId,
    target_type: "task",
    target_id: input.taskId,
    relationship: "references",
  });
  if (error) throw error;
}

async function buildManagerConversationPacket(db: any, input: ManagerConversationInput, conversationId: string, messageId: string) {
  const [profile, evidence, musicItems, musicProjects, memory, agentReports, missions, tasks, conversations, messages, managerPackets] = await Promise.all([
    selectMany(db, "artist_profiles", "id,display_name,genres,home_market,stage,current_goal,artist_direction,budget_context,social_handles", input, 1),
    selectMany(db, "evidence_items", "id,source,source_kind,evidence_type,subject_type,subject_id,subject_label,metric_name,metric_value,metric_unit,freshness,confidence,provenance,limitation,raw_ref", input, 12),
    selectMany(db, "music_items", "id,title,item_type,lifecycle_stage,released_at,source_kind,source_limit,metadata", input, 16),
    selectMany(db, "music_projects", "id,title,project_type,lifecycle_stage,released_at,source_kind,source_limit,metadata", input, 12),
    selectMany(db, "memory_entries", "id,scope,kind,content,source_type,confidence,reason,mission_id,conversation_id,created_at", input, 12),
    selectMany(db, "agent_reports", "id,agent_key,mission_id,mission_pattern_key,summary,confidence,limitations,finding,evidence_missing,risk_or_opportunity,recommended_internal_action,permission_required,suggested_follow_up,created_at", input, 8),
    selectMany(db, "missions", "id,title,objective,reason,status,priority,progress,summary,pattern_name,current_recommendation,required_evidence,missing_evidence,change_conditions,review_point,created_at", input, 12),
    selectMany(db, "tasks", "id,mission_id,primary_checkpoint_id,title,owner_role,status,purpose,evidence_needed,completion_expectation,completion_mode,deliverable_title,deliverable_requirements,manager_responsibility,user_responsibility,risk_if_late", input, 20),
    selectMany(db, "conversations", "id,topic,status,summary,last_update_at,created_at", input, 12),
    selectConversationHistory(db, input, conversationId, 12),
    selectMany(db, "manager_intelligence_packets", "id,packet_type,profile_projection_json,signal_snapshot_json,strategic_diagnosis_json,asset_reads_json,market_reads_json,mission_seed_json,conversation_memory_seed_json,supporting_evidence_json,internal_only_json,created_at", input, 1),
  ]);
  const latestManagerIntelligencePacket = managerPackets[0] ?? null;
  const taskContext = input.taskId ? tasks.find((task: any) => task.id === input.taskId) ?? null : null;
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
    conversationHistory: messages,
    taskContext,
    latestManagerIntelligencePacket,
    managerIntelligenceProfileProjection: latestManagerIntelligencePacket?.profile_projection_json ?? {},
    managerIntelligenceMissionSeed: latestManagerIntelligencePacket?.mission_seed_json ?? {},
    managerIntelligenceAssetReads: latestManagerIntelligencePacket?.asset_reads_json ?? [],
    managerIntelligenceMarketReads: latestManagerIntelligencePacket?.market_reads_json ?? [],
    activePlaybookKeys: readActivePlaybookKeys(latestManagerIntelligencePacket?.internal_only_json),
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

async function selectConversationHistory(db: any, input: ManagerConversationInput, conversationId: string, limit: number) {
  const { data, error } = await db
    .from("conversation_messages")
    .select("id,conversation_id,speaker,label,body,metadata,created_at")
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("artist_id", input.artistId)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).reverse();
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

async function loadPreviousOpenAIResponseId(db: any, input: ManagerConversationInput, conversationId: string) {
  const { data, error } = await db
    .from("conversation_messages")
    .select("metadata")
    .eq("conversation_id", conversationId)
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("artist_id", input.artistId)
    .eq("speaker", "manager")
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  const metadata = isRecord(data?.[0]?.metadata) ? data[0].metadata : {};
  return typeof metadata.openaiResponseId === "string" ? metadata.openaiResponseId : "";
}

async function callOpenAIManagerConversation(
  db: any,
  input: ManagerConversationInput,
  context: unknown,
  previousResponseId: string,
  onToolEvent: (event: ManagerAgentToolTrace) => void,
) {
  const playbookInstructions = getPlaybooksInstructions(managerConversationPlaybookKeys(context));
  const result = await runManagerAgentLoop({
    endpoint: "https://api.openai.com/v1/responses",
    apiKey: requireEnv("OPENAI_API_KEY"),
    model: Deno.env.get("OPENAI_MANAGER_REASONING_MODEL") || Deno.env.get("OPENAI_MANAGER_CONVERSATION_MODEL") || Deno.env.get("OPENAI_SUMMARY_MODEL") || "gpt-5.6-sol",
    instructions: buildManagerConversationInstructions(playbookInstructions),
    context,
    previousResponseId,
    tools: managerConversationTools,
    jsonSchema: managerConversationJsonSchema,
    reasoningEffort: "high",
    executeTool: (name, args) => executeManagerConversationTool(db, input, name, args),
    onToolEvent,
  });
  return {
    output: parseManagerConversationOutput(result.outputText),
    usage: result.usage,
    responseId: result.responseId,
    toolTrace: result.toolTrace,
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
  const { data: existing, error: existingError } = await db.from("memory_entries")
    .select("id,content,kind,mission_id,task_id")
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("artist_id", input.artistId)
    .order("created_at", { ascending: false })
    .limit(80);
  if (existingError) throw existingError;
  const taskMissionId = input.taskId ? await loadTaskMissionId(db, input) : "";
  const candidates = qualifyManagerMemoryCandidates(output.durableMemory, existing ?? [], {
    taskId: input.taskId,
    missionId: taskMissionId,
  });
  for (const item of candidates) {
    const { error } = await db.from("memory_entries").insert({
      account_id: input.accountId,
      artist_workspace_id: input.artistWorkspaceId,
      artist_id: input.artistId,
      conversation_id: conversationId,
      mission_id: item.mission_id,
      task_id: item.task_id,
      scope: item.scope,
      kind: item.kind,
      content: item.content,
      source_type: "manager_conversation",
      source_id: conversationId,
      confidence: output.confidence === "unknown" ? "medium" : output.confidence,
      reason: `Qualified as ${item.category} because it can affect future decisions.`,
      supersedes_memory_entry_id: item.supersedes_memory_entry_id,
      created_from_run_id: runId,
    });
    if (error) throw error;
  }
}

async function loadTaskMissionId(db: any, input: ManagerConversationInput) {
  const { data, error } = await db.from("tasks")
    .select("mission_id")
    .eq("id", input.taskId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .maybeSingle();
  if (error) throw error;
  return data?.mission_id ?? "";
}

async function persistTaskDraftOutput(
  db: any,
  input: ManagerConversationInput,
  conversationId: string,
  runId: string,
  output: ManagerConversationOutput,
) {
  if (!input.taskId || output.contextQuestions.length) return null;
  const { data: task, error: taskError } = await db.from("tasks")
    .select("id,mission_id,title,completion_mode,deliverable_title,deliverable_requirements,completion_expectation")
    .eq("id", input.taskId)
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("artist_id", input.artistId)
    .maybeSingle();
  if (taskError) throw taskError;
  if (!task || task.completion_mode !== "manager_draft") return null;

  const { data: current, error: currentError } = await db.from("manager_outputs")
    .select("id")
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("output_type", "task_draft")
    .eq("subject_type", "task")
    .eq("subject_id", input.taskId)
    .eq("is_current", true)
    .maybeSingle();
  if (currentError) throw currentError;
  if (current?.id) {
    const { error } = await db.from("manager_outputs").update({ is_current: false }).eq("id", current.id);
    if (error) throw error;
  }

  const title = task.deliverable_title || task.title;
  const { data: draft, error: draftError } = await db.from("manager_outputs").insert({
    account_id: input.accountId,
    artist_workspace_id: input.artistWorkspaceId,
    artist_id: input.artistId,
    conversation_id: conversationId,
    mission_id: task.mission_id,
    subject_type: "task",
    subject_id: input.taskId,
    output_type: "task_draft",
    dominant_situation: "task_completion",
    layout_pattern: "working_draft",
    tone: "direct",
    summary: output.summary,
    primary_recommendation_json: { recommendation: output.responseBody },
    confidence_json: { confidence: output.confidence },
    supporting_evidence_json: output.evidenceIds.map((id) => ({ id })),
    render_json: {
      title,
      content: output.responseBody,
      status: "draft",
      completionExpectation: task.completion_expectation,
      requirements: task.deliverable_requirements ?? [],
      assumptions: output.limitations,
      evidenceIds: output.evidenceIds,
      conversationId,
    },
    supersedes_output_id: current?.id ?? null,
    is_current: true,
    created_from_run_id: runId,
  }).select("id").single();
  if (draftError) throw draftError;
  const { error: linkError } = await db.from("artifact_links").insert({
    account_id: input.accountId,
    artist_workspace_id: input.artistWorkspaceId,
    artist_id: input.artistId,
    source_type: "manager_output",
    source_id: draft.id,
    target_type: "task",
    target_id: input.taskId,
    relationship: "response_to",
  });
  if (linkError) throw linkError;
  return {
    type: "task" as const,
    title,
    body: "Manager draft saved to this task. Open the task to review or submit this version.",
    id: input.taskId,
    parentMissionId: task.mission_id ?? undefined,
    status: current?.id ? "updated" as const : "created" as const,
  };
}

async function persistDecisionPackageOutput(db: any, input: ManagerConversationInput, conversationId: string, runId: string, output: ManagerConversationOutput) {
  if (output.actionPolicy !== "create_decision_package") return null;

  const { error: staleError } = await db
    .from("manager_outputs")
    .update({ is_current: false })
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("artist_id", input.artistId)
    .eq("output_type", "decision_package")
    .eq("subject_type", "conversation")
    .eq("subject_id", conversationId)
    .eq("is_current", true);
  if (staleError) throw staleError;

  const { data, error } = await db
    .from("manager_outputs")
    .insert({
      account_id: input.accountId,
      artist_workspace_id: input.artistWorkspaceId,
      artist_id: input.artistId,
      output_type: "decision_package",
      subject_type: "conversation",
      subject_id: conversationId,
      summary: output.summary,
      primary_recommendation_json: { recommendation: output.responseBody },
      confidence_json: { confidence: output.confidence },
      supporting_evidence_json: output.evidenceIds.map((id) => ({ id })),
      render_json: {
        title: output.topic || "Manager decision package",
        summary: output.summary,
        recommendation: output.responseBody,
        confidence: output.confidence,
        classification: output.classification,
        actionPolicy: output.actionPolicy,
        evidenceIds: output.evidenceIds,
        limitations: output.limitations,
        createdWork: output.createdWork,
        proposedActions: output.proposedActions,
        contextQuestions: output.contextQuestions,
        conversationId,
      },
      is_current: true,
      created_from_run_id: runId,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data as { id: string };
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
      model_or_tool: Deno.env.get("OPENAI_MANAGER_REASONING_MODEL") || Deno.env.get("OPENAI_MANAGER_CONVERSATION_MODEL") || Deno.env.get("OPENAI_SUMMARY_MODEL") || "gpt-5.6-sol",
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

function toConversationViewModel(conversation: any, messages: any[], taskContextId?: string) {
  const normalizedMessages = messages.map(toMessageViewModel);
  return {
    id: conversation.id,
    ...(taskContextId ? { taskContextId } : {}),
    topic: conversation.topic || titleFromBody(normalizedMessages.find((message) => message.speaker === "artist")?.body || ""),
    status: conversation.status,
    summary: conversation.summary || "Manager conversation.",
    prompt: normalizedMessages.find((message) => message.speaker === "artist")?.body || "",
    lastUpdate: conversation.last_update_at || "",
    messages: normalizedMessages,
    createdWork: normalizedMessages.flatMap((message) => message.createdWork ?? []),
  };
}

function toMessageViewModel(message: any) {
  const metadata = isRecord(message.metadata) ? message.metadata : {};
  return {
    id: message.id,
    speaker: message.speaker === "artist" ? "artist" : "manager",
    label: message.label || (message.speaker === "artist" ? "You" : "Manager"),
    body: message.body,
    createdWork: normalizeCreatedWork(metadata.createdWork),
    contextQuestions: normalizeContextQuestions(metadata.contextQuestions),
    contextRequestId: typeof metadata.contextRequestId === "string" && metadata.contextRequestId.trim() ? metadata.contextRequestId.trim() : undefined,
    createdAt: message.created_at,
    status: "sent",
  };
}

function managerConversationModelContext(input: ManagerConversationInput, packet: unknown, previousResponseId = "") {
  const modelPacket = isRecord(packet)
    ? {
        ...packet,
        conversationHistory: previousResponseId
          ? []
          : Array.isArray(packet.conversationHistory)
            ? packet.conversationHistory.filter((message) => !isRecord(message) || message.id !== packet.newMessageId)
            : [],
      }
    : packet;
  return {
    packet: modelPacket,
    userMessage: input.body.trim(),
    contextRequestId: input.contextRequestId ?? "",
    contextAnswers: normalizeContextAnswers(input.contextAnswers),
    taskId: input.taskId ?? "",
  };
}

function managerConversationPlaybookKeys(context: unknown): PlaybookKey[] {
  if (!isRecord(context) || !isRecord(context.packet)) return [];
  const directKeys = readPlaybookKeyList(context.packet.activePlaybookKeys);
  if (directKeys.length) return directKeys;
  const latestPacket = isRecord(context.packet.latestManagerIntelligencePacket)
    ? context.packet.latestManagerIntelligencePacket
    : {};
  return readActivePlaybookKeys(latestPacket.internal_only_json);
}

function readActivePlaybookKeys(value: unknown): PlaybookKey[] {
  if (!isRecord(value)) return [];
  return readPlaybookKeyList(value.playbooks_applied);
}

function readPlaybookKeyList(value: unknown): PlaybookKey[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<PlaybookKey>([
    "cultural_expansion",
    "era_architecture",
    "artist_as_business",
    "prestige_positioning",
    "artist_first_development",
    "song_fan_trust",
    "live_demand_community",
    "authentic_growth",
    "world_building",
    "fan_psychology_ownership",
    "ar_breakout",
    "playlist_discovery",
    "social_contagion",
    "no_engine",
  ]);
  return value.filter((item): item is PlaybookKey => typeof item === "string" && allowed.has(item as PlaybookKey));
}

function managerArtistMessageMetadata(input: ManagerConversationInput) {
  return {
    taskId: input.taskId ?? "",
    contextRequestId: input.contextRequestId ?? "",
    contextAnswers: normalizeContextAnswers(input.contextAnswers),
  };
}

function safeToolTraceSummary(trace: ManagerAgentToolTrace[]) {
  return trace
    .filter((item) => item.status === "completed")
    .map((item) => ({ tool: item.tool, summary: item.summary }))
    .slice(0, 12);
}

function managerToolLabel(tool: string) {
  if (tool === "web_search") return "Searching the web";
  if (tool === "query_evidence_items") return "Checking evidence";
  if (tool === "query_active_missions") return "Reviewing mission state";
  if (tool === "query_music_catalog") return "Checking catalog";
  if (tool === "query_durable_memory") return "Reading Manager memory";
  if (tool === "query_manager_outputs") return "Reviewing prior decisions";
  return "Using Manager tool";
}

function normalizeCreatedWork(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeCreatedWorkItem).filter((item) => item.title && item.body);
}

function normalizeCreatedWorkItem(item: any) {
  return {
    type: item.type === "music_item" || item.type === "mission" || item.type === "task" ? item.type : "task",
    title: String(item.title || "").trim(),
    body: String(item.body || "").trim(),
    id: item.id ? String(item.id) : undefined,
    parentMissionId: item.parentMissionId ? String(item.parentMissionId) : undefined,
    status: item.status === "updated" || item.status === "approval_required" || item.status === "failed" || item.status === "pending" ? item.status : "created",
  };
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
      recommendedAnswer: String(item.recommendedAnswer || "").trim(),
      recommendationReason: String(item.recommendationReason || "").trim(),
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

function refreshHintForCreatedWork(work: ManagerConversationOutput["createdWork"][number]) {
  if (work.type === "mission") return { missions: true, missionIds: work.id ? [work.id] : [], conversations: false };
  if (work.type === "task") return { missions: true, missionIds: work.parentMissionId ? [work.parentMissionId] : [], taskIds: work.id ? [work.id] : [], conversations: false };
  if (work.type === "music_item") return { music: true };
  return {};
}

function refreshHintForCreatedWorkItems(items: ManagerConversationOutput["createdWork"]) {
  return {
    conversations: false,
    missions: true,
    missionIds: uniqueStrings(items.flatMap((work) => work.type === "mission" ? [work.id] : work.parentMissionId ? [work.parentMissionId] : [])),
    taskIds: uniqueStrings(items.filter((work) => work.type === "task").map((work) => work.id)),
  };
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter((value) => value && value.trim()).map((value) => value.trim()))];
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

function chunkText(value: string) {
  return value.match(/.{1,28}(\s|$)/g) ?? [value];
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

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class HttpError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
