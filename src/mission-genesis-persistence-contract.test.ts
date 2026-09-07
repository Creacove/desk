import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf8");
const migration = read("supabase", "migrations", "20260906000200_generic_mission_task_contract.sql");
const genesis = read("supabase", "functions", "mission-genesis", "index.ts");
const graphPersistence = read("supabase", "functions", "_shared", "missionGraphPersistence.ts");
const review = read("supabase", "functions", "manager-review-task-result", "index.ts");

describe("generic Mission Genesis persistence contract", () => {
  it("keeps the durable Genesis finalizer while adapting its task rows to typed lifecycle state", () => {
    expect(genesis).toContain('rpc("finalize_mission_genesis_v2"');
    expect(migration).toContain("_apply_mission_genesis_graph_legacy_v2");
    expect(migration).toContain("create or replace function public._apply_mission_genesis_graph_v2");
    expect(migration).toContain("task_intent = generated_intent");
    expect(migration).toContain("readiness = generated_readiness");
  });

  it("quarantines approval-shaped Genesis output instead of exposing an untargeted review", () => {
    expect(graphPersistence).toContain("Mission Genesis cannot create an approval task before a runtime artifact has a ready immutable version.");
    expect(migration).toContain("generated_completion_mode = 'approval'");
    expect(migration).toContain("state_reason = case when generated_readiness = 'blocked' then 'review_target_missing'");
    expect(review).toContain("Review this draft with the approval action.");
  });

  it("creates review continuation from structured intent and a stable event identity", () => {
    const continuation = sliceBetween(
      migration,
      "create or replace function public.persist_manager_review_continuation()",
      "-- Assignment follows the canonical continuation event",
    );
    expect(continuation).toContain("intent_text");
    expect(continuation).toContain("task_dedupe_key := 'manager-follow-up:'");
    expect(continuation).toContain("task_intent");
    expect(continuation).toContain("manager_follow_up_task_created");
    // The continuation owns task creation; the validated assignment/reminder
    // lifecycle owns recipient delivery after the child event is persisted.
    expect(continuation).not.toContain("insert into public.reminder_queue");
    expect(continuation).toContain("pg_advisory_xact_lock");
    expect(continuation).not.toContain("lower(trim(task.title))");
  });

  it("resolves Team assignments from the continuation event id, never from generated title text", () => {
    const assignment = sliceBetween(
      migration,
      "-- Assignment follows the canonical continuation event",
      "revoke all on function public.assert_mission_task_contract_v1",
    );
    expect(assignment).toContain("new.task_id");
    expect(assignment).toContain("follow_up_task_id");
    expect(assignment).toContain("md5(follow_up::text)");
    expect(assignment).not.toContain("lower(btrim(task.title))");
  });
});

function sliceBetween(source: string, start: string, end: string) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  return source.slice(from, to === -1 ? undefined : to);
}
