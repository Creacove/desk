import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createSupabaseCatalogRepository } from "../_shared/supabaseCatalogRepository.ts";
import { assertActiveWorkspaceEntitlement } from "../_shared/entitlements.ts";

const publicCatalogLimit =
  "Spotify public catalog supports identity, catalog, and public metadata only; it does not prove private analytics, saves, source-of-stream, revenue, conversion, or campaign ROI.";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const bootstrapStartTimeoutMs = 60000;

declare const EdgeRuntime: { waitUntil?: (task: Promise<unknown>) => void } | undefined;

type ConnectInput = {
  accountId: string;
  artistWorkspaceId: string;
  artistId: string;
  selectedArtist: {
    spotifyArtistId: string;
    name: string;
    spotifyUrl: string;
    spotifyUri?: string;
    imageUrl?: string;
    followers?: number;
    genres?: string[];
  };
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
    const input = (await request.json()) as ConnectInput;
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

    if (membershipError) {
      throw membershipError;
    }

    if (!membership) {
      return json({ error: "Forbidden." }, 403);
    }

    await assertActiveWorkspaceEntitlement(authClient, input);

    const repository = createSupabaseCatalogRepository(authClient, {
      accountId: input.accountId,
      artistWorkspaceId: input.artistWorkspaceId,
      artistId: input.artistId,
    });
    const providerId = await repository.getSpotifyProviderId();
    await repository.saveArtistSpotifyIdentity({
      spotifyArtistId: input.selectedArtist.spotifyArtistId,
      name: input.selectedArtist.name,
      spotifyUrl: input.selectedArtist.spotifyUrl,
      spotifyUri: input.selectedArtist.spotifyUri,
      imageUrl: input.selectedArtist.imageUrl,
      followers: input.selectedArtist.followers,
      genres: input.selectedArtist.genres ?? [],
    });
    const sourceConnectionId = await repository.upsertSourceConnection({
      accountId: input.accountId,
      artistWorkspaceId: input.artistWorkspaceId,
      artistId: input.artistId,
      providerId,
      handleOrExternalRef: input.selectedArtist.spotifyArtistId,
      status: "connected",
      limitations: [publicCatalogLimit],
      metadata: {
        spotify_artist_id: input.selectedArtist.spotifyArtistId,
        spotify_artist_url: input.selectedArtist.spotifyUrl,
        spotify_artist_uri: input.selectedArtist.spotifyUri,
      },
    });
    const sourceSyncJobId = await repository.createSourceSyncJob({
      accountId: input.accountId,
      artistWorkspaceId: input.artistWorkspaceId,
      artistId: input.artistId,
      sourceConnectionId,
      jobType: "spotify_catalog_bootstrap",
      triggerType: "setup",
      status: "running",
    });

    scheduleCatalogBootstrap(
      startCatalogBootstrap({
        supabaseUrl,
        anonKey,
        authHeader,
        authClient,
        input,
        sourceConnectionId,
        sourceSyncJobId,
      }),
    );

    return json({
      account_id: input.accountId,
      artist_workspace_id: input.artistWorkspaceId,
      artist_id: input.artistId,
      artist_name: input.selectedArtist.name,
      workspace_name: `${input.selectedArtist.name} Desk`,
      status: "setup",
      spotify_connected: true,
      spotify_artist_id: input.selectedArtist.spotifyArtistId,
      spotify_artist_name: input.selectedArtist.name,
      spotify_artist_url: input.selectedArtist.spotifyUrl,
      spotify_image_url: input.selectedArtist.imageUrl,
      context_complete: false,
      latest_catalog_sync_status: "running",
    });
  } catch (error) {
    const message = errorMessage(error, "Spotify artist could not be connected.");
    console.error("connect-spotify-artist failed", { message, error });
    return json({ error: message }, 500);
  }
});

function scheduleCatalogBootstrap(task: Promise<unknown>) {
  task.catch(() => undefined);

  if (typeof EdgeRuntime === "undefined" || typeof EdgeRuntime.waitUntil !== "function") {
    return;
  }

  try {
    EdgeRuntime.waitUntil(task);
  } catch {
    // The task is already running; scheduling support must not break artist selection.
  }
}

async function startCatalogBootstrap({
  supabaseUrl,
  anonKey,
  authHeader,
  authClient,
  input,
  sourceConnectionId,
  sourceSyncJobId,
}: {
  supabaseUrl: string;
  anonKey: string;
  authHeader: string;
  authClient: any;
  input: ConnectInput;
  sourceConnectionId: string;
  sourceSyncJobId: string;
}) {
  try {
    const response = await fetchWithTimeout(`${supabaseUrl}/functions/v1/spotify-catalog-bootstrap`, {
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
        selectedArtist: input.selectedArtist,
        market: input.market ?? "US",
        sourceConnectionId,
        sourceSyncJobId,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(body || `Spotify catalog bootstrap failed with ${response.status}.`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Spotify catalog bootstrap could not be started.";
    await authClient
      .from("source_sync_jobs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error: message,
      })
      .eq("id", sourceSyncJobId);
  }
}

async function fetchWithTimeout(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), bootstrapStartTimeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`Spotify catalog bootstrap start timed out after ${bootstrapStartTimeoutMs}ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function validateInput(input: ConnectInput) {
  if (!input?.accountId || !input.artistWorkspaceId || !input.artistId || !input.selectedArtist?.spotifyArtistId) {
    throw new Error("Missing required Spotify artist connection input.");
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
