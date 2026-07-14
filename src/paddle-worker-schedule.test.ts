import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Paddle webhook recovery schedule", () => {
  it("runs every minute and reads its credential from Vault at execution time", () => {
    const sql = readFileSync(join(process.cwd(), "supabase", "migrations", "20260714000300_schedule_billing_worker.sql"), "utf8");
    expect(sql).toContain("billing-webhook-recovery");
    expect(sql).toContain("'* * * * *'");
    expect(sql).toContain("vault.decrypted_secrets");
    expect(sql).toContain("billing_worker_secret");
    expect(sql).toContain("/functions/v1/paddle-process-webhooks");
    expect(sql).not.toMatch(/x-billing-worker-secret'\s*,\s*'[^']{20,}'/);
  });
});
