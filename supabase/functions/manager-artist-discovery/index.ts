import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { runManagerAgentLoop } from "../_shared/manager-conversation/agentLoop.ts";
import type { ManagerAgentToolDefinition } from "../_shared/manager-conversation/agentLoop.ts";
import {
  buildDiscoveryActionKey,
  classifyDiscoveryCompletion,
  executeDiscoveryTool,
  freezeDiscoveryTargets,
  selectFrozenRows,
} from "../_shared/manager-agent/discoveryTools.ts";
import { assertActiveWorkspaceEntitlement } from "../_shared/entitlements.ts";
import {
  claimManagerSynthesisRun,
  claimWorkspaceSetupStage,
  finishManagerSynthesisRun,
  heartbeatManagerSynthesisRun,
  heartbeatWorkspaceSetupStage,
  mergeWorkspaceSetupStage,
} from "../_shared/durableWorkflow.ts";
import { publicWorkflowFailure, workflowFailureBody } from "../_shared/workflowErrors.ts";
import { writeWorkspaceEvent } from "../_shared/workspaceEvents.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_DISCOVERY_TOOL_CALLS = 18;

type DiscoveryInput = {
  accountId: string;
  artistWorkspaceId: string;
  artistId: string;
  spotifyArtistId: string;
  artistName: string;
  setupRunId?: string;
  checkoutSessionId?: string;
  reuseExistingSnapshots?: boolean;
  setupStageLeaseToken?: string;
};

const discoveryCompleteSchema = {
  name: "manager_discovery_complete",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["summary", "focusTracksDiscovered", "marketsDiscovered", "strategicPositioning"],
    properties: {
      summary: { type: "string", description: "Brief summary of the onboarding discovery findings." },
      focusTracksDiscovered: { type: "array", items: { type: "string" }, description: "List of focus track names discovered." },
      marketsDiscovered: { type: "array", items: { type: "string" }, description: "Key markets or cities discovered." },
      strategicPositioning: { type: "string", description: "Strategic posture or positioning direction." }
    }
  }
};

const discoveryToolsList: ManagerAgentToolDefinition[] = [
  { type: "web_search" },
  {
    type: "function",
    name: "chartmetric_artist_enrich",
    description: "Enrich the artist profile, fetching Chartmetric stats, fanbase ranks, city affinity data, etc.",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["spotifyArtistId"],
      properties: {
        spotifyArtistId: { type: "string", description: "The Spotify artist ID to enrich" }
      }
    }
  },
  {
    type: "function",
    name: "chartmetric_track_enrich",
    description: "Enrich one catalog track using its internal workspace music item ID. Use only IDs from catalog.tracks[].id.",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["musicItemId"],
      properties: {
        musicItemId: { type: "string", description: "Internal workspace music item ID" }
      }
    }
  },
  {
    type: "function",
    name: "chartmetric_project_enrich",
    description: "Enrich one catalog project using its internal workspace music project ID. Use only IDs from catalog.projects[].id.",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["musicProjectId"],
      properties: {
        musicProjectId: { type: "string", description: "Internal workspace music project ID" }
      }
    }
  },
  {
    type: "function",
    name: "write_strategic_memory",
    description: "Write key strategic insights, home base vs active secondary markets, platform imbalances, and A&R notes to the workspace memory.",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["scope", "kind", "content", "confidence"],
      properties: {
        scope: { type: "string", enum: ["artist", "music_item", "music_project", "mission", "conversation", "task", "checkpoint", "source", "run"], description: "The database memory scope. Use artist for setup-level strategic facts." },
        kind: { type: "string", enum: ["fact", "preference", "constraint", "interpretation", "risk", "rejected_move"], description: "The kind of memory" },
        content: { type: "string", description: "The content of the strategic memory" },
        confidence: { type: "string", enum: ["high", "medium", "low"], description: "Confidence level of this memory" }
      }
    }
  },
  {
    type: "function",
    name: "save_public_evidence",
    description: "Save public context, press mentions, or web links as verified public evidence items.",
    strict: true,
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["url", "title", "claim", "managementUse"],
      properties: {
        url: { type: "string", description: "The URL of the public web page or article" },
        title: { type: "string", description: "Short title or label for the link source" },
        claim: { type: "string", description: "The specific claim or fact verified by this page" },
        managementUse: { type: "string", description: "How this public context should be used for manager strategy" }
      }
    }
  }
];

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  let input: DiscoveryInput | null = null;
  let db: any | null = null;
  let setupStageLeaseToken: string | null = null;
  let synthesisRunId: string | null = null;
  let synthesisLeaseToken: string | null = null;
  try {
    input = (await request.json()) as DiscoveryInput;
    validateInput(input);

    const authHeader = request.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header." }, 401);

    const supabaseUrl = requireEnv("SUPABASE_URL");
    const anonKey = requireEnv("SUPABASE_ANON_KEY");
    const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

    const isServiceRoleInvocation =
      authHeader === `Bearer ${serviceRoleKey}` || readBearerJwtRole(authHeader) === "service_role";
    const scopedAuthHeader = isServiceRoleInvocation ? `Bearer ${serviceRoleKey}` : authHeader;
    const authClient = createClient(supabaseUrl, isServiceRoleInvocation ? serviceRoleKey : anonKey, {
      global: { headers: { Authorization: scopedAuthHeader } },
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

    db = createClient(supabaseUrl, serviceRoleKey);
    if (!isServiceRoleInvocation) {
      await assertActiveWorkspaceEntitlement(db, input);
    }

    setupStageLeaseToken = input.setupStageLeaseToken ?? null;
    if (input.setupRunId && setupStageLeaseToken) {
      const active = await heartbeatWorkspaceSetupStage(db, {
        setupRunId: input.setupRunId,
        stage: "manager_discovery",
        leaseToken: setupStageLeaseToken,
        leaseSeconds: 900,
      });
      if (!active) return json({ status: "running", setupRunId: input.setupRunId });
    } else if (input.setupRunId) {
      const currentState = await loadSetupStageState(db, input.setupRunId, "manager_discovery");
      if (["completed", "completed_with_limits"].includes(currentState)) {
        return json({ status: currentState, setupRunId: input.setupRunId });
      }
      if (currentState === "failed") return json({ status: "failed", setupRunId: input.setupRunId });
      const lease = await claimWorkspaceSetupStage(db, {
        setupRunId: input.setupRunId,
        stage: "manager_discovery",
        expectedStatus: currentState === "not_started" ? "queued" : currentState,
        leaseSeconds: 900,
      });
      if (!lease) return json({ status: "running", setupRunId: input.setupRunId });
      setupStageLeaseToken = lease.token;
    }

    const discoveryRun = await loadOrCreateDiscoveryRun(db, input);
    synthesisRunId = discoveryRun.id;
    if (["completed", "completed_with_limits"].includes(discoveryRun.status)) {
      const replay = readPersistedDiscoveryResult(discoveryRun);
      if (input.setupRunId && setupStageLeaseToken) {
        const setupFinished = await mergeWorkspaceSetupStage(db, {
          setupRunId: input.setupRunId,
          stage: "manager_discovery",
          leaseToken: setupStageLeaseToken,
          patch: {
            status: discoveryRun.status,
            completed_at: new Date().toISOString(),
            limitations: discoveryRun.limitations ?? [],
            next_stage_patch: { status: "queued" },
          },
        });
        if (!setupFinished) throw new Error("Discovery lease expired before replay could be saved.");
      }
      if (input.checkoutSessionId) {
        scheduleBackgroundTask(dispatchContextualizePhase(supabaseUrl, serviceRoleKey, input.checkoutSessionId));
      }
      return json({ status: discoveryRun.status, ...replay, replayed: true });
    }
    if (discoveryRun.status === "failed") {
      return json({ status: "failed", setupRunId: input.setupRunId, synthesisRunId: discoveryRun.id });
    }
    const synthesisLease = await claimManagerSynthesisRun(db, { runId: discoveryRun.id, leaseSeconds: 900 });
    if (!synthesisLease) return json({ status: "running", setupRunId: input.setupRunId, synthesisRunId: discoveryRun.id });
    synthesisLeaseToken = synthesisLease.token;

    await writeOperatingEvent(db, input, "manager_discovery_started", `Started workspace discovery for ${input.artistName}.`, {}, discoveryRun.id);
    const catalogContext = await loadFrozenCatalogContext(db, input, discoveryRun.context_payload);

    // Construct agent system prompt
    const instructions = [
      "You are the artist's senior manager and elite music strategy analyst.",
      "Your objective is to run a thorough autonomous onboarding discovery loop for a newly connected artist.",
      "Use the tools provided to discover narrative positioning, markets, and enrich the key focus assets.",
      "Follow this sequence of steps carefully:",
      "1. Enrich the artist profile using `chartmetric_artist_enrich`.",
      "2. Search the web using `web_search` for recent news, press, interviews, or reviews to discover their narrative/positioning. Save 1-2 key links using `save_public_evidence`.",
      "3. The catalog context is the frozen focus set for this run. Issue the focus-asset enrichment calls together in one turn for every listed focus track and the listed project. Copy internal IDs exactly from `catalog`; never substitute or invent an ID.",
      "4. Write 2-3 strategic memories using `write_strategic_memory`. Always include scope, kind, content, and confidence. Use scope `artist` unless the memory is about one specific music item or project. Detail home market vs secondary lanes, narrative posture, and specific avoid/guardrail rules.",
      "5. Finally, output the completion schema summarizing your discoveries.",
      "",
      "Keep all output clean. Do not expose backend names (like Chartmetric) in your final completion fields."
    ].join("\n");

    const context = {
      artistName: input.artistName,
      spotifyArtistId: input.spotifyArtistId,
      catalog: catalogContext,
      onboardingStage: "discovery"
    };

    // Run the agent loop
    const discoveryToolResults: Array<{ name: string; result: unknown }> = [];
    const result = await runManagerAgentLoop({
      endpoint: "https://api.openai.com/v1/responses",
      apiKey: requireEnv("OPENAI_API_KEY"),
      model: Deno.env.get("OPENAI_MANAGER_REASONING_MODEL") || Deno.env.get("OPENAI_SUMMARY_MODEL") || "gpt-5-mini",
      instructions,
      context,
      tools: discoveryToolsList,
      jsonSchema: discoveryCompleteSchema,
      maxToolCalls: MAX_DISCOVERY_TOOL_CALLS,
      parallelToolCalls: true,
      reasoningEffort: "low",
      beforeModelRequest: () => heartbeatDiscoveryLeases(db, input!, setupStageLeaseToken, discoveryRun.id, synthesisLease.token),
      afterModelRequest: () => heartbeatDiscoveryLeases(db, input!, setupStageLeaseToken, discoveryRun.id, synthesisLease.token),
      executeTool: async (name, args, { callId }) => {
        assertFrozenToolTarget(name, args, discoveryRun.context_payload);
        const toolResult = await executeReplaySafeDiscoveryAction(db, {
          input: input!,
          runId: discoveryRun.id,
          leaseToken: synthesisLease.token,
          name,
          args,
          callId,
          setupStageLeaseToken,
        });
        discoveryToolResults.push({ name, result: toolResult });
        return toolResult;
      },
      onToolEvent: async (event) => {
        // Log tool execution as an operating event to allow streaming setup progress in UI
        await writeOperatingEvent(db, input!, `manager_discovery_tool_${event.status}`, event.summary, {
          tool: event.tool,
          call_id: event.callId,
          status: event.status
        }, discoveryRun.id);
      }
    });

    const failedTools = result.toolTrace.filter((event) => event.status === "failed");
    const completion = classifyDiscoveryCompletion({
      catalogHasAssets: catalogContext.tracks.length > 0 || catalogContext.projects.length > 0,
      toolResults: discoveryToolResults,
      failedTools,
    });
    if (completion.status === "failed") throw new Error(completion.error);
    const discoveryOutput = parseDiscoveryOutput(result.outputText);
    const synthesisFinished = await finishManagerSynthesisRun(db, {
      runId: discoveryRun.id,
      leaseToken: synthesisLease.token,
      status: completion.status,
      steps: [{ discovery: discoveryOutput, toolFailures: completion.limitations }],
      limitations: completion.limitations.map((entry) => `${entry.tool}: ${entry.summary}`),
    });
    if (!synthesisFinished) throw new Error("Discovery run lease expired before completion could be saved.");
    synthesisLeaseToken = null;
    if (input.setupRunId && setupStageLeaseToken) {
      const setupFinished = await mergeWorkspaceSetupStage(db, {
        setupRunId: input.setupRunId,
        stage: "manager_discovery",
        leaseToken: setupStageLeaseToken,
        patch: {
          status: completion.status,
          completed_at: new Date().toISOString(),
          limitations: completion.limitations,
          next_stage_patch: { status: "queued" },
        },
      });
      if (!setupFinished) throw new Error("Discovery lease expired before completion could be saved.");
    }
    const completionEventType = completion.status === "completed_with_limits"
      ? "manager_discovery_completed_with_limits"
      : "manager_discovery_completed";
    await writeOperatingEvent(
      db,
      input,
      completionEventType,
      completion.status === "completed_with_limits"
        ? `Workspace discovery completed for ${input.artistName} with ${completion.limitations.length} limitation${completion.limitations.length === 1 ? "" : "s"}.`
        : `Workspace discovery completed for ${input.artistName}.`,
      { ...discoveryOutput, tool_failures: completion.limitations },
      discoveryRun.id,
    );
    if (input.checkoutSessionId) {
      scheduleBackgroundTask(dispatchContextualizePhase(supabaseUrl, serviceRoleKey, input.checkoutSessionId));
    }

    return json({
      status: completion.status,
      discovery: discoveryOutput,
      toolFailures: completion.limitations,
    });

  } catch (error) {
    const failure = publicWorkflowFailure(error);
    console.error("manager-artist-discovery failed", { error, setupRunId: input?.setupRunId });
    if (input && db) {
      try {
        await writeOperatingEvent(db, input, "manager_discovery_failed", failure.message, { failure }, synthesisRunId ?? undefined);
        if (synthesisRunId && synthesisLeaseToken) {
          await finishManagerSynthesisRun(db, {
            runId: synthesisRunId,
            leaseToken: synthesisLeaseToken,
            status: "failed",
            error: failure.message,
          });
        }
        if (input.setupRunId && setupStageLeaseToken) {
          await mergeWorkspaceSetupStage(db, {
            setupRunId: input.setupRunId,
            stage: "manager_discovery",
            leaseToken: setupStageLeaseToken,
            patch: { status: "failed", error: failure.message, failure, failed_at: new Date().toISOString() },
          });
        }
      } catch { /* best-effort logging */ }
    }
    return json(workflowFailureBody(error), 500);
  }
});

function validateInput(input: DiscoveryInput) {
  for (const [key, value] of [
    ["accountId", input.accountId],
    ["artistWorkspaceId", input.artistWorkspaceId],
    ["artistId", input.artistId],
    ["spotifyArtistId", input.spotifyArtistId],
    ["artistName", input.artistName],
  ]) {
    if (!value?.trim()) throw new Error(`Missing required field: ${key}.`);
  }
}

async function loadSetupStageState(db: any, setupRunId: string, stage: string) {
  const { data, error } = await db.from("workspace_setup_runs").select("stage_status").eq("id", setupRunId).maybeSingle();
  if (error) throw error;
  const stages = data?.stage_status && typeof data.stage_status === "object" ? data.stage_status : {};
  const value = stages[stage];
  return typeof value === "string" ? value : typeof value?.status === "string" ? value.status : "not_started";
}

async function dispatchContextualizePhase(supabaseUrl: string, serviceRoleKey: string, checkoutSessionId: string) {
  const response = await fetch(`${supabaseUrl}/functions/v1/paid-workspace-setup`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ checkoutSessionId, phase: "contextualize" }),
  });
  if (!response.ok) throw new Error(`Contextual setup dispatch failed with ${response.status}.`);
}

function scheduleBackgroundTask(task: Promise<unknown>) {
  const edgeRuntime = (globalThis as { EdgeRuntime?: { waitUntil?: (task: Promise<unknown>) => void } }).EdgeRuntime;
  if (typeof edgeRuntime?.waitUntil === "function") edgeRuntime.waitUntil(task);
  else void task;
}

function readBearerJwtRole(authHeader: string) {
  try {
    const token = authHeader.replace(/^Bearer\s+/i, "");
    return JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")))?.role;
  } catch {
    return undefined;
  }
}

type DiscoveryRunRow = {
  id: string;
  status: string;
  context_payload: Record<string, unknown>;
  steps_payload?: unknown[];
  limitations?: string[];
};

async function loadOrCreateDiscoveryRun(db: any, input: DiscoveryInput): Promise<DiscoveryRunRow> {
  const idempotencyKey = `manager-artist-discovery:${input.setupRunId ?? input.artistWorkspaceId}`;
  const { data: existing, error: existingError } = await db
    .from("manager_synthesis_runs")
    .select("id,status,context_payload,steps_payload,limitations")
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing?.id) {
    if (existing.status === "failed" || existing.status === "cancelled") {
      const { data: reset, error: resetError } = await db
        .from("manager_synthesis_runs")
        .update({
          status: "queued",
          error: null,
          lease_token: null,
        })
        .eq("id", existing.id)
        .select("id,status,context_payload,steps_payload,limitations")
        .single();
      if (!resetError && reset) return reset as DiscoveryRunRow;
    }
    return existing as DiscoveryRunRow;
  }

  const candidates = await loadCatalogCandidates(db, input);
  const contextPayload = freezeDiscoveryTargets(input.setupRunId, candidates.tracks, candidates.projects);
  const { data, error } = await db.from("manager_synthesis_runs").insert({
    account_id: input.accountId,
    artist_workspace_id: input.artistWorkspaceId,
    artist_id: input.artistId,
    trigger_type: "manual",
    status: "queued",
    classification: "manager_artist_discovery_v1",
    context_payload: contextPayload,
    workflow_version: "manager_artist_discovery_v1",
    scope_key: input.setupRunId ?? input.artistWorkspaceId,
    idempotency_key: idempotencyKey,
    input_refs: input.setupRunId ? [{ type: "workspace_setup_run", id: input.setupRunId }] : [],
  }).select("id,status,context_payload,steps_payload,limitations").single();
  if (!error && data) return data as DiscoveryRunRow;
  if ((error as { code?: string } | null)?.code !== "23505") throw error;

  const { data: raced, error: racedError } = await db
    .from("manager_synthesis_runs")
    .select("id,status,context_payload,steps_payload,limitations")
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (racedError) throw racedError;
  if (!raced?.id) throw new Error("Discovery run could not be recovered after concurrent creation.");
  if (raced.status === "failed" || raced.status === "cancelled") {
    const { data: reset, error: resetError } = await db
      .from("manager_synthesis_runs")
      .update({
        status: "queued",
        error: null,
        lease_token: null,
      })
      .eq("id", raced.id)
      .select("id,status,context_payload,steps_payload,limitations")
      .single();
    if (!resetError && reset) return reset as DiscoveryRunRow;
  }
  return raced as DiscoveryRunRow;
}

async function loadCatalogCandidates(db: any, input: DiscoveryInput) {
  const [items, projects] = await Promise.all([
    db.from("music_items")
      .select("id,title,item_type,released_at,metadata")
      .eq("account_id", input.accountId)
      .eq("artist_workspace_id", input.artistWorkspaceId)
      .eq("artist_id", input.artistId)
      .order("released_at", { ascending: false, nullsFirst: false })
      .order("id", { ascending: true })
      .limit(10),
    db.from("music_projects")
      .select("id,title,project_type,released_at,metadata")
      .eq("account_id", input.accountId)
      .eq("artist_workspace_id", input.artistWorkspaceId)
      .eq("artist_id", input.artistId)
      .order("released_at", { ascending: false, nullsFirst: false })
      .order("id", { ascending: true })
      .limit(5)
  ]);
  if (items.error) throw items.error;
  if (projects.error) throw projects.error;
  return { tracks: items.data ?? [], projects: projects.data ?? [] };
}

async function loadFrozenCatalogContext(db: any, input: DiscoveryInput, frozen: Record<string, unknown>) {
  const selectedMusicItemIds = Array.isArray(frozen.selectedMusicItemIds)
    ? frozen.selectedMusicItemIds.filter((id): id is string => typeof id === "string")
    : [];
  const selectedMusicProjectId = typeof frozen.selectedMusicProjectId === "string" ? frozen.selectedMusicProjectId : null;
  const [items, projects] = await Promise.all([
    selectedMusicItemIds.length
      ? db.from("music_items").select("id,title,item_type,released_at,metadata")
        .eq("account_id", input.accountId).eq("artist_workspace_id", input.artistWorkspaceId)
        .eq("artist_id", input.artistId).in("id", selectedMusicItemIds)
      : Promise.resolve({ data: [], error: null }),
    selectedMusicProjectId
      ? db.from("music_projects").select("id,title,project_type,released_at,metadata")
        .eq("account_id", input.accountId).eq("artist_workspace_id", input.artistWorkspaceId)
        .eq("artist_id", input.artistId).eq("id", selectedMusicProjectId)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (items.error) throw items.error;
  if (projects.error) throw projects.error;
  const frozenItems = selectFrozenRows(items.data ?? [], selectedMusicItemIds);

  return {
    tracks: frozenItems.map((t: any) => ({
      id: t.id,
      title: t.title,
      spotifyTrackId: t.metadata?.spotify?.track_id || t.metadata?.spotify_track_id || t.metadata?.id || null,
      isrc: t.metadata?.spotify?.isrc || t.metadata?.external_ids?.isrc || null,
    })),
    projects: (projects.data ?? []).map((p: any) => ({
      id: p.id,
      title: p.title,
      spotifyAlbumId: p.metadata?.spotify?.album_id || p.metadata?.spotify_album_id || p.metadata?.id || null,
      upc: p.metadata?.spotify?.upc || p.metadata?.external_ids?.upc || null,
    }))
  };
}

function readPersistedDiscoveryResult(run: DiscoveryRunRow) {
  const step = Array.isArray(run.steps_payload) && run.steps_payload.length
    ? run.steps_payload[run.steps_payload.length - 1]
    : {};
  return step && typeof step === "object" ? step as Record<string, unknown> : {};
}

async function heartbeatDiscoveryLeases(
  db: any,
  input: DiscoveryInput,
  setupLeaseToken: string | null,
  runId: string,
  runLeaseToken: string,
) {
  const runActive = await heartbeatManagerSynthesisRun(db, { runId, leaseToken: runLeaseToken, leaseSeconds: 900 });
  if (!runActive) throw new Error("Discovery run lease expired.");
  if (input.setupRunId && setupLeaseToken) {
    const setupActive = await heartbeatWorkspaceSetupStage(db, {
      setupRunId: input.setupRunId,
      stage: "manager_discovery",
      leaseToken: setupLeaseToken,
      leaseSeconds: 900,
    });
    if (!setupActive) throw new Error("Discovery setup lease expired.");
  }
}

function assertFrozenToolTarget(name: string, args: Record<string, unknown>, frozen: Record<string, unknown>) {
  if (name === "chartmetric_track_enrich") {
    const allowed = Array.isArray(frozen.selectedMusicItemIds) ? frozen.selectedMusicItemIds : [];
    if (!allowed.includes(args.musicItemId)) throw new Error("Track enrichment target is outside the frozen discovery scope.");
  }
  if (name === "chartmetric_project_enrich" && args.musicProjectId !== frozen.selectedMusicProjectId) {
    throw new Error("Project enrichment target is outside the frozen discovery scope.");
  }
}

async function executeReplaySafeDiscoveryAction(db: any, request: {
  input: DiscoveryInput;
  runId: string;
  leaseToken: string;
  name: string;
  args: Record<string, unknown>;
  callId: string;
  setupStageLeaseToken: string | null;
}) {
  const actionKey = buildDiscoveryActionKey(request.name, request.args);
  let { data: action, error } = await db.from("manager_run_actions")
    .select("id,status,result_payload")
    .eq("manager_synthesis_run_id", request.runId)
    .eq("action_key", actionKey)
    .maybeSingle();
  if (error) throw error;
  if (action?.status === "applied") return action.result_payload;
  if (!action?.id) {
    const inserted = await db.from("manager_run_actions").insert({
      account_id: request.input.accountId,
      artist_workspace_id: request.input.artistWorkspaceId,
      artist_id: request.input.artistId,
      manager_synthesis_run_id: request.runId,
      order_index: 0,
      action_type: request.name,
      action_key: actionKey,
      target_type: discoveryTargetType(request.name),
      target_id: discoveryTargetId(request.name, request.args),
      payload: { args: request.args, first_call_id: request.callId },
    }).select("id,status,result_payload").single();
    if (!inserted.error) action = inserted.data;
    else if ((inserted.error as { code?: string }).code === "23505") {
      const raced = await db.from("manager_run_actions").select("id,status,result_payload")
        .eq("manager_synthesis_run_id", request.runId).eq("action_key", actionKey).maybeSingle();
      if (raced.error) throw raced.error;
      action = raced.data;
    } else throw inserted.error;
  }
  if (!action?.id) throw new Error("Discovery action could not be persisted.");
  if (action.status === "applied") return action.result_payload;

  await heartbeatDiscoveryLeases(db, request.input, request.setupStageLeaseToken, request.runId, request.leaseToken);
  try {
    const result = await executeDiscoveryTool(db, {
      ...request.input,
      reuseExistingSnapshots: true,
      managerRunId: request.runId,
      managerActionId: action.id,
    }, request.name, request.args);
    await heartbeatDiscoveryLeases(db, request.input, request.setupStageLeaseToken, request.runId, request.leaseToken);
    const saved = await db.from("manager_run_actions").update({
      status: "applied",
      result_payload: result,
      error: null,
    }).eq("id", action.id).eq("manager_synthesis_run_id", request.runId).select("id").maybeSingle();
    if (saved.error) throw saved.error;
    if (!saved.data?.id) throw new Error("Discovery action result could not be saved.");
    return result;
  } catch (actionError) {
    const failure = publicWorkflowFailure(actionError);
    await db.from("manager_run_actions").update({ status: "failed", error: failure.message })
      .eq("id", action.id).eq("manager_synthesis_run_id", request.runId);
    throw actionError;
  }
}

function discoveryTargetType(name: string) {
  if (name === "chartmetric_track_enrich") return "music_item";
  if (name === "chartmetric_project_enrich") return "music_project";
  return "artist";
}

function discoveryTargetId(name: string, args: Record<string, unknown>) {
  if (name === "chartmetric_track_enrich") return args.musicItemId;
  if (name === "chartmetric_project_enrich") return args.musicProjectId;
  return null;
}

async function writeOperatingEvent(
  db: any,
  input: DiscoveryInput,
  eventType: string,
  summary: string,
  payload: Record<string, unknown> = {},
  synthesisRunId?: string,
) {
  try {
    await writeWorkspaceEvent(db, {
      accountId: input.accountId,
      artistWorkspaceId: input.artistWorkspaceId,
      artistId: input.artistId,
      eventType,
      summary,
      targetType: "artist_workspace",
      targetId: input.artistWorkspaceId,
      workspaceSetupRunId: input.setupRunId,
      dedupeKey: `${synthesisRunId ?? input.setupRunId ?? input.artistWorkspaceId}:manager_discovery:${eventType}:${String(payload.tool ?? "run")}`,
      displayMode: eventType.includes("_completed") ? "toast" : "activity",
      refreshScope: ["activity", "workspace"],
      payload: { ...payload, manager_synthesis_run_id: synthesisRunId },
    });
  } catch (error) {
    console.warn("Failed to write discovery operating event:", error);
  }
}

function requireEnv(key: string) {
  const value = Deno.env.get(key);
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

function parseDiscoveryOutput(outputText: string) {
  try {
    const parsed = JSON.parse(outputText);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return { summary: outputText };
  }
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
