import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260728000200_production_reliability_v1.sql",
), "utf8").toLowerCase();
const eventMigration = readFileSync(join(
  process.cwd(), "supabase", "migrations", "20260728000300_operating_events_realtime.sql",
), "utf8").toLowerCase();

describe("production reliability v1 schema", () => {
  it("adds the narrow durable workspace-event outbox without replacing existing access policies", () => {
    for (const field of ["workspace_setup_run_id uuid", "dedupe_key text", "display_mode text", "refresh_scope text[]", "recipient_user_id uuid"]) {
      expect(eventMigration).toContain(`add column if not exists ${field}`);
    }
    expect(eventMigration).toContain("on delete set null");
    expect(eventMigration).toContain("display_mode is null or display_mode in ('activity', 'toast', 'action')");
    expect(eventMigration).toContain("operating_events_workspace_dedupe_idx");
    expect(eventMigration).toContain("artist_workspace_id, dedupe_key");
    expect(eventMigration).toContain("where dedupe_key is not null");
    expect(eventMigration).toContain("operating_events_workspace_cursor_idx");
    expect(eventMigration).toContain("artist_workspace_id, created_at, id");
    expect(eventMigration).not.toContain("drop policy");
  });

  it("idempotently adds only operating events to the realtime publication", () => {
    expect(eventMigration).toContain("pg_publication_tables");
    expect(eventMigration).toContain("alter publication supabase_realtime add table public.operating_events");
    expect(eventMigration.match(/add table/g)).toHaveLength(1);
  });
  it("adds backward-safe workflow identity, retry, availability, and lease metadata", () => {
    for (const column of [
      "workflow_version", "input_refs", "scope_key", "idempotency_key", "attempt_count",
      "max_attempts", "available_at", "lease_token", "lease_expires_at", "heartbeat_at",
      "last_attempt_started_at",
    ]) expect(migration).toContain(`add column if not exists ${column}`);

    expect(migration).toMatch(/alter table public\.workspace_setup_runs[\s\S]*?add column if not exists workflow_version/);
    expect(migration).not.toMatch(/alter table public\.workspace_setup_runs[\s\S]*?add column if not exists attempt_count/);
    expect(migration).toContain("retry_count = setup_run.retry_count + 1");
  });

  it("adds replay-safe source job target identity", () => {
    for (const column of ["subject_type", "subject_id", "target_payload", "workspace_setup_run_id"]) {
      expect(migration).toContain(`add column if not exists ${column}`);
    }
  });

  it("adds bounded recovery and active-scope uniqueness indexes", () => {
    expect(migration).toContain("manager_synthesis_runs_recovery_idx");
    expect(migration).toContain("source_sync_jobs_recovery_idx");
    expect(migration).toContain("workspace_setup_runs_recovery_idx");
    expect(migration).toContain("status, available_at, lease_expires_at");
    expect(migration).toContain("source_sync_jobs_active_scope_idx");
    expect(migration).toContain("manager_synthesis_runs_active_brief_scope_idx");
    expect(migration).toContain("manager_synthesis_runs_active_mission_genesis_scope_idx");
    expect(migration).toContain("status in ('queued', 'running')");
    expect(migration).toContain("scope_key is not null");
  });

  it("defines locked service-only claim, heartbeat, merge, and reap RPCs", () => {
    for (const fn of [
      "claim_manager_synthesis_run", "claim_source_sync_job", "claim_workspace_setup_stage",
      "heartbeat_manager_synthesis_run", "heartbeat_source_sync_job", "merge_workspace_setup_stage",
      "reap_expired_workflows",
    ]) {
      expect(migration).toContain(`function public.${fn}`);
      expect(migration).toMatch(new RegExp(`function public\\.${fn}[\\s\\S]*?security definer[\\s\\S]*?set search_path = public`));
      expect(migration).toContain(`revoke all on function public.${fn}`);
      expect(migration).toContain(`grant execute on function public.${fn}`);
      expect(migration).toContain("to service_role");
    }
  });

  it("keeps setup-stage writes path-local and rejects stale leases", () => {
    expect(migration).toContain("jsonb_set(setup_run.stage_status, array[stage_key]");
    expect(migration).toContain("current_stage_state ->> 'lease_token' is distinct from current_lease_token::text");
    expect(migration).toContain("setup_run.status in ('completed', 'failed')");
  });

  it("limits automated recovery to explicitly versioned workflows", () => {
    expect(migration.match(/workflow_version is not null/g)?.length).toBeGreaterThanOrEqual(5);
    expect(migration).not.toContain("update public.manager_synthesis_runs set workflow_version");
    expect(migration).not.toContain("update public.source_sync_jobs set workflow_version");
  });
});
