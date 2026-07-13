import { describe, expect, it, vi } from "vitest";

import {
  buildManagerAgentRequest,
  managerConversationTools,
  runManagerAgentLoop,
} from "../supabase/functions/_shared/manager-conversation/agentLoop";
import { managerConversationJsonSchema } from "../supabase/functions/_shared/openaiManagerConversation";

describe("Manager Agent Responses loop", () => {
  it("builds a stateful Responses request with web search, local tools, and strict output format", () => {
    const request = buildManagerAgentRequest({
      model: "gpt-5-mini",
      instructions: "Write as the Manager.",
      context: { artist: { name: "BNXN" }, userMessage: "What is the release strategy?" },
      tools: managerConversationTools,
      jsonSchema: managerConversationJsonSchema,
      previousResponseId: "resp-prior",
    });

    expect(request).toMatchObject({
      model: "gpt-5-mini",
      instructions: "Write as the Manager.",
      store: true,
      previous_response_id: "resp-prior",
      tool_choice: "auto",
      parallel_tool_calls: false,
      text: { format: { type: "json_schema", name: "manager_conversation_router_v1" } },
    });
    expect(request.input).toBe(JSON.stringify({ artist: { name: "BNXN" }, userMessage: "What is the release strategy?" }));
    expect(request.tools).toEqual([
      expect.objectContaining({ type: "web_search" }),
      expect.objectContaining({ type: "function", name: "query_evidence_items" }),
      expect.objectContaining({ type: "function", name: "query_active_missions" }),
      expect.objectContaining({ type: "function", name: "query_music_catalog" }),
      expect.objectContaining({ type: "function", name: "query_durable_memory" }),
      expect.objectContaining({ type: "function", name: "query_manager_outputs" }),
    ]);
  });

  it("executes local tool calls, returns function_call_output by call_id, and continues with previous_response_id", async () => {
    const requests: unknown[] = [];
    const toolCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const finalJson = JSON.stringify({
      actionPolicy: "answer_only",
      topic: "Playlist conversion",
      summary: "Manager checked playlist signal.",
      status: "Manager responded",
      confidence: "medium",
      classification: "evidence_check",
      responseBody: "Playlist reach is not enough until saves or repeat listening prove conversion.",
      evidenceIds: ["ev-playlist"],
      limitations: [],
      createdWork: [],
      missionGraphDecisions: [],
      contextQuestions: [],
      proposedActions: [],
      durableMemory: [],
    });

    const fetchImpl = async (_url: string, init?: RequestInit) => {
      requests.push(JSON.parse(String(init?.body ?? "{}")));
      const index = requests.length;
      const payload = index === 1
        ? {
            id: "resp-tool",
            output: [
              {
                type: "function_call",
                call_id: "call-evidence",
                name: "query_evidence_items",
                arguments: "{\"category\":\"playlist\",\"limit\":5}",
              },
            ],
            usage: { input_tokens: 100, output_tokens: 20 },
          }
        : {
            id: "resp-final",
            output_text: finalJson,
            output: [{ type: "message", content: [{ type: "output_text", text: finalJson }] }],
            usage: { input_tokens: 40, output_tokens: 80 },
          };
      return new Response(JSON.stringify(payload), { status: 200 });
    };

    const result = await runManagerAgentLoop({
      endpoint: "https://api.openai.com/v1/responses",
      apiKey: "test-key",
      model: "gpt-5-mini",
      instructions: "Write as the Manager.",
      context: { userMessage: "Is playlist reach converting?" },
      tools: managerConversationTools,
      jsonSchema: managerConversationJsonSchema,
      fetchImpl,
      executeTool: async (name, args) => {
        toolCalls.push({ name, args });
        return { items: [{ id: "ev-playlist", read: "High reach, conversion unproven." }] };
      },
    });

    expect(toolCalls).toEqual([{ name: "query_evidence_items", args: { category: "playlist", limit: 5 } }]);
    expect(requests).toHaveLength(2);
    expect(requests[1]).toMatchObject({
      previous_response_id: "resp-tool",
      input: [
        {
          type: "function_call_output",
          call_id: "call-evidence",
          output: JSON.stringify({ items: [{ id: "ev-playlist", read: "High reach, conversion unproven." }] }),
        },
      ],
    });
    expect(result.responseId).toBe("resp-final");
    expect(result.outputText).toBe(finalJson);
    expect(result.usage).toMatchObject({ input_tokens: 140, output_tokens: 100 });
    expect(result.toolTrace).toEqual([
      expect.objectContaining({
        tool: "query_evidence_items",
        callId: "call-evidence",
        status: "completed",
      }),
    ]);
  });

  it("summarizes discovery tool results with operational status and saved evidence counts", async () => {
    const events: Array<{ status: string; summary: string }> = [];
    const finalJson = JSON.stringify({
      actionPolicy: "answer_only",
      topic: "Setup",
      summary: "Done",
      status: "Manager responded",
      confidence: "medium",
      classification: "evidence_check",
      responseBody: "Done",
      evidenceIds: ["ev-1"],
      limitations: [],
      createdWork: [],
      missionGraphDecisions: [],
      contextQuestions: [],
      proposedActions: [],
      durableMemory: [],
    });

    const fetchImpl = async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}"));
      return new Response(JSON.stringify(body.previous_response_id
        ? { id: "resp-final", output_text: finalJson, output: [{ type: "message", content: [{ type: "output_text", text: finalJson }] }] }
        : {
            id: "resp-tool",
            output: [{
              type: "function_call",
              call_id: "call-track",
              name: "chartmetric_track_enrich",
              arguments: "{\"musicItemId\":\"track-1\"}",
            }],
          }), { status: 200 });
    };

    await runManagerAgentLoop({
      endpoint: "https://api.openai.com/v1/responses",
      apiKey: "test-key",
      model: "gpt-5-mini",
      instructions: "Run discovery.",
      context: { artistName: "Rema" },
      tools: [{ type: "function", name: "chartmetric_track_enrich", description: "Enrich", strict: false, parameters: {} }],
      jsonSchema: managerConversationJsonSchema,
      fetchImpl,
      executeTool: async () => ({ status: "completed", snapshotId: "snap-1", evidenceCount: 7 }),
      onToolEvent: (event) => events.push(event),
    });

    expect(events).toEqual([
      expect.objectContaining({ status: "started", summary: "Enriching a focus track." }),
      expect.objectContaining({
        status: "completed",
        summary: "Music intelligence is ready with 7 supporting signals.",
      }),
    ]);
    expect(JSON.stringify(events)).not.toMatch(/chartmetric|snapshot|snap-1|evidence item/i);
  });

  it("can execute independent discovery tool calls concurrently when explicitly enabled", async () => {
    const releases: Array<() => void> = [];
    let active = 0;
    let peakActive = 0;
    const finalJson = JSON.stringify({ summary: "done" });
    const fetchImpl = async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}"));
      return new Response(JSON.stringify(body.previous_response_id
        ? { id: "resp-final", output_text: finalJson }
        : {
            id: "resp-tools",
            output: [
              { type: "function_call", call_id: "call-1", name: "enrich", arguments: "{}" },
              { type: "function_call", call_id: "call-2", name: "enrich", arguments: "{}" },
            ],
          }), { status: 200 });
    };

    const resultPromise = runManagerAgentLoop({
      endpoint: "https://api.openai.com/v1/responses",
      apiKey: "test-key",
      model: "gpt-5-mini",
      instructions: "Run discovery.",
      context: {},
      tools: [{ type: "function", name: "enrich", description: "Enrich", strict: false, parameters: {} }],
      jsonSchema: managerConversationJsonSchema,
      fetchImpl,
      parallelToolCalls: true,
      executeTool: async () => {
        active += 1;
        peakActive = Math.max(peakActive, active);
        await new Promise<void>((resolve) => releases.push(resolve));
        active -= 1;
        return { status: "completed" };
      },
    });

    await vi.waitFor(() => expect(releases).toHaveLength(2));
    releases.forEach((release) => release());
    await expect(resultPromise).resolves.toMatchObject({ outputText: finalJson });
    expect(peakActive).toBe(2);
  });

  it("surfaces useful messages from non-Error tool failures", async () => {
    const events: Array<{ status: string; summary: string }> = [];
    const finalJson = JSON.stringify({
      actionPolicy: "answer_only",
      topic: "Setup",
      summary: "Done",
      status: "Manager responded",
      confidence: "low",
      classification: "evidence_check",
      responseBody: "Done",
      evidenceIds: [],
      limitations: ["tool failed"],
      createdWork: [],
      missionGraphDecisions: [],
      contextQuestions: [],
      proposedActions: [],
      durableMemory: [],
    });

    const fetchImpl = async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}"));
      return new Response(JSON.stringify(body.previous_response_id
        ? { id: "resp-final", output_text: finalJson, output: [{ type: "message", content: [{ type: "output_text", text: finalJson }] }] }
        : {
            id: "resp-tool",
            output: [{
              type: "function_call",
              call_id: "call-memory",
              name: "write_strategic_memory",
              arguments: "{\"content\":\"Rema has secondary market demand.\"}",
            }],
          }), { status: 200 });
    };

    await runManagerAgentLoop({
      endpoint: "https://api.openai.com/v1/responses",
      apiKey: "test-key",
      model: "gpt-5-mini",
      instructions: "Run discovery.",
      context: { artistName: "Rema" },
      tools: [{ type: "function", name: "write_strategic_memory", description: "Write", strict: false, parameters: {} }],
      jsonSchema: managerConversationJsonSchema,
      fetchImpl,
      executeTool: async () => {
        throw { message: 'invalid input value for enum memory_scope: "strategic"' };
      },
      onToolEvent: (event) => events.push(event),
    });

    expect(events.find((event) => event.status === "failed")?.summary).toContain("invalid input value for enum memory_scope");
    expect(events.find((event) => event.status === "failed")?.summary).not.toBe("Tool failed.");
  });

  it("awaits async tool event handlers before returning the final response", async () => {
    const events: string[] = [];
    let releaseCompletedEvent: (() => void) | undefined;
    const completedEventWritten = new Promise<void>((resolve) => {
      releaseCompletedEvent = resolve;
    });
    const finalJson = JSON.stringify({
      actionPolicy: "answer_only",
      topic: "Setup",
      summary: "Done",
      status: "Manager responded",
      confidence: "medium",
      classification: "evidence_check",
      responseBody: "Done",
      evidenceIds: [],
      limitations: [],
      createdWork: [],
      missionGraphDecisions: [],
      contextQuestions: [],
      proposedActions: [],
      durableMemory: [],
    });

    const fetchImpl = async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}"));
      return new Response(JSON.stringify(body.previous_response_id
        ? { id: "resp-final", output_text: finalJson }
        : {
            id: "resp-tool",
            output: [{
              type: "function_call",
              call_id: "call-evidence",
              name: "query_evidence_items",
              arguments: "{}",
            }],
          }), { status: 200 });
    };

    const resultPromise = runManagerAgentLoop({
      endpoint: "https://api.openai.com/v1/responses",
      apiKey: "test-key",
      model: "gpt-5-mini",
      instructions: "Run discovery.",
      context: { artistName: "Rema" },
      tools: managerConversationTools,
      jsonSchema: managerConversationJsonSchema,
      fetchImpl,
      executeTool: async () => ({ status: "completed" }),
      onToolEvent: async (event) => {
        if (event.status === "completed") {
          await completedEventWritten;
        }
        events.push(event.status);
      },
    });

    await vi.waitFor(() => expect(events).toEqual(["started"]));

    releaseCompletedEvent?.();
    const result = await resultPromise;

    expect(result.outputText).toBe(finalJson);
    expect(events).toEqual(["started", "completed"]);
  });
});
