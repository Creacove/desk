import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const taskExecution = read("supabase/functions/manager-task-execution/index.ts");
const taskSheet = read("src/features/missions/MissionTaskSheet.tsx");
const workSurface = read("src/features/missions/MissionWorkSurface.tsx");
const deskHome = read("src/features/desk/DeskHQ.tsx");

describe("Manager execution loop", () => {
  it("keeps Start deterministic and reserves model reasoning for a changed plan", () => {
    expect(taskExecution).toContain('action: "start" | "move"');
    expect(taskExecution).toContain("async function startTask");
    expect(taskExecution).toContain("async function moveTask");
    expect(taskExecution).toContain("callOpenAIMoveReview");

    const startBlock = sliceBetween(taskExecution, "async function startTask", "async function moveTask");
    expect(startBlock).not.toContain("api.openai.com");
    expect(startBlock).toContain('status: "in_progress"');
  });

  it("treats Move as human availability, never as permission to invent a deadline", () => {
    const moveBlock = sliceBetween(taskExecution, "async function moveTask", "async function loadMoveReviewContext");
    expect(moveBlock).toContain("available_from: availableFrom");
    expect(moveBlock).not.toMatch(/deadline\s*:/);
    expect(taskExecution).toContain("Treat availableFrom as when the human can next do the work, not as a new deadline.");
    expect(taskExecution).toContain("Do not invent or silently change any deadline");
  });

  it("never puts Manager machine work on the human execution clock", () => {
    expect(taskExecution).toContain('workMode === "manager_work"');
    expect(taskExecution).toContain("Manager-owned work runs inside Desk and cannot be scheduled as artist work.");
    expect(taskExecution).toContain("Manager work is machine work and does not consume calendar days.");
  });

  it("persists changed reality before Manager reasons about downstream impact", () => {
    const updateIndex = taskExecution.indexOf("available_from: availableFrom");
    const reviewIndex = taskExecution.indexOf("callOpenAIMoveReview(context)");
    expect(updateIndex).toBeGreaterThan(-1);
    expect(reviewIndex).toBeGreaterThan(updateIndex);
    expect(taskExecution).toContain('status: "due"');
    expect(taskExecution).toContain("reviewDeferred: true");
  });

  it("gives human work the four operating actions without creating another task system", () => {
    for (const label of ["Start", "Done", "Move it", "I’m blocked"]) {
      expect(taskSheet).toMatch(new RegExp(`>\\s*${label.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\s*<`));
    }
    expect(workSurface).toContain("startMissionTask");
    expect(workSurface).toContain("moveMissionTask");
    expect(workSurface).toContain("onCompleteTask(");
  });

  it("makes Home manager-led: execution appears before the conversation escape hatch", () => {
    const todayIndex = deskHome.indexOf("<TodayExecution");
    const composerIndex = deskHome.indexOf("<HomeManagerComposer");
    expect(todayIndex).toBeGreaterThan(-1);
    expect(composerIndex).toBeGreaterThan(todayIndex);
    expect(deskHome).toContain('placeholder="Tell Desk what changed, or ask something"');
    expect(deskHome).not.toContain('placeholder="What do you want to work on?"');
    expect(deskHome).toContain("Desk is watching:");
  });
});

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function sliceBetween(source: string, start: string, end: string) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  return source.slice(from, to === -1 ? undefined : to);
}
