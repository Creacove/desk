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
  const focusedMusicSubject = compactFocusedMusicSubject(source.focusedMusicSubject);
  const openingBrief = {
    version: "manager_opening_brief_v2",
    truthPriority: [
      "focusedMusicSubject is current workspace truth and overrides old conversation/memory/Manager Read",
      "durableMemory is preference/history, not a replacement for current structured song state",
      "Manager Read is derived analysis and can be stale",
    ],
    artist: compactArtist(source.artist),
    focusedMusicSubject,
    taskContext: compactTask(source.taskContext),
    conversationHistory: compactConversationHistory(source.conversationHistory),
    durableMemory: compactMemoryList(source.memory, 6),
    evidence: compactEvidenceList(source.evidence, 8),
    music: compactMusic(source.music),
    activeMissions: compactMissionList(source.existingMissions, 6),
    activeTasks: compactTaskList(source.existingTasks, 8),
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
    plannedReleaseDate: compactText(subject.plannedReleaseDate ?? subject.planned_release_date ?? metadata.planned_release_date ?? metadata.release_date, 120),
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
      const event = record(item);
      return {
        eventType: compactText(event.eventType ?? event.event_type, 160),
        summary: compactText(event.summary, 500),
        createdAt: compactText(event.createdAt ?? event.created_at, 120),
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
  const read = record(value);
  if (!Object.keys(read).length) return null;
  return {
    id: compactText(read.id, 120),
    summary: compactText(read.summary, 1_500),
    recommendation: compactText(read.recommendation, 2_000),
    createdAt: compactText(read.createdAt ?? read.created_at, 120),
  };
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

function compactMusic(value: unknown) {
  const music = record(value);
  return { items: compactCatalogList(music.items, 8), projects: compactCatalogList(music.projects, 6) };
}

function compactCatalogList(value: unknown, limit: number) {
  return array(value).slice(0, limit).map((item) => {
    const row = record(item);
    return {
      id: compactText(row.id, 120),
      title: compactText(row.title, 240),
      type: compactText(row.item_type ?? row.project_type ?? row.type, 120),
      lifecycleStage: compactText(row.lifecycle_stage ?? row.lifecycleStage, 120),
      plannedReleaseDate: compactText(row.planned_release_date ?? row.plannedReleaseDate, 120),
      releasedAt: compactText(row.released_at ?? row.releasedAt, 120),
    };
  });
}

function compactEvidenceList(value: unknown, limit: number) {
  return array(value).slice(0, limit).map((item) => {
    const row = record(item);
    return {
      id: compactText(row.id, 120), source: compactText(row.source, 160), kind: compactText(row.kind ?? row.evidence_type, 120),
      subjectId: compactText(row.subjectId ?? row.subject_id, 120), subject: compactText(row.subject ?? row.subject_label, 240),
      value: compactText(row.value ?? row.metric_value, 500), freshness: compactText(row.freshness, 120), confidence: compactText(row.confidence, 120),
      provenance: compactText(row.provenance, 500), limitation: compactText(row.limitation, 500),
    };
  });
}

function compactMemoryList(value: unknown, limit: number) {
  return array(value).slice(0, limit).map((item) => {
    const row = record(item);
    return {
      id: compactText(row.id, 120), scope: compactText(row.scope, 120), kind: compactText(row.kind, 120),
      content: compactText(row.content, 1_000), confidence: compactText(row.confidence, 120), reason: compactText(row.reason, 400),
    };
  });
}

function compactMissionList(value: unknown, limit: number) { return array(value).slice(0, limit).map(compactMission); }
function compactMission(value: unknown) {
  const row = record(value);
  return {
    id: compactText(row.id, 120), title: compactText(row.title, 240), objective: compactText(row.objective, 900),
    status: compactText(row.status, 120), progress: numberOrEmpty(row.progress), summary: compactText(row.summary, 800),
    currentRecommendation: compactText(row.current_recommendation ?? row.currentRecommendation, 800),
  };
}

function compactTaskList(value: unknown, limit: number) { return array(value).slice(0, limit).map(compactTask); }
function compactTask(value: unknown) {
  const row = record(value);
  return {
    id: compactText(row.id, 120), missionId: compactText(row.mission_id ?? row.missionId, 120), title: compactText(row.title, 240),
    status: compactText(row.status, 120), workMode: compactText(row.work_mode ?? row.workMode, 120), purpose: compactText(row.purpose, 700),
    managerResponsibility: compactText(row.manager_responsibility ?? row.managerResponsibility, 600),
    userResponsibility: compactText(row.user_responsibility ?? row.userResponsibility, 600),
  };
}

function compactAgentReportList(value: unknown, limit: number) {
  return array(value).slice(0, limit).map((item) => {
    const row = record(item);
    return { id: compactText(row.id, 120), agentKey: compactText(row.agent_key ?? row.agentKey, 120), summary: compactText(row.summary, 800), finding: compactText(row.finding, 800) };
  });
}

function compactConversationHistory(value: unknown) {
  return array(value).slice(-6).map((item) => {
    const row = record(item);
    return { id: compactText(row.id, 120), speaker: compactText(row.speaker, 40), body: compactText(row.body, 1_500), createdAt: compactText(row.created_at ?? row.createdAt, 80) };
  });
}

function compactPatternList(value: unknown, limit: number) {
  return array(value).slice(0, limit).map((item) => {
    const row = record(item);
    return { key: compactText(row.key ?? row.patternName ?? row.name, 160), name: compactText(row.name ?? row.patternName, 200), summary: compactText(row.summary ?? row.description, 600) };
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

function compactMusicSubjectPointer(value: unknown) {
  const subject = record(value);
  const type = subject.type === "music_item" || subject.type === "music_project" ? subject.type : "";
  const id = compactText(subject.id, 120);
  return type && id ? { type, id } : null;
}

function normalizeContextAnswers(value: unknown) {
  return array(value).slice(0, 8).map((item) => {
    const answer = record(item);
    return { questionKey: compactText(answer.questionKey, 160), answer: compactText(answer.answer, 2_000) };
  }).filter((item) => item.questionKey && item.answer);
}

function enforceByteBudget<T extends Record<string, any>>(value: T, maxBytes: number): T {
  if (encoder.encode(JSON.stringify(value)).byteLength <= maxBytes) return value;
  const compacted = {
    version: "manager_opening_brief_v2_compact",
    notice: "Secondary context was compacted; current focused-subject truth is preserved.",
    truthPriority: value.truthPriority,
    artist: value.artist,
    focusedMusicSubject: value.focusedMusicSubject,
    taskContext: value.taskContext,
    conversationHistory: array(value.conversationHistory).slice(-3),
    durableMemory: array(value.durableMemory).slice(0, 3),
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
  } catch { return {}; }
}

function compactJson(value: unknown, maxChars: number) {
  if (value == null) return "";
  try { return compactText(JSON.stringify(value), maxChars); } catch { return ""; }
}

function compactStringList(value: unknown, limit: number, maxChars: number) { return array(value).slice(0, limit).map((item) => compactText(item, maxChars)).filter(Boolean); }
function compactText(value: unknown, maxChars: number) {
  const text = typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
  return text.length > maxChars ? `${text.slice(0, Math.max(0, maxChars - 1))}…` : text;
}
function numberOrText(value: unknown, maxLength: number) { return typeof value === "number" && Number.isFinite(value) ? value : compactText(value, maxLength); }
function numberOrEmpty(value: unknown) { return typeof value === "number" && Number.isFinite(value) ? value : ""; }
function array(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function record(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }

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
