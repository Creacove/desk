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
});
