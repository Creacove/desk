# Task Completion and Progress Clarity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make task completion explicit and immediately visible, present Manager drafts as readable documents, and reduce checkpoints to a focused single-column progress view.

**Architecture:** Keep completion state and callbacks in `TasksPanel`; move its confirmation UI into a single accessible dialog so it cannot be hidden by task details. Keep the existing checkpoint information and task routing, but render it through one responsive accordion rather than separate desktop and mobile information architectures. Reuse a small local markdown-document renderer only for saved Manager drafts; it will not alter streaming chat rendering.

**Tech Stack:** React, TypeScript, Tailwind CSS, Vitest, Testing Library.

---

### Task 1: Visible task-completion decision

**Files:**
- Modify: `src/mission-task-deliverables.test.tsx`
- Modify: `src/features/missions/MissionScreens.tsx`

- [ ] **Step 1: Write the failing interaction test**

Add a test that renders `missionWithRequiredThesis()`, clicks `Mark done`, and asserts that a `role="dialog"` named `Mark “Provide 90-day thesis” as done` is visible, contains the `Task result note` input, and contains `Confirm done`. Assert the old `task-completion-panel-task-thesis` is absent.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- src/mission-task-deliverables.test.tsx`

Expected: FAIL because task completion still renders an inline `task-completion-panel-*` section and no dialog exists.

- [ ] **Step 3: Implement the minimum completion dialog**

In `TasksPanel`, retain `completionNote` as the single source of draft completion state. Replace the inline confirmation block with a `TaskCompletionDialog` rendered once beside the panel. Give it `role="dialog"`, `aria-modal="true"`, an exact task-specific heading, auto-focus the textarea with `useEffect`, and preserve existing `onCompleteTask(taskId, status, note, deliverableIds, managerDraftId)` arguments. Use exact action labels: `Confirm done`, `Submit for review`, and `Report blocker` where the state requires them.

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `npm test -- src/mission-task-deliverables.test.tsx`

Expected: PASS.

### Task 2: Task information hierarchy and readable Manager draft

**Files:**
- Modify: `src/mission-task-deliverables.test.tsx`
- Modify: `src/features/missions/MissionScreens.tsx`

- [ ] **Step 1: Write failing presentation tests**

Add a Manager-draft fixture with `## Position`, `**Lagos**`, and a two-item markdown list. Assert the task card has a `Current Manager draft` document section with a rendered heading and bold text, does not display literal `##` or `**`, and no longer renders the duplicate `Task 1` label.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- src/mission-task-deliverables.test.tsx`

Expected: FAIL because `TaskDetails` prints saved draft content using `whitespace-pre-wrap` and the duplicate task ordinal remains.

- [ ] **Step 3: Implement the minimum document treatment**

In `TaskDetails`, retain outcome, deliverable requirements, saved draft, and result; remove default Manager/artist responsibility copy and late-risk copy. Replace the draft’s plain paragraph with a small `TaskDraftDocument` renderer that supports headings, unordered lists, ordered lists, horizontal rules, and inline bold. Keep content as text nodes—never HTML injection. Remove the duplicate `Task {n}` visual label while retaining the numbered step icon for navigation.

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `npm test -- src/mission-task-deliverables.test.tsx`

Expected: PASS.

### Task 3: Single responsive Progress view

**Files:**
- Modify: `src/mission-workspace-simplification.test.tsx`
- Modify: `src/features/missions/MissionScreens.tsx`

- [ ] **Step 1: Write the failing view test**

Replace the desktop-master-detail expectation with assertions that `checkpoint-accordion` is available at every viewport, `checkpoint-workspace-grid` is absent, collapsed phase rows do not list task titles, and expanding a phase shows the success condition, its decisive Manager state, and a `View tasks` action.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- src/mission-workspace-simplification.test.tsx`

Expected: FAIL because the desktop master-detail grid remains and collapsed rows expose task lists.

- [ ] **Step 3: Implement the minimum single-column progression**

Replace the desktop `CheckpointInspector` / ledger grid with the existing accordion as the one responsive layout. Collapsed rows show phase number, title, status, and task count only. An expanded row shows the checkpoint question as `Success condition`, the meaningful recommendation or result once, then either blocker/unlock state and a `View tasks` button. Route that button through the existing task-tab selection callback; do not add fetches, polling, or new persistence.

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `npm test -- src/mission-workspace-simplification.test.tsx`

Expected: PASS.

### Task 4: Verify the integrated mission room

**Files:**
- Modify: `docs/production-stabilization-issues.md` only if a new discovered issue needs recording.

- [ ] **Step 1: Run the targeted task and mission suites**

Run: `npm test -- src/mission-task-deliverables.test.tsx src/mission-workspace-simplification.test.tsx src/production-app-shell.test.tsx`

Expected: PASS.

- [ ] **Step 2: Run production checks**

Run: `npm run build`

Expected: exits 0. This repository intentionally has no `lint` script.

- [ ] **Step 3: Review the patch before commit**

Run: `git diff --check && git diff -- src/features/missions/MissionScreens.tsx src/mission-task-deliverables.test.tsx src/mission-workspace-simplification.test.tsx`

Expected: no whitespace errors and only the planned focused changes.

- [ ] **Step 4: Commit the verified change**

Run: `git add src/features/missions/MissionScreens.tsx src/mission-task-deliverables.test.tsx src/mission-workspace-simplification.test.tsx docs/superpowers/plans/2026-08-02-task-completion-and-progress-clarity.md && git commit -m "feat: clarify mission task completion"
