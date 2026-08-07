export type MusicConversationSubjectType = "music_item" | "music_project";

export type MusicConversationSubject = {
  type: MusicConversationSubjectType;
  id: string;
};

const MUSIC_SUBJECT_TYPES = new Set<MusicConversationSubjectType>([
  "music_item",
  "music_project",
]);

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseMusicConversationSubject(value: unknown): MusicConversationSubject | null {
  if (value == null) return null;
  if (!isRecord(value) || !MUSIC_SUBJECT_TYPES.has(value.type as MusicConversationSubjectType) || typeof value.id !== "string" || !UUID_PATTERN.test(value.id)) {
    throw new Error("Manager conversation music subject is invalid.");
  }
  return { type: value.type as MusicConversationSubjectType, id: value.id };
}

export function musicConversationSubjectTarget(subject: MusicConversationSubject) {
  return subject.type === "music_item"
    ? { table: "music_items", artifactType: "music_item" as const }
    : { table: "music_projects", artifactType: "music_project" as const };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
