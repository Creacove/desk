# Video One CTO Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair every verified Video One release blocker and prove the complete 14-day release workflow is safe, durable, observable, and preview-ready.

**Architecture:** Preserve the existing Release Success architecture and correct contracts at their source. Database transactions remain authoritative for approval, schedule binding, and canonical documents; Manager and UI layers only render and invoke those durable contracts. Every correction is test-first and independently committed.

**Tech Stack:** React 18, TypeScript, Vitest, Supabase/Postgres/Edge Functions, OpenAI Responses tools, Vite, Netlify.

---

### Task 1: Proposal and approval identity contract

**Files:**
- Modify: `src/release-plan-change-function.test.ts`
- Modify: `src/release-success-conversation.test.tsx`
- Modify: `supabase/functions/manager-conversation-stream/index.ts`
- Modify: `src/types/cleanProduction.ts`
- Modify: `src/app/ProductionApp.tsx`
- Modify: `supabase/migrations/20260812000100_release_success_foundation.sql`

- [ ] Add failing tests proving SQL-shaped `requestId` reaches the approval button and approval reuses the proposal idempotency key.
- [ ] Run the focused tests and confirm the expected failures.
- [ ] Normalize the proposal contract and persist/expose the immutable proposal idempotency key.
- [ ] Run focused tests and confirm green.
- [ ] Commit only this correction.

### Task 2: Schedule-binding lifecycle safety

**Files:**
- Modify: `src/release-success-rpc-contract.test.ts`
- Modify: `src/release-success-schedule.test.ts`
- Modify: `supabase/migrations/20260812000100_release_success_foundation.sql`

- [ ] Add failing tests for key removal, invalid key, mission change, status deactivation, and offset update.
- [ ] Run tests and confirm expected failures.
- [ ] Make the binding trigger deactivate stale rows and upsert valid current bindings.
- [ ] Run focused schedule/RPC tests and confirm green.
- [ ] Commit only this correction.

### Task 3: Durable approval receipt hydration

**Files:**
- Modify: `src/production-supabase-service.test.ts`
- Modify: `src/release-success-conversation.test.tsx`
- Modify: `src/services/productionSupabase.ts`
- Modify: `src/services/managerConversationStream.ts`

- [ ] Add a failing refresh test proving an approved request hydrates `state: applied` with its persisted receipt.
- [ ] Run it and confirm the old awaiting-approval state fails.
- [ ] Load scoped release requests and merge authoritative receipt state during conversation hydration.
- [ ] Run focused service/UI tests and confirm green.
- [ ] Commit only this correction.

### Task 4: Verifiable public-contact provenance

**Files:**
- Modify: `src/release-opportunities.test.ts`
- Modify: `supabase/functions/_shared/release-success/opportunities.ts`
- Modify: `supabase/functions/_shared/manager-conversation/toolExecutor.ts`

- [ ] Add failing tests for fabricated email, unrelated URL, unreachable source, matching email, matching form URL, and Spotify editorial separation.
- [ ] Run tests and confirm expected failures.
- [ ] Inspect cited public sources server-side and downgrade unproven contacts to non-actionable records with limitations.
- [ ] Run focused opportunity tests and confirm green.
- [ ] Commit only this correction.

### Task 5: Atomic canonical documents and opportunity linkage

**Files:**
- Modify: `src/release-success-documents.test.tsx`
- Modify: `src/release-opportunities.test.ts`
- Modify: `supabase/functions/_shared/songDocumentDraft.ts`
- Modify: `supabase/functions/_shared/manager-conversation/toolExecutor.ts`
- Add: `supabase/migrations/20260813000100_release_document_persistence.sql`

- [ ] Add failing tests proving atomic creation, canonical release-mission selection, rollback, and `pitch_document_id` linkage.
- [ ] Run focused tests and confirm expected failures.
- [ ] Add one scoped transaction RPC and route Manager document creation through it.
- [ ] Link prepared target pitches to the exact opportunity.
- [ ] Run focused tests and confirm green.
- [ ] Commit only this correction.

### Task 6: Intent-scoped Manager tools

**Files:**
- Modify: `src/manager-agent-loop.test.ts`
- Modify: `src/release-success-manager-tools.test.ts`
- Modify: `supabase/functions/_shared/manager-conversation/agentLoop.ts`
- Modify: `supabase/functions/manager-conversation-stream/index.ts`

- [ ] Add failing tests proving unrelated conversations receive no release mutation tools and valid release turns receive the minimal required set.
- [ ] Run tests and confirm expected failures.
- [ ] Build tools from validated subject and intent instead of supplying one global mutation list.
- [ ] Run focused Manager tests and confirm green.
- [ ] Commit only this correction.

### Task 7: Boundary telemetry and UI fidelity

**Files:**
- Modify: `src/app-error-high-fidelity-contract.test.ts`
- Modify: `src/release-success-conversation.test.tsx`
- Modify: `src/app/ProductionApp.tsx`
- Modify: `src/features/manager/ReleaseSuccessArtifact.tsx`
- Modify: relevant Edge boundaries under `supabase/functions/**`

- [ ] Add failing tests that inspect real telemetry calls at each required boundary and scan rendered/source text for encoding corruption.
- [ ] Run tests and confirm expected failures.
- [ ] Emit correlated existing telemetry at the real boundaries and replace corrupted text.
- [ ] Run focused telemetry/UI tests and confirm green.
- [ ] Commit only this correction.

### Task 8: Edge type safety

**Files:**
- Modify only files identified by Deno diagnostics.

- [ ] Run Deno checks and record every diagnostic.
- [ ] Add or strengthen type-level/runtime tests where a diagnostic exposes behavior risk.
- [ ] Fix diagnostics without broad refactors or weakened types.
- [ ] Re-run all touched Edge checks until zero errors.
- [ ] Commit only type-safety corrections.

### Task 9: Automated release gates

- [ ] Run all Video One focused suites.
- [ ] Run all cross-Hub regression suites.
- [ ] Run the complete Vitest suite with required safe environment configuration.
- [ ] Run the production Vite build.
- [ ] Run `git diff --check`, prohibited-scope scans, and worktree inspection.
- [ ] Stop immediately on any failure and return to the owning task.

### Task 10: Production-like acceptance and preview

- [ ] Apply migrations and deploy Edge functions only to an isolated/local preview backend.
- [ ] Execute “I want to release this song in 14 days” from an attached unreleased song.
- [ ] Capture song, mission, request, receipt revision, moved/preserved task, document, opportunity, share-link, trace, and error-event identifiers.
- [ ] Refresh/reopen and prove receipt, mission, Files, and opportunity state persist.
- [ ] Exercise controlled failures and verify centralized telemetry correlation and scrubbing.
- [ ] Deploy the reviewed frontend to a preview URL backed by the verified preview backend.
- [ ] Independently review the final diff and resolve every critical/important finding.
- [ ] Provide the URL and CTO handback. Do not merge or deploy production.
