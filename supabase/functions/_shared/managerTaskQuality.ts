export type ExecutableHumanTaskShape = {
  title: string;
  purpose: string;
  steps: string[];
  completionExpectation: string;
  managerResponsibility: string;
  userResponsibility: string;
  riskIfLate: string;
};

export class HumanTaskContractError extends Error {
  readonly issues: string[];

  constructor(title: string, issues: string[]) {
    super(`Human Task contract failed for ${title || "untitled task"}: ${issues.join(" ")}`);
    this.name = "HumanTaskContractError";
    this.issues = issues;
  }
}

/**
 * Deterministic validation is deliberately limited to objective runtime invariants.
 * It does not infer quality from length, vocabulary, synonyms, content nouns, or
 * domain-specific regexes. Semantic quality belongs in the generation contract;
 * this guard exists only to prevent malformed structured Tasks from persisting.
 */
export function assertExecutableHumanTask(task: ExecutableHumanTaskShape) {
  const title = clean(task.title);
  const purpose = clean(task.purpose);
  const completionExpectation = clean(task.completionExpectation);
  const managerResponsibility = clean(task.managerResponsibility);
  const userResponsibility = clean(task.userResponsibility);
  const riskIfLate = clean(task.riskIfLate);
  const steps = task.steps.map(clean).filter(Boolean);
  const issues: string[] = [];

  if (!title) issues.push("Title is required.");
  if (!purpose) issues.push("Purpose is required.");
  if (steps.length < 3) issues.push("The structured Task contract requires at least three execution steps.");
  if (!completionExpectation) issues.push("Completion expectation is required.");
  if (!managerResponsibility) issues.push("Manager responsibility is required.");
  if (!userResponsibility) issues.push("Human responsibility is required.");
  if (!riskIfLate) issues.push("Consequence of delay is required.");

  const normalizedSteps = steps.map(normalize);
  if (new Set(normalizedSteps).size !== normalizedSteps.length) {
    issues.push("Execution steps contain exact or punctuation-only duplicates.");
  }

  const systemFacingStep = steps.find((step) =>
    /\b(packet|mission\.sourcerefs|source refs|sourcerefs|reference evidence ids|evidence ids into|populate permissionrequests|permissionrequests queue|retrieve artist packet|artist operating packet|attach evidence refs)\b/i.test(step)
  );
  if (systemFacingStep) {
    issues.push(`System support must not appear inside visible human Tasks: ${systemFacingStep}`);
  }

  if (issues.length) throw new HumanTaskContractError(title, issues);
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
