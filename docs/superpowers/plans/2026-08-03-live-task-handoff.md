# Live task handoff and review submission plan

> **Execution:** Proceeding in the current worktree on `main` with the user's explicit approval.

## Goal

Make newly-created Manager drafts and reviews visible when an artist opens the attached task, without a browser reload. When a task is submitted for review, close the note dialog immediately and move the waiting state into the task card.

## Task 1: Refresh the exact mission behind Manager artifacts

**Files:**
- Modify: `src/services/managerConversationStream.ts`
- Modify: `src/app/ProductionApp.tsx`
- Test: `src/manager-conversation-stream.test.ts`
- Test: `src/production-app-shell.test.tsx`

1. Add focused tests proving a Manager refresh hint invalidates each referenced mission and that opening an attached task forces a fresh mission detail load before its room is shown.
2. Run the focused tests to record the expected failure.
3. Convert `missionIds` in the Manager refresh hint to exact mission invalidations, while retaining list invalidation.
4. Make `openCreatedWork` await `hydrateMission(targetMissionId, true)` before navigating to a task room.
5. Re-run the focused tests.

## Task 2: Move Manager-review waiting state into its task card

**Files:**
- Modify: `src/features/missions/MissionScreens.tsx`
- Test: `src/mission-task-deliverables.test.tsx`

1. Add a UI regression test proving review submission dismisses the dialog immediately and exposes a non-blocking review state in the submitted task card.
2. Run it to record the expected failure.
3. Replace dialog-level pending state with per-task review state and per-task inline errors.
4. Close the dialog before awaiting the Manager review request; preserve validation errors in the dialog and provide an inline retry path after request errors.
5. Re-run the focused test.

## Task 3: Integrate and verify

1. Run all affected tests together.
2. Run the production build.
3. Inspect the diff to ensure only this request's changes are staged; preserve the pre-existing `deno.lock` edit.
4. Commit and push to `origin/main` as requested.
