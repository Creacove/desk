import type { ManagerConversationOutput } from "./openaiManagerConversationLegacy.ts";

const RELEASED_STAGES = new Set(["released", "catalog", "catalogued", "archived"]);
const ASSET_TERMS = /\b(audio|master|artwork|cover art|credits?|rights?|splits?|release assets?|release package|metadata)\b/i;
const REQUEST_TERMS = /\b(upload|provide|add|attach|supply|collect|complete|submit|gather|need|needs|needed|required|requires|missing|open files|open rights)\b/i;
const NEGATED_REQUIREMENT = /\b(no need|do not need|does not need|not required|without requiring|already (?:has|exists|available))\b/i;
const EXPLICIT_CORRECTION = /\b(replace|correct|fix|amend|update|change|wrong|incorrect|takedown)\b/i;
const SPECIFIC_POST_RELEASE_DEPENDENCY = /\b(sync|licen[cs](?:e|ing)|clearance|rights dispute|ownership dispute|metadata correction|delivery correction|takedown|replacement master)\b/i;

type FocusedMusicSubject = {
  lifecycleStage?: unknown;
  lifecycle_stage?: unknown;
  releasedAt?: unknown;
  released_at?: unknown;
  sourceKind?: unknown;
  source_kind?: unknown;
};

export function isReleasedCatalogSubject(subject: FocusedMusicSubject | null | undefined) {
  if (!subject) return false;
  const lifecycle = text(subject.lifecycleStage ?? subject.lifecycle_stage).toLowerCase();
  return RELEASED_STAGES.has(lifecycle) || Boolean(text(subject.releasedAt ?? subject.released_at));
}

export function assertReleasedCatalogManagerPolicy(
  output: ManagerConversationOutput,
  subject: FocusedMusicSubject | null | undefined,
  userRequest: string,
) {
  if (!isReleasedCatalogSubject(subject)) return;

  const userAskedForCorrection = ASSET_TERMS.test(userRequest) && EXPLICIT_CORRECTION.test(userRequest);
  const userNamedExactDependency = SPECIFIC_POST_RELEASE_DEPENDENCY.test(userRequest);
  if (userAskedForCorrection || userNamedExactDependency) return;

  const violations: string[] = [];
  if (isGenericAssetRequirement(output.responseBody)) violations.push("response");

  for (const decision of output.missionGraphDecisions) {
    for (const task of decision.tasks) {
      const taskText = [
        task.title,
        task.purpose,
        ...task.steps,
        ...task.evidenceNeeded,
        task.completionExpectation,
      ].join(" ");
      if (isGenericAssetRequirement(taskText) && !SPECIFIC_POST_RELEASE_DEPENDENCY.test(taskText)) {
        violations.push(`task:${task.title}`);
      }
    }
  }

  for (const question of output.contextQuestions) {
    const questionText = [question.key, question.question, question.reason, question.recommendedAnswer].join(" ");
    const isAssetWorkspaceAction = /^workspace_action:(files|rights|details):/i.test(question.key)
      && ASSET_TERMS.test(questionText);
    if ((isAssetWorkspaceAction || isGenericAssetRequirement(questionText))
      && !SPECIFIC_POST_RELEASE_DEPENDENCY.test(questionText)) {
      violations.push(`question:${question.key}`);
    }
  }

  if (violations.length) {
    throw new Error(
      `Manager output violated the released/catalog policy (${violations.join(", ")}). `
      + "Released music cannot be blocked by generic pre-release asset collection.",
    );
  }
}

function isGenericAssetRequirement(value: unknown) {
  const valueText = text(value);
  return Boolean(valueText)
    && ASSET_TERMS.test(valueText)
    && REQUEST_TERMS.test(valueText)
    && !NEGATED_REQUIREMENT.test(valueText);
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
