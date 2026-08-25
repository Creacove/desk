# Manager Live Activity Orb Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the 20px thinking orb and show human, phase-specific Manager activity in the V2 conversation.

**Architecture:** Keep event production unchanged. Interpret run-step labels in the focused `managerRunStatus` module, then render its label and orb state from `ManagerConversationV2`. Replace the fabricated optimistic label at its source.

**Tech Stack:** React, TypeScript, Vitest, thinking-orbs

---

### Task 1: Define the live activity contract

**Files:**
- Modify: `src/features/manager/managerRunStatus.ts`
- Modify: `src/manager-conversation-polish.test.ts`

- [ ] Add failing tests for initial, analysis, search, review, creation, composing, and raw-tool states.
- [ ] Run `node ./node_modules/vitest/vitest.mjs run src/manager-conversation-polish.test.ts --environment jsdom --pool=vmThreads` and confirm the new assertions fail.
- [ ] Add a `managerRunActivity` projection returning `{ label, orbState }`; keep `managerRunStatusLabel` as a compatibility wrapper.
- [ ] Rerun the focused test and confirm it passes.

### Task 2: Restore the orb and remove the fabricated label

**Files:**
- Modify: `src/features/manager/ManagerConversationV2.tsx`
- Modify: `src/app/ProductionApp.tsx`
- Modify: `src/production-app-shell.test.tsx`

- [ ] Add a failing UI test requiring `AppThinkingOrb` with `size={20}`, the projected orb state, and the friendly initial label.
- [ ] Run the exact UI test and confirm it fails because V2 has no orb and ProductionApp emits `Starting Manager run`.
- [ ] Render the existing orb beside the live label and replace all optimistic start labels with `Reviewing your request`.
- [ ] Rerun the exact UI test and focused Manager test suite.

### Task 3: Verify and deliver

**Files:**
- No production files added.

- [ ] Run `npm run build` and confirm exit code 0.
- [ ] Run `git diff --check` and inspect the complete scoped diff.
- [ ] Commit the implementation without touching existing `.playwright-cli` files.
- [ ] Push `main` and verify `HEAD` equals `origin/main`.
