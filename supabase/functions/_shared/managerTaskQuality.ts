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
 * Deterministic validation for invariants that should never be delegated to a model.
 * Semantic quality is intentionally NOT inferred from keywords, synonyms, content nouns,
 * or domain-specific regexes. The independent model reviewer owns that judgement.
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

  if (title.length < 8) issues.push("Title is missing or too short to identify the work safely.");
  if (purpose.length < 24) issues.push("Purpose is missing or too thin.");
  if (steps.length < 3) issues.push("At least three execution steps are required by the runtime contract.");
  if (completionExpectation.length < 20) issues.push("Completion expectation is missing or too thin.");
  if (managerResponsibility.length < 20) issues.push("Manager responsibility is missing or too thin.");
  if (userResponsibility.length < 20) issues.push("Human responsibility is missing or too thin.");
  if (riskIfLate.length < 20) issues.push("Consequence of delay is missing or too thin.");

  const normalizedSteps = steps.map(normalize);
  if (new Set(normalizedSteps).size !== normalizedSteps.length) {
    issues.push("Execution steps contain exact or punctuation-only duplicates.");
  }

  for (const step of steps) {
    if (step.length < 18) {
      issues.push("An execution step is too short to carry a usable instruction.");
      break;
    }
  }

  if (steps.join(" ").length < 100) {
    issues.push("The execution sequence is structurally too thin for a multi-step human Task.");
  }

  if (issues.length) throw new HumanTaskContractError(title, issues);
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
