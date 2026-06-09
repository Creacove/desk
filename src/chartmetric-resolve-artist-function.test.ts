import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const functionSource = readFileSync(join(process.cwd(), "supabase", "functions", "chartmetric-resolve-artist", "index.ts"), "utf8");

describe("Chartmetric artist resolution edge function", () => {
  it("authenticates the Supabase user before calling Chartmetric", () => {
    expect(functionSource).toContain("Deno.serve");
    expect(functionSource).toContain("Authorization");
    expect(functionSource).toContain("auth.getUser()");
    expect(functionSource).toContain("Unauthorized");

    const authIndex = functionSource.indexOf("auth.getUser()");
    const chartmetricIndex = functionSource.indexOf("const chartmetric = createChartmetricClient");
    expect(authIndex).toBeGreaterThan(-1);
    expect(chartmetricIndex).toBeGreaterThan(authIndex);
  });

  it("accepts only explicit artist identity inputs from the setup flow", () => {
    expect(functionSource).toContain("type ResolveArtistInput");
    expect(functionSource).toContain("accountId: string");
    expect(functionSource).toContain("artistWorkspaceId: string");
    expect(functionSource).toContain("artistId: string");
    expect(functionSource).toContain("spotifyArtistId: string");
    expect(functionSource).toContain("spotifyArtistUrl?: string");
    expect(functionSource).toContain("artistName: string");
    expect(functionSource).toContain("socialHandles?");
    expect(functionSource).not.toContain("providerPath");
    expect(functionSource).not.toContain("endpoint");
  });

  it("creates a source job, stores the raw Chartmetric response, and writes operating events", () => {
    expect(functionSource).toContain('provider_key", "chartmetric"');
    expect(functionSource).toContain('job_type: "chartmetric_artist_resolve"');
    expect(functionSource).toContain('snapshot_type: "chartmetric_artist_search"');
    expect(functionSource).toContain("raw_payload");
    expect(functionSource).toContain("chartmetric_artist_resolve_started");
    expect(functionSource).toContain("chartmetric_artist_resolve_completed");
    expect(functionSource).toContain("chartmetric_artist_resolve_failed");
  });

  it("uses the shared Chartmetric client and a narrow artist search request", () => {
    expect(functionSource).toContain("../_shared/chartmetricClient.ts");
    expect(functionSource).toContain("createChartmetricClient");
    expect(functionSource).toContain("buildChartmetricSearchPath");
    expect(functionSource).toContain('searchParams.set("q", input.artistName.trim())');
    expect(functionSource).toContain('searchParams.set("type", "artists")');
    expect(functionSource).toContain('searchParams.set("limit", "5")');
    expect(functionSource).not.toContain('searchParams.set("spotify_artist_id"');
  });

  it("reads the seeded Chartmetric provider instead of inserting reference data with the authenticated client", () => {
    expect(functionSource).toContain("getChartmetricProvider");
    expect(functionSource).not.toContain("getOrCreateChartmetricProvider");
    expect(functionSource).not.toContain('from("source_providers")\n    .insert');
  });
});
