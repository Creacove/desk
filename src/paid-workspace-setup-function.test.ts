import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { nextAvailableAt } from "../supabase/functions/_shared/durableWorkflow";
import { publicWorkflowFailure } from "../supabase/functions/_shared/workflowErrors";

function source(...parts: string[]) {
  return readFileSync(join(process.cwd(), ...parts), "utf8");
}

describe("paid workspace setup orchestration", () => {
  it("uses database-owned stage leases and token-guarded merges", () => {
    const setupText = source("supabase", "functions", "paid-workspace-setup", "index.ts");
    const migration = source("supabase", "migrations", "20260728000200_production_reliability_v1.sql");

    expect(setupText).toContain("claimWorkspaceSetupStage");
    expect(setupText).toContain("mergeWorkspaceSetupStage");
    expect(setupText).not.toContain("claimFailedDiscoveryRetry");
    expect(setupText).not.toContain("claimContextualPhase");
    expect(migration).toContain("current_stage_state ->> 'lease_token' is distinct from current_lease_token::text");
    expect(migration).toContain("nullif(current_stage_state ->> 'lease_expires_at', '')::timestamptz > now()");
    expect(migration).toContain("in ('completed', 'completed_with_limits', 'failed')");
    expect(migration).toContain("heartbeat_workspace_setup_stage");
  });

  it("backs retries off deterministically without exposing internal failures", () => {
    const now = new Date("2026-07-29T08:00:00.000Z");
    expect(nextAvailableAt(1, now)).toBe("2026-07-29T08:00:05.000Z");
    expect(nextAvailableAt(4, now)).toBe("2026-07-29T08:00:40.000Z");
    expect(publicWorkflowFailure(new Error("postgres password=secret provider body"))).toEqual({
      code: "workflow_temporarily_unavailable",
      message: "We couldn't finish this work right now. Your completed work is safe.",
      retryable: true,
    });
  });

  it("defines discovery and contextualize phases with durable setup-run updates", () => {
    const path = join(process.cwd(), "supabase", "functions", "paid-workspace-setup", "index.ts");
    expect(existsSync(path)).toBe(true);
    const text = readFileSync(path, "utf8");

    expect(text).toContain('phase: "discovery" | "contextualize"');
    expect(text).toContain('.from("workspace_setup_runs")');
    expect(text).toContain('"spotify-catalog-bootstrap"');
    expect(text).toContain('"generate-todays-brief"');
    expect(text).toContain('generationMode: "setup-map"');
    expect(text).toContain("service_role");
    expect(text).toContain("waiting_for_context");
  });

  it("uses verified paid checkout or a matching active beta grant as the setup authorization boundary", () => {
    const text = source("supabase", "functions", "paid-workspace-setup", "index.ts");

    expect(text).toContain('checkout.status === "paid"');
    expect(text).toContain('isAuthorizedSetupCheckout');
    expect(text).toContain('.from("workspace_access_grants")');
    expect(text).toContain("user.id !== checkout.user_id");
    expect(text).not.toContain("assertActiveWorkspaceEntitlement");
  });

  it("allows the paid discovery chain to run with a service-role caller while preserving entitlement checks", () => {
    for (const functionName of [
      "spotify-catalog-bootstrap",
      "manager-artist-discovery",
      "generate-todays-brief",
      "generate-music-summary",
    ]) {
      const text = source("supabase", "functions", functionName, "index.ts");
      expect(text, functionName).toContain("isServiceRoleInvocation");
      expect(text, functionName).toContain("assertActiveWorkspaceEntitlement");
      expect(text, functionName).toMatch(/if \(!isServiceRoleInvocation\) \{\s*await assertActiveWorkspaceEntitlement/s);
    }
  });

  it("can redispatch manager discovery when paid setup has a completed catalog but no discovery completion", () => {
    const text = source("supabase", "functions", "paid-workspace-setup", "index.ts");

    expect(text).toContain("dispatchManagerDiscoveryPhase");
    expect(text).toContain('"manager_artist_discovery_dispatch_failed"');
    expect(text).toContain('catalogState === "completed" || catalogState === "completed_with_limits"');
  });

  it("does not redispatch a terminal discovery failure during contextual polling", () => {
    const text = source("supabase", "functions", "paid-workspace-setup", "index.ts");
    const contextualize = text.slice(
      text.indexOf("async function runContextualizePhase"),
      text.indexOf("async function loadCompletedSetupResult"),
    );

    expect(contextualize).toContain('if (discoveryState === "failed")');
    expect(contextualize).toContain("throw new Error(readDiscoveryStageError(contextStages)");
  });

  it("requires an explicit retry signal before restarting a failed discovery stage", () => {
    const setupText = source("supabase", "functions", "paid-workspace-setup", "index.ts");
    const billingText = source("supabase", "functions", "billing-status", "index.ts");

    expect(setupText).toContain("explicitRetry?: boolean");
    expect(setupText).toContain('if (existing === "failed" && !input.explicitRetry)');
    expect(billingText).toContain("explicitRetry: true");
  });

  it("routes retry from the failed discovery stage before considering current_stage", () => {
    const billingText = source("supabase", "functions", "billing-status", "index.ts");
    const retrySelector = billingText.slice(
      billingText.indexOf("function selectSetupRetryPhase"),
      billingText.indexOf("function selectSetupRetryPhase") + 900,
    );

    expect(billingText).toContain('select("id,status,current_stage,stage_status,last_error")');
    expect(retrySelector).toContain('stageState(stageStatus, "manager_discovery") === "failed"');
    expect(retrySelector).toContain('return "discovery"');
    expect(retrySelector).toContain('currentStage === "setup_brief"');
    expect(retrySelector.indexOf('stageState(stageStatus, "manager_discovery")')).toBeLessThan(
      retrySelector.indexOf('currentStage === "setup_brief"'),
    );
  });

  it("atomically claims a failed discovery retry before dispatching it", () => {
    const setupText = source("supabase", "functions", "paid-workspace-setup", "index.ts");
    const discoveryPhase = setupText.slice(
      setupText.indexOf("async function runDiscoveryPhase"),
      setupText.indexOf("async function runContextualizePhase"),
    );
    expect(discoveryPhase).toContain("claimWorkspaceSetupStage");
    expect(discoveryPhase).toContain('expectedStatus: existing === "not_started" ? "queued" : existing');
    expect(discoveryPhase).toContain("setupStageLeaseToken");
    expect(setupText).toContain("reuseExistingSnapshots: existing === \"failed\"");
  });

  it("opens Desk HQ after the brief while music reads continue in the background", () => {
    const text = source("supabase", "functions", "paid-workspace-setup", "index.ts");
    const briefText = source("supabase", "functions", "generate-todays-brief", "index.ts");

    expect(briefText).toContain("scheduleBackgroundTask");
    expect(briefText).toContain("Promise.allSettled");
    expect(text).toContain('status: hasMusicReadTargets ? "running" : "completed"');
    expect(text).toContain("next_stage_patch: proposedMusicReadStage");
    expect(text).toContain('status: "completed"');
    expect(text).toContain("setupRunId: setupRun.id");
    expect(text).toContain("mergeWorkspaceSetupStage");
  });

  it("does not reconcile a running brief with an unguarded artifact lookup", () => {
    const text = source("supabase", "functions", "paid-workspace-setup", "index.ts");

    expect(text).not.toContain("reconcileCompletedSetupBrief");
    expect(text).not.toContain('output_type", "setup_first_manager_read"');
  });

  it("does not let historical discovery events complete the active setup stage", () => {
    const text = source("supabase", "functions", "paid-workspace-setup", "index.ts");

    expect(text).not.toContain("reconcileCompletedDiscoveryStage");
    expect(text).not.toContain('.eq("event_type", "manager_discovery_completed")');
  });

  it("re-enters catalog bootstrap when contextual setup observes a failed or incomplete catalog", () => {
    const text = source("supabase", "functions", "paid-workspace-setup", "index.ts");
    const contextualize = text.slice(
      text.indexOf("async function runContextualizePhase"),
      text.indexOf("async function loadCompletedSetupResult"),
    );

    expect(contextualize).toContain("recoverCatalogBeforeContextualize");
    expect(contextualize).toContain('status: "waiting_for_catalog"');
    expect(contextualize).toContain("return runDiscoveryPhase");
    expect(contextualize).not.toContain('current_stage: "manager_discovery"');
  });

  it("returns the persisted contextual brief and music targets when setup already completed", () => {
    const text = source("supabase", "functions", "paid-workspace-setup", "index.ts");

    expect(text).toContain("loadCompletedSetupResult");
    expect(text).toContain('.from("manager_outputs")');
    expect(text).toContain('select("render_json")');
    expect(text).toContain("setupMusicReadTargets");
    expect(text).not.toContain('return { status: "completed", phase: "contextualize" };');
    expect(text).toContain("reconcileCompletedSetupMusicReads");
    expect(text).toContain('rpc("merge_setup_music_read_target_v1"');
  });

  it("never makes workspace access wait for setup music reads", () => {
    const migration = source("supabase", "migrations", "20260728000400_todays_brief_and_mission_finalizers.sql");
    expect(migration).toContain("set status = 'completed'");
    expect(migration).toContain("current_stage = 'music_reads'");
    expect(migration).toContain("merge_setup_music_read_target_v1");
    expect(migration).not.toMatch(/set status = case[\s\S]{0,300}music_reads/);
  });

  it("dispatches paid setup only after the active subscription is stored", () => {
    const text = source("supabase", "functions", "paystack-webhook", "index.ts");
    const atomicFulfillment = text.indexOf("fulfillVerifiedPaystackCheckout");
    const setupDispatch = text.indexOf("dispatchPaidSetup", atomicFulfillment);

    expect(atomicFulfillment).toBeGreaterThan(-1);
    expect(setupDispatch).toBeGreaterThan(atomicFulfillment);
    expect(text).toContain('phase: "discovery"');
  });

  it("does not acknowledge Paystack activation before processing subscription and setup dispatch", () => {
    const text = source("supabase", "functions", "paystack-webhook", "index.ts");

    expect(text).toContain("await processPaystackEvent(db, event, eventToProcess.id)");
    expect(text).not.toContain("EdgeRuntime.waitUntil(task)");
    expect(text).not.toContain("task.catch(() => undefined)");
  });

  it("matches Paystack events that carry the transaction reference on the nested transaction object", () => {
    const text = source("supabase", "functions", "paystack-webhook", "index.ts");

    expect(text).toContain("event.data?.transaction?.reference");
  });

  it("verifies and repairs paid checkout activation from billing status when the webhook is delayed", () => {
    const text = source("supabase", "functions", "billing-status", "index.ts");

    expect(text).toContain("verifyPaystackTransaction");
    expect(text).toContain("activateVerifiedPaystackCheckout");
    expect(text).toContain("ensureActiveSubscriptionForCheckout");
    expect(text).toContain('phase: "discovery"');
  });

  it("routes manual setup retries back through the paid setup orchestrator", () => {
    const text = source("supabase", "functions", "billing-status", "index.ts");
    expect(text).toContain('functionName: "paid-workspace-setup"');
    expect(text).toContain("phase: selectSetupRetryPhase(setupResult.data)");
  });
});
