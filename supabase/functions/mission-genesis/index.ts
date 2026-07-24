import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildMissionGenesisInstructions,
  buildMissionGenesisRepairInstructions,
  missionGenesisJsonSchema,
  parseMissionGenesisOutput,
  type MissionGenesisCandidate,
  type MissionGenesisMode,
  type MissionGenesisOutput,
  type MissionGenesisQuestion,
} from "../_shared/openaiMissionGenesis.ts";
import {
  getMissionPatternRegistry,
  selectMissionPatternsForPacket,
} from "../_shared/mission-patterns/missionPatternRegistry.ts";
import { persistMissionGenesisGraphPlan } from "../_shared/missionGraphPersistence.ts";
import { assertActiveWorkspaceEntitlement } from "../_shared/entitlements.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MISSION_GENESIS_PACKET_LIMITS = {
  evidence: 36,
  musicItems: 24,
  musicProjects: 16,
  memory: 32,
  agentReports: 24,
  missions: 16,
  tasks: 24,
  sources: 12,
  managerAssetReads: 8,
  managerMarketReads: 8,
  managerDomainReads: 8,
  managerPublicContext: 6,
  managerOpenDecisions: 8,
  managerDoNotDo: 8,
  arrayItems: 12,
  objectKeys: 14,
  stringLength: 420,
  depth: 3,
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
    await assertActiveWorkspaceEntitlement(db, input);
    await assertWorkspace(db, input);

    if (input.mode === "initial") {
      const { data: existingCandidate } = await db
        .from("missions")
        .select("id,title,objective,reason,summary,pattern_name,current_recommendation,change_conditions,status")
        .eq("artist_workspace_id", input.artistWorkspaceId)
        .eq("status", "candidate")
        .maybeSingle();

      if (existingCandidate) {
        const prefix = questionPrefix(existingCandidate.id);
        const { data: questionRows } = await db
          .from("manager_context_questions")
          .select("id,question_key,question,order_index")
          .like("question_key", `${prefix}%`)
          .eq("status", "active")
          .order("order_index", { ascending: true });

        if (questionRows && questionRows.length > 0) {
          const questionIds = questionRows.map((q: any) => q.id);
          const { data: answerRows } = await db
            .from("manager_context_answers")
            .select("question_id,answer")
            .in("question_id", questionIds);

          const answerMap = new Map((answerRows ?? []).map((ans: any) => [ans.question_id, ans.answer]));
          const unansweredQuestions = questionRows.filter((q: any) => !answerMap.get(q.id));

          if (unansweredQuestions.length > 0) {
            const questions = questionRows.map(mapQuestionFromRow);
            const output: MissionGenesisOutput = {
              outcome: "candidate_needs_context",
              confidence: "medium",
              stage: { label: "Context collection", reason: "An existing candidate mission is awaiting context." },
              decisionSummary: existingCandidate.objective,
              reasons: [existingCandidate.reason],
              evidenceNeeded: [],
              existingMissionId: existingCandidate.id,
              questions: [],
              mission: {
                title: existingCandidate.title,
                objective: existingCandidate.objective,
                reason: existingCandidate.reason,
                summary: existingCandidate.summary ?? "",
                patternName: existingCandidate.pattern_name ?? "",
                currentRecommendation: existingCandidate.current_recommendation ?? "",
                changeConditions: existingCandidate.change_conditions ?? [],
                timeline: "",
                sourceRefs: [],
              },
              checkpoints: [],
              tasks: [],
              permissionRequests: [],
              missionCandidates: [],
            };
            return json(toViewModel(output, { missionId: existingCandidate.id, questions }));
          }
        }
      }
    }

    let contextAnswers: Array<{ questionKey: string; answer: string }> = [];
    let priorCandidate: Record<string, unknown> | null = null;
    if (input.mode === "continuation") {
      priorCandidate = await loadCandidate(db, input);
      contextAnswers = await persistContextAnswers(db, input);
    }

    const packet = await buildArtistOperatingPacket(db, input);
    runId = await createManagerRun(db, input, packet, contextAnswers, priorCandidate);
    usageId = await createUsageEvent(db, input, runId);

    scheduleMissionGenesisBackgroundRun(
      completeMissionGenesisRun({
        db,
        input,
        runId,
        usageId,
        packet,
        contextAnswers,
        priorCandidate,
      }),
    );

    return json({ status: "processing", runId }, 202);
  } catch (error) {
    const message = describeError(error, "Mission Genesis failed.");
    if (runId) await markRunFailedSafe(runId, message);
    if (usageId) await markUsageFailedSafe(usageId, message);
    return json({ error: message }, 500);
  }
});

function scheduleMissionGenesisBackgroundRun(task: Promise<void>) {
  const runtime = (globalThis as { EdgeRuntime?: { waitUntil?: (promise: Promise<unknown>) => void } }).EdgeRuntime;
  if (typeof runtime?.waitUntil === "function") {
    runtime.waitUntil(task);
    return;
  }

  task.catch((error) => console.error("Mission Genesis background run failed:", error));
}

async function completeMissionGenesisRun({
  db,
  input,
  runId,
  usageId,
  packet,
  contextAnswers,
  priorCandidate,
}: {
  db: any;
  input: MissionGenesisInput;
  runId: string;
  usageId: string;
  packet: unknown;
  contextAnswers: Array<{ questionKey: string; answer: string }>;
  priorCandidate: Record<string, unknown> | null;
}) {
  try {
    const { output, usage, requestCount } = await callOpenAIMissionGenesis({ packet, contextAnswers, priorCandidate }, input.mode);
    const persisted = await persistDecision(db, input, runId, output);
    await completeManagerRun(db, runId, output, persisted.missionId);
    await completeUsageEvent(db, usageId, usage, requestCount);
  } catch (error) {
    const message = describeError(error, "Mission Genesis failed.");
    await markRunFailedSafe(runId, message);
    await markUsageFailedSafe(usageId, message);
  }
}

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
  const [profile, evidence, musicItems, musicProjects, memory, agentReports, missions, tasks, sources, managerPackets] = await Promise.all([
    selectMany(db, "artist_profiles", "id,display_name,genres,home_market,stage,current_goal,artist_direction,budget_context,social_handles", input, 1),
    selectMany(db, "evidence_items", "id,source,source_kind,evidence_type,subject_type,subject_id,subject_label,metric_name,metric_value,metric_unit,freshness,confidence,provenance,limitation,raw_ref,created_at", input, MISSION_GENESIS_PACKET_LIMITS.evidence),
    selectMany(db, "music_items", "id,title,item_type,lifecycle_stage,released_at,source_kind,source_limit", input, MISSION_GENESIS_PACKET_LIMITS.musicItems),
    selectMany(db, "music_projects", "id,title,project_type,lifecycle_stage,released_at,source_kind,source_limit", input, MISSION_GENESIS_PACKET_LIMITS.musicProjects),
    selectMany(db, "memory_entries", "id,scope,kind,content,source_type,confidence,reason,mission_id,created_at", input, MISSION_GENESIS_PACKET_LIMITS.memory),
    selectMany(db, "agent_reports", "id,agent_key,mission_id,mission_pattern_key,summary,confidence,limitations,finding,evidence_missing,risk_or_opportunity,recommended_internal_action,permission_required,suggested_follow_up,created_at", input, MISSION_GENESIS_PACKET_LIMITS.agentReports),
    selectMany(db, "missions", "id,title,objective,reason,status,priority,progress,summary,pattern_name,current_recommendation,required_evidence,missing_evidence,change_conditions,review_point,created_at", input, MISSION_GENESIS_PACKET_LIMITS.missions),
    selectMany(db, "tasks", "id,mission_id,primary_checkpoint_id,title,owner_role,status,purpose,evidence_needed,completion_expectation,risk_if_late", input, MISSION_GENESIS_PACKET_LIMITS.tasks),
    selectMany(db, "source_connections", "id,provider_id,handle_or_external_ref,status,last_sync_at,next_sync_at,freshness_target,limitations,created_at", input, MISSION_GENESIS_PACKET_LIMITS.sources),
    selectMany(db, "manager_intelligence_packets", "id,packet_type,profile_projection_json,strategic_diagnosis_json,asset_reads_json,market_reads_json,domain_reads_json,public_context_json,open_decisions_json,do_not_do_json,mission_seed_json,created_at", input, 1),
  ]);
  const managerIntelligence = buildManagerIntelligenceMissionContext(managerPackets[0] ?? null);
  const packet = {
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
    evidence: buildMissionEvidenceContext(evidence),
    music: {
      items: boundedValue(musicItems),
      projects: boundedValue(musicProjects),
    },
    memory: boundedValue(memory),
    managerIntelligence: {
      packetId: managerIntelligence.packetId,
      packetType: managerIntelligence.packetType,
      createdAt: managerIntelligence.createdAt,
      managerIntelligenceProfileProjection: managerIntelligence.profileProjection,
      managerIntelligenceMissionSeed: managerIntelligence.missionSeed,
      managerIntelligenceDomainReads: managerIntelligence.domainReads,
      managerIntelligencePublicContext: managerIntelligence.publicContext,
      managerIntelligenceOpenDecisions: managerIntelligence.openDecisions,
      managerIntelligenceDoNotDo: managerIntelligence.doNotDo,
      assetReads: managerIntelligence.assetReads,
      marketReads: managerIntelligence.marketReads,
    },
    recentAgentReports: boundedValue(agentReports),
    existingMissions: boundedValue(missions),
    existingTasks: boundedValue(tasks),
    sources: boundedValue(sources),
    rules: {
      userContextIsNotThirdPartyEvidence: true,
      externalActionsRequirePermission: true,
      noDuplicateActiveMission: true,
      noMissionIsValid: true,
    },
  };

  return {
    ...packet,
    missionPatternRegistry: getMissionPatternRegistry(),
    recommendedMissionPatterns: selectMissionPatternsForPacket(packet as any),
  };
}

function buildManagerIntelligenceMissionContext(row: any) {
  if (!row) {
    return {
      packetId: "",
      packetType: "",
      createdAt: "",
      profileProjection: {},
      strategicDiagnosis: {},
      missionSeed: {},
      assetReads: [],
      marketReads: [],
      domainReads: [],
      publicContext: [],
      openDecisions: [],
      doNotDo: [],
    };
  }

  return {
    packetId: row.id ?? "",
    packetType: row.packet_type ?? "",
    createdAt: row.created_at ?? "",
    profileProjection: boundedValue(row.profile_projection_json),
    strategicDiagnosis: boundedValue(row.strategic_diagnosis_json),
    missionSeed: boundedValue(row.mission_seed_json),
    assetReads: boundedArray(row.asset_reads_json, MISSION_GENESIS_PACKET_LIMITS.managerAssetReads),
    marketReads: boundedArray(row.market_reads_json, MISSION_GENESIS_PACKET_LIMITS.managerMarketReads),
    domainReads: boundedArray(row.domain_reads_json, MISSION_GENESIS_PACKET_LIMITS.managerDomainReads),
    publicContext: boundedArray(row.public_context_json, MISSION_GENESIS_PACKET_LIMITS.managerPublicContext),
    openDecisions: boundedArray(row.open_decisions_json, MISSION_GENESIS_PACKET_LIMITS.managerOpenDecisions),
    doNotDo: boundedArray(row.do_not_do_json, MISSION_GENESIS_PACKET_LIMITS.managerDoNotDo),
  };
}

function buildMissionEvidenceContext(rows: any[]) {
  return rows
    .map((row) => {
      const rawRef = isRecord(row.raw_ref) ? row.raw_ref : {};
      return {
        id: row.id,
        source: row.source,
        sourceKind: row.source_kind,
        kind: row.evidence_type,
        subject: row.subject_label,
        label: row.metric_name,
        value: row.metric_value == null ? "" : `${row.metric_value}${row.metric_unit ? ` ${row.metric_unit}` : ""}`,
        freshness: row.freshness,
        confidence: row.confidence,
        provenance: row.provenance,
        limitation: row.limitation,
        url: typeof rawRef.url === "string" ? rawRef.url : undefined,
        domain: typeof rawRef.domain === "string" ? rawRef.domain : undefined,
      };
    })
    .sort((left, right) => evidencePriority(right) - evidencePriority(left))
    .slice(0, MISSION_GENESIS_PACKET_LIMITS.evidence);
}

function evidencePriority(row: Record<string, unknown>) {
  const text = `${row.kind ?? ""} ${row.label ?? ""} ${row.sourceKind ?? ""}`.toLowerCase();
  let score = 0;
  if (text.includes("rights") || text.includes("split")) score += 9;
  if (text.includes("mission") || text.includes("management")) score += 8;
  if (text.includes("public_web") || text.includes("public")) score += 7;
  if (text.includes("market") || text.includes("city")) score += 6;
  if (text.includes("playlist") || text.includes("shazam") || text.includes("tiktok")) score += 5;
  if (text.includes("monthly") || text.includes("rank") || text.includes("score")) score += 4;
  if (row.url) score += 2;
  if (row.confidence === "high") score += 2;
  if (row.confidence === "medium") score += 1;
  return score;
}

function boundedArray(value: unknown, limit: number) {
  return Array.isArray(value) ? value.slice(0, limit).map((item) => boundedValue(item, MISSION_GENESIS_PACKET_LIMITS.depth - 1)) : [];
}

function boundedValue(value: unknown, depth = MISSION_GENESIS_PACKET_LIMITS.depth): unknown {
  if (typeof value === "string") {
    return value.length > MISSION_GENESIS_PACKET_LIMITS.stringLength
      ? `${value.slice(0, MISSION_GENESIS_PACKET_LIMITS.stringLength)}...`
      : value;
  }
  if (typeof value !== "object" || value === null) return value;
  if (depth <= 0) return Array.isArray(value) ? `[${value.length} items]` : "[object]";
  if (Array.isArray(value)) {
    return value.slice(0, MISSION_GENESIS_PACKET_LIMITS.arrayItems).map((item) => boundedValue(item, depth - 1));
  }

  return Object.fromEntries(
    Object.entries(value)
      .slice(0, MISSION_GENESIS_PACKET_LIMITS.objectKeys)
      .map(([key, item]) => [key, boundedValue(item, depth - 1)]),
  );
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
  const first = await requestOpenAIMissionGenesis(buildMissionGenesisInstructions(mode), context);
  try {
    return {
      output: parseMissionGenesisOutput(first.outputText, context.packet, mode),
      usage: first.usage,
      requestCount: 1,
    };
  } catch (error) {
    const validationError = describeError(error, "OpenAI Mission Genesis returned an invalid structured decision.");
    const repaired = await requestOpenAIMissionGenesis(
      buildMissionGenesisRepairInstructions(mode, validationError),
      { ...context, invalidOutput: first.outputText, validationError },
    );
    try {
      return {
        output: parseMissionGenesisOutput(repaired.outputText, context.packet, mode),
        usage: mergeOpenAIUsage(first.usage, repaired.usage),
        requestCount: 2,
      };
    } catch (secondError) {
      throw secondError;
    }
  }
}

async function requestOpenAIMissionGenesis(instructions: string, context: unknown) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${requireEnv("OPENAI_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: Deno.env.get("OPENAI_MISSION_GENESIS_MODEL") || Deno.env.get("OPENAI_MANAGER_REASONING_MODEL") || Deno.env.get("OPENAI_SUMMARY_MODEL") || "gpt-5.4",
      reasoning: { effort: "high" },
      instructions,
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
    outputText: readOutputText(payload),
    usage: isRecord(payload.usage) ? payload.usage : {},
  };
}

function mergeOpenAIUsage(first: Record<string, unknown>, second: Record<string, unknown>) {
  const firstInput = isRecord(first.input_tokens_details) ? first.input_tokens_details : {};
  const secondInput = isRecord(second.input_tokens_details) ? second.input_tokens_details : {};
  const firstOutput = isRecord(first.output_tokens_details) ? first.output_tokens_details : {};
  const secondOutput = isRecord(second.output_tokens_details) ? second.output_tokens_details : {};
  return {
    input_tokens: (numberOrNull(first.input_tokens) ?? 0) + (numberOrNull(second.input_tokens) ?? 0),
    output_tokens: (numberOrNull(first.output_tokens) ?? 0) + (numberOrNull(second.output_tokens) ?? 0),
    input_tokens_details: {
      cached_tokens: (numberOrNull(firstInput.cached_tokens) ?? 0) + (numberOrNull(secondInput.cached_tokens) ?? 0),
    },
    output_tokens_details: {
      reasoning_tokens: (numberOrNull(firstOutput.reasoning_tokens) ?? 0) + (numberOrNull(secondOutput.reasoning_tokens) ?? 0),
    },
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
      context_payload: buildMissionGenesisRunAudit(input, packet, contextAnswers, priorCandidate),
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

function buildMissionGenesisRunAudit(input: MissionGenesisInput, packet: unknown, contextAnswers: unknown[], priorCandidate: unknown) {
  const record = isRecord(packet) ? packet : {};
  const music = isRecord(record.music) ? record.music : {};
  const managerIntelligence = isRecord(record.managerIntelligence) ? record.managerIntelligence : {};
  return {
    mode: input.mode,
    packetVersion: record.packetVersion ?? "mission_genesis_v2",
    generatedAt: record.generatedAt ?? new Date().toISOString(),
    candidateMissionId: input.candidateMissionId ?? null,
    counts: {
      evidence: arrayLength(record.evidence),
      musicItems: arrayLength(music.items),
      musicProjects: arrayLength(music.projects),
      memory: arrayLength(record.memory),
      agentReports: arrayLength(record.recentAgentReports),
      missions: arrayLength(record.existingMissions),
      tasks: arrayLength(record.existingTasks),
      sources: arrayLength(record.sources),
      recommendedMissionPatterns: arrayLength(record.recommendedMissionPatterns),
    },
    managerIntelligencePacketId: typeof managerIntelligence.packetId === "string" ? managerIntelligence.packetId : "",
    contextAnswers: boundedValue(contextAnswers, 2),
    priorCandidateId: isRecord(priorCandidate) && typeof priorCandidate.id === "string" ? priorCandidate.id : null,
  };
}

function arrayLength(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
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
      model_or_tool: Deno.env.get("OPENAI_MISSION_GENESIS_MODEL") || Deno.env.get("OPENAI_MANAGER_REASONING_MODEL") || Deno.env.get("OPENAI_SUMMARY_MODEL") || "gpt-5.4",
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
  let missionIds: string[] = [];
  let activatedMissionIds: string[] = [];
  let candidateMissionIds: string[] = [];

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

  const shouldPersistMultipleCandidates = !input.candidateMissionId && output.missionCandidates.length > 1;
  if (output.outcome === "update_existing_mission") {
    missionId = output.existingMissionId;
    missionIds = [missionId];
    activatedMissionIds = [missionId];
    const { error } = await db.from("missions").update({
      title: output.mission.title,
      objective: output.mission.objective,
      reason: output.mission.reason,
      summary: output.mission.summary,
      pattern_name: output.mission.patternName,
      status: "active",
      priority: 1,
      current_recommendation: output.mission.currentRecommendation || output.decisionSummary,
      change_conditions: output.mission.changeConditions,
      review_point: output.checkpoints[0]?.title ?? "Manager review",
      required_evidence: unique(output.checkpoints.flatMap((c) => c.requiredEvidence)),
      missing_evidence: unique([...output.evidenceNeeded, ...output.checkpoints.flatMap((c) => c.missingEvidence)]),
      originating_trigger: "manual_mission_genesis_openai",
      updated_at: new Date().toISOString(),
    }).eq("id", missionId).eq("artist_workspace_id", input.artistWorkspaceId);
    if (error) throw error;

    await persistMissionGenesisGraphPlan(db, input, { runId, actionId: action.id }, missionId, output);

    if (output.missionCandidates.length > 0) {
      const allQuestions: MissionGenesisQuestion[] = [];
      for (const [index, candidate] of output.missionCandidates.entries()) {
        if (candidate.key === output.existingMissionId) continue;
        const persistedCandidate = await persistMissionCandidate(db, input, runId, action.id, output, candidate, index);
        if (persistedCandidate.missionId) {
          missionIds.push(persistedCandidate.missionId);
        }
        if (persistedCandidate.outcome === "activate_mission" && persistedCandidate.missionId) {
          activatedMissionIds.push(persistedCandidate.missionId);
        }
        if (persistedCandidate.outcome === "candidate_needs_context" && persistedCandidate.missionId) {
          candidateMissionIds.push(persistedCandidate.missionId);
        }
        allQuestions.push(...persistedCandidate.questions);
      }
      questions = [...output.questions, ...allQuestions];
    }
  } else if (shouldPersistMultipleCandidates) {
    const allQuestions: MissionGenesisQuestion[] = [];
    for (const [index, candidate] of output.missionCandidates.entries()) {
      const persistedCandidate = await persistMissionCandidate(db, input, runId, action.id, output, candidate, index);
      if (persistedCandidate.missionId) {
        missionIds.push(persistedCandidate.missionId);
      }
      if (persistedCandidate.outcome === "activate_mission" && persistedCandidate.missionId) {
        activatedMissionIds.push(persistedCandidate.missionId);
      }
      if (persistedCandidate.outcome === "candidate_needs_context" && persistedCandidate.missionId) {
        candidateMissionIds.push(persistedCandidate.missionId);
      }
      allQuestions.push(...persistedCandidate.questions);
    }
    missionId = activatedMissionIds[0] ?? candidateMissionIds[0] ?? missionIds[0];
    questions = allQuestions;
  } else if (output.outcome === "candidate_needs_context") {
    missionId = await createCandidate(db, input, runId, action.id, output);
    missionIds = [missionId];
    candidateMissionIds = [missionId];
    questions = await persistQuestions(db, missionId, output.questions);
  } else if (output.outcome === "activate_mission") {
    missionId = input.candidateMissionId
      ? await activateCandidate(db, input, runId, action.id, output)
      : await createActiveMission(db, input, runId, action.id, output);
    missionIds = [missionId];
    activatedMissionIds = [missionId];
    await persistMissionGenesisGraphPlan(db, input, { runId, actionId: action.id }, missionId, output);
    await finalizeMissionActivation(db, input, missionId);
  } else if (input.candidateMissionId) {
    const { error } = await db.from("missions").update({
      status: "archived",
      archived_at: new Date().toISOString(),
      current_recommendation: output.decisionSummary,
      updated_at: new Date().toISOString(),
    }).eq("id", input.candidateMissionId).eq("artist_workspace_id", input.artistWorkspaceId).eq("status", "candidate");
    if (error) throw error;
  }

  if (!shouldPersistMultipleCandidates) {
    await writeOperatingEvent(db, input, runId, missionId, output);
  }
  const { error: completeActionError } = await db.from("manager_run_actions").update({
    target_id: missionId || output.existingMissionId || null,
    status: output.outcome === "request_evidence" ? "skipped" : "applied",
    result_payload: { outcome: output.outcome, missionId: missionId ?? null, missionIds, activatedMissionIds, candidateMissionIds, questions },
  }).eq("id", action.id);
  if (completeActionError) throw completeActionError;

  return { missionId, primaryMissionId: missionId, missionIds, activatedMissionIds, candidateMissionIds, questions };
}

async function persistMissionCandidate(
  db: any,
  input: MissionGenesisInput,
  runId: string,
  actionId: string,
  output: MissionGenesisOutput,
  candidate: MissionGenesisCandidate,
  index: number,
) {
  const candidateOutput = outputFromCandidate(output, candidate, index);
  let missionId: string | undefined;
  let questions: MissionGenesisQuestion[] = [];
  if (candidate.outcome === "candidate_needs_context") {
    missionId = await createCandidate(db, input, runId, actionId, candidateOutput);
    questions = await persistQuestions(db, missionId, candidate.questions);
    await writeOperatingEvent(db, input, runId, missionId, candidateOutput);
  } else if (candidate.outcome === "activate_mission") {
    missionId = await createActiveMission(db, input, runId, actionId, candidateOutput);
    await persistMissionGenesisGraphPlan(db, input, { runId, actionId }, missionId, candidateOutput);
    await finalizeMissionActivation(db, input, missionId);
    await writeOperatingEvent(db, input, runId, missionId, candidateOutput);
  }
  return { missionId, questions, outcome: candidate.outcome };
}

function outputFromCandidate(output: MissionGenesisOutput, candidate: MissionGenesisCandidate, index: number): MissionGenesisOutput {
  return {
    ...output,
    outcome: candidate.outcome,
    confidence: candidate.confidence,
    decisionSummary: candidate.mission.summary || output.decisionSummary,
    reasons: candidate.reasons.length ? candidate.reasons : output.reasons,
    evidenceNeeded: candidate.evidenceNeeded,
    existingMissionId: "",
    questions: candidate.questions,
    mission: candidate.mission,
    checkpoints: candidate.checkpoints,
    tasks: candidate.tasks,
    permissionRequests: candidate.permissionRequests,
    missionCandidates: [candidate],
    stage: { ...output.stage, label: `${output.stage.label} candidate ${index + 1}` },
  };
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

async function completeUsageEvent(db: any, usageId: string, usage: Record<string, unknown>, requestCount: number) {
  const inputDetails = isRecord(usage.input_tokens_details) ? usage.input_tokens_details : {};
  const outputDetails = isRecord(usage.output_tokens_details) ? usage.output_tokens_details : {};
  const { error } = await db.from("ai_run_usage_events").update({
    status: "succeeded",
    provider_request_count: requestCount,
    input_tokens: numberOrNull(usage.input_tokens),
    cached_input_tokens: numberOrNull(inputDetails.cached_tokens),
    output_tokens: numberOrNull(usage.output_tokens),
    reasoning_tokens: numberOrNull(outputDetails.reasoning_tokens),
    completed_at: new Date().toISOString(),
  }).eq("id", usageId);
  if (error) throw error;
}

function toViewModel(output: MissionGenesisOutput, persisted: { missionId?: string; primaryMissionId?: string; missionIds?: string[]; activatedMissionIds?: string[]; candidateMissionIds?: string[]; questions: MissionGenesisQuestion[] }) {
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
    ...(persisted.candidateMissionIds?.length ? { candidateMissionIds: persisted.candidateMissionIds } : {}),
    ...(persisted.activatedMissionIds?.length ? { activatedMissionIds: persisted.activatedMissionIds } : {}),
    ...(output.outcome === "candidate_needs_context" ? { candidateMissionId: persisted.candidateMissionIds?.[0] ?? persisted.missionId } : {}),
    ...((output.outcome === "activate_mission" || output.outcome === "update_existing_mission") ? { activatedMissionId: persisted.activatedMissionIds?.[0] ?? persisted.primaryMissionId ?? persisted.missionId } : {}),
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


function mapQuestionFromRow(row: any): MissionGenesisQuestion {
  const key = row.question_key;
  let answerKind: MissionGenesisQuestion["answerKind"] = "short_text";
  let options: string[] = [];
  let reason = "Provide context to activate this mission.";
  let recommendedAnswer = "Use the Manager's recommendation from the current artist context.";
  let recommendationReason = "This is the lowest-friction starting point supported by the information already saved.";

  if (key.endsWith("approve_mission") || key.endsWith("approve")) {
    answerKind = "single_select";
    options = ["Yes, approve", "No, decline"];
    reason = "An explicit decision is required to allocate resources and authorize external outreach.";
    recommendedAnswer = "Yes, approve";
    recommendationReason = "Approval is recommended only when the proposed mission matches the artist's stated objective and boundaries.";
  } else if (key.endsWith("execution_owner") || key.endsWith("owner")) {
    answerKind = "single_select";
    options = ["Artist", "Manager", "Team"];
    reason = "We must assign a single accountable owner to route approvals correctly.";
    recommendedAnswer = "Manager";
    recommendationReason = "The Manager can coordinate the work while keeping final decisions with the artist.";
  } else if (key.endsWith("budget_allocation") || key.endsWith("budget") || key.endsWith("budget_boundary")) {
    answerKind = "money_range";
    reason = "A realistic allocation is required before we create vendor scope and paid media plans.";
    recommendedAnswer = "Use the smallest test budget supported by the saved budget context.";
    recommendationReason = "A bounded test preserves optionality until the mission produces evidence.";
  } else if (key.endsWith("priority_markets") || key.endsWith("markets")) {
    answerKind = "short_text";
    reason = "Specify priority territories (e.g. US, UK, NG) to target curator and social campaigns.";
    recommendedAnswer = "Start with the strongest market already visible in the artist's evidence.";
    recommendationReason = "Existing demand is the most defensible starting point when the artist has not chosen a territory.";
  }

  return {
    key,
    question: row.question,
    reason,
    answerKind,
    options,
    recommendedAnswer,
    recommendationReason,
  };
}
