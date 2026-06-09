import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createChartmetricClient } from "../_shared/chartmetricClient.ts";
import { normalizeChartmetricArtistEvidence } from "../_shared/chartmetricEvidence.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const chartmetricLimit =
  "Chartmetric artist enrichment is third-party music intelligence. Streams and platform metrics are allowed when Chartmetric returns them and must be labeled as Chartmetric-sourced; rights, royalties, ROI, and conversion need stronger evidence.";

type ArtistEnrichmentInput = {
  accountId: string;
  artistWorkspaceId: string;
  artistId: string;
  sourceSyncJobId?: string;
  sourceConnectionId?: string;
  chartmetricArtistId?: string;
  spotifyArtistId?: string;
  artistName?: string;
};

type QueuedJobContext = {
  sourceSyncJobId?: string;
  sourceConnectionId?: string;
  metadata: Record<string, unknown>;
};

type ArtistProfileRow = {
  id: string;
  display_name?: string | null;
  spotify_identity?: Record<string, unknown> | null;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return json({ ok: true });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  let jobId: string | null = null;
  let context: ArtistEnrichmentInput | null = null;

  try {
    const input = (await request.json()) as ArtistEnrichmentInput;
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
    const artistProfile = await loadArtistProfile(authClient, input);
    const providerId = await getChartmetricProvider(authClient);
    const sourceConnectionId =
      queuedJob.sourceConnectionId ?? input.sourceConnectionId ?? (await createChartmetricArtistConnection(authClient, input, providerId, artistProfile));

    jobId =
      queuedJob.sourceSyncJobId ??
      (await createSourceSyncJob(authClient, input, sourceConnectionId, "manual"));

    await updateSourceSyncJob(authClient, jobId, { status: "running" });
    await writeOperatingEvent(authClient, input, {
      eventType: "chartmetric_artist_enrichment_started",
      targetType: "artist",
      targetId: input.artistId,
      sourceType: "source_sync_job",
      sourceId: jobId,
      summary: `Started Chartmetric artist enrichment for ${readArtistName(input, queuedJob, artistProfile)}.`,
    });

    const chartmetric = createChartmetricClient({
      refreshToken: requireEnv("CHARTMETRIC_REFRESH_TOKEN"),
      baseUrl: Deno.env.get("CHARTMETRIC_BASE_URL") || undefined,
    });
    const resolvedChartmetricArtistId = await resolveChartmetricArtistId(input, queuedJob, artistProfile, chartmetric);
    if (!resolvedChartmetricArtistId) {
      throw new Error("No exact Chartmetric artist match was found from the Spotify artist ID.");
    }
    const enrichment = await chartmetric.requestJson<Record<string, unknown>>(
      `/api/artist/${encodeURIComponent(resolvedChartmetricArtistId)}`,
    );
    const rawRef = resolvedChartmetricArtistId ?? readChartmetricArtistRef(input, queuedJob, artistProfile);
    const snapshotId = await writeSourceSnapshot(authClient, input, {
      providerId,
      sourceConnectionId,
      snapshotType: "chartmetric_artist_enrichment",
      rawRef,
      rawPayload: enrichment.data,
      metadata: {
        provider: "chartmetric",
        snapshot_type: "chartmetric_artist_enrichment",
        artist_id: input.artistId,
        artist_name: readArtistName(input, queuedJob, artistProfile),
        chartmetric_artist_id: resolvedChartmetricArtistId,
        spotify_artist_id: input.spotifyArtistId ?? readString(queuedJob.metadata.spotify_artist_id),
        rate_limit: enrichment.rateLimit,
      },
    });
    const evidenceItems = normalizeChartmetricArtistEvidence(enrichment.data, {
      accountId: input.accountId,
      artistWorkspaceId: input.artistWorkspaceId,
      artistId: input.artistId,
      subjectId: input.artistId,
      sourceSnapshotId: snapshotId,
      providerId,
      subjectLabel: readArtistName(input, queuedJob, artistProfile),
      rawRef,
    });
    await writeEvidenceItems(authClient, evidenceItems);

    await updateSourceSyncJob(authClient, jobId, { status: "completed", snapshotIds: [snapshotId] });
    await writeOperatingEvent(authClient, input, {
      eventType: "chartmetric_artist_enrichment_completed",
      targetType: "artist",
      targetId: input.artistId,
      sourceType: "source_snapshot",
      sourceId: snapshotId,
      summary: `Stored Chartmetric artist enrichment snapshot for ${readArtistName(input, queuedJob, artistProfile)}.`,
      payload: {
        snapshot_id: snapshotId,
        evidence_count: evidenceItems.length,
      },
    });

    return json({
      status: "completed",
      sourceSyncJobId: jobId,
      sourceSnapshotId: snapshotId,
      evidenceCount: evidenceItems.length,
      rateLimit: enrichment.rateLimit,
    });
  } catch (error) {
    if (jobId && context) {
      await markFailedSafe(jobId, context, error);
    }
    return json({ error: describeError(error, "Chartmetric artist enrichment failed.") }, 500);
  }
});

async function loadQueuedJobContext(supabase: any, input: ArtistEnrichmentInput): Promise<QueuedJobContext> {
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
  if (!job?.id) throw new Error("Queued Chartmetric artist enrichment job was not found.");
  if (job.job_type !== "chartmetric_artist_enrichment") {
    throw new Error("Queued job is not a Chartmetric artist enrichment job.");
  }

  const sourceConnectionId = job.source_connection_id as string | undefined;
  const connection = sourceConnectionId ? await loadSourceConnection(supabase, input, sourceConnectionId) : null;
  return {
    sourceSyncJobId: job.id as string,
    sourceConnectionId,
    metadata: (connection?.metadata as Record<string, unknown> | undefined) ?? {},
  };
}

async function loadSourceConnection(supabase: any, input: ArtistEnrichmentInput, sourceConnectionId: string) {
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

async function loadArtistProfile(supabase: any, input: ArtistEnrichmentInput): Promise<ArtistProfileRow | null> {
  const { data, error } = await supabase
    .from("artist_profiles")
    .select("id,display_name,spotify_identity")
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("artist_id", input.artistId)
    .maybeSingle();
  if (error) throw error;
  return data?.id ? (data as ArtistProfileRow) : null;
}

async function resolveChartmetricArtistId(
  input: ArtistEnrichmentInput,
  queuedJob: QueuedJobContext,
  artistProfile: ArtistProfileRow | null,
  chartmetric: ReturnType<typeof createChartmetricClient>,
) {
  const chartmetricArtistId = input.chartmetricArtistId?.trim() ?? readString(queuedJob.metadata.chartmetric_artist_id);
  if (chartmetricArtistId) return chartmetricArtistId;

  const spotifyArtistId =
    input.spotifyArtistId?.trim() ??
    readString(queuedJob.metadata.spotify_artist_id) ??
    readString(artistProfile?.spotify_identity?.id);
  if (!spotifyArtistId) return undefined;

  const result = await chartmetric.requestJson<Record<string, unknown>>(
    `/api/artist/spotify/${encodeURIComponent(spotifyArtistId)}/get-ids`,
  );
  return readChartmetricArtistId(result.data);
}

function readChartmetricArtistId(payload: unknown) {
  if (!isRecord(payload)) return undefined;
  const obj = "obj" in payload ? payload.obj : payload;
  const candidate = Array.isArray(obj) ? obj.find(isRecord) : obj;
  if (!isRecord(candidate)) return undefined;
  const id =
    readNumber(candidate.cm_artist) ??
    readString(candidate.cm_artist) ??
    readNumber(candidate.chartmetric_id) ??
    readString(candidate.chartmetric_id) ??
    readNumber(candidate.id) ??
    readString(candidate.id);
  return id === undefined ? undefined : String(id);
}

function readChartmetricArtistRef(input: ArtistEnrichmentInput, queuedJob: QueuedJobContext, artistProfile: ArtistProfileRow | null) {
  return (
    input.chartmetricArtistId ??
    readString(queuedJob.metadata.chartmetric_artist_id) ??
    input.spotifyArtistId ??
    readString(queuedJob.metadata.spotify_artist_id) ??
    readString(artistProfile?.spotify_identity?.id) ??
    input.artistId
  );
}

function readArtistName(input: ArtistEnrichmentInput, queuedJob: QueuedJobContext, artistProfile: ArtistProfileRow | null) {
  return (
    input.artistName?.trim() ??
    readString(queuedJob.metadata.artist_name) ??
    readString(artistProfile?.display_name) ??
    readString(artistProfile?.spotify_identity?.name) ??
    "artist"
  );
}

async function getChartmetricProvider(supabase: any) {
  const { data, error } = await supabase.from("source_providers").select("id").eq("provider_key", "chartmetric").maybeSingle();
  if (error) throw error;
  if (data?.id) return data.id as string;

  throw new Error("Chartmetric source provider is not seeded. Run the Chartmetric provider seed migration before enrichment.");
}

async function createChartmetricArtistConnection(
  supabase: any,
  input: ArtistEnrichmentInput,
  providerId: string,
  artistProfile: ArtistProfileRow | null,
) {
  const handleOrExternalRef = input.chartmetricArtistId ?? input.spotifyArtistId ?? readString(artistProfile?.spotify_identity?.id) ?? input.artistId;
  const { data: existing, error: existingError } = await supabase
    .from("source_connections")
    .select("id")
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("provider_id", providerId)
    .eq("handle_or_external_ref", handleOrExternalRef)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing?.id) return existing.id as string;

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
        target_scope: "artist",
        chartmetric_artist_id: input.chartmetricArtistId,
        spotify_artist_id: input.spotifyArtistId ?? readString(artistProfile?.spotify_identity?.id),
        artist_name: input.artistName ?? readString(artistProfile?.spotify_identity?.name),
      },
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function createSourceSyncJob(
  supabase: any,
  input: ArtistEnrichmentInput,
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
      job_type: "chartmetric_artist_enrichment",
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
  input: ArtistEnrichmentInput,
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

async function updateSourceSyncJob(
  supabase: any,
  jobId: string,
  patch: { status: "running" | "completed" | "failed"; snapshotIds?: string[]; error?: string },
) {
  const payload: Record<string, unknown> = {
    status: patch.status,
    error: patch.error,
  };
  if (patch.status === "running") payload.started_at = new Date().toISOString();
  if (patch.status === "completed" || patch.status === "failed") {
    payload.snapshot_ids = patch.snapshotIds ?? [];
    payload.completed_at = new Date().toISOString();
  }
  const { error } = await supabase.from("source_sync_jobs").update(payload).eq("id", jobId);
  if (error) throw error;
}

async function writeOperatingEvent(
  supabase: any,
  input: ArtistEnrichmentInput,
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

async function markFailedSafe(jobId: string, input: ArtistEnrichmentInput, error: unknown) {
  try {
    const supabaseUrl = requireEnv("SUPABASE_URL");
    const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);
    const message = describeError(error, "Chartmetric artist enrichment failed.");
    await updateSourceSyncJob(serviceClient, jobId, { status: "failed", error: message });
    await writeOperatingEvent(serviceClient, input, {
      eventType: "chartmetric_artist_enrichment_failed",
      targetType: "artist",
      targetId: input.artistId,
      sourceType: "source_sync_job",
      sourceId: jobId,
      summary: message,
    });
  } catch {
    // Preserve the original error response when failure logging also fails.
  }
}

function validateInput(input: ArtistEnrichmentInput) {
  for (const [key, value] of [
    ["accountId", input.accountId],
    ["artistWorkspaceId", input.artistWorkspaceId],
    ["artistId", input.artistId],
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

function describeError(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (isRecord(error)) {
    const message = readString(error.message);
    const details = readString(error.details);
    const hint = readString(error.hint);
    const code = readString(error.code);
    return [message, details, hint, code ? `code: ${code}` : undefined].filter(Boolean).join(" ") || fallback;
  }
  return fallback;
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
