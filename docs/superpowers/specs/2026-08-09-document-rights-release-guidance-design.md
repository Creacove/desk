# Document, Rights, and Release Guidance Production Design

**Date:** 2026-08-09  
**Status:** Approved for implementation planning  
**Product:** Ordersounds Desk

## Objective

Make three connected song-room workflows production-ready without replacing the application’s existing architecture:

1. Adding a document must always be visible, understandable, and usable on desktop and mobile.
2. Creating, sending, reviewing, confirming, rejecting, importing, and exporting split information must follow a coherent rights workflow.
3. The Manager must lead an attached unreleased song toward release readiness using the song’s current state, existing tools, and existing linked mission.

The implementation extends the current song materials, music assets, split confirmations, operating events, Manager conversation tools, and release-readiness model. It does not introduce DocuSign, a parallel document store, a second mission system, or claims of legal enforceability.

## Product Principles

- Every control must earn its place. A user should see the next relevant action, not every possible action simultaneously.
- The app must distinguish allocation, confirmation, evidence, and legal execution. Ordersounds confirmation is a durable product record but is not represented as a DocuSign-equivalent signature.
- Public catalog data cannot establish private rights. Spotify import proves catalog identity and release state, not ownership or collaborator agreement.
- The Manager reads before asking. It asks one high-value question at a time and never asks the artist to repeat information already stored on the song.
- Existing released-song and general Manager behavior must remain stable outside the attached unreleased-song workflow.

## 1. Add Document Experience

### Root cause

The current Add document menu is absolutely positioned inside the Files surface. That surface uses `overflow-hidden`, so the menu is clipped when the Documents section is near the viewport or container boundary. Increasing `z-index` cannot escape an ancestor’s clipping context.

### Interaction design

Add document opens a viewport-level overlay anchored to the trigger rather than a child of the clipped Files surface.

- Desktop: a compact popover aligned to the Add document button. It opens below when space permits and flips above when the lower viewport is constrained.
- Mobile: a bottom sheet with the same options and a visible close affordance.
- The overlay closes on Escape, click outside, route/tab change, or completed selection.
- Focus moves into the overlay when it opens and returns to Add document when it closes.
- The overlay has a maximum viewport-relative height and internal scrolling as a last resort.

### Information architecture

The first level contains three paths:

1. **Write here** — opens the existing native document editor.
2. **Ask Manager to draft** — opens the existing attached Manager conversation with a document-specific request and song subject.
3. **Upload existing file** — reveals typed upload choices: Lyrics, EPK / press kit, Press material, Split sheet / rights document, and Other document.

The workflow reuses the existing document editor and asset uploader. Upload progress, completion, failure, and retry continue to use the existing inline upload model. Successfully created or uploaded content appears in Documents without a page reload and becomes available to the Manager through the existing song packet and operating-event flow.

Duplicate native documents remain editable records; the Add flow does not silently create a second item when the user selected an existing document to edit.

## 2. Owner Rights Workspace

### State model

The Rights tab presents one primary state at a time:

| State | Meaning | Primary action |
| --- | --- | --- |
| Not managed | No Ordersounds allocation exists | Add existing record or set up splits |
| Draft | Allocation is incomplete or editable | Add/edit collaborators |
| Ready | Publishing and master allocations both total 100% | Review and send |
| Awaiting | Requests were sent and no collaborator has responded | View recipients / resend pending |
| Partially confirmed | At least one collaborator confirmed and others remain | View remaining collaborators |
| Disputed | A collaborator rejected the proposal | Review correction and revise |
| Confirmed | All collaborators confirmed the same proposal | Export split record |
| Document on file | An external split document was uploaded | View/download record; optionally set up structured splits |

Publishing and master allocations are two independent 100% totals. Confirmation progress never changes or renormalizes those totals. “One of two confirmed” describes people, while “Publishing allocated 100%” and “Master allocated 100%” describe the proposal.

### Layout

- A quiet header states the current rights condition in plain language.
- During Draft and Ready, the collaborator ledger is the primary content.
- Each row shows contributor, role, publishing share, master share, and confirmation state. Email is available to the owner but visually secondary.
- Allocation warnings appear only while totals are incomplete.
- A single primary action appears for the current state. Secondary actions use quiet text or icon controls.
- Approval history remains collapsed unless requested.

### Sending and resending

Sending is allowed only when:

- both allocations equal exactly 100%;
- every contributor has a valid email;
- at least one contributor exists; and
- the proposal is not locked by an active or completed confirmation cycle.

Before sending, a compact review step summarizes recipient count and both totals. Sending creates a unique hashed capability token per contributor, supersedes earlier active tokens for the same proposal, records the activity, and transitions the proposal to Awaiting.

The owner can resend only to pending recipients. Confirmed recipients are not disturbed. Revising an allocation supersedes all active links because confirmations must refer to one immutable proposal.

### External records and released imports

A released Spotify-imported song with no structured split data displays:

> Rights not managed in Ordersounds
>
> This song was imported from the public catalog. Spotify confirms that it is released, but public catalog data does not verify ownership or collaborator agreements.

Available actions:

- **Upload existing split sheet** — uses the music asset type `split_sheet`.
- **Set up splits here** — begins the existing structured allocation workflow.

An uploaded record displays **Document on file — not independently verified**. It is viewable/downloadable and included in Manager song context. It does not automatically mark structured rights as confirmed.

Released imported songs are not marked release-blocked solely because Ordersounds lacks private rights data. The Manager may identify rights evidence as useful for licensing, accounting, disputes, or sync readiness, but must not reopen release preparation.

### Export

Confirmed structured splits expose a quiet **Export split record** action. The first implementation produces a downloadable, portable record containing:

- song title;
- proposal version/date;
- contributors and roles;
- publishing and master allocations;
- per-contributor confirmation state and confirmation timestamp where available; and
- an explicit statement that this is an Ordersounds confirmation record, not legal advice or a qualified electronic-signature certificate.

The export uses existing stored data and requires no new signing provider. DocuSign or another qualified execution provider remains a later integration.

## 3. Collaborator Email

The email is concise and personal. It contains:

- Ordersounds identity;
- song title;
- recipient name and role;
- the recipient’s proposed publishing and master shares;
- one **Review split** button;
- the request expiry; and
- a plain fallback URL.

The email does not expose other collaborators’ email addresses, internal status, mission data, conversations, or workspace navigation. It does not ask the recipient to confirm directly from email; the decision happens on the token-scoped review page.

Email HTML escapes all user-provided values. The token remains unhashed only in the recipient URL and is never stored in plaintext.

## 4. Collaborator Review and Confirmation

### What the recipient sees

The token-scoped page remains outside the authenticated Desk shell.

The primary card shows:

- song title;
- recipient name and role;
- their publishing share;
- their master share; and
- plain-language definitions distinguishing composition/publishing from master recording.

The recipient also sees the full allocation because informed approval requires knowing the complete proposal. The full allocation includes only contributor names, roles, publishing shares, and master shares. It excludes emails, internal confirmation states, workspace activity, and private operational information. Both columns visibly total 100%.

### Decisions

- **Confirm my shares** requires an explicit checkbox acknowledging the displayed proposal.
- **Request a correction** opens a required short text field. It does not use accusatory “reject” language as the primary label.
- Confirmation and correction requests are idempotent. An already-used, expired, revoked, or superseded token returns a neutral final state rather than exposing server details.
- A correction request marks the proposal disputed, records the note for the owner, and supersedes the remaining active confirmation links.

### Completion state

After confirmation, the recipient sees a simple receipt with song title, their confirmed shares, and confirmation timestamp. After requesting a correction, the receipt states that the artist team received the correction and must send a revised proposal before confirmation can continue.

## 5. Manager-Led Release Conversation

### Scope

The behavior applies only when a Manager conversation has an attached unreleased song or when the user explicitly starts release planning for an unreleased song. It does not globally rewrite Manager behavior.

### Conversation loop

For each turn, the Manager:

1. Reads the attached song and deterministic release-readiness view.
2. Identifies the highest-impact unresolved release decision.
3. Uses existing tools or public/provider context before asking the user for information the system can obtain itself.
4. Asks one concise question when human confirmation is genuinely required.
5. Saves a confirmed answer through the existing metadata, lifecycle, file, rights, document, or mission tools.
6. Re-reads readiness after a durable change.
7. Updates the already-linked release mission only when the change completes, removes, unblocks, or materially changes planned work.

### Question priority

The Manager selects from applicable gaps rather than following a rigid wizard:

1. Release intent and lifecycle stage.
2. Target date or release window.
3. Current master and artwork.
4. Primary/featured artists, credits, and required identifiers.
5. Structured splits or external rights record.
6. Distribution readiness.
7. Lyrics, press angle, press release, images, and shareable package readiness.
8. Launch and post-release work appropriate to the artist’s actual stage, evidence, budget, and team.

Satisfied and irrelevant gates are skipped. The Manager does not manufacture a duplicate mission or a long checklist in chat. It acknowledges saved work and moves to the next decision only when helpful.

### Released songs

Released/catalog songs continue through the post-release path. The Manager uses existing public and provider-backed data and tools, does not ask the user for readily available public metrics, and does not reopen master, split-confirmation, or distribution gates as release blockers.

## 6. Data and Architecture

The implementation will reuse:

- `music_assets` and `uploaded_files` for uploaded rights documents;
- `documents` and `document_versions` for native song documents;
- `music_splits`, `music_split_contributors`, and `music_split_confirmations` for structured splits;
- `operating_events` for Manager-visible durable activity;
- the existing public split load/confirm functions and hashed token model;
- the existing focused-song context and release-readiness Manager tools; and
- the existing linked mission update tools.

Schema changes are limited to fields required for correction notes, immutable proposal/version context, and timestamps not already represented. No parallel rights tables will be created.

## 7. Error Handling and Safety

- Document overlays remain visible within the viewport and never depend on ancestor overflow.
- Failed uploads remain visible with retry controls.
- Partial email delivery returns an exact count and leaves unsent recipients retryable; successfully delivered links are not silently duplicated.
- Public endpoints return neutral unavailable/expired states and never leak database or storage errors.
- Allocations are validated server-side in addition to UI validation.
- A confirmation token is scoped to one contributor and one immutable proposal.
- Changing a proposal invalidates prior outstanding approvals.
- Emails, exported records, and public pages escape user content.
- No external message is sent by the Manager without the existing permission boundary.

## 8. Accessibility and Responsive Requirements

- All overlays use dialog/menu semantics appropriate to the final interaction.
- Keyboard users can open, navigate, select, and close the document overlay.
- Focus is restored to the invoking control.
- Confirmation choices have visible labels and disabled/pending states.
- Mobile layouts use one column, touch targets of at least 44px for primary actions, and no horizontal page overflow.
- The collaborator allocation may use stacked rows on mobile; it must not require a technical understanding of tables.

## 9. Acceptance Criteria

### Documents

- Add document is fully visible at the bottom of the Files surface on supported desktop sizes.
- The mobile interaction is a usable bottom sheet.
- Every choice routes to the correct existing editor, Manager conversation, or typed upload.
- Created/uploaded documents appear without a manual refresh and reach Manager context.

### Rights owner

- Draft, ready, awaiting, partial, disputed, confirmed, imported-unmanaged, and document-on-file states each show one clear primary action.
- Publishing and master totals remain independent and mathematically correct.
- Released Spotify imports never imply Spotify handled or verified splits.
- External split records can be uploaded and downloaded.
- Confirmed structured data can be exported as a clearly labeled Ordersounds record.

### Collaborator

- Email displays the recipient’s proposed shares and one review CTA.
- The public page displays their shares first and the complete 100% allocation without private contact/status data.
- Confirmation requires explicit acknowledgement.
- Correction requires a reason and disputes the immutable proposal.
- Used, superseded, revoked, and expired links fail neutrally.

### Manager

- Attached unreleased-song conversations use current readiness and ask one relevant question at a time.
- Confirmed answers persist through existing tools and immediately affect subsequent reasoning.
- Existing linked release missions are updated only on material state changes.
- Released-song conversations remain post-release and do not regress into generic upload requests or pre-release blockers.

### Verification and release

- Unit, component, service, Edge Function contract, and production shell tests cover each new state and transition.
- The complete existing suite and production build pass.
- Signed-in desktop and responsive QA cover document creation, split setup, send/review/confirm/correction, imported released rights, export/download, and Manager release guidance.
- Required Edge Functions and the web application are deployed only after verification passes.

## 10. Explicit Non-Goals

- DocuSign or qualified electronic signatures.
- Legal advice or automatic claims of enforceability.
- Royalty payment calculation or payout routing.
- Distributor API submission.
- A new document storage system.
- A second release mission for the same attached song.

