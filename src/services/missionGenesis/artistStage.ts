import type { ArtistOperatingPacket, ArtistStageResult } from "./types";

export function classifyArtistStage(packet: ArtistOperatingPacket): ArtistStageResult {
  const reasons: string[] = [];
  const limitations: string[] = [];
  const catalogCount = packet.music.songs.length + packet.music.projects.length;
  const strongSignalCount =
    packet.audience.momentumSignals.length +
    packet.audience.geographySignals.length +
    packet.audience.platformSignals.length +
    packet.sourceConfidence.strong.length;
  const missingCriticalContext = packet.sourceConfidence.missing.filter((item) =>
    /goal|stream|analytics|budget|team|source|catalog|rights/i.test(item),
  );

  if ((catalogCount === 0 && strongSignalCount === 0) || missingCriticalContext.length >= 3) {
    reasons.push("The artist still has missing operating context or insufficient mapped catalog.");
    return {
      stage: "foundation",
      confidence: missingCriticalContext.length >= 3 ? "high" : "medium",
      reasons,
      limitations: missingCriticalContext,
    };
  }

  if (packet.audience.chartmetricScore && packet.audience.chartmetricScore >= 750 && strongSignalCount >= 4) {
    reasons.push("The artist has strong audience and platform signals that can support expansion decisions.");
    return {
      stage: "breakout",
      confidence: "medium",
      reasons,
      limitations,
    };
  }

  if (packet.audience.chartmetricScore && packet.audience.chartmetricScore >= 600 && strongSignalCount >= 3) {
    reasons.push("The artist has visible momentum, but operating proof still needs structured review.");
    return {
      stage: "emerging",
      confidence: "medium",
      reasons,
      limitations,
    };
  }

  if (catalogCount >= 20 && packet.business.revenueSignals.length > 0) {
    reasons.push("The artist has enough catalog and business signal for catalog or established-artist management work.");
    return {
      stage: "established",
      confidence: "medium",
      reasons,
      limitations,
    };
  }

  reasons.push("The artist has some operating material, but repeatable audience or business leverage is not yet proven.");
  return {
    stage: "developing",
    confidence: "medium",
    reasons,
    limitations,
  };
}
