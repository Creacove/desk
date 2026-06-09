import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

describe("production implementation boundary", () => {
  it("keeps production folders documented and separate", () => {
    for (const folder of ["app", "features", "services", "types"]) {
      expect(existsSync(join(root, "src", folder, "README.md"))).toBe(true);
    }
  });

  it("documents phase order and the Spotify catalog bootstrap contract", () => {
    const readme = readFileSync(join(root, "README.md"), "utf8");
    const implementationPhases = readFileSync(join(root, "docs", "implementation-phases.md"), "utf8");
    const spotifyContract = readFileSync(join(root, "docs", "workflows", "spotify-catalog-bootstrap.md"), "utf8");

    expect(readme).toContain("Frozen prototype contract");
    expect(readme).toContain("Production code boundary");
    expect(implementationPhases).toContain("Phase 0: Cleanup And Production Boundary");
    expect(implementationPhases).toContain("Phase 2: Spotify Catalog Bootstrap");
    expect(spotifyContract).toContain("No Spotify audio downloads");
    expect(spotifyContract).toContain("raw source snapshot");
    expect(spotifyContract).toContain("music_items");
  });

  it("removes obsolete root replacement scripts from the production workspace", () => {
    const rootFiles = readdirSync(root);

    expect(rootFiles.filter((file) => /^replace_.*\.cjs$/.test(file))).toEqual([]);
  });
});
