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
    expect(text).toContain("assertActiveWorkspaceEntitlement");
    expect(text).toContain("service_role");
    expect(text).toContain("waiting_for_context");
  });

  it("allows the paid discovery chain to run with a service-role caller while preserving entitlement checks", () => {
    for (const functionName of ["spotify-catalog-bootstrap", "manager-artist-discovery"]) {
      const text = source("supabase", "functions", functionName, "index.ts");
      expect(text, functionName).toContain("isServiceRoleInvocation");
      expect(text, functionName).toContain("assertActiveWorkspaceEntitlement");
      expect(text, functionName).toContain("setupRunId");
    }
  });

  it("dispatches paid setup only after the active subscription is stored", () => {
    const text = source("supabase", "functions", "paystack-webhook", "index.ts");
    const subscriptionWrite = text.indexOf('.from("billing_subscriptions").upsert');
    const setupDispatch = text.indexOf("dispatchPaidSetup", subscriptionWrite);

    expect(subscriptionWrite).toBeGreaterThan(-1);
    expect(setupDispatch).toBeGreaterThan(subscriptionWrite);
    expect(text).toContain('phase: "discovery"');
    expect(text).toContain("EdgeRuntime.waitUntil");
  });

  it("routes manual setup retries back through the paid setup orchestrator", () => {
    const text = source("supabase", "functions", "billing-status", "index.ts");
    expect(text).toContain('functionName: "paid-workspace-setup"');
    expect(text).toContain('phase: setupResult.data?.current_stage === "setup_brief" ? "contextualize" : "discovery"');
  });
});
