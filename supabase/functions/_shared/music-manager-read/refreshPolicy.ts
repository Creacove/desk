export type MusicReadRefreshMode = "pre_release" | "release_window" | "post_release";

const PRE_RELEASE_EVENTS = new Set([
  "music_asset_uploaded",
  "music_asset_upload_failed",
  "music_audio_analysis_completed",
  "music_audio_analysis_failed",
  "music_lifecycle_updated",
  "music_metadata_updated",
  "music_credit_updated",
  "music_identifier_added",
  "music_split_contributor_saved",
  "music_split_contributor_removed",
  "music_split_confirmation_sent",
  "music_split_confirmation_completed",
  "music_release_brief_updated",
  "music_delivery_status_updated",
]);

const RELEASE_WINDOW_EVENTS = new Set([
  "music_asset_uploaded",
  "music_asset_upload_failed",
  "music_audio_analysis_completed",
  "music_audio_analysis_failed",
  "music_lifecycle_updated",
  "music_split_contributor_saved",
  "music_split_contributor_removed",
  "music_split_confirmation_sent",
  "music_split_confirmation_completed",
  "music_release_brief_updated",
  "music_delivery_status_updated",
]);

const POST_RELEASE_EVENTS = new Set([
  "music_asset_uploaded",
  "music_audio_analysis_completed",
  "music_lifecycle_updated",
  "music_metadata_updated",
  "music_post_release_evidence_updated",
]);

export function shouldAutomaticallyRefreshMusicRead(input: { mode: MusicReadRefreshMode; eventType: string }) {
  if (input.mode === "pre_release") return PRE_RELEASE_EVENTS.has(input.eventType);
  if (input.mode === "release_window") return RELEASE_WINDOW_EVENTS.has(input.eventType);
  return POST_RELEASE_EVENTS.has(input.eventType);
}

export function musicReadRefreshMode(value: { lifecycleStage?: unknown; releasedAt?: unknown; plannedReleaseDate?: unknown }): MusicReadRefreshMode {
  const lifecycle = typeof value.lifecycleStage === "string" ? value.lifecycleStage.trim().toLowerCase() : "";
  if (value.releasedAt || lifecycle === "released" || lifecycle === "catalog") return "post_release";
  if (lifecycle === "scheduled" || value.plannedReleaseDate) return "release_window";
  return "pre_release";
}
