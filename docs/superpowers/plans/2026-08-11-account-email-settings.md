# Account Email Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the authenticated account email as a read-only field in the Settings Account tab.

**Architecture:** Keep the email in the auth/session model (`ProductionUser.email`) and pass it through the existing `ProductionApp` → `CleanProductionWorkspace` → `SettingsScreen` path. Render a dedicated Account identity section using the shared `Field` component with a new `readOnly` option; do not add email to the artist profile model or create an email-change flow.

**Tech Stack:** React, TypeScript, shared design-system components, Vitest, Testing Library, Vite.

---

### Task 1: Add regression coverage for the Account email

**Files:**
- Modify: `src/settings-screen.test.tsx`
- Modify: `src/production-app-shell.test.tsx`

- [ ] **Step 1: Write the failing SettingsScreen test**

Add a test that renders `SettingsScreen` with `accountEmail="artist@example.com"`, opens the Account tab, and asserts the field is visible, has the expected value, and is read-only:

```tsx
it("shows the signed-in account email in Account", () => {
  render(
    <SettingsScreen
      profile={profileWithArtistIntelligence()}
      onChange={vi.fn()}
      onBack={vi.fn()}
      accountEmail="artist@example.com"
    />,
  );

  fireEvent.click(screen.getByRole("tab", { name: "Account" }));

  const email = screen.getByLabelText("Email address");
  expect(email).toHaveValue("artist@example.com");
  expect(email).toHaveAttribute("readonly");
  expect(email).not.toBeDisabled();
});
```

- [ ] **Step 2: Add the production shell data-flow assertion**

In the existing Settings navigation test in `src/production-app-shell.test.tsx`, open the Account tab after opening Settings and assert the session fixture email is rendered as the read-only Email address field:

```tsx
fireEvent.click(screen.getByRole("tab", { name: "Account" }));
expect(screen.getByLabelText("Email address")).toHaveValue("artist@example.com");
expect(screen.getByLabelText("Email address")).toHaveAttribute("readonly");
```

- [ ] **Step 3: Run the focused tests and confirm they fail**

Run:

```bash
npx vitest run src/settings-screen.test.tsx src/production-app-shell.test.tsx
```

Expected: FAIL because `SettingsScreen` does not yet accept `accountEmail`, the shared `Field` has no `readOnly` prop, and the Account tab has no Email address field.

### Task 2: Wire the authenticated email and render it read-only

**Files:**
- Modify: `src/design-system/components.tsx:75-120`
- Modify: `src/features/settings/SettingsScreen.tsx:9-70, 285-325`
- Modify: `src/app/ProductionApp.tsx:2062-2080`

- [ ] **Step 1: Add optional read-only support to the shared Field**

Extend the `Field` props with `readOnly?: boolean` and forward it to the input:

```tsx
readOnly,
// ...
<input
  // existing props
  readOnly={readOnly}
  onChange={(event) => onChange(event.target.value)}
  className={cn(
    "mt-1 w-full bg-transparent text-[13px] font-bold text-foreground outline-none placeholder:text-muted-foreground/60",
    readOnly && "cursor-default",
  )}
/>
```

- [ ] **Step 2: Pass `accountEmail` into SettingsScreen**

Add `accountEmail?: string` to `SettingsScreen` props, pass it to `AccountSettings`, and provide `analyticsUser.email` from the existing `CleanProductionWorkspace` render:

```tsx
<SettingsScreen
  // existing props
  accountEmail={analyticsUser.email}
  // existing props
/>
```

- [ ] **Step 3: Render the Account identity section**

Add `accountEmail?: string` to `AccountSettings`, normalize the value, and render this section before Appearance:

```tsx
function AccountIdentity({ accountEmail }: { accountEmail?: string }) {
  const displayEmail = accountEmail?.trim() || "Email unavailable";

  return (
    <section className="rounded-[16px] border border-foreground/10 bg-background p-5 shadow-sm">
      <p className="text-[11px] font-bold text-foreground">Account email</p>
      <p className="mt-1 text-[12px] font-semibold text-muted-foreground">
        Used to sign in and recover this account.
      </p>
      <div className="mt-4">
        <Field
          label="Email address"
          value={displayEmail}
          onChange={() => undefined}
          type="email"
          readOnly
        />
      </div>
    </section>
  );
}
```

Render `<AccountIdentity accountEmail={accountEmail} />` as the first child of the Account tab’s existing `space-y-4` container.

- [ ] **Step 4: Run focused tests and confirm they pass**

Run:

```bash
npx vitest run src/settings-screen.test.tsx src/production-app-shell.test.tsx
```

Expected: all tests in both files pass.

### Task 3: Verify the complete change

**Files:**
- No additional files.

- [ ] **Step 1: Run typecheck/build and the full test suite**

Run:

```bash
npm run build
npx vitest run
```

Expected: the production build succeeds and the full Vitest suite passes with no new failures.

- [ ] **Step 2: Inspect the final diff**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors; only the intended settings, design-system, app-shell test, and settings test changes remain in addition to any pre-existing user worktree changes.

- [ ] **Step 3: Commit the implementation**

```bash
git add src/design-system/components.tsx src/features/settings/SettingsScreen.tsx src/app/ProductionApp.tsx src/settings-screen.test.tsx src/production-app-shell.test.tsx
git commit -m "feat: show account email in settings"
```
