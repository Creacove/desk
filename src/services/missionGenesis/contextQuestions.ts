import type { ContextQuestion } from "./types";

export function questionsForMissingContext(missingContext: string[]): ContextQuestion[] {
  const questions: ContextQuestion[] = [];
  const normalized = missingContext.map((item) => item.toLowerCase());

  if (normalized.some((item) => item.includes("90-day") || item.includes("goal") || item.includes("priority"))) {
    questions.push({
      key: "mission_90_day_goal",
      question: "What should the Manager optimize for over the next 90 days?",
      reason: "The mission changes depending on whether the artist needs audience growth, revenue, industry leverage, market entry, catalog value, or creative reset.",
      answerKind: "single_select",
      options: ["Audience growth", "Revenue", "Industry leverage", "Market entry", "Catalog value", "Creative reset"],
      memoryKind: "goal",
    });
  }

  if (normalized.some((item) => item.includes("budget") || item.includes("spend"))) {
    questions.push({
      key: "mission_budget_range",
      question: "What budget range can the Manager plan around before asking for explicit spend approval?",
      reason: "Budget posture controls whether the mission should recommend proof gathering, capped tests, or larger coordinated work.",
      answerKind: "money_range",
      memoryKind: "operating_context",
    });
  }

  if (normalized.some((item) => item.includes("team") || item.includes("capacity") || item.includes("owner"))) {
    questions.push({
      key: "mission_team_capacity",
      question: "Who can actually execute work this month?",
      reason: "The mission timeline and task ownership must match real capacity.",
      answerKind: "single_select",
      options: ["Artist only", "Small team", "Label team", "External vendors available", "Unknown"],
      memoryKind: "constraint",
    });
  }

  if (normalized.some((item) => item.includes("timing") || item.includes("deadline") || item.includes("date"))) {
    questions.push({
      key: "mission_timing_boundary",
      question: "Is timing flexible, or is there a fixed public, distributor, contractual, or partner deadline?",
      reason: "Fixed timing changes what can be safely recommended and which checkpoints must happen first.",
      answerKind: "single_select",
      options: ["Flexible", "Public date fixed", "Distributor deadline fixed", "Contract or partner deadline fixed", "Unknown"],
      memoryKind: "constraint",
    });
  }

  if (normalized.some((item) => item.includes("avoid") || item.includes("boundary") || item.includes("positioning"))) {
    questions.push({
      key: "mission_do_not_do",
      question: "Are there moves, markets, brands, content styles, or deal types the artist does not want right now?",
      reason: "The Manager should not create work that violates artist identity or remembered boundaries.",
      answerKind: "short_text",
      memoryKind: "preference",
    });
  }

  return questions.slice(0, 5);
}
