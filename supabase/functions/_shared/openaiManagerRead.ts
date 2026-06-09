export type ManagerReadSubjectType = "music_item" | "music_project";

export type ManagerReadPacket = {
  subjectType: ManagerReadSubjectType;
  subject: Record<string, unknown>;
  identifiers: Array<Record<string, unknown>>;
  evidence: Array<Record<string, unknown>>;
  tracklist: Array<Record<string, unknown>>;
  limitations: string[];
  sourcePanelInstruction: string;
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
};

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
    ],
    properties: {
      situationLine: { type: "string", maxLength: 220 },
      headline: { type: "string", maxLength: 90 },
      managerRead: { type: "string", maxLength: 860 },
      nextMove: { type: "string", maxLength: 220 },
      watchNext: { type: "string", maxLength: 220 },
      generationState: { type: "string", enum: ["fresh", "limited"] },
      whatMatters: { type: "array", items: { type: "string" } },
      doNotDoYet: { type: "array", items: { type: "string" } },
      missingProof: { type: "array", items: { type: "string" } },
      confidence: { type: "string", enum: ["low", "medium", "high", "unknown"] },
      evidenceIdsUsed: { type: "array", items: { type: "string" } },
      sourcePanelNote: { type: "string" },
    },
  },
};

export function buildManagerReadInstructions(subjectType: ManagerReadSubjectType) {
  const subjectLabel = subjectType === "music_project" ? "project" : "track";
  return [
    "You are the artist's senior manager. You have broken major records and you know the difference between noise, exposure, demand, conversion, and career leverage.",
    "Write in basic English that an independent artist can understand without analytics training.",
    "Explain what happened, why it matters, and what to do next.",
    "Do not use analytics jargon such as playlist concentration, trajectory, conversion signal, or platform footprint.",
    "Write in first person as the Manager. Use I found, I am seeing, I would, and I would not where natural.",
    "The situationLine field must be one short, concrete line that says where the song stands now. It must not repeat the Manager Read.",
    "The Manager Read must be 2 short paragraphs maximum, 130 words maximum, and 4 sentences maximum. The nextMove field must be one sentence, 36 words maximum.",
    "The watchNext field must say exactly what to check next and why, in 30 words maximum.",
    "Use generationState fresh when the evidence supports a useful decision, or limited when important recent or private proof is missing.",
    "Sound calm and commercially sharp. Do not sound like a legal memo, metadata export, analyst dashboard, or motivational speech.",
    "Do not say I will demand, within 48 hours I will, immediately force, greenlight, or any other fake authority unless an actual user task says that action is approved.",
    "Do not say Chartmetric found. Do not say Spotify confirms. Do not name backend providers in the main read unless the user must know the source to avoid a false claim.",
    "Provider names belong in the Sources panel, not the Manager Read. The sourcePanelNote field can mention source names and limitations.",
    "Do not call the whole packet catalog-only, metadata-only, or only catalog metadata when evidence entries include third-party metrics, playlist counts, charts, or social/radio activity.",
    "When both catalog metadata and third-party intelligence are present, say that third-party intelligence shows attention but private DSP/distributor proof is still missing.",
    "When the packet has many evidence rows, synthesize the pattern. Rank by commercial usefulness: current/trailing streams, playlist reach and editorial support, social video scale, Shazam/radio, charts or territory ranks, then metadata.",
    "Translate database metric names into plain manager language. Never expose raw names like provider_window, video_creates, playlist_total_reach, or spotify_trailing_28d_streams in the main read.",
    "Do not make the main read mainly about missing data when useful intelligence exists. Use missing proof to set the guardrails after naming the opportunity.",
    "The nextMove should be an operating decision, not just a request for more data. If rights are blocked, say how to clear them and what commercial move becomes possible after that.",
    "Do not dump credits, copyright notices, label text, UPCs, asset IDs, cover image facts, duration, or license language unless that one detail changes the decision.",
    "Do not say movement, signal, activity, or momentum unless you immediately name the concrete detail behind it.",
    "Use exact numbers, names, dates, placements, ranks, and trends from the packet when they change the management judgment.",
    `Make this feel specific to this ${subjectLabel}. Do not write a reusable template, dashboard summary, or generic music advice.`,
    "Do not list every fact. Pick the details that change the decision.",
    "Never invent private Spotify saves, repeat listeners, source-of-stream, revenue, rights certainty, campaign ROI, or conversion.",
    "If private proof is missing, say exactly what proof would change the decision.",
    "End with a practical management move, not a vague recommendation.",
  ].join("\n");
}

export function parseManagerReadOutput(payload: unknown): ManagerReadOutput {
  const output = typeof payload === "string" ? JSON.parse(payload) : payload;
  if (!isRecord(output)) throw new Error("OpenAI manager read output was not an object.");

  return {
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
  };
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
