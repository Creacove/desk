import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { assertActiveWorkspaceEntitlement } from "../_shared/entitlements.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type SetupInput = {
  checkoutSessionId: string;
  phase: "discovery" | "contextualize";
};

type StageStatus = Record<string, Record<string, unknown> | string>;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  let setupRun: any | null = null;
  let input: SetupInput | null = null;
  let db: any | null = null;
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header." }, 401);
    input = (await request.json()) as SetupInput;
    if (!input.checkoutSessionId || !["discovery", "contextualize"].includes(input.phase)) {
      return json({ error: "checkoutSessionId and a valid phase are required." }, 400);
    }

    const supabaseUrl = requireEnv("SUPABASE_URL");
    const anonKey = requireEnv("SUPABASE_ANON_KEY");
    const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const isServiceRoleInvocation = authHeader === `Bearer ${serviceRoleKey}` || readBearerJwtRole(authHeader) === "service_role";
    db = createClient(supabaseUrl, serviceRoleKey, {
      global: { headers: { Authorization: `Bearer ${serviceRoleKey}` } },
    });

    const { data: checkout, error: checkoutError } = await db
      .from("billing_checkout_sessions")
      .select("*")
      .eq("id", input.checkoutSessionId)
      .maybeSingle();
    if (checkoutError) throw checkoutError;
    if (!checkout?.artist_workspace_id || checkout.status !== "paid") {
      return json({ error: "Paid checkout workspace was not found." }, 404);
    }

    if (!isServiceRoleInvocation) {
      const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
      const { data: { user }, error: userError } = await authClient.auth.getUser();
      if (userError || !user || user.id !== checkout.user_id) return json({ error: "Forbidden." }, 403);
    }

    const { data: run, error: runError } = await db
      .from("workspace_setup_runs")
      .select("*")
      .eq("checkout_session_id", checkout.id)
      .maybeSingle();
    if (runError) throw runError;
    if (!run) throw new Error("Workspace setup run was not created.");
    setupRun = run;

    const workspace = await loadWorkspace(db, checkout.artist_workspace_id);
    await assertActiveWorkspaceEntitlement(db, { artistWorkspaceId: workspace.id });

    if (input.phase === "discovery") {
      return json(await runDiscoveryPhase({ db, supabaseUrl, serviceRoleKey, checkout, workspace, setupRun }));
    }
    return json(await runContextualizePhase({ db, supabaseUrl, serviceRoleKey, checkout, workspace, setupRun }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Paid workspace setup failed.";
    if (db && setupRun && input) await markSetupFailed(db, setupRun, input.phase, message).catch(() => undefined);
    return json({ error: message }, 500);
  }
});

async function runDiscoveryPhase({ db, supabaseUrl, serviceRoleKey, checkout, workspace, setupRun }: any) {
  const stages = stageStatus(setupRun.stage_status);
  const existing = stageState(stages, "manager_discovery");
  const catalogState = stageState(stages, "catalog_bootstrap");
  if (
    setupRun.status === "running" && ["queued", "running", "completed", "completed_with_limits"].includes(existing) ||
    ["running", "completed", "completed_with_limits"].includes(catalogState) ||
    ["completed", "completed_with_limits"].includes(existing)
  ) {
    return { status: existing, phase: "discovery" };
  }

  const startedAt = new Date().toISOString();
  const nextStages = {
    ...stages,
    catalog_bootstrap: { status: "running", started_at: startedAt },
    manager_discovery: { status: "queued" },
  };
  const claimed = await claimSetupRun(db, setupRun.id, setupRun.status, {
    status: "running",
    current_stage: "catalog_bootstrap",
    stage_status: nextStages,
    last_error: null,
  });
  if (!claimed) return { status: "running", phase: "discovery" };

  const selectedArtist = checkout.selected_artist;
  const result = await invokeFunctionWithRetries({
    supabaseUrl,
    serviceRoleKey,
    functionName: "spotify-catalog-bootstrap",
    body: {
      accountId: workspace.account_id,
      artistWorkspaceId: workspace.id,
      artistId: workspace.artist_id,
      selectedArtist,
      market: "US",
      setupRunId: setupRun.id,
      checkoutSessionId: checkout.id,
    },
  });

  return { status: "running", phase: "discovery", catalog: result };
}

async function runContextualizePhase({ db, supabaseUrl, serviceRoleKey, workspace, setupRun }: any) {
  const stages = stageStatus(setupRun.stage_status);
  const contextComplete = Boolean(workspace.profile?.artist_direction && workspace.profile?.budget_context);
  const contextStages = {
    ...stages,
    context_received: {
      status: contextComplete ? "completed" : "waiting",
      ...(contextComplete ? { completed_at: new Date().toISOString() } : {}),
    },
  };
  if (!contextComplete) {
    await updateSetupRun(db, setupRun.id, {
      status: "running",
      current_stage: "setup_brief",
      stage_status: { ...contextStages, setup_brief: { status: "waiting_for_context" } },
    });
    return { status: "waiting_for_context", phase: "contextualize" };
  }

  const discoveryState = stageState(contextStages, "manager_discovery");
  if (!["completed", "completed_with_limits"].includes(discoveryState)) {
    await updateSetupRun(db, setupRun.id, {
      status: "running",
      current_stage: "manager_discovery",
      stage_status: { ...contextStages, setup_brief: { status: "queued" } },
    });
    return { status: "waiting_for_discovery", phase: "contextualize" };
  }

  const setupBriefState = stageState(contextStages, "setup_brief");
  if (setupBriefState === "completed") {
    return { status: "completed", phase: "contextualize" };
  }
  if (setupBriefState === "running") return { status: "running", phase: "contextualize" };

  const startedAt = new Date().toISOString();
  const claimed = await claimContextualPhase(db, setupRun.id, setupBriefState, {
    status: "running",
    current_stage: "setup_brief",
    stage_status: { ...contextStages, setup_brief: { status: "running", started_at: startedAt } },
    last_error: null,
  });
  if (!claimed) return { status: "running", phase: "contextualize" };

  const result = await invokeFunctionWithRetries({
    supabaseUrl,
    serviceRoleKey,
    functionName: "generate-todays-brief",
    body: {
      accountId: workspace.account_id,
      artistWorkspaceId: workspace.id,
      artistId: workspace.artist_id,
      trigger: "setup",
      generationMode: "setup-map",
    },
  });
  if (result?.status !== "completed" || !result.brief) throw new Error("Contextual setup brief did not produce a live Manager read.");

  const completedAt = new Date().toISOString();
  await updateSetupRun(db, setupRun.id, {
    status: "completed",
    current_stage: "music_reads",
    stage_status: {
      ...contextStages,
      setup_brief: { status: "completed", started_at: startedAt, completed_at: completedAt },
      music_reads: {
        status: Array.isArray(result.setupMusicReadTargets) && result.setupMusicReadTargets.length ? "running" : "completed",
        target_count: Array.isArray(result.setupMusicReadTargets) ? result.setupMusicReadTargets.length : 0,
        started_at: completedAt,
      },
    },
    completed_at: completedAt,
    last_error: null,
  });
  return { status: "completed", phase: "contextualize", ...result };
}

async function loadWorkspace(db: any, workspaceId: string) {
  const { data, error } = await db
    .from("artist_workspaces")
    .select("id,account_id,artist_id,artists(display_name,canonical_spotify_artist_id,canonical_spotify_url),artist_profiles(artist_direction,budget_context,current_goal)")
    .eq("id", workspaceId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Artist workspace was not found.");
  const artist = Array.isArray(data.artists) ? data.artists[0] : data.artists;
  const profile = Array.isArray(data.artist_profiles) ? data.artist_profiles[0] : data.artist_profiles;
  return { ...data, artist, profile };
}

async function invokeFunctionWithRetries({ supabaseUrl, serviceRoleKey, functionName, body }: any) {
  let lastError: unknown;
  for (const delayMs of [0, 500, 1500]) {
    if (delayMs) await delay(delayMs);
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error ?? `${functionName} failed with ${response.status}.`);
      return payload;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

async function markSetupFailed(db: any, run: any, phase: string, message: string) {
  const stages = stageStatus(run.stage_status);
  const key = phase === "discovery" ? "catalog_bootstrap" : "setup_brief";
  await updateSetupRun(db, run.id, {
    status: "failed",
    current_stage: key,
    stage_status: { ...stages, [key]: { status: "failed", error: message, failed_at: new Date().toISOString() } },
    last_error: message,
    retry_count: Number(run.retry_count ?? 0) + 1,
  });
}

async function updateSetupRun(db: any, id: string, patch: Record<string, unknown>) {
  const { error } = await db.from("workspace_setup_runs").update(patch).eq("id", id);
  if (error) throw error;
}

async function claimSetupRun(db: any, id: string, expectedStatus: string, patch: Record<string, unknown>) {
  const { data, error } = await db.from("workspace_setup_runs")
    .update(patch)
    .eq("id", id)
    .eq("status", expectedStatus)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return Boolean(data?.id);
}

async function claimContextualPhase(db: any, id: string, expectedStage: string, patch: Record<string, unknown>) {
  let query = db.from("workspace_setup_runs").update(patch).eq("id", id);
  if (expectedStage !== "not_started") {
    query = query.contains("stage_status", { setup_brief: { status: expectedStage } });
  }
  const { data, error } = await query.select("id").maybeSingle();
  if (error) throw error;
  return Boolean(data?.id);
}

function stageStatus(value: unknown): StageStatus {
  return value && typeof value === "object" && !Array.isArray(value) ? value as StageStatus : {};
}

function stageState(stages: StageStatus, key: string) {
  const value = stages[key];
  return typeof value === "string" ? value : typeof value?.status === "string" ? value.status : "not_started";
}

function readBearerJwtRole(authHeader: string) {
  try {
    const token = authHeader.replace(/^Bearer\s+/i, "");
    return JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")))?.role;
  } catch {
    return undefined;
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requireEnv(key: string) {
  const value = Deno.env.get(key);
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
