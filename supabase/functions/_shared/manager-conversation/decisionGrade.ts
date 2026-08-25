export type ManagerTurnMode = "normal" | "decision_grade";

type ManagerTurnInput = {
  body: string;
  contextAnswers?: Array<{ questionKey: string; answer: string }>;
};

const decisionIntentPattern = /\b(?:should|do|can|would)\s+(?:we|i)|\bis\s+it\s+worth\b|\bwhich\s+(?:option|path|offer|deal|choice)\b|\b(?:accept|reject|take|decline|turn down|sign|spend|invest|delay|postpone|keep|choose|negotiate|counter|license|sell|commit|approve|pause|continue)\b|\b(?:better|cheaper|stronger|safer)\s+(?:to|than)\b/i;
const comparisonPattern = /\b(?:versus|vs\.?|or should|compared with|instead of|rather than|trade-?off)\b/i;
const materialStakePattern = /(?:[$€£₦]\s?\d|\b\d[\d,.]*\s*(?:dollars?|usd|eur|gbp|naira|percent|%)\b)|\b(?:money|cash|advance|offer|budget|spend|investment|payment|guarantee|fee|financing|loan|cost|runway|revenue|income|royalt(?:y|ies)|masters?|rights?|ownership|licen[cs]e|publishing|points|splits?|recoup(?:ment|able)?|catalog(?:ue)?|term|years?|months?|exclusiv(?:e|ity)|options?|control|reversion|territor(?:y|ies)|cross-collateralization|contract|agreement|deal|distribution|distributor|partnership|brand|sponsor|tour|festival|show|release date|delay|postpone|commitment|reputation)\b/i;
const artifactRequestPattern = /\b(?:draft|write|prepare|create|make|build|revise|refresh|update|finish|complete)\b[\s\S]{0,80}\b(?:epk|press kit|press release|pitch|content plan|release calendar|one[- ]sheet|bio(?:graphy)?|lyrics|credits|distributor notes|document)\b/i;

export function classifyManagerTurn(input: ManagerTurnInput): { mode: ManagerTurnMode; reason: string } {
  const context = (input.contextAnswers ?? [])
    .map((item) => `${item.questionKey} ${item.answer}`)
    .join(" ");
  const text = `${input.body ?? ""} ${context}`.replace(/[_-]+/g, " ").trim();

  if (!text || artifactRequestPattern.test(text)) {
    return { mode: "normal", reason: text ? "artifact_or_workflow_request" : "empty_turn" };
  }

  const hasDecisionIntent = decisionIntentPattern.test(text) || comparisonPattern.test(text);
  const hasMaterialStake = materialStakePattern.test(text);
  if (hasDecisionIntent && hasMaterialStake) {
    return { mode: "decision_grade", reason: "material_choice_with_long_term_tradeoffs" };
  }

  return { mode: "normal", reason: hasDecisionIntent ? "choice_without_material_stakes" : "ordinary_manager_turn" };
}

export function managerReasoningEffort(mode: ManagerTurnMode): "medium" | "high" {
  return mode === "decision_grade" ? "high" : "medium";
}

export function managerAnalysisPhaseLabel(mode: ManagerTurnMode) {
  return mode === "decision_grade"
    ? "Working through the economics and trade-offs"
    : "Preparing the answer";
}

export const decisionGradeInstructions = [
  "Decision-grade management standard: this turn asks for a consequential choice. The following standard overrides the normal 1-3 paragraph rule for this turn only.",
  "First identify the artist's actual objective and the immediate need the proposed move solves. Establish the current artist, catalog, financial, and leverage position from available workspace evidence.",
  "Separate verified facts, user-provided terms, assumptions, and unknowns. Public popularity, playlist reach, social attention, and catalog visibility must not be treated as revenue proof.",
  "Quantify what the artist receives and what the artist surrenders. When numbers materially affect the choice, show clearly labeled downside, base, and upside scenarios, the assumptions behind them, and the break-even or opportunity-cost implication. Never present an estimate as known artist revenue.",
  "Inspect only the mechanics that could change this decision, including scope, ownership versus license, revenue definition, recoupment, deductions, term, extensions, territory, control, partner obligations, accounting, audit, cross-collateralization, reversion, and exit conditions when applicable.",
  "Compare credible and less expensive alternatives that could achieve the same objective. Give a ranked negotiating position with concrete terms, then identify the unanswered questions capable of reversing the recommendation.",
  "Give an actionable conditional recommendation. Use this hierarchy when it helps: Manager's position; What the move solves; Current position; What is surrendered; Economics; Terms that change the answer; Alternatives; Our counter; Questions before commitment.",
  "Short headings, bullets, and one compact scenario table are allowed when they make the decision easier to understand. Professional legal, tax, accounting, or wellbeing review is a concise boundary after useful management judgment, never a substitute for it.",
].join("\n");
