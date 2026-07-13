import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { assertActiveWorkspaceEntitlement } from "../_shared/entitlements.ts";
import { createSpotifyCatalogClient } from "../_shared/spotifyCatalogClient.ts";
import type { SpotifyAlbumSummary, SpotifyImage } from "../_shared/spotifyCatalogBootstrap.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type CatalogSearchInput = {
  accountId: string;
  artistWorkspaceId: string;
  artistId: string;
  kind: "song" | "project";
  albumId?: string;
  market?: string;
};

type ReleaseCandidate = {
  albumId: string;
  name: string;
  albumType: string;
  releaseDate?: string;
  totalTracks?: number;
  coverImageUrl?: string;
  spotifyUrl?: string;
  alreadyImported: boolean;
};

type TrackCandidate = {
  trackId: string;
  name: string;
  trackNumber?: number;
  durationMs?: number;
  isrc?: string;
  alreadyImported: boolean;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return json({ ok: true });
  }
  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  try {
    const input = (await request.json()) as CatalogSearchInput;
    validateInput(input);

    const supabaseUrl = requireEnv("SUPABASE_URL");
    const anonKey = requireEnv("SUPABASE_ANON_KEY");
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing Authorization header." }, 401);
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser();
    if (userError || !user) {
      return json({ error: "Unauthorized." }, 401);
    }

    const { data: membership, error: membershipError } = await authClient.rpc("is_account_member", {
      target_account_id: input.accountId,
    });
    if (membershipError) throw membershipError;
    if (!membership) {
      return json({ error: "Forbidden." }, 403);
    }
    await assertActiveWorkspaceEntitlement(authClient, input);

    const spotifyArtistId = await resolveSpotifyArtistId(authClient, input);
    if (!spotifyArtistId) {
      return json({ error: "This workspace is not connected to a Spotify artist yet." }, 409);
    }

    const spotify = await createSpotifyCatalogClient();

    if (input.albumId) {
      const album = await spotify.getAlbum(input.albumId, { market: input.market });
      const trackIds = (album.tracks?.items ?? []).map((track) => track.id).filter(Boolean);
      const importedTrackIds = await importedIdentifierValues(authClient, input, "spotify_track_id", trackIds);
      const tracks: TrackCandidate[] = (album.tracks?.items ?? []).map((track) => ({
        trackId: track.id,
        name: track.name,
        trackNumber: track.track_number,
        durationMs: track.duration_ms,
        isrc: track.external_ids?.isrc,
        alreadyImported: importedTrackIds.has(track.id),
      }));
      return json({
        mode: "tracks",
        album: {
          albumId: album.id,
          name: album.name,
          coverImageUrl: selectImage(album.images),
        },
        tracks,
      });
    }

    const [projectReleases, singleReleases] = await Promise.all([
      fetchAllArtistAlbums(spotify, spotifyArtistId, "album", input.market),
      fetchAllArtistAlbums(spotify, spotifyArtistId, "single", input.market),
    ]);

    const releasesById = new Map<string, SpotifyAlbumSummary>();
    for (const release of [...projectReleases, ...singleReleases]) {
      if (release?.id) releasesById.set(release.id, release);
    }
    const uniqueReleases = [...releasesById.values()].sort(
      (a, b) => releaseSortValue(b.release_date) - releaseSortValue(a.release_date),
    );

    const importedAlbumIds = await importedIdentifierValues(
      authClient,
      input,
      "spotify_album_id",
      uniqueReleases.map((release) => release.id),
    );

    const releases: ReleaseCandidate[] = uniqueReleases.map((release) => ({
      albumId: release.id,
      name: release.name,
      albumType: release.album_type,
      releaseDate: release.release_date,
      totalTracks: release.total_tracks,
      coverImageUrl: selectImage(release.images),
      spotifyUrl: release.external_urls?.spotify,
      alreadyImported: importedAlbumIds.has(release.id),
    }));

    return json({ mode: "releases", releases });
  } catch (error) {
    const message = errorMessage(error, "Spotify catalog search failed.");
    console.error("spotify-catalog-search failed", { message });
    return json({ error: message }, 500);
  }
});

// This Spotify app runs in development mode, which caps the get-artist-albums
// endpoint at limit=10 (higher values return 400 "Invalid limit"). Paginate with
// offset to still surface the full catalogue, with a hard ceiling as a safety net.
const ALBUMS_PAGE_LIMIT = 10;
const ALBUMS_MAX_ITEMS = 100;

async function fetchAllArtistAlbums(
  spotify: Awaited<ReturnType<typeof createSpotifyCatalogClient>>,
  artistId: string,
  includeGroup: "album" | "single",
  market: string | undefined,
): Promise<SpotifyAlbumSummary[]> {
  const collected: SpotifyAlbumSummary[] = [];
  for (let offset = 0; offset < ALBUMS_MAX_ITEMS; offset += ALBUMS_PAGE_LIMIT) {
    const page = await spotify.getArtistAlbums(artistId, { market, limit: ALBUMS_PAGE_LIMIT, includeGroup, offset });
    const items = page.items ?? [];
    collected.push(...items);
    if (items.length < ALBUMS_PAGE_LIMIT) break;
    if (typeof page.total === "number" && offset + ALBUMS_PAGE_LIMIT >= page.total) break;
  }
  return collected;
}

async function resolveSpotifyArtistId(authClient: any, input: CatalogSearchInput) {
  const { data, error } = await authClient
    .from("artist_profiles")
    .select("spotify_identity")
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("artist_id", input.artistId)
    .maybeSingle();
  if (error) throw error;
  const identity = data?.spotify_identity as { id?: unknown } | null | undefined;
  const id = identity?.id;
  return typeof id === "string" && id.trim() ? id.trim() : undefined;
}

async function importedIdentifierValues(
  authClient: any,
  input: CatalogSearchInput,
  identifierType: "spotify_track_id" | "spotify_album_id",
  values: string[],
) {
  const unique = [...new Set(values.filter(Boolean))];
  if (unique.length === 0) return new Set<string>();

  const { data, error } = await authClient
    .from("music_identifiers")
    .select("identifier_value")
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("identifier_type", identifierType)
    .in("identifier_value", unique);
  if (error) throw error;

  return new Set((data as Array<{ identifier_value?: string }> | null)?.map((row) => row.identifier_value ?? "") ?? []);
}

function selectImage(images: SpotifyImage[] | undefined) {
  return [...(images ?? [])].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]?.url;
}

function releaseSortValue(releaseDate: string | undefined) {
  if (!releaseDate) return 0;
  const parsed = new Date(releaseDate);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function validateInput(input: CatalogSearchInput | null): asserts input is CatalogSearchInput {
  if (!input?.accountId || !input.artistWorkspaceId || !input.artistId) {
    throw new Error("Missing required Spotify catalog search input.");
  }
  if (input.kind !== "song" && input.kind !== "project") {
    throw new Error("Spotify catalog search kind must be 'song' or 'project'.");
  }
}

function requireEnv(key: string) {
  const value = Deno.env.get(key);
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  return fallback;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
