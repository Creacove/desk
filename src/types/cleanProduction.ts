import type { LucideIcon } from "lucide-react";

export type CleanProductionView =
  | "labelHQ"
  | "managerOffice"
  | "conversationWorkspace"
  | "investigation"
  | "decisionPackage"
  | "staffWorkspace"
  | "agentWorkspace"
  | "missionsWorkspace"
  | "musicWorkspace"
  | "settings";

export type DrawerKind = "evidence" | "missionRecord" | "workDraft" | null;

export type PriorityItem = {
  label: string;
  value: string;
  meta: string;
  actionLabel: string;
  target: CleanProductionView;
};

export type AttentionItem = {
  title: string;
  body: string;
  tone: "warning" | "accent" | "neutral";
};

export type MovementItem = {
  label: string;
  title: string;
  time: string;
};

export type TodayBriefMetric = {
  label: string;
  value: string;
  context?: string;
  evidenceIds: string[];
};

export type TodayBriefSnapshotGroup = {
  title: string;
  insight: string;
  metrics: TodayBriefMetric[];
};

export type TodayBriefViewModel = {
  headlineRead: string;
  intelligenceSnapshot: TodayBriefSnapshotGroup[];
  snapshotSummary: string;
  managerRead: string;
  managerEvidenceReads?: Array<{
    label: string;
    value?: string;
    category?: "kpi" | "signal" | "asset" | "market" | "management";
    read: string;
    evidenceIds: string[];
    confidence?: string;
  }>;
  sourceLine: string;
  confidence: "high" | "medium" | "low" | "limited" | "unknown";
  generatedAt?: string;
  managerSynthesisRunId?: string;
  managerOutputId?: string;
  managerIntelligencePacketId?: string;
  state?: "fresh" | "limited" | "fallback" | "failed";
};

export type TodayBriefGenerationMode = "setup-map" | "operating";
export type MusicReadTarget = { subjectType: "music_item" | "music_project"; subjectId: string };

export type TodayBriefGenerationResponse = {
  status?: "processing";
  runId?: string;
  brief?: TodayBriefViewModel;
  setupMusicReadTargets?: MusicReadTarget[];
} & Partial<TodayBriefViewModel>;

export type PublicContextRefreshResult = {
  findingsInserted: number;
  evidenceItemIds: string[];
  summary?: string;
};

export type DeskSnapshot = {
  priority: PriorityItem[];
  attention: AttentionItem[];
  movement: MovementItem[];
  todayBrief: TodayBriefViewModel;
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
    items: Array<{
      title: string;
      meta: string;
      status: string;
      detail: string;
    }>;
  }>;
  sources: Array<{
    label: string;
    action: string;
    detail: string;
    state: "needs_upload" | "connected";
  }>;
};

export type ManagerRunStepViewModel = {
  id: string;
  label: string;
  detail: string;
  state: "pending" | "running" | "complete" | "failed";
};

export type ManagerConversationContextQuestion = {
  key: string;
  question: string;
  reason: string;
  answerKind: "short_text" | "single_select" | "multi_select" | "money_range";
  options: string[];
  recommendedAnswer?: string;
  recommendationReason?: string;
};

export type ManagerConversationContextAnswer = {
  questionKey: string;
  answer: string;
};

export type ManagerConversationMusicSubject = {
  type: "music_item" | "music_project";
  id: string;
  title: string;
  lifecycleStage?: string;
};

export type MusicConversationSubjectViewModel = ManagerConversationMusicSubject;

export type MusicConversationLinkViewModel = {
  id: string;
  topic: string;
  summary: string;
  status: string;
  lastUpdate?: string;
};

export type ManagerConversationAttachmentViewModel = {
  id: string;
  musicItemId: string;
  title: string;
  assetType?: string;
  status?: string;
};

export type ManagerConversationRefreshHint = {
  scope: "missions" | "music" | "manager" | "desk" | "evidence";
  reason: string;
  missionId?: string;
  musicItemId?: string;
};

export type ManagerConversationStreamEvent =
  | { type: "run_started"; runId: string; conversationId?: string }
  | { type: "step_started"; runId: string; step: ManagerRunStepViewModel }
  | { type: "step_finished"; runId: string; step: ManagerRunStepViewModel }
  | { type: "conversation_saved"; runId: string; conversation: ConversationViewModel }
  | { type: "refresh_hint"; runId: string; hint: ManagerConversationRefreshHint }
  | { type: "run_completed"; runId: string; conversation: ConversationViewModel }
  | { type: "run_failed"; runId: string; error: string; conversation?: ConversationViewModel };

export type ReleaseDateChangeMovedItem = {
  taskId: string;
  title: string;
  from: string | null;
  to: string;
};

export type ReleaseDateChangePreservedItem = {
  taskId: string;
  reason: string;
};

export type ReleaseDateChangePreview = {
  musicItemId: string;
  releasePlanId: string;
  missionId?: string;
  fromDate: string | null;
  proposedDate: string;
  expectedRevision: number;
  moved: ReleaseDateChangeMovedItem[];
  preserved: ReleaseDateChangePreservedItem[];
  nextDeadline: { taskId: string; title: string; deadline: string } | null;
};

export type ReleaseDateChangeProposalInput = {
  musicItemId: string;
  proposedDate: string;
  reason?: string;
  expectedRevision: number;
  preview: ReleaseDateChangePreview;
  previewHash: string;
  idempotencyKey: string;
};

export type ReleaseDateChangeRequestViewModel = {
  requestId: string;
  idempotencyKey: string;
  releasePlanId: string;
  musicItemId: string;
  missionId?: string;
  fromDate?: string | null;
  proposedDate: string;
  reason?: string;
  status: "pending" | "approved" | "rejected" | "superseded" | "expired" | "failed";
  expectedPlanRevision: number;
  previewHash: string;
  preview: ReleaseDateChangePreview;
  expiresAt: string;
};

export type ReleaseDateChangeReceiptViewModel = {
  requestId: string;
  releasePlanId: string;
  musicItemId: string;
  missionId?: string;
  fromDate: string | null;
  approvedDate: string;
  previousRevision: number;
  revision: number;
  moved: ReleaseDateChangeMovedItem[];
  preserved: ReleaseDateChangePreservedItem[];
  nextDeadline: { taskId: string; title: string; deadline: string } | null;
  operatingEventId?: string;
};

export type ConversationViewModel = {
  id: string;
  taskContextId?: string;
  musicSubject?: MusicConversationSubjectViewModel;
  topic: string;
  status: string;
  summary: string;
  prompt: string;
  lastUpdate?: string;
  messages: Array<{
    id: string;
    speaker: "artist" | "manager";
    label: string;
    body: string;
    createdWork?: Array<{
      type: "music_item" | "mission" | "task";
      title: string;
      body: string;
      artifactKind?: "task_draft" | "song_document";
      content?: string;
      musicItemId?: string;
      documentType?: string;
      readiness?: "ready" | "needs_review" | "save_failed";
      missingInputs?: string[];
      managerOutputId?: string;
      id?: string;
      parentMissionId?: string;
      status?: "created" | "updated" | "approval_required" | "failed" | "pending";
    }>;
    contextRequestId?: string;
    contextQuestions?: ManagerConversationContextQuestion[];
    contextAnswers?: ManagerConversationContextAnswer[];
    attachments?: ManagerConversationAttachmentViewModel[];
  }>;
  decisionPackage?: {
    id: string;
    title: string;
    summary: string;
    recommendation: string;
    confidence: string;
    actionPolicy: string;
    evidenceIds: string[];
    limitations: string[];
    createdWork: NonNullable<ConversationViewModel["createdWork"]>;
    proposedActions: Array<{
      title: string;
      body: string;
      actionType: string;
      targetType: string;
      approvalRequired: boolean;
    }>;
    createdAt?: string;
  };
  createdWork?: Array<{
    type: "music_item" | "mission" | "task";
    title: string;
    body: string;
    artifactKind?: "task_draft" | "song_document";
    content?: string;
    musicItemId?: string;
    documentType?: string;
    readiness?: "ready" | "needs_review" | "save_failed";
    missingInputs?: string[];
    managerOutputId?: string;
    id?: string;
    parentMissionId?: string;
    status?: "created" | "updated" | "approval_required" | "failed" | "pending";
  }>;
  releaseSuccessArtifacts?: ReleaseSuccessArtifactViewModel[];
  releaseOpportunityArtifacts?: ReleaseOpportunityArtifactViewModel[];
};

export type ReleaseOpportunitySourceEvidence = {
  source: string;
  ref?: string;
  observedAt?: string;
};

export type ReleaseOpportunityPublicContact = {
  kind: "email" | "submission_form" | "contact_page";
  value: string;
  sourceUrl: string;
  verifiedAt?: string;
};

export type ReleaseOpportunityTargetViewModel = {
  id: string;
  targetName: string;
  platform?: string;
  sourceUrl: string;
  targetUrl?: string;
  publicOrganization?: string;
  publicContact?: ReleaseOpportunityPublicContact;
  fit: {
    songCriteria: string[];
    targetCriteria: string[];
    explanation: string;
    recency?: string;
    market?: string;
  };
  sourceEvidence: ReleaseOpportunitySourceEvidence[];
  confidence: "high" | "medium" | "low" | "unknown";
  limitations: string[];
  requirements: string[];
  safetyState: "clear" | "caution" | "excluded";
  status: "watch" | "shortlisted" | "approved" | "submitted_manually" | "replied" | "accepted" | "declined" | "skipped";
  manualOutcome?: string;
  pitchDocumentId?: string;
  document?: {
    id: string;
    title: string;
    body?: string;
    status?: string;
  };
  package?: {
    selectedFiles: string[];
    pitchBody?: string;
    shareUrl?: string;
  };
};

export type ReleaseOpportunityArtifactViewModel = {
  id: string;
  musicItemId: string;
  missionId?: string;
  opportunityType: "playlist" | "press";
  subject: {
    title: string;
    itemType: "music_item";
  };
  shortlist: ReleaseOpportunityTargetViewModel[];
  watch: ReleaseOpportunityTargetViewModel[];
  excluded: ReleaseOpportunityTargetViewModel[];
};

export type ReleaseSuccessArtifactViewModel = {
  id: string;
  musicItemId: string;
  musicTitle: string;
  missionId?: string;
  recommendation: "hold" | "move" | "review";
  shortAnswer: string;
  confidence: "high" | "medium" | "low" | "unknown";
  limitations: string[];
  evidenceIds: string[];
  nextReviewAt?: string;
  createdAt?: string;
  requestId?: string;
  sourceRevision?: number;
  actionPolicy?: string;
  movement?: Array<{
    type: "music_item" | "mission" | "task";
    id?: string;
    title: string;
    body: string;
    status?: "created" | "updated" | "approval_required" | "failed" | "pending";
  }>;
  change?: {
    state: "preview" | "approved" | "failed";
    proposedDate: string;
    fromDate?: string | null;
    reason?: string;
    expectedPlanRevision: number;
    previewHash: string;
    idempotencyKey: string;
    preview: ReleaseDateChangePreview;
    request?: ReleaseDateChangeRequestViewModel;
    receipt?: ReleaseDateChangeReceiptViewModel;
    error?: string;
  };
};

export type MissionGenesisResultViewModel = {
  outcome: "activate_mission" | "candidate_needs_context" | "request_evidence" | "update_existing_mission" | "no_mission";
  title: string;
  body: string;
  reasons: string[];
  missionIds?: string[];
  candidateMissionIds?: string[];
  activatedMissionIds?: string[];
  candidateMissionId?: string;
  activatedMissionId?: string;
  evidenceNeeded: string[];
  questions: ManagerConversationContextQuestion[];
};

export type MissionTaskResultViewModel = {
  status: "completed" | "blocked" | "revised";
  summary: string;
  userNote: string;
  interpretation: string;
  missionEffect: string;
  followUp: string;
};

export type MissionTaskDeliverableViewModel = {
  id: string;
  title: string;
  status: "uploaded" | "checking" | "accepted" | "needs_revision" | "failed";
  documentId?: string;
  fileName?: string;
  validationSummary?: string;
};

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
  workMode?: "artist_action" | "collaborative" | "manager_work";
  completionMode?: "evidence" | "attestation" | "manager_draft";
  completionExpectation?: string;
  deliverableTitle?: string;
  deliverableRequirements?: string[];
  managerResponsibility?: string;
  userResponsibility?: string;
  managerDraft?: {
    id: string;
    title: string;
    summary: string;
    status: "draft" | "needs_revision" | "accepted";
    createdAt?: string;
  };
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

export type MissionEventViewModel = {
  type: string;
  actor: string;
  summary: string;
  createdAt?: string;
};

export type MissionViewModel = {
  id: string;
  title: string;
  status: "active" | "candidate" | "complete" | "archived" | "cancelled";
  progress: number;
  review: string;
  summary: string;
  recommendation: string;
  musicSubject: string;
  subjectType?: "music_item" | "music_project";
  subjectId?: string;
  nextTask: string;
  checkpoints?: MissionCheckpointViewModel[];
  tasks: MissionTaskViewModel[];
  notes?: MissionNoteViewModel[];
  events?: MissionEventViewModel[];
};

export type MusicManagerReadStatus =
  | "unknown"
  | "not_generated"
  | "running"
  | "refreshing"
  | "fresh"
  | "stale"
  | "failed"
  | "refresh_failed";

export type MusicManagerRunStatus =
  | "queued"
  | "running"
  | "completed"
  | "completed_with_limits"
  | "failed"
  | "cancelled";

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

export type MusicObjectViewModel = {
  id: string;
  kind: "song" | "project";
  title: string;
  status: string;
  lifecycle: string;
  lifecycleStage?: string;
  blocker: string;
  sourceKind: string;
  sourceLimit: string;
  sourceSummary?: {
    headline: string;
    badges: string[];
    facts: Array<{
      label: string;
      value: string;
      source: string;
      status: "Confirmed" | "Missing";
    }>;
    evidence: Array<{
      label: string;
      value: string;
      source: string;
      window: string;
      limitation?: string;
    }>;
    limitations: string[];
  };
  managerRead?: MusicManagerReadViewModel;
  managerReadSummary?: string;
  managerReadStatus: MusicManagerReadStatus;
  managerReadRunId?: string;
  managerReadError?: string;
  rightsState?: string;
  assets?: string[];
  coverImageUrl?: string;
  spotifyUrl?: string;
  linkedMissionIds?: string[];
  linkedTaskIds?: string[];
  linkedTaskCount?: number;
  managerConversationId?: string;
  managerConversation?: MusicConversationLinkViewModel;
  projectIds?: string[];
  songs?: string[];
  songIds?: string[];
  files?: Array<{ label: string; status: string }>;
  fileAssets?: Array<{
    assetId?: string;
    group: "Audio" | "Artwork" | "Documents";
    label: string;
    status: string;
    action: string;
    assetType?: string;
    canUpload?: boolean;
    canReplace?: boolean;
  }>;
  materials?: SongMaterialViewModel[];
  details?: Array<{ label: string; value: string; status: string }>;
  metadataFields?: Array<{ label: string; value: string; status: string }>;
  releaseFields?: Array<{ label: string; value: string; status: string }>;
  credits?: Array<{ role: string; names: string; status: string }>;
  identifiers?: Array<{ label: string; value: string; status: string }>;
  splits?: {
    status: string;
    summary: string;
    writers: string;
    producers: string;
    publishingTotal?: string;
    masterTotal?: string;
    contributors?: Array<{
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
      fileName?: string;
    }
  | {
      id: string;
      kind: "document";
      group: "Documents";
      materialType: SongDocumentType;
      title: string;
      status: string;
      origin: "user_uploaded" | "manager_generated" | "system_generated" | "imported";
      reviewState?: "ready" | "needs_review" | "needs_revision";
      body?: string;
      fileName?: string;
      currentVersionId?: string;
    };

export type MusicUploadProgress = {
  phase: "preparing" | "uploading" | "finalizing" | "complete";
  percent: number;
  bytesUploaded: number;
  bytesTotal: number;
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

export type SpotifyCatalogSearchResult = {
  artist: {
    spotifyArtistId: string;
    name: string;
  };
  catalog: {
    albums: Array<{ id: string; name: string; releaseDate?: string; totalTracks?: number; coverImageUrl?: string }>;
    singles: Array<{ id: string; name: string; releaseDate?: string; totalTracks?: number; coverImageUrl?: string }>;
    compilations: Array<{ id: string; name: string; releaseDate?: string; totalTracks?: number; coverImageUrl?: string }>;
    appearsOn: Array<{ id: string; name: string; releaseDate?: string; totalTracks?: number; coverImageUrl?: string }>;
    standaloneSingles: Array<{ id: string; name: string; durationMs?: number; previewUrl?: string | null; coverImageUrl?: string }>;
  };
  fetchedAt: string;
};

export type SpotifyImportResult = {
  status: "imported" | "reimported" | "already_current";
  kind: "album" | "single" | "compilation" | "appears_on" | "track";
  sourceId: string;
  musicProjectId?: string;
  musicItemIds: string[];
  syncJobId: string;
  completedAt: string;
};

export type ManualSongWorkspaceResult = {
  song: MusicObjectViewModel;
  missionId: string;
  conversation: ConversationViewModel;
};

export type ArtistProfileViewModel = {
  name: string;
  spotify: string;
  genre: string;
  market: string;
  release: string;
  goal: string;
  budget: string;
  stage: string;
  tiktok: string;
  instagram: string;
  youtube: string;
  x: string;
  imageUrl?: string;
  artistIntelligence?: {
    headline: string;
    marketRead: string;
    platformRead: string;
    socialRead: string;
    limitations: string[];
  };
};

export type EvidenceItemViewModel = {
  id: string;
  source: string;
  sourceKind: string;
  subject: string;
  metric: string;
  window: string;
  confidence: string;
  limitation: string;
};

export type MusicSharePreset = "listen" | "epk_press" | "delivery" | "custom";

export type MusicShareLinkViewModel = {
  id: string;
  label: string;
  url: string;
  preset: MusicSharePreset;
  recipientEmail?: string;
  createdAt?: string;
};

export type MusicShareLinkHistoryItem = {
  id: string;
  label: string;
  preset: MusicSharePreset;
  state: "active" | "revoked" | "expired";
  recipientEmail?: string;
  createdAt?: string;
  assetCount: number;
  accessCount: number;
};

export type MusicRepository = {
  loadMusic: () => Promise<MusicObjectViewModel[]>;
  loadMusicList?: () => Promise<MusicObjectViewModel[]>;
  loadMusicObject?: (subjectId: string, subjectType: "music_item" | "music_project") => Promise<MusicObjectViewModel | null>;
  loadManagerRun?: (runId: string) => Promise<{
    id: string;
    status: MusicManagerRunStatus;
    subjectId: string;
    subjectType: "music_item" | "music_project";
    error?: string;
  } | null>;
  startManagerRead?: (subjectId: string, subjectType: "music_item" | "music_project") => Promise<MusicObjectViewModel>;
  searchSpotifyCatalog?: (input: { kind: "album" | "single" | "compilation" | "appears_on" | "track"; albumId?: string }) => Promise<SpotifyCatalogSearchResult>;
  importSpotifySelection?: (input: { kind: "album" | "single" | "compilation" | "appears_on" | "track"; albumId?: string; trackId?: string }) => Promise<SpotifyImportResult>;
  createSong?: (input: { title: string; itemType: string; lifecycleStage: string }) => Promise<MusicObjectViewModel>;
  createSongWorkspace?: (input: { title: string; itemType: string; lifecycleStage: string; requestId?: string }) => Promise<ManualSongWorkspaceResult>;
  createProject?: (input: { title: string; projectType: string; lifecycleStage: string }) => Promise<MusicObjectViewModel>;
  updateLifecycleStage?: (musicItemId: string, lifecycleStage: string) => Promise<void>;
  saveDetail?: (musicItemId: string, input: { group: "Metadata" | "Release" | "Credits" | "Identifiers"; label: string; value: string }) => Promise<void>;
  saveCredit?: (musicItemId: string, input: { role: string; name: string }) => Promise<void>;
  createSongDocument?: (musicItemId: string, input: { documentType: SongDocumentType; title: string; body: string }) => Promise<Extract<SongMaterialViewModel, { kind: "document" }>>;
  updateSongDocument?: (documentId: string, input: { title?: string; body: string }) => Promise<Extract<SongMaterialViewModel, { kind: "document" }>>;
  approveSongDocument?: (documentId: string) => Promise<void>;
  saveIdentifier?: (musicItemId: string, input: { identifierType: string; identifierValue: string }) => Promise<void>;
  saveSplitContributor?: (musicItemId: string, input: SplitContributorInput) => Promise<void>;
  removeSplitContributor?: (musicItemId: string, contributorId: string) => Promise<void>;
  sendSplitConfirmationLinks?: (musicItemId: string) => Promise<void>;
  loadSplitConfirmation: (token: string) => Promise<SplitConfirmationViewModel>;
  submitSplitConfirmation: (token: string, input: { decision: "confirmed" | "correction_requested"; confirmationText?: string; correctionReason?: string }) => Promise<void>;
  uploadAsset?: (
    musicItemId: string,
    input: {
      group: "Audio" | "Artwork" | "Documents";
      assetType: string;
      title: string;
      file: File;
      onProgress?: (progress: MusicUploadProgress) => void;
    },
  ) => Promise<NonNullable<MusicObjectViewModel["fileAssets"]>[number]>;
  getAssetAccessUrl?: (musicItemId: string, assetId: string) => Promise<string>;
  createShareLink?: (input: {
    musicSubject: { id: string; type: "music_item" | "music_project"; title: string };
    assetIds: string[];
    documentIds: string[];
    informationKeys: string[];
    preset: MusicSharePreset;
    recipientEmail?: string;
    label?: string;
  }) => Promise<MusicShareLinkViewModel>;
  listShareLinks?: (musicSubject: { id: string; type: "music_item" | "music_project" }) => Promise<MusicShareLinkHistoryItem[]>;
  sendShareLink?: (input: { shareLinkId: string; url: string; recipientEmail: string }) => Promise<{ status: "sent"; shareLinkId: string; recipientEmail: string }>;
  revokeShareLink?: (shareLinkId: string) => Promise<void>;
};

export type CleanProductionRepositories = {
  desk: {
    loadDesk: () => Promise<DeskSnapshot>;
    loadActivity: () => Promise<Pick<DeskSnapshot, "priority" | "attention" | "movement">>;
    loadBrief: () => Promise<TodayBriefViewModel>;
    generateTodaysBrief?: (mode?: TodayBriefGenerationMode) => Promise<TodayBriefGenerationResponse>;
    loadTodaysBriefRunStatus?: (runId: string) => Promise<{ status: string; error?: string }>;
    refreshPublicContext?: () => Promise<PublicContextRefreshResult>;
  };
  staff: {
    loadAgents: () => Promise<AgentViewModel[]>;
  };
  music: MusicRepository;
  manager: {
    loadConversationList?: () => Promise<ConversationViewModel[]>;
    loadConversation?: (conversationId: string) => Promise<ConversationViewModel | null>;
    loadConversations: () => Promise<ConversationViewModel[]>;
    sendMessage?: (input: {
      conversationId?: string;
      body: string;
      taskId?: string;
      musicSubject?: ManagerConversationMusicSubject;
      contextRequestId?: string;
      contextAnswers?: ManagerConversationContextAnswer[];
      attachmentIds?: string[];
    }) => Promise<ConversationViewModel>;
    sendMessageStream?: (
      input: {
        conversationId?: string;
        body: string;
        taskId?: string;
        musicSubject?: ManagerConversationMusicSubject;
        contextRequestId?: string;
        contextAnswers?: ManagerConversationContextAnswer[];
        attachmentIds?: string[];
      },
      handlers: { onEvent: (event: ManagerConversationStreamEvent) => void },
    ) => Promise<void>;
    proposeReleaseDateChange?: (input: ReleaseDateChangeProposalInput) => Promise<ReleaseDateChangeRequestViewModel>;
    approveReleaseDateChange?: (input: { requestId: string; previewHash: string; idempotencyKey: string }) => Promise<ReleaseDateChangeReceiptViewModel>;
  };
  missions: {
    loadMissionList?: () => Promise<MissionViewModel[]>;
    loadMission?: (missionId: string) => Promise<MissionViewModel | null>;
    loadMissions: () => Promise<MissionViewModel[]>;
    approveTask: (taskId: string) => Promise<void>;
    uploadTaskDeliverable?: (taskId: string, input: { title: string; file: File }) => Promise<MissionTaskDeliverableViewModel>;
    completeTask: (
      taskId: string,
      input: { status: "completed" | "blocked"; note: string; documentIds?: string[]; managerOutputId?: string },
    ) => Promise<MissionViewModel>;
  };
  missionGenesis: {
    runMissionGenesis: () => Promise<MissionGenesisResultViewModel>;
    answerMissionGenesisContext?: (input: { candidateMissionId: string; answers: Record<string, string> }) => Promise<MissionGenesisResultViewModel>;
  };
  artistProfile: {
    loadProfile: () => Promise<ArtistProfileViewModel>;
  };
  evidence: {
    loadEvidence: () => Promise<EvidenceItemViewModel[]>;
  };
};
