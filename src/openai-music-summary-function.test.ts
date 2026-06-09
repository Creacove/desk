import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const functionSource = readFileSync(join(process.cwd(), "supabase", "functions", "generate-music-summary", "index.ts"), "utf8");
const promptSource = readFileSync(join(process.cwd(), "supabase", "functions", "_shared", "openaiManagerRead.ts"), "utf8");

describe("OpenAI music Manager Read generation function", () => {
  it("authenticates the Supabase user and checks account membership before model calls", () => {
    expect(functionSource).toContain("Deno.serve");
    expect(functionSource).toContain("Authorization");
    expect(functionSource).toContain("auth.getUser()");
    expect(functionSource).toContain("is_account_member");

    const authIndex = functionSource.indexOf("auth.getUser()");
    const openAiIndex = functionSource.indexOf("callOpenAIManagerRead");
    expect(authIndex).toBeGreaterThan(-1);
    expect(openAiIndex).toBeGreaterThan(authIndex);
  });

  it("allows exact service-role invocations for controlled backfills", () => {
    expect(functionSource).toContain("isServiceRoleInvocation");
    expect(functionSource).toContain("X-Chartmetric-Backfill-Token");
    expect(functionSource).toContain('Deno.env.get("CHARTMETRIC_BACKFILL_TOKEN")');
    expect(functionSource).toContain('requireEnv("SUPABASE_SERVICE_ROLE_KEY")');
    expect(functionSource).toContain("if (!isServiceRoleInvocation)");
  });

  it("builds the read packet from saved Music and evidence records instead of client-supplied facts", () => {
    expect(functionSource).toContain('from("music_items")');
    expect(functionSource).toContain('from("music_projects")');
    expect(functionSource).toContain('from("music_project_items")');
    expect(functionSource).toContain('from("music_identifiers")');
    expect(functionSource).toContain('from("evidence_items")');
    expect(functionSource).toContain(".limit(150)");
    expect(functionSource).toContain("buildManagerReadPacket");
    expect(functionSource).not.toContain("input.facts");
    expect(functionSource).not.toContain("input.evidence");
    expect(functionSource).not.toContain("input.managerRead");
  });

  it("uses Responses API structured output and persists the generated read with provenance", () => {
    expect(functionSource).toContain("/v1/responses");
    expect(functionSource).toContain("json_schema");
    expect(functionSource).toContain("manager_synthesis_runs");
    expect(functionSource).toContain("ai_run_usage_events");
    expect(functionSource).toContain('trigger_type: "evidence_triggered"');
    expect(functionSource).toContain('workflow_key: "music_readiness_run"');
    expect(functionSource).toContain('run_type: "manager_synthesis"');
    expect(functionSource).toContain('status: "succeeded"');
    expect(functionSource).toContain("failure_reason");
    expect(functionSource).toContain("operating_events");
    expect(functionSource).toContain("persistGeneratedRead");
    expect(functionSource).toContain("manager_read");
    expect(promptSource).toContain("situationLine");
    expect(promptSource).toContain("watchNext");
    expect(promptSource).toContain("generationState");
  });

  it("uses a valid operating-event actor and does not fail a completed read when telemetry fails", () => {
    expect(functionSource).toContain('actor_type: "manager"');
    expect(functionSource).not.toContain('actor_type: "manager_ai"');
    expect(functionSource).toContain("writeOperatingEventSafe");
  });

  it("prompts as a human Manager while keeping provider attribution out of the main read", () => {
    expect(promptSource).toContain("You are the artist's senior manager");
    expect(promptSource).toContain("Write in first person as the Manager");
    expect(promptSource).toContain("130 words maximum");
    expect(promptSource).toContain("36 words maximum");
    expect(promptSource).toContain("Do not say I will demand");
    expect(promptSource).toContain("Do not dump credits, copyright notices, label text");
    expect(promptSource).toContain("Do not say Chartmetric found");
    expect(promptSource).toContain("Do not say Spotify confirms");
    expect(promptSource).toContain("Do not call the whole packet catalog-only");
    expect(promptSource).toContain("third-party intelligence shows attention");
    expect(promptSource).toContain("Rank by commercial usefulness");
    expect(promptSource).toContain("Never expose raw names like provider_window");
    expect(promptSource).toContain("not just a request for more data");
    expect(promptSource).toContain("Do not say movement, signal, activity, or momentum unless");
    expect(promptSource).toContain("Provider names belong in the Sources panel");
    expect(promptSource).toContain("exact numbers, names, dates, placements, ranks, and trends");
    expect(promptSource).toContain("basic English");
    expect(promptSource).toContain("what happened, why it matters, and what to do next");
    expect(promptSource).toContain("Do not use analytics jargon");
  });
});
