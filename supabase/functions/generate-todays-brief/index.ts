import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  assertNoBannedVisibleTerms,
  assertSignalsHaveEvidenceIds,
  buildTodaysBriefInstructions,
  parseTodaysBriefOutput,
  todaysBriefJsonSchema,
  type ArtistBriefPacket,
  type TodaysBriefOutput,
  type TodaysBriefSignalInput,
} from "../_shared/openaiTodaysBrief.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type GenerateTodaysBriefInput = {
  accountId: string;
  artistWorkspaceId: string;
  artistId: string;
  trigger: "setup" | "manual";
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

    const authHeader = request.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header." }, 401);

    const supabaseUrl = requireEnv("SUPABASE_URL");
    const anonKey = requireEnv("SUPABASE_ANON_KEY");
    const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const isServiceRoleInvocation = authHeader === `Bearer ${serviceRoleKey}`;
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

    const { packet, sourceAudit } = await buildArtistBriefPacket(authClient, input);
    runId = await createManagerSynthesisRun(authClient, input, packet, sourceAudit);
    usageId = await createUsageEvent(authClient, input, runId);
    const output = await callOpenAITodaysBrief(packet);
    const completed = {
      ...output,
      generatedAt: new Date().toISOString(),
      managerSynthesisRunId: runId,
    };
    assertSignalsHaveEvidenceIds(completed);
    assertNoBannedVisibleTerms(completed);
    await completeManagerSynthesisRun(authClient, runId, packet, sourceAudit, completed);
    await completeUsageEvent(authClient, usageId, completed);
    await writeOperatingEventSafe(authClient, input, {
      eventType: input.trigger === "setup" ? "setup_todays_brief_generated" : "setup_todays_brief_refreshed",
      summary: `Generated Today's Brief for ${packet.profile.artistName}.`,
      payload: {
        manager_synthesis_run_id: runId,
        confidence: completed.confidence,
        signal_count: completed.signals.length,
        claimAudit: completed.claimAudit,
      },
    });

    return json({ status: "completed", managerSynthesisRunId: runId, brief: completed });
  } catch (error) {
    if (runId && input) await markRunFailedSafe(runId, input, error);
    if (usageId) await markUsageFailedSafe(usageId, error);
    return json({ error: describeError(error, "Today's Brief generation failed.") }, 500);
  }
});

async function buildArtistBriefPacket(
  supabase: any,
  input: GenerateTodaysBriefInput,
): Promise<{ packet: ArtistBriefPacket; sourceAudit: Array<Record<string, unknown>> }> {
  const [profile, musicItems, musicProjects, evidenceRows, syncRows] = await Promise.all([
    loadArtistProfile(supabase, input),
    loadMusicItems(supabase, input),
    loadMusicProjects(supabase, input),
    loadArtistEvidence(supabase, input),
    loadSourceSyncJobs(supabase, input),
  ]);

  const artistName = readString(profile.display_name) ?? readString(profile.spotify_identity?.name) ?? "the artist";
  const signals = [
    ...rankEvidenceSignals(evidenceRows),
    ...catalogSignals(musicItems, musicProjects),
    ...sourceLimitSignals(evidenceRows, musicItems, musicProjects),
  ].slice(0, 10);
  const sourceLimits = uniqueStrings([
    ...evidenceRows.map((row) => readString(row.limitation)).filter(Boolean),
    ...musicItems.map((row) => readString(row.source_limit)).filter(Boolean),
    ...musicProjects.map((row) => readString(row.source_limit)).filter(Boolean),
    "Private saves, repeat listeners, source-of-stream, revenue, campaign ROI, rights certainty, and conversion need direct saved proof before the Manager can claim them.",
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
    catalog: {
      songCount: musicItems.length,
      projectCount: musicProjects.length,
      albumCount: musicProjects.filter((project) => project.project_type === "album").length,
      latestTitles: latestCatalogTitles(musicItems, musicProjects),
      catalogStatus: syncRows.some((row: Record<string, unknown>) => row.status === "completed" || row.status === "completed_with_limits")
        ? "Imported catalog is available."
        : "Imported catalog is still limited or pending.",
    },
    signals: signals.length ? signals : fallbackSignals(artistName),
    sourceLimits,
    generatedFor: input.trigger,
  };

  return {
    packet,
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

async function callOpenAITodaysBrief(packet: ArtistBriefPacket): Promise<TodaysBriefOutput> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireEnv("OPENAI_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: Deno.env.get("OPENAI_TODAYS_BRIEF_MODEL") || Deno.env.get("OPENAI_SUMMARY_MODEL") || "gpt-5-mini",
      instructions: buildTodaysBriefInstructions(),
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
    throw new Error(`OpenAI Today's Brief request failed with status ${response.status}.`);
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
    .eq("subject_type", "artist")
    .order("created_at", { ascending: false })
    .limit(120);
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
      context_payload: { packet, sourceAudit },
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
) {
  const { error } = await supabase
    .from("manager_synthesis_runs")
    .update({
      status: "completed",
      confidence: output.confidence === "limited" ? "low" : output.confidence,
      context_payload: { packet, sourceAudit },
      action_plan: [output],
      limitations: output.missingProof,
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
      output_tokens: [output.headlineRead, output.artistSnapshot, output.managerRead, output.teamRead, output.todayDirective].join(" ").split(/\s+/).length,
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

function rankEvidenceSignals(rows: EvidenceRow[]): TodaysBriefSignalInput[] {
  return rows
    .map((row) => evidenceSignal(row))
    .filter((signal): signal is TodaysBriefSignalInput & { priority: number } => Boolean(signal))
    .sort((a, b) => b.priority - a.priority)
    .map(({ priority: _priority, ...signal }) => signal);
}

function evidenceSignal(row: EvidenceRow): (TodaysBriefSignalInput & { priority: number }) | null {
  const metricName = row.metric_name ?? row.evidence_type ?? "";
  const value = typeof row.metric_value === "number" ? formatNumber(row.metric_value, row.metric_unit) : undefined;
  if (!metricName && !value) return null;
  const category = signalCategory(row);
  return {
    id: row.id,
    category,
    label: metricLabel(metricName, row.evidence_type),
    value,
    whyItMatters: signalMeaning(category),
    confidence: row.confidence ?? "unknown",
    evidenceIds: [row.id],
    limitation: readString(row.limitation),
    priority: signalPriority(category, metricName),
  };
}

function catalogSignals(items: MusicItemRow[], projects: MusicProjectRow[]): TodaysBriefSignalInput[] {
  if (!items.length && !projects.length) return [];
  const albumCount = projects.filter((project) => project.project_type === "album").length;
  return [
    {
      id: "catalog-summary",
      category: "catalog",
      label: "Imported catalog depth",
      value: `${items.length} songs, ${projects.length} projects${albumCount ? `, ${albumCount} albums` : ""}`,
      whyItMatters: "The Manager can orient around real recorded work instead of an empty setup profile.",
      confidence: "medium",
      evidenceIds: ["catalog-summary"],
    },
  ];
}

function sourceLimitSignals(evidence: EvidenceRow[], items: MusicItemRow[], projects: MusicProjectRow[]): TodaysBriefSignalInput[] {
  const hasLimits = evidence.some((row) => row.limitation) || items.some((row) => row.source_limit) || projects.some((row) => row.source_limit);
  return hasLimits
    ? [
        {
          id: "source-limits",
          category: "source_limit",
          label: "Decision limits",
          value: "Private behavior and conversion proof are still limited.",
          whyItMatters: "The Manager can make a first read while avoiding spend, revenue, and conversion claims that are not proven yet.",
          confidence: "low",
          evidenceIds: ["source-limits"],
        },
      ]
    : [];
}

function fallbackSignals(artistName: string): TodaysBriefSignalInput[] {
  return [
    {
      id: "artist-profile",
      category: "artist_context",
      label: "Saved artist profile",
      value: `${artistName} has a saved setup profile.`,
      whyItMatters: "The Manager has enough identity context to produce a limited first read.",
      confidence: "low",
      evidenceIds: ["artist-profile"],
    },
  ];
}

function signalCategory(row: EvidenceRow): TodaysBriefSignalInput["category"] {
  if (row.evidence_type === "market_rank" || row.evidence_type === "market_metric") return "market";
  if (row.evidence_type === "public_social_metric") return "social_attention";
  if (row.evidence_type === "artist_career_context") return "artist_context";
  if ((row.metric_name ?? "").includes("playlist")) return "playlist";
  if (row.evidence_type === "platform_metric") return "audience";
  return "artist_context";
}

function signalPriority(category: TodaysBriefSignalInput["category"], metricName: string) {
  if (metricName.includes("monthly_listeners")) return 100;
  if (metricName.includes("followers")) return 96;
  if (category === "market") return 92;
  if (category === "playlist") return 88;
  if (category === "social_attention") return 80;
  if (category === "catalog") return 76;
  return 60;
}

function signalMeaning(category: TodaysBriefSignalInput["category"]) {
  switch (category) {
    case "market":
      return "This tells the team where the artist already has a visible audience or home-market position.";
    case "audience":
      return "This gives the Manager a scale read, while still separating public attention from private fan behavior.";
    case "playlist":
      return "This shows surface area around the catalog, but it does not prove saves or conversion by itself.";
    case "social_attention":
      return "This helps explain public attention, but it must be checked against stronger listener behavior before spend decisions.";
    case "source_limit":
      return "This protects the artist from decisions that the current proof cannot support yet.";
    default:
      return "This helps the Manager understand who the artist is right now.";
  }
}

function metricLabel(metricName: string, evidenceType?: string | null) {
  if (metricName.startsWith("chartmetric_country_rank_")) return `Country rank ${titleCase(metricName.replace("chartmetric_country_rank_", ""))}`;
  if (metricName.startsWith("spotify_listener_city_")) return `${titleCase(metricName.replace("spotify_listener_city_", ""))} listener base`;
  if (metricName.includes("monthly_listeners")) return "Monthly listeners";
  if (metricName.includes("followers")) return "Followers";
  if (metricName.includes("playlist_total_reach")) return "Playlist reach";
  if (metricName.includes("playlist_count")) return "Playlist count";
  if (metricName.includes("artist_score")) return "Artist score";
  if (metricName.includes("artist_rank")) return "Artist rank";
  if (metricName.includes("tiktok")) return "Short-form attention";
  if (metricName.includes("youtube")) return "Video audience";
  if (metricName.includes("instagram")) return "Social audience";
  if (metricName.includes("shazam")) return "Discovery activity";
  return titleCase((metricName || evidenceType || "artist context").replace(/[_-]+/g, " "));
}

function formatNumber(value: number, unit?: string | null) {
  const number = value.toLocaleString("en-US");
  if (unit === "rank") return `#${number}`;
  if (!unit || unit === "score") return number;
  return `${number} ${unit}`;
}

function latestCatalogTitles(items: MusicItemRow[], projects: MusicProjectRow[]) {
  return [...projects.map((project) => project.title), ...items.map((item) => item.title)].filter(Boolean).slice(0, 6);
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function describeError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (isRecord(error) && typeof error.message === "string" && error.message.trim()) return error.message.trim();
  return fallback;
}

function requireEnv(key: string) {
  const value = Deno.env.get(key);
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
