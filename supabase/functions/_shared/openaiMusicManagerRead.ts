export const MUSIC_MANAGER_READ_SCHEMA_VERSION = "music-manager-read-v2";

export type MusicManagerReadSubjectType = "music_item" | "music_project";

export type MusicManagerReadV2 = {
  position: string;
  managementRole: string;
  body: string;
  decision: string;
  avoid: string;
  watch: string;
  confidence: "low" | "medium" | "high";
  confidenceReason: string;
  signals: Array<{
    label: string;
    value: string;
    meaning: string;
    evidenceIds: string[];
  }>;
  evidenceIds: string[];
};

export type ValidationContext = {
  subjectType: MusicManagerReadSubjectType;
  subjectTitle: string;
  allowedEvidenceIds: Set<string>;
};

const ROOT_OUTPUT_KEYS = [
  "position",
  "managementRole",
  "body",
  "decision",
  "avoid",
  "watch",
  "confidence",
  "confidenceReason",
  "signals",
  "evidenceIds",
] as const;

const SIGNAL_OUTPUT_KEYS = ["label", "value", "meaning", "evidenceIds"] as const;

export const musicManagerReadJsonSchema = {
  name: "music_manager_read_v2",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ROOT_OUTPUT_KEYS,
    properties: {
      position: { type: "string", maxLength: 220 },
      managementRole: { type: "string", maxLength: 100 },
      body: { type: "string", maxLength: 2400 },
      decision: { type: "string", maxLength: 260 },
      avoid: { type: "string", maxLength: 260 },
      watch: { type: "string", maxLength: 260 },
      confidence: { type: "string", enum: ["low", "medium", "high"] },
      confidenceReason: { type: "string", maxLength: 260 },
      signals: {
        type: "array",
        minItems: 3,
        maxItems: 6,
        items: {
          type: "object",
          additionalProperties: false,
          required: SIGNAL_OUTPUT_KEYS,
          properties: {
            label: { type: "string", maxLength: 56 },
            value: { type: "string", maxLength: 18 },
            meaning: { type: "string", maxLength: 120 },
            evidenceIds: {
              type: "array",
              minItems: 1,
              items: { type: "string" },
            },
          },
        },
      },
      evidenceIds: {
        type: "array",
        minItems: 1,
        items: { type: "string" },
      },
    },
  },
} as const;

const FORBIDDEN_VISIBLE_TERMS =
  /\b(openai|chatgpt|anthropic|claude|gemini|playbook|chartmetric|evidence row|third-party|uuid|source ref(?:erence)?|internal id)\b/i;

export function parseMusicManagerReadOutput(value: unknown): MusicManagerReadV2 {
  if (!isPlainObject(value)) {
    throw new Error("OpenAI music manager read output must be a plain object.");
  }
  assertExactOwnEnumerableKeys(value, ROOT_OUTPUT_KEYS, "root");

  return {
    position: readRequiredString(value.position, "position"),
    managementRole: readRequiredString(value.managementRole, "managementRole"),
    body: readRequiredString(value.body, "body"),
    decision: readRequiredString(value.decision, "decision"),
    avoid: readRequiredString(value.avoid, "avoid"),
    watch: readRequiredString(value.watch, "watch"),
    confidence: readConfidence(value.confidence),
    confidenceReason: readRequiredString(value.confidenceReason, "confidenceReason"),
    signals: readSignals(value.signals),
    evidenceIds: readEvidenceIds(value.evidenceIds, "evidenceIds"),
  };
}

export function validateMusicManagerReadOutput(
  output: MusicManagerReadV2,
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
    ["decision", output.decision],
    ["avoid", output.avoid],
    ["watch", output.watch],
    ["confidenceReason", output.confidenceReason],
  ];
  output.signals.forEach((signal, index) => {
    visibleFields.push(
      [`signals[${index}].label`, signal.label],
      [`signals[${index}].value`, signal.value],
      [`signals[${index}].meaning`, signal.meaning],
    );
  });

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

  const judgmentFields: Array<[string, string]> = [
    ["decision", output.decision],
    ["avoid", output.avoid],
    ["watch", output.watch],
  ];
  for (let leftIndex = 0; leftIndex < judgmentFields.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < judgmentFields.length; rightIndex += 1) {
      const [leftName, leftText] = judgmentFields[leftIndex];
      const [rightName, rightText] = judgmentFields[rightIndex];
      if (tokenOverlap(leftText, rightText) >= 0.8) {
        violations.push(`${leftName} and ${rightName} must be meaningfully distinct.`);
      }
    }
  }

  const bodyWordCount = countWords(output.body);
  if (bodyWordCount < 120 || bodyWordCount > 320) {
    violations.push(`body must contain 120–320 words; received ${bodyWordCount}.`);
  }

  validateEvidenceIds(output.evidenceIds, "evidenceIds", context.allowedEvidenceIds, violations);
  const rootEvidenceIds = new Set(output.evidenceIds);
  const missingSignalEvidenceIds = new Set<string>();
  output.signals.forEach((signal, index) => {
    validateEvidenceIds(
      signal.evidenceIds,
      `signals[${index}].evidenceIds`,
      context.allowedEvidenceIds,
      violations,
    );
    for (const evidenceId of signal.evidenceIds) {
      if (!rootEvidenceIds.has(evidenceId)) missingSignalEvidenceIds.add(evidenceId);
    }
  });
  for (const evidenceId of missingSignalEvidenceIds) {
    violations.push(`evidenceIds must include signal evidence ID "${evidenceId}".`);
  }

  return violations;
}

export function buildMusicManagerReadRepairInstructions(violations: string[]): string {
  const violationList = violations.map((violation) => `- ${JSON.stringify(violation)}`).join("\n");
  return [
    "Correct only these violations:",
    violationList,
    "Preserve all already-valid content.",
    "Return the full music_manager_read_v2 schema again.",
  ].join("\n");
}

export function buildMusicManagerReadInstructions(
  subjectType: MusicManagerReadSubjectType,
  playbookInstructions: string,
): string {
  const instructions = [
    "You are the artist's senior Manager.",
    "Deliver judgment on the current position, management role, grounded interpretation, decision, avoid, watch, and calibrated confidence.",
    "Put the conclusion first. Write the body as two or three natural paragraphs in plain, direct English.",
    "Use the exact requested subject, artist, markets, comparisons, and numbers supplied in context.",
    "Distinguish attention, discovery, conversion, and durable fandom when interpreting the evidence.",
    "Format signal values compactly with K, M, #, or %, for example 5.2M.",
    "Make the decision, avoid, and watch meaningfully distinct.",
    "Do not create missions, tasks, fake commitments, provider references, or descriptions of internal mechanics.",
    "Do not substitute a comparison for the requested subject; the position must name the exact requested subject.",
    ...(subjectType === "music_project"
      ? [
          "For a project, reason across the release and identify carrying tracks only when the supplied context supports them.",
        ]
      : []),
    "Use only supplied evidence IDs, and never print evidence IDs in visible text.",
  ];
  const playbook = playbookInstructions.trim();
  if (playbook) instructions.push(playbook);
  return instructions.join("\n");
}

function readSignals(value: unknown): MusicManagerReadV2["signals"] {
  if (!Array.isArray(value) || value.length < 3 || value.length > 6) {
    throw new Error("OpenAI music manager read output signals must contain 3–6 objects.");
  }

  return value.map((signal, index) => {
    if (!isPlainObject(signal)) {
      throw new Error(`OpenAI music manager read output signals[${index}] must be a plain object.`);
    }
    assertExactOwnEnumerableKeys(signal, SIGNAL_OUTPUT_KEYS, `signals[${index}]`);
    return {
      label: readRequiredString(signal.label, `signals[${index}].label`),
      value: readRequiredString(signal.value, `signals[${index}].value`),
      meaning: readRequiredString(signal.meaning, `signals[${index}].meaning`),
      evidenceIds: readEvidenceIds(signal.evidenceIds, `signals[${index}].evidenceIds`),
    };
  });
}

function readRequiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`OpenAI music manager read output ${field} must be a non-empty string.`);
  }
  return value.trim();
}

function readConfidence(value: unknown): MusicManagerReadV2["confidence"] {
  if (value !== "low" && value !== "medium" && value !== "high") {
    throw new Error("OpenAI music manager read output confidence must be low, medium, or high.");
  }
  return value;
}

function readEvidenceIds(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`OpenAI music manager read output ${field} must be an array of strings.`);
  }
  if (value.length === 0) {
    throw new Error(`OpenAI music manager read output ${field} must contain at least one evidence ID.`);
  }

  const trimmed = value.map((evidenceId) => {
    if (typeof evidenceId !== "string" || !evidenceId.trim()) {
      throw new Error(`OpenAI music manager read output ${field} must contain only non-empty strings.`);
    }
    return evidenceId.trim();
  });
  return [...new Set(trimmed)];
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

function tokenOverlap(left: string, right: string): number {
  const leftTokens = new Set(tokenize(left));
  const rightTokens = new Set(tokenize(right));
  const smallerSize = Math.min(leftTokens.size, rightTokens.size);
  if (smallerSize === 0) return 0;

  let intersectionSize = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) intersectionSize += 1;
  }
  return intersectionSize / smallerSize;
}

function tokenize(value: string): string[] {
  return value.normalize("NFC").toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
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
