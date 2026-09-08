# Drawn E-Sign Song Split Sheet Workflow Design

**Status:** Product design for review. This document defines the intended product and legal-document workflow. It does not implement the feature.

**Audience:** Luna and any engineer implementing the Ordersounds Rights tab, contributor signing portal, agreement PDF, and execution record.

**Reference document:** `C:\Users\USER\Downloads\MCSN-Split-Sheet-Template.pdf`

Use the attached document as the content, density, hierarchy, and signature-layout reference. The Ordersounds version carries Ordersounds branding and does not name a country, jurisdiction, or rights society.

## 1. Product outcome

Ordersounds must provide a complete digital split-sheet workflow for one song. It must record the fields represented in the reference sheet, collect a hand-drawn electronic signature from every required contributor, and produce one downloadable, fully signed PDF with an execution certificate.

The editable object inside Ordersounds is the **split workspace**. The legal-facing object is the **Split Agreement**. The final immutable artifact is the **Executed Split Agreement PDF**.

The product must never describe a click-only confirmation as a signature. It must never describe a partially signed document as executed.

## 2. Binding product decisions

1. The attached split sheet is the content and information-hierarchy benchmark.
2. Ordersounds uses its own branding and original visual implementation. The product and generated PDF do not name or imply endorsement by the organisation shown in the reference.
3. The base agreement records split ownership and royalty-participation information. It does not secretly assign copyright or grant an exclusive licence.
4. The signed columns are:
   - performing rights percentage;
   - mechanical rights percentage;
   - neighbouring rights percentage.
5. Inapplicable rights columns are blank, not automatically converted to zero.
6. Every applicable percentage column must total exactly 100% before the agreement can be locked.
7. Every contributor with an ownership or participation percentage greater than zero is a required signer.
8. Signatures are drawn by hand on a digital signature pad using a finger, stylus, trackpad, or mouse.
9. A typed name is not a substitute for the hand-drawn signature.
10. A contributor must draw a new signature for each agreement. Ordersounds does not save reusable signatures.
11. Once the signing version is locked, its legal content, participants, and percentages cannot change.
12. Any correction after locking creates a new version and invalidates every outstanding request for the old version.
13. The final PDF contains the visible drawn signatures and server-generated signature dates.
14. An execution certificate is appended to the final PDF and also available separately.
15. An Excel or CSV export is operational data only. It is never the authoritative signed agreement.

## 3. What the agreement means

The agreement is titled **Song Split Agreement**.

Its plain-language legal statement is:

> Each contributor confirms that the identity, contribution, role, and percentage information recorded for them is accurate and reflects the agreement between the contributors concerning the musical work and sound recording identified in this document. Each contributor agrees that the executed agreement may be used for work registration, royalty matching, royalty distribution, rights administration, and related professional purposes. This agreement records the agreed split information. It does not assign copyright or grant an exclusive licence unless a separate written agreement expressly provides otherwise.

This statement appears before the signature pages and is included in the consent shown to every signer.

Ordersounds must not state that it independently verified authorship or ownership. It records the parties' agreement and preserves evidence of their execution.

## 4. User roles

### 4.1 Agreement coordinator

An authenticated workspace member who can:

- create and edit the draft;
- add or remove contributors before locking;
- enter work and recording metadata;
- prepare the signing version;
- send and resend signing requests;
- view delivery and signature progress;
- review correction requests;
- create a revised version;
- download the executed agreement and evidence;
- void an unexecuted signing round.

The coordinator cannot modify a locked signing version.

### 4.2 Contributor signer

A token-scoped external participant who can:

- verify access with an email OTP;
- review the full locked agreement;
- review their own identity, role, and percentages;
- request a correction before signing;
- consent to electronic signing;
- draw and submit their signature;
- receive a signing receipt;
- receive the final executed agreement after completion.

The contributor cannot see workspace navigation, internal notes, other contributors' contact details outside the signed agreement, or any other song.

### 4.3 Read-only workspace viewer

An authenticated workspace member with read access can view status and the final agreement but cannot edit, send, void, or sign for another person.

## 5. Rights tab information architecture

The existing compact ledger in `src/features/music/MusicScreens.tsx` becomes the agreement workspace. Keep it inside the current song page, current `Rights` tab, and existing `os-room-rail`. Do not create a disconnected dashboard, wizard, or document-management product inside the tab.

The visual direction is **redesign-preserve**. Luna must reuse the current Ordersounds product language rather than introduce a new legal-tech aesthetic.

### 5.1 Visual contract

The Rights tab must look like the other song tabs at first glance:

- one continuous page surface on the existing app background;
- Manrope through the existing `font-display` and `font-ui` utilities;
- 20-22px tab title, 12-13px operating text, and 10-12px compact labels;
- existing foreground, muted foreground, background, brand accent, success, warning, and danger tokens only;
- `border-foreground/8` or the existing adjacent-tab equivalent for structural lines;
- 10px controls, 12px buttons, and 16px only for the contributor ledger or an existing dialog container;
- no shadows except an existing app-level dialog or primary-action treatment;
- no new gradients, glass, illustrations, decorative icons, or legal-themed visual motifs;
- no metric cards, dashboard tiles, oversized status banners, or persistent PDF side panel;
- no explanatory subtitle below the tab title;
- no horizontal or vertical progress stepper;
- no sticky right rail.

Cards are not the default grouping mechanism. Use spacing, one enclosing ledger border, and sparse horizontal rules. Every border, label, badge, and sentence must carry operational meaning.

The contributor ledger is the dominant object. Work metadata, totals, actions, and activity exist to support the ledger and must not compete with it.

### 5.2 Desktop layout

Use one vertical flow within the existing room width:

1. title row and state action;
2. compact agreement identity row when a version exists;
3. three-column totals strip;
4. contributor ledger;
5. add/edit controls in draft, or signing actions when locked;
6. collapsed `Work and recording` disclosure;
7. collapsed `Activity` disclosure.

The PDF preview opens in the app's existing document modal or a full-width document viewer. It never permanently reduces the width of the ledger.

### 5.3 Mobile layout

Stack content in this order:

1. title, short state, and overflow menu;
2. totals strip;
3. contributor rows;
4. state action;
5. work and recording disclosure;
6. activity disclosure.

Each contributor row becomes one compact stacked row inside the same enclosing ledger. Do not turn every contributor into a floating card. Name and signature state appear first; role and rights percentages follow. Every percentage and signature state remains visible without horizontal scrolling.

### 5.4 Copy budget

Default to labels, values, and actions. General teaching copy is not visible in the tab.

Visible prose is allowed only when it does one of four jobs:

1. identifies a blocker the user must fix;
2. confirms an irreversible or legally meaningful action;
3. captures consent in the external signing ceremony;
4. explains an error or exceptional state.

Use one short line for a state message. Do not place helper paragraphs under headings. Field help belongs in a tooltip, accessible description, or inline validation and appears only when needed.

Preferred labels:

- `Draft`
- `Ready to send`
- `2 of 3 signed`
- `Correction requested`
- `Fully signed`
- `Preview PDF`
- `Prepare for signing`
- `Send requests`
- `Download signed PDF`

Avoid labels such as `Agreement readiness`, `Signing progress`, or `Current stage` when the value itself communicates the state.

### 5.5 Desktop visual skeleton

```text
Song rights                                      [Preview PDF]
Draft
--------------------------------------------------------------
Performing 100%        Mechanical 100%        Neighbouring 100%
--------------------------------------------------------------
CONTRIBUTOR       ROLE            PERF.   MECH.   NEIGH.   STATUS
Ada Okafor        Songwriter       50%     50%       -     Draft   ...
Tobi Mensah       Producer         50%     50%     100%    Draft   ...
--------------------------------------------------------------
[+ Add contributor]                         [Prepare for signing]

Work and recording                                             >
Activity                                                       >
```

This is a hierarchy reference, not permission to add visible instructional copy or a separate boxed panel around every line.

## 6. Rights tab header

### Draft and review states

**Title:** `Song rights`

The header shows:

- one short status line directly below the title: `Draft`, `Ready to send`, `[N] of [N] signed`, `Correction requested`, or `Fully signed`;
- `Version [N]` and document ID only after a locked version exists;
- one quiet right-aligned action: `Preview PDF` before execution or `Download signed PDF` after execution;
- secondary actions in the existing overflow menu.

Do not show `Last saved` in the permanent header. Show save state only while saving, after a save failure, or briefly after a manual change.

### Executed state

**Title:** `Song rights`

**Status:** `Fully signed`

Header actions:

- primary: `Download signed PDF`;
- overflow: `Execution certificate`, `Evidence package`, `Split data (.xlsx)`, `Create revised agreement`.

## 7. Agreement state treatment

Do not render a progress band or stepper in the Rights tab. The workflow is not navigation and does not deserve permanent vertical space.

Represent progress through the short header state and each contributor's row status. The complete internal state mapping remains:

- `draft`, `correction_requested`: `Draft` or `Correction requested`;
- `ready_for_signature`, `locking`: `Ready to send`;
- `sent_for_signature`, `partially_signed`: `[signed] of [required] signed`;
- `finalizing`: `Finalizing`;
- `executed`: `Fully signed`.

The external signer may see a very small text marker such as `Review  /  Sign` when orientation is genuinely needed, but no numbered stages and no decorative progress track.

## 8. Agreement details section

Use a quiet section with dividers, not a dense card grid.

**Section title:** `Work and recording`

Fields:

| Field | Requirement | Behavior |
| --- | --- | --- |
| Work title | Required | Name of the musical composition. Pre-fill from song title but remain editable before locking. |
| Recording title / version | Required | Example: `No Pressure - Main Version`. |
| Date of this agreement | Required at lock | Defaults to the date the version is locked. Coordinator may select an earlier agreed date, but the system preserves the actual lock and signature timestamps separately. |
| Date created | Required | Date or best-known date the work was completed/fixed. |
| Release date | Optional | Required only when the song is already scheduled or released. |
| ISWC | Optional | Composition identifier. Empty values display as blank in the PDF. |
| ISRC | Optional | Sound-recording identifier. Empty values display as blank in the PDF. |
| Coordinating contributor | Required | Workspace contributor or manager responsible for checking the sheet. |
| Coordinator role | Required | Contributor, manager, publisher, label, or other. |

Do not display `TBD`, `Missing`, or placeholder punctuation inside the generated agreement. Optional unknown fields remain blank.

## 9. Rights totals section

Place the totals in the existing compact border-y metric strip directly above the contributor ledger. Do not title the strip.

Show three totals as separate rows:

- Performing rights: `0-100%`
- Mechanical rights: `0-100%`
- Neighbouring rights: `0-100%`

For each column, show one value and, only when useful, one short state:

- `Not used` when every contributor value is blank;
- `Balanced` when the applicable total is exactly 100%;
- `[number]%` when incomplete;
- `[number]% / over` when over-allocated.

An unused column does not block locking. A used column must equal exactly 100%.

Never infer that performing and mechanical percentages are identical. The coordinator may deliberately copy one complete column into the other using `Copy performing splits to mechanical`, but that action must show a confirmation and remain visible in activity history.

## 10. Contributor ledger

**Section title:** `Contributors and splits`

There is no persistent section helper. If a coordinator attempts to sign for somebody else, explain the rule at that point.

Desktop columns:

1. Contributor
2. Role
3. Performing
4. Mechanical
5. Neighbouring
6. Signature
7. Row actions

Contributor cell:

- primary line: full legal name;
- secondary line: stage name when present;
- tertiary detail shown in expanded view: email and telephone.

Role cell displays up to two roles and `+N` for additional roles. Hover/focus or row expansion shows all roles.

Percentage cells display blank for not applicable and a formatted value such as `25%` when applicable.

Signature statuses:

- `Not invited`
- `Sent`
- `Opened`
- `Identity verified`
- `Signed`
- `Correction requested`
- `Expired`
- `Superseded`

Rows are editable only in draft or correction-revision states. During signing they are locked. In the executed state they are read-only.

Row actions before locking:

- `Edit contributor`
- `Remove contributor`

Row actions during signing:

- `View request`
- `Copy signing link`
- `Resend email`
- `Revoke request`

Row actions after execution:

- `View signature receipt`

## 11. Add or edit contributor dialog

Use the app's existing centered dialog pattern on desktop and full-screen dialog treatment on small screens. Do not introduce a permanent right-side drawer. The ledger stays visually stable behind the dialog.

The dialog title is `Add contributor` or `Edit contributor`. Do not add a subtitle. Group the fields with spacing and sparse dividers, not nested cards.

### Identity

| Field | Requirement |
| --- | --- |
| Full legal name | Required. Show `Use the name on identity and banking records` only on focus or validation. |
| Stage / professional name | Optional |
| Contributor type | Required: Individual or Organisation |
| Organisation name | Required when contributor type is Organisation |
| Signing capacity | Required for organisations. Examples: Director, Authorised Representative, Label Manager. |
| Email | Required. A duplicate email produces a warning rather than a hard failure because one authorised representative may sign for more than one organisation or capacity. The coordinator must confirm each duplicate explicitly. |
| Telephone | Required, including country code |
| Rights society member ID | Optional |
| IPI / CAE number | Optional |
| Signing authority | Required: Self, Authorised organisation representative, or Parent/guardian |
| Parent/guardian legal name | Required when signing authority is Parent/guardian |
| Parent/guardian relationship | Required when signing authority is Parent/guardian |

### Roles

Multi-select choices:

- Composer
- Lyricist
- Songwriter
- Arranger
- Producer
- Performer
- Featured artist
- Session musician
- Engineer
- Publisher
- Label
- Other

At least one role is required. `Other` reveals a required free-text role field.

### Splits

Inputs:

- Performing rights percentage
- Mechanical rights percentage
- Neighbouring rights percentage

Each input accepts blank or a number from 0 to 100 with up to two decimal places. Blank means not applicable. Zero means the right category applies but the contributor receives zero, and should be used only intentionally.

When a contributor has zero or blank values in every column, show a warning:

`This contributor has no recorded split. Keep them only if their role must appear on the agreement.`

The user must confirm `Include without a percentage` before saving such a contributor.

### Signing

`Signature required` defaults to on for every contributor. It cannot be turned off for a contributor with a positive percentage. A zero-share contributor may be non-signing only when the coordinator selects a reason:

- Credit only
- Represented by organisation signer
- Supporting signed document on file

The selected reason appears in the version snapshot and activity history.

Dialog actions:

- primary: `Save contributor`
- secondary: `Cancel`
- destructive edit-only action: `Remove contributor`

## 12. Draft readiness treatment

There is no permanent readiness panel. The primary action stays disabled until the legal minimum is present. Immediately above that action, show at most one unresolved blocker, selected in this order: missing agreement metadata, missing signer identity/contact, under-allocation, over-allocation, missing coordinator.

Examples:

- `Add at least one contributor.`
- `Enter the recording title or version.`
- `Add a legal name for Tobi Mensah.`
- `Add a signing email for Kemi Adebayo.`
- `Performing rights total 80%. Add the remaining 20%.`
- `Mechanical rights total 110%. Remove 10%.`
- `Select a coordinating contributor.`

Do not show a success panel when no blockers remain. Enable `Prepare for signing`. `Preview PDF` remains the quiet header action.

## 13. Prepare-for-signatures confirmation

Selecting `Prepare for signatures` opens a modal.

**Title:** `Lock this agreement for signing?`

**Body:** `This creates Version [N]. Names, roles, percentages, and terms lock until signing ends. A correction creates a new version.`

Summary inside the modal:

- work and recording title;
- number of contributors;
- number of required signers;
- applicable totals;
- agreement date;
- coordinator name.

Required checkbox:

`I reviewed this version and am ready to send it for signatures.`

Actions:

- primary: `Create signing version`
- secondary: `Go back`

The server, not the browser, creates the canonical snapshot, PDF, document ID, version number, and pre-signature SHA-256 hash.

Document IDs use the stable format `OS-SA-[four-digit year]-[six-digit sequence]`, for example `OS-SA-2026-000481`. A version is displayed separately as `Version 03`; it is never encoded by changing the document ID.

## 14. Locked review state

After the version is created but before emails are sent, the Rights tab displays:

**Status:** `Ready to send`

**Message:** `Version [N] is locked.`

Actions:

- primary: `Send signature requests`
- secondary: `Open locked PDF`
- tertiary: `Discard this signing version`

Discarding is allowed only before the first request is sent. It returns the agreement to draft and records a discarded-version event.

## 15. Sending requests

The send dialog lists each required signer with their legal name and email. The coordinator can exclude nobody who has a positive applicable percentage.

Email subject:

`Signature requested: [Work title] split agreement`

Email body must include:

- coordinator or artist/workspace name;
- work title and recording version;
- the signer's role;
- their performing, mechanical, and neighbouring percentages;
- the request expiry date;
- `Review and sign agreement` button;
- fallback URL;
- notice that the link is personal and must not be forwarded.

If some emails send and others fail, the UI reports the exact partial result. Successful requests remain valid. Failed rows show `Delivery failed` and a retry action.

## 16. External signing portal

Replace the existing `SplitConfirmationPortal` with a focused signing ceremony outside the authenticated app shell. It should feel like Ordersounds with the navigation removed, not like a third-party e-sign product.

Stages:

1. Verify
2. Review
3. Sign
4. Receipt

Do not render these as four large cards or a full stepper. Use one centered reading column, one task per screen, the Ordersounds wordmark, a compact document identity line, and one primary action. Legal consent is the deliberate exception to the app's minimal-copy rule.

Portal visual rules:

- max content width of approximately 720px for review and 560px for verify, consent, and receipt;
- same Manrope typography, neutral background, token colors, control radii, and button language as the app;
- no authenticated sidebar, song-room tabs, Manager button, or internal activity;
- no marketing copy, illustrations, trust badges, celebratory graphics, or oversized completion icon;
- PDF frame may be wider than the reading column but stays within the viewport;
- the signature surface is the only intentionally high-contrast white panel in dark mode;
- one primary action per screen; correction and resend actions remain quiet text or secondary controls.

### 16.1 Verify

Opening the token-scoped link displays:

**Eyebrow:** `Ordersounds - Split agreement`

**Title:** `Verify your identity`

**Identity line:** `[Work title] / Version [N]`

**Body:** `Code sent to [masked email].`

OTP rules:

- six numeric digits;
- valid for 10 minutes;
- maximum five failed attempts per code;
- 60-second resend cooldown;
- signing request expires after 14 days;
- the raw OTP and raw link token are never stored;
- successful verification is bound to the request, agreement version, and browser session;
- a verified session expires after 30 minutes of inactivity.

Actions:

- primary: `Verify and continue`
- secondary: `Send a new code`

### 16.2 Review

Display the full locked agreement using an embedded PDF viewer. On small screens, provide page thumbnails or page navigation and a prominent `Open full PDF` control.

Above the PDF show only:

**Title:** `Review the agreement`

**Identity line:** `[Work title] / Version [N]`

Below the PDF, show a concise signer summary:

- legal name;
- stage name;
- roles;
- performing percentage;
- mechanical percentage;
- neighbouring percentage;
- document ID;
- version;
- agreement date.

Actions:

- primary: `Continue to signature`
- secondary: `Request a correction`

The signer cannot edit any value.

### 16.3 Required consent

Before the signature pad, require all three checkboxes:

1. `I reviewed the complete agreement and confirm that my identity, roles, contributions, and percentages are accurate.`
2. `I agree that this executed agreement may be used for work registration, royalty matching, royalty distribution, and rights administration.`
3. `I consent to using an electronic signature and intend my signature to bind me to this agreement.`

The exact consent text and a `consent_version` identifier are stored with the signature event.

### 16.4 Hand-drawn signature pad

**Heading:** `Draw your signature`

Do not show a permanent helper paragraph. Inside the empty pad, show `Sign here`. On devices where pointer support is ambiguous, a short accessible hint may appear once: `Use your finger, stylus, trackpad, or mouse.`

Signature pad behavior:

- opaque white signing surface in light and dark app themes;
- black or near-black ink;
- visible baseline and `Sign here` hint before the first stroke;
- supports pointer, mouse, touch, and stylus events;
- `touch-action: none` while drawing so the page does not scroll;
- responsive width with a minimum practical height of 180 CSS pixels;
- preserve normalized x/y points so the signature scales cleanly into the PDF;
- do not collect pressure, tilt, or behavioral biometric measurements;
- `Undo last stroke` action;
- `Clear` action;
- signature is valid when a non-empty visible mark exists;
- the drawn mark remains visible until submission succeeds;
- if submission fails, preserve the mark in page memory so the signer can retry;
- clear the mark from browser memory after successful signing or when the signing session ends.

Do not provide:

- typed signature fonts;
- uploaded signature images;
- stored reusable signatures;
- a checkbox-only completion route.

Printed identity below the pad:

`Signing as: [full legal name]`

For an organisation:

`Signing as: [signatory legal name], [capacity], for [organisation name]`

For a minor contributor:

`Signing as: [parent/guardian legal name], [relationship], for [minor contributor legal name]`

The date is not editable. Show:

`Signature date: Recorded automatically when you sign.`

Primary action:

`Adopt and sign agreement`

This action is disabled until all consents are checked and a visible signature exists.

### 16.5 Signature submission

The submission must atomically bind:

- agreement version ID;
- pre-signature document hash;
- signer participant ID;
- verified signing request ID;
- printed legal name;
- organisation and capacity when applicable;
- signing authority and parent/guardian identity when applicable;
- signature vector/path asset;
- rendered signature image asset;
- signature asset hash;
- consent version and accepted consent text;
- server timestamp in UTC;
- display timezone;
- hashed IP address;
- hashed user-agent value;
- provider or internal execution event ID;
- idempotency key.

A retry with the same idempotency key returns the existing receipt and never creates a second signature.

### 16.6 Receipt

After successful signing:

**Title:** `Your signature was recorded`

**Confirmation line:** `Signed [localized date and time]`

Show:

- drawn signature preview;
- printed legal name;
- document ID and version;
- signature date and time;
- signer receipt ID;
- current completion state such as `2 of 3 required contributors signed`.

Actions:

- `Download signing receipt`
- `Close`

The final executed PDF is sent only after every required signature and required coordinator countersignature are complete.

## 17. Correction request flow

The signer may request a correction from the Review stage. The form requires:

- correction category: Identity, Role, Performing split, Mechanical split, Neighbouring split, Missing contributor, Work metadata, Other;
- explanation of at least 10 characters;
- optional supporting attachment.

Submitting a correction:

- changes the contributor status to `Correction requested`;
- changes the agreement state to `correction_requested`;
- prevents new signatures on that version;
- invalidates all unsigned requests for that version;
- preserves signatures already submitted as historical evidence but does not carry them into a replacement version;
- notifies the coordinator;
- shows the correction in the Rights tab activity history.

The coordinator selects `Create revised version`, returns to an editable copy, makes corrections, reviews changes, and creates a new locked version. Every required signer signs the new version again.

## 18. Signing-state Rights tab

While requests are active, the short header state reads `[signed] of [required] signed`. The contributor rows are the progress display. Do not duplicate every row state in a second dashboard summary.

Show a separate count only for an exceptional state that needs action, such as `2 delivery failures` or `1 correction requested`.

Primary action depends on state:

- unsigned requests remain: `Send reminders`;
- delivery failures exist: `Retry failed deliveries`;
- correction requested: `Review correction`;
- all contributors signed but coordinator pending: `Add coordinator signature`;
- all signatures complete and finalization failed: `Retry finalization`.

Secondary actions:

- `Open signing PDF`
- `Void signing round`

`Copy pending links` belongs in the overflow menu and must preserve link-access controls. It is not a permanent page action.

Voiding requires a reason and confirmation. It revokes every active link and marks the version `voided`. It does not delete evidence.

## 19. Coordinator countersignature

The reference agreement allows a coordinating contributor, manager, or publisher to check and countersign the agreement.

The coordinator block contains:

- checked by legal name;
- role;
- hand-drawn signature;
- server-recorded date and time.

If the coordinator is also a contributor, Ordersounds still presents a separate countersignature step. The coordinator may use the same signing ceremony but must draw the signature again to show the separate capacity and intent.

The agreement cannot become executed until the countersignature is complete when the coordinator block is marked required. Ordersounds workspaces should require it by default.

## 20. Finalization

After the last required signature, the server starts finalization.

During finalization:

- overall state is `finalizing`;
- all signing endpoints become read-only;
- the canonical PDF is rebuilt from the locked snapshot and signature records;
- visible signatures and dates are placed in each participant block;
- the coordinator signature is placed on page one;
- an execution certificate page is appended;
- the completed PDF receives a final SHA-256 hash;
- the PDF, certificate, and manifest are stored in private immutable storage;
- every signer is emailed the same final PDF or a secure download link;
- an `agreement_executed` event is written only after every artifact is stored successfully.

If finalization fails, the agreement remains `finalizing_failed`, not executed. Signatures remain valid and finalization may be retried idempotently.

## 21. Executed Rights tab

Do not show a large success banner. Change the short header state to `Fully signed`, make `Download signed PDF` the right-aligned header action, and preserve the same ledger layout in read-only form.

The collapsed `Execution details` disclosure shows:

- executed date;
- document ID;
- version;
- final PDF hash, shortened with copy action;
- signer count;
- coordinator name;
- verification status.

Downloads:

1. `Download signed PDF`
2. `Execution certificate`
3. `Evidence package`
4. `Split data (.xlsx)`

Only the signed PDF is shown as a full button. The other downloads live in the overflow menu or inside `Execution details`.

The Excel download displays a warning before generation:

`The spreadsheet is an operational export. The signed PDF is the authoritative agreement.`

Post-execution actions:

- `Create revised agreement`
- `Report a dispute`

Never offer `Edit agreement` on an executed version.

## 22. PDF specification

Generate an original Ordersounds document using the reference sheet's content hierarchy and density. Do not reproduce its branding. Do not use browser print-to-PDF. Use a deterministic server-side PDF generator.

### Page format

- A4 portrait primary output;
- print-safe margins that also fit when scaled to US Letter;
- minimum 10-point body text;
- black text on white paper;
- restrained Ordersounds accent colour;
- page numbers and document identity on every page;
- no interactive form fields in the final executed PDF;
- fonts embedded;
- signatures rendered sharply without pixelation.

### Page 1

- Ordersounds wordmark and `Music rights` descriptor;
- title: `Song Split Agreement`;
- subtitle: `One agreement covering the musical work and the sound recording.`;
- work and recording metadata table;
- explanation of what the agreement records;
- three applicable totals;
- completion statement;
- coordinator/checker block with drawn signature and date;
- document ID, version, and pre-signature hash reference in footer.

### Contributor pages

Render up to four contributor blocks per page, matching the reference density. Add as many pages as required.

Each block contains:

- full legal name;
- stage/professional name;
- roles;
- IPI/CAE number;
- rights society member ID;
- performing percentage;
- mechanical percentage;
- neighbouring percentage;
- email;
- telephone;
- organisation and signing capacity where applicable;
- hand-drawn signature;
- printed legal name;
- signature date and time;
- signer receipt ID in small text.

Do not place blank signature lines over an electronic signature. The signature image occupies the signature area, with printed identity and timestamp directly below it.

### Agreement statement page or section

Include the legal statement from section 3 and the exact electronic-signature consent. Keep the language concise. Do not add assignment or exclusive-licence terms.

### Execution certificate page

Include:

- document ID and version;
- work and recording titles;
- pre-signature document hash;
- final executed PDF hash;
- generated-at timestamp;
- one row per signer with legal name, capacity, signed-at timestamp, receipt ID, and verification method;
- coordinator countersignature row;
- consent version;
- verification URL and QR code;
- statement that the certificate is part of the executed agreement evidence package.

Do not print raw IP addresses, raw user-agent strings, email OTPs, or raw signing tokens in the PDF. Those remain protected audit evidence.

## 23. Conceptual data model

The implementation should introduce explicit agreement entities rather than stretching the existing mutable split row.

### `split_agreements`

- `id`
- workspace/account/song scope
- `status`
- `current_draft_version_number`
- `latest_executed_version_id`
- `created_by`
- timestamps

### `split_agreement_versions`

- `id`
- `split_agreement_id`
- `version_number`
- `status`
- canonical agreement snapshot JSON
- `terms_version`
- `consent_version`
- `document_id`
- pre-signature PDF asset ID
- pre-signature SHA-256 hash
- final PDF asset ID
- final PDF SHA-256 hash
- execution certificate asset ID
- evidence manifest asset ID
- locked, sent, finalized, executed, voided, and superseded timestamps
- coordinator participant/signatory identity
- void or supersede reason

### `split_agreement_participants`

Version-scoped snapshot rows containing:

- participant/contributor identity references;
- legal name;
- stage name;
- participant type;
- organisation name;
- signing capacity;
- roles array;
- email;
- telephone;
- rights society member ID;
- IPI/CAE number;
- performing, mechanical, and neighbouring percentages as nullable decimals;
- signature-required flag;
- non-signing reason;
- display order.

### `split_signature_requests`

- agreement version and participant IDs;
- hashed capability token;
- hashed OTP and expiry;
- OTP attempt count;
- request status;
- provider delivery ID;
- sent, delivered, opened, verified, signed, expired, revoked, and superseded timestamps;
- request expiry;
- idempotency key.

### `split_signatures`

- agreement version, participant, and request IDs;
- pre-signature document hash;
- signature vector/path asset ID;
- rendered signature image asset ID;
- signature asset hash;
- printed signer name;
- organisation/capacity;
- consent version and accepted text snapshot;
- signed-at UTC timestamp;
- display timezone;
- hashed IP and user agent;
- receipt ID;
- provider event/envelope ID where applicable;
- idempotency key;
- revocation/supersession metadata.

### `split_agreement_events`

Append-only event history for draft changes, version locking, sends, delivery failures, opens, OTP verification, corrections, signatures, reminders, voids, finalization, downloads, and disputes.

## 24. Service operations

Luna should preserve existing repository boundaries but replace confirmation-only operations with agreement operations:

- create/load split agreement;
- update work metadata;
- add/update/remove contributor;
- validate agreement readiness;
- preview agreement;
- create locked signing version;
- discard unsent version;
- send signature requests;
- resend/revoke request;
- load token-scoped signing package;
- issue and verify OTP;
- submit correction request;
- submit hand-drawn signature;
- submit coordinator countersignature;
- finalize executed agreement;
- load execution status;
- download final PDF/certificate/evidence/export;
- void signing round;
- create revised agreement from a prior version.

All mutating operations require idempotency keys. Workspace operations require authenticated membership and appropriate role. Public operations are scoped to one hashed token, one participant, and one agreement version.

## 25. State model

Agreement version states:

- `draft`
- `ready_for_signature`
- `locking`
- `ready_to_send`
- `sent_for_signature`
- `partially_signed`
- `correction_requested`
- `finalizing`
- `finalizing_failed`
- `executed`
- `expired`
- `voided`
- `superseded`
- `disputed`

Allowed transitions must be enforced on the server. The UI must not manufacture a legal state from local calculations.

Expiry belongs to individual signature requests. Expiring every outstanding request does not destroy or expire the locked agreement version; the coordinator may issue new requests for the same unchanged version.

## 26. Legacy data migration

Existing `publishing_share` and `master_share` values must not be silently relabelled as the three agreement columns.

For an existing split:

- import contributor identity, role, email, and current values into a new draft;
- mark the draft `rights_mapping_required`;
- show the coordinator the old publishing and master values beside the new columns;
- require the coordinator to explicitly assign the old values to performing, mechanical, and/or neighbouring rights;
- record the mapping decision in activity history;
- never send a signing request from an automatically mapped legacy draft.

The old text export remains available only for historical records created before the new agreement workflow. New agreements use PDF and evidence exports.

## 27. Privacy and evidence rules

- Agreement PDFs and signature assets live in private storage.
- Access uses short-lived signed URLs or authenticated download endpoints.
- Raw signature vectors are never used for biometric analysis.
- Raw OTPs and raw capability tokens are never stored.
- IP and user-agent values are hashed using a server-held rotating secret.
- Signature images are not exposed as reusable profile assets.
- Contributors are told that contact information and signatures will appear in the private agreement shared with the parties and rights administrators.
- Retention and deletion rules must be approved before production launch.
- Deleting a user account must not destroy executed agreement evidence required for legal, accounting, or compliance purposes; access and retention must follow the approved policy.

## 28. Failure behavior

- Partial email delivery reports sent and failed recipients separately.
- Expired links show `This signing request expired. Ask the coordinator for a new request.`
- Superseded links show `A newer version of this agreement is available. Use the latest email from Ordersounds.`
- A link for an already signed participant shows their receipt, not the signature pad.
- An invalid OTP does not reveal whether another email address or participant exists.
- A correction request freezes the current signing round immediately.
- A network error while drawing does not erase the visible signature.
- A duplicate signature submission returns the original receipt.
- A finalization error does not lose submitted signatures or mark the document executed.
- A PDF/hash mismatch is a blocking integrity error requiring internal review. Do not offer a bypass.

## 29. Accessibility and device requirements

- Complete signing must work at 320 CSS pixels wide.
- Signature pad supports touch, stylus, mouse, and trackpad.
- Controls meet minimum touch-target size.
- The signature pad has visible focus and instructions.
- Status and errors are not communicated by colour alone.
- PDF review supports zoom and keyboard navigation.
- Consent checkboxes have full descriptive labels.
- For a signer unable to draw a conventional signature, the product may accept a personally drawn mark through the same pad. A witnessed or assisted-signing route is outside this scope, not a typed-signature shortcut.

## 30. Acceptance criteria

The feature is acceptable only when all of the following are true:

1. The Rights tab displays work metadata, all contributors, all three percentage columns, and signature state.
2. A used percentage column cannot proceed unless it totals exactly 100%.
3. An unused percentage column remains blank and does not block signing.
4. Every positive-share contributor is a required signer.
5. The signing version is immutable after locking.
6. Every signer sees the complete locked PDF before the signature pad.
7. OTP verification is required before signing.
8. All three consent statements are required.
9. A visible hand-drawn signature is required.
10. Typed signatures and uploaded signature images are unavailable.
11. A signature is bound to the exact version and pre-signature document hash.
12. A correction request stops further signing and requires a new version.
13. Signatures from an old version never carry into a new version.
14. The coordinator countersignature is captured separately when required.
15. `Executed` is impossible until every required signature and final artifact exist.
16. The final PDF visibly contains each signature, printed legal name, and server date/time.
17. The execution certificate lists every signer and both document hashes.
18. Every signer receives access to the same final PDF.
19. The signed PDF cannot be edited or replaced in place.
20. Excel/CSV exports identify themselves as non-authoritative operational exports.
21. Partial send, expiry, correction, duplicate submission, and finalization failure states have tested behavior.
22. Desktop and mobile layouts remain usable without hidden percentages or signature states.
23. The final PDF renders cleanly on every page with no clipping, overlapping text, missing signatures, or illegible metadata.
24. The Rights tab remains one continuous `os-room-rail` surface with no sticky right rail, no progress stepper, no repeated helper paragraphs, and no dashboard metric cards.
25. The tab title, text sizes, tokens, borders, radii, dialogs, buttons, focus states, and responsive behavior match the current production song-room design system.
26. The contributor ledger remains the strongest visual object in draft, signing, correction, and executed states.
27. At most one primary action is visually dominant in the viewport at a time.
28. A visible sentence in the Rights tab must identify a blocker, confirm a legal action, explain an exception, or report an error; otherwise it is removed or converted to a label.

## 31. Implementation order for Luna

This is sequencing guidance, not implementation work in this document.

1. Establish agreement/version/participant/signature contracts and server-enforced state transitions.
2. Replace the Rights tab information architecture and contributor editor.
3. Add deterministic locked-PDF preview generation and hashing.
4. Add signature request delivery, token scoping, OTP verification, and correction requests.
5. Add the hand-drawn signature pad and atomic signature receipt.
6. Add coordinator countersigning and final PDF/certificate generation.
7. Add executed-state downloads, evidence package, and operational spreadsheet export.
8. Add legacy split mapping, failure recovery, responsive QA, accessibility QA, and full acceptance coverage.

## 32. Non-goals for this scope

- Copyright assignment or exclusive-licence drafting
- Publishing administration agreements
- Producer or featured-artist royalty contracts
- Reusable signature profiles
- Biometric signature verification
- Publicly accessible signed PDFs
- Third-party branding or claims of endorsement
- Automatic submission to a rights society before a separate integration is approved
- Blockchain or public-ledger notarization
- A typed-signature fallback
- Wet-ink signing or uploaded scans in this version-one scope
