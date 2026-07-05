import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const searchSource = readFileSync(join(process.cwd(), "supabase", "functions", "spotify-catalog-search", "index.ts"), "utf8");
const importSource = readFileSync(join(process.cwd(), "supabase", "functions", "spotify-import-selection", "index.ts"), "utf8");

describe("Spotify catalogue import edge functions", () => {
  it("guards the catalogue search behind auth + account membership", () => {
    expect(searchSource).toContain("auth.getUser()");
    expect(searchSource).toContain("is_account_member");
    expect(searchSource).toContain("Access-Control-Allow-Origin");
    // Reuses the shared Spotify client rather than re-implementing auth/endpoints.
    expect(searchSource).toContain("../_shared/spotifyCatalogClient.ts");
    expect(searchSource).toContain("createSpotifyCatalogClient");
    // Scoped to the connected artist's own catalogue via their stored Spotify identity.
    expect(searchSource).toContain("artist_profiles");
    expect(searchSource).toContain("spotify_identity");
    expect(searchSource).toContain("getArtistAlbums");
    // Flags already-imported releases/tracks so re-imports are visible.
    expect(searchSource).toContain("alreadyImported");
    expect(searchSource).toContain("music_identifiers");
  });

  it("persists a selection with the shared normalizers and never enriches inline", () => {
    expect(importSource).toContain("auth.getUser()");
    expect(importSource).toContain("is_account_member");
    expect(importSource).toContain("../_shared/spotifyCatalogClient.ts");
    expect(importSource).toContain("createSupabaseCatalogRepository");
    // Reuses the exact setup importers so identifiers/dedup match the bootstrap.
    expect(importSource).toContain("importSpotifyAlbumAsProject");
    expect(importSource).toContain("importSpotifyTrackAsSong");
    // Returns the subject so the client can orchestrate enrichment + read; no enrichment here.
    expect(importSource).toContain("subjectType");
    expect(importSource).toContain("subjectId");
    expect(importSource).not.toContain("chartmetric-track-enrichment");
    expect(importSource).not.toContain("chartmetric-project-enrichment");
    expect(importSource).not.toContain("generate-music-summary");
  });
});
