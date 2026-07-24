import type {
  MissionGenesisCheckpoint,
  MissionGenesisMission,
  MissionGenesisPermission,
  MissionGenesisQuestion,
  MissionGenesisTask,
} from "./openaiMissionGenesis.ts";

export type ManagerConversationCreatedWork = {
  type: "music_item" | "mission" | "task";
  title: string;
  body: string;
  id: string;
  parentMissionId?: string;
  status?: "created" | "updated" | "approval_required" | "failed" | "pending";
};

export type ManagerMissionGraphDecision = {
  outcome: "activate_mission" | "update_existing_mission";
  confidence: "high" | "medium" | "low" | "limited";
  decisionSummary: string;
  evidenceNeeded: string[];
  existingMissionId: string;
  reasons: string[];
  mission: MissionGenesisMission;
  checkpoints: MissionGenesisCheckpoint[];
  tasks: MissionGenesisTask[];
  permissionRequests: MissionGenesisPermission[];
};

export type ManagerConversationAction = {
  actionType: string;
  targetType: string;
  title: string;
  body: string;
  approvalRequired: boolean;
};

export type ManagerConversationOutput = {
  topic: string;
  summary: string;
  status: string;
  confidence: "high" | "medium" | "low" | "unknown";
  classification: string;
  actionPolicy:
    | "answer_only"
    | "save_memory"
    | "create_decision_package"
    | "create_mission"
    | "update_mission"
    | "update_task"
    | "review_checkpoint"
    | "request_permission"
    | "request_evidence";
  responseBody: string;
  evidenceIds: string[];
  limitations: string[];
  createdWork: ManagerConversationCreatedWork[];
  missionGraphDecisions: ManagerMissionGraphDecision[];
  contextQuestions: MissionGenesisQuestion[];
  proposedActions: ManagerConversationAction[];
  durableMemory: string[];
};

const stringArraySchema = { type: "array", items: { type: "string" } };
const missionSchema = {
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
};
const checkpointSchema = {
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
};
const taskSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "ownerRole", "primaryCheckpointKey", "purpose", "steps", "evidenceNeeded", "completionExpectation", "completionMode", "deliverableTitle", "deliverableRequirements", "managerResponsibility", "userResponsibility", "riskIfLate", "sourceRefs"],
  properties: {
    title: { type: "string" },
    ownerRole: { type: "string" },
    primaryCheckpointKey: { type: "string" },
    purpose: { type: "string" },
    steps: stringArraySchema,
    evidenceNeeded: stringArraySchema,
    completionExpectation: { type: "string" },
    completionMode: { type: "string", enum: ["result_note", "manager_draft", "evidence"] },
    deliverableTitle: { type: "string" },
    deliverableRequirements: stringArraySchema,
    managerResponsibility: { type: "string" },
    userResponsibility: { type: "string" },
    riskIfLate: { type: "string" },
    sourceRefs: stringArraySchema,
  },
};
const permissionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "requestType", "body", "risk"],
  properties: {
    title: { type: "string" },
    requestType: {
      type: "string",
      enum: ["spend", "external_outreach", "submission", "publish", "schedule", "release_plan_change", "legal_finance_rights", "sensitive_commitment", "draft_export", "source_connection"],
    },
    body: { type: "string" },
    risk: { type: "string" },
  },
};
const contextQuestionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["key", "question", "reason", "answerKind", "options", "recommendedAnswer", "recommendationReason"],
  properties: {
    key: { type: "string" },
    question: { type: "string" },
    reason: { type: "string" },
    answerKind: { type: "string", enum: ["short_text", "single_select", "multi_select", "money_range"] },
    options: stringArraySchema,
    recommendedAnswer: { type: "string" },
    recommendationReason: { type: "string" },
  },
};

export const managerConversationJsonSchema = {
  name: "manager_conversation_router_v1",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "topic",
      "summary",
      "status",
      "confidence",
      "classification",
      "actionPolicy",
      "responseBody",
      "evidenceIds",
      "limitations",
      "createdWork",
      "missionGraphDecisions",
      "contextQuestions",
      "proposedActions",
      "durableMemory",
    ],
    properties: {
      topic: { type: "string" },
      summary: { type: "string" },
      status: { type: "string" },
      confidence: { type: "string", enum: ["high", "medium", "low", "unknown"] },
      classification: { type: "string" },
      actionPolicy: {
        type: "string",
        enum: [
          "answer_only",
          "save_memory",
          "create_decision_package",
          "create_mission",
          "update_mission",
          "update_task",
          "review_checkpoint",
          "request_permission",
          "request_evidence",
        ],
      },
      responseBody: { type: "string" },
      evidenceIds: stringArraySchema,
      limitations: stringArraySchema,
      createdWork: {
        type: "array",
        maxItems: 8,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["type", "title", "body", "id", "parentMissionId", "status"],
          properties: {
            type: { type: "string", enum: ["music_item", "mission", "task"] },
            title: { type: "string" },
            body: { type: "string" },
            id: { type: "string" },
            parentMissionId: { type: "string" },
            status: { type: "string", enum: ["created", "updated", "approval_required", "failed", "pending"] },
          },
        },
      },
      missionGraphDecisions: {
        type: "array",
        maxItems: 4,
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "outcome",
            "confidence",
            "decisionSummary",
            "evidenceNeeded",
            "existingMissionId",
            "reasons",
            "mission",
            "checkpoints",
            "tasks",
            "permissionRequests",
          ],
          properties: {
            outcome: { type: "string", enum: ["activate_mission", "update_existing_mission"] },
            confidence: { type: "string", enum: ["high", "medium", "low", "limited"] },
            decisionSummary: { type: "string" },
            evidenceNeeded: stringArraySchema,
            existingMissionId: { type: "string" },
            reasons: stringArraySchema,
            mission: missionSchema,
            checkpoints: { type: "array", items: checkpointSchema },
            tasks: { type: "array", items: taskSchema },
            permissionRequests: { type: "array", items: permissionSchema },
          },
        },
      },
      contextQuestions: { type: "array", maxItems: 1, items: contextQuestionSchema },
      proposedActions: {
        type: "array",
        maxItems: 12,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["actionType", "targetType", "title", "body", "approvalRequired"],
          properties: {
            actionType: { type: "string" },
            targetType: { type: "string" },
            title: { type: "string" },
            body: { type: "string" },
            approvalRequired: { type: "boolean" },
          },
        },
      },
      durableMemory: stringArraySchema,
    },
  },
};

export function buildManagerConversationInstructions(playbookInstructions = "") {
  return [
    "You are the Manager Conversation Router for the prototype-style manager office.",
    "Use the supplied Manager Intelligence packet, artist profile, evidence, music catalog, missions, tasks, memory, agent reports, and recent conversation history to answer the user's directive.",
    "Write as the Manager: direct, plain, senior, specific to this artist and this workspace. Do not use generic assistant greetings or filler.",
    "For normal questions and follow-ups, write 1-3 natural paragraphs. Do not dump headings, task lists, or project-management fields into responseBody unless the user explicitly asks to draft, build, activate, or update work.",
    "If evidence is incomplete, say what decision can still be made and what must be verified. Push back when the evidence does not justify the move.",
    "Do not create a separate evidence-read section. Evidence, H-score/H-strike style metrics, market concentration, ramp-versus-engagement, and packet signals must be synthesized into the Manager answer.",
    "Do not collapse every answer into promoting the strongest track. Use whichever management lenses fit: strategy, positioning, rights, release, market, team operations, reputation, finance, source completeness, or mission design.",
    "Set actionPolicy before any durable write is applied: answer_only for simple conversation; save_memory only when durableMemory is the only write; create_decision_package for a durable recommendation package; create_mission or update_mission for missionGraphDecisions; update_task or review_checkpoint for task/checkpoint state changes; request_permission for external, expensive, legal, financial, public, or reputational actions; request_evidence when missing evidence blocks a specific decision.",
    "When the user asks a conversational question, set actionPolicy to answer_only and do not generate missionGraphDecisions, createdWork, or proposedActions unless a concrete operational action is genuinely needed.",
    "Use missionGraphDecisions only when the user is actually creating or changing mission work. Create or update at most one mission per user request: one durable objective, checkpoints as decision questions with rules, and tasks as concrete work that answers those questions.",
    "Never create lightweight mission/task work. Do not emit one task with a duplicate checkpoint. If any mission work is created or updated, provide mission identity, checkpoint decision rules, task steps, completion expectations, riskIfLate, sourceRefs, and permission requests.",
    "Use outcome activate_mission for new missions. Use outcome update_existing_mission for changes to existing missions, including adding tasks or checkpoints to existing work; provide existingMissionId and a complete revised plan.",
    "Every new task must declare its completion contract: result_note for an observable user-reported outcome, manager_draft when you can produce the substantive artifact in this chat, or evidence only when external proof truly must be uploaded. Never make the user upload a document you can draft with them.",
    "When taskContext is present, work on that task inside this conversation. Produce a usable draft in responseBody, cover its deliverable requirements, state assumptions, and ask at most one question that materially changes the draft.",
    "If user-controlled context is missing, return at most one context question and no missionGraphDecisions. Include recommendedAnswer and recommendationReason so an inexperienced artist can accept your best judgment or say they are unsure.",
    "Return createdWork only for already-known concrete non-mission artifacts. For mission/task creates and updates, prefer missionGraphDecisions and let the server emit canonical createdWork after persistence. Use proposedActions for internal next steps that the app can later approve or execute.",
    "Never mention provider mechanics, model names, or internal prompt/source packaging in the user-facing responseBody.",
    playbookInstructions,
  ].join("\n");
}

export function parseManagerConversationOutput(raw: string): ManagerConversationOutput {
  const parsed = JSON.parse(raw) as Partial<ManagerConversationOutput> & { workOperations?: unknown };
  if (Array.isArray(parsed.workOperations) && parsed.workOperations.length > 0) {
    throw new Error("Manager conversation output must use missionGraphDecisions instead of lightweight workOperations.");
  }
  const actionPolicy = normalizeActionPolicy(parsed.actionPolicy);
  if (!actionPolicy) {
    throw new Error("Manager conversation output is missing required actionPolicy.");
  }
  const output: ManagerConversationOutput = {
    topic: cleanString(parsed.topic, "Manager conversation").slice(0, 120),
    summary: cleanString(parsed.summary, "Manager answered the directive.").slice(0, 240),
    status: cleanString(parsed.status, "Manager responded").slice(0, 80),
    confidence: ["high", "medium", "low", "unknown"].includes(String(parsed.confidence)) ? parsed.confidence as ManagerConversationOutput["confidence"] : "unknown",
    classification: cleanString(parsed.classification, "manager_conversation").slice(0, 80),
    actionPolicy,
    responseBody: cleanString(parsed.responseBody, "The Manager could not produce a grounded answer from the current packet."),
    evidenceIds: cleanStringArray(parsed.evidenceIds).slice(0, 24),
    limitations: cleanStringArray(parsed.limitations).slice(0, 12),
    createdWork: Array.isArray(parsed.createdWork) ? parsed.createdWork.map(normalizeCreatedWork).filter(Boolean).slice(0, 8) as ManagerConversationCreatedWork[] : [],
    missionGraphDecisions: Array.isArray(parsed.missionGraphDecisions)
      ? parsed.missionGraphDecisions.map(normalizeMissionGraphDecision).filter(Boolean).slice(0, 4) as ManagerMissionGraphDecision[]
      : [],
    contextQuestions: Array.isArray(parsed.contextQuestions)
      ? parsed.contextQuestions.map(normalizeContextQuestion).filter(Boolean).slice(0, 1) as MissionGenesisQuestion[]
      : [],
    proposedActions: Array.isArray(parsed.proposedActions) ? parsed.proposedActions.map(normalizeAction).filter(Boolean).slice(0, 12) as ManagerConversationAction[] : [],
    durableMemory: cleanStringArray(parsed.durableMemory).slice(0, 8),
  };

  if (!output.responseBody.trim()) {
    throw new Error("Manager conversation output is missing responseBody.");
  }

  return output;
}

function normalizeActionPolicy(value: unknown): ManagerConversationOutput["actionPolicy"] | null {
  const allowed = [
    "answer_only",
    "save_memory",
    "create_decision_package",
    "create_mission",
    "update_mission",
    "update_task",
    "review_checkpoint",
    "request_permission",
    "request_evidence",
  ];
  return allowed.includes(String(value)) ? value as ManagerConversationOutput["actionPolicy"] : null;
}

function normalizeCreatedWork(value: unknown): ManagerConversationCreatedWork | null {
  if (!value || typeof value !== "object") return null;
  const work = value as Partial<ManagerConversationCreatedWork>;
  if (work.type !== "music_item" && work.type !== "mission" && work.type !== "task") return null;
  const title = cleanString(work.title, "");
  const body = cleanString(work.body, "");
  if (!title || !body) return null;
  const status = ["created", "updated", "approval_required", "failed", "pending"].includes(String(work.status)) ? work.status as ManagerConversationCreatedWork["status"] : undefined;
  return {
    type: work.type,
    title,
    body,
    id: cleanString(work.id, ""),
    parentMissionId: cleanString(work.parentMissionId, ""),
    ...(status ? { status } : {}),
  };
}

function normalizeMissionGraphDecision(value: unknown): ManagerMissionGraphDecision | null {
  if (!value || typeof value !== "object") return null;
  const decision = value as Partial<ManagerMissionGraphDecision>;
  if (decision.outcome !== "activate_mission" && decision.outcome !== "update_existing_mission") return null;
  const mission = normalizeMission(decision.mission);
  const checkpoints = Array.isArray(decision.checkpoints) ? decision.checkpoints.map(normalizeCheckpoint).filter(Boolean) as MissionGenesisCheckpoint[] : [];
  const tasks = Array.isArray(decision.tasks) ? decision.tasks.map(normalizeTask).filter(Boolean) as MissionGenesisTask[] : [];
  if (!mission || !checkpoints.length || !tasks.length) return null;
  const checkpointKeys = new Set(checkpoints.map((checkpoint) => checkpoint.key));
  if (tasks.some((task) => !checkpointKeys.has(task.primaryCheckpointKey))) return null;
  return {
    outcome: decision.outcome,
    confidence: ["high", "medium", "low", "limited"].includes(String(decision.confidence)) ? decision.confidence as ManagerMissionGraphDecision["confidence"] : "medium",
    decisionSummary: cleanString(decision.decisionSummary, mission.summary),
    evidenceNeeded: cleanStringArray(decision.evidenceNeeded).slice(0, 24),
    existingMissionId: cleanString(decision.existingMissionId, ""),
    reasons: cleanStringArray(decision.reasons).slice(0, 8),
    mission,
    checkpoints,
    tasks,
    permissionRequests: Array.isArray(decision.permissionRequests) ? decision.permissionRequests.map(normalizePermission).filter(Boolean) as MissionGenesisPermission[] : [],
  };
}

function normalizeMission(value: unknown): MissionGenesisMission | null {
  if (!value || typeof value !== "object") return null;
  const mission = value as Partial<MissionGenesisMission>;
  const normalized = {
    title: cleanString(mission.title, ""),
    objective: cleanString(mission.objective, ""),
    reason: cleanString(mission.reason, ""),
    summary: cleanString(mission.summary, ""),
    patternName: cleanString(mission.patternName, ""),
    currentRecommendation: cleanString(mission.currentRecommendation, ""),
    changeConditions: cleanStringArray(mission.changeConditions).slice(0, 12),
    timeline: cleanString(mission.timeline, ""),
    sourceRefs: cleanStringArray(mission.sourceRefs).slice(0, 24),
  };
  return normalized.title && normalized.objective && normalized.reason && normalized.summary && normalized.patternName && normalized.currentRecommendation && normalized.timeline
    ? normalized
    : null;
}

function normalizeCheckpoint(value: unknown): MissionGenesisCheckpoint | null {
  if (!value || typeof value !== "object") return null;
  const checkpoint = value as Partial<MissionGenesisCheckpoint>;
  const normalized = {
    key: cleanString(checkpoint.key, ""),
    title: cleanString(checkpoint.title, ""),
    question: cleanString(checkpoint.question, ""),
    decisionRule: cleanString(checkpoint.decisionRule, ""),
    requiredEvidence: cleanStringArray(checkpoint.requiredEvidence).slice(0, 12),
    missingEvidence: cleanStringArray(checkpoint.missingEvidence).slice(0, 12),
    sourceRefs: cleanStringArray(checkpoint.sourceRefs).slice(0, 24),
  };
  return normalized.key && normalized.title && normalized.question && normalized.decisionRule ? normalized : null;
}

function normalizeTask(value: unknown): MissionGenesisTask | null {
  if (!value || typeof value !== "object") return null;
  const task = value as Partial<MissionGenesisTask>;
  const normalized = {
    title: cleanString(task.title, ""),
    ownerRole: cleanString(task.ownerRole, "Manager"),
    primaryCheckpointKey: cleanString(task.primaryCheckpointKey, ""),
    purpose: cleanString(task.purpose, ""),
    steps: cleanStringArray(task.steps).slice(0, 6),
    evidenceNeeded: cleanStringArray(task.evidenceNeeded).slice(0, 12),
    completionExpectation: cleanString(task.completionExpectation, ""),
    completionMode: ["result_note", "manager_draft", "evidence"].includes(String(task.completionMode))
      ? task.completionMode as MissionGenesisTask["completionMode"]
      : "result_note",
    deliverableTitle: cleanString(task.deliverableTitle, ""),
    deliverableRequirements: cleanStringArray(task.deliverableRequirements).slice(0, 12),
    managerResponsibility: cleanString(task.managerResponsibility, ""),
    userResponsibility: cleanString(task.userResponsibility, ""),
    riskIfLate: cleanString(task.riskIfLate, ""),
    sourceRefs: cleanStringArray(task.sourceRefs).slice(0, 24),
  };
  return normalized.title && normalized.primaryCheckpointKey && normalized.purpose && normalized.steps.length && normalized.completionExpectation && normalized.riskIfLate
    ? normalized
    : null;
}

function normalizePermission(value: unknown): MissionGenesisPermission | null {
  if (!value || typeof value !== "object") return null;
  const permission = value as Partial<MissionGenesisPermission>;
  const requestTypes = ["spend", "external_outreach", "submission", "publish", "schedule", "release_plan_change", "legal_finance_rights", "sensitive_commitment", "draft_export", "source_connection"];
  const requestType = requestTypes.includes(String(permission.requestType)) ? permission.requestType as MissionGenesisPermission["requestType"] : null;
  const title = cleanString(permission.title, "");
  const body = cleanString(permission.body, "");
  const risk = cleanString(permission.risk, "");
  return requestType && title && body && risk ? { title, requestType, body, risk } : null;
}

function normalizeContextQuestion(value: unknown): MissionGenesisQuestion | null {
  if (!value || typeof value !== "object") return null;
  const question = value as Partial<MissionGenesisQuestion>;
  const answerKinds = ["short_text", "single_select", "multi_select", "money_range"];
  const answerKind = answerKinds.includes(String(question.answerKind)) ? question.answerKind as MissionGenesisQuestion["answerKind"] : null;
  const key = cleanString(question.key, "");
  const body = cleanString(question.question, "");
  const reason = cleanString(question.reason, "");
  return key && body && reason && answerKind
    ? {
        key,
        question: body,
        reason,
        answerKind,
        options: cleanStringArray(question.options).slice(0, 8),
        recommendedAnswer: cleanString(question.recommendedAnswer, ""),
        recommendationReason: cleanString(question.recommendationReason, ""),
      }
    : null;
}

function normalizeAction(value: unknown): ManagerConversationAction | null {
  if (!value || typeof value !== "object") return null;
  const action = value as Partial<ManagerConversationAction>;
  const actionType = cleanString(action.actionType, "");
  const targetType = cleanString(action.targetType, "");
  const title = cleanString(action.title, "");
  const body = cleanString(action.body, "");
  if (!actionType || !title || !body) return null;
  return {
    actionType,
    targetType,
    title,
    body,
    approvalRequired: Boolean(action.approvalRequired),
  };
}

function cleanString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function cleanStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim())
    : [];
}
