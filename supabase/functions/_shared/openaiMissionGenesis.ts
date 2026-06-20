export type MissionGenesisMode = "initial" | "continuation";

export type MissionGenesisQuestion = {
  key: string;
  question: string;
  reason: string;
  answerKind: "short_text" | "single_select" | "multi_select" | "money_range";
  options: string[];
};

export type MissionGenesisMission = {
  title: string;
  objective: string;
  reason: string;
  summary: string;
  patternName: string;
  currentRecommendation: string;
  changeConditions: string[];
  timeline: string;
  sourceRefs: string[];
};

export type MissionGenesisCheckpoint = {
  key: string;
  title: string;
  question: string;
  decisionRule: string;
  requiredEvidence: string[];
  missingEvidence: string[];
  sourceRefs: string[];
};

export type MissionGenesisTask = {
  title: string;
  ownerRole: string;
  primaryCheckpointKey: string;
  purpose: string;
  evidenceNeeded: string[];
  completionExpectation: string;
  riskIfLate: string;
  sourceRefs: string[];
};

export type MissionGenesisPermission = {
  title: string;
  requestType:
    | "spend"
    | "external_outreach"
    | "submission"
    | "publish"
    | "schedule"
    | "release_plan_change"
    | "legal_finance_rights"
    | "sensitive_commitment"
    | "draft_export"
    | "source_connection";
  body: string;
  risk: string;
};

export type MissionGenesisOutput = {
  outcome: "activate_mission" | "candidate_needs_context" | "request_evidence" | "update_existing_mission" | "no_mission";
  confidence: "high" | "medium" | "low" | "limited";
  stage: { label: string; reason: string };
  decisionSummary: string;
  reasons: string[];
  evidenceNeeded: string[];
  existingMissionId: string;
  questions: MissionGenesisQuestion[];
  mission: MissionGenesisMission;
  checkpoints: MissionGenesisCheckpoint[];
  tasks: MissionGenesisTask[];
  permissionRequests: MissionGenesisPermission[];
};

const outcomeValues = ["activate_mission", "candidate_needs_context", "request_evidence", "update_existing_mission", "no_mission"];
const confidenceValues = ["high", "medium", "low", "limited"];
const answerKindValues = ["short_text", "single_select", "multi_select", "money_range"];
const permissionTypeValues = [
  "spend",
  "external_outreach",
  "submission",
  "publish",
  "schedule",
  "release_plan_change",
  "legal_finance_rights",
  "sensitive_commitment",
  "draft_export",
  "source_connection",
];

const stringArraySchema = { type: "array", items: { type: "string" } };

export const missionGenesisJsonSchema = {
  name: "mission_genesis_v2",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "outcome",
      "confidence",
      "stage",
      "decisionSummary",
      "reasons",
      "evidenceNeeded",
      "existingMissionId",
      "questions",
      "mission",
      "checkpoints",
      "tasks",
      "permissionRequests",
    ],
    properties: {
      outcome: { type: "string", enum: outcomeValues },
      confidence: { type: "string", enum: confidenceValues },
      stage: {
        type: "object",
        additionalProperties: false,
        required: ["label", "reason"],
        properties: { label: { type: "string" }, reason: { type: "string" } },
      },
      decisionSummary: { type: "string" },
      reasons: stringArraySchema,
      evidenceNeeded: stringArraySchema,
      existingMissionId: { type: "string" },
      questions: {
        type: "array",
        maxItems: 5,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["key", "question", "reason", "answerKind", "options"],
          properties: {
            key: { type: "string" },
            question: { type: "string" },
            reason: { type: "string" },
            answerKind: { type: "string", enum: answerKindValues },
            options: stringArraySchema,
          },
        },
      },
      mission: {
        type: "object",
        additionalProperties: false,
        required: ["title", "objective", "reason", "summary", "patternName", "currentRecommendation", "changeConditions", "timeline", "sourceRefs"],
        properties: {
          title: { type: "string" },
          objective: { type: "string" },
          reason: { type: "string" },
          summary: { type: "string" },
          patternName: { type: "string" },
          currentRecommendation: { type: "string" },
          changeConditions: stringArraySchema,
          timeline: { type: "string" },
          sourceRefs: stringArraySchema,
        },
      },
      checkpoints: {
        type: "array",
        maxItems: 8,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["key", "title", "question", "decisionRule", "requiredEvidence", "missingEvidence", "sourceRefs"],
          properties: {
            key: { type: "string" },
            title: { type: "string" },
            question: { type: "string" },
            decisionRule: { type: "string" },
            requiredEvidence: stringArraySchema,
            missingEvidence: stringArraySchema,
            sourceRefs: stringArraySchema,
          },
        },
      },
      tasks: {
        type: "array",
        maxItems: 20,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "ownerRole", "primaryCheckpointKey", "purpose", "evidenceNeeded", "completionExpectation", "riskIfLate", "sourceRefs"],
          properties: {
            title: { type: "string" },
            ownerRole: { type: "string" },
            primaryCheckpointKey: { type: "string" },
            purpose: { type: "string" },
            evidenceNeeded: stringArraySchema,
            completionExpectation: { type: "string" },
            riskIfLate: { type: "string" },
            sourceRefs: stringArraySchema,
          },
        },
      },
      permissionRequests: {
        type: "array",
        maxItems: 10,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "requestType", "body", "risk"],
          properties: {
            title: { type: "string" },
            requestType: { type: "string", enum: permissionTypeValues },
            body: { type: "string" },
            risk: { type: "string" },
          },
        },
      },
    },
  },
};

const sharedInstructions = [
  "You are the senior Manager inside an agentic artist operating system. OpenAI is the decision engine for Mission Genesis.",
  "The application supplies a complete artist operating packet. You alone decide whether there is a durable management objective and, if so, author its mission, checkpoints, tasks, timeline, evidence links, and permission gates.",
  "Do not create a mission merely because this workflow was invoked. no_mission is a correct and valuable result when the packet does not justify coordinated work.",
  "Do not use templates, default release plans, canned audience missions, or fixed seven-day timelines. Derive the work from this artist's actual profile, music, evidence, memory, budget, team, goals, constraints, active work, and agent reports.",
  "If the same mission could be returned for another artist after changing only the artist name, return no_mission or ask for the exact missing context instead.",
  "Use concrete artist anchors in the objective: saved record/project titles, markets, goals, constraints, team capacity, budget boundary, business risk, or named evidence.",
  "Every sourceRefs value must be an exact id present in the packet. Never invent an id. User intent and preferences are context, not third-party factual proof.",
  "A mission is a durable objective requiring coordinated work and review. A task is an action that produces evidence for one checkpoint. A checkpoint is a decision question, not a renamed task list.",
  "Every task must reference a checkpoint key. Every checkpoint must have a decision rule. Use realistic timelines: days, weeks, or months according to the work.",
  "Ask every material user-controlled question at once, between two and five questions. Do not ask anything already answered by profile, memory, evidence, or prior context answers.",
  "Missing source proof produces request_evidence. Missing user-controlled intent, capacity, budget, timing, or boundaries may produce candidate_needs_context.",
  "If active work already owns the objective, return update_existing_mission with its exact id. Do not create duplicate work.",
  "External outreach, spend, publishing, submission, scheduling, release-plan changes, sensitive commitments, and legal/finance/rights conclusions require a permission request.",
  "For no_mission or request_evidence, leave mission text fields empty and return empty checkpoints, tasks, and permissionRequests.",
  "For candidate_needs_context, provide a grounded candidate mission identity and questions, but leave checkpoints, tasks, and permissionRequests empty until the answers are synthesized.",
  "For activate_mission, return a complete mission with at least one checkpoint and at least one task. The plan must be executable and specific, not advice-shaped prose.",
];

export function buildMissionGenesisInstructions(mode: MissionGenesisMode) {
  return [
    ...sharedInstructions,
    mode === "continuation"
      ? "This is the continuation after the user answered the complete context batch. The supplied prior candidate is the work being evaluated and is not a duplicate existing mission. You must not ask another round of context questions. Decide activate_mission, request_evidence, update_existing_mission, or no_mission."
      : "This is the initial synthesis. Ask one complete batch of context questions only when those answers materially change whether or how the mission should exist.",
  ].join("\n");
}

export function parseMissionGenesisOutput(payload: unknown, packet: unknown, mode: MissionGenesisMode): MissionGenesisOutput {
  const value = typeof payload === "string" ? JSON.parse(payload) : payload;
  if (!isRecord(value)) throw new Error("OpenAI Mission Genesis output was not an object.");

  const output: MissionGenesisOutput = {
    outcome: readEnum(value.outcome, outcomeValues, "outcome") as MissionGenesisOutput["outcome"],
    confidence: readEnum(value.confidence, confidenceValues, "confidence") as MissionGenesisOutput["confidence"],
    stage: readStage(value.stage),
    decisionSummary: readString(value.decisionSummary, "decisionSummary", true),
    reasons: readStringArray(value.reasons),
    evidenceNeeded: readStringArray(value.evidenceNeeded),
    existingMissionId: readString(value.existingMissionId, "existingMissionId", false),
    questions: readQuestions(value.questions),
    mission: readMission(value.mission),
    checkpoints: readCheckpoints(value.checkpoints),
    tasks: readTasks(value.tasks),
    permissionRequests: readPermissions(value.permissionRequests),
  };

  validateOutput(output, packet, mode);
  return output;
}

function validateOutput(output: MissionGenesisOutput, packet: unknown, mode: MissionGenesisMode) {
  if (!output.reasons.length) throw new Error("OpenAI Mission Genesis output must explain its decision.");
  if (mode === "continuation" && output.outcome === "candidate_needs_context") {
    throw new Error("OpenAI Mission Genesis attempted another round of context questions after the complete answer batch.");
  }

  const packetIds = collectIds(packet);
  for (const ref of [
    ...output.mission.sourceRefs,
    ...output.checkpoints.flatMap((checkpoint) => checkpoint.sourceRefs),
    ...output.tasks.flatMap((task) => task.sourceRefs),
  ]) {
    if (!packetIds.has(ref)) throw new Error(`OpenAI Mission Genesis returned unknown source reference: ${ref}.`);
  }

  const visiblePlan = [
    output.mission.title,
    output.mission.objective,
    output.mission.summary,
    ...output.checkpoints.flatMap((checkpoint) => [checkpoint.title, checkpoint.question]),
    ...output.tasks.map((task) => task.title),
  ].join("\n");
  if (/test whether current attention is becoming repeatable audience behavior|prepare first manager read|objective quality/i.test(visiblePlan)) {
    throw new Error("OpenAI Mission Genesis returned generic or retired Mission Genesis copy.");
  }

  if (output.outcome === "activate_mission" || output.outcome === "candidate_needs_context") {
    const normalizedPlan = normalizeAnchor(visiblePlan);
    const matchedAnchors = [...collectPersonalizationAnchors(packet)].filter((anchor) => normalizedPlan.includes(normalizeAnchor(anchor)));
    if (matchedAnchors.length < 2) {
      throw new Error("OpenAI Mission Genesis plan is missing artist-specific anchors from the operating packet.");
    }
  }

  if (output.outcome === "candidate_needs_context") {
    if (output.questions.length < 2 || output.questions.length > 5) throw new Error("Mission Genesis context must contain two to five questions.");
    assertMissionIdentity(output.mission);
    if (output.checkpoints.length || output.tasks.length || output.permissionRequests.length) {
      throw new Error("Mission Genesis cannot create plan work before required context is answered.");
    }
    return;
  }

  if (output.questions.length) throw new Error("Mission Genesis returned questions for an outcome that does not accept context.");

  if (output.outcome === "activate_mission") {
    assertMissionIdentity(output.mission);
    if (output.mission.sourceRefs.length < Math.min(2, packetIds.size)) {
      throw new Error("Mission Genesis active mission is not grounded in enough packet sources.");
    }
    if (!output.checkpoints.length || !output.tasks.length) throw new Error("Mission Genesis active mission requires checkpoints and tasks.");
    const keys = new Set<string>();
    for (const checkpoint of output.checkpoints) {
      if (keys.has(checkpoint.key)) throw new Error(`Mission Genesis returned duplicate checkpoint key: ${checkpoint.key}.`);
      keys.add(checkpoint.key);
    }
    for (const task of output.tasks) {
      if (!keys.has(task.primaryCheckpointKey)) throw new Error(`Mission Genesis task references missing checkpoint: ${task.primaryCheckpointKey}.`);
    }
    return;
  }

  if (output.outcome === "update_existing_mission") {
    if (!output.existingMissionId || !packetIds.has(output.existingMissionId)) {
      throw new Error("Mission Genesis update outcome does not reference an existing mission in the packet.");
    }
    return;
  }

  if (output.checkpoints.length || output.tasks.length || output.permissionRequests.length) {
    throw new Error("Mission Genesis cannot persist plan work for a non-mission outcome.");
  }
}

function assertMissionIdentity(mission: MissionGenesisMission) {
  for (const [key, value] of Object.entries({ title: mission.title, objective: mission.objective, reason: mission.reason, summary: mission.summary, patternName: mission.patternName, currentRecommendation: mission.currentRecommendation, timeline: mission.timeline })) {
    if (!value.trim()) throw new Error(`OpenAI Mission Genesis output missing mission.${key}.`);
  }
  if (!mission.changeConditions.length) throw new Error("OpenAI Mission Genesis mission is missing change conditions.");
  if (!mission.sourceRefs.length) throw new Error("OpenAI Mission Genesis mission is missing source references.");
}

function readStage(value: unknown) {
  if (!isRecord(value)) throw new Error("OpenAI Mission Genesis output missing stage.");
  return { label: readString(value.label, "stage.label", true), reason: readString(value.reason, "stage.reason", true) };
}

function readQuestions(value: unknown): MissionGenesisQuestion[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((item) => ({
    key: readString(item.key, "questions.key", true),
    question: readString(item.question, "questions.question", true),
    reason: readString(item.reason, "questions.reason", true),
    answerKind: readEnum(item.answerKind, answerKindValues, "questions.answerKind") as MissionGenesisQuestion["answerKind"],
    options: readStringArray(item.options),
  }));
}

function readMission(value: unknown): MissionGenesisMission {
  if (!isRecord(value)) throw new Error("OpenAI Mission Genesis output missing mission object.");
  return {
    title: readString(value.title, "mission.title", false),
    objective: readString(value.objective, "mission.objective", false),
    reason: readString(value.reason, "mission.reason", false),
    summary: readString(value.summary, "mission.summary", false),
    patternName: readString(value.patternName, "mission.patternName", false),
    currentRecommendation: readString(value.currentRecommendation, "mission.currentRecommendation", false),
    changeConditions: readStringArray(value.changeConditions),
    timeline: readString(value.timeline, "mission.timeline", false),
    sourceRefs: readStringArray(value.sourceRefs),
  };
}

function readCheckpoints(value: unknown): MissionGenesisCheckpoint[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((item) => ({
    key: readString(item.key, "checkpoints.key", true),
    title: readString(item.title, "checkpoints.title", true),
    question: readString(item.question, "checkpoints.question", true),
    decisionRule: readString(item.decisionRule, "checkpoints.decisionRule", true),
    requiredEvidence: readStringArray(item.requiredEvidence),
    missingEvidence: readStringArray(item.missingEvidence),
    sourceRefs: readStringArray(item.sourceRefs),
  }));
}

function readTasks(value: unknown): MissionGenesisTask[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((item) => ({
    title: readString(item.title, "tasks.title", true),
    ownerRole: readString(item.ownerRole, "tasks.ownerRole", true),
    primaryCheckpointKey: readString(item.primaryCheckpointKey, "tasks.primaryCheckpointKey", true),
    purpose: readString(item.purpose, "tasks.purpose", true),
    evidenceNeeded: readStringArray(item.evidenceNeeded),
    completionExpectation: readString(item.completionExpectation, "tasks.completionExpectation", true),
    riskIfLate: readString(item.riskIfLate, "tasks.riskIfLate", true),
    sourceRefs: readStringArray(item.sourceRefs),
  }));
}

function readPermissions(value: unknown): MissionGenesisPermission[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((item) => ({
    title: readString(item.title, "permissionRequests.title", true),
    requestType: readEnum(item.requestType, permissionTypeValues, "permissionRequests.requestType") as MissionGenesisPermission["requestType"],
    body: readString(item.body, "permissionRequests.body", true),
    risk: readString(item.risk, "permissionRequests.risk", true),
  }));
}

function collectIds(value: unknown, ids = new Set<string>()) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectIds(item, ids));
    return ids;
  }
  if (!isRecord(value)) return ids;
  if (typeof value.id === "string" && value.id.trim()) ids.add(value.id.trim());
  Object.values(value).forEach((item) => collectIds(item, ids));
  return ids;
}

function collectPersonalizationAnchors(value: unknown, anchors = new Set<string>(), parentKey = "") {
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === "string" && /goals|genres/i.test(parentKey)) addAnchor(anchors, item);
      else collectPersonalizationAnchors(item, anchors, parentKey);
    }
    return anchors;
  }
  if (!isRecord(value)) return anchors;
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string" && /^(name|title|homeMarket|content|label|subject)$/i.test(key)) addAnchor(anchors, item);
    else collectPersonalizationAnchors(item, anchors, key);
  }
  return anchors;
}

function addAnchor(anchors: Set<string>, value: string) {
  const anchor = value.trim();
  if (anchor.length >= 4 && !/^(artist|unknown|none|active|developing|released)$/i.test(anchor)) anchors.add(anchor);
}

function normalizeAnchor(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function readString(value: unknown, key: string, required: boolean) {
  if (typeof value !== "string") {
    if (!required) return "";
    throw new Error(`OpenAI Mission Genesis output missing ${key}.`);
  }
  const text = value.trim();
  if (required && !text) throw new Error(`OpenAI Mission Genesis output missing ${key}.`);
  return text;
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim()) : [];
}

function readEnum(value: unknown, allowed: string[], key: string) {
  if (typeof value !== "string" || !allowed.includes(value)) throw new Error(`OpenAI Mission Genesis output has invalid ${key}.`);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
