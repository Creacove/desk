import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const functionSource = readFileSync(join(process.cwd(), "supabase", "functions", "chartmetric-artist-enrichment", "index.ts"), "utf8");

describe("Chartmetric artist enrichment edge function", () => {
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

  it("accepts a scoped artist enrichment request and consumes queued setup jobs", () => {
    expect(functionSource).toContain("type ArtistEnrichmentInput");
    expect(functionSource).toContain("accountId: string");
    expect(functionSource).toContain("artistWorkspaceId: string");
    expect(functionSource).toContain("artistId: string");
    expect(functionSource).toContain("sourceSyncJobId?: string");
    expect(functionSource).toContain("sourceConnectionId?: string");
    expect(functionSource).toContain("chartmetricArtistId?: string");
    expect(functionSource).toContain("spotifyArtistId?: string");
    expect(functionSource).not.toContain("providerPath");
    expect(functionSource).not.toContain("endpoint");
  });

  it("loads queued job metadata and artist profile before building the Chartmetric request", () => {
    expect(functionSource).toContain('from("source_sync_jobs")');
    expect(functionSource).toContain('from("source_connections")');
    expect(functionSource).toContain('from("artist_profiles")');
    expect(functionSource).toContain('.select("id,display_name,spotify_identity")');
    expect(functionSource).not.toContain("profile_data");
    expect(functionSource).toContain("loadQueuedJobContext");
    expect(functionSource).toContain("loadArtistProfile");
    expect(functionSource).toContain("resolveChartmetricArtistId");

    const jobIndex = functionSource.indexOf("const queuedJob = await loadQueuedJobContext");
    const profileIndex = functionSource.indexOf("const artistProfile = await loadArtistProfile");
    const pathIndex = functionSource.indexOf("resolveChartmetricArtistId(input, queuedJob, artistProfile");
    expect(pathIndex).toBeGreaterThan(jobIndex);
    expect(pathIndex).toBeGreaterThan(profileIndex);
  });

  it("resolves the exact Spotify artist identity before requesting the detail endpoint", () => {
    expect(functionSource).toContain('/api/artist/spotify/${encodeURIComponent(spotifyArtistId)}/get-ids');
    expect(functionSource).toContain("readChartmetricArtistId");
    expect(functionSource).toContain('`/api/artist/${encodeURIComponent(resolvedChartmetricArtistId)}`');
    expect(functionSource).not.toContain("/api/search?");
  });

  it("stores raw Chartmetric artist snapshots, normalized evidence, and job events", () => {
    expect(functionSource).toContain('job_type: "chartmetric_artist_enrichment"');
    expect(functionSource).toContain('snapshot_type: "chartmetric_artist_enrichment"');
    expect(functionSource).toContain("raw_payload");
    expect(functionSource).toContain("normalizeChartmetricArtistEvidence");
    expect(functionSource).toContain('from("evidence_items")');
    expect(functionSource).toContain("chartmetric_artist_enrichment_started");
    expect(functionSource).toContain("chartmetric_artist_enrichment_completed");
    expect(functionSource).toContain("chartmetric_artist_enrichment_failed");
    expect(functionSource).not.toContain('.from("artists").update');
    expect(functionSource).not.toContain('.from("artist_profiles").update');
  });

  it("hands saved artist intelligence to Today's Brief generation without blocking enrichment", () => {
    expect(functionSource).toContain("generate-todays-brief");
    expect(functionSource).toContain("generateTodaysBriefAfterArtistEvidence");
    expect(functionSource).toContain("todays_brief_handoff_failed");
    expect(functionSource).toContain("Today's Brief handoff failed");
  });

  it("reuses an existing Chartmetric source connection before inserting a new one", () => {
    expect(functionSource).toContain("const { data: existing, error: existingError }");
    expect(functionSource).toContain('.eq("provider_id", providerId)');
    expect(functionSource).toContain('.eq("handle_or_external_ref", handleOrExternalRef)');
    expect(functionSource).toContain("if (existing?.id) return existing.id as string");
  });

  it("describes structured Supabase errors instead of hiding them behind a generic fallback", () => {
    expect(functionSource).toContain("describeError(error");
    expect(functionSource).toContain("readString(error.message)");
    expect(functionSource).toContain("readString(error.details)");
    expect(functionSource).toContain("readString(error.hint)");
  });

  it("reads the seeded Chartmetric provider instead of inserting reference data with the authenticated client", () => {
    expect(functionSource).toContain("getChartmetricProvider");
    expect(functionSource).not.toContain("getOrCreateChartmetricProvider");
    expect(functionSource).not.toContain('from("source_providers")\n    .insert');
  });
});
