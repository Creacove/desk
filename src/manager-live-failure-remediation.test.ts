import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260830213000_manager_live_failure_remediation.sql",
);
const migration = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";
const missionActivationMigrationPath = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260830214500_manager_mission_task_activation.sql",
);
const missionActivationMigration = existsSync(missionActivationMigrationPath)
  ? readFileSync(missionActivationMigrationPath, "utf8")
  : "";
const missionGraph = readFileSync(join(
  process.cwd(),
  "supabase",
  "functions",
  "_shared",
  "missionGraphPersistence.ts",
), "utf8");

describe("Manager live failure remediation", () => {
  it("writes adaptive-plan deliverable requirements using the jsonb column contract", () => {
    expect(existsSync(migrationPath)).toBe(true);
    expect(migration).toContain("create or replace function public.finalize_manager_replan_v1");
    expect(migration).toMatch(/deliverable_requirements[\s\S]*?'\[\]'::jsonb[\s\S]*?manager_responsibility/i);
    expect(migration).not.toMatch(/deliverable_requirements[\s\S]{0,800}'\{\}'::text\[\][\s\S]{0,300}manager_responsibility/i);
  });

  it("persists review-created human tasks with the complete database execution contract", () => {
    expect(migration).toContain("create or replace function public.persist_manager_review_continuation()");
    for (const column of [
      "work_mode",
      "completion_expectation",
      "completion_mode",
      "manager_responsibility",
      "user_responsibility",
      "risk_if_late",
    ]) {
      expect(migration).toContain(column);
    }
  });

  it("stages conversation-created human tasks until their steps pass the database contract", () => {
    expect(existsSync(missionActivationMigrationPath)).toBe(true);
    expect(missionGraph).toContain("preflightMissionTasks");
    expect(missionGraph).toContain('rpc("assert_generated_human_task_execution_contract_v1"');
    expect(missionGraph).toContain('work_mode: "manager_work"');
    expect(missionGraph).toContain("await activateHumanTask");
    expect(missionActivationMigration).toContain("after update of work_mode on public.tasks");
    expect(missionActivationMigration).toContain("generated_human_task_execution_contract_on_activation");
  });
});
