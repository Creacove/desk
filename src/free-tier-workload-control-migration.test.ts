import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260811000200_bound_cron_workload.sql",
);

describe("free-tier cron workload cleanup", () => {
  it("removes only the two wasteful music polling schedules", () => {
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toContain("music-manager-read-refresh-worker");
    expect(sql).toContain("music-audio-analysis-worker");
    expect(sql).toMatch(/cron\.unschedule\([^;]+music-manager-read-refresh-worker/is);
    expect(sql).toMatch(/cron\.unschedule\([^;]+music-audio-analysis-worker/is);
    expect(sql).not.toMatch(/cron\.schedule\([^;]+music-(?:manager-read-refresh|audio-analysis)-worker/is);
  });

  it("retains guarded billing and setup recovery at five-minute cadence", () => {
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toContain("billing-webhook-recovery");
    expect(sql).toContain("workflow-recovery-worker");
    expect(sql.match(/'\*\/5 \* \* \* \*'/g)).toHaveLength(2);
    expect(sql).toContain("billing_command");
    expect(sql).toContain("workflow_command");
  });

  it("truncates only disposable cron history and installs bounded retention", () => {
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toMatch(/truncate table cron\.job_run_details/i);
    expect(sql).toMatch(/delete from cron\.job_run_details[\s\S]+end_time < now\(\) - interval '7 days'/i);
    expect(sql).toContain("cron-history-retention");
    expect(sql).not.toMatch(/truncate table public\./i);
    expect(sql).not.toMatch(/delete from public\./i);
  });

  it("asserts the final production job set after cleanup", () => {
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toContain("Unexpected cron job set after workload cleanup");
    expect(sql).toMatch(/jobname in \(\s*'billing-webhook-recovery',\s*'workflow-recovery-worker',\s*'cron-history-retention'\s*\)/i);
    expect(sql).toMatch(/select count\(\*\) into history_rows_after from cron\.job_run_details/i);
    expect(sql).toContain("Cron history cleanup did not empty cron.job_run_details");
  });
});
