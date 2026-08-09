# Split Confirmation Hierarchy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Rights tab distinguish allocated shares from confirmed shares with one clear, human-first confirmation summary.

**Architecture:** Keep the existing `MusicRightsWorkspace` and split data model. Add a pure presenter helper in `MusicScreens.tsx` that derives the single header sentence from contributor approval states, then render a compact ledger without allocation meters or duplicated server summary during the confirmation flow. Use the existing app-shell integration test to cover the rendered contract.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Vitest, Testing Library.

---

### Task 1: Capture the active confirmation contract

**Files:**
- Modify: `src/production-app-shell.test.tsx`

- [ ] **Step 1: Write the failing test**

Add an active two-contributor Rights test that opens a song with `status: "Partially Confirmed"`, Mureni marked `Cleared`, David marked `Pending`, and 50% publishing/master for both. Assert the human sentence, unambiguous ledger shares, `Confirmed`, and `Awaiting confirmation`; assert that the obsolete allocation meters, status pill, duplicate database summary, and locked remove column are absent.

```tsx
expect(screen.getByText("Mureni confirmed their 50% publishing and 50% master share. Waiting for David.")).toBeInTheDocument();
expect(screen.getAllByText("Publishing 50% · Master 50%")).toHaveLength(2);
expect(screen.getByText("Confirmed")).toBeInTheDocument();
expect(screen.getByText("Awaiting confirmation")).toBeInTheDocument();
expect(screen.queryByText("100% publishing")).not.toBeInTheDocument();
expect(screen.queryByText("Split details partially confirmed. Waiting for remaining collaborators.")).not.toBeInTheDocument();
expect(screen.queryByText("Remove")).not.toBeInTheDocument();
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- src/production-app-shell.test.tsx -t "summarizes a partially confirmed split without allocation noise"`

Expected: FAIL because the current UI still shows allocation meters, summary, `Cleared`, and `Pending`.

### Task 2: Render the single hierarchy

**Files:**
- Modify: `src/features/music/MusicScreens.tsx:1572-1787`

- [ ] **Step 1: Add a pure confirmation-summary helper**

Implement a helper that returns the specific one-confirmed/one-pending sentence and count-based fallback copy for larger groups. It must use only confirmed/cleared approvals as confirmed rights and must not use allocation totals as confirmation progress.

```tsx
function splitConfirmationCopy(contributors: NonNullable<MusicObjectViewModel["splits"]>["contributors"]) {
  const confirmed = contributors.filter((contributor) => ["cleared", "confirmed"].includes(contributor.approval.toLowerCase()));
  const pending = contributors.filter((contributor) => contributor.approval.toLowerCase() === "pending");
  if (confirmed.length === 1 && pending.length === 1) {
    const collaborator = confirmed[0];
    return `${collaborator.name} confirmed their ${collaborator.publishingShare} publishing and ${collaborator.masterShare} master share. Waiting for ${pending[0].name}.`;
  }
  return `${confirmed.length} of ${contributors.length} collaborators confirmed. Waiting for ${pending.length} collaborator${pending.length === 1 ? "" : "s"}.`;
}
```

- [ ] **Step 2: Replace competing confirmation chrome**

In confirmation states, render the helper sentence under `Splits`; do not render `MusicStatusPill`, `SplitAllocationMeter`, a separate confirmation count, or `song.splits.summary`. Retain draft balancing and send states unchanged.

- [ ] **Step 3: Make contributor rows self-explanatory**

Replace the `Splits` cell with `Publishing {publishingShare} · Master {masterShare}`. Rename the green contributor badge to `Confirmed` and the pending badge to `Awaiting confirmation`. When the split is locked, omit the Remove header and cell instead of rendering `-`.

- [ ] **Step 4: Remove the unused allocation-meter component and imports if no longer referenced**

Run: `rg -n "SplitAllocationMeter" src`

Expected: no result.

### Task 3: Verify and ship

**Files:**
- Modify: `src/production-app-shell.test.tsx`
- Modify: `src/features/music/MusicScreens.tsx`

- [ ] **Step 1: Run the focused Rights test**

Run: `npm test -- src/production-app-shell.test.tsx -t "split ledger flow|summarizes a partially confirmed split"`

Expected: PASS.

- [ ] **Step 2: Run the complete test suite and production build**

Run: `npm test`

Run: `npm run build`

Expected: both exit 0.

- [ ] **Step 3: Review the production diff and deploy**

Run: `git diff --check && git status --short`

Deploy the validated Netlify build to production, then use the already-authenticated Chrome tab to inspect the Rights tab at desktop width and confirm that only the one confirmation sentence and contributor ledger communicate status.

- [ ] **Step 4: Commit and push**

```bash
git add docs/superpowers/specs/2026-08-09-split-confirmation-hierarchy-design.md docs/superpowers/plans/2026-08-09-split-confirmation-hierarchy.md src/features/music/MusicScreens.tsx src/production-app-shell.test.tsx
git commit -m "fix: clarify split confirmation hierarchy"
git push origin main
```
