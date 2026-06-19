import type { ArtistOperatingPacket, MissionPressure } from "./types";

export type MissionPlanDraft = {
  mission: {
    title: string;
    objective: string;
    reason: string;
    summary: string;
    patternName: string;
    currentRecommendation: string;
    changeConditions: string[];
    timeline: string;
  };
  checkpoints: Array<{
    key: string;
    title: string;
    question: string;
    decisionRule: string;
    requiredEvidence: string[];
    missingEvidence: string[];
  }>;
  tasks: Array<{
    title: string;
    ownerRole: string;
    primaryCheckpointKey: string;
    purpose: string;
    evidenceNeeded: string[];
    completionExpectation: string;
    riskIfLate: string;
  }>;
  permissionRequests: Array<{
    title: string;
    requestType: "spend" | "external_contact" | "submission" | "public_action" | "legal_financial";
    body: string;
    risk: string;
  }>;
};

export function draftMissionPlan(packet: ArtistOperatingPacket, pressure: MissionPressure): MissionPlanDraft {
  if (pressure.category === "market_expansion") {
    return marketExpansionDraft(packet, pressure);
  }

  if (pressure.category === "data_source_completeness") {
    return sourceCompletenessDraft(packet, pressure);
  }

  if (pressure.category === "rights_business") {
    return rightsBusinessDraft(packet, pressure);
  }

  return genericDraft(packet, pressure);
}

function marketExpansionDraft(packet: ArtistOperatingPacket, pressure: MissionPressure): MissionPlanDraft {
  return {
    mission: baseMission(packet, pressure, "Market Expansion + Audience Development"),
    checkpoints: [
      {
        key: "market_signal_quality",
        title: "Market signal quality",
        question: "Is this market signal real enough to deserve focused operating attention?",
        decisionRule: "Proceed only if source-backed geography or audience evidence supports more than passive attention.",
        requiredEvidence: ["geography-capable audience source", "platform or conversion signal"],
        missingEvidence: pressure.missingEvidence,
      },
      {
        key: "artist_fit_and_positioning",
        title: "Artist fit and positioning",
        question: "Does this market fit the artist's identity, goals, language, culture, and current positioning?",
        decisionRule: "Proceed only if the market test does not flatten the artist or violate remembered boundaries.",
        requiredEvidence: ["artist goal", "positioning memory", "market context"],
        missingEvidence: pressure.missingContext,
      },
      {
        key: "test_design",
        title: "Scoped market test",
        question: "What is the smallest credible test that can prove whether the market deserves more work?",
        decisionRule: "Do not scale spend or external commitments until the test has reviewable signal.",
        requiredEvidence: ["budget posture", "team capacity", "test result"],
        missingEvidence: [],
      },
    ],
    tasks: [
      {
        title: "Verify geography signal quality",
        ownerRole: "Manager",
        primaryCheckpointKey: "market_signal_quality",
        purpose: "Confirm whether the market signal is source-backed and current enough to influence strategy.",
        evidenceNeeded: ["geography-capable audience source"],
        completionExpectation: "A short read on whether the market signal is strong, weak, stale, or unsupported.",
        riskIfLate: "The team may spend time or money around a market that is not actually moving.",
      },
      {
        title: "Define the market test boundary",
        ownerRole: "Manager",
        primaryCheckpointKey: "test_design",
        purpose: "Scope the market test to the artist's budget, team capacity, and positioning.",
        evidenceNeeded: ["budget answer", "team capacity answer", "artist positioning memory"],
        completionExpectation: "A test plan with timeline, owner, proof target, and stop/scale rule.",
        riskIfLate: "The mission may become vague expansion work instead of a controlled proof loop.",
      },
    ],
    permissionRequests: [],
  };
}

function sourceCompletenessDraft(packet: ArtistOperatingPacket, pressure: MissionPressure): MissionPlanDraft {
  return {
    mission: baseMission(packet, pressure, "Data / Source Completeness"),
    checkpoints: [
      {
        key: "critical_context",
        title: "Critical context",
        question: "Does the Manager have enough artist-controlled context to avoid generic missions?",
        decisionRule: "Proceed when goal, budget, team capacity, and key constraints are known or explicitly marked unknown.",
        requiredEvidence: ["artist goal", "budget posture", "team capacity"],
        missingEvidence: pressure.missingContext,
      },
      {
        key: "source_readiness",
        title: "Source readiness",
        question: "Are the required sources connected or uploaded for the next useful management decision?",
        decisionRule: "Proceed when the missing source list is either resolved or converted into explicit limitations.",
        requiredEvidence: pressure.missingEvidence,
        missingEvidence: pressure.missingEvidence,
      },
    ],
    tasks: pressure.missingEvidence.map((source) => ({
      title: `Connect or upload ${source}`,
      ownerRole: "Artist team",
      primaryCheckpointKey: "source_readiness",
      purpose: `Give the Manager enough proof to avoid making generic recommendations about ${source}.`,
      evidenceNeeded: [source],
      completionExpectation: "Source is connected, uploaded, or explicitly marked unavailable.",
      riskIfLate: "Mission creation may stay limited to context gathering and low-confidence recommendations.",
    })),
    permissionRequests: [],
  };
}

function rightsBusinessDraft(packet: ArtistOperatingPacket, pressure: MissionPressure): MissionPlanDraft {
  return {
    mission: baseMission(packet, pressure, "Rights / Business Affairs"),
    checkpoints: [
      {
        key: "rights_risk",
        title: "Rights risk",
        question: "Is ownership, split, metadata, or document risk blocking safer artist operations?",
        decisionRule: "Do not recommend public, commercial, sync, or distribution action until the relevant risk is resolved or explicitly accepted.",
        requiredEvidence: ["split confirmation", "ownership note", "metadata state"],
        missingEvidence: pressure.missingEvidence,
      },
    ],
    tasks: pressure.supportingSignals.map((risk) => ({
      title: `Resolve ${risk}`,
      ownerRole: "Finance/Rights",
      primaryCheckpointKey: "rights_risk",
      purpose: "Reduce business risk before the artist makes higher-stakes moves.",
      evidenceNeeded: [risk],
      completionExpectation: "Risk is confirmed resolved, blocked, or escalated for human/legal review.",
      riskIfLate: "The artist may make public or commercial decisions with unresolved business exposure.",
    })),
    permissionRequests: [
      {
        title: "Human review required before legal or financial conclusion",
        requestType: "legal_financial",
        body: "The Manager can organize evidence and risks, but cannot make binding legal or financial conclusions without approval.",
        risk: "Incorrect rights or finance certainty can expose the artist and team.",
      },
    ],
  };
}

function genericDraft(packet: ArtistOperatingPacket, pressure: MissionPressure): MissionPlanDraft {
  return {
    mission: baseMission(packet, pressure, pressure.likelyPatterns.join(" + ") || "Ad hoc management mission"),
    checkpoints: [
      {
        key: "objective_quality",
        title: "Objective quality",
        question: "Is this objective specific, timely, and aligned enough to organize work?",
        decisionRule: "Proceed only if the objective can produce a clear next action and review rule.",
        requiredEvidence: pressure.supportingSignals,
        missingEvidence: [...pressure.missingContext, ...pressure.missingEvidence],
      },
    ],
    tasks: [
      {
        title: "Prepare first Manager read",
        ownerRole: "Manager",
        primaryCheckpointKey: "objective_quality",
        purpose: "Turn the detected pressure into a concrete operating read with limits.",
        evidenceNeeded: pressure.supportingSignals,
        completionExpectation: "A Manager read that states next action, limitation, and review rule.",
        riskIfLate: "The mission may remain abstract instead of becoming useful work.",
      },
    ],
    permissionRequests: [],
  };
}

function baseMission(packet: ArtistOperatingPacket, pressure: MissionPressure, patternName: string) {
  return {
    title: pressure.title,
    objective: `${pressure.title} for ${packet.artist.name}.`,
    reason: pressure.whyNow,
    summary: `${pressure.artistStageFit} ${pressure.risksIfIgnored[0] ?? ""}`.trim(),
    patternName,
    currentRecommendation: "Organize the work internally, preserve evidence limits, and request permission before external or spend-sensitive action.",
    changeConditions: [
      ...pressure.risksIfIgnored,
      "New source evidence changes confidence.",
      "Artist goal, budget, team capacity, or permission boundary changes.",
    ],
    timeline: `${pressure.estimatedTimeline.minDays}-${pressure.estimatedTimeline.maxDays} days: ${pressure.estimatedTimeline.reason}`,
  };
}
