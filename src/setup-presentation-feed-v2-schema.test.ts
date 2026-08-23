import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260823000100_setup_presentation_feed_v2.sql",
);
const smokePath = join(
  process.cwd(),
  "supabase",
  "tests",
  "setup_presentation_feed_v2_smoke.sql",
);

function read(path: string) {
  return readFileSync(path, "utf8").toLowerCase();
}

describe("setup presentation feed v2 schema", () => {
  it("defines an authenticated, stable, security-invoker read-only RPC", () => {
    expect(existsSync(migrationPath)).toBe(true);
    const migration = read(migrationPath);

    expect(migration).toMatch(/create or replace function public\.get_setup_presentation_feed_v2\s*\(\s*p_setup_run_id\s+uuid\s*\)/);
    expect(migration).toMatch(/returns jsonb[\s\S]*?language sql[\s\S]*?stable[\s\S]*?security invoker/);
    expect(migration).toContain("auth.role() = 'authenticated'");
    expect(migration).toContain("p_setup_run_id");
    expect(migration).toContain("revoke all on function public.get_setup_presentation_feed_v2(uuid)");
    expect(migration).toContain("from public, anon");
    expect(migration).toContain("grant execute on function public.get_setup_presentation_feed_v2(uuid) to authenticated");
    expect(migration).not.toMatch(/\b(insert|update|delete|merge|truncate)\s+(into\s+)?public\./);
  });

  it("keeps the public response bounded and structurally display-safe", () => {
    const migration = read(migrationPath);

    expect(migration).toContain("'version', 2");
    expect(migration).toContain("'bounded', true");
    expect(migration).toContain("'maxfindings', 32");
    expect(migration).toContain("limit 32");
    expect(migration).toContain("omitted_malformed");
    expect(migration).toContain("jsonb_build_object('id'");
    for (const forbidden of [
      "metric_name",
      "source_kind",
      "provider_id",
      "action_type",
      "raw_ref",
      "provenance",
    ]) {
      expect(migration).not.toMatch(new RegExp(`jsonb_build_object[\\s\\S]{0,500}'${forbidden}'`));
    }
    expect(migration).not.toMatch(/jsonb_build_object[\s\S]{0,500}chartmetric/);
    expect(migration).not.toMatch(/\b(provider|worker|ai)[_-]?invoke\b/);
  });

  it("scopes every eligible source to the exact setup run and persisted completion boundaries", () => {
    const migration = read(migrationPath);

    expect(migration).toContain("setup.id = p_setup_run_id");
    expect(migration).toContain("setup.artist_workspace_id");
    expect(migration).toContain("setup.account_id");
    expect(migration).toContain("setup.artist_id");
    expect(migration).toContain("action.manager_synthesis_run_id = discovery_run.id");
    expect(migration).toContain("action.status::text = 'applied'");
    expect(migration).toContain("event.event_type in ('spotify_catalog_bootstrap_completed', 'spotify_catalog_bootstrap_completed_with_limits')");
    expect(migration).toContain("output.is_current = true");
    expect(migration).toContain("brief.status::text in ('completed', 'completed_with_limits')");
    expect(migration).toContain("output.output_type = 'setup_first_manager_read'");
  });

  it("documents the read-only RLS and eligibility smoke cases", () => {
    expect(existsSync(smokePath)).toBe(true);
    const smoke = read(smokePath);

    for (const assertion of [
      "set local role authenticated",
      "set_config('request.jwt.claim.sub'",
      "foreign workspace",
      "pending",
      "failed",
      "malformed",
      "order by",
      "limit 32",
      "rollback",
    ]) {
      expect(smoke).toContain(assertion);
    }
    expect(smoke).not.toMatch(/\b(insert|update|delete|merge|truncate)\s+public\./);
  });
});
