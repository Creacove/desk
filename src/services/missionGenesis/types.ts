export type ArtistStage = "foundation" | "developing" | "emerging" | "breakout" | "established" | "catalog_legacy";

export type Confidence = "high" | "medium" | "low" | "unknown";

export type ArtistOperatingPacket = {
  artist: {
    id: string;
    name: string;
    stage: ArtistStage;
    stageReason: string;
    goals: string[];
    genreContext: string[];
    marketContext: string[];
    positioning: string[];
    constraints: string[];
    doNotDo: string[];
  };
  budget: {
    posture: "unknown" | "none" | "low" | "moderate" | "serious" | "enterprise";
    statedAmount?: number;
    currency?: string;
    source: "profile" | "memory" | "context_answer" | "unknown";
    confidence: Confidence;
  };
  team: {
    capacity: "unknown" | "solo" | "small_team" | "label_team" | "full_team";
    availableRoles: string[];
    constraints: string[];
  };
  music: {
    songs: Array<{
      id: string;
      title: string;
      lifecycleStage: string;
      readiness: string;
      blockers: string[];
      evidenceSignals: string[];
    }>;
    projects: Array<{
      id: string;
      title: string;
      projectType: string;
      lifecycleStage: string;
      trackCount: number;
      blockers: string[];
      evidenceSignals: string[];
    }>;
  };
  audience: {
    chartmetricScore?: number;
    momentumSignals: string[];
    geographySignals: string[];
    platformSignals: string[];
    sourceLimitations: string[];
  };
  business: {
    rightsRisks: string[];
    metadataRisks: string[];
    distributionRisks: string[];
    revenueSignals: string[];
  };
  memory: {
    durableContext: string[];
    priorDecisions: string[];
    rejectedMoves: string[];
    activeConstraints: string[];
  };
  existingMissions: Array<{
    id: string;
    title: string;
    objective: string;
    status: string;
    patternName?: string;
  }>;
  recentAgentInputs: Array<{
    id: string;
    agentKey: string;
    summary: string;
    confidence: string;
    limitations: string[];
  }>;
  sourceConfidence: {
    strong: string[];
    weak: string[];
    missing: string[];
    stale: string[];
  };
};

export type ArtistStageResult = {
  stage: ArtistStage;
  confidence: Confidence;
  reasons: string[];
  limitations: string[];
};

export type MissionPressure = {
  pressureKey: string;
  category:
    | "career_architecture"
    | "positioning"
    | "focus_asset"
    | "release_readiness"
    | "rights_business"
    | "audience_development"
    | "market_expansion"
    | "campaign_operations"
    | "touring_live"
    | "sync_deals_partnerships"
    | "budget_allocation"
    | "data_source_completeness"
    | "team_operations"
    | "reputation_wellbeing"
    | "revenue_investigation";
  title: string;
  whyNow: string;
  artistStageFit: string;
  supportingSignals: string[];
  missingContext: string[];
  missingEvidence: string[];
  risksIfIgnored: string[];
  likelyPatterns: string[];
  estimatedTimeline: {
    minDays: number;
    maxDays: number;
    reason: string;
  };
  confidence: Exclude<Confidence, "unknown">;
};

export type ContextQuestion = {
  key: string;
  question: string;
  reason: string;
  answerKind: "short_text" | "single_select" | "multi_select" | "money_range";
  options?: string[];
  memoryKind: "goal" | "constraint" | "preference" | "risk" | "operating_context";
};

export type MissionWorthinessResult = {
  outcome: "activate_mission" | "candidate_needs_context" | "request_evidence" | "update_existing_mission" | "no_mission";
  activate: boolean;
  reasons: string[];
  blockedGates: string[];
  questionsNeeded: ContextQuestion[];
  evidenceNeeded: string[];
  existingMissionId?: string;
};
