import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createChartmetricClient } from "../_shared/chartmetricClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const chartmetricLimit =
  "Chartmetric is a third-party music intelligence source. It can support provider-backed artist, track, playlist, chart, and social context where returned, but it does not prove private Spotify analytics, royalty revenue, rights certainty, campaign ROI, or conversion.";

type ResolveArtistInput = {
  accountId: string;
  artistWorkspaceId: string;
  artistId: string;
  spotifyArtistId: string;
  spotifyArtistUrl?: string;
  artistName: string;
  socialHandles?: {
    tiktok?: string;
    instagram?: string;
    youtube?: string;
    x?: string;
  };
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return json({ ok: true });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  let jobId: string | null = null;
  let context: ResolveArtistInput | null = null;

  try {
    const input = (await request.json()) as ResolveArtistInput;
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

    if (membershipError) {
      throw membershipError;
    }

    if (!membership) {
      return json({ error: "Forbidden." }, 403);
    }

    const providerId = await getChartmetricProvider(authClient);
    const sourceConnectionId = await upsertChartmetricConnection(authClient, input, providerId);
    jobId = await createSourceSyncJob(authClient, input, sourceConnectionId);

    await writeOperatingEvent(authClient, input, {
      eventType: "chartmetric_artist_resolve_started",
      targetType: "source_connection",
      targetId: sourceConnectionId,
      sourceType: "source_sync_job",
      sourceId: jobId,
      summary: `Started Chartmetric artist resolution for ${input.artistName.trim()}.`,
    });

    const chartmetric = createChartmetricClient({
      refreshToken: requireEnv("CHARTMETRIC_REFRESH_TOKEN"),
      baseUrl: Deno.env.get("CHARTMETRIC_BASE_URL") || undefined,
    });
    const search = await chartmetric.requestJson<ChartmetricSearchResponse>(buildChartmetricSearchPath(input));
    const snapshotId = await writeSourceSnapshot(authClient, input, {
      providerId,
      sourceConnectionId,
      snapshotType: "chartmetric_artist_search",
      rawRef: input.spotifyArtistId,
      rawPayload: search.data,
      metadata: {
        provider: "chartmetric",
        snapshot_type: "chartmetric_artist_search",
        spotify_artist_id: input.spotifyArtistId,
        spotify_artist_url: input.spotifyArtistUrl,
        artist_name: input.artistName.trim(),
        social_handles: input.socialHandles ?? {},
        rate_limit: search.rateLimit,
      },
    });

    await updateSourceSyncJob(authClient, jobId, { status: "completed", snapshotIds: [snapshotId] });
    await writeOperatingEvent(authClient, input, {
      eventType: "chartmetric_artist_resolve_completed",
      targetType: "source_connection",
      targetId: sourceConnectionId,
      sourceType: "source_snapshot",
      sourceId: snapshotId,
      summary: `Stored Chartmetric artist resolution snapshot for ${input.artistName.trim()}.`,
      payload: {
        candidate_count: readCandidateCount(search.data),
        snapshot_id: snapshotId,
      },
    });

    return json({
      status: "completed",
      sourceSyncJobId: jobId,
      sourceSnapshotId: snapshotId,
      candidates: normalizeCandidates(search.data),
      rateLimit: search.rateLimit,
    });
  } catch (error) {
    if (jobId && context) {
      await markFailedSafe(jobId, context, error);
    }
    return json({ error: error instanceof Error ? error.message : "Chartmetric artist resolution failed." }, 500);
  }
});

function buildChartmetricSearchPath(input: ResolveArtistInput) {
  const searchParams = new URLSearchParams();
  searchParams.set("q", input.artistName.trim());
  searchParams.set("type", "artists");
  searchParams.set("limit", "5");
  return `/api/search?${searchParams.toString()}`;
}

type ChartmetricSearchResponse = {
  obj?: {
    artists?: unknown[];
  };
  artists?: unknown[];
};

function normalizeCandidates(payload: ChartmetricSearchResponse) {
  const candidates = Array.isArray(payload.obj?.artists) ? payload.obj.artists : Array.isArray(payload.artists) ? payload.artists : [];
  return candidates.slice(0, 5);
}

function readCandidateCount(payload: ChartmetricSearchResponse) {
  return normalizeCandidates(payload).length;
}

async function getChartmetricProvider(supabase: any) {
  const { data, error } = await supabase.from("source_providers").select("id").eq("provider_key", "chartmetric").maybeSingle();
  if (error) throw error;
  if (data?.id) return data.id as string;

  throw new Error("Chartmetric source provider is not seeded. Run the Chartmetric provider seed migration before enrichment.");
}

async function upsertChartmetricConnection(supabase: any, input: ResolveArtistInput, providerId: string) {
  const handleOrExternalRef = input.spotifyArtistId;
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
      spotify_artist_id: input.spotifyArtistId,
      spotify_artist_url: input.spotifyArtistUrl,
      artist_name: input.artistName.trim(),
      social_handles: input.socialHandles ?? {},
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

async function createSourceSyncJob(supabase: any, input: ResolveArtistInput, sourceConnectionId: string) {
  const { data, error } = await supabase
    .from("source_sync_jobs")
    .insert({
      account_id: input.accountId,
      artist_workspace_id: input.artistWorkspaceId,
      artist_id: input.artistId,
      source_connection_id: sourceConnectionId,
      job_type: "chartmetric_artist_resolve",
      trigger_type: "setup",
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
  input: ResolveArtistInput,
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

async function updateSourceSyncJob(
  supabase: any,
  jobId: string,
  patch: { status: "completed" | "failed"; snapshotIds?: string[]; error?: string },
) {
  const { error } = await supabase
    .from("source_sync_jobs")
    .update({
      status: patch.status,
      snapshot_ids: patch.snapshotIds ?? [],
      completed_at: new Date().toISOString(),
      error: patch.error,
    })
    .eq("id", jobId);
  if (error) throw error;
}

async function writeOperatingEvent(
  supabase: any,
  input: ResolveArtistInput,
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

async function markFailedSafe(jobId: string, input: ResolveArtistInput, error: unknown) {
  try {
    const supabaseUrl = requireEnv("SUPABASE_URL");
    const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);
    const message = error instanceof Error ? error.message : "Chartmetric artist resolution failed.";
    await updateSourceSyncJob(serviceClient, jobId, { status: "failed", error: message });
    await writeOperatingEvent(serviceClient, input, {
      eventType: "chartmetric_artist_resolve_failed",
      sourceType: "source_sync_job",
      sourceId: jobId,
      summary: message,
    });
  } catch {
    // Preserve the original error response when failure logging also fails.
  }
}

function validateInput(input: ResolveArtistInput) {
  const required = [
    ["accountId", input.accountId],
    ["artistWorkspaceId", input.artistWorkspaceId],
    ["artistId", input.artistId],
    ["spotifyArtistId", input.spotifyArtistId],
    ["artistName", input.artistName],
  ];

  for (const [key, value] of required) {
    if (!value?.trim()) {
      throw new Error(`Missing required field: ${key}.`);
    }
  }
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
