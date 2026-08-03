# Minimal Setup and Beta Loading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove unnecessary onboarding copy and give beta activation a clear in-button loading state.

**Architecture:** Preserve the existing setup and paywall components. Change only rendered copy and add one local beta-submission state so the loader describes beta activation specifically rather than every paywall request.

**Tech Stack:** React 18, TypeScript, Lucide React, Vitest, Testing Library.

---

### Task 1: Reduce setup activity copy

**Files:**
- Modify: `src/onboarding-responsive.test.tsx`
- Modify: `src/production-app-shell.test.tsx`
- Modify: `src/features/onboarding/SetupActivityScreen.tsx`

- [ ] Write assertions that active setup shows `Preparing your workspace` and the real stage rows without the Manager/close-page sentence.
- [ ] Run the focused tests and confirm they fail on the existing sentence.
- [ ] Remove the active-state description while retaining failure and ready-state copy.
- [ ] Run the focused tests and confirm they pass.

### Task 2: Make beta activation minimal and visibly active

**Files:**
- Modify: `src/private-beta-ui.test.tsx`
- Modify: `src/features/onboarding/OnboardingScreens.tsx`

- [ ] Add a deferred redemption test that requires a `status` indicator, spinner, and `Activating` label while the promise is pending.
- [ ] Add assertions that the expanded form omits the heading, invitation explanation, and complimentary-access paragraph.
- [ ] Run the beta UI tests and confirm they fail.
- [ ] Add local beta-submission state, a Lucide spinner, shorter labels, and remove the redundant copy.
- [ ] Run the beta and paywall tests and confirm they pass.

### Task 3: Verify and deploy

**Files:**
- All files above.

- [ ] Run the focused onboarding, beta, and paywall test files.
- [ ] Run `npm run build` and `git diff --check`.
- [ ] Commit, push `main`, deploy Netlify production, and confirm the live page serves the new asset.
