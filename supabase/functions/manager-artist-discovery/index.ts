import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { runManagerAgentLoop } from "../_shared/manager-conversation/agentLoop.ts";
import type { ManagerAgentToolDefinition } from "../_shared/manager-conversation/agentLoop.ts";
import { executeDiscoveryTool } from "../_shared/manager-agent/discoveryTools.ts";
import { assertActiveWorkspaceEntitlement } from "../_shared/entitlements.ts";

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

    const db = createClient(supabaseUrl, serviceRoleKey);
    if (!isServiceRoleInvocation) {
      await assertActiveWorkspaceEntitlement(db, input);
    }

    // Write starting operating event
    await writeOperatingEvent(db, input, "manager_discovery_started", `Started autonomous onboarding discovery loop for ${input.artistName}.`);

    // Load bootstrapped catalog context to pass to agent
    const catalogContext = await loadCatalogContext(db, input);

    // Construct agent system prompt
    const instructions = [
      "You are the artist's senior manager and elite music strategy analyst.",
      "Your objective is to run a thorough autonomous onboarding discovery loop for a newly connected artist.",
      "Use the tools provided to discover narrative positioning, markets, and enrich the key focus assets.",
      "Follow this sequence of steps carefully:",
      "1. Enrich the artist profile using `chartmetric_artist_enrich`.",
      "2. Search the web using `web_search` for recent news, press, interviews, or reviews to discover their narrative/positioning. Save 1-2 key links using `save_public_evidence`.",
      "3. Look at the catalog context provided. Select up to 5 focus tracks and 1 project, starting with the most popular/relevant. For tracks, call `chartmetric_track_enrich` with `musicItemId` copied exactly from `catalog.tracks[].id`. For projects, call `chartmetric_project_enrich` with `musicProjectId` copied exactly from `catalog.projects[].id`. Never call these tools without the internal ID.",
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
      executeTool: async (name, args) => {
        const toolResult = await executeDiscoveryTool(db, input!, name, args);
        discoveryToolResults.push({ name, result: toolResult });
        return toolResult;
      },
      onToolEvent: async (event) => {
        // Log tool execution as an operating event to allow streaming setup progress in UI
        await writeOperatingEvent(db, input!, `manager_discovery_tool_${event.status}`, event.summary, {
          tool: event.tool,
          call_id: event.callId,
          status: event.status
        });
      }
    });

    const failedTools = result.toolTrace.filter((event) => event.status === "failed");
    assertRequiredDiscoveryCompleted(catalogContext, discoveryToolResults, failedTools);
    const discoveryOutput = parseDiscoveryOutput(result.outputText);
    if (failedTools.length) {
      await writeOperatingEvent(
        db,
        input,
        "manager_discovery_completed_with_limits",
        `Autonomous onboarding discovery completed for ${input.artistName} with ${failedTools.length} tool limitation${failedTools.length === 1 ? "" : "s"}.`,
        {
          ...discoveryOutput,
          tool_failures: failedTools.map((event) => ({
            tool: event.tool,
            summary: event.summary,
          })),
        },
      );
    }

    // Write completion operating event
    await writeOperatingEvent(db, input, "manager_discovery_completed", `Autonomous onboarding discovery completed for ${input.artistName}.`, discoveryOutput);

    if (input.setupRunId) {
      await completeDiscoverySetupStage(db, input.setupRunId, failedTools.length > 0);
    }
    if (input.checkoutSessionId) {
      scheduleBackgroundTask(dispatchContextualizePhase(supabaseUrl, serviceRoleKey, input.checkoutSessionId));
    }

    return json({
      status: "completed",
      discovery: discoveryOutput,
      toolFailures: failedTools.map((event) => ({ tool: event.tool, summary: event.summary })),
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : "Autonomous artist discovery failed.";
    console.error("manager-artist-discovery failed", { message, error });
    if (input) {
      try {
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        if (serviceRoleKey && supabaseUrl) {
          const failDb = createClient(supabaseUrl, serviceRoleKey);
          await writeOperatingEvent(failDb, input, "manager_discovery_failed", `Autonomous onboarding discovery failed: ${message}`);
          if (input.setupRunId) await failDiscoverySetupStage(failDb, input.setupRunId, message);
        }
      } catch { /* best-effort logging */ }
    }
    return json({ error: message }, 500);
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

function assertRequiredDiscoveryCompleted(
  catalog: { tracks: unknown[]; projects: unknown[] },
  toolResults: Array<{ name: string; result: unknown }>,
  failedTools: Array<{ tool: string; summary: string }>,
) {
  const artistResult = toolResults.find(({ name }) => name === "chartmetric_artist_enrich")?.result as Record<string, unknown> | undefined;
  if (!artistResult || artistResult.status === "unresolved" || failedTools.some(({ tool }) => tool === "chartmetric_artist_enrich")) {
    throw new Error("Required artist intelligence failed; discovery cannot complete without provider-backed artist enrichment.");
  }

  const assetResults = toolResults.filter(({ name }) => name === "chartmetric_track_enrich" || name === "chartmetric_project_enrich");
  const catalogHasAssets = catalog.tracks.length > 0 || catalog.projects.length > 0;
  if (catalogHasAssets && (!assetResults.length || assetResults.some(({ result }) => (result as Record<string, unknown>)?.status === "unresolved"))) {
    throw new Error("Required focus-asset intelligence failed; discovery cannot complete with unmatched catalog assets.");
  }
}

async function completeDiscoverySetupStage(db: any, setupRunId: string, limited: boolean) {
  const { data: run, error } = await db.from("workspace_setup_runs").select("stage_status").eq("id", setupRunId).maybeSingle();
  if (error) throw error;
  const stages = run?.stage_status && typeof run.stage_status === "object" ? run.stage_status : {};
  const now = new Date().toISOString();
  const { error: updateError } = await db.from("workspace_setup_runs").update({
    status: "running",
    current_stage: "setup_brief",
    stage_status: {
      ...stages,
      manager_discovery: { status: limited ? "completed_with_limits" : "completed", completed_at: now },
      setup_brief: { status: "waiting_for_context" },
    },
    last_error: null,
  }).eq("id", setupRunId);
  if (updateError) throw updateError;
}

async function failDiscoverySetupStage(db: any, setupRunId: string, message: string) {
  const { data: run } = await db.from("workspace_setup_runs").select("stage_status,retry_count").eq("id", setupRunId).maybeSingle();
  const stages = run?.stage_status && typeof run.stage_status === "object" ? run.stage_status : {};
  await db.from("workspace_setup_runs").update({
    status: "failed",
    current_stage: "manager_discovery",
    stage_status: { ...stages, manager_discovery: { status: "failed", error: message, failed_at: new Date().toISOString() } },
    last_error: message,
    retry_count: Number(run?.retry_count ?? 0) + 1,
  }).eq("id", setupRunId);
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

async function loadCatalogContext(db: any, input: DiscoveryInput) {
  const [items, projects] = await Promise.all([
    db.from("music_items")
      .select("id,title,item_type,released_at,metadata")
      .eq("account_id", input.accountId)
      .eq("artist_workspace_id", input.artistWorkspaceId)
      .eq("artist_id", input.artistId)
      .limit(10),
    db.from("music_projects")
      .select("id,title,project_type,released_at,metadata")
      .eq("account_id", input.accountId)
      .eq("artist_workspace_id", input.artistWorkspaceId)
      .eq("artist_id", input.artistId)
      .limit(5)
  ]);

  return {
    tracks: (items.data ?? []).map((t: any) => ({
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

async function writeOperatingEvent(
  db: any,
  input: DiscoveryInput,
  eventType: string,
  summary: string,
  payload: Record<string, unknown> = {}
) {
  const { error } = await db.from("operating_events").insert({
    account_id: input.accountId,
    artist_workspace_id: input.artistWorkspaceId,
    artist_id: input.artistId,
    event_type: eventType,
    actor_type: "integration",
    target_type: "artist_workspace",
    target_id: input.artistWorkspaceId,
    summary,
    payload,
  });
  if (error) {
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
