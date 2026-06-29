import type { ManagerConversationStreamEvent } from "../types/cleanProduction";

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
