import type { AdaptivePlanOutput } from "./openaiAdaptivePlanCompiler.ts";

export type ManagerTaskQualityFinding = {
  taskIndex: number;
  verdict: "pass" | "repair_required";
  issues: string[];
  repairInstructions: string[];
};

export type ManagerTaskQualityReview = {
  verdict: "pass" | "repair_required";
  summary: string;
  globalIssues: string[];
  taskFindings: ManagerTaskQualityFinding[];
};

const stringArray = { type: "array", items: { type: "string" } };

export const managerTaskQualityReviewJsonSchema = {
  name: "manager_task_quality_review_v1",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["verdict", "summary", "globalIssues", "taskFindings"],
    properties: {
      verdict: { type: "string", enum: ["pass", "repair_required"] },
      summary: { type: "string" },
      globalIssues: stringArray,
      taskFindings: {
        type: "array",
        maxItems: 24,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["taskIndex", "verdict", "issues", "repairInstructions"],
          properties: {
            taskIndex: { type: "integer", minimum: 0, maximum: 23 },
            verdict: { type: "string", enum: ["pass", "repair_required"] },
            issues: stringArray,
            repairInstructions: stringArray,
          },
        },
      },
    },
  },
};

export function buildManagerTaskQualityReviewInstructions() {
  return [
    "You are the semantic quality reviewer for Desk's Manager Runtime. Review the proposed visible human Tasks before they can reach an artist.",
    "Judge meaning and executability, not vocabulary. Do NOT use keyword matching, synonym lists, or the presence of particular nouns as proof of quality.",
    "The central test is behavioral: could the named human perform the Task now, from the supplied context and Task brief, without having to invent the strategy, choose the creative direction, guess missing resources, or ask Desk 'okay, but how?'",
    "PASS only when each visible Task clearly states the concrete human action, the practical sequence, what finished looks like, what the human owns, what Desk owns, and what real-world result returns to the Manager when one is needed.",
    "A Task may be concise when the action is intrinsically simple. Do not reward verbosity. Several polished sentences that still leave the artist to decide the concept, angle, setup, audience action, outreach target, or next management decision must fail.",
    "For creative/content work, infer what execution detail is necessary from the actual concept. A good brief normally resolves the creative idea and enough of the setup, performance/action, format/treatment, and result handoff to make the concept executable. These are semantic dimensions, not required words or a lexical checklist.",
    "For non-content work, apply the equivalent domain-specific standard. An interview, rehearsal, rights task, meeting, live action, collaboration, or offline errand should contain the information a competent manager would give the artist before sending them to do it.",
    "Do not require Desk to restate facts already clear in context. Do not demand invented facts. If a required real-world fact is genuinely unknown and materially changes the route, the plan should ask one Manager context question rather than hide the unknown inside a Task.",
    "Fail any Task that delegates Manager work back to the artist: strategy, research, deciding what to make, choosing targets, figuring out positioning, interpreting performance, deciding what happens next, or reconstructing the brief.",
    "Fail fabricated specificity. A Task is not better because it invents a location, collaborator, budget, deadline, audience fact, permission, or commitment not present in context.",
    "Check the plan as a whole too: the Tasks should form a coherent remaining route, align with the stated strategy/checkpoints, and avoid recreating already completed/accepted work unless the changed reality invalidated that result.",
    "When repair is required, identify the exact semantic gap and give repair instructions that are usable by the Plan Compiler. Do not write the repaired Task yourself and do not introduce new facts.",
    "Return PASS only when you would be comfortable shipping the Tasks directly to a paying artist or team with no human operator cleaning them up.",
  ].join("\n");
}

export function parseManagerTaskQualityReview(raw: unknown, taskCount: number): ManagerTaskQualityReview {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Manager Task quality reviewer returned an invalid object.");
  }
  const value = raw as Record<string, unknown>;
  const verdict = value.verdict === "pass" || value.verdict === "repair_required" ? value.verdict : null;
  if (!verdict) throw new Error("Manager Task quality reviewer returned an invalid verdict.");

  const findings = array(value.taskFindings).map((item) => {
    const row = record(item);
    const taskIndex = Number(row.taskIndex);
    if (!Number.isInteger(taskIndex) || taskIndex < 0 || taskIndex >= taskCount) {
      throw new Error("Manager Task quality reviewer referenced an invalid task index.");
    }
    const findingVerdict = row.verdict === "pass" || row.verdict === "repair_required" ? row.verdict : null;
    if (!findingVerdict) throw new Error("Manager Task quality reviewer returned an invalid task verdict.");
    return {
      taskIndex,
      verdict: findingVerdict,
      issues: strings(row.issues),
      repairInstructions: strings(row.repairInstructions),
    } satisfies ManagerTaskQualityFinding;
  });

  const seen = new Set<number>();
  for (const finding of findings) {
    if (seen.has(finding.taskIndex)) throw new Error("Manager Task quality reviewer returned duplicate task findings.");
    seen.add(finding.taskIndex);
  }
  if (taskCount > 0 && findings.length !== taskCount) {
    throw new Error("Manager Task quality reviewer must evaluate every visible human Task.");
  }

  const globalIssues = strings(value.globalIssues);
  const hasRepairFinding = findings.some((finding) => finding.verdict === "repair_required");
  if (verdict === "pass" && (hasRepairFinding || globalIssues.length > 0)) {
    throw new Error("Manager Task quality reviewer contradicted its PASS verdict.");
  }
  if (verdict === "repair_required" && !hasRepairFinding && globalIssues.length === 0) {
    throw new Error("Manager Task quality reviewer requested repair without identifying a semantic issue.");
  }

  return {
    verdict,
    summary: text(value.summary),
    globalIssues,
    taskFindings: findings,
  };
}

export function buildManagerTaskRepairInstructions(review: ManagerTaskQualityReview, draft: AdaptivePlanOutput) {
  return [
    "QUALITY REPAIR PASS: the first structured draft was blocked by Desk's independent semantic Task reviewer.",
    "Repair the draft once. Preserve every valid fact, strategy decision, checkpoint, permission boundary, deadline/availability allow-list rule, and completed-work constraint.",
    "Change only what is necessary to resolve the reviewer findings. Never invent specificity to satisfy the reviewer.",
    "If a finding cannot be repaired without one genuinely decision-changing human fact, return needs_context with exactly one quality Manager question instead of guessing.",
    "The repaired response must still be a complete coherent replacement route, not a patch fragment.",
    `Reviewer findings: ${JSON.stringify(review)}`,
    `Blocked draft: ${JSON.stringify(draft)}`,
  ].join("\n");
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function record(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, any> : {};
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
    : [];
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
