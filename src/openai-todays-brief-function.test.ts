import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const functionSource = readFileSync(join(process.cwd(), "supabase", "functions", "generate-todays-brief", "index.ts"), "utf8");
const promptSource = readFileSync(join(process.cwd(), "supabase", "functions", "_shared", "openaiTodaysBrief.ts"), "utf8");

const bannedVisibleTerms = ["Chartmetric", "provider", "API", "normalized", "database", "evidence row", "third-party"];

describe("OpenAI Today's Brief generation function", () => {
  it("authenticates users and builds the packet from saved artist records only", () => {
    expect(functionSource).toContain("Deno.serve");
    expect(functionSource).toContain("Authorization");
    expect(functionSource).toContain("auth.getUser()");
    expect(functionSource).toContain("is_account_member");
    expect(functionSource).toContain("buildArtistBriefPacket");
    expect(functionSource).toContain('from("artist_profiles")');
    expect(functionSource).toContain('from("music_items")');
    expect(functionSource).toContain('from("music_projects")');
    expect(functionSource).toContain('from("evidence_items")');
    expect(functionSource).toContain('from("source_sync_jobs")');
    expect(functionSource).not.toContain("input.evidence");
    expect(functionSource).not.toContain("input.facts");
    expect(functionSource).not.toContain("input.brief");
  });

  it("uses structured output, stores provenance, and validates visible Manager language", () => {
    expect(functionSource).toContain("/v1/responses");
    expect(functionSource).toContain("json_schema");
    expect(functionSource).toContain("todaysBriefJsonSchema");
    expect(functionSource).toContain("manager_synthesis_runs");
    expect(functionSource).toContain("ai_run_usage_events");
    expect(functionSource).toContain("operating_events");
    expect(functionSource).toContain('classification: "setup_todays_brief_v1"');
    expect(functionSource).toContain("claimAudit");
    expect(functionSource).toContain("assertNoBannedVisibleTerms");
    expect(functionSource).toContain("assertSignalsHaveEvidenceIds");
  });

  it("defines the premium brief fields and hides vendor/backend language from visible copy", () => {
    for (const field of [
      "headlineRead",
      "artistSnapshot",
      "signals",
      "managerRead",
      "teamRead",
      "todayDirective",
      "missingProof",
      "sourceLine",
      "claimAudit",
    ]) {
      expect(promptSource).toContain(field);
    }

    expect(promptSource).toContain("Write as the artist's senior Manager");
    expect(promptSource).toContain("Do not name backend sources or data vendors");
    expect(promptSource).toContain("Your audience picture is");
    expect(promptSource).toContain("I would treat this as");
    expect(promptSource).toContain("private saves");
    expect(promptSource).toContain("source-of-stream");
    expect(promptSource).toContain("campaign ROI");

    for (const term of bannedVisibleTerms) {
      expect(promptSource).toContain(term);
    }
  });
});
