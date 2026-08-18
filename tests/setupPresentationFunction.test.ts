import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src", "services", "setupPresentation.ts"), "utf8");

describe("setup presentation direct-read safety boundary", () => {
  it("is read-only and never dispatches production work", () => {
    expect(source).not.toContain(".insert(");
    expect(source).not.toContain(".update(");
    expect(source).not.toContain(".upsert(");
    expect(source).not.toContain(".delete(");
    expect(source).not.toContain("functions.invoke");
    expect(source).not.toMatch(/fetch\s*\(/);
    expect(source).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("uses only the authenticated browser Supabase client and RLS-readable tables", () => {
    expect(source).toContain('client\n        .from("workspace_setup_runs")');
    expect(source).toContain('.from("artist_profiles")');
    expect(source).toContain('.from("music_items")');
    expect(source).toContain('.from("music_projects")');
    expect(source).toContain('.from("operating_events")');
    expect(source).toContain('.from("manager_synthesis_runs")');
    expect(source).toContain('.from("manager_run_actions")');
    expect(source).toContain('.from("evidence_items")');
    expect(source).toContain('.from("manager_outputs")');
  });

  it("scopes discovery, brief, actions, evidence, and output to the active setup run", () => {
    expect(source).toContain('.eq("classification", "manager_artist_discovery_v1")');
    expect(source).toContain('.eq("classification", "setup_todays_brief_v1")');
    expect(source).toContain('.eq("scope_key", setupRun.id)');
    expect(source).toContain('.eq("manager_synthesis_run_id", discoveryRun.id)');
    expect(source).toContain('.in("created_from_action_id", actionIds)');
    expect(source).toContain('mergeConsumedDiscoveryEvidence');
    expect(source).toContain('.eq("created_from_run_id", briefRun.id)');
    expect(source).toContain('.eq("output_type", "setup_first_manager_read")');
  });

  it("uses bounded reads and propagates AbortSignal to every live query", () => {
    expect(source).toContain('.limit(10)');
    expect(source).toContain('.limit(5)');
    expect(source).toContain('.limit(120)');
    expect(source).toContain('.abortSignal(signal)');
  });
});
