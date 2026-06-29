export type EvidenceConfidence = "High" | "Medium" | "Low";

export type ManagerSignalType =
  | "attention"
  | "conversion"
  | "discovery"
  | "fan"
  | "market"
  | "playlist"
  | "live"
  | "catalog"
  | "risk"
  | "career_architecture"
  | "positioning"
  | "rights_business"
  | "sync_deal"
  | "team_operations"
  | "reputation_wellbeing"
  | "public_context";

export type SignalEvidenceStrength = EvidenceConfidence;

export type EvidenceLike = {
  source?: string | null;
  source_kind?: string | null;
  evidence_type?: string | null;
  metric_name?: string | null;
  lens?: string | null;
  metric_value?: number | string | null;
  subject_type?: string | null;
  subject_label?: string | null;
  provenance?: string | null;
  raw_ref?: string | null;
  limitation?: string | null;
};

export type Direction = "up" | "down" | "flat" | "unknown";

export type KpiValue = {
  value: number | null;
  direction?: Direction;
};

export type ChartmetricKpiInput = {
  artistScore?: KpiValue;
  artistRank?: KpiValue;
  careerStage?: string | null;
  momentum?: "rising" | "flat" | "cooling" | "volatile" | "unknown" | null;
  fanBaseRank?: number | null;
  engagementRank?: number | null;
  socialEngagementScore?: number | null;
  networkStrengthScore?: number | null;
  cityAffinity?: Array<{ city: string; score?: number | null; listenerCount?: number | null }>;
  brandAffinity?: Array<{ brandOrCategory: string; score?: number | null; artistWorldFit?: "strong" | "weak" | "unknown" | null }>;
  moodTags?: string[];
  genreTags?: string[];
  trackScores?: Array<{
    musicItemId?: string | null;
    trackName: string;
    chartmetricTrackScore?: number | null;
    spotifyPopularity?: number | null;
  }>;
};

export type PlaybookKey =
  | "cultural_expansion"
  | "era_architecture"
  | "artist_as_business"
  | "prestige_positioning"
  | "artist_first_development"
  | "song_fan_trust"
  | "live_demand_community"
  | "authentic_growth"
  | "world_building"
  | "fan_psychology_ownership"
  | "ar_breakout"
  | "playlist_discovery"
  | "social_contagion"
  | "no_engine";
