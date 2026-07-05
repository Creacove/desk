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
    const clientSource = readFileSync(join(root, "supabase", "functions", "_shared", "spotifyCatalogClient.ts"), "utf8");

    // Client credentials are held server-side in the shared Spotify client the bootstrap uses.
    expect(clientSource).toContain("SPOTIFY_CLIENT_ID");
    expect(clientSource).toContain("SPOTIFY_CLIENT_SECRET");
    expect(source).toContain("../_shared/spotifyCatalogClient.ts");
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

  it("grants authenticated users access to account-scoped agent operating tables", () => {
    const migrationsRoot = join(root, "supabase", "migrations");
    const migrations = ["20260619000100_agent_reports_and_related_tables.sql", "20260619000200_agent_tables_authenticated_grants.sql"]
      .map((file) => readFileSync(join(migrationsRoot, file), "utf8"))
      .join("\n");

    for (const table of ["agent_runs", "agent_reports", "agent_notes", "agent_inbox_items"]) {
      expect(migrations).toMatch(new RegExp(`alter table public\\.${table} enable row level security`, "i"));
      expect(migrations).toMatch(new RegExp(`grant select, insert, update, delete on public\\.${table} to authenticated`, "i"));
    }
  });
});
