# Beta Entitlement and First Mission Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give active beta workspaces the same protected functions as paid workspaces and route first-mission creation through Manager conversation.

**Architecture:** Repair the final SQL entitlement RPC at the shared authorization boundary, then redeploy all functions that bundle its TypeScript caller. Replace only the user-facing first-mission entry point with the already-supported Manager conversation path, removing obsolete Mission Genesis UI state while retaining backend compatibility.

**Tech Stack:** PostgreSQL/Supabase migrations, Supabase Edge Functions (Deno/TypeScript), React, Vitest, Testing Library.

---

### Task 1: Lock down paid-or-beta entitlement semantics

**Files:**
- Modify: `src/private-beta-access-contract.test.ts`
- Create: `supabase/migrations/20260714000100_restore_paid_or_beta_entitlement_guard.sql`
- Modify: `supabase/functions/_shared/entitlements.ts`

- [x] Expand the protected-function contract list to all 17 callers found by repository audit.
- [x] Add assertions for the final migration's paid branch, active beta branch, date window, `set row_security = off`, and `auth.role() = 'service_role'`.
- [x] Run `npm test -- --run src/private-beta-access-contract.test.ts` and confirm the new migration assertion fails before implementation.
- [x] Add the final SQL RPC definition and paid-or-beta error wording.
- [x] Rerun the focused contract test and confirm it passes.

### Task 2: Route first-mission creation through Manager

**Files:**
- Modify: `src/production-app-shell.test.tsx`
- Modify: `src/app/ProductionApp.tsx`
- Modify: `src/features/missions/MissionScreens.tsx`
- Modify: `src/features/manager/ManagerScreens.tsx`

- [x] Replace the old first-plan test with a regression test that clicks the empty Missions action and expects `manager.sendMessage` with `{ body: "Create the first mission for this workspace." }` while `missionGenesis.runMissionGenesis` remains uncalled.
- [x] Run the focused shell test and confirm it fails against the old workflow.
- [x] Change the empty-state callback and labels to first-mission Manager conversation semantics.
- [x] Remove Mission Genesis result/question/error UI beneath the empty-state action so that it is no longer reachable.
- [x] Rerun the focused shell and component tests and confirm they pass.

### Task 3: Verify and release

**Files:**
- Verify all modified files above.

- [x] Run `npm test` and require zero failures.
- [x] Run `npm run build` and require exit code zero.
- [x] Run `supabase db push --linked` and confirm migration `20260714000100` is remote.
- [x] Deploy all 17 protected Edge Functions because each bundles `_shared/entitlements.ts`.
- [x] Run `supabase functions list --project-ref bbwbxmnanccwottrmkqu` and verify the protected inventory is live.
- [ ] Inspect `git diff`, stage only task files, commit, and push `main` to `origin/main` as explicitly requested.
