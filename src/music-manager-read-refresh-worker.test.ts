import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("music Manager Read refresh worker", () => {
  it("deduplicates material server events before requesting an existing durable read workflow", () => {
    const workerPath = join(process.cwd(), "supabase", "functions", "music-manager-read-refresh-worker", "index.ts");
    const readPath = join(process.cwd(), "supabase", "functions", "generate-music-summary", "index.ts");
    const refreshSchedulePath = join(process.cwd(), "supabase", "migrations", "20260807000200_schedule_music_manager_read_refresh.sql");
    const audioSchedulePath = join(process.cwd(), "supabase", "migrations", "20260807000300_schedule_music_audio_analysis.sql");
    expect(existsSync(workerPath)).toBe(true);
    const worker = readFileSync(workerPath, "utf8");
    const read = readFileSync(readPath, "utf8");
    const refreshSchedule = readFileSync(refreshSchedulePath, "utf8");
    const audioSchedule = readFileSync(audioSchedulePath, "utf8");

    expect(worker).toContain("x-workflow-worker-secret");
    expect(worker).toContain("shouldAutomaticallyRefreshMusicRead");
    expect(worker).toContain("triggerEventId");
    expect(worker).toContain("generate-music-summary");
    expect(read).toContain("triggerEventId?: string");
    expect(read).toContain("findManagerReadForTriggerEvent");
    for (const schedule of [refreshSchedule, audioSchedule]) {
      expect(schedule).toContain("project_url");
      expect(schedule).toContain("endpoint.decrypted_secret");
      expect(schedule).not.toContain("bbwbxmnanccwottrmkqu.supabase.co");
    }
  });
});
