import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createChartmetricClient } from "../_shared/chartmetricClient.ts";
import type { ChartmetricClient } from "../_shared/chartmetricClient.ts";
import { normalizeChartmetricTrackEvidence } from "../_shared/chartmetricEvidence.ts";
import {
  mergeChartmetricTrackPayload,
  type ChartmetricTrackSupplementals,
} from "../_shared/chartmetricPayload.ts";
import { assertActiveWorkspaceEntitlement } from "../_shared/entitlements.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-chartmetric-backfill-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const chartmetricLimit =
  "Chartmetric track enrichment is third-party provider context. It can support provider-backed track, playlist, chart, and social movement where returned, but it does not prove private Spotify analytics, royalties, campaign ROI, or conversion.";

type TrackEnrichmentInput = {
  accountId: string;
  artistWorkspaceId: string;
  artistId: string;
  musicItemId: string;
  sourceSyncJobId?: string;
  sourceConnectionId?: string;
  chartmetricArtistId?: string;
  chartmetricTrackId?: string;
};

type MusicItemRow = {
  id: string;
  title: string;
  metadata?: Record<string, unknown> | null;
};

type MusicIdentifierRow = {
  identifier_type: string;
  identifier_value: string;
};

type NormalizedIdentifier = {
  identifierType: string;
  identifierValue: string;
};

type QueuedJobContext = {
  sourceSyncJobId?: string;
  sourceConnectionId?: string;
  metadata: Record<string, unknown>;
};

type TrackResolution = {
  id: string | undefined;
  resolvedVia: "provided" | "spotify_track_id" | "isrc" | "none";
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return json({ ok: true });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  let jobId: string | null = null;
  let usageId: string | null = null;
  let requestCount = 0;
  let context: TrackEnrichmentInput | null = null;

  try {
    const input = (await request.json()) as TrackEnrichmentInput;
    validateInput(input);
    context = input;

    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing Authorization header." }, 401);
    }

    const supabaseUrl = requireEnv("SUPABASE_URL");
    const anonKey = requireEnv("SUPABASE_ANON_KEY");
    const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const configuredBackfillToken = Deno.env.get("CHARTMETRIC_BACKFILL_TOKEN");
    const presentedBackfillToken = request.headers.get("X-Chartmetric-Backfill-Token");
    const isServiceRoleInvocation = Boolean(
      configuredBackfillToken &&
      presentedBackfillToken &&
      configuredBackfillToken === presentedBackfillToken
    );
    const scopedAuthHeader = isServiceRoleInvocation ? `Bearer ${serviceRoleKey}` : authHeader;
    const authClient = createClient(supabaseUrl, isServiceRoleInvocation ? serviceRoleKey : anonKey, {
      global: { headers: { Authorization: scopedAuthHeader } },
    });

    if (!isServiceRoleInvocation) {
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
    }

    await assertActiveWorkspaceEntitlement(authClient, input);

    const queuedJob = await loadQueuedJobContext(authClient, input);
    const musicItem = await loadMusicItem(authClient, input);
    const identifiers = await loadIdentifiers(authClient, input);
    const providerId = await getChartmetricProvider(authClient);
    const sourceConnectionId =
      queuedJob.sourceConnectionId ??
      input.sourceConnectionId ??
      (await upsertChartmetricTrackConnection(authClient, input, providerId, musicItem, identifiers));
    jobId = queuedJob.sourceSyncJobId ?? (await createSourceSyncJob(authClient, input, sourceConnectionId));
    await updateSourceSyncJob(authClient, jobId, { status: "running" });
    usageId = await createChartmetricUsageEvent(authClient, input, jobId);

    await writeOperatingEvent(authClient, input, {
      eventType: "chartmetric_track_enrichment_started",
      targetType: "music_item",
      targetId: input.musicItemId,
      sourceType: "source_sync_job",
      sourceId: jobId,
      summary: `Started Chartmetric track enrichment for ${musicItem.title}.`,
    });

    const chartmetric = createChartmetricClient({
      refreshToken: requireEnv("CHARTMETRIC_REFRESH_TOKEN"),
      baseUrl: Deno.env.get("CHARTMETRIC_BASE_URL") || undefined,
    });
    const meteredChartmetric: ChartmetricClient = {
      async requestJson<T>(path: string, init?: RequestInit) {
        requestCount += 1;
        return chartmetric.requestJson<T>(path, init);
      },
    };

    // Step 1: Resolve the Chartmetric track ID via direct identifier lookup endpoints.
    // Priority: explicit override → spotify_track_id → isrc. Never guesses from title search.
    const resolution = await resolveChartmetricTrackId(identifiers, meteredChartmetric, input.chartmetricTrackId);

    if (!resolution.id) {
      const rawRef =
        findIdentifier(identifiers, "spotify_track_id") ??
        findIdentifier(identifiers, "isrc") ??
        input.musicItemId;
      const snapshotId = await writeSourceSnapshot(authClient, input, {
        providerId,
        sourceConnectionId,
        snapshotType: "chartmetric_track_enrichment_unresolved",
        rawRef,
        rawPayload: {
          resolved: false,
          identifiers,
          limitation:
            "No Chartmetric track ID could be resolved from spotify_track_id or isrc. Ensure identifiers are populated for this music item.",
        },
        metadata: {
          provider: "chartmetric",
          snapshot_type: "chartmetric_track_enrichment_unresolved",
          music_item_id: input.musicItemId,
          music_title: musicItem.title,
          identifiers,
          limitation: "No exact Chartmetric track match was found from Spotify track ID or ISRC, so no track evidence was normalized.",
        },
      });
      await updateSourceSyncJob(authClient, jobId, { status: "completed", snapshotIds: [snapshotId] });
      await completeChartmetricUsageEvent(authClient, usageId, requestCount);
      await writeOperatingEvent(authClient, input, {
        eventType: "chartmetric_track_enrichment_unresolved",
        targetType: "music_item",
        targetId: input.musicItemId,
        sourceType: "source_snapshot",
        sourceId: snapshotId,
        summary: `No exact Chartmetric track match was found for ${musicItem.title}.`,
        payload: { snapshot_id: snapshotId, evidence_count: 0, status: "unresolved" },
      });
      return json({
        status: "unresolved",
        sourceSyncJobId: jobId,
        sourceSnapshotId: snapshotId,
        evidenceCount: 0,
      });
    }

    // Step 2: Fetch base track detail from the resolved Chartmetric track ID.
    const detail = await meteredChartmetric.requestJson<Record<string, unknown>>(
      `/api/track/${encodeURIComponent(resolution.id)}`,
    );

    // Step 3: Fetch supplemental intelligence in parallel — streaming stats, playlists, charts, social.
    const supplementals = await fetchTrackSupplementals(resolution.id, meteredChartmetric);

    // Step 4: Merge base detail and supplementals into a single enriched payload for the snapshot.
    const enrichedPayload = mergeChartmetricTrackPayload(detail.data, supplementals);

    const snapshotId = await writeSourceSnapshot(authClient, input, {
      providerId,
      sourceConnectionId,
      snapshotType: "chartmetric_track_enrichment",
      rawRef: resolution.id,
      rawPayload: enrichedPayload,
      metadata: {
        provider: "chartmetric",
        snapshot_type: "chartmetric_track_enrichment",
        music_item_id: input.musicItemId,
        music_title: musicItem.title,
        chartmetric_artist_id: input.chartmetricArtistId,
        chartmetric_track_id: resolution.id,
        resolved_via: resolution.resolvedVia,
        identifiers,
        supplemental_fetch_window: supplementals.fetchWindow,
        supplemental_errors: supplementals.supplementalErrors,
        rate_limit: detail.rateLimit,
      },
    });

    const evidenceItems = normalizeChartmetricTrackEvidence(enrichedPayload, {
      accountId: input.accountId,
      artistWorkspaceId: input.artistWorkspaceId,
      artistId: input.artistId,
      musicItemId: input.musicItemId,
      sourceSnapshotId: snapshotId,
      providerId,
      subjectLabel: musicItem.title,
      rawRef: resolution.id,
    });
    await writeEvidenceItems(authClient, evidenceItems);

    const managerReadResult = await invokeManagerReadGeneration(authHeader, input, {
      subjectType: "music_item",
      subjectId: input.musicItemId,
    }, isServiceRoleInvocation ? configuredBackfillToken : undefined);
    if (managerReadResult.status === "failed") {
      await writeOperatingEvent(authClient, input, {
        eventType: "music_manager_read_handoff_failed",
        targetType: "music_item",
        targetId: input.musicItemId,
        sourceType: "source_snapshot",
        sourceId: snapshotId,
        summary: `Could not generate a Manager Read for ${musicItem.title} after Chartmetric track evidence was stored.`,
        payload: { error: managerReadResult.error },
      });
    }

    const completedStatus =
      Object.keys(supplementals.supplementalErrors).length ||
      evidenceItems.length === 0 ||
      managerReadResult.status === "failed"
        ? "completed_with_limits"
        : "completed";
    await updateSourceSyncJob(authClient, jobId, { status: completedStatus, snapshotIds: [snapshotId] });
    await completeChartmetricUsageEvent(authClient, usageId, requestCount, completedStatus === "completed_with_limits");
    await writeOperatingEvent(authClient, input, {
      eventType: "chartmetric_track_enrichment_completed",
      targetType: "music_item",
      targetId: input.musicItemId,
      sourceType: "source_snapshot",
      sourceId: snapshotId,
      summary: `Stored Chartmetric track enrichment snapshot for ${musicItem.title}.`,
      payload: {
        snapshot_id: snapshotId,
        chartmetric_track_id: resolution.id,
        resolved_via: resolution.resolvedVia,
        evidence_count: evidenceItems.length,
        manager_read_status: managerReadResult.status,
        supplemental_errors: supplementals.supplementalErrors,
        status: completedStatus,
      },
    });

    return json({
      status: completedStatus,
      sourceSyncJobId: jobId,
      sourceSnapshotId: snapshotId,
      evidenceCount: evidenceItems.length,
      managerReadStatus: managerReadResult.status,
      supplementalErrors: supplementals.supplementalErrors,
      rateLimit: detail.rateLimit,
    });
  } catch (error) {
    if (jobId && context) {
      await markFailedSafe(jobId, context, error, usageId, requestCount);
    }
    return json({ error: describeError(error) }, 500);
  }
});

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

/**
 * Resolves a Chartmetric track ID using the platform's direct identifier-lookup
 * endpoints. Priority: explicit override → spotify_track_id → isrc.
 * Falls back to "none" rather than guessing from a title-based text search.
 */
async function resolveChartmetricTrackId(
  identifiers: NormalizedIdentifier[],
  chartmetric: ChartmetricClient,
  chartmetricTrackIdOverride?: string,
): Promise<TrackResolution> {
  if (chartmetricTrackIdOverride?.trim()) {
    return { id: chartmetricTrackIdOverride.trim(), resolvedVia: "provided" };
  }

  const spotifyTrackId = findIdentifier(identifiers, "spotify_track_id");
  if (spotifyTrackId) {
    try {
      const result = await chartmetric.requestJson<Record<string, unknown>>(
        `/api/track/spotify/${encodeURIComponent(spotifyTrackId)}/get-ids`,
      );
      const id = readCmIdFromGetIds(result.data);
      if (id) return { id, resolvedVia: "spotify_track_id" };
    } catch {
      // Fall through to ISRC lookup.
    }
  }

  const isrc = findIdentifier(identifiers, "isrc");
  if (isrc) {
    try {
      const result = await chartmetric.requestJson<Record<string, unknown>>(
        `/api/track/isrc/${encodeURIComponent(isrc)}/get-ids`,
      );
      const id = readCmIdFromGetIds(result.data);
      if (id) return { id, resolvedVia: "isrc" };
    } catch {
      // Fall through to unresolved.
    }
  }

  return { id: undefined, resolvedVia: "none" };
}

/**
 * Reads the Chartmetric entity ID from a get-ids response.
 * Track lookups can return an object or a one-item `obj` array with `chartmetric_ids`.
 */
function readCmIdFromGetIds(payload: unknown): string | undefined {
  if (!isRecord(payload)) return undefined;
  const obj = "obj" in payload ? payload.obj : payload;
  const candidate = Array.isArray(obj) ? obj.find(isRecord) : obj;
  if (!isRecord(candidate)) return undefined;

  const chartmetricIds = Array.isArray(candidate.chartmetric_ids) ? candidate.chartmetric_ids : [];
  const id =
    readNumber(candidate.id) ??
    readString(candidate.id) ??
    readNumber(candidate.cm_track) ??
    readString(candidate.cm_track) ??
    readNumber(candidate.chartmetric_id) ??
    readString(candidate.chartmetric_id) ??
    readNumber(chartmetricIds[0]) ??
    readString(chartmetricIds[0]);
  return id !== undefined ? String(id) : undefined;
}

// ---------------------------------------------------------------------------
// Supplemental fetch
// ---------------------------------------------------------------------------

/**
 * Fetches enriched intelligence from Chartmetric's per-track endpoints in parallel.
 * Uses Promise.allSettled so a 404 or 429 on any one call does not abort the job —
 * the snapshot is stored with whatever data was successfully retrieved.
 */
async function fetchTrackSupplementals(cmTrackId: string, chartmetric: ChartmetricClient): Promise<ChartmetricTrackSupplementals> {
  const until = new Date().toISOString().split("T")[0];
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const timeParams = `since=${since}&until=${until}`;
  const id = encodeURIComponent(cmTrackId);

  const [spotifyStats, tiktokStats, playlistSnapshot, spotifyTopCharts, spotifyViralCharts] = await Promise.allSettled([
    chartmetric.requestJson(`/api/track/${id}/spotify/stats/highest-playcounts?${timeParams}&type=streams`),
    chartmetric.requestJson(`/api/track/${id}/tiktok/stats/most-history?${timeParams}&type=posts`),
    chartmetric.requestJson(`/api/track/${id}/spotify/playlists/snapshot?date=${until}&limit=100`),
    chartmetric.requestJson(`/api/track/${id}/spotify_top_daily/charts?${timeParams}`),
    chartmetric.requestJson(`/api/track/${id}/spotify_viral_daily/charts?${timeParams}`),
  ]);

  const results = { spotifyStats, tiktokStats, playlistSnapshot, spotifyTopCharts, spotifyViralCharts };
  return {
    spotifyStats: settledData(spotifyStats),
    tiktokStats: settledData(tiktokStats),
    playlistSnapshot: settledData(playlistSnapshot),
    spotifyTopCharts: settledData(spotifyTopCharts),
    spotifyViralCharts: settledData(spotifyViralCharts),
    fetchWindow: { since, until },
    supplementalErrors: Object.fromEntries(
      Object.entries(results).flatMap(([key, result]) =>
        result.status === "rejected" ? [[key, describeError(result.reason)]] : []
      ),
    ),
  };
}

function settledData(result: PromiseSettledResult<{ data: unknown }>) {
  return result.status === "fulfilled" ? result.value.data : undefined;
}

function describeError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (isRecord(error)) {
    return readString(error.message) ??
      readString(error.error) ??
      readString(error.details) ??
      "Chartmetric request failed.";
  }
  return "Chartmetric request failed.";
}

// ---------------------------------------------------------------------------
// Data loaders
// ---------------------------------------------------------------------------

async function loadQueuedJobContext(supabase: any, input: TrackEnrichmentInput): Promise<QueuedJobContext> {
  if (!input.sourceSyncJobId) {
    return { sourceConnectionId: input.sourceConnectionId, metadata: {} };
  }

  const { data: job, error } = await supabase
    .from("source_sync_jobs")
    .select("id,source_connection_id,job_type")
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("artist_id", input.artistId)
    .eq("id", input.sourceSyncJobId)
    .maybeSingle();
  if (error) throw error;
  if (!job?.id) throw new Error("Queued Chartmetric track enrichment job was not found.");
  if (job.job_type !== "chartmetric_track_enrichment") {
    throw new Error("Queued job is not a Chartmetric track enrichment job.");
  }

  const sourceConnectionId = job.source_connection_id as string | undefined;
  const connection = sourceConnectionId ? await loadSourceConnection(supabase, input, sourceConnectionId) : null;
  return {
    sourceSyncJobId: job.id as string,
    sourceConnectionId,
    metadata: (connection?.metadata as Record<string, unknown> | undefined) ?? {},
  };
}

async function loadSourceConnection(supabase: any, input: TrackEnrichmentInput, sourceConnectionId: string) {
  const { data, error } = await supabase
    .from("source_connections")
    .select("id,metadata")
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("artist_id", input.artistId)
    .eq("id", sourceConnectionId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function loadMusicItem(supabase: any, input: TrackEnrichmentInput): Promise<MusicItemRow> {
  const { data, error } = await supabase
    .from("music_items")
    .select("id,title,metadata")
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("artist_id", input.artistId)
    .eq("id", input.musicItemId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.id) {
    throw new Error("Music item was not found for Chartmetric enrichment.");
  }
  return data as MusicItemRow;
}

async function loadIdentifiers(supabase: any, input: TrackEnrichmentInput): Promise<NormalizedIdentifier[]> {
  const { data, error } = await supabase
    .from("music_identifiers")
    .select("identifier_type,identifier_value")
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("artist_id", input.artistId)
    .eq("music_item_id", input.musicItemId);
  if (error) throw error;

  return ((data ?? []) as MusicIdentifierRow[]).map((identifier) => ({
    identifierType: identifier.identifier_type,
    identifierValue: identifier.identifier_value,
  }));
}

function findIdentifier(identifiers: NormalizedIdentifier[], identifierType: string) {
  return identifiers.find((identifier) => identifier.identifierType === identifierType)?.identifierValue;
}

// ---------------------------------------------------------------------------
// Provider and connection
// ---------------------------------------------------------------------------

async function getChartmetricProvider(supabase: any) {
  const { data, error } = await supabase.from("source_providers").select("id").eq("provider_key", "chartmetric").maybeSingle();
  if (error) throw error;
  if (data?.id) return data.id as string;

  throw new Error("Chartmetric source provider is not seeded. Run the Chartmetric provider seed migration before enrichment.");
}

async function upsertChartmetricTrackConnection(
  supabase: any,
  input: TrackEnrichmentInput,
  providerId: string,
  musicItem: MusicItemRow,
  identifiers: NormalizedIdentifier[],
) {
  const handleOrExternalRef = input.chartmetricTrackId ?? findIdentifier(identifiers, "spotify_track_id") ?? input.musicItemId;
  const { data: existingRows, error: findError } = await supabase
    .from("source_connections")
    .select("id")
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("provider_id", providerId)
    .eq("handle_or_external_ref", handleOrExternalRef)
    .limit(1);
  if (findError) throw findError;

  const payload = {
    account_id: input.accountId,
    artist_workspace_id: input.artistWorkspaceId,
    artist_id: input.artistId,
    provider_id: providerId,
    handle_or_external_ref: handleOrExternalRef,
    status: "candidate",
    limitations: [chartmetricLimit],
    metadata: {
      music_item_id: input.musicItemId,
      music_title: musicItem.title,
      chartmetric_artist_id: input.chartmetricArtistId,
      chartmetric_track_id: input.chartmetricTrackId,
      identifiers,
    },
  };

  const existingId = (existingRows as Array<{ id?: string }> | null)?.[0]?.id;
  if (existingId) {
    const { error } = await supabase.from("source_connections").update(payload).eq("id", existingId);
    if (error) throw error;
    return existingId;
  }

  const { data, error } = await supabase.from("source_connections").insert(payload).select("id").single();
  if (error) throw error;
  return data.id as string;
}

// ---------------------------------------------------------------------------
// Job and snapshot management
// ---------------------------------------------------------------------------

async function createSourceSyncJob(supabase: any, input: TrackEnrichmentInput, sourceConnectionId: string) {
  const { data, error } = await supabase
    .from("source_sync_jobs")
    .insert({
      account_id: input.accountId,
      artist_workspace_id: input.artistWorkspaceId,
      artist_id: input.artistId,
      source_connection_id: sourceConnectionId,
      job_type: "chartmetric_track_enrichment",
      trigger_type: "manual",
      status: "running",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function writeSourceSnapshot(
  supabase: any,
  input: TrackEnrichmentInput,
  draft: {
    providerId: string;
    sourceConnectionId: string;
    snapshotType: string;
    rawRef: string;
    rawPayload: unknown;
    metadata: Record<string, unknown>;
  },
) {
  const { data, error } = await supabase
    .from("source_snapshots")
    .insert({
      account_id: input.accountId,
      artist_workspace_id: input.artistWorkspaceId,
      artist_id: input.artistId,
      source_connection_id: draft.sourceConnectionId,
      provider_id: draft.providerId,
      source_kind: "third_party_provider",
      snapshot_type: draft.snapshotType,
      raw_ref: draft.rawRef,
      raw_payload: draft.rawPayload,
      metadata: draft.metadata,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function writeEvidenceItems(supabase: any, evidenceItems: Array<Record<string, unknown>>) {
  if (!evidenceItems.length) return;

  const { error } = await supabase.from("evidence_items").insert(evidenceItems);
  if (error) throw error;
}

async function invokeManagerReadGeneration(
  authHeader: string,
  input: TrackEnrichmentInput,
  subject: { subjectType: "music_item"; subjectId: string },
  backfillToken?: string,
) {
  try {
    const response = await fetch(`${requireEnv("SUPABASE_URL")}/functions/v1/generate-music-summary`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
        ...(backfillToken ? { "X-Chartmetric-Backfill-Token": backfillToken } : {}),
      },
      body: JSON.stringify({
        accountId: input.accountId,
        artistWorkspaceId: input.artistWorkspaceId,
        artistId: input.artistId,
        subjectType: subject.subjectType,
        subjectId: subject.subjectId,
      }),
    });
    if (!response.ok) {
      return { status: "failed", error: await response.text() };
    }
    return { status: "completed" };
  } catch (error) {
    return { status: "failed", error: error instanceof Error ? error.message : "Manager Read generation failed." };
  }
}

async function updateSourceSyncJob(
  supabase: any,
  jobId: string,
  patch: { status: "running" | "completed" | "completed_with_limits" | "failed"; snapshotIds?: string[]; error?: string },
) {
  const payload: Record<string, unknown> = {
    status: patch.status,
    error: patch.error,
  };
  if (patch.status === "running") payload.started_at = new Date().toISOString();
  if (patch.status === "completed" || patch.status === "completed_with_limits" || patch.status === "failed") {
    payload.snapshot_ids = patch.snapshotIds ?? [];
    payload.completed_at = new Date().toISOString();
  }
  const { error } = await supabase.from("source_sync_jobs").update(payload).eq("id", jobId);
  if (error) throw error;
}

async function createChartmetricUsageEvent(supabase: any, input: TrackEnrichmentInput, jobId: string) {
  const { data, error } = await supabase
    .from("ai_run_usage_events")
    .insert({
      account_id: input.accountId,
      artist_workspace_id: input.artistWorkspaceId,
      artist_id: input.artistId,
      workflow_key: "music_readiness_run",
      run_type: "source_sync",
      source_sync_job_id: jobId,
      subject_type: "music_item",
      subject_id: input.musicItemId,
      provider: "chartmetric",
      model_or_tool: "chartmetric_api",
      operation_key: "chartmetric_track_enrichment",
      status: "started",
      provider_request_count: 0,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function completeChartmetricUsageEvent(supabase: any, usageId: string, requestCount: number, partial = false) {
  const { error } = await supabase
    .from("ai_run_usage_events")
    .update({
      status: partial ? "partial" : "succeeded",
      provider_request_count: requestCount,
      completed_at: new Date().toISOString(),
    })
    .eq("id", usageId);
  if (error) throw error;
}

async function writeOperatingEvent(
  supabase: any,
  input: TrackEnrichmentInput,
  draft: {
    eventType: string;
    targetType?: string;
    targetId?: string;
    sourceType?: string;
    sourceId?: string;
    summary: string;
    payload?: Record<string, unknown>;
  },
) {
  const { error } = await supabase.from("operating_events").insert({
    account_id: input.accountId,
    artist_workspace_id: input.artistWorkspaceId,
    artist_id: input.artistId,
    event_type: draft.eventType,
    actor_type: "integration",
    target_type: draft.targetType,
    target_id: draft.targetId,
    source_type: draft.sourceType,
    source_id: draft.sourceId,
    summary: draft.summary,
    payload: draft.payload ?? {},
  });
  if (error) throw error;
}

async function markFailedSafe(
  jobId: string,
  input: TrackEnrichmentInput,
  error: unknown,
  usageId: string | null,
  requestCount: number,
) {
  try {
    const supabaseUrl = requireEnv("SUPABASE_URL");
    const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);
    const message = describeError(error);
    await updateSourceSyncJob(serviceClient, jobId, { status: "failed", error: message });
    if (usageId) {
      await serviceClient
        .from("ai_run_usage_events")
        .update({
          status: "failed",
          provider_request_count: requestCount,
          failure_reason: message,
          completed_at: new Date().toISOString(),
        })
        .eq("id", usageId);
    }
    await writeOperatingEvent(serviceClient, input, {
      eventType: "chartmetric_track_enrichment_failed",
      targetType: "music_item",
      targetId: input.musicItemId,
      sourceType: "source_sync_job",
      sourceId: jobId,
      summary: message,
    });
  } catch {
    // Preserve the original error response when failure logging also fails.
  }
}

// ---------------------------------------------------------------------------
// Validation and utilities
// ---------------------------------------------------------------------------

function validateInput(input: TrackEnrichmentInput) {
  const required = [
    ["accountId", input.accountId],
    ["artistWorkspaceId", input.artistWorkspaceId],
    ["artistId", input.artistId],
    ["musicItemId", input.musicItemId],
  ];

  for (const [key, value] of required) {
    if (!value?.trim()) {
      throw new Error(`Missing required field: ${key}.`);
    }
  }
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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
