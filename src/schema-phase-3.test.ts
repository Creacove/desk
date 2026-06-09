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
});
