# Ops UI redesign design

## Reading of the brief

OrderSounds Ops is an internal operator workspace. It should feel like the existing Desk product: light, quiet, mobile-first, and action-oriented. The redesign must preserve the current Ops navigation, Supabase calls, and operational workflows while removing decorative copy and duplicated controls.

## Goals

- Replace the dark, purple-heavy Ops shell with Desk's light visual language.
- Use the real OrderSounds mark from `/logo.png`, Manrope typography, Desk spacing, and restrained purple accent tokens.
- Keep `Today`, `Pipeline`, `Meetings`, and `Case detail` as the existing destinations.
- Reduce visible copy to labels that help an operator decide or act.
- Keep one clear navigation/back action per context.
- Make the transcript workflow discoverable without changing the database contract.
- Make finite choices selectors wherever the existing schema already defines finite values.
- Prevent mobile input focus zoom while preserving browser zoom for accessibility.

## Non-goals

- No changes to Supabase tables, RPCs, RLS, authentication, or API method signatures.
- No new Ops navigation or data model.
- No generated decorative imagery. The product mark and operational data are the appropriate visual material for this tool.
- No dark-mode toggle or alternate dark visual system in Ops.

## Visual system

Ops will use a scoped Desk-aligned token layer rather than importing the root app's Tailwind tree. This keeps the separate Vite deployment stable while making the visual contract explicit:

- Warm light canvas, white elevated surfaces, dark ink text, muted secondary text, subtle borders.
- Desk's existing purple brand accent for primary actions, focus rings, and selected states.
- Manrope for display, UI, and body text; no DM Sans, DM Mono, Playfair, or Georgia in Ops.
- One restrained radius scale and 1px borders; no purple gradients, decorative rings, glass effects, or dark-only controls.
- Short state transitions only, with a reduced-motion fallback.

## Information hierarchy and screen behavior

### Login

The first viewport contains the real mark, a short `Ops` label, the two credential fields, one primary `Sign in` action, and one secondary `Use a magic link` action. The existing authentication behavior and error/success messages remain. The slogan, metrics, internal-only strip, explanatory paragraphs, and fake control-room branding are removed. Desktop may use a quiet split layout; mobile collapses to the form without a decorative hero panel.

### Authenticated shell

The desktop rail contains the mark, `Today`, `Pipeline`, and `Meetings`, followed by the signed-in operator and sign-out. The top bar contains only the current page label and the mobile menu trigger. The secure pill and unused settings icon are removed. On mobile, the existing drawer remains the navigation mechanism; its styling matches the light Desk rail.

### Today

The page title is `Today`. Keep the three useful work queues and their actions. Remove the redundant metric strip, date stamp, operator-brief eyebrow, and explanatory header paragraph. Cards lead with the case, state, due time, and next action. Empty, loading, and error states stay concise and actionable.

### Pipeline

The page title is `Pipeline`. Keep search, stage filtering, case count, table/list rows, and the new-case action. Remove the relationship-map eyebrow and explanatory sentence. Stage remains a selector because its allowed values are finite and already defined by the schema.

### Meetings

The page title is `Meetings`. Keep the list and existing case navigation. Remove the conversation-log eyebrow and explanatory sentence. Meeting type remains a selector with the four schema values. Processing status is displayed as a compact status badge, not an editable free-text field.

### Case detail

Use one back control at the start of the content header. The top bar must not provide a second back-like action. The title, stage selector, source, and created date form the first decision block. Contact and music source follow. Meetings, follow-ups, activity, and Desk linking retain their current capabilities but use a clear action order and shorter copy.

## Transcript workflow

The existing transcript functionality is retained and made explicit:

1. An operator opens a case and sees the `Meetings` section immediately after contact context.
2. Each meeting row shows meeting type, schedule, and processing status.
3. A meeting without a transcript shows a compact `Add transcript` action, not a warning paragraph.
4. Selecting it expands an editor in that meeting row with a large transcript field and an `Outcome` selector.
5. The outcome selector exposes only the database's finite values: `Ready to start`, `Needs follow-up`, `Not ready`, `Inquiry questions`, and `Not a fit`, plus an empty placeholder before completion.
6. Saving stores the transcript, outcome, completion timestamp, and existing unprocessed state through `updateMeeting`; cancellation closes the editor without mutation.
7. A saved transcript shows a readable preview with `Edit transcript`; the Today queue can still surface `Transcript ready` using the existing RPC.

The UI should make this flow visible on both desktop and mobile. No new transcript storage or processing API is needed in this pass.

## UX and accessibility rules

- Preserve labels, semantic form controls, keyboard focus, and visible focus rings.
- Keep select controls for finite domain values: stage, meeting type, outcome, and release timing.
- Use 16px minimum input/select/textarea text at mobile widths to avoid iOS focus zoom.
- Do not disable pinch zoom via a restrictive viewport setting.
- Keep destructive/error states inline and short; do not hide errors in transient-only toasts.
- Keep primary actions visually distinct and secondary actions quiet.
- Avoid duplicate actions with the same intent.

## Developer experience and verification

- Keep `ops/src/App.tsx` behavior and `ops/src/lib/*` contracts stable unless a small presentational extraction makes the hierarchy clearer.
- Keep the Desk-aligned token layer scoped to Ops so the root Desk app cannot regress.
- Add contract tests for light-only tokens, removal of duplicate chrome, finite outcome options, and mobile input sizing.
- Run the focused Ops tests, TypeScript check, production build, and full repository test suite before handoff.
- Perform a live smoke check at `https://ops.ordersounds.com` after deployment.

