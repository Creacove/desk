import type { ManagerConversationCreatedWork } from "../openaiManagerConversation.ts";

export type ManagerToolResult = { tool: string; result: unknown };

export function isReleaseSuccessArtifactTool(tool: string) {
  return tool === "read_focused_release_success" || tool === "propose_focused_release_date_change";
}

export function songDocumentWorkFromToolResult(
  musicItemId: string,
  resultValue: unknown,
): ManagerConversationCreatedWork | undefined {
  if (!musicItemId || !isRecord(resultValue)) return undefined;
  const status = text(resultValue.status);
  if (status !== "drafted" && status !== "draft_ready_unsaved") return undefined;
  const documentType = text(resultValue.documentType);
  const title = text(resultValue.title) || "Song document";
  if (documentType === "release_narrative" || title.toLowerCase() === "release narrative") return undefined;

  const quality = isRecord(resultValue.quality) ? resultValue.quality : {};
  const qualityReadiness = text(quality.readiness);
  const missingInputs = Array.isArray(resultValue.missingInputs)
    ? resultValue.missingInputs.map(text).filter(Boolean).slice(0, 20)
    : [];
  const unsaved = status === "draft_ready_unsaved";
  const documentId = text(resultValue.documentId);
  const stableId = documentId || `unsaved-document:${slug(documentType || title)}:${slug(title)}`;

  return {
    type: "music_item",
    id: stableId,
    musicItemId,
    artifactKind: "song_document",
    documentType: documentType || undefined,
    title,
    body: unsaved ? "Draft created, but it couldn't be saved to Files." : "Saved to Files.",
    content: unsaved ? text(resultValue.draftBody) || undefined : undefined,
    readiness: unsaved ? "save_failed" : qualityReadiness === "ready" && !missingInputs.length ? "ready" : "needs_review",
    missingInputs,
    status: unsaved ? "failed" : resultValue.created === false ? "updated" : "created",
  };
}

export function songDocumentWorkItems(musicItemId: string, results: ManagerToolResult[]) {
  return results
    .filter((item) => item.tool === "create_focused_song_document")
    .map((item) => songDocumentWorkFromToolResult(musicItemId, item.result))
    .filter((item): item is ManagerConversationCreatedWork => Boolean(item));
}

export function upsertManagerCreatedWork(current: ManagerConversationCreatedWork[], next: ManagerConversationCreatedWork) {
  const key = workKey(next);
  return [...current.filter((item) => workKey(item) !== key), next];
}

function workKey(item: ManagerConversationCreatedWork) {
  return `${item.artifactKind ?? item.type}:${item.id || item.title}`;
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 72) || "document";
}
