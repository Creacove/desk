import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const functionSource = readFileSync(join(process.cwd(), "supabase", "functions", "chartmetric-track-enrichment", "index.ts"), "utf8");

describe("Chartmetric track enrichment edge function", () => {
  it("authenticates and checks account membership before provider calls", () => {
    expect(functionSource).toContain("Deno.serve");
    expect(functionSource).toContain("Authorization");
    expect(functionSource).toContain("auth.getUser()");
    expect(functionSource).toContain("is_account_member");
    expect(functionSource).toContain("Unauthorized");

    const authIndex = functionSource.indexOf("auth.getUser()");
    const chartmetricIndex = functionSource.indexOf("const chartmetric = createChartmetricClient");
    expect(authIndex).toBeGreaterThan(-1);
    expect(chartmetricIndex).toBeGreaterThan(authIndex);
  });

  it("allows exact secret-token invocations for controlled backfills", () => {
    expect(functionSource).toContain("isServiceRoleInvocation");
    expect(functionSource).toContain("X-Chartmetric-Backfill-Token");
    expect(functionSource).toContain('Deno.env.get("CHARTMETRIC_BACKFILL_TOKEN")');
    expect(functionSource).toContain('requireEnv("SUPABASE_SERVICE_ROLE_KEY")');
    expect(functionSource).toContain("if (!isServiceRoleInvocation)");
  });

  it("accepts a single scoped music item request with optional Chartmetric identifiers", () => {
    expect(functionSource).toContain("type TrackEnrichmentInput");
    expect(functionSource).toContain("accountId: string");
    expect(functionSource).toContain("artistWorkspaceId: string");
    expect(functionSource).toContain("artistId: string");
    expect(functionSource).toContain("musicItemId: string");
    expect(functionSource).toContain("sourceSyncJobId?: string");
    expect(functionSource).toContain("sourceConnectionId?: string");
    expect(functionSource).toContain("chartmetricArtistId?: string");
    expect(functionSource).toContain("chartmetricTrackId?: string");
    expect(functionSource).not.toContain("providerPath");
  });

  it("loads the Music item and identifiers before building the Chartmetric request", () => {
    expect(functionSource).toContain("loadQueuedJobContext");
    expect(functionSource).toContain('from("source_sync_jobs")');
    expect(functionSource).toContain('from("source_connections")');
    expect(functionSource).toContain('from("music_items")');
    expect(functionSource).toContain('from("music_identifiers")');
    expect(functionSource).toContain('identifier_type,identifier_value');
    expect(functionSource).toContain("resolveChartmetricTrackId");

    const musicReadIndex = functionSource.indexOf("const musicItem = await loadMusicItem");
    const identifierReadIndex = functionSource.indexOf("const identifiers = await loadIdentifiers");
    const chartmetricPathIndex = functionSource.indexOf("resolveChartmetricTrackId(identifiers, meteredChartmetric");
    expect(chartmetricPathIndex).toBeGreaterThan(musicReadIndex);
    expect(chartmetricPathIndex).toBeGreaterThan(identifierReadIndex);
  });

  it("stores raw Chartmetric track snapshots and job events without directly mutating visible Music fields", () => {
    expect(functionSource).toContain('job_type: "chartmetric_track_enrichment"');
    expect(functionSource).toContain('snapshot_type: "chartmetric_track_enrichment"');
    expect(functionSource).toContain("raw_payload");
    expect(functionSource).toContain("chartmetric_track_enrichment_started");
    expect(functionSource).toContain("chartmetric_track_enrichment_completed");
    expect(functionSource).toContain("chartmetric_track_enrichment_failed");
    expect(functionSource).not.toContain('.from("music_items").update');
    expect(functionSource).not.toContain("manager_next_move");
  });

  it("records paid Chartmetric request usage for the enrichment job", () => {
    expect(functionSource).toContain('from("ai_run_usage_events")');
    expect(functionSource).toContain('provider: "chartmetric"');
    expect(functionSource).toContain('operation_key: "chartmetric_track_enrichment"');
    expect(functionSource).toContain("provider_request_count");
    expect(functionSource).toContain("requestCount");
  });

  it("normalizes Chartmetric evidence only after the raw snapshot exists", () => {
    expect(functionSource).toContain("../_shared/chartmetricEvidence.ts");
    expect(functionSource).toContain("normalizeChartmetricTrackEvidence");
    expect(functionSource).toContain("writeEvidenceItems");
    expect(functionSource).toContain('from("evidence_items")');

    const snapshotIndex = functionSource.indexOf("const snapshotId = await writeSourceSnapshot");
    const normalizeIndex = functionSource.indexOf("normalizeChartmetricTrackEvidence(enrichedPayload");
    expect(snapshotIndex).toBeGreaterThan(-1);
    expect(normalizeIndex).toBeGreaterThan(snapshotIndex);
  });

  it("hands off to the Manager Read generator after normalized evidence is written", () => {
    expect(functionSource).toContain("invokeManagerReadGeneration");
    expect(functionSource).toContain("generate-music-summary");
    expect(functionSource).toContain('subjectType: "music_item"');

    const evidenceIndex = functionSource.indexOf("await writeEvidenceItems(authClient, evidenceItems)");
    const managerReadIndex = functionSource.indexOf("await invokeManagerReadGeneration(authHeader, input");
    expect(evidenceIndex).toBeGreaterThan(-1);
    expect(managerReadIndex).toBeGreaterThan(evidenceIndex);
  });

  it("requires exact track identity before requesting the detail endpoint from search results", () => {
    expect(functionSource).toContain("createChartmetricClient");
    expect(functionSource).toContain("resolveChartmetricTrackId");
    expect(functionSource).toContain("fetchTrackSupplementals");
    expect(functionSource).toContain("/api/track/spotify/");
    expect(functionSource).toContain("/api/track/isrc/");
    expect(functionSource).toContain("chartmetric_ids");
    expect(functionSource).toContain('findIdentifier(identifiers, "spotify_track_id")');
    expect(functionSource).toContain('findIdentifier(identifiers, "isrc")');
    expect(functionSource).toContain('`/api/track/${encodeURIComponent(resolution.id)}`');
    expect(functionSource).not.toContain('searchParams.set("type", "tracks")');
    expect(functionSource).not.toContain('searchParams.set("limit", "5")');
    expect(functionSource).not.toContain('resolveVerifiedChartmetricTrackId');
    expect(functionSource).not.toContain('matchesTrackIdentity');
    expect(functionSource).not.toContain('searchParams.set("spotify_track_id"');
    expect(functionSource).not.toContain('searchParams.set("isrc"');
  });

  it("uses the documented Chartmetric track intelligence endpoints", () => {
    expect(functionSource).toContain("/spotify/stats/highest-playcounts?");
    expect(functionSource).toContain("type=streams");
    expect(functionSource).toContain("/tiktok/stats/most-history?");
    expect(functionSource).toContain("type=posts");
    expect(functionSource).toContain("/spotify/playlists/snapshot?");
    expect(functionSource).toContain("/spotify_top_daily/charts?");
    expect(functionSource).toContain("/spotify_viral_daily/charts?");
    expect(functionSource).not.toContain("/stat/spotify");
    expect(functionSource).not.toContain("/playlist/snapshot?spotify=true");
    expect(functionSource).not.toContain("/chart/spotify");
  });

  it("preserves supplemental endpoint failures in the saved snapshot metadata", () => {
    expect(functionSource).toContain("supplementalErrors");
    expect(functionSource).toContain("supplemental_errors");
    expect(functionSource).toContain("completed_with_limits");
  });

  it("records an unresolved result instead of storing misleading track evidence when no exact identity match exists", () => {
    expect(functionSource).toContain("chartmetric_track_enrichment_unresolved");
    expect(functionSource).toContain("No exact Chartmetric track match");
    expect(functionSource).toContain('status: "unresolved"');
    expect(functionSource).toContain("return json({");
  });

  it("reads the seeded Chartmetric provider instead of inserting reference data with the authenticated client", () => {
    expect(functionSource).toContain("getChartmetricProvider");
    expect(functionSource).not.toContain("getOrCreateChartmetricProvider");
    expect(functionSource).not.toContain('from("source_providers")\n    .insert');
  });
});
