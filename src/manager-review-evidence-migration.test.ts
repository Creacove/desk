import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260830220000_manager_canonical_evidence_deduplication.sql",
  "utf8",
);

describe("canonical evidence persistence invariants", () => {
  it("owns task-result concurrency and terminal completion uniqueness in Postgres", () => {
    expect(migration).toContain("manager_task_result_one_running_review_idx");
    expect(migration).toContain("task_results_one_completed_per_task_idx");
    expect(migration).toContain("operating_events_one_task_completion_idx");
    expect(migration).toContain("task_state_events_one_task_completion_idx");
  });

  it("suppresses semantically repeated human evidence follow-ups at the event boundary", () => {
    expect(migration).toContain("manager_follow_up_repeats_source_v1");
    expect(migration).toContain("suppress_redundant_human_follow_ups_v1");
    expect(migration).toContain("suppress_redundant_human_follow_ups");
    for (const domain of ["audio", "artwork", "lyrics", "metadata", "rights", "document", "campaign"]) {
      expect(migration).toContain(domain);
    }
  });

  it("does not expose the security-definer helpers to client roles", () => {
    expect(migration).toContain("revoke all on function public.manager_follow_up_repeats_source_v1(uuid, jsonb) from public, anon, authenticated");
    expect(migration).toContain("revoke all on function public.suppress_redundant_human_follow_ups_v1() from public, anon, authenticated");
  });
});
