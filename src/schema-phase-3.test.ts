import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase", "migrations", "20260527000100_initial_workspace_onboarding.sql"),
  "utf8",
);
const setupContextMigration = readFileSync(
  join(process.cwd(), "supabase", "migrations", "20260527000500_complete_artist_setup_context.sql"),
  "utf8",
);
const setupContextConflictMigrationPath = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260531000100_complete_artist_setup_context_conflict_resolution.sql",
);
const setupContextRelaxMigrationPath = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260702000100_relax_artist_setup_context_required_fields.sql",
);

describe("Phase 3 production workspace onboarding schema", () => {
  it("adds a security-definer RPC for the first authenticated workspace", () => {
    expect(migration).toContain("create or replace function public.create_initial_artist_workspace");
    expect(migration).toContain("security definer");
    expect(migration).toContain("auth.uid()");
    expect(migration).toContain("grant execute on function public.create_initial_artist_workspace(text, text) to authenticated");
  });

  it("creates the ownership, artist, workspace, profile, and operating event records together", () => {
    expect(migration).toContain("insert into public.users");
    expect(migration).toContain("insert into public.accounts");
    expect(migration).toContain("insert into public.account_memberships");
    expect(migration).toContain("insert into public.artists");
    expect(migration).toContain("insert into public.artist_workspaces");
    expect(migration).toContain("insert into public.artist_profiles");
    expect(migration).toContain("insert into public.operating_events");
  });

  it("guards the setup completion RPC against return column name ambiguity", () => {
    expect(setupContextMigration).toContain("create or replace function public.complete_artist_setup_context");
    expect(setupContextMigration).toContain("#variable_conflict use_column");
  });

  it("ships a forward migration for already-applied setup completion RPCs", () => {
    expect(existsSync(setupContextConflictMigrationPath)).toBe(true);

    const conflictMigration = readFileSync(setupContextConflictMigrationPath, "utf8");
    expect(conflictMigration).toContain("create or replace function public.complete_artist_setup_context");
    expect(conflictMigration).toContain("#variable_conflict use_column");
  });

  it("lets setup require only human-owned manager context while preserving enrichment-derived fields", () => {
    expect(existsSync(setupContextRelaxMigrationPath)).toBe(true);

    const relaxMigration = readFileSync(setupContextRelaxMigrationPath, "utf8");
    expect(relaxMigration).toContain("artist direction and budget are required");
    expect(relaxMigration).toContain("stage = coalesce(nullif(trim(p_stage), ''), stage)");
    expect(relaxMigration).toContain("home_market = coalesce(nullif(trim(p_home_market), ''), home_market)");
    expect(relaxMigration).toContain("when coalesce(array_length(p_genres, 1), 0) > 0 then p_genres else genres end");
    expect(relaxMigration).toContain("'required_fields', array['artist_direction','budget_context']");
    expect(relaxMigration).toContain("'enrichment_derived_fields', array['stage','home_market','genres']");
  });
});
