import { questionsForMissingContext } from "./contextQuestions";
import type { ArtistOperatingPacket, MissionPressure, MissionWorthinessResult } from "./types";

export function applyMissionWorthinessGates(
  packet: ArtistOperatingPacket,
  pressure: MissionPressure,
): MissionWorthinessResult {
  const reasons: string[] = [];

  if (!pressure.title || !pressure.whyNow || pressure.supportingSignals.length === 0) {
    return {
      outcome: "no_mission",
      activate: false,
      reasons: ["The pressure does not have enough specific signal to become durable managed work."],
      blockedGates: ["durable_objective"],
      questionsNeeded: [],
      evidenceNeeded: [],
    };
  }

  const duplicate = packet.existingMissions.find((mission) =>
    sameObjectiveFamily(mission.objective, pressure.title) || sameObjectiveFamily(mission.title, pressure.title),
  );

  if (duplicate && duplicate.status === "active") {
    return {
      outcome: "update_existing_mission",
      activate: false,
      reasons: [`An active mission already appears to cover this pressure: ${duplicate.title}.`],
      blockedGates: ["duplicate_overlap"],
      questionsNeeded: [],
      evidenceNeeded: [],
      existingMissionId: duplicate.id,
    };
  }

  if (pressure.missingEvidence.length > 0 && pressure.supportingSignals.length < 2) {
    return {
      outcome: "request_evidence",
      activate: false,
      reasons: ["The pressure may matter, but source-backed proof is too weak to define a useful first checkpoint."],
      blockedGates: ["evidence_sufficiency"],
      questionsNeeded: [],
      evidenceNeeded: pressure.missingEvidence,
    };
  }

  const questionsNeeded = questionsForMissingContext(pressure.missingContext);

  if (questionsNeeded.length > 0) {
    return {
      outcome: "candidate_needs_context",
      activate: false,
      reasons: ["The pressure is promising, but user-controlled context could materially change the mission plan."],
      blockedGates: ["context_sufficiency"],
      questionsNeeded,
      evidenceNeeded: pressure.missingEvidence,
    };
  }

  if (!stageCanSupportPressure(packet, pressure)) {
    return {
      outcome: "no_mission",
      activate: false,
      reasons: ["The pressure does not fit the artist's current stage, constraints, or operating capacity."],
      blockedGates: ["artist_fit"],
      questionsNeeded: [],
      evidenceNeeded: [],
    };
  }

  reasons.push("The pressure is durable, artist-specific, evidenced enough to start, and not covered by an active mission.");

  return {
    outcome: "activate_mission",
    activate: true,
    reasons,
    blockedGates: [],
    questionsNeeded: [],
    evidenceNeeded: pressure.missingEvidence,
  };
}

function sameObjectiveFamily(left: string, right: string) {
  const leftTokens = tokenSet(left);
  const rightTokens = tokenSet(right);
  const overlap = [...leftTokens].filter((token) => rightTokens.has(token));
  return overlap.length >= 3;
}

function tokenSet(value: string) {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 3),
  );
}

function stageCanSupportPressure(packet: ArtistOperatingPacket, pressure: MissionPressure) {
  if (packet.artist.stage === "foundation") {
    return ["data_source_completeness", "career_architecture", "positioning", "rights_business", "focus_asset"].includes(pressure.category);
  }

  if (packet.artist.stage === "catalog_legacy") {
    return ["revenue_investigation", "rights_business", "sync_deals_partnerships", "data_source_completeness", "campaign_operations"].includes(pressure.category);
  }

  return true;
}
