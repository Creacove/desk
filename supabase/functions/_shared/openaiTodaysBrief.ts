export type TodaysBriefMetricInput = {
  id: string;
  category:
    | "artist_context"
    | "audience_scale"
    | "market_heat"
    | "public_reach"
    | "playlist"
    | "discovery"
    | "track_momentum"
    | "current_music"
    | "source_limit";
  subjectType?: string;
  subjectLabel?: string;
  label: string;
  value: string;
  context?: string;
  confidence: "high" | "medium" | "low" | "unknown";
  evidenceIds: string[];
  limitation?: string;
};

export type TodaysBriefDerivedInsight = {
  label: string;
  read: string;
  evidenceIds: string[];
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
  workingCatalog: {
    scopeLabel: "working catalog in view";
    projectCount: number;
    songCount: number;
    latestProjectTitles: string[];
    focusSongTitles: string[];
    note: string;
  };
  intelligenceSnapshotInputs: Array<{
    title: string;
    metrics: TodaysBriefMetricInput[];
    suggestedInsight?: string;
  }>;
  derivedInsights: TodaysBriefDerivedInsight[];
  sourceLimits: string[];
  generatedFor: "setup" | "manual";
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

export type TodaysBriefOutput = {
  headlineRead: string;
  intelligenceSnapshot: TodaysBriefSnapshotGroupOutput[];
  snapshotSummary: string;
  managerRead: string;
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

const setupVisibleAntiPatterns = [
  "campaign",
  "mission",
  "rollout",
  "private saves",
  "repeat listeners",
  "source-of-stream",
  "conversion proof",
  "still missing",
  "missing data",
];

export const todaysBriefJsonSchema = {
  name: "setup_todays_brief_v1",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "headlineRead",
      "intelligenceSnapshot",
      "snapshotSummary",
      "managerRead",
      "sourceLine",
      "confidence",
      "claimAudit",
    ],
    properties: {
      headlineRead: { type: "string", maxLength: 180 },
      intelligenceSnapshot: {
        type: "array",
        minItems: 2,
        maxItems: 5,
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
                  value: { type: "string", maxLength: 42 },
                  context: { type: "string", maxLength: 80 },
                  evidenceIds: { type: "array", minItems: 1, items: { type: "string" } },
                },
              },
            },
          },
        },
      },
      snapshotSummary: { type: "string", maxLength: 280 },
      managerRead: { type: "string", maxLength: 1800 },
      sourceLine: { type: "string", maxLength: 180 },
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
    "Write as the artist's senior Manager and elite music strategy analyst. The Manager is decisive, commercial, culturally aware, and specific.",
    "This is the first setup brief after onboarding. The artist has not created missions, tasks, rollout plans, or campaigns yet.",
    "Do not pretend a campaign, mission, rollout, or release plan already exists. Do not use the word campaign, mission, or rollout in visible output.",
    "Visible output has only two product surfaces: Artist Intelligence and Manager's Read. The JSON still includes sourceLine and claimAudit for product/audit use.",
    "Do not name backend sources or data vendors. Never say Chartmetric, provider, API, normalized, database, evidence row, or third-party in any visible field.",
    "Use the intelligenceSnapshot to prove the Manager knows the artist: compact groups like Scale, Market Heat, Public Reach, Current Music In View, Playlist/Discovery, or Track Momentum when the packet supports them.",
    "Current Music In View means the latest project and recent focus records available to manage now; do not infer full discography size from the workspace catalog.",
    "Do not explain that the working catalog is not the full discography. Use it naturally as current music in view.",
    "Pick the most useful 8-16 facts from the packet. Do not dump every metric.",
    "derive ratios, contrasts, and ranking insights from the data: biggest city vs. second city, combined secondary markets, one social platform compared to the others, playlist reach compared to follower scale, current records with stronger evidence than others.",
    "Every snapshot group insight must say what the numbers mean, not merely repeat the numbers.",
    "The Manager's Read must go deeper than the artist already knows. Explain the shape of the artist's business right now: power center, hidden second lane, cultural base, public leverage, current music focus, and where management should start.",
    "Every Manager's Read paragraph must include at least one artist-specific fact, title, market, platform, comparison, or derived inference from the packet.",
    "If a sentence could be said to another artist, delete it.",
    "Do not write generic platform advice such as X drives conversation, Instagram controls image, or TikTok tests hooks unless the artist's actual numbers make that point non-obvious.",
    "Do not lead with missing data. Do not end with missing data. Do not mention private saves or repeat listener gaps unless directly asked by the user.",
    "Never claim rights certainty, royalties, revenue, return on spend, or conversion unless directly saved in the packet.",
    "End the Manager's Read with one useful thing to do today: choose the first management focus, meaning the record, market, or story the workspace should organize around first.",
    "The sourceLine must be exactly: Based on your saved artist profile, current music in view, public audience signals, and source limits.",
    "Every metric in intelligenceSnapshot must include evidenceIds from the packet. Every claimAudit item must include evidenceIds that support it.",
  ].join("\n");
}

export function parseTodaysBriefOutput(payload: unknown): TodaysBriefOutput {
  const output = typeof payload === "string" ? JSON.parse(payload) : payload;
  if (!isRecord(output)) throw new Error("OpenAI Today's Brief output was not an object.");

  const parsed: TodaysBriefOutput = {
    headlineRead: readRequiredString(output.headlineRead, "headlineRead"),
    intelligenceSnapshot: readSnapshotGroups(output.intelligenceSnapshot),
    snapshotSummary: readRequiredString(output.snapshotSummary, "snapshotSummary"),
    managerRead: readRequiredString(output.managerRead, "managerRead"),
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
  if (!output.intelligenceSnapshot.length) throw new Error("Today's Brief must include artist intelligence.");
  for (const group of output.intelligenceSnapshot) {
    if (!group.metrics.length) throw new Error("Today's Brief intelligence group is missing metrics.");
    for (const metric of group.metrics) {
      if (!metric.evidenceIds.length) throw new Error("Today's Brief intelligence metric is missing evidence IDs.");
    }
  }
  if (!output.claimAudit.length) throw new Error("Today's Brief claim audit is missing.");
  for (const audit of output.claimAudit) {
    if (!audit.evidenceIds.length) throw new Error("Today's Brief claim audit is missing evidence IDs.");
  }
}

export function assertNoBannedVisibleTerms(output: TodaysBriefOutput) {
  const visibleText = [
    output.headlineRead,
    output.snapshotSummary,
    output.managerRead,
    output.sourceLine,
    ...output.intelligenceSnapshot.flatMap((group) => [
      group.title,
      group.insight,
      ...group.metrics.flatMap((metric) => [metric.label, metric.value, metric.context ?? ""]),
    ]),
  ].join("\n");
  const matched = [...bannedVisibleTerms, ...setupVisibleAntiPatterns].find((term) =>
    new RegExp(`\\b${escapeRegex(term)}\\b`, "i").test(visibleText)
  );
  if (matched) throw new Error(`Today's Brief visible copy used banned setup/source term: ${matched}.`);
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
