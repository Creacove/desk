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

type ManagerFailure = {
  publicMessage: string;
  internalMessage: string;
};

const MAX_OPENING_BRIEF_BYTES = 80_000;
const encoder = new TextEncoder();

export function buildManagerConversationModelContext(
  input: ManagerConversationContextInput,
  packet: unknown,
  conversationId: string,
  previousResponseId = "",
) {
  const scope = {
    accountId: input.accountId,
    artistWorkspaceId: input.artistWorkspaceId,
    artistId: input.artistId,
    conversationId,
    taskId: input.taskId ?? "",
    musicSubject: compactMusicSubjectPointer(input.musicSubject),
  };
  const message = compactText(input.body, 6_000);
  const common = {
    scope,
    userMessage: message,
    contextRequestId: compactText(input.contextRequestId ?? "", 160),
    contextAnswers: normalizeContextAnswers(input.contextAnswers),
  };
  if (previousResponseId) return common;
  return {
    ...common,
    openingBrief: compactOpeningPacket(packet),
  };
}

export function classifyManagerConversationError(error: unknown, fallback = "Manager could not complete that request. Your conversation and drafts are safe; try again."): ManagerFailure {
  const internalMessage = readErrorMessage(error, fallback);
  const normalized = internalMessage.toLowerCase();
  if (/status 429|rate.limit/.test(normalized)) {
    if (/request too large|tokens per min|token limit|context length|context window|too many tokens/.test(normalized)) {
      return {
        publicMessage: "This Manager session is larger than it can safely process right now. Start a focused follow-up or try again after the workspace refreshes.",
        internalMessage,
      };
    }
    return { publicMessage: "Manager is briefly busy. Please try again in a moment.", internalMessage };
  }
  return { publicMessage: fallback, internalMessage };
}

function compactOpeningPacket(packet: unknown) {
  const source = record(packet);
  const latestIntelligence = record(source.latestManagerIntelligencePacket);
  const openingBrief = {
    version: "manager_opening_brief_v1",
    artist: compactArtist(source.artist),
    taskContext: compactTask(source.taskContext),
    focusedMusicSubject: compactFocusedMusicSubject(source.focusedMusicSubject),
    evidence: compactEvidenceList(source.evidence, 8),
    music: compactMusic(source.music),
    durableMemory: compactMemoryList(source.memory, 6),
    activeMissions: compactMissionList(source.existingMissions, 6),
    activeTasks: compactTaskList(source.existingTasks, 8),
    recentAgentReports: compactAgentReportList(source.recentAgentReports, 4),
    conversationHistory: compactConversationHistory(source.conversationHistory),
    intelligenceSummary: {
      packetType: compactText(latestIntelligence.packet_type, 120),
      strategicDiagnosis: compactJson(latestIntelligence.strategic_diagnosis_json, 3_000),
      missionSeed: compactJson(latestIntelligence.mission_seed_json, 3_000),
    },
    activePlaybookKeys: compactStringList(source.activePlaybookKeys, 8, 80),
    recommendedMissionPatterns: compactPatternList(source.recommendedMissionPatterns, 4),
    rules: compactRules(source.rules),
  };
  return enforceByteBudget(openingBrief, MAX_OPENING_BRIEF_BYTES);
}

function compactArtist(value: unknown) {
  const artist = record(value);
  return {
    id: compactText(artist.id, 120),
    name: compactText(artist.name, 200),
    stage: compactText(artist.stage, 120),
    goals: compactStringList(artist.goals, 6, 500),
    genres: compactStringList(artist.genres, 8, 120),
    homeMarket: compactText(artist.homeMarket, 200),
    budgetContext: compactText(artist.budgetContext, 1_000),
  };
}

function compactEvidenceList(value: unknown, limit: number) {
  return array(value).slice(0, limit).map((item) => {
    const row = record(item);
    return {
      id: compactText(row.id, 120), source: compactText(row.source, 160), kind: compactText(row.kind, 120),
      subjectId: compactText(row.subjectId, 120), subject: compactText(row.subject, 240), label: compactText(row.label, 240),
      value: compactText(row.value, 500), freshness: compactText(row.freshness, 120), confidence: compactText(row.confidence, 120),
      provenance: compactText(row.provenance, 700), limitation: compactText(row.limitation, 700),
    };
  });
}

function compactMusic(value: unknown) {
  const music = record(value);
  return {
    items: compactCatalogList(music.items, 8),
    projects: compactCatalogList(music.projects, 6),
  };
}

function compactMusicSubjectPointer(value: unknown) {
  const subject = record(value);
  const type = subject.type === "music_item" || subject.type === "music_project" ? subject.type : "";
  const id = compactText(subject.id, 120);
  return type && id ? { type, id } : null;
}

function compactFocusedMusicSubject(value: unknown) {
  const subject = record(value);
  const type = subject.type === "music_item" || subject.type === "music_project" ? subject.type : "";
  const id = compactText(subject.id, 120);
  if (!type || !id) return null;
  return {
    type,
    id,
    title: compactText(subject.title, 240),
    kind: compactText(subject.kind, 120),
    lifecycleStage: compactText(subject.lifecycleStage ?? subject.lifecycle_stage, 120),
    releasedAt: compactText(subject.releasedAt ?? subject.released_at, 120),
    sourceKind: compactText(subject.sourceKind ?? subject.source_kind, 120),
    sourceLimit: compactText(subject.sourceLimit ?? subject.source_limit, 600),
  };
}

function compactCatalogList(value: unknown, limit: number) {
  return array(value).slice(0, limit).map((item) => {
    const row = record(item);
    return {
      id: compactText(row.id, 120), title: compactText(row.title, 240), type: compactText(row.item_type ?? row.project_type ?? row.type, 120),
      lifecycleStage: compactText(row.lifecycle_stage ?? row.lifecycleStage, 120), releasedAt: compactText(row.released_at ?? row.releasedAt, 120),
      sourceKind: compactText(row.source_kind ?? row.sourceKind, 120), sourceLimit: compactText(row.source_limit ?? row.sourceLimit, 500),
    };
  });
}

function compactMemoryList(value: unknown, limit: number) {
  return array(value).slice(0, limit).map((item) => {
    const row = record(item);
    return { id: compactText(row.id, 120), scope: compactText(row.scope, 120), kind: compactText(row.kind, 120), content: compactText(row.content, 1_200), confidence: compactText(row.confidence, 120), reason: compactText(row.reason, 500), missionId: compactText(row.mission_id ?? row.missionId, 120) };
  });
}

function compactMissionList(value: unknown, limit: number) {
  return array(value).slice(0, limit).map((item) => compactMission(item));
}

function compactMission(value: unknown) {
  const row = record(value);
  return {
    id: compactText(row.id, 120), title: compactText(row.title, 240), objective: compactText(row.objective, 1_000), reason: compactText(row.reason, 700),
    status: compactText(row.status, 120), priority: numberOrEmpty(row.priority), progress: numberOrEmpty(row.progress), summary: compactText(row.summary, 1_000),
    patternName: compactText(row.pattern_name ?? row.patternName, 160), currentRecommendation: compactText(row.current_recommendation ?? row.currentRecommendation, 1_000),
    requiredEvidence: compactStringList(row.required_evidence ?? row.requiredEvidence, 8, 400), missingEvidence: compactStringList(row.missing_evidence ?? row.missingEvidence, 8, 400),
    changeConditions: compactStringList(row.change_conditions ?? row.changeConditions, 8, 400), reviewPoint: compactText(row.review_point ?? row.reviewPoint, 500),
  };
}

function compactTaskList(value: unknown, limit: number) {
  return array(value).slice(0, limit).map((item) => compactTask(item));
}

function compactTask(value: unknown) {
  const row = record(value);
  return {
    id: compactText(row.id, 120), missionId: compactText(row.mission_id ?? row.missionId, 120), title: compactText(row.title, 240),
    ownerRole: compactText(row.owner_role ?? row.ownerRole, 120), workMode: compactText(row.work_mode ?? row.workMode, 120), status: compactText(row.status, 120), purpose: compactText(row.purpose, 1_000),
    evidenceNeeded: compactStringList(row.evidence_needed ?? row.evidenceNeeded, 8, 400), completionExpectation: compactText(row.completion_expectation ?? row.completionExpectation, 700),
    completionMode: compactText(row.completion_mode ?? row.completionMode, 120), deliverableTitle: compactText(row.deliverable_title ?? row.deliverableTitle, 240),
    deliverableRequirements: compactStringList(row.deliverable_requirements ?? row.deliverableRequirements, 8, 400),
    managerResponsibility: compactText(row.manager_responsibility ?? row.managerResponsibility, 700), userResponsibility: compactText(row.user_responsibility ?? row.userResponsibility, 700), riskIfLate: compactText(row.risk_if_late ?? row.riskIfLate, 700),
  };
}

function compactAgentReportList(value: unknown, limit: number) {
  return array(value).slice(0, limit).map((item) => {
    const row = record(item);
    return { id: compactText(row.id, 120), agentKey: compactText(row.agent_key ?? row.agentKey, 120), missionId: compactText(row.mission_id ?? row.missionId, 120), summary: compactText(row.summary, 1_000), confidence: compactText(row.confidence, 120), limitations: compactText(row.limitations, 700), finding: compactText(row.finding, 1_000), recommendedAction: compactText(row.recommended_internal_action ?? row.recommendedAction, 700) };
  });
}

function compactConversationHistory(value: unknown) {
  return array(value).slice(-6).map((item) => {
    const row = record(item);
    return { id: compactText(row.id, 120), speaker: compactText(row.speaker, 40), label: compactText(row.label, 100), body: compactText(row.body, 1_500), createdAt: compactText(row.created_at ?? row.createdAt, 80) };
  });
}

function compactPatternList(value: unknown, limit: number) {
  return array(value).slice(0, limit).map((item) => {
    const row = record(item);
    return { key: compactText(row.key ?? row.patternName ?? row.name, 160), name: compactText(row.name ?? row.patternName, 200), summary: compactText(row.summary ?? row.description, 700) };
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

function normalizeContextAnswers(value: unknown) {
  return array(value).slice(0, 8).map((item) => {
    const answer = record(item);
    return { questionKey: compactText(answer.questionKey, 160), answer: compactText(answer.answer, 2_000) };
  }).filter((item) => item.questionKey && item.answer);
}

function enforceByteBudget<T>(value: T, maxBytes: number): T {
  const serialized = JSON.stringify(value);
  if (encoder.encode(serialized).byteLength <= maxBytes) return value;
  return {
    version: "manager_opening_brief_v1",
    notice: "Opening brief was compacted for a safe context budget.",
    artist: (value as any).artist,
    taskContext: (value as any).taskContext,
    conversationHistory: (value as any).conversationHistory.slice(-3),
    activePlaybookKeys: (value as any).activePlaybookKeys,
  } as T;
}

function compactJson(value: unknown, maxChars: number) {
  if (value == null) return "";
  try {
    return compactText(JSON.stringify(value), maxChars);
  } catch {
    return "";
  }
}

function compactStringList(value: unknown, limit: number, maxChars: number) {
  return array(value).slice(0, limit).map((item) => compactText(item, maxChars)).filter(Boolean);
}

function compactText(value: unknown, maxChars: number) {
  const text = typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
  return text.length > maxChars ? `${text.slice(0, Math.max(0, maxChars - 1))}…` : text;
}

function readErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
}

function numberOrEmpty(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : "";
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
