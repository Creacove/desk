import type { LucideIcon } from "lucide-react";

export type CleanProductionView =
  | "connectArtist"
  | "setup"
  | "setupActivity"
  | "paywall"
  | "desk"
  | "manager"
  | "decisionPackage"
  | "investigation"
  | "conversation"
  | "missions"
  | "music"
  | "staff"
  | "settings";

export type DrawerKind = "sources" | "evidence" | "proof" | "billing" | "profile";

export type AttentionItem = {
  id: string;
  domain: string;
  title: string;
  reason: string;
  action: string;
  actionType?: "button" | "chat";
  owner?: string;
  tone?: "urgent" | "warning" | "neutral";
  missionId?: string;
  taskId?: string;
  sourceType?: string;
  sourceId?: string;
  evidenceIds?: string[];
  conversationId?: string;
  eventType?: string;
};

export type MovementItem = {
  id: string;
  domain: string;
  title: string;
  meta: string;
  timestamp?: string;
  targetType?: string;
  targetId?: string;
  missionId?: string;
  taskId?: string;
  sourceType?: string;
  sourceId?: string;
  evidenceIds?: string[];
  conversationId?: string;
  eventType?: string;
};

export type PriorityItem = {
  id: string;
  priority: string;
  title: string;
  status: string;
  meta: string;
  action: string;
};

export type TodayBriefConfidence = "low" | "medium" | "high";
export type TodayBriefActionMode = "artist" | "manager";

export type TodayBriefMetricViewModel = {
  label: string;
  value: string;
  source: string;
};

export type TodayBriefActionViewModel = {
  id: string;
  title: string;
  owner: string;
  why: string;
  mode: TodayBriefActionMode;
  prompt?: string;
  missionId?: string;
  taskId?: string;
  musicSubject?: MusicConversationSubjectViewModel;
  sourceEventId?: string;
  evidenceIds: string[];
};

export type TodayBriefViewModel = {
  id: string;
  headline: string;
  summary: string;
  confidence: TodayBriefConfidence;
  generatedAt: string;
  metrics: TodayBriefMetricViewModel[];
  changes: Array<{ id: string; title: string; detail: string; sourceEventId?: string }>;
  actions: TodayBriefActionViewModel[];
  limitations: string[];
};

export type TodayBriefGenerationMode = "setup" | "manual" | "event";

export type TodayBriefGenerationResult = {
  brief: TodayBriefViewModel;
  runId?: string;
};

export type TodayBriefProcessingResult = {
  status: "processing";
  runId: string;
  setupMusicReadTargets?: MusicReadTarget[];
};

export type TodayBriefGenerationResponse = TodayBriefViewModel | TodayBriefGenerationResult | TodayBriefProcessingResult;

export type PublicContextRefreshResult = {
  findingsInserted: number;
  evidenceItemIds: string[];
  summary?: string;
};

export type AgentViewModel = {
  id: string;
  name: string;
  status: "available" | "locked";
  readiness: string;
  purpose: string;
  icon: LucideIcon;
  workspaceTitle: string;
  workspaceSubtitle: string;
  sections: Array<{
    eyebrow: string;
    title: string;
    actionLabel?: string;
    items: Array<{
      title: string;
      meta: string;
      status: string;
      detail: string;
      value?: string;
    }>;
  }>;
  sources: Array<{
    label: string;
    action: string;
    detail: string;
    state: "active" | "system" | "needs_upload";
  }>;
};

export type MissionViewModel = {
  id: string;
  title: string;
  status: "active" | "review" | "blocked" | "complete";
  progress: number;
  review: string;
  summary: string;
  recommendation: string;
  musicSubject: string;
  subjectType?: "artist" | "music_item" | "music_project";
  subjectId?: string;
  nextTask: string;
  tasks?: MissionTaskViewModel[];
  checkpoints?: MissionCheckpointViewModel[];
  notes?: MissionNoteViewModel[];
  recap?: MissionRecapViewModel;
  events?: MissionEventViewModel[];
};

export type MissionTaskResultViewModel = {
  status: "completed" | "blocked" | "missed" | "rejected" | "revised" | "pending";
  summary: string;
  userNote: string;
  interpretation: string;
  missionEffect: string;
  followUp: string;
};

export type MissionTaskDeliverableViewModel = {
  id: string;
  title: string;
  status: "missing" | "uploading" | "uploaded" | "checking" | "accepted" | "needs_revision" | "failed";
  documentId?: string;
  fileName?: string;
  validationSummary?: string;
};

export type MissionTaskDraftViewModel = {
  id: string;
  title: string;
  summary: string;
  status: "draft" | "needs_revision" | "accepted";
  createdAt?: string;
};

export type MissionTaskWorkMode = "artist_action" | "collaborative" | "manager_work";

export type MissionTaskViewModel = {
  id: string;
  checkpointId: string;
  title: string;
  owner: string;
  deadline: string;
  approvalState: "not_required" | "needs approval" | "approved" | "blocked" | "active";
  purpose: string;
  steps: string[];
  evidenceIds: string[];
  deliverables?: MissionTaskDeliverableViewModel[];
  workMode?: MissionTaskWorkMode;
  completionMode?: "result_note" | "manager_draft" | "evidence";
  completionExpectation?: string;
  deliverableTitle?: string;
  deliverableRequirements?: string[];
  managerResponsibility?: string;
  userResponsibility?: string;
  managerDraft?: MissionTaskDraftViewModel;
  dependency: string;
  riskIfLate: string;
  result?: MissionTaskResultViewModel;
};

export type MissionCheckpointViewModel = {
  id: string;
  phase: number;
  title: string;
  status: "Waiting on tasks" | "Ready for AI review" | "Needs revision" | "Watching signal" | "Met";
  question: string;
  requiredTaskIds: string[];
  dependsOnCheckpointIds: string[];
  unlocks: string[];
  blockedReason: string;
  dependencyImpact: string;
  watchedSignals: string[];
  decisionRule: string;
  recommendation: string;
  rationale: string;
  managerRead: string;
  nextAction: string;
};

export type MissionNoteViewModel = {
  id: string;
  route: string;
  subject: string;
  message: string;
  status: string;
  sourceBasis: string;
  recommendedAction: string;
  resultingChange: string;
  briefType: string;
  createdAt?: string;
};

export type MissionRecapViewModel = {
  finalCall: string;
  currentState: string;
  originalRequest: string;
  confidence: string;
  reviewDate: string;
  sections: Array<{ label: string; value: string }>;
  missingEvidence: string[];
  alternativesRejected: string[];
  changeDecision: string;
  override: string;
  qualityGate: string;
};

export type MissionEventViewModel = {
  id?: string;
  type: string;
  actor: string;
  summary: string;
  createdAt?: string;
};

export type MusicManagerReadViewModel = {
  position: string;
  managementRole: string;
  body: string;
  metrics: Array<{
    label: string;
    value: string;
    evidenceId: string;
  }>;
  evidenceIds: string[];
};

export type MusicManagerReadStatus =
  | "unknown"
  | "not_generated"
  | "stale"
  | "running"
  | "refreshing"
  | "fresh"
  | "failed"
  | "refresh_failed";

export type MusicManagerRunStatus =
  | "queued"
  | "running"
  | "completed"
  | "completed_with_limits"
  | "failed"
  | "cancelled";

export type SongDocumentType =
  | "lyrics"
  | "press_release"
  | "press_angle"
  | "artist_biography"
  | "one_sheet"
  | "credits"
  | "distributor_notes"
  | "epk"
  | "spotify_editorial_pitch"
  | "playlist_pitch"
  | "press_target_brief"
  | "press_pitch"
  | "content_plan"
  | "release_calendar"
  | "other";

export type SongMaterialViewModel =
  | {
      id: string;
      kind: "file";
      group: "Audio" | "Artwork" | "Documents";
      materialType: string;
      title: string;
      status: string;
      origin: "uploaded" | "imported";
    }
  | {
      id: string;
      kind: "document";
      group: "Documents";
      materialType: SongDocumentType;
      title: string;
      status: string;
      origin: "user_uploaded" | "manager_generated" | "system_generated" | "imported";
      reviewState?: "needs_review" | "ready";
      body?: string;
      fileName?: string;
      currentVersionId?: string;
    };

export type MusicObjectViewModel = {
  id: string;
  kind: "song" | "project";
  title: string;
  status?: string;
  lifecycle: string;
  lifecycleStage?: string;
  blocker: string;
  sourceKind?: string;
  sourceLimit: string;
  managerRead?: MusicManagerReadViewModel;
  managerReadSummary?: string;
  managerReadStatus: MusicManagerReadStatus;
  managerReadRunId?: string;
  managerReadError?: string;
  managerConversationId?: string;
  managerConversation?: MusicConversationLinkViewModel;
  rightsState?: string;
  assets?: string[];
  coverImageUrl?: string;
  spotifyUrl?: string;
  sourceSummary?: {
    headline: string;
    badges: string[];
    facts: Array<{ label: string; value: string; source: string; status: "Missing" | "Draft" | "Confirmed" }>;
    evidence: Array<{ label: string; value: string; source: string; window: string; limitation?: string }>;
    limitations: string[];
  };
  linkedMissionIds: string[];
  linkedTaskIds?: string[];
  linkedTaskCount: number;
  songs?: string[];
  songIds?: string[];
  projectIds?: string[];
  files?: Array<{ label: string; status: string }>;
  fileAssets?: Array<{ assetId?: string; group: "Audio" | "Artwork" | "Documents"; label: string; status: string; action: string; assetType?: string; canUpload?: boolean; canReplace?: boolean }>;
  materials?: SongMaterialViewModel[];
  details?: Array<{ label: string; value: string; status: string }>;
  metadataFields?: Array<{ label: string; value: string; status: "Missing" | "Draft" | "Confirmed" }>;
  releaseFields?: Array<{ label: string; value: string; status: "Missing" | "Draft" | "Confirmed" }>;
  credits?: Array<{ role: string; names: string; status: "Missing" | "Draft" | "Confirmed" }>;
  identifiers?: Array<{ label: string; value: string; status: "Missing" | "Draft" | "Confirmed" }>;
  splits?: {
    status: string;
    summary: string;
    writers?: string;
    producers?: string;
    publishingTotal?: string;
    masterTotal?: string;
    documentSource?: string;
    approvalLog?: string[];
    contributors: Array<{
      id?: string;
      name: string;
      role: string;
      email?: string;
      publishingShare: string;
      masterShare: string;
      approval: string;
    }>;
  };
};

export type MusicConversationLinkViewModel = {
  id: string;
  topic: string;
  summary: string;
  status: string;
  lastUpdate?: string;
};

export type MusicConversationSubjectViewModel = {
  type: "music_item" | "music_project";
  id: string;
  title: string;
  lifecycleStage?: string;
};

export type ManualSongWorkspaceResult = {
  song: MusicObjectViewModel;
  missionId: string;
  conversation: ConversationViewModel;
};

export type SplitContributorInput = {
  name: string;
  role: string;
  email: string;
  publishingShare: number;
  masterShare: number;
};

export type SplitConfirmationViewModel = {
  songTitle: string;
  contributorName: string;
  contributorRole: string;
  publishingShare: string;
  masterShare: string;
  status: string;
  contributors: Array<{
    name: string;
    role: string;
    publishingShare: string;
    masterShare: string;
  }>;
};

export type ConversationMessageViewModel = {
  id: string;
  speaker: "artist" | "manager";
  label: string;
  body: string;
  status?: "sending" | "streaming" | "sent" | "failed";
  runId?: string;
  createdAt?: string;
  presentation?: ManagerConversationPresentation;
  createdWork?: ManagerConversationCreatedWork[];
};

export type ManagerConversationMessageSource = {
  evidenceId: string;
  sourceLabel: string;
  sourceKind: string;
  confidence?: string;
  limitation?: string;
};

export type ManagerConversationPresentation = {
  responseKind: "text" | "mission" | "decision" | "investigation" | "document" | "mixed";
  surfaces: Array<"chat" | "mission" | "decision_package" | "investigation" | "document">;
  primarySurface: "chat" | "mission" | "decision_package" | "investigation" | "document";
  missionId?: string;
  decisionPackageId?: string;
  investigationId?: string;
  documentId?: string;
};

export type ManagerConversationCreatedWork = {
  type: "mission" | "task" | "document" | "decision_package" | "investigation" | "release_opportunity";
  id: string;
  title?: string;
  missionId?: string;
  taskId?: string;
  documentType?: SongDocumentType;
};

export type ManagerConversationMusicSubject = {
  type: "music_item" | "music_project";
  id: string;
  title: string;
  lifecycleStage?: string;
};

export type ManagerConversationContextAnswer = {
  text: string;
  sources?: ManagerConversationMessageSource[];
};

export type ReleaseDateChangeRequestViewModel = {
  id: string;
  status: "pending" | "approved" | "declined" | "cancelled";
  currentDate?: string;
  proposedDate: string;
  reason: string;
  requestMessage: string;
  requestedAt?: string;
  resolvedAt?: string;
  requestedBy?: string;
  decision?: string;
  conversationId?: string;
  missionId?: string;
  musicSubject?: ManagerConversationMusicSubject;
};

export type ReleaseDateChangeProposalInput = {
  musicItemId: string;
  currentDate?: string;
  proposedDate: string;
  reason: string;
  requestMessage: string;
  conversationId?: string;
  missionId?: string;
};

export type ReleaseDateChangeReceiptViewModel = {
  status: "approved";
  requestId: string;
  musicItemId: string;
  requestedDate: string;
  previousDate?: string;
  changedAt: string;
  missionId?: string;
  conversationId?: string;
};

export type ReleaseOpportunityTargetViewModel = {
  id: string;
  missionId?: string;
  musicItemId: string;
  subjectTitle: string;
  opportunityType: "playlist" | "press";
  platform?: string;
  targetName: string;
  organization?: string;
  sourceUrl?: string;
  targetUrl?: string;
  contactKind?: string;
  publicContactValue?: string;
  publicContactSourceUrl?: string;
  contactVerifiedAt?: string;
  fitScore?: number;
  fitReasons: string[];
  fitSummary?: string;
  evidenceIds: string[];
  confidence?: string;
  limitations: string[];
  safetyState?: string;
  requirements: string[];
  pitchDocumentId?: string;
  pitchDocumentTitle?: string;
  pitchBody?: string;
  status?: string;
  outcome?: string;
  updatedAt?: string;
};

export type ReleaseOpportunityArtifactViewModel = {
  id: string;
  type: "playlist_shortlist" | "press_shortlist";
  title: string;
  subjectTitle: string;
  missionId?: string;
  targets: ReleaseOpportunityTargetViewModel[];
  generatedAt?: string;
};

export type ReleaseSuccessArtifactViewModel = {
  id: string;
  type: "release_scorecard" | "release_review";
  title: string;
  musicItemId: string;
  missionId?: string;
  generatedAt?: string;
  metrics: Array<{ label: string; value: string; source?: string }>;
  learnings: string[];
  nextActions: string[];
  summary?: string;
};

export type ReleaseOpportunityArtifactKind = ReleaseOpportunityArtifactViewModel["type"];

export type ReleaseOpportunityTargetKind = ReleaseOpportunityTargetViewModel["opportunityType"];

export type ReleaseOpportunityTargetStatus = "identified" | "prepared" | "sent" | "replied" | "committed" | "posted" | "declined";

export type ReleaseOpportunityOutcome = "won" | "lost" | "pending";

export type ReleaseOpportunityArtifactState = "draft" | "ready";

export type ReleaseOpportunitySafetyState = "safe" | "manual_review" | "unsafe";

export type ReleaseOpportunityContactKind = "email" | "form" | "dm" | "submission";

export type MusicReadTarget = {
  type: "music_item" | "music_project";
  id: string;
};

export type ManagerRunStepViewModel = {
  id: string;
  runId: string;
  sequence: number;
  label: string;
  status: string;
  agent: string;
  detail: string;
  startedAt?: string;
  completedAt?: string;
};

export type ManagerConversationRefreshHint = {
  kind: "refresh";
  resources: Array<"desk" | "missions" | "music" | "conversation" | "workspace">;
  reason?: string;
};

export type ManagerConversationStreamEvent =
  | { kind: "status"; runId?: string; message?: string }
  | { kind: "delta"; runId?: string; text: string }
  | { kind: "message"; runId?: string; message: ConversationMessageViewModel }
  | { kind: "artifact"; runId?: string; createdWork: ManagerConversationCreatedWork[] }
  | { kind: "presentation"; runId?: string; presentation: ManagerConversationPresentation }
  | ManagerConversationRefreshHint
  | { kind: "done"; runId?: string; conversation?: ConversationViewModel; message?: ConversationMessageViewModel; presentation?: ManagerConversationPresentation; createdWork?: ManagerConversationCreatedWork[] }
  | { kind: "error"; runId?: string; message: string; retryable?: boolean };

export type ManagerConversationInput = {
  conversationId?: string;
  taskContextId?: string;
  musicSubject?: ManagerConversationMusicSubject;
  text: string;
  requestId?: string;
};

export type ConversationViewModel = {
  id: string;
  topic: string;
  status: string;
  summary: string;
  prompt: string;
  lastUpdate?: string;
  messages: ConversationMessageViewModel[];
  decisionPackage?: DecisionPackageViewModel;
  taskContextId?: string;
  musicSubject?: ManagerConversationMusicSubject;
  createdWork?: ManagerConversationCreatedWork[];
  releaseSuccessArtifacts?: ReleaseSuccessArtifactViewModel[];
  releaseOpportunityArtifacts?: ReleaseOpportunityArtifactViewModel[];
};

export type ManagerConversationReviewRequest = {
  action: "manager_review";
  taskId: string;
  resultSummary: string;
};

export type ManagerConversationReviewResponse = {
  message: ConversationMessageViewModel;
  task?: MissionTaskViewModel;
  checkpoint?: MissionCheckpointViewModel;
};

export type DecisionPackageViewModel = {
  id: string;
  title: string;
  decision: string;
  status: "pending" | "accepted" | "declined";
  owner: string;
  confidence: string;
  rationale: string;
  proofIds: string[];
  alternatives: Array<{ title: string; whyNot: string }>;
};

export type InvestigationViewModel = {
  id: string;
  title: string;
  status: string;
  trigger: string;
  facts: string[];
  suspects: string[];
  conclusion: string;
  nextActions: string[];
};

export type EvidenceItemViewModel = {
  id: string;
  source: string;
  sourceKind: string;
  claim: string;
  freshness: string;
  confidence: string;
  limitation: string;
};

export type MusicUploadProgress = {
  phase: "preparing" | "uploading" | "finalizing";
  percent: number;
  bytesUploaded: number;
  bytesTotal: number;
};

export type ArtistProfileViewModel = {
  displayName: string;
  spotifyIdentity?: {
    id: string;
    name: string;
    url?: string;
    imageUrl?: string;
  };
  genres: string[];
  homeMarket: string;
  stage: string;
  artistDirection: string;
  currentGoal: string;
  budgetContext: string;
};

export type MissionGenesisResultViewModel = {
  mission: MissionViewModel;
  conversation: ConversationViewModel;
};

export type CleanProductionRepositories = {
  loadDesk: () => Promise<{
    brief: TodayBriefViewModel | null;
    attention: AttentionItem[];
    movement: MovementItem[];
  }>;
  generateTodayBrief: (input?: { mode?: TodayBriefGenerationMode; force?: boolean }) => Promise<TodayBriefGenerationResponse>;
  loadTodayBriefRun?: (runId: string) => Promise<TodayBriefGenerationResponse>;
  refreshTodayPublicContext?: () => Promise<PublicContextRefreshResult>;
  loadArtistProfile: () => Promise<ArtistProfileViewModel>;
  updateArtistProfile?: (input: ArtistProfileViewModel) => Promise<ArtistProfileViewModel>;
  loadAgents: () => Promise<AgentViewModel[]>;
  loadConversations: () => Promise<ConversationViewModel[]>;
  loadConversation: (id: string) => Promise<ConversationViewModel>;
  sendManagerMessage?: (input: ManagerConversationInput) => Promise<ConversationViewModel>;
  sendManagerMessageStream?: (input: ManagerConversationInput, handlers: { onEvent: (event: ManagerConversationStreamEvent) => void; signal?: AbortSignal }) => Promise<ConversationViewModel | null>;
  answerManagerContext?: (input: { subject?: ManagerConversationMusicSubject; taskId?: string; question: string }) => Promise<ManagerConversationContextAnswer>;
  requestTaskManagerReview?: (input: ManagerConversationReviewRequest) => Promise<ManagerConversationReviewResponse>;
  acceptDecisionPackage?: (id: string) => Promise<DecisionPackageViewModel>;
  declineDecisionPackage?: (id: string, reason: string) => Promise<DecisionPackageViewModel>;
  createMissionFromDecision?: (id: string) => Promise<{ mission: MissionViewModel; conversation?: ConversationViewModel }>;
  createMissionFromConversation?: (conversationId: string) => Promise<{ mission: MissionViewModel; conversation?: ConversationViewModel }>;
  createManualSongWorkspace?: (input: { title: string; lifecycleStage?: string }) => Promise<ManualSongWorkspaceResult>;
  updateMusicItem?: (id: string, input: { title?: string; lifecycleStage?: string }) => Promise<MusicObjectViewModel>;
  createReleaseMission?: (input: { musicItemId: string; releaseDate?: string; budgetContext?: string }) => Promise<ManualSongWorkspaceResult>;
  loadMissions: () => Promise<MissionViewModel[]>;
  loadMission: (id: string) => Promise<MissionViewModel>;
  approveMissionTask: (id: string) => Promise<MissionTaskViewModel>;
  completeMissionTask: (id: string, input: { status: "completed" | "blocked"; note: string; documentIds?: string[]; managerOutputId?: string }) => Promise<MissionTaskViewModel>;
  uploadMissionTaskDeliverable?: (id: string, input: { title: string; file: File }) => Promise<MissionTaskDeliverableViewModel>;
  loadMusic: () => Promise<MusicObjectViewModel[]>;
  loadMusicItem?: (id: string) => Promise<MusicObjectViewModel>;
  loadMusicProject?: (id: string) => Promise<MusicObjectViewModel>;
  createSongDocument?: (musicItemId: string, input: { title: string; documentType: SongDocumentType; body: string }) => Promise<SongMaterialViewModel>;
  updateSongDocument?: (documentId: string, input: { title?: string; body: string }) => Promise<SongMaterialViewModel>;
  approveSongDocument?: (documentId: string) => Promise<void>;
  saveIdentifier?: (musicItemId: string, input: { identifierType: string; identifierValue: string }) => Promise<void>;
  saveSplitContributor?: (musicItemId: string, input: SplitContributorInput) => Promise<void>;
  removeSplitContributor?: (musicItemId: string, contributorId: string) => Promise<void>;
  sendSplitConfirmationLinks?: (musicItemId: string) => Promise<void>;
  loadSplitConfirmation?: (token: string) => Promise<SplitConfirmationViewModel>;
  submitSplitConfirmation?: (token: string, input: { decision: "approve" | "request_change"; confirmationText?: string; correctionReason?: string }) => Promise<void>;
  createShareLink?: (input: { musicSubject: ManagerConversationMusicSubject; assetIds: string[]; documentIds: string[]; informationKeys: string[]; preset?: string; recipientEmail?: string; label?: string }) => Promise<{ id: string; url: string; expiresAt?: string; accessMode?: string; emailSent?: boolean }>;
  listShareLinks?: (musicSubject: ManagerConversationMusicSubject) => Promise<Array<{ id: string; url: string; status: string; expiresAt?: string; recipientEmail?: string; label?: string; createdAt?: string }>>;
  sendShareLink?: (input: { shareLinkId: string; url: string; recipientEmail: string }) => Promise<{ status: "sent"; shareLinkId: string; recipientEmail: string }>;
  revokeShareLink?: (shareLinkId: string) => Promise<void>;
  getAssetAccessUrl?: (musicItemId: string, assetId: string) => Promise<string>;
  uploadAsset?: (musicItemId: string, input: { assetType: string; title: string; file: File; onProgress?: (progress: MusicUploadProgress) => void }) => Promise<MusicObjectViewModel>;
};

export type ProductionFixtureData = {
  brief: TodayBriefViewModel;
  attention: AttentionItem[];
  movement: MovementItem[];
  artistProfile: ArtistProfileViewModel;
  agents: AgentViewModel[];
  conversations: ConversationViewModel[];
  missions: MissionViewModel[];
  music: MusicObjectViewModel[];
  evidence: EvidenceItemViewModel[];
};
