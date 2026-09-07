# Task Contract Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align Task generation with validation, simplify Task actions, eliminate duplicate evidence writes, and integrate the valid billing fixes without regressing Team billing.

**Architecture:** A shared Task contract supplies prompt text and validation constants. Model-produced optional continuations are filtered at their boundary, while mission persistence stays atomic. UI labels reflect durable task state without changing the underlying execution API.

**Tech Stack:** TypeScript, React, Supabase Edge Functions, Vitest.

---

### Task 1: Shared Task contract parity

**Files:**
- Modify: `supabase/functions/_shared/managerHumanTaskGenerationContract.ts`
- Modify: `supabase/functions/_shared/managerTaskQuality.ts`
- Modify: `supabase/functions/_shared/openaiManagerConversationLegacy.ts`
- Modify: `supabase/functions/manager-review-task-result/index.ts`
- Test: `src/manager-task-quality.test.ts`
- Test: `src/openai-manager-conversation-function.test.ts`
- Test: `src/manager-review-task-result-function.test.ts`

- [ ] Add failing tests asserting the prompt, both JSON schemas, normalizers, and validator all require three steps.
- [ ] Run `npm test -- --run src/manager-task-quality.test.ts src/openai-manager-conversation-function.test.ts src/manager-review-task-result-function.test.ts`; expect the new parity assertions to fail on the current two-step values.
- [ ] Export `MIN_HUMAN_TASK_STEPS = 3`, render it in the compact shared instruction, and use it in validation and schema `minItems` values.
- [ ] Run the focused command again; expect all tests to pass.
- [ ] Commit with `fix: align task prompts and validation`.

### Task 2: Prevent impossible mission Tasks

**Files:**
- Modify: `supabase/functions/_shared/openaiManagerConversationLegacy.ts`
- Modify: `supabase/functions/_shared/missionGraphPersistence.ts`
- Test: `src/openai-manager-conversation-function.test.ts`
- Test: `src/mission-genesis-persistence-contract.test.ts`

- [ ] Add failing tests proving model mission Tasks cannot emit `manager_work` or `review_approval`, and that `human_action`/`collaborative_draft` remain valid.
- [ ] Run the two focused test files; expect the impossible-intent assertions to fail.
- [ ] Restrict the mission Task schema and normalizer to the two model-valid intents; preserve runtime-created review Tasks and Manager checkpoint reads.
- [ ] Run the focused tests; expect all to pass.
- [ ] Commit with `fix: keep impossible work out of mission tasks`.

### Task 3: Isolate invalid review follow-ups

**Files:**
- Modify: `supabase/functions/manager-review-task-result/index.ts`
- Test: `src/manager-review-task-result-function.test.ts`

- [ ] Add failing tests for the two production cases: a two-step continuation and a Manager/system-facing continuation.
- [ ] Run the test file; expect failure because optional invalid follow-ups currently abort review.
- [ ] Validate follow-ups before persistence, retain valid human Tasks, omit invalid or Manager-owned Tasks, and append a bounded limitation without failing the primary review.
- [ ] Run the test file; expect all tests to pass.
- [ ] Commit with `fix: isolate invalid review followups`.

### Task 4: Clarify Task actions

**Files:**
- Modify: `src/features/missions/MissionTaskSheet.tsx`
- Modify: `src/features/missions/missionModel.ts`
- Test: `src/mission-task-review-safety.test.tsx`

- [ ] Add failing UI tests for `Start task`, `Finish task`, `Continue task`, `Do later`, `Change timing`, Manager preparation, review, and completed states.
- [ ] Run the UI test; expect current `Start`, `Done`, and `Move it` labels to fail.
- [ ] Centralize state-aware labels in `missionModel.ts` and replace the ambiguous Task-sheet copy without changing mutation endpoints.
- [ ] Run the UI test; expect all states to pass.
- [ ] Commit with `fix: clarify task lifecycle actions`.

### Task 5: Deduplicate Chartmetric evidence

**Files:**
- Modify: `supabase/functions/chartmetric-track-enrichment/index.ts`
- Test: `src/chartmetric-track-enrichment-function.test.ts`

- [ ] Add a failing regression test with duplicate evidence identity fields in one provider batch.
- [ ] Run the test file; expect the duplicate-write assertion to fail.
- [ ] Deduplicate rows before insert using sync job, evidence type, subject type/id, metric name, and raw reference; retain existing replay handling.
- [ ] Run the test file; expect it to pass.
- [ ] Commit with `fix: deduplicate chartmetric evidence`.

### Task 6: Reconcile billing recovery

**Files:**
- Modify: `supabase/functions/paddle-process-webhooks/index.ts`
- Modify: `supabase/functions/paid-workspace-setup/index.ts`
- Test: `src/paddle-backend-contract.test.ts`
- Test: `src/paid-workspace-setup-function.test.ts`

- [ ] Add failing tests for replay dispatch and explicit relationship selection while asserting Team-plan reconciliation remains present.
- [ ] Run both tests; expect only the missing recovery behavior to fail.
- [ ] Apply the minimal replay and relationship changes from `codex/billing-recovery-20260907`; do not replace the updated `origin/main` functions.
- [ ] Run both tests; expect all to pass.
- [ ] Commit with `fix: reconcile billing recovery safeguards`.

### Task 7: Verify and prepare deployment

**Files:**
- Modify: `.deploy-bundles/manager-conversation.ts`
- Modify: `.deploy-bundles/manager-conversation-stream.ts`
- Modify: `.deploy-bundles/manifest.txt`

- [ ] Run all focused test files from Tasks 1–6; expect zero failures.
- [ ] Run `npm test`; expect the full suite to pass.
- [ ] Run `npm run build`; expect a successful production build.
- [ ] Regenerate the Manager deploy bundles with the repository's existing bundle command and verify the manifest.
- [ ] Confirm `git diff --check` and `git status --short` show only intended files.
- [ ] Commit with `chore: prepare task reliability deploy bundles`.

### Task 8: Merge and production verification

**Files:**
- No source changes expected.

- [ ] Fast-forward `main` to the verified feature branch and confirm `main` and `origin/main` share the expected baseline before push.
- [ ] Deploy the two Manager conversation functions, Manager task-result review, Chartmetric enrichment, Paddle webhook processing, and paid workspace setup.
- [ ] Retry the exact failed Manager request, a Task result that produces follow-up work, and a duplicate Chartmetric job.
- [ ] Query `app_error_events` for the three prior fingerprints and confirm no new occurrences.
