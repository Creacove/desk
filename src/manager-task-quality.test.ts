import { describe, expect, it } from "vitest";
import {
  buildAdaptivePlanCompilerInstructions,
  parseAdaptivePlanOutput,
} from "../supabase/functions/_shared/openaiAdaptivePlanCompiler";
import { buildMissionGenesisInstructions } from "../supabase/functions/_shared/openaiMissionGenesis";
import { buildManagerConversationInstructions } from "../supabase/functions/_shared/openaiManagerConversation";
import {
  MANAGER_HUMAN_TASK_GENERATION_CONTRACT_VERSION,
} from "../supabase/functions/_shared/managerHumanTaskGenerationContract";
import {
  buildManagerTaskQualityReviewInstructions,
  buildManagerTaskRepairInstructions,
  parseManagerTaskQualityReview,
} from "../supabase/functions/_shared/openaiManagerTaskQuality";

const validation = {
  allowedDeadlines: [],
  allowedAvailability: [],
  allowedFactScopes: ["artist", "mission:mission-1"],
};

describe("Manager human Task quality", () => {
  it("frontloads the same Manager-grade Task contract into every model path that can generate Tasks", () => {
    const generators = {
      missionGenesis: buildMissionGenesisInstructions("initial"),
      managerConversation: buildManagerConversationInstructions(),
      adaptivePlanCompiler: buildAdaptivePlanCompilerInstructions(),
    };

    for (const [name, instructions] of Object.entries(generators)) {
      expect(instructions, name).toContain(MANAGER_HUMAN_TASK_GENERATION_CONTRACT_VERSION);
      expect(instructions, name).toMatch(/Apply this BEFORE writing any visible Task/i);
      expect(instructions, name).toMatch(/Desk owns research, diagnosis, comparison, strategy/i);
      expect(instructions, name).toMatch(/Do not ask the artist to invent the concept/i);
      expect(instructions, name).toMatch(/could the named human execute this now/i);
      expect(instructions, name).toMatch(/what next\?/i);
    }
  });

  it("keeps deterministic validation structural instead of pretending words prove semantic quality", () => {
    const output = replanWithTask({
      title: "Record Odaeshi launch message for the audience",
      purpose: "Use one launch message to introduce Odaeshi and give the audience something to react to before release.",
      steps: [
        "Record a polished launch message that explains Odaeshi and keeps the delivery energetic from beginning to end.",
        "Keep the message clear and pace the recording carefully so the finished piece feels intentional and easy to follow.",
        "Publish the finished piece when it is ready and return the result to Desk so the Manager can continue from reality.",
      ],
      completionExpectation: "The finished launch piece is public and its result is returned to Desk for the next management decision.",
      managerResponsibility: "Desk reviews the real result, interprets the response, and decides whether this creative direction should continue.",
      userResponsibility: "Otmos records the launch message, completes the human publishing action, and returns the resulting public reference.",
      riskIfLate: "A late launch piece leaves less time for Desk to learn from the response before the release campaign advances.",
    });

    // This is intentionally allowed through the deterministic parser. Whether it is
    // actually manager-grade is a semantic question for the independent reviewer,
    // not a regex/synonym detector in application code.
    expect(parseAdaptivePlanOutput(output, validation).tasks).toHaveLength(1);
  });

  it("defines semantic quality as behavior rather than vocabulary", () => {
    const instructions = buildManagerTaskQualityReviewInstructions();
    expect(instructions).toMatch(/Judge meaning and executability, not vocabulary/i);
    expect(instructions).toMatch(/Do NOT use keyword matching, synonym lists/i);
    expect(instructions).toMatch(/without having to invent the strategy/i);
    expect(instructions).toMatch(/paying artist or team/i);
  });

  it("requires the reviewer to identify every Task before a pass can be trusted", () => {
    const review = parseManagerTaskQualityReview({
      verdict: "pass",
      summary: "Both Tasks are directly executable.",
      globalIssues: [],
      taskFindings: [
        { taskIndex: 0, verdict: "pass", issues: [], repairInstructions: [] },
        { taskIndex: 1, verdict: "pass", issues: [], repairInstructions: [] },
      ],
    }, 2);

    expect(review.verdict).toBe("pass");
    expect(review.taskFindings).toHaveLength(2);

    expect(() => parseManagerTaskQualityReview({
      verdict: "pass",
      summary: "Looks fine.",
      globalIssues: [],
      taskFindings: [
        { taskIndex: 0, verdict: "pass", issues: [], repairInstructions: [] },
      ],
    }, 2)).toThrow(/evaluate every visible human Task/i);
  });

  it("rejects contradictory reviewer output instead of trusting a superficial PASS", () => {
    expect(() => parseManagerTaskQualityReview({
      verdict: "pass",
      summary: "Pass.",
      globalIssues: ["The route still leaves the artist to choose the creative concept."],
      taskFindings: [
        {
          taskIndex: 0,
          verdict: "repair_required",
          issues: ["The concept is unresolved."],
          repairInstructions: ["Resolve the concept without inventing new resources."],
        },
      ],
    }, 1)).toThrow(/contradicted its PASS verdict/i);
  });

  it("builds a bounded repair prompt from exact semantic findings without authorizing invented facts", () => {
    const draft = parseAdaptivePlanOutput(replanWithTask({
      title: "Record Odaeshi launch message for the audience",
      purpose: "Use one launch message to introduce Odaeshi and give the audience something to react to before release.",
      steps: [
        "Record a polished launch message that explains Odaeshi and keeps the delivery energetic from beginning to end.",
        "Keep the message clear and pace the recording carefully so the finished piece feels intentional and easy to follow.",
        "Publish the finished piece when it is ready and return the result to Desk so the Manager can continue from reality.",
      ],
      completionExpectation: "The finished launch piece is public and its result is returned to Desk for the next management decision.",
      managerResponsibility: "Desk reviews the real result, interprets the response, and decides whether this creative direction should continue.",
      userResponsibility: "Otmos records the launch message, completes the human publishing action, and returns the resulting public reference.",
      riskIfLate: "A late launch piece leaves less time for Desk to learn from the response before the release campaign advances.",
    }), validation);

    const review = parseManagerTaskQualityReview({
      verdict: "repair_required",
      summary: "The Task is polished but still delegates the concept to the artist.",
      globalIssues: [],
      taskFindings: [{
        taskIndex: 0,
        verdict: "repair_required",
        issues: ["The brief does not resolve what the artist should actually say or do."],
        repairInstructions: ["Use the confirmed Odaeshi resilience thesis to resolve the creative action without inventing a new location or collaborator."],
      }],
    }, 1);

    const repair = buildManagerTaskRepairInstructions(review, draft);
    expect(repair).toMatch(/Repair the draft once/i);
    expect(repair).toMatch(/Never invent specificity/i);
    expect(repair).toMatch(/return needs_context/i);
    expect(repair).toContain("does not resolve what the artist should actually say or do");
  });

  it("accepts an Odaeshi-quality executable Task structurally before semantic review", () => {
    const output = replanWithTask({
      title: "Shoot Odaeshi resilience conversation in a parked car",
      purpose: "Turn Odaeshi's resilience meaning into a human story viewers can immediately recognise and respond to.",
      steps: [
        "Park the car somewhere quiet and frame Otmos with two friends on a phone in vertical 9:16.",
        "Open with the on-screen question ‘What couldn’t finish us?’ and let each friend answer one thing they survived.",
        "After the final answer, Otmos says ‘That’s Odaeshi,’ then bring in the chorus and cut to the three of them reacting.",
        "Keep the edit under 40 seconds, add readable subtitles, and end with a caption asking viewers what they came back from.",
        "Post to TikTok or Reels and send Desk the public link so it can review comments, saves, shares, and the next move.",
      ],
      completionExpectation: "A public TikTok or Reel link is sent to Desk with the finished 40-second-or-shorter video live.",
      managerResponsibility: "Desk reviews the public result, compares the response with the creative hypothesis, and decides the next Task.",
      userResponsibility: "Otmos records the conversation with two friends, completes the edit, publishes it, and returns the public post link.",
      riskIfLate: "Delaying the first story-led post reduces the time Desk has to learn which Odaeshi creative territory deserves repetition.",
    });

    expect(parseAdaptivePlanOutput(output, validation).tasks[0]).toMatchObject({
      title: "Shoot Odaeshi resilience conversation in a parked car",
      estimatedMinutes: 40,
    });
  });

  it("still fails closed on objective structural defects before any semantic review", () => {
    const output = replanWithTask({
      steps: [
        "Record the agreed Odaeshi concept exactly as prepared for the active Mission.",
        "Record the agreed Odaeshi concept exactly as prepared for the active Mission.",
        "Return the result to Desk after the human action is actually complete.",
      ],
    });

    expect(() => parseAdaptivePlanOutput(output, validation)).toThrow(/duplicates/i);
  });

  it("rejects internal runtime instructions even when the rest of the Task is structurally valid", () => {
    const output = replanWithTask({
      steps: [
        "Retrieve the artist operating packet and copy its evidence ids into mission.sourceRefs.",
        "Populate the permissionRequests queue for the proposed external action.",
        "Return the generated database records to Desk so the Manager can continue.",
      ],
    });

    expect(() => parseAdaptivePlanOutput(output, validation)).toThrow(/system support/i);
  });
});

function replanWithTask(task: Partial<Record<string, unknown>>) {
  return {
    decision: "replan",
    reason: "The current route needs replacement human work.",
    whatChanged: "The next human action changed.",
    missionRecommendation: "Run the concrete replacement Task and review the result.",
    planSummary: "One executable human Task before the next decision gate.",
    strategyState: {
      objective: "Make Odaeshi a cultural anthem representing strength and collective unity.",
      strategicThesis: "Lead with lived resilience stories rather than generic song promotion.",
      desiredAudienceBehavior: "People should recognise themselves in the story and respond with their own resilience moments.",
      creativePillars: ["We still stand", "Tough skin stories"],
      culturalMeaning: ["Igbo resilience", "Collective strength"],
      constraints: [],
      scopedBudget: "₦0 for this Task",
      availableResources: ["Phone", "Two friends", "Parked car"],
      horizon: "This week",
      successIndicators: ["Meaningful comments", "Saves", "Shares"],
      rejectedDirections: [],
      guardrails: ["Do not turn resilience into empty motivational copy"],
      updatedBecause: "The next human action needs to be executable.",
    },
    questions: [],
    checkpoints: [{
      key: "creative_response",
      title: "Review creative response",
      question: "Did this creative territory produce enough meaningful response to repeat?",
      decisionRule: "Repeat only if the response supports the resilience-story hypothesis.",
      managerRead: "Desk will review the returned result.",
      nextAction: "Choose repeat, change, or stop.",
      watchedSignals: ["comments", "saves", "shares"],
    }],
    tasks: [{
      title: "Execute the next human action",
      checkpointKey: "creative_response",
      ownerRole: "Artist",
      workMode: "artist_action",
      purpose: "Complete the next concrete action so Desk has a real result to manage from.",
      steps: [
        "Follow the prepared execution brief exactly as written for this Task.",
        "Complete the physical or social action that only the artist can perform.",
        "Return the requested result to Desk so the Manager can review reality.",
      ],
      completionMode: "result_note",
      completionExpectation: "Desk receives the requested real-world result and can make the next management decision from it.",
      managerResponsibility: "Desk prepares the route, reviews the result, and decides what happens next without asking the artist to plan it.",
      userResponsibility: "The artist performs the specified human action and returns the exact result Desk requested for review.",
      riskIfLate: "Delay reduces the time available for Desk to learn from the result and adapt the active Mission while it still matters.",
      availableFrom: "",
      deadline: "",
      estimatedMinutes: 40,
      ...task,
    }],
    permissionRequests: [],
  };
}
