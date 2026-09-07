# Generic Mission Genesis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Mission Genesis produce high-level, artist-specific missions and tasks from context while making draft-first review workflows structurally safe.

**Architecture:** Separate task intent from generated copy and from execution/completion state. A review task will carry a typed, versioned review target and will not become actionable until the target is ready. Mission generation, draft persistence, task activation, reminders, and UI hydration will all consume the same server-enforced contract; prompts will guide generation but will not be the authority.

**Tech Stack:** React 18 + TypeScript, Supabase Edge Functions (Deno), PostgreSQL migrations/RPCs, Vitest/Testing Library, existing Vite/Vercel deployment.

---

### Task 1: Define the canonical mission task contract

**Files:**
- Create: `supabase/functions/_shared/missionTaskContract.ts`
- Modify: `supabase/functions/_shared/openaiMissionGenesis.ts:44-64,218-245,747-763,852-879`
- Modify: `supabase/functions/_shared/openaiManagerConversationLegacy.ts:107-131,327-329,413-517`
- Modify: `src/types/cleanProduction.ts:432-458`
- Test: `src/mission-task-contract.test.ts`

- [ ] **Step 1: Write failing contract tests**

  Add tests that assert:

  ```ts
  expect(normalizeMissionTask({ intent: "review_approval" })).toThrow("review target");
  expect(normalizeMissionTask({ intent: "collaborative_draft", completionMode: "manager_draft" })).not.toThrow();
  expect(normalizeMissionTask({ title: "Approve the direction", completionMode: "result_note" })).toThrow("intent");
  ```

  Also test that a normal `human_action` task can be generated without a review target and that title wording never changes the normalized intent.

- [ ] **Step 2: Run the focused test and verify it fails**

  Run `npm test -- --run src/mission-task-contract.test.ts`.

- [ ] **Step 3: Add the shared contract**

  Define these values in one module:

  ```ts
  export type MissionTaskIntent = "manager_work" | "human_action" | "collaborative_draft" | "review_approval";
  export type MissionTaskCompletionMode = "result_note" | "manager_draft" | "evidence";
  export type MissionTaskReadiness = "preparing" | "ready" | "needs_revision" | "completed" | "blocked";
  export type ReviewTarget = {
    artifactType: "manager_output" | "song_document";
    artifactId: string;
    versionId?: string;
    status: "draft" | "ready_for_review" | "accepted" | "needs_revision";
  };
  export type NormalizedMissionTask = {
    intent: MissionTaskIntent;
    completionMode: MissionTaskCompletionMode;
    reviewTarget?: ReviewTarget;
    readiness: MissionTaskReadiness;
  };
  ```

  `normalizeMissionTask` must reject `review_approval` without a target, reject `collaborative_draft` without `manager_draft`, and never inspect title/purpose text to infer intent.

- [ ] **Step 4: Add the fields to both Genesis schemas and readers**

  Require `intent` in the JSON schema. Add optional `reviewTarget` only for continuation output where a persisted artifact already exists. Remove defaulting that silently converts missing completion mode to `result_note`; invalid/missing intent must produce a candidate needing correction rather than an actionable task.

- [ ] **Step 5: Map the contract into the client view model**

  Add `intent`, `readiness`, and optional `reviewTarget` to `MissionTaskViewModel`. Keep legacy fields during migration, but make all new UI decisions use the explicit fields.

- [ ] **Step 6: Run focused tests and commit**

  Run `npm test -- --run src/mission-task-contract.test.ts src/openai-mission-genesis-function.test.ts`. Commit with `feat: define generic mission task contract`.

### Task 2: Add database invariants and a typed review target

**Files:**
- Create: `supabase/migrations/20260906000200_generic_mission_task_contract.sql`
- Modify: `supabase/migrations/20260723000100_manager_intelligence_v1.sql` only if the migration needs a compatibility constraint update
- Create: `supabase/tests/generic_mission_task_contract_smoke.sql`

- [ ] **Step 1: Write the SQL smoke test first**

  The test must insert a `review_approval` task without a target and assert the database rejects it; insert a `human_action` task without a target and assert it succeeds; insert a review target from another workspace and assert it is rejected.

- [ ] **Step 2: Add additive schema columns**

  Add to `public.tasks`:

  ```sql
  task_intent text not null default 'human_action'
    check (task_intent in ('manager_work','human_action','collaborative_draft','review_approval')),
  readiness text not null default 'ready'
    check (readiness in ('preparing','ready','needs_revision','completed','blocked')),
  review_target_id uuid,
  review_target_type text,
  review_target_version_id uuid,
  review_target_status text
  ```

  Keep the existing `approval_state` column as a lifecycle gate; do not use it as task intent.

- [ ] **Step 3: Add a deferred invariant trigger**

  The trigger must enforce:

  ```sql
  if new.task_intent = 'review_approval' then
    require new.review_target_id is not null;
    require new.review_target_type is not null;
    require new.review_target_status = 'ready_for_review';
    require new.approval_state = 'needs_approval';
    require new.readiness = 'ready';
  end if;
  ```

  It must also reject `readiness = 'ready'` for a `review_approval` task unless the target belongs to the same account, workspace, artist, mission, and current plan. Use a service-side RPC to perform the cross-table checks instead of relying on a generic UUID column alone.

- [ ] **Step 4: Add one atomic RPC for artifact-to-review-task activation**

  Create `public.activate_review_task_for_target(...)` that locks the target artifact, verifies its ready status and workspace identity, updates the task with the target/version and `needs_approval`, and records the transition in `task_state_events` in one transaction. Repeated calls with the same task and version must be idempotent.

- [ ] **Step 5: Quarantine existing malformed rows**

  Backfill explicit intent only where existing structured fields prove it. Rows with approval-like semantics but no target must be set to `readiness = 'blocked'` and remain non-actionable; do not classify rows by title regex. Record `state_reason = 'review_target_missing'` in task metadata or the existing event stream.

- [ ] **Step 6: Run the SQL smoke test and commit**

  Run the project’s fresh-database migration test plus `supabase/tests/generic_mission_task_contract_smoke.sql`. Commit with `feat: enforce mission review target invariants`.

### Task 3: Make Mission Genesis generic and artifact-first

**Files:**
- Modify: `supabase/functions/_shared/missionGraphPersistence.ts:312-369,445-457`
- Modify: `supabase/functions/mission-genesis/index.ts`
- Modify: `supabase/functions/_shared/openaiMissionGenesis.ts:382-435,747-879`
- Modify: `supabase/functions/_shared/managerTaskQuality.ts:27-57`
- Test: `src/openai-mission-genesis-function.test.ts`
- Test: `supabase/tests/mission_genesis_review_lifecycle_smoke.sql`

- [ ] **Step 1: Add failing Genesis lifecycle tests**

  Cover these exact cases:

  ```text
  Genesis returns a high-level mission and collaborative draft -> draft is persisted -> review task is activated.
  Genesis returns review_approval without a target -> no actionable task is created.
  Genesis returns two different artist contexts -> mission titles/tasks differ according to context, without template-specific branches.
  A missing optional field cannot silently turn a review task into result_note work.
  ```

- [ ] **Step 2: Update the generation contract**

  Tell the model to return one of the explicit intents, require `manager_draft` for `collaborative_draft`, and forbid `review_approval` until a target ID/version is supplied by the runtime. Keep the prompt high-level: it may describe the artist’s real objective, but it must not contain a list of mission names or title heuristics.

- [ ] **Step 3: Normalize before persistence**

  Call `normalizeMissionTask` for every generated task. On contract failure, return a candidate requiring context and do not persist human-facing tasks. Preserve the existing generic quality checks for steps and responsibilities.

- [ ] **Step 4: Change persistence order**

  Persist Manager work and draft-producing tasks as `preparing`. Do not activate a `review_approval` task in `activateHumanTask`. After the artifact is written and marked `ready_for_review`, call the database RPC from Task 2 to activate the review task.

- [ ] **Step 5: Preserve genericity**

  Remove any new branching on phrases such as “approve,” “thesis,” or “positioning.” The runtime must operate on `task_intent` and the artifact target only.

- [ ] **Step 6: Run focused tests and commit**

  Run the Genesis function tests and SQL lifecycle smoke. Commit with `feat: make mission genesis artifact-first`.

### Task 4: Make Manager draft persistence and review version-safe

**Files:**
- Modify: `supabase/functions/manager-conversation/index.ts:139-166,866-967`
- Modify: `supabase/functions/manager-conversation-stream/index.ts:227-255,1329-1426`
- Modify: `supabase/functions/manager-review-task-result/index.ts:219-270,600-668,847-861`
- Modify: `src/services/productionSupabase.ts:2719-2761,2895-2903,4346-4371,6954-7042`
- Test: `src/manager-draft-review-lifecycle.test.ts`

- [ ] **Step 1: Write failing lifecycle tests**

  Test that a first mission draft is visible before a review task is actionable, that a missing draft cannot be submitted, that a stale draft version cannot be approved, and that a repeated Manager response does not create duplicate current drafts.

- [ ] **Step 2: Make draft creation return a typed target**

  `persistTaskDraftOutput` must return `{ artifactId, versionId, status: 'ready_for_review' }` only after the row is committed. It must update the associated task through the atomic RPC, rather than leaving the task independent.

- [ ] **Step 3: Validate target identity on review**

  `manager-review-task-result` must load the exact target/version from the task and reject a submitted draft that is not the current target, belongs to another workspace, or is not ready. Keep the existing review result/event writes inside the same transaction boundary where possible.

- [ ] **Step 4: Hydrate the typed projection**

  Include `task_intent`, `readiness`, target IDs, and target status in task selects. Replace the optional-only draft interpretation with a projection that distinguishes `preparing`, `ready_for_review`, `needs_revision`, and `accepted`.

- [ ] **Step 5: Run tests and commit**

  Run `npm test -- --run src/manager-draft-review-lifecycle.test.ts src/production-supabase-service.test.ts`. Commit with `feat: make manager drafts version-safe`.

### Task 5: Make the Mission UI fail closed and use human language

**Files:**
- Modify: `src/features/missions/MissionTaskSheet.tsx:130-397`
- Modify: `src/features/missions/MissionWorkSurface.tsx:92-180,297-327`
- Modify: `src/features/missions/missionModel.ts:92-189`
- Modify: `src/types/cleanProduction.ts:432-458`
- Test: `src/mission-task-deliverables.test.tsx`
- Test: `src/mission-task-review-safety.test.tsx`

- [ ] **Step 1: Add failing UI tests**

  Assert that a review task with no target renders “Draft is being prepared” and no Start/Already done/Approve buttons; a ready target renders the draft and “Review draft”; a revision target renders “Work with Manager”; and a normal human action still renders Start.

- [ ] **Step 2: Derive actions from intent/readiness**

  Replace the current title-independent-but-state-incomplete fallback with explicit branches:

  ```ts
  if (task.intent === "review_approval" && task.readiness !== "ready") return preparingState;
  if (task.intent === "review_approval") return reviewState;
  if (task.intent === "collaborative_draft") return draftState;
  return humanActionState;
  ```

  Never expose an action for a missing or mismatched review target.

- [ ] **Step 3: Add a presentation copy layer**

  Use deterministic labels for actions and short generated summaries for explanation. Replace internal headings with artist-facing copy such as “Review your artist direction,” “Check that this sounds like you,” “Approve this direction,” and “Request one change.” Do not render raw `riskIfLate`, `completionMode`, or source-reference language in the primary decision surface.

- [ ] **Step 4: Run UI tests and commit**

  Run the mission UI tests and the production shell tests. Commit with `feat: make mission review UI fail closed`.

### Task 6: Align execution, Today, and reminders with readiness

**Files:**
- Modify: `supabase/functions/manager-task-execution/index.ts:135-165`
- Modify: `supabase/migrations/20260829070300_task_reminder_lifecycle.sql:45-139,151-165`
- Modify: `src/features/desk/todayProjection.ts:200-340`
- Test: `src/manager-today-execution.test.ts`
- Test: `supabase/tests/generic_mission_task_reminder_smoke.sql`

- [ ] **Step 1: Add failing readiness tests**

  A `preparing` or targetless review task must not start, appear as due, or receive a reminder. A ready review task must appear as a review item and be approvable by an authorized owner. Normal human actions must retain current behavior.

- [ ] **Step 2: Enforce readiness in the Edge Function**

  Before starting or completing a task, load `task_intent`, `readiness`, and target state. Return a deterministic conflict response for a task still preparing or whose target is stale.

- [ ] **Step 3: Gate reminders and Today projection**

  Queue reminders only for `readiness = 'ready'` and valid human actions/reviews. Represent preparing work as a Manager status update, not as a user task.

- [ ] **Step 4: Run tests and commit**

  Run the execution and reminder smoke tests. Commit with `fix: align task execution with readiness`.

### Task 7: Full verification, migration evidence, and release

**Files:**
- Modify: `docs/team-release-evidence.md`
- Create: `docs/superpowers/specs/2026-09-06-generic-mission-genesis-architecture.md`

- [ ] **Step 1: Run focused contract and lifecycle tests**

  Run the new TypeScript and SQL tests first. Confirm the negative paths fail closed.

- [ ] **Step 2: Run the complete application checks**

  Run `npm test`, `npm run build`, all changed Edge Function Deno checks, and the existing Solo, Team, Manager conversation, Mission Genesis, task execution, reminder, and mobile suites.

- [ ] **Step 3: Run fresh database and race checks**

  Apply all migrations to a fresh database, run the new smoke tests, and run the existing independent-connection/concurrency tests. Capture exact outputs.

- [ ] **Step 4: Perform browser acceptance checks**

  Verify first mission generation, draft visibility, approval, revision, retry/idempotency, team owner/member permissions, mobile review, and existing billing flows.

- [ ] **Step 5: Update release evidence and deploy one SHA**

  Record the exact commit, migration head, Edge Function versions, frontend deployment, test results, and any quarantined legacy rows. Deploy frontend and functions from the same verified SHA.

- [ ] **Step 6: Mark the goal complete only after evidence is green**

  The completion condition is: generic context-driven Genesis output, no actionable review without a ready target, first mission draft visible before review, fail-closed UI, clean regression suite, fresh DB/race evidence, and matching deployed versions.

---

## Self-review

- The plan covers generation, persistence, artifact lifecycle, UI, execution, reminders, data migration, tests, and deployment.
- No task relies on title regexes or hardcoded mission names.
- Existing Team, billing, and Solo behavior remains covered by regression suites.
- The review target is typed and versioned; generic `artifact_links` remains an audit relationship rather than the workflow authority.
- The missing-draft state is explicitly non-actionable at the database, Edge Function, reminder, and UI layers.
