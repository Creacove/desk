import { describe, expect, it, vi } from "vitest";
import { runManagerAgentLoop } from "../supabase/functions/_shared/manager-conversation/agentLoop";

const schema = { name: "manager_test", schema: { type: "object" } };

function functionCall(callId: string, name: string, args: Record<string, unknown>) {
  return new Response(JSON.stringify({
    id: `response-${callId}`,
    output: [{ type: "function_call", call_id: callId, name, arguments: JSON.stringify(args) }],
    usage: {},
  }), { status: 200, headers: { "content-type": "application/json" } });
}

function finalResponse() {
  return new Response(JSON.stringify({
    id: "response-final",
    output_text: "done",
    usage: {},
  }), { status: 200, headers: { "content-type": "application/json" } });
}

describe("Manager agent production resilience", () => {
  it("suppresses an identical mutation repeated by the model in the same turn", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(functionCall("call-1", "create_focused_song_document", {
        documentType: "epk",
        title: "Oleku EPK",
        body: "{}",
        opportunityId: null,
      }))
      .mockResolvedValueOnce(functionCall("call-2", "create_focused_song_document", {
        documentType: "epk",
        title: "Oleku EPK",
        body: "{}",
        opportunityId: null,
      }))
      .mockResolvedValueOnce(finalResponse());
    const executeTool = vi.fn(async () => ({ status: "drafted" }));

    const result = await runManagerAgentLoop({
      endpoint: "https://example.test/responses",
      apiKey: "test-key",
      model: "test-model",
      instructions: "test",
      context: { test: true },
      tools: [],
      jsonSchema: schema,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      executeTool,
      maxToolCalls: 4,
    });

    expect(result.outputText).toBe("done");
    expect(executeTool).toHaveBeenCalledTimes(1);
    expect(result.toolTrace.some((item) => item.summary.includes("Duplicate write suppressed"))).toBe(true);
  });

  it("retries a temporary 429 using Retry-After instead of immediately failing the Manager turn", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        error: { message: "Rate limit reached. Please try again in 0s." },
      }), { status: 429, headers: { "retry-after": "0" } }))
      .mockResolvedValueOnce(finalResponse());

    const result = await runManagerAgentLoop({
      endpoint: "https://example.test/responses",
      apiKey: "test-key",
      model: "test-model",
      instructions: "test",
      context: { test: true },
      tools: [],
      jsonSchema: schema,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      executeTool: vi.fn(),
    });

    expect(result.outputText).toBe("done");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
