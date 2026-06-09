import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createChartmetricClient } from "../_shared/chartmetricClient.ts";
import type { ChartmetricClient } from "../_shared/chartmetricClient.ts";
import { normalizeChartmetricProjectEvidence } from "../_shared/chartmetricEvidence.ts";
import {
  mergeChartmetricProjectPayload,
  type ChartmetricProjectSupplementals,
} from "../_shared/chartmetricProjectPayload.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const chartmetricLimit =
  "Chartmetric project enrichment is third-party release intelligence. Streams and platform metrics are allowed when Chartmetric returns them and must be labeled as Chartmetric-sourced; rights, royalties, ROI, and conversion need stronger evidence.";

type ProjectEnrichmentInput = {
  accountId: string;
  artistWorkspaceId: string;
  artistId: string;
  musicProjectId: string;
  sourceSyncJobId?: string;
  sourceConnectionId?: string;
  chartmetricProjectId?: string;
};

type QueuedJobContext = {
  sourceSyncJobId?: string;
  sourceConnectionId?: string;
  metadata: Record<string, unknown>;
};

type MusicProjectRow = {
  id: string;
  title: string;
  project_type?: string | null;
  metadata?: Record<string, unknown> | null;
};

type MusicIdentifierRow = {
  identifier_type: string;
  identifier_value: string;
};

type ProjectTrackRow = {
  music_item_id: string;
  display_title?: string | null;
  order_index?: number | null;
};

type NormalizedIdentifier = {
  identifierType: string;
  identifierValue: string;
};

type ProjectResolution = {
  id: string | undefined;
  resolvedVia: "provided" | "spotify_album_id" | "upc" | "none";
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return json({ ok: true });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  let jobId: string | null = null;
  let context: ProjectEnrichmentInput | null = null;

  try {
    const input = (await request.json()) as ProjectEnrichmentInput;
    validateInput(input);
    context = input;

    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing Authorization header." }, 401);
    }

    const supabaseUrl = requireEnv("SUPABASE_URL");
    const anonKey = requireEnv("SUPABASE_ANON_KEY");
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

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

    if (membershipError) throw membershipError;
    if (!membership) return json({ error: "Forbidden." }, 403);

    const queuedJob = await loadQueuedJobContext(authClient, input);
    const musicProject = await loadMusicProject(authClient, input);
    const identifiers = await loadProjectIdentifiers(authClient, input);
    const tracklist = await loadProjectTracklist(authClient, input);
    const providerId = await getChartmetricProvider(authClient);
    const sourceConnectionId =
      queuedJob.sourceConnectionId ??
      input.sourceConnectionId ??
      (await createChartmetricProjectConnection(authClient, input, providerId, musicProject, identifiers));

    jobId =
      queuedJob.sourceSyncJobId ??
      (await createSourceSyncJob(authClient, input, sourceConnectionId, "manual"));

    await updateSourceSyncJob(authClient, jobId, { status: "running" });
    await writeOperatingEvent(authClient, input, {
      eventType: "chartmetric_project_enrichment_started",
      targetType: "music_project",
      targetId: input.musicProjectId,
      sourceType: "source_sync_job",
      sourceId: jobId,
      summary: `Started Chartmetric project enrichment for ${musicProject.title}.`,
    });

    const chartmetric = createChartmetricClient({
      refreshToken: requireEnv("CHARTMETRIC_REFRESH_TOKEN"),
      baseUrl: Deno.env.get("CHARTMETRIC_BASE_URL") || undefined,
    });

    // Step 1: Resolve the Chartmetric album ID via direct identifier lookup.
    // Priority: explicit override → spotify_album_id → upc. Avoids guessing from title search.
    const chartmetricProjectIdFromJob = readString(queuedJob.metadata.chartmetric_project_id);
    const resolution = await resolveChartmetricProjectId(
      identifiers,
      chartmetric,
      input.chartmetricProjectId ?? chartmetricProjectIdFromJob,
    );

    if (!resolution.id) {
      const rawRef =
        findIdentifier(identifiers, "spotify_album_id") ??
        findIdentifier(identifiers, "upc") ??
        input.musicProjectId;
      const snapshotId = await writeSourceSnapshot(authClient, input, {
        providerId,
        sourceConnectionId,
        snapshotType: "chartmetric_project_enrichment_unresolved",
        rawRef,
        rawPayload: {
          resolved: false,
          identifiers,
          tracklist,
          limitation:
            "No Chartmetric album ID could be resolved from spotify_album_id or upc. Ensure identifiers are populated for this project.",
        },
        metadata: {
          provider: "chartmetric",
          snapshot_type: "chartmetric_project_enrichment_unresolved",
          music_project_id: input.musicProjectId,
          project_title: musicProject.title,
          project_type: musicProject.project_type,
          identifiers,
          tracklist,
          limitation: "No exact Chartmetric project match was found from Spotify album ID or UPC, so no project evidence was normalized.",
        },
      });
      await updateSourceSyncJob(authClient, jobId, { status: "completed", snapshotIds: [snapshotId] });
      await writeOperatingEvent(authClient, input, {
        eventType: "chartmetric_project_enrichment_unresolved",
        targetType: "music_project",
        targetId: input.musicProjectId,
        sourceType: "source_snapshot",
        sourceId: snapshotId,
        summary: `No exact Chartmetric project match was found for ${musicProject.title}.`,
        payload: { snapshot_id: snapshotId, evidence_count: 0, track_count: tracklist.length, status: "unresolved" },
      });
      return json({
        status: "unresolved",
        sourceSyncJobId: jobId,
        sourceSnapshotId: snapshotId,
        evidenceCount: 0,
      });
    }

    // Step 2: Fetch base album detail from the resolved Chartmetric album ID.
    const detail = await chartmetric.requestJson<Record<string, unknown>>(
      `/api/album/${encodeURIComponent(resolution.id)}`,
    );

    // Step 3: Fetch supplemental intelligence in parallel — streaming stats and playlist placements.
    const supplementals = await fetchProjectSupplementals(resolution.id, chartmetric);

    // Step 4: Merge base detail and supplementals into a single enriched payload.
    const enrichedPayload = mergeChartmetricProjectPayload(detail.data, supplementals);

    const rawRef = resolution.id;
    const snapshotId = await writeSourceSnapshot(authClient, input, {
      providerId,
      sourceConnectionId,
      snapshotType: "chartmetric_project_enrichment",
      rawRef,
      rawPayload: enrichedPayload,
      metadata: {
        provider: "chartmetric",
        snapshot_type: "chartmetric_project_enrichment",
        music_project_id: input.musicProjectId,
        project_title: musicProject.title,
        project_type: musicProject.project_type,
        chartmetric_project_id: resolution.id,
        resolved_via: resolution.resolvedVia,
        identifiers,
        tracklist,
        supplemental_fetch_window: supplementals.fetchWindow,
        supplemental_errors: supplementals.supplementalErrors,
        rate_limit: detail.rateLimit,
      },
    });

    const evidenceItems = normalizeChartmetricProjectEvidence(enrichedPayload, {
      accountId: input.accountId,
      artistWorkspaceId: input.artistWorkspaceId,
      artistId: input.artistId,
      musicProjectId: input.musicProjectId,
      sourceSnapshotId: snapshotId,
      providerId,
      subjectLabel: musicProject.title,
      rawRef,
    });
    await writeEvidenceItems(authClient, evidenceItems);

    const managerReadResult = await invokeManagerReadGeneration(authHeader, input, {
      subjectType: "music_project",
      subjectId: input.musicProjectId,
    });
    if (managerReadResult.status === "failed") {
      await writeOperatingEvent(authClient, input, {
        eventType: "music_manager_read_handoff_failed",
        targetType: "music_project",
        targetId: input.musicProjectId,
        sourceType: "source_snapshot",
        sourceId: snapshotId,
        summary: `Could not generate a Manager Read for ${musicProject.title} after Chartmetric project evidence was stored.`,
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
    await writeOperatingEvent(authClient, input, {
      eventType: "chartmetric_project_enrichment_completed",
      targetType: "music_project",
      targetId: input.musicProjectId,
      sourceType: "source_snapshot",
      sourceId: snapshotId,
      summary: `Stored Chartmetric project enrichment snapshot for ${musicProject.title}.`,
      payload: {
        snapshot_id: snapshotId,
        chartmetric_project_id: resolution.id,
        resolved_via: resolution.resolvedVia,
        evidence_count: evidenceItems.length,
        track_count: tracklist.length,
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
      await markFailedSafe(jobId, context, error);
    }
    return json({ error: error instanceof Error ? error.message : "Chartmetric project enrichment failed." }, 500);
  }
});

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

/**
 * Resolves a Chartmetric album ID using the platform's direct identifier-lookup
 * endpoints. Priority: explicit override → spotify_album_id → upc.
 */
async function resolveChartmetricProjectId(
  identifiers: NormalizedIdentifier[],
  chartmetric: ChartmetricClient,
  chartmetricProjectIdOverride?: string,
): Promise<ProjectResolution> {
  if (chartmetricProjectIdOverride?.trim()) {
    return { id: chartmetricProjectIdOverride.trim(), resolvedVia: "provided" };
  }

  const spotifyAlbumId = findIdentifier(identifiers, "spotify_album_id");
  if (spotifyAlbumId) {
    try {
      const result = await chartmetric.requestJson<Record<string, unknown>>(
        `/api/album/spotify/${encodeURIComponent(spotifyAlbumId)}/get-ids`,
      );
      const id = readCmIdFromGetIds(result.data);
      if (id) return { id, resolvedVia: "spotify_album_id" };
    } catch {
      // Fall through to UPC lookup.
    }
  }

  const upc = findIdentifier(identifiers, "upc");
  if (upc) {
    try {
      const result = await chartmetric.requestJson<Record<string, unknown>>(
        `/api/album/upc/${encodeURIComponent(upc)}/get-ids`,
      );
      const id = readCmIdFromGetIds(result.data);
      if (id) return { id, resolvedVia: "upc" };
    } catch {
      // Fall through to unresolved.
    }
  }

  return { id: undefined, resolvedVia: "none" };
}

/**
 * Reads the Chartmetric entity ID from a get-ids response.
 * Album lookups can return an object or a one-item `obj` array with `cm_album`.
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
    readNumber(candidate.cm_album) ??
    readString(candidate.cm_album) ??
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
 * Fetches enriched intelligence from Chartmetric's per-album endpoints in parallel.
 * Uses Promise.allSettled so a failed supplemental call does not abort the job.
 */
async function fetchProjectSupplementals(
  cmAlbumId: string,
  chartmetric: ChartmetricClient,
): Promise<ChartmetricProjectSupplementals> {
  const until = new Date().toISOString().split("T")[0];
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const timeParams = `since=${since}&until=${until}`;
  const id = encodeURIComponent(cmAlbumId);

  const [spotifyPopularity, playlistSnapshot, albumTracks] = await Promise.allSettled([
    chartmetric.requestJson(`/api/album/${id}/spotify/followers?${timeParams}`),
    chartmetric.requestJson(
      `/api/album/${id}/spotify/current/playlists?${timeParams}&limit=100&editorial=false&showPositionStats=true`,
    ),
    chartmetric.requestJson(`/api/album/${id}/tracks`),
  ]);

  const results = { spotifyPopularity, playlistSnapshot, albumTracks };
  return {
    spotifyPopularity: settledData(spotifyPopularity),
    playlistSnapshot: settledData(playlistSnapshot),
    albumTracks: settledData(albumTracks),
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
  return error instanceof Error ? error.message : "Chartmetric supplemental request failed.";
}

// ---------------------------------------------------------------------------
// Data loaders
// ---------------------------------------------------------------------------

async function loadQueuedJobContext(supabase: any, input: ProjectEnrichmentInput): Promise<QueuedJobContext> {
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
  if (!job?.id) throw new Error("Queued Chartmetric project enrichment job was not found.");
  if (job.job_type !== "chartmetric_project_enrichment") {
    throw new Error("Queued job is not a Chartmetric project enrichment job.");
  }

  const sourceConnectionId = job.source_connection_id as string | undefined;
  const connection = sourceConnectionId ? await loadSourceConnection(supabase, input, sourceConnectionId) : null;
  return {
    sourceSyncJobId: job.id as string,
    sourceConnectionId,
    metadata: (connection?.metadata as Record<string, unknown> | undefined) ?? {},
  };
}

async function loadSourceConnection(supabase: any, input: ProjectEnrichmentInput, sourceConnectionId: string) {
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

async function loadMusicProject(supabase: any, input: ProjectEnrichmentInput): Promise<MusicProjectRow> {
  const { data, error } = await supabase
    .from("music_projects")
    .select("id,title,project_type,metadata")
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("artist_id", input.artistId)
    .eq("id", input.musicProjectId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.id) throw new Error("Music project was not found for Chartmetric enrichment.");
  return data as MusicProjectRow;
}

async function loadProjectIdentifiers(supabase: any, input: ProjectEnrichmentInput): Promise<NormalizedIdentifier[]> {
  const { data, error } = await supabase
    .from("music_identifiers")
    .select("identifier_type,identifier_value")
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("artist_id", input.artistId)
    .eq("music_project_id", input.musicProjectId);
  if (error) throw error;
  return ((data ?? []) as MusicIdentifierRow[]).map((identifier) => ({
    identifierType: identifier.identifier_type,
    identifierValue: identifier.identifier_value,
  }));
}

async function loadProjectTracklist(supabase: any, input: ProjectEnrichmentInput): Promise<ProjectTrackRow[]> {
  const { data, error } = await supabase
    .from("music_project_items")
    .select("music_item_id,display_title,order_index")
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("artist_id", input.artistId)
    .eq("music_project_id", input.musicProjectId)
    .order("order_index", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ProjectTrackRow[];
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

async function createChartmetricProjectConnection(
  supabase: any,
  input: ProjectEnrichmentInput,
  providerId: string,
  musicProject: MusicProjectRow,
  identifiers: NormalizedIdentifier[],
) {
  const handleOrExternalRef = input.chartmetricProjectId ?? findIdentifier(identifiers, "spotify_album_id") ?? input.musicProjectId;
  const { data, error } = await supabase
    .from("source_connections")
    .insert({
      account_id: input.accountId,
      artist_workspace_id: input.artistWorkspaceId,
      artist_id: input.artistId,
      provider_id: providerId,
      handle_or_external_ref: handleOrExternalRef,
      status: "candidate",
      limitations: [chartmetricLimit],
      metadata: {
        target_scope: "music_project",
        music_project_id: input.musicProjectId,
        project_title: musicProject.title,
        chartmetric_project_id: input.chartmetricProjectId,
        identifiers,
      },
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

// ---------------------------------------------------------------------------
// Job and snapshot management
// ---------------------------------------------------------------------------

async function createSourceSyncJob(
  supabase: any,
  input: ProjectEnrichmentInput,
  sourceConnectionId: string,
  triggerType: "setup" | "manual",
) {
  const { data, error } = await supabase
    .from("source_sync_jobs")
    .insert({
      account_id: input.accountId,
      artist_workspace_id: input.artistWorkspaceId,
      artist_id: input.artistId,
      source_connection_id: sourceConnectionId,
      job_type: "chartmetric_project_enrichment",
      trigger_type: triggerType,
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
  input: ProjectEnrichmentInput,
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
  input: ProjectEnrichmentInput,
  subject: { subjectType: "music_project"; subjectId: string },
) {
  try {
    const response = await fetch(`${requireEnv("SUPABASE_URL")}/functions/v1/generate-music-summary`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
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

async function writeOperatingEvent(
  supabase: any,
  input: ProjectEnrichmentInput,
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

async function markFailedSafe(jobId: string, input: ProjectEnrichmentInput, error: unknown) {
  try {
    const supabaseUrl = requireEnv("SUPABASE_URL");
    const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);
    const message = error instanceof Error ? error.message : "Chartmetric project enrichment failed.";
    await updateSourceSyncJob(serviceClient, jobId, { status: "failed", error: message });
    await writeOperatingEvent(serviceClient, input, {
      eventType: "chartmetric_project_enrichment_failed",
      targetType: "music_project",
      targetId: input.musicProjectId,
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

function validateInput(input: ProjectEnrichmentInput) {
  for (const [key, value] of [
    ["accountId", input.accountId],
    ["artistWorkspaceId", input.artistWorkspaceId],
    ["artistId", input.artistId],
    ["musicProjectId", input.musicProjectId],
  ]) {
    if (!value?.trim()) throw new Error(`Missing required field: ${key}.`);
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
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
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
