import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("music audio-analysis worker", () => {
  it("analyzes uploaded audio only in a protected server worker and records bounded evidence", () => {
    const workerPath = join(process.cwd(), "supabase", "functions", "music-audio-analysis-worker", "index.ts");
    expect(existsSync(workerPath)).toBe(true);
    const source = readFileSync(workerPath, "utf8");

    expect(source).toContain("x-workflow-worker-secret");
    expect(source).toContain("AUDIO_ANALYSIS_URL");
    expect(source).toContain("createSignedUrl");
    expect(source).toContain("music_assets");
    expect(source).toContain("uploaded_files");
    expect(source).toContain("evidence_items");
    expect(source).toContain("audio_analysis");
    expect(source).toContain("music_audio_analysis_completed");
    expect(source).toContain("normalizeBpm");
    expect(source).toContain("normalizeMusicalKey");
    expect(source).not.toContain("navigator");
  });
});
