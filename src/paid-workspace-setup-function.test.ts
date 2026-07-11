import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(...parts: string[]) {
  return readFileSync(join(process.cwd(), ...parts), "utf8");
}

describe("paid workspace setup orchestration", () => {
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

  it("uses the verified paid checkout as the setup orchestrator authorization boundary", () => {
    const text = source("supabase", "functions", "paid-workspace-setup", "index.ts");

    expect(text).toContain('checkout.status !== "paid"');
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

  it("returns the persisted contextual brief and music targets when setup already completed", () => {
    const text = source("supabase", "functions", "paid-workspace-setup", "index.ts");

    expect(text).toContain("loadCompletedSetupResult");
    expect(text).toContain('.from("manager_outputs")');
    expect(text).toContain('select("render_json")');
    expect(text).toContain("setupMusicReadTargets");
    expect(text).not.toContain('return { status: "completed", phase: "contextualize" };');
  });

  it("dispatches paid setup only after the active subscription is stored", () => {
    const text = source("supabase", "functions", "paystack-webhook", "index.ts");
    const subscriptionWrite = text.indexOf('.from("billing_subscriptions").upsert');
    const setupDispatch = text.indexOf("dispatchPaidSetup", subscriptionWrite);

    expect(subscriptionWrite).toBeGreaterThan(-1);
    expect(setupDispatch).toBeGreaterThan(subscriptionWrite);
    expect(text).toContain('phase: "discovery"');
  });

  it("does not acknowledge Paystack activation before processing subscription and setup dispatch", () => {
    const text = source("supabase", "functions", "paystack-webhook", "index.ts");

    expect(text).toContain("await processPaystackEvent(db, event, storedEvent.id)");
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
    expect(text).toContain('phase: setupResult.data?.current_stage === "setup_brief" ? "contextualize" : "discovery"');
  });
});
