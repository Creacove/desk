import type { MissionViewModel, MusicObjectViewModel, SongMaterialViewModel } from "../../types/cleanProduction";

const CAMPAIGN_DOCUMENT_TYPES = new Set([
  "epk",
  "press_release",
  "press_angle",
  "artist_biography",
  "one_sheet",
  "spotify_editorial_pitch",
  "playlist_pitch",
  "press_target_brief",
  "press_pitch",
  "content_plan",
  "release_calendar",
]);

const RELEASED_STAGES = new Set(["released", "catalog", "archived"]);
const CAMPAIGN_LANGUAGE = /\b(release|launch|campaign|rollout|playlist|press|publicity|media|pitch|outreach|promotion|promote|servic(?:e|ing)|push (?:this|the) record|grow (?:this|the) record)\b/i;

type SongDocument = Extract<SongMaterialViewModel, { kind: "document" }>;

export type SongCampaignPhase = "pre_release" | "post_release";
export type SongCampaignNextMove = "build_release_kit" | "continue_campaign";

export type SongCampaignState = {
  visible: boolean;
  phase: SongCampaignPhase;
  managerStarted: boolean;
  documents: SongDocument[];
  mission?: MissionViewModel;
  nextMove: SongCampaignNextMove;
};

export function deriveSongCampaignState(
  song: MusicObjectViewModel,
  missions: MissionViewModel[] = [],
): SongCampaignState {
  const phase: SongCampaignPhase = isReleasedSong(song) ? "post_release" : "pre_release";
  const documents = (song.materials ?? []).filter(isCampaignDocument);
  const campaignMissions = missions.filter(isCampaignMission);
  const mission = campaignMissions.find((candidate) => candidate.status !== "complete") ?? campaignMissions[0];
  const managerStarted = isCampaignConversation(song);

  // Campaign is progressively disclosed. A newly imported released song stays simple
  // until the artist actually asks Manager to run campaign/servicing work or durable
  // campaign records exist. Rights, metadata, lyrics and unrelated Manager work do not
  // grow another navigation tab by accident.
  const visible = Boolean(managerStarted || mission || documents.length);

  return {
    visible,
    phase,
    managerStarted,
    documents,
    ...(mission ? { mission } : {}),
    nextMove: documents.length ? "continue_campaign" : "build_release_kit",
  };
}

export function isReleasedSong(song: MusicObjectViewModel) {
  const stage = String(song.lifecycleStage || song.status || song.lifecycle || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  return RELEASED_STAGES.has(stage);
}

function isCampaignDocument(material: SongMaterialViewModel): material is SongDocument {
  return material.kind === "document" && CAMPAIGN_DOCUMENT_TYPES.has(material.materialType);
}

function isCampaignMission(mission: MissionViewModel) {
  return CAMPAIGN_LANGUAGE.test([
    mission.title,
    mission.summary,
    mission.recommendation,
    mission.nextTask,
    mission.review,
  ].filter(Boolean).join(" "));
}

function isCampaignConversation(song: MusicObjectViewModel) {
  const conversation = song.managerConversation;
  if (!conversation?.id) return false;
  return CAMPAIGN_LANGUAGE.test(`${conversation.topic} ${conversation.summary}`);
}
