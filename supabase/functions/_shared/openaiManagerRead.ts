export type ManagerReadSubjectType = "music_item" | "music_project";

export type ManagerReadPacket = {
  subjectType: ManagerReadSubjectType;
  subject: Record<string, unknown>;
  identifiers: Array<Record<string, unknown>>;
  evidence: Array<Record<string, unknown>>;
  artistProfile?: Record<string, unknown>;
  relatedRecords?: Array<Record<string, unknown>>;
  derivedInsights?: Array<Record<string, unknown>>;
  tracklist: Array<Record<string, unknown>>;
  limitations: string[];
  sourcePanelInstruction: string;
};

export type TodaysBriefMetricOutput = {
  label: string;
  value: string;
  context?: string;
  evidenceIds: string[];
};

export type TodaysBriefSnapshotGroupOutput = {
  title: string;
  insight: string;
  metrics: TodaysBriefMetricOutput[];
};

export type TodaysBriefClaimAudit = {
  claim: string;
  evidenceIds: string[];
  limitation: string;
};

export type ManagerReadOutput = {
  situationLine: string;
  headline: string;
  managerRead: string;
  nextMove: string;
  watchNext: string;
  generationState: "fresh" | "limited";
  whatMatters: string[];
  doNotDoYet: string[];
  missingProof: string[];
  confidence: "low" | "medium" | "high" | "unknown";
  evidenceIdsUsed: string[];
  sourcePanelNote: string;

  // New fields aligned with Today's Brief structure
  intelligenceSnapshot: TodaysBriefSnapshotGroupOutput[];
  snapshotSummary: string;
  claimAudit: TodaysBriefClaimAudit[];
  sourceLine: string;
};

const MANAGER_READ_SOURCE_LINE = "Prepared from the record details and audience signals I can already see.";
const MANAGER_READ_SOURCE_PACKET_ID = "source-packet";

export const managerReadJsonSchema = {
  name: "music_manager_read",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "situationLine",
      "headline",
      "managerRead",
      "nextMove",
      "watchNext",
      "generationState",
      "whatMatters",
      "doNotDoYet",
      "missingProof",
      "confidence",
      "evidenceIdsUsed",
      "sourcePanelNote",
      "intelligenceSnapshot",
      "snapshotSummary",
      "claimAudit",
      "sourceLine",
    ],
    properties: {
      situationLine: { type: "string", maxLength: 220 },
      headline: { type: "string", maxLength: 90 },
      managerRead: { type: "string", maxLength: 1800 },
      nextMove: { type: "string", maxLength: 220 },
      watchNext: { type: "string", maxLength: 220 },
      generationState: { type: "string", enum: ["fresh", "limited"] },
      whatMatters: { type: "array", items: { type: "string" } },
      doNotDoYet: { type: "array", items: { type: "string" } },
      missingProof: { type: "array", items: { type: "string" } },
      confidence: { type: "string", enum: ["low", "medium", "high", "unknown"] },
      evidenceIdsUsed: { type: "array", items: { type: "string" } },
      sourcePanelNote: { type: "string" },
      intelligenceSnapshot: {
        type: "array",
        minItems: 1,
        maxItems: 4,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "insight", "metrics"],
          properties: {
            title: { type: "string", maxLength: 48 },
            insight: { type: "string", maxLength: 220 },
            metrics: {
              type: "array",
              minItems: 1,
              maxItems: 6,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["label", "value", "context", "evidenceIds"],
                properties: {
                  label: { type: "string", maxLength: 42 },
                  value: { type: "string", maxLength: 18 },
                  context: { type: "string", maxLength: 56 },
                  evidenceIds: { type: "array", minItems: 1, items: { type: "string" } },
                },
              },
            },
          },
        },
      },
      snapshotSummary: { type: "string", maxLength: 280 },
      claimAudit: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["claim", "evidenceIds", "limitation"],
          properties: {
            claim: { type: "string" },
            evidenceIds: { type: "array", minItems: 1, items: { type: "string" } },
            limitation: { type: "string" },
          },
        },
      },
      sourceLine: { type: "string", maxLength: 180 },
    },
  },
};

export function buildManagerReadInstructions(subjectType: ManagerReadSubjectType) {
  const subjectLabel = subjectType === "music_project" ? "project" : "track";
  return [
    "You are the artist's senior manager and elite music strategy analyst. The Manager is decisive, commercial, culturally aware, and highly specific.",
    "Write in basic English that an independent artist can understand without analytics training.",
    "Explain what happened, why it matters, and what to do next. Do not list numbers without explaining what they mean for the artist's strategy.",
    "Do not use analytics jargon such as playlist concentration, trajectory, conversion signal, or platform footprint.",
    "Write in first person as the Manager where natural, but do not force every sentence to start with I.",
    "The situationLine field must be one short, concrete line that says where the song/project stands now. It must not repeat the Manager Read.",
    "The Manager Read must go deeper than the artist already knows. Explain the record role right now: public-pressure record, playlist record, video/search record, discovery record, collaboration lever, sleeper, catalog support, or project anchor.",
    "Write 2 to 3 compact paragraphs. The Manager Read must be 180 to 260 words.",
    "Do not use markdown headings or bold labels inside Manager Read. It should read like a sharp private note from a great manager, not a report template.",
    "Every Manager's Read paragraph must include at least one specific fact, title, market, platform, comparison, or derived inference from the packet. If a sentence could be said to another record, delete it.",
    "Do not write generic platform advice such as X drives conversation, Instagram controls image, or TikTok tests hooks unless the actual numbers make that point non-obvious.",
    "Do not say I will demand, within 48 hours I will, immediately force, greenlight, or any other fake authority unless an actual user task says that action is approved.",
    "Do not use the words ChatGPT, AI, bot, backend, provider, API, database, evidence row, third-party, Chartmetric, or Spotify confirms in any visible field.",
    "Do not say Chartmetric found. Do not say Spotify confirms. Do not name backend providers in the main read unless the user must know the source to avoid a false claim.",
    "Visible fields must sound like the Manager owns the read. Use language like I found, I am seeing, this record is showing, or the audience is pointing to. Never write third-party data shows, the provider says, or an API found.",
    "Provider names belong in the internal audit fields, not the Manager Read, situationLine, headline, snapshotSummary, sourceLine, or Record Intelligence.",
    "Do not call the whole packet catalog-only, metadata-only, or only catalog metadata when evidence entries include third-party metrics, playlist counts, charts, or social/radio activity.",
    "When catalog details and public attention intelligence are both present, lead with the public attention shape and use catalog details only when they change the decision.",
    "When the packet has many evidence rows, synthesize the pattern. Rank by commercial usefulness: current/trailing streams, playlist reach and editorial support, social video scale, Shazam/radio, charts or territory ranks, then metadata.",
    "Translate database metric names into plain manager language. Never expose raw names like provider_window, video_creates, playlist_total_reach, or spotify_trailing_28d_streams in the main read.",
    "Do not lead with missing data. Do not make the main read mainly about missing data when useful intelligence exists. The opportunity is the center; absent private documents and source limits are not the story.",
    "Do not mention private saves, repeat listeners, source-of-stream, conversion proof, private conversion data, or campaign ROI in visible output unless the user directly asks for those proof gaps.",
    "The nextMove should be a concrete operating decision, not just a request for more data. If rights are blocked, say the practical unlock without making the whole brief about paperwork. The nextMove field must be one sentence, 36 words maximum.",
    "The watchNext field must say exactly what to check next and why, in 30 words maximum.",
    "Do not dump credits, copyright notices, label text, UPCs, asset IDs, cover image facts, duration, or license language unless that one detail changes the decision.",
    "Do not say movement, signal, activity, or momentum unless you immediately name the concrete detail behind it.",
    "Use exact numbers, names, dates, placements, ranks, and trends from the packet when they change the management judgment.",
    "Use comparisons when available: this record versus other current records, TikTok pressure versus YouTube demand, playlist reach versus playlist count, editorial support versus social reach, or latest week versus trailing window.",
    `Make this feel specific to this ${subjectLabel}. Do not write a reusable template, dashboard summary, or generic music advice.`,
    ...(subjectType === "music_project"
      ? [
          "For music_project subjects, write a release-level brief, not a song recap.",
          "Use the tracklist to explain which song should be inspected first, which songs are blocked, and whether the project should move as one release or as a focus-track-led plan.",
          "Name the focus track when the packet supports one; if the packet does not support one, say what release-level evidence would choose the focus track without turning the brief into a missing-data report.",
          "Explain release readiness through concrete saved facts: mapped songs, project-level evidence, track-level evidence, rights blockers, lifecycle stage, and any project evidence that changes the release decision.",
          "Use Project Intelligence for project snapshots. Project Intelligence should summarize release shape, tracklist focus, project-level evidence, comparison, and operational readiness when supported.",
        ]
      : []),
    "Never invent private Spotify saves, repeat listeners, source-of-stream, revenue, rights certainty, campaign ROI, or conversion.",
    "The final sentence of the Manager Read must be today's practical move: the record, market, story, or platform behavior the team should organize around first.",
    "Use the intelligenceSnapshot to create Record Intelligence groups like Public Pressure, Music Platform Support, Video/Search Demand, Collaboration/Market Read, Comparison, and Operational Readiness when evidence supports them.",
    "Record Intelligence must prove the Manager knows the song: compact metrics plus an insight that explains why those facts change the read.",
    "Do not put missing proof, unavailable private documents, source limits, or vendor names into Record Intelligence. Record Intelligence is for usable facts we have, not gaps.",
    "Provide a snapshotSummary that synthesizes the snapshots into a plain-English overview.",
    "For the metrics in `intelligenceSnapshot`, write values using a clean, compact format: e.g. use '5.2M' instead of '5,222,775' or '~5,222,775', '328' instead of '328 playlists', '9K' instead of '9,171', '719K' instead of '719,252'. Use standard metric notation (K for thousands, M for millions, # for ranks, % for percentages).",
    "Each intelligenceSnapshot group metric value must contain ONLY the clean formatted number/string, and the unit/track name belongs in the context field (e.g. value: '5.2M', context: 'playlist reach').",
    "Record Intelligence metric values are table cells, not sentences. Keep value under 18 characters, keep context under 56 characters, and never use ellipses.",
    "Back up all claims in the Manager Read with corresponding evidenceIds using the claimAudit array.",
    `If a fact comes from subject metadata, artist profile, tracklist, relatedRecords, or derivedInsights rather than an evidence row, use "${MANAGER_READ_SOURCE_PACKET_ID}" as its evidenceIds value. Never leave evidenceIds empty.`,
    `The sourceLine must be exactly: ${MANAGER_READ_SOURCE_LINE}`,
  ].join("\n");
}

export function parseManagerReadOutput(payload: unknown): ManagerReadOutput {
  const output = typeof payload === "string" ? JSON.parse(payload) : payload;
  if (!isRecord(output)) throw new Error("OpenAI manager read output was not an object.");

  const parsed: ManagerReadOutput = repairMusicReadProvenance({
    situationLine: readRequiredString(output.situationLine, "situationLine"),
    headline: readRequiredString(output.headline, "headline"),
    managerRead: readRequiredString(output.managerRead, "managerRead"),
    nextMove: readRequiredString(output.nextMove, "nextMove"),
    watchNext: readRequiredString(output.watchNext, "watchNext"),
    generationState: readGenerationState(output.generationState),
    whatMatters: readStringArray(output.whatMatters),
    doNotDoYet: readStringArray(output.doNotDoYet),
    missingProof: readStringArray(output.missingProof),
    confidence: readConfidence(output.confidence),
    evidenceIdsUsed: readStringArray(output.evidenceIdsUsed),
    sourcePanelNote: readRequiredString(output.sourcePanelNote, "sourcePanelNote"),

    // New fields
    intelligenceSnapshot: readSnapshotGroups(output.intelligenceSnapshot),
    snapshotSummary: readRequiredString(output.snapshotSummary, "snapshotSummary"),
    claimAudit: readClaimAudit(output.claimAudit),
    sourceLine: readRequiredString(output.sourceLine, "sourceLine"),
  });

  assertMusicReadHasEvidenceIds(parsed);
  // Banned-term enforcement is handled by the caller via checkBannedVisibleMusicTerms.
  // Do NOT hard-throw here — callers retry or strip automatically.
  return parsed;
}

/**
 * Returns the first banned term found in visible output fields, or null if clean.
 * Callers should retry the OpenAI call with a correction prompt before giving up.
 */
export function checkBannedVisibleMusicTerms(output: ManagerReadOutput): string | null {
  const visibleText = buildVisibleText(output);
  return musicReadBannedVisibleTerms.find((term) =>
    new RegExp(`\\b${escapeRegex(term)}\\b`, "i").test(visibleText)
  ) ?? null;
}

/**
 * Returns true if the sourceLine matches the required manager voice.
 */
export function checkSourceLine(output: ManagerReadOutput): boolean {
  return output.sourceLine === MANAGER_READ_SOURCE_LINE;
}

/**
 * In-place strip of any remaining banned terms after retries are exhausted.
 * Replaces matched terms with semantically neutral substitutes so the read
 * can still be returned rather than hard-failing the user request.
 */
export function stripBannedVisibleMusicTerms(output: ManagerReadOutput): ManagerReadOutput {
  function clean(text: string): string {
    let result = text;
    for (const replacement of musicReadVisibleReplacementRules) {
      result = result.replace(replacement.pattern, replacement.value);
    }
    result = result.replace(/\s{2,}/g, " ").replace(/\s+([,.;:!?])/g, "$1").trim();
    return result;
  }
  return {
    ...output,
    situationLine: clean(output.situationLine),
    headline: clean(output.headline),
    managerRead: clean(output.managerRead),
    nextMove: clean(output.nextMove),
    watchNext: clean(output.watchNext),
    snapshotSummary: clean(output.snapshotSummary),
    sourceLine: clean(output.sourceLine),
    whatMatters: output.whatMatters,
    doNotDoYet: output.doNotDoYet,
    missingProof: output.missingProof,
    intelligenceSnapshot: output.intelligenceSnapshot.map((group) => ({
      ...group,
      title: clean(group.title),
      insight: clean(group.insight),
      metrics: group.metrics.map((m) => ({
        ...m,
        label: clean(m.label),
        value: clean(m.value),
        context: m.context ? clean(m.context) : m.context,
      })),
    })),
  };
}

function readSnapshotGroups(value: unknown): TodaysBriefSnapshotGroupOutput[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((item) => ({
    title: readRequiredString(item.title, "intelligenceSnapshot.title"),
    insight: readRequiredString(item.insight, "intelligenceSnapshot.insight"),
    metrics: readSnapshotMetrics(item.metrics),
  }));
}

function readSnapshotMetrics(value: unknown): TodaysBriefMetricOutput[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((item) => ({
    label: readRequiredString(item.label, "intelligenceSnapshot.metrics.label"),
    value: readRequiredString(item.value, "intelligenceSnapshot.metrics.value"),
    context: readRequiredString(item.context, "intelligenceSnapshot.metrics.context"),
    evidenceIds: readStringArray(item.evidenceIds),
  }));
}

function readClaimAudit(value: unknown): TodaysBriefClaimAudit[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((item) => ({
    claim: readRequiredString(item.claim, "claimAudit.claim"),
    evidenceIds: readStringArray(item.evidenceIds),
    limitation: readRequiredString(item.limitation, "claimAudit.limitation"),
  }));
}

function repairMusicReadProvenance(output: ManagerReadOutput): ManagerReadOutput {
  return {
    ...output,
    evidenceIdsUsed: withSourcePacketFallback(output.evidenceIdsUsed),
    intelligenceSnapshot: output.intelligenceSnapshot.map((group) => ({
      ...group,
      metrics: group.metrics.map((metric) => ({
        ...metric,
        evidenceIds: withSourcePacketFallback(metric.evidenceIds),
      })),
    })),
    claimAudit: output.claimAudit.map((audit) => ({
      ...audit,
      evidenceIds: withSourcePacketFallback(audit.evidenceIds),
    })),
  };
}

function withSourcePacketFallback(evidenceIds: string[]) {
  return evidenceIds.length ? evidenceIds : [MANAGER_READ_SOURCE_PACKET_ID];
}

function readRequiredString(value: unknown, key: string) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`OpenAI manager read output missing ${key}.`);
  return value.trim();
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim()) : [];
}

function readConfidence(value: unknown): ManagerReadOutput["confidence"] {
  return value === "low" || value === "medium" || value === "high" || value === "unknown" ? value : "unknown";
}

function readGenerationState(value: unknown): ManagerReadOutput["generationState"] {
  if (value === "fresh" || value === "limited") return value;
  throw new Error("OpenAI manager read output missing generationState.");
}

const musicReadBannedVisibleTerms = [
  "ChatGPT",
  "AI",
  "bot",
  "backend",
  "Chartmetric",
  "provider",
  "API",
  "APIs",
  "database",
  "evidence row",
  "third-party",
  "Spotify confirms",
  "Spotify for Artists",
  "private conversion data",
  "private saves",
  "private analytics",
  "private documents",
  "repeat listeners",
  "source-of-stream",
  "source limits",
  "source limit",
  "conversion proof",
  "campaign ROI",
  "missing proof",
  "still missing",
  "missing data",
  "catalog-only",
  "metadata-only",
  "only catalog metadata",
  "metadata record",
  "saved track metadata",
];

const musicReadVisibleReplacementRules = [
  { pattern: /\bChartmetric\s+says\b/gi, value: "I found" },
  { pattern: /\bChartmetric\s+found\b/gi, value: "I found" },
  { pattern: /\bSpotify\s+confirms\b/gi, value: "the record details show" },
  { pattern: /\bthird-party\s+data\s+shows\b/gi, value: "the record read shows" },
  { pattern: /\bprovider\s+data\s+says\b/gi, value: "the record read shows" },
  { pattern: /\bprivate\s+saves\s+are\s+still\s+missing\b/gi, value: "save-level behavior is not part of this read" },
  { pattern: /\bsource-of-stream\b/gi, value: "stream origin detail" },
  { pattern: /\bprivate\s+conversion\s+data\b/gi, value: "deeper fan behavior" },
  { pattern: /\bconversion\s+proof\b/gi, value: "fan-response proof" },
  { pattern: /\bcampaign\s+ROI\b/gi, value: "spend return" },
  { pattern: /\brepeat\s+listeners\b/gi, value: "returning fan behavior" },
  { pattern: /\bprivate\s+saves\b/gi, value: "save-level behavior" },
  { pattern: /\bprivate\s+analytics\b/gi, value: "deeper account-level detail" },
  { pattern: /\bprivate\s+documents\b/gi, value: "team documents" },
  { pattern: /\bSpotify\s+for\s+Artists\b/gi, value: "artist account detail" },
  { pattern: /\bthird-party\b/gi, value: "public" },
  { pattern: /\bChartmetric\b/gi, value: "the read" },
  { pattern: /\bprovider\b/gi, value: "record" },
  { pattern: /\bAPIs\b/gi, value: "tools" },
  { pattern: /\bAPI\b/gi, value: "tool" },
  { pattern: /\bChatGPT\b/gi, value: "the Manager" },
  { pattern: /\bAI\b/gi, value: "Manager" },
  { pattern: /\bbot\b/gi, value: "assistant" },
  { pattern: /\bbackend\b/gi, value: "system" },
  { pattern: /\bdatabase\b/gi, value: "workspace" },
  { pattern: /\bevidence row\b/gi, value: "supporting detail" },
  { pattern: /\bsource limits\b/gi, value: "known limits" },
  { pattern: /\bsource limit\b/gi, value: "known limit" },
  { pattern: /\bmissing proof\b/gi, value: "open item" },
  { pattern: /\bstill missing\b/gi, value: "not part of this read" },
  { pattern: /\bmissing data\b/gi, value: "unavailable detail" },
  { pattern: /\bcatalog-only\b/gi, value: "catalog-level" },
  { pattern: /\bmetadata-only\b/gi, value: "basic detail" },
  { pattern: /\bonly catalog metadata\b/gi, value: "basic catalog detail" },
  { pattern: /\bmetadata record\b/gi, value: "record detail" },
  { pattern: /\bsaved track metadata\b/gi, value: "saved track details" },
];

function assertMusicReadHasEvidenceIds(output: ManagerReadOutput) {
  if (!output.intelligenceSnapshot.length) throw new Error("OpenAI manager read output missing Record Intelligence.");
  for (const group of output.intelligenceSnapshot) {
    if (!group.metrics.length) throw new Error("OpenAI manager read Record Intelligence group missing metrics.");
    for (const metric of group.metrics) {
      if (!metric.evidenceIds.length) throw new Error("OpenAI manager read Record Intelligence metric missing evidence IDs.");
    }
  }
  if (!output.claimAudit.length) throw new Error("OpenAI manager read output missing claim audit.");
  for (const audit of output.claimAudit) {
    if (!audit.evidenceIds.length) throw new Error("OpenAI manager read claim audit missing evidence IDs.");
  }
  if (!output.evidenceIdsUsed.length) throw new Error("OpenAI manager read output missing evidence IDs used.");
}

function buildVisibleText(output: ManagerReadOutput): string {
  return [
    output.situationLine,
    output.headline,
    output.managerRead,
    output.nextMove,
    output.watchNext,
    output.snapshotSummary,
    output.sourceLine,
    ...output.intelligenceSnapshot.flatMap((group) => [
      group.title,
      group.insight,
      ...group.metrics.flatMap((metric) => [metric.label, metric.value, metric.context ?? ""]),
    ]),
  ].join("\n");
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
