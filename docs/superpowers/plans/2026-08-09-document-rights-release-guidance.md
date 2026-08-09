# Document, Rights, and Release Guidance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a production-quality song document, rights-confirmation, and Manager-led release workflow that uses the existing Ordersounds data model and speaks only in customer-facing language.

**Architecture:** Keep `MusicScreens` as the song-room coordinator, but extract the clipped document chooser and rights presentation helpers into focused components. Reuse existing `music_assets`, native song documents, split tables, hashed public tokens, operating events, Manager song packet, and linked-mission tools; add no parallel storage or mission system. Public split functions remain capability-token scoped, while owner actions continue through the authenticated repository.

**Tech Stack:** React 18, TypeScript, Tailwind, Radix Dialog where already present, Vitest/Testing Library, Supabase/Postgres/Edge Functions, Resend, Netlify.

---

## File map

- Create `src/features/music/SongDocumentActions.tsx`: viewport-level responsive document action overlay.
- Create `src/features/music/songRights.ts`: deterministic rights-state, allocation, export, and customer-error helpers.
- Create `src/song-document-actions.test.tsx`: clipping-independent overlay and copy behavior.
- Create `src/song-rights.test.ts`: state/math/export behavior.
- Create `src/customer-facing-copy.test.ts`: source-level guard against rendered infrastructure language.
- Modify `src/features/music/MusicScreens.tsx`: integrate extracted overlay, polish upload/edit dialogs, render imported/external/structured rights states, download export.
- Modify `src/types/cleanProduction.ts`: expose external rights-document data and correction submission shape without exposing recipient approval state.
- Modify `src/services/productionSupabase.ts`: map split-sheet assets, normalize public confirmation payloads, submit correction reasons, and return customer-safe errors.
- Modify `src/features/music/SplitConfirmationPortal.tsx`: recipient-first review, allocation totals, correction flow, and neutral receipts.
- Modify `supabase/functions/send-split-confirmations/index.ts`: personal email with role, both shares, expiry, fallback link, pending-only resend, escaped content, partial-delivery result.
- Modify `supabase/functions/load-split-confirmation/index.ts`: public payload without contact details or collaborator approval states; neutral terminal-link response.
- Modify `supabase/functions/confirm-split/index.ts`: required correction reason, idempotent terminal response, neutral errors, dispute event payload.
- Modify `src/split-confirmation-portal.test.tsx`, `src/split-confirmation-functions.test.ts`, and `src/production-supabase-service.test.ts`: public and repository contracts.
- Modify `supabase/functions/_shared/openaiManagerConversation.ts` and `supabase/functions/_shared/manager-conversation/agentLoop.ts`: one-question unreleased-song guidance using current readiness and existing tools.
- Modify `src/openai-manager-conversation-function.test.ts`, `src/manager-agent-loop.test.ts`, and `src/manager-conversation-song-scope.test.ts`: focused unreleased/released regression coverage.
- Modify `src/production-app-shell.test.tsx`: signed-in song-room integration, external split records, overlay copy, immediate persistence, and error sanitization.
- Modify `docs/superpowers/specs/2026-08-09-document-rights-release-guidance-design.md` only if implementation discovery requires a documented clarification.

### Task 1: Document chooser and customer-facing upload overlays

**Files:**
- Create: `src/features/music/SongDocumentActions.tsx`
- Create: `src/song-document-actions.test.tsx`
- Modify: `src/features/music/MusicScreens.tsx`
- Test: `src/production-app-shell.test.tsx`

- [ ] **Step 1: Write failing component tests for the document overlay**

Render the trigger inside an `overflow-hidden` ancestor and assert the open UI is portalled to `document.body`, contains `Write here`, `Ask Manager to draft`, `Lyrics`, `EPK / press kit`, `Press material`, `Split sheet / rights document`, and `Other document`, closes on Escape, and invokes the selected callback.

```tsx
expect(screen.getByRole("dialog", { name: "Add document" }).parentElement).toBe(document.body);
fireEvent.keyDown(document, { key: "Escape" });
expect(screen.queryByRole("dialog", { name: "Add document" })).not.toBeInTheDocument();
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/song-document-actions.test.tsx`
Expected: FAIL because `SongDocumentActions` does not exist.

- [ ] **Step 3: Implement the viewport-level overlay and integrate it**

Use `createPortal(..., document.body)`, a fixed backdrop, desktop anchored panel, mobile bottom sheet, focus on first action, Escape/outside-close, focus restoration, and callbacks that close before routing. Replace the absolutely positioned Documents menu in `MusicScreens.tsx`. Include `split_sheet` in typed uploads.

- [ ] **Step 4: Write failing upload-dialog copy tests**

Add an integration assertion that the audio chooser contains `Add a mix, master, instrumental, or stems for this song.`, shows filename/type/size after selection, and does not contain `large-file path`, `private upload path`, `storage bucket`, or `provider trace`.

- [ ] **Step 5: Run the focused integration test and verify RED**

Run: `npm test -- src/production-app-shell.test.tsx -t "uses customer-facing upload copy"`
Expected: FAIL on the existing infrastructure sentence.

- [ ] **Step 6: Implement the copy contract in song overlays**

Change the upload eyebrow to `Add to song`, title to `Upload audio`/the specific asset action, chooser to `Choose an audio file`, selected summary to filename/format/size, and button to `Upload audio` or `Upload <asset>`. Preserve existing inline progress and retry, but include the filename and translate thrown upload errors through one customer-safe helper. Audit create/import, metadata edit, native document edit, and share dialogs for infrastructure wording and raw errors.

- [ ] **Step 7: Run focused tests and commit**

Run: `npm test -- src/song-document-actions.test.tsx src/production-app-shell.test.tsx`
Expected: PASS.

Commit: `git commit -m "fix: make song document and upload overlays usable"`

### Task 2: Deterministic owner rights states and external records

**Files:**
- Create: `src/features/music/songRights.ts`
- Create: `src/song-rights.test.ts`
- Modify: `src/features/music/MusicScreens.tsx`
- Modify: `src/types/cleanProduction.ts`
- Modify: `src/services/productionSupabase.ts`
- Test: `src/production-app-shell.test.tsx`

- [ ] **Step 1: Write failing rights-state and math tests**

Define tests for `Not managed`, `Draft`, `Ready`, `Awaiting`, `Partially confirmed`, `Disputed`, `Confirmed`, and `Document on file`. Assert one confirmed 50/50 contributor plus one pending 50/50 contributor yields allocation totals 100/100 and confirmation progress `1 of 2 confirmed`, never `100% confirmed`.

```ts
expect(deriveSongRightsState(song)).toMatchObject({
  state: "partially_confirmed",
  publishingAllocated: 100,
  masterAllocated: 100,
  confirmedCount: 1,
  contributorCount: 2,
});
```

- [ ] **Step 2: Run the unit test and verify RED**

Run: `npm test -- src/song-rights.test.ts`
Expected: FAIL because the helper does not exist.

- [ ] **Step 3: Implement state helpers and external record mapping**

Derive state only from structured split status, independent totals, collaborator confirmations, source kind, and a `split_sheet` music asset. Extend the song view model with an optional external record `{ assetId, label, status }`. Map uploaded split-sheet assets from existing `music_assets`/`uploaded_files`; do not add a new rights table.

- [ ] **Step 4: Write failing owner UI tests**

Assert a released Spotify import with no structured splits shows `Rights not managed in Ordersounds`, explains that public catalog data does not verify ownership, and offers `Upload existing split sheet` plus `Set up splits here`. Assert an uploaded record shows `Document on file — not independently verified` with download/open access. Assert each state renders one primary action and the ledger labels separate `Publishing` and `Master` columns.

- [ ] **Step 5: Run owner UI tests and verify RED**

Run: `npm test -- src/production-app-shell.test.tsx -t "rights"`
Expected: FAIL on imported/external state copy or missing controls.

- [ ] **Step 6: Rebuild the Rights tab around the state helper**

Render a quiet state header, owner-only email, separate share columns, warnings only for incomplete totals, pending-only resend, disputed correction note, and one primary action. Allow adding until either total would exceed 100; once both reach 100, replace the form with review/send. Keep approval history collapsed. Route external upload to asset type `split_sheet` and access through `getAssetAccessUrl`.

- [ ] **Step 7: Implement and test portable export**

Create a text/CSV-safe export from the current immutable view containing song, proposal date/version label, contributors, roles, both allocations, confirmation state/timestamps when available, and `Ordersounds confirmation record — not legal advice or a qualified electronic-signature certificate.` Trigger a Blob download from a quiet `Export split record` action only when confirmed.

- [ ] **Step 8: Run focused tests and commit**

Run: `npm test -- src/song-rights.test.ts src/production-app-shell.test.tsx src/production-supabase-service.test.ts`
Expected: PASS.

Commit: `git commit -m "feat: make song rights states explicit"`

### Task 3: Split email and public function contracts

**Files:**
- Modify: `supabase/functions/send-split-confirmations/index.ts`
- Modify: `supabase/functions/load-split-confirmation/index.ts`
- Modify: `supabase/functions/confirm-split/index.ts`
- Modify: `src/split-confirmation-functions.test.ts`
- Modify: `src/types/cleanProduction.ts`
- Modify: `src/services/productionSupabase.ts`
- Modify: `src/production-supabase-service.test.ts`

- [ ] **Step 1: Write failing Edge Function contract tests**

Assert email rendering receives contributor role, publishing share, master share, expiry and fallback URL; all interpolated values use `escapeHtml`. Assert load output excludes `email`, `approval_status`, missions, and conversations. Assert correction requires non-empty `correctionReason`, records it in `confirmation_text` and the dispute operating event, and terminal links return a neutral final payload.

- [ ] **Step 2: Run the contract test and verify RED**

Run: `npm test -- src/split-confirmation-functions.test.ts`
Expected: FAIL because the current email omits shares/expiry and public rows include approval.

- [ ] **Step 3: Implement personal email and safe delivery behavior**

Render a restrained Ordersounds email with song, recipient, role, their two shares, 14-day expiry, one `Review split` button, and visible fallback URL. Supersede active tokens only when a revised proposal is sent; on resend, target pending contributors and leave confirmed recipients untouched. Return `{ status: "sent", sent, failed }` and keep failed recipients retryable rather than aborting the whole loop.

- [ ] **Step 4: Implement public payload privacy and correction contract**

Return full allocation rows as `{ name, role, publishingShare, masterShare }` only. Accept `{ decision: "confirmed" | "correction_requested", correctionReason? }`; require a trimmed reason for correction, store it, mark the proposal disputed, supersede remaining active links, and record a customer-readable event. Return neutral `unavailable` or completed receipts for missing/expired/used/superseded links without leaking storage/database errors.

- [ ] **Step 5: Update repository normalization and verify RED/GREEN**

Remove `approval` from public contributor types, submit `correctionReason`, and map terminal status without throwing a raw function message. Add service tests for both decisions and customer-safe failures.

Run: `npm test -- src/split-confirmation-functions.test.ts src/production-supabase-service.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

Commit: `git commit -m "feat: ship private split review contracts"`

### Task 4: Collaborator review, correction, and receipts

**Files:**
- Modify: `src/features/music/SplitConfirmationPortal.tsx`
- Modify: `src/split-confirmation-portal.test.tsx`

- [ ] **Step 1: Write failing recipient UX tests**

Assert the recipient sees their role and two shares first, plain definitions for publishing and master, complete allocations totaling 100%, no email/status, an acknowledgement-gated `Confirm my shares`, and `Request a correction`. Assert correction reveals a required text field and submits `correction_requested` with its reason. Assert confirmation/correction receipts include song, shares, and useful next-state copy.

- [ ] **Step 2: Run portal tests and verify RED**

Run: `npm test -- src/split-confirmation-portal.test.tsx`
Expected: FAIL because the current portal uses `Reject details` and has no correction reason.

- [ ] **Step 3: Implement the public recipient experience**

Use one narrow responsive page outside the Desk shell. Present `Your proposed shares`, role, composition/master explanations, the complete allocation with explicit totals, then the two decisions. Disable duplicate submission while pending. Translate link failures into `This split request is no longer available. Ask the artist team for a new link.`

- [ ] **Step 4: Run portal tests and commit**

Run: `npm test -- src/split-confirmation-portal.test.tsx`
Expected: PASS.

Commit: `git commit -m "feat: polish collaborator split review"`

### Task 5: Manager-led unreleased release guidance without released-song regressions

**Files:**
- Modify: `supabase/functions/_shared/openaiManagerConversation.ts`
- Modify: `supabase/functions/_shared/manager-conversation/agentLoop.ts`
- Modify: `src/openai-manager-conversation-function.test.ts`
- Modify: `src/manager-agent-loop.test.ts`
- Modify: `src/manager-conversation-song-scope.test.ts`
- Modify: `src/conversational-song-workspace-manager.test.ts`

- [ ] **Step 1: Write failing prompt and tool-policy tests**

Assert attached unreleased-song turns must read release readiness, use available tools before asking, ask at most one human-only question, persist confirmed metadata, re-read readiness after a write, and update only the linked mission when a gate materially changes. Assert released/catalog turns use public/provider tools, remain post-release, and never ask the user to upload public metrics or reopen master/splits/distribution as blockers.

- [ ] **Step 2: Run Manager tests and verify RED**

Run: `npm test -- src/openai-manager-conversation-function.test.ts src/manager-agent-loop.test.ts src/manager-conversation-song-scope.test.ts src/conversational-song-workspace-manager.test.ts`
Expected: FAIL on missing explicit one-question/read-after-write/tool-first guarantees.

- [ ] **Step 3: Tighten only focused-song instructions and tool sequencing**

Add scoped instructions for attached unreleased songs rather than rewriting global personality. Make the loop prefer `read_release_readiness`, relevant song/provider/search tools, then the existing durable save tool; after a successful write, read readiness again. Require one concise question only when human intent/confirmation is absent. Require `update_existing_mission` with the attached mission id and a complete materially revised plan; prohibit duplicate missions and checklist narration.

- [ ] **Step 4: Add released-song regression guards**

Make the default opening brief for released/catalog songs ask the Manager to determine the best next move from existing manager read, Chartmetric/provider evidence, and search tools. Explicitly prohibit asking the user for metrics available to tools; only request private first-party data when a named decision truly cannot be made without it, and still provide a useful tool-backed recommendation first.

- [ ] **Step 5: Run Manager tests and commit**

Run: `npm test -- src/openai-manager-conversation-function.test.ts src/manager-agent-loop.test.ts src/manager-conversation-song-scope.test.ts src/conversational-song-workspace-manager.test.ts`
Expected: PASS.

Commit: `git commit -m "fix: restore manager-led song guidance"`

### Task 6: Complete overlay/error audit and regression suite

**Files:**
- Modify: overlay components found by `rg 'role="dialog"|Dialog.Content|SheetContent' src`
- Modify: `src/production-app-shell.test.tsx`
- Modify: focused component tests associated with changed overlays

- [ ] **Step 1: Add a failing source-level customer-copy guard**

Add a test that scans customer-facing React sources and rejects known internal phrases: `large-file path`, `standard private upload path`, `storage bucket`, `storage ref`, `signed URL`, `provider trace`, and `RPC` when present in rendered strings. Exclude service implementation and test fixtures.

- [ ] **Step 2: Run the guard and verify RED**

Run: `npm test -- src/customer-facing-copy.test.ts`
Expected: FAIL on any remaining rendered engineering copy.

- [ ] **Step 3: Audit and repair every song/release overlay state**

For create/import, document edit, upload, metadata edit, share, rights send/review, and activity/error overlays, verify title, task guidance, selected/empty state, pending state, success, actionable error, specific button verbs, Escape/close behavior, and mobile scrolling. Translate raw repository errors at the UI boundary while retaining original errors for logs.

- [ ] **Step 4: Run focused and complete test suites**

Run: `npm test -- src/customer-facing-copy.test.ts src/song-document-actions.test.tsx src/song-rights.test.ts src/split-confirmation-portal.test.tsx src/split-confirmation-functions.test.ts src/production-app-shell.test.tsx`
Expected: PASS.

Run: `npm test`
Expected: all tests PASS with only established skips.

- [ ] **Step 5: Build and commit**

Run: `npm run build`
Expected: TypeScript/Vite production build succeeds.

Commit: `git commit -m "test: lock production song workflow quality"`

### Task 7: Production migration, Edge deployment, signed-in QA, and web deployment

**Files:**
- Deploy existing functions: `send-split-confirmations`, `load-split-confirmation`, `confirm-split`
- Deploy web app through the repository’s existing Netlify workflow

- [ ] **Step 1: Re-run clean verification immediately before deployment**

Run: `npm test && npm run build`
Expected: complete suite and build PASS from the committed tree.

- [ ] **Step 2: Deploy changed Edge Functions**

Run the established Supabase CLI commands against project `bbwbxmnanccwottrmkqu` for all three changed functions. Verify deployment listing/version output before continuing.

- [ ] **Step 3: Deploy the production web build**

Use the repository’s established Netlify production deployment and confirm `https://desk.ordersounds.com` serves the new deployment id.

- [ ] **Step 4: QA in the already signed-in Chrome `Order` tab**

Desktop and responsive checks: Add document never clips; each route opens; audio copy/progress/retry are useful; created documents and split-sheet assets appear without refresh; Spotify import rights copy is honest; structured allocation math remains 100/100 with person progress separate; recipient email/link review/confirm/correction work; export downloads; Manager unreleased flow asks one appropriate next question and saves it; released song uses its read/provider context and does not regress into upload demands.

- [ ] **Step 5: Verify public link terminal and privacy behavior**

Open a recipient link without Desk authentication, confirm no emails/internal statuses/navigation are exposed, submit once, then reload and confirm the neutral completed/unavailable state.

- [ ] **Step 6: Push final commits and record evidence**

Run: `git status --short`, `git log -8 --oneline`, and `git push origin main`.
Expected: only the two pre-existing user-owned `.playwright-cli` untracked files remain; push succeeds.
