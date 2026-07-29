import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "supabase", "functions", "workflow-recovery", "index.ts"), "utf8");
const config = readFileSync(join(process.cwd(), "supabase", "config.toml"), "utf8");
const migration = readFileSync(join(process.cwd(), "supabase", "migrations", "20260728000200_production_reliability_v1.sql"), "utf8");

describe("workflow recovery worker", () => {
  it("is secret-authenticated, observation-first, and bounded to four candidates", () => {
    expect(source).toContain("x-workflow-worker-secret");
    expect(source).toContain("WORKFLOW_WORKER_SECRET");
    expect(source).toContain("constantTimeEqual");
    expect(source).toContain('mode: "observe"');
    expect(source).toContain("RECOVERY_BATCH_SIZE = 4");
    expect(config).toContain("[functions.workflow-recovery]");
    expect(config).toContain("verify_jwt = false");
  });

  it("uses one service-only indexed candidate RPC and ignores legacy rows", () => {
    expect(source).toContain('.rpc("list_workflow_recovery_candidates"');
    expect(migration).toContain("list_workflow_recovery_candidates");
    expect(migration).toContain("workflow_version is not null");
    expect(migration).toContain("available_at <= now()");
    expect(migration).toContain("lease_expires_at <= now()");
    expect(migration).toContain("limit least(greatest(batch_size, 1), 5)");
    expect(migration).toContain("limit greatest(batch_size - affected, 0)");
    expect(migration).toContain("to service_role");
  });

  it("allowlists versions explicitly and revalidates the owner tuple before dispatch", () => {
    for (const version of [
      "workspace-setup-v1", "source-sync-v1", "music-manager-read-v2", "mission-genesis-v2", "todays-brief-v1",
    ]) expect(source).toContain(`"${version}"`);
    expect(source).toContain("assertRecoveryOwner");
    expect(source).toContain("account_id");
    expect(source).toContain("artist_workspace_id");
    expect(source).toContain("artist_id");
    expect(source).toContain("WORKFLOW_RECOVERY_ENABLED_VERSIONS");
  });

  it("reaps expired leases, classifies permanent failures, and terminalizes usage", () => {
    expect(source).toContain('.rpc("reap_expired_workflows"');
    expect(source).toContain("PERMANENT_HTTP_STATUSES");
    expect(source).toContain("terminalizeRecoveryFailure");
    expect(source).toContain("ai_run_usage_events");
    expect(source).toContain("nextRetryAt");
    expect(source).toContain("Math.random()");
    expect(source).toContain("Math.min(300");
    expect(migration).toContain("workflow_retry_at");
    expect(migration).toContain("Maximum recovery attempts exhausted");
  });
});
