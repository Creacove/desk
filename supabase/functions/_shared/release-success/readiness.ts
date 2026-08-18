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
      recommendation: { kind: "keep", reason: "This is released or catalog music; pre-release checks are not reopened." },
    };
  }

  const stage = normalizedStage(packet.lifecycleStage);
  const releaseDate = effectiveReleaseDate(packet);
  const foundationDefinitions: GateDefinition[] = [
    assetGate("final_master", "Final master", stageRequiresDeliveryAssets(stage) ? packet.assets.finalMaster : optionalFact(packet.assets.finalMaster), "Choose the final delivery master in Files.", "A designated uploaded master is valid evidence; a rough/demo file is not automatically the final master."),
    assetGate("artwork", "Artwork", stageRequiresDeliveryAssets(stage) ? packet.assets.artwork : optionalFact(packet.assets.artwork), "Add or choose the release artwork before delivery.", "Artwork is required later in the release workflow, not while a song is still being made."),
    factGate("metadata", "Release details", stageRequiresDeliveryMetadata(stage) ? packet.metadata : optionalFact(packet.metadata), "Complete the release details needed for delivery.", "Distributor-specific fields can still differ by provider."),
    factGate("credits", "Credits", stageRequiresCredits(stage) ? packet.credits : optionalFact(packet.credits), "Complete the contributor credits when the recording team is known.", "A credit does not imply an ownership share."),
    factGate("splits", "Rights & splits", stageRequiresRights(stage) ? packet.splits : optionalFact(packet.splits), "Resolve ownership splits before external delivery where applicable.", "People can legitimately have a credit and 0% ownership."),
    factGate("clearances", "Clearances", stageRequiresRights(stage) ? packet.clearances : optionalFact(packet.clearances), "Confirm any clearance declarations that apply to this recording.", "Desk records declarations and evidence; it does not infer legal clearance from audio."),
    {
      key: "operational_release_date",
      label: "Release date",
      group: "foundation",
      fact: releaseDate
        ? { state: "confirmed", source: packet.approvedReleaseDate ? "music_release_plans" : "music_items", detail: releaseDate }
        : stageRequiresReleaseDate(stage)
          ? { state: "missing", source: "music_items" }
          : { state: "not_applicable", source: "lifecycle_stage" },
      nextAction: stageRequiresReleaseDate(stage) ? "Choose a release date." : "Choose a release date when release planning starts.",
      limitation: "The canonical song date is valid current state; an operational plan approval may add scheduling semantics later.",
    },
    factGate("distributor_delivery", "Distributor delivery", stageRequiresDistributor(stage) ? packet.distributor : optionalFact(packet.distributor), "Record distributor delivery when the release is submitted.", "Desk cannot claim distributor acceptance without a receipt or explicit user confirmation."),
    factGate("identifiers", "ISRC / identifiers", stageRequiresIdentifier(packet, stage) ? packet.identifiers : optionalIdentifierFact(packet.identifiers), stageRequiresIdentifier(packet, stage) ? "Add the ISRC, or confirm that your distributor will assign it during delivery." : "No ISRC is needed yet. Add it when it is assigned.", "An unreleased recording can legitimately have no ISRC until distribution."),
  ];

  const campaignDefinitions: GateDefinition[] = [];
  addCampaignGate(campaignDefinitions, packet.campaign.spotifyEditorialEnabled, "spotify_editorial_pitch", "Spotify editorial pitch", packet.campaignFacts.spotifyEditorialPitch, "Prepare the pitch and submit it through Spotify for Artists.", "Desk prepares the pitch but does not submit it.");
  addCampaignGate(campaignDefinitions, packet.campaign.independentPlaylistsEnabled, "independent_playlist_targets", "Playlist targets", packet.campaignFacts.independentPlaylistTargets, "Research and shortlist source-backed playlist opportunities.", "Playlist placement is never guaranteed.");
  addCampaignGate(campaignDefinitions, packet.campaign.pressEnabled, "press_package", "Press package", packet.campaignFacts.pressPackage, "Create or approve the release-specific press package.", "Preparation does not guarantee coverage.");
  addCampaignGate(campaignDefinitions, packet.campaign.contentEnabled, "content_plan", "Content rollout", packet.campaignFacts.contentPlan, "Create the campaign-specific content plan and assets.", "Desk does not enforce a universal asset count.");
  addCampaignGate(campaignDefinitions, packet.campaign.postReleaseMeasurementEnabled, "post_release_measurement", "Post-release measurement", packet.campaignFacts.postReleaseMeasurement, "Choose the evidence that will be reviewed after launch.", "Private analytics require a connected or uploaded source.");

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

function stageRequiresDeliveryAssets(stage: string) { return ["ready", "scheduled"].includes(stage); }
function stageRequiresDeliveryMetadata(stage: string) { return ["ready", "scheduled"].includes(stage); }
function stageRequiresCredits(stage: string) { return ["mixing", "mastering", "ready", "scheduled"].includes(stage); }
function stageRequiresRights(stage: string) { return ["ready", "scheduled"].includes(stage); }
function stageRequiresReleaseDate(stage: string) { return ["ready", "scheduled"].includes(stage); }
function stageRequiresDistributor(stage: string) { return stage === "scheduled"; }
function stageRequiresIdentifier(packet: ReleaseSuccessPacket, stage: string) {
  if (stage === "scheduled") return true;
  if (stage !== "ready") return false;
  // If delivery is already underway, the identifier becomes actionable. Otherwise a
  // distributor may still assign it later and we should not call the song blocked.
  return ["confirmed", "pending", "uploaded"].includes(packet.distributor?.state ?? "");
}
function normalizedStage(value: string) { return String(value ?? "").trim().toLowerCase(); }
function effectiveReleaseDate(packet: ReleaseSuccessPacket) { return packet.approvedReleaseDate ?? packet.plannedReleaseDate ?? packet.providerReleaseDate ?? null; }

function optionalFact(fact: ReleaseFact | undefined): ReleaseFact {
  if (!fact || ["missing", "pending", "unknown"].includes(fact.state)) return { state: "not_applicable", source: fact?.source ?? "lifecycle_stage", detail: fact?.detail };
  return fact;
}
function optionalIdentifierFact(fact: ReleaseFact | undefined): ReleaseFact {
  if (!fact || ["missing", "pending", "unknown"].includes(fact.state)) return { state: "not_applicable", source: fact?.source ?? "lifecycle_stage", detail: "Identifier can be assigned later in distribution." };
  return fact;
}

function factGate(key: string, label: string, fact: ReleaseFact | undefined, nextAction: string, limitation: string): GateDefinition {
  return { key, label, group: key.startsWith("spotify_") || key.includes("playlist") || key.includes("press") || key.includes("content") || key.includes("post_release") ? "campaign" : "foundation", fact, nextAction, limitation };
}
function addCampaignGate(definitions: GateDefinition[], enabled: boolean | undefined, key: string, label: string, fact: ReleaseFact | undefined, nextAction: string, limitation: string) {
  if (enabled === undefined) return;
  definitions.push(factGate(key, label, enabled ? fact : { state: "not_applicable", source: "release_strategy" }, nextAction, limitation));
}
function assetGate(key: string, label: string, fact: ReleaseFact | undefined, nextAction: string, limitation: string): GateDefinition { return { key, label, group: "foundation", fact, nextAction, limitation }; }

function buildGroup(definitions: GateDefinition[], packet: ReleaseSuccessPacket): ReleaseGateGroup {
  const gates = definitions.map((definition) => toGateResult(definition, packet));
  const counts = {
    confirmedCount: gates.filter((gate) => gate.state === "confirmed").length,
    blockedCount: gates.filter((gate) => gate.state === "blocked").length,
    atRiskCount: gates.filter((gate) => gate.state === "at_risk").length,
    unknownCount: gates.filter((gate) => gate.state === "unknown").length,
  };
  const status: Exclude<ReleaseGateState, "not_applicable"> = gates.some((gate) => gate.state === "blocked") ? "blocked" : gates.some((gate) => gate.state === "at_risk") ? "at_risk" : gates.some((gate) => gate.state === "unknown") ? "unknown" : "confirmed";
  return { status, gates, ...counts };
}
function toGateResult(definition: GateDefinition, _packet: ReleaseSuccessPacket): ReleaseGateResult {
  const fact = definition.fact;
  const state = factToGateState(fact);
  const evidence: ReleaseGateResult["evidence"] = fact?.source ? [{ source: fact.source, ...(fact.ref ? { ref: fact.ref } : {}), ...(fact.observedAt ? { observedAt: fact.observedAt } : {}) }] : [];
  return {
    key: definition.key,
    label: definition.label,
    group: definition.group,
    state,
    evidence,
    freshness: fact?.observedAt ?? "Current workspace state",
    limitation: fact?.detail ? `${definition.limitation} ${fact.detail}` : definition.limitation,
    nextAction: definition.nextAction,
  };
}
function factToGateState(fact: ReleaseFact | undefined): ReleaseGateState {
  if (!fact) return "unknown";
  switch (fact.state) {
    case "confirmed": return "confirmed";
    case "uploaded": return "confirmed"; // presence is confirmed; validation/risk must be a separate fact
    case "not_applicable": return "not_applicable";
    case "missing": return "blocked";
    case "pending": return "blocked";
    case "draft": return "at_risk";
    default: return "unknown";
  }
}
function emptyGroup(): ReleaseGateGroup { return { status: "confirmed", gates: [], confirmedCount: 0, blockedCount: 0, atRiskCount: 0, unknownCount: 0 }; }
function isReleasedCatalog(packet: ReleaseSuccessPacket) { return Boolean(packet.releasedAt) || ["released", "catalog", "archived"].includes(normalizedStage(packet.lifecycleStage)); }

function recommendReleaseDate(packet: ReleaseSuccessPacket, foundation: ReleaseGateGroup, campaign: ReleaseGateGroup) {
  const releaseDate = effectiveReleaseDate(packet);
  if (!releaseDate) {
    if (!stageRequiresReleaseDate(normalizedStage(packet.lifecycleStage))) return { kind: "keep" as const, reason: "A release date is not required at this stage." };
    return { kind: "recover" as const, reason: "Choose a release date before calculating campaign runway." };
  }
  const today = packet.today ?? new Date().toISOString().slice(0, 10);
  const daysToRelease = daysBetween(today, releaseDate);
  const hasMaterialWork = foundation.blockedCount > 0 || foundation.atRiskCount > 0 || foundation.unknownCount > 0 || campaign.blockedCount > 0 || campaign.atRiskCount > 0 || campaign.unknownCount > 0;
  if (hasMaterialWork && daysToRelease <= RELEASE_SUCCESS_POLICY.minimumOperationalBufferDays) {
    return { kind: "move" as const, proposedDate: addDays(releaseDate, RELEASE_SUCCESS_POLICY.minimumOperationalBufferDays), reason: `${daysToRelease} days remain and material release work is unresolved. Moving the date creates a safer operating window.` };
  }
  if (foundation.blockedCount > 0 || foundation.unknownCount > 0) return { kind: "recover" as const, reason: "The release date can remain, but the remaining foundation work should be resolved before external delivery." };
  return { kind: "keep" as const, reason: "There is no deterministic timing reason to move the current release date." };
}
function daysBetween(from: string, to: string) { return Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / 86400000); }
function addDays(value: string, days: number) { const date = parseDate(value); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); }
function parseDate(value: string) { const date = new Date(`${value}T00:00:00.000Z`); if (Number.isNaN(date.getTime())) throw new Error(`Invalid ISO date: ${value}`); return date; }
