import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const migrationPath = join(root, "supabase", "migrations", "20260526000200_spotify_catalog_bootstrap_support.sql");
const functionPath = join(root, "supabase", "functions", "spotify-catalog-bootstrap", "index.ts");

describe("Phase 2 Spotify catalog bootstrap infrastructure", () => {
  it("adds source snapshot raw payload and source connection metadata support", () => {
    expect(existsSync(migrationPath)).toBe(true);

    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toContain("alter table public.source_snapshots");
    expect(sql).toContain("add column if not exists snapshot_type text");
    expect(sql).toContain("add column if not exists raw_payload jsonb");
    expect(sql).toContain("alter table public.source_connections");
    expect(sql).toContain("add column if not exists metadata jsonb");
    expect(sql).toContain("source_connections_unique_external_ref");
  });

  it("adds a server-side Spotify bootstrap function boundary", () => {
    expect(existsSync(functionPath)).toBe(true);

    const source = readFileSync(functionPath, "utf8");

    expect(source).toContain("SPOTIFY_CLIENT_ID");
    expect(source).toContain("SPOTIFY_CLIENT_SECRET");
    expect(source).toContain("spotify_catalog_bootstrap");
    expect(source).toContain("source_snapshots");
    expect(source).toContain("music_items");
    expect(source).toContain("music_identifiers");
    expect(source).not.toMatch(/download|rip|full audio/i);
  });

  it("keeps service-role source and evidence verification grants explicit", () => {
    const migrationsRoot = join(root, "supabase", "migrations");
    const migrations = ["20260531000300_catalog_import_workspace_grants.sql", "20260604000200_chartmetric_service_role_grants.sql"]
      .map((file) => readFileSync(join(migrationsRoot, file), "utf8"))
      .join("\n");

    expect(migrations).toMatch(/grant select on public\.source_providers to anon, authenticated, service_role/i);
    expect(migrations).toMatch(/grant select, insert, update, delete on public\.evidence_items to authenticated, service_role/i);
    expect(migrations).toMatch(/grant select, insert, update, delete on public\.evidence_links to authenticated, service_role/i);
    expect(migrations).toMatch(/grant select, insert on public\.operating_events to authenticated, service_role/i);
  });
});
