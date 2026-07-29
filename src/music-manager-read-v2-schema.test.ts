import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260727000100_music_manager_read_v2.sql",
  ),
  "utf8",
);
const singleSurfaceMigrationPath = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260728000100_music_manager_read_single_surface.sql",
);
const reliabilityMigration = readFileSync(
  join(process.cwd(), "supabase", "migrations", "20260728000200_production_reliability_v1.sql"),
  "utf8",
);

describe("Music Manager Read v2 schema", () => {
  it("preserves the existing active Music Manager Read uniqueness contract", () => {
    expect(reliabilityMigration).not.toContain("drop index manager_synthesis_runs_active_music_read_v2_idx");
    expect(reliabilityMigration).not.toContain("drop index if exists manager_synthesis_runs_active_music_read_v2_idx");
  });
  it("adds durable subject identity to manager synthesis runs", () => {
    expect(migration).toContain("add column if not exists subject_type text");
    expect(migration).toContain("add column if not exists subject_id uuid");
  });

  it("allows only one active v2 run per music subject", () => {
    expect(migration).toContain(
      "manager_synthesis_runs_active_music_read_v2_idx",
    );
    expect(migration).toContain("classification = 'music_manager_read_v2'");
    expect(migration).toContain("status in ('queued', 'running')");
    expect(migration).toContain("where subject_id is not null");
  });

  it("allows only one v2 output to be staged from each synthesis run", () => {
    expect(migration).toContain(
      "manager_outputs_music_read_v2_run_unique_idx",
    );
    expect(migration).toMatch(
      /create unique index if not exists manager_outputs_music_read_v2_run_unique_idx\s+on public\.manager_outputs \(created_from_run_id\)\s+where created_from_run_id is not null\s+and schema_version = 'music-manager-read-v2';/i,
    );
  });

  it("requires valid subjects for v2 runs without constraining legacy classifications", () => {
    expect(migration).toContain(
      "manager_synthesis_runs_music_read_v2_subject_check",
    );
    expect(migration).toMatch(
      /check\s*\(\s*classification <> 'music_manager_read_v2'\s+or\s+\(\s*subject_id is not null\s+and\s+subject_type is not null\s+and\s+subject_type in \('music_item', 'music_project'\)\s*\)\s*\)/i,
    );
  });

  it("finalizes v2 outputs, runs, and usage through one atomic boundary", () => {
    expect(migration).toContain("finalize_music_manager_read_v2");
    expect(migration).not.toContain("activate_music_manager_read_v2");
    expect(migration).toContain(
      "schema_version <> 'music-manager-read-v2'",
    );
    expect(migration).toContain("for update");
    expect(migration).toContain(
      "supersedes_output_id = previous_output_id",
    );
    expect(migration).toContain("status = target_run_status");
    expect(migration).toContain("steps_payload = target_steps_payload");
    expect(migration).toContain("error = null");
    expect(migration).toContain("status = expected_usage_status");
    expect(migration).toContain("input_tokens = target_input_tokens");
    expect(migration).toContain(
      "cached_input_tokens = target_cached_input_tokens",
    );
    expect(migration).toContain("output_tokens = target_output_tokens");
    expect(migration).toContain(
      "reasoning_tokens = target_reasoning_tokens",
    );
    expect(migration).toContain(
      "provider_request_count = target_provider_request_count",
    );
    expect(migration).toContain("metadata = target_usage_metadata");
    expect(
      migration.match(/completed_at = now\(\)/gi)?.length,
    ).toBeGreaterThanOrEqual(2);
    expect(migration).toContain("grant execute");
  });

  it("serializes finalization on the stable music subject", () => {
    expect(migration).toMatch(
      /from public\.music_items[\s\S]{0,500}?for update;/i,
    );
    expect(migration).toMatch(
      /from public\.music_projects[\s\S]{0,500}?for update;/i,
    );
  });

  it("validates staged output, run, and usage ownership as one unit", () => {
    expect(migration).toContain(
      "next_output.created_from_run_id is distinct from synthesis_run.id",
    );
    expect(migration).toContain(
      "synthesis_run.classification <> 'music_manager_read_v2'",
    );

    for (const ownerColumn of [
      "account_id",
      "artist_workspace_id",
      "artist_id",
      "subject_type",
      "subject_id",
    ]) {
      expect(migration).toContain(
        `synthesis_run.${ownerColumn} is distinct from next_output.${ownerColumn}`,
      );
      expect(migration).toContain(
        `usage_event.${ownerColumn} is distinct from next_output.${ownerColumn}`,
      );
    }

    expect(migration).toContain(
      "usage_event.manager_synthesis_run_id is distinct from synthesis_run.id",
    );
    expect(migration).toContain(
      "usage_event.workflow_key <> 'music_readiness_run'",
    );
    expect(migration).toContain(
      "usage_event.run_type <> 'manager_synthesis'",
    );
    expect(migration).toContain(
      "usage_event.operation_key <> 'music_manager_read_v2'",
    );
  });

  it("accepts only valid terminal state, counters, steps, and bounded metadata", () => {
    expect(migration).toContain(
      "target_run_status not in ('completed', 'completed_with_limits')",
    );
    expect(migration).toContain(
      "expected_usage_status := case target_run_status",
    );
    expect(migration).toContain("target_input_tokens < 0");
    expect(migration).toContain("target_cached_input_tokens < 0");
    expect(migration).toContain("target_output_tokens < 0");
    expect(migration).toContain("target_reasoning_tokens < 0");
    expect(migration).toContain("target_provider_request_count < 0");
    expect(migration).toContain(
      "jsonb_typeof(target_steps_payload) <> 'array'",
    );
    expect(migration).toContain("step ->> 'step' = 'output_activation'");
    expect(migration).toContain("step ->> 'status' = 'completed'");
    expect(migration).toContain(
      "jsonb_typeof(target_usage_metadata) <> 'object'",
    );
    expect(migration).toContain(
      "octet_length(target_usage_metadata::text) > 8192",
    );
  });

  it("permits only exact replays after terminalization", () => {
    expect(migration).toContain(
      "synthesis_run.status in ('completed', 'completed_with_limits')",
    );
    expect(migration).toContain(
      "synthesis_run.steps_payload is distinct from target_steps_payload",
    );
    expect(migration).toContain(
      "usage_event.status in ('succeeded', 'partial')",
    );
    expect(migration).toContain(
      "usage_event.metadata is distinct from target_usage_metadata",
    );
    expect(migration).toContain(
      "usage_event.provider_request_count is distinct from target_provider_request_count",
    );
  });

  it("accepts exact replays only for current or lineage-superseded outputs", () => {
    const replayBranch =
      migration.match(
        /if run_was_terminal is distinct from usage_was_terminal then[\s\S]*?end if;\s+if run_was_terminal then([\s\S]*?)elsif next_output\.is_current then/i,
      )?.[1] ?? "";

    expect(replayBranch).toContain("return next_output.id;");
    expect(replayBranch).toContain("if not next_output.is_current");
    expect(replayBranch).toContain(
      "supersedes_output_id = next_output.id",
    );
    expect(replayBranch).toContain(
      "raise exception 'Terminal output is not present in the finalized lineage.'",
    );
    expect(replayBranch).not.toContain("set is_current = true");
    expect(migration).not.toContain("Finalized output is no longer current.");
  });

  it("rejects zero-row writes instead of reporting false finalization success", () => {
    expect(
      migration.match(/get diagnostics affected_rows = row_count;/gi)?.length,
    ).toBeGreaterThanOrEqual(4);
    expect(migration).toContain("if affected_rows <> 1 then");
    expect(migration).toContain(
      "raise exception 'Previous Music Manager Read output could not be retired.'",
    );
    expect(migration).toContain(
      "raise exception 'Staged Music Manager Read output could not be activated.'",
    );
    expect(migration).toContain(
      "raise exception 'Music Manager Read synthesis run could not be terminalized.'",
    );
    expect(migration).toContain(
      "raise exception 'Music Manager Read usage event could not be terminalized.'",
    );
  });

  it("accepts only exact music subject and output type pairings", () => {
    expect(migration).toContain(
      "next_output.subject_type = 'music_item' and next_output.output_type = 'song_manager_read'",
    );
    expect(migration).toContain(
      "next_output.subject_type = 'music_project' and next_output.output_type = 'project_manager_read'",
    );
  });

  it("scopes predecessor lookup and retirement to the full output owner", () => {
    const predecessorScope =
      migration.match(
        /select id\s+into previous_output_id[\s\S]*?for update;/i,
      )?.[0] ?? "";
    const retirementScope =
      migration.match(
        /update public\.manager_outputs\s+set is_current = false[\s\S]*?;/i,
      )?.[0] ?? "";

    expect(retirementScope).toContain("id = previous_output_id");

    for (const scope of [predecessorScope, retirementScope]) {
      expect(scope).toContain("account_id = next_output.account_id");
      expect(scope).toContain(
        "artist_workspace_id = next_output.artist_workspace_id",
      );
      expect(scope).toContain("artist_id = next_output.artist_id");
      expect(scope).toContain("output_type = next_output.output_type");
      expect(scope).toContain("subject_type = next_output.subject_type");
      expect(scope).toContain("subject_id = next_output.subject_id");
    }
  });

  it("revokes broad RPC execution before granting trusted roles", () => {
    const revoke =
      /revoke execute on function public\.finalize_music_manager_read_v2\(uuid, uuid, public\.run_status, jsonb, integer, integer, integer, integer, integer, jsonb\)\s+from public, anon;/i;
    const grant =
      "grant execute on function public.finalize_music_manager_read_v2(uuid, uuid, public.run_status, jsonb, integer, integer, integer, integer, integer, jsonb)";
    const revokeIndex = migration.search(revoke);

    expect(revokeIndex).toBeGreaterThanOrEqual(0);
    expect(revokeIndex).toBeLessThan(migration.indexOf(grant));
  });

  it("uses invoker rights with a locked search path", () => {
    expect(migration).toMatch(
      /create or replace function public\.finalize_music_manager_read_v2[\s\S]*?security invoker\s+set search_path = public/i,
    );
  });

  it("keeps the existing finalizer behind a service-only lease guard", () => {
    const reliability = readFileSync(join(process.cwd(), "supabase", "migrations", "20260728000200_production_reliability_v1.sql"), "utf8");
    expect(reliability).toContain("finalize_leased_music_manager_read_v2");
    expect(reliability).toContain("target.lease_token = target_lease_token");
    expect(reliability).toContain("target.lease_expires_at > now()");
    expect(reliability).toContain("synthesis_run.status in ('completed', 'completed_with_limits')");
    expect(reliability).toContain("public.finalize_music_manager_read_v2(");
    expect(reliability).toContain("revoke execute on function public.finalize_music_manager_read_v2");
    expect(reliability).toContain("grant execute on function public.finalize_leased_music_manager_read_v2");
    expect(reliability).toContain("to service_role");
  });
});

describe("Music Manager Read single-surface conversion", () => {
  it("converts transitional reads and metrics in original order", () => {
    const sql = readFileSync(singleSurfaceMigrationPath, "utf8");
    expect(sql).toContain("jsonb_array_elements");
    expect(sql).toContain("with ordinality");
    expect(sql).toContain("jsonb_build_object('label'");
    expect(sql).toContain("'managerRead', converted.render_json->>'body'");
    expect(sql).toContain("avoid_json = '[]'::jsonb");
    expect(sql).toContain("confidence_json = '{}'::jsonb");
    expect(sql).toContain("supporting_evidence_json = converted.supporting_evidence");
  });

  it("is idempotently scoped only to transitional v2 music reads", () => {
    const sql = readFileSync(singleSurfaceMigrationPath, "utf8");
    expect(sql).toMatch(/where schema_version = 'music-manager-read-v2'/i);
    expect(sql).toMatch(/render_json \? 'signals'/i);
    expect(sql).toMatch(/render_json \? 'decision'/i);
    expect(sql).toMatch(/output_type in \('song_manager_read', 'project_manager_read'\)/i);
  });

  it("preserves row identity, lineage, current state, and timestamps", () => {
    const sql = readFileSync(singleSurfaceMigrationPath, "utf8");
    const setClause = sql.match(/update public\.manager_outputs[\s\S]*?\sset\s+([\s\S]*?)\sfrom converted/i)?.[1] ?? "";
    expect(setClause).not.toMatch(/\bid\s*=/i);
    expect(setClause).not.toMatch(/\bis_current\s*=/i);
    expect(setClause).not.toMatch(/\bsupersedes_output_id\s*=/i);
    expect(setClause).not.toMatch(/\bcreated_from_run_id\s*=/i);
    expect(setClause).not.toMatch(/\bcreated_at\s*=/i);
    expect(setClause).not.toMatch(/\bupdated_at\s*=/i);
  });
});
