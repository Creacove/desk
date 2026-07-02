import type { EvidenceLike, ManagerSignalType, SignalEvidenceStrength } from "../types.ts";

export type ClassifiedSignal = {
  signalType: ManagerSignalType;
  evidenceStrength: SignalEvidenceStrength;
  reason: string;
};

const includesAny = (value: string, needles: string[]) => needles.some((needle) => value.includes(needle));

const numericValue = (value: EvidenceLike["metric_value"]) => {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const strengthFor = (value: EvidenceLike["metric_value"]): SignalEvidenceStrength => {
  const metricValue = numericValue(value);
  if (metricValue === null) return "Medium";
  if (metricValue >= 10_000 || metricValue >= 80) return "High";
  if (metricValue <= 0) return "Low";
  return "Medium";
};

export const classifyEvidenceSignal = (evidence: EvidenceLike): ClassifiedSignal => {
  const combined = [
    evidence.source,
    evidence.source_kind,
    evidence.evidence_type,
    evidence.metric_name,
    evidence.lens,
    evidence.subject_type,
    evidence.provenance,
    evidence.raw_ref,
    evidence.limitation,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  let signalType: ManagerSignalType = "fan";
  let reason = "Audience or fan behavior signal.";

  if (includesAny(combined, ["public_web", "public career", "press", "interview", "announcement", "news", "article"])) {
    signalType = "public_context";
    reason = "Sourced public career context signal.";
  } else if (includesAny(combined, ["reputation", "wellbeing", "burnout", "crisis", "sensitive", "conflict", "public risk"])) {
    signalType = "reputation_wellbeing";
    reason = "Reputation, sensitivity, or wellbeing signal.";
  } else if (includesAny(combined, ["team capacity", "approval chain", "accountability", "owner", "overloaded", "team_operations"])) {
    signalType = "team_operations";
    reason = "Team ownership, capacity, or approval-flow signal.";
  } else if (includesAny(combined, ["rights", "split", "ownership", "metadata", "royalty", "finance", "budget", "deal risk", "blocker"])) {
    signalType = "rights_business";
    reason = "Rights, finance, ownership, or business-readiness signal.";
  } else if (includesAny(combined, ["sync", "brand", "partnership", "license", "sponsorship", "pitch"])) {
    signalType = "sync_deal";
    reason = "Sync, brand, partnership, or deal-readiness signal.";
  } else if (includesAny(combined, ["positioning", "narrative", "story", "artist world", "public language", "brand posture"])) {
    signalType = "positioning";
    reason = "Artist positioning or narrative signal.";
  } else if (includesAny(combined, ["career direction", "north star", "long-term", "competing opportunities", "do-not-do", "artist_direction"])) {
    signalType = "career_architecture";
    reason = "Career architecture or long-term direction signal.";
  } else if (includesAny(combined, ["risk", "limitation", "missing"])) {
    signalType = "risk";
    reason = "Risk or readiness signal.";
  } else if (includesAny(combined, ["playlist"])) {
    signalType = "playlist";
    reason = "Playlist exposure or playlist durability signal.";
  } else if (includesAny(combined, ["shazam", "search", "discovery"])) {
    signalType = "discovery";
    reason = "Discovery intent signal.";
  } else if (includesAny(combined, ["tiktok", "reels", "shorts", "views", "impressions", "reach", "social_attention"])) {
    signalType = "attention";
    reason = "Public attention signal.";
  } else if (includesAny(combined, ["save", "follow", "followers", "repeat", "popularity", "conversion"])) {
    signalType = "conversion";
    reason = "Owned audience or conversion signal.";
  } else if (includesAny(combined, ["city", "country", "market", "affinity", "diaspora", "rank"])) {
    signalType = "market";
    reason = "Market concentration or market movement signal.";
  } else if (includesAny(combined, ["live", "ticket", "venue", "show"])) {
    signalType = "live";
    reason = "Live demand signal.";
  } else if (includesAny(combined, ["catalog", "revival", "older", "project"])) {
    signalType = "catalog";
    reason = "Catalog or project-role signal.";
  }

  return {
    signalType,
    evidenceStrength: strengthFor(evidence.metric_value),
    reason,
  };
};
