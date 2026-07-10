import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  assertSignalsHaveEvidenceIds,
  buildTodaysBriefInstructions,
  parseTodaysBriefOutput,
  todaysBriefJsonSchema,
  type ArtistBriefPacket,
  type TodaysBriefPromptMode,
  type TodaysBriefOutput,
  type TodaysBriefDerivedInsight,
  type TodaysBriefMetricInput,
} from "../_shared/openaiTodaysBrief.ts";
import {
  appendManagerEvidenceReads,
  buildTodaysBriefModelPacket,
} from "../_shared/manager-intelligence/brief/briefPacketProjection.ts";
import { buildManagerIntelligencePacket } from "../_shared/manager-intelligence/packet/strategicIntelligencePacket.ts";
import { getPlaybooksInstructions } from "../_shared/manager-intelligence/playbooks/playbookDefinitions.ts";
import type { PlaybookKey } from "../_shared/manager-intelligence/types.ts";
import { assertActiveWorkspaceEntitlement } from "../_shared/entitlements.ts";

declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const OPENAI_TODAYS_BRIEF_RATE_LIMIT_MESSAGE = "OpenAI Today's Brief request failed with status 429";

type GenerateTodaysBriefInput = {
  accountId: string;
  artistWorkspaceId: string;
  artistId: string;
  trigger: "setup" | "manual";
  generationMode?: "operating" | "setup-map";
};

type SetupMusicReadTarget = {
  subjectType: "music_item" | "music_project";
  subjectId: string;
};

type EvidenceRow = {
  id: string;
  source?: string | null;
  source_kind?: string | null;
  evidence_type?: string | null;
  subject_type?: string | null;
  subject_id?: string | null;
  subject_label?: string | null;
  metric_name?: string | null;
  metric_value?: number | null;
  metric_unit?: string | null;
  freshness?: string | null;
  confidence?: "high" | "medium" | "low" | "unknown" | null;
  provenance?: string | null;
  limitation?: string | null;
  raw_ref?: string | null;
};

type MusicItemRow = {
  id: string;
  title: string;
  item_type?: string | null;
  lifecycle_stage?: string | null;
  released_at?: string | null;
  source_limit?: string | null;
};

type MusicProjectRow = {
  id: string;
  title: string;
  project_type?: string | null;
  lifecycle_stage?: string | null;
  released_at?: string | null;
  source_limit?: string | null;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  let runId: string | null = null;
  let usageId: string | null = null;
  let input: GenerateTodaysBriefInput | null = null;

  try {
    input = (await request.json()) as GenerateTodaysBriefInput;
    validateInput(input);
    const generationMode = readGenerationMode(input);

    const authHeader = request.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header." }, 401);

    const supabaseUrl = requireEnv("SUPABASE_URL");
    const anonKey = requireEnv("SUPABASE_ANON_KEY");
    const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const isServiceRoleInvocation =
      authHeader === `Bearer ${serviceRoleKey}` ||
      readBearerJwtRole(authHeader) === "service_role";
    const scopedAuthHeader = isServiceRoleInvocation ? `Bearer ${serviceRoleKey}` : authHeader;
    const authClient = createClient(supabaseUrl, isServiceRoleInvocation ? serviceRoleKey : anonKey, {
      global: { headers: { Authorization: scopedAuthHeader } },
    });

    if (!isServiceRoleInvocation) {
      const {
        data: { user },
        error: userError,
      } = await authClient.auth.getUser();
      if (userError || !user) return json({ error: "Unauthorized." }, 401);

      const { data: membership, error: membershipError } = await authClient.rpc("is_account_member", {
        target_account_id: input.accountId,
      });
      if (membershipError) throw membershipError;
      if (!membership) return json({ error: "Forbidden." }, 403);
    }

    await assertActiveWorkspaceEntitlement(authClient, input);

    const { packet, sourceAudit, managerIntelligencePacket, setupMusicReadTargets } = await buildArtistBriefPacket(authClient, input);
    runId = await createManagerSynthesisRun(authClient, input, packet, sourceAudit, generationMode);
    usageId = await createUsageEvent(authClient, input, runId);
    const managerPacketId = await persistManagerIntelligencePacket(authClient, managerIntelligencePacket, runId);
    await persistManagerPacketEvidenceLinks(authClient, input, runId, managerPacketId, managerIntelligencePacket);
    await persistManagerPacketMemorySeeds(authClient, input, runId, managerPacketId, managerIntelligencePacket);
    const modelPacket = buildTodaysBriefModelPacket(packet, managerIntelligencePacket);
    const appliedPlaybooks = readAppliedPlaybooks(managerIntelligencePacket);
    const playbookLensText = getPlaybooksInstructions(appliedPlaybooks);
    let output = await callOpenAITodaysBriefWithRetry(modelPacket, generationMode, playbookLensText);
    output = appendManagerEvidenceReads(output, managerIntelligencePacket);
    const completed = {
      ...output,
      generatedAt: new Date().toISOString(),
      managerSynthesisRunId: runId,
    };
    assertSignalsHaveEvidenceIds(completed);
    await completeManagerSynthesisRun(authClient, runId, packet, sourceAudit, completed, generationMode);
    const managerOutputId = await persistManagerOutput(authClient, input, runId, managerPacketId, completed);
    await completeUsageEvent(authClient, usageId, completed);
    await writeOperatingEventSafe(authClient, input, {
      eventType: input.trigger === "setup"
        ? "setup_todays_brief_generated"
        : "setup_todays_brief_refreshed",
      summary: `Generated Today's Brief for ${packet.profile.artistName}.`,
      payload: {
        manager_synthesis_run_id: runId,
        manager_intelligence_packet_id: managerPacketId,
        manager_output_id: managerOutputId,
        confidence: completed.confidence,
        intelligence_group_count: completed.intelligenceSnapshot.length,
        generationMode,
        claimAudit: completed.claimAudit,
      },
    });

    if (generationMode === "setup-map" && setupMusicReadTargets.length) {
      dispatchSetupMusicReadsSequentially(supabaseUrl, anonKey, authHeader, input, setupMusicReadTargets);
    }

    return json({
      status: "completed",
      managerSynthesisRunId: runId,
      brief: completed,
      setupMusicReadTargets: generationMode === "setup-map" ? setupMusicReadTargets : [],
    });
  } catch (error) {
    if (runId && input) await markRunFailedSafe(runId, input, error);
    if (usageId) await markUsageFailedSafe(usageId, error);
    return json({ error: describeError(error, "Today's Brief generation failed.") }, 500);
  }
});

async function buildArtistBriefPacket(
  supabase: any,
  input: GenerateTodaysBriefInput,
): Promise<{ packet: ArtistBriefPacket; sourceAudit: Array<Record<string, unknown>>; managerIntelligencePacket: Record<string, unknown>; setupMusicReadTargets: SetupMusicReadTarget[] }> {
  const [profile, musicItems, musicProjects, evidenceRows, syncRows] = await Promise.all([
    loadArtistProfile(supabase, input),
    loadMusicItems(supabase, input),
    loadMusicProjects(supabase, input),
    loadArtistEvidence(supabase, input),
    loadSourceSyncJobs(supabase, input),
  ]);

  const spotifyIdentity = isRecord(profile.spotify_identity) ? profile.spotify_identity : {};
  const artistName = readString(profile.display_name) ?? readString(spotifyIdentity.name) ?? "the artist";
  const metricInputs = evidenceRows
    .map((row) => evidenceMetric(row))
    .filter((metric): metric is TodaysBriefMetricInput & { priority: number } => Boolean(metric))
    .sort((a, b) => b.priority - a.priority)
    .map(({ priority: _priority, ...metric }) => metric);
  const intelligenceSnapshotInputs = buildIntelligenceSnapshotInputs(metricInputs, musicItems, musicProjects, syncRows);
  const derivedInsights = deriveInsightComparisons(metricInputs);
  const sourceLimits = uniqueStrings([
    ...evidenceRows.map((row) => readString(row.limitation)).filter(Boolean),
    ...musicItems.map((row) => readString(row.source_limit)).filter(Boolean),
    ...musicProjects.map((row) => readString(row.source_limit)).filter(Boolean),
    "Revenue, rights certainty, return on spend, and conversion need direct saved proof before the Manager can claim them.",
  ]).slice(0, 8);

  const packet: ArtistBriefPacket = {
    profile: {
      artistName,
      stage: readString(profile.stage),
      homeMarket: readString(profile.home_market),
      genres: Array.isArray(profile.genres) ? profile.genres.filter((item: unknown): item is string => typeof item === "string") : [],
      artistDirection: readString(profile.artist_direction) ?? readString(profile.current_goal),
      budgetContext: readString(profile.budget_context),
      socialHandles: readSocialHandles(profile.social_handles),
    },
    workingCatalog: {
      scopeLabel: "working catalog in view",
      songCount: musicItems.length,
      projectCount: musicProjects.length,
      latestProjectTitles: musicProjects.map((project) => project.title).filter(Boolean).slice(0, 3),
      focusSongTitles: musicItems.map((item) => item.title).filter(Boolean).slice(0, 6),
      note: "This is current music in view for management focus, not a claim about the artist's full discography.",
    },
    intelligenceSnapshotInputs: intelligenceSnapshotInputs.length ? intelligenceSnapshotInputs : fallbackSnapshotInputs(artistName),
    derivedInsights,
    sourceLimits,
    generatedFor: input.trigger,
  };
  const managerIntelligencePacket = buildManagerIntelligencePacket({
    accountId: input.accountId,
    artistWorkspaceId: input.artistWorkspaceId,
    artistId: input.artistId,
    packetType: input.trigger === "setup" ? "setup" : "manual_refresh",
    profile: profile as {
      display_name?: string | null;
      stage?: string | null;
      home_market?: string | null;
      genres?: string[] | null;
      current_goal?: string | null;
      artist_direction?: string | null;
    },
    musicItems,
    musicProjects,
    evidenceRows,
  });

  return {
    packet,
    managerIntelligencePacket,
    setupMusicReadTargets: selectSetupMusicReadTargets(musicItems, musicProjects, evidenceRows),
    sourceAudit: evidenceRows.map((row) => ({
      id: row.id,
      source: row.source,
      source_kind: row.source_kind,
      evidence_type: row.evidence_type,
      metric_name: row.metric_name,
      freshness: row.freshness,
      confidence: row.confidence,
      limitation: row.limitation,
      raw_ref: row.raw_ref,
    })),
  };
}

function selectSetupMusicReadTargets(musicItems: MusicItemRow[], musicProjects: MusicProjectRow[], evidenceRows: EvidenceRow[]): SetupMusicReadTarget[] {
  const musicItemIds = new Set(musicItems.map((item) => item.id).filter(Boolean));
  const chartmetricEnrichedMusicItemIds = selectChartmetricEnrichedMusicItemIds(evidenceRows)
    .filter((subjectId) => musicItemIds.has(subjectId))
    .slice(0, 5);
  return [
    ...musicProjects.slice(0, 1).map((project) => ({ subjectType: "music_project" as const, subjectId: project.id })),
    ...chartmetricEnrichedMusicItemIds.map((subjectId) => ({ subjectType: "music_item" as const, subjectId })),
  ].filter((target) => Boolean(target.subjectId));
}

function selectChartmetricEnrichedMusicItemIds(evidenceRows: EvidenceRow[]): string[] {
  const selected: string[] = [];
  const seen = new Set<string>();
  for (const row of evidenceRows) {
    const subjectId = readString(row.subject_id);
    const sourceKind = readString(row.source_kind)?.toLowerCase();
    const source = readString(row.source)?.toLowerCase();
    if (row.subject_type !== "music_item" || !subjectId || seen.has(subjectId)) continue;
    if (sourceKind !== "chartmetric" && source !== "chartmetric") continue;
    selected.push(subjectId);
    seen.add(subjectId);
  }
  return selected;
}

function dispatchSetupMusicReadsSequentially(
  supabaseUrl: string,
  anonKey: string,
  authHeader: string,
  input: GenerateTodaysBriefInput,
  setupMusicReadTargets: SetupMusicReadTarget[],
) {
  const work = (async () => {
    for (const [index, target] of setupMusicReadTargets.entries()) {
      if (index > 0) await delay(1200);
      await dispatchSetupMusicRead(supabaseUrl, anonKey, authHeader, input, target);
    }
  })().catch((error) => {
    console.warn("setup music Manager Read dispatch failed", {
      message: describeError(error, "Setup music Manager Read dispatch failed."),
    });
  });

  EdgeRuntime.waitUntil(work);
}

async function dispatchSetupMusicRead(
  supabaseUrl: string,
  anonKey: string,
  authHeader: string,
  input: GenerateTodaysBriefInput,
  target: SetupMusicReadTarget,
) {
  const response = await fetch(`${supabaseUrl}/functions/v1/generate-music-summary`, {
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
      subjectType: target.subjectType,
      subjectId: target.subjectId,
    }),
  });
  if (!response.ok) {
    throw new Error(`Setup music Manager Read ${target.subjectType}:${target.subjectId} failed with ${response.status}.`);
  }
}

async function callOpenAITodaysBriefWithRetry(
  packet: unknown,
  generationMode: TodaysBriefPromptMode,
  playbookLensText?: string,
): Promise<TodaysBriefOutput> {
  const maxAttempts = 3;
  let lastError: unknown = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await callOpenAITodaysBrief(packet, generationMode, playbookLensText);
    } catch (error) {
      lastError = error;
      if (!isRetryableOpenAIError(error) || attempt === maxAttempts - 1) throw error;
      await delay(openAiRetryDelayMs(attempt));
    }
  }

  throw lastError ?? new Error("OpenAI Today's Brief request failed.");
}

async function callOpenAITodaysBrief(
  packet: unknown,
  generationMode: TodaysBriefPromptMode,
  playbookLensText?: string,
): Promise<TodaysBriefOutput> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireEnv("OPENAI_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: Deno.env.get("OPENAI_TODAYS_BRIEF_MODEL") || Deno.env.get("OPENAI_SUMMARY_MODEL") || "gpt-5-mini",
      instructions: buildTodaysBriefInstructions(generationMode, playbookLensText),
      input: JSON.stringify(packet),
      text: {
        format: {
          type: "json_schema",
          ...todaysBriefJsonSchema,
        },
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI Today's Brief request failed with status ${response.status}: ${body.slice(0, 500)}`);
  }

  const payload = await response.json();
  return parseTodaysBriefOutput(readOutputText(payload));
}

async function loadArtistProfile(supabase: any, input: GenerateTodaysBriefInput) {
  const { data, error } = await supabase
    .from("artist_profiles")
    .select("display_name,spotify_identity,genres,home_market,stage,current_goal,artist_direction,budget_context,social_handles")
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("artist_id", input.artistId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? {}) as Record<string, unknown>;
}

async function loadMusicItems(supabase: any, input: GenerateTodaysBriefInput): Promise<MusicItemRow[]> {
  const { data, error } = await supabase
    .from("music_items")
    .select("id,title,item_type,lifecycle_stage,released_at,source_limit")
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("artist_id", input.artistId)
    .eq("status", "active")
    .order("released_at", { ascending: false })
    .limit(80);
  if (error) throw error;
  return (data ?? []) as MusicItemRow[];
}

async function loadMusicProjects(supabase: any, input: GenerateTodaysBriefInput): Promise<MusicProjectRow[]> {
  const { data, error } = await supabase
    .from("music_projects")
    .select("id,title,project_type,lifecycle_stage,released_at,source_limit")
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("artist_id", input.artistId)
    .eq("status", "active")
    .order("released_at", { ascending: false })
    .limit(80);
  if (error) throw error;
  return (data ?? []) as MusicProjectRow[];
}

async function loadArtistEvidence(supabase: any, input: GenerateTodaysBriefInput): Promise<EvidenceRow[]> {
  const { data, error } = await supabase
    .from("evidence_items")
    .select("id,source,source_kind,evidence_type,subject_type,subject_id,subject_label,metric_name,metric_value,metric_unit,freshness,confidence,provenance,limitation,raw_ref")
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("artist_id", input.artistId)
    .order("created_at", { ascending: false })
    .limit(240);
  if (error) throw error;
  return (data ?? []) as EvidenceRow[];
}

async function loadSourceSyncJobs(supabase: any, input: GenerateTodaysBriefInput) {
  const { data, error } = await supabase
    .from("source_sync_jobs")
    .select("id,job_type,status,completed_at,error")
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("artist_id", input.artistId)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw error;
  return (data ?? []) as Array<Record<string, unknown>>;
}

async function createManagerSynthesisRun(
  supabase: any,
  input: GenerateTodaysBriefInput,
  packet: ArtistBriefPacket,
  sourceAudit: Array<Record<string, unknown>>,
  generationMode: TodaysBriefPromptMode,
) {
  const { data, error } = await supabase
    .from("manager_synthesis_runs")
    .insert({
      account_id: input.accountId,
      artist_workspace_id: input.artistWorkspaceId,
      artist_id: input.artistId,
      trigger_type: input.trigger === "setup" ? "evidence_triggered" : "manual",
      status: "running",
      classification: "setup_todays_brief_v1",
      context_payload: { packet, sourceAudit, generationMode },
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function completeManagerSynthesisRun(
  supabase: any,
  runId: string,
  packet: ArtistBriefPacket,
  sourceAudit: Array<Record<string, unknown>>,
  output: TodaysBriefOutput,
  generationMode: TodaysBriefPromptMode,
) {
  const { error } = await supabase
    .from("manager_synthesis_runs")
    .update({
      status: "completed",
      confidence: output.confidence === "limited" ? "low" : output.confidence,
      context_payload: { packet, sourceAudit, generationMode },
      action_plan: [output],
      limitations: packet.sourceLimits,
      completed_at: new Date().toISOString(),
    })
    .eq("id", runId);
  if (error) throw error;
}

async function createUsageEvent(supabase: any, input: GenerateTodaysBriefInput, runId: string) {
  const { data, error } = await supabase
    .from("ai_run_usage_events")
    .insert({
      account_id: input.accountId,
      artist_workspace_id: input.artistWorkspaceId,
      artist_id: input.artistId,
      workflow_key: "daily_operating_run",
      run_type: "manager_synthesis",
      manager_synthesis_run_id: runId,
      subject_type: "artist",
      subject_id: input.artistId,
      provider: "openai",
      model_or_tool: Deno.env.get("OPENAI_TODAYS_BRIEF_MODEL") || Deno.env.get("OPENAI_SUMMARY_MODEL") || "gpt-5-mini",
      operation_key: "setup_todays_brief_v1",
      status: "started",
      provider_request_count: 1,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function completeUsageEvent(supabase: any, usageId: string, output: TodaysBriefOutput) {
  const { error } = await supabase
    .from("ai_run_usage_events")
    .update({
      status: "succeeded",
      output_tokens: [
        output.headlineRead,
        output.snapshotSummary,
        output.managerRead,
        output.sourceLine,
        ...output.intelligenceSnapshot.flatMap((group) => [
          group.title,
          group.insight,
          ...group.metrics.flatMap((metric) => [metric.label, metric.value, metric.context ?? ""]),
        ]),
      ].join(" ").split(/\s+/).length,
      completed_at: new Date().toISOString(),
    })
    .eq("id", usageId);
  if (error) throw error;
}

async function writeOperatingEvent(
  supabase: any,
  input: GenerateTodaysBriefInput,
  draft: { eventType: string; summary: string; payload?: Record<string, unknown> },
) {
  const { error } = await supabase.from("operating_events").insert({
    account_id: input.accountId,
    artist_workspace_id: input.artistWorkspaceId,
    artist_id: input.artistId,
    event_type: draft.eventType,
    actor_type: "manager",
    target_type: "artist",
    target_id: input.artistId,
    summary: draft.summary,
    payload: draft.payload ?? {},
  });
  if (error) throw error;
}

async function writeOperatingEventSafe(
  supabase: any,
  input: GenerateTodaysBriefInput,
  draft: { eventType: string; summary: string; payload?: Record<string, unknown> },
) {
  try {
    await writeOperatingEvent(supabase, input, draft);
  } catch (error) {
    console.error("Today's Brief operating event write failed:", describeError(error, "Unknown operating event error."));
  }
}

async function markRunFailedSafe(runId: string, input: GenerateTodaysBriefInput, error: unknown) {
  try {
    const serviceClient = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"));
    const failureMessage = describeError(error, "Today's Brief generation failed.");
    await serviceClient.from("manager_synthesis_runs").update({
      status: "failed",
      error: failureMessage,
      completed_at: new Date().toISOString(),
    }).eq("id", runId);
    await writeOperatingEventSafe(serviceClient, input, {
      eventType: "setup_todays_brief_failed",
      summary: failureMessage,
    });
  } catch {
    // Preserve the original response when failure logging fails.
  }
}

async function markUsageFailedSafe(usageId: string, error: unknown) {
  try {
    const serviceClient = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"));
    await serviceClient.from("ai_run_usage_events").update({
      status: "failed",
      failure_reason: describeError(error, "Today's Brief generation failed."),
      completed_at: new Date().toISOString(),
    }).eq("id", usageId);
  } catch {
    // Preserve the original response when failure logging fails.
  }
}

function evidenceMetric(row: EvidenceRow): (TodaysBriefMetricInput & { priority: number; numericValue?: number }) | null {
  const metricName = row.metric_name ?? row.evidence_type ?? "";
  const value = typeof row.metric_value === "number" ? formatMetricValue(row.metric_value, row.metric_unit) : textMetricValue(row);
  if (!metricName || !value) return null;
  const category = metricCategory(row);
  return {
    id: row.id,
    category,
    subjectType: readString(row.subject_type),
    subjectLabel: readString(row.subject_label),
    label: metricLabel(metricName, row.evidence_type),
    value,
    context: metricContext(row),
    confidence: row.confidence ?? "unknown",
    evidenceIds: [row.id],
    limitation: readString(row.limitation),
    priority: metricPriority(category, metricName, row.subject_type),
    numericValue: typeof row.metric_value === "number" ? row.metric_value : undefined,
  };
}

async function persistManagerIntelligencePacket(supabase: any, packet: Record<string, unknown>, runId: string) {
  const { data, error } = await supabase
    .from("manager_intelligence_packets")
    .insert({
      account_id: packet.account_id,
      artist_workspace_id: packet.artist_workspace_id,
      artist_id: packet.artist_id,
      packet_date: packet.packet_date,
      packet_type: packet.packet_type,
      status: packet.status,
      profile_projection_json: packet.profile_projection_json,
      signal_snapshot_json: packet.signal_snapshot_json,
      data_freshness_json: packet.data_freshness_json,
      executive_read_json: packet.executive_read_json,
      strategic_diagnosis_json: packet.strategic_diagnosis_json,
      kpi_read_json: packet.kpi_read_json,
      signal_map_json: packet.signal_map_json,
      management_insights_json: packet.management_insights_json,
      asset_reads_json: packet.asset_reads_json,
      market_reads_json: packet.market_reads_json,
      domain_reads_json: packet.domain_reads_json,
      public_context_json: packet.public_context_json,
      open_decisions_json: packet.open_decisions_json,
      do_not_do_json: packet.do_not_do_json,
      mission_seed_json: packet.mission_seed_json,
      conversation_memory_seed_json: packet.conversation_memory_seed_json,
      supporting_evidence_json: packet.supporting_evidence_json,
      internal_only_json: packet.internal_only_json,
      schema_version: packet.schema_version,
      created_from_run_id: runId,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function persistManagerPacketEvidenceLinks(
  supabase: any,
  input: GenerateTodaysBriefInput,
  runId: string,
  managerPacketId: string,
  packet: Record<string, unknown>,
) {
  const evidenceIds = readPacketEvidenceIds(packet);
  if (!evidenceIds.length) return;
  const { error } = await supabase.from("evidence_links").insert(
    evidenceIds.map((evidenceId) => ({
      account_id: input.accountId,
      artist_workspace_id: input.artistWorkspaceId,
      artist_id: input.artistId,
      evidence_item_id: evidenceId,
      target_type: "manager_intelligence_packet",
      target_id: managerPacketId,
      usage: "supports_claim",
      claim_text: "Manager Intelligence Packet supporting evidence",
      created_from_run_id: runId,
    })),
  );
  if (error) throw error;
}

async function persistManagerPacketMemorySeeds(
  supabase: any,
  input: GenerateTodaysBriefInput,
  runId: string,
  managerPacketId: string,
  packet: Record<string, unknown>,
) {
  const memorySeed = isRecord(packet.conversation_memory_seed_json) ? packet.conversation_memory_seed_json : {};
  const remember = stringArray(memorySeed.what_manager_should_remember).slice(0, 6).map((content) => ({
    kind: memoryKindForContent(content),
    content,
    reason: "Saved from the Artist Operating Packet because it should shape future Manager decisions.",
    payload: { source: "conversation_memory_seed_json" },
  }));
  const openDecisions = arrayValue(packet.open_decisions_json).slice(0, 6).map((item) => {
    const decision = isRecord(item) ? readString(item.decision) : undefined;
    return decision
      ? {
          kind: "open_question",
          content: decision,
          reason: "Saved because this open decision should affect future Mission Genesis and Manager reads.",
          payload: item,
        }
      : null;
  }).filter(Boolean);
  const rejectedMoves = stringArray(packet.do_not_do_json).slice(0, 6).map((content) => ({
    kind: "rejected_move",
    content,
    reason: "Saved as a do-not-do guardrail from the Artist Operating Packet.",
    payload: { source: "do_not_do_json" },
  }));

  const rows = [...remember, ...openDecisions, ...rejectedMoves].filter((row): row is {
    kind: string;
    content: string;
    reason: string;
    payload: unknown;
  } => Boolean(row?.content?.trim())).slice(0, 16);
  if (!rows.length) return;

  const { error } = await supabase.from("memory_entries").insert(
    rows.map((row) => ({
      account_id: input.accountId,
      artist_workspace_id: input.artistWorkspaceId,
      artist_id: input.artistId,
      scope: "artist",
      kind: row.kind,
      content: row.content,
      source_type: "manager_intelligence_packet",
      source_id: managerPacketId,
      confidence: "medium",
      reason: row.reason,
      payload: row.payload,
      created_from_run_id: runId,
    })),
  );
  if (error) throw error;
}

async function persistManagerOutput(
  supabase: any,
  input: GenerateTodaysBriefInput,
  runId: string,
  managerPacketId: string,
  output: TodaysBriefOutput,
) {
  const outputType = input.trigger === "setup" ? "setup_first_manager_read" : "recurring_todays_brief";
  await retireCurrentManagerOutput(supabase, {
    accountId: input.accountId,
    artistWorkspaceId: input.artistWorkspaceId,
    artistId: input.artistId,
    subjectType: "artist",
    subjectId: input.artistId,
    outputType,
  });

  const { data, error } = await supabase
    .from("manager_outputs")
    .insert({
      account_id: input.accountId,
      artist_workspace_id: input.artistWorkspaceId,
      artist_id: input.artistId,
      source_packet_id: managerPacketId,
      subject_type: "artist",
      subject_id: input.artistId,
      output_type: outputType,
      hero_json: {
        headline: output.headlineRead,
        confidence: {
          level: output.confidence,
          reason: output.sourceLine,
        },
      },
      blocks_json: output.intelligenceSnapshot.map((group, index) => ({
        block_id: `brief_block_${index + 1}`,
        block_type: "signal_stack",
        title: group.title,
        content: group.insight,
        items: group.metrics,
      })),
      summary: output.snapshotSummary,
      primary_recommendation_json: {
        summary: output.managerRead,
      },
      avoid_json: [],
      confidence_json: {
        level: output.confidence,
        reason: output.sourceLine,
      },
      supporting_evidence_json: output.claimAudit,
      render_json: output,
      schema_version: "manager-output-v1",
      created_from_run_id: runId,
      is_current: true,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function retireCurrentManagerOutput(
  supabase: any,
  input: {
    accountId: string;
    artistWorkspaceId: string;
    artistId: string;
    subjectType: string;
    subjectId: string;
    outputType: string;
  },
) {
  const { error } = await supabase
    .from("manager_outputs")
    .update({ is_current: false })
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("artist_id", input.artistId)
    .eq("subject_type", input.subjectType)
    .eq("subject_id", input.subjectId)
    .eq("output_type", input.outputType)
    .eq("is_current", true);
  if (error) throw error;
}

function buildIntelligenceSnapshotInputs(
  metrics: TodaysBriefMetricInput[],
  items: MusicItemRow[],
  projects: MusicProjectRow[],
  syncRows: Array<Record<string, unknown>>,
): ArtistBriefPacket["intelligenceSnapshotInputs"] {
  const groups = [
    metricGroup("Scale", metrics, ["audience_scale", "artist_context"], 5),
    metricGroup("Market Heat", metrics, ["market_heat"], 6),
    metricGroup("Public Reach", metrics, ["public_reach"], 6),
    metricGroup("Playlist / Discovery", metrics, ["playlist", "discovery"], 6),
    metricGroup("Track Momentum", metrics, ["track_momentum"], 6),
    currentMusicGroup(items, projects, syncRows),
  ];
  return groups.filter((group): group is ArtistBriefPacket["intelligenceSnapshotInputs"][number] => Boolean(group?.metrics.length));
}

function metricGroup(
  title: string,
  metrics: TodaysBriefMetricInput[],
  categories: TodaysBriefMetricInput["category"][],
  limit: number,
): ArtistBriefPacket["intelligenceSnapshotInputs"][number] | null {
  const groupMetrics = metrics.filter((metric) => categories.includes(metric.category)).slice(0, limit);
  if (!groupMetrics.length) return null;
  return {
    title,
    metrics: groupMetrics,
    suggestedInsight: suggestedGroupInsight(title, groupMetrics),
  };
}

function currentMusicGroup(
  items: MusicItemRow[],
  projects: MusicProjectRow[],
  syncRows: Array<Record<string, unknown>>,
): ArtistBriefPacket["intelligenceSnapshotInputs"][number] | null {
  if (!items.length && !projects.length) return null;
  const latestProject = projects[0]?.title;
  const focusTitles = items.map((item) => item.title).filter(Boolean).slice(0, 5);
  const connected = syncRows.some((row) => row.status === "completed" || row.status === "completed_with_limits");
  return {
    title: "Current Music In View",
    metrics: [
      {
        id: "current-music-context",
        category: "current_music",
        label: "Working catalog",
        value: workingCatalogValue(items.length, projects.length),
        context: connected ? "current focus" : "setup focus",
        confidence: "medium",
        evidenceIds: ["working-catalog-scope"],
      },
      ...(latestProject
        ? [{
            id: "current-project-context",
            category: "current_music" as const,
            label: "Latest project",
            value: latestProject,
            context: "in view",
            confidence: "medium" as const,
            evidenceIds: ["latest-project-in-view"],
          }]
        : []),
      ...(focusTitles.length
        ? [{
          id: "recent-focus-records",
            category: "current_music" as const,
            label: "Recent records",
            value: `${focusTitles.length} in focus`,
            context: focusTitles.slice(0, 3).join(", "),
            confidence: "medium" as const,
            evidenceIds: ["recent-focus-records"],
          }]
        : []),
    ],
    suggestedInsight: "These are the current records the workspace can organize around first.",
  };
}

function fallbackSnapshotInputs(artistName: string): ArtistBriefPacket["intelligenceSnapshotInputs"] {
  return [
    {
      title: "Artist Intelligence",
      metrics: [
        {
          id: "artist-profile",
          category: "artist_context",
          label: "Artist profile",
          value: artistName,
          context: "saved setup",
          confidence: "low",
          evidenceIds: ["artist-profile"],
        },
      ],
      suggestedInsight: "The saved setup gives the Manager enough identity context to choose the first focus.",
    },
    {
      title: "Current Music In View",
      metrics: [
        {
          id: "current-music-context",
          category: "current_music",
          label: "Working catalog",
          value: "In view",
          context: "current focus",
          confidence: "low",
          evidenceIds: [],
        },
      ],
      suggestedInsight: "The first read should organize the workspace around one practical starting point.",
    },
  ];
}

function deriveInsightComparisons(metrics: Array<TodaysBriefMetricInput & { numericValue?: number }>): TodaysBriefDerivedInsight[] {
  const insights: TodaysBriefDerivedInsight[] = [];
  const markets = metrics
    .filter((metric) => metric.category === "market_heat" && typeof metric.numericValue === "number")
    .sort((a, b) => (b.numericValue ?? 0) - (a.numericValue ?? 0));
  if (markets.length >= 2) {
    const [top, second] = markets;
    const difference = Math.round(((top.numericValue ?? 0) / Math.max(second.numericValue ?? 1, 1) - 1) * 100);
    insights.push({
      label: "Top market gap",
      read: `${top.label} is ${difference}% larger than ${second.label} in this read.`,
      evidenceIds: [...top.evidenceIds, ...second.evidenceIds],
    });
  }
  if (markets.length >= 3) {
    const secondaryTotal = markets.slice(1, 3).reduce((sum, metric) => sum + (metric.numericValue ?? 0), 0);
    insights.push({
      label: "Secondary market weight",
      read: `${markets[1].label} and ${markets[2].label} combine for ${formatCompactNumber(secondaryTotal)} listeners.`,
      evidenceIds: [...markets[1].evidenceIds, ...markets[2].evidenceIds],
    });
  }

  const publicReach = metrics
    .filter((metric) => metric.category === "public_reach" && typeof metric.numericValue === "number")
    .sort((a, b) => (b.numericValue ?? 0) - (a.numericValue ?? 0));
  if (publicReach.length >= 2) {
    const [top, ...rest] = publicReach;
    const restTotal = rest.reduce((sum, metric) => sum + (metric.numericValue ?? 0), 0);
    const comparison = restTotal > 0 && (top.numericValue ?? 0) > restTotal
      ? `${top.label} is larger than the other saved public platforms combined.`
      : `${top.label} is the largest saved public platform in this read.`;
    insights.push({
      label: "Public reach shape",
      read: comparison,
      evidenceIds: [top, ...rest].slice(0, 4).flatMap((metric) => metric.evidenceIds),
    });
  }

  const trackMomentum = metrics.filter((metric) => metric.category === "track_momentum").slice(0, 3);
  if (trackMomentum.length >= 2) {
    insights.push({
      label: "Current record surface area",
      read: `${trackMomentum.map((metric) => metric.subjectLabel ?? metric.label).filter(Boolean).slice(0, 2).join(" and ")} have current saved momentum signals.`,
      evidenceIds: trackMomentum.flatMap((metric) => metric.evidenceIds),
    });
  }

  return insights.slice(0, 5);
}

function metricCategory(row: EvidenceRow): TodaysBriefMetricInput["category"] {
  const metricName = row.metric_name ?? "";
  if (row.evidence_type === "market_rank" || row.evidence_type === "market_metric" || metricName.startsWith("spotify_listener_city_")) return "market_heat";
  if (isPublicReachMetric(metricName)) return "public_reach";
  if (row.subject_type === "music_item" && (metricName.includes("stream") || metricName.includes("tiktok") || metricName.includes("apple_music"))) return "track_momentum";
  if (metricName.includes("playlist")) return "playlist";
  if (metricName.includes("shazam") || metricName.includes("airplay") || row.evidence_type === "chart_position") return "discovery";
  if (metricName.includes("monthly_listeners") || metricName === "spotify_followers" || metricName.includes("popularity") || metricName.includes("pandora") || metricName.includes("deezer")) return "audience_scale";
  if (row.evidence_type === "artist_career_context" || row.evidence_type === "artist_context") return "artist_context";
  return "artist_context";
}

function metricPriority(category: TodaysBriefMetricInput["category"], metricName: string, subjectType?: string | null) {
  if (metricName.includes("monthly_listeners")) return 100;
  if (metricName === "spotify_followers") return 98;
  if (category === "market_heat") return 96;
  if (category === "public_reach") return 90;
  if (category === "track_momentum") return subjectType === "music_item" ? 88 : 82;
  if (category === "playlist") return 86;
  if (category === "discovery") return 82;
  if (category === "artist_context") return 72;
  return 60;
}

function metricLabel(metricName: string, evidenceType?: string | null) {
  if (metricName.startsWith("chartmetric_country_rank_")) return `Country rank ${titleCase(metricName.replace("chartmetric_country_rank_", ""))}`;
  if (metricName.startsWith("spotify_listener_city_")) return titleCase(metricName.replace("spotify_listener_city_", ""));
  if (metricName.includes("monthly_listeners")) return "Monthly listeners";
  if (metricName === "spotify_followers") return "Followers";
  if (metricName === "twitter_followers") return "X";
  if (metricName === "instagram_followers") return "Instagram";
  if (metricName === "tiktok_followers") return "TikTok";
  if (metricName === "youtube_subscribers") return "YouTube";
  if (metricName.includes("playlist_total_reach")) return "Playlist reach";
  if (metricName.includes("playlist_count")) return "Playlist count";
  if (metricName.includes("artist_score")) return "Artist score";
  if (metricName.includes("artist_rank")) return "Artist rank";
  if (metricName.includes("tiktok_top_video")) return "Top TikTok video";
  if (metricName.includes("tiktok_video_creates")) return "TikTok creates";
  if (metricName.includes("tiktok_track_posts")) return "TikTok track posts";
  if (metricName.includes("tiktok_likes")) return "TikTok likes";
  if (metricName.includes("youtube")) return "YouTube";
  if (metricName.includes("instagram")) return "Instagram";
  if (metricName.includes("shazam")) return "Shazams";
  if (metricName.includes("airplay")) return "Airplay";
  if (metricName.includes("spotify_trailing_28d_streams")) return "Last 28 days";
  if (metricName.includes("spotify_peak_day_streams")) return "Peak day";
  if (metricName.includes("spotify_stream_trend")) return "Stream trend";
  if (metricName.includes("apple_music_plays")) return "Apple Music";
  if (metricName === "career_stage") return "Career stage";
  if (metricName === "career_trend") return "Career trend";
  if (metricName === "artist_primary_genre") return "Primary genre";
  if (metricName === "artist_record_label") return "Label context";
  return titleCase((metricName || evidenceType || "artist context").replace(/[_-]+/g, " "));
}

function metricContext(row: EvidenceRow) {
  const unit = row.metric_unit;
  const subject = readString(row.subject_label);
  const window = [readString(row.freshness)].filter(Boolean).join(" ");
  if (unit === "rank") return "artist rank";
  if (row.metric_name?.startsWith("spotify_listener_city_")) return "listeners";
  if (unit === "followers") return "followers";
  if (unit === "listeners") return "listeners";
  if (unit === "streams") return subject ? `${subject}` : "streams";
  if (unit === "views") return "views";
  if (unit === "videos" || unit === "video_creates") return "videos";
  if (unit === "playlists") return "playlists";
  if (unit === "reach") return "reach";
  if (unit === "score") return "score";
  if (unit === "spins") return "spins";
  if (unit === "shazams") return "Shazams";
  return subject || window || "saved signal";
}

function suggestedGroupInsight(title: string, metrics: TodaysBriefMetricInput[]) {
  if (title === "Market Heat" && metrics.length >= 2) return `${metrics[0].label} leads this saved market read; ${metrics[1].label} is the next market to inspect.`;
  if (title === "Public Reach" && metrics.length >= 2) return `${metrics[0].label} is the largest saved public room; compare it against the rest before choosing the first communication lane.`;
  if (title === "Track Momentum" && metrics.length) return `The current music read has record-level movement, so the first focus can be chosen from actual music signals.`;
  if (title === "Playlist / Discovery" && metrics.length) return `Discovery and playlist surface area can show where music is already travelling.`;
  return `${title} gives the Manager a stronger first read than a generic setup profile.`;
}

function textMetricValue(row: EvidenceRow) {
  const rawRef = readString(row.raw_ref);
  if (!rawRef) return undefined;
  const value = rawRef.split(":").pop()?.trim();
  return value && !value.includes("_") ? value : undefined;
}

function formatMetricValue(value: number, unit?: string | null) {
  if (unit === "rank") return `#${value.toLocaleString("en-US")}`;
  if (unit === "score" || unit === "percent_change") return `${value.toLocaleString("en-US")}${unit === "percent_change" ? "%" : ""}`;
  return formatCompactNumber(value);
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: value >= 1_000_000 ? 1 : 0,
  }).format(value);
}

function workingCatalogValue(itemCount: number, projectCount: number) {
  if (projectCount && itemCount) return `Latest project + ${itemCount} songs`;
  if (projectCount) return `${projectCount} project${projectCount === 1 ? "" : "s"} in view`;
  return `${itemCount} song${itemCount === 1 ? "" : "s"} in view`;
}

function isPublicReachMetric(metricName: string) {
  return [
    "instagram_",
    "tiktok_",
    "twitter_",
    "youtube_",
    "genius_",
  ].some((prefix) => metricName.startsWith(prefix));
}

function readSocialHandles(value: unknown) {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([, item]) => typeof item === "string" && Boolean(item.trim()))) as Record<string, string>;
}

function readOutputText(payload: unknown) {
  const output = isRecord(payload) && Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    if (!isRecord(item) || !Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if (isRecord(content) && typeof content.text === "string") return content.text;
    }
  }
  if (isRecord(payload) && typeof payload.output_text === "string") return payload.output_text;
  throw new Error("OpenAI response did not include structured output text.");
}

function readPacketEvidenceIds(packet: Record<string, unknown>) {
  const evidence = Array.isArray(packet.supporting_evidence_json) ? packet.supporting_evidence_json : [];
  return Array.from(new Set(
    evidence
      .map((item) => (isRecord(item) && typeof item.id === "string" ? item.id : undefined))
      .filter((id): id is string => Boolean(id)),
  ));
}

function validateInput(input: GenerateTodaysBriefInput) {
  for (const [key, value] of Object.entries({
    accountId: input.accountId,
    artistWorkspaceId: input.artistWorkspaceId,
    artistId: input.artistId,
  })) {
    if (typeof value !== "string" || !value.trim()) throw new Error(`Missing required field: ${key}.`);
  }
  if (input.trigger !== "setup" && input.trigger !== "manual") {
    throw new Error("trigger must be setup or manual.");
  }
  if (
    input.generationMode !== undefined &&
    input.generationMode !== "operating" &&
    input.generationMode !== "setup-map"
  ) {
    throw new Error("generationMode must be operating or setup-map.");
  }
}

function readGenerationMode(input: GenerateTodaysBriefInput): TodaysBriefPromptMode {
  if (input.generationMode === "setup-map" || input.generationMode === "operating") return input.generationMode;
  return input.trigger === "setup" ? "setup-map" : "operating";
}

function readBearerJwtRole(authHeader: string) {
  const token = authHeader.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return undefined;
  const [, encodedPayload] = token.split(".");
  if (!encodedPayload) return undefined;

  try {
    const payload = JSON.parse(decodeBase64Url(encodedPayload));
    return isRecord(payload) && typeof payload.role === "string" ? payload.role : undefined;
  } catch {
    return undefined;
  }
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return atob(padded);
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function titleCase(value: string) {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function uniqueStrings(values: Array<string | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value?.trim()))));
}

function arrayValue(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim()) : [];
}

function memoryKindForContent(content: string) {
  if (/avoid|do not|never|reject/i.test(content)) return "rejected_move";
  if (/block|risk|uncertain|missing/i.test(content)) return "risk";
  if (/priority|direction|goal|thesis|market|catalog|positioning/i.test(content)) return "interpretation";
  return "fact";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function describeError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (isRecord(error) && typeof error.message === "string" && error.message.trim()) return error.message.trim();
  return fallback;
}

function isRetryableOpenAIError(error: unknown) {
  const message = describeError(error, "");
  const status = Number(message.match(/\bstatus\s+(\d{3})\b/i)?.[1]);
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504 || /too much compute/i.test(message);
}

function openAiRetryDelayMs(attempt: number) {
  return [1000, 2500, 5000][attempt] ?? 5000;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requireEnv(key: string) {
  const value = Deno.env.get(key);
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

function readAppliedPlaybooks(managerIntelligencePacket: Record<string, unknown>): PlaybookKey[] {
  const internalOnly = isRecord(managerIntelligencePacket?.internal_only_json) ? managerIntelligencePacket.internal_only_json : {};
  const applied = internalOnly.playbooks_applied;
  if (!Array.isArray(applied)) return [];
  return applied.filter((item): item is PlaybookKey => typeof item === "string" && Boolean(item.trim()));
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
