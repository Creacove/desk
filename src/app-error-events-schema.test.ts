import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260811000100_app_error_events.sql",
);
const migration = existsSync(migrationPath) ? readFileSync(migrationPath, "utf8") : "";

describe("central application error ledger schema", () => {
  it("creates one private diagnostic table with actionable failure fields", () => {
    expect(existsSync(migrationPath)).toBe(true);
    expect(migration).toMatch(/create table public\.app_error_events/i);
    expect(migration).toMatch(/error_message text not null/i);
    expect(migration).toMatch(/error_details jsonb not null/i);
    expect(migration).toMatch(/account_email text/i);
    expect(migration).toMatch(/provider_request_id text/i);
    expect(migration).toMatch(/operating_event_id uuid/i);
    expect(migration).toMatch(/setup_run_id uuid/i);
    expect(migration).toMatch(/manager_run_id uuid/i);
  });

  it("keeps the ledger service-role-only", () => {
    expect(migration).toMatch(/enable row level security/i);
    expect(migration).toMatch(/revoke all on public\.app_error_events from anon, authenticated/i);
    expect(migration).toMatch(/grant select, insert, update, delete on public\.app_error_events to service_role/i);
    expect(migration).not.toMatch(/create policy[^;]+authenticated/is);
  });

  it("indexes operational review and direct workflow correlation", () => {
    for (const index of [
      "app_error_events_occurred_at_idx",
      "app_error_events_open_severity_idx",
      "app_error_events_fingerprint_idx",
      "app_error_events_account_email_idx",
      "app_error_events_request_id_idx",
      "app_error_events_setup_run_idx",
      "app_error_events_manager_run_idx",
    ]) {
      expect(migration).toContain(index);
    }
  });

  it("bounds enum-like status fields and structured JSON", () => {
    expect(migration).toContain("severity in ('warning', 'error', 'critical')");
    expect(migration).toContain("status in ('open', 'investigating', 'resolved')");
    expect(migration).toContain("source in ('client', 'edge', 'worker', 'database', 'provider')");
    expect(migration).toContain("jsonb_typeof(error_details) = 'object'");
    expect(migration).toContain("jsonb_typeof(context) = 'object'");
  });
});
