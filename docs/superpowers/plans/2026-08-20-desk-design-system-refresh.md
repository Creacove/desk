# Desk Design System Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the authenticated artist desk feel like one internationally designed product by replacing inconsistent Home Manager's Read geometry and normalizing the highest-visibility shared layout patterns.

**Architecture:** Keep the existing React and Tailwind architecture. First reshape Home Manager's Read into a reusable centered briefing rail with stable row geometry. Then normalize the shared app container, headings, actions, loading states, and mobile information hierarchy in the existing feature components. Preserve routes, data, navigation, content, and brand assets.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS 3, Vitest, Testing Library, Radix Dialog.

---

### Task 1: Replace the Home Manager's Read grid with a centered briefing rail

**Files:**
- Modify: `src/features/desk/DeskHQ.tsx:315-370`
- Test: `src/desk-hq-editorial.test.tsx`

- [ ] **Step 1: Add a failing layout-contract test**

Extend the Home Manager's Read test coverage to render four read segments and assert that the section uses a centered capped rail, that all four segments use the same padding contract, and that no segment class contains the old `first:pl-0` exception. The assertion should inspect `desk-manager-read-grid` and all `desk-manager-read-segment` elements.

- [ ] **Step 2: Run the focused test and verify it fails for the missing rail contract**

Run: `npm test -- src/desk-hq-editorial.test.tsx`

Expected: the new layout-contract assertion fails because the current grid is full width and the first segment still has the index-specific padding class.

- [ ] **Step 3: Implement the briefing rail**

Change `ManagerRead` so the section header and content share a centered `max-w-[1120px]` container. Replace the two-by-two grid with a single ordered rail. Each row should use a stable metadata column for the number and label, a readable body column, identical desktop and mobile padding, and a divider between rows. Remove `managerReadCellClass` and the `lg:first:pl-0` exception. Keep the existing `segments` data, Evidence action, labels, and body copy unchanged.

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `npm test -- src/desk-hq-editorial.test.tsx`

Expected: all Home editorial tests pass, including the new centered-rail and equal-padding assertions.

- [ ] **Step 5: Commit the focused component change**

Run: `git add src/features/desk/DeskHQ.tsx src/desk-hq-editorial.test.tsx && git commit -m "refactor: give Manager read a consistent briefing rail"`

### Task 2: Establish shared desk width and typography hooks

**Files:**
- Modify: `src/app/ProductionApp.tsx:2161-2174`
- Modify: `src/design-system/desktop-premium.css`
- Test: `src/desktop-workspace-width.test.ts`

- [ ] **Step 1: Add a failing shell-width contract**

Add a test that reads the production shell source and verifies that the workspace has one primary content cap and that the main content area exposes a shared reading-width utility or token instead of relying only on page-local caps.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- src/desktop-workspace-width.test.ts`

Expected: the new contract fails against the current unconstrained main shell.

- [ ] **Step 3: Add the smallest shared layout contract**

Add CSS variables or utility classes for the primary desk content cap, reading measure, and form measure. Apply the primary cap to the authenticated workspace main content without changing the sidebar width or mobile navigation. Preserve full-width structural rows by allowing feature sections to opt into the cap explicitly.

- [ ] **Step 4: Normalize the shared body and heading hooks**

Use the existing Manrope family and add named classes for page title, section title, readable body, metadata, and eyebrow text. Replace only the highest-visibility local values touched by this pass. Do not introduce a new font, gradient, or decorative visual treatment.

- [ ] **Step 5: Run focused and shell tests**

Run: `npm test -- src/desktop-workspace-width.test.ts src/desk-hq-editorial.test.tsx src/production-app-shell.test.tsx`

Expected: all focused tests pass.

- [ ] **Step 6: Commit the shell contract**

Run: `git add src/app/ProductionApp.tsx src/design-system/desktop-premium.css src/desktop-workspace-width.test.ts && git commit -m "refactor: centralize desk width and type hooks"`

### Task 3: Normalize high-visibility controls and explicit states

**Files:**
- Modify: `src/design-system/desktopPrimitives.tsx`
- Modify: `src/features/notifications/WorkspaceActivityCenter.tsx`
- Modify: `src/features/music/MusicScreens.tsx`
- Modify: `src/features/missions/MissionScreens.tsx`
- Test: `src/workspace-activity-center.test.tsx`
- Test: `src/production-app-shell.test.tsx`

- [ ] **Step 1: Add failing assertions for visible state and action consistency**

Cover the Activity Center timestamp display, loading/empty state labels for focused Music and Mission views, and minimum action sizing through existing component tests or source-level contracts.

- [ ] **Step 2: Run the focused tests and verify the new assertions fail**

Run: `npm test -- src/workspace-activity-center.test.tsx src/production-app-shell.test.tsx`

Expected: the new assertions fail against the current live-rendered timestamp and blank transition paths.

- [ ] **Step 3: Implement the state and control updates**

Keep grouped Activity timestamps precise enough to distinguish adjacent events, ensure every async detail surface preserves its previous content or shows a labeled skeleton, and apply shared button and tab sizing without changing action behavior.

- [ ] **Step 4: Run focused tests and commit**

Run: `npm test -- src/workspace-activity-center.test.tsx src/production-app-shell.test.tsx`

Then commit with: `git add src/design-system/desktopPrimitives.tsx src/features/notifications/WorkspaceActivityCenter.tsx src/features/music/MusicScreens.tsx src/features/missions/MissionScreens.tsx src/workspace-activity-center.test.tsx src/production-app-shell.test.tsx && git commit -m "fix: make desk states and actions explicit"`

### Task 4: Re-QA responsive visual hierarchy

**Files:**
- Inspect and modify only the feature files identified by the visual pass.
- Add or update focused tests when a responsive behavior changes.

- [ ] **Step 1: Build the app**

Run: `npm run build`

Expected: Vite exits with code 0 and produces the production bundle.

- [ ] **Step 2: Inspect the authenticated desktop route matrix**

Check Home and Activity Center, Catalog Songs and Projects, all Song tabs, Project detail, Manager Office and three conversations, Missions tabs and detail, and all Settings tabs.

- [ ] **Step 3: Inspect the 390px mobile route matrix**

Repeat the same route matrix at 390px. Verify title hierarchy, bottom navigation, status parity, reading width, action padding, and loading feedback.

- [ ] **Step 4: Fix only evidence-backed visual regressions**

Add focused tests before behavior changes. Keep the design contract intact and avoid unrelated data or backend edits.

- [ ] **Step 5: Run the full test suite and build**

Run: `npm test`

Then run: `npm run build`

Expected: 0 test failures, 0 build failures.

- [ ] **Step 6: Commit the verified visual pass**

Run: `git add -A && git commit -m "refactor: align authenticated desk visual system"`

### Task 5: Final review checkpoint

**Files:**
- Review: all changed files and the design spec.

- [ ] **Step 1: Review the diff for scope and accidental behavior changes**

Run: `git diff main...HEAD --stat` and `git diff main...HEAD --check`.

- [ ] **Step 2: Re-run focused tests for the Manager's Read and shell**

Run: `npm test -- src/desk-hq-editorial.test.tsx src/desktop-workspace-width.test.ts src/workspace-activity-center.test.tsx`

- [ ] **Step 3: Re-run the complete verification commands**

Run: `npm test && npm run build`

- [ ] **Step 4: Record the QA result**

Document the inspected routes, viewport sizes, remaining known issues, test counts, and build result in the final handoff. Do not claim deployment or production rollout until a separate deployment request is made.
