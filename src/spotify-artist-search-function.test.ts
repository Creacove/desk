import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const functionSource = readFileSync(join(process.cwd(), "supabase", "functions", "spotify-artist-search", "index.ts"), "utf8");

describe("Spotify artist search edge function", () => {
  it("authenticates the Supabase user before calling Spotify", () => {
    expect(functionSource).toContain("Deno.serve");
    expect(functionSource).toContain("Authorization");
    expect(functionSource).toContain("auth.getUser()");
    expect(functionSource).toContain("Unauthorized");
  });

  it("uses Spotify client credentials search and returns normalized public artist candidates", () => {
    expect(functionSource).toContain("https://accounts.spotify.com/api/token");
    expect(functionSource).toContain("https://api.spotify.com/v1/search");
    expect(functionSource).toContain('searchParams.set("type", "artist")');
    expect(functionSource).toContain("spotifyArtistId");
    expect(functionSource).toContain("spotifyUrl");
    expect(functionSource).toContain("followers");
    expect(functionSource).toContain("genres");
  });
});
