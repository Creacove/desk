# Paywall Mobile Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the active Desk paywall show real blurred preview text, remain visually legible in light and dark themes, and keep the checkout immediately visible as a mobile overlay.

**Architecture:** Keep the production paywall in `FrontDoorScreens.tsx` as the canonical active surface. On mobile, the catalog preview becomes an inert full-viewport backdrop and the checkout becomes a bounded, internally scrollable fixed card; desktop keeps the existing two-column layout. Replace the current empty blurred bars with a small data-free locked insight model so the visual communicates withheld content without inventing artist-specific research.

**Tech Stack:** React 18, TypeScript, Tailwind utility classes, Vitest, Testing Library, Vite.

---

### Task 1: Add failing contract tests for the active paywall surface

**Files:**
- Create: `src/paywall-responsive.test.tsx`
- Reference: `src/features/onboarding/FrontDoorScreens.tsx:252-489`

- [x] **Step 1: Write the failing tests**

Add tests that render the `FrontDoorScreens` paywall and assert:

```tsx
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PaywallPreviewScreen } from "./features/onboarding/FrontDoorScreens";

const preview = {
  checkoutSessionId: "checkout-1",
  reference: "checkout-1",
  provider: "paddle" as const,
  status: "open" as const,
  artist: {
    spotifyArtistId: "artist-1",
    name: "Sable Day",
    spotifyUrl: "https://open.spotify.com/artist/artist-1",
    imageUrl: undefined,
  },
  interval: "monthly" as const,
  formattedTotal: "$20.00",
  priceId: "pri_month",
};

afterEach(cleanup);

describe("active paywall responsive surface", () => {
  it("renders actual locked copy instead of empty blur bars", () => {
    render(<PaywallPreviewScreen preview={preview} onSubscribe={() => undefined} onBack={() => undefined} />);

    const audience = screen.getByLabelText("Audience intelligence preview locked");
    const managerRead = screen.getByLabelText("Manager's read preview locked");

    expect(within(audience).getByTestId("paywall-locked-insight-copy-Audience-intelligence")).toHaveTextContent(/listener|discovery|signal/i);
    expect(within(managerRead).getByTestId("paywall-locked-insight-copy-Managers-read")).toHaveTextContent(/priority|timing|recommendation/i);
    expect(within(audience).getByTestId("paywall-locked-insight-copy-Audience-intelligence")).toHaveAttribute("aria-hidden", "true");
  });

  it("keeps the mobile checkout above an inert preview without outer-page scrolling", () => {
    render(<PaywallPreviewScreen preview={preview} onSubscribe={() => undefined} onBack={() => undefined} />);

    expect(screen.getByTestId("paywall-preview-layer")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByTestId("paywall-mobile-veil")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByTestId("paywall-checkout-card")).toHaveClass("fixed", "overflow-y-auto", "overscroll-contain");
    expect(screen.getByLabelText("Desk preview")).toHaveClass("overflow-hidden");
    expect(screen.getByRole("heading", { name: "Open Sable Day's Desk." })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start my Desk" })).toBeInTheDocument();
  });

  it("keeps the desktop checkout in the right-hand layout", () => {
    render(<PaywallPreviewScreen preview={preview} onSubscribe={() => undefined} onBack={() => undefined} />);

    expect(screen.getByTestId("paywall-checkout-card")).toHaveClass("lg:sticky", "lg:top-7");
    expect(screen.getByTestId("paywall-preview-layer")).toHaveClass("lg:grid");
  });
});
```

- [x] **Step 2: Run the focused test to verify it fails for the intended reasons**

Run:

```bash
npx vitest run src/paywall-responsive.test.tsx --environment jsdom --pool=vmThreads
```

Expected: FAIL because the current locked preview contains only width bars and the checkout/preview elements do not have the new mobile overlay contract.

### Task 2: Implement real locked insight copy and theme-safe visual treatment

**Files:**
- Modify: `src/features/onboarding/FrontDoorScreens.tsx:352-361`
- Modify: `src/features/onboarding/FrontDoorScreens.tsx:552-560`

- [x] **Step 1: Replace the `lines: string[]` API with compact locked text rows**

Use data-free teaser rows with real text, for example `Listener signal`, `Discovery pattern`, and `Next opportunity` for Audience intelligence; use `Priority`, `Timing`, and `Recommendation` for Manager's read. Keep the copy generic unless a real pre-payment data source exists.

- [x] **Step 2: Render the text inside a bounded locked surface**

Keep the section label and lock affordance readable. Render the text rows inside a `data-testid` target with `aria-hidden="true"`, apply blur to the text nodes themselves, and add explicit light/dark background, border, and veil classes. Do not blur the entire preview card.

- [x] **Step 3: Run the focused test and confirm the copy assertions still fail only for the unimplemented mobile contract**

Run:

```bash
npx vitest run src/paywall-responsive.test.tsx --environment jsdom --pool=vmThreads
```

Expected: the real-copy assertions pass after this task; the mobile overlay assertions remain the only failures until Task 3.

### Task 3: Implement the mobile overlay without changing desktop hierarchy

**Files:**
- Modify: `src/features/onboarding/FrontDoorScreens.tsx:294-486`

- [x] **Step 1: Make the preview a mobile backdrop**

Give the paywall section a bounded mobile viewport, position the preview layer behind the checkout, mark it `aria-hidden`, and disable pointer interaction on the preview/veil.

- [x] **Step 2: Add the mobile veil and fixed checkout card**

Use a fixed card below the mobile header/back controls with a safe-area-aware bottom edge, `max-h` bounded to the viewport, `overflow-y-auto`, and `overscroll-contain`. Keep the price, interval toggle, and `Start my Desk` action near the top of the card. Add `data-testid="paywall-mobile-veil"` and `data-testid="paywall-checkout-card"` for the responsive contract.

- [x] **Step 3: Preserve desktop behavior**

Keep the desktop preview and checkout as the existing `lg:grid` two-column composition; apply sticky positioning only at `lg` and above.

- [x] **Step 4: Run the focused test and verify it passes**

Run:

```bash
npx vitest run src/paywall-responsive.test.tsx --environment jsdom --pool=vmThreads
```

Expected: PASS.

### Task 4: Verify the active production flow and build

**Files:**
- Modify only if regressions are found: `src/paddle-paywall-ui.test.tsx`, `src/paystack-paywall-contract.test.tsx`, `src/private-beta-ui.test.tsx`

- [x] **Step 1: Run targeted paywall tests**

```bash
npx vitest run src/paywall-responsive.test.tsx src/paddle-paywall-ui.test.tsx src/paystack-paywall-contract.test.tsx src/private-beta-ui.test.tsx --environment jsdom --pool=vmThreads
```

- [x] **Step 2: Run the TypeScript/Vite build**

```bash
npm run build
```

Expected: exit code 0.

- [x] **Step 3: Run the complete test suite and record unrelated baseline failures separately**

```bash
npm test
```

The existing `production-app-shell.test.tsx` baseline failures must not be attributed to this paywall change unless their stack points into the modified file.

- [x] **Step 4: Review the final diff and commit the isolated branch**

```bash
git diff --check
git status --short
git add docs/superpowers/plans/2026-08-23-paywall-mobile-overlay.md src/paywall-responsive.test.tsx src/features/onboarding/FrontDoorScreens.tsx
git commit -m "fix: make paywall preview legible on mobile"
```
