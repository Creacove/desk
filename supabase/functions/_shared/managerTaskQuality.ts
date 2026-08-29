export type ExecutableHumanTaskShape = {
  title: string;
  purpose: string;
  steps: string[];
  completionExpectation: string;
  managerResponsibility: string;
  userResponsibility: string;
  riskIfLate: string;
};

const GENERIC_TITLE_PATTERN = /^(?:create|make|shoot|film|record|post|share|promote|prepare|do|work on)\s+(?:(?:some|a|the)\s+)?(?:content|video|videos|post|posts|promo|promotion|social media|tiktok|reel|reels|song|release)$/i;
const GENERIC_STEP_PATTERNS = [
  /^(?:create|make|shoot|film|record)\s+(?:(?:some|a|the)\s+)?(?:content|video|videos|post|posts)$/i,
  /^post\s+(?:it|the\s+(?:video|content|post))\s+(?:on|to)\s+(?:tiktok|instagram|social media)$/i,
  /^promote\s+(?:the\s+)?(?:song|release|music)$/i,
  /^share\s+(?:it|the\s+(?:song|release|post))$/i,
  /^edit\s+(?:the\s+)?(?:video|content)$/i,
  /^add\s+(?:a\s+)?caption$/i,
];
const PLACEHOLDER_PATTERN = /\b(?:tbd|to be decided|as needed|something|some content|figure it out|whatever works|etc\.?|and so on)\b/i;
const CONTENT_PATTERN = /\b(?:content|video|tiktok|reel|instagram|youtube|shorts?|shoot|film|record|clip|post)\b/i;

export function assertExecutableHumanTask(task: ExecutableHumanTaskShape) {
  const title = clean(task.title);
  const purpose = clean(task.purpose);
  const completionExpectation = clean(task.completionExpectation);
  const managerResponsibility = clean(task.managerResponsibility);
  const userResponsibility = clean(task.userResponsibility);
  const riskIfLate = clean(task.riskIfLate);
  const steps = task.steps.map(clean).filter(Boolean);

  if (wordCount(title) < 3 || GENERIC_TITLE_PATTERN.test(title)) {
    throw new Error(`Adaptive human task is too generic to execute: ${title || "untitled task"}.`);
  }
  if (purpose.length < 30) {
    throw new Error(`Adaptive human task purpose is too thin for ${title}.`);
  }
  if (steps.length < 3) {
    throw new Error(`Adaptive human task needs at least three concrete execution steps for ${title}.`);
  }
  if (completionExpectation.length < 25) {
    throw new Error(`Adaptive human task needs a concrete completion expectation for ${title}.`);
  }
  if (managerResponsibility.length < 20 || userResponsibility.length < 20) {
    throw new Error(`Adaptive human task must separate Manager work from human work for ${title}.`);
  }
  if (riskIfLate.length < 20) {
    throw new Error(`Adaptive human task must explain why delay matters for ${title}.`);
  }

  const allCopy = [title, purpose, ...steps, completionExpectation, managerResponsibility, userResponsibility, riskIfLate].join(" ");
  if (PLACEHOLDER_PATTERN.test(allCopy)) {
    throw new Error(`Adaptive human task contains placeholder execution language for ${title}.`);
  }

  const normalizedSteps = steps.map(normalize);
  if (new Set(normalizedSteps).size !== normalizedSteps.length) {
    throw new Error(`Adaptive human task repeats an execution step for ${title}.`);
  }

  for (const step of steps) {
    if (wordCount(step) < 4 || step.length < 18 || GENERIC_STEP_PATTERNS.some((pattern) => pattern.test(step))) {
      throw new Error(`Adaptive human task contains a vague execution step for ${title}: ${step}.`);
    }
  }

  if (steps.join(" ").length < 120) {
    throw new Error(`Adaptive human task does not contain enough execution detail for ${title}.`);
  }

  if (CONTENT_PATTERN.test([title, purpose, ...steps].join(" "))) {
    assertContentExecutionCoverage(title, [purpose, ...steps, completionExpectation].join(" "));
  }
}

function assertContentExecutionCoverage(title: string, copy: string) {
  const categories = [
    /\b(?:location|room|studio|car|street|park|home|bedroom|stage|phone|camera|tripod|lighting|outfit|friend|friends|team|person|people|creator|dancer|setup|setting)\b/i,
    /\b(?:hook|open with|say|ask|show|tell|line|script|story|question|chorus|verse|lyric|song|audio|sound|moment|perform|performance)\b/i,
    /\b(?:seconds?|vertical|9:16|cut|edit|caption|subtitle|text on screen|overlay|reel|tiktok|instagram|youtube|short|frame|transition)\b/i,
    /\b(?:comment|save|share|reply|response|cta|link|url|screenshot|report|result|post|upload|send|publish|posted|performance data)\b/i,
  ];
  const coverage = categories.reduce((count, pattern) => count + (pattern.test(copy) ? 1 : 0), 0);
  if (coverage < 3) {
    throw new Error(`Adaptive content task is missing execution context for ${title}; specify setup, creative action, format/editing, and/or the result to report.`);
  }
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function wordCount(value: string) {
  return value.split(/\s+/).filter(Boolean).length;
}
