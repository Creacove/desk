# Desk Home Visual Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recompose Desk Home into one polished, responsive page using only the information already present, while making Today conditional and visually integrated with the composer, brief, metrics, and Manager's Read.

**Architecture:** Keep `DeskHQScreen` as the page orchestrator and `TodayRuntimeExecution` as the runtime/data boundary. Add a focused `deskHome.css` design layer and semantic Home class names; use a gap-based primary flow so Today can return `null` without leaving layout residue. Preserve all repositories, projections, mutations, and brief-generation behavior.

**Tech Stack:** React 18, TypeScript, Tailwind CSS utilities, scoped CSS, Vitest, Testing Library, Vite, Playwright visual QA.

---

## File map

- Create `src/features/desk/deskHome.css`: scoped Home surfaces, typography, grid, responsive, dark/light, and reduced-motion rules.
- Modify `src/features/desk/DeskHQ.tsx`: import the Home stylesheet, establish the shared page flow, and add semantic classes/test IDs to the brief, metrics, composer, and Manager's Read.
- Modify `src/features/desk/TodayRuntimeExecution.tsx`: apply primary/supporting hierarchy, plain indexes, responsive row structure, and padded inline states.
- Modify `src/desk-hq-editorial.test.tsx`: assert page order, conditional Today behavior, and semantic Home classes.
- Create `src/desk-home-visual-contract.test.ts`: assert the scoped stylesheet contains required responsive, theme-token, and reduced-motion contracts.

### Task 1: Lock the adaptive Home structure

**Files:**
- Modify: `src/desk-hq-editorial.test.tsx`
- Modify: `src/features/desk/DeskHQ.tsx`

- [ ] **Step 1: Write failing hierarchy tests**

Add these cases to `src/desk-hq-editorial.test.tsx`:

```tsx
it("uses one gap-based primary flow so Today can disappear without leaving a spacer", () => {
  renderHome({ missions: [] });

  expect(screen.queryByTestId("desk-today-execution")).not.toBeInTheDocument();
  const flow = screen.getByTestId("desk-home-primary-flow");
  const composer = screen.getByTestId("desk-home-composer");
  expect(flow).toHaveClass("home-primary-flow");
  expect(flow.firstElementChild).toBe(composer);
});

it("keeps execution, composer, brief, metrics, and Manager read in one deliberate order", () => {
  renderHome();

  const page = screen.getByTestId("desk-home-page");
  const ordered = [
    screen.getByTestId("desk-today-execution"),
    screen.getByTestId("desk-home-composer"),
    screen.getByTestId("desk-editorial-brief"),
    screen.getByTestId("desk-signal-metric-strip"),
    screen.getByTestId("desk-manager-read"),
  ];
  expect(ordered.every((node, index) => index === 0 || Boolean(ordered[index - 1].compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
  expect(page).toHaveClass("desk-home-page");
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run:

```powershell
npx vitest run src/desk-hq-editorial.test.tsx --environment jsdom --pool=vmThreads
```

Expected: both new tests fail because the Home test IDs and gap-based flow do not exist.

- [ ] **Step 3: Implement the structural flow**

In `DeskHQ.tsx`:

```tsx
import "./deskHome.css";

<section
  data-testid="desk-home-page"
  className="app-workspace app-workspace-reveal home-workspace desk-home-page relative isolate min-w-0 pb-12"
>
  <div className="os-room-rail">
    <WorkspaceHeader ... />

    <div data-testid="desk-home-primary-flow" className="home-primary-flow">
      <TodayRuntimeExecution ... />
      <div data-testid="desk-home-composer" className="home-composer-wrap">
        <HomeManagerComposer ... />
      </div>
    </div>

    <section data-testid="desk-editorial-brief" className="home-brief-section">...</section>
    {metrics.length ? <SignalMetricStrip metrics={metrics} /> : null}
    <ManagerRead segments={managerReadSegments} />
  </div>
</section>
```

Remove the standalone `mt-*` wrappers that assume Today exists.

- [ ] **Step 4: Run the hierarchy tests and verify GREEN**

Run the same Vitest command. Expected: all `desk-hq-editorial` tests pass.

- [ ] **Step 5: Commit**

```powershell
git add src/desk-hq-editorial.test.tsx src/features/desk/DeskHQ.tsx
git commit -m "refactor: unify Desk Home page flow"
```

### Task 2: Build the Today execution hierarchy

**Files:**
- Modify: `src/desk-hq-editorial.test.tsx`
- Modify: `src/features/desk/TodayRuntimeExecution.tsx`

- [ ] **Step 1: Write the failing Today hierarchy test**

Add:

```tsx
it("gives Today one primary action and quieter supporting actions", () => {
  renderHome();

  const today = screen.getByTestId("desk-today-execution");
  const actionRows = within(today).getAllByRole("button").filter((button) => button.hasAttribute("data-today-kind"));
  expect(today).toHaveClass("home-today-band");
  expect(actionRows[0]).toHaveAttribute("data-today-primary", "true");
  expect(actionRows[0]).toHaveClass("home-today-row-primary");
  expect(actionRows.slice(1).every((row) => row.classList.contains("home-today-row-supporting"))).toBe(true);
  expect(within(actionRows[0]).getByTestId("desk-today-index")).toHaveTextContent("01");
});
```

- [ ] **Step 2: Run the test and verify RED**

Run the focused Vitest command. Expected: failure for missing Home Today classes and padded index test ID.

- [ ] **Step 3: Implement semantic Today classes**

Change the Today shell and rows to use these structures:

```tsx
<section data-testid="desk-today-execution" className="home-today-band">
  <div className="home-today-heading">...</div>
  <div className="home-today-list">...</div>
</section>
```

For question, permission, and task buttons:

```tsx
className={`home-today-row ${primary ? "home-today-row-primary" : "home-today-row-supporting"}`}
```

Replace the circular badge with:

```tsx
<span data-testid="desk-today-index" className="home-today-index">
  {String(index + 1).padStart(2, "0")}
</span>
```

Use `home-today-copy`, `home-today-title`, `home-today-description`, `home-today-meta`, and `home-today-action` for the remaining row regions. Use `home-today-expanded` for expanded question/permission content and `home-today-watch-list` for watches.

- [ ] **Step 4: Run the tests and verify GREEN**

Expected: all focused tests pass and existing question/permission behavior remains intact.

- [ ] **Step 5: Commit**

```powershell
git add src/desk-hq-editorial.test.tsx src/features/desk/TodayRuntimeExecution.tsx
git commit -m "feat: establish Today action hierarchy"
```

### Task 3: Add the scoped visual system

**Files:**
- Create: `src/desk-home-visual-contract.test.ts`
- Create: `src/features/desk/deskHome.css`
- Modify: `src/features/desk/DeskHQ.tsx`

- [ ] **Step 1: Write the failing visual contract test**

Create `src/desk-home-visual-contract.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src/features/desk/deskHome.css"), "utf8");

describe("Desk Home visual contract", () => {
  it("uses the shared theme tokens and a padded Today surface", () => {
    expect(css).toContain(".home-today-band");
    expect(css).toContain("hsl(var(--surface-panel))");
    expect(css).toContain("hsl(var(--brand-accent))");
    expect(css).toMatch(/\.home-today-band\s*\{[^}]*padding:/s);
  });

  it("defines mobile, narrow mobile, dark theme, and reduced-motion behavior", () => {
    expect(css).toContain("@media (max-width: 767px)");
    expect(css).toContain("@media (max-width: 359px)");
    expect(css).toContain(".app-theme-dark .home-today-band");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("keeps Home typography on the existing product fonts", () => {
    expect(css).toContain("var(--font-display)");
    expect(css).toContain("var(--font-ui)");
    expect(css).not.toContain("@font-face");
  });
});
```

- [ ] **Step 2: Run the visual contract and verify RED**

Run:

```powershell
npx vitest run src/desk-home-visual-contract.test.ts --pool=vmThreads
```

Expected: failure because `deskHome.css` does not exist.

- [ ] **Step 3: Implement `deskHome.css`**

Create scoped rules for:

```css
.desk-home-page { --home-reading-measure: 68ch; }
.home-primary-flow { display: grid; gap: 1.25rem; }
.home-today-band { padding: 1.5rem; border: 1px solid hsl(var(--border)); border-radius: 1rem; background: hsl(var(--surface-panel)); }
.home-today-heading { display: flex; align-items: end; justify-content: space-between; gap: 1.5rem; }
.home-today-headline { font: 600 clamp(1.6875rem, 2.15vw, 1.875rem)/1.12 var(--font-display); letter-spacing: -0.028em; }
.home-today-list { margin-top: 1.4rem; border-top: 1px solid hsl(var(--border)); }
.home-today-row { display: grid; grid-template-columns: 2.25rem minmax(0, 1fr) auto; min-height: 4.75rem; gap: 1rem; padding: 1.1rem 0; }
.home-today-row-primary { position: relative; }
.home-today-row-primary::before { content: ""; position: absolute; inset: 1rem auto 1rem -1.5rem; width: 2px; background: hsl(var(--brand-accent)); }
.home-today-index { font: 600 0.6875rem/1.5 var(--font-mono); color: hsl(var(--muted-foreground)); }
.home-today-title { font: 600 0.9375rem/1.4 var(--font-ui); }
.home-today-description { margin-top: 0.3rem; max-width: 52rem; font: 500 0.8125rem/1.6 var(--font-ui); color: hsl(var(--muted-foreground)); }
.home-today-action { min-height: 2.75rem; align-self: center; }
.home-composer-wrap { min-width: 0; }
.home-brief-section { margin-top: clamp(2.25rem, 4vw, 2.75rem); }
.home-brief-headline { max-width: 30ch; font: 600 clamp(2rem, 3vw, 2.375rem)/1.08 var(--font-display); letter-spacing: -0.032em; }
.home-metric-value { font-size: clamp(1.5rem, 2vw, 1.6875rem); }
.home-manager-read-body { max-width: var(--home-reading-measure); }
```

Add dark, mobile, narrow-mobile, and reduced-motion rules that stack Today rows, preserve 16px mobile insets, produce a two-column metric grid, and move Manager's Read metadata above body copy.

Add corresponding semantic classes in `DeskHQ.tsx` to the brief headline, metric value, Manager's Read rows/body, and section headers.

- [ ] **Step 4: Run focused tests and build**

Run:

```powershell
npx vitest run src/desk-home-visual-contract.test.ts src/desk-hq-editorial.test.tsx --environment jsdom --pool=vmThreads
npm run build
```

Expected: tests pass and Vite exits 0.

- [ ] **Step 5: Commit**

```powershell
git add src/desk-home-visual-contract.test.ts src/features/desk/deskHome.css src/features/desk/DeskHQ.tsx
git commit -m "style: redesign Desk Home composition"
```

### Task 4: Verify interactions and visual states

**Files:**
- Verify: `src/features/desk/DeskHQ.tsx`
- Verify: `src/features/desk/TodayRuntimeExecution.tsx`
- Verify: `src/features/desk/deskHome.css`
- Verify: `src/desk-hq-editorial.test.tsx`

- [ ] **Step 1: Run the complete automated suite**

```powershell
npm test
npm run build
```

Expected: zero test failures and build exit 0.

- [ ] **Step 2: Launch the production app locally**

```powershell
npm run dev -- --host 127.0.0.1
```

Use the production app mode with existing local Supabase credentials.

- [ ] **Step 3: Inspect responsive states**

Capture and inspect:

- 1440x900 dark
- 1440x900 light
- 1024x768
- 390x844 dark
- 390x844 light
- 320x720

Verify the actionable Today state, the composer/brief transition, metric wrapping, Manager's Read measure, and mobile navigation clearance.

- [ ] **Step 4: Verify conditional and expanded states**

Use focused component tests or fixture overrides to verify:

- `missions: []` removes Today and leaves composer first in `home-primary-flow`
- watch-only projection remains compact
- permission and question expansion stays inside Today with adequate padding
- refresh pending/failure preserves the brief
- reduced motion removes nonessential movement

- [ ] **Step 5: Fix visual defects test-first**

For each behavior defect, add a focused assertion to `desk-hq-editorial.test.tsx`, run it to confirm failure, patch the component/CSS, and rerun the focused suite. Pure optical adjustments must be checked at all six viewports before acceptance.

- [ ] **Step 6: Run final verification and commit**

```powershell
npm test
npm run build
git diff --check
git add src/features/desk/DeskHQ.tsx src/features/desk/TodayRuntimeExecution.tsx src/features/desk/deskHome.css src/desk-hq-editorial.test.tsx src/desk-home-visual-contract.test.ts
git commit -m "fix: finish responsive Desk Home design"
```

Expected: tests and build pass, `git diff --check` is clean, and no visual defect remains in the required state/viewport matrix.
