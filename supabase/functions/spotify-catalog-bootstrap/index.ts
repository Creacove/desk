import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { bootstrapSpotifyCatalog } from "../_shared/spotifyCatalogBootstrap.ts";
import { createSpotifyCatalogClient } from "../_shared/spotifyCatalogClient.ts";
import { createSupabaseCatalogRepository } from "../_shared/supabaseCatalogRepository.ts";
import { assertActiveWorkspaceEntitlement } from "../_shared/entitlements.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const sourceSyncJobType = "spotify_catalog_bootstrap";
const normalizedCatalogTables = ["source_snapshots", "music_items", "music_identifiers"];

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
  setupRunId?: string;
  checkoutSessionId?: string;
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
    const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const authHeader = request.headers.get("Authorization");

    if (!authHeader) {
      return json({ error: "Missing Authorization header." }, 401);
    }

    const isServiceRoleInvocation =
      authHeader === `Bearer ${serviceRoleKey}` || readBearerJwtRole(authHeader) === "service_role";
    authClient = createClient(supabaseUrl, isServiceRoleInvocation ? serviceRoleKey : anonKey, {
      global: { headers: { Authorization: isServiceRoleInvocation ? `Bearer ${serviceRoleKey}` : authHeader } },
    });

    if (!isServiceRoleInvocation) {
      const { data: { user }, error: userError } = await authClient.auth.getUser();
      if (userError || !user) return json({ error: "Unauthorized." }, 401);
      const { data: membership, error: membershipError } = await authClient.rpc("is_account_member", {
        target_account_id: input.accountId,
      });
      if (membershipError) throw membershipError;
      if (!membership) return json({ error: "Forbidden." }, 403);
    }

    if (!isServiceRoleInvocation) {
      await assertActiveWorkspaceEntitlement(authClient, input);
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

    if (bootstrapInput.setupRunId && result.status !== "failed") {
      await updateSetupRunStage(authClient, bootstrapInput.setupRunId, {
        status: "running",
        currentStage: "manager_discovery",
        completedStage: "catalog_bootstrap",
        nextStage: "manager_discovery",
        limitation: result.status === "completed_with_limits" ? "Spotify catalog completed with limits." : undefined,
      });
    }

    const functionApiKey = isServiceRoleInvocation ? serviceRoleKey : anonKey;
    scheduleBackgroundTask(dispatchManagerArtistDiscovery(supabaseUrl, functionApiKey, authHeader, bootstrapInput, result).catch(async (error) => {
      const message = errorMessage(error, "Manager artist discovery dispatch failed.");
      console.warn("manager artist discovery dispatch failed", { message });
      await recordDiscoveryFailure(authClient, bootstrapInput, message).catch(() => undefined);
      if (bootstrapInput.setupRunId) {
        await markSetupRunDiscoveryFailed(authClient, bootstrapInput.setupRunId, message).catch(() => undefined);
      }
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
      setupRunId: input.setupRunId,
      checkoutSessionId: input.checkoutSessionId,
    }),
  });

  if (!response.ok) {
    throw new Error(`Manager artist discovery dispatch failed with status ${response.status}.`);
  }
}

async function updateSetupRunStage(
  client: any,
  setupRunId: string,
  input: { status: string; currentStage: string; completedStage: string; nextStage: string; limitation?: string },
) {
  const { data: run, error } = await client.from("workspace_setup_runs").select("stage_status").eq("id", setupRunId).maybeSingle();
  if (error) throw error;
  const stages = run?.stage_status && typeof run.stage_status === "object" ? run.stage_status : {};
  const now = new Date().toISOString();
  const { error: updateError } = await client.from("workspace_setup_runs").update({
    status: input.status,
    current_stage: input.currentStage,
    stage_status: {
      ...stages,
      [input.completedStage]: { status: input.limitation ? "completed_with_limits" : "completed", completed_at: now, limitation: input.limitation },
      [input.nextStage]: { status: "running", started_at: now },
    },
  }).eq("id", setupRunId);
  if (updateError) throw updateError;
}

function readBearerJwtRole(authHeader: string) {
  try {
    const token = authHeader.replace(/^Bearer\s+/i, "");
    return JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")))?.role;
  } catch {
    return undefined;
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

async function markSetupRunDiscoveryFailed(authClient: any, setupRunId: string, message: string) {
  const { data: run, error } = await authClient.from("workspace_setup_runs").select("stage_status,retry_count").eq("id", setupRunId).maybeSingle();
  if (error) throw error;
  const stages = run?.stage_status && typeof run.stage_status === "object" ? run.stage_status : {};
  await authClient.from("workspace_setup_runs").update({
    status: "failed",
    current_stage: "manager_discovery",
    stage_status: {
      ...stages,
      manager_discovery: { status: "failed", error: message, failed_at: new Date().toISOString() },
    },
    last_error: message,
    retry_count: Number(run?.retry_count ?? 0) + 1,
  }).eq("id", setupRunId);
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
