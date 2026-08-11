# Settings Information Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split Settings into Profile, Workspace, Preferences, and Account tabs while making manual artist fields editable and persistable.

**Architecture:** Keep the existing SettingsScreen component and separate its current Account content into Preferences and Account. The production runtime will expose the existing Supabase `updateArtistProfile` RPC wrapper so ProfileSettings can render its explicit save action. Profile fields remain local drafts until the user presses Save changes; only the Spotify-connected artist stays read-only.

**Tech Stack:** React, TypeScript, Tailwind utility classes, Vitest, Testing Library, Supabase RPC adapter, Vite.

---

### Task 1: Add failing coverage for tab structure, editing, and runtime save wiring

**Files:**
- Modify: `src/settings-screen.test.tsx`
- Modify: `src/production-app-shell.test.tsx`

- [ ] **Step 1: Update the default-tab assertions**

Change the existing default SettingsScreen test to assert the four labels and order:

```tsx
expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
  "Profile",
  "Workspace",
  "Preferences",
  "Account",
]);
expect(screen.getByRole("tab", { name: "Profile" })).toHaveAttribute("aria-selected", "true");
expect(screen.getByRole("tab", { name: "Workspace" })).toHaveAttribute("aria-selected", "false");
expect(screen.getByRole("tab", { name: "Preferences" })).toHaveAttribute("aria-selected", "false");
expect(screen.getByRole("tab", { name: "Account" })).toHaveAttribute("aria-selected", "false");
```

- [ ] **Step 2: Update the appearance-boundary test**

Click `Preferences` instead of `Account` when asserting appearance controls, then click `Account` and assert `Appearance` is absent:

```tsx
fireEvent.click(screen.getByRole("tab", { name: "Preferences" }));
expect(screen.getByText("Appearance")).toBeInTheDocument();
expect(screen.getByText("Following system: Dark")).toBeInTheDocument();
fireEvent.click(screen.getByRole("tab", { name: "Account" }));
expect(screen.queryByText("Appearance")).not.toBeInTheDocument();
```

- [ ] **Step 3: Add a manual-field editing test**

Add a test that renders the profile tab with an `onSaveProfile` callback and verifies manual fields are enabled while the connected artist remains disabled:

```tsx
it("lets users edit manual profile fields while keeping the connected artist managed", () => {
  render(
    <SettingsScreen
      profile={profileWithArtistIntelligence()}
      onChange={vi.fn()}
      onSaveProfile={vi.fn().mockResolvedValue(undefined)}
      onBack={vi.fn()}
    />,
  );

  for (const label of ["Artist name", "Artist stage", "Home market", "Genre", "Monthly budget", "TikTok", "Instagram", "YouTube", "X"]) {
    expect(screen.getByLabelText(label)).toBeEnabled();
  }
  expect(screen.getByLabelText("Connected artist")).toBeDisabled();
  expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
});
```

- [ ] **Step 4: Assert the production runtime exposes Save changes**

In the existing real-repository Settings navigation test, after opening Settings and before changing tabs, assert the default production runtime renders the disabled Save changes button:

```tsx
expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
```

- [ ] **Step 5: Run the focused tests and confirm they fail**

Run:

```bash
npm test -- src/settings-screen.test.tsx src/production-app-shell.test.tsx
```

Expected: FAIL because the current tab list has three entries, Appearance is still rendered in Account, manual fields are disabled, and the production fallback runtime does not expose `updateArtistProfile`.

### Task 2: Implement the four-tab Settings architecture and working saves

**Files:**
- Modify: `src/features/settings/SettingsScreen.tsx:36-67, 116-140, 245-320`
- Modify: `src/app/ProductionApp.tsx:170-180, 2062-2080`
- Modify: `src/design-system/components.tsx:120-150` (only if the profile save state needs to disable the textarea)

- [ ] **Step 1: Replace the tab list and panel routing**

Use this tab list and route the panels as follows:

```tsx
type SettingsTab = "profile" | "workspace" | "preferences" | "account";

const tabs: Array<{ id: SettingsTab; label: string }> = [
  { id: "profile", label: "Profile" },
  { id: "workspace", label: "Workspace" },
  { id: "preferences", label: "Preferences" },
  { id: "account", label: "Account" },
];
```

Use `grid-cols-4` for the tab rail, render `AccessSummary`/`AccessEmptyState` for `workspace`, render a new `PreferencesSettings` wrapper containing `AppearanceControl` for `preferences`, and render `AccountSettings` without appearance props for `account`.

- [ ] **Step 2: Enable manual profile fields**

Remove the unconditional `disabled` prop from Artist name, Artist stage, Home market, Genre, and Monthly budget; pass only `disabled={savePending}` if those controls should be locked during a request. Keep Connected artist as:

```tsx
<Field
  label="Connected artist"
  value={draft.spotify}
  onChange={() => undefined}
  disabled
  helper="Managed by your connected Spotify artist."
/>
```

Leave TikTok, Instagram, YouTube, and X enabled with their existing draft update handlers.

- [ ] **Step 3: Keep explicit save feedback on Profile**

Retain the existing draft/save state machine and ensure the Save changes action remains visible whenever `onSaveProfile` is supplied. The button stays disabled when `!dirty || savePending`; successful saves call `onChange(draft)` and show `Changes saved.`, while failures keep the draft and show the service error.

- [ ] **Step 4: Add the missing production profile-service wrapper**

Extend the default `ProductionApp` runtime object so the existing Supabase adapter exposes both methods:

```tsx
profileSetupService:
  profileSetupService ??
  ({
    saveSetupContext: (nextWorkspace, profile) =>
      createSupabaseProfileSetupService(getClient()).saveSetupContext(nextWorkspace, profile),
    updateArtistProfile: (nextWorkspace, profile) =>
      createSupabaseProfileSetupService(getClient()).updateArtistProfile!(nextWorkspace, profile),
  } satisfies ProductionProfileSetupService),
```

This makes `CleanProductionWorkspace` pass `onSaveProfile` in the live runtime and routes the complete profile draft to the existing `update_artist_profile` RPC.

- [ ] **Step 5: Move appearance into Preferences and leave Account focused**

Create `PreferencesSettings` with the current `AppearanceControl`. Remove `mode`, `resolvedMode`, and `onThemeModeChange` from `AccountSettings`; keep AccountIdentity, PasswordSettings, and sign-out there.

- [ ] **Step 6: Run the focused tests and confirm they pass**

Run:

```bash
npm test -- src/settings-screen.test.tsx src/production-app-shell.test.tsx
```

Expected: all SettingsScreen and production shell tests pass, including the new four-tab and save-wiring assertions.

### Task 3: Verify and publish the redesign

**Files:**
- No additional files.

- [ ] **Step 1: Run the full suite and build**

Run:

```bash
npm test
npm run build
```

Expected: all Vitest files pass and Vite builds successfully.

- [ ] **Step 2: Review the diff for unintended scope**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors; only the Settings UI, production runtime wrapper, tests, and this plan/spec are changed. Existing Playwright artifacts remain untracked and are not staged.

- [ ] **Step 3: Commit and push**

```bash
git add src/features/settings/SettingsScreen.tsx src/app/ProductionApp.tsx src/design-system/components.tsx src/settings-screen.test.tsx src/production-app-shell.test.tsx docs/superpowers/specs/2026-08-11-settings-information-architecture-design.md docs/superpowers/plans/2026-08-11-settings-information-architecture.md
git commit -m "feat: organize settings and enable profile editing"
git push origin main
```
