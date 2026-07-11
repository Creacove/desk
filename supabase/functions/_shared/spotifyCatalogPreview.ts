import type {
  SpotifyAlbumPayload,
  SpotifyAlbumSummary,
  SpotifyArtistPayload,
  SpotifyCatalogClient,
  SpotifyTrackPayload,
} from "./spotifyCatalogBootstrap.ts";

export type SpotifyCatalogPreviewTrack = {
  spotifyTrackId: string;
  name: string;
  durationMs?: number;
  spotifyUrl?: string;
  explicit?: boolean;
};

export type SpotifyCatalogPreviewRelease = {
  spotifyAlbumId: string;
  name: string;
  releaseType?: string;
  releaseDate?: string;
  artworkUrl?: string;
  spotifyUrl?: string;
  tracks: SpotifyCatalogPreviewTrack[];
};

export type SpotifyCatalogPreview = {
  artist: {
    spotifyArtistId: string;
    name: string;
    spotifyUrl?: string;
    imageUrl?: string;
  };
  latestProject?: SpotifyCatalogPreviewRelease;
  standaloneSingles: SpotifyCatalogPreviewRelease[];
};

export type SpotifyCatalogSelection = {
  artist: SpotifyArtistPayload;
  albumsResponse: { items: SpotifyAlbumSummary[]; total: number };
  latestProject?: SpotifyAlbumPayload;
  standaloneAlbums: SpotifyAlbumPayload[];
  limitations: string[];
};

export async function loadSpotifyCatalogPreview({
  artistId,
  market = "US",
  spotify,
  retryDelaysMs = [1000, 3000, 7000],
}: {
  artistId: string;
  market?: string;
  spotify: SpotifyCatalogClient;
  retryDelaysMs?: number[];
}): Promise<SpotifyCatalogPreview> {
  const selection = await loadSpotifyCatalogSelection({ artistId, market, spotify, retryDelaysMs });
  return {
    artist: toArtist(selection.artist),
    latestProject: selection.latestProject ? toRelease(selection.latestProject) : undefined,
    standaloneSingles: selection.standaloneAlbums.map(toRelease),
  };
}

export async function loadSpotifyCatalogSelection({
  artistId,
  market = "US",
  spotify,
  retryDelaysMs = [1000, 3000, 7000],
}: {
  artistId: string;
  market?: string;
  spotify: SpotifyCatalogClient;
  retryDelaysMs?: number[];
}): Promise<SpotifyCatalogSelection> {
  const artist = await withRetries(() => spotify.getArtist(artistId), retryDelaysMs);
  const [projects, singles] = await Promise.all([
    withRetries(() => spotify.getArtistAlbums(artistId, { market, limit: 10, includeGroup: "album" }), retryDelaysMs),
    withRetries(() => spotify.getArtistAlbums(artistId, { market, limit: 10, includeGroup: "single" }), retryDelaysMs),
  ]);
  const releases = uniqueReleases([...projects.items, ...singles.items]);
  const latestProjectSummary = selectLatestProject(releases);
  const standaloneSummaries = selectStandaloneSingles(releases, latestProjectSummary?.id, 5);

  const limitations: string[] = [];
  const [latestProject, standaloneAlbums] = await Promise.all([
    latestProjectSummary
      ? withRetries(() => spotify.getAlbum(latestProjectSummary.id, { market }), retryDelaysMs).catch((error) => {
          limitations.push(error instanceof Error ? error.message : "Spotify project fetch returned partial data.");
          return undefined;
        })
      : Promise.resolve(undefined),
    Promise.all(
      standaloneSummaries.map((summary) =>
        withRetries(() => spotify.getAlbum(summary.id, { market }), retryDelaysMs)
          .catch((error) => {
            limitations.push(error instanceof Error ? error.message : `Spotify single ${summary.id} returned partial data.`);
            return undefined;
          }),
      ),
    ).then((items) => items.filter((item): item is SpotifyAlbumPayload => Boolean(item))),
  ]);

  return {
    artist,
    albumsResponse: {
      items: releases,
      total: (projects.total ?? projects.items.length) + (singles.total ?? singles.items.length),
    },
    latestProject,
    standaloneAlbums,
    limitations,
  };
}

async function withRetries<T>(operation: () => Promise<T>, retryDelaysMs: number[]) {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt >= retryDelaysMs.length || !isTransientSpotifyError(error)) throw error;
      await delay(spotifyRetryDelayMs(error, retryDelaysMs[attempt]));
    }
  }
  throw lastError;
}

export function spotifyRetryDelayMs(error: unknown, fallbackMs: number) {
  if (!error || typeof error !== "object" || !("retryAfterMs" in error)) return fallbackMs;
  const retryAfterMs = Number((error as { retryAfterMs?: unknown }).retryAfterMs);
  return Number.isFinite(retryAfterMs) && retryAfterMs > 0
    ? Math.max(fallbackMs, retryAfterMs)
    : fallbackMs;
}

function isTransientSpotifyError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /\b(?:429|5\d\d)\b|timed out|network|fetch/i.test(message);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toArtist(artist: SpotifyArtistPayload) {
  return {
    spotifyArtistId: artist.id,
    name: artist.name,
    spotifyUrl: artist.external_urls?.spotify,
    imageUrl: selectImage(artist.images),
  };
}

function toRelease(album: SpotifyAlbumPayload): SpotifyCatalogPreviewRelease {
  return {
    spotifyAlbumId: album.id,
    name: album.name,
    releaseType: album.album_type,
    releaseDate: album.release_date,
    artworkUrl: selectImage(album.images),
    spotifyUrl: album.external_urls?.spotify,
    tracks: uniqueTracks(album.tracks?.items ?? []).map(toTrack),
  };
}

function toTrack(track: SpotifyTrackPayload): SpotifyCatalogPreviewTrack {
  return {
    spotifyTrackId: track.id,
    name: track.name,
    durationMs: track.duration_ms,
    spotifyUrl: track.external_urls?.spotify,
    explicit: track.explicit,
  };
}

function uniqueReleases(releases: SpotifyAlbumSummary[]) {
  const seen = new Set<string>();
  return releases.filter((release) => {
    if (!release.id || seen.has(release.id)) return false;
    seen.add(release.id);
    return true;
  });
}

function selectLatestProject(releases: SpotifyAlbumSummary[]) {
  return [...releases]
    .filter((release) => release.album_type !== "single" || (release.total_tracks ?? 0) > 1)
    .sort((left, right) => releaseTime(right.release_date) - releaseTime(left.release_date))[0];
}

function selectStandaloneSingles(releases: SpotifyAlbumSummary[], projectId: string | undefined, limit: number) {
  return [...releases]
    .filter((release) => release.id !== projectId && release.album_type === "single" && release.total_tracks === 1)
    .sort((left, right) => releaseTime(right.release_date) - releaseTime(left.release_date))
    .slice(0, limit);
}

function uniqueTracks(tracks: SpotifyTrackPayload[]) {
  const seen = new Set<string>();
  return tracks.filter((track) => {
    if (!track.id || seen.has(track.id)) return false;
    seen.add(track.id);
    return true;
  });
}

function releaseTime(value?: string) {
  if (!value) return 0;
  const time = Date.parse(value.length === 4 ? `${value}-01-01` : value.length === 7 ? `${value}-01` : value);
  return Number.isFinite(time) ? time : 0;
}

function selectImage(images?: Array<{ url: string; width?: number | null }>) {
  return [...(images ?? [])].sort((left, right) => (right.width ?? 0) - (left.width ?? 0))[0]?.url;
}
