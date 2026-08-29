import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");
const context = read("supabase/functions/_shared/manager-conversation/context.ts");
const migration = read("supabase/migrations/20260829081300_manager_state_integrity_closure.sql");

describe("Manager canonical state integrity", () => {
  it("uses one generic canonical truth hierarchy for conversation turns", () => {
    expect(context).toContain('version: "manager_opening_brief_v4"');
    expect(context).toContain("canonicalState is the current durable product truth");
    expect(context).toContain("resolved decisions in canonicalState remain resolved");
    expect(context).toContain("fresh operatingFacts in canonicalState are already known");
    expect(context).toContain("conversationHistory and durableMemory are historical context");
    expect(context).toContain('sourceType !== "manager_canonical_state_v1"');
  });

  it("does not special-case release timing as a separate truth system", () => {
    expect(context).not.toContain("findCanonicalReleaseProjection");
    expect(context).not.toContain("canonicalOperationalStateLoaded");
    expect(context).not.toContain("releaseTiming");
    expect(context).not.toContain("approved operational release plan is canonical");
  });

  it("projects only current-plan executable work into canonical state", () => {
    expect(migration).toContain("manager_canonical_state_snapshot_v1");
    expect(migration).toContain("task.mission_plan_version_id = mission.active_plan_version_id");
    expect(migration).toContain("task.status in ('proposed', 'open', 'needs_approval', 'approved', 'in_progress', 'blocked', 'missed')");
    expect(migration).toContain("mission.status in ('candidate', 'active', 'blocked', 'review', 'paused')");
  });

  it("fails closed before a fresh known fact can become a repeated question", () => {
    expect(migration).toContain("reject_known_manager_question_v1");
    expect(migration).toContain("fact.status = 'active'");
    expect(migration).toContain("fact.valid_until is null or fact.valid_until > now()");
    expect(migration).toContain("canonical fact is already known and fresh");
  });

  it("refreshes canonical state after every artist turn before the next Manager packet", () => {
    expect(migration).toContain("zz_refresh_manager_canonical_state_memory");
    expect(migration).toContain("after insert on public.conversation_messages");
    expect(migration).toContain("source_type = 'manager_canonical_state_v1'");
    expect(migration).toContain("overrides older conversation, memory, stale plans, stale Tasks, and derived Manager reads");
  });
});
