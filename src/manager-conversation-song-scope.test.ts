import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

const source = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

it("reuses the durable song link for every Manager conversation turn", () => {
  for (const functionPath of [
    "supabase/functions/manager-conversation/index.ts",
    "supabase/functions/manager-conversation-stream/index.ts",
  ]) {
    const content = source(functionPath);
    expect(content).toContain("Manager conversation is already scoped to a different song or project.");
    expect(content).toContain("input.musicSubject = musicSubject;");
    expect(content).toContain("scopedMissionId");
  }
});

it("keeps mission writes from a song conversation inside its linked mission", () => {
  const content = source("supabase/functions/_shared/missionGraphPersistence.ts");
  expect(content).toContain("context.scopedMissionId");
  expect(content).toContain('outcome: "update_existing_mission"');
  expect(content).toContain("const scopedMissionId = context.scopedMissionId;");
  expect(content).toContain("existingMissionId: scopedMissionId");
});
