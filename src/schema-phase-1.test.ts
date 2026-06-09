import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const migrationPath = join(root, "supabase", "migrations", "20260526000100_core_operating_schema.sql");
const seedPath = join(root, "supabase", "seed.sql");

const read = (path: string) => readFileSync(path, "utf8");

describe("phase 1 Supabase core schema", () => {
  it("ships a core operating schema migration", () => {
    expect(existsSync(migrationPath)).toBe(true);

    const sql = read(migrationPath);
    const requiredTables = [
      "accounts",
      "users",
      "account_memberships",
      "artist_workspaces",
      "artists",
      "artist_profiles",
      "artist_profile_versions",
      "source_providers",
      "source_connections",
      "source_sync_jobs",
      "source_snapshots",
      "evidence_items",
      "evidence_links",
      "music_items",
      "music_projects",
      "music_project_items",
      "music_identifiers",
      "music_assets",
      "music_credits",
      "music_splits",
      "music_split_contributors",
      "music_split_confirmations",
      "operating_events",
      "artifact_links",
      "memory_entries",
      "conversations",
      "conversation_messages",
      "manager_context_questions",
      "manager_context_answers",
      "manager_synthesis_runs",
      "manager_run_actions",
      "missions",
      "mission_plan_versions",
      "checkpoints",
      "tasks",
      "task_state_events",
      "task_results",
      "reviews",
      "permission_requests",
      "ai_run_usage_events",
    ];

    for (const table of requiredTables) {
      expect(sql).toMatch(new RegExp(`create table public\\.${table}\\b`, "i"));
    }
  });

  it("enables account-scoped RLS on runtime tables", () => {
    const sql = read(migrationPath);

    for (const table of ["artist_profiles", "source_connections", "music_items", "missions", "tasks", "manager_synthesis_runs"]) {
      expect(sql).toMatch(new RegExp(`alter table public\\.${table} enable row level security`, "i"));
      expect(sql).toMatch(new RegExp(`create policy ${table}_account_members_select`, "i"));
      expect(sql).toMatch(new RegExp(`create policy ${table}_account_members_modify`, "i"));
    }
  });

  it("adds scoped split contributor and confirmation records", () => {
    const sql = read(migrationPath);

    expect(sql).toMatch(/create table public\.music_split_contributors\b/i);
    expect(sql).toContain("approval_status");
    expect(sql).toContain("publishing_share numeric");
    expect(sql).toContain("master_share numeric");
    expect(sql).toMatch(/create table public\.music_split_confirmations\b/i);
    expect(sql).toContain("confirmation_token_hash");
    expect(sql).toContain("expires_at");
    expect(sql).toContain("music_split_confirmations_unique_active_token");

    for (const table of ["music_split_contributors", "music_split_confirmations"]) {
      expect(sql).toMatch(new RegExp(`alter table public\\.${table} enable row level security`, "i"));
      expect(sql).toMatch(new RegExp(`create policy ${table}_account_members_select`, "i"));
      expect(sql).toMatch(new RegExp(`create policy ${table}_account_members_modify`, "i"));
      expect(sql).toMatch(new RegExp(`grant select, insert, update, delete on public\\.${table}\\s+to authenticated`, "i"));
    }
  });

  it("adds state enums and transition guards for the first workflows", () => {
    const sql = read(migrationPath);

    for (const enumName of ["run_status", "mission_status", "checkpoint_status", "task_status", "permission_request_status"]) {
      expect(sql).toMatch(new RegExp(`create type public\\.${enumName} as enum`, "i"));
    }

    expect(sql).toContain("validate_task_transition");
    expect(sql).toContain("approval-gated task cannot be completed before approval");
  });

  it("adds production upload storage primitives for Music assets", () => {
    const sql = read(migrationPath);
    const migrationsRoot = join(root, "supabase", "migrations");
    const uploadMigration = readdirSync(migrationsRoot)
      .filter((file) => file.endsWith(".sql"))
      .map((file) => read(join(migrationsRoot, file)))
      .join("\n");

    expect(uploadMigration).toMatch(/insert into storage\.buckets\s*\([^)]*id[^)]*name[^)]*public/i);
    expect(uploadMigration).toContain("music-uploads");
    expect(uploadMigration).toMatch(/create table( if not exists)? public\.uploaded_files\b/i);
    expect(uploadMigration).toContain("storage_ref");
    expect(uploadMigration).toContain("uploaded_files_account_members_select");
    expect(uploadMigration).toContain("music_uploads_objects_insert");
    expect(uploadMigration).toContain("drop policy if exists music_uploads_objects_insert");
    expect(uploadMigration).toContain("grant execute on function public.is_account_member(uuid) to authenticated, service_role");
    expect(uploadMigration).toContain("(storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'");
    expect(sql).toContain("uploaded_file_id uuid");
  });

  it("seeds reference providers, agents, mission pattern, and Manager context questions", () => {
    expect(existsSync(seedPath)).toBe(true);

    const seed = read(seedPath);

    for (const value of ["spotify", "youtube", "manual_upload", "manager", "marketing", "sync_deals", "touring", "finance_rights", "release_planning"]) {
      expect(seed).toContain(value);
    }

    expect(seed).toContain("manager_context_questions");
  });
});
