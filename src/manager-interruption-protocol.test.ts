import { describe, expect, it } from "vitest";

import {
  buildManagerConversationInstructions,
  parseManagerConversationOutput,
} from "../supabase/functions/_shared/openaiManagerConversation";

function outputWithQuestions(contextQuestions: unknown[]) {
  return JSON.stringify({
    topic: "Launch kit",
    summary: "Manager needs one input.",
    status: "Waiting on input",
    confidence: "high",
    classification: "release_campaign",
    actionPolicy: "request_evidence",
    responseBody: "I need one item before I can continue.",
    evidenceIds: [],
    limitations: [],
    createdWork: [],
    missionGraphDecisions: [],
    contextQuestions,
    proposedActions: [],
    durableMemory: [],
  });
}

describe("Manager interruption protocol", () => {
  it("tells Manager to route workspace work instead of asking for fake text confirmation", () => {
    const instructions = buildManagerConversationInstructions();
    expect(instructions).toContain("contextQuestions are only for human input that can be supplied entirely as a conversational answer");
    expect(instructions).toContain("workspace_action:<target>:<short_slug>");
    expect(instructions).toContain("Never ask the user to type 'done'");
    expect(instructions).toContain("use files for audio, artwork");
  });

  it("normalizes file blockers into compact workspace actions", () => {
    const output = parseManagerConversationOutput(outputWithQuestions([{
      key: "workspace_action:FILES:cover_art",
      question: "Approved cover artwork is missing and the Manager needs the final approved artwork before the campaign kit can be completed for review and delivery.",
      reason: "The current song has no approved cover artwork attached. Add the approved cover in Files so the application can verify the asset directly instead of asking you to confirm it in chat.",
      answerKind: "short_text",
      options: ["This should disappear"],
      recommendedAnswer: "Add approved artwork now from the song Files section",
      recommendationReason: "This should disappear too.",
    }]));

    const action = output.contextQuestions[0];
    expect(action.key).toBe("workspace_action:files:cover_art");
    expect(action.answerKind).toBe("short_text");
    expect(action.options).toEqual([]);
    expect(action.question.length).toBeLessThanOrEqual(140);
    expect(action.reason.length).toBeLessThanOrEqual(220);
    expect(action.recommendedAnswer.length).toBeLessThanOrEqual(55);
    expect(action.recommendationReason).toBe("");
  });

  it("caps conversational choices so the mobile decision UI stays scannable", () => {
    const output = parseManagerConversationOutput(outputWithQuestions([{
      key: "launch_market",
      question: "Considering all the information already available in the workspace and the current release campaign, which market should the team prioritize as the primary launch market for this song?",
      reason: "This decision changes the campaign focus.",
      answerKind: "single_select",
      options: [
        "Nigeria",
        "United Kingdom",
        "United States",
        "South Africa",
        "Ghana",
        "France",
        "A deliberately extremely long option label that should be clipped because it would destroy the compact mobile decision experience when rendered inside the Manager composer",
      ],
      recommendedAnswer: "Nigeria",
      recommendationReason: "Current evidence supports it.",
    }]));

    const decision = output.contextQuestions[0];
    expect(decision.question.length).toBeLessThanOrEqual(140);
    expect(decision.options).toHaveLength(5);
    expect(decision.options.every((option) => option.length <= 90)).toBe(true);
    expect(decision.recommendedAnswer).toBe("Nigeria");
  });
});
