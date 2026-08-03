export type MissionGenesisMode = "initial" | "continuation";

export const MISSION_GENESIS_PROMPT_VERSION = "mission-genesis-grounded-v2";
export const MISSION_GENESIS_PACKET_VERSION = "mission-genesis-packet-v2";
export const MISSION_GENESIS_SCHEMA_VERSION = "mission_genesis_v2";

export type MissionGenesisQuestion = {
  key: string;
  question: string;
  reason: string;
  answerKind: "short_text" | "single_select" | "multi_select" | "money_range";
  options: string[];
  recommendedAnswer: string;
  recommendationReason: string;
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
  managerRead: string;
  nextAction: string;
  requiredEvidence: string[];
  missingEvidence: string[];
  sourceRefs: string[];
};

export type MissionGenesisTask = {
  title: string;
  ownerRole: string;
  workMode: "artist_action" | "collaborative" | "manager_work";
  primaryCheckpointKey: string;
  purpose: string;
  steps: string[];
  evidenceNeeded: string[];
  completionExpectation: string;
  completionMode: "result_note" | "manager_draft" | "evidence";
  deliverableTitle: string;
  deliverableRequirements: string[];
  managerResponsibility: string;
  userResponsibility: string;
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

export type MissionGenesisCandidate = {
  key: string;
  outcome: "activate_mission" | "candidate_needs_context" | "request_evidence" | "no_mission";
  confidence: "high" | "medium" | "low" | "limited";
  reasons: string[];
  evidenceNeeded: string[];
  questions: MissionGenesisQuestion[];
  mission: MissionGenesisMission;
  checkpoints: MissionGenesisCheckpoint[];
  tasks: MissionGenesisTask[];
  permissionRequests: MissionGenesisPermission[];
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
  missionCandidates: MissionGenesisCandidate[];
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
      "missionCandidates",
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
        maxItems: 1,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["key", "question", "reason", "answerKind", "options", "recommendedAnswer", "recommendationReason"],
          properties: {
            key: { type: "string" },
            question: { type: "string" },
            reason: { type: "string" },
            answerKind: { type: "string", enum: answerKindValues },
            options: stringArraySchema,
            recommendedAnswer: { type: "string" },
            recommendationReason: { type: "string" },
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
          required: ["key", "title", "question", "decisionRule", "managerRead", "nextAction", "requiredEvidence", "missingEvidence", "sourceRefs"],
          properties: {
            key: { type: "string" },
            title: { type: "string" },
            question: { type: "string" },
            decisionRule: { type: "string" },
            managerRead: { type: "string" },
            nextAction: { type: "string" },
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
          required: ["title", "ownerRole", "workMode", "primaryCheckpointKey", "purpose", "steps", "evidenceNeeded", "completionExpectation", "completionMode", "deliverableTitle", "deliverableRequirements", "managerResponsibility", "userResponsibility", "riskIfLate", "sourceRefs"],
          properties: {
            title: { type: "string" },
            ownerRole: { type: "string" },
            workMode: { type: "string", enum: ["artist_action", "collaborative", "manager_work"] },
            primaryCheckpointKey: { type: "string" },
            purpose: { type: "string" },
            steps: { type: "array", minItems: 2, maxItems: 6, items: { type: "string" } },
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
      missionCandidates: {
        type: "array",
        maxItems: 1,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["key", "outcome", "confidence", "reasons", "evidenceNeeded", "questions", "mission", "checkpoints", "tasks", "permissionRequests"],
          properties: {
            key: { type: "string" },
            outcome: { type: "string", enum: ["activate_mission", "candidate_needs_context", "request_evidence", "no_mission"] },
            confidence: { type: "string", enum: confidenceValues },
            reasons: stringArraySchema,
            evidenceNeeded: stringArraySchema,
            questions: {
              type: "array",
              maxItems: 1,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["key", "question", "reason", "answerKind", "options", "recommendedAnswer", "recommendationReason"],
                properties: {
                  key: { type: "string" },
                  question: { type: "string" },
                  reason: { type: "string" },
                  answerKind: { type: "string", enum: answerKindValues },
                  options: stringArraySchema,
                  recommendedAnswer: { type: "string" },
                  recommendationReason: { type: "string" },
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
                required: ["key", "title", "question", "decisionRule", "managerRead", "nextAction", "requiredEvidence", "missingEvidence", "sourceRefs"],
                properties: {
                  key: { type: "string" },
                  title: { type: "string" },
                  question: { type: "string" },
                  decisionRule: { type: "string" },
                  managerRead: { type: "string" },
                  nextAction: { type: "string" },
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
                required: ["title", "ownerRole", "workMode", "primaryCheckpointKey", "purpose", "steps", "evidenceNeeded", "completionExpectation", "completionMode", "deliverableTitle", "deliverableRequirements", "managerResponsibility", "userResponsibility", "riskIfLate", "sourceRefs"],
                properties: {
                  title: { type: "string" },
                  ownerRole: { type: "string" },
                  workMode: { type: "string", enum: ["artist_action", "collaborative", "manager_work"] },
                  primaryCheckpointKey: { type: "string" },
                  purpose: { type: "string" },
                  steps: { type: "array", minItems: 2, maxItems: 6, items: { type: "string" } },
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
      },
    },
  },
};

const sharedInstructions = [
  `Prompt contract: ${MISSION_GENESIS_PROMPT_VERSION}.`,
  "Treat input according to these boundaries: VERIFIED_EVIDENCE is saved evidence and evidence-backed Manager reads; USER_CONTEXT is artist-stated intent, answers, budget, capacity, and preferences; PERSISTED_WORKSPACE_STATE is saved music, missions, tasks, sources, memory, and prior candidate state; PERMITTED_INFERENCE is bounded management judgment derived from those inputs; MISSING_OR_STALE_INFORMATION is limitations, freshness, and evidenceNeeded.",
  "General model knowledge may help interpret a management category, but unsupported knowledge must not become a sourced workspace fact, artist fact, market fact, mission premise, or sourceRef.",
  "You are the senior Manager inside an agentic artist operating system. Use first-principles artist management judgment: specific, commercially literate, creatively sensitive, and honest about uncertainty.",
  "The application supplies a complete artist operating packet. You alone decide whether there is a durable management objective and, if so, author its mission, checkpoints, tasks, timeline, evidence links, and permission gates.",
  "Mission Genesis is a Mission Orchestrator, not the source of first strategy. It must consume packet.managerIntelligence strategic diagnosis, mission implications, and careerConditionDiagnosis before authoring any mission.",
  "careerConditionDiagnosis is mandatory: before selecting mission families, identify the top career conditions in the packet, such as feature_leverage_moment, feature_overshadowing_risk, artist_identity_gap, song_first_attention, market_opening, rights_splits_risk, team_structure_gap, deal_readiness_moment, fan_ownership_gap, or career_direction_unclear.",
  "You are not creating marketing tasks. You are creating career-management workstreams for a human artist team. Consider creative, A&R, artist identity, collaboration, business affairs, finance, live, brand, PR, team operations, fan ownership, deal readiness, wellbeing, and market expansion.",
  "Do not recommend smart URLs, TikTok conversion, creator pilots, saves, follows, or playlist pushes unless the career-condition diagnosis specifically says the artist's highest priority is fan capture, conversion, or campaign execution.",
  "Mission Judge: before activation, reject a generic mission, marketing-default mission, mixed-objective mission, system-facing tasks, vague checkpoints, or any mission not tied to one career condition.",
  "One mission equals one career-management workstream for one career condition. A mission cannot mix career thesis, team operations, and campaign execution.",
  "Do not create a mission merely because this workflow was invoked. no_mission is a correct and valuable result when the packet does not justify coordinated work.",
  "CRITICAL: Do not use generic templates, canned release plans, smart-link checklists, or fixed seven-day timelines. Every single element must be derived from this specific artist's profile, music, evidence, memory, budget, team capacity, goals, constraints, active work, and agent reports. If you cannot produce artist-specific work, return no_mission and ask for the missing context.",
  "CRITICAL: If the mission, checkpoints, or tasks could apply to any random artist after swapping the name, the output is WRONG. Return no_mission or candidate_needs_context instead.",
  "Think in terms of career leverage, demand architecture, and long-term positioning — not marketing checklists. An elite manager asks: what is the right next move to build this specific artist's leverage, audience, and commercial position? What should we NOT do? What creates asymmetric career value?",
  "Use concrete artist anchors in every field: saved record/project titles, home market, current goal, streaming metrics, budget boundary, team capacity, named agent reports, constraints, or prior decisions from memory.",
  "Timeline must reflect the true scope of work. Use weeks or months for most tasks. A three-month market expansion is three months. A DSP pitch cycle is 6–8 weeks. A brand partnership is 2–4 months of outreach and negotiation. A release campaign is 8–12 weeks of coordinated work. Hardcoding '7 days' for every task is WRONG.",
  "Every sourceRefs value must be an exact id present in the packet. Never invent an id. User intent and preferences are context, not third-party factual proof.",
  "A mission is a durable objective requiring coordinated work and review, not a to-do list. A visible task exists only when the artist or team must decide, approve, perform an external action, or report an offline outcome. A checkpoint is a decision question with a binary pass/fail rule, not a renamed task grouping.",
  "Research, comparison, synthesis, monitoring, and recommendations are Manager work: put the result in checkpoint.managerRead and do not create a task.",
  "A mission may contain zero tasks when the packet already supports the Manager read and nothing is needed from the artist. Every active mission still requires at least one checkpoint.",
  "Uploads are optional context only. Never create completionMode evidence in a new plan, never make an upload a checkpoint gate, and proceed with a limited or conservative recommendation when private data is unavailable.",
  "checkpoint.managerRead states what the available evidence means now. checkpoint.nextAction names one human action or explicitly says that nothing is needed from the artist while the Manager watches signals.",
  "Visible task steps must be human-facing only. Do not write system-support instructions such as retrieving the packet, attaching evidence refs, referencing mission.sourceRefs, or populating permission request queues.",
  "Every task MUST include a 'steps' array with 2–6 plain-language sequential actions. Steps describe exactly what to do — specific enough that someone could execute them without needing a meeting. No vague steps like 'do the research' or 'complete the task'. Good step examples: 'Pull city-level streaming breakdown from Spotify for Artists for the last 90 days', 'Build a creator brief with hook timestamp, posting window, and niche context for each target', 'Draft contract term sheet and send to entertainment attorney for review by [week 2]'.",
  "Every task must reference a checkpoint key. Every checkpoint must have a decision rule. Use realistic timelines: weeks or months based on the actual scope of the work involved.",
  "Every visible task must declare exactly one completionMode: result_note when the user can report an observable outcome or manager_draft when the Manager can prepare the substantive artifact in chat. The legacy evidence value exists for compatibility but must not be generated.",
  "Every visible task must declare workMode: artist_action when the artist or team performs or reports the work, or collaborative when the artist/team and Manager build or approve it together. A manager_draft task must be collaborative. Do not generate manager_work tasks; put immediate Manager analysis in checkpoint.managerRead instead.",
  "Every task must state completionExpectation, deliverableRequirements, managerResponsibility, and userResponsibility so an independent artist knows what happens next without a meeting.",
  "Ask at most one decision-changing user question at a time. Include a recommendedAnswer and recommendationReason so the user can accept the Manager's judgment or say they are unsure. Do not ask anything already answered by profile, memory, evidence, or prior context answers.",
  "Missing source proof is a limitation, not an upload gate. Use request_evidence only when no responsible recommendation can be made at all; otherwise proceed with a limited or conservative recommendation.",
  "If active work already owns the objective, return update_existing_mission with its exact mission id. You MUST still provide a complete revised plan, with the same rigour as activate_mission: all 7 mission identity fields (title, objective, reason, summary, patternName, currentRecommendation, timeline), changeConditions, at least 2 sourceRefs, and at least one checkpoint with a binary decision rule grounded in evidence. Author the update as if writing the mission fresh from the latest evidence. Tasks may be empty when nothing is needed from the artist.",
  "Use packet.missionPatternRegistry as the runtime management-domain contract. It defines when patterns apply, evidence needs, task types, checkpoint questions, permission boundaries, review triggers, success states, blockage states, and change conditions.",
  "Ground a mission in at most two relevant patterns from packet.missionPatternRegistry. Pattern taskTypes are examples, not a skeleton or mandatory checklist. Author only tasks required by this artist's objective and current evidence.",
  "Use packet.recommendedMissionPatterns only when they fit the user's current request. An empty recommendation list is a valid signal; do not invent a career thesis or data-upload mission to fill it.",
  "Create or update at most one mission for one user request. Other possible workstreams belong in the explanation, not missionCandidates.",
  "Top-level outcome, questions, mission, checkpoints, tasks, and permissionRequests describe the primary decision only. If the primary top-level outcome is activate_mission, update_existing_mission, request_evidence, or no_mission, top-level questions MUST be an empty array.",
  "Only set top-level outcome to candidate_needs_context when no mission should activate until those exact top-level questions are answered. In that case top-level checkpoints, tasks, and permissionRequests must be empty.",
  "Do not default every mission to promoting the strongest song. Consider all relevant management domains, then choose the single workstream that creates the most leverage now.",
  "If no listed pattern fits, create an ad hoc pattern in mission.patternName and explain why in mission.reason. The ad hoc mission must still obey the registry contract: evidence, checkpoint, task, permission, review trigger, success state, blockage state, and change condition.",
  "External outreach, spend, publishing, submission, scheduling, release-plan changes, sensitive commitments, and legal/finance/rights conclusions require a permission request.",
  "For no_mission or request_evidence, leave mission text fields empty and return empty checkpoints, tasks, and permissionRequests.",
  "For candidate_needs_context, provide a grounded candidate mission identity and questions, but leave checkpoints, tasks, and permissionRequests empty until the answers are synthesized.",
  "For activate_mission, return a complete mission with at least one checkpoint. Tasks may be empty when no artist or collaborative action is needed. The plan must be executable and specific, not advice-shaped prose.",
];

export function buildMissionGenesisInstructions(mode: MissionGenesisMode) {
  return [
    ...sharedInstructions,
    mode === "continuation"
      ? "This is the continuation after the user answered the decision-changing context question. The supplied prior candidate is the work being evaluated and is not a duplicate existing mission. You must not ask another round of context questions. Decide activate_mission, request_evidence, update_existing_mission, or no_mission."
      : "This is the initial synthesis. Ask one decision-changing context question only when its answer materially changes whether or how the mission should exist.",
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
    missionCandidates: [],
  };
  output.missionCandidates = readMissionCandidates(value.missionCandidates, output);
  normalizeTopLevelMissionFromCandidates(output);
  normalizeQuestionPlacement(output, mode);

  validateOutput(output, packet, mode);
  return output;
}

function normalizeTopLevelMissionFromCandidates(output: MissionGenesisOutput) {
  if (output.outcome !== "activate_mission" && output.outcome !== "candidate_needs_context" && output.outcome !== "update_existing_mission") return;
  const shouldUseCandidateSurface = output.missionCandidates.length > 1 || missionIdentityIsMissing(output.mission);
  if (!shouldUseCandidateSurface) return;

  const candidate =
    output.missionCandidates.find((item) => item.outcome === output.outcome) ??
    output.missionCandidates.find((item) => item.outcome === "activate_mission" || item.outcome === "candidate_needs_context") ??
    output.missionCandidates[0];
  if (!candidate) return;

  output.mission = candidate.mission;
  if (shouldUseCandidateSurface) {
    if (candidate.questions.length || !output.questions.length) output.questions = candidate.questions;
    output.checkpoints = candidate.checkpoints;
    output.tasks = candidate.tasks;
    output.permissionRequests = candidate.permissionRequests;
  } else {
    if (!output.questions.length) output.questions = candidate.questions;
    if (!output.checkpoints.length) output.checkpoints = candidate.checkpoints;
    if (!output.tasks.length) output.tasks = candidate.tasks;
    if (!output.permissionRequests.length) output.permissionRequests = candidate.permissionRequests;
  }
  if (!output.evidenceNeeded.length) output.evidenceNeeded = candidate.evidenceNeeded;
  if (!output.reasons.length) output.reasons = candidate.reasons;
}

function normalizeQuestionPlacement(output: MissionGenesisOutput, mode: MissionGenesisMode) {
  const contextCandidate = output.missionCandidates.find((candidate) => candidate.outcome === "candidate_needs_context");

  if (output.outcome === "candidate_needs_context") {
    if (contextCandidate) {
      if (!output.questions.length) output.questions = contextCandidate.questions;
      if (missionIdentityIsMissing(output.mission)) output.mission = contextCandidate.mission;
      if (output.checkpoints.length || output.tasks.length || output.permissionRequests.length) {
        output.checkpoints = contextCandidate.checkpoints;
        output.tasks = contextCandidate.tasks;
        output.permissionRequests = contextCandidate.permissionRequests;
      }
      if (!output.reasons.length) output.reasons = contextCandidate.reasons;
      if (!output.evidenceNeeded.length) output.evidenceNeeded = contextCandidate.evidenceNeeded;
    }
    return;
  }

  if (!output.questions.length) return;

  if (contextCandidate && !contextCandidate.questions.length) {
    contextCandidate.questions = output.questions;
  }

  if (output.outcome === "activate_mission" || output.outcome === "update_existing_mission") {
    output.questions = [];
    return;
  }

  if (mode === "initial" && !missionIdentityIsMissing(output.mission) && !output.checkpoints.length && !output.tasks.length && !output.permissionRequests.length) {
    output.outcome = "candidate_needs_context";
    return;
  }
}

function missionIdentityIsMissing(mission: MissionGenesisMission) {
  return !mission.title.trim() ||
    !mission.objective.trim() ||
    !mission.reason.trim() ||
    !mission.summary.trim() ||
    !mission.patternName.trim() ||
    !mission.currentRecommendation.trim() ||
    !mission.timeline.trim() ||
    !mission.changeConditions.length ||
    !mission.sourceRefs.length;
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
    output.mission.reason,
    output.mission.summary,
    output.mission.currentRecommendation,
    ...output.checkpoints.flatMap((checkpoint) => [checkpoint.title, checkpoint.question, checkpoint.managerRead, checkpoint.nextAction]),
    ...output.tasks.flatMap((task) => [task.title, task.purpose, ...task.steps]),
  ].join("\n");
  if (/test whether current attention is becoming repeatable audience behavior|prepare first manager read|objective quality/i.test(visiblePlan)) {
    throw new Error("OpenAI Mission Genesis returned generic or retired Mission Genesis copy.");
  }
  validateMissionJudgeSurface(output.mission, output.checkpoints, output.tasks, "OpenAI Mission Genesis");

  if (output.outcome === "activate_mission" || output.outcome === "candidate_needs_context" || output.outcome === "update_existing_mission") {
    const normalizedPlan = normalizeAnchor(visiblePlan);
    const matchedAnchors = [...collectPersonalizationAnchors(packet)].filter((anchor) => normalizedPlan.includes(normalizeAnchor(anchor)));
    if (matchedAnchors.length < 2) {
      throw new Error("OpenAI Mission Genesis plan is missing artist-specific anchors from the operating packet.");
    }
  }

  if (output.outcome === "candidate_needs_context") {
    if (output.questions.length !== 1) throw new Error("Mission Genesis context must contain exactly one decision-changing question.");
    assertMissionIdentity(output.mission);
    if (output.checkpoints.length || output.tasks.length || output.permissionRequests.length) {
      throw new Error("Mission Genesis cannot create plan work before required context is answered.");
    }
    validateMissionCandidates(output, packet, mode);
    return;
  }

  if (output.questions.length) throw new Error("Mission Genesis returned questions for an outcome that does not accept context.");

  if (output.outcome === "activate_mission") {
    assertMissionIdentity(output.mission);
    if (output.mission.sourceRefs.length < Math.min(2, packetIds.size)) {
      throw new Error("Mission Genesis active mission is not grounded in enough packet sources.");
    }
    if (!output.checkpoints.length) throw new Error("Mission Genesis active mission requires at least one checkpoint.");
    const keys = new Set<string>();
    for (const checkpoint of output.checkpoints) {
      if (keys.has(checkpoint.key)) throw new Error(`Mission Genesis returned duplicate checkpoint key: ${checkpoint.key}.`);
      keys.add(checkpoint.key);
    }
    for (const task of output.tasks) {
      if (!keys.has(task.primaryCheckpointKey)) throw new Error(`Mission Genesis task references missing checkpoint: ${task.primaryCheckpointKey}.`);
    }
    validateMissionCandidates(output, packet, mode);
    return;
  }

  if (output.outcome === "update_existing_mission") {
    if (!output.existingMissionId || !packetIds.has(output.existingMissionId)) {
      throw new Error("Mission Genesis update outcome does not reference an existing mission in the packet.");
    }
    assertMissionIdentity(output.mission);
    if (output.mission.sourceRefs.length < Math.min(2, packetIds.size)) {
      throw new Error("Mission Genesis update is not grounded in enough packet sources.");
    }
    if (!output.checkpoints.length) {
      throw new Error("Mission Genesis update requires a complete revised plan with checkpoints.");
    }
    const keys = new Set<string>();
    for (const checkpoint of output.checkpoints) {
      if (keys.has(checkpoint.key)) throw new Error(`Mission Genesis returned duplicate checkpoint key: ${checkpoint.key}.`);
      keys.add(checkpoint.key);
    }
    for (const task of output.tasks) {
      if (!keys.has(task.primaryCheckpointKey)) {
        throw new Error(`Mission Genesis task references missing checkpoint: ${task.primaryCheckpointKey}.`);
      }
    }
    validateMissionCandidates(output, packet, mode);
    return;
  }

  if (output.checkpoints.length || output.tasks.length || output.permissionRequests.length) {
    throw new Error("Mission Genesis cannot persist plan work for a non-mission outcome.");
  }
  validateMissionCandidates(output, packet, mode);
}

function validateMissionCandidates(output: MissionGenesisOutput, packet: unknown, mode: MissionGenesisMode) {
  for (const candidate of output.missionCandidates) {
    validateMissionCandidate(candidate, packet, mode);
  }
}

function validateMissionCandidate(candidate: MissionGenesisCandidate, packet: unknown, mode: MissionGenesisMode) {
  if (!candidate.reasons.length) throw new Error(`Mission candidate ${candidate.key} must explain its decision.`);
  if (mode === "continuation" && candidate.outcome === "candidate_needs_context") throw new Error("Mission Genesis attempted another round of context questions after the complete answer batch.");
  const packetIds = collectIds(packet);
  for (const ref of [
    ...candidate.mission.sourceRefs,
    ...candidate.checkpoints.flatMap((checkpoint) => checkpoint.sourceRefs),
    ...candidate.tasks.flatMap((task) => task.sourceRefs),
  ]) {
    if (!packetIds.has(ref)) throw new Error(`Mission candidate ${candidate.key} returned unknown source reference: ${ref}.`);
  }
  if (candidate.outcome === "activate_mission" || candidate.outcome === "candidate_needs_context") {
    assertMissionIdentity(candidate.mission);
    const visiblePlan = [
      candidate.mission.title,
      candidate.mission.objective,
      candidate.mission.reason,
      candidate.mission.summary,
      candidate.mission.currentRecommendation,
      ...candidate.checkpoints.flatMap((checkpoint) => [checkpoint.title, checkpoint.question, checkpoint.managerRead, checkpoint.nextAction]),
      ...candidate.tasks.flatMap((task) => [task.title, task.purpose, ...task.steps]),
    ].join("\n");
    validateMissionJudgeSurface(candidate.mission, candidate.checkpoints, candidate.tasks, `Mission candidate ${candidate.key}`);
    const normalizedPlan = normalizeAnchor(visiblePlan);
    const matchedAnchors = [...collectPersonalizationAnchors(packet)].filter((anchor) => normalizedPlan.includes(normalizeAnchor(anchor)));
    if (matchedAnchors.length < 2) throw new Error(`Mission candidate ${candidate.key} is missing artist-specific anchors from the operating packet.`);
  }
  if (candidate.outcome === "candidate_needs_context") {
    if (candidate.questions.length !== 1) throw new Error(`Mission candidate ${candidate.key} context must contain exactly one decision-changing question.`);
    if (candidate.checkpoints.length || candidate.tasks.length || candidate.permissionRequests.length) throw new Error(`Mission candidate ${candidate.key} cannot create plan work before context is answered.`);
  }
  if (candidate.outcome === "activate_mission") {
    if (!candidate.checkpoints.length) throw new Error(`Mission candidate ${candidate.key} requires at least one checkpoint.`);
    const keys = new Set(candidate.checkpoints.map((checkpoint) => checkpoint.key));
    for (const task of candidate.tasks) {
      if (!keys.has(task.primaryCheckpointKey)) throw new Error(`Mission candidate ${candidate.key} task references missing checkpoint: ${task.primaryCheckpointKey}.`);
    }
  }
}

function validateMissionJudgeSurface(
  mission: MissionGenesisMission,
  checkpoints: MissionGenesisCheckpoint[],
  tasks: MissionGenesisTask[],
  label: string,
) {
  const text = [
    mission.title,
    mission.objective,
    mission.reason,
    mission.summary,
    mission.patternName,
    mission.currentRecommendation,
    ...checkpoints.flatMap((checkpoint) => [checkpoint.title, checkpoint.question, checkpoint.decisionRule, checkpoint.managerRead, checkpoint.nextAction]),
    ...tasks.flatMap((task) => [task.title, task.ownerRole, task.purpose, ...task.steps]),
  ].join("\n");
  const lower = text.toLowerCase();

  const hasCareerThesis = /career thesis|north star|90-day|90 day|positioning thesis|career position/i.test(text);
  const hasTeamOps = /team ops|assign owners|approval flow|owner list|permissionrequests queue|rights\/finance|creative assets/i.test(text);
  const hasCampaignExecution = /creator[- ]led|creator pilot|creator shortlist|smart url|tiktok conversion|playlist-add|shazam uplift|pilot plan|paid boost/i.test(text);
  if ([hasCareerThesis, hasTeamOps, hasCampaignExecution].filter(Boolean).length >= 2) {
    throw new Error(`${label} returned mixed career-management objectives; split career thesis, team operations, and campaign execution into separate missions.`);
  }

  for (const task of tasks) {
    const systemFacingStep = task.steps.find((step) =>
      /\b(packet|mission\.sourcerefs|source refs|sourcerefs|reference evidence ids|populate permissionrequests|permissionrequests queue|retrieve artist packet|attach evidence refs)\b/i.test(step),
    );
    if (systemFacingStep) {
      throw new Error(`${label} returned system support inside visible human tasks: ${systemFacingStep}`);
    }
  }

  if (/(smart url|tiktok conversion|creator pilot|creator-led|saves|follows|playlist push|highest-track push)/i.test(text)) {
    const diagnosisAllowsCampaign =
      /fan capture|campaign execution|conversion proof|marketing validation|fan ownership/i.test(text) &&
      !/career thesis|artist identity|feature leverage|collaboration strategy/i.test(text);
    if (!diagnosisAllowsCampaign) {
      throw new Error(`${label} defaulted to a marketing/conversion mission without a supporting career condition.`);
    }
  }

  validateSourceCompletenessMission(mission, checkpoints, tasks, label);
  validateHumanTaskContract(tasks, label);

  for (const checkpoint of checkpoints) {
    if (!/(if|only if|continue|stop|pause|change|reframe|approve|reject|pass|fail|otherwise|whether)/i.test(checkpoint.decisionRule)) {
      throw new Error(`${label} checkpoint is not a decision branch: ${checkpoint.title}`);
    }
  }
  if (/build a stronger audience foundation|create a repeatable process for audience growth/i.test(lower)) {
    throw new Error(`${label} returned a generic mission that could apply to 100 artists and is missing artist-specific anchors.`);
  }
}

function validateHumanTaskContract(tasks: MissionGenesisTask[], label: string) {
  for (const task of tasks) {
    if (task.workMode === "manager_work") {
      throw new Error(`${label} returned Manager analysis as a visible task; put the result in the checkpoint read.`);
    }
    if (task.ownerRole.trim().toLowerCase() === "manager" && task.workMode !== "collaborative") {
      throw new Error(`${label} returned Manager analysis as a visible task; put the result in the checkpoint read.`);
    }
    if (task.completionMode === "manager_draft" && task.workMode !== "collaborative") {
      throw new Error(`${label} returned a Manager draft without collaborative participation.`);
    }
    if (task.completionMode === "evidence") {
      throw new Error(`${label} returned a required upload even though uploads must remain optional context.`);
    }
    const taskText = [task.title, task.purpose, ...task.steps].join(" ");
    const analysisOnly = /\b(review|analy[sz]e|compare|research|assess|validate|monitor|issue a recommendation)\b/i.test(taskText)
      && !/\b(approve|choose|decide|publish|send|sign|perform|record|report|confirm|attend|schedule)\b/i.test(taskText);
    if (analysisOnly) {
      throw new Error(`${label} returned analysis-only work as a visible human task.`);
    }
  }
}

function validateSourceCompletenessMission(
  mission: MissionGenesisMission,
  checkpoints: MissionGenesisCheckpoint[],
  tasks: MissionGenesisTask[],
  label: string,
) {
  const missionText = [
    mission.title,
    mission.objective,
    mission.reason,
    mission.summary,
    mission.patternName,
    mission.currentRecommendation,
  ].join("\n");
  const reviewText = [
    missionText,
    ...checkpoints.flatMap((checkpoint) => [checkpoint.title, checkpoint.question, checkpoint.decisionRule, ...checkpoint.requiredEvidence, ...checkpoint.missingEvidence]),
    ...tasks.flatMap((task) => [task.title, task.purpose, ...task.steps, ...task.evidenceNeeded, task.completionExpectation]),
  ].join("\n");

  const isSourceCompletenessMission =
    /(source[- ]completeness|data \/ source completeness|source connection|source upload|upload (spotify|private|analytics)|private analytics|spotify for artists and smart[- ]link data)/i.test(missionText);
  if (!isSourceCompletenessMission) return;

  const namesBlockedDecision =
    /\b(so the team can decide|decide whether|approval decision|approve|reject|revise|greenlight|release date|rights|clearance|budget|spend|submission|pitch|external outreach|\$[0-9])/i.test(reviewText);
  if (!namesBlockedDecision) {
    throw new Error(`${label} returned a source-completeness mission without a specific blocked decision.`);
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
    recommendedAnswer: readString(item.recommendedAnswer, "questions.recommendedAnswer", false),
    recommendationReason: readString(item.recommendationReason, "questions.recommendationReason", false),
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
    managerRead: readString(item.managerRead, "checkpoints.managerRead", true),
    nextAction: readString(item.nextAction, "checkpoints.nextAction", true),
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
    workMode: readOptionalEnum(item.workMode, ["artist_action", "collaborative", "manager_work"], item.completionMode === "manager_draft" ? "collaborative" : "artist_action") as MissionGenesisTask["workMode"],
    primaryCheckpointKey: readString(item.primaryCheckpointKey, "tasks.primaryCheckpointKey", true),
    purpose: readString(item.purpose, "tasks.purpose", true),
    steps: readStringArray(item.steps),
    evidenceNeeded: readStringArray(item.evidenceNeeded),
    completionExpectation: typeof item.completionExpectation === "string" && item.completionExpectation.trim()
      ? item.completionExpectation.trim()
      : readString(item.purpose, "tasks.purpose", true),
    completionMode: readOptionalEnum(item.completionMode, ["result_note", "manager_draft", "evidence"], "result_note") as MissionGenesisTask["completionMode"],
    deliverableTitle: typeof item.deliverableTitle === "string" && item.deliverableTitle.trim()
      ? item.deliverableTitle.trim()
      : readString(item.title, "tasks.title", true),
    deliverableRequirements: readStringArray(item.deliverableRequirements),
    managerResponsibility: typeof item.managerResponsibility === "string" && item.managerResponsibility.trim()
      ? item.managerResponsibility.trim()
      : "Manager reviews the submitted result and recommends the next move.",
    userResponsibility: typeof item.userResponsibility === "string" && item.userResponsibility.trim()
      ? item.userResponsibility.trim()
      : "Complete the task steps and report the observable result.",
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

function readMissionCandidates(value: unknown, output: MissionGenesisOutput): MissionGenesisCandidate[] {
  const candidates = Array.isArray(value)
    ? value.filter(isRecord).map((item, index) => ({
        key: readString(item.key, `missionCandidates.${index}.key`, true),
        outcome: readEnum(item.outcome, ["activate_mission", "candidate_needs_context", "request_evidence", "no_mission"], `missionCandidates.${index}.outcome`) as MissionGenesisCandidate["outcome"],
        confidence: readEnum(item.confidence, confidenceValues, `missionCandidates.${index}.confidence`) as MissionGenesisCandidate["confidence"],
        reasons: readStringArray(item.reasons),
        evidenceNeeded: readStringArray(item.evidenceNeeded),
        questions: readQuestions(item.questions),
        mission: readMission(item.mission),
        checkpoints: readCheckpoints(item.checkpoints),
        tasks: readTasks(item.tasks),
        permissionRequests: readPermissions(item.permissionRequests),
      }))
    : [];

  if (candidates.length) return candidates;
  if (output.outcome === "activate_mission" || output.outcome === "candidate_needs_context") {
    return [{
      key: "primary",
      outcome: output.outcome,
      confidence: output.confidence,
      reasons: output.reasons,
      evidenceNeeded: output.evidenceNeeded,
      questions: output.questions,
      mission: output.mission,
      checkpoints: output.checkpoints,
      tasks: output.tasks,
      permissionRequests: output.permissionRequests,
    }];
  }
  return [];
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
  if (anchor.length >= 4 && !/^(artist|unknown|none|active|developing|released)$/i.test(anchor)) {
    anchors.add(anchor);
    const beforeParen = anchor.split("(")[0]?.trim();
    if (beforeParen && beforeParen.length >= 4) anchors.add(beforeParen);
    for (const part of anchor.split(/[,/|;:-]/).map((item) => item.trim())) {
      if (part.length >= 4 && part.length <= 40) anchors.add(part);
    }
  }
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

function readOptionalEnum(value: unknown, allowed: string[], fallback: string) {
  return typeof value === "string" && allowed.includes(value) ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

