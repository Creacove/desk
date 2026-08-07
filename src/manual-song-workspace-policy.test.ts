import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const policyPath = resolve(process.cwd(), "supabase/functions/_shared/manualSongWorkspace.ts");

describe("manual song workspace policy", () => {
  it("gives a mastering song Files-first guidance without committing a release", async () => {
    expect(existsSync(policyPath)).toBe(true);
    const { manualSongWorkspaceCopy } = await import(policyPath);

    expect(manualSongWorkspaceCopy({ title: "Debbie", lifecycleStage: "mastering" })).toMatchObject({
      missionTitle: "Prepare Debbie for release",
      firstTaskTitle: "Add the current working audio",
      openingMessage: expect.stringContaining("Files"),
    });
  });
});
