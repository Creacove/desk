export type TodaysBriefSignalInput = {
  id: string;
  category: "artist_context" | "market" | "audience" | "catalog" | "playlist" | "social_attention" | "source_limit";
  label: string;
  value?: string;
  whyItMatters: string;
  confidence: "high" | "medium" | "low" | "unknown";
  evidenceIds: string[];
  limitation?: string;
};

export type ArtistBriefPacket = {
  profile: {
    artistName: string;
    stage?: string;
    homeMarket?: string;
    genres: string[];
    artistDirection?: string;
    budgetContext?: string;
    socialHandles: Record<string, string>;
  };
  catalog: {
    songCount: number;
    projectCount: number;
    albumCount: number;
    latestTitles: string[];
    catalogStatus: string;
  };
  signals: TodaysBriefSignalInput[];
  sourceLimits: string[];
  generatedFor: "setup" | "manual";
};

export type TodaysBriefSignalOutput = {
  claim: string;
  whyItMatters: string;
  evidenceIds: string[];
};

export type TodaysBriefClaimAudit = {
  claim: string;
  evidenceIds: string[];
  limitation: string;
};

export type TodaysBriefOutput = {
  headlineRead: string;
  artistSnapshot: string;
  signals: TodaysBriefSignalOutput[];
  managerRead: string;
  teamRead: string;
  todayDirective: string;
  missingProof: string[];
  sourceLine: string;
  confidence: "high" | "medium" | "low" | "limited" | "unknown";
  generatedAt?: string;
  managerSynthesisRunId?: string;
  claimAudit: TodaysBriefClaimAudit[];
};

export const bannedVisibleTerms = [
  "Chartmetric",
  "provider",
  "API",
  "normalized",
  "database",
  "evidence row",
  "third-party",
];

export const todaysBriefJsonSchema = {
  name: "setup_todays_brief_v1",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "headlineRead",
      "artistSnapshot",
      "signals",
      "managerRead",
      "teamRead",
      "todayDirective",
      "missingProof",
      "sourceLine",
      "confidence",
      "claimAudit",
    ],
    properties: {
      headlineRead: { type: "string", maxLength: 220 },
      artistSnapshot: { type: "string", maxLength: 520 },
      signals: {
        type: "array",
        minItems: 1,
        maxItems: 6,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["claim", "whyItMatters", "evidenceIds"],
          properties: {
            claim: { type: "string", maxLength: 260 },
            whyItMatters: { type: "string", maxLength: 320 },
            evidenceIds: { type: "array", minItems: 1, items: { type: "string" } },
          },
        },
      },
      managerRead: { type: "string", maxLength: 1200 },
      teamRead: { type: "string", maxLength: 620 },
      todayDirective: { type: "string", maxLength: 320 },
      missingProof: { type: "array", items: { type: "string" } },
      sourceLine: { type: "string", maxLength: 260 },
      confidence: { type: "string", enum: ["high", "medium", "low", "limited", "unknown"] },
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
    },
  },
};

export function buildTodaysBriefInstructions() {
  return [
    "Write as the artist's senior Manager. The Manager knows the artist's saved profile, catalog, public audience picture, and current proof limits.",
    "Do not name backend sources or data vendors. Never say Chartmetric, provider, API, normalized, database, evidence row, or third-party in any visible field.",
    "Use Manager language: I'm seeing, Your strongest current proof is, The catalog tells me, Your audience picture is, and I would treat this as where natural.",
    "Translate all metrics into plain artist/team meaning. Do not expose raw metric names.",
    "Pick the few facts that change the management read. Do not list every field.",
    "Make the brief feel specific to this artist, not reusable setup advice.",
    "End with one useful thing to do today.",
    "The sourceLine must be exactly this plain-language idea, adjusted only for grammar: Based on your saved artist profile, imported catalog, public audience signals, and current source limits.",
    "The Manager can sound confident, but cannot invent certainty.",
    "Never claim private saves, repeat listeners, source-of-stream, revenue, rights certainty, campaign ROI, or conversion unless the packet directly supports it.",
    "If proof is limited, say it like a Manager: I can see public attention, but I cannot yet see whether people are saving, returning, or converting.",
    "Every signal must include evidenceIds from the packet. Every claimAudit item must include the evidenceIds that support it.",
  ].join("\n");
}

export function parseTodaysBriefOutput(payload: unknown): TodaysBriefOutput {
  const output = typeof payload === "string" ? JSON.parse(payload) : payload;
  if (!isRecord(output)) throw new Error("OpenAI Today's Brief output was not an object.");

  const parsed: TodaysBriefOutput = {
    headlineRead: readRequiredString(output.headlineRead, "headlineRead"),
    artistSnapshot: readRequiredString(output.artistSnapshot, "artistSnapshot"),
    signals: readSignals(output.signals),
    managerRead: readRequiredString(output.managerRead, "managerRead"),
    teamRead: readRequiredString(output.teamRead, "teamRead"),
    todayDirective: readRequiredString(output.todayDirective, "todayDirective"),
    missingProof: readStringArray(output.missingProof),
    sourceLine: readRequiredString(output.sourceLine, "sourceLine"),
    confidence: readConfidence(output.confidence),
    generatedAt: readOptionalString(output.generatedAt),
    managerSynthesisRunId: readOptionalString(output.managerSynthesisRunId),
    claimAudit: readClaimAudit(output.claimAudit),
  };

  assertSignalsHaveEvidenceIds(parsed);
  assertNoBannedVisibleTerms(parsed);
  return parsed;
}

export function assertSignalsHaveEvidenceIds(output: TodaysBriefOutput) {
  if (!output.signals.length) throw new Error("Today's Brief must include at least one signal.");
  for (const signal of output.signals) {
    if (!signal.evidenceIds.length) throw new Error("Today's Brief signal is missing evidence IDs.");
  }
  if (!output.claimAudit.length) throw new Error("Today's Brief claim audit is missing.");
  for (const audit of output.claimAudit) {
    if (!audit.evidenceIds.length) throw new Error("Today's Brief claim audit is missing evidence IDs.");
  }
}

export function assertNoBannedVisibleTerms(output: TodaysBriefOutput) {
  const visibleText = [
    output.headlineRead,
    output.artistSnapshot,
    output.managerRead,
    output.teamRead,
    output.todayDirective,
    output.sourceLine,
    ...output.missingProof,
    ...output.signals.flatMap((signal) => [signal.claim, signal.whyItMatters]),
  ].join("\n");
  const matched = bannedVisibleTerms.find((term) => new RegExp(`\\b${escapeRegex(term)}\\b`, "i").test(visibleText));
  if (matched) throw new Error(`Today's Brief visible copy used banned backend/source term: ${matched}.`);
}

function readSignals(value: unknown): TodaysBriefSignalOutput[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((item) => ({
    claim: readRequiredString(item.claim, "signals.claim"),
    whyItMatters: readRequiredString(item.whyItMatters, "signals.whyItMatters"),
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

function readRequiredString(value: unknown, key: string) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`OpenAI Today's Brief output missing ${key}.`);
  return value.trim();
}

function readOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim()) : [];
}

function readConfidence(value: unknown): TodaysBriefOutput["confidence"] {
  return value === "high" || value === "medium" || value === "low" || value === "limited" || value === "unknown" ? value : "unknown";
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
