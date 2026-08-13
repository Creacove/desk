import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(process.cwd(), "supabase/migrations/20260807000400_manual_song_workspace.sql");
const releaseSuccessMigrationPath = resolve(process.cwd(), "supabase/migrations/20260812000100_release_success_foundation.sql");

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

  it("binds only stable release task keys and never backfills by title", () => {
    expect(existsSync(releaseSuccessMigrationPath)).toBe(true);

    const releaseSuccess = readFileSync(releaseSuccessMigrationPath, "utf8");
    expect(releaseSuccess).toContain("create or replace function public.ensure_release_success_workspace_v1");
    expect(releaseSuccess).toContain("distributor_delivery");
    expect(releaseSuccess).toContain("spotify_editorial_pitch");
    expect(releaseSuccess).toContain("playlist_shortlist");
    expect(releaseSuccess).toContain("epk_press_package");
    expect(releaseSuccess).toContain("content_rollout_start");
    expect(releaseSuccess).toContain("release_live_check");
    expect(releaseSuccess).toContain("post_release_review");
    expect(releaseSuccess).toContain("offset_days");
    expect(releaseSuccess).not.toMatch(/lower\s*\(\s*task\.title|task\.title\s* ilike|title\s*~\*/i);
  });
});
