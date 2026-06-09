export type ChartmetricProjectSupplementals = {
  spotifyPopularity?: unknown;
  playlistSnapshot?: unknown;
  albumTracks?: unknown;
  fetchWindow: { since: string; until: string };
  supplementalErrors: Record<string, string>;
};

export function mergeChartmetricProjectPayload(
  base: unknown,
  supplementals: ChartmetricProjectSupplementals,
): Record<string, unknown> {
  return {
    ...unwrapEntity(base),
    _spotify_popularity_history: unwrapRows(supplementals.spotifyPopularity),
    _active_playlists: unwrapPlaylistRows(supplementals.playlistSnapshot),
    _album_tracks: unwrapRows(supplementals.albumTracks),
    _fetch_window: supplementals.fetchWindow,
    _supplemental_errors: supplementals.supplementalErrors,
  };
}

function unwrapEntity(payload: unknown): Record<string, unknown> {
  if (!isRecord(payload)) return {};
  const obj = payload.obj;
  if (isRecord(obj)) return obj;
  if (Array.isArray(obj)) return obj.find(isRecord) ?? {};
  return payload;
}

function unwrapRows(payload: unknown) {
  const obj = unwrapObj(payload);
  if (Array.isArray(obj)) return obj.filter(isRecord);
  if (isRecord(obj) && Array.isArray(obj.data)) return obj.data.filter(isRecord);
  return [];
}

function unwrapPlaylistRows(payload: unknown) {
  const obj = unwrapObj(payload);
  if (!Array.isArray(obj)) return [];

  return obj.flatMap((row) => {
    if (!isRecord(row)) return [];
    const playlist = isRecord(row.playlist) ? row.playlist : row;
    const track = isRecord(row.track) ? row.track : {};
    return [{
      ...playlist,
      added_at: readString(playlist.added_at) ?? readString(row.added_at),
      removed_at: readString(playlist.removed_at) ?? readString(row.removed_at),
      position: readNumber(playlist.position) ?? readNumber(row.position) ?? readNumber(row.rank),
      platform: readString(playlist.platform) ?? readString(playlist.store) ?? "spotify",
      track_name: readString(track.name),
      chartmetric_track_id: readNumber(track.cm_track) ?? readNumber(track.id),
    }];
  });
}

function unwrapObj(payload: unknown): unknown {
  if (!isRecord(payload)) return payload;
  return "obj" in payload ? payload.obj : payload;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
