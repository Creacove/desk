import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const migrationPath = join(process.cwd(), "supabase", "migrations", "20260906000100_artist_team_first_run.sql");

describe("Team first-run database contract", () => {
  it("adds additive state and a single scoped transactional completion RPC", () => {
    const migration = readFileSync(migrationPath, "utf8");

    expect(migration).toContain("add column if not exists first_run_completed_at timestamptz");
    expect(migration).toMatch(/create or replace function public\.complete_team_first_run_v1\(/i);
    expect(migration).toContain("p_artist_workspace_id uuid");
    expect(migration).toContain("p_team_name text");
    expect(migration).toContain("p_operating_title text");
    expect(migration).toContain("p_responsibility_tags text[]");
    expect(migration).toContain("'teamName'");
    expect(migration).toContain("update public.accounts");
    expect(migration).toContain("update public.account_memberships");
    expect(migration).toContain("first_run_completed_at = pg_catalog.now()");
    expect(migration).toContain("for update");
    expect(migration).toContain("_assert_team_owner_v1");
    expect(migration).toContain("_workspace_team_capability_v1");
    expect(migration).toMatch(/grant execute on function public\.complete_team_first_run_v1\([^;]+\)\s+to authenticated, service_role;/i);
  });

  it("keeps the setup orchestrator and discovery DAG out of the first-run migration", () => {
    const migration = readFileSync(migrationPath, "utf8");

    expect(migration).not.toMatch(/paid-workspace-setup|manager-discovery|setup_run|setup_stage/i);
  });
});
