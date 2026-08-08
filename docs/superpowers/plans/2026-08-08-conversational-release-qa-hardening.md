# Conversational Release QA Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the production QA gaps in the chat-created song release handoff without changing the approved release architecture.

**Architecture:** Preserve the atomic Supabase command. Enrich the lightweight mission list with only the task rows required for accurate summaries, pass an explicit song-room destination through the existing artifact callback, opt the Manager conversation out of forced heading punctuation, and repair mojibake through an ASCII-only migration.

**Tech Stack:** React, TypeScript, Vitest, Supabase/PostgreSQL, Deno Edge Functions, Netlify, Chrome browser QA.

---

### Task 1: Accurate mission summaries

**Files:**
- Modify: `src/services/productionSupabase.ts`
- Test: `src/production-supabase-service.test.ts`

- [ ] Add a failing repository test proving `loadMissionList()` requests task rows and returns the open task as `nextTask`.
- [ ] Run the focused test and confirm it fails because mission-list rows currently omit tasks.
- [ ] Load minimal task fields for the returned mission IDs and map those rows through `missionFromRow`.
- [ ] Re-run the focused test and confirm it passes.

### Task 2: Direct Files handoff and clean conversation heading

**Files:**
- Modify: `src/app/ProductionApp.tsx`
- Modify: `src/features/manager/ManagerScreens.tsx`
- Modify: `src/features/music/MusicScreens.tsx`
- Modify: `src/design-system/components.tsx`
- Test: `src/production-app-shell.test.tsx`

- [ ] Add failing UI tests proving the release receipt says `Add files`, opens the song room on Files, the persistent subject opens Overview, and the conversation heading has no forced period.
- [ ] Run the focused tests and confirm the old label, Overview destination, and punctuation fail.
- [ ] Add an optional song-room target tab to the existing music navigation and use it only for the release receipt.
- [ ] Add an optional `punctuateTitle` prop to `WorkspaceShell` and disable it only for Manager conversations.
- [ ] Re-run the focused tests and confirm they pass.

### Task 3: Encoding-safe production repair

**Files:**
- Create: `supabase/migrations/20260808000200_conversational_release_qa_hardening.sql`
- Test: `src/conversational-song-workspace-contract.test.ts`

- [ ] Add a failing migration contract test for an ASCII-only `pg_get_functiondef` repair and persisted-topic repair.
- [ ] Run the focused contract test and confirm the migration is missing.
- [ ] Add the migration using `chr(226) || chr(8364) || chr(8221)` for the corrupt sequence and `chr(8212)` for the correct em dash.
- [ ] Re-run the contract test and Deno checks.

### Task 4: Release and production QA

**Files:**
- Verify all modified files.

- [ ] Run focused tests, then the full Vitest suite with the required test environment values.
- [ ] Run `npm run build`, both Manager Deno checks, and `git diff --check`.
- [ ] Commit and push `main`.
- [ ] Apply and verify the Supabase migration, redeploy both Manager functions, and deploy Netlify production.
- [ ] Use the logged-in Chrome tab to verify desktop and mobile Files routing, mission summaries after reload, clean title rendering, and repeat-message idempotency.
- [ ] Delete only the exact controlled QA song, mission, task, conversation links/messages, and related events created during this QA pass, then verify they are absent.
