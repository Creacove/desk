export type ReleaseGateState = "confirmed" | "blocked" | "at_risk" | "unknown" | "not_applicable";

export type ReleaseEvidence = {
  source: string;
  ref?: string;
  observedAt?: string;
};

export type ReleaseGateResult = {
  key: string;
  label: string;
  group: "foundation" | "campaign";
  state: ReleaseGateState;
  evidence: ReleaseEvidence[];
  freshness: string;
  limitation: string;
  nextAction: string;
};

export type ReleaseGateGroup = {
  status: Exclude<ReleaseGateState, "not_applicable">;
  gates: ReleaseGateResult[];
  confirmedCount: number;
  blockedCount: number;
  atRiskCount: number;
  unknownCount: number;
};

export type ReleaseFactState = "confirmed" | "missing" | "pending" | "unknown" | "not_applicable" | "draft" | "uploaded";

export type ReleaseFact = {
  state: ReleaseFactState;
  source?: string;
  ref?: string;
  observedAt?: string;
  detail?: string;
};

export type ReleaseCampaignConfig = {
  spotifyEditorialEnabled?: boolean;
  independentPlaylistsEnabled?: boolean;
  pressEnabled?: boolean;
  contentEnabled?: boolean;
  postReleaseMeasurementEnabled?: boolean;
};

export type ReleaseTaskScheduleBindingInput = {
  taskId: string;
  title: string;
  deadline?: string | null;
  offsetDays: number;
  active?: boolean;
  scheduleMode?: "release_bound" | "fixed" | "manual";
  taskStatus?: string;
};

export type ReleaseSuccessPacket = {
  musicItemId: string;
  releasePlanId?: string | null;
  releasePlanRevision: number;
  lifecycleStage: string;
  releasedAt?: string | null;
  providerReleaseDate?: string | null;
  approvedReleaseDate?: string | null;
  today?: string;
  assets: {
    finalMaster?: ReleaseFact;
    artwork?: ReleaseFact;
  };
  metadata: ReleaseFact;
  credits: ReleaseFact;
  splits: ReleaseFact;
  clearances: ReleaseFact;
  identifiers: ReleaseFact;
  distributor: ReleaseFact;
  campaign: ReleaseCampaignConfig;
  campaignFacts: {
    spotifyEditorialPitch?: ReleaseFact;
    independentPlaylistTargets?: ReleaseFact;
    pressPackage?: ReleaseFact;
    contentPlan?: ReleaseFact;
    postReleaseMeasurement?: ReleaseFact;
  };
  scheduleBindings?: ReleaseTaskScheduleBindingInput[];
};

export type ReleaseSuccessAssessment = {
  musicItemId: string;
  releasePlanRevision: number;
  assessedAt: string;
  foundation: ReleaseGateGroup;
  campaign: ReleaseGateGroup;
  unknownCount: number;
  recommendation: {
    kind: "keep" | "move" | "recover";
    proposedDate?: string;
    reason: string;
  };
};

export type ReleaseSchedulePreviewInput = {
  currentReleaseDate?: string | null;
  proposedReleaseDate: string;
  expectedRevision: number;
  bindings: ReleaseTaskScheduleBindingInput[];
};

export type ReleaseScheduleChange = {
  taskId: string;
  title: string;
  from: string | null;
  to: string;
  offsetDays: number;
};

export type ReleaseSchedulePreserved = {
  taskId: string;
  title: string;
  deadline: string | null;
  reason: "fixed" | "manual" | "completed" | "archived" | "inactive" | "unbound";
};

export type ReleaseSchedulePreview = {
  fromDate: string | null;
  proposedDate: string;
  expectedRevision: number;
  changes: ReleaseScheduleChange[];
  preserved: ReleaseSchedulePreserved[];
  previewHash?: string;
};

export type ReleaseDateChangeReceipt = {
  requestId: string;
  releasePlanId: string;
  musicItemId: string;
  missionId?: string | null;
  fromDate: string | null;
  approvedDate: string;
  previousRevision: number;
  revision: number;
  moved: Array<{ taskId: string; title: string; from: string | null; to: string }>;
  preserved: Array<{ taskId: string; reason: string }>;
  nextDeadline?: { taskId: string; title: string; deadline: string } | null;
  operatingEventId?: string;
};

export type ReleaseOpportunitySongContext = {
  musicItemId: string;
  title: string;
  genres: string[];
  moods: string[];
  markets: string[];
  comparableArtists: string[];
  artistStage?: string;
};

export type ReleaseOpportunityCandidate = {
  opportunityType: "playlist" | "press";
  platform?: string;
  targetName: string;
  sourceUrl: string;
  targetUrl?: string;
  publicOrganization?: string;
  publicContact?: { kind: "email" | "submission_form" | "contact_page"; value: string; sourceUrl: string; verifiedAt?: string };
  fit: {
    songCriteria: string[];
    targetCriteria: string[];
    explanation: string;
    recency?: string;
    market?: string;
  };
  sourceEvidence: ReleaseEvidence[];
  confidence: "high" | "medium" | "low" | "unknown";
  limitations: string[];
  paidPlacementClaim?: boolean;
  requirements?: string[];
};

export type ReleaseOpportunityBrief = ReleaseOpportunityCandidate & {
  dedupeKey: string;
  safetyState: "clear" | "caution" | "excluded";
  status: "watch" | "shortlisted" | "approved";
};
