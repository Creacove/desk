# Today Approval Surface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the decorative Today approval treatment with a compact integrated action surface and correct Activity badge spacing.

**Architecture:** Keep the current React behavior and data flow. Change only the component classes and Desk Home CSS, protected by source/DOM visual contracts.

**Tech Stack:** React, TypeScript, CSS, Vitest, Testing Library.

---

### Task 1: Lock the visual contract

**Files:**
- Modify: `src/desk-home-visual-contract.test.ts`
- Modify: `src/desk-hq-editorial.test.tsx`

- [ ] Assert that the surface has no left accent inset, the expanded approval uses the integrated class, and Activity uses an explicit gap.
- [ ] Run the focused tests and confirm they fail on the current implementation.

### Task 2: Implement the integrated surface

**Files:**
- Modify: `src/features/desk/TodayRuntimeExecution.tsx`
- Modify: `src/features/desk/deskHome.css`
- Modify: `src/features/desk/DeskHQ.tsx`

- [ ] Remove the accent/tint styling and nested approval card classes.
- [ ] Add restrained integrated expansion styles for desktop, mobile, dark mode, and reduced motion.
- [ ] Add spacing between Activity and its unread badge.
- [ ] Run focused tests until green.

### Task 3: Verify and ship

**Files:**
- Verify all modified files.

- [ ] Run the complete test suite, production build, and `git diff --check`.
- [ ] Commit on `main`, push `origin/main`, and confirm the production deployment is Ready.
