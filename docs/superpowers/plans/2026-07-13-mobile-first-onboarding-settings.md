# Mobile-first Onboarding and Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make artist selection, Manager Basics, and Settings purpose-built mobile app surfaces while retaining useful desktop layouts and preventing long paywall content from escaping the viewport.

**Architecture:** Keep the existing React screen boundaries and callback contracts. Add responsive presentation branches inside `OnboardingScreens.tsx`, convert `SettingsScreen.tsx` from a stacked document into three local-state tabs, and harden the existing paywall grid with shrink and overflow constraints. Component tests define content visibility, tab behavior, retained callbacks, and overflow-class contracts before implementation.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Vitest, Testing Library, lucide-react.

---

## File map

- Modify `src/features/onboarding/OnboardingScreens.tsx`: mobile-first artist selection, compact Manager Basics, and paywall overflow containment.
- Create `src/onboarding-responsive.test.tsx`: focused rendering and behavior coverage for ConnectArtistScreen and SetupScreen.
- Modify `src/features/settings/SettingsScreen.tsx`: Profile, Access, and Account tab architecture; remove intelligence rendering.
- Modify `src/settings-screen.test.tsx`: tab semantics, section visibility, callbacks, and removal of Artist Intelligence.
- Modify `src/paystack-paywall-contract.test.tsx`: adversarial long-content overflow contract.

### Task 1: Define mobile onboarding behavior with failing tests

**Files:**
- Create: `src/onboarding-responsive.test.tsx`
- Test: `src/onboarding-responsive.test.tsx`

- [ ] **Step 1: Write artist-selection structure tests**

Render `ConnectArtistScreen` in search mode and assert that `Choose your artist` and `Search Spotify artist` exist, the mobile task region has `lg:hidden`, and the desktop introduction containing `Bring your catalog to life.` has `hidden lg:block`. Render a long candidate name and assert the result's content wrapper uses `min-w-0` and its name uses `truncate`.

- [ ] **Step 2: Write Manager Basics reduction tests**

Render `SetupScreen` with a complete profile. Assert a `setup-mobile-form` region has `lg:hidden` and contains Artist direction, Monthly budget, and Enter Desk HQ. Assert `setup-desktop-layout` has `hidden lg:grid` and contains Artist name, Artist identity, Onboarding tips, and Skip. Click the mobile action and verify `onContinue` receives the unchanged complete profile.

- [ ] **Step 3: Run the new tests and verify failure**

Run: `npm test -- src/onboarding-responsive.test.tsx`

Expected: FAIL because the responsive regions and new mobile title do not exist.

- [ ] **Step 4: Commit the red tests**

```powershell
git add src/onboarding-responsive.test.tsx
git commit -m "test: define mobile onboarding hierarchy"
```

### Task 2: Implement purpose-built mobile onboarding

**Files:**
- Modify: `src/features/onboarding/OnboardingScreens.tsx`
- Test: `src/onboarding-responsive.test.tsx`

- [ ] **Step 1: Split artist selection presentation responsively**

Keep callbacks and result mapping shared where practical. Add a compact `lg:hidden` search/confirmation composition headed by `Choose your artist`; place the current two-column marketing layout in `hidden lg:grid`. Ensure all row parents that contain external names use `min-w-0`, names/metadata use `truncate`, and the mobile header avoids status copy.

- [ ] **Step 2: Add the compact Manager Basics composition**

Add a `lg:hidden` mobile form containing back, compact artist identity, title, `ArtistDirectionField`, Monthly budget, concise inline status, and one Enter Desk HQ button. Keep the existing desktop form in `hidden lg:grid`, shorten desktop explanatory copy, and preserve the current completion/pending rules and unchanged profile submission.

- [ ] **Step 3: Run onboarding tests**

Run: `npm test -- src/onboarding-responsive.test.tsx src/production-app-shell.test.tsx`

Expected: PASS.

- [ ] **Step 4: Commit onboarding implementation**

```powershell
git add src/features/onboarding/OnboardingScreens.tsx src/onboarding-responsive.test.tsx
git commit -m "feat: streamline onboarding on mobile"
```

### Task 3: Define Settings tab behavior with failing tests

**Files:**
- Modify: `src/settings-screen.test.tsx`
- Test: `src/settings-screen.test.tsx`

- [ ] **Step 1: Replace intelligence expectations with navigation expectations**

Render Settings with a profile that still contains `artistIntelligence`. Assert tabs named Profile, Access, and Account exist; Profile is selected by default; `Artist intelligence` and its reads do not render.

- [ ] **Step 2: Test active section isolation and controls**

Assert Profile initially exposes Artist name and hides access/password controls. Click Access and assert Private beta plus expiry renders while profile controls disappear. Click Account and assert Appearance, password fields, and Sign out render while Access content disappears.

- [ ] **Step 3: Test retained callbacks**

Change Artist name and confirm `onChange` receives the full profile with the new name. From Account, switch appearance and confirm `onThemeModeChange`. Submit matching passwords and confirm `onUpdatePassword`.

- [ ] **Step 4: Run Settings tests and verify failure**

Run: `npm test -- src/settings-screen.test.tsx`

Expected: FAIL because Settings has no tabs and still renders intelligence.

- [ ] **Step 5: Commit the red tests**

```powershell
git add src/settings-screen.test.tsx
git commit -m "test: define settings information architecture"
```

### Task 4: Implement tabbed Settings

**Files:**
- Modify: `src/features/settings/SettingsScreen.tsx`
- Test: `src/settings-screen.test.tsx`

- [ ] **Step 1: Add typed local tab state and accessible navigation**

Define `type SettingsTab = "profile" | "access" | "account"`, default to Profile, and render a sticky mobile segmented tablist with buttons carrying `role="tab"`, `aria-selected`, and `aria-controls`. Use the same navigation on desktop.

- [ ] **Step 2: Extract focused settings sections**

Create local `ProfileSettings`, `AccessSettings`, and `AccountSettings` components in the same file. Profile groups identity, career context, operating context, and channels. Access always renders, with a concise empty state when `workspace` is absent. Account composes appearance, optional password, and optional sign out.

- [ ] **Step 3: Remove Settings intelligence presentation**

Delete the intelligence imports, `IntelligenceRead`, and all rendering of `profile.artistIntelligence`. Do not alter the profile type or data.

- [ ] **Step 4: Run Settings and shell tests**

Run: `npm test -- src/settings-screen.test.tsx src/production-app-shell.test.tsx`

Expected: PASS after updating any shell assertion that intentionally referenced the old stacked settings structure.

- [ ] **Step 5: Commit Settings implementation**

```powershell
git add src/features/settings/SettingsScreen.tsx src/settings-screen.test.tsx src/production-app-shell.test.tsx
git commit -m "feat: reorganize settings into focused tabs"
```

### Task 5: Harden paywall overflow with an adversarial contract

**Files:**
- Modify: `src/paystack-paywall-contract.test.tsx`
- Modify: `src/features/onboarding/OnboardingScreens.tsx`
- Test: `src/paystack-paywall-contract.test.tsx`

- [ ] **Step 1: Write the long-content contract**

Render the paywall with long unbroken artist, project, track, and single names. Assert the viewport has `max-w-full`, the principal content grid and checkout use `min-w-0`, and every externally supplied title targeted by a test id uses `truncate`, `break-words`, or a line clamp.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npm test -- src/paystack-paywall-contract.test.tsx`

Expected: FAIL on missing containment hooks/classes.

- [ ] **Step 3: Apply shrink and overflow constraints**

Add `max-w-full`, `min-w-0`, `overflow-hidden`, and bounded wrapping/truncation to the paywall grid, catalog preview, queue cards, checkout heading, and flex/grid children. Preserve `h-dvh`, existing layout, pricing, and billing behavior.

- [ ] **Step 4: Run paywall tests**

Run: `npm test -- src/paystack-paywall-contract.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit overflow hardening**

```powershell
git add src/features/onboarding/OnboardingScreens.tsx src/paystack-paywall-contract.test.tsx
git commit -m "fix: contain long paywall catalog content"
```

### Task 6: Full verification and responsive inspection

**Files:**
- Modify only if verification reveals an in-scope regression.

- [ ] **Step 1: Run formatting/type/build validation**

Run: `npm run build`

Expected: successful TypeScript and Vite production build.

- [ ] **Step 2: Run the full test suite**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 3: Inspect responsive pages in a real browser**

Run the Vite app and inspect artist selection, Manager Basics, Settings Profile/Access/Account, and paywall at 320x568, 390x844, 768x1024, and a desktop viewport in light and dark modes. Confirm the primary mobile form starts in the first viewport, tabs remain usable, and `document.documentElement.scrollWidth <= window.innerWidth` on affected screens.

- [ ] **Step 4: Record final repository state**

Run: `git status --short` and `git log -6 --oneline`.

Expected: no unintended changes; implementation commits are present.
