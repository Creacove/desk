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
  managerEvidenceReads?: Array<{
    label: string;
    value?: string;
    category: "kpi" | "signal" | "asset" | "market" | "management";
    read: string;
    evidenceIds: string[];
    confidence?: string;
  }>;
  sourceLine: string;
  confidence: "high" | "medium" | "low" | "limited" | "unknown";
  generationState?: "fresh" | "fallback";
  generatedAt?: string;
  managerSynthesisRunId?: string;
  claimAudit: TodaysBriefClaimAudit[];
};

export type TodaysBriefPromptMode = "operating" | "setup-map";

export const TODAYS_BRIEF_PROMPT_VERSION = "todays-brief-grounded-v3";
export const TODAYS_BRIEF_PACKET_VERSION = "todays-brief-packet-v2";
export const TODAYS_BRIEF_SCHEMA_VERSION = "setup_todays_brief_v1";

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

const visibleCopyReplacements: Array<[RegExp, string]> = [
  [/\bChartmetric\b/gi, "saved intelligence"],
  [/\bprovider\b/gi, "source"],
  [/\bAPI\b/g, "source"],
  [/\bnormalized\b/gi, "prepared"],
  [/\bdatabase\b/gi, "workspace"],
  [/\bevidence row\b/gi, "supporting evidence"],
  [/\bthird-party\b/gi, "external"],
  [/\bprivate saves\b/gi, "save signals"],
  [/\brepeat listeners\b/gi, "listener return signals"],
  [/\bsource-of-stream\b/gi, "stream source"],
  [/\bconversion proof\b/gi, "conversion signal"],
  [/\bstill missing\b/gi, "not yet in view"],
  [/\bmissing data\b/gi, "source gap"],
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
      headlineRead: { type: "string", maxLength: 360 },
      intelligenceSnapshot: {
        type: "array",
        minItems: 2,
        maxItems: 5,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "insight", "metrics"],
          properties: {
            title: { type: "string", maxLength: 80 },
            insight: { type: "string", maxLength: 520 },
            metrics: {
              type: "array",
              minItems: 1,
              maxItems: 6,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["label", "value", "context", "evidenceIds"],
                properties: {
                  label: { type: "string", maxLength: 80 },
                  value: { type: "string", maxLength: 120 },
                  context: { type: "string", maxLength: 180 },
                  evidenceIds: { type: "array", items: { type: "string" } },
                },
              },
            },
          },
        },
      },
      snapshotSummary: { type: "string", maxLength: 700 },
      managerRead: { type: "string", maxLength: 5000 },
      sourceLine: { type: "string", maxLength: 240 },
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
            evidenceIds: { type: "array", items: { type: "string" } },
            limitation: { type: "string" },
          },
        },
      },
    },
  },
};

const sharedTodaysBriefInstructions = [
    `Prompt contract: ${TODAYS_BRIEF_PROMPT_VERSION}.`,
    "Treat input according to these boundaries: VERIFIED_EVIDENCE contains saved facts with allowed evidence IDs; USER_CONTEXT contains artist-stated goals and preferences; PERSISTED_WORKSPACE_STATE contains saved catalog, current workspace state, and prior Manager state; PERMITTED_INFERENCE allows only calculations, comparisons, and clearly framed judgment derived from those inputs; MISSING_OR_STALE_INFORMATION contains limitations that must constrain confidence.",
    "General model knowledge may help interpret a category, but unsupported knowledge must not become a sourced workspace fact, named artist fact, metric, event, biography, market claim, or recommendation premise.",
    "Write as the artist's senior Manager and elite music strategy analyst. The Manager is decisive, commercial, culturally aware, and specific.",
    "Visible output has only two product surfaces: Artist Intelligence and Manager's Read. The JSON still includes sourceLine and claimAudit for product/audit use.",
    "Do not name backend sources or data vendors. Never say Chartmetric, provider, API, normalized, database, evidence row, or third-party in any visible field.",
    "Platform-specific metrics must name the actual platform in the label. Say Spotify monthly listeners, Spotify listeners in Lagos, TikTok followers, YouTube subscribers, and similar explicit labels. The platform is part of the meaning; the data vendor is not.",
    "Do not surface proprietary vendor scores or vendor-specific artist/country ranks as if they were universal industry rankings.",
    "Use the intelligenceSnapshot to prove the Manager knows the artist. Pick group titles that fit the actual read, such as Scale, Market Heat, Public Reach, Current Music In View, Playlist/Discovery, Track Momentum, Catalog Center, or Audience Map when the packet supports them.",
    "Metric value must be the atomic number or short fact only. Put artist, record, window, source meaning, or explanation in metric label/context. Do not put parenthetical explanations in metric value.",
    "Use managerEvidenceReads to explain what the visible evidence means inside the Manager's Read. Do not interpret only KPI scores; interpret the strongest KPI, signal, asset, market, and management evidence available in the packet.",
    "Artist goal or artist direction is ambition context, not automatically the object of today's work. Do not quote broad goals like 'to be the biggest in the world' as if they are a song, signal, or task.",
    "Do not turn a broad artist goal into wording like do-this / do-not-do rules. Translate ambition into a concrete management focus grounded in evidence: record, market, audience, positioning, rights, team capacity, or current workspace state.",
    "Current Music In View means the latest project and recent focus records available to manage now; do not infer full discography size from the workspace catalog.",
    "Do not explain that the working catalog is not the full discography. Use it naturally as current music in view.",
    "Pick the most useful facts from the packet. Do not dump every metric, task, conversation, event, or mission into visible output.",
    "derive ratios, contrasts, and ranking insights from the data when useful: biggest city vs. second city, combined secondary markets, one social platform compared to the others, playlist reach compared to follower scale, current records with stronger evidence than others.",
    "Every snapshot group insight must say what the numbers mean, not merely repeat the numbers.",
    "Write headlineRead as a very concise, punchy title for the day's brief (strictly under 120 characters). It must never contain long lists of tracks, numbers, or detailed context that would cause text clipping. Push all detailed numbers and context into snapshotSummary or managerRead.",
    "Write snapshotSummary as a rich, dense synthesis (250-500 characters) explaining who the artist is, where their career or brand stands now, and the positioning supported by the frozen packet. Do not add news, biography, social facts, or background that is absent from the packet.",
    "The Manager's Read is the desk's core output. It has exactly 4 sections — no more, no fewer. Separate each section with a blank line. Each section must start with its label in title case followed by a colon, then the section body. Format for every section: 'Label: Body text here.'",
    "Use complete sentences throughout. Do not stop mid-sentence, and do not let any visible field read like clipped copy.",
    "Section 1 is always labeled 'Artist Intelligence'. Write 2-4 sentences that synthesise what the strongest signals in this packet add up to about this artist's current position — scale, market pull, platform shape, catalog weight, operating position, or standout contrast. It must be grounded in specific numbers, titles, markets, or current workspace facts from the packet.",
    "Sections 2, 3, and 4 are determined by the Manager's own analysis of the packet. Before writing them, reason internally: identify the 3 most commercially important or strategically urgent themes that are not already covered by Artist Intelligence. Label each theme precisely in 2-4 words (title case). Write 2-4 sentences of body per section.",
    "Minimum body length per section: each section body must be at least 150 characters. Do not write stub sections. If a theme cannot be supported with at least 2 specific sentences from the packet, choose a different theme.",
    "Every Manager's Read section must include at least one artist-specific fact, title, market, platform, comparison, workspace state, or derived inference from the packet.",
    "If a sentence could be said to another artist, delete it.",
    "Do not write generic platform advice such as X drives conversation, Instagram controls image, or TikTok tests hooks unless the artist's actual numbers make that point non-obvious.",
    "Do not lead with missing data. Do not end with missing data. Do not mention private saves or repeat listener gaps unless directly asked by the user.",
    "Never claim rights certainty, royalties, revenue, return on spend, or conversion unless directly saved in the packet.",
    "The sourceLine must be exactly: Based on your saved artist profile, current music in view, public audience signals, and source limits.",
    "Every metric and claimAudit item should use the evidenceIds supplied in the packet. Real evidence rows use saved evidence IDs; setup metadata and catalog scope use stable packet IDs such as artist-profile, working-catalog-scope, latest-project-in-view, or recent-focus-records. If an item has no supplied ID, keep its evidenceIds empty rather than inventing one.",
    "Never print evidence IDs, UUIDs, database IDs, source refs, or parenthetical evidence citations in headlineRead, snapshotSummary, intelligenceSnapshot visible text, or managerRead. IDs belong only in evidenceIds arrays and claimAudit.",
];

const operatingTodaysBriefInstructions = [
    "Write the operating brief as the current desk read after setup. This is not onboarding and it is not a replay of the setup Artist Operating Map.",
    "The operatingContext is current persisted workspace truth. Use it together with artist intelligence to understand what is actually happening across missions, tasks, music, Manager Reads, recent conversations, durable memory, agent reports, rights/splits, meaningful workspace events, and the previous brief.",
    "Follow operatingContext.truthPriority strictly. Current structured workspace state overrides older Manager Reads, conversation prose, memory, and the previous Today's Brief whenever they conflict.",
    "Manager Reads and the previous brief are analysis, not immutable facts. Use their reasoning when still relevant, but never let an old statement such as 'release date unconfirmed' override a newer confirmed release date in structured state.",
    "Recency alone does not make something important. Prioritize blockers, approvals, deadlines, active release or mission decisions, consequential current work, rights/split state, and meaningful changes over casual recent conversation.",
    "Recent conversations matter when they changed or clarified a decision, focus, date, mission, deliverable, approval, blocker, responsibility, or strategy. Do not let a random recent question hijack the brief.",
    "Meaningful events are supporting context, not an Activity feed. Synthesize what they mean; do not produce a chronological recap or a 'What Changed' section.",
    "The previous brief provides continuity only. If the workspace has not materially changed, preserve the management thesis instead of manufacturing a new crisis or new focus for novelty.",
    "The Manager's Read still has exactly 4 sections. Section 1 is Artist Intelligence. Sections 2-4 are the three most important management conclusions across the entire current workspace. Missions, tasks, rights, conversations, releases, and Manager Reads are inputs to those conclusions, not extra sections.",
    "A mission, campaign, release plan, or rollout may be named when it genuinely exists in operatingContext. Never invent one that is absent.",
    "The final section may end with one clear management call when the packet supports it, but do not create a separate 'Today's Move', 'What Changed', 'Updates', or task-list section.",
];

const setupMapTodaysBriefInstructions = [
    "Write the setup-map brief as an Artist Operating Map, not a normal daily brief.",
    "This is the first setup brief after onboarding. The artist has not created missions, tasks, rollout plans, or campaigns yet. Do not pretend any of those exist and do not use campaign, mission, or rollout as visible current-state claims.",
    "The read must feel highly personal: like the Manager has studied this specific artist's career shape, strongest music, audience base, platform behavior, and current leverage before saying anything.",
    "Treat the setup-map structure as a judgment frame, not a rigid template.",
    "The Manager's Read has exactly 4 sections. Section 1 (Artist Intelligence) always comes first: synthesise the key signals into what this artist's current position actually means as a management starting point. Sections 2-4 are the 3 most important operating map themes you can identify from the packet — where the artist is strongest, where the hidden opportunity is, and what the first management focus should be, in that order of build-up.",
    "The first sentence of Artist Intelligence must be unique to this artist and must not sound reusable. It should immediately prove that the desk knows what is special, strange, or commercially important about this specific person.",
    "Interpret catalog, projects, tracks, audience geography, platform behavior, playlist discovery, public reach, and current music as one management map instead of separate facts.",
    "The intelligenceSnapshot metrics must support the specific thesis of this artist. Select only the facts that make the operating map believable; do not fill the table with generic top metrics.",
    "Show career-level understanding when the packet supports it: where the artist's audience lives, which records carry the brand, what the catalog is teaching us, which platforms are overpowered or underpowered, and what kind of management posture fits the evidence.",
    "The fourth section must land on the single clearest management focus: the record, market, or story the workspace should organize around first.",
];

export function buildTodaysBriefInstructions(
  mode: TodaysBriefPromptMode = "operating",
  playbookLensText?: string,
) {
  const base = [
    ...sharedTodaysBriefInstructions,
    ...(mode === "setup-map" ? setupMapTodaysBriefInstructions : operatingTodaysBriefInstructions),
  ].join("\n");
  if (playbookLensText?.trim()) {
    return `${base}\n\n${playbookLensText.trim()}`;
  }
  return base;
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
    generationState: output.generationState === "fallback" ? "fallback" : output.generationState === "fresh" ? "fresh" : undefined,
    generatedAt: readOptionalString(output.generatedAt),
    managerSynthesisRunId: readOptionalString(output.managerSynthesisRunId),
    claimAudit: readClaimAudit(output.claimAudit),
  };

  assertSignalsHaveEvidenceIds(parsed);
  return sanitizeTodaysBriefVisibleCopy(parsed);
}

export function assertSignalsHaveEvidenceIds(output: TodaysBriefOutput) {
  if (!output.intelligenceSnapshot.length) throw new Error("Today's Brief must include artist intelligence.");
  for (const group of output.intelligenceSnapshot) {
    if (!group.metrics.length) throw new Error("Today's Brief intelligence group is missing metrics.");
  }
}

export function assertTodaysBriefEvidenceIsGrounded(output: TodaysBriefOutput, packet: unknown): TodaysBriefOutput {
  const allowed = collectAllowedEvidenceIds(packet);
  let strippedCount = 0;
  const sanitized: TodaysBriefOutput = {
    ...output,
    intelligenceSnapshot: output.intelligenceSnapshot.map((group) => ({
      ...group,
      metrics: group.metrics.map((metric) => {
        const valid = (metric.evidenceIds ?? []).filter((id) => {
          if (allowed.has(id)) return true;
          strippedCount++;
          return false;
        });
        return { ...metric, evidenceIds: valid };
      }),
    })),
    claimAudit: output.claimAudit.map((claim) => {
      const valid = (claim.evidenceIds ?? []).filter((id) => {
        if (allowed.has(id)) return true;
        strippedCount++;
        return false;
      });
      return { ...claim, evidenceIds: valid };
    }),
  };
  if (strippedCount > 0) {
    console.warn(`Today's Brief grounding: stripped ${strippedCount} unsupported evidence ID(s) from model output.`);
  }
  return sanitized;
}

function collectAllowedEvidenceIds(value: unknown, into = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) collectAllowedEvidenceIds(item, into);
    return into;
  }
  if (!isRecord(value)) return into;
  for (const [key, item] of Object.entries(value)) {
    if ((key === "id" || key === "evidenceId") && typeof item === "string" && item.trim()) into.add(item.trim());
    if (key === "evidenceIds" && Array.isArray(item)) {
      for (const id of item) if (typeof id === "string" && id.trim()) into.add(id.trim());
    }
    collectAllowedEvidenceIds(item, into);
  }
  return into;
}

export function sanitizeTodaysBriefVisibleCopy(output: TodaysBriefOutput): TodaysBriefOutput {
  return {
    ...output,
    headlineRead: sanitizeVisibleString(output.headlineRead),
    intelligenceSnapshot: output.intelligenceSnapshot.map((group) => ({
      ...group,
      title: sanitizeVisibleString(group.title),
      insight: sanitizeVisibleString(group.insight),
      metrics: group.metrics.map((metric) => ({
        ...metric,
        label: sanitizeVisibleString(metric.label),
        value: sanitizeVisibleString(metric.value),
        context: metric.context ? sanitizeVisibleString(metric.context) : metric.context,
      })),
    })),
    snapshotSummary: sanitizeVisibleString(output.snapshotSummary),
    managerRead: sanitizeVisibleString(output.managerRead),
    sourceLine: sanitizeVisibleString(output.sourceLine),
    claimAudit: output.claimAudit.map((audit) => ({
      ...audit,
      claim: sanitizeVisibleString(audit.claim),
      limitation: sanitizeVisibleString(audit.limitation),
    })),
  };
}

function sanitizeVisibleString(value: string) {
  return value
    .split(/\n{2,}/)
    .map((paragraph) =>
      visibleCopyReplacements
        .reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), paragraph)
        .replace(/\((?:evidence|source refs?|refs?|ids?)\s*:\s*[^)]*\)/gi, "")
        .replace(/\b(?:evidence|source refs?|refs?|ids?)\s*:\s*[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?:\s*[,;]\s*[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})*/gi, "")
        .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "")
        .replace(/[ \t]+([,.;:!?])/g, "$1")
        .replace(/[ \t]{2,}/g, " ")
        .trim()
    )
    .filter(Boolean)
    .join("\n\n");
}

function readSnapshotGroups(value: unknown): TodaysBriefSnapshotGroupOutput[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((item) => {
    const title = readRequiredString(item.title, "intelligenceSnapshot.title");
    return {
      title,
      insight: readRequiredString(item.insight, "intelligenceSnapshot.insight"),
      metrics: readSnapshotMetrics(item.metrics).map((metric) => normalizeBriefMetricDisplay(metric, title)),
    };
  });
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
import { normalizeBriefMetricDisplay } from "./briefMetricDisplay.ts";
