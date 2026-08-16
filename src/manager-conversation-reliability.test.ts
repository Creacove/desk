import { describe, expect, it, vi } from "vitest";
import { runManagerAgentLoop } from "../supabase/functions/_shared/manager-conversation/agentLoop";
import { classifyManagerConversationError } from "../supabase/functions/_shared/manager-conversation/context";

describe("Manager conversation reliability", () => {
  it("retries a transient TPM 429 inside the same Manager turn", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        error: {
          message: "Rate limit reached on tokens per min. Please try again in 0s.",
          code: "rate_limit_exceeded",
        },
      }), { status: 429, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: "resp-recovered",
        output_text: "Recovered without asking the artist to start another conversation.",
        usage: { input_tokens: 100, output_tokens: 20 },
      }), { status: 200, headers: { "Content-Type": "application/json" } }));

    const result = await runManagerAgentLoop({
      endpoint: "https://api.openai.com/v1/responses",
      apiKey: "test-key",
      model: "gpt-5.6-luna",
      instructions: "test",
      context: { userMessage: "Create the launch kit" },
      tools: [],
      jsonSchema: { name: "test_output", schema: { type: "object" } },
      fetchImpl: fetchImpl as unknown as typeof fetch,
      executeTool: async () => ({}),
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result.responseId).toBe("resp-recovered");
    expect(result.outputText).toContain("Recovered");
  });

  it("does not mislabel a TPM rate limit as an oversized conversation", () => {
    const failure = classifyManagerConversationError(new Error(
      "Manager agent request failed with status 429: Rate limit reached on tokens per min. Please try again in 3.781s.",
    ));

    expect(failure.publicMessage).toBe("Manager is briefly busy. Please try again in a moment.");
    expect(failure.publicMessage.toLowerCase()).not.toContain("session is larger");
    expect(failure.publicMessage.toLowerCase()).not.toContain("focused follow-up");
  });
});
