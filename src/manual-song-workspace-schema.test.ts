import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(process.cwd(), "supabase/migrations/20260807000400_manual_song_workspace.sql");

describe("manual song workspace schema", () => {
  it("creates one durable song workspace using the existing domain tables", () => {
    expect(existsSync(migrationPath)).toBe(true);

    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toContain("create or replace function public.create_manual_song_workspace_v1");
    expect(sql).toContain("insert into public.missions");
    expect(sql).toContain("insert into public.conversations");
    expect(sql).toContain("insert into public.conversation_messages");
    expect(sql).toContain("'mission'");
    expect(sql).toContain("'conversation'");
    expect(sql).toContain("'music_item'");
    expect(sql).toContain("_manual_workspace_request_id");
  });
});
