import type {
  ManagerConversationRefreshHint,
  ManagerConversationStreamEvent,
  ReleaseSuccessArtifactState,
  ReleaseSuccessArtifactViewModel,
} from "../types/cleanProduction";
import type { WorkspaceInvalidation } from "./workspaceLiveSync";

const RELEASE_SUCCESS_STATES: readonly ReleaseSuccessArtifactState[] = [
  "investigating",
  "assessed",
  "proposed",
  "awaiting_approval",
  "applying",
  "applied",
  "failed",
];

export function normalizeReleaseSuccessArtifact(value: unknown): ReleaseSuccessArtifactViewModel | null {
  if (!isRecord(value)) return null;
  const id = readRequiredString(value.id);
  const musicItemId = readRequiredString(value.musicItemId);
  const state = isReleaseSuccessArtifactState(value.state) ? value.state : null;
  const subject = isRecord(value.subject) ? value.subject : null;
  const title = readRequiredString(subject?.title);
  const itemType = readRequiredString(subject?.itemType);
  if (!id || !musicItemId || !state || !title || !itemType) return null;

  const artifact: ReleaseSuccessArtifactViewModel = {
    id,
    musicItemId,
    state,
    subject: {
      title,
      itemType,
      ...(readOptionalString(subject?.approvedReleaseDate)
        ? { approvedReleaseDate: readOptionalString(subject?.approvedReleaseDate) }
        : {}),
    },
  };

  const missionId = readOptionalString(value.missionId);
  const requestId = readOptionalString(value.requestId);
  if (missionId) artifact.missionId = missionId;
  if (requestId) artifact.requestId = requestId;

  if (isRecord(value.assessment)) artifact.assessment = value.assessment as ReleaseSuccessArtifactViewModel["assessment"];
  if (isRecord(value.preview)) artifact.preview = value.preview as ReleaseSuccessArtifactViewModel["preview"];
  if (isRecord(value.receipt)) artifact.receipt = value.receipt as ReleaseSuccessArtifactViewModel["receipt"];

  if (isRecord(value.error)) {
    const message = readOptionalString(value.error.message);
    if (message && typeof value.error.retryable === "boolean") {
      artifact.error = {
        message,
        retryable: value.error.retryable,
        ...(readOptionalString(value.error.reference) ? { reference: readOptionalString(value.error.reference) } : {}),
      };
    }
  }

  return artifact;
}

export function mergeReleaseSuccessArtifacts(
  current: ReleaseSuccessArtifactViewModel[] = [],
  next: ReleaseSuccessArtifactViewModel[] = [],
): ReleaseSuccessArtifactViewModel[] {
  const byId = new Map<string, ReleaseSuccessArtifactViewModel>();
  for (const item of current) {
    const normalized = normalizeReleaseSuccessArtifact(item);
    if (normalized) byId.set(normalized.id, normalized);
  }
  for (const item of next) {
    const normalized = normalizeReleaseSuccessArtifact(item);
    if (normalized) byId.set(normalized.id, normalized);
  }
  return [...byId.values()];
}

export function hydrateReleaseSuccessArtifacts(rows: unknown[] = []): ReleaseSuccessArtifactViewModel[] {
  const ordered = rows
    .map((row, index) => ({ row, index, createdAt: readRowCreatedAt(row) }))
    .sort((left, right) => {
      const dateOrder = right.createdAt.localeCompare(left.createdAt);
      return dateOrder || right.index - left.index;
    });
  const byId = new Map<string, ReleaseSuccessArtifactViewModel>();
  for (const entry of ordered) {
    const renderJson = isRecord(entry.row) && "render_json" in entry.row ? entry.row.render_json : entry.row;
    const normalized = normalizeReleaseSuccessArtifact(renderJson);
    if (normalized && !byId.has(normalized.id)) byId.set(normalized.id, normalized);
  }
  return [...byId.values()];
}

export function releaseSuccessProgressLabel(tool: string): string {
  if (tool === "read_focused_release_success") return "Release materials checked";
  if (tool === "propose_focused_release_date_change") return "Release date impact preview ready";
  return "Release plan review in progress";
}

export function invalidationsFromManagerRefreshHint(hint?: ManagerConversationRefreshHint): WorkspaceInvalidation[] {
  if (!hint) return [];
  const invalidations: WorkspaceInvalidation[] = [];
  if (hint.conversations) invalidations.push({ scope: "conversation-list" });
  if (hint.missions) invalidations.push({ scope: "mission-list" });
  for (const missionId of new Set(hint.missionIds?.filter(Boolean) ?? [])) {
    invalidations.push({ scope: "mission", id: missionId });
  }
  if (hint.music) invalidations.push({ scope: "music-list" });
  if (hint.desk) invalidations.push({ scope: "activity" }, { scope: "desk-brief" });
  return invalidations;
}

export async function parseManagerConversationEventStream(stream: ReadableStream<Uint8Array> | null): Promise<ManagerConversationStreamEvent[]> {
  const events: ManagerConversationStreamEvent[] = [];
  await consumeManagerConversationEventStream(stream, (event) => {
    events.push(event);
  });
  return events;
}

export async function consumeManagerConversationEventStream(
  stream: ReadableStream<Uint8Array> | null,
  onEvent: (event: ManagerConversationStreamEvent) => void,
) {
  if (!stream) {
    throw new Error("Manager conversation stream did not include a response body.");
  }

  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const seenIds = new Set<string>();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    buffer = flushCompleteBlocks(buffer, seenIds, onEvent);
  }

  buffer += decoder.decode();
  flushCompleteBlocks(`${buffer}\n\n`, seenIds, onEvent);
}

function flushCompleteBlocks(
  buffer: string,
  seenIds: Set<string>,
  onEvent: (event: ManagerConversationStreamEvent) => void,
) {
  const normalized = buffer.replace(/\r\n/g, "\n");
  const blocks = normalized.split("\n\n");
  const remainder = blocks.pop() ?? "";

  for (const block of blocks) {
    const parsed = parseStreamBlock(block);
    if (!parsed) continue;
    if (parsed.id) {
      if (seenIds.has(parsed.id)) continue;
      seenIds.add(parsed.id);
    }

    try {
      const value = JSON.parse(parsed.data) as ManagerConversationStreamEvent;
      if (isManagerConversationStreamEvent(value)) {
        onEvent(value);
      }
    } catch {
      // Malformed stream chunks should not kill a long-running chat session.
    }
  }

  return remainder;
}

function parseStreamBlock(block: string) {
  let id = "";
  const data: string[] = [];

  for (const line of block.split("\n")) {
    if (line.startsWith("id:")) {
      id = line.slice(3).trim();
    } else if (line.startsWith("data:")) {
      data.push(line.slice(5).trimStart());
    } else if (line.trim().startsWith("{")) {
      data.push(line.trim());
    }
  }

  const joined = data.join("\n").trim();
  return joined ? { id, data: joined } : null;
}

function isManagerConversationStreamEvent(value: unknown): value is ManagerConversationStreamEvent {
  return Boolean(
    value &&
      typeof value === "object" &&
      "type" in value &&
      typeof (value as { type?: unknown }).type === "string",
  );
}

function isReleaseSuccessArtifactState(value: unknown): value is ReleaseSuccessArtifactState {
  return typeof value === "string" && RELEASE_SUCCESS_STATES.includes(value as ReleaseSuccessArtifactState);
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function readRequiredString(value: unknown): string | null {
  const normalized = readOptionalString(value);
  return normalized || null;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readRowCreatedAt(value: unknown): string {
  if (!isRecord(value) || typeof value.created_at !== "string") return "";
  return value.created_at;
}
