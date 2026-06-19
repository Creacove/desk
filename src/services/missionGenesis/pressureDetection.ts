import type { ArtistOperatingPacket, MissionPressure } from "./types";

export function detectMissionPressures(packet: ArtistOperatingPacket): MissionPressure[] {
  const pressures: MissionPressure[] = [];

  if (packet.sourceConfidence.missing.length >= 3) {
    pressures.push({
      pressureKey: "source-completeness-foundation",
      category: "data_source_completeness",
      title: "Resolve source and context gaps before higher-stakes management work",
      whyNow: "The Manager is missing enough operating context that strategic missions could become generic or unsafe.",
      artistStageFit: "Source completeness is appropriate when proof, goals, budget, or team capacity are missing.",
      supportingSignals: packet.sourceConfidence.missing.map((item) => `Missing: ${item}`),
      missingContext: packet.sourceConfidence.missing.filter((item) => /goal|budget|team|capacity/i.test(item)),
      missingEvidence: packet.sourceConfidence.missing.filter((item) => !/goal|budget|team|capacity/i.test(item)),
      risksIfIgnored: ["The app may recommend work that does not fit the artist or cannot be executed."],
      likelyPatterns: ["Data / Source Completeness", "Career Architecture"],
      estimatedTimeline: {
        minDays: 1,
        maxDays: 14,
        reason: "Source and context setup should be short, but external exports or team answers may take longer than one session.",
      },
      confidence: "high",
    });
  }

  if (packet.audience.geographySignals.length > 0 && packet.artist.stage !== "foundation") {
    pressures.push({
      pressureKey: "market-expansion-signal",
      category: "market_expansion",
      title: "Validate whether a rising market deserves focused operating attention",
      whyNow: "Geography signal exists, but the Manager needs to verify whether it aligns with artist goals, budget, and capacity.",
      artistStageFit: "Market validation fits developing, emerging, breakout, and established artists when audience geography is source-backed.",
      supportingSignals: packet.audience.geographySignals,
      missingContext: missing(packet, ["90-day goal", "budget range", "team capacity"]),
      missingEvidence: packet.sourceConfidence.weak.includes("geography") ? ["strong geography-capable source"] : [],
      risksIfIgnored: ["The team may miss a real market opening or spend against a weak geographic signal."],
      likelyPatterns: ["Market Expansion", "Audience Development", "Budget Allocation"],
      estimatedTimeline: {
        minDays: 45,
        maxDays: 120,
        reason: "Market validation needs enough time to test content, audience quality, and conversion before scaling.",
      },
      confidence: "medium",
    });
  }

  if (packet.business.rightsRisks.length > 0) {
    pressures.push({
      pressureKey: "rights-business-risk",
      category: "rights_business",
      title: "Clear rights and business risks blocking safer artist operations",
      whyNow: "Rights or metadata risk can block distribution, sync, revenue, partnerships, and public commitments.",
      artistStageFit: "Rights cleanup is valuable at every artist stage when business risk affects decisions.",
      supportingSignals: packet.business.rightsRisks,
      missingContext: [],
      missingEvidence: packet.business.rightsRisks,
      risksIfIgnored: ["The artist may make public or commercial moves without enough business safety."],
      likelyPatterns: ["Rights Cleanup", "Data / Source Completeness"],
      estimatedTimeline: {
        minDays: 3,
        maxDays: 30,
        reason: "Rights cleanup depends on collaborator response, documents, and confirmation records.",
      },
      confidence: "medium",
    });
  }

  if (packet.audience.momentumSignals.length > 0 && packet.artist.stage !== "foundation") {
    pressures.push({
      pressureKey: "audience-development-signal",
      category: "audience_development",
      title: "Test whether current attention is becoming repeatable audience behavior",
      whyNow: "Momentum exists, but the Manager must determine whether it is durable enough to shape operating work.",
      artistStageFit: "Audience development fits artists with early or growing public signal.",
      supportingSignals: packet.audience.momentumSignals,
      missingContext: missing(packet, ["90-day goal", "budget range"]),
      missingEvidence: packet.sourceConfidence.missing.filter((item) => /smart|conversion|save|fan|email|link/i.test(item)),
      risksIfIgnored: ["The team may mistake attention for fandom or fail to capture real demand."],
      likelyPatterns: ["Audience Development", "Creator / Content Validation"],
      estimatedTimeline: {
        minDays: 14,
        maxDays: 45,
        reason: "Audience validation needs a short testing window plus reviewable signal.",
      },
      confidence: "medium",
    });
  }

  return pressures.sort((a, b) => scorePressure(b) - scorePressure(a));
}

function missing(packet: ArtistOperatingPacket, items: string[]) {
  return items.filter((item) => {
    if (/goal/i.test(item)) return packet.artist.goals.length === 0;
    if (/budget/i.test(item)) return packet.budget.posture === "unknown";
    if (/team|capacity/i.test(item)) return packet.team.capacity === "unknown";
    return false;
  });
}

function scorePressure(pressure: MissionPressure) {
  const categoryWeight = pressure.category === "market_expansion" ? 3 : 0;
  return categoryWeight + pressure.supportingSignals.length * 2 - pressure.missingEvidence.length - pressure.missingContext.length;
}
