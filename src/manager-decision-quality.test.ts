import { describe, expect, it } from "vitest";
import {
  classifyManagerTurn,
  decisionGradeInstructions,
  managerAnalysisPhaseLabel,
  managerReasoningEffort,
} from "../supabase/functions/_shared/manager-conversation/decisionGrade";

describe("Manager decision-grade turn contract", () => {
  it.each([
    "Should we take a $30,000 offer for 50% of our masters for seven years?",
    "Is it worth spending $20,000 on this campaign or should we keep the cash?",
    "Should we accept this festival guarantee and commit to the tour?",
    "Do we sign this exclusive brand partnership for the next two years?",
    "Should we delay the release or keep the date and spend more to recover?",
  ])("classifies a consequential decision across management domains: %s", (body) => {
    expect(classifyManagerTurn({ body })).toMatchObject({ mode: "decision_grade" });
  });

  it.each([
    "Hello Manager",
    "What does recoupment mean?",
    "Which songs are in the catalog?",
    "Draft an EPK for this release",
    "I uploaded the new artwork",
  ])("keeps ordinary and workflow turns fast: %s", (body) => {
    expect(classifyManagerTurn({ body })).toMatchObject({ mode: "normal" });
  });

  it("uses submitted context answers when they contain the material decision", () => {
    expect(classifyManagerTurn({
      body: "What do you think?",
      contextAnswers: [
        { questionKey: "offer_structure", answer: "They want exclusivity for seven years" },
        { questionKey: "decision", answer: "We need to choose whether to sign the deal" },
      ],
    })).toMatchObject({ mode: "decision_grade" });
  });

  it("requires commercial analysis rather than legal boilerplate", () => {
    expect(decisionGradeInstructions).toContain("actual objective");
    expect(decisionGradeInstructions).toContain("verified facts, user-provided terms, assumptions, and unknowns");
    expect(decisionGradeInstructions).toContain("downside, base, and upside");
    expect(decisionGradeInstructions).toContain("ownership versus license");
    expect(decisionGradeInstructions).toContain("less expensive alternatives");
    expect(decisionGradeInstructions).toContain("ranked negotiating position");
    expect(decisionGradeInstructions).toContain("Questions before commitment");
    expect(decisionGradeInstructions).toContain("must not be treated as revenue proof");
    expect(decisionGradeInstructions).toContain("overrides the normal 1-3 paragraph rule");
    expect(decisionGradeInstructions).not.toMatch(/Niniola|\$30,000/i);
  });

  it("spends additional reasoning only on consequential choices", () => {
    expect(managerReasoningEffort("normal")).toBe("medium");
    expect(managerReasoningEffort("decision_grade")).toBe("high");
    expect(managerAnalysisPhaseLabel("normal")).toBe("Preparing the answer");
    expect(managerAnalysisPhaseLabel("decision_grade")).toBe("Working through the economics and trade-offs");
  });
});
