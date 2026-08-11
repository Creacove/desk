# Central Error Telemetry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist every unexpected application failure in one service-role-only `app_error_events` table with the real diagnostic, account identity when known, request correlation, and direct links to workflow records.

**Architecture:** A migration creates the private append-only diagnostic ledger. One pure shared module normalizes and scrubs errors, then persists through the Supabase REST endpoint without importing another runtime client. A shared Edge boundary assigns request IDs and catches otherwise-unrecorded 5xx responses; important workflows also call the capture helper inside their catches so the original exception is retained. An authenticated, bounded Edge endpoint accepts browser-only failures and global browser handlers invoke it without blocking the UI.

**Tech Stack:** PostgreSQL/Supabase migrations and RLS, Supabase Edge Functions on Deno, TypeScript, React, `@supabase/supabase-js`, Vitest.

---

### Task 1: Private central error table

**Files:**
- Create: `supabase/migrations/20260811000100_app_error_events.sql`
- Create: `src/app-error-events-schema.test.ts`

- [ ] **Step 1: Write the failing schema test**

Create a Vitest contract test that loads `20260811000100_app_error_events.sql` and requires:

```ts
expect(sql).toMatch(/create table public\.app_error_events/i);
expect(sql).toMatch(/error_message text not null/i);
expect(sql).toMatch(/error_details jsonb not null/i);
expect(sql).toMatch(/account_email text/i);
expect(sql).toMatch(/provider_request_id text/i);
expect(sql).toMatch(/enable row level security/i);
expect(sql).toMatch(/revoke all on public\.app_error_events from anon, authenticated/i);
expect(sql).toMatch(/grant select, insert, update, delete on public\.app_error_events to service_role/i);
expect(sql).not.toMatch(/create policy[^;]+authenticated/is);
```

- [ ] **Step 2: Run the schema test and verify RED**

Run: `npm test -- src/app-error-events-schema.test.ts`

Expected: FAIL because the migration does not exist.

- [ ] **Step 3: Create the migration**

Create `public.app_error_events` with UUID primary key, timestamps, environment/release/severity/status, source/function/operation/route, error class/code/fingerprint, full message/details/stack/public message/context, optional user/email/account/workspace/artist identity, trace/request/parent IDs, provider/status/latency fields, optional setup/Manager/source-sync/usage/billing/operating/conversation/mission/task/music references, stage and attempt. Add checks for enum-like text values, JSON object checks, positive numeric checks, indexes on `(occurred_at desc)`, `(status, severity, occurred_at desc)`, `(fingerprint, occurred_at desc)`, `(account_email, occurred_at desc)`, `(request_id)`, and partial indexes for non-null setup/Manager run IDs. Enable RLS, revoke anonymous/authenticated access, and grant only service role access.

- [ ] **Step 4: Run the schema test and verify GREEN**

Run: `npm test -- src/app-error-events-schema.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the schema slice**

```powershell
git add -- supabase/migrations/20260811000100_app_error_events.sql src/app-error-events-schema.test.ts
git commit -m "feat: add central application error ledger"
```

### Task 2: Shared diagnostic normalizer and persistence helper

**Files:**
- Create: `supabase/functions/_shared/appError.ts`
- Create: `src/app-error-capture.test.ts`

- [ ] **Step 1: Write failing normalization tests**

Test the wished-for API:

```ts
const row = normalizeAppError(new Error("OpenAI failed", {
  cause: { status: 429, code: "insufficient_quota", request_id: "req_123" },
}), {
  functionName: "manager-conversation",
  operation: "generate_reply",
  accountEmail: "artist@example.com",
  requestId: "11111111-1111-4111-8111-111111111111",
  context: { authorization: "Bearer secret", conversationId: "safe-id" },
});

expect(row.error_message).toContain("OpenAI failed");
expect(row.error_details).toMatchObject({ cause: expect.objectContaining({ code: "insufficient_quota" }) });
expect(row.provider_request_id).toBe("req_123");
expect(row.account_email).toBe("artist@example.com");
expect(JSON.stringify(row)).not.toContain("Bearer secret");
```

Add separate tests for Supabase `{ code, message, details, hint }`, nested causes, stack truncation, JSON byte limits, credential-key scrubbing, signed URL query removal, stable fingerprints, and circular/unserializable values.

- [ ] **Step 2: Run helper tests and verify RED**

Run: `npm test -- src/app-error-capture.test.ts`

Expected: FAIL because `appError.ts` does not exist.

- [ ] **Step 3: Implement pure normalization**

Export these contracts:

```ts
export type AppErrorContext = {
  functionName: string;
  operation: string;
  source?: "client" | "edge" | "worker" | "database" | "provider";
  severity?: "warning" | "error" | "critical";
  publicMessage?: string;
  requestId?: string;
  traceId?: string;
  userId?: string;
  accountEmail?: string;
  accountId?: string;
  artistWorkspaceId?: string;
  artistId?: string;
  provider?: string;
  providerRequestId?: string;
  httpStatus?: number;
  context?: Record<string, unknown>;
  refs?: Record<string, string | number | null | undefined>;
};

export function normalizeAppError(error: unknown, context: AppErrorContext): Record<string, unknown>;
export async function captureAppError(error: unknown, context: AppErrorContext): Promise<string | null>;
```

The normalizer keeps useful provider/database fields and recursively scrubs only credential-bearing keys and high-risk bodies. Bound message to 8 KB, stack to 32 KB, details to 32 KB serialized, and context to 16 KB serialized. Record truncation metadata. Compute a SHA-256 fingerprint from function, operation, error class/code, provider, and the first normalized stack frame.

`captureAppError()` POSTs one row to `${SUPABASE_URL}/rest/v1/app_error_events` with the service-role key and `Prefer: return=representation`. It checks non-2xx responses, emits the complete scrubbed event to `console.error`, never throws, and returns the persisted UUID when available.

- [ ] **Step 4: Run helper tests and verify GREEN**

Run: `npm test -- src/app-error-capture.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the helper slice**

```powershell
git add -- supabase/functions/_shared/appError.ts src/app-error-capture.test.ts
git commit -m "feat: normalize and persist application errors"
```

### Task 3: Common Edge request boundary

**Files:**
- Create: `supabase/functions/_shared/appFunction.ts`
- Create: `src/app-error-boundary.test.ts`
- Modify: every `supabase/functions/*/index.ts` entrypoint

- [ ] **Step 1: Write the failing boundary tests**

Test that the wrapper:

```ts
const wrapped = withAppErrorCapture("example", async () => new Response('{"error":"public"}', { status: 500 }));
const response = await wrapped(new Request("https://example.test/functions/v1/example", { method: "POST" }));
expect(response.status).toBe(500);
expect(response.headers.get("x-request-id")).toMatch(UUID_PATTERN);
expect(capture).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
  functionName: "example",
  operation: "request",
  httpStatus: 500,
}));
```

Also cover accepted valid inbound request IDs, replacement of invalid IDs, OPTIONS header decoration, unhandled exceptions becoming a safe 500 response with an `errorEventId`, and a pre-marked `x-error-captured: 1` response not producing a duplicate row.

- [ ] **Step 2: Run boundary tests and verify RED**

Run: `npm test -- src/app-error-boundary.test.ts`

Expected: FAIL because `appFunction.ts` does not exist.

- [ ] **Step 3: Implement the boundary**

Export:

```ts
export function withAppErrorCapture(
  functionName: string,
  handler: (request: Request) => Promise<Response> | Response,
): (request: Request) => Promise<Response>;
```

The wrapper assigns a UUID request ID, measures latency, decorates CORS allow/expose headers, captures returned status `>= 500` unless already marked, and catches otherwise-unhandled exceptions. It never records 4xx validation/auth/not-found responses.

- [ ] **Step 4: Wrap every Edge entrypoint**

For each `supabase/functions/*/index.ts`, import `withAppErrorCapture` and change:

```ts
Deno.serve(async (request) => {
```

to:

```ts
Deno.serve(withAppErrorCapture("directory-name", async (request) => {
```

and change the matching final `});` to `}));`. Do not change handler bodies or response semantics in this mechanical step.

- [ ] **Step 5: Add and run an all-entrypoint contract test**

The test enumerates every first-level function directory containing `index.ts`, excludes `_shared`, and requires its entrypoint to contain both the shared import and `Deno.serve(withAppErrorCapture("<directory-name>"`.

Run: `npm test -- src/app-error-boundary.test.ts src/app-error-entrypoint-contract.test.ts`

Expected: PASS for every Edge Function.

- [ ] **Step 6: Commit the boundary slice**

```powershell
git add -- supabase/functions src/app-error-boundary.test.ts src/app-error-entrypoint-contract.test.ts
git commit -m "feat: capture failures at every edge boundary"
```

### Task 4: High-fidelity workflow capture and known bookkeeping fixes

**Files:**
- Modify: `supabase/functions/manager-conversation/index.ts`
- Modify: `supabase/functions/manager-conversation-stream/index.ts`
- Modify: `supabase/functions/manager-artist-discovery/index.ts`
- Modify: `supabase/functions/paid-workspace-setup/index.ts`
- Modify: `supabase/functions/mission-genesis/index.ts`
- Modify: `supabase/functions/generate-todays-brief/index.ts`
- Modify: `supabase/functions/workflow-recovery/index.ts`
- Modify: billing and payment webhook/worker entrypoints
- Modify: music worker entrypoints
- Modify: relevant existing function contract tests

- [ ] **Step 1: Write failing contract tests for the known gaps**

Require both Manager conversation functions to update `ai_run_usage_events.failure_reason`, inspect the returned `{ error }`, and call `captureAppError` with the original exception. Require discovery to omit `rawError` from the customer response while passing the raw exception to central capture. Require setup, mission, brief, recovery, payment, and worker terminal catches to call `captureAppError` with their available account/workspace/run references.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `npm test -- src/openai-manager-conversation-function.test.ts src/manager-artist-discovery-function.test.ts src/paid-workspace-setup-function.test.ts src/openai-mission-genesis-function.test.ts src/openai-todays-brief-function.test.ts src/workflow-recovery-function.test.ts src/paddle-backend-contract.test.ts src/paystack-fulfillment.test.ts src/music-manager-read-refresh-worker.test.ts src/music-audio-analysis-worker.test.ts`

Expected: FAIL on missing central calls, the nonexistent usage column, and the temporary raw customer field.

- [ ] **Step 3: Add explicit high-fidelity capture**

In each terminal catch, call:

```ts
const errorEventId = await captureAppError(error, {
  functionName: "exact-function-name",
  operation: "exact_operation",
  source: "edge",
  publicMessage: safeMessage,
  requestId: request.headers.get("x-request-id") ?? undefined,
  userId: user?.id,
  accountEmail: user?.email,
  accountId: input?.accountId,
  artistWorkspaceId: input?.artistWorkspaceId,
  artistId: input?.artistId,
  refs: { setup_run_id: input?.setupRunId, manager_run_id: runId, usage_event_id: usageId },
  context: { stage: failureStage, trigger: input?.trigger },
});
```

Return the existing safe customer message plus `errorEventId` where the response is JSON. Never return `error_message`, provider bodies, stack traces, or `rawError` to customers.

- [ ] **Step 4: Correct failure bookkeeping**

Change both Manager usage updates to `failure_reason`. Destructure and inspect the update result; if bookkeeping fails, create a second `bookkeeping_failed` event referencing the original event ID. Apply the same returned-error check to modified setup/worker failure writes. Do not replace domain status/error columns with central telemetry.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run the same focused command from Step 2.

Expected: PASS.

- [ ] **Step 6: Commit the workflow slice**

```powershell
git add -- supabase/functions src
git commit -m "fix: preserve actionable workflow failure diagnostics"
```

### Task 5: Authenticated browser error capture

**Files:**
- Create: `supabase/functions/capture-browser-error/index.ts`
- Create: `src/lib/errorTelemetry.ts`
- Modify: `src/main.tsx`
- Create: `src/browser-error-telemetry.test.ts`

- [ ] **Step 1: Write failing browser telemetry tests**

Test that `installBrowserErrorTelemetry()` registers `error` and `unhandledrejection`, sends bounded structured errors through an injected async capture callback, coalesces the same fingerprint for 10 seconds, excludes passwords/tokens/DOM bodies, and never throws back into the application. Test the Edge source contract for authenticated identity derivation, fixed operation names, field size limits, and rejection of caller-supplied user/account email.

- [ ] **Step 2: Run browser tests and verify RED**

Run: `npm test -- src/browser-error-telemetry.test.ts`

Expected: FAIL because the module and endpoint do not exist.

- [ ] **Step 3: Implement the authenticated endpoint**

Use the request's bearer token with the anon client to resolve the Supabase user. Accept only `operation`, `message`, `stack`, `route`, `requestId`, and bounded context. Allow operations `window_error`, `unhandled_rejection`, `react_error_boundary`, and `service_call_failed`. Call `captureAppError` with `source: "client"`, the authenticated user ID/email, and a lookup of their active account/workspace when available. Wrap the endpoint in the common Edge boundary.

- [ ] **Step 4: Install global browser handlers**

In production mode, initialize the handler once from `main.tsx`. Invoke `capture-browser-error` through the singleton Supabase client. Skip public-share/prototype pages without an authenticated session, and keep the call fire-and-forget so telemetry cannot block rendering.

- [ ] **Step 5: Run browser tests and verify GREEN**

Run: `npm test -- src/browser-error-telemetry.test.ts src/supabase-client.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the browser slice**

```powershell
git add -- supabase/functions/capture-browser-error src/lib/errorTelemetry.ts src/main.tsx src/browser-error-telemetry.test.ts
git commit -m "feat: capture authenticated browser failures"
```

### Task 6: Verification and production rollout

**Files:**
- Modify only if verification reveals a tested defect.

- [ ] **Step 1: Run static diff checks**

Run: `git diff --check main...HEAD`

Expected: exit 0.

- [ ] **Step 2: Run the complete test suite with the root environment**

Run:

```powershell
node --env-file='C:\Users\USER\Desktop\ai-record-label-prototype\.env' node_modules/vitest/vitest.mjs run --environment jsdom --pool=vmThreads
```

Expected: all test files pass; only the five intentionally skipped tests remain skipped.

- [ ] **Step 3: Run the production build**

Run:

```powershell
node --env-file='C:\Users\USER\Desktop\ai-record-label-prototype\.env' node_modules/vite/bin/vite.js build
```

Expected: exit 0.

- [ ] **Step 4: Push the additive migration first**

Run: `supabase db push --linked --include-all`

Immediately query the linked production schema to verify `app_error_events`, indexes, RLS, grants, and zero initial rows. Do not deploy functions if the schema verification fails.

- [ ] **Step 5: Deploy the browser endpoint and high-risk functions first**

Deploy `capture-browser-error`, Manager conversation/stream, setup, discovery, mission, brief, workflow recovery, billing/payment, and music workers. Run their existing smoke paths and query Edge logs for deployment/runtime errors.

- [ ] **Step 6: Deploy remaining wrapped functions**

Deploy the rest of the function directories in bounded batches. After each batch, verify function versions and run one non-destructive request against a representative authenticated route.

- [ ] **Step 7: Run controlled production acceptance**

Generate one authenticated bounded browser test error and one controlled server 500 that does not mutate business state. Query `app_error_events` by request ID and verify the persisted email, function, operation, real message/details, public message, request ID, fingerprint, and workflow reference. Verify authenticated/anonymous REST reads of the table are denied.

- [ ] **Step 8: Record production evidence and commit any deployment-only documentation**

Record migration version, deployed function versions, acceptance row IDs, table size, and access checks without copying secrets or raw customer payloads into the repository.

