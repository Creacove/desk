import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type SetupEnrichmentInput = {
  accountId: string;
  artistWorkspaceId: string;
  artistId: string;
  spotifyArtistId?: string;
  artistName?: string;
  maxRecentSongs?: number;
  maxStandaloneSongs?: number;
};

type SetupProjectRow = {
  id: string;
  title: string;
  project_type?: string | null;
};

type RecentSongRow = {
  id: string;
  title: string;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return json({ ok: true });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  try {
    const input = (await request.json()) as SetupEnrichmentInput;
    validateInput(input);

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

    const setupProjects = await loadSetupProjects(authClient, input);
    const recentSongs = await loadRecentSongs(authClient, input);
    const jobs = await createEnrichmentJobs(authClient, input, setupProjects, recentSongs);

    await writeOperatingEvent(authClient, input, {
      eventType: "chartmetric_setup_enrichment_queued",
      targetType: "artist_workspace",
      targetId: input.artistWorkspaceId,
      summary: `Queued Chartmetric enrichment for artist, ${setupProjects.length} setup project${setupProjects.length === 1 ? "" : "s"}, and ${recentSongs.length} recent song${recentSongs.length === 1 ? "" : "s"}.`,
      payload: {
        setup_project_ids: setupProjects.map((project) => project.id),
        recent_song_ids: recentSongs.map((song) => song.id),
        job_ids: jobs.map((job) => job.id),
      },
    });

    dispatchEnrichmentWorkers(supabaseUrl, anonKey, authHeader, input, jobs);

    return json({
      status: "queued",
      setupProjectCount: setupProjects.length,
      recentSongCount: recentSongs.length,
      jobs,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Chartmetric setup enrichment failed." }, 500);
  }
});

async function loadSetupProjects(supabase: any, input: SetupEnrichmentInput): Promise<SetupProjectRow[]> {
  const { data, error } = await supabase
    .from("music_projects")
    .select("id,title,project_type")
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("artist_id", input.artistId)
    .eq("status", "active")
    .order("released_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return ((data ?? []) as SetupProjectRow[]).filter((project) => project.id);
}

async function loadRecentSongs(supabase: any, input: SetupEnrichmentInput): Promise<RecentSongRow[]> {
  const limit = Math.max(1, Math.min(input.maxRecentSongs ?? input.maxStandaloneSongs ?? 5, 10));
  const { data, error } = await supabase
    .from("music_items")
    .select("id,title")
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("artist_id", input.artistId)
    .eq("status", "active")
    .order("released_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as RecentSongRow[]).filter((song) => song.id);
}

type EnrichmentJobDraft = {
  id: string;
  job_type: string;
  source_connection_id: string;
  metadata: Record<string, unknown>;
};

async function createEnrichmentJobs(
  supabase: any,
  input: SetupEnrichmentInput,
  setupProjects: SetupProjectRow[],
  recentSongs: RecentSongRow[],
) {
  const providerId = await getChartmetricProvider(supabase);
  const targets = [
    {
      job_type: "chartmetric_artist_enrichment",
      handle_or_external_ref: input.spotifyArtistId ?? input.artistId,
      metadata: {
        target_scope: "artist",
        spotify_artist_id: input.spotifyArtistId,
        artist_name: input.artistName,
      },
    },
    ...setupProjects.map((project) => ({
      job_type: "chartmetric_project_enrichment",
      handle_or_external_ref: project.id,
      metadata: {
        target_scope: "music_project",
        music_project_id: project.id,
        project_title: project.title,
        project_type: project.project_type,
      },
    })),
    ...recentSongs.map((song) => ({
      job_type: "chartmetric_track_enrichment",
      handle_or_external_ref: song.id,
      metadata: {
        target_scope: "music_item",
        music_item_id: song.id,
        music_title: song.title,
      },
    })),
  ];

  const jobs = [];
  for (const target of targets) {
    const sourceConnectionId = await createChartmetricSourceConnection(supabase, input, providerId, target);
    const { data, error } = await supabase
      .from("source_sync_jobs")
      .insert({
        account_id: input.accountId,
        artist_workspace_id: input.artistWorkspaceId,
        artist_id: input.artistId,
        source_connection_id: sourceConnectionId,
        job_type: target.job_type,
        trigger_type: "setup",
        status: "queued",
      })
      .select("id,job_type,source_connection_id");
    if (error) throw error;
    const created = Array.isArray(data) ? data[0] : data;
    if (created) jobs.push({ ...created, metadata: target.metadata });
  }

  return jobs as EnrichmentJobDraft[];
}

function dispatchEnrichmentWorkers(
  supabaseUrl: string,
  anonKey: string,
  authHeader: string,
  input: SetupEnrichmentInput,
  jobs: EnrichmentJobDraft[],
) {
  const work = Promise.all(jobs.map((job) => dispatchEnrichmentWorker(supabaseUrl, anonKey, authHeader, input, job))).catch((error) => {
    console.warn("chartmetric setup enrichment worker dispatch failed", {
      message: error instanceof Error ? error.message : "Chartmetric setup enrichment worker dispatch failed.",
    });
  });
  EdgeRuntime.waitUntil(work);
}

async function dispatchEnrichmentWorker(
  supabaseUrl: string,
  anonKey: string,
  authHeader: string,
  input: SetupEnrichmentInput,
  job: EnrichmentJobDraft,
) {
  const endpoint = workerEndpoint(job.job_type);
  if (!endpoint) return;

  const response = await fetch(`${supabaseUrl}/functions/v1/${endpoint}`, {
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
      sourceSyncJobId: job.id,
      sourceConnectionId: job.source_connection_id,
      spotifyArtistId: input.spotifyArtistId,
      artistName: input.artistName,
      musicProjectId: job.metadata.music_project_id,
      musicItemId: job.metadata.music_item_id,
    }),
  });

  if (!response.ok) {
    throw new Error(`Chartmetric worker ${endpoint} failed with ${response.status}.`);
  }
}

function workerEndpoint(jobType: string) {
  if (jobType === "chartmetric_artist_enrichment") return "chartmetric-artist-enrichment";
  if (jobType === "chartmetric_project_enrichment") return "chartmetric-project-enrichment";
  if (jobType === "chartmetric_track_enrichment") return "chartmetric-track-enrichment";
  return null;
}

async function getChartmetricProvider(supabase: any) {
  const { data, error } = await supabase.from("source_providers").select("id").eq("provider_key", "chartmetric").maybeSingle();
  if (error) throw error;
  if (data?.id) return data.id as string;

  throw new Error("Chartmetric source provider is not seeded. Run the Chartmetric provider seed migration before enrichment.");
}

async function createChartmetricSourceConnection(
  supabase: any,
  input: SetupEnrichmentInput,
  providerId: string,
  target: { job_type: string; handle_or_external_ref: string; metadata: Record<string, unknown> },
) {
  const { data: existing, error: existingError } = await supabase
    .from("source_connections")
    .select("id")
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("provider_id", providerId)
    .eq("handle_or_external_ref", target.handle_or_external_ref)
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
      handle_or_external_ref: target.handle_or_external_ref,
      status: "candidate",
      limitations: [
        "Chartmetric enrichment is third-party music intelligence. Streams and platform metrics are allowed when Chartmetric returns them and must be labeled as Chartmetric-sourced.",
      ],
      metadata: target.metadata,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function writeOperatingEvent(
  supabase: any,
  input: SetupEnrichmentInput,
  draft: {
    eventType: string;
    targetType?: string;
    targetId?: string;
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
    summary: draft.summary,
    payload: draft.payload ?? {},
  });
  if (error) throw error;
}

function validateInput(input: SetupEnrichmentInput) {
  for (const [key, value] of [
    ["accountId", input.accountId],
    ["artistWorkspaceId", input.artistWorkspaceId],
    ["artistId", input.artistId],
  ]) {
    if (!value?.trim()) throw new Error(`Missing required field: ${key}.`);
  }
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
