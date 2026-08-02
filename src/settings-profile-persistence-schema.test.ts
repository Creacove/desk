import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = join(process.cwd(), "supabase", "migrations", "20260802000100_update_artist_profile.sql");

describe("settings profile persistence migration", () => {
  it("adds a member-scoped profile update RPC without changing workspace setup state", () => {
    const migration = readFileSync(migrationPath, "utf8");

    expect(migration).toContain("create or replace function public.update_artist_profile(");
    expect(migration).toContain("if not public.is_account_member(v_workspace.account_id) then");
    expect(migration).toContain("insert into public.artist_profile_versions");
    expect(migration).toContain("update public.artist_profiles");
    expect(migration).toContain("set active_profile_version_id = v_profile_version_id");
    expect(migration).not.toContain("set status = 'active'");
    expect(migration).toContain("grant execute on function public.update_artist_profile");
  });
});
