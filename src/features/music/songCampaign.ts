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
  const mission = missions.find((candidate) => candidate.status !== "complete") ?? missions[0];
  const managerStarted = Boolean(song.managerConversationId || song.managerConversation?.id);

  // Campaign is progressively disclosed. A newly imported released song stays simple
  // until the artist actually asks Manager to work it or durable campaign work exists.
  // Unreleased song workspaces normally have a linked release mission, which makes the
  // same surface available without introducing a second campaign record.
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
