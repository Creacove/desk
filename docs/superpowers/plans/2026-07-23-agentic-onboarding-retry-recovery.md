# Agentic Onboarding Retry Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make partial discovery complete with limitations and make Retry setup recover the actual failed stage without repurchasing successful Chartmetric enrichment.

**Architecture:** Add one pure discovery-result classifier to the existing discovery tools and use it inside the discovery function. Correct retry routing, atomically claim failed discovery before dispatch, and allow explicit recovery to reuse stored successful snapshots regardless of age while normal refreshes retain the 24-hour freshness rule.

**Tech Stack:** TypeScript, Supabase Edge Functions, Vitest

---

### Task 1: Classify partial discovery safely

**Files:**
- Modify: `supabase/functions/_shared/manager-agent/discoveryTools.ts`
- Modify: `supabase/functions/manager-artist-discovery/index.ts`
- Test: `src/manager-artist-discovery-function.test.ts`

- [x] Add failing behavioral tests for all-success, partial-success, zero-asset-success, and missing-artist cases.
- [x] Run `npm test -- src/manager-artist-discovery-function.test.ts` and confirm the classifier contract fails.
- [x] Implement a pure classifier where `completed` and `cached` count as success, `unresolved` counts as a limitation, artist intelligence remains mandatory, and catalogs with assets require at least one successful focus asset.
- [x] Replace the broad `assetResults.some(unresolved)` assertion with the classifier.
- [x] Include unresolved results in the limited completion event, setup-stage state, and response.
- [x] Run `npm test -- src/manager-artist-discovery-function.test.ts` and confirm it passes.

### Task 2: Route and claim retry correctly

**Files:**
- Modify: `supabase/functions/billing-status/index.ts`
- Modify: `supabase/functions/paid-workspace-setup/index.ts`
- Test: `src/paid-workspace-setup-function.test.ts`

- [x] Add failing regression assertions requiring retry selection from `stage_status.manager_discovery` before `current_stage`.
- [x] Add a failing regression assertion requiring an atomic failed-to-running claim before retry dispatch.
- [x] Run `npm test -- src/paid-workspace-setup-function.test.ts` and confirm the new assertions fail.
- [x] Load `stage_status` in billing status and select discovery whenever manager discovery failed.
- [x] Atomically claim a failed discovery stage before dispatch so repeated button presses cannot launch concurrent runs.
- [x] Preserve the existing running/completed short circuits.
- [x] Reuse stored successful snapshots during explicit recovery without changing normal cache freshness.
- [x] Run `npm test -- src/paid-workspace-setup-function.test.ts` and confirm it passes.

### Task 3: Verify and commit the hotfix

**Files:**
- Verify only the files listed above plus this plan.

- [x] Run the focused discovery/setup tests.
- [x] Run the complete test suite with `npm test`; focused hotfix tests pass, while five unrelated suites are blocked by the pre-existing syntax error in `src/services/productionSupabase.ts:217`.
- [x] Run the production build with `npm run build`; it reaches the same unrelated pre-existing syntax error in `src/services/productionSupabase.ts:217`.
- [x] Run `deno check` for all three affected Edge Function entry points.
- [x] Review `git diff --check` and confirm no unrelated files are included in the hotfix scope.
- [x] Commit only the plan, classifier, affected functions, and tests with `fix: make onboarding retry recover partial discovery`.
