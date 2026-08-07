import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

it("grounds every Music Manager Read in the current saved file manifest", () => {
  const summary = readFileSync(join(process.cwd(), "supabase", "functions", "generate-music-summary", "index.ts"), "utf8");
  const prompt = readFileSync(join(process.cwd(), "supabase", "functions", "_shared", "openaiMusicManagerRead.ts"), "utf8");

  expect(summary).toContain("loadAssetManifest(db, input)");
  expect(summary).toContain("assetManifest,");
  expect(summary).toContain("music_assets");
  expect(summary).toContain("uploaded_files");
  expect(prompt).toContain("assetManifest");
  expect(prompt).toContain("never claim an asset is absent when it appears in the manifest");
});
