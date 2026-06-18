import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildTodaysBriefInstructions, parseTodaysBriefOutput } from "../supabase/functions/_shared/openaiTodaysBrief";

const functionSource = readFileSync(join(process.cwd(), "supabase", "functions", "generate-todays-brief", "index.ts"), "utf8");
const promptSource = readFileSync(join(process.cwd(), "supabase", "functions", "_shared", "openaiTodaysBrief.ts"), "utf8");

const bannedVisibleTerms = ["Chartmetric", "provider", "API", "normalized", "database", "evidence row", "third-party"];

describe("OpenAI Today's Brief generation function", () => {
  it("authenticates users and builds the packet from all saved artist and music intelligence", () => {
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
    expect(functionSource).toContain("buildIntelligenceSnapshotInputs");
    expect(functionSource).toContain("deriveInsightComparisons");
    expect(functionSource).toContain("working catalog in view");
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
    expect(functionSource).not.toContain("assertNoBannedVisibleTerms(completed)");
    expect(functionSource).toContain("assertSignalsHaveEvidenceIds");
  });

  it("selects separate setup-map and operating prompt modes", () => {
    expect(functionSource).toContain('generationMode?: "operating" | "setup-map"');
    expect(functionSource).toContain("readGenerationMode(input)");
    expect(functionSource).toContain("callOpenAITodaysBrief(packet, generationMode)");

    const setupMapPrompt = buildTodaysBriefInstructions("setup-map");
    const operatingPrompt = buildTodaysBriefInstructions("operating");

    expect(setupMapPrompt).toContain("Artist Operating Map");
    expect(setupMapPrompt).toContain("highly personal");
    expect(setupMapPrompt).toContain("not a rigid template");
    expect(setupMapPrompt).toContain("first sentence");
    expect(setupMapPrompt).toContain("catalog, projects, tracks, audience geography, platform behavior");
    expect(setupMapPrompt).toContain("intelligenceSnapshot metrics must support the specific thesis of this artist");
    expect(operatingPrompt).toContain("End the Manager's Read with one useful thing to do today");
    expect(operatingPrompt).not.toContain("Artist Operating Map");
  });

  it("allows complete Today's Brief copy instead of forcing short character caps", () => {
    expect(promptSource).toContain("3-5 short paragraphs separated by blank lines");
    expect(promptSource).toContain("complete sentences");
    expect(promptSource).toContain("Do not stop mid-sentence");
    expect(promptSource).toContain("Metric value must be the atomic number or short fact only");
    expect(promptSource).toContain("Do not put parenthetical explanations in metric value");
    expect(promptSource).not.toContain('headlineRead: { type: "string", maxLength: 180 }');
    expect(promptSource).not.toContain('snapshotSummary: { type: "string", maxLength: 280 }');
    expect(promptSource).not.toContain('managerRead: { type: "string", maxLength: 1800 }');
  });

  it("sanitizes style-policy terms without hard-failing a usable brief", () => {
    const output = parseTodaysBriefOutput({
      headlineRead: "Nova Vale has a clear campaign starting point.",
      intelligenceSnapshot: [
        {
          title: "Artist Intelligence",
          insight: "The campaign read is centered on London.",
          metrics: [
            { label: "Campaign signal", value: "1.2M", context: "campaign context", evidenceIds: ["ev-1"] },
          ],
        },
      ],
      snapshotSummary: "The first campaign read has a usable shape.",
      managerRead: "The campaign should start with London because the artist already has public pull there.",
      sourceLine: "Based on your saved artist profile, current music in view, public audience signals, and source limits.",
      confidence: "medium",
      claimAudit: [{ claim: "London is the lead signal.", evidenceIds: ["ev-1"], limitation: "Public signal only." }],
    });

    const visibleCopy = [
      output.headlineRead,
      output.snapshotSummary,
      output.managerRead,
      output.sourceLine,
      ...output.intelligenceSnapshot.flatMap((group) => [
        group.title,
        group.insight,
        ...group.metrics.flatMap((metric) => [metric.label, metric.value, metric.context ?? ""]),
      ]),
    ].join(" ");

    expect(visibleCopy).not.toMatch(/\bcampaign\b/i);
    expect(output.managerRead).toContain("London");
    expect(output.intelligenceSnapshot[0].metrics[0].evidenceIds).toEqual(["ev-1"]);
  });

  it("defines the premium intelligence brief fields and hides vendor/backend language from visible copy", () => {
    for (const field of [
      "headlineRead",
      "intelligenceSnapshot",
      "metrics",
      "insight",
      "managerRead",
      "sourceLine",
      "claimAudit",
    ]) {
      expect(promptSource).toContain(field);
    }

    expect(promptSource).toContain("Write as the artist's senior Manager");
    expect(promptSource).toContain("Do not name backend sources or data vendors");
    expect(promptSource).toContain("If a sentence could be said to another artist, delete it");
    expect(promptSource).toContain("This is the first setup brief after onboarding");
    expect(promptSource).toContain("Do not pretend a campaign, mission, rollout, or release plan already exists");
    expect(promptSource).toContain("Do not explain that the working catalog is not the full discography");
    expect(promptSource).toContain("Do not lead with missing data");
    expect(promptSource).toContain("derive ratios, contrasts, and ranking insights");
    expect(promptSource).toContain("Current Music In View");
    expect(promptSource).toContain("do not infer full discography size from the workspace catalog");
    expect(promptSource).not.toContain("Still missing");
    expect(promptSource).not.toContain("private saves, repeat listeners");

    for (const term of bannedVisibleTerms) {
      expect(promptSource).toContain(term);
    }
  });
});
