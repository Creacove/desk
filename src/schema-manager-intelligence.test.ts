import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const migrationsRoot = join(root, "supabase", "migrations");
const migrationPath = join(migrationsRoot, "20260625000100_manager_intelligence_spine.sql");

const read = (path: string) => readFileSync(path, "utf8");
const readAllMigrations = () =>
  readdirSync(migrationsRoot)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => read(join(migrationsRoot, file)))
    .join("\n");

describe("Manager Intelligence consolidated schema", () => {
  it("adds only the durable packet and visible output tables needed for Manager Intelligence", () => {
    expect(existsSync(migrationPath)).toBe(true);

    const sql = read(migrationPath);

    for (const table of ["manager_intelligence_packets", "manager_outputs"]) {
      expect(sql).toMatch(new RegExp(`create table public\\.${table}\\b`, "i"));
      expect(sql).toContain("account_id uuid not null references public.accounts(id) on delete cascade");
      expect(sql).toContain("artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade");
      expect(sql).toContain("artist_id uuid not null references public.artists(id) on delete cascade");
      expect(sql).toMatch(new RegExp(`alter table public\\.${table} enable row level security`, "i"));
      expect(sql).toMatch(new RegExp(`create policy ${table}_account_members_select`, "i"));
      expect(sql).toMatch(new RegExp(`create policy ${table}_account_members_modify`, "i"));
      expect(sql).toMatch(new RegExp(`grant select, insert, update on public\\.${table} to authenticated, service_role`, "i"));
    }
  });

  it("stores packet intelligence without creating parallel profile, snapshot, brief, or memory tables", () => {
    const allMigrations = readAllMigrations();
    const sql = read(migrationPath);

    expect(sql).toContain("profile_projection_json jsonb not null default '{}'::jsonb");
    expect(sql).toContain("signal_snapshot_json jsonb not null default '{}'::jsonb");
    expect(sql).toContain("mission_seed_json jsonb not null default '{}'::jsonb");
    expect(sql).toContain("conversation_memory_seed_json jsonb not null default '{}'::jsonb");
    expect(sql).toContain("internal_only_json jsonb not null default '{}'::jsonb");
    expect(sql).toContain("supersedes_packet_id uuid references public.manager_intelligence_packets(id) on delete set null");

    expect(allMigrations).not.toMatch(/create table( if not exists)? public\.artist_signal_snapshots\b/i);
    expect(allMigrations).not.toMatch(/create table( if not exists)? public\.artist_operating_profiles\b/i);
    expect(allMigrations).not.toMatch(/create table( if not exists)? public\.manager_briefs\b/i);
    expect(allMigrations).not.toMatch(/create table( if not exists)? public\.manager_memory\b/i);
  });

  it("adds artist operating packet sections to Manager Intelligence packets", () => {
    const allMigrations = readAllMigrations();

    for (const column of [
      "domain_reads_json jsonb not null default '[]'::jsonb",
      "public_context_json jsonb not null default '[]'::jsonb",
      "open_decisions_json jsonb not null default '[]'::jsonb",
      "do_not_do_json jsonb not null default '[]'::jsonb",
    ]) {
      expect(allMigrations).toContain(column);
    }
  });

  it("uses manager_outputs for all user-facing Manager reads", () => {
    const sql = read(migrationPath);

    for (const column of [
      "source_packet_id uuid references public.manager_intelligence_packets(id) on delete set null",
      "subject_type text not null",
      "subject_id uuid",
      "output_type text not null",
      "hero_json jsonb not null default '{}'::jsonb",
      "blocks_json jsonb not null default '[]'::jsonb",
      "primary_recommendation_json jsonb not null default '{}'::jsonb",
      "avoid_json jsonb not null default '[]'::jsonb",
      "confidence_json jsonb not null default '{}'::jsonb",
      "supporting_evidence_json jsonb not null default '[]'::jsonb",
      "render_json jsonb not null default '{}'::jsonb",
      "is_current boolean not null default true",
    ]) {
      expect(sql).toContain(column);
    }

    expect(sql).toContain("manager_outputs_current_subject_idx");
    expect(sql).toContain("manager_outputs_current_unique_idx");
  });

  it("extends existing memory and profile tables instead of replacing them", () => {
    const sql = read(migrationPath);

    expect(sql).toMatch(/alter table public\.memory_entries\s+add column if not exists payload jsonb not null default '\{\}'::jsonb/i);
    expect(sql).toMatch(/alter table public\.artist_profiles\s+add column if not exists current_manager_packet_id uuid/i);
    expect(sql).toMatch(/add column if not exists manager_profile_summary_json jsonb not null default '\{\}'::jsonb/i);
    expect(sql).toContain("artist_profiles_current_manager_packet_fk");
  });

  it("adds lineage indexes for packet, output, memory, and evidence lookup", () => {
    const sql = read(migrationPath);

    for (const indexName of [
      "manager_intelligence_packets_workspace_idx",
      "manager_intelligence_packets_run_idx",
      "manager_outputs_workspace_idx",
      "manager_outputs_source_packet_idx",
      "memory_entries_manager_source_idx",
      "evidence_links_manager_target_idx",
    ]) {
      expect(sql).toContain(indexName);
    }
  });
});
