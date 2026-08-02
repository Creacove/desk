# Manager Context Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep long-lived Manager conversations under a controlled OpenAI context budget while allowing complete documents to remain durable and retrievable in Desk.

**Architecture:** The shared Manager agent loop gains explicit Responses compaction, output, cache, and tool-result controls. A new shared Manager-context module creates a bounded opening brief and a continuation scope pointer. Manager documents are retrieved through a scoped section tool instead of embedding `render_json` in every workspace packet. Both Manager functions use the same error classification so provider details remain internal.

**Tech Stack:** Supabase Edge Functions (Deno/TypeScript), OpenAI Responses API, Vitest, existing Supabase service-role data access.

---

## File structure

- `supabase/functions/_shared/manager-conversation/agentLoop.ts` — Responses request options, compacted tool outputs, and typed provider failures.
- `supabase/functions/_shared/manager-conversation/context.ts` — bounded opening brief, continuation scope pointer, context caps, and public/internal error mapping.
- `supabase/functions/_shared/manager-conversation/toolExecutor.ts` — metadata-first Manager-output query and bounded, workspace-scoped document-section tool.
- `supabase/functions/manager-conversation/index.ts` — apply the shared context boundary and OpenAI controls to non-streaming chat.
- `supabase/functions/manager-conversation-stream/index.ts` — apply the identical boundary and controls to streaming chat.
- `src/manager-agent-loop.test.ts` — shared request and tool-output behaviour.
- `src/manager-conversation-context.test.ts` — pure opening/continuation context and provider-failure contracts.
- `src/manager-conversation-tool-executor.test.ts` — scoped document retrieval behaviour with a realistic query double.
- `src/openai-manager-conversation-function.test.ts` — deployed-function source contracts for both routes.

### Task 1: Add bounded Responses request controls

**Files:**
- Modify: `src/manager-agent-loop.test.ts`
- Modify: `supabase/functions/_shared/manager-conversation/agentLoop.ts`

- [ ] **Step 1: Write failing request-control tests**

Add a `buildManagerAgentRequest` test that passes `maxOutputTokens: 6000`, `contextManagement: [{ type: "compaction", compact_threshold: 64000 }]`, `promptCacheKey: "manager:workspace-1:v1"`, and `promptCacheMode: "explicit"`. Assert the request contains all four values.

Add a loop test whose tool returns a 30,000-character `content` string. Assert the following `function_call_output` is capped and contains a truncation marker rather than the full string.

- [ ] **Step 2: Run the focused test file and confirm the new assertions fail**

Run: `npm test -- src/manager-agent-loop.test.ts`

Expected: the request-control assertion fails because the new request properties are absent, and the tool-output assertion fails because the output remains unbounded.

- [ ] **Step 3: Add minimal shared-loop support**

Extend `ManagerAgentRequestInput` with optional `maxOutputTokens`, `contextManagement`, `promptCacheKey`, and `promptCacheMode` fields. Add those fields to the initial request and tool-continuation request when supplied.

Before serializing a successful tool result, route it through a `compactToolOutput` helper that serializes safely, keeps at most 12,000 UTF-8 characters, and returns `{ truncated: true, excerpt }` when over budget. Keep the existing public tool trace based on the original result summary.

- [ ] **Step 4: Run the focused test file and confirm it passes**

Run: `npm test -- src/manager-agent-loop.test.ts`

Expected: all tests in the file pass.

- [ ] **Step 5: Commit the focused loop change**

```bash
git add src/manager-agent-loop.test.ts supabase/functions/_shared/manager-conversation/agentLoop.ts
git commit -m "fix: bound manager response context"
```

### Task 2: Create the pure Manager context boundary

**Files:**
- Create: `src/manager-conversation-context.test.ts`
- Create: `supabase/functions/_shared/manager-conversation/context.ts`
- Modify: `supabase/functions/manager-conversation/index.ts`
- Modify: `supabase/functions/manager-conversation-stream/index.ts`

- [ ] **Step 1: Write failing pure-context tests**

Write tests for `buildManagerConversationModelContext` using an intentionally oversized packet. Assert an opening context contains no `latestManagerIntelligencePacket`, no `missionPatternRegistry`, no raw `render_json`, no full message metadata, at most six message summaries, and a byte length below 90,000.

Write a continuation test with a previous response ID. Assert it contains the user message, context answers, task ID, and scope IDs, but does not include `openingBrief`, conversation history, or the large packet fields.

Write provider-error tests for a token-limit 429, a normal 429, and an unknown 500. Assert public messages never contain `gpt-`, `OpenAI`, request IDs, or the raw provider body while internal messages retain the original diagnostic text.

- [ ] **Step 2: Run the new test file and confirm it fails**

Run: `npm test -- src/manager-conversation-context.test.ts`

Expected: the import fails because the shared context module does not exist.

- [ ] **Step 3: Implement bounded context and error classification**

Create `context.ts` with:

```ts
export function buildManagerConversationModelContext(input, packet, conversationId, previousResponseId) {
  return previousResponseId
    ? { scope: { accountId: input.accountId, artistWorkspaceId: input.artistWorkspaceId, artistId: input.artistId, conversationId, taskId: input.taskId ?? "" }, userMessage: input.body.trim(), contextRequestId: input.contextRequestId ?? "", contextAnswers: normalizeContextAnswers(input.contextAnswers) }
    : { scope: { accountId: input.accountId, artistWorkspaceId: input.artistWorkspaceId, artistId: input.artistId, conversationId, taskId: input.taskId ?? "" }, openingBrief: compactOpeningPacket(packet), userMessage: input.body.trim(), contextRequestId: input.contextRequestId ?? "", contextAnswers: normalizeContextAnswers(input.contextAnswers) };
}
```

`compactOpeningPacket` must cap strings and lists, retain profile/task/mission/music/output summaries, and retain only active playbook keys and recommended pattern keys. It must never copy the full intelligence packet, full registry, raw manager-output render data, or message metadata.

Add `classifyManagerConversationError` returning `{ publicMessage, internalMessage }`. Use its public value for HTTP/SSE responses and its internal value for the Manager run and usage event failure records.

- [ ] **Step 4: Wire both Manager functions to the shared module**

Replace their local `managerConversationModelContext` calls with the shared builder. Build playbook instructions from the original packet before compacting it. Pass `maxOutputTokens: 6000`, compaction threshold `64000`, and a stable workspace cache key into `runManagerAgentLoop`. Replace local raw `describeError` use in each catch block with the shared classified failure.

- [ ] **Step 5: Run the context and function-contract tests**

Run: `npm test -- src/manager-conversation-context.test.ts src/openai-manager-conversation-function.test.ts`

Expected: both test files pass.

- [ ] **Step 6: Commit the context boundary**

```bash
git add src/manager-conversation-context.test.ts supabase/functions/_shared/manager-conversation/context.ts supabase/functions/manager-conversation/index.ts supabase/functions/manager-conversation-stream/index.ts src/openai-manager-conversation-function.test.ts
git commit -m "fix: compact manager conversation context"
```

### Task 3: Retrieve documents through a bounded scoped tool

**Files:**
- Create: `src/manager-conversation-tool-executor.test.ts`
- Modify: `supabase/functions/_shared/manager-conversation/agentLoop.ts`
- Modify: `supabase/functions/_shared/manager-conversation/toolExecutor.ts`
- Modify: `supabase/functions/_shared/openaiManagerConversation.ts`

- [ ] **Step 1: Write failing document-tool tests**

Create a chainable Supabase query double that records selected columns and filters. Test that `query_manager_outputs` returns a metadata-only record without a raw `render_json` document body. Test that `read_manager_output_section` selects by output ID and current account/workspace/artist, returns at most 7,000 characters, and marks a truncated excerpt. Test a missing scoped row returns a neutral `not_found` result without leaking another workspace artifact.

Add an agent-loop request test that expects a `read_manager_output_section` function tool definition.

- [ ] **Step 2: Run the new tests and confirm they fail**

Run: `npm test -- src/manager-conversation-tool-executor.test.ts src/manager-agent-loop.test.ts`

Expected: the document tool is absent and the existing output query still requests `render_json`.

- [ ] **Step 3: Implement metadata-first output access and section retrieval**

Change `queryManagerOutputs` to request and return only `id`, `output_type`, subject fields, `summary`, confidence/evidence metadata, and `created_at`.

Add the strict function-tool definition `read_manager_output_section` with `outputId`, `query`, and `maxChars` fields. Its executor reads a single workspace-scoped `manager_outputs` row, extracts the text from known output shapes (`render_json.content`, `primary_recommendation_json.recommendation`, or `summary`), selects a query-adjacent section when requested, and caps it at 7,000 characters.

Update the Manager instructions to direct the model to query output metadata first and request a document section only when text is necessary.

- [ ] **Step 4: Run document and loop tests and confirm they pass**

Run: `npm test -- src/manager-conversation-tool-executor.test.ts src/manager-agent-loop.test.ts`

Expected: both files pass.

- [ ] **Step 5: Commit the document retrieval change**

```bash
git add src/manager-conversation-tool-executor.test.ts src/manager-agent-loop.test.ts supabase/functions/_shared/manager-conversation/agentLoop.ts supabase/functions/_shared/manager-conversation/toolExecutor.ts supabase/functions/_shared/openaiManagerConversation.ts
git commit -m "feat: retrieve manager documents by section"
```

### Task 4: Verify, deploy, and observe the focused change

**Files:**
- Modify: `docs/production-stabilization-issues.md`

- [ ] **Step 1: Add the P0 resolution verification note**

Record the deployed context threshold, output cap, tool-output cap, and the production checks required before closing the Manager TPM issue.

- [ ] **Step 2: Run type and regression verification**

Run:

```bash
deno check supabase/functions/manager-conversation/index.ts
deno check supabase/functions/manager-conversation-stream/index.ts
npm test -- src/manager-agent-loop.test.ts src/manager-conversation-context.test.ts src/manager-conversation-tool-executor.test.ts src/openai-manager-conversation-function.test.ts
npm test
npm run build
```

Expected: every command exits successfully. The full Vitest suite and production build must pass before deployment.

- [ ] **Step 3: Deploy only changed Manager functions without Docker**

Run:

```bash
supabase functions deploy manager-conversation --use-api
supabase functions deploy manager-conversation-stream --use-api
```

Then confirm their versions are active with `supabase functions list` and run a production Manager conversation with a long existing thread. Confirm the user receives no raw provider error and that the resulting `ai_run_usage_events` input token count remains below the configured safe envelope.

- [ ] **Step 4: Commit verification documentation**

```bash
git add docs/production-stabilization-issues.md
git commit -m "docs: record manager context safeguards"
```

