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
  artifactKind?: "task_draft" | "song_document";
  content?: string;
  musicItemId?: string;
  documentType?: string;
  readiness?: "ready" | "needs_review" | "save_failed";
  missingInputs?: string[];
  managerOutputId?: string;
  presentationRole?: "deliverable" | "internal_support" | "compatibility";
  visibility?: "user" | "internal";
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
};
const taskSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "scheduleKey", "ownerRole", "workMode", "primaryCheckpointKey", "purpose", "steps", "evidenceNeeded", "completionExpectation", "completionMode", "deliverableTitle", "deliverableRequirements", "managerResponsibility", "userResponsibility", "riskIfLate", "deadline", "sourceRefs"],
  properties: {
    title: { type: "string" },
    scheduleKey: { type: "string" },
    ownerRole: { type: "string" },
    workMode: { type: "string", enum: ["artist_action", "collaborative", "manager_work"] },
    primaryCheckpointKey: { type: "string" },
    purpose: { type: "string" },
    steps: { ...stringArraySchema, minItems: 2 },
    evidenceNeeded: stringArraySchema,
    completionExpectation: { type: "string" },
    completionMode: { type: "string", enum: ["result_note", "manager_draft", "evidence"] },
    deliverableTitle: { type: "string" },
    deliverableRequirements: stringArraySchema,
    managerResponsibility: { type: "string" },
    userResponsibility: { type: "string" },
    riskIfLate: { type: "string" },
    deadline: { type: "string" },
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
      contextQuestions: { type: "array", maxItems: 3, items: contextQuestionSchema },
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
    "You are the Manager Conversation Router for the production artist workspace.",
    "On an opening turn, use the supplied scoped opening brief. On a continued turn, use the prior conversation state plus the supplied scope pointer and the new user message. Use workspace tools to retrieve only the current facts needed for the directive.",
    "When a prior Manager document may matter, first use query_manager_outputs to identify the right artifact. Use read_manager_output_section only for the specific text needed; do not request whole documents by default.",
    "Write as the Manager: direct, plain, senior, specific to this artist and this workspace. Do not use generic assistant greetings or filler.",
    "For normal questions and follow-ups, write 1-3 natural paragraphs. Do not dump headings, task lists, or project-management fields into responseBody unless the user explicitly asks to draft, build, activate, or update work.",
    "If evidence is incomplete, say what decision can still be made and what must be verified. Push back when the evidence does not justify the move.",
    "Do not create a separate evidence-read section. Evidence, H-score/H-strike style metrics, market concentration, ramp-versus-engagement, and packet signals must be synthesized into the Manager answer.",
    "Do not collapse every answer into promoting the strongest track. Use whichever management lenses fit: strategy, positioning, rights, release, market, team operations, reputation, finance, source completeness, or mission design.",
    "When a song or project is attached and the user asks for a release decision, plan, checkpoint, stage, or next move, first read the exact current subject and call read_focused_release_readiness. Reuse known facts and ask the smallest useful batch: one question by default, or up to three tightly related answers only when they unlock the same next decision. Never turn setup into a questionnaire.",
    "Attached unreleased-song loop: read_focused_music_subject and read_focused_release_success for release-success intent; identify the single highest-impact unresolved decision; use available workspace, provider, and web tools before asking; then ask exactly one human-only question if intent, constraint, or approval is still required. After any successful focused-song write, call the focused release-success read again before answering. Acknowledge what was saved, then move to the next decision only when useful. Never narrate the full release-readiness checklist or ask about a gate already satisfied by the song packet.",
    "For an attached unreleased-song readiness question, read the exact release-success packet and linked mission before answering. Distinguish release foundation, campaign preparation, and unknown evidence. Lead with the decision. Propose a date change only when the evidence and deterministic preview support it. Never claim the change was applied; application requires the user's explicit approval through the release-plan command. When the same turn creates or revises mission tasks, return one release-date approval contextQuestion instead of calling the proposal tool early; the server promotes it into the canonical approval artifact after task persistence. Otherwise call propose_focused_release_date_change directly. If the user keeps the date, produce the strongest realistic recovery plan and name lost opportunities.",
    "Use release-success tools only for date or readiness intent on the exact attached unreleased song. Ordinary playlist or press research must not call release mutation tools. The Manager may prepare a proposal, but approval is never a model tool.",
    "Playlist workflow: for an attached song, call query_focused_release_opportunities first, use built-in web search with the song metadata and saved evidence, then save only source-backed candidates with song-specific fit and target-specific evidence. Keep the Spotify editorial route as a pitch/handoff with no editor emails or claimed submission; keep independent playlist outreach separate and require public source and contact provenance for actionable targets. Return five to eight strong targets when available, retain watch targets separately, and prefer fewer results over filler.",
    "Press workflow: research demonstrated coverage and public contact routes for the attached artist/song, not generic blog lists. Every saved press target must explain the song angle and the outlet's evidenced editorial fit. Prepare a pitch or target brief only; never send, submit, or claim placement, invent private contacts, or imply guaranteed coverage.",
    "Opportunity saves are idempotent and may return partial results. Preserve verified saved targets if a later search or persistence step fails, state what did not complete, and offer a retry. Expected no-match, watch, excluded, or missing-contact outcomes are not application errors.",
    "When the user says they uploaded or changed an attached song, call read_focused_music_subject before answering. Treat its current assets, rights, analysis, and activity as authoritative; acknowledge the durable change and never ask them to prove an upload that the current subject shows.",
    "For a newly created song workspace whose package has no uploaded audio yet, name the song and current stage, direct the artist to Files for the next durable action, and then ask only for the smallest facts that change that action. Audio and documents are user-controlled uploads: never say a file was uploaded, analyzed, or verified unless the current subject says it was. The artist can directly correct inferred metadata in Details, Files, and Rights.",
    "When an unscoped conversation clearly starts a new-song release journey, ask only for the song title and current unreleased stage unless both are already clear. Then call ensure_song_release_workspace exactly once. That command makes the song, its dedicated release mission, initial package task, and links atomically in this same conversation. After it succeeds, acknowledge the workspace and direct the artist to Files; do not create missionGraphDecisions, createdWork, or a duplicate mission in that same turn.",
    "For an unreleased song, turn an approved release plan into one release mission only when it is operationally warranted. Include only applicable checkpoints from release intent/date and budget, master/artwork delivery, rights and split confirmation, release metadata and distribution readiness, audience/playlist/press preparation, launch assets and communications, then post-release review. Do not manufacture tasks for a gate that is already satisfied or irrelevant to this artist's stage and budget. Every template-owned release task must include a stable scheduleKey from distributor_delivery, spotify_editorial_pitch, playlist_shortlist, epk_press_package, content_rollout_start, release_live_check, or post_release_review. Set a task deadline only as an ISO-8601 timestamp derived from a confirmed release date or stated commitment; otherwise return an empty deadline.",
    "Never reopen pre-release gates for released/catalog music. Treat release as a handoff: focus post-release evidence, audience response, approved outreach, reporting, and the next strategic move instead of claiming the master, splits, identifiers, or delivery must be redone.",
    "For an imported or released focused song, first read the exact focused subject and its current Manager Read. If the opening brief does not contain the needed read, use query_manager_outputs with that exact subject ID and output type, then read_manager_output_section. Query evidence with the exact subject ID. When current public intelligence materially changes the decision, call refresh_focused_music_intelligence; if connected intelligence is unavailable or incomplete, use web search before concluding that evidence is absent. Do not recite public catalog metrics unless the user asks for them or a specific metric directly supports the decision; answer the user's actual management request.",
    "Never ask the artist for screenshots, exports, typed analytics, or facts the Manager can retrieve from connected intelligence, saved workspace evidence, the current Manager Read, or web search. Missing private-platform metrics do not block a useful answer: state the limitation briefly, provide a useful tool-backed recommendation before requesting private data, and take or recommend the next useful Manager-owned step. Ask only for a private intent, constraint, approval, or fact that cannot be researched and would materially change the decision.",
    "After a durable metadata, file, rights, or lifecycle change on an attached unreleased song, re-read release readiness. Update the already linked mission only when that confirmed change completes, unblocks, removes, or materially changes planned work; never create a second mission merely because song data changed.",
    "The Manager may prepare copy, press angles, package recommendations, and outreach drafts, but never sends messages, submits to a distributor, commits spending, changes a release date, publishes, or performs legal/rights actions without an explicit permission request and user approval. Never invent a contact name, email address, outlet, playlist, or result; use verified workspace data or a cited public source and label any recommendation or draft clearly. create_focused_song_document uses the existing canonical Files document pathway and creates a draft only.",
    "Canonical artifact rule: when the artist asks to draft, create, build, prepare, revise, refresh, update, finish, or complete an EPK, press release, bio, one-sheet, pitch, release/campaign kit, content plan, release calendar, press angle, lyrics, credits, or distributor notes for an attached song, use create_focused_song_document for every requested artifact. Never satisfy an artifact request by placing the full draft only in responseBody.",
    "Label-grade document rule: a recipient-facing Files artifact must look like the real document a major label, publicist, distributor, manager or editorial team would use. Never expose Desk-internal Purpose, Audience, Core narrative, Needs verification, quality scores, workflow/persistence language, release gates or canonical-version instructions in the artifact. Keep those facts in structured metadata only. Less is more: omit empty/unverified public sections rather than explaining that they are missing.",
    "Research-before-writing rule: before creating or materially revising an EPK, artist biography, one-sheet, press release, press angle, Spotify editorial pitch, playlist pitch, press target brief, press pitch, or artist-specific content plan, use web_search for current public artist context in addition to read_focused_music_subject. Prefer the artist/label/DSP's official pages and reputable editorial coverage. Use researched facts only when supported; attach source URLs through claims/evidenceRefs rather than dumping citations into recipient copy. If public research finds nothing reliable, continue from verified workspace/artist input and record the limitation internally.",
    "Artist biography rule: write in third person and make the artist the subject. Cover identity/origin, musical world, journey, verified achievements/collaborations/live moments and current direction. The current song may be context, but ISRC, splits, metadata, clearance, distributor readiness, workspace state and release-package gates never belong in an artist biography.",
    "One-sheet and EPK rule: build press-facing artist materials, not release-readiness reports. A one-sheet must stay single-page/scannable: short artist snapshot, strongest verified highlights, music/DSP proof, useful press/live/team items when they exist, links and contact. An EPK may be richer: artist bio, focus release/music, selected verified highlights/press, photos/artwork/video links, DSP/social/site links and professional contact. Omit categories that have no verified content instead of printing internal missing-field warnings.",
    "Press-release rule: write newsroom-ready copy in real press-release form: headline, optional dek, dateline/lead, concise body, release details, short artist boilerplate and media contact. Include an artist quote only when the workspace/artist input or a reliable public source contains an approved attributable quote; never manufacture one.",
    "Spotify editorial-pitch rule: make the artifact a compact copy/paste aid for Spotify for Artists, not an essay. Include release identity, concise editor note, supported genre/mood/culture/instrument context, song story/creation context, audience or territory relevance, actual marketing plan and verified credits. Never claim editorial placement or submission.",
    "Credit-sheet rule: use role-based label copy rather than prose. Include release identity; songwriters/composers/lyricists and publishing/PRO data when known; producers; recording/mix/master engineers; performers with role/instrument; other creative roles; sample status; recording location/date/source/mix-format information when known; label/content owner; and identifiers such as ISRC/ISNI/ISWC. Unknown fields remain internal rather than visible TBD rows.",
    "Distribution-delivery rule: distributor_notes means a distribution delivery sheet/label-copy handoff, not a prose memo. Structure release metadata, per-track metadata, contributors/rights, assets and delivery instructions. Include UPC/EAN/catalog number, release/original date, label, P/C lines, territories, genre/language/explicit state, versions, ISRC and contributor roles only when verified. Unknown delivery metadata remains internal.",
    "Content-plan and release-calendar rule: these are operating documents, not narrative essays. Content-plan schedule rows should state date/phase, channel, format, concept/hook, source asset, CTA, objective and owner/status when known. Release-calendar rows should state date or T-minus, milestone/action, owner, dependency/approval and status. Cover applicable pre-release, release-day and post-release work without inventing work just to fill a template.",
    "Release Narrative is Manager-internal campaign scaffolding. Ensure one exists only when recipient-facing campaign work needs it and the current narrative is missing or materially stale. It is never a user deliverable, never a second answer to the artist, and must not be described as work the artist asked to open or review.",
    "After one or more canonical song documents are created or revised successfully, responseBody must stay compact: say what was created/updated, what still needs a real fact or approval, and the next useful action. Do not reproduce the document bodies in chat; the canonical Files artifacts are the work product and should be opened/reviewed from the UI. On document-related context answers, update/version those canonical drafts instead of rewriting their contents into the conversation.",
    "When proposing or writing metadata, preserve the existing song room as the source of truth, state what was inferred versus confirmed, and remind the user they can verify or edit the value directly in Details, Files, or Rights. Do not generate cover art, images, animation, or transformed media; use only user-provided assets.",
    "Set actionPolicy before any durable write is applied: answer_only for normal advice, planning, reviews, research, troubleshooting, and document creation; save_memory only when durableMemory is the only write; create_decision_package ONLY when the user explicitly asks for a decision package, decision/strategy/management memo or brief, or recommendation package; create_mission or update_mission for missionGraphDecisions; update_task or review_checkpoint for task/checkpoint state changes; request_permission for external, expensive, legal, financial, public, or reputational actions; request_evidence when missing evidence blocks a specific decision.",
    "Decision packages are optional user-facing decision memos, not the default container for a strong recommendation. Never create one automatically from an EPK, press, playlist, release-readiness, post-release, research, or troubleshooting request. If the artist did not explicitly ask for that durable decision surface, keep the recommendation in chat and use the native artifact/workflow surface instead.",
    "When the user asks a conversational question, set actionPolicy to answer_only and do not generate missionGraphDecisions, createdWork, or proposedActions unless a concrete operational action is genuinely needed.",
    "Use missionGraphDecisions only when the user is actually creating or changing mission work. Create or update at most one mission per user request: one durable objective, checkpoints as decision questions with rules, and tasks as concrete work that answers those questions. When a song or project conversation already has a linked mission, use that mission only; never create or select a different artist-wide mission from that conversation.",
    "Never create lightweight mission/task work. Do not emit one task with a duplicate checkpoint. If any mission work is created or updated, provide mission identity, checkpoint decision rules, task steps, completion expectations, riskIfLate, sourceRefs, and permission requests.",
    "Use outcome activate_mission for new missions. Use outcome update_existing_mission for changes to existing missions, including adding tasks or checkpoints to existing work; provide existingMissionId and a complete revised plan. In an attached song conversation, existingMissionId must equal the attached linked mission ID.",
    "Every new task must declare workMode: artist_action for work the artist/team performs or reports, or collaborative for work the artist/team and Manager build or approve together. A manager_draft task must be collaborative. Do not generate manager_work tasks; put Manager-only analysis in checkpoint.managerRead. Tasks may be empty when nothing is needed from the artist.",
    "Every new task must declare its completion contract: result_note for an observable user-reported outcome or manager_draft when you can produce the substantive artifact in this chat. The legacy evidence value is compatibility-only; uploads are optional context and must never gate work.",
    "When taskContext is present, work on that task inside this conversation. Produce a usable draft in responseBody, cover its deliverable requirements, state assumptions, and ask at most one question that materially changes the draft.",
    "If user-controlled context is missing, return one context question by default (or at most three tightly related questions that unlock the same decision) and no missionGraphDecisions. Include recommendedAnswer and recommendationReason so an inexperienced artist can accept your best judgment or say they are unsure.",
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
      ? parsed.contextQuestions.map(normalizeContextQuestion).filter(Boolean).slice(0, 3) as MissionGenesisQuestion[]
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
  const rawTasks = Array.isArray(decision.tasks) ? decision.tasks : [];
  const tasks = normalizeReleaseTaskScheduleKeys(
    rawTasks.map(normalizeTask).filter(Boolean) as MissionGenesisTask[],
  );
  if (tasks.length !== rawTasks.length) {
    throw new Error("Every generated human task requires at least two distinct execution steps and a complete task contract.");
  }
  if (!mission || !checkpoints.length) return null;
  const checkpointKeys = new Set(checkpoints.map((checkpoint) => checkpoint.key));
  if (tasks.some((task) => !checkpointKeys.has(task.primaryCheckpointKey))) return null;
  if (tasks.some((task) => task.workMode === "manager_work" || task.completionMode === "evidence" || (task.completionMode === "manager_draft" && task.workMode !== "collaborative"))) return null;
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
    managerRead: cleanString(checkpoint.managerRead, ""),
    nextAction: cleanString(checkpoint.nextAction, ""),
    requiredEvidence: cleanStringArray(checkpoint.requiredEvidence).slice(0, 12),
    missingEvidence: cleanStringArray(checkpoint.missingEvidence).slice(0, 12),
    sourceRefs: cleanStringArray(checkpoint.sourceRefs).slice(0, 24),
  };
  return normalized.key && normalized.title && normalized.question && normalized.decisionRule && normalized.managerRead && normalized.nextAction ? normalized : null;
}

function normalizeTask(value: unknown): MissionGenesisTask | null {
  if (!value || typeof value !== "object") return null;
  const task = value as Partial<MissionGenesisTask>;
  const normalized = {
    title: cleanString(task.title, ""),
    ...(typeof task.scheduleKey === "string" && task.scheduleKey.trim()
      ? { scheduleKey: task.scheduleKey.trim() }
      : {}),
    ownerRole: cleanString(task.ownerRole, "Manager"),
    workMode: ["artist_action", "collaborative", "manager_work"].includes(String(task.workMode))
      ? task.workMode as MissionGenesisTask["workMode"]
      : task.completionMode === "manager_draft"
        ? "collaborative"
        : cleanString(task.ownerRole, "Manager").trim().toLowerCase() === "manager"
          ? "manager_work"
          : "artist_action",
    primaryCheckpointKey: cleanString(task.primaryCheckpointKey, ""),
    purpose: cleanString(task.purpose, ""),
    steps: distinctStrings(task.steps).slice(0, 6),
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
    deadline: normalizeTaskDeadline(task.deadline),
    sourceRefs: cleanStringArray(task.sourceRefs).slice(0, 24),
  };
  return normalized.title && normalized.primaryCheckpointKey && normalized.purpose && normalized.steps.length >= 2 && normalized.completionExpectation && normalized.riskIfLate
    ? normalized
    : null;
}

const releaseTaskScheduleKeys = new Set([
  "distributor_delivery",
  "spotify_editorial_pitch",
  "playlist_shortlist",
  "epk_press_package",
  "content_rollout_start",
  "release_live_check",
  "post_release_review",
]);

export function normalizeReleaseTaskScheduleKeys<T extends { scheduleKey?: string }>(tasks: T[]): T[] {
  const used = new Set<string>();
  return tasks.map((task) => {
    const key = typeof task.scheduleKey === "string" ? task.scheduleKey.trim() : "";
    if (!releaseTaskScheduleKeys.has(key) || used.has(key)) {
      const { scheduleKey: _ignored, ...unbound } = task;
      return unbound as T;
    }
    used.add(key);
    return { ...task, scheduleKey: key };
  });
}

export function deriveReleaseDateProposalFromContextQuestions(
  questions: MissionGenesisQuestion[],
): { proposedDate: string; reason: string; questionKey: string } | null {
  const question = questions.find((item) =>
    /(?:approve|confirm).*(?:release|target).*date|(?:release|target).*date.*(?:approve|confirm)/i.test(`${item.key} ${item.question}`)
  );
  if (!question) return null;
  const option = question.options.find((item) => /^\s*(?:approve|confirm)\s+/i.test(item));
  if (!option) return null;
  const dateText = `${option} ${question.question}`;
  const match = dateText.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(\d{4})\b/i);
  if (!match) return null;
  const months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
  const month = months.indexOf(match[1].toLowerCase()) + 1;
  const day = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return null;
  return {
    proposedDate: `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`,
    reason: cleanString(question.reason, "The artist requested this target release date."),
    questionKey: question.key,
  };
}

function normalizeTaskDeadline(value: unknown) {
  const text = cleanString(value, "");
  if (!text) return "";
  const timestamp = Date.parse(text);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : "";
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

function distinctStrings(value: unknown) {
  const seen = new Set<string>();
  return cleanStringArray(value).filter((item) => {
    const key = item.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
