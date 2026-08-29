export type ManagerMemoryKind = "fact" | "preference" | "constraint" | "blocker" | "outcome_note" | "rejected_move";

export type QualifiedManagerMemory = {
  content: string;
  category: "operational_fact" | "durable_preference" | "durable_constraint" | "current_blocker" | "execution_outcome" | "rejected_move";
  kind: ManagerMemoryKind;
  scope: "artist" | "mission" | "task";
  mission_id: string | null;
  task_id: string | null;
  supersedes_memory_entry_id: string | null;
};

type ExistingMemory = {
  id?: string;
  content?: string;
  kind?: string;
  mission_id?: string | null;
  task_id?: string | null;
};

export function qualifyManagerMemoryCandidates(
  values: unknown,
  existing: ExistingMemory[],
  context: { missionId?: string; taskId?: string } = {},
): QualifiedManagerMemory[] {
  const strings = Array.isArray(values)
    ? values.filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
    : [];
  const accepted: QualifiedManagerMemory[] = [];

  for (const raw of strings.slice(0, 8)) {
    const content = raw.trim().replace(/\s+/g, " ").slice(0, 500);
    const kind = classifyManagerMemory(content);
    if (!kind) continue;
    const normalized = normalize(content);
    if (existing.some((item) => normalize(item.content ?? "") === normalized)) continue;
    if (accepted.some((item) => normalize(item.content) === normalized)) continue;

    const scope = context.taskId ? "task" : context.missionId ? "mission" : "artist";
    const superseded = existing.find((item) =>
      item.kind === kind &&
      Boolean(context.taskId ? item.task_id === context.taskId : context.missionId ? item.mission_id === context.missionId : !item.task_id && !item.mission_id) &&
      memoryTopic(item.content ?? "") === memoryTopic(content)
    );
    accepted.push({
      content,
      category: categoryForKind(kind),
      kind,
      scope,
      mission_id: context.missionId ?? null,
      task_id: context.taskId ?? null,
      supersedes_memory_entry_id: superseded?.id ?? null,
    });
  }

  return accepted;
}

function classifyManagerMemory(value: string): ManagerMemoryKind | null {
  const normalized = normalize(value);

  if (/\b(must not|never|cannot|can't|do not|won't|without approval|budget cap|budget is capped|capped at|spend limit|deadline|hard limit|constraint|max(?:imum)? budget|only has|only have)\b/.test(normalized)) {
    return "constraint";
  }
  if (/\b(blocked|waiting on|unavailable|cancelled|canceled|cannot proceed|can't proceed|holding up|dependency)\b/.test(normalized)) {
    return "blocker";
  }
  if (/\b(prefers?|wants?|likes?|prioriti[sz]es?|goal is|direction is|comfortable with|would rather|doesn't like|does not like|hates?)\b/.test(normalized)) {
    return "preference";
  }
  if (/\b(rejected|do not pursue|don't pursue|not pursuing|decided against|avoid this move|stop doing|dropped this direction)\b/.test(normalized)) {
    return "rejected_move";
  }
  if (/\b(outperformed|underperformed|performed better|performed worse|worked better|worked worse|resulted in|response was stronger|response was weaker|completed|missed repeatedly)\b/.test(normalized)) {
    return "outcome_note";
  }
  if (/\b(has access to|have access to|owns?|uses?|lives? in|based in|available on|available after|can shoot|can film|can edit|speaks?|has an? iphone|has an? android|has friends?|has a team|works? (?:weekends?|evenings?|mornings?))\b/.test(normalized)) {
    return "fact";
  }
  return null;
}

function categoryForKind(kind: ManagerMemoryKind): QualifiedManagerMemory["category"] {
  switch (kind) {
    case "fact": return "operational_fact";
    case "preference": return "durable_preference";
    case "constraint": return "durable_constraint";
    case "blocker": return "current_blocker";
    case "outcome_note": return "execution_outcome";
    case "rejected_move": return "rejected_move";
  }
}

function memoryTopic(value: string) {
  return normalize(value)
    .replace(/\b(the|artist|team|manager|wants?|prefers?|must|never|cannot|do not|goal is|is|at|to|of|and|for|per|has|have|access)\b/g, " ")
    .split(/\s+/)
    .filter((item) => Boolean(item) && !/^\d+(?:\.\d+)?$/.test(item))
    .slice(0, 5)
    .sort()
    .join(" ");
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}
