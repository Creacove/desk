import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildMissionGenesisInstructions,
  parseMissionGenesisOutput,
} from "../supabase/functions/_shared/openaiMissionGenesis";

const functionSource = readFileSync(join(process.cwd(), "supabase", "functions", "mission-genesis", "index.ts"), "utf8");

const packet = {
  artist: { id: "artist-1", name: "Nova Vale", stage: "developing", goals: ["Build a durable London audience"] },
  evidence: [
    { id: "evidence-london", label: "London monthly listeners", value: "42,000", confidence: "medium", limitation: "Public listener signal only" },
  ],
  music: [{ id: "song-midnight", title: "After Midnight", lifecycleStage: "released" }],
  memory: [{ id: "memory-budget", kind: "constraint", content: "Use no more than $5,000 before explicit approval." }],
  existingMissions: [],
};

function activeOutput() {
  return {
    outcome: "activate_mission",
    confidence: "medium",
    stage: { label: "developing", reason: "Nova Vale has a real London signal around After Midnight, but repeat behavior is not yet proven." },
    decisionSummary: "Organize a London proof loop around After Midnight before any scale decision.",
    reasons: ["London is the strongest saved audience signal and the artist wants durable audience growth."],
    evidenceNeeded: [],
    existingMissionId: "",
    questions: [],
    mission: {
      title: "Prove After Midnight can retain Nova Vale's London audience",
      objective: "Determine whether London listeners around After Midnight return, engage, or enter an owned audience path before approving scale.",
      reason: "The saved London listener signal is material but does not yet prove repeat behavior.",
      summary: "A 30-day London validation mission tied to After Midnight, the artist's audience goal, and the $5,000 approval boundary.",
      patternName: "Audience validation",
      currentRecommendation: "Run the lowest-cost London proof loop first and hold scale spend until the review checkpoint.",
      changeConditions: ["A stronger market signal overtakes London.", "The artist changes the 90-day goal."],
      timeline: "30 days",
      sourceRefs: ["evidence-london", "song-midnight", "memory-budget"],
    },
    checkpoints: [
      {
        key: "london_return_signal",
        title: "London return signal",
        question: "Does After Midnight produce repeat or owned-audience behavior in London?",
        decisionRule: "Continue only if the agreed return or capture signal improves during the review window.",
        requiredEvidence: ["A dated London response or capture measure"],
        missingEvidence: [],
        sourceRefs: ["evidence-london", "song-midnight"],
      },
    ],
    tasks: [
      {
        title: "Define the London return-behavior baseline for After Midnight",
        ownerRole: "Manager",
        primaryCheckpointKey: "london_return_signal",
        purpose: "Create the baseline needed to judge whether attention is becoming durable.",
        evidenceNeeded: ["Current London response baseline"],
        completionExpectation: "A dated baseline and one agreed review metric are saved.",
        riskIfLate: "The team cannot distinguish movement from noise.",
        sourceRefs: ["evidence-london", "song-midnight"],
      },
    ],
    permissionRequests: [],
  } as const;
}

describe("OpenAI Mission Genesis", () => {
  it("builds the complete artist packet server-side and gives OpenAI sole authorship of the decision and plan", () => {
    expect(functionSource).toContain("Deno.serve");
    expect(functionSource).toContain("auth.getUser()");
    expect(functionSource).toContain("is_account_member");
    for (const table of ["artist_profiles", "music_items", "music_projects", "evidence_items", "memory_entries", "agent_reports", "missions"]) {
      expect(functionSource).toContain(`selectMany(db, "${table}"`);
    }
    expect(functionSource).toContain("/v1/responses");
    expect(functionSource).toContain("missionGenesisJsonSchema");
    expect(functionSource).toContain("manager_run_actions");
    expect(functionSource).toContain("ai_run_usage_events");
    expect(functionSource).not.toContain("runMissionGenesisDecision");
    expect(functionSource).not.toContain("draftMissionPlan");
  });

  it("prompts for artist-specific reasoning and all-at-once context questions", () => {
    const initial = buildMissionGenesisInstructions("initial");
    const continuation = buildMissionGenesisInstructions("continuation");

    expect(initial).toContain("OpenAI is the decision engine");
    expect(initial).toContain("If the same mission could be returned for another artist");
    expect(initial).toContain("Ask every material user-controlled question at once");
    expect(initial).toContain("Do not create a mission merely because this workflow was invoked");
    expect(continuation).toContain("must not ask another round of context questions");
  });

  it("accepts a grounded personalized mission graph", () => {
    const parsed = parseMissionGenesisOutput(activeOutput(), packet, "initial");
    expect(parsed.mission.title).toContain("After Midnight");
    expect(parsed.tasks[0].primaryCheckpointKey).toBe("london_return_signal");
  });

  it("rejects the canned audience mission instead of persisting it", () => {
    const output = activeOutput();
    output.mission.title = "Test whether current attention is becoming repeatable audience behavior";
    expect(() => parseMissionGenesisOutput(output, packet, "initial")).toThrow(/generic or retired Mission Genesis copy/i);
  });

  it("rejects invented source references and orphaned tasks", () => {
    const invented = activeOutput();
    invented.mission.sourceRefs = ["not-in-packet"];
    expect(() => parseMissionGenesisOutput(invented, packet, "initial")).toThrow(/source reference/i);

    const orphaned = activeOutput();
    orphaned.tasks[0].primaryCheckpointKey = "missing_checkpoint";
    expect(() => parseMissionGenesisOutput(orphaned, packet, "initial")).toThrow(/checkpoint/i);
  });

  it("rejects a generic plan even when it cites real packet ids", () => {
    const generic = activeOutput();
    generic.mission.title = "Build a stronger audience foundation";
    generic.mission.objective = "Create a repeatable process for audience growth.";
    generic.mission.reason = "Audience growth is valuable for the artist.";
    generic.mission.summary = "A focused audience growth objective with clear review points.";
    generic.checkpoints[0].title = "Audience review";
    generic.checkpoints[0].question = "Is audience growth improving?";
    generic.tasks[0].title = "Define the audience baseline";
    generic.tasks[0].purpose = "Create a baseline for future comparison.";

    expect(() => parseMissionGenesisOutput(generic, packet, "initial")).toThrow(/artist-specific anchor/i);
  });

  it("rejects another question loop after the user answers the first batch", () => {
    const output = activeOutput();
    output.outcome = "candidate_needs_context";
    output.questions = [{ key: "more_context", question: "Anything else?", reason: "More context", answerKind: "short_text", options: [] }];
    expect(() => parseMissionGenesisOutput(output, packet, "continuation")).toThrow(/another round/i);
  });
});
