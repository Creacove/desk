type ManagerConversationContextInput = {
  accountId: string;
  artistWorkspaceId: string;
  artistId: string;
  taskId?: string;
  musicSubject?: { type: "music_item" | "music_project"; id: string };
  body: string;
  contextRequestId?: string;
  contextAnswers?: unknown;
};

type ManagerFailure = { publicMessage: string; internalMessage: string };

const MAX_OPENING_BRIEF_BYTES = 48_000;
const encoder = new TextEncoder();

export function buildManagerConversationModelContext(
  input: ManagerConversationContextInput,
  packet: unknown,
  conversationId: string,
  previousResponseId = "",
) {
  const common = {
    scope: {
      accountId: input.accountId,
      artistWorkspaceId: input.artistWorkspaceId,
      artistId: input.artistId,
      conversationId,
      taskId: input.taskId ?? "",
      musicSubject: compactMusicSubjectPointer(input.musicSubject),
    },
    userMessage: compactText(input.body, 6_000),
    contextRequestId: compactText(input.contextRequestId ?? "", 160),
    contextAnswers: normalizeContextAnswers(input.contextAnswers),
  };
  if (previousResponseId) return common;
  return { ...common, openingBrief: compactOpeningPacket(packet) };
}

export function classifyManagerConversationError(
  error: unknown,
  fallback = "Manager could not complete that request. Your conversation and drafts are safe; try again.",
): ManagerFailure {
  const internalMessage = readErrorMessage(error, fallback);
  const normalized = internalMessage.toLowerCase();
  if (/thread killed by timeout manager|postgrest.*timeout|pgrst.*timeout|database worker/.test(normalized)) {
    return { publicMessage: "Manager is temporarily unable to reach your workspace. Please try again in a moment.", internalMessage };
  }
  if (/status 429|rate.limit/.test(normalized)) {
    if (/request too large|context length|context window|maximum context|too many tokens/.test(normalized)) {
      return { publicMessage: "This Manager session is larger than it can safely process right now. Start a focused follow-up or try again after the workspace refreshes.", internalMessage };
    }
    return { publicMessage: "Manager is briefly busy. Please try again in a moment.", internalMessage };
  }
  return { publicMessage: fallback, internalMessage };
}

function compactOpeningPacket(packet: unknown) {
  const source = record(packet);
  const latestIntelligence = record(source.latestManagerIntelligencePacket);
  const canonicalState = findCanonicalStateSnapshot(source.memory);
  const canonicalMissions = array(canonicalState.activeMissions);
  const canonicalTasks = array(canonicalState.activeTasks);
  const focusedPointer = compactMusicSubjectPointer(record(source.focusedMusicSubject));
  const managerKnowledge = compactManagerKnowledge(
    findManagerKnowledgeSnapshot(source.memory, latestIntelligence),
    focusedPointer,
  );
  const openingBrief = {
    version: "manager_opening_brief_v5",
    truthPriority: [
      "canonicalState is the current durable product truth and overrides older conversation messages, durable memory, superseded plans, superseded Tasks, and derived Manager reads when they conflict",
      "managerKnowledge is current canonical semantic understanding plus current operating reality; use it before deciding, planning, reviewing, or asking the artist for context",
      "artist-confirmed semantic understanding in managerKnowledge outranks supported or inferred interpretations and derived Manager Reads",
      "focusedMusicSubject is freshly loaded structured product state for the current song or project and overrides historical conversation claims about that subject",
      "managerKnowledge is focus-scoped: artist-level understanding plus understanding for the focused song/project; never borrow semantic meaning from another music asset",
      "activeMissions and activeTasks come from the current active Mission plan when canonicalState is available; never revive completed, rejected, archived, or superseded work from conversation history",
      "resolved decisions in canonicalState remain resolved: approved, rejected, executed, failed, indeterminate, superseded, or revoked state must not be presented as a new pending decision unless canonical state has materially changed",
      "fresh operatingFacts in canonicalState and operatingReality in managerKnowledge are already known; do not ask the artist to provide or reconfirm them while they remain valid",
      "conversationHistory and durableMemory are historical context, not authority against newer canonical product state",
      "Manager Read and intelligence summaries are derived analysis and can be stale",
    ],
    canonicalState: compactCanonicalState(canonicalState),
    managerKnowledge,
    artist: compactArtist(source.artist),
    focusedMusicSubject: compactFocusedMusicSubject(source.focusedMusicSubject),
    taskContext: compactTask(source.taskContext),
    conversationHistory: compactConversationHistory(source.conversationHistory),
    durableMemory: compactMemoryList(
      array(source.memory).filter((item) => {
        const sourceType = compactText(record(item).source_type, 120);
        return sourceType !== "manager_canonical_state_v1" && sourceType !== "canonical_release_plan" && sourceType !== "manager_knowledge_v1";
      }),
      6,
    ),
    evidence: compactEvidenceList(source.evidence, 8),
    music: compactMusic(source.music),
    activeMissions: compactMissionList(canonicalMissions.length ? canonicalMissions : activeMissionFallback(source.existingMissions), 8),
    activeTasks: compactTaskList(canonicalTasks.length ? canonicalTasks : activeTaskFallback(source.existingTasks), 12),
    recentAgentReports: compactAgentReportList(source.recentAgentReports, 4),
    intelligenceSummary: {
      packetType: compactText(latestIntelligence.packet_type, 120),
      strategicDiagnosis: compactJson(latestIntelligence.strategic_diagnosis_json, 2_500),
      missionSeed: compactJson(latestIntelligence.mission_seed_json, 2_000),
    },
    activePlaybookKeys: compactStringList(source.activePlaybookKeys, 8, 80),
    recommendedMissionPatterns: compactPatternList(source.recommendedMissionPatterns, 4),
    rules: compactRules(source.rules),
  };
  return enforceByteBudget(openingBrief, MAX_OPENING_BRIEF_BYTES);
}

function findCanonicalStateSnapshot(memoryValue: unknown) {
  for (const item of array(memoryValue)) {
    const row = record(item);
    if (row.source_type !== "manager_canonical_state_v1") continue;
    const content = typeof row.content === "string" ? row.content.trim() : "";
    if (!content) continue;
    try {
      const parsed = JSON.parse(content);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) continue;
      const snapshot = parsed as Record<string, unknown>;
      if (snapshot.projectionVersion !== "manager_canonical_state_v1") continue;
      return snapshot;
    } catch {
      continue;
    }
  }
  return {} as Record<string, unknown>;
}

function findManagerKnowledgeSnapshot(memoryValue: unknown, latestIntelligence: Record<string, unknown>) {
  for (const item of array(memoryValue)) {
    const row = record(item);
    if (row.source_type !== "manager_knowledge_v1") continue;
    const content = typeof row.content === "string" ? row.content.trim() : "";
    if (!content) continue;
    try {
      const parsed = JSON.parse(content);
      if (record(parsed).contractVersion === "manager-knowledge-v1") return parsed;
    } catch {
      continue;
    }
  }
  const profileProjection = record(latestIntelligence.profile_projection_json);
  const fromPacket = record(profileProjection.managerKnowledge);
  return fromPacket.contractVersion === "manager-knowledge-v1" ? fromPacket : {};
}

function compactManagerKnowledge(value: unknown, focused: { type: "music_item" | "music_project"; id: string } | null) {
  const knowledge = record(value);
  const semantic = array(knowledge.semanticUnderstanding).filter((item) => {
    const row = record(item);
    const scopeType = compactText(row.scopeType ?? row.scope_type, 80);
    const scopeId = compactText(row.scopeId ?? row.scope_id, 120);
    if (scopeType === "artist") return true;
    if (!focused) return false;
    return scopeType === focused.type && scopeId === focused.id;
  }).slice(0, 24).map((item) => {
    const row = record(item);
    return {
      id: compactText(row.id, 120),
      scopeType: compactText(row.scopeType ?? row.scope_type, 80),
      scopeId: compactText(row.scopeId ?? row.scope_id, 120),
      key: compactText(row.key ?? row.understanding_key, 180),
      category: compactText(row.category, 120),
      statement: compactText(row.statement, 900),
      confidence: compactText(row.confidence, 80),
      authority: compactText(row.authority, 80),
      sourceKind: compactText(row.sourceKind ?? row.source_kind, 120),
      sourceRef: compactText(row.sourceRef ?? row.source_ref, 300),
      updatedAt: compactText(row.updatedAt ?? row.updated_at, 120),
    };
  });
  const operating = array(knowledge.operatingReality).slice(0, 30).map((item) => {
    const row = record(item);
    return {
      id: compactText(row.id, 120),
      domain: compactText(row.domain, 80),
      key: compactText(row.key ?? row.fact_key, 180),
      scopeType: compactText(row.scopeType ?? row.scope_type, 80),
      scopeKey: compactText(row.scopeKey ?? row.scope_key, 180),
      displayValue: compactText(row.displayValue ?? row.display_value, 700),
      value: compactStructured(row.value ?? row.value_json, 1_500),
      confidence: compactText(row.confidence, 80),
      validUntil: compactText(row.validUntil ?? row.valid_until, 120),
    };
  });
  return {
    contractVersion: semantic.length || operating.length ? "manager-knowledge-v1" : "",
    semanticUnderstanding: semantic,
    operatingReality: operating,
    rules: [
      "Use relevant current semantic understanding and operating reality before asking the artist or choosing work.",
      "Artist-confirmed semantic understanding outranks supported/inferred interpretation.",
      "Do not let meaning from another song/project leak into the focused subject.",
    ],
  };
}

function compactCanonicalState(value: unknown) {
  const state = record(value);
  return {
    projectionVersion: compactText(state.projectionVersion, 120),
    generatedAt: compactText(state.generatedAt, 120),
    operatingFacts: array(state.operatingFacts).slice(0, 30).map((item) => {
      const row = record(item);
      return {
        id: compactText(row.id, 120),
        domain: compactText(row.domain, 80),
        factKey: compactText(row.factKey, 180),
        scopeType: compactText(row.scopeType, 80),
        scopeKey: compactText(row.scopeKey, 180),
        displayValue: compactText(row.displayValue, 700),
        value: compactStructured(row.value, 1_500),
        confidence: compactText(row.confidence, 80),
        validUntil: compactText(row.validUntil, 120),
      };
    }),
    questionHistory: array(state.questionHistory).slice(0, 16).map((item) => {
      const row = record(item);
      return {
        id: compactText(row.id, 120),
        missionId: compactText(row.missionId, 120),
        taskId: compactText(row.taskId, 120),
        questionKey: compactText(row.questionKey, 180),
        status: compactText(row.status, 80),
        factKey: compactText(row.factKey, 180),
        scopeKey: compactText(row.factScopeKey, 180),
        answer: compactText(row.answer, 700),
        expiresAt: compactText(row.expiresAt, 120),
      };
    }),
    decisions: array(state.decisions).slice(0, 16).map((item) => {
      const row = record(item);
      return {
        kind: compactText(row.kind, 80),
        id: compactText(row.id, 120),
        missionId: compactText(row.missionId, 120),
        taskId: compactText(row.taskId, 120),
        requestType: compactText(row.requestType, 120),
        title: compactText(row.title, 300),
        status: compactText(row.status, 100),
        parameters: compactStructured(row.parameters, 2_000),
      };
    }),
    managerActions: array(state.managerActions).slice(0, 16).map((item) => {
      const row = record(item);
      return {
        id: compactText(row.id, 120),
        actionType: compactText(row.actionType, 180),
        targetType: compactText(row.targetType, 120),
        targetId: compactText(row.targetId, 120),
        status: compactText(row.status, 100),
        approvalRequired: Boolean(row.approvalRequired),
        result: compactStructured(row.result, 1_500),
        error: compactText(row.error, 500),
      };
    }),
  };
}

function compactFocusedMusicSubject(value: unknown) {
  const subject = record(value);
  const type = subject.type === "music_item" || subject.type === "music_project" ? subject.type : "";
  const id = compactText(subject.id, 120);
  if (!type || !id) return null;
  const metadata = record(subject.metadata);
  return {
    type,
    id,
    title: compactText(subject.title, 240),
    kind: compactText(subject.kind, 120),
    lifecycleStage: compactText(subject.lifecycleStage ?? subject.lifecycle_stage, 120),
    releasedAt: compactText(subject.releasedAt ?? subject.released_at, 120),
    sourceKind: compactText(subject.sourceKind ?? subject.source_kind, 120),
    sourceLimit: compactText(subject.sourceLimit ?? subject.source_limit, 600),
    metadata: compactStructured(metadata, 8_000),
    identifiers: array(subject.identifiers).slice(0, 24).map((item) => {
      const row = record(item);
      return {
        id: compactText(row.id, 120),
        type: compactText(row.type ?? row.identifierType ?? row.identifier_type, 120),
        value: compactText(row.value ?? row.identifierValue ?? row.identifier_value, 500),
        confidence: compactText(row.confidence, 80),
      };
    }),
    credits: array(subject.credits).slice(0, 32).map((item) => {
      const row = record(item);
      return {
        id: compactText(row.id, 120),
        contributorId: compactText(row.contributorId ?? row.contributor_id, 120),
        role: compactText(row.role, 160),
        name: compactText(row.name ?? row.displayName ?? row.display_name, 240),
        status: compactText(row.status, 100),
      };
    }),
    assets: array(subject.assets).slice(0, 24).map((item) => {
      const asset = record(item);
      return {
        id: compactText(asset.id, 120),
        assetType: compactText(asset.assetType ?? asset.asset_type, 120),
        title: compactText(asset.title, 240),
        status: compactText(asset.status, 120),
        uploadedFileId: compactText(asset.uploadedFileId ?? asset.uploaded_file_id, 120),
        updatedAt: compactText(asset.updatedAt ?? asset.updated_at ?? asset.createdAt ?? asset.created_at, 120),
      };
    }),
    documents: array(subject.documents).slice(0, 24).map((item) => {
      const document = record(item);
      return {
        id: compactText(document.id, 120),
        title: compactText(document.title, 240),
        documentType: compactText(document.documentType ?? document.document_type, 160),
        status: compactText(document.status, 120),
        summary: compactText(document.summary, 600),
        updatedAt: compactText(document.updatedAt ?? document.updated_at ?? document.createdAt ?? document.created_at, 120),
      };
    }),
    rights: compactFocusedRights(subject.rights),
    contributors: array(subject.contributors).slice(0, 32).map(compactContributor),
    splitConfirmations: array(subject.splitConfirmations ?? subject.split_confirmations).slice(0, 32).map((item) => {
      const row = record(item);
      return {
        id: compactText(row.id, 120),
        contributorId: compactText(row.contributorId ?? row.contributor_id ?? row.music_split_contributor_id, 120),
        status: compactText(row.status, 100),
        confirmedAt: compactText(row.confirmedAt ?? row.confirmed_at, 120),
      };
    }),
    recentActivity: array(subject.recentActivity).slice(0, 10).map((item) => {
      const row = record(item);
      return {
        eventType: compactText(row.eventType ?? row.event_type, 160),
        summary: compactText(row.summary, 500),
        createdAt: compactText(row.createdAt ?? row.created_at, 120),
      };
    }),
    managerRead: compactFocusedManagerRead(subject.managerRead),
  };
}

function compactContributor(value: unknown) {
  const row = record(value);
  return {
    id: compactText(row.id ?? row.contributorId ?? row.contributor_id, 120),
    name: compactText(row.name ?? row.displayName ?? row.display_name, 240),
    email: compactText(row.email, 240),
    role: compactText(row.role, 160),
    roles: compactStringList(row.roles, 10, 160),
    publishingShare: numberOrText(row.publishingShare ?? row.publishing_share, 80),
    masterShare: numberOrText(row.masterShare ?? row.master_share, 80),
    approval: compactText(row.approval ?? row.approvalStatus ?? row.approval_status, 120),
  };
}

function compactFocusedRights(value: unknown) {
  const rights = record(value);
  if (!Object.keys(rights).length) return null;
  return {
    status: compactText(rights.status, 120),
    publishingTotal: numberOrText(rights.publishingTotal ?? rights.publishing_total, 80),
    masterTotal: numberOrText(rights.masterTotal ?? rights.master_total, 80),
    summary: compactText(rights.summary, 700),
    documentAssetId: compactText(rights.documentAssetId ?? rights.document_asset_id, 120),
    contributors: array(rights.contributors).slice(0, 32).map(compactContributor),
  };
}

function compactFocusedManagerRead(value: unknown) {
  const row = record(value);
  if (!Object.keys(row).length) return null;
  return {
    id: compactText(row.id, 120),
    summary: compactText(row.summary, 1_500),
    recommendation: compactText(row.recommendation, 2_000),
    createdAt: compactText(row.createdAt ?? row.created_at, 120),
  };
}

function compactArtist(value: unknown) {
  const row = record(value);
  return {
    id: compactText(row.id, 120),
    name: compactText(row.name, 200),
    stage: compactText(row.stage, 120),
    goals: compactStringList(row.goals, 6, 500),
    genres: compactStringList(row.genres, 8, 120),
    homeMarket: compactText(row.homeMarket, 200),
    budgetContext: compactText(row.budgetContext, 1_000),
  };
}

function compactMusic(value: unknown) {
  const row = record(value);
  return { items: compactCatalogList(row.items, 8), projects: compactCatalogList(row.projects, 6) };
}

function compactCatalogList(value: unknown, limit: number) {
  return array(value).slice(0, limit).map((item) => {
    const row = record(item);
    return {
      id: compactText(row.id, 120),
      title: compactText(row.title, 240),
      type: compactText(row.item_type ?? row.project_type ?? row.type, 120),
      lifecycleStage: compactText(row.lifecycle_stage ?? row.lifecycleStage, 120),
      releasedAt: compactText(row.released_at ?? row.releasedAt, 120),
    };
  });
}

function compactEvidenceList(value: unknown, limit: number) {
  return array(value).slice(0, limit).map((item) => {
    const row = record(item);
    return {
      id: compactText(row.id, 120),
      source: compactText(row.source, 160),
      kind: compactText(row.kind ?? row.evidence_type, 120),
      subjectId: compactText(row.subjectId ?? row.subject_id, 120),
      subject: compactText(row.subject ?? row.subject_label, 240),
      value: compactText(row.value ?? row.metric_value, 500),
      freshness: compactText(row.freshness, 120),
      confidence: compactText(row.confidence, 120),
      provenance: compactText(row.provenance, 500),
      limitation: compactText(row.limitation, 500),
    };
  });
}

function compactMemoryList(value: unknown, limit: number) {
  return array(value).slice(0, limit).map((item) => {
    const row = record(item);
    return {
      id: compactText(row.id, 120),
      scope: compactText(row.scope, 120),
      kind: compactText(row.kind, 120),
      content: compactText(row.content, 1_000),
      confidence: compactText(row.confidence, 120),
      reason: compactText(row.reason, 400),
    };
  });
}

function activeMissionFallback(value: unknown) {
  const terminal = new Set(["complete", "archived", "cancelled"]);
  return array(value).filter((item) => !terminal.has(compactText(record(item).status, 80).toLowerCase()));
}

function activeTaskFallback(value: unknown) {
  const terminal = new Set(["completed", "rejected", "archived", "superseded"]);
  return array(value).filter((item) => !terminal.has(compactText(record(item).status, 80).toLowerCase()));
}

function compactMissionList(value: unknown, limit: number) { return array(value).slice(0, limit).map(compactMission); }
function compactMission(value: unknown) {
  const row = record(value);
  return {
    id: compactText(row.id, 120),
    title: compactText(row.title, 240),
    objective: compactText(row.objective, 900),
    status: compactText(row.status, 120),
    progress: numberOrEmpty(row.progress),
    summary: compactText(row.summary, 800),
    currentRecommendation: compactText(row.current_recommendation ?? row.currentRecommendation, 800),
    activePlanVersionId: compactText(row.activePlanVersionId ?? row.active_plan_version_id, 120),
  };
}

function compactTaskList(value: unknown, limit: number) { return array(value).slice(0, limit).map(compactTask); }
function compactTask(value: unknown) {
  const row = record(value);
  return {
    id: compactText(row.id, 120),
    missionId: compactText(row.mission_id ?? row.missionId, 120),
    missionPlanVersionId: compactText(row.mission_plan_version_id ?? row.missionPlanVersionId, 120),
    title: compactText(row.title, 240),
    status: compactText(row.status, 120),
    approvalState: compactText(row.approval_state ?? row.approvalState, 120),
    workMode: compactText(row.work_mode ?? row.workMode, 120),
    purpose: compactText(row.purpose, 700),
    managerResponsibility: compactText(row.manager_responsibility ?? row.managerResponsibility, 600),
    userResponsibility: compactText(row.user_responsibility ?? row.userResponsibility, 600),
  };
}

function compactAgentReportList(value: unknown, limit: number) {
  return array(value).slice(0, limit).map((item) => {
    const row = record(item);
    return {
      id: compactText(row.id, 120),
      agentKey: compactText(row.agent_key ?? row.agentKey, 120),
      summary: compactText(row.summary, 800),
      finding: compactText(row.finding, 800),
    };
  });
}

function compactConversationHistory(value: unknown) {
  return array(value).slice(-6).map((item) => {
    const row = record(item);
    return {
      id: compactText(row.id, 120),
      speaker: compactText(row.speaker, 40),
      body: compactText(row.body, 1_500),
      createdAt: compactText(row.created_at ?? row.createdAt, 80),
    };
  });
}

function compactPatternList(value: unknown, limit: number) {
  return array(value).slice(0, limit).map((item) => {
    const row = record(item);
    return {
      key: compactText(row.key ?? row.patternName ?? row.name, 160),
      name: compactText(row.name ?? row.patternName, 200),
      summary: compactText(row.summary ?? row.description, 600),
    };
  });
}

function compactRules(value: unknown) {
  const rules = record(value);
  return {
    userContextIsNotThirdPartyEvidence: Boolean(rules.userContextIsNotThirdPartyEvidence),
    externalActionsRequirePermission: Boolean(rules.externalActionsRequirePermission),
    noSeparateEvidenceReadSection: Boolean(rules.noSeparateEvidenceReadSection),
    createdWorkMustBeConcrete: Boolean(rules.createdWorkMustBeConcrete),
  };
}

function compactMusicSubjectPointer(value: unknown): { type: "music_item" | "music_project"; id: string } | null {
  const subject = record(value);
  const type = subject.type === "music_item" || subject.type === "music_project" ? subject.type : "";
  const id = compactText(subject.id, 120);
  return type && id ? { type, id } : null;
}

function normalizeContextAnswers(value: unknown) {
  return array(value).slice(0, 8).map((item) => {
    const answer = record(item);
    return {
      questionKey: compactText(answer.questionKey, 160),
      answer: compactText(answer.answer, 2_000),
    };
  }).filter((item) => item.questionKey && item.answer);
}

function enforceByteBudget<T extends Record<string, any>>(value: T, maxBytes: number): T {
  if (encoder.encode(JSON.stringify(value)).byteLength <= maxBytes) return value;
  const compacted = {
    version: "manager_opening_brief_v5_compact",
    notice: "Secondary context was compacted. canonicalState, managerKnowledge and current focused-subject truth remain authoritative over historical conversation and memory.",
    truthPriority: value.truthPriority,
    canonicalState: value.canonicalState,
    managerKnowledge: value.managerKnowledge,
    artist: value.artist,
    focusedMusicSubject: value.focusedMusicSubject,
    taskContext: value.taskContext,
    conversationHistory: array(value.conversationHistory).slice(-3),
    durableMemory: array(value.durableMemory).slice(0, 3),
    activeMissions: array(value.activeMissions).slice(0, 4),
    activeTasks: array(value.activeTasks).slice(0, 6),
    activePlaybookKeys: value.activePlaybookKeys,
    rules: value.rules,
  } as unknown as T;
  return compacted;
}

function compactStructured(value: unknown, maxChars: number) {
  if (value == null) return {};
  try {
    const serialized = JSON.stringify(value);
    if (serialized.length <= maxChars) return value;
    return { compacted: true, summary: serialized.slice(0, maxChars) };
  } catch {
    return {};
  }
}

function compactJson(value: unknown, maxChars: number) {
  if (value == null) return "";
  try { return compactText(JSON.stringify(value), maxChars); } catch { return ""; }
}

function compactStringList(value: unknown, limit: number, maxChars: number) {
  return array(value).slice(0, limit).map((item) => compactText(item, maxChars)).filter(Boolean);
}

function compactText(value: unknown, maxChars: number) {
  const text = typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
  return text.length > maxChars ? `${text.slice(0, Math.max(0, maxChars - 1))}…` : text;
}

function numberOrText(value: unknown, maxLength: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : compactText(value, maxLength);
}
function numberOrEmpty(value: unknown) { return typeof value === "number" && Number.isFinite(value) ? value : ""; }
function array(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function readErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  if (error && typeof error === "object" && !Array.isArray(error)) {
    const source = error as Record<string, unknown>;
    const parts = [["code", source.code], ["status", source.status], ["message", source.message], ["details", source.details], ["hint", source.hint]].flatMap(([label, item]) => {
      if (typeof item !== "string" && typeof item !== "number") return [];
      const text = String(item).trim();
      return text ? [`${label}=${text}`] : [];
    });
    if (parts.length) return parts.join(" | ");
  }
  return fallback;
}