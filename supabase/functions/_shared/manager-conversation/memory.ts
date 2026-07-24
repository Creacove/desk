export type QualifiedManagerMemory = {
  content: string;
  category: "durable_preference" | "durable_constraint";
  kind: "preference" | "constraint";
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
    const kind = classifyDurableMemory(content);
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
      category: kind === "preference" ? "durable_preference" : "durable_constraint",
      kind,
      scope,
      mission_id: context.missionId ?? null,
      task_id: context.taskId ?? null,
      supersedes_memory_entry_id: superseded?.id ?? null,
    });
  }

  return accepted;
}

function classifyDurableMemory(value: string): "preference" | "constraint" | null {
  const normalized = normalize(value);
  if (/\b(must not|never|cannot|can't|do not|won't|without approval|budget cap|budget is capped|capped at|spend limit|deadline|hard limit|constraint)\b/.test(normalized)) {
    return "constraint";
  }
  if (/\b(prefers?|wants?|likes?|prioriti[sz]es?|goal is|direction is|comfortable with|would rather)\b/.test(normalized)) {
    return "preference";
  }
  return null;
}

function memoryTopic(value: string) {
  return normalize(value)
    .replace(/\b(the|artist|team|manager|wants?|prefers?|must|never|cannot|do not|goal is|is|at|to|of|and|for|per)\b/g, " ")
    .split(/\s+/)
    .filter((item) => Boolean(item) && !/^\d+(?:\.\d+)?$/.test(item))
    .slice(0, 4)
    .sort()
    .join(" ");
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}
