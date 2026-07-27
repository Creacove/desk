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

  it("activates v2 outputs atomically", () => {
    expect(migration).toContain("activate_music_manager_read_v2");
    expect(migration).toContain(
      "schema_version <> 'music-manager-read-v2'",
    );
    expect(migration).toContain("for update");
    expect(migration).toContain(
      "supersedes_output_id = previous_output_id",
    );
    expect(migration).toContain("grant execute");
  });

  it("serializes activation on the stable music subject and is idempotent", () => {
    expect(migration).toMatch(
      /from public\.music_items[\s\S]{0,500}?for update;/i,
    );
    expect(migration).toMatch(
      /from public\.music_projects[\s\S]{0,500}?for update;/i,
    );
    expect(migration).toMatch(
      /if next_output\.is_current then\s+return next_output\.id;/i,
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
      /revoke execute on function public\.activate_music_manager_read_v2\(uuid\)\s+from public, anon;/i;
    const grant =
      "grant execute on function public.activate_music_manager_read_v2(uuid)";
    const revokeIndex = migration.search(revoke);

    expect(revokeIndex).toBeGreaterThanOrEqual(0);
    expect(revokeIndex).toBeLessThan(migration.indexOf(grant));
  });
});
