import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { loadSpotifyCatalogPreview } from "../supabase/functions/_shared/spotifyCatalogPreview";

describe("Spotify catalog preview", () => {
  it("loads the latest project tracklist and up to five standalone singles without a repository", async () => {
    const getAlbum = vi.fn(async (albumId: string) => ({
      id: albumId,
      name: albumId === "album-latest" ? "New Chapter" : `Single ${albumId}`,
      album_type: albumId === "album-latest" ? "album" : "single",
      release_date: albumId === "album-latest" ? "2026-06-01" : "2026-05-01",
      total_tracks: albumId === "album-latest" ? 2 : 1,
      external_urls: { spotify: `https://open.spotify.com/album/${albumId}` },
      images: [{ url: `https://i.scdn.co/image/${albumId}`, width: 640, height: 640 }],
      tracks: {
        items: albumId === "album-latest"
          ? [
              { id: "track-1", name: "First Light", duration_ms: 180000, external_urls: { spotify: "https://open.spotify.com/track/track-1" } },
              { id: "track-2", name: "Second Wind", duration_ms: 190000, external_urls: { spotify: "https://open.spotify.com/track/track-2" } },
            ]
          : [{ id: `track-${albumId}`, name: `Track ${albumId}`, duration_ms: 200000 }],
      },
    }));

    const preview = await loadSpotifyCatalogPreview({
      artistId: "artist-1",
      market: "US",
      spotify: {
        getArtist: async () => ({
          id: "artist-1",
          name: "Nova Vale",
          external_urls: { spotify: "https://open.spotify.com/artist/artist-1" },
          images: [{ url: "https://i.scdn.co/image/artist-1", width: 640, height: 640 }],
        }),
        getArtistAlbums: async (_artistId, options) => ({
          items: options.includeGroup === "album"
            ? [{ id: "album-latest", name: "New Chapter", album_type: "album", release_date: "2026-06-01", total_tracks: 2 }]
            : Array.from({ length: 7 }, (_, index) => ({
                id: `single-${index + 1}`,
                name: `Single ${index + 1}`,
                album_type: "single",
                release_date: `2026-05-${String(20 - index).padStart(2, "0")}`,
                total_tracks: 1,
              })),
        }),
        getAlbum,
      },
      retryDelaysMs: [],
    });

    expect(preview.artist).toMatchObject({ spotifyArtistId: "artist-1", name: "Nova Vale" });
    expect(preview.latestProject).toMatchObject({ spotifyAlbumId: "album-latest", name: "New Chapter" });
    expect(preview.latestProject?.tracks.map((track) => track.name)).toEqual(["First Light", "Second Wind"]);
    expect(preview.standaloneSingles).toHaveLength(5);
    expect(getAlbum).toHaveBeenCalledTimes(6);
  });

  it("retries transient Spotify failures before returning the preview", async () => {
    let attempts = 0;
    const preview = await loadSpotifyCatalogPreview({
      artistId: "artist-1",
      spotify: {
        getArtist: async () => {
          attempts += 1;
          if (attempts < 3) throw new Error("Spotify request failed with 503.");
          return { id: "artist-1", name: "Nova Vale" };
        },
        getArtistAlbums: async () => ({ items: [] }),
        getAlbum: async () => { throw new Error("not expected"); },
      },
      retryDelaysMs: [0, 0],
    });

    expect(attempts).toBe(3);
    expect(preview.artist.name).toBe("Nova Vale");
    expect(preview.latestProject).toBeUndefined();
  });

  it("exposes an authenticated preview function without database writes or entitlement checks", () => {
    const functionPath = join(process.cwd(), "supabase", "functions", "spotify-catalog-preview", "index.ts");
    expect(existsSync(functionPath)).toBe(true);
    const source = readFileSync(functionPath, "utf8");

    expect(source).toContain("auth.getUser");
    expect(source).toContain("loadSpotifyCatalogPreview");
    expect(source).not.toContain("assertActiveWorkspaceEntitlement");
    expect(source).not.toContain('.from("');
  });
});
