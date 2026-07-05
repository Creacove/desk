import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  importSpotifyAlbumAsProject,
  importSpotifyTrackAsSong,
  type SpotifyCatalogBootstrapInput,
} from "../_shared/spotifyCatalogBootstrap.ts";
import { createSpotifyCatalogClient } from "../_shared/spotifyCatalogClient.ts";
import { createSupabaseCatalogRepository } from "../_shared/supabaseCatalogRepository.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ImportSelectionInput = {
  accountId: string;
  artistWorkspaceId: string;
  artistId: string;
  kind: "song" | "project";
  albumId: string;
  trackId?: string;
  market?: string;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return json({ ok: true });
  }
  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  try {
    const input = (await request.json()) as ImportSelectionInput;
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

    const selectedArtist = await resolveSelectedArtist(authClient, input);
    if (!selectedArtist) {
      return json({ error: "This workspace is not connected to a Spotify artist yet." }, 409);
    }

    const spotify = await createSpotifyCatalogClient();
    const album = await spotify.getAlbum(input.albumId, { market: input.market });

    const bootstrapInput: SpotifyCatalogBootstrapInput = {
      accountId: input.accountId,
      artistWorkspaceId: input.artistWorkspaceId,
      artistId: input.artistId,
      selectedArtist,
      market: input.market,
    };
    const repository = createSupabaseCatalogRepository(authClient, {
      accountId: input.accountId,
      artistWorkspaceId: input.artistWorkspaceId,
      artistId: input.artistId,
    });

    if (input.kind === "project") {
      const result = await importSpotifyAlbumAsProject({ input: bootstrapInput, spotify, repository, album });
      await writeImportEvent(authClient, input, "music_project", result.musicProjectId, album.name, {
        imported_track_count: result.importedTrackCount,
        already_existed: result.alreadyExisted,
      });
      return json({
        subjectType: "music_project",
        subjectId: result.musicProjectId,
        alreadyExisted: result.alreadyExisted,
        importedTrackCount: result.importedTrackCount,
      });
    }

    if (!input.trackId) {
      return json({ error: "A trackId is required to import a song." }, 400);
    }

    const result = await importSpotifyTrackAsSong({ input: bootstrapInput, spotify, repository, album, trackId: input.trackId });
    const trackName = (album.tracks?.items ?? []).find((track) => track.id === input.trackId)?.name ?? album.name;
    await writeImportEvent(authClient, input, "music_item", result.musicItemId, trackName, {
      already_existed: result.alreadyExisted,
    });
    return json({
      subjectType: "music_item",
      subjectId: result.musicItemId,
      alreadyExisted: result.alreadyExisted,
    });
  } catch (error) {
    const message = errorMessage(error, "Spotify import failed.");
    console.error("spotify-import-selection failed", { message });
    return json({ error: message }, 500);
  }
});

async function resolveSelectedArtist(
  authClient: any,
  input: ImportSelectionInput,
): Promise<SpotifyCatalogBootstrapInput["selectedArtist"] | undefined> {
  const { data, error } = await authClient
    .from("artist_profiles")
    .select("spotify_identity")
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("artist_id", input.artistId)
    .maybeSingle();
  if (error) throw error;

  const identity = data?.spotify_identity as { id?: unknown; name?: unknown; url?: unknown; uri?: unknown } | null | undefined;
  const spotifyArtistId = typeof identity?.id === "string" ? identity.id.trim() : "";
  if (!spotifyArtistId) return undefined;

  return {
    spotifyArtistId,
    name: typeof identity?.name === "string" ? identity.name : "",
    spotifyUrl: typeof identity?.url === "string" ? identity.url : "",
    spotifyUri: typeof identity?.uri === "string" ? identity.uri : undefined,
  };
}

async function writeImportEvent(
  authClient: any,
  input: ImportSelectionInput,
  targetType: "music_item" | "music_project",
  targetId: string,
  title: string,
  payload: Record<string, unknown>,
) {
  await authClient
    .from("operating_events")
    .insert({
      account_id: input.accountId,
      artist_workspace_id: input.artistWorkspaceId,
      artist_id: input.artistId,
      event_type: targetType === "music_project" ? "spotify_project_imported" : "spotify_song_imported",
      actor_type: "user",
      target_type: targetType,
      target_id: targetId,
      summary: `Imported ${targetType === "music_project" ? "project" : "song"} ${title} from Spotify.`,
      payload: { ...payload, spotify_album_id: input.albumId, spotify_track_id: input.trackId },
    })
    .then((result: { error?: unknown }) => {
      if (result?.error) console.warn("spotify import event insert failed", { error: result.error });
    });
}

function validateInput(input: ImportSelectionInput | null): asserts input is ImportSelectionInput {
  if (!input?.accountId || !input.artistWorkspaceId || !input.artistId || !input.albumId) {
    throw new Error("Missing required Spotify import input.");
  }
  if (input.kind !== "song" && input.kind !== "project") {
    throw new Error("Spotify import kind must be 'song' or 'project'.");
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
