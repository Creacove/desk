import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf8");
const migration = read("supabase", "migrations", "20260906000200_generic_mission_task_contract.sql");
const conversation = read("supabase", "functions", "manager-conversation", "index.ts");
const streamConversation = read("supabase", "functions", "manager-conversation-stream", "index.ts");
const review = read("supabase", "functions", "manager-review-task-result", "index.ts");

describe("Manager draft review lifecycle", () => {
  it("persists and activates a draft atomically", () => {
    expect(migration).toContain("persist_manager_task_draft_v1");
    expect(migration).toContain("activate_review_task_for_target_v1");
    expect(conversation).toContain('rpc("persist_manager_task_draft_v1"');
    expect(streamConversation).toContain('rpc("persist_manager_task_draft_v1"');
    expect(conversation).toContain("task_intent,completion_mode");
    expect(streamConversation).toContain("task_intent,completion_mode");
    expect(conversation).toContain('task.task_intent !== "review_approval"');
    expect(streamConversation).toContain('task.task_intent !== "review_approval"');
  });

  it("requires the task's current version before review can be submitted", () => {
    expect(review).toContain("review_target_id");
    expect(review).toContain("review_target_version_id");
    expect(review).toContain("The submitted Manager draft is not the current review version.");
    expect(review).toContain("A review draft is not ready yet.");
  });
});
