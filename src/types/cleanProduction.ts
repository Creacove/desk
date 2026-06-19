import type { LucideIcon } from "lucide-react";

export type CleanProductionView =
  | "connectArtist"
  | "setup"
  | "labelHQ"
  | "musicWorkspace"
  | "staffWorkspace"
  | "managerOffice"
  | "conversationWorkspace"
  | "investigation"
  | "decisionPackage"
  | "missionsWorkspace"
  | "artistProfileWorkspace"
  | "lockedAgentWorkspace";

export type DrawerKind = "evidence" | "missionRecord" | "workDraft" | null;

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
  tone: "warning" | "accent";
  target?: CleanProductionView;
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
  sourceLine: string;
  confidence: "high" | "medium" | "low" | "limited" | "unknown";
  generatedAt?: string;
  managerSynthesisRunId?: string;
  state: "fresh" | "limited" | "fallback" | "failed";
};

export type TodayBriefGenerationMode = "operating" | "setup-map";

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
  resultSummary: string;
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
  type: string;
  actor: string;
  summary: string;
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
  managerRead?: string;
  situationLine?: string;
  watchNext?: string;
  managerReadState?: "fresh" | "limited" | "fallback" | "stale" | "failed";
  nextMove: string;
  intelligenceSnapshot?: TodayBriefSnapshotGroup[];
  snapshotSummary?: string;
  confidence?: string;
  sourceLine?: string;
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
  fileAssets?: Array<{ group: "Audio" | "Artwork" | "Splits"; label: string; status: string; action: string; assetType?: string; canUpload?: boolean; canReplace?: boolean }>;
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
    approval: string;
  }>;
};

export type ConversationMessageViewModel = {
  id: string;
  speaker: "artist" | "manager";
  label: string;
  body: string;
};

export type ConversationViewModel = {
  id: string;
  topic: string;
  status: string;
  summary: string;
  prompt: string;
  messages: ConversationMessageViewModel[];
  createdWork: Array<{
    type: "music_item" | "mission" | "task";
    title: string;
    body: string;
    id?: string;
  }>;
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

export type ProductionFixtureData = {
  profile: ArtistProfileViewModel;
  priority: PriorityItem[];
  attention: AttentionItem[];
  movement: MovementItem[];
  todayBrief: TodayBriefViewModel;
  agents: AgentViewModel[];
  missions: MissionViewModel[];
  music: MusicObjectViewModel[];
  conversations: ConversationViewModel[];
  evidence: EvidenceItemViewModel[];
};

export type ArtistProfileRepository = {
  loadProfile(): Promise<ArtistProfileViewModel>;
};

export type DeskRepository = {
  loadDesk(): Promise<Pick<ProductionFixtureData, "priority" | "attention" | "movement" | "todayBrief">>;
  generateTodaysBrief(mode?: TodayBriefGenerationMode): Promise<TodayBriefViewModel>;
};

export type StaffRepository = {
  loadAgents(): Promise<AgentViewModel[]>;
};

export type MusicRepository = {
  loadMusic(): Promise<MusicObjectViewModel[]>;
  generateMusicSummary(subjectId: string, subjectType: "music_item" | "music_project"): Promise<MusicObjectViewModel>;
  createSong(input: { title: string; itemType: string; lifecycleStage: string }): Promise<MusicObjectViewModel>;
  createProject(input: { title: string; projectType: string; lifecycleStage: string }): Promise<MusicObjectViewModel>;
  updateLifecycleStage(musicItemId: string, lifecycleStage: string): Promise<void>;
  saveDetail(musicItemId: string, input: { group: string; label: string; value: string }): Promise<void>;
  saveCredit(musicItemId: string, input: { role: string; name: string }): Promise<void>;
  saveIdentifier(musicItemId: string, input: { identifierType: string; identifierValue: string }): Promise<void>;
  saveSplitContributor(musicItemId: string, input: SplitContributorInput): Promise<void>;
  removeSplitContributor(musicItemId: string, contributorId: string): Promise<void>;
  sendSplitConfirmationLinks(musicItemId: string): Promise<void>;
  loadSplitConfirmation(token: string): Promise<SplitConfirmationViewModel>;
  submitSplitConfirmation(token: string, input: { decision: "confirmed" | "rejected"; confirmationText?: string }): Promise<void>;
  uploadAsset(
    musicItemId: string,
    input: { assetType: string; title: string; file: File },
  ): Promise<{ group: "Audio" | "Artwork" | "Splits"; label: string; status: string; action: string; assetType?: string }>;
};

export type ManagerRepository = {
  loadConversations(): Promise<ConversationViewModel[]>;
};

export type MissionRepository = {
  loadMissions(): Promise<MissionViewModel[]>;
  approveTask(taskId: string): Promise<void>;
  completeTask(taskId: string, input: { status: "completed" | "blocked"; note: string }): Promise<MissionViewModel>;
};

export type MissionGenesisQuestionViewModel = {
  key: string;
  question: string;
  reason: string;
  answerKind: "short_text" | "single_select" | "multi_select" | "money_range";
  options?: string[];
};

export type MissionGenesisResultViewModel = {
  outcome: "activate_mission" | "candidate_needs_context" | "request_evidence" | "update_existing_mission" | "no_mission";
  title: string;
  body: string;
  reasons: string[];
  questions: MissionGenesisQuestionViewModel[];
  evidenceNeeded: string[];
  candidateMissionId?: string;
  activatedMissionId?: string;
};

export type MissionGenesisRepository = {
  runMissionGenesis(): Promise<MissionGenesisResultViewModel>;
  answerMissionGenesisContext(input: {
    candidateMissionId: string;
    answers: Array<{ questionKey: string; answer: string }>;
  }): Promise<MissionGenesisResultViewModel>;
};

export type EvidenceRepository = {
  loadEvidence(): Promise<EvidenceItemViewModel[]>;
};

export type CleanProductionRepositories = {
  artistProfile: ArtistProfileRepository;
  desk: DeskRepository;
  staff: StaffRepository;
  music: MusicRepository;
  manager: ManagerRepository;
  missions: MissionRepository;
  missionGenesis: MissionGenesisRepository;
  evidence: EvidenceRepository;
};
