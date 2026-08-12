import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(process.cwd(), "supabase/migrations/20260808000100_conversational_song_workspace.sql");
const repairMigrationPath = resolve(process.cwd(), "supabase/migrations/20260808000200_conversational_release_qa_hardening.sql");
const releaseSuccessMigrationPath = resolve(process.cwd(), "supabase/migrations/20260812000100_release_success_foundation.sql");

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

  it("repairs corrupted release topics and function text without non-ASCII migration literals", () => {
    expect(existsSync(repairMigrationPath)).toBe(true);
    const migration = readFileSync(repairMigrationPath, "utf8");
    expect(migration).toContain("pg_get_functiondef");
    expect(migration).toContain("chr(226) || chr(8364) || chr(8221)");
    expect(migration).toContain("chr(8212)");
    expect([...migration].every((character) => character.charCodeAt(0) < 128)).toBe(true);
  });

  it("keeps one idempotent mission and lazily attaches one release plan to the song", () => {
    expect(existsSync(releaseSuccessMigrationPath)).toBe(true);
    const migration = readFileSync(migrationPath, "utf8");
    const releaseSuccess = readFileSync(releaseSuccessMigrationPath, "utf8");

    expect(migration).toContain("if v_mission_id is null then");
    expect(migration).toContain("return jsonb_build_object(");
    expect(releaseSuccess).toContain("ensure_release_success_workspace_v1");
    expect(releaseSuccess).toContain("music_release_plans");
    expect(releaseSuccess).toContain("on conflict (music_item_id) do nothing");
    expect(releaseSuccess).toContain("release_task_schedule_bindings");
    expect(releaseSuccess).toContain("schedule_key");
  });
});
