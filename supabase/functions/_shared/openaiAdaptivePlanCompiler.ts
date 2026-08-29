export type AdaptivePlanStrategyState = {
  objective: string;
  strategicThesis: string;
  desiredAudienceBehavior: string;
  creativePillars: string[];
  culturalMeaning: string[];
  constraints: string[];
  scopedBudget: string;
  availableResources: string[];
  horizon: string;
  successIndicators: string[];
  rejectedDirections: string[];
  guardrails: string[];
  updatedBecause: string;
};

export type AdaptivePlanCheckpoint = {
  key: string;
  title: string;
  question: string;
  decisionRule: string;
  managerRead: string;
  nextAction: string;
  watchedSignals: string[];
};

export type AdaptivePlanTask = {
  title: string;
  checkpointKey: string;
  ownerRole: string;
  workMode: "artist_action" | "collaborative";
  purpose: string;
  steps: string[];
  completionMode: "result_note" | "manager_draft";
  completionExpectation: string;
  managerResponsibility: string;
  userResponsibility: string;
  riskIfLate: string;
  availableFrom: string;
  deadline: string;
  estimatedMinutes: number;
};

export type AdaptivePlanPermission = {
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

export type AdaptivePlanOutput = {
  decision: "no_change" | "replan";
  reason: string;
  whatChanged: string;
  missionRecommendation: string;
  planSummary: string;
  strategyState: AdaptivePlanStrategyState;
  checkpoints: AdaptivePlanCheckpoint[];
  tasks: AdaptivePlanTask[];
  permissionRequests: AdaptivePlanPermission[];
};

export type AdaptivePlanValidationContext = {
  allowedDeadlines: string[];
  allowedAvailability: string[];
};

const permissionTypes = [
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

const stringArray = { type: "array", items: { type: "string" } };

export const adaptivePlanCompilerJsonSchema = {
  name: "adaptive_plan_compiler_v1",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["decision", "reason", "whatChanged", "missionRecommendation", "planSummary", "strategyState", "checkpoints", "tasks", "permissionRequests"],
    properties: {
      decision: { type: "string", enum: ["no_change", "replan"] },
      reason: { type: "string" },
      whatChanged: { type: "string" },
      missionRecommendation: { type: "string" },
      planSummary: { type: "string" },
      strategyState: {
        type: "object",
        additionalProperties: false,
        required: ["objective", "strategicThesis", "desiredAudienceBehavior", "creativePillars", "culturalMeaning", "constraints", "scopedBudget", "availableResources", "horizon", "successIndicators", "rejectedDirections", "guardrails", "updatedBecause"],
        properties: {
          objective: { type: "string" },
          strategicThesis: { type: "string" },
          desiredAudienceBehavior: { type: "string" },
          creativePillars: stringArray,
          culturalMeaning: stringArray,
          constraints: stringArray,
          scopedBudget: { type: "string" },
          availableResources: stringArray,
          horizon: { type: "string" },
          successIndicators: stringArray,
          rejectedDirections: stringArray,
          guardrails: stringArray,
          updatedBecause: { type: "string" },
        },
      },
      checkpoints: {
        type: "array",
        maxItems: 8,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["key", "title", "question", "decisionRule", "managerRead", "nextAction", "watchedSignals"],
          properties: {
            key: { type: "string" },
            title: { type: "string" },
            question: { type: "string" },
            decisionRule: { type: "string" },
            managerRead: { type: "string" },
            nextAction: { type: "string" },
            watchedSignals: stringArray,
          },
        },
      },
      tasks: {
        type: "array",
        maxItems: 24,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "checkpointKey", "ownerRole", "workMode", "purpose", "steps", "completionMode", "completionExpectation", "managerResponsibility", "userResponsibility", "riskIfLate", "availableFrom", "deadline", "estimatedMinutes"],
          properties: {
            title: { type: "string" },
            checkpointKey: { type: "string" },
            ownerRole: { type: "string" },
            workMode: { type: "string", enum: ["artist_action", "collaborative"] },
            purpose: { type: "string" },
            steps: { type: "array", minItems: 2, maxItems: 8, items: { type: "string" } },
            completionMode: { type: "string", enum: ["result_note", "manager_draft"] },
            completionExpectation: { type: "string" },
            managerResponsibility: { type: "string" },
            userResponsibility: { type: "string" },
            riskIfLate: { type: "string" },
            availableFrom: { type: "string" },
            deadline: { type: "string" },
            estimatedMinutes: { type: "integer", minimum: 5, maximum: 240 },
          },
        },
      },
      permissionRequests: {
        type: "array",
        maxItems: 8,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "requestType", "body", "risk"],
          properties: {
            title: { type: "string" },
            requestType: { type: "string", enum: permissionTypes },
            body: { type: "string" },
            risk: { type: "string" },
          },
        },
      },
    },
  },
};

export function buildAdaptivePlanCompilerInstructions() {
  return [
    "You are Desk's adaptive Plan Compiler. A real operating condition changed inside an active artist Mission.",
    "Your job is not to brainstorm a fresh campaign. Preserve the Mission's durable objective and strategic intent unless the supplied changed reality directly invalidates them.",
    "First decide whether the current route truly needs a new plan version. If not, return no_change and empty checkpoints/tasks/permissionRequests.",
    "If replanning is required, produce one coherent replacement plan graph. The persistence layer will atomically supersede the old plan; never assume old open tasks remain active.",
    "HARD CLOCK RULE: Manager/Desk machine work does not consume calendar time. Research, analysis, drafting, comparison, review, synthesis, monitoring setup, and replanning happen now and MUST NOT be emitted as tasks or future-day work.",
    "A visible task is only human/team/external work: recording, filming, attending, contacting when permissioned, approving, providing a private fact, performing an offline action, or reporting an outcome Desk cannot observe itself.",
    "A checkpoint is a management decision gate after enough meaningful work or signal exists. It is not a task heading. Prefer a few real checkpoints over one checkpoint per task.",
    "Every human task must be executable without asking 'okay, but how?'. State the exact action, practical sequence, expected result, owner, estimated time, and why delay matters.",
    "For content work, steps must carry the execution itself when relevant: setup/location/resources, people, format or hook, what to say/do, song moment, edit treatment, CTA/desired response, and what result to report. Do not emit generic 'create content' tasks.",
    "Do not invent resources, budgets, collaborators, locations, availability, audience facts, deadlines, release dates, external commitments, or permissions. Use only supplied context.",
    "deadline may be non-empty ONLY when it exactly matches one of context.allowedDeadlines. Otherwise use an empty string.",
    "availableFrom may be non-empty ONLY when it exactly matches one of context.allowedAvailability. Otherwise use an empty string. Do not create fake sequencing by putting Manager thinking on future days.",
    "If the user moved one task because a collaborator/resource/time constraint changed, use that fact as a real constraint and adapt the route around it instead of merely marking the old task late.",
    "strategyState is durable campaign/mission state, not prose chat history. Preserve confirmed cultural meaning, strategic thesis, desired audience behavior, constraints, available resources, scoped budget, rejected directions, guardrails, and success indicators from the prior strategyState when still valid.",
    "Permission boundaries remain in force. Spending, publishing, external outreach/submission, release-plan changes, legal/finance/rights commitments, sensitive commitments, draft export, and source connection require permissionRequests rather than silent execution.",
    "The artist should experience: I told Desk what changed, and Desk changed the plan. Do not make the artist manage dependencies or ask what happens next.",
  ].join("\n");
}

export function parseAdaptivePlanOutput(raw: unknown, context: AdaptivePlanValidationContext): AdaptivePlanOutput {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Adaptive Plan Compiler returned an invalid object.");
  const value = raw as Record<string, any>;
  if (value.decision !== "no_change" && value.decision !== "replan") throw new Error("Adaptive Plan Compiler returned an invalid decision.");

  const output: AdaptivePlanOutput = {
    decision: value.decision,
    reason: text(value.reason),
    whatChanged: text(value.whatChanged),
    missionRecommendation: text(value.missionRecommendation),
    planSummary: text(value.planSummary),
    strategyState: parseStrategy(value.strategyState),
    checkpoints: array(value.checkpoints).map(parseCheckpoint).slice(0, 8),
    tasks: array(value.tasks).map(parseTask).slice(0, 24),
    permissionRequests: array(value.permissionRequests).map(parsePermission).slice(0, 8),
  };

  if (output.decision === "no_change") {
    if (output.checkpoints.length || output.tasks.length || output.permissionRequests.length) {
      throw new Error("A no-change adaptive plan cannot create replacement work.");
    }
    return output;
  }

  if (!output.checkpoints.length) throw new Error("A replacement plan requires at least one checkpoint.");
  const checkpointKeys = new Set(output.checkpoints.map((checkpoint) => checkpoint.key));
  if (checkpointKeys.size !== output.checkpoints.length) throw new Error("Adaptive plan checkpoint keys must be unique.");
  for (const task of output.tasks) {
    if (!checkpointKeys.has(task.checkpointKey)) throw new Error(`Adaptive task references missing checkpoint: ${task.checkpointKey}`);
    if (task.deadline && !context.allowedDeadlines.includes(normalizeIso(task.deadline))) {
      throw new Error(`Adaptive plan invented an unsupported deadline for ${task.title}.`);
    }
    if (task.availableFrom && !context.allowedAvailability.includes(normalizeIso(task.availableFrom))) {
      throw new Error(`Adaptive plan invented unsupported availability for ${task.title}.`);
    }
  }
  return output;
}

function parseStrategy(value: unknown): AdaptivePlanStrategyState {
  const row = record(value);
  return {
    objective: text(row.objective),
    strategicThesis: text(row.strategicThesis),
    desiredAudienceBehavior: text(row.desiredAudienceBehavior),
    creativePillars: strings(row.creativePillars, 12),
    culturalMeaning: strings(row.culturalMeaning, 12),
    constraints: strings(row.constraints, 20),
    scopedBudget: text(row.scopedBudget),
    availableResources: strings(row.availableResources, 20),
    horizon: text(row.horizon),
    successIndicators: strings(row.successIndicators, 16),
    rejectedDirections: strings(row.rejectedDirections, 16),
    guardrails: strings(row.guardrails, 16),
    updatedBecause: text(row.updatedBecause),
  };
}

function parseCheckpoint(value: unknown): AdaptivePlanCheckpoint {
  const row = record(value);
  const key = slug(text(row.key));
  if (!key) throw new Error("Adaptive checkpoint requires a stable key.");
  const checkpoint = {
    key,
    title: text(row.title),
    question: text(row.question),
    decisionRule: text(row.decisionRule),
    managerRead: text(row.managerRead),
    nextAction: text(row.nextAction),
    watchedSignals: strings(row.watchedSignals, 16),
  };
  if (!checkpoint.title || !checkpoint.question || !checkpoint.decisionRule) throw new Error("Adaptive checkpoint is incomplete.");
  return checkpoint;
}

function parseTask(value: unknown): AdaptivePlanTask {
  const row = record(value);
  const workMode = row.workMode === "collaborative" ? "collaborative" : row.workMode === "artist_action" ? "artist_action" : null;
  const completionMode = row.completionMode === "manager_draft" ? "manager_draft" : row.completionMode === "result_note" ? "result_note" : null;
  if (!workMode || !completionMode) throw new Error("Adaptive task has an invalid work/completion mode.");
  const steps = strings(row.steps, 8);
  if (steps.length < 2) throw new Error("Adaptive human task requires at least two executable steps.");
  const estimatedMinutes = Number(row.estimatedMinutes);
  if (!Number.isInteger(estimatedMinutes) || estimatedMinutes < 5 || estimatedMinutes > 240) throw new Error("Adaptive task estimated minutes are invalid.");
  const task = {
    title: text(row.title),
    checkpointKey: slug(text(row.checkpointKey)),
    ownerRole: text(row.ownerRole) || "Artist / team",
    workMode,
    purpose: text(row.purpose),
    steps,
    completionMode,
    completionExpectation: text(row.completionExpectation),
    managerResponsibility: text(row.managerResponsibility),
    userResponsibility: text(row.userResponsibility),
    riskIfLate: text(row.riskIfLate),
    availableFrom: optionalIso(row.availableFrom),
    deadline: optionalIso(row.deadline),
    estimatedMinutes,
  } satisfies AdaptivePlanTask;
  if (!task.title || !task.checkpointKey || !task.purpose || !task.userResponsibility) throw new Error("Adaptive human task is incomplete.");
  return task;
}

function parsePermission(value: unknown): AdaptivePlanPermission {
  const row = record(value);
  const requestType = text(row.requestType) as AdaptivePlanPermission["requestType"];
  if (!permissionTypes.includes(requestType)) throw new Error("Adaptive plan permission type is invalid.");
  return { title: text(row.title), requestType, body: text(row.body), risk: text(row.risk) };
}

function normalizeIso(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString();
}

function optionalIso(value: unknown) {
  const raw = text(value);
  return raw ? normalizeIso(raw) : "";
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 4_000) : "";
}

function strings(value: unknown, limit: number) {
  return array(value).map(text).filter(Boolean).slice(0, limit);
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80);
}
