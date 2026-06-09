import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const functionSource = readFileSync(join(process.cwd(), "supabase", "functions", "chartmetric-project-enrichment", "index.ts"), "utf8");

describe("Chartmetric project enrichment edge function", () => {
  it("authenticates and checks account membership before provider calls", () => {
    expect(functionSource).toContain("Deno.serve");
    expect(functionSource).toContain("Authorization");
    expect(functionSource).toContain("auth.getUser()");
    expect(functionSource).toContain("is_account_member");

    const authIndex = functionSource.indexOf("auth.getUser()");
    const chartmetricIndex = functionSource.indexOf("const chartmetric = createChartmetricClient");
    expect(authIndex).toBeGreaterThan(-1);
    expect(chartmetricIndex).toBeGreaterThan(authIndex);
  });

  it("accepts a scoped project enrichment request and consumes queued setup jobs", () => {
    expect(functionSource).toContain("type ProjectEnrichmentInput");
    expect(functionSource).toContain("accountId: string");
    expect(functionSource).toContain("artistWorkspaceId: string");
    expect(functionSource).toContain("artistId: string");
    expect(functionSource).toContain("musicProjectId: string");
    expect(functionSource).toContain("sourceSyncJobId?: string");
    expect(functionSource).toContain("sourceConnectionId?: string");
    expect(functionSource).toContain("chartmetricProjectId?: string");
    expect(functionSource).not.toContain("providerPath");
  });

  it("loads the project, project identifiers, and tracklist before building the Chartmetric request", () => {
    expect(functionSource).toContain('from("music_projects")');
    expect(functionSource).toContain('from("music_identifiers")');
    expect(functionSource).toContain('from("music_project_items")');
    expect(functionSource).toContain("loadMusicProject");
    expect(functionSource).toContain("loadProjectIdentifiers");
    expect(functionSource).toContain("loadProjectTracklist");
    expect(functionSource).toContain("resolveChartmetricProjectId");

    const projectIndex = functionSource.indexOf("const musicProject = await loadMusicProject");
    const identifierIndex = functionSource.indexOf("const identifiers = await loadProjectIdentifiers");
    const tracklistIndex = functionSource.indexOf("const tracklist = await loadProjectTracklist");
    const pathIndex = functionSource.indexOf("resolveChartmetricProjectId(");
    expect(pathIndex).toBeGreaterThan(projectIndex);
    expect(pathIndex).toBeGreaterThan(identifierIndex);
    expect(pathIndex).toBeGreaterThan(tracklistIndex);
  });

  it("stores raw Chartmetric project snapshots, normalized evidence, and job events without directly mutating visible Music fields", () => {
    expect(functionSource).toContain('job_type: "chartmetric_project_enrichment"');
    expect(functionSource).toContain('snapshot_type: "chartmetric_project_enrichment"');
    expect(functionSource).toContain("raw_payload");
    expect(functionSource).toContain("normalizeChartmetricProjectEvidence");
    expect(functionSource).toContain('from("evidence_items")');
    expect(functionSource).toContain("chartmetric_project_enrichment_started");
    expect(functionSource).toContain("chartmetric_project_enrichment_completed");
    expect(functionSource).toContain("chartmetric_project_enrichment_failed");
    expect(functionSource).not.toContain('.from("music_projects").update');
  });

  it("hands off to the Manager Read generator after normalized evidence is written", () => {
    expect(functionSource).toContain("invokeManagerReadGeneration");
    expect(functionSource).toContain("generate-music-summary");
    expect(functionSource).toContain('subjectType: "music_project"');

    const evidenceIndex = functionSource.indexOf("await writeEvidenceItems(authClient, evidenceItems)");
    const managerReadIndex = functionSource.indexOf("await invokeManagerReadGeneration(authHeader, input");
    expect(evidenceIndex).toBeGreaterThan(-1);
    expect(managerReadIndex).toBeGreaterThan(evidenceIndex);
  });

  it("requires exact release identity before requesting the detail endpoint from search results", () => {
    expect(functionSource).toContain("resolveChartmetricProjectId");
    expect(functionSource).toContain("fetchProjectSupplementals");
    expect(functionSource).toContain("/api/album/spotify/");
    expect(functionSource).toContain("/api/album/upc/");
    expect(functionSource).toContain("cm_album");
    expect(functionSource).toContain('findIdentifier(identifiers, "spotify_album_id")');
    expect(functionSource).toContain('findIdentifier(identifiers, "upc")');
    expect(functionSource).toContain('`/api/album/${encodeURIComponent(resolution.id)}`');
    expect(functionSource).not.toContain('searchParams.set("type", "albums")');
    expect(functionSource).not.toContain('searchParams.set("limit", "5")');
    expect(functionSource).not.toContain('resolveVerifiedChartmetricProjectId');
    expect(functionSource).not.toContain('matchesProjectIdentity');
    expect(functionSource).not.toContain('searchParams.set("spotify_album_id"');
    expect(functionSource).not.toContain('searchParams.set("upc"');
  });

  it("uses documented album intelligence endpoints without labeling popularity as streams", () => {
    expect(functionSource).toContain("/spotify/followers?");
    expect(functionSource).toContain("/spotify/current/playlists?");
    expect(functionSource).toContain("/tracks");
    expect(functionSource).toContain("mergeChartmetricProjectPayload");
    expect(functionSource).not.toContain("/stat/spotify");
    expect(functionSource).not.toContain("/playlist/snapshot?spotify=true");
    expect(functionSource).not.toContain("_spotify_stream_history");
  });

  it("preserves supplemental album failures and reports limited completion", () => {
    expect(functionSource).toContain("supplementalErrors");
    expect(functionSource).toContain("supplemental_errors");
    expect(functionSource).toContain("completed_with_limits");
  });

  it("records an unresolved result instead of storing misleading project evidence when no exact identity match exists", () => {
    expect(functionSource).toContain("chartmetric_project_enrichment_unresolved");
    expect(functionSource).toContain("No exact Chartmetric project match");
    expect(functionSource).toContain('status: "unresolved"');
    expect(functionSource).toContain("return json({");
  });

  it("reads the seeded Chartmetric provider instead of inserting reference data with the authenticated client", () => {
    expect(functionSource).toContain("getChartmetricProvider");
    expect(functionSource).not.toContain("getOrCreateChartmetricProvider");
    expect(functionSource).not.toContain('from("source_providers")\n    .insert');
  });
});
