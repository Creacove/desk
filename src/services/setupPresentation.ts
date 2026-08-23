import type { SupabaseClient } from "@supabase/supabase-js";
import { buildSetupPresentationSnapshot, mergeConsumedDiscoveryEvidence } from "./setupPresentationProjection";
import { parseSetupPresentationFeed } from "./setupPresentationFindings";
import type { SetupPresentationFeed, SetupPresentationSnapshot } from "../types/setupPresentation";

export type SetupPresentationLoader = (
  artistWorkspaceId: string,
  options?: { signal?: AbortSignal },
) => Promise<SetupPresentationSnapshot>;

type QueryError = { message?: string; code?: string; details?: string; hint?: string };
type QueryResult<T> = { data: T | null; error: QueryError | null };

type SetupRunRow = {
  id: string;
  account_id: string;
  artist_id: string;
  status?: string | null;
  current_stage?: string | null;
  stage_status?: unknown;
  started_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type DiscoveryRunRow = {
  id: string;
  status?: string | null;
  started_at?: string | null;
  created_at?: string | null;
  context_payload?: unknown;
  steps_payload?: unknown;
};

type BriefRunRow = {
  id: string;
  status?: string | null;
  started_at?: string | null;
  created_at?: string | null;
};

type DiscoveryActionRow = {
  id: string;
  status?: string | null;
  action_type?: string | null;
  result_payload?: unknown;
};

const RELEVANT_EVENT_TYPES = [
  "spotify_catalog_bootstrap_started",
  "spotify_catalog_bootstrap_completed",
  "spotify_catalog_bootstrap_completed_with_limits",
  "manager_discovery_started",
  "manager_discovery_completed",
  "manager_discovery_completed_with_limits",
  "manager_discovery_tool_started",
  "manager_discovery_tool_completed",
  "manager_discovery_tool_failed",
  "setup_todays_brief_generated",
] as const;

export function createSupabaseSetupPresentationLoader(client: SupabaseClient): SetupPresentationLoader {
  return async (artistWorkspaceId, options = {}) => {
    assertUuid(artistWorkspaceId);
    const signal = options.signal;

    // This first query is both discovery and authorization: workspace_setup_runs is RLS-protected
    // by account membership, so an inaccessible workspace resolves to no visible setup run.
    const setupResult = await withSignal(
      client
        .from("workspace_setup_runs")
        .select("id,account_id,artist_id,status,current_stage,stage_status,started_at,created_at,updated_at")
        .eq("artist_workspace_id", artistWorkspaceId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      signal,
    ) as QueryResult<SetupRunRow>;
    throwIfError(setupResult.error);
    if (!setupResult.data?.id) throw new Error("Setup presentation run is unavailable.");
    const setupRun = setupResult.data;

    const v2Feed = await tryLoadSetupPresentationFeed(client, setupRun.id, signal);
    if (v2Feed) {
      return assertSetupPresentationSnapshot(snapshotFromFeed(v2Feed));
    }

    const setupStartedAt = setupRun.started_at ?? setupRun.created_at ?? undefined;

    const [profileResult, itemsResult, projectsResult, eventsResult, discoveryResult, briefResult] = await Promise.all([
      withSignal(
        client
          .from("artist_profiles")
          .select("display_name,spotify_identity,genres")
          .eq("account_id", setupRun.account_id)
          .eq("artist_workspace_id", artistWorkspaceId)
          .eq("artist_id", setupRun.artist_id)
          .maybeSingle(),
        signal,
      ),
      withSignal(
        client
          .from("music_items")
          .select("id,title,metadata,released_at")
          .eq("account_id", setupRun.account_id)
          .eq("artist_workspace_id", artistWorkspaceId)
          .eq("artist_id", setupRun.artist_id)
          .order("released_at", { ascending: false, nullsFirst: false })
          .order("id", { ascending: true })
          .limit(10),
        signal,
      ),
      withSignal(
        client
          .from("music_projects")
          .select("id,title,metadata,released_at")
          .eq("account_id", setupRun.account_id)
          .eq("artist_workspace_id", artistWorkspaceId)
          .eq("artist_id", setupRun.artist_id)
          .order("released_at", { ascending: false, nullsFirst: false })
          .order("id", { ascending: true })
          .limit(5),
        signal,
      ),
      withSignal(buildEventQuery(client, setupRun.account_id, artistWorkspaceId, setupRun.artist_id, setupStartedAt), signal),
      withSignal(
        client
          .from("manager_synthesis_runs")
          .select("id,status,started_at,created_at,context_payload,steps_payload")
          .eq("account_id", setupRun.account_id)
          .eq("artist_workspace_id", artistWorkspaceId)
          .eq("artist_id", setupRun.artist_id)
          .eq("classification", "manager_artist_discovery_v1")
          .eq("scope_key", setupRun.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        signal,
      ),
      withSignal(
        client
          .from("manager_synthesis_runs")
          .select("id,status,started_at,created_at")
          .eq("account_id", setupRun.account_id)
          .eq("artist_workspace_id", artistWorkspaceId)
          .eq("artist_id", setupRun.artist_id)
          .eq("classification", "setup_todays_brief_v1")
          .eq("scope_key", setupRun.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        signal,
      ),
    ]);

    [profileResult, itemsResult, projectsResult, eventsResult, discoveryResult, briefResult].forEach((result) => throwIfError(result.error));
    const discoveryRun = (discoveryResult.data ?? null) as DiscoveryRunRow | null;
    const briefRun = (briefResult.data ?? null) as BriefRunRow | null;

    const [actionsResult, managerOutputResult] = await Promise.all([
      discoveryRun?.id
        ? withSignal(
            client
              .from("manager_run_actions")
              .select("id,status,action_type,result_payload")
              .eq("account_id", setupRun.account_id)
              .eq("artist_workspace_id", artistWorkspaceId)
              .eq("artist_id", setupRun.artist_id)
              .eq("manager_synthesis_run_id", discoveryRun.id)
              .order("created_at", { ascending: true }),
            signal,
          )
        : Promise.resolve({ data: [], error: null }),
      briefRun?.id
        ? withSignal(
            client
              .from("manager_outputs")
              .select("render_json")
              .eq("account_id", setupRun.account_id)
              .eq("artist_workspace_id", artistWorkspaceId)
              .eq("artist_id", setupRun.artist_id)
              .eq("created_from_run_id", briefRun.id)
              .eq("output_type", "setup_first_manager_read")
              .limit(1)
              .maybeSingle(),
            signal,
          )
        : Promise.resolve({ data: null, error: null }),
    ]);
    throwIfError(actionsResult.error);
    throwIfError(managerOutputResult.error);

    const discoveryActions = (actionsResult.data ?? []) as DiscoveryActionRow[];
    const actionIds = discoveryActions.map((row) => row.id).filter(Boolean);
    const evidenceResult = actionIds.length
      ? await withSignal(
          client
            .from("evidence_items")
            .select("id,source,source_kind,metric_name,metric_value,metric_unit,subject_label,subject_id,provenance,raw_ref,created_at")
            .eq("account_id", setupRun.account_id)
            .eq("artist_workspace_id", artistWorkspaceId)
            .eq("artist_id", setupRun.artist_id)
            .in("created_from_action_id", actionIds)
            .order("created_at", { ascending: true }),
          signal,
        )
      : { data: [], error: null };
    throwIfError(evidenceResult.error);

    const evidence = mergeConsumedDiscoveryEvidence(
      (evidenceResult.data ?? []) as Parameters<typeof mergeConsumedDiscoveryEvidence>[0],
      discoveryActions,
    );
    const events = [...(eventsResult.data ?? [])].reverse();

    return assertSetupPresentationSnapshot(buildSetupPresentationSnapshot({
      setupRun,
      workspace: {
        artistName: profileResult.data?.display_name ?? null,
        spotifyIdentity: profileResult.data?.spotify_identity,
        genres: profileResult.data?.genres,
      },
      musicItems: itemsResult.data ?? [],
      musicProjects: projectsResult.data ?? [],
      operatingEvents: events,
      discoveryRun,
      evidence,
      briefRun,
      managerOutput: managerOutputResult.data ?? null,
    }));
  };
}

async function tryLoadSetupPresentationFeed(
  client: SupabaseClient,
  setupRunId: string,
  signal?: AbortSignal,
): Promise<SetupPresentationFeed | null> {
  try {
    const result = await withSignal(
      client.rpc("get_setup_presentation_feed_v2", { p_setup_run_id: setupRunId }),
      signal,
    ) as QueryResult<unknown>;
    if (result.error || result.data === null) return null;
    return parseSetupPresentationFeed(result.data, setupRunId);
  } catch {
    return null;
  }
}

function snapshotFromFeed(feed: SetupPresentationFeed): SetupPresentationSnapshot {
  return {
    version: 1,
    observedAt: feed.observedAt,
    feed,
    setup: {
      status: feed.setup.status,
      phase: feed.setup.phase,
      startedAt: feed.setup.startedAt,
      phaseStartedAt: feed.setup.phaseStartedAt,
      updatedAt: feed.setup.updatedAt,
    },
    artist: feed.artist,
  };
}

function buildEventQuery(
  client: SupabaseClient,
  accountId: string,
  artistWorkspaceId: string,
  artistId: string,
  setupStartedAt?: string,
) {
  let query = client
    .from("operating_events")
    .select("event_type,payload,created_at")
    .eq("account_id", accountId)
    .eq("artist_workspace_id", artistWorkspaceId)
    .eq("artist_id", artistId)
    .in("event_type", [...RELEVANT_EVENT_TYPES])
    .order("created_at", { ascending: false })
    .limit(120);
  if (setupStartedAt) query = query.gte("created_at", setupStartedAt);
  return query;
}

function withSignal<T extends { abortSignal(signal: AbortSignal): PromiseLike<unknown> }>(query: T, signal?: AbortSignal): Promise<any> {
  return signal ? Promise.resolve(query.abortSignal(signal)) : Promise.resolve(query);
}

function throwIfError(error: QueryError | null | undefined) {
  if (error) throw error;
}

function assertUuid(value: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error("Setup presentation workspace is invalid.");
  }
}

export function assertSetupPresentationSnapshot(value: unknown): SetupPresentationSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Setup presentation returned invalid data.");
  const row = value as Record<string, unknown>;
  if (row.version !== 1 || typeof row.observedAt !== "string") throw new Error("Setup presentation returned an unsupported version.");
  const setup = row.setup;
  if (!setup || typeof setup !== "object" || Array.isArray(setup)) throw new Error("Setup presentation returned no setup state.");
  const setupRow = setup as Record<string, unknown>;
  if (!new Set(["queued", "running", "completed", "failed"]).has(String(setupRow.status))) {
    throw new Error("Setup presentation returned an invalid setup status.");
  }
  if (!new Set(["catalogue", "discovery", "synthesis", "ready"]).has(String(setupRow.phase))) {
    throw new Error("Setup presentation returned an invalid setup phase.");
  }

  if (row.feed !== undefined) {
    if (!row.feed || typeof row.feed !== "object" || Array.isArray(row.feed)) {
      throw new Error("Setup presentation returned an invalid v2 feed.");
    }
    const feedRow = row.feed as Record<string, unknown>;
    const feedSetup = feedRow.setup;
    const runId = feedSetup && typeof feedSetup === "object" && !Array.isArray(feedSetup)
      ? (feedSetup as Record<string, unknown>).runId
      : undefined;
    if (typeof runId !== "string") throw new Error("Setup presentation returned an invalid v2 feed run ID.");
    const feed = parseSetupPresentationFeed(row.feed, runId);
    if (feed.setup.status !== setupRow.status || feed.setup.phase !== setupRow.phase) {
      throw new Error("Setup presentation v2 feed disagrees with setup state.");
    }
  }

  if (row.catalogue !== undefined) {
    if (!row.catalogue || typeof row.catalogue !== "object" || Array.isArray(row.catalogue)) {
      throw new Error("Setup presentation returned an invalid catalogue state.");
    }
    const catalogue = row.catalogue as Record<string, unknown>;
    if (catalogue.state !== "working" && catalogue.state !== "complete") {
      throw new Error("Setup presentation returned an invalid catalogue state.");
    }
    if (!Array.isArray(catalogue.covers)) throw new Error("Setup presentation returned invalid catalogue artwork.");
  }

  if (row.manager !== undefined) {
    if (!row.manager || typeof row.manager !== "object" || Array.isArray(row.manager)) {
      throw new Error("Setup presentation returned an invalid Manager state.");
    }
    const manager = row.manager as Record<string, unknown>;
    if (!new Set(["waiting", "working", "ready"]).has(String(manager.state))) {
      throw new Error("Setup presentation returned an invalid Manager state.");
    }
  }

  return value as SetupPresentationSnapshot;
}
