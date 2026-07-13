import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const message = error instanceof Error ? error.message : "Paid workspace setup failed.";
    if (db && setupRun && input) await markSetupFailed(db, setupRun, input.phase, message).catch(() => undefined);
    return json({ error: message }, 500);
  }
});

async function isAuthorizedSetupCheckout(db: any, checkout: any) {
  if (checkout.status === "paid") return true;
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

async function runDiscoveryPhase({ db, supabaseUrl, serviceRoleKey, checkout, workspace, setupRun, input = {} }: any) {
  const stages = stageStatus(setupRun.stage_status);
  const existing = stageState(stages, "manager_discovery");
  const catalogState = stageState(stages, "catalog_bootstrap");

  if (["completed", "completed_with_limits"].includes(existing)) {
    return { status: existing, phase: "discovery" };
  }

  if (existing === "failed" && !input.explicitRetry) {
    return { status: "failed", phase: "discovery", error: readDiscoveryStageError(stages) };
  }

  if (catalogState === "running") {
    return { status: "running", phase: "discovery" };
  }

  if (catalogState === "completed" || catalogState === "completed_with_limits") {
    const dispatchFailed = await hasDiscoveryDispatchFailure(db, workspace, stages);
    if (existing === "running" && !dispatchFailed) {
      return { status: "running", phase: "discovery" };
    }

    await dispatchManagerDiscoveryPhase({ db, supabaseUrl, serviceRoleKey, checkout, workspace, setupRun, stages });
    return { status: "running", phase: "discovery" };
  }

  if (setupRun.status === "running" && ["queued", "running"].includes(existing)) {
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

  contextStages = await reconcileCompletedDiscoveryStage(db, workspace, contextStages);
  const discoveryState = stageState(contextStages, "manager_discovery");
  if (discoveryState === "failed") {
    throw new Error(readDiscoveryStageError(contextStages) || "Manager discovery failed. Retry setup after repairing the reported provider error.");
  }
  if (!["completed", "completed_with_limits"].includes(discoveryState)) {
    const catalogState = stageState(contextStages, "catalog_bootstrap");
    if (!["completed", "completed_with_limits"].includes(catalogState)) {
      return recoverCatalogBeforeContextualize({
        db,
        supabaseUrl,
        serviceRoleKey,
        checkout,
        workspace,
        setupRun,
      });
    }
    if (catalogState === "completed" || catalogState === "completed_with_limits") {
      const dispatchFailed = await hasDiscoveryDispatchFailure(db, workspace, contextStages);
      if (discoveryState !== "running" || dispatchFailed) {
        contextStages = await dispatchManagerDiscoveryPhase({ db, supabaseUrl, serviceRoleKey, checkout, workspace, setupRun, stages: contextStages });
      }
    }

    await updateSetupRun(db, setupRun.id, {
      status: "running",
      current_stage: "manager_discovery",
      stage_status: { ...contextStages, setup_brief: { status: "queued" } },
    });
    return { status: "waiting_for_discovery", phase: "contextualize" };
  }

  contextStages = await reconcileCompletedSetupBrief(db, workspace, setupRun, contextStages);
  const setupBriefState = stageState(contextStages, "setup_brief");
  if (setupBriefState === "completed") {
    return loadCompletedSetupResult(db, workspace);
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
      dispatchMusicReads: true,
      setupRunId: setupRun.id,
    },
  });
  if (result?.status !== "completed" || !result.brief) throw new Error("Contextual setup brief did not produce a live Manager read.");

  const completedAt = new Date().toISOString();
  const hasMusicReadTargets = Array.isArray(result.setupMusicReadTargets) && result.setupMusicReadTargets.length > 0;
  await updateSetupRun(db, setupRun.id, {
    status: "completed",
    current_stage: "music_reads",
    stage_status: {
      ...contextStages,
      setup_brief: { status: "completed", started_at: startedAt, completed_at: completedAt },
      music_reads: {
        status: hasMusicReadTargets ? "running" : "completed",
        target_count: Array.isArray(result.setupMusicReadTargets) ? result.setupMusicReadTargets.length : 0,
        targets: Array.isArray(result.setupMusicReadTargets) ? result.setupMusicReadTargets : [],
        started_at: completedAt,
        ...(hasMusicReadTargets ? {} : { completed_at: completedAt }),
      },
    },
    completed_at: completedAt,
    last_error: null,
  });
  return { status: "completed", phase: "contextualize", ...result };
}

async function reconcileCompletedSetupBrief(db: any, workspace: any, setupRun: any, stages: StageStatus) {
  if (stageState(stages, "setup_brief") !== "running") return stages;
  const setupBrief = stages.setup_brief;
  const startedAt = typeof setupBrief === "object" && typeof setupBrief.started_at === "string"
    ? setupBrief.started_at
    : null;
  let query = db.from("manager_outputs")
    .select("created_at")
    .eq("account_id", workspace.account_id)
    .eq("artist_workspace_id", workspace.id)
    .eq("artist_id", workspace.artist_id)
    .eq("output_type", "setup_first_manager_read")
    .eq("is_current", true)
    .order("created_at", { ascending: false })
    .limit(1);
  if (startedAt) query = query.gte("created_at", startedAt);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data?.created_at) return stages;

  const targets = await loadSetupMusicReadTargets(db, workspace);
  const completedStages = {
    ...stages,
    setup_brief: { status: "completed", started_at: startedAt, completed_at: data.created_at },
    music_reads: {
      status: targets.length ? "running" : "completed",
      target_count: targets.length,
      targets,
      started_at: data.created_at,
      ...(targets.length ? {} : { completed_at: data.created_at }),
    },
  };
  await updateSetupRun(db, setupRun.id, {
    status: "completed",
    current_stage: "music_reads",
    stage_status: completedStages,
    completed_at: data.created_at,
    last_error: null,
  });
  return completedStages;
}

async function recoverCatalogBeforeContextualize(args: any) {
  return runDiscoveryPhase(args).then((result) => ({
    ...result,
    status: "waiting_for_catalog",
    phase: "contextualize",
  }));
}

async function reconcileCompletedDiscoveryStage(db: any, workspace: any, stages: StageStatus) {
  if (stageState(stages, "manager_discovery") !== "running") return stages;
  const discoveryStage = stages.manager_discovery;
  const startedAt = typeof discoveryStage === "object" && typeof discoveryStage.started_at === "string"
    ? discoveryStage.started_at
    : null;
  let query = db
    .from("operating_events")
    .select("created_at")
    .eq("artist_workspace_id", workspace.id)
    .eq("event_type", "manager_discovery_completed")
    .order("created_at", { ascending: false })
    .limit(1);
  if (startedAt) query = query.gte("created_at", startedAt);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data?.created_at) return stages;
  return {
    ...stages,
    manager_discovery: { status: "completed", completed_at: data.created_at },
  };
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

async function dispatchManagerDiscoveryPhase({ db, supabaseUrl, serviceRoleKey, checkout, workspace, setupRun, stages }: any) {
  const startedAt = new Date().toISOString();
  const nextStages = {
    ...stages,
    manager_discovery: { status: "running", started_at: startedAt },
  };
  await updateSetupRun(db, setupRun.id, {
    status: "running",
    current_stage: "manager_discovery",
    stage_status: nextStages,
    last_error: null,
  });

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
    },
  }).catch(async (error) => {
    const message = error instanceof Error ? error.message : "Manager artist discovery dispatch failed.";
    await recordDiscoveryDispatchFailure(db, checkout, workspace, message).catch(() => undefined);
    await updateSetupRun(db, setupRun.id, {
      status: "failed",
      current_stage: "manager_discovery",
      stage_status: {
        ...stages,
        manager_discovery: { status: "failed", error: message, failed_at: new Date().toISOString() },
      },
      last_error: message,
      retry_count: Number(setupRun.retry_count ?? 0) + 1,
    }).catch(() => undefined);
  }));

  return nextStages;
}

async function hasDiscoveryDispatchFailure(db: any, workspace: any, stages: StageStatus) {
  const discoveryStage = stages.manager_discovery;
  const startedAt = typeof discoveryStage === "object" && typeof discoveryStage.started_at === "string" ? discoveryStage.started_at : null;
  let query = db
    .from("operating_events")
    .select("id")
    .eq("artist_workspace_id", workspace.id)
    .eq("event_type", "manager_artist_discovery_dispatch_failed")
    .limit(1);
  if (startedAt) {
    query = query.gte("created_at", startedAt);
  }
  const { data, error } = await query;
  if (error) throw error;
  return Array.isArray(data) && data.length > 0;
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

function readDiscoveryStageError(stages: StageStatus) {
  const stage = stages.manager_discovery;
  return typeof stage === "object" && typeof stage.error === "string" ? stage.error : "";
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
