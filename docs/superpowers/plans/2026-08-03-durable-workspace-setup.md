# Durable Workspace Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every entitled beta, Paystack, and Paddle workspace resume setup after Manager Basics, reload, or Retry without duplicating completed work.

**Architecture:** Keep `workspace_setup_runs` as the sole progress record. Add one SQL transition function plus a setup-only profile-version trigger, call that transition from the existing billing retry endpoint, preserve the checkout ID in beta activation, and make the existing frontend perform one idempotent resume on reload before bounded polling. Enable only the existing setup recovery workflow and reconcile active unfinished setup rows once.

**Tech Stack:** React 18, TypeScript, Vitest, Supabase Postgres/PLpgSQL, Supabase Edge Functions (Deno), pg_cron.

---

### Task 1: Preserve the private-beta setup identifier

**Files:**
- Modify: `src/private-beta-ui.test.tsx`
- Modify: `src/private-beta-access-contract.test.ts`
- Modify: `src/services/productionSupabase.ts`
- Modify: `supabase/functions/redeem-private-beta-code/index.ts`

- [ ] **Step 1: Write failing beta contract tests**

Extend the service test so the mocked Edge response omits `billingCheckoutSessionId` but the returned workspace must contain the request checkout ID:

```ts
expect(result.workspace.billingCheckoutSessionId).toBe("checkout-1");
```

Extend the backend source contract to require `billingCheckoutSessionId: checkoutSessionId` in the mapped beta workspace.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
npm test -- --run src/private-beta-ui.test.tsx src/private-beta-access-contract.test.ts
```

Expected: the workspace checkout-ID assertion fails because beta activation currently drops the identifier.

- [ ] **Step 3: Implement the minimal contract fix**

In `createSupabaseBillingService().redeemPrivateBetaCode`, normalize the returned workspace:

```ts
workspace: {
  ...payload.workspace,
  billingCheckoutSessionId: payload.workspace.billingCheckoutSessionId ?? checkoutSessionId,
}
```

Pass `checkoutSessionId` to the Edge mapper and include it in the response workspace:

```ts
workspace: mapWorkspace(workspace, checkoutSessionId)
```

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run the same Vitest command. Expected: both files pass.

### Task 2: Make Manager Basics and Retry durably queue setup

**Files:**
- Create: `supabase/migrations/20260803000300_durable_workspace_setup_resume.sql`
- Modify: `src/production-reliability-schema.test.ts`
- Modify: `src/paid-workspace-setup-function.test.ts`
- Modify: `supabase/functions/billing-status/index.ts`

- [ ] **Step 1: Write failing schema and retry tests**

Require the migration to define and protect:

```sql
public.prepare_workspace_setup_resume(setup_run_id uuid, explicit_retry boolean)
public.queue_setup_after_context_version()
```

Require the trigger to run only for `artist_profile_versions.source = 'setup'`, preserve completed runs, and queue `setup_brief` only when `manager_discovery` is completed or completed with limits.

Require `billing-status` to call:

```ts
serviceClient.rpc("prepare_workspace_setup_resume", {
  setup_run_id: setupResult.data.id,
  explicit_retry: true,
})
```

before dispatching the retry phase.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
npm test -- --run src/production-reliability-schema.test.ts src/paid-workspace-setup-function.test.ts
```

Expected: failures identify the missing migration functions and retry RPC call.

- [ ] **Step 3: Add the minimal setup transition migration**

Create a security-definer function that locks one setup run, validates active workspace entitlement, and returns the unchanged run when completed. For unfinished runs it must:

```sql
-- Context is already saved and discovery is complete.
stage_status := jsonb_set(stage_status, '{context_received}',
  coalesce(stage_status -> 'context_received', '{}'::jsonb) ||
  jsonb_build_object('status', 'completed', 'completed_at', now()), true);

-- Queue only the first incomplete stage and preserve all completed stage JSON.
-- An explicit retry clears error/failure/lease fields and resets that stage's
-- attempt counter once; a valid running lease remains untouched.
```

Add an `AFTER INSERT` trigger on `artist_profile_versions` guarded by `when (new.source = 'setup')`. It calls the transition for the matching unfinished run with `explicit_retry = false`, making context persistence and setup enqueue part of one database transaction.

The migration must also reconcile existing active unfinished runs once:

- set completed `context_received` from saved profile direction and budget;
- queue `setup_brief` when discovery is complete;
- make failed current stages retryable while retaining completed stages;
- set inactive/expired unfinished runs' `workflow_version` to null so recovery cannot spend AI work on them.

Reschedule the conditional workflow cron with body `{"mode":"run"}` while retaining the existing one-minute conditional query and capped worker batch.

- [ ] **Step 4: Make the existing Retry endpoint prepare then dispatch**

In `billing-status`, call `prepare_workspace_setup_resume` for an authorized explicit retry, reload the setup row, select the correct phase from the refreshed state, and invoke `paid-workspace-setup`. Do not directly update stage JSON in the Edge Function.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run the same schema/setup Vitest command. Expected: all tests pass.

### Task 3: Resume unfinished setup once on reload

**Files:**
- Modify: `src/production-app-shell.test.tsx`
- Modify: `src/app/ProductionApp.tsx`

- [ ] **Step 1: Write a failing reload-resume test**

Render an entitled workspace with complete context, a checkout ID, and `setupStatus: "running"` at `setup_brief`. Inject `billingService.retrySetup`, advance the existing bounded polling timers, and assert:

```ts
expect(retrySetup).toHaveBeenCalledTimes(1);
expect(retrySetup).toHaveBeenCalledWith({ checkoutSessionId: "checkout-1" });
expect(await screen.findByRole("heading", { name: "Desk HQ" })).toBeInTheDocument();
```

Also assert that a completed workspace never calls `retrySetup`.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```powershell
npm test -- --run src/production-app-shell.test.tsx -t "resumes unfinished setup once on reload|does not resume completed setup"
```

Expected: unfinished setup is only polled and `retrySetup` is never called.

- [ ] **Step 3: Add one idempotent resume per mounted workspace**

Add a ref keyed by user/workspace/checkout and, inside the existing setup polling effect, call `runtime.billingService.retrySetup` once before polling:

```ts
const resumeKey = `${sessionUser.id}:${workspace.artistWorkspaceId}:${workspace.billingCheckoutSessionId}`;
if (setupResumeAttempted.current !== resumeKey) {
  setupResumeAttempted.current = resumeKey;
  void runtime.billingService?.retrySetup?.({
    checkoutSessionId: workspace.billingCheckoutSessionId,
  }).then((result) => {
    if (!cancelled && result.workspace) setWorkspace(result.workspace);
  });
}
```

Keep failed runs on the visible Retry path and completed runs out of the effect.

- [ ] **Step 4: Run focused and full shell tests**

Run the focused test, then:

```powershell
npm test -- --run src/production-app-shell.test.tsx
```

Expected: all non-skipped shell tests pass.

### Task 4: Enable setup-only automatic recovery

**Files:**
- Modify: `src/workflow-recovery-function.test.ts`
- Modify: `docs/production-reliability-live-workspace-rollout.md`
- Modify: `supabase/migrations/20260803000300_durable_workspace_setup_resume.sql`

- [ ] **Step 1: Write the failing recovery schedule assertions**

Require the new migration to schedule `workflow-recovery-worker`, use `jsonb_build_object('mode', 'run')`, retain the indexed candidate `exists` guard, and avoid enabling any non-setup workflow version in code.

- [ ] **Step 2: Run the recovery tests and verify RED**

Run:

```powershell
npm test -- --run src/workflow-recovery-function.test.ts
```

Expected: the current observation-only schedule does not satisfy the execution assertions.

- [ ] **Step 3: Complete the setup-only schedule and rollout notes**

Keep function-side allowlisting unchanged. Document the production secret value as exactly:

```text
WORKFLOW_RECOVERY_ENABLED_VERSIONS=workspace_setup_v1
```

The migration must unschedule the old observer and create the setup recovery worker only after existing run reconciliation.

- [ ] **Step 4: Run recovery tests and verify GREEN**

Run the recovery test file again. Expected: pass.

### Task 5: Verify, deploy, and reconcile production

**Files:**
- All modified files above

- [ ] **Step 1: Run fresh repository verification**

Run:

```powershell
npm test -- --run src/private-beta-ui.test.tsx src/private-beta-access-contract.test.ts src/production-reliability-schema.test.ts src/paid-workspace-setup-function.test.ts src/workflow-recovery-function.test.ts src/production-app-shell.test.tsx
npm run build
git diff --check
```

Expected: zero test failures, successful Vite build, and no diff-check errors.

- [ ] **Step 2: Commit and push the implementation**

```powershell
git add docs src supabase
git commit -m "fix: make workspace setup self-healing"
git push origin main
```

- [ ] **Step 3: Apply production state changes**

```powershell
supabase db push
supabase functions deploy redeem-private-beta-code billing-status paid-workspace-setup workflow-recovery
supabase secrets set WORKFLOW_RECOVERY_ENABLED_VERSIONS=workspace_setup_v1
npx netlify deploy --prod --build
```

Deploy only the functions changed or required by the setup contract. Do not redeploy unrelated Manager, mission, or music functions.

- [ ] **Step 4: Verify production setup state**

Confirm:

- the public site returns HTTP 200 with the new asset hash;
- active unfinished setup rows progress or become visibly failed with Retry;
- completed rows retain their completed stage JSON;
- the supplied account remains unentitled until payment or beta redemption rather than receiving accidental access;
- a fresh beta activation returns `billingCheckoutSessionId` immediately.
