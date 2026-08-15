import { describe, expect, it, vi } from "vitest";
import {
  buildManagerAgentRequest,
  managerConversationTools,
  runManagerAgentLoop,
  selectManagerConversationToolsForTurn,
} from "../supabase/functions/_shared/manager-conversation/agentLoop";

describe("Manager Agent Responses loop", () => {
  it("withholds release mutation tools from unrelated or invalid turns", () => {
    const unrelated = selectManagerConversationToolsForTurn({
      body: "What should I focus on this week?",
      contextAnswers: [],
      hasAttachedUnreleasedSong: false,
    });
    const invalidRelease = selectManagerConversationToolsForTurn({
      body: "Move the release date to next Friday.",
      contextAnswers: [],
      hasAttachedUnreleasedSong: false,
    });

    const names = (tools: typeof unrelated) => tools.filter((tool) => tool.type === "function").map((tool) => tool.name);
    expect(names(unrelated)).not.toContain("propose_focused_release_date_change");
    expect(names(unrelated)).not.toContain("create_focused_song_document");
    expect(names(unrelated)).not.toContain("prepare_focused_release_share_package");
    expect(names(invalidRelease)).not.toContain("propose_focused_release_date_change");
  });

  it("supplies the minimal Video One tool set for a valid release turn", () => {
    const tools = selectManagerConversationToolsForTurn({
      body: "Should we move the release date?",
      contextAnswers: [],
      hasAttachedUnreleasedSong: true,
    });
    const names = tools.filter((tool) => tool.type === "function").map((tool) => tool.name);

    expect(names).toContain("read_focused_release_success");
    expect(names).toContain("propose_focused_release_date_change");
    expect(names).not.toContain("create_focused_song_document");
    expect(names).not.toContain("prepare_focused_release_share_package");
  });

  it("keeps the release proposal tool available when the artist answers a release-date context question", () => {
    const tools = selectManagerConversationToolsForTurn({
      body: "Yes, let's do that.",
      contextAnswers: [{ questionKey: "release_date", answer: "2026-09-04" }],
      hasAttachedUnreleasedSong: true,
    });
    const names = tools.filter((tool) => tool.type === "function").map((tool) => tool.name);
    expect(names).toContain("propose_focused_release_date_change");
  });

  it("builds a stateful Responses request with web search, local tools, and strict output format", () => {
    const request = buildManagerAgentRequest({
      model: "gpt-5-mini",
      instructions: "Write as the Manager.",
      context: { artist: { name: "BNXN" }, userMessage: "What is the release strategy?" },
      tools: managerConversationTools,
      jsonSchema: {
        name: "manager_conversation_router_v1",
        strict: true,
        schema: { type: "object", additionalProperties: false },
      },
      previousResponseId: "resp-prior",
      parallelToolCalls: false,
      maxOutputTokens: 6000,
      contextManagement: [{ type: "compaction", compact_threshold: 64000 }],
      promptCacheKey: "manager:workspace-1:v1",
      promptCacheMode: "explicit",
    });

    expect(request).toMatchObject({
      model: "gpt-5-mini",
      instructions: "Write as the Manager.",
      store: true,
      previous_response_id: "resp-prior",
      tool_choice: "auto",
      parallel_tool_calls: false,
      max_output_tokens: 6000,
      context_management: [{ type: "compaction", compact_threshold: 64000 }],
      prompt_cache_key: "manager:workspace-1:v1",
      prompt_cache_options: { mode: "explicit" },
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
      expect.objectContaining({ type: "function", name: "read_manager_output_section" }),
      expect.objectContaining({ type: "function", name: "read_focused_music_subject", strict: true }),
      expect.objectContaining({ type: "function", name: "read_focused_release_success", strict: true }),
      expect.objectContaining({ type: "function", name: "propose_focused_release_date_change", strict: true }),
      expect.objectContaining({ type: "function", name: "query_focused_release_opportunities", strict: true }),
      expect.objectContaining({ type: "function", name: "save_focused_release_opportunities", strict: true }),
      expect.objectContaining({ type: "function", name: "record_focused_release_opportunity_outcome", strict: true }),
      expect.objectContaining({ type: "function", name: "create_focused_song_document", strict: true }),
      expect.objectContaining({ type: "function", name: "prepare_focused_release_share_package", strict: true }),
      expect.objectContaining({ type: "function", name: "read_focused_release_readiness", strict: true }),
      expect.objectContaining({ type: "function", name: "refresh_focused_music_intelligence", strict: true }),
      expect.objectContaining({ type: "function", name: "update_focused_music_metadata", strict: true }),
      expect.objectContaining({ type: "function", name: "update_focused_music_lifecycle", strict: true }),
      expect.objectContaining({ type: "function", name: "ensure_song_release_workspace", strict: true }),
    ]);
  });

  it("caps oversized tool output before continuing the Responses loop", async () => {
    const requests: Array<Record<string, unknown>> = [];
    const finalJson = JSON.stringify({ summary: "done" });
    const fetchImpl = async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}"));
      requests.push(body);
      return new Response(JSON.stringify(body.previous_response_id
        ? { id: "resp-final", output_text: finalJson }
        : {
            id: "resp-tool",
            output: [{ type: "function_call", call_id: "call-document", name: "read_manager_output_section", arguments: "{}" }],
          }), { status: 200 });
    };

    await runManagerAgentLoop({
      endpoint: "https://api.openai.com/v1/responses",
      apiKey: "test-key",
      model: "gpt-5-mini",
      instructions: "Manager",
      context: {},
      tools: managerConversationTools,
      jsonSchema: { name: "manager", schema: { type: "object" } },
      fetchImpl: fetchImpl as typeof fetch,
      executeTool: async () => ({ body: "x".repeat(20_000) }),
    });

    const second = requests[1] as any;
    expect(second.previous_response_id).toBe("resp-tool");
    expect(second.input[0].output).toContain('"truncated":true');
    expect(second.input[0].output.length).toBeLessThan(13_000);
  });

  it("exposes a scoped Manager-output section reader", () => {
    const reader = managerConversationTools.find((tool) => tool.type === "function" && tool.name === "read_manager_output_section");
    expect(reader).toMatchObject({ type: "function", name: "read_manager_output_section", strict: true });
    if (!reader || reader.type !== "function") throw new Error("reader missing");
    expect((reader.parameters as any).required).toEqual(["outputId", "query", "maxChars"]);
  });

  it("executes local tool calls, returns function_call_output by call_id, and continues with previous_response_id", async () => {
    const requests: Array<Record<string, unknown>> = [];
    const toolEvents: any[] = [];
    const finalJson = JSON.stringify({ responseBody: "Done." });
    const fetchImpl = async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}"));
      requests.push(body);
      return new Response(JSON.stringify(requests.length === 1
        ? {
            id: "resp-tool",
            output: [{ type: "function_call", call_id: "call-1", name: "query_evidence_items", arguments: JSON.stringify({ query: "streams" }) }],
            usage: { input_tokens: 100, output_tokens: 20 },
          }
        : { id: "resp-final", output_text: finalJson, usage: { input_tokens: 60, output_tokens: 30 } }), { status: 200 });
    };

    const result = await runManagerAgentLoop({
      endpoint: "https://api.openai.com/v1/responses",
      apiKey: "test-key",
      model: "gpt-5-mini",
      instructions: "Manager",
      context: {},
      tools: managerConversationTools,
      jsonSchema: { name: "manager", schema: { type: "object" } },
      fetchImpl: fetchImpl as typeof fetch,
      executeTool: async (name, args) => ({ name, args, rows: 3 }),
      onToolEvent: (event) => { toolEvents.push(event); },
    });

    expect(requests).toHaveLength(2);
    expect((requests[1] as any).previous_response_id).toBe("resp-tool");
    expect((requests[1] as any).input).toEqual([
      expect.objectContaining({ type: "function_call_output", call_id: "call-1" }),
    ]);
    expect(result.outputText).toBe(finalJson);
    expect(result.responseId).toBe("resp-final");
    expect(toolEvents.map((event) => event.status)).toEqual(["started", "completed"]);
  });

  it("summarizes discovery tool results with operational status and saved evidence counts", async () => {
    const events: any[] = [];
    let call = 0;
    const fetchImpl = async () => {
      call += 1;
      return new Response(JSON.stringify(call === 1
        ? { id: "resp-tool", output: [{ type: "function_call", call_id: "call-1", name: "refresh_focused_music_intelligence", arguments: "{}" }] }
        : { id: "resp-final", output_text: JSON.stringify({ responseBody: "Done." }) }), { status: 200 });
    };

    await runManagerAgentLoop({
      endpoint: "https://api.openai.com/v1/responses",
      apiKey: "test-key",
      model: "gpt-5-mini",
      instructions: "Manager",
      context: {},
      tools: managerConversationTools,
      jsonSchema: { name: "manager", schema: { type: "object" } },
      fetchImpl: fetchImpl as typeof fetch,
      executeTool: async () => ({ status: "completed", evidence: [{}, {}, {}], sourceSnapshotId: "snapshot-secret" }),
      onToolEvent: (event) => { events.push(event); },
    });

    expect(events.at(-1)?.summary).toContain("3 saved evidence item");
    expect(events.at(-1)?.summary).not.toContain("snapshot-secret");
  });

  it("can execute independent discovery tool calls concurrently when explicitly enabled", async () => {
    let active = 0;
    let maxActive = 0;
    let call = 0;
    const fetchImpl = async () => {
      call += 1;
      return new Response(JSON.stringify(call === 1
        ? {
            id: "resp-tools",
            output: [
              { type: "function_call", call_id: "call-a", name: "query_evidence_items", arguments: "{}" },
              { type: "function_call", call_id: "call-b", name: "query_active_missions", arguments: "{}" },
            ],
          }
        : { id: "resp-final", output_text: JSON.stringify({ responseBody: "Done." }) }), { status: 200 });
    };

    await runManagerAgentLoop({
      endpoint: "https://api.openai.com/v1/responses",
      apiKey: "test-key",
      model: "gpt-5-mini",
      instructions: "Manager",
      context: {},
      tools: managerConversationTools,
      jsonSchema: { name: "manager", schema: { type: "object" } },
      fetchImpl: fetchImpl as typeof fetch,
      parallelToolCalls: true,
      executeTool: async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 50));
        active -= 1;
        return { ok: true };
      },
    });

    expect(maxActive).toBe(2);
  });

  it("surfaces useful messages from non-Error tool failures", async () => {
    let call = 0;
    const fetchImpl = async () => {
      call += 1;
      return new Response(JSON.stringify(call === 1
        ? { id: "resp-tool", output: [{ type: "function_call", call_id: "call-1", name: "query_evidence_items", arguments: "{}" }] }
        : { id: "resp-final", output_text: JSON.stringify({ responseBody: "Handled." }) }), { status: 200 });
    };

    const traces: any[] = [];
    await runManagerAgentLoop({
      endpoint: "https://api.openai.com/v1/responses",
      apiKey: "test-key",
      model: "gpt-5-mini",
      instructions: "Manager",
      context: {},
      tools: managerConversationTools,
      jsonSchema: { name: "manager", schema: { type: "object" } },
      fetchImpl: fetchImpl as typeof fetch,
      executeTool: async () => { throw { message: "provider unavailable" }; },
      onToolEvent: (event) => { traces.push(event); },
    });

    expect(traces.find((event) => event.status === "failed")?.summary).toContain("provider unavailable");
  });

  it("awaits async tool event handlers before returning the final response", async () => {
    const sequence: string[] = [];
    let call = 0;
    const fetchImpl = async () => {
      call += 1;
      return new Response(JSON.stringify(call === 1
        ? { id: "resp-tool", output: [{ type: "function_call", call_id: "call-1", name: "query_evidence_items", arguments: "{}" }] }
        : { id: "resp-final", output_text: JSON.stringify({ responseBody: "Done." }) }), { status: 200 });
    };

    const result = await runManagerAgentLoop({
      endpoint: "https://api.openai.com/v1/responses",
      apiKey: "test-key",
      model: "gpt-5-mini",
      instructions: "Manager",
      context: {},
      tools: managerConversationTools,
      jsonSchema: { name: "manager", schema: { type: "object" } },
      fetchImpl: fetchImpl as typeof fetch,
      executeTool: async () => ({ ok: true }),
      onToolEvent: async (event) => {
        await new Promise((resolve) => setTimeout(resolve, 25));
        sequence.push(event.status);
      },
    });

    expect(result.outputText).toContain("Done");
    expect(sequence).toEqual(["started", "completed"]);
  });
});
