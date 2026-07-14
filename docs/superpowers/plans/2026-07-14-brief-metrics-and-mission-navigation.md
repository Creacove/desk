# Brief Metrics and Mission Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce concise, correctly labelled Today's Brief metrics and prevent the populated Missions page from submitting the first-mission prompt.

**Architecture:** Normalize generated metric labels and values before persistence, then apply the same client-side compatibility normalizer while reading historical briefs. Split the Missions callbacks so empty and populated states cannot trigger the same action accidentally.

**Tech Stack:** TypeScript, Supabase Edge Functions, React, Vitest, Testing Library.

---

### Task 1: Normalize generated and saved brief metrics

**Files:**
- Modify: `src/openai-todays-brief-function.test.ts`
- Modify: `src/production-supabase-service.test.ts`
- Modify: `supabase/functions/_shared/openaiTodaysBrief.ts`
- Modify: `supabase/functions/generate-todays-brief/index.ts`
- Modify: `src/services/productionSupabase.ts`

- [x] Add a server contract test that expects readable fallback labels and whole-number/compact-number formatting.
- [ ] Add a client mapper test with `97.8864321`, `2451.873`, and duplicate `2.1M` label/value input.
- [ ] Run both focused tests and confirm failures are caused by unnormalized values and labels.
- [ ] Add pure server metric normalization and apply it before persistence.
- [ ] Normalize saved metric strings in `readBriefMetrics`, using context and group title as label fallbacks.
- [ ] Rerun both focused tests and confirm they pass.

### Task 2: Separate first-mission creation from Manager navigation

**Files:**
- Modify: `src/production-app-shell.test.tsx`
- Modify: `src/features/missions/MissionScreens.tsx`
- Modify: `src/app/ProductionApp.tsx`
- Modify: `src/mission-workspace-simplification.test.tsx`
- Modify: `src/mission-task-deliverables.test.tsx`

- [ ] Add a populated-Missions regression test that clicks `Talk to Manager`, expects Manager Office, and verifies no Manager message method was called.
- [ ] Run the focused test and confirm it fails by submitting the first-mission directive.
- [ ] Add `onOpenManager` to `MissionsWorkspace` and reserve `onCreateFirstMission` for the empty state.
- [ ] Wire `onOpenManager` to `navigate("managerOffice")` in `ProductionApp` and update component fixtures.
- [ ] Rerun the focused shell and mission component tests and confirm they pass.

### Task 3: Verify the complete change

**Files:**
- Verify all files above.

- [ ] Run `npm test` and require zero failures.
- [ ] Run `npm run build` and require exit code zero.
- [ ] Run `git diff --check` and inspect the final scoped diff.
