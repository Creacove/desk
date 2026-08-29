import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const compiler = read("supabase/functions/_shared/openaiAdaptivePlanCompiler.ts");
const humanTaskContract = read("supabase/functions/_shared/managerHumanTaskGenerationContract.ts");
const runner = read("supabase/functions/manager-runtime-runner/index.ts");
const finalizer = read("supabase/migrations/20260829080000_adaptive_manager_replan.sql");
const dispatchHardening = read("supabase/migrations/20260829080100_manager_runtime_dispatch_hardening.sql");
const concurrencyGuard = read("supabase/migrations/20260829080200_adaptive_replan_concurrency_guard.sql");
const recovery = read("supabase/functions/workflow-recovery/index.ts");

describe("Adaptive Manager replan runtime", () => {
  it("keeps Manager machine work off the human calendar", () => {
    expect(compiler).toContain("buildManagerHumanTaskGenerationContract");
    expect(humanTaskContract).toContain("Manager machine work happens now");
    expect(compiler).toContain('workMode: "artist_action" | "collaborative"');
    expect(compiler).not.toContain('workMode: "artist_action" | "collaborative" | "manager_work"');
    expect(finalizer).toContain("Replacement plan attempted to schedule Manager-owned work as a task");
  });

  it("does not let the compiler invent calendar commitments", () => {
    expect(compiler).toContain("deadline may be non-empty ONLY when it exactly matches one of context.validation.allowedDeadlines");
    expect(compiler).toContain("availableFrom may be non-empty ONLY when it exactly matches one of context.validation.allowedAvailability");
    expect(compiler).toContain("Adaptive plan invented an unsupported deadline");
    expect(compiler).toContain("Adaptive plan invented unsupported availability");
    expect(runner).toContain("allowedDeadlines = uniqueIso");
    expect(runner).toContain("allowedAvailability = uniqueIso");
  });

  it("treats a replan as a complete replacement route, not an in-place patch", () => {
    expect(runner).toContain("A replan output must therefore be a complete coherent replacement route for remaining human work, not a patch list.");
    expect(finalizer).toContain("insert into public.mission_plan_versions");
    expect(finalizer).toContain("status = 'superseded'");
    expect(finalizer).toContain("set active_plan_version_id = new_plan_id");
    expect(finalizer).toContain("'manager_replanned_mission'");
  });

  it("installs replacement plans atomically and guards stale model work", () => {
    expect(finalizer).toContain("create or replace function public.finalize_manager_replan_v1");
    expect(concurrencyGuard).toContain("before update of active_plan_version_id on public.missions");
    expect(concurrencyGuard).toContain("run.context_payload -> 'mission' ->> 'active_plan_version_id'");
    expect(concurrencyGuard).toContain("Adaptive replan became stale before atomic plan swap");
    expect(runner).toContain("triggerPlanId !== activePlanId");
    expect(runner.indexOf("deterministicNoChange(context)")).toBeLessThan(runner.indexOf("callAdaptivePlanCompiler(context)"));
  });

  it("serializes autonomous replans per Mission and recovers abandoned claims", () => {
    expect(concurrencyGuard).toContain("reviews_one_running_adaptive_replan_per_mission_uidx");
    expect(dispatchHardening).toContain("runtime_claimed_at");
    expect(dispatchHardening).toContain("runtime_attempt_count");
    expect(dispatchHardening).toContain("reap_stale_manager_runtime_reviews_v1");
    expect(dispatchHardening).toContain("runtime_attempt_count >= 5");
    expect(runner).toContain('error?.code === "23505"');
  });

  it("uses one worker-secret gateway and keeps the real runners JWT protected", () => {
    expect(dispatchHardening).toContain("/functions/v1/workflow-recovery");
    expect(dispatchHardening).toContain("'mode', 'adaptive_replan'");
    expect(dispatchHardening).toContain("'mode', 'dispatch_reminders'");
    expect(recovery).toContain('type DirectManagerMode = "adaptive_replan" | "external_action_decision" | "dispatch_reminders"');
    expect(recovery).toContain('value === "adaptive_replan" || value === "external_action_decision" || value === "dispatch_reminders"');
    expect(recovery).toContain('"manager-runtime-runner"');
    expect(recovery).toContain('"manager-action-intent-runner"');
    expect(recovery).toContain('"manager-dispatcher"');
    expect(runner).toContain('constantTimeEqual(authHeader, `Bearer ${serviceRoleKey}`)');
  });

  it("fails closed: compiler/finalizer failure preserves the current plan", () => {
    expect(runner).toContain("currentPlanMustRemainUntouchedUntilAtomicFinalize: true");
    expect(runner).toContain("requeue_manager_runtime_review_v1");
    expect(runner).toContain("currentPlanPreserved: true");
    expect(dispatchHardening).toContain("Desk kept the current plan because it could not safely compile a replacement.");
  });

  it("does not let telemetry failure replay a successful plan swap", () => {
    const finalizeIndex = runner.indexOf("const result = await finalizeReplan(db, claimedReview.id, runId, output)");
    const accountingIndex = runner.indexOf("await completeUsageEventSafe(db, usageId, usage)", finalizeIndex);
    expect(finalizeIndex).toBeGreaterThan(-1);
    expect(accountingIndex).toBeGreaterThan(finalizeIndex);
    expect(runner).toContain("Telemetry is downstream of the user-visible state transition");
  });

  it("preserves strategy state while adapting execution", () => {
    for (const field of [
      "strategicThesis",
      "desiredAudienceBehavior",
      "creativePillars",
      "culturalMeaning",
      "constraints",
      "scopedBudget",
      "availableResources",
      "successIndicators",
      "rejectedDirections",
      "guardrails",
    ]) {
      expect(compiler).toContain(field);
      expect(runner).toContain(field);
    }
    expect(finalizer).toContain("strategy_state");
  });
});

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}
