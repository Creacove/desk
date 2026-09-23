# Desk Operator Access and Meeting Handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let approved OrderSounds operators search and open a real customer workspace as themselves, safely process one linked Ops meeting into a reviewable Manager proposal, and apply or decline it without changing customer membership or entitlement.

**Architecture:** Add an explicit `customer | operator` access context around the existing `ProductionApp`. Operator workspace discovery/loading uses authenticated Edge Functions; read-only Desk inspection uses tightly enumerated RLS select policies guarded by the operator allow-list and a database kill switch. Meeting processing and apply are separate idempotent Edge Functions: processing writes only a review payload, while apply uses the existing Manager/Mission persistence adapter and records provenance/audit.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, Supabase Auth/Postgres/RLS/Edge Functions, existing Manager intelligence and Mission persistence

---

## Fixed decisions

- Reuse `ordersounds_operators` from PR 1 as the single internal operator/admin allow-list. An active row grants both Ops and the PR 2 Desk operator/admin surface; do not add a second admin table or a separate Desk flag. Never create `account_memberships` rows for operators.
- Use a database-backed server configuration row defaulting to disabled. Both RLS and Edge Functions consult it, so the kill switch cannot be bypassed by calling PostgREST directly.
- Operator mode is read-only except the dedicated meeting `process`, `apply`, `decline`, and `retry` endpoints. This is the smallest V1 capability set that supports managed service without opening every customer mutation path.
- Operators may inspect expired/unentitled workspaces. Customer entitlement values are returned unchanged and never treated as active because of operator status.
- Keep the existing customer loader and repositories as the default. Operator mode supplies a target loader and explicit access context; it does not write session storage membership or pretend the operator owns the account.
- `Process` creates/reuses one `manager_synthesis_runs` row with workflow `ops_meeting_ingestion_v1` and stores a review payload. It does not write Missions, tasks, or memory.
- `Apply` is the only boundary that calls existing Manager persistence. `processed` is set only after all required writes and audit records complete. Partial failures remain `failed` and retryable.

## Current implementation map

**Modify**

- `src/main.tsx` - recognize `/admin/workspaces` and `/admin/workspaces/:id`; construct explicit operator access context.
- `src/types/productionApp.ts` - add `WorkspaceAccessContext`, capabilities, and `loadWorkspaceById` contract without changing `loadActiveWorkspace`.
- `src/app/ProductionApp.tsx` - default customer mode; operator branch bypasses customer onboarding/payment gates, shows persistent banner, blocks billing/Team/destructive controls, and preserves customer behavior.
- `src/services/productionSupabase.ts` - add an operator workspace loader client and read-only repository wrapper; leave `createSupabaseWorkspaceLoader` unchanged.
- `src/features/settings/SettingsScreen.tsx` - hide billing and Team management in operator mode.
- `src/design-system/components.tsx` or a new `src/features/operator/OperatorAccessBanner.tsx` - persistent identity banner and Back to workspaces control.
- `supabase/functions/_shared/missionGraphPersistence.ts` - allow `sourceType: "ops_meeting"`; preserve existing branches.
- Extract only the pure Manager memory/packet helpers required by the new ingestion function from `supabase/functions/manager-conversation/index.ts`; existing customer tests must prove behavior unchanged.
- `ops/src/features/meetings/MeetingDetailScreen.tsx` and `ops/src/lib/opsService.ts` - process/retry/open-review status.

**Create**

- `supabase/migrations/<generated>_desk_operator_access.sql`
- `supabase/migrations/<generated>_ops_meeting_handoff.sql`
- `supabase/tests/desk_operator_access_smoke.sql`
- `supabase/tests/ops_meeting_handoff_smoke.sql`
- `supabase/functions/operator-workspaces/index.ts`
- `supabase/functions/ops-meeting-process/index.ts`
- `supabase/functions/ops-meeting-apply/index.ts`
- `supabase/functions/_shared/operatorAuthorization.ts`
- `supabase/functions/_shared/opsMeetingPacket.ts`
- `src/features/operator/OperatorWorkspaceIndex.tsx`
- `src/features/operator/OperatorAccessBanner.tsx`
- `src/features/operator/OpsMeetingReview.tsx`
- Focused contract/component/function tests listed below.

**Existing authorization paths preserved exactly for customers**

- `createSupabaseWorkspaceLoader(...).loadActiveWorkspace(user)` membership lookup
- `public.is_account_member(...)` and `public.has_active_workspace_entitlement(...)`
- `SubscriptionRecoveryGate`, Paystack/Paddle callbacks, setup/discovery ordering
- Team owner/member policies and invitation/join flows
- Normal `manager-conversation` and `manager-conversation-stream` membership/entitlement behavior
- Existing Mission persistence semantics for customer-triggered runs

## Task 1: Add operator access configuration and audit schema

- [ ] **Step 1: Generate migrations through the CLI**

```powershell
npx supabase migration new --help
npx supabase migration new desk_operator_access
npx supabase migration new ops_meeting_handoff
```

Use the generated paths; do not rename historical migrations.

- [ ] **Step 2: Write the failing contract test**

Create `src/desk-operator-access-schema.test.ts`. Require:

```ts
const required = [
  "operator_workspace_events",
  "private.operator_access_config",
  "private.can_operator_access_workspace",
  "ops_meeting_ingestion_v1",
];

const forbidden = [
  /insert into public\.account_memberships/i,
  /update public\.account_memberships/i,
  /isoperator.*has_active_workspace_entitlement/i,
  /email.*(?:like|similar to).*ordersounds/i,
  /alter policy[\s\S]+is_account_member/i,
];
```

- [ ] **Step 3: Run RED**

Run `npm test -- src/desk-operator-access-schema.test.ts`.

- [ ] **Step 4: Implement config and audit**

Create one private singleton row:

```sql
create table private.operator_access_config (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users(id)
);
```

Create `operator_workspace_events` exactly as the handover specifies, using `target_id text` to support UUID and non-UUID targets. Add indexes `(operator_user_id, created_at desc)` and `(artist_workspace_id, created_at desc)`. Enable RLS; operators may select their own audit events, while inserts are server/service-only. Add an immutable update/delete guard.

- [ ] **Step 5: Implement one fail-closed helper**

`private.can_operator_access_workspace(p_artist_workspace_id uuid)` returns true only when config is enabled, the exact authenticated user is active in `ordersounds_operators`, and the target workspace exists. Use `security definer set search_path = ''`, revoke from `public, anon`, and grant execute to `authenticated` only.

- [ ] **Step 6: Commit**

```powershell
git add src/desk-operator-access-schema.test.ts supabase/migrations
git commit -m "feat: add operator access kill switch and audit"
```

## Task 2: Add narrow read-only RLS for operator inspection

- [ ] **Step 1: Write the SQL smoke test first**

In `supabase/tests/desk_operator_access_smoke.sql`, seed customer A, customer B, one operator, one non-operator, and representative Desk rows. Assert:

1. Disabled config returns zero operator rows.
2. Enabled config lets only the active operator select the exact URL-targeted workspace rows.
3. Non-operator and inactive operator receive zero rows.
4. No operator insert/update/delete succeeds on Desk-domain tables.
5. No `account_memberships`, billing, or entitlement row is created or changed.

- [ ] **Step 2: Add separate select policies, never edit customer policies**

Add operator `for select to authenticated` policies guarded by `(select private.can_operator_access_workspace(artist_workspace_id))` to this explicit V1 set:

```text
artist_profiles, source_sync_jobs, operating_events,
evidence_items, artifact_links,
manager_outputs, manager_synthesis_runs, manager_run_actions,
missions, mission_plan_versions, checkpoints, mission_plan_checkpoints,
tasks, task_steps, task_state_events, task_results, reviews, memory_entries,
conversations, conversation_messages,
music_items, music_projects, music_project_items, music_identifiers,
music_assets, music_credits, music_splits, music_split_contributors,
documents, document_versions, uploaded_files,
release_opportunities, release_date_change_requests
```

Do not add operator policies to `account_memberships`, billing/subscription/access-grant tables, Team invitations/settings, storage objects, or destructive lifecycle tables. Global lookup tables retain their current policies.

- [ ] **Step 3: Verify policy performance**

Every policy filters on indexed `artist_workspace_id`. Confirm each listed table has a leading index for that column; add only missing indexes. Run advisors and inspect `EXPLAIN` for a representative mission and conversation query.

- [ ] **Step 4: Run the smoke test and commit**

Expected: all five assertions pass with config both off and on.

```powershell
git add supabase/migrations supabase/tests/desk_operator_access_smoke.sql
git commit -m "feat: allow kill-switched operator inspection"
```

## Task 3: Build authenticated workspace list/load endpoints

- [ ] **Step 1: Write Edge Function contract tests**

Create `src/operator-workspaces-function.test.ts`. Assert the source re-authenticates with `auth.getUser()`, checks active operator and config on every request, validates the exact target ID, limits search results, and never returns membership or billing data.

- [ ] **Step 2: Implement shared authorization**

`operatorAuthorization.ts` exports:

```ts
export type AuthorizedOperator = { userId: string; email?: string };

export async function requireOperatorWorkspaceAccess(
  request: Request,
  targetWorkspaceId?: string,
): Promise<{ actor: AuthorizedOperator; authClient: any; adminClient: any }>;
```

It must authenticate the bearer token, select the operator row by authenticated user ID, read the database config, and when provided verify the exact workspace. Return 401 for no user and 403 for disabled/non-operator/invalid target without leaking workspace existence.

- [ ] **Step 3: Implement `operator-workspaces`**

Support only:

```ts
type Request =
  | { action: "list"; query: string }
  | { action: "load"; artistWorkspaceId: string };
```

`list` returns max 25 rows with workspace/artist/account identity and status. `load` returns the normal `ProductionWorkspace` shape, including real entitlement/access status, plus `accessMode: "operator"`. It writes `workspace_opened` to `operator_workspace_events` after successful load. Never call or alter `has_active_workspace_entitlement` because of operator identity.

- [ ] **Step 4: Verify and commit**

```powershell
npm test -- src/operator-workspaces-function.test.ts
git add src/operator-workspaces-function.test.ts supabase/functions/operator-workspaces supabase/functions/_shared/operatorAuthorization.ts
git commit -m "feat: add operator workspace gateway"
```

## Task 4: Add explicit access context without changing customer loading

- [ ] **Step 1: Write routing and loader tests first**

Create `src/operator-workspace-routing.test.tsx` and extend `src/production-supabase-service.test.ts`. Cover:

- customer root still calls only `loadActiveWorkspace`;
- `/admin/workspaces` rejects non-operators;
- `/admin/workspaces/:id` calls `loadWorkspaceById(id)`;
- URL tampering is rejected by the server;
- operator target is never written to `ordersounds.workspace.active`;
- Back to workspaces clears only the route, not the auth session.

- [ ] **Step 2: Add the access types**

```ts
export type WorkspaceAccessContext =
  | { mode: "customer" }
  | {
      mode: "operator";
      operatorUserId: string;
      targetWorkspaceId: string;
      opsMeetingId?: string;
      capabilities: {
        inspect: true;
        processOpsMeeting: true;
        billing: false;
        teamAdministration: false;
        workspaceLifecycle: false;
        directDomainMutation: false;
      };
    };
```

Keep `ProductionWorkspaceLoader.loadActiveWorkspace` unchanged. Add a separate `OperatorWorkspaceLoader.loadWorkspaceById(user, id)` interface.

- [ ] **Step 3: Implement selector and route shell**

`OperatorWorkspaceIndex.tsx` has one search field and results showing artist/workspace name, account identifier, and status. Do not preload the entire customer list. Require two characters or an exact UUID.

- [ ] **Step 4: Add the smallest `ProductionApp` seam**

Add optional `accessContext` defaulting to `{ mode: "customer" }` and optional prevalidated workspace/operator loader. In operator mode:

- skip payment-return handling, workspace creation, setup resume, subscription recovery, beta notice, pricing loads, live entitlement subscriptions, and plan dialog;
- load the explicit target only;
- render existing Desk screens with read-only repositories;
- never alter `workspace.entitlementActive`;
- force a safe initial view (`labelHQ`, or `managerOffice` when `opsMeetingId` is present).

Customer branches must remain byte-for-byte equivalent where practical; prefer small `if (accessContext.mode === "customer")` guards over restructuring the component.

- [ ] **Step 5: Verify customer regression tests**

```powershell
npm test -- src/operator-workspace-routing.test.tsx src/production-supabase-service.test.ts src/production-app-shell.test.tsx src/front-door-auth.test.tsx src/subscription-recovery-gate.test.tsx src/team-first-run-routing.test.tsx
```

- [ ] **Step 6: Commit**

```powershell
git add src/main.tsx src/types/productionApp.ts src/app/ProductionApp.tsx src/services/productionSupabase.ts src/features/operator src/*operator*
git commit -m "feat: add explicit Desk operator access mode"
```

## Task 5: Make operator mode visually unmistakable and block forbidden surfaces

- [ ] **Step 1: Write UI tests first**

Create `src/operator-mode-safety.test.tsx`. Require a persistent banner with `Internal access - <artist>` and `Back to workspaces` at every supported Desk view. Assert absent: checkout/choose-plan/customer-portal actions, Team invite/remove/ownership controls, account deletion, setup/connect-artist actions, music upload/edit actions, and destructive workspace actions.

- [ ] **Step 2: Implement the banner**

Use a sticky high-contrast bar above the normal shell. Include operator label, target artist/workspace, and back control. It must remain visible at 390px and desktop widths.

- [ ] **Step 3: Centralize capabilities**

Pass `WorkspaceAccessContext` to the shell/screens. Do not scatter `isOperator` booleans or email checks. A capability guard must default to deny when context is absent or malformed.

- [ ] **Step 4: Use a read-only repository wrapper**

Wrap `createSupabaseProductionRepositories` for operator mode. Allow load methods and the dedicated meeting client only. Mutation methods throw a typed `OPERATOR_ACTION_NOT_ALLOWED` error and should not be rendered by capability-aware UI.

- [ ] **Step 5: Verify and commit**

```powershell
npm test -- src/operator-mode-safety.test.tsx src/settings-screen.test.tsx src/team-invitation-pr3.test.ts
git add src
git commit -m "feat: make operator mode safe and visible"
```

## Task 6: Define idempotent meeting processing state

- [ ] **Step 1: Write SQL smoke cases first**

In `supabase/tests/ops_meeting_handoff_smoke.sql`, cover no transcript, wrong link, non-operator, disabled operator, double claim, active claim replay, failed retry, completed replay, and cross-workspace URL tampering.

- [ ] **Step 2: Reuse the existing logical-run unique boundary**

The repository already has `manager_synthesis_runs_idempotency_idx` on `(account_id, artist_workspace_id, idempotency_key)` whenever `workflow_version` is non-null. Do not add a redundant index. Set `workflow_version='ops_meeting_ingestion_v1'` and `idempotency_key='ops-meeting:<ops_meeting_id>'`, and assert the existing index rejects a second logical run.

- [ ] **Step 3: Add claim/finalize functions callable only by service role**

`claim_ops_meeting_processing_v1(meeting_id, operator_id)` must lock meeting and case, validate transcript/link, and return one of `started`, `in_progress`, `review_ready`, `processed`. On failed retry it reuses the same run ID and increments attempt count. It never creates a second run.

`finalize_ops_meeting_processing_v1(meeting_id, run_id, status, error)` must reject mismatched IDs. Only `applied` may set `processing_status='processed'` and `processed_at`. Any error sets `failed`; review-ready keeps the meeting at `processing` and is derived from the run payload.

- [ ] **Step 4: Verify concurrency**

Run two concurrent claims for the same meeting. Expected: one `started`, one replay/in-progress; one `manager_synthesis_runs` row; zero Mission/task/memory writes.

- [ ] **Step 5: Commit**

```powershell
git add supabase/migrations supabase/tests/ops_meeting_handoff_smoke.sql
git commit -m "feat: add idempotent Ops meeting run boundary"
```

## Task 7: Process a meeting into a review payload without durable Desk mutation

- [ ] **Step 1: Write function tests first**

Create `src/ops-meeting-process-function.test.ts`. Require re-authentication, exact workspace-link check, claim RPC, one run, provenance, failure finalization, and explicit absence of Mission/task/memory inserts or `persistManagerMissionGraphDecisions` calls.

- [ ] **Step 2: Build a bounded packet**

`opsMeetingPacket.ts` loads the current artist profile, active Missions/plans/tasks/checkpoints, fresh memory, recent evidence/events, and the transcript. The packet includes:

```ts
{
  source: {
    type: "ops_meeting",
    sourceId: opsMeetingId,
    opsCaseId,
    meetingType,
    operatorUserId,
  },
  transcript,
  workspaceContext,
  currentMissions,
  memory,
  evidence,
}
```

Do not insert a conversation or an artist-authored message. Do not copy transcript text into audit metadata.

- [ ] **Step 3: Reuse the existing Manager output contract**

Use `managerConversationJsonSchema`/`parseManagerConversationOutput` and the existing Mission graph preflight. Tailor instructions to return: understood goal/current situation, constraints, decisions, commitments, uncertainties, `missionGraphDecisions`, memory candidates, tasks/checkpoints/reviews, or no durable write. Do not call Mission Genesis.

- [ ] **Step 4: Persist review only**

Write the normalized interpretation to `manager_synthesis_runs.result_payload` with classification `ops_meeting_review_v1`, source metadata, operator ID, and status `completed`. Write `operator_workspace_events.action='meeting_processed_for_review'` without transcript. Return the existing run on replay.

- [ ] **Step 5: Failure behavior**

On provider/database failure, mark the run and meeting failed with a short sanitized error. If any unexpected Desk-domain write occurred, mark `partial_failure: true`; never report processed. Retry must reuse the run.

- [ ] **Step 6: Verify and commit**

```powershell
npm test -- src/ops-meeting-process-function.test.ts src/manager-intelligence-core.test.ts src/manager-conversation-reliability.test.ts
git add supabase/functions src
git commit -m "feat: process Ops meetings into Manager review"
```

## Task 8: Build human review, apply, and decline

- [ ] **Step 1: Write review UI tests first**

Create `src/ops-meeting-review.test.tsx`. Cover loading, review-ready, uncertainty, no-write, apply confirmation, decline, applying, applied replay, failed retry, and partial failure. The transcript is collapsible context; recommended changes are the focus.

- [ ] **Step 2: Render the review in Desk language**

`OpsMeetingReview.tsx` shows goal, current situation/release, budget/constraints when present, decisions, commitments/team context, recommended Desk changes, and uncertainty. It provides `Apply changes`, `Decline`, and `Retry`; no automatic apply.

- [ ] **Step 3: Extend the existing persistence adapter narrowly**

Allow `sourceType: "ops_meeting"` in `missionGraphPersistence.ts`. Reuse preflight, mission create/update, task/checkpoint construction, and operating events. Set `originating_trigger='ops_meeting'`, `created_from_run_id`, and source links back to the meeting run. Extract/reuse the existing memory persistence helper so memory rows use `source_type='ops_meeting'`, `source_id=ops_meeting_id`, and `created_from_run_id`.

- [ ] **Step 4: Implement apply endpoint**

`ops-meeting-apply` re-authenticates the operator and target, loads the stored normalized payload, and accepts only:

```ts
type ApplyRequest = {
  opsMeetingId: string;
  artistWorkspaceId: string;
  decision: "apply" | "decline";
  editedPayload?: ManagerConversationOutput;
};
```

If edited payload is supported, parse and preflight it with the same schema; otherwise omit the field and do not ship a partial editor. Apply uses the existing persistence adapter. Decline writes no Desk-domain rows. Both append operator audit with run/meeting IDs and outcome.

- [ ] **Step 5: Make apply replay-safe**

Use run ID/source IDs as dedupe keys. Existing rows created from the run must be returned, not duplicated. Only after persistence and audit succeed call the finalize RPC with `applied`; on partial failure finalize `failed` and show needs attention.

- [ ] **Step 6: Verify and commit**

```powershell
npm test -- src/ops-meeting-review.test.tsx src/ops-meeting-apply-function.test.ts src/manager-draft-review-lifecycle.test.ts src/manager-e2e-golden.test.ts
git add src supabase/functions supabase/functions/_shared
git commit -m "feat: review and apply Ops meeting changes"
```

## Task 9: Connect Ops status and retry

- [ ] **Step 1: Add Ops client tests**

Test process double-click, network timeout/retry, review-ready deep link, failed retry, applied status, wrong workspace link, and disabled gateway.

- [ ] **Step 2: Implement calls**

`MeetingDetailScreen` invokes `ops-meeting-process`, then opens:

```text
<Desk URL>/admin/workspaces/<desk_workspace_id>?opsMeetingId=<ops_meeting_id>
```

Polling/reload reads the meeting and linked run state. Disable the button while a request is pending, but rely on server idempotency for correctness.

- [ ] **Step 3: Surface all failures on Today**

Failed and partial-failure meetings render `Retry` as the one obvious action. Review-ready meetings render `Review in Desk`. Processed meetings leave Today unless another follow-up is due.

- [ ] **Step 4: Verify and commit**

```powershell
npm --prefix ops test
npm --prefix ops run build
git add ops/src
git commit -m "feat: connect Ops to Desk meeting review"
```

## Task 10: Security, regression, rollout, and PR 2 merge gate

- [ ] **Step 1: Run focused security tests**

Test non-operator, inactive operator, kill switch off, changed URL ID, wrong Ops link, archived workspace, expired subscription, no transcript, double-click, timeout, model failure, partial apply, billing URL, Team URL, and customer session. Every privileged request must re-check current operator state.

- [ ] **Step 2: Run the complete relevant suite**

```powershell
npm test -- src/desk-operator-access-schema.test.ts src/operator-workspaces-function.test.ts src/operator-workspace-routing.test.tsx src/operator-mode-safety.test.tsx src/ops-meeting-process-function.test.ts src/ops-meeting-apply-function.test.ts src/ops-meeting-review.test.tsx src/production-app-shell.test.tsx src/front-door-auth.test.tsx src/subscription-recovery-gate.test.tsx src/paystack-fulfillment.test.ts src/paddle-app-flow-contract.test.ts src/team-first-run-contract.test.ts src/workspace-team-authority.test.ts src/manager-e2e-golden.test.ts src/manager-draft-review-lifecycle.test.ts
npm test
npm run build
npm --prefix ops test
npm --prefix ops run build
git diff --check
```

- [ ] **Step 3: Run database verification**

Apply both migrations to a disposable branch/local database, run both SQL smoke files, run database advisors, and verify the query plans use workspace indexes. Confirm `anon` has no new access and `authenticated` has no operator writes to Desk-domain tables.

- [ ] **Step 4: Execute canonical Donny Crown scenario**

Link the Ops case, process once, retry during processing, open as Temitope, confirm persistent operator banner, review proposal, apply, verify one logical run and provenance on every created record, then process a second meeting and confirm Manager can update the existing Mission. Confirm Temitope never appears in Donny's Team.

- [ ] **Step 5: Prove customer equivalence**

With the kill switch disabled and enabled, separately test solo owner, Team owner, Team member, invite/join, expired subscription, private beta, Paystack, Paddle, onboarding/discovery, normal Manager chat, Mission create/update, task assignment/authorship, and live sync. Expected: identical customer behavior and entitlement.

- [ ] **Step 6: Rollout safely**

1. Deploy schema and functions with DB config `enabled=false`.
2. Deploy Desk and Ops frontends.
3. Add only reviewed operator UUIDs.
4. Enable config in staging; run canonical scenario.
5. Enable production for Temitope/Tolu only.
6. Monitor function errors and audit events.
7. Roll back by setting config `enabled=false`; do not alter customer data or memberships.

- [ ] **Step 7: Final diff review**

Reject the PR if it adds customer memberships, changes entitlement truth, exposes service credentials, weakens existing customer policies, introduces automatic transcript mutation, or rewrites broad `ProductionApp`/Manager behavior.
