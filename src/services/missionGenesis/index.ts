import { classifyArtistStage } from "./artistStage";
import { detectMissionPressures } from "./pressureDetection";
import { applyMissionWorthinessGates } from "./worthinessGates";
import { draftMissionPlan, type MissionPlanDraft } from "./missionPlanDraft";
import type { ArtistOperatingPacket, ContextQuestion, MissionPressure, MissionWorthinessResult } from "./types";

export type MissionGenesisResult = {
  outcome: MissionWorthinessResult["outcome"];
  stage: ReturnType<typeof classifyArtistStage>;
  pressure?: MissionPressure;
  candidate?: MissionPlanDraft["mission"];
  draft?: MissionPlanDraft;
  questions: ContextQuestion[];
  evidenceNeeded: string[];
  reasons: string[];
};

export function runMissionGenesis(packet: ArtistOperatingPacket): MissionGenesisResult {
  const stage = classifyArtistStage(packet);
  const stagedPacket: ArtistOperatingPacket = {
    ...packet,
    artist: {
      ...packet.artist,
      stage: stage.stage,
      stageReason: stage.reasons.join(" "),
    },
  };
  const pressures = detectMissionPressures(stagedPacket);
  const pressure = pressures[0];

  if (!pressure) {
    return {
      outcome: "no_mission",
      stage,
      questions: [],
      evidenceNeeded: [],
      reasons: ["No durable management pressure was strong enough to create or candidate a mission."],
    };
  }

  const worthiness = applyMissionWorthinessGates(stagedPacket, pressure);

  if (worthiness.outcome === "activate_mission") {
    const draft = draftMissionPlan(stagedPacket, pressure);
    return {
      outcome: "activate_mission",
      stage,
      pressure,
      draft,
      questions: [],
      evidenceNeeded: worthiness.evidenceNeeded,
      reasons: worthiness.reasons,
    };
  }

  if (worthiness.outcome === "candidate_needs_context") {
    const draft = draftMissionPlan(stagedPacket, pressure);
    return {
      outcome: "candidate_needs_context",
      stage,
      pressure,
      candidate: draft.mission,
      questions: worthiness.questionsNeeded,
      evidenceNeeded: worthiness.evidenceNeeded,
      reasons: worthiness.reasons,
    };
  }

  return {
    outcome: worthiness.outcome,
    stage,
    pressure,
    questions: worthiness.questionsNeeded,
    evidenceNeeded: worthiness.evidenceNeeded,
    reasons: worthiness.reasons,
  };
}
