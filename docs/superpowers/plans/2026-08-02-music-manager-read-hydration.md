# Music Manager Read Hydration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the last usable Manager Read when opening a song or project without adding bulk document reads or polling.

**Architecture:** Catalog lists retain metadata-only Manager Read state. The room hydrates one selected subject when status says a read exists but the body is absent, using the existing focused-object overlay. The production mapper safely projects legacy saved text into a read card only for the detailed request path.

**Tech Stack:** React, TypeScript, Vitest, existing Supabase production repository.

---

### Task 1: Reproduce selected-room hydration

**Files:**
- Modify: `src/production-app-shell.test.tsx`
- Modify: `src/features/music/MusicScreens.tsx`

- [ ] **Step 1: Write failing room tests**

Add a parameterized test that opens a song and a project with `managerReadStatus: "fresh"` and no `managerRead`. Make `onRefreshObject` return the same subject with a complete read. Assert the read body appears, `No Manager Read yet` does not appear, and `onRefreshObject` is called once.

- [ ] **Step 2: Run the test red**

Run: `npm test -- src/production-app-shell.test.tsx`

Expected: the current room displays the empty state and never calls the focused loader for `fresh` status.

- [ ] **Step 3: Implement one focused hydration trigger**

Replace the `unknown`-only room-open effect in `src/features/music/MusicScreens.tsx` with a helper that returns true only when a selected object lacks a `managerRead` and status is `unknown`, `fresh`, `stale`, `refreshing`, or `refresh_failed`. Use a subject-and-revision guard so a failed/inconclusive focused request is not repeated until server state changes.

- [ ] **Step 4: Run the room test green**

Run: `npm test -- src/production-app-shell.test.tsx`

Expected: both song and project read bodies render after exactly one focused load.

### Task 2: Render durable legacy Manager text

**Files:**
- Modify: `src/production-supabase-service.test.ts`
- Modify: `src/services/productionSupabase.ts`

- [ ] **Step 1: Write a failing legacy-output mapper assertion**

Change the existing `legacy current output` case to expect `hasRead: true` and assert the projected body is `Legacy copy` while its metrics list is empty.

- [ ] **Step 2: Run the service test red**

Run: `npm test -- src/production-supabase-service.test.ts`

Expected: the legacy row is still classified stale but provides no `managerRead` body.

- [ ] **Step 3: Implement a bounded legacy projection**

Extend the detailed-output parser to accept only a non-empty `render_json.managerRead` string from non-v2 output. Return a compatibility read with that body, a clear prior-read label, empty metrics, and no invented evidence. Keep v2 parsing strict.

- [ ] **Step 4: Run the service test green**

Run: `npm test -- src/production-supabase-service.test.ts`

Expected: legacy text displays only when it is present and valid; malformed legacy output remains unavailable.

### Task 3: Verify and commit the focused patch

**Files:**
- Modify: `src/production-app-shell.test.tsx`
- Modify: `src/production-supabase-service.test.ts`
- Modify: `src/features/music/MusicScreens.tsx`
- Modify: `src/services/productionSupabase.ts`

- [ ] **Step 1: Run focused regression checks**

Run: `npm test -- src/production-app-shell.test.tsx src/production-supabase-service.test.ts`

Expected: room hydration, refresh preservation, and repository mapping all pass.

- [ ] **Step 2: Run production build**

Run: `npm run build`

Expected: the production bundle builds successfully.

- [ ] **Step 3: Commit**

```bash
git add src/production-app-shell.test.tsx src/production-supabase-service.test.ts src/features/music/MusicScreens.tsx src/services/productionSupabase.ts
git commit -m "fix: hydrate existing music manager reads"
```
