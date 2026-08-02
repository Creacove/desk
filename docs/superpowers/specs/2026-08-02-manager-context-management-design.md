# Manager Context Management Design

## Goal

Make Manager conversations reliable for long-lived work, including substantial drafts, without unbounded OpenAI context growth, raw provider errors, or unnecessary Supabase reads.

## Scope

This first phase changes the Manager request boundary only. It covers the non-streaming and streaming Manager Edge Functions, their shared agent loop, the workspace packet, document retrieval tools, token telemetry, and regression tests.

It does not change the conversation-room UI, task conversation routing, task CTA lifecycle, or the visual presentation of drafts. Those are a later product-workflow phase that will use this stable backend boundary.

## Confirmed Production Failure

The production conversation that failed on 2026-08-02 grew from roughly 62,000 input tokens to 173,526 input tokens across successive Manager turns, then was rejected at 202,669 tokens against the organisation's 200,000 TPM limit. The application both chained `previous_response_id` and repeatedly constructed a large workspace packet. That packet contained conversation history, full intelligence data, the mission-pattern registry, and duplicated intelligence projections.

OpenAI documents that prior input tokens in a `previous_response_id` chain are billed as input tokens. OpenAI also documents server-side compaction for long-running Responses conversations. The implementation will use that supported pattern instead of maintaining an unbounded chain.

## Decision

Use the Responses API with `previous_response_id`, `store: true`, and server-side compaction. Supabase remains Desk's canonical product state; OpenAI state provides short-lived conversational continuity only.

Each Manager request has two modes:

1. **Opening a Manager conversation** sends a lean, scoped opening brief and the user's message.
2. **Continuing a Manager conversation** sends only the new user message, a compact scope pointer, and `previous_response_id`. The Manager reads current workspace facts through scoped tools rather than receiving a rebuilt workspace dump.

All Manager requests use server-side compaction with a 64,000-token threshold and an explicit 6,000-token maximum output. This gives ample room below the 200,000 TPM limit while allowing substantial structured answers and drafts.

## Context Contract

The opening brief contains only:

- Artist identity and a compact strategic profile.
- Current task or mission when the user entered through one.
- Up to six short, relevant recent messages, each body-capped.
- Compact status summaries for current missions, tasks, music, and durable memory.
- IDs, titles, status, and summaries for recent Manager artifacts.
- Recommended mission-pattern keys, not the entire mission-pattern registry.

The brief must not include raw document bodies, entire `manager_intelligence_packets`, full `render_json` values, full conversation-message metadata, or duplicated intelligence projections.

The shared agent loop estimates request size before sending it. A request that exceeds the local context budget is reduced to the compact scope pointer rather than being sent to OpenAI. Tool results are compacted before they are returned to the model.

## Documents and Drafts

Long drafts remain complete and durable in Supabase. A normal catalog of Manager outputs returns metadata, summary, type, subject, status, and IDs only.

The Manager receives document text only through a new scoped document-section tool. The tool takes a Manager-output ID and optional section query, verifies that the artifact belongs to the current account/workspace/artist, and returns a clearly labelled excerpt with a strict character cap. It never returns an unrestricted `render_json` object or an arbitrary artifact from another workspace.

This uses the retrieval principle recommended by OpenAI for large files without introducing an OpenAI vector store, duplicate customer data, indexing jobs, or additional V1 cost.

## OpenAI Request Shape

Every Manager request will include:

```ts
{
  model,
  instructions: stableManagerInstructions,
  input: currentTurnInput,
  previous_response_id: previousResponseId || undefined,
  store: true,
  context_management: [{ type: "compaction", compact_threshold: 64000 }],
  max_output_tokens: 6000,
  prompt_cache_key: `manager:${artistWorkspaceId}:v1`,
  prompt_cache_options: { mode: "explicit" },
  tools,
  text: { format: structuredOutputSchema }
}
```

The stable instructions and stable tool definitions are placed before per-turn material. The cache breakpoint will be added only after the stable prefix is represented in the supported Responses input form; it is not a substitute for context limits. Usage records will persist input, cached-input, output, reasoning, and provider-request counts so cache effectiveness is observable.

## Failure Behaviour

Provider response bodies and internal model names never reach the user. A typed provider failure maps to a plain Desk message:

- Context or token-limit rejection: “This Manager session is larger than it can safely process right now. Start a focused follow-up or try again after the workspace refreshes.”
- Transient rate limit: “Manager is briefly busy. Please try again in a moment.”
- Other provider failure: “Manager could not complete that request. Your conversation and drafts are safe; try again.”

The internal reason remains in the run and usage records for diagnosis.

## Testing and Rollout

Tests must prove that:

1. Opening and continuation requests have the required compaction and output controls.
2. A continuation excludes bulk workspace history and does not duplicate intelligence data.
3. Oversized tool results are reduced before a follow-up model request.
4. Document reads are workspace-scoped and bounded.
5. 429 responses are mapped to a safe public message while retaining an internal classification.
6. Existing Manager structured output, tool execution, streaming events, and task-draft persistence remain intact.

The focused Edge Functions will be Deno-checked, relevant tests run first, then the complete Vitest suite and production build run before deployment. Deployment changes only the Manager Edge Functions; no database migration is required for this phase.

