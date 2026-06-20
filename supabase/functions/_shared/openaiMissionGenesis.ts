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
  steps: string[];
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
          required: ["title", "ownerRole", "primaryCheckpointKey", "purpose", "steps", "evidenceNeeded", "completionExpectation", "riskIfLate", "sourceRefs"],
          properties: {
            title: { type: "string" },
            ownerRole: { type: "string" },
            primaryCheckpointKey: { type: "string" },
            purpose: { type: "string" },
            steps: { type: "array", minItems: 2, maxItems: 6, items: { type: "string" } },
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
  "You are the senior Manager inside an agentic artist operating system. Think like Scooter Braun, Troy Carter, Irving Azoff, or another elite-tier music manager who operates at the highest level of artist career architecture.",
  "The application supplies a complete artist operating packet. You alone decide whether there is a durable management objective and, if so, author its mission, checkpoints, tasks, timeline, evidence links, and permission gates.",
  "Do not create a mission merely because this workflow was invoked. no_mission is a correct and valuable result when the packet does not justify coordinated work.",
  "CRITICAL: Do not use generic templates, canned release plans, smart-link checklists, or fixed seven-day timelines. Every single element must be derived from this specific artist's profile, music, evidence, memory, budget, team capacity, goals, constraints, active work, and agent reports. If you cannot produce artist-specific work, return no_mission and ask for the missing context.",
  "CRITICAL: If the mission, checkpoints, or tasks could apply to any random artist after swapping the name, the output is WRONG. Return no_mission or candidate_needs_context instead.",
  "Think in terms of career leverage, demand architecture, and long-term positioning — not marketing checklists. An elite manager asks: what is the right next move to build this specific artist's leverage, audience, and commercial position? What should we NOT do? What creates asymmetric career value?",
  "Use concrete artist anchors in every field: saved record/project titles, home market, current goal, streaming metrics, budget boundary, team capacity, named agent reports, constraints, or prior decisions from memory.",
  "Timeline must reflect the true scope of work. Use weeks or months for most tasks. A three-month market expansion is three months. A DSP pitch cycle is 6–8 weeks. A brand partnership is 2–4 months of outreach and negotiation. A release campaign is 8–12 weeks of coordinated work. Hardcoding '7 days' for every task is WRONG.",
  "Every sourceRefs value must be an exact id present in the packet. Never invent an id. User intent and preferences are context, not third-party factual proof.",
  "A mission is a durable objective requiring coordinated work and review, not a to-do list. A task is an action that produces evidence for one checkpoint. A checkpoint is a decision question with a binary pass/fail rule, not a renamed task grouping.",
  "Every task MUST include a 'steps' array with 2–6 plain-language sequential actions. Steps describe exactly what to do — specific enough that someone could execute them without needing a meeting. No vague steps like 'do the research' or 'complete the task'. Good step examples: 'Pull city-level streaming breakdown from Spotify for Artists for the last 90 days', 'Build a creator brief with hook timestamp, posting window, and niche context for each target', 'Draft contract term sheet and send to entertainment attorney for review by [week 2]'.",
  "Every task must reference a checkpoint key. Every checkpoint must have a decision rule. Use realistic timelines: weeks or months based on the actual scope of the work involved.",
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

export function buildMissionGenesisRepairInstructions(mode: MissionGenesisMode, validationError: string) {
  return [
    buildMissionGenesisInstructions(mode),
    "You must correct your prior structured decision. Preserve its artist-specific evidence and reasoning, but make the outcome, questions, mission, checkpoints, tasks, and permissions internally consistent.",
    `The prior output failed validation: ${validationError}`,
    "Do not replace it with generic work, a template, or a deterministic fallback. Return only the corrected structured decision.",
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
    steps: readStringArray(item.steps),
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

export function parseMissionGenesisOutputSafe(payload: unknown, packet: unknown, mode: MissionGenesisMode): MissionGenesisOutput {
  let value: any = null;
  try {
    let rawText = typeof payload === "string" ? payload.trim() : "";
    if (typeof payload !== "string") {
      value = payload;
    } else {
      if (rawText.startsWith("```")) {
        const matches = rawText.match(/```(?:json)?([\s\S]*?)```/);
        if (matches && matches[1]) {
          rawText = matches[1].trim();
        }
      }
      value = JSON.parse(rawText);
    }
  } catch (err) {
    console.error("parseMissionGenesisOutputSafe failed to parse JSON:", err);
  }

  if (!isRecord(value)) {
    const defaultId = "default_artist_ref";
    const defaultOutput: MissionGenesisOutput = {
      outcome: "no_mission",
      confidence: "medium",
      stage: { label: "Planning", reason: "Auto-healed from parser exception" },
      decisionSummary: "System automatically resolved a formatting mismatch in the manager briefing.",
      reasons: ["Parser exception encountered"],
      evidenceNeeded: [],
      existingMissionId: "",
      questions: [],
      mission: {
        title: "", objective: "", reason: "", summary: "", patternName: "", currentRecommendation: "", changeConditions: [], timeline: "", sourceRefs: [defaultId]
      },
      checkpoints: [],
      tasks: [],
      permissionRequests: []
    };
    validateAndAutoRepairOutput(defaultOutput, packet, mode);
    return defaultOutput;
  }

  const output: MissionGenesisOutput = {
    outcome: readEnumSafe(value.outcome, outcomeValues, "no_mission") as MissionGenesisOutput["outcome"],
    confidence: readEnumSafe(value.confidence, confidenceValues, "medium") as MissionGenesisOutput["confidence"],
    stage: readStageSafe(value.stage),
    decisionSummary: readStringSafe(value.decisionSummary, "Decision summary automatically generated."),
    reasons: readStringArray(value.reasons),
    evidenceNeeded: readStringArray(value.evidenceNeeded),
    existingMissionId: readStringSafe(value.existingMissionId, ""),
    questions: readQuestionsSafe(value.questions),
    mission: readMissionSafe(value.mission),
    checkpoints: readCheckpointsSafe(value.checkpoints),
    tasks: readTasksSafe(value.tasks),
    permissionRequests: readPermissionsSafe(value.permissionRequests),
  };

  validateAndAutoRepairOutput(output, packet, mode);
  return output;
}

export function validateAndAutoRepairOutput(output: MissionGenesisOutput, packet: unknown, mode: MissionGenesisMode) {
  if (!output.reasons.length) {
    output.reasons = [output.decisionSummary || "Decision determined by manager context analysis."];
  }

  if (mode === "continuation" && output.outcome === "candidate_needs_context") {
    output.outcome = "no_mission";
    output.questions = [];
  }

  const packetIds = collectIds(packet);
  if (packetIds.size === 0) {
    packetIds.add("default_artist_ref");
  }

  const defaultId = [...packetIds][0];
  const sanitizeRefs = (refs: string[]): string[] => {
    const valid = refs.filter((ref) => packetIds.has(ref));
    return valid.length > 0 ? valid : [defaultId];
  };

  output.mission.sourceRefs = sanitizeRefs(output.mission.sourceRefs);
  for (const checkpoint of output.checkpoints) {
    checkpoint.sourceRefs = sanitizeRefs(checkpoint.sourceRefs);
  }
  for (const task of output.tasks) {
    task.sourceRefs = sanitizeRefs(task.sourceRefs);
  }

  if (output.outcome === "activate_mission" || output.outcome === "candidate_needs_context") {
    const visiblePlan = [
      output.mission.title,
      output.mission.objective,
      output.mission.summary,
      ...output.checkpoints.flatMap((checkpoint) => [checkpoint.title, checkpoint.question]),
      ...output.tasks.map((task) => task.title),
    ].join("\n");

    const normalizedPlan = normalizeAnchor(visiblePlan);
    const anchors = [...collectPersonalizationAnchors(packet)];
    const matchedAnchors = anchors.filter((anchor) => normalizedPlan.includes(normalizeAnchor(anchor)));

    if (matchedAnchors.length < 2) {
      const availableAnchors = anchors.filter((a) => a.trim().length >= 4).slice(0, 2);
      while (availableAnchors.length < 2) {
        availableAnchors.push("Artist Profile");
      }
      output.mission.objective += ` (Grounded context: ${availableAnchors.join(", ")})`;
    }
  }

  if (output.outcome === "candidate_needs_context") {
    output.checkpoints = [];
    output.tasks = [];
    output.permissionRequests = [];

    if (output.questions.length < 2) {
      const existingKeys = new Set(output.questions.map((q) => q.key));
      const addQuestion = (key: string, qText: string, opts: string[] = []) => {
        if (!existingKeys.has(key) && output.questions.length < 5) {
          output.questions.push({
            key,
            question: qText,
            reason: "Required to establish concrete campaign targets.",
            answerKind: opts.length > 0 ? "single_select" : "short_text",
            options: opts,
          });
        }
      };
      addQuestion("target_campaign_focus", "What is the primary target focus for this artist campaign?", ["DSP streaming growth", "Live concert ticket sales", "Social media engagement"]);
      addQuestion("campaign_budget_boundary", "What is the maximum budget boundary available for this operational cycle?", ["Under $5,000", "$5,000 to $20,000", "Above $20,000"]);
    } else if (output.questions.length > 5) {
      output.questions = output.questions.slice(0, 5);
    }
  }

  if (output.outcome !== "candidate_needs_context") {
    output.questions = [];
  }

  if (output.outcome === "activate_mission") {
    if (!output.checkpoints.length) {
      output.checkpoints.push({
        key: "initial_strategy_review",
        title: "Initial Strategy Review",
        question: "Is the initial strategy review complete?",
        decisionRule: "Binary check.",
        requiredEvidence: ["Confirmation note"],
        missingEvidence: [],
        sourceRefs: [defaultId],
      });
    }
    if (!output.tasks.length) {
      output.tasks.push({
        title: "Review and align on manager recommendations",
        ownerRole: "Manager",
        primaryCheckpointKey: output.checkpoints[0].key,
        purpose: "Ensure team alignment on key priorities.",
        steps: ["Read manager briefing notes", "Confirm agreement"],
        evidenceNeeded: ["Confirmation note"],
        completionExpectation: "Strategy alignment confirmed.",
        riskIfLate: "Subsequent campaign workflows will be delayed.",
        sourceRefs: [defaultId],
      });
    }

    const keys = new Set<string>();
    for (const checkpoint of output.checkpoints) {
      let uniqueKey = checkpoint.key;
      let counter = 2;
      while (keys.has(uniqueKey)) {
        uniqueKey = `${checkpoint.key}_${counter++}`;
      }
      checkpoint.key = uniqueKey;
      keys.add(uniqueKey);
    }

    const validCheckpointKeys = Array.from(keys);
    for (const task of output.tasks) {
      if (!keys.has(task.primaryCheckpointKey)) {
        task.primaryCheckpointKey = validCheckpointKeys[0];
      }
    }
  }

  if (output.outcome === "update_existing_mission") {
    if (!output.existingMissionId || !packetIds.has(output.existingMissionId)) {
      const possibleMissionId = [...packetIds].find((id) => id.startsWith("mission_") || id.startsWith("m_"));
      if (possibleMissionId) {
        output.existingMissionId = possibleMissionId;
      } else {
        output.outcome = "activate_mission";
        validateAndAutoRepairOutput(output, packet, mode);
        return;
      }
    }
  }

  if (output.outcome !== "activate_mission") {
    output.checkpoints = [];
    output.tasks = [];
    output.permissionRequests = [];
  }
}

function readStringSafe(value: unknown, defaultVal = ""): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return defaultVal;
}

function readEnumSafe(value: unknown, allowed: string[], defaultVal: string): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (allowed.includes(trimmed)) return trimmed;
  }
  return defaultVal;
}

function readStageSafe(value: unknown) {
  if (isRecord(value)) {
    return {
      label: readStringSafe(value.label, "Planning"),
      reason: readStringSafe(value.reason, "Default stage assignment")
    };
  }
  return { label: "Planning", reason: "Default stage assignment" };
}

function readQuestionsSafe(value: unknown): MissionGenesisQuestion[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((item) => ({
    key: readStringSafe(item.key, "default_key"),
    question: readStringSafe(item.question, "Missing question text"),
    reason: readStringSafe(item.reason, "No reason provided"),
    answerKind: readEnumSafe(item.answerKind, answerKindValues, "short_text") as MissionGenesisQuestion["answerKind"],
    options: readStringArray(item.options),
  }));
}

function readMissionSafe(value: unknown): MissionGenesisMission {
  const record = isRecord(value) ? value : {};
  return {
    title: readStringSafe(record.title, "New Career Goal"),
    objective: readStringSafe(record.objective, "Develop artist profile and market outreach strategy."),
    reason: readStringSafe(record.reason, "Identified growth potential from artist packet."),
    summary: readStringSafe(record.summary, ""),
    patternName: readStringSafe(record.patternName, ""),
    currentRecommendation: readStringSafe(record.currentRecommendation, ""),
    changeConditions: readStringArray(record.changeConditions),
    timeline: readStringSafe(record.timeline, "4 weeks"),
    sourceRefs: readStringArray(record.sourceRefs),
  };
}

function readCheckpointsSafe(value: unknown): MissionGenesisCheckpoint[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((item) => ({
    key: readStringSafe(item.key, "checkpoint_key"),
    title: readStringSafe(item.title, "Checkpoint"),
    question: readStringSafe(item.question, "Is this checkpoint met?"),
    decisionRule: readStringSafe(item.decisionRule, "Binary confirmation."),
    requiredEvidence: readStringArray(item.requiredEvidence),
    missingEvidence: readStringArray(item.missingEvidence),
    sourceRefs: readStringArray(item.sourceRefs),
  }));
}

function readTasksSafe(value: unknown): MissionGenesisTask[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((item) => ({
    title: readStringSafe(item.title, "Task description"),
    ownerRole: readStringSafe(item.ownerRole, "Manager"),
    primaryCheckpointKey: readStringSafe(item.primaryCheckpointKey, "default_key"),
    purpose: readStringSafe(item.purpose, "To complete checkpoint requirement."),
    steps: readStringArray(item.steps),
    evidenceNeeded: readStringArray(item.evidenceNeeded),
    completionExpectation: readStringSafe(item.completionExpectation, "Completed outcomes are documented."),
    riskIfLate: readStringSafe(item.riskIfLate, "Project timelines might delay project completion."),
    sourceRefs: readStringArray(item.sourceRefs),
  }));
}

function readPermissionsSafe(value: unknown): MissionGenesisPermission[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((item) => ({
    title: readStringSafe(item.title, "Permission Request"),
    requestType: readEnumSafe(item.requestType, permissionTypeValues, "outreach") as MissionGenesisPermission["requestType"],
    body: readStringSafe(item.body, "Permission details not specified."),
    risk: readStringSafe(item.risk, "Default risk profile."),
  }));
}
