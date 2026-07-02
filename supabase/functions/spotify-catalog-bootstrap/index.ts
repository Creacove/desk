import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  bootstrapSpotifyCatalog,
  type SpotifyAudioFeaturesPayload,
  type SpotifyAlbumPayload,
  type SpotifyArtistAlbumsResponse,
  type SpotifyArtistPayload,
} from "../_shared/spotifyCatalogBootstrap.ts";
import { createSupabaseCatalogRepository } from "../_shared/supabaseCatalogRepository.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const sourceSyncJobType = "spotify_catalog_bootstrap";
const normalizedCatalogTables = ["source_snapshots", "music_items", "music_identifiers"];
const spotifyTimeoutMs = 15000;

type BootstrapInput = {
  accountId: string;
  artistWorkspaceId: string;
  artistId: string;
  selectedArtist: {
    spotifyArtistId: string;
    name: string;
    spotifyUrl: string;
    spotifyUri?: string;
  };
  market?: string;
  sourceConnectionId?: string;
  sourceSyncJobId?: string;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return json({ ok: true });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  let input: BootstrapInput | null = null;
  let authClient: any | null = null;
  try {
    input = (await request.json()) as BootstrapInput;
    validateInput(input);
    const bootstrapInput = input;

    const supabaseUrl = requireEnv("SUPABASE_URL");
    const anonKey = requireEnv("SUPABASE_ANON_KEY");
    const authHeader = request.headers.get("Authorization");

    if (!authHeader) {
      return json({ error: "Missing Authorization header." }, 401);
    }

    authClient = createClient(supabaseUrl, anonKey, {
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

    if (membershipError) {
      throw membershipError;
    }

    if (!membership) {
      return json({ error: "Forbidden." }, 403);
    }

    const result = await bootstrapSpotifyCatalog({
      input: bootstrapInput,
      spotify: await createSpotifyCatalogClient(),
      repository: createSupabaseCatalogRepository(authClient, {
        accountId: bootstrapInput.accountId,
        artistWorkspaceId: bootstrapInput.artistWorkspaceId,
        artistId: bootstrapInput.artistId,
      }),
    });

    scheduleBackgroundTask(dispatchManagerArtistDiscovery(supabaseUrl, anonKey, authHeader, bootstrapInput, result).catch(async (error) => {
      const message = errorMessage(error, "Manager artist discovery dispatch failed.");
      console.warn("manager artist discovery dispatch failed", { message });
      await recordDiscoveryFailure(authClient, bootstrapInput, message).catch(() => undefined);
    }));

    return json(result, result.status === "failed" ? 502 : 200);
  } catch (error) {
    const message = errorMessage(error, "Spotify catalog bootstrap failed.");
    console.error("spotify-catalog-bootstrap failed", { message, error });
    if (input?.sourceSyncJobId && authClient) {
      await markExistingJobFailed(authClient, input.sourceSyncJobId, message).catch(() => undefined);
    }
    return json({ error: message }, 500);
  }
});

async function createSpotifyCatalogClient() {
  const clientId = requireEnv("SPOTIFY_CLIENT_ID");
  const clientSecret = requireEnv("SPOTIFY_CLIENT_SECRET");
  const credentials = btoa(`${clientId}:${clientSecret}`);
  const token = await postSpotifyToken(credentials);

  const callSpotify = async <T>(path: string, params: Record<string, string | number | undefined> = {}) => {
    const url = new URL(`https://api.spotify.com/v1${path}`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }

    return fetchSpotifyJson<T>(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });
  };

  return {
    getArtist: (artistId: string) => callSpotify<SpotifyArtistPayload>(`/artists/${encodeURIComponent(artistId)}`),
    getArtistAlbums: (
      artistId: string,
      options: { market?: string; limit: number; includeGroup: "album" | "single" },
    ) =>
      callSpotify<SpotifyArtistAlbumsResponse>(`/artists/${encodeURIComponent(artistId)}/albums`, {
        include_groups: options.includeGroup,
        market: options.market,
        limit: options.limit,
      }),
    getAlbum: (albumId: string, options: { market?: string }) =>
      callSpotify<SpotifyAlbumPayload>(`/albums/${encodeURIComponent(albumId)}`, { market: options.market }),
    getTrackAudioFeatures: (trackId: string) =>
      callSpotify<SpotifyAudioFeaturesPayload>(`/audio-features/${encodeURIComponent(trackId)}`),
  };
}

async function postSpotifyToken(credentials: string) {
  const response = await fetchWithTimeout("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });

  if (!response.ok) {
    throw new Error(`Spotify token request failed with ${response.status}.`);
  }

  const token = (await response.json()) as { access_token?: string };
  if (!token.access_token) {
    throw new Error("Spotify token response did not include an access token.");
  }

  return token.access_token;
}

async function fetchSpotifyJson<T>(url: string, init: RequestInit) {
  const response = await fetchWithTimeout(url, init);

  if (!response.ok) {
    throw new Error(`Spotify ${new URL(url).pathname} failed with ${response.status}.`);
  }

  return (await response.json()) as T;
}

async function fetchWithTimeout(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), spotifyTimeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`Spotify request timed out after ${spotifyTimeoutMs}ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function dispatchManagerArtistDiscovery(
  supabaseUrl: string,
  anonKey: string,
  authHeader: string,
  input: BootstrapInput,
  result: { status?: string },
) {
  if (result.status === "failed") {
    return;
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/manager-artist-discovery`, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      accountId: input.accountId,
      artistWorkspaceId: input.artistWorkspaceId,
      artistId: input.artistId,
      spotifyArtistId: input.selectedArtist.spotifyArtistId,
      artistName: input.selectedArtist.name,
    }),
  });

  if (!response.ok) {
    throw new Error(`Manager artist discovery dispatch failed with status ${response.status}.`);
  }
}

function scheduleBackgroundTask(task: Promise<unknown>) {
  const edgeRuntime = (globalThis as { EdgeRuntime?: { waitUntil?: (task: Promise<unknown>) => void } }).EdgeRuntime;
  if (typeof edgeRuntime?.waitUntil === "function") {
    edgeRuntime.waitUntil(task);
    return;
  }
  void task;
}

async function markExistingJobFailed(authClient: any, sourceSyncJobId: string, message: string) {
  await authClient
    .from("source_sync_jobs")
    .update({
      status: "failed",
      completed_at: new Date().toISOString(),
      error: message,
    })
    .eq("id", sourceSyncJobId);
}

async function recordDiscoveryFailure(authClient: any, input: BootstrapInput, message: string) {
  await authClient.from("operating_events").insert({
    account_id: input.accountId,
    artist_workspace_id: input.artistWorkspaceId,
    artist_id: input.artistId,
    event_type: "manager_artist_discovery_dispatch_failed",
    actor_type: "integration",
    target_type: "artist_workspace",
    target_id: input.artistWorkspaceId,
    source_type: "source_sync_job",
    source_id: input.sourceSyncJobId,
    summary: message,
    payload: {
      spotify_artist_id: input.selectedArtist.spotifyArtistId,
      artist_name: input.selectedArtist.name,
    },
  });
}

function validateInput(input: BootstrapInput | null): asserts input is BootstrapInput {
  if (!input?.accountId || !input.artistWorkspaceId || !input.artistId || !input.selectedArtist?.spotifyArtistId) {
    throw new Error("Missing required Spotify bootstrap input.");
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
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message) {
      return message;
    }
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
