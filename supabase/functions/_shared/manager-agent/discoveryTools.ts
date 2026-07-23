import { createChartmetricClient } from "../chartmetricClient.ts";
import {
  normalizeChartmetricArtistEvidence,
  normalizeChartmetricTrackEvidence,
  normalizeChartmetricProjectEvidence,
} from "../chartmetricEvidence.ts";
import {
  mergeChartmetricTrackPayload,
  type ChartmetricTrackSupplementals,
} from "../chartmetricPayload.ts";
import {
  mergeChartmetricProjectPayload,
  type ChartmetricProjectSupplementals,
} from "../chartmetricProjectPayload.ts";

export type DiscoveryToolInput = {
  accountId: string;
  artistWorkspaceId: string;
  artistId: string;
  reuseExistingSnapshots?: boolean;
};

type NormalizedIdentifier = {
  identifierType: string;
  identifierValue: string;
};

// -----------------------------------------------------------------------------
// Cache Utilities
// -----------------------------------------------------------------------------
async function checkCachedSnapshot(
  db: any,
  input: DiscoveryToolInput,
  snapshotType: string,
  rawRef?: string,
  metadataMatch?: Record<string, unknown>,
) {
  let query = db
    .from("source_snapshots")
    .select("id,raw_payload,created_at")
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("snapshot_type", snapshotType)
    .order("created_at", { ascending: false })
    .limit(1);

  if (rawRef) {
    query = query.eq("raw_ref", rawRef);
  }
  if (metadataMatch) {
    query = query.contains("metadata", metadataMatch);
  }

  const { data, error } = await query;
  if (error || !data?.length) return null;

  const snapshot = data[0];
  const ageMs = Date.now() - new Date(snapshot.created_at).getTime();
  if (ageMs > 24 * 60 * 60 * 1000 && input.reuseExistingSnapshots !== true) return null; // 24-hour cache window

  return snapshot;
}

async function getCachedEvidenceItems(db: any, snapshotId: string) {
  const { data, error } = await db
    .from("evidence_items")
    .select("*")
    .eq("source_snapshot_id", snapshotId);
  if (error) return [];
  return data ?? [];
}

// -----------------------------------------------------------------------------
// Tool Implementations
// -----------------------------------------------------------------------------
export async function executeDiscoveryTool(
  db: any,
  input: DiscoveryToolInput,
  name: string,
  args: Record<string, unknown>,
) {
  if (name === "chartmetric_artist_enrich") return chartmetricArtistEnrich(db, input, args);
  if (name === "chartmetric_track_enrich") return chartmetricTrackEnrich(db, input, args);
  if (name === "chartmetric_project_enrich") return chartmetricProjectEnrich(db, input, args);
  if (name === "write_strategic_memory") return writeStrategicMemory(db, input, args);
  if (name === "save_public_evidence") return savePublicEvidence(db, input, args);
  throw new Error(`Unsupported discovery tool: ${name}`);
}

// 1. Chartmetric Artist Enrichment Tool
async function chartmetricArtistEnrich(db: any, input: DiscoveryToolInput, args: Record<string, unknown>) {
  const spotifyArtistId = String(args.spotifyArtistId ?? "").trim();
  if (!spotifyArtistId) {
    throw new Error("chartmetric_artist_enrich requires spotifyArtistId");
  }

  // Check Cache
  const cached = await checkCachedSnapshot(db, input, "chartmetric_artist_enrichment");
  if (cached) {
    const items = await getCachedEvidenceItems(db, cached.id);
    return {
      status: "cached",
      snapshotId: cached.id,
      evidenceCount: items.length,
      evidence: items,
    };
  }

  // Fetch Live
  const providerId = await getChartmetricProvider(db);
  const chartmetric = createChartmetricClient({
    refreshToken: Deno.env.get("CHARTMETRIC_REFRESH_TOKEN") ?? "",
    baseUrl: Deno.env.get("CHARTMETRIC_BASE_URL") ?? undefined,
  });

  const cmId = await resolveArtistId(spotifyArtistId, chartmetric).catch((error) => {
    throw new Error(`Chartmetric artist ID lookup failed: ${readErrorMessage(error)}`);
  });
  if (!cmId) {
    throw new Error(`Could not resolve Chartmetric Artist ID from Spotify ID: ${spotifyArtistId}`);
  }

  const res = await chartmetric.requestJson<Record<string, unknown>>(`/api/artist/${cmId}`);
  const snapshotId = await writeSourceSnapshot(db, input, {
    providerId,
    sourceConnectionId: await getOrCreateConnection(db, input, providerId, cmId, "artist"),
    snapshotType: "chartmetric_artist_enrichment",
    rawRef: cmId,
    rawPayload: res.data,
    metadata: { provider: "chartmetric", artist_id: input.artistId, chartmetric_artist_id: cmId },
  });

  const evidenceItems = normalizeChartmetricArtistEvidence(res.data, {
    accountId: input.accountId,
    artistWorkspaceId: input.artistWorkspaceId,
    artistId: input.artistId,
    subjectId: input.artistId,
    sourceSnapshotId: snapshotId,
    providerId,
    subjectLabel: String(res.data?.name ?? "artist"),
    rawRef: cmId,
  });

  await writeEvidenceItems(db, evidenceItems);

  return {
    status: "completed",
    snapshotId,
    evidenceCount: evidenceItems.length,
    evidence: evidenceItems,
  };
}

// 2. Chartmetric Track Enrichment Tool
async function chartmetricTrackEnrich(db: any, input: DiscoveryToolInput, args: Record<string, unknown>) {
  const identifiers = await resolveTrackDiscoveryIdentifiers(db, input, args);
  const { spotifyTrackId, isrc, musicItemId, subjectLabel } = identifiers;

  const cached = await checkCachedSnapshot(
    db,
    input,
    "chartmetric_track_enrichment",
    undefined,
    musicItemId ? { music_item_id: musicItemId } : undefined,
  );
  if (cached) {
    const items = await getCachedEvidenceItems(db, cached.id);
    return {
      status: "cached",
      snapshotId: cached.id,
      evidenceCount: items.length,
      evidence: items,
    };
  }

  const providerId = await getChartmetricProvider(db);
  const chartmetric = createChartmetricClient({
    refreshToken: Deno.env.get("CHARTMETRIC_REFRESH_TOKEN") ?? "",
    baseUrl: Deno.env.get("CHARTMETRIC_BASE_URL") ?? undefined,
  });

  let cmId: string | undefined;
  if (spotifyTrackId) {
    const res = await chartmetric.requestJson<any>(`/api/track/spotify/${encodeURIComponent(spotifyTrackId)}/get-ids`).catch((error) => {
      throw new Error(`Chartmetric track ID lookup failed: ${readErrorMessage(error)}`);
    });
    cmId = readChartmetricEntityId(res?.data);
  }
  if (!cmId && isrc) {
    const res = await chartmetric.requestJson<any>(`/api/track/isrc/${encodeURIComponent(isrc)}/get-ids`).catch((error) => {
      throw new Error(`Chartmetric track ID lookup failed: ${readErrorMessage(error)}`);
    });
    cmId = readChartmetricEntityId(res?.data);
  }

  if (!cmId) {
    return { status: "unresolved", evidenceCount: 0 };
  }

  const detail = await chartmetric.requestJson<any>(`/api/track/${cmId}`);
  const mergedPayload = mergeChartmetricTrackPayload(detail.data, await fetchTrackDiscoverySupplementals(cmId, chartmetric));

  const snapshotId = await writeSourceSnapshot(db, input, {
    providerId,
    sourceConnectionId: await getOrCreateConnection(db, input, providerId, cmId, "music_item"),
    snapshotType: "chartmetric_track_enrichment",
    rawRef: cmId,
    rawPayload: mergedPayload,
    metadata: { provider: "chartmetric", music_item_id: musicItemId, chartmetric_track_id: cmId },
  });

  const evidenceItems = normalizeChartmetricTrackEvidence(mergedPayload, {
    accountId: input.accountId,
    artistWorkspaceId: input.artistWorkspaceId,
    artistId: input.artistId,
    musicItemId: musicItemId || undefined,
    sourceSnapshotId: snapshotId,
    providerId,
    subjectLabel: subjectLabel || String(detail.data?.name ?? "track"),
    rawRef: cmId,
  });

  await writeEvidenceItems(db, evidenceItems);

  return {
    status: "completed",
    snapshotId,
    evidenceCount: evidenceItems.length,
    evidence: evidenceItems,
  };
}

// 3. Chartmetric Project Enrichment Tool
async function chartmetricProjectEnrich(db: any, input: DiscoveryToolInput, args: Record<string, unknown>) {
  const identifiers = await resolveProjectDiscoveryIdentifiers(db, input, args);
  const { spotifyAlbumId, upc, musicProjectId, subjectLabel } = identifiers;

  const cached = await checkCachedSnapshot(
    db,
    input,
    "chartmetric_project_enrichment",
    undefined,
    musicProjectId ? { music_project_id: musicProjectId } : undefined,
  );
  if (cached) {
    const items = await getCachedEvidenceItems(db, cached.id);
    return {
      status: "cached",
      snapshotId: cached.id,
      evidenceCount: items.length,
      evidence: items,
    };
  }

  const providerId = await getChartmetricProvider(db);
  const chartmetric = createChartmetricClient({
    refreshToken: Deno.env.get("CHARTMETRIC_REFRESH_TOKEN") ?? "",
    baseUrl: Deno.env.get("CHARTMETRIC_BASE_URL") ?? undefined,
  });

  let cmId: string | undefined;
  if (spotifyAlbumId) {
    const res = await chartmetric.requestJson<any>(`/api/album/spotify/${encodeURIComponent(spotifyAlbumId)}/get-ids`).catch((error) => {
      throw new Error(`Chartmetric project ID lookup failed: ${readErrorMessage(error)}`);
    });
    cmId = readChartmetricEntityId(res?.data);
  }
  if (!cmId && upc) {
    const res = await chartmetric.requestJson<any>(`/api/album/upc/${encodeURIComponent(upc)}/get-ids`).catch((error) => {
      throw new Error(`Chartmetric project ID lookup failed: ${readErrorMessage(error)}`);
    });
    cmId = readChartmetricEntityId(res?.data);
  }

  if (!cmId) {
    return { status: "unresolved", evidenceCount: 0 };
  }

  const detail = await chartmetric.requestJson<any>(`/api/album/${cmId}`);
  const mergedPayload = mergeChartmetricProjectPayload(detail.data, await fetchProjectDiscoverySupplementals(cmId, chartmetric));

  const snapshotId = await writeSourceSnapshot(db, input, {
    providerId,
    sourceConnectionId: await getOrCreateConnection(db, input, providerId, cmId, "music_project"),
    snapshotType: "chartmetric_project_enrichment",
    rawRef: cmId,
    rawPayload: mergedPayload,
    metadata: { provider: "chartmetric", music_project_id: musicProjectId, chartmetric_album_id: cmId },
  });

  const evidenceItems = normalizeChartmetricProjectEvidence(mergedPayload, {
    accountId: input.accountId,
    artistWorkspaceId: input.artistWorkspaceId,
    artistId: input.artistId,
    musicProjectId: musicProjectId || undefined,
    sourceSnapshotId: snapshotId,
    providerId,
    subjectLabel: subjectLabel || String(detail.data?.name ?? "project"),
    rawRef: cmId,
  });

  await writeEvidenceItems(db, evidenceItems);

  return {
    status: "completed",
    snapshotId,
    evidenceCount: evidenceItems.length,
    evidence: evidenceItems,
  };
}

// 4. Memory Writer Tool
async function writeStrategicMemory(db: any, input: DiscoveryToolInput, args: Record<string, unknown>) {
  const scope = normalizeDiscoveryMemoryScope(args.scope);
  const kind = String(args.kind ?? "fact");
  const content = String(args.content ?? "").trim();
  const confidence = String(args.confidence ?? "medium");

  if (!content) {
    throw new Error("write_strategic_memory requires content");
  }

  const { data, error } = await db
    .from("memory_entries")
    .insert({
      account_id: input.accountId,
      artist_workspace_id: input.artistWorkspaceId,
      artist_id: input.artistId,
      scope,
      kind,
      content,
      confidence,
      source_type: "manager_reasoning",
    })
    .select("id")
    .single();

  if (error) throw new Error(readErrorMessage(error));
  return { status: "saved", memoryId: data.id };
}

// 5. Public Evidence Tool
async function savePublicEvidence(db: any, input: DiscoveryToolInput, args: Record<string, unknown>) {
  const url = String(args.url ?? "").trim();
  const title = String(args.title ?? "").trim();
  const claim = String(args.claim ?? "").trim();
  const managementUse = String(args.managementUse ?? "").trim();

  if (!url || !claim) {
    throw new Error("save_public_evidence requires url and claim");
  }

  const { data, error } = await db
    .from("evidence_items")
    .insert({
      account_id: input.accountId,
      artist_workspace_id: input.artistWorkspaceId,
      artist_id: input.artistId,
      source: "public_web",
      source_kind: "public_web",
      evidence_type: "public_career_context",
      subject_type: "artist",
      subject_id: input.artistId,
      subject_label: title || "Public career context",
      metric_name: "public_context",
      metric_value: 1,
      metric_unit: "instance",
      lens: "public_context",
      confidence: "low",
      provenance: url,
      limitation: "Public context only; not private performance metrics.",
      raw_ref: url,
    })
    .select("id")
    .single();

  if (error) throw new Error(readErrorMessage(error));
  return { status: "saved", evidenceId: data.id };
}

// -----------------------------------------------------------------------------
// Shared Discovery Helpers
// -----------------------------------------------------------------------------
async function getChartmetricProvider(db: any) {
  const { data, error } = await db.from("source_providers").select("id").eq("provider_key", "chartmetric").maybeSingle();
  if (error) throw error;
  if (data?.id) return data.id as string;
  throw new Error("Chartmetric source provider is not seeded.");
}

async function getOrCreateConnection(db: any, input: DiscoveryToolInput, providerId: string, cmId: string, scope: string) {
  const { data: existing, error: existingError } = await db
    .from("source_connections")
    .select("id")
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("provider_id", providerId)
    .eq("handle_or_external_ref", cmId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing?.id) return existing.id as string;

  const { data, error } = await db
    .from("source_connections")
    .insert({
      account_id: input.accountId,
      artist_workspace_id: input.artistWorkspaceId,
      artist_id: input.artistId,
      provider_id: providerId,
      handle_or_external_ref: cmId,
      status: "connected",
      limitations: ["Chartmetric direct connection."],
      metadata: { target_scope: scope, chartmetric_id: cmId },
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function writeSourceSnapshot(db: any, input: DiscoveryToolInput, draft: any) {
  const { data, error } = await db
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

async function writeEvidenceItems(db: any, items: any[]) {
  if (!items.length) return;
  const { error } = await db.from("evidence_items").insert(items);
  if (error) throw error;
}

async function resolveArtistId(spotifyArtistId: string, chartmetric: any) {
  const res = await chartmetric.requestJson(`/api/artist/spotify/${encodeURIComponent(spotifyArtistId)}/get-ids`);
  return readChartmetricEntityId(res?.data);
}

async function resolveTrackDiscoveryIdentifiers(db: any, input: DiscoveryToolInput, args: Record<string, unknown>) {
  const musicItemId = String(args.musicItemId ?? "").trim();
  if (!musicItemId) {
    throw new Error("chartmetric_track_enrich requires musicItemId so evidence is attached to the correct track.");
  }

  const [identifiers, musicItem] = await Promise.all([
    loadMusicIdentifiers(db, input, { musicItemId }),
    loadMusicItemIdentity(db, input, musicItemId),
  ]);
  const spotifyTrackId =
    findIdentifier(identifiers, "spotify_track_id") ||
    readNestedString(musicItem?.metadata, ["spotify", "track_id"]) ||
    readNestedString(musicItem?.metadata, ["spotify_track_id"]) ||
    readNestedString(musicItem?.metadata, ["id"]);
  const isrc =
    findIdentifier(identifiers, "isrc") ||
    readNestedString(musicItem?.metadata, ["spotify", "isrc"]) ||
    readNestedString(musicItem?.metadata, ["external_ids", "isrc"]);
  if (!spotifyTrackId && !isrc) {
    throw new Error("chartmetric_track_enrich requires musicItemId with a spotify_track_id or isrc identifier.");
  }

  return {
    musicItemId,
    spotifyTrackId,
    isrc,
    subjectLabel: typeof musicItem?.title === "string" ? musicItem.title : "",
  };
}

async function loadMusicItemIdentity(db: any, input: DiscoveryToolInput, musicItemId: string) {
  const { data, error } = await db
    .from("music_items")
    .select("title,metadata")
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("artist_id", input.artistId)
    .eq("id", musicItemId)
    .maybeSingle();
  if (error) throw new Error(readErrorMessage(error));
  return data;
}

async function resolveProjectDiscoveryIdentifiers(db: any, input: DiscoveryToolInput, args: Record<string, unknown>) {
  const musicProjectId = String(args.musicProjectId ?? "").trim();
  if (!musicProjectId) {
    throw new Error("chartmetric_project_enrich requires musicProjectId so evidence is attached to the correct project.");
  }

  const [identifiers, musicProject] = await Promise.all([
    loadMusicIdentifiers(db, input, { musicProjectId }),
    loadMusicProjectIdentity(db, input, musicProjectId),
  ]);
  const spotifyAlbumId =
    findIdentifier(identifiers, "spotify_album_id") ||
    readNestedString(musicProject?.metadata, ["spotify", "album_id"]) ||
    readNestedString(musicProject?.metadata, ["spotify_album_id"]) ||
    readNestedString(musicProject?.metadata, ["id"]);
  const upc =
    findIdentifier(identifiers, "upc") ||
    readNestedString(musicProject?.metadata, ["spotify", "upc"]) ||
    readNestedString(musicProject?.metadata, ["external_ids", "upc"]);
  if (!spotifyAlbumId && !upc) {
    throw new Error("chartmetric_project_enrich requires musicProjectId with a spotify_album_id or upc identifier.");
  }

  return {
    musicProjectId,
    spotifyAlbumId,
    upc,
    subjectLabel: typeof musicProject?.title === "string" ? musicProject.title : "",
  };
}

async function loadMusicProjectIdentity(db: any, input: DiscoveryToolInput, musicProjectId: string) {
  const { data, error } = await db
    .from("music_projects")
    .select("title,metadata")
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("artist_id", input.artistId)
    .eq("id", musicProjectId)
    .maybeSingle();
  if (error) throw new Error(readErrorMessage(error));
  return data;
}

async function loadMusicIdentifiers(
  db: any,
  input: DiscoveryToolInput,
  subject: { musicItemId?: string; musicProjectId?: string },
): Promise<NormalizedIdentifier[]> {
  const musicItemId = subject.musicItemId;
  const musicProjectId = subject.musicProjectId;
  let query = db
    .from("music_identifiers")
    .select("identifier_type,identifier_value")
    .eq("account_id", input.accountId)
    .eq("artist_workspace_id", input.artistWorkspaceId)
    .eq("artist_id", input.artistId);

  if (musicItemId) query = query.eq("music_item_id", musicItemId);
  if (musicProjectId) query = query.eq("music_project_id", musicProjectId);

  const { data, error } = await query;
  if (error) throw new Error(readErrorMessage(error));

  return ((data ?? []) as Array<{ identifier_type?: string; identifier_value?: string }>).flatMap((identifier) => {
    if (!identifier.identifier_type || !identifier.identifier_value) return [];
    return [{ identifierType: identifier.identifier_type, identifierValue: identifier.identifier_value }];
  });
}

function findIdentifier(identifiers: NormalizedIdentifier[], identifierType: string) {
  return identifiers.find((identifier) => identifier.identifierType === identifierType)?.identifierValue;
}

function readNestedString(value: unknown, path: string[]) {
  let current = value;
  for (const segment of path) {
    if (!isRecord(current)) return "";
    current = current[segment];
  }
  return typeof current === "string" && current.trim() ? current.trim() : "";
}

async function fetchTrackDiscoverySupplementals(cmTrackId: string, chartmetric: any): Promise<ChartmetricTrackSupplementals> {
  const until = new Date().toISOString().split("T")[0];
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const timeParams = `since=${since}&until=${until}`;
  const id = encodeURIComponent(cmTrackId);
  const supplementalErrors: Record<string, string> = {};

  const entries = await Promise.allSettled([
    chartmetric.requestJson(`/api/track/${id}/spotify/stats/highest-playcounts?${timeParams}&type=streams`),
    chartmetric.requestJson(`/api/track/${id}/tiktok/stats/most-history?${timeParams}&type=posts`),
    chartmetric.requestJson(`/api/track/${id}/spotify/playlists/snapshot?date=${until}&limit=100`),
    chartmetric.requestJson(`/api/track/${id}/spotify/top/charts?${timeParams}`),
    chartmetric.requestJson(`/api/track/${id}/spotify/viral/charts?${timeParams}`),
  ]);
  const names = ["spotifyStats", "tiktokStats", "playlistSnapshot", "spotifyTopCharts", "spotifyViralCharts"] as const;
  const output: Partial<Record<typeof names[number], unknown>> = {};
  entries.forEach((entry, index) => {
    const name = names[index];
    if (entry.status === "fulfilled") output[name] = entry.value;
    else supplementalErrors[name] = readErrorMessage(entry.reason);
  });

  return {
    spotifyStats: output.spotifyStats,
    tiktokStats: output.tiktokStats,
    playlistSnapshot: output.playlistSnapshot,
    spotifyTopCharts: output.spotifyTopCharts,
    spotifyViralCharts: output.spotifyViralCharts,
    fetchWindow: { since, until },
    supplementalErrors,
  };
}

async function fetchProjectDiscoverySupplementals(cmAlbumId: string, chartmetric: any): Promise<ChartmetricProjectSupplementals> {
  const until = new Date().toISOString().split("T")[0];
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const timeParams = `since=${since}&until=${until}`;
  const id = encodeURIComponent(cmAlbumId);
  const supplementalErrors: Record<string, string> = {};

  const entries = await Promise.allSettled([
    chartmetric.requestJson(`/api/album/${id}/spotify/followers?${timeParams}`),
    chartmetric.requestJson(`/api/album/${id}/spotify/current/playlists?${timeParams}&limit=100&editorial=false&showPositionStats=true`),
    chartmetric.requestJson(`/api/album/${id}/tracks`),
  ]);
  const names = ["spotifyPopularity", "playlistSnapshot", "albumTracks"] as const;
  const output: Partial<Record<typeof names[number], unknown>> = {};
  entries.forEach((entry, index) => {
    const name = names[index];
    if (entry.status === "fulfilled") output[name] = entry.value;
    else supplementalErrors[name] = readErrorMessage(entry.reason);
  });

  return {
    spotifyPopularity: output.spotifyPopularity,
    playlistSnapshot: output.playlistSnapshot,
    albumTracks: output.albumTracks,
    fetchWindow: { since, until },
    supplementalErrors,
  };
}

export function normalizeDiscoveryMemoryScope(value: unknown) {
  const scope = typeof value === "string" ? value.trim() : "";
  if (["music_item", "music_project", "mission", "conversation", "task", "checkpoint", "source", "run"].includes(scope)) {
    return scope;
  }
  return "artist";
}

export function classifyDiscoveryCompletion(input: {
  catalogHasAssets: boolean;
  toolResults: Array<{ name: string; result: unknown }>;
  failedTools: Array<{ tool: string; summary: string }>;
}) {
  const successfulStatuses = new Set(["completed", "cached"]);
  const resultStatus = (result: unknown) =>
    isRecord(result) && typeof result.status === "string" ? result.status : "";
  const artistResults = input.toolResults.filter(({ name }) => name === "chartmetric_artist_enrich");
  const assetResults = input.toolResults.filter(({ name }) =>
    name === "chartmetric_track_enrich" || name === "chartmetric_project_enrich"
  );
  const limitations = [
    ...input.failedTools.map(({ tool, summary }) => ({ tool, summary })),
    ...assetResults
      .filter(({ result }) => resultStatus(result) === "unresolved")
      .map(({ name }) => ({
        tool: name,
        summary: "Provider intelligence could not be matched for this focus asset.",
      })),
  ];
  const artistSucceeded =
    artistResults.some(({ result }) => successfulStatuses.has(resultStatus(result))) &&
    !input.failedTools.some(({ tool }) => tool === "chartmetric_artist_enrich");

  if (!artistSucceeded) {
    return {
      status: "failed" as const,
      limitations,
      error: "Required artist intelligence failed; discovery cannot complete without provider-backed artist enrichment.",
    };
  }

  const assetSucceeded = assetResults.some(({ result }) => successfulStatuses.has(resultStatus(result)));
  if (input.catalogHasAssets && !assetSucceeded) {
    return {
      status: "failed" as const,
      limitations,
      error: "Required focus-asset intelligence failed; discovery cannot complete without any matched catalog assets.",
    };
  }

  return {
    status: limitations.length ? "completed_with_limits" as const : "completed" as const,
    limitations,
  };
}

export function readChartmetricEntityId(payload: unknown): string | undefined {
  if (!isRecord(payload)) return undefined;
  const obj = "obj" in payload ? payload.obj : payload;
  const candidate = Array.isArray(obj) ? obj.find(isRecord) : obj;
  if (!isRecord(candidate)) return undefined;

  const chartmetricIds = Array.isArray(candidate.chartmetric_ids) ? candidate.chartmetric_ids : [];

  const id =
    candidate.cm_artist ??
    candidate.cm_track ??
    candidate.cm_album ??
    candidate.chartmetric_id ??
    candidate.id ??
    chartmetricIds[0];
  return id === undefined ? undefined : String(id);
}

function readErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (isRecord(error) && typeof error.message === "string") return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown tool error.";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
