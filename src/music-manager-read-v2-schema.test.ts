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

describe("Music Manager Read v2 schema", () => {
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

  it("does not reactivate an exact replay after its output was superseded", () => {
    const replayBranch =
      migration.match(
        /if run_was_terminal is distinct from usage_was_terminal then[\s\S]*?end if;\s+if run_was_terminal then([\s\S]*?)elsif next_output\.is_current then/i,
      )?.[1] ?? "";

    expect(replayBranch).toContain("return next_output.id;");
    expect(replayBranch).not.toContain("if not next_output.is_current");
    expect(replayBranch).not.toContain("set is_current = true");
    expect(migration).not.toContain("Finalized output is no longer current.");
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
});
