import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "supabase", "functions", "workflow-recovery", "index.ts"), "utf8");
const config = readFileSync(join(process.cwd(), "supabase", "config.toml"), "utf8");
const migration = readFileSync(join(process.cwd(), "supabase", "migrations", "20260728000200_production_reliability_v1.sql"), "utf8");
const schedule = readFileSync(join(process.cwd(), "supabase", "migrations", "20260728000500_schedule_workflow_recovery.sql"), "utf8");
const durableSetup = readFileSync(join(process.cwd(), "supabase", "migrations", "20260803000300_durable_workspace_setup_resume.sql"), "utf8");

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

  it("isolates automatic recovery to entitled workspace setup runs", () => {
    expect(source).toContain("SETUP_WORKFLOW_VERSIONS");
    expect(source).toContain('.rpc("reap_expired_workspace_setup_runs"');
    expect(source).toContain('.rpc("list_workspace_setup_recovery_candidates"');
    expect(durableSetup).toContain("reap_expired_workspace_setup_runs");
    expect(durableSetup).toContain("list_workspace_setup_recovery_candidates");
    expect(durableSetup).toContain("workflow_version in ('workspace_setup_v1', 'workspace-setup-v1')");
    expect(durableSetup).toContain("has_active_workspace_entitlement");
    expect(durableSetup).toContain("to service_role");
  });

  it("schedules observation only when indexed eligible work exists", () => {
    expect(schedule).toContain("workflow-recovery-observer");
    expect(schedule).toContain("'* * * * *'");
    expect(schedule).toContain("workflow_worker_secret");
    expect(schedule).toContain("cron.unschedule");
    expect(schedule).toContain("exists (");
    expect(schedule).toContain("workflow_version is not null");
    expect(schedule).toContain("available_at <= now()");
    expect(schedule).toContain("lease_expires_at <= now()");
    expect(schedule).toContain("/functions/v1/workflow-recovery");
    expect(schedule).toContain("jsonb_build_object('mode', 'observe')");
    expect(schedule).not.toMatch(/x-workflow-worker-secret'\s*,\s*'[^']{20,}'/);
  });

  it("supersedes observation with a setup-only run schedule", () => {
    expect(durableSetup).toContain("workflow-recovery-worker");
    expect(durableSetup).toContain("workflow-recovery-observer");
    expect(durableSetup).toContain("cron.unschedule");
    expect(durableSetup).toContain("'* * * * *'");
    expect(durableSetup).toContain("workflow_worker_secret");
    expect(durableSetup).toContain("workflow_version in ('workspace_setup_v1', 'workspace-setup-v1')");
    expect(durableSetup).toContain("jsonb_build_object('mode', 'run')");
    expect(durableSetup).not.toMatch(/x-workflow-worker-secret'\s*,\s*'[^']{20,}'/);
  });
});
