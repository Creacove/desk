export type ChartmetricTrackSupplementals = {
  spotifyStats?: unknown;
  tiktokStats?: unknown;
  playlistSnapshot?: unknown;
  spotifyTopCharts?: unknown;
  spotifyViralCharts?: unknown;
  fetchWindow: { since: string; until: string };
  supplementalErrors: Record<string, string>;
};

export function mergeChartmetricTrackPayload(
  base: unknown,
  supplementals: ChartmetricTrackSupplementals,
): Record<string, unknown> {
  return {
    ...unwrapEntity(base),
    _spotify_stream_history: unwrapStatSeries(supplementals.spotifyStats),
    _tiktok_activity: unwrapStatSeries(supplementals.tiktokStats),
    _active_playlists: unwrapPlaylistSnapshot(supplementals.playlistSnapshot),
    _chart_history: [
      ...unwrapChartRows(supplementals.spotifyTopCharts, "Spotify Top Daily"),
      ...unwrapChartRows(supplementals.spotifyViralCharts, "Spotify Viral Daily"),
    ],
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

function unwrapStatSeries(payload: unknown) {
  const obj = unwrapObj(payload);
  const rows = Array.isArray(obj) ? obj.filter(isRecord) : isRecord(obj) ? [obj] : [];
  return rows.flatMap((row) => Array.isArray(row.data) ? row.data : []);
}

function unwrapPlaylistSnapshot(payload: unknown) {
  const obj = unwrapObj(payload);
  if (!Array.isArray(obj)) return [];

  return obj.flatMap((row) => {
    if (!isRecord(row)) return [];
    const playlist = isRecord(row.playlist) ? row.playlist : row;
    return [{
      ...playlist,
      added_at: readString(row.added_at) ?? readString(playlist.added_at),
      removed_at: readString(row.removed_at) ?? readString(playlist.removed_at),
      position: readNumber(row.position) ?? readNumber(row.rank) ?? readNumber(playlist.position) ?? readNumber(playlist.rank),
      platform: readString(playlist.platform) ?? readString(playlist.store) ?? "spotify",
    }];
  });
}

function unwrapChartRows(payload: unknown, defaultChartName: string) {
  const obj = unwrapObj(payload);
  const rows = Array.isArray(obj)
    ? obj.filter(isRecord)
    : isRecord(obj) && Array.isArray(obj.data)
      ? obj.data.filter(isRecord)
      : [];

  return rows.map((row) => ({
    ...row,
    chart_name: readString(row.chart_name) ?? readString(row.name) ?? readString(row.chart_type) ?? defaultChartName,
    platform: readString(row.platform) ?? readString(row.store) ?? "spotify",
    date: readString(row.date) ?? readString(row.timestp) ?? readString(row.chart_date) ?? readString(row.added_at),
    country: readString(row.country) ?? readString(row.region) ?? readString(row.code2) ?? "global",
  }));
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
