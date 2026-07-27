import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const functionSource = readFileSync(join(process.cwd(), "supabase", "functions", "chartmetric-project-enrichment", "index.ts"), "utf8");
const normalizedFunctionSource = functionSource.replace(/\r\n/g, "\n");

describe("Chartmetric project enrichment edge function", () => {
  it("accepts exact service-role or backfill credentials without requiring an end-user session", () => {
    expect(functionSource).toContain('Deno.env.get("CHARTMETRIC_BACKFILL_TOKEN")');
    expect(functionSource).toContain('request.headers.get("X-Chartmetric-Backfill-Token")');
    expect(functionSource).toContain("isServiceRoleInvocation");
    expect(functionSource).toContain('authHeader === `Bearer ${serviceRoleKey}`');
    expect(functionSource).toContain('const scopedAuthHeader = isServiceRoleInvocation ? `Bearer ${serviceRoleKey}` : authHeader');
    expect(functionSource).toContain("if (!isServiceRoleInvocation)");
    expect(functionSource.indexOf("if (!isServiceRoleInvocation)")).toBeLessThan(functionSource.indexOf("auth.getUser()"));
    expect(functionSource).toContain("await assertActiveWorkspaceEntitlement(authClient, input)");
  });

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

  it("records durable paid Chartmetric request usage for resolved and unresolved project enrichment", () => {
    expect(functionSource).toContain('from("ai_run_usage_events")');
    expect(functionSource).toContain('provider: "chartmetric"');
    expect(functionSource).toContain('operation_key: "chartmetric_project_enrichment"');
    expect(functionSource).toContain('subject_type: "music_project"');
    expect(functionSource).toContain("subject_id: input.musicProjectId");
    expect(functionSource).toContain("provider_request_count");
    expect(functionSource).toContain("requestCount");

    const jobIndex = functionSource.indexOf("jobId =");
    const usageStartIndex = functionSource.indexOf("usageId = await createChartmetricUsageEvent(authClient, input, jobId)");
    expect(jobIndex).toBeGreaterThan(-1);
    expect(usageStartIndex).toBeGreaterThan(jobIndex);
    expect(functionSource.match(/usageId = await createChartmetricUsageEvent\(authClient, input, jobId\)/g)).toHaveLength(1);
    expect(functionSource.match(/await completeChartmetricUsageEvent\(authClient, usageId, requestCount/g)).toHaveLength(2);
  });

  it("persists failed project provider usage without replacing the original error", () => {
    expect(functionSource).toContain("await markFailedSafe(jobId, context, error, usageId, requestCount)");
    expect(functionSource).toContain('status: "failed"');
    expect(functionSource).toContain("provider_request_count: requestCount");
    expect(functionSource).toContain("failure_reason: message");
    expect(functionSource).toContain("completed_at: new Date().toISOString()");
    expect(functionSource).toContain("Preserve the original error response when failure logging also fails.");
  });

  it("finishes after normalized evidence without invoking OpenAI or Manager Read generation", () => {
    const evidenceIndex = functionSource.indexOf("await writeEvidenceItems(authClient, evidenceItems)");
    expect(evidenceIndex).toBeGreaterThan(-1);
    expect(functionSource).not.toContain("invokeManagerReadGeneration");
    expect(functionSource).not.toContain("generate-music-summary");
    expect(functionSource).not.toContain("music_manager_read_handoff_failed");
    expect(functionSource).not.toContain("manager_read_status");
    expect(functionSource).not.toContain("managerReadStatus");
    expect(normalizedFunctionSource).toContain(`return json({
      status: completedStatus,
      sourceSyncJobId: jobId,
      snapshotId,
      evidenceItemCount: evidenceItems.length,
      providerRequestCount: requestCount,
      supplementalErrors,
    });`);
  });

  it("requires exact release identity before requesting the detail endpoint from search results", () => {
    expect(functionSource).toContain("isChartmetricNotFoundError");
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

  it("falls through only on typed Chartmetric 404 identifier misses", () => {
    const resolverStart = normalizedFunctionSource.indexOf("async function resolveChartmetricProjectId(");
    const resolverEnd = normalizedFunctionSource.indexOf("function readCmIdFromGetIds(", resolverStart);
    const resolverSource = normalizedFunctionSource.slice(resolverStart, resolverEnd);

    expect(resolverStart).toBeGreaterThan(-1);
    expect(resolverEnd).toBeGreaterThan(resolverStart);
    expect(resolverSource.match(/catch \(error\) \{/g)).toHaveLength(2);
    expect(resolverSource.match(/if \(!isChartmetricNotFoundError\(error\)\) throw error;/g)).toHaveLength(2);
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
    expect(normalizedFunctionSource).toContain(`return json({
        status: "unresolved",
        sourceSyncJobId: jobId,
        snapshotId,
        evidenceItemCount: 0,
        providerRequestCount: requestCount,
        supplementalErrors: {},
      });`);
  });

  it("reads the seeded Chartmetric provider instead of inserting reference data with the authenticated client", () => {
    expect(functionSource).toContain("getChartmetricProvider");
    expect(functionSource).not.toContain("getOrCreateChartmetricProvider");
    expect(functionSource).not.toContain('from("source_providers")\n    .insert');
  });
});
