import { describe, expect, it } from "vitest";

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
});
