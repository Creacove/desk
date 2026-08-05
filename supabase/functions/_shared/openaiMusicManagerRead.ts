export const MUSIC_MANAGER_READ_SCHEMA_VERSION = "music-manager-read-v2";
export const MUSIC_MANAGER_READ_PROMPT_VERSION = "music-manager-read-grounded-v2";
export const MUSIC_MANAGER_READ_PACKET_VERSION = "music-manager-read-packet-v2";

export type MusicManagerReadSubjectType = "music_item" | "music_project";

export const MUSIC_MANAGER_READ_LIMITS = {
  positionChars: 220,
  managementRoleChars: 160,
  bodyChars: 2400,
  bodyMinWords: 140,
  bodyMaxWords: 280,
  metricMinItems: 0,
  metricMaxItems: 5,
  evidenceMaxItems: 24,
} as const;

export type MusicManagerReadModelOutput = {
  position: string;
  managementRole: string;
  body: string;
  metricEvidenceIds: string[];
  evidenceIds: string[];
};

export type MusicManagerReadMetric = {
  label: string;
  value: string;
  evidenceId: string;
};

export type MusicManagerReadV2 = {
  position: string;
  managementRole: string;
  body: string;
  metrics: MusicManagerReadMetric[];
  evidenceIds: string[];
};

export type ValidationContext = {
  subjectType: MusicManagerReadSubjectType;
  subjectTitle: string;
  allowedEvidenceIds: Set<string>;
  allowedMetricEvidenceIds: Set<string>;
};

const ROOT_OUTPUT_KEYS = [
  "position",
  "managementRole",
  "body",
  "metricEvidenceIds",
  "evidenceIds",
] as const;

export const musicManagerReadJsonSchema = {
  name: "music_manager_read_v2",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ROOT_OUTPUT_KEYS,
    properties: {
      position: { type: "string", maxLength: MUSIC_MANAGER_READ_LIMITS.positionChars },
      managementRole: { type: "string", maxLength: MUSIC_MANAGER_READ_LIMITS.managementRoleChars },
      body: { type: "string", maxLength: MUSIC_MANAGER_READ_LIMITS.bodyChars },
      metricEvidenceIds: {
        type: "array",
        minItems: MUSIC_MANAGER_READ_LIMITS.metricMinItems,
        maxItems: MUSIC_MANAGER_READ_LIMITS.metricMaxItems,
        items: { type: "string" },
      },
      evidenceIds: {
        type: "array",
        minItems: 1,
        maxItems: MUSIC_MANAGER_READ_LIMITS.evidenceMaxItems,
        items: { type: "string" },
      },
    },
  },
} as const;

const FORBIDDEN_VISIBLE_TERMS =
  /\b(openai|chatgpt|anthropic|claude|gemini|playbook|chartmetric|evidence row|third-party|uuid|source ref(?:erence)?|internal id|provider window|ingestion error|provider data|source window|data ingestion|metric window|provider limit|the provider|the api|the database|the prompt)\b/i;

export function parseMusicManagerReadOutput(value: unknown): MusicManagerReadModelOutput {
  if (!isPlainObject(value)) {
    throw new Error("OpenAI music manager read output must be a plain object.");
  }
  assertExactOwnEnumerableKeys(value, ROOT_OUTPUT_KEYS, "root");

  return {
    position: readRequiredString(value.position, "position", MUSIC_MANAGER_READ_LIMITS.positionChars),
    managementRole: readRequiredString(value.managementRole, "managementRole", MUSIC_MANAGER_READ_LIMITS.managementRoleChars),
    body: readRequiredString(value.body, "body", MUSIC_MANAGER_READ_LIMITS.bodyChars),
    metricEvidenceIds: readEvidenceIds(value.metricEvidenceIds, "metricEvidenceIds", false, MUSIC_MANAGER_READ_LIMITS.metricMaxItems, MUSIC_MANAGER_READ_LIMITS.metricMinItems),
    evidenceIds: readEvidenceIds(value.evidenceIds, "evidenceIds", true, MUSIC_MANAGER_READ_LIMITS.evidenceMaxItems, 1),
  };
}

export function validateMusicManagerReadOutput(
  output: MusicManagerReadModelOutput,
  context: ValidationContext,
): string[] {
  const violations: string[] = [];

  if (!containsExactSubjectTitle(output.position, context.subjectTitle)) {
    violations.push(`position must name the exact subject title "${context.subjectTitle}".`);
  }

  const visibleFields: Array<[string, string]> = [
    ["position", output.position],
    ["managementRole", output.managementRole],
    ["body", output.body],
  ];

  if (/\b(as|for|of|with|and|or|in|to|at|by|the|a|an)\s*$/i.test(output.managementRole.trim())) {
    violations.push("managementRole must be a complete role title and not end mid-sentence.");
  }

  for (const [field, text] of visibleFields) {
    const match = text.match(FORBIDDEN_VISIBLE_TERMS);
    if (match) {
      violations.push(`${field} contains forbidden provider or internal terminology "${match[0]}".`);
    }
    for (const evidenceId of context.allowedEvidenceIds) {
      if (evidenceId && text.includes(evidenceId)) {
        violations.push(`${field} exposes evidence ID "${evidenceId}" in visible content.`);
      }
    }
  }

  const seenMetricIds = new Set<string>();
  for (const evidenceId of output.metricEvidenceIds) {
    if (seenMetricIds.has(evidenceId)) {
      violations.push(`metricEvidenceIds must not contain duplicate evidence ID "${evidenceId}".`);
    }
    seenMetricIds.add(evidenceId);
    if (!context.allowedMetricEvidenceIds.has(evidenceId)) {
      violations.push(`metricEvidenceIds contains unsupported metric evidence ID "${evidenceId}".`);
    }
    if (!output.evidenceIds.includes(evidenceId)) {
      violations.push(`evidenceIds must include selected metric evidence ID "${evidenceId}".`);
    }
  }

  const bodyWordCount = countWords(output.body);
  if (bodyWordCount < MUSIC_MANAGER_READ_LIMITS.bodyMinWords || bodyWordCount > MUSIC_MANAGER_READ_LIMITS.bodyMaxWords) {
    violations.push(
      `body must contain ${MUSIC_MANAGER_READ_LIMITS.bodyMinWords}–${MUSIC_MANAGER_READ_LIMITS.bodyMaxWords} words; received ${bodyWordCount}.`,
    );
  }

  validateEvidenceIds(output.evidenceIds, "evidenceIds", context.allowedEvidenceIds, violations);
  return violations;
}

export function buildMusicManagerReadRepairInstructions(violations: string[]): string {
  const violationList = violations.map((violation) => `- ${JSON.stringify(violation)}`).join("\n");
  return [
    "Correct only these violations:",
    violationList,
    "Preserve all already-valid content.",
    "Return the complete structured output again.",
  ].join("\n");
}

export function buildMusicManagerReadInstructions(
  subjectType: MusicManagerReadSubjectType,
  playbookInstructions: string,
): string {
  const isProject = subjectType === "music_project";
  const subject = isProject ? "project" : "song";
  const subjectPossessive = isProject ? "project's" : "song's";
  const systemRole = isProject ? "release-level role this project is becoming" : "role this song is becoming";
  const instructions = [
    `Prompt contract: ${MUSIC_MANAGER_READ_PROMPT_VERSION}.`,
    "Treat input according to these boundaries: VERIFIED_EVIDENCE is reasoningEvidence, metricCandidates, and managerPacketEvidence; USER_CONTEXT is artistProfile goals, direction, budget, and stage; PERSISTED_WORKSPACE_STATE is the requested subject, related records, tracklist, and saved Manager packet; PERMITTED_INFERENCE is bounded comparison and management judgment derived from supplied fields; MISSING_OR_STALE_INFORMATION is evidence freshness, confidence, and limitations.",
    "General model knowledge may help interpret a music-business category, but unsupported knowledge must not become a sourced workspace fact, artist fact, metric, market claim, or recommendation premise.",
    "You are the artist's senior Manager — an experienced A&R and music business operator who writes honest, direct reads grounded in data. You are skeptical of vanity metrics and prioritize what is true over what sounds impressive.",
    `Before writing anything, silently ask yourself: (1) What is the single most distinctive thing about this ${subjectPossessive} data right now — what would surprise a seasoned manager? (2) What do the artist's current stage and current goal make important here? (3) What is the core argument the read should make? Then write only the final judgment, not your private reasoning.`,
    "Do not produce a read with a fixed shape. If the data has one dominant story, tell that story. If it has competing stories, address only those that change the judgment. Let the data dictate the structure of the insight, not the other way around.",
    `Do not open with a generic introduction. Open with the most specific insight the supplied data reveals for this ${subject}. Vary sentence structure and opening across reads.`,
    "Calibrate the read to the artist's current stage and current goal. The same number means something fundamentally different for an emerging artist and an established act.",
    "Interpret direction, not just scale. When the supplied evidence supports a trajectory — growing, stalling, or declining — name what that direction means.",
    `Identify the ${systemRole} in the artist's current system and explain why the supplied evidence supports that judgment.`,
    `In the ${subjectPossessive} Manager's Read, naturally weave together the current judgment, the concrete next move, the attractive but wrong move, and the observable condition that would materially change the judgment. Do not label these as separate sections.`,
    "Use the exact requested subject, artist, markets, comparisons, and numbers supplied in context when they materially support the argument. Use supplied dates and ranks when they change the judgment. Interpret figures instead of dumping a list of metrics.",
    "Write body as 140–280 words in two to four short, natural paragraphs. Lead with the conclusion, keep every paragraph specific to this artist, and remove repetition before removing evidence or management judgment.",
    "Write managementRole as a short, complete 3–7 word executive status title. Never end it mid-sentence.",
    "Select up to five metric candidate IDs supplied in context, preserving the order in which those exact metrics should appear. Select only metrics that materially support the read; never invent or rewrite a metric value. If no metric candidates are supplied, return an empty metricEvidenceIds array rather than inventing a metric.",
    "Do not create missions, tasks, fake commitments, provider references, or descriptions of internal mechanics. Do not mention prompts, APIs, databases, evidence rows, source windows, ingestion, provider limits, internal IDs, or data pipelines.",
    "Do not substitute a comparison artist or comparison track for the requested subject; position must name the exact requested subject.",
    ...(isProject
      ? ["For a project, reason across the full release and supplied tracklist. Identify carrying tracks only when the evidence supports them, but keep the project—not one song—as the subject of the final judgment."]
      : ["For a song, judge the individual track's role inside the wider artist system; do not turn the answer into a project or catalog review."]),
    "Use only supplied evidence IDs in metricEvidenceIds and evidenceIds, and never print evidence IDs in visible text.",
  ];
  const playbook = playbookInstructions.trim();
  if (playbook) instructions.push(playbook);
  return instructions.join("\n");
}

function readRequiredString(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`OpenAI music manager read output ${field} must be a non-empty string.`);
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new Error(`OpenAI music manager read output ${field} exceeds ${maxLength} characters.`);
  }
  return trimmed;
}

function readEvidenceIds(
  value: unknown,
  field: string,
  deduplicate: boolean,
  maxItems: number,
  minItems: number,
): string[] {
  if (!Array.isArray(value) || value.length < minItems || value.length > maxItems) {
    throw new Error(`OpenAI music manager read output ${field} must contain 1–${maxItems} evidence IDs.`);
  }
  const trimmed = value.map((evidenceId) => {
    if (typeof evidenceId !== "string" || !evidenceId.trim()) {
      throw new Error(`OpenAI music manager read output ${field} must contain only non-empty strings.`);
    }
    return evidenceId.trim();
  });
  return deduplicate ? [...new Set(trimmed)] : trimmed;
}

function containsExactSubjectTitle(position: string, subjectTitle: string): boolean {
  const requestedTitle = subjectTitle.trim().normalize("NFC").toLowerCase();
  if (!requestedTitle) return false;
  const normalizedPosition = position.normalize("NFC").toLowerCase();
  let searchStart = 0;
  while (searchStart < normalizedPosition.length) {
    const titleStart = normalizedPosition.indexOf(requestedTitle, searchStart);
    if (titleStart < 0) return false;
    const before = normalizedPosition[titleStart - 1];
    const after = normalizedPosition[titleStart + requestedTitle.length];
    if (!isWordCharacter(before) && !isWordCharacter(after)) return true;
    searchStart = titleStart + 1;
  }
  return false;
}

function isWordCharacter(value: string | undefined): boolean {
  return value !== undefined && /[\p{L}\p{N}_]/u.test(value);
}

function countWords(value: string): number {
  return value.trim().match(/\S+/g)?.length ?? 0;
}

function validateEvidenceIds(
  evidenceIds: string[],
  field: string,
  allowedEvidenceIds: Set<string>,
  violations: string[],
): void {
  for (const evidenceId of evidenceIds) {
    if (!allowedEvidenceIds.has(evidenceId)) {
      violations.push(`${field} contains unsupported evidence ID "${evidenceId}".`);
    }
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertExactOwnEnumerableKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
  field: string,
): void {
  const actualKeys = Object.keys(value);
  const expectedKeySet = new Set(expectedKeys);
  for (const key of actualKeys) {
    if (!expectedKeySet.has(key)) {
      throw new Error(`OpenAI music manager read output ${field} contains unexpected key "${key}".`);
    }
  }
  const actualKeySet = new Set(actualKeys);
  for (const key of expectedKeys) {
    if (!actualKeySet.has(key)) {
      throw new Error(`OpenAI music manager read output ${field}.${key} must be a required own enumerable key.`);
    }
  }
}
