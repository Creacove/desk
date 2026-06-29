import { describe, expect, it } from "vitest";
import { ReadableStream } from "node:stream/web";

import { parseManagerConversationEventStream } from "./services/managerConversationStream";

describe("Manager conversation stream parser", () => {
  it("parses SSE events, ignores duplicate event ids, and keeps malformed chunks non-fatal", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode('id: event-1\ndata: {"type":"conversation.started","conversation":{"id":"conv-1"},"run":{"id":"run-1"}}\n\n'));
        controller.enqueue(encoder.encode('id: event-2\ndata: {"type":"assistant.delta","conversationId":"conv-1","delta":"Run a capped"}\n\n'));
        controller.enqueue(encoder.encode('id: event-2\ndata: {"type":"assistant.delta","conversationId":"conv-1","delta":" duplicate"}\n\n'));
        controller.enqueue(encoder.encode("data: {not json}\n\n"));
        controller.enqueue(encoder.encode('data: {"type":"assistant.delta","conversationId":"conv-1","delta":" proof loop."}\n\n'));
        controller.enqueue(encoder.encode('data: {"type":"conversation.completed","conversation":{"id":"conv-1","messages":[],"createdWork":[]},"refresh":{"missions":true}}\n\n'));
        controller.close();
      },
    });

    const events = await parseManagerConversationEventStream(stream);

    expect(events.map((event) => event.type)).toEqual([
      "conversation.started",
      "assistant.delta",
      "assistant.delta",
      "conversation.completed",
    ]);
    expect(events.filter((event) => event.type === "assistant.delta").map((event) => event.delta).join("")).toBe("Run a capped proof loop.");
  });
});
