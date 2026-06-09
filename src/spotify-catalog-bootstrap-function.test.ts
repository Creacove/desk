import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { createSupabaseCatalogRepository } from "../supabase/functions/_shared/supabaseCatalogRepository";

const functionSource = readFileSync(join(process.cwd(), "supabase", "functions", "spotify-catalog-bootstrap", "index.ts"), "utf8");

describe("Spotify catalog bootstrap edge function", () => {
  it("uses the shared catalog importer and avoids deprecated top-tracks fallback", () => {
    expect(functionSource).toContain("../_shared/spotifyCatalogBootstrap.ts");
    expect(functionSource).toContain("bootstrapSpotifyCatalog");
    expect(functionSource).toContain("createSupabaseCatalogRepository");
    expect(functionSource).not.toContain("top-tracks");
    expect(functionSource).not.toContain("getArtistTopTracks");
    expect(functionSource).toContain('include_groups: options.includeGroup');
  });

  it("queues Chartmetric setup enrichment after the Spotify catalog import without failing setup", () => {
    const bootstrapIndex = functionSource.indexOf("const result = await bootstrapSpotifyCatalog");
    const queueIndex = functionSource.indexOf("queueChartmetricSetupEnrichment");
    const returnIndex = functionSource.indexOf("return json(result");

    expect(queueIndex).toBeGreaterThan(bootstrapIndex);
    expect(returnIndex).toBeGreaterThan(queueIndex);
    expect(functionSource).toContain("chartmetric-setup-enrichment");
    expect(functionSource).toContain("spotifyArtistId: input.selectedArtist.spotifyArtistId");
    expect(functionSource).toContain("artistName: input.selectedArtist.name");
    expect(functionSource).toContain("maxStandaloneSongs: 5");
    expect(functionSource).toContain(".catch(async (error)");
    expect(functionSource).toContain("chartmetric setup enrichment queue failed");
  });

  it("records Chartmetric queue failures as operating events so successful Spotify imports do not hide them", () => {
    expect(functionSource).toContain("recordChartmetricQueueFailure");
    expect(functionSource).toContain("chartmetric_setup_enrichment_queue_failed");
    expect(functionSource).toContain('source_type: "source_sync_job"');
  });

  it("persists catalog drafts into Supabase table payloads", async () => {
    const tables: Record<string, Array<Record<string, unknown>>> = {
      source_providers: [{ id: "provider-spotify", provider_key: "spotify" }],
      artists: [{ id: "artist-1", account_id: "account-1", display_name: "Old Name" }],
      artist_profiles: [{ id: "profile-1", account_id: "account-1", artist_workspace_id: "workspace-1", artist_id: "artist-1" }],
      source_connections: [],
      source_sync_jobs: [],
      source_snapshots: [],
      music_projects: [],
      music_items: [],
      music_project_items: [],
      music_identifiers: [],
      operating_events: [],
    };
    const repository = createSupabaseCatalogRepository(createMutableClient(tables), {
      accountId: "account-1",
      artistWorkspaceId: "workspace-1",
      artistId: "artist-1",
    });

    const providerId = await repository.getSpotifyProviderId();
    await repository.saveArtistSpotifyIdentity({
      spotifyArtistId: "spotify-artist-1",
      name: "Nova Vale",
      spotifyUrl: "https://open.spotify.com/artist/spotify-artist-1",
      spotifyUri: "spotify:artist:spotify-artist-1",
      imageUrl: "https://i.scdn.co/image/artist",
      followers: 42000,
      genres: ["afro-fusion"],
    });
    const sourceConnectionId = await repository.upsertSourceConnection({
      accountId: "account-1",
      artistWorkspaceId: "workspace-1",
      artistId: "artist-1",
      providerId,
      handleOrExternalRef: "spotify-artist-1",
      status: "connected",
      limitations: ["public catalog only"],
      metadata: { spotify_artist_id: "spotify-artist-1" },
    });
    const sourceSyncJobId = await repository.createSourceSyncJob({
      accountId: "account-1",
      artistWorkspaceId: "workspace-1",
      artistId: "artist-1",
      sourceConnectionId,
      jobType: "spotify_catalog_bootstrap",
      triggerType: "setup",
      status: "running",
    });
    const snapshotId = await repository.writeSourceSnapshot({
      accountId: "account-1",
      artistWorkspaceId: "workspace-1",
      artistId: "artist-1",
      sourceConnectionId,
      providerId,
      sourceKind: "official_api",
      snapshotType: "spotify_album",
      rawRef: "spotify:album:album-1",
      rawPayload: { id: "album-1", name: "Night Bus" },
      metadata: { provider: "spotify", snapshot_type: "spotify_album" },
    });
    const projectId = await repository.createMusicProject({
      accountId: "account-1",
      artistWorkspaceId: "workspace-1",
      artistId: "artist-1",
      title: "Night Bus",
      projectType: "album",
      lifecycleStage: "released",
      sourceKind: "spotify_public_catalog",
      sourceLimit: "public catalog only",
      dedupeKey: "spotify_album_id:album-1",
      metadata: { dedupe_key: "spotify_album_id:album-1", spotify: { album_id: "album-1" } },
      releasedAt: "2026-04-12T00:00:00.000Z",
      createdByType: "integration",
    });
    const itemId = await repository.createMusicItem({
      accountId: "account-1",
      artistWorkspaceId: "workspace-1",
      artistId: "artist-1",
      title: "Night Bus",
      itemType: "released_track",
      lifecycleStage: "released",
      sourceKind: "spotify_public_catalog",
      sourceLimit: "public catalog only",
      dedupeKey: "spotify_track_id:track-1",
      metadata: { dedupe_key: "spotify_track_id:track-1", spotify: { track_id: "track-1" } },
      releasedAt: "2026-04-12T00:00:00.000Z",
      createdByType: "integration",
    });
    await repository.upsertMusicProjectItem({
      musicProjectId: projectId,
      musicItemId: itemId,
      orderIndex: 1,
      discNumber: 1,
      displayTitle: "Night Bus",
    });
    await repository.upsertMusicIdentifier({
      accountId: "account-1",
      artistWorkspaceId: "workspace-1",
      artistId: "artist-1",
      musicItemId: itemId,
      identifierType: "spotify_track_id",
      identifierValue: "track-1",
      dedupeKey: "spotify_track_id:track-1",
      providerId,
      sourceSnapshotId: snapshotId,
      confidence: "medium",
    });
    await repository.updateSourceSyncJob(sourceSyncJobId, { status: "completed" });

    expect(tables.artists[0]).toMatchObject({
      display_name: "Nova Vale",
      canonical_spotify_artist_id: "spotify-artist-1",
    });
    expect(tables.artist_profiles[0].spotify_identity).toMatchObject({
      id: "spotify-artist-1",
      image_url: "https://i.scdn.co/image/artist",
    });
    expect(tables.source_snapshots[0]).toMatchObject({
      snapshot_type: "spotify_album",
      raw_payload: { id: "album-1", name: "Night Bus" },
    });
    expect(tables.music_projects[0]).toMatchObject({
      title: "Night Bus",
      source_kind: "spotify_public_catalog",
      metadata: { dedupe_key: "spotify_album_id:album-1", spotify: { album_id: "album-1" } },
    });
    expect(tables.music_items[0]).toMatchObject({
      title: "Night Bus",
      item_type: "released_track",
      metadata: { dedupe_key: "spotify_track_id:track-1", spotify: { track_id: "track-1" } },
    });
    expect(tables.music_project_items[0]).toMatchObject({
      music_project_id: projectId,
      music_item_id: itemId,
      order_index: 1,
    });
    expect(tables.music_identifiers[0]).toMatchObject({
      music_item_id: itemId,
      identifier_type: "spotify_track_id",
      identifier_value: "track-1",
    });
    expect(tables.source_sync_jobs[0]).toMatchObject({
      status: "completed",
      completed_at: expect.any(String),
    });
  });
});

function createMutableClient(tables: Record<string, Array<Record<string, unknown>>>) {
  return {
    from(table: string) {
      return mutableQuery(table, tables);
    },
  };
}

function mutableQuery(table: string, tables: Record<string, Array<Record<string, unknown>>>) {
  const filters: Array<{ key: string; value: unknown }> = [];
  let mode: "select" | "insert" | "update" | "upsert" = "select";
  let payload: Record<string, unknown> | null = null;
  let limitCount: number | undefined;

  const query = {
    select: () => query,
    eq: (key: string, value: unknown) => {
      filters.push({ key, value });
      return query;
    },
    limit: (count: number) => {
      limitCount = count;
      return query;
    },
    insert: (nextPayload: Record<string, unknown>) => {
      mode = "insert";
      payload = nextPayload;
      return query;
    },
    update: (nextPayload: Record<string, unknown>) => {
      mode = "update";
      payload = nextPayload;
      return query;
    },
    upsert: (nextPayload: Record<string, unknown>) => {
      mode = "upsert";
      payload = nextPayload;
      return query;
    },
    maybeSingle: () => execute().then(({ data, error }) => ({ data: Array.isArray(data) ? data[0] ?? null : data, error })),
    single: () => execute().then(({ data, error }) => ({ data: Array.isArray(data) ? data[0] : data, error })),
    then: (resolve: (value: { data: unknown[]; error: null }) => unknown, reject: (reason: unknown) => unknown) => execute().then(resolve, reject),
  };

  function matchingRows() {
    const rows = tables[table] ?? [];
    const matched = rows.filter((row) => filters.every((filter) => row[filter.key] === filter.value));
    return typeof limitCount === "number" ? matched.slice(0, limitCount) : matched;
  }

  async function execute() {
    tables[table] = tables[table] ?? [];

    if (mode === "insert" || mode === "upsert") {
      const row = {
        id: `${table.slice(0, -1)}-${tables[table].length + 1}`,
        ...payload,
      };
      tables[table].push(row);
      return { data: [row], error: null };
    }

    if (mode === "update") {
      const rows = matchingRows();
      rows.forEach((row) => Object.assign(row, payload));
      return { data: rows, error: null };
    }

    return { data: matchingRows(), error: null };
  }

  return query;
}
