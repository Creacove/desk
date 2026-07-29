import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { bootstrapSpotifyCatalog } from "../_shared/spotifyCatalogBootstrap.ts";
import { createSpotifyCatalogClient } from "../_shared/spotifyCatalogClient.ts";
import { createSupabaseCatalogRepository } from "../_shared/supabaseCatalogRepository.ts";
import { assertActiveWorkspaceEntitlement } from "../_shared/entitlements.ts";
import {
  claimSourceSyncJob,
  claimWorkspaceSetupStage,
  finishSourceSyncJob,
  heartbeatWorkspaceSetupStage,
  mergeWorkspaceSetupStage,
  type DurableLease,
} from "../_shared/durableWorkflow.ts";
import { publicWorkflowFailure, workflowFailureBody } from "../_shared/workflowErrors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const sourceSyncJobType = "spotify_catalog_bootstrap";

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
  setupStageLeaseToken?: string;
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
  let workflowClient: any | null = null;
  let sourceJobId: string | null = null;
  let sourceJobLease: DurableLease | null = null;
  let setupStageLeaseToken: string | null = null;
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
    workflowClient = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: `Bearer ${serviceRoleKey}` } },
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

    setupStageLeaseToken = bootstrapInput.setupStageLeaseToken ?? null;
    if (bootstrapInput.setupRunId && !setupStageLeaseToken) {
      const setupLease = await claimWorkspaceSetupStage(workflowClient, {
        setupRunId: bootstrapInput.setupRunId,
        stage: "catalog_bootstrap",
        expectedStatus: "queued",
      });
      if (!setupLease) return json({ status: "running", setupRunId: bootstrapInput.setupRunId });
      setupStageLeaseToken = setupLease.token;
    } else if (bootstrapInput.setupRunId && setupStageLeaseToken) {
      const active = await heartbeatWorkspaceSetupStage(workflowClient, {
        setupRunId: bootstrapInput.setupRunId,
        stage: "catalog_bootstrap",
        leaseToken: setupStageLeaseToken,
        leaseSeconds: 900,
      });
      if (!active) return json({ status: "running", setupRunId: bootstrapInput.setupRunId });
    }

    sourceJobId = await ensureDurableSourceJob(workflowClient, bootstrapInput);
    sourceJobLease = await claimSourceSyncJob(workflowClient, { jobId: sourceJobId, leaseSeconds: 900 });
    if (!sourceJobLease) return json(await loadSourceJobState(workflowClient, sourceJobId));

    const baseRepository = createSupabaseCatalogRepository(authClient, {
      accountId: bootstrapInput.accountId,
      artistWorkspaceId: bootstrapInput.artistWorkspaceId,
      artistId: bootstrapInput.artistId,
    });
    const result = await bootstrapSpotifyCatalog({
      input: { ...bootstrapInput, sourceSyncJobId: sourceJobId },
      spotify: await createSpotifyCatalogClient(),
      repository: {
        ...baseRepository,
        async updateSourceSyncJob(id, patch) {
          const saved = await finishSourceSyncJob(workflowClient, {
            jobId: id,
            leaseToken: sourceJobLease!.token,
            status: patch.status,
            error: patch.error ? publicWorkflowFailure(new Error(patch.error)).message : undefined,
          });
          if (!saved) throw new Error("Source job lease expired before completion could be saved.");
        },
      },
    });

    if (result.status === "failed") {
      const failure = publicWorkflowFailure(result);
      if (bootstrapInput.setupRunId && setupStageLeaseToken) {
        await mergeWorkspaceSetupStage(workflowClient, {
          setupRunId: bootstrapInput.setupRunId,
          stage: "catalog_bootstrap",
          leaseToken: setupStageLeaseToken,
          patch: { status: "failed", error: failure.message, failure, failed_at: new Date().toISOString() },
        });
      }
      return json({ status: "failed", ...workflowFailureBody(failure) }, 502);
    }

    if (bootstrapInput.setupRunId && setupStageLeaseToken) {
      const merged = await mergeWorkspaceSetupStage(workflowClient, {
        setupRunId: bootstrapInput.setupRunId,
        stage: "catalog_bootstrap",
        leaseToken: setupStageLeaseToken,
        patch: {
          status: result.status === "completed_with_limits" ? "completed_with_limits" : "completed",
          completed_at: new Date().toISOString(),
          ...(result.status === "completed_with_limits" ? { limitation: "Music catalogue completed with limits." } : {}),
          next_stage_patch: { status: "queued" },
        },
      });
      if (!merged) throw new Error("Setup catalog lease expired before completion could be saved.");
    }

    const functionApiKey = isServiceRoleInvocation ? serviceRoleKey : anonKey;
    const discoveryLease = bootstrapInput.setupRunId
      ? await claimWorkspaceSetupStage(workflowClient, {
          setupRunId: bootstrapInput.setupRunId,
          stage: "manager_discovery",
          expectedStatus: "queued",
          leaseSeconds: 900,
        })
      : null;
    if (!bootstrapInput.setupRunId || discoveryLease) {
      scheduleBackgroundTask(dispatchManagerArtistDiscovery(
        supabaseUrl,
        functionApiKey,
        authHeader,
        bootstrapInput,
        result,
        discoveryLease?.token,
      ).catch(async (error) => {
        const failure = publicWorkflowFailure(error);
        console.error("manager artist discovery dispatch failed", { error, setupRunId: bootstrapInput.setupRunId });
        await recordDiscoveryFailure(authClient, bootstrapInput, failure.message).catch(() => undefined);
        if (bootstrapInput.setupRunId && discoveryLease) {
          await mergeWorkspaceSetupStage(workflowClient, {
            setupRunId: bootstrapInput.setupRunId,
            stage: "manager_discovery",
            leaseToken: discoveryLease.token,
            patch: { status: "failed", error: failure.message, failure, failed_at: new Date().toISOString() },
          }).catch(() => false);
        }
      }));
    }

    return json(result);
  } catch (error) {
    const failure = publicWorkflowFailure(error);
    console.error("spotify-catalog-bootstrap failed", { error, sourceJobId, setupRunId: input?.setupRunId });
    if (sourceJobId && sourceJobLease && workflowClient) {
      await finishSourceSyncJob(workflowClient, {
        jobId: sourceJobId,
        leaseToken: sourceJobLease.token,
        status: "failed",
        error: failure.message,
      }).catch(() => false);
    }
    if (input?.setupRunId && setupStageLeaseToken && workflowClient) {
      await mergeWorkspaceSetupStage(workflowClient, {
        setupRunId: input.setupRunId,
        stage: "catalog_bootstrap",
        leaseToken: setupStageLeaseToken,
        patch: { status: "failed", error: failure.message, failure, failed_at: new Date().toISOString() },
      }).catch(() => false);
    }
    return json(workflowFailureBody(error), 500);
  }
});

async function dispatchManagerArtistDiscovery(
  supabaseUrl: string,
  anonKey: string,
  authHeader: string,
  input: BootstrapInput,
  result: { status?: string },
  setupStageLeaseToken?: string,
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
      setupStageLeaseToken,
    }),
  });

  if (!response.ok) {
    throw new Error(`Manager artist discovery dispatch failed with status ${response.status}.`);
  }
}

async function ensureDurableSourceJob(client: any, input: BootstrapInput): Promise<string> {
  if (input.sourceSyncJobId) return input.sourceSyncJobId;
  const scopeKey = `spotify_catalog:${input.setupRunId ?? input.artistWorkspaceId}:${input.selectedArtist.spotifyArtistId}`;
  const payload = {
    account_id: input.accountId,
    artist_workspace_id: input.artistWorkspaceId,
    artist_id: input.artistId,
    source_connection_id: input.sourceConnectionId ?? null,
    job_type: sourceSyncJobType,
    trigger_type: "setup",
    status: "queued",
    workflow_version: "spotify_catalog_bootstrap_v1",
    scope_key: scopeKey,
    input_refs: input.setupRunId ? [{ type: "workspace_setup_run", id: input.setupRunId }] : [],
    target_payload: {
      spotify_artist_id: input.selectedArtist.spotifyArtistId,
      market: input.market ?? "US",
    },
    workspace_setup_run_id: input.setupRunId ?? null,
  };
  const { data, error } = await client.from("source_sync_jobs").insert(payload).select("id").maybeSingle();
  if (!error && data?.id) return data.id as string;
  if ((error as { code?: string } | null)?.code !== "23505") throw error;
  const { data: active, error: activeError } = await client.from("source_sync_jobs")
    .select("id")
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("job_type", sourceSyncJobType)
    .eq("scope_key", scopeKey)
    .in("status", ["queued", "running"])
    .maybeSingle();
  if (activeError) throw activeError;
  if (!active?.id) throw error;
  return active.id as string;
}

async function loadSourceJobState(client: any, sourceSyncJobId: string) {
  const { data, error } = await client.from("source_sync_jobs")
    .select("id,status,attempt_count,available_at,completed_at,error")
    .eq("id", sourceSyncJobId)
    .maybeSingle();
  if (error) throw error;
  return { status: data?.status ?? "queued", sourceSyncJobId, job: data ?? undefined };
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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
