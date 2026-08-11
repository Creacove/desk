import { markErrorCaptured, withAppErrorCapture } from "../_shared/appFunction.ts";
import { captureAppError } from "../_shared/appError.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  MISSION_GENESIS_PACKET_VERSION,
  MISSION_GENESIS_PROMPT_VERSION,
  MISSION_GENESIS_SCHEMA_VERSION,
  buildMissionGenesisInstructions,
  buildMissionGenesisRepairInstructions,
  missionGenesisJsonSchema,
  parseMissionGenesisOutput,
  type MissionGenesisMode,
  type MissionGenesisOutput,
  type MissionGenesisQuestion,
} from "../_shared/openaiMissionGenesis.ts";
import {
  getMissionPatternRegistry,
  selectMissionPatternsForPacket,
} from "../_shared/mission-patterns/missionPatternRegistry.ts";
import { assertActiveWorkspaceEntitlement } from "../_shared/entitlements.ts";
import {
  claimManagerSynthesisRun,
  finishManagerSynthesisRun,
  heartbeatManagerSynthesisRun,
} from "../_shared/durableWorkflow.ts";

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
  requestKey?: string;
  recoveryRunId?: string;
};

const MISSION_GENESIS_LEASE_SECONDS = 900;

Deno.serve(withAppErrorCapture("mission-genesis", async (request) => {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  let input: MissionGenesisInput | null = null;
  let runId: string | null = null;
  let usageId: string | null = null;
  let leaseToken: string | null = null;
  let workflowDb: any = null;

  try {
    input = (await request.json()) as MissionGenesisInput;
    validateInput(input);

    const authHeader = request.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header." }, 401);

    const supabaseUrl = requireEnv("SUPABASE_URL");
    const anonKey = requireEnv("SUPABASE_ANON_KEY");
    const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const isServiceRoleInvocation = authHeader === `Bearer ${serviceRoleKey}`;
    if (!isServiceRoleInvocation) {
      const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
      const { data: { user }, error: userError } = await authClient.auth.getUser();
      if (userError || !user) return json({ error: "Unauthorized." }, 401);

      const { data: membership, error: membershipError } = await authClient.rpc("is_account_member", { target_account_id: input.accountId });
      if (membershipError) throw membershipError;
      if (!membership) return json({ error: "Forbidden." }, 403);
    }
    if (input.recoveryRunId && !isServiceRoleInvocation) return json({ error: "Forbidden." }, 403);

    const db = createClient(supabaseUrl, serviceRoleKey);
    workflowDb = db;
    if (!isServiceRoleInvocation) await assertActiveWorkspaceEntitlement(db, input);
    await assertWorkspace(db, input);

    if (input.mode === "initial" && !input.recoveryRunId) {
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
      contextAnswers = await prepareContextAnswers(db, input);
    }

    if (input.recoveryRunId) {
      const recoveryRun = await loadRecoveryMissionGenesisRun(db, input, input.recoveryRunId);
      runId = recoveryRun.id;
    } else {
      const identity = await buildMissionGenesisRunIdentity(input, contextAnswers);
      const run = await createManagerRun(db, input, identity, contextAnswers, priorCandidate);
      runId = run.runId;
      if (!run.created) return json({ status: "processing", runId }, 202);
    }

    if (!runId) throw new Error("Mission Genesis run identity is missing.");
    const activeRunId = runId;
    const lease = await claimManagerSynthesisRun(db as any, { runId: activeRunId, leaseSeconds: MISSION_GENESIS_LEASE_SECONDS });
    if (!lease) return json({ status: "processing", runId: activeRunId }, 202);
    leaseToken = lease.token;
    if (input.mode === "continuation") {
      await persistContextAnswers(db, input, activeRunId, contextAnswers);
    }
    const packet = await buildArtistOperatingPacket(db, input);
    await persistMissionGenesisRunAudit(db, input, activeRunId, lease.token, packet, contextAnswers, priorCandidate);
    usageId = await createUsageEvent(db, input, activeRunId);

    scheduleMissionGenesisBackgroundRun(
      completeMissionGenesisRun({
        db,
        input,
        runId: activeRunId,
        usageId,
        leaseToken: lease.token,
        packet,
        contextAnswers,
        priorCandidate,
      }),
    );

    return json({ status: "processing", runId: activeRunId }, 202);
  } catch (error) {
    const message = describeError(error, "Mission Genesis failed.");
    const errorEventId = await captureAppError(error, {
      functionName: "mission-genesis",
      operation: "generate_mission",
      source: "edge",
      publicMessage: "Mission Genesis failed.",
      requestId: request.headers.get("x-request-id") ?? undefined,
      accountId: input?.accountId,
      artistWorkspaceId: input?.artistWorkspaceId,
      artistId: input?.artistId,
      provider: "openai",
      refs: { manager_run_id: runId, usage_event_id: usageId, mission_id: input?.candidateMissionId },
    });
    const failed = runId && leaseToken && workflowDb
      ? await finishManagerSynthesisRun(workflowDb, {
        runId,
        leaseToken,
        status: "failed",
        steps: [{ step: "request_setup", status: "failed" }],
        error: message,
      }).catch(() => false)
      : false;
    if (failed && usageId) await markUsageFailedSafe(usageId, message);
    return markErrorCaptured(json({ error: message, errorEventId }, 500), errorEventId);
  }
}));

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
  leaseToken,
  packet,
  contextAnswers,
  priorCandidate,
}: {
  db: any;
  input: MissionGenesisInput;
  runId: string;
  usageId: string;
  leaseToken: string;
  packet: unknown;
  contextAnswers: Array<{ questionKey: string; answer: string }>;
  priorCandidate: Record<string, unknown> | null;
}) {
  try {
    await heartbeatMissionGenesisLease(db, runId, leaseToken);
    const { output, usage, requestCount } = await callOpenAIMissionGenesis({ packet, contextAnswers, priorCandidate }, input.mode);
    await heartbeatMissionGenesisLease(db, runId, leaseToken);
    await finalizeMissionGenesis(db, input, runId, leaseToken, usageId, output, usage, requestCount);
  } catch (error) {
    const message = describeError(error, "Mission Genesis failed.");
    await captureAppError(error, {
      functionName: "mission-genesis",
      operation: "generate_mission",
      source: "worker",
      publicMessage: "Mission Genesis failed.",
      accountId: input.accountId,
      artistWorkspaceId: input.artistWorkspaceId,
      artistId: input.artistId,
      provider: "openai",
      refs: { manager_run_id: runId, usage_event_id: usageId, mission_id: input.candidateMissionId },
      context: { mode: input.mode, background: true },
    });
    const failed = await finishManagerSynthesisRun(db, {
      runId,
      leaseToken,
      status: "failed",
      steps: [{ step: "packet_built", status: "completed" }, { step: "openai_synthesis", status: "failed" }],
      error: message,
    }).catch(() => false);
    if (failed) await markUsageFailedSafe(usageId, message);
  }
}

function validateInput(input: MissionGenesisInput) {
  if (!input?.accountId || !input.artistWorkspaceId || !input.artistId) throw new Error("Mission Genesis workspace input is incomplete.");
  if (input.mode !== "initial" && input.mode !== "continuation") throw new Error("Mission Genesis mode is invalid.");
  if (input.mode === "continuation") {
    if (!input.candidateMissionId) throw new Error("Mission Genesis continuation requires a candidate mission.");
    if (!Array.isArray(input.answers) || input.answers.length < 2) throw new Error("Mission Genesis continuation requires the complete context answer batch.");
  }
  if (input.requestKey !== undefined && (!input.requestKey.trim() || input.requestKey.length > 128)) {
    throw new Error("Mission Genesis request key is invalid.");
  }
}

async function loadRecoveryMissionGenesisRun(db: any, input: MissionGenesisInput, recoveryRunId: string) {
  const { data, error } = await db.from("manager_synthesis_runs")
    .select("id,status,workflow_version,classification")
    .eq("id", recoveryRunId)
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("artist_id", input.artistId)
    .eq("workflow_version", "mission-genesis-v2")
    .in("classification", ["mission_genesis_v2", "mission_genesis_continue_v2"])
    .in("status", ["queued", "running"])
    .maybeSingle();
  if (error) throw error;
  if (!data?.id) throw new Error("Mission Genesis recovery run does not match the requested owner and mode.");
  const expected = input.mode === "continuation" ? "mission_genesis_continue_v2" : "mission_genesis_v2";
  if (data.classification !== expected) throw new Error("Mission Genesis recovery mode conflicts with the persisted run.");
  return data;
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

async function prepareContextAnswers(db: any, input: MissionGenesisInput) {
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

  return questions.map((question) => ({ questionKey: question.question_key, answer: answerMap.get(question.question_key)! }));
}

async function persistContextAnswers(
  db: any,
  input: MissionGenesisInput,
  runId: string,
  answers: Array<{ questionKey: string; answer: string }>,
) {
  const prefix = questionPrefix(input.candidateMissionId!);
  const { data: questionRows, error: questionError } = await db
    .from("manager_context_questions")
    .select("id,question_key,question")
    .like("question_key", `${prefix}%`)
    .eq("status", "active");
  if (questionError) throw questionError;
  const answerMap = new Map(answers.map((item) => [item.questionKey, item.answer]));

  for (const question of questionRows ?? []) {
    const answer = answerMap.get(question.question_key)!;
    const { data: memory, error: memoryError } = await db
      .from("memory_entries")
      .upsert({
        account_id: input.accountId,
        artist_workspace_id: input.artistWorkspaceId,
        artist_id: input.artistId,
        mission_id: input.candidateMissionId,
        scope: "artist",
        kind: memoryKind(question.question),
        content: `${question.question} ${answer}`,
        source_type: "manager_context_answer",
        source_id: question.id,
        confidence: "high",
        reason: "Saved because this user-controlled context materially affects Mission Genesis decisions.",
        created_from_run_id: runId,
      }, { onConflict: "created_from_run_id,source_type,source_id" })
      .select("id")
      .single();
    if (memoryError) throw memoryError;

    const { data: existingAnswer, error: existingAnswerError } = await db.from("manager_context_answers")
      .select("id")
      .eq("question_id", question.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingAnswerError) throw existingAnswerError;
    const answerWrite = {
      account_id: input.accountId,
      artist_workspace_id: input.artistWorkspaceId,
      artist_id: input.artistId,
      question_id: question.id,
      answer,
      source: "typed",
      memory_entry_id: memory.id,
    };
    const { error: answerError } = existingAnswer?.id
      ? await db.from("manager_context_answers").update(answerWrite).eq("id", existingAnswer.id)
      : await db.from("manager_context_answers").insert(answerWrite);
    if (answerError) throw answerError;
  }
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
    selectMany(db, "tasks", "id,mission_id,primary_checkpoint_id,title,owner_role,work_mode,status,purpose,evidence_needed,completion_expectation,risk_if_late", input, MISSION_GENESIS_PACKET_LIMITS.tasks),
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
  const modelInput = buildMissionGenesisModelInput(context);
  const first = await requestOpenAIMissionGenesis(buildMissionGenesisInstructions(mode), modelInput);
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
      { ...modelInput, invalidOutput: first.outputText, validationError },
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
      model: Deno.env.get("OPENAI_MISSION_GENESIS_MODEL") || Deno.env.get("OPENAI_MANAGER_REASONING_MODEL") || Deno.env.get("OPENAI_SUMMARY_MODEL") || "gpt-5.6-luna",
      reasoning: { effort: "medium" },
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

async function buildMissionGenesisRunIdentity(
  input: MissionGenesisInput,
  contextAnswers: Array<{ questionKey: string; answer: string }>,
) {
  if (input.mode === "continuation") {
    const answerHash = await hashMissionGenesisAnswerBatch(contextAnswers);
    const scopeKey = `${input.candidateMissionId}:${answerHash}`;
    return { scopeKey, idempotencyKey: `mission-genesis:continuation:${scopeKey}` };
  }
  const requestKey = input.requestKey?.trim() || crypto.randomUUID();
  return { scopeKey: `initial:${requestKey}`, idempotencyKey: `mission-genesis:initial:${requestKey}` };
}

function buildMissionGenesisModelInput(
  context: { packet: unknown; contextAnswers: unknown[]; priorCandidate: Record<string, unknown> | null },
) {
  return {
    promptVersion: MISSION_GENESIS_PROMPT_VERSION,
    packetVersion: MISSION_GENESIS_PACKET_VERSION,
    schemaVersion: MISSION_GENESIS_SCHEMA_VERSION,
    groundingContract: {
      VERIFIED_EVIDENCE: "packet.evidence and evidence-backed packet.managerIntelligence",
      USER_CONTEXT: "packet.artist goals and constraints, plus contextAnswers",
      PERSISTED_WORKSPACE_STATE: "remaining packet fields and priorCandidate",
      PERMITTED_INFERENCE: "management judgment derived from supplied packet fields",
      MISSING_OR_STALE_INFORMATION: "packet limitations, freshness, and explicit evidence gaps",
    },
    packet: context.packet,
    contextAnswers: context.contextAnswers,
    priorCandidate: context.priorCandidate,
  };
}

async function hashMissionGenesisAnswerBatch(answers: Array<{ questionKey: string; answer: string }>) {
  const canonical = [...answers]
    .sort((left, right) => left.questionKey.localeCompare(right.questionKey))
    .map(({ questionKey, answer }) => [questionKey.trim(), answer.trim()]);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(canonical)));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function createManagerRun(
  db: any,
  input: MissionGenesisInput,
  identity: { scopeKey: string; idempotencyKey: string },
  contextAnswers: unknown[],
  priorCandidate: unknown,
) {
  const { data, error } = await db
    .from("manager_synthesis_runs")
    .insert({
      account_id: input.accountId,
      artist_workspace_id: input.artistWorkspaceId,
      artist_id: input.artistId,
      trigger_type: "mission",
      mission_id: input.candidateMissionId ?? null,
      status: "queued",
      classification: input.mode === "continuation" ? "mission_genesis_continue_v2" : "mission_genesis_v2",
      confidence: "unknown",
      context_payload: {
        promptVersion: MISSION_GENESIS_PROMPT_VERSION,
        packetVersion: MISSION_GENESIS_PACKET_VERSION,
        schemaVersion: MISSION_GENESIS_SCHEMA_VERSION,
        mode: input.mode,
        candidateMissionId: input.candidateMissionId ?? null,
        contextAnswers,
        priorCandidateId: isRecord(priorCandidate) ? priorCandidate.id ?? null : null,
      },
      steps_payload: [{ step: "queued", status: "completed" }],
      action_plan: [],
      limitations: [],
      workflow_version: "mission-genesis-v2",
      input_refs: input.candidateMissionId ? [{ type: "mission", id: input.candidateMissionId }] : [{ type: "artist", id: input.artistId }],
      scope_key: identity.scopeKey,
      idempotency_key: identity.idempotencyKey,
    })
    .select("id,status")
    .single();
  if (!error && data?.id) return { runId: data.id as string, status: data.status as string, created: true };
  if (error?.code === "23505") {
    const { data: existing, error: existingError } = await db.from("manager_synthesis_runs")
      .select("id,status")
      .eq("account_id", input.accountId)
      .eq("artist_workspace_id", input.artistWorkspaceId)
      .eq("idempotency_key", identity.idempotencyKey)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing?.id) return { runId: existing.id as string, status: existing.status as string, created: false };
  }
  throw error ?? new Error("Mission Genesis run could not be queued.");
}

async function persistMissionGenesisRunAudit(
  db: any,
  input: MissionGenesisInput,
  runId: string,
  leaseToken: string,
  packet: unknown,
  contextAnswers: unknown[],
  priorCandidate: unknown,
) {
  const { data, error } = await db.from("manager_synthesis_runs").update({
    context_payload: buildMissionGenesisRunAudit(input, packet, contextAnswers, priorCandidate),
    steps_payload: [{ step: "packet_built", status: "completed" }, { step: "openai_synthesis", status: "running" }],
  }).eq("id", runId).eq("lease_token", leaseToken).gt("lease_expires_at", new Date().toISOString()).select("id").maybeSingle();
  if (error) throw error;
  if (!data?.id) throw new Error("Mission Genesis lease is no longer active.");
}

function buildMissionGenesisRunAudit(input: MissionGenesisInput, packet: unknown, contextAnswers: unknown[], priorCandidate: unknown) {
  const record = isRecord(packet) ? packet : {};
  const music = isRecord(record.music) ? record.music : {};
  const managerIntelligence = isRecord(record.managerIntelligence) ? record.managerIntelligence : {};
  return {
    mode: input.mode,
    promptVersion: MISSION_GENESIS_PROMPT_VERSION,
    packetVersion: MISSION_GENESIS_PACKET_VERSION,
    schemaVersion: MISSION_GENESIS_SCHEMA_VERSION,
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
      model_or_tool: Deno.env.get("OPENAI_MISSION_GENESIS_MODEL") || Deno.env.get("OPENAI_MANAGER_REASONING_MODEL") || Deno.env.get("OPENAI_SUMMARY_MODEL") || "gpt-5.6-luna",
      operation_key: input.mode === "continuation" ? "mission_genesis_continue_v2" : "mission_genesis_initial_v2",
      status: "started",
      provider_request_count: 1,
      metadata: { mode: input.mode },
    })
    .select("id")
    .single();
  if (error?.code === "23505") {
    const { data: existing, error: existingError } = await db.from("ai_run_usage_events")
      .select("id")
      .eq("manager_synthesis_run_id", runId)
      .in("operation_key", ["mission_genesis_initial_v2", "mission_genesis_continue_v2"])
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing?.id) return existing.id as string;
  }
  if (error) throw error;
  return data.id as string;
}

async function heartbeatMissionGenesisLease(db: any, runId: string, leaseToken: string) {
  const active = await heartbeatManagerSynthesisRun(db, {
    runId,
    leaseToken,
    leaseSeconds: MISSION_GENESIS_LEASE_SECONDS,
  });
  if (!active) throw new Error("Mission Genesis lease is no longer active.");
}

async function finalizeMissionGenesis(
  db: any,
  input: MissionGenesisInput,
  runId: string,
  leaseToken: string,
  usageId: string,
  output: MissionGenesisOutput,
  usage: Record<string, unknown>,
  requestCount: number,
) {
  const inputDetails = isRecord(usage.input_tokens_details) ? usage.input_tokens_details : {};
  const outputDetails = isRecord(usage.output_tokens_details) ? usage.output_tokens_details : {};
  const { error } = await db.rpc("finalize_mission_genesis_v2", {
    run_id: runId,
    current_lease_token: leaseToken,
    usage_id: usageId,
    result_output: output,
    actual_provider_request_count: requestCount,
    actual_input_tokens: numberOrNull(usage.input_tokens) ?? 0,
    actual_cached_input_tokens: numberOrNull(inputDetails.cached_tokens) ?? 0,
    actual_output_tokens: numberOrNull(usage.output_tokens) ?? 0,
    actual_reasoning_tokens: numberOrNull(outputDetails.reasoning_tokens) ?? 0,
  });
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

function compact(values: unknown[]) {
  return values.filter((value): value is string => typeof value === "string" && Boolean(value.trim())).map((value) => value.trim());
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
