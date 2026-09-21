# Ops UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with review checkpoints.

**Goal:** Make the deployed Ops workspace feel like Desk's light, quiet, mobile-first product while preserving all existing routes, Supabase calls, and operator workflows.

**Architecture:** Keep ops/src/App.tsx as the behavior owner and replace only its presentation hierarchy and copy. Replace the dark Ops stylesheet with a scoped Desk-aligned token layer in ops/src/styles.css; use the real /logo.png asset and Manrope in the separate Ops Vite app. Add focused UI contract tests before implementation, then verify with the existing full test suite, Ops build, typecheck, and live smoke checks.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, Testing Library, lucide-react, Supabase client (unchanged).

---

### Task 1: Add failing UI contract tests

**Files:**
- Create: ops/src/ui-contract.test.ts
- Test target: ops/src/App.tsx, ops/src/styles.css, ops/index.html

- [ ] **Step 1: Write the failing contract tests**

Create tests that read the Ops source and assert the approved user-facing contract:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");

describe("Ops Desk-style UI contract", () => {
  it("uses the real brand and concise light-shell copy", () => {
    expect(appSource).toContain('src="/logo.png"');
    expect(appSource).toContain('label="Today"');
    expect(appSource).toContain('label="Pipeline"');
    expect(appSource).toContain('label="Meetings"');
    expect(appSource).not.toContain("Internal only");
    expect(appSource).not.toContain("Keep the signal");
    expect(appSource).not.toContain("The calm place for every artist conversation");
    expect(appSource).not.toContain("Operator context");
  });

  it("keeps one case-detail back action and removes redundant chrome actions", () => {
    expect(appSource).toContain('className="back-button"');
    expect(appSource).not.toContain("Operator settings");
    expect(appSource).not.toContain("One operator identity");
  });

  it("exposes finite meeting outcomes as a selector", () => {
    for (const label of ["Ready to start", "Needs follow-up", "Not ready", "Inquiry questions", "Not a fit"]) {
      expect(appSource).toContain(label);
    }
    expect(appSource).toContain('className="outcome-select"');
  });

  it("locks Ops to the light Desk tokens and protects mobile form focus", () => {
    expect(styles).toContain("--canvas: #f8f6f1");
    expect(styles).toContain('--font-ui: "Manrope"');
    expect(styles).not.toContain("color-scheme: dark");
    expect(styles).not.toContain("Playfair Display");
    expect(styles).toContain("@media (max-width: 760px)");
    expect(styles).toContain("font-size: 16px");
    expect(index).toContain("fonts.googleapis.com/css2?family=Manrope");
  });
});
```

- [ ] **Step 2: Run the new test and verify it fails for the old UI**

Run:

```bash
npm test -- --run ops/src/ui-contract.test.ts
```

Expected: FAIL because the current source still contains the dark-shell copy, lacks the real logo, and has no outcome-select contract.

- [ ] **Step 3: Commit the red test**

```bash
git add ops/src/ui-contract.test.ts
git commit -m "test: define Ops Desk-style UI contract"
```

### Task 2: Replace the Ops visual foundation with Desk light tokens

**Files:**
- Modify: ops/index.html
- Modify: ops/src/styles.css
- Copy: public/logo.png to ops/public/logo.png

- [ ] **Step 1: Add the Desk font and light viewport metadata**

In ops/index.html, keep the existing title, add the same Manrope preconnect/font links used by the Desk root app, set the theme color to #f8f6f1, and keep the standard accessible viewport. Do not add a dark-mode preference branch.

- [ ] **Step 2: Make the real logo available to the Ops deployment**

Create ops/public if needed and copy the existing binary public/logo.png into it so /logo.png resolves in both local Vite and the deployed Ops project.

- [ ] **Step 3: Replace dark CSS tokens and generic decoration**

Rewrite the top-level token block in ops/src/styles.css to use:

```css
:root {
  color-scheme: light;
  --canvas: #f8f6f1;
  --panel: #ffffff;
  --panel-raised: #ffffff;
  --ink: #111318;
  --muted: #4f5663;
  --soft: #6f7683;
  --line: rgb(17 19 24 / 0.1);
  --accent: #5f36d6;
  --accent-soft: #f0ebff;
  --success: #1e7a4c;
  --warning: #a9561b;
  --danger: #b42318;
  --radius-sm: 8px;
  --radius-md: 10px;
  --radius-lg: 12px;
  --font-ui: "Manrope", system-ui, sans-serif;
  font-family: var(--font-ui);
  background: var(--canvas);
  font-synthesis: none;
}
```

Remove dark gradients, radial rings, DM Sans/DM Mono/Playfair/Georgia declarations, glass/backdrop effects, and purple/coral/mint surface gradients. Rebuild shell, sidebar, topbar, panel, button, form, badge, and modal rules around white surfaces, 1px borders, visible focus rings, and the single accent token. Keep class names stable wherever possible so markup changes remain small.

- [ ] **Step 4: Add responsive input sizing**

Add a mobile media rule covering login-form inputs, modal inputs/selects, inline-form inputs/selects, transcript-editor textarea/select, and filter inputs/selects with font-size: 16px, while leaving normal viewport zoom behavior enabled.

- [ ] **Step 5: Run the focused UI contract test**

Run:

```bash
npm test -- --run ops/src/ui-contract.test.ts
```

Expected: token/font/mobile assertions pass; copy/markup assertions remain red until Tasks 3 and 4.

### Task 3: Refactor the shell and page hierarchy without changing behavior

**Files:**
- Modify: ops/src/App.tsx
- Test: ops/src/ui-contract.test.ts

- [ ] **Step 1: Replace the sidebar brand mark with the real asset**

Render a Desk-style brand lockup using <img src="/logo.png" alt="" />, a short Ops label, and the existing nav buttons. Keep the Today, Pipeline, and Meetings callbacks unchanged. Keep the signed-in email and sign-out control at the rail bottom.

- [ ] **Step 2: Simplify top chrome**

Keep the mobile menu and current-page label. Remove the Internal only secure pill and unused settings button. Preserve aria-label values for the mobile menu and existing interactive controls.

- [ ] **Step 3: Simplify login copy and structure**

Keep the existing password and magic-link handlers. Replace the split hero copy with a light form-first layout:

```tsx
<div className="login-shell">
  <div className="login-panel">
    <div className="login-brand">
      <img src="/logo.png" alt="" />
      <span>Ops</span>
    </div>
    <div className="login-copy">
      <h1>Sign in</h1>
    </div>
    <form ...>
      ...
      <button className="primary-button full-width">Sign in</button>
      <button type="button" className="text-button">Use a magic link</button>
    </form>
  </div>
</div>
```

Keep existing error/success messages, labels, autocomplete attributes, and required fields. Remove the slogan, stats, internal-only footer, and explanatory paragraphs.

- [ ] **Step 4: Simplify page headers and Today**

Change PageHeader to render only a title and optional action. Update titles to Today, Pipeline, and Meetings; remove the eyebrow, description, date stamp, and relationship-map/operator-brief strings. Keep Today’s three work queues and card actions, but remove the redundant signal-strip; do not change listToday() or grouping logic.

- [ ] **Step 5: Remove duplicate case-detail chrome**

Keep the existing single Back to pipeline button in the case content header. Remove the Desk-note explanatory block and keep the Desk linking card itself. Preserve stage changes, contact information, music links, meeting data, follow-ups, activity, and workspace linking.

- [ ] **Step 6: Run the focused contract test**

Run:

```bash
npm test -- --run ops/src/ui-contract.test.ts
```

Expected: shell, copy, and duplicate-action assertions pass; transcript selector assertions remain until Task 4.

- [ ] **Step 7: Commit the shell refactor**

```bash
git add ops/index.html ops/public/logo.png ops/src/styles.css ops/src/App.tsx
git commit -m "feat: align Ops shell with Desk light UI"
```

### Task 4: Make meetings and transcript capture explicit

**Files:**
- Modify: ops/src/App.tsx
- Modify: ops/src/styles.css
- Test: ops/src/ui-contract.test.ts

- [ ] **Step 1: Keep meeting creation finite and clear**

Keep meeting_type with exactly Onboarding, Check-in, Monthly review, and Other. Keep the datetime-local control. Present the compact form under Schedule meeting and preserve createMeeting.

- [ ] **Step 2: Make transcript state visible**

In each meeting detail row, a missing transcript gets a compact Add transcript action; a saved transcript gets a readable preview and Edit transcript. Opening either action seeds the editor with existing transcript/outcome values. Keep the textarea and cancellation path. Use Save transcript as the only submit action.

- [ ] **Step 3: Use the schema outcome options**

Render a labeled outcome-select with these exact values:

```tsx
<option value="">Choose outcome</option>
<option value="ready_to_start">Ready to start</option>
<option value="needs_follow_up">Needs follow-up</option>
<option value="not_ready">Not ready</option>
<option value="inquiry_questions">Inquiry questions</option>
<option value="not_a_fit">Not a fit</option>
```

Do not add a free-text outcome input. Preserve updateMeeting payload fields: transcript, outcome, completed_at, processing_status: "unprocessed", and processed_at: null.

- [ ] **Step 4: Clarify status without adding controls**

Keep processing status as a read-only badge. Use Transcript missing only as a short state label next to Add transcript; remove warning-style paragraph copy.

- [ ] **Step 5: Run focused tests**

Run:

```bash
npm test -- --run ops/src/ui-contract.test.ts ops/src/lib/opsService.test.ts ops/src/lib/opsApi.test.ts
```

Expected: all focused tests pass.

- [ ] **Step 6: Commit the transcript UX**

```bash
git add ops/src/App.tsx ops/src/styles.css ops/src/ui-contract.test.ts
git commit -m "feat: clarify Ops meeting transcript workflow"
```

### Task 5: Verify the complete UI and deployment

**Files:**
- Verify: ops/src/App.tsx
- Verify: ops/src/styles.css
- Verify: ops/index.html

- [ ] **Step 1: Run the full repository test suite**

Run:

```bash
npm test
```

Expected: zero failures.

- [ ] **Step 2: Run Ops typecheck and production build**

Run:

```bash
npx tsc -p ops/tsconfig.json --noEmit
npm run build --prefix ops
```

Expected: both commands exit 0. A pre-existing Tailwind content warning is acceptable only if the build completes and no new warning appears.

- [ ] **Step 3: Verify mobile CSS and asset output**

Inspect the built bundle and ops/dist to confirm /logo.png exists, light token values are present, the mobile input rule sets 16px text, and no old login slogan remains in source.

- [ ] **Step 4: Smoke-test the live Ops URL**

Open https://ops.ordersounds.com, confirm the login shell is light, title is OrderSounds Ops, and there is no console/runtime error. If an authenticated session is available, open a case, expand a meeting, add a transcript, choose an outcome, cancel once, then save and confirm the preview returns.

- [ ] **Step 5: Review the final diff**

Run:

```bash
git diff --check
git status --short
git log -3 --oneline
```

Expected: no whitespace errors, only intended Ops UI files changed, and all verification evidence recorded before handoff.

