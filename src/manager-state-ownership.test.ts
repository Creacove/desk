import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("supabase/migrations/20260829200800_manager_state_ownership.sql", "utf8");
const questionFix = readFileSync(
  "supabase/migrations/20260829201000_fix_manager_question_variable_conflict.sql",
  "utf8",
);

describe("service-owned Manager state", () => {
  for (const table of [
    "manager_synthesis_runs",
    "manager_run_actions",
    "ai_run_usage_events",
    "reviews",
    "permission_requests",
    "memory_entries",
  ]) {
    it(`prevents authenticated clients from mutating ${table}`, () => {
      expect(migration).toContain(`revoke insert, update, delete on public.${table} from authenticated`);
      expect(migration).toContain(`drop policy if exists ${table}_account_members_modify on public.${table}`);
      expect(migration).toContain(`grant select on public.${table} to authenticated`);
    });
  }
});

describe("Manager question persistence", () => {
  it("makes PL/pgSQL variable precedence explicit", () => {
    expect(questionFix).toContain("#variable_conflict use_variable");
    expect(questionFix).toContain("persist_manager_question_request_v1(uuid,uuid,jsonb)");
  });
});
