import {
  ReleaseFact,
  ReleaseGateGroup,
  ReleaseGateResult,
  ReleaseGateState,
  ReleaseSuccessAssessment,
  ReleaseSuccessPacket,
} from "./types.ts";

export const RELEASE_SUCCESS_POLICY = {
  spotifyEditorialMinimumDays: 7,
  minimumOperationalBufferDays: 14,
  preferredCampaignBufferDays: 28,
} as const;

type GateDefinition = {
  key: string;
  label: string;
  group: "foundation" | "campaign";
  fact?: ReleaseFact;
  nextAction: string;
  limitation: string;
};

export function assessReleaseSuccess(packet: ReleaseSuccessPacket, assessedAt = new Date().toISOString()): ReleaseSuccessAssessment {
  if (isReleasedCatalog(packet)) {
    const empty = emptyGroup();
    return {
      musicItemId: packet.musicItemId,
      releasePlanRevision: packet.releasePlanRevision,
      assessedAt,
      foundation: empty,
      campaign: empty,
      unknownCount: 0,
      recommendation: { kind: "keep", reason: "This is released or catalog music; pre-release gates are not reopened." },
    };
  }

  const foundationDefinitions: GateDefinition[] = [
    assetGate("final_master", "Final master", packet.assets.finalMaster, "Designate the final delivery master in Files.", "An uploaded demo or rough mix is not delivery evidence."),
    assetGate("artwork", "Approved artwork", packet.assets.artwork, "Add or designate the approved cover artwork.", "Artwork presence is known only from the song asset record."),
    factGate("metadata", "Release metadata", packet.metadata, "Confirm the required release metadata in the song details.", "The assessment does not replace distributor-specific metadata validation."),
    factGate("credits", "Credits", packet.credits, "Complete and confirm the contributor credits.", "Credit completeness depends on the workspace records supplied to Desk."),
    factGate("splits", "Splits", packet.splits, "Resolve pending split confirmations before external delivery.", "Splits are an operating readiness signal, not legal advice."),
    factGate("clearances", "Clearance declarations", packet.clearances, "Answer the focused clearance question or attach the relevant evidence.", "Desk records user-provided declarations and does not infer clearance from audio."),
    {
      key: "operational_release_date",
      label: "Approved release date",
      group: "foundation",
      fact: packet.approvedReleaseDate
        ? { state: "confirmed", source: "music_release_plans", detail: packet.approvedReleaseDate }
        : { state: "missing", source: "music_release_plans" },
      nextAction: "Choose and approve an operational release date.",
      limitation: "A provider date is historical evidence, not approval for an unreleased plan.",
    },
    factGate("distributor_delivery", "Distributor delivery", packet.distributor, "Record the distributor submission or delivery evidence.", "Desk cannot claim distributor acceptance without a user or provider receipt."),
    factGate("identifiers", "Identifiers", packet.identifiers, "Add the applicable ISRC or release identifier.", "Some identifiers may be assigned by a distributor later."),
  ];

  const campaignDefinitions: GateDefinition[] = [];
  addCampaignGate(campaignDefinitions, packet.campaign.spotifyEditorialEnabled, "spotify_editorial_pitch", "Spotify editorial pitch", packet.campaignFacts.spotifyEditorialPitch, "Prepare and submit the pitch through Spotify for Artists.", "Desk prepares the pitch but does not submit it.");
  addCampaignGate(campaignDefinitions, packet.campaign.independentPlaylistsEnabled, "independent_playlist_targets", "Independent playlist targets", packet.campaignFacts.independentPlaylistTargets, "Research and shortlist source-backed playlist opportunities.", "A playlist reach claim is not a guarantee of fan conversion.");
  addCampaignGate(campaignDefinitions, packet.campaign.pressEnabled, "press_package", "Press package", packet.campaignFacts.pressPackage, "Create or approve the release-specific press package.", "Press preparation does not guarantee coverage.");
  addCampaignGate(campaignDefinitions, packet.campaign.contentEnabled, "content_plan", "Content rollout", packet.campaignFacts.contentPlan, "Create the campaign-specific content plan and assets.", "V1 does not enforce a universal asset count.");
  addCampaignGate(campaignDefinitions, packet.campaign.postReleaseMeasurementEnabled, "post_release_measurement", "Post-release measurement", packet.campaignFacts.postReleaseMeasurement, "Choose the evidence that will be reviewed after launch.", "Private platform analytics require a connected or uploaded source.");

  const foundation = buildGroup(foundationDefinitions, packet);
  const campaign = buildGroup(campaignDefinitions, packet);
  return {
    musicItemId: packet.musicItemId,
    releasePlanRevision: packet.releasePlanRevision,
    assessedAt,
    foundation,
    campaign,
    unknownCount: foundation.unknownCount + campaign.unknownCount,
    recommendation: recommendReleaseDate(packet, foundation, campaign),
  };
}

function factGate(key: string, label: string, fact: ReleaseFact | undefined, nextAction: string, limitation: string): GateDefinition {
  return { key, label, group: key.startsWith("spotify_") || key.includes("playlist") || key.includes("press") || key.includes("content") || key.includes("post_release") ? "campaign" : "foundation", fact, nextAction, limitation };
}

function addCampaignGate(
  definitions: GateDefinition[],
  enabled: boolean | undefined,
  key: string,
  label: string,
  fact: ReleaseFact | undefined,
  nextAction: string,
  limitation: string,
) {
  if (enabled === undefined) return;
  definitions.push(factGate(
    key,
    label,
    enabled ? fact : { state: "not_applicable", source: "release_strategy" },
    nextAction,
    limitation,
  ));
}

function assetGate(key: string, label: string, fact: ReleaseFact | undefined, nextAction: string, limitation: string): GateDefinition {
  return { key, label, group: "foundation", fact, nextAction, limitation };
}

function buildGroup(definitions: GateDefinition[], packet: ReleaseSuccessPacket): ReleaseGateGroup {
  const gates = definitions.map((definition) => toGateResult(definition, packet));
  const counts = {
    confirmedCount: gates.filter((gate) => gate.state === "confirmed").length,
    blockedCount: gates.filter((gate) => gate.state === "blocked").length,
    atRiskCount: gates.filter((gate) => gate.state === "at_risk").length,
    unknownCount: gates.filter((gate) => gate.state === "unknown").length,
  };
  const status: Exclude<ReleaseGateState, "not_applicable"> = gates.some((gate) => gate.state === "blocked")
    ? "blocked"
    : gates.some((gate) => gate.state === "at_risk")
      ? "at_risk"
      : gates.some((gate) => gate.state === "unknown")
        ? "unknown"
        : "confirmed";
  return { status, gates, ...counts };
}

function toGateResult(definition: GateDefinition, packet: ReleaseSuccessPacket): ReleaseGateResult {
  const fact = definition.fact;
  const state = factToGateState(fact);
  const evidence: ReleaseGateResult["evidence"] = fact?.source
    ? [{ source: fact.source, ...(fact.ref ? { ref: fact.ref } : {}), ...(fact.observedAt ? { observedAt: fact.observedAt } : {}) }]
    : [];
  return {
    key: definition.key,
    label: definition.label,
    group: definition.group,
    state,
    evidence,
    freshness: fact?.observedAt ?? "No fresh evidence supplied",
    limitation: fact?.detail ? `${definition.limitation} ${fact.detail}` : definition.limitation,
    nextAction: definition.nextAction,
  };
}

function factToGateState(fact: ReleaseFact | undefined): ReleaseGateState {
  if (!fact) return "unknown";
  switch (fact.state) {
    case "confirmed": return "confirmed";
    case "not_applicable": return "not_applicable";
    case "missing": return "blocked";
    case "pending": return "blocked";
    case "draft": return "at_risk";
    case "uploaded": return "at_risk";
    default: return "unknown";
  }
}

function emptyGroup(): ReleaseGateGroup {
  return { status: "confirmed", gates: [], confirmedCount: 0, blockedCount: 0, atRiskCount: 0, unknownCount: 0 };
}

function isReleasedCatalog(packet: ReleaseSuccessPacket) {
  return Boolean(packet.releasedAt) || ["released", "catalog", "archived"].includes(packet.lifecycleStage);
}

function recommendReleaseDate(packet: ReleaseSuccessPacket, foundation: ReleaseGateGroup, campaign: ReleaseGateGroup) {
  const approvedDate = packet.approvedReleaseDate;
  if (!approvedDate) {
    return { kind: "recover" as const, reason: "Choose an operational release date before calculating the campaign runway." };
  }
  const today = packet.today ?? new Date().toISOString().slice(0, 10);
  const daysToRelease = daysBetween(today, approvedDate);
  const hasMaterialWork = foundation.blockedCount > 0 || foundation.atRiskCount > 0 || foundation.unknownCount > 0 || campaign.blockedCount > 0 || campaign.atRiskCount > 0 || campaign.unknownCount > 0;
  if (hasMaterialWork && daysToRelease <= RELEASE_SUCCESS_POLICY.minimumOperationalBufferDays) {
    const proposedDate = addDays(approvedDate, RELEASE_SUCCESS_POLICY.minimumOperationalBufferDays);
    return {
      kind: "move" as const,
      proposedDate,
      reason: `${daysToRelease} days remain and material release or campaign evidence is unresolved. Moving the date by ${RELEASE_SUCCESS_POLICY.minimumOperationalBufferDays} days creates a clearer operating window.`,
    };
  }
  if (foundation.blockedCount > 0 || foundation.unknownCount > 0) {
    return { kind: "recover" as const, reason: "The release date can remain, but foundation evidence must be resolved before external delivery or outreach." };
  }
  return { kind: "keep" as const, reason: "The current date has no deterministic timing reason to move. Complete the highest-impact campaign actions next." };
}

function daysBetween(from: string, to: string) {
  return Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / 86400000);
}

function addDays(value: string, days: number) {
  const date = parseDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function parseDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid ISO date: ${value}`);
  return date;
}
