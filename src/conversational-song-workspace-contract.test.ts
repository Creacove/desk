import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(process.cwd(), "supabase/migrations/20260808000100_conversational_song_workspace.sql");

describe("conversational song workspace contract", () => {
  it("adopts a Manager conversation in one versioned workspace command", () => {
    expect(existsSync(migrationPath)).toBe(true);
    const migration = readFileSync(migrationPath, "utf8");
    expect(migration).toContain("create_conversational_song_workspace_v2");
    expect(migration).toContain("p_conversation_id uuid");
    expect(migration).toContain("Conversation is already linked to another Music subject.");
    expect(migration).toContain("linked_mission_id = v_mission_id");
    expect(migration).toContain("conversational-song-workspace:");
    expect(migration).toContain("'taskId', v_task_id");
  });
});
