import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = join(process.cwd(), "supabase", "migrations", "20260807000100_music_share_links.sql");

describe("music share-link storage", () => {
  it("stores a revocable selected-asset manifest without persisting a public raw token", () => {
    expect(existsSync(migrationPath)).toBe(true);
    const migration = readFileSync(migrationPath, "utf8");

    expect(migration).toContain("create table public.music_share_links");
    expect(migration).toContain("token_hash");
    expect(migration).not.toMatch(/\btoken\s+text/i);
    expect(migration).toContain("asset_manifest jsonb not null");
    expect(migration).toContain("music_item_id uuid");
    expect(migration).toContain("music_project_id uuid");
    expect(migration).toContain("state text not null default 'active'");
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("grant select, insert, update on public.music_share_links to authenticated");
    expect(migration).toContain("grant select, insert, update on public.music_share_links to service_role");
    expect(migration).toContain("create or replace function public.record_music_share_link_access");
    expect(migration).toContain("access_count = access_count + 1");
  });
});
