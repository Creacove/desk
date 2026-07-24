import { describe, expect, it } from "vitest";
import { qualifyManagerMemoryCandidates } from "../supabase/functions/_shared/manager-conversation/memory";

describe("Manager durable memory qualification", () => {
  it("stores durable preferences and constraints but rejects temporary work notes", () => {
    const result = qualifyManagerMemoryCandidates([
      "The artist prefers to approve visual concepts before publishing.",
      "The campaign budget cap is 500000 NGN.",
      "The draft was reviewed this afternoon.",
    ], []);

    expect(result).toEqual([
      expect.objectContaining({ kind: "preference", category: "durable_preference", scope: "artist" }),
      expect.objectContaining({ kind: "constraint", category: "durable_constraint", scope: "artist" }),
    ]);
  });

  it("deduplicates exact memory and links a changed task constraint to the prior entry", () => {
    const existing = [
      { id: "memory-budget-old", content: "The campaign budget cap is 500000 NGN.", kind: "constraint", task_id: "task-1" },
      { id: "memory-approval", content: "The artist prefers to approve visual concepts before publishing.", kind: "preference", task_id: "task-1" },
    ];
    const result = qualifyManagerMemoryCandidates([
      "The artist prefers to approve visual concepts before publishing.",
      "The campaign budget cap is 750000 NGN.",
    ], existing, { missionId: "mission-1", taskId: "task-1" });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      kind: "constraint",
      scope: "task",
      mission_id: "mission-1",
      task_id: "task-1",
      supersedes_memory_entry_id: "memory-budget-old",
    });
  });
});
