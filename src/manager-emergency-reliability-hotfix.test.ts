import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260830130000_manager_emergency_reliability_hotfix.sql",
);

describe("Manager emergency reliability hotfix", () => {
  const migration = readFileSync(migrationPath, "utf8").toLowerCase();

  it("quarantines Career Watch until its output contract is reliable", () => {
    expect(migration).toContain("update public.manager_career_watch_state");
    expect(migration).toContain("set enabled = false");
    expect(migration).toContain("jobname = 'manager-career-watch-dispatcher'");
    expect(migration).toContain("cron.unschedule(jobid)");
    expect(migration).toContain("values (new.account_id, new.id, new.artist_id, false, now())");
  });

  it("provides a service-only, non-executable decision permission resolver", () => {
    expect(migration).toContain("resolve_manager_decision_permission_v1");
    expect(migration).toContain("permission_row.created_from_action_id is not null");
    expect(migration).toContain("permission_row.parameters ->> 'executable'");
    expect(migration).toContain("'shouldexecute', false");
    expect(migration).toContain("revoke all on function public.resolve_manager_decision_permission_v1");
    expect(migration).toContain("grant execute on function public.resolve_manager_decision_permission_v1");
    expect(migration).toContain("to service_role");
  });

  it("supersedes existing generic asset requests attached to released catalog music", () => {
    expect(migration).toContain("invalid_released_tasks");
    expect(migration).toContain("item.released_at is not null");
    expect(migration).toContain("project.released_at is not null");
    expect(migration).toContain("item.lifecycle_stage::text");
    expect(migration).toContain("project.lifecycle_stage::text");
    expect(migration).toContain("set status = 'superseded'");
    expect(migration).toContain("superseded by released/catalog policy");
  });
});
