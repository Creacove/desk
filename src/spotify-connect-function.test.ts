import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const functionSource = readFileSync(join(process.cwd(), "supabase", "functions", "connect-spotify-artist", "index.ts"), "utf8");

describe("Spotify artist connect edge function", () => {
  it("authenticates the user, saves identity, and starts catalog import as a background task", () => {
    expect(functionSource).toContain("Deno.serve");
    expect(functionSource).toContain("auth.getUser()");
    expect(functionSource).toContain("createSupabaseCatalogRepository");
    expect(functionSource).toContain("saveArtistSpotifyIdentity");
    expect(functionSource).toContain("scheduleCatalogBootstrap");
    expect(functionSource).toContain('typeof EdgeRuntime === "undefined"');
    expect(functionSource).toContain("spotify-catalog-bootstrap");
    expect(functionSource).toContain("latest_catalog_sync_status");
  });

  it("creates the running job before starting catalog bootstrap", () => {
    expect(functionSource.indexOf("createSourceSyncJob")).toBeGreaterThan(-1);
    expect(functionSource.indexOf("createSourceSyncJob")).toBeLessThan(functionSource.indexOf("scheduleCatalogBootstrap"));
    expect(functionSource).toContain("sourceSyncJobId");
  });
});
