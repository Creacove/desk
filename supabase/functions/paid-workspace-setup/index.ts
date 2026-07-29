import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { claimWorkspaceSetupStage, mergeWorkspaceSetupStage } from "../_shared/durableWorkflow.ts";
import { publicWorkflowFailure, workflowFailureBody } from "../_shared/workflowErrors.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type SetupInput = {
  checkoutSessionId: string;
  phase: "discovery" | "contextualize";
  explicitRetry?: boolean;
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
    if (!checkout?.artist_workspace_id || !(await isAuthorizedSetupCheckout(db, checkout))) {
      return json({ error: "Authorized checkout workspace was not found." }, 404);
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
    if (input.phase === "discovery") {
      return json(await runDiscoveryPhase({ db, supabaseUrl, serviceRoleKey, checkout, workspace, setupRun, input }));
    }
    return json(await runContextualizePhase({ db, supabaseUrl, serviceRoleKey, checkout, workspace, setupRun }));
  } catch (error) {
    console.error("paid-workspace-setup failed", { error, setupRunId: setupRun?.id, phase: input?.phase });
    return json(workflowFailureBody(error), 500);
  }
});

async function isAuthorizedSetupCheckout(db: any, checkout: any) {
  if (checkout.status === "paid") {
    const [transactionResult, subscriptionResult] = await Promise.all([
      db
        .from("billing_transactions")
        .select("id")
        .eq("checkout_session_id", checkout.id)
        .eq("provider", checkout.provider)
        .eq("status", "completed")
        .maybeSingle(),
      db
        .from("billing_subscriptions")
        .select("provider,status,current_period_end")
        .eq("checkout_session_id", checkout.id)
        .eq("provider", checkout.provider)
        .maybeSingle(),
    ]);
    if (transactionResult.error) throw transactionResult.error;
    if (subscriptionResult.error) throw subscriptionResult.error;
    return Boolean(transactionResult.data?.id && subscriptionGrantsPaidSetupAccess(subscriptionResult.data));
  }
  const { data, error } = await db
    .from("workspace_access_grants")
    .select("id")
    .eq("checkout_session_id", checkout.id)
    .eq("artist_workspace_id", checkout.artist_workspace_id)
    .eq("user_id", checkout.user_id)
    .eq("access_type", "private_beta")
    .eq("status", "active")
    .lte("starts_at", new Date().toISOString())
    .gt("ends_at", new Date().toISOString())
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

function subscriptionGrantsPaidSetupAccess(subscription: any) {
  if (!subscription) return false;
  const grantsForProvider = subscription.provider === "paddle"
    ? ["active", "trialing"].includes(subscription.status)
    : subscription.provider === "paystack"
      ? ["active", "non-renewing", "attention"].includes(subscription.status)
      : false;
  if (!grantsForProvider) return false;
  const periodEnd = subscription.current_period_end
    ? Date.parse(subscription.current_period_end)
    : Number.NaN;
  return !Number.isFinite(periodEnd) || periodEnd > Date.now();
}

async function runDiscoveryPhase({ db, supabaseUrl, serviceRoleKey, checkout, workspace, setupRun, input = {} }: any) {
  const stages = stageStatus(setupRun.stage_status);
  const existing = stageState(stages, "manager_discovery");
  const catalogState = stageState(stages, "catalog_bootstrap");

  if (["completed", "completed_with_limits"].includes(existing)) {
    return { status: existing, phase: "discovery" };
  }

  if (existing === "failed" && !input.explicitRetry) {
    const failure = readDiscoveryStageFailure(stages);
    return { status: "failed", phase: "discovery", error: failure.message, failure };
  }

  if (catalogState === "completed" || catalogState === "completed_with_limits") {
    if (existing === "running") return { status: "running", phase: "discovery" };
    const discoveryLease = await claimWorkspaceSetupStage(db, {
      setupRunId: setupRun.id,
      stage: "manager_discovery",
      expectedStatus: existing === "not_started" ? "queued" : existing,
      leaseSeconds: 900,
    });
    if (!discoveryLease) return { status: "running", phase: "discovery" };
    await dispatchManagerDiscoveryPhase({
      db,
      supabaseUrl,
      serviceRoleKey,
      checkout,
      workspace,
      setupRun,
      setupStageLeaseToken: discoveryLease.token,
      reuseExistingSnapshots: existing === "failed",
    });
    return { status: "running", phase: "discovery" };
  }

  if (catalogState === "running") return { status: "running", phase: "discovery" };
  const catalogLease = await claimWorkspaceSetupStage(db, {
    setupRunId: setupRun.id,
    stage: "catalog_bootstrap",
    expectedStatus: catalogState === "not_started" ? "queued" : catalogState,
    leaseSeconds: 900,
  });
  if (!catalogLease) return { status: "running", phase: "discovery" };

  const selectedArtist = checkout.selected_artist;
  let result: any;
  try {
    result = await invokeFunctionWithRetries({
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
        setupStageLeaseToken: catalogLease.token,
      },
    });
  } catch (error) {
    const failure = publicWorkflowFailure(error);
    await mergeWorkspaceSetupStage(db, {
      setupRunId: setupRun.id,
      stage: "catalog_bootstrap",
      leaseToken: catalogLease.token,
      patch: { status: "failed", error: failure.message, failure, failed_at: new Date().toISOString() },
    }).catch(() => false);
    throw error;
  }

  return { status: "running", phase: "discovery", catalog: result };
}

async function runContextualizePhase({ db, supabaseUrl, serviceRoleKey, checkout, workspace, setupRun }: any) {
  const stages = stageStatus(setupRun.stage_status);
  const contextComplete = Boolean(workspace.profile?.artist_direction && workspace.profile?.budget_context);
  let contextStages: StageStatus = {
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
  if (discoveryState === "failed") {
    throw new Error(readDiscoveryStageError(contextStages) || "Manager discovery failed. Retry setup after repairing the reported provider error.");
  }
  if (!["completed", "completed_with_limits"].includes(discoveryState)) {
    return recoverCatalogBeforeContextualize({ db, supabaseUrl, serviceRoleKey, checkout, workspace, setupRun });
  }

  const setupBriefState = stageState(contextStages, "setup_brief");
  if (setupBriefState === "completed") {
    return loadCompletedSetupResult(db, workspace);
  }
  if (setupBriefState === "running") return { status: "running", phase: "contextualize" };

  const startedAt = new Date().toISOString();
  const briefLease = await claimWorkspaceSetupStage(db, {
    setupRunId: setupRun.id,
    stage: "setup_brief",
    expectedStatus: setupBriefState === "not_started" ? "queued" : setupBriefState,
  });
  if (!briefLease) return { status: "running", phase: "contextualize" };

  let result: any;
  try {
    result = await invokeFunctionWithRetries({
      supabaseUrl,
      serviceRoleKey,
      functionName: "generate-todays-brief",
      body: {
        accountId: workspace.account_id,
        artistWorkspaceId: workspace.id,
        artistId: workspace.artist_id,
        trigger: "setup",
        generationMode: "setup-map",
        dispatchMusicReads: true,
        setupRunId: setupRun.id,
      },
    });
  } catch (error) {
    const failure = publicWorkflowFailure(error);
    await mergeWorkspaceSetupStage(db, {
      setupRunId: setupRun.id,
      stage: "setup_brief",
      leaseToken: briefLease.token,
      patch: { status: "failed", error: failure.message, failure, failed_at: new Date().toISOString() },
    }).catch(() => false);
    throw error;
  }
  if (result?.status !== "completed" || !result.brief) {
    const error = new Error("Contextual setup brief did not produce a live Manager read.");
    const failure = publicWorkflowFailure(error);
    await mergeWorkspaceSetupStage(db, {
      setupRunId: setupRun.id,
      stage: "setup_brief",
      leaseToken: briefLease.token,
      patch: { status: "failed", error: failure.message, failure, failed_at: new Date().toISOString() },
    }).catch(() => false);
    throw error;
  }

  const completedAt = new Date().toISOString();
  const hasMusicReadTargets = Array.isArray(result.setupMusicReadTargets) && result.setupMusicReadTargets.length > 0;
  const proposedMusicReadStage = {
    status: hasMusicReadTargets ? "running" : "completed",
    target_count: Array.isArray(result.setupMusicReadTargets) ? result.setupMusicReadTargets.length : 0,
    targets: Array.isArray(result.setupMusicReadTargets) ? result.setupMusicReadTargets : [],
    started_at: completedAt,
    ...(hasMusicReadTargets ? {} : { completed_at: completedAt }),
  };
  const merged = await mergeWorkspaceSetupStage(db, {
    setupRunId: setupRun.id,
    stage: "setup_brief",
    leaseToken: briefLease.token,
    patch: {
      status: "completed",
      started_at: startedAt,
      completed_at: completedAt,
      next_stage_patch: proposedMusicReadStage,
    },
  });
  if (!merged) throw new Error("Setup brief lease expired before completion could be saved.");
  return { status: "completed", phase: "contextualize", ...result };
}

async function recoverCatalogBeforeContextualize(args: any) {
  return runDiscoveryPhase(args).then((result) => ({
    ...result,
    status: "waiting_for_catalog",
    phase: "contextualize",
  }));
}

async function loadCompletedSetupResult(db: any, workspace: any) {
  const { data: output, error: outputError } = await db
    .from("manager_outputs")
    .select("render_json")
    .eq("account_id", workspace.account_id)
    .eq("artist_workspace_id", workspace.id)
    .eq("artist_id", workspace.artist_id)
    .eq("subject_type", "artist")
    .eq("is_current", true)
    .in("output_type", ["setup_first_manager_read", "recurring_todays_brief"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (outputError) throw outputError;
  if (!output?.render_json) throw new Error("Completed contextual setup has no persisted Manager brief.");

  return {
    status: "completed",
    phase: "contextualize",
    brief: output.render_json,
    setupMusicReadTargets: await loadSetupMusicReadTargets(db, workspace),
  };
}

async function loadSetupMusicReadTargets(db: any, workspace: any) {
  const [itemsResult, projectsResult, evidenceResult] = await Promise.all([
    db.from("music_items")
      .select("id")
      .eq("account_id", workspace.account_id)
      .eq("artist_workspace_id", workspace.id)
      .eq("artist_id", workspace.artist_id)
      .eq("status", "active")
      .limit(80),
    db.from("music_projects")
      .select("id")
      .eq("account_id", workspace.account_id)
      .eq("artist_workspace_id", workspace.id)
      .eq("artist_id", workspace.artist_id)
      .eq("status", "active")
      .order("released_at", { ascending: false })
      .limit(1),
    db.from("evidence_items")
      .select("source,source_kind,subject_type,subject_id")
      .eq("account_id", workspace.account_id)
      .eq("artist_workspace_id", workspace.id)
      .eq("artist_id", workspace.artist_id)
      .eq("subject_type", "music_item")
      .order("created_at", { ascending: false })
      .limit(240),
  ]);
  if (itemsResult.error) throw itemsResult.error;
  if (projectsResult.error) throw projectsResult.error;
  if (evidenceResult.error) throw evidenceResult.error;

  const itemIds = new Set((itemsResult.data ?? []).map((row: any) => row.id));
  const selectedItemIds: string[] = [];
  for (const row of evidenceResult.data ?? []) {
    const source = String(row.source ?? "").toLowerCase();
    const sourceKind = String(row.source_kind ?? "").toLowerCase();
    if (!row.subject_id || !itemIds.has(row.subject_id) || selectedItemIds.includes(row.subject_id)) continue;
    if (source !== "chartmetric" && sourceKind !== "chartmetric") continue;
    selectedItemIds.push(row.subject_id);
    if (selectedItemIds.length === 5) break;
  }

  return [
    ...(projectsResult.data ?? []).map((row: any) => ({ subjectType: "music_project", subjectId: row.id })),
    ...selectedItemIds.map((subjectId) => ({ subjectType: "music_item", subjectId })),
  ];
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

async function loadCheckoutForSetupRun(db: any, checkoutSessionId: string) {
  const { data, error } = await db
    .from("billing_checkout_sessions")
    .select("*")
    .eq("id", checkoutSessionId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Checkout session was not found for setup run.");
  return data;
}

async function dispatchManagerDiscoveryPhase({
  db,
  supabaseUrl,
  serviceRoleKey,
  checkout,
  workspace,
  setupRun,
  setupStageLeaseToken,
  reuseExistingSnapshots = false,
}: any) {
  scheduleBackgroundTask(invokeFunctionWithRetries({
    supabaseUrl,
    serviceRoleKey,
    functionName: "manager-artist-discovery",
    body: {
      accountId: workspace.account_id,
      artistWorkspaceId: workspace.id,
      artistId: workspace.artist_id,
      spotifyArtistId: checkout.selected_artist.spotifyArtistId,
      artistName: checkout.selected_artist.name,
      setupRunId: setupRun.id,
      checkoutSessionId: checkout.id,
      setupStageLeaseToken,
      reuseExistingSnapshots,
    },
  }).catch(async (error) => {
    const failure = publicWorkflowFailure(error);
    console.error("manager discovery dispatch failed", { error, setupRunId: setupRun.id });
    await recordDiscoveryDispatchFailure(db, checkout, workspace, failure.message).catch(() => undefined);
    await mergeWorkspaceSetupStage(db, {
      setupRunId: setupRun.id,
      stage: "manager_discovery",
      leaseToken: setupStageLeaseToken,
      patch: { status: "failed", error: failure.message, failure, failed_at: new Date().toISOString() },
    }).catch(() => undefined);
  }));
}

async function recordDiscoveryDispatchFailure(db: any, checkout: any, workspace: any, message: string) {
  await db.from("operating_events").insert({
    account_id: workspace.account_id,
    artist_workspace_id: workspace.id,
    artist_id: workspace.artist_id,
    event_type: "manager_artist_discovery_dispatch_failed",
    actor_type: "integration",
    target_type: "artist_workspace",
    target_id: workspace.id,
    summary: message,
    payload: {
      checkout_session_id: checkout.id,
      spotify_artist_id: checkout.selected_artist.spotifyArtistId,
      artist_name: checkout.selected_artist.name,
    },
  });
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

async function updateSetupRun(db: any, id: string, patch: Record<string, unknown>) {
  const { error } = await db.from("workspace_setup_runs").update(patch).eq("id", id);
  if (error) throw error;
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

function readDiscoveryStageError(stages: StageStatus) {
  const stage = stages.manager_discovery;
  return typeof stage === "object" && typeof stage.error === "string" ? stage.error : "";
}

function readDiscoveryStageFailure(stages: StageStatus) {
  const stage = stages.manager_discovery;
  return publicWorkflowFailure(typeof stage === "object" ? stage.failure : undefined);
}

function scheduleBackgroundTask(task: Promise<unknown>) {
  const edgeRuntime = (globalThis as { EdgeRuntime?: { waitUntil?: (task: Promise<unknown>) => void } }).EdgeRuntime;
  if (typeof edgeRuntime?.waitUntil === "function") {
    edgeRuntime.waitUntil(task);
    return;
  }
  void task;
}

function requireEnv(key: string) {
  const value = Deno.env.get(key);
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
