# Living Evidence Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the setup presentation's long working-file list with a compact, content-aware evidence board while preserving queue order and setup completion behavior.

**Architecture:** Keep `useSetupPresentationQueue` and `SetupPresentationSnapshot` unchanged. Refactor only `ManagerWorkingFile` presentation markup into deterministic evidence-module variants, then replace the dedicated CSS with a responsive grid and transform/opacity-only motion.

**Tech Stack:** React 18, TypeScript, existing Lucide icon set, CSS, Vitest, Testing Library.

---

### Task 1: Specify the evidence-board contract

**Files:**
- Modify: `src/features/onboarding/setup-presentation/ManagerWorkingFile.test.tsx`

- [ ] Add one focused test that settles metric, market, and music findings and asserts `manager-file-evidence-board`, `data-evidence-variant`, platform wording, collapsed-count copy, and removal of the old `Filing into` footer.
- [ ] Run `npm test -- src/features/onboarding/setup-presentation/ManagerWorkingFile.test.tsx -t "composes settled findings as a living evidence board"`.
- [ ] Confirm it fails because the evidence-board markup does not exist.

### Task 2: Build deterministic evidence modules

**Files:**
- Modify: `src/features/onboarding/setup-presentation/ManagerWorkingFile.tsx`

- [ ] Remove the decorative setup eyebrow, saved ornament, paper stack, section numbering, row checkmarks, and active-finding footer.
- [ ] Add a pure `evidenceVariant` classifier:

```ts
type EvidenceVariant = "identity" | "metric" | "market" | "music" | "narrative";

function evidenceVariant(finding: SetupPresentationFinding): EvidenceVariant {
  if (finding.kind === "identity") return "identity";
  if (finding.kind === "music" || finding.artwork) return "music";
  if (finding.kind === "market" || finding.destination === "markets") return "market";
  if (finding.kind === "manager_read" || finding.destination === "manager_read") return "narrative";
  return "metric";
}
```

- [ ] Render settled findings in `EvidenceBoard` as content-aware `EvidenceModule` articles with stable source-order keys.
- [ ] Keep the active finding connected to the same queue callbacks and timing.
- [ ] Use truthful copy only: `Reading now`, `Waiting for the first signal`, and the queue-provided collapsed count.

### Task 3: Apply the restrained visual system

**Files:**
- Modify: `src/features/onboarding/setup-presentation/setupPresentationMotion.css`

- [ ] Replace the paper sheet and row styles with an asymmetric two-column board, soft neutral modules, cover-led music modules, large metric values, and compact market/narrative modules.
- [ ] Remove the active card's left border and connector line.
- [ ] Use the existing radius and neutral color language. Keep purple out of evidence modules and green only for real active state.
- [ ] Animate only `opacity` and `transform`; preserve reduced-motion overrides.
- [ ] Collapse the rail above the board under 768px and prevent horizontal page overflow at 320px.

### Task 4: Verify and preview

**Files:**
- Test: `src/features/onboarding/setup-presentation/ManagerWorkingFile.test.tsx`

- [ ] Run the focused test and confirm it passes.
- [ ] Run `npm run build` and confirm exit code 0.
- [ ] Open the discovery fixture at desktop and mobile widths, verify the old left border and long list are gone, and capture a screenshot for review.
- [ ] Run `git diff --check` and inspect the final diff before committing.

