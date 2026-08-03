# Manager Conversation Reliability Design

**Date:** 2026-08-03
**Status:** Approved for implementation and live rollout

## Problem

Manager context-answer turns can generate a valid answer and begin displaying it, then fail while persisting downstream state. The current request writes related records sequentially and emits artificial answer deltas before persistence finishes. A failure in the new task-draft activity write therefore leaves a saved draft and artifact link, but no Manager message, completed run, finalized usage record, or activity event.

The immediate trigger is a contract mismatch between `writeWorkspaceEvent` and the database schema. The writer performs a PostgREST upsert with `onConflict: "artist_workspace_id,dedupe_key"`, while the database exposes only a partial unique index for that key. PostgreSQL cannot infer that partial index from the PostgREST conflict target.

Three secondary defects hide and amplify the failure:

- PostgREST errors are plain objects, but the Manager error classifier reads only `Error` instances and strings, so the internal database message is replaced by a generic fallback.
- Usage failure handling writes to `ai_run_usage_events.error`, which does not exist; the correct column is `failure_reason`.
- Retrying a failed context-answer turn resends only the visible artist-message body and drops `contextRequestId` and `contextAnswers`.

## Goals

- A Manager answer must never appear and then be replaced by an error because a later persistence step failed.
- A completed context answer must persist one coherent result: Manager message, task draft where applicable, artifact link, conversation state, run state, usage state, actions, qualified memory, decision package where applicable, and workspace activity.
- Retrying the same logical turn must be safe and must preserve structured context answers.
- A non-critical activity-notification failure must not invalidate a successfully persisted Manager answer or draft.
- Internal failure records must retain actionable PostgREST/provider diagnostics while user-facing errors remain safe.
- The live rollout must be backward compatible with existing conversations and existing saved drafts.

## Non-goals

- Replacing the OpenAI Responses integration.
- Moving interactive Manager chat to a fully asynchronous job queue.
- Redesigning the Manager UI.
- Reworking Mission Genesis or Music Manager Read workflows except where shared helpers require compatible behavior.

## Chosen Architecture

### 1. Idempotent turn identity

Every Manager send receives a client-generated `requestId`. The client retains the complete retry envelope:

```ts
type ManagerTurnEnvelope = {
  requestId: string;
  conversationId?: string;
  taskId?: string;
  body: string;
  contextRequestId?: string;
  contextAnswers?: ManagerConversationContextAnswer[];
};
```

The request ID is persisted with the artist message and synthesis run. Repeating the same request returns or resumes the existing durable result instead of creating duplicate artist messages, drafts, actions, or usage events.

### 2. Prepare, finalize, then display

The Edge Function keeps authentication, workspace validation, packet construction, tool execution, and model synthesis in TypeScript. It does not emit `assistant.delta` events until the durable finalization boundary succeeds.

The flow is:

1. Authenticate and validate the exact workspace tuple.
2. Claim or recover the logical turn by `requestId`, including its artist message, synthesis run, and usage event.
3. Build bounded context and run the Manager agent.
4. Normalize and validate the Manager output.
5. Finalize all core conversation records through one replay-safe database RPC.
6. Emit answer deltas from the committed Manager message.
7. Emit `conversation.completed` from the committed conversation view.

This preserves the current visual typing treatment while preventing uncommitted text from appearing.

### 3. Transactional core finalizer

Add `finalize_manager_conversation_v2`, a `security definer` PostgreSQL function restricted to `service_role`. It locks the synthesis run and verifies:

- account, workspace, artist, conversation, and request identity;
- the run is in a finalizable state;
- a replay carries the same normalized output identity;
- referenced task, mission, conversation, and evidence records remain in scope.

Within one transaction it:

- verifies and reuses the artist message created by the turn claim;
- inserts or supersedes the task draft when the task contract requires `manager_draft` and no further context question remains;
- inserts the artifact link idempotently;
- persists proposed actions idempotently;
- persists qualified durable memory idempotently;
- inserts or supersedes a decision package when requested;
- inserts the Manager message with its OpenAI response ID and normalized metadata;
- updates the conversation summary/status/timestamp;
- marks the synthesis run completed;
- marks the usage event succeeded with token counts;
- returns IDs and the persisted conversation payload needed by the stream response.

Mission graph mutations remain delegated to the existing mission graph persistence boundary. Their resulting canonical work references are supplied to the conversation finalizer; a graph mutation failure prevents finalization and no answer deltas are emitted.

### 4. Activity outbox is non-critical

The operating event is written inside a guarded PL/pgSQL exception block after the core records are durable within the finalizer. Its dedupe key is `manager-task-draft:<manager_output_id>`.

The schema replaces the partial dedupe index with a normal unique index on `(artist_workspace_id, dedupe_key)`. PostgreSQL unique indexes already allow multiple `NULL` values, so non-deduplicated events retain their current behavior while PostgREST and SQL `ON CONFLICT` can infer the index.

If activity insertion unexpectedly fails, the finalizer records a bounded warning in the run audit payload and still commits the Manager answer. The missing event can be reconciled later without making the chat appear failed.

### 5. Accurate failure handling

The shared error reader accepts:

- native `Error` instances;
- strings;
- structured objects containing `message`, `code`, `details`, or `hint`.

User-facing classification continues to hide provider and database internals. Internal run errors retain the structured message and code. Usage failures update `failure_reason`, set `status = 'failed'`, and set `completed_at`.

Failures are classified by phase (`request_setup`, `context_build`, `manager_synthesis`, `graph_persistence`, or `conversation_finalization`) so production records show where the turn stopped.

### 6. Structured retry

The client stores the most recent `ManagerTurnEnvelope` for the active request. A failed Manager message references that envelope. `Retry Manager message` resends the same request ID and the same structured context-answer payload.

The server handles three retry states:

- completed: return the committed conversation without calling the model again;
- in progress: return a processing event and do not duplicate work;
- failed before durable finalization: reclaim the run for another attempt while preserving the original artist message identity.

## Compatibility

- `requestId` is optional during a short transition window. The server generates a fallback ID for old clients, but the production client always supplies one.
- Existing conversation messages and Manager outputs need no backfill.
- Existing partial failed runs remain historical evidence; the migration does not rewrite or delete them.
- Both `manager-conversation` and `manager-conversation-stream` use the same finalization and error helpers so fallback and streaming behavior cannot drift.

## Testing Strategy

### Unit tests

- Structured PostgREST errors retain their internal message and expose only the safe public message.
- Usage failure patches use `failure_reason` and never reference a nonexistent `error` column.
- Client retry envelopes preserve `requestId`, `contextRequestId`, `contextAnswers`, task ID, conversation ID, and body.
- Stream deltas are emitted only after the finalizer succeeds.
- Finalizer failure emits an error without emitting any assistant delta.

### Schema and contract tests

- The dedupe index is non-partial and matches the finalizer conflict target.
- The finalizer is replay-safe and restricted to `service_role`.
- Core writes are inside the finalizer transaction.
- Activity insertion is guarded and cannot roll back core completion.
- Both Manager endpoints invoke the same v2 finalization path.

### Integration tests

- A context recommendation completes a manager-draft task and persists exactly one artist message, Manager message, current draft, artifact link, run, usage record, and activity event.
- Replaying the same request ID creates no duplicates and performs no second model call.
- Simulated activity failure still completes the conversation and returns the committed Manager answer.
- Simulated finalizer failure displays no partial answer.
- Retrying a context answer preserves the selected recommendation.

## Live Rollout

1. Run focused tests and the complete test suite.
2. Produce a successful production build.
3. Apply the database migration first.
4. Verify the finalizer signature, grants, index shape, and PostgREST schema refresh.
5. Deploy both Manager conversation Edge Functions.
6. Run a live authenticated context-question flow using a real workspace.
7. Verify the persisted artist message, Manager message, task draft, artifact link, completed synthesis run, succeeded usage event, and deduplicated operating event.
8. Replay the same request ID and verify record counts remain unchanged.
9. Inspect recent failed runs and Edge Function logs for new finalization failures.

Rollback is additive and safe: redeploy the previous functions if necessary. The new finalizer and request identity columns may remain unused. The dedupe index can be restored only after reverting all writers that rely on the inferable conflict target.

## Acceptance Criteria

- Using a Manager recommendation for a context question completes successfully in production.
- The answer never begins displaying before its durable records exist.
- Activity publication cannot convert a durable answer into a failed chat turn.
- Retry replays the full structured request and creates no duplicate durable work.
- Failed runs contain their real internal failure reason and correct phase.
- Usage records terminate as `succeeded` or `failed`; none from the repaired path remain `started` after a terminal response.
- Focused tests, the full suite, the production build, migration verification, function deployment, and live smoke test all pass.
