# Theme-Safe Orbs and Manager Buttons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every thinking orb and both Ask Manager buttons reliably legible in the app's light and dark modes while matching the existing Ordersounds design system.

**Architecture:** Introduce one `AppThinkingOrb` adapter that translates the app's resolved theme into the surface theme expected by `thinking-orbs`, including inverse button surfaces. Remove `MetalFx` from the two Ask Manager actions, retain the existing compact inverse pill treatment, and migrate every direct orb call site to the adapter.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Vitest, Testing Library, Vite

---

## File map

- Create `src/design-system/AppThinkingOrb.tsx`: theme-aware adapter around the third-party orb.
- Create `src/design-system/app-thinking-orb.test.tsx`: focused light, dark, and inverse-surface tests.
- Modify `src/features/music/MusicScreens.tsx`: simplify both Ask Manager controls and migrate music loading orbs.
- Modify `src/features/manager/ManagerScreens.tsx`: migrate manager activity orbs and remove stale effect imports.
- Modify `src/features/missions/MissionScreens.tsx`: migrate mission loading orb.
- Modify `src/app/ProductionApp.tsx`: migrate setup, billing, and branded-loader orbs.
- Modify `src/prototype/AiLabelPrototype.tsx`: migrate prototype loading orb.
- Modify `src/production-app-shell.test.tsx`: add regression assertions for the two simplified buttons.
- Modify `package.json` and `package-lock.json`: remove the now-unused `metal-fx` dependency.

### Task 1: Add the theme-aware orb adapter

**Files:**
- Create: `src/design-system/AppThinkingOrb.tsx`
- Create: `src/design-system/app-thinking-orb.test.tsx`

- [ ] **Step 1: Write the failing adapter tests**

Create `src/design-system/app-thinking-orb.test.tsx` with a small mock of the
third-party canvas so the test can observe the theme passed across that package
boundary:

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("thinking-orbs", () => ({
  ThinkingOrb: ({ theme }: { theme: "light" | "dark" }) => <canvas data-testid="thinking-orb" data-theme={theme} />,
}));

import { ThemeProvider } from "../app/theme";
import { AppThinkingOrb } from "./AppThinkingOrb";

describe("AppThinkingOrb", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    document.documentElement.className = "";
    vi.restoreAllMocks();
  });

  it("matches the resolved app theme on a normal surface", () => {
    localStorage.setItem("ordersounds-theme-mode", "light");
    render(<ThemeProvider><AppThinkingOrb state="working" size={20} /></ThemeProvider>);
    expect(screen.getByTestId("thinking-orb")).toHaveAttribute("data-theme", "light");
  });

  it("uses the dark-surface palette on an inverse button in light mode", () => {
    localStorage.setItem("ordersounds-theme-mode", "light");
    render(<ThemeProvider><AppThinkingOrb surface="inverse" state="composing" size={20} /></ThemeProvider>);
    expect(screen.getByTestId("thinking-orb")).toHaveAttribute("data-theme", "dark");
  });

  it("uses the light-surface palette on an inverse button in dark mode", () => {
    localStorage.setItem("ordersounds-theme-mode", "dark");
    render(<ThemeProvider><AppThinkingOrb surface="inverse" state="composing" size={20} /></ThemeProvider>);
    expect(screen.getByTestId("thinking-orb")).toHaveAttribute("data-theme", "light");
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npx vitest run src/design-system/app-thinking-orb.test.tsx --environment jsdom --pool=vmThreads
```

Expected: FAIL because `./AppThinkingOrb` does not exist.

- [ ] **Step 3: Implement the minimal adapter**

Create `src/design-system/AppThinkingOrb.tsx`:

```tsx
import { ThinkingOrb, type ThinkingOrbProps } from "thinking-orbs";
import { useTheme } from "../app/theme";

type AppThinkingOrbProps = Omit<ThinkingOrbProps, "theme"> & {
  surface?: "normal" | "inverse";
};

export function AppThinkingOrb({ surface = "normal", ...props }: AppThinkingOrbProps) {
  const { resolvedMode } = useTheme();
  const theme = surface === "inverse"
    ? resolvedMode === "dark" ? "light" : "dark"
    : resolvedMode;

  return <ThinkingOrb {...props} theme={theme} />;
}
```

- [ ] **Step 4: Run the adapter tests and verify GREEN**

Run:

```bash
npx vitest run src/design-system/app-thinking-orb.test.tsx --environment jsdom --pool=vmThreads
```

Expected: 3 tests PASS.

- [ ] **Step 5: Commit the adapter**

```bash
git add src/design-system/AppThinkingOrb.tsx src/design-system/app-thinking-orb.test.tsx
git commit -m "feat: add theme-aware thinking orb"
```

### Task 2: Simplify the Ask Manager buttons

**Files:**
- Modify: `src/production-app-shell.test.tsx`
- Modify: `src/features/music/MusicScreens.tsx`

- [ ] **Step 1: Add the failing song and project button regressions**

In the existing test that opens `No Read Song` and `No Read Project`, retain the
accessible-name assertions and add:

```tsx
const songAskManagerButton = within(songRoom).getByRole("button", { name: "Ask Manager for a read" });
expect(songAskManagerButton).toHaveClass("bg-foreground", "text-background", "focus:ring-brand-accent/30");
expect(songAskManagerButton.closest(".metal-fx-root")).toBeNull();

const projectAskManagerButton = within(projectRoom).getByRole("button", { name: "Ask Manager for a project read" });
expect(projectAskManagerButton).toHaveClass("bg-foreground", "text-background", "focus:ring-brand-accent/30");
expect(projectAskManagerButton.closest(".metal-fx-root")).toBeNull();
```

- [ ] **Step 2: Run the regression and verify RED**

Run:

```bash
npx vitest run src/production-app-shell.test.tsx -t "uses empty-state Manager read copy" --environment jsdom --pool=vmThreads
```

Expected: FAIL because both buttons still have a `.metal-fx-root` ancestor and
lack the design-system focus-ring class.

- [ ] **Step 3: Remove MetalFx and apply the native Ordersounds treatment**

In `src/features/music/MusicScreens.tsx`:

- remove the `MetalFx` import;
- remove both `<MetalFx>` wrappers;
- keep each button's compact `rounded-full`, responsive padding, font size,
  `bg-foreground`, `text-background`, and shadow;
- add `font-ui`, `focus:outline-none`, `focus:ring-2`,
  `focus:ring-brand-accent/30`, `disabled:pointer-events-none`, and
  `disabled:opacity-40`;
- replace each pending orb with:

```tsx
<AppThinkingOrb surface="inverse" state="composing" size={20} />
```

- [ ] **Step 4: Run the regression and verify GREEN**

Run:

```bash
npx vitest run src/production-app-shell.test.tsx -t "uses empty-state Manager read copy" --environment jsdom --pool=vmThreads
```

Expected: PASS.

- [ ] **Step 5: Commit the button fix**

```bash
git add src/features/music/MusicScreens.tsx src/production-app-shell.test.tsx
git commit -m "fix: simplify manager read buttons"
```

### Task 3: Migrate every remaining orb call site

**Files:**
- Modify: `src/features/music/MusicScreens.tsx`
- Modify: `src/features/manager/ManagerScreens.tsx`
- Modify: `src/features/missions/MissionScreens.tsx`
- Modify: `src/app/ProductionApp.tsx`
- Modify: `src/prototype/AiLabelPrototype.tsx`

- [ ] **Step 1: Add a failing source-coverage regression**

Extend `src/design-system/app-thinking-orb.test.tsx` with a test that reads the
five orb-consuming source files and requires them to use the adapter:

```tsx
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

it("routes every app orb through the theme-aware adapter", () => {
  const files = [
    "src/features/music/MusicScreens.tsx",
    "src/features/manager/ManagerScreens.tsx",
    "src/features/missions/MissionScreens.tsx",
    "src/app/ProductionApp.tsx",
    "src/prototype/AiLabelPrototype.tsx",
  ];

  for (const file of files) {
    const source = readFileSync(resolve(process.cwd(), file), "utf8");
    expect(source).not.toContain('from "thinking-orbs"');
    expect(source).not.toMatch(/<ThinkingOrb\b/);
    expect(source).not.toMatch(/theme="(?:light|dark)"/);
  }
});
```

- [ ] **Step 2: Run the coverage test and verify RED**

Run:

```bash
npx vitest run src/design-system/app-thinking-orb.test.tsx --environment jsdom --pool=vmThreads
```

Expected: FAIL because direct imports, direct JSX, and hard-coded themes remain.

- [ ] **Step 3: Route all normal-surface orbs through the adapter**

For each listed source file:

- replace the runtime `ThinkingOrb` import with `AppThinkingOrb` from
  `../../design-system/AppThinkingOrb` or `../design-system/AppThinkingOrb` as
  appropriate;
- retain `import type { OrbState } from "thinking-orbs"` in
  `ManagerScreens.tsx`, because the state mapping still needs the package type;
- replace every `<ThinkingOrb ... theme="dark" />` normal-surface use with
  `<AppThinkingOrb ... />`;
- keep the two Ask Manager pending uses as
  `<AppThinkingOrb surface="inverse" ... />`;
- preserve every existing state and size.

- [ ] **Step 4: Run adapter and coverage tests and verify GREEN**

Run:

```bash
npx vitest run src/design-system/app-thinking-orb.test.tsx --environment jsdom --pool=vmThreads
```

Expected: 4 tests PASS.

- [ ] **Step 5: Commit the migration**

```bash
git add src/design-system/app-thinking-orb.test.tsx src/features/music/MusicScreens.tsx src/features/manager/ManagerScreens.tsx src/features/missions/MissionScreens.tsx src/app/ProductionApp.tsx src/prototype/AiLabelPrototype.tsx
git commit -m "fix: make all thinking orbs theme aware"
```

### Task 4: Remove the unused effect dependency

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Confirm MetalFx has no remaining source use**

Run:

```bash
rg -n "MetalFx|metal-fx" src
```

Expected: no matches.

- [ ] **Step 2: Remove the dependency**

Run:

```bash
npm uninstall metal-fx
```

Expected: `metal-fx` is removed from `package.json` and `package-lock.json`.

- [ ] **Step 3: Verify the dependency is absent**

Run:

```bash
npm ls metal-fx
```

Expected: an empty dependency tree.

- [ ] **Step 4: Commit dependency cleanup**

```bash
git add package.json package-lock.json
git commit -m "chore: remove unused metal effect"
```

### Task 5: Verify behavior and presentation

**Files:**
- No additional production files expected.

- [ ] **Step 1: Run the focused tests**

```bash
npx vitest run src/design-system/app-thinking-orb.test.tsx src/production-app-shell.test.tsx -t "AppThinkingOrb|uses empty-state Manager read copy" --environment jsdom --pool=vmThreads
```

Expected: all selected tests PASS.

- [ ] **Step 2: Run the full test suite**

```bash
npm test
```

Expected: all tests PASS with no unhandled errors.

- [ ] **Step 3: Run the production build**

```bash
npm run build
```

Expected: TypeScript and Vite complete successfully.

- [ ] **Step 4: Audit the final source**

```bash
rg -n 'from "thinking-orbs"|<ThinkingOrb|theme="(?:light|dark)"|MetalFx|metal-fx' src package.json
```

Expected: only the type import in `ManagerScreens.tsx` and the adapter's own
`thinking-orbs` import remain; no hard-coded orb themes or MetalFx references
remain.

- [ ] **Step 5: Visually verify both themes**

Start the app with `npm run dev -- --host 127.0.0.1`, open the Catalog song and
project detail screens, and inspect:

- light mode idle Ask Manager button;
- light mode pending Ask Manager button;
- dark mode idle Ask Manager button;
- dark mode pending Ask Manager button;
- manager activity, mission, setup, import, billing, and branded-loader orbs on
  their normal surfaces.

Expected: labels and icons meet the surrounding Ordersounds contrast pattern;
orbs use dark ink on light surfaces and light ink on dark surfaces; no metallic
wrapper remains around either Ask Manager button.
