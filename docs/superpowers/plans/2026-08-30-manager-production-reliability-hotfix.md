# Manager Production Reliability Hotfix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the broken production Manager paths and prevent the same ownership, output-contract, lifecycle, and permission failures at their shared source boundaries.

**Architecture:** Keep authenticated Supabase clients at the identity/read boundary and use service-role clients for service-owned workflow mutations. Split non-executable planning decisions from immutable executable approvals, validate model output before persistence or visible completion, and enforce released-catalog policy in both instructions and runtime admission.

**Tech Stack:** TypeScript, React, Supabase Edge Functions, PostgreSQL/RLS/security-definer RPCs, Vitest, Deno.

---

### Task 1: Contain unsafe Career Watch execution

**Files:**
- Create: `supabase/migrations/20260830130000_manager_emergency_reliability_hotfix.sql`
- Test: `src/manager-emergency-reliability-hotfix.test.ts`

- [ ] Write a failing migration-source test requiring all Career Watch state to be disabled, the dispatcher cron to be unscheduled when `pg_cron` exists, and new workspaces to default to disabled.
- [ ] Run `npx vitest run src/manager-emergency-reliability-hotfix.test.ts` and confirm it fails because the migration does not exist.
- [ ] Add the migration statements:

```sql
update public.manager_career_watch_state set enabled=false, last_error='Temporarily paused for structured-output reliability remediation.' where enabled;
do $$ begin if exists(select 1 from pg_extension where extname='pg_cron') then perform cron.unschedule(jobid) from cron.job where jobname='manager-career-watch-dispatcher'; end if; end $$;
create or replace function public.enable_manager_career_watch_for_workspace_v1() returns trigger language plpgsql security definer set search_path=public as $$begin insert into public.manager_career_watch_state(account_id,artist_workspace_id,artist_id,enabled,next_run_at) values(new.account_id,new.id,new.artist_id,false,now()) on conflict do nothing; return new; end$$;
```

- [ ] Run the focused test and confirm the containment assertions pass.

### Task 2: Restore Today's Brief service-owned writes

**Files:**
- Modify: `supabase/functions/generate-todays-brief/index.ts`
- Modify: `src/openai-todays-brief-function.test.ts`

- [ ] Add a failing source-contract test requiring `createManagerSynthesisRun(serviceClient, ...)` while packet construction and user authorization remain on `authClient`.
- [ ] Run the focused test and confirm it fails on the run-creation assertion.
- [ ] Create the service client once after authentication and pass it to service-owned run creation and background execution. Do not restore authenticated table mutation grants.
- [ ] Run the Today's Brief suite and Deno-check the Edge Function.

### Task 3: Split decision-only permissions from executable approvals

**Files:**
- Modify: `supabase/migrations/20260830130000_manager_emergency_reliability_hotfix.sql`
- Modify: `supabase/functions/manager-permission-action/index.ts`
- Modify: `src/services/todayPermissionAction.ts`
- Modify: `src/manager-emergency-reliability-hotfix.test.ts`
- Test: `src/today-permission-action.test.ts`

- [ ] Add failing tests requiring a service-only `resolve_manager_decision_permission_v1` RPC, explicit routing for unbound permissions, rejection of executable parameters on decision-only records, and extraction of the Edge response body rather than the generic Supabase wrapper.
- [ ] Implement an idempotent security-definer RPC that locks one unbound pending decision, records approve/reject, writes a deduplicated operating event, queues an adaptive review when mission-scoped, and always returns `shouldExecute=false`.
- [ ] Route `created_from_action_id IS NULL` to the decision RPC; retain `resolve_manager_permission_v1` for action-bound execution approvals.
- [ ] Capture the original permission exception through central telemetry before returning a safe message and trace reference.
- [ ] Parse the Edge response body in the Today client so the user sees the safe server explanation.
- [ ] Run permission, schema, and frontend-focused tests plus Deno check.

### Task 4: Prevent invalid generated human tasks before persistence

**Files:**
- Modify: `supabase/functions/_shared/openaiManagerConversationLegacy.ts`
- Modify: `supabase/functions/_shared/managerHumanTaskGenerationContract.ts`
- Modify: `src/openai-manager-conversation-function.test.ts`

- [ ] Add failing tests proving the JSON schema requires at least two task steps and the parser rejects a one-step task instead of silently dropping or persisting it.
- [ ] Set `steps.minItems=2`, state the exact rule in the generation contract, and make task normalization require two non-empty distinct execution steps.
- [ ] Throw a typed semantic-contract error when any emitted mission task is invalid so no partial graph is persisted.
- [ ] Run the Manager conversation contract tests.

### Task 5: Persist before streaming authoritative Manager completion

**Files:**
- Modify: `supabase/functions/manager-conversation-stream/index.ts`
- Modify: `src/openai-manager-conversation-function.test.ts`

- [ ] Add a failing source-order test proving mission graph persistence happens before the first `assistant.delta`.
- [ ] Move response streaming until after graph, action, memory, draft, decision package, message, run, and usage persistence succeeds; keep progress/tool events but do not stream an answer that may fail to commit.
- [ ] Emit completion only from durable rows and preserve the existing failure event/trace behavior.
- [ ] Run the Manager conversation suite and Deno check both streaming and non-streaming functions.

### Task 6: Enforce released/catalog behavior at generation and admission

**Files:**
- Create: `supabase/functions/_shared/managerReleasedCatalogPolicy.ts`
- Modify: `supabase/functions/_shared/openaiManagerConversation.ts`
- Modify: `supabase/functions/manager-conversation/index.ts`
- Modify: `supabase/functions/manager-conversation-stream/index.ts`
- Test: `src/manager-released-catalog-policy.test.ts`
- Modify: `src/openai-manager-conversation-function.test.ts`

- [ ] Add failing unit tests for released lifecycle detection and prohibited generic audio/artwork/credits/rights upload tasks or workspace actions, while allowing explicit correction and exact licensing/sync dependencies.
- [ ] Add unambiguous generation instructions that provider-observed release assets count as known and released songs default to metrics, conversion, campaign/catalog growth, targeted materials, and optimization.
- [ ] Validate the complete output against the final focused subject before persistence in both conversation functions. Reject prohibited work rather than weakening database invariants.
- [ ] Run released-policy and Manager conversation tests and Deno checks.

### Task 7: Verify, commit, deploy, and inspect production

**Files:**
- Modify only files from Tasks 1-6.

- [ ] Run focused Vitest suites for Today's Brief, Manager conversation, permissions, production service, state ownership, and reliability migrations.
- [ ] Run Deno checks on every changed Edge Function and shared import graph.
- [ ] Run `npm run build`.
- [ ] Apply the new migration to the linked Supabase project, deploy changed Edge Functions, deploy the frontend when client code changed, and push `main` only after local verification.
- [ ] Query migration state, Career Watch state/cron, recent `app_error_events`, and relevant workflow records.
- [ ] Perform controlled authenticated smoke tests for Today's Brief and a decision-only approval. Do not trigger a real external action.
- [ ] Report exact deployed commit, verification evidence, residual risks, and any workflow intentionally left quarantined.
