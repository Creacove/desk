# Private Beta Entry Restoration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the historical paywall beta-code flow behind the existing feature flag, changing only its reveal label to a tiny, low-contrast `BETA`.

**Architecture:** Reconnect the existing `PaywallPreviewScreen` beta form to the existing `SpotifyIdentityGate` billing callback. The client-side flag controls whether the quiet trigger is discoverable; the existing authenticated Edge Function and database RPC continue to validate every code. No new route, API, schema, or payment mode is added.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind utility classes, Vitest, Testing Library, Supabase Edge Functions.

---

## File Map

- Modify `src/features/onboarding/FrontDoorScreens.tsx`: restore the historical beta trigger, inline form, and optional component props; change the trigger copy and resting-state contrast only.
- Modify `src/app/ProductionApp.tsx`: restore the existing callback from `SpotifyIdentityGate` and pass the existing `VITE_PRIVATE_BETA_ENABLED` flag into the paywall component.
- Modify `src/private-beta-ui.test.tsx`: replace the stale removal assertion with disabled/enabled UI coverage while retaining the billing-service contract test.
- Do not modify `supabase/functions/redeem-private-beta-code/index.ts`, migrations, billing service, or deployment configuration; those already provide the required behavior and Netlify production already sets `VITE_PRIVATE_BETA_ENABLED=true`.

### Task 1: Add Regression Tests

**Files:**
- Modify: `src/private-beta-ui.test.tsx`

- [ ] **Step 1: Extend the test imports and add enabled-flow fixtures.**

Add `fireEvent` to the Testing Library import. Keep the existing `preview` fixture and add the callback assertions in the new test instead of introducing a second preview shape.

```tsx
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
```

- [ ] **Step 2: Replace the stale phased-out assertion with the disabled-state test.**

Replace the test named `phases beta-code entry out of the paywall while keeping paid checkout primary` with a test that explicitly passes `privateBetaEnabled={false}` and asserts the payment controls remain while the beta affordance is absent.

```tsx
it("hides the beta affordance when private beta is disabled", () => {
  const onSubscribe = vi.fn();
  render(
    <PaywallPreviewScreen
      preview={preview}
      onSubscribe={onSubscribe}
      onBack={() => undefined}
      privateBetaEnabled={false}
      onRedeemPrivateBeta={() => undefined}
    />,
  );

  expect(screen.getByRole("button", { name: /subscribe \$20\/month/i })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "BETA" })).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/beta code|access code/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 3: Add the enabled historical flow test.**

Add this test below the disabled-state test. It proves the new trigger is quiet but discoverable by its accessible name, reveals the old form without removing the payment action, and uppercases the submitted value before invoking the callback.

```tsx
it("restores the historical beta form behind the faint BETA trigger", () => {
  const onRedeemPrivateBeta = vi.fn();
  render(
    <PaywallPreviewScreen
      preview={preview}
      onSubscribe={() => undefined}
      onBack={() => undefined}
      privateBetaEnabled
      onRedeemPrivateBeta={onRedeemPrivateBeta}
    />,
  );

  fireEvent.click(screen.getByRole("button", { name: "BETA" }));

  expect(screen.getByLabelText(/private-beta access code/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /subscribe \$20\/month/i })).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText(/private-beta access code/i), { target: { value: " beta-abcd-1234 " } });
  fireEvent.submit(screen.getByRole("button", { name: /activate beta access/i }).closest("form")!);

  expect(onRedeemPrivateBeta).toHaveBeenCalledWith("BETA-ABCD-1234");
});
```

- [ ] **Step 4: Run the new tests and verify they fail for the expected missing props/behavior.**

Run:

```powershell
npm test -- src/private-beta-ui.test.tsx
```

Expected: the suite fails because `PaywallPreviewScreen` does not currently accept the beta props or render the `BETA` trigger.

### Task 2: Restore the Existing Flow and Quiet Trigger

**Files:**
- Modify: `src/features/onboarding/FrontDoorScreens.tsx:1,253-470`
- Modify: `src/app/ProductionApp.tsx:2140-2205`

- [ ] **Step 1: Restore the historical paywall props and local state.**

In `FrontDoorScreens.tsx`, restore `FormEvent` in the React import, add the two optional props to `PaywallPreviewScreen`, and initialize the historical beta form state beside `selectedInterval`:

```tsx
import { useState, type FormEvent, type ReactNode } from "react";
```

```tsx
onRedeemPrivateBeta,
privateBetaEnabled = false,
```

```tsx
onRedeemPrivateBeta?: (code: string) => void | Promise<void>;
privateBetaEnabled?: boolean;
```

```tsx
const [showBetaCode, setShowBetaCode] = useState(false);
const [betaCode, setBetaCode] = useState("");
```

- [ ] **Step 2: Restore the inline beta form in the historical location.**

Place the conditional block immediately after the existing subscribe/provider controls and before the artist-source link. Preserve the old form copy, normalization, disabled behavior, and callback. Use the exact trigger label `BETA`; only its resting text styling differs from the historical link.

```tsx
{privateBetaEnabled && onRedeemPrivateBeta ? (
  <div className="mt-3 border-t border-foreground/8 pt-3">
    {!showBetaCode ? (
      <button
        type="button"
        onClick={() => setShowBetaCode(true)}
        aria-label="BETA"
        className="w-full text-center text-[9px] font-semibold text-muted-foreground/25 underline decoration-transparent underline-offset-4 transition-colors hover:text-muted-foreground/70 hover:decoration-foreground/20 focus-visible:text-foreground focus-visible:decoration-foreground/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/25"
      >
        BETA
      </button>
    ) : (
      <form
        className="rounded-[12px] border border-foreground/10 bg-foreground/[0.025] p-3"
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          const normalized = betaCode.trim().toUpperCase();
          if (normalized) void onRedeemPrivateBeta(normalized);
        }}
      >
        <p className="text-[11px] font-black text-foreground">Private-beta access</p>
        <p className="mt-1 text-[9px] font-semibold leading-relaxed text-muted-foreground">Enter one of the codes included in your invitation.</p>
        <label className="mt-3 block text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground" htmlFor="private-beta-code">Private-beta access code</label>
        <input
          id="private-beta-code"
          value={betaCode}
          onChange={(event) => setBetaCode(event.target.value)}
          disabled={pending}
          autoComplete="off"
          spellCheck={false}
          className="mt-1.5 h-9 w-full rounded-[9px] border border-foreground/12 bg-background px-3 font-mono text-[11px] font-bold uppercase text-foreground outline-none ring-brand-accent/30 focus:ring-2"
        />
        <button type="submit" disabled={pending || !betaCode.trim()} className="mt-2 inline-flex h-9 w-full items-center justify-center rounded-[9px] border border-foreground/12 bg-background text-[10px] font-bold text-foreground transition-colors hover:bg-foreground/5 disabled:opacity-50">
          {pending ? "Activating your Desk..." : "Activate beta access"}
        </button>
        <p className="mt-2 text-[9px] font-semibold leading-relaxed text-muted-foreground">A valid invitation provides 30 days of complimentary access. No card is required, and you will not be charged automatically.</p>
      </form>
    )}
  </div>
) : null}
```

- [ ] **Step 3: Reconnect the existing callback in `SpotifyIdentityGate`.**

Add this function before the `if (checkoutPreview)` return. It must use the already-created preview session id and the existing event names, then hand the returned workspace to the existing setup transition.

```tsx
async function redeemPrivateBetaCode(code: string) {
  if (!checkoutPreview || !billingService?.redeemPrivateBetaCode) return;
  try {
    setSelectPending(true);
    setMessage(null);
    trackEvent("beta code submitted", { is_test_user: isTestUserEmail(user?.email) });
    const result = await billingService.redeemPrivateBetaCode({ checkoutSessionId: checkoutPreview.checkoutSessionId, code });
    trackEvent("beta invitation activated", {
      artist_workspace_id: result.workspace.artistWorkspaceId,
      access_source: "private_beta",
      is_test_user: isTestUserEmail(user?.email),
    });
    onWorkspaceReady(result.workspace);
  } catch (redemptionError) {
    setMessage(readErrorMessage(redemptionError, "Private-beta access could not be activated."));
  } finally {
    setSelectPending(false);
  }
}
```

- [ ] **Step 4: Pass the existing flag and callback into the paywall.**

Add these props to the current `PaywallPreviewScreen` call in `SpotifyIdentityGate`, leaving all existing paywall props intact:

```tsx
privateBetaEnabled={import.meta.env.VITE_PRIVATE_BETA_ENABLED === "true"}
onRedeemPrivateBeta={redeemPrivateBetaCode}
```

- [ ] **Step 5: Run the focused tests and confirm they pass.**

Run:

```powershell
npm test -- src/private-beta-ui.test.tsx
```

Expected: all private-beta UI and billing-service tests pass.

- [ ] **Step 6: Commit the implementation.**

```powershell
git add -- src/features/onboarding/FrontDoorScreens.tsx src/app/ProductionApp.tsx src/private-beta-ui.test.tsx
git commit -m "feat: restore private beta paywall entry"
```

### Task 3: Full Verification

**Files:**
- No additional files expected.

- [ ] **Step 1: Run the full test suite.**

Run:

```powershell
npm test
```

Expected: Vitest exits with code 0 and all suites pass.

- [ ] **Step 2: Run the production build.**

Run:

```powershell
npm run build
```

Expected: Vite completes successfully and writes the production bundle to `dist`.

- [ ] **Step 3: Review the final diff and working tree.**

Run:

```powershell
git diff HEAD^ --check
git status --short --branch
```

Expected: no whitespace errors and no uncommitted implementation changes. The only implementation commit changes the two onboarding files and the private-beta UI test; deployment and backend files remain untouched.
