import type { ArtistBriefPacket, TodaysBriefOutput } from "../../openaiTodaysBrief.ts";

export type ManagerEvidenceRead = {
  label: string;
  value?: string;
  category: "kpi" | "signal" | "asset" | "market" | "management";
  read: string;
  evidenceIds: string[];
  confidence?: string;
};

type ManagerPacketRecord = Record<string, unknown>;

export function buildTodaysBriefModelPacket(
  packet: ArtistBriefPacket,
  managerIntelligencePacket: ManagerPacketRecord,
) {
  return {
    ...packet,
    managerIntelligence: projectManagerIntelligenceForBrief(managerIntelligencePacket),
    managerEvidenceReads: buildManagerEvidenceReads(managerIntelligencePacket),
  };
}

export function appendManagerEvidenceReads<T extends TodaysBriefOutput>(
  output: T,
  managerIntelligencePacket: ManagerPacketRecord,
): T & { managerEvidenceReads: ManagerEvidenceRead[] } {
  return {
    ...output,
    managerEvidenceReads: buildManagerEvidenceReads(managerIntelligencePacket),
  };
}

export function buildManagerEvidenceReads(managerIntelligencePacket: ManagerPacketRecord): ManagerEvidenceRead[] {
  const reads = uniqueReads([
    ...kpiEvidenceReads(managerIntelligencePacket.kpi_read_json),
    ...signalEvidenceReads(managerIntelligencePacket.signal_map_json),
    ...assetEvidenceReads(managerIntelligencePacket.asset_reads_json),
    ...marketEvidenceReads(managerIntelligencePacket.market_reads_json),
    ...managementEvidenceReads(managerIntelligencePacket.management_insights_json),
  ]);

  const fallbackEvidenceIds = packetEvidenceIds(managerIntelligencePacket);
  return reads
    .map((read) => ({
      ...read,
      evidenceIds: read.evidenceIds.length ? read.evidenceIds : fallbackEvidenceIds.slice(0, 1),
    }))
    .filter((read) => read.read && read.evidenceIds.length)
    .slice(0, 12);
}

function projectManagerIntelligenceForBrief(managerIntelligencePacket: ManagerPacketRecord) {
  const internalOnly = record(managerIntelligencePacket.internal_only_json);
  return {
    packetType: stringValue(managerIntelligencePacket.packet_type),
    executiveRead: record(managerIntelligencePacket.executive_read_json),
    strategicDiagnosis: record(managerIntelligencePacket.strategic_diagnosis_json),
    kpiRead: record(managerIntelligencePacket.kpi_read_json),
    signalMap: arrayValue(managerIntelligencePacket.signal_map_json),
    assetReads: arrayValue(managerIntelligencePacket.asset_reads_json),
    marketReads: arrayValue(managerIntelligencePacket.market_reads_json),
    managementInsights: arrayValue(managerIntelligencePacket.management_insights_json),
    domainReads: arrayValue(managerIntelligencePacket.domain_reads_json),
    publicContext: arrayValue(managerIntelligencePacket.public_context_json),
    openDecisions: arrayValue(managerIntelligencePacket.open_decisions_json),
    doNotDo: arrayValue(managerIntelligencePacket.do_not_do_json),
    missionSeed: record(managerIntelligencePacket.mission_seed_json),
    sourceLimits: record(managerIntelligencePacket.data_freshness_json),
    internalPlaybooksApplied: stringArray(internalOnly.playbooks_applied),
  };
}

function kpiEvidenceReads(value: unknown): ManagerEvidenceRead[] {
  const kpi = record(value);
  const reads: ManagerEvidenceRead[] = [];
  const artistScore = record(kpi.artistScore);
  if (artistScore.read) {
    reads.push({
      label: "Artist Score",
      value: valueLabel(artistScore.value),
      category: "kpi",
      read: stringValue(artistScore.read),
      evidenceIds: [],
      confidence: stringValue(artistScore.confidence),
    });
  }

  const artistRank = record(kpi.artistRank);
  if (artistRank.read) {
    reads.push({
      label: "Artist Rank",
      value: valueLabel(artistRank.value),
      category: "kpi",
      read: stringValue(artistRank.read),
      evidenceIds: [],
    });
  }

  const fanbaseVsEngagement = record(kpi.fanbaseVsEngagement);
  if (fanbaseVsEngagement.read) {
    reads.push({
      label: "Fanbase vs engagement",
      category: "kpi",
      read: stringValue(fanbaseVsEngagement.read),
      evidenceIds: [],
    });
  }

  for (const city of arrayValue(kpi.cityAffinityReads)) {
    const item = record(city);
    if (!item.read) continue;
    reads.push({
      label: stringValue(item.city) || "Market affinity",
      value: valueLabel(item.score),
      category: "market",
      read: stringValue(item.read),
      evidenceIds: [],
    });
  }

  for (const track of arrayValue(kpi.trackScoreReads)) {
    const item = record(track);
    if (!item.read) continue;
    reads.push({
      label: stringValue(item.trackName) || "Track score",
      value: valueLabel(item.chartmetricTrackScore),
      category: "signal",
      read: stringValue(item.read),
      evidenceIds: [],
    });
  }

  return reads;
}

function signalEvidenceReads(value: unknown): ManagerEvidenceRead[] {
  return arrayValue(value).map((item) => {
    const signal = record(item);
    return {
      label: stringValue(signal.name) || stringValue(signal.metric) || "Saved signal",
      value: valueLabel(signal.value),
      category: "signal" as const,
      read: stringValue(signal.interpretation),
      evidenceIds: stringArray(signal.evidence_ids),
      confidence: stringValue(signal.evidence_strength),
    };
  });
}

function assetEvidenceReads(value: unknown): ManagerEvidenceRead[] {
  return arrayValue(value).map((item) => {
    const asset = record(item);
    return {
      label: stringValue(asset.asset_name) || "Current music",
      category: "asset" as const,
      read: stringValue(asset.read),
      evidenceIds: stringArray(asset.evidence_ids),
    };
  });
}

function marketEvidenceReads(value: unknown): ManagerEvidenceRead[] {
  return arrayValue(value).map((item) => {
    const market = record(item);
    return {
      label: stringValue(market.market) || "Market read",
      category: "market" as const,
      read: stringValue(market.read),
      evidenceIds: stringArray(market.evidence_ids),
    };
  });
}

function managementEvidenceReads(value: unknown): ManagerEvidenceRead[] {
  return arrayValue(value).map((item) => {
    const insight = record(item);
    return {
      label: "Management read",
      category: "management" as const,
      read: stringValue(insight.why_it_matters) || stringValue(insight.insight),
      evidenceIds: stringArray(insight.evidence_ids),
      confidence: stringValue(insight.confidence_level),
    };
  });
}

function packetEvidenceIds(packet: ManagerPacketRecord) {
  return arrayValue(packet.supporting_evidence_json)
    .map((item) => stringValue(record(item).id))
    .filter(Boolean);
}

function uniqueReads(reads: ManagerEvidenceRead[]) {
  const seen = new Set<string>();
  return reads.filter((read) => {
    const key = `${read.category}:${read.label}:${read.read}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())) : [];
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function valueLabel(value: unknown) {
  if (typeof value === "number") return String(value);
  if (typeof value === "string" && value.trim()) return value.trim();
  return undefined;
}
