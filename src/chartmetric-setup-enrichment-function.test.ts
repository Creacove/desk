import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const functionSource = readFileSync(join(process.cwd(), "supabase", "functions", "chartmetric-setup-enrichment", "index.ts"), "utf8");
const seedSource = readFileSync(join(process.cwd(), "supabase", "seed.sql"), "utf8");

describe("Chartmetric setup enrichment edge function", () => {
  it("authenticates and checks membership before creating enrichment jobs", () => {
    expect(functionSource).toContain("Deno.serve");
    expect(functionSource).toContain("Authorization");
    expect(functionSource).toContain("auth.getUser()");
    expect(functionSource).toContain("is_account_member");

    const authIndex = functionSource.indexOf("auth.getUser()");
    const jobsIndex = functionSource.indexOf("createEnrichmentJobs");
    expect(authIndex).toBeGreaterThan(-1);
    expect(jobsIndex).toBeGreaterThan(authIndex);
  });

  it("creates background jobs for the artist, setup project, and recent songs", () => {
    expect(functionSource).toContain('job_type: "chartmetric_artist_enrichment"');
    expect(functionSource).toContain('job_type: "chartmetric_project_enrichment"');
    expect(functionSource).toContain('job_type: "chartmetric_track_enrichment"');
    expect(functionSource).toContain("loadSetupProjects");
    expect(functionSource).toContain("loadRecentSongs");
    expect(functionSource).toContain("music_project_id");
    expect(functionSource).toContain("music_item_id");
    expect(functionSource).not.toContain(".not(\"id\", \"in\"");
  });

  it("does not call Chartmetric inline during Spotify setup orchestration", () => {
    expect(functionSource).not.toContain("createChartmetricClient");
    expect(functionSource).not.toContain("requestJson");
    expect(functionSource).toContain('status: "queued"');
    expect(functionSource).toContain("chartmetric_setup_enrichment_queued");
  });

  it("uses seeded Chartmetric provider reference data instead of inserting providers through the user client", () => {
    expect(seedSource).toContain("'chartmetric'");
    expect(seedSource).toContain("'Chartmetric'");
    expect(functionSource).toContain("getChartmetricProvider");
    expect(functionSource).not.toContain("getOrCreateChartmetricProvider");
    expect(functionSource).not.toContain('from("source_providers")\n    .insert');
  });

  it("dispatches queued enrichment jobs to the worker functions", () => {
    expect(functionSource).toContain("dispatchEnrichmentWorkers");
    expect(functionSource).toContain("chartmetric-artist-enrichment");
    expect(functionSource).toContain("chartmetric-project-enrichment");
    expect(functionSource).toContain("chartmetric-track-enrichment");
    expect(functionSource).toContain("sourceSyncJobId");
    expect(functionSource).toContain("sourceConnectionId");
    expect(functionSource).toContain("EdgeRuntime.waitUntil");

    const jobsIndex = functionSource.indexOf("const jobs = await createEnrichmentJobs");
    const dispatchIndex = functionSource.indexOf("dispatchEnrichmentWorkers");
    const returnIndex = functionSource.indexOf('status: "queued"', dispatchIndex);
    expect(dispatchIndex).toBeGreaterThan(jobsIndex);
    expect(returnIndex).toBeGreaterThan(dispatchIndex);
  });

  it("reuses existing Chartmetric source connections when setup is tested repeatedly", () => {
    expect(functionSource).toContain("const { data: existing, error: existingError }");
    expect(functionSource).toContain('.eq("provider_id", providerId)');
    expect(functionSource).toContain('.eq("handle_or_external_ref", target.handle_or_external_ref)');
    expect(functionSource).toContain("if (existing?.id) return existing.id as string");
  });
});
