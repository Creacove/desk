# Song Sharing Experience Design

**Date:** 2026-08-09  
**Status:** Approved product direction; written review pending

## Outcome

Sharing should feel like handing someone a finished, private music package—not configuring a database record. An artist chooses the purpose, confirms the material, creates one controlled link, and immediately knows what the recipient will see. The recipient opens a polished music-first page that works without an Ordersounds account.

This is a focused correction of the existing Files sharing increment. It reuses `music_share_links`, the hashed token lifecycle, selected manifests, access tracking, signed storage access, email delivery, and the public `/share` route. It does not introduce a second EPK product, contact manager, collaboration system, password system, comments, uploads from recipients, or ZIP generation.

## Product decisions

### One clear owner flow

The share interaction has three natural states and no visible stepper:

1. **Build package** — choose a familiar purpose and confirm the content.
2. **Preview** — inspect the exact recipient presentation.
3. **Link ready** — copy, open, email, or revoke the link.

Email is not requested before link creation. Creating a link is the primary task; sending it is a follow-up action. This prevents email delivery from blocking a usable share and keeps the builder focused.

### Familiar package purposes

The builder offers three presets and Custom:

- **Listen**: the current playable audio version, artwork when available, song title, and primary artist.
- **Press kit**: current audio, cover and press images, accepted press/biography/lyrics documents, and populated public-facing song facts.
- **Delivery**: final or current master, approved artwork, accepted delivery documents, and populated release metadata.
- **Custom**: starts empty and lets the artist choose from all eligible content.

Presets are selection defaults, not separate products. Switching a preset replaces the suggested selection until the user manually changes it; a customized package is labeled Custom.

Only content that actually exists and is eligible appears. Missing biography, genre, label, release date, documents, or files are never rendered as checked options and never counted in preview. A preset with no eligible content has one compact recovery action back to Files; it does not show a missing-content checklist.

### Quiet package builder

The desktop builder is one restrained modal within the existing Ordersounds visual system. Mobile uses a full-height sheet with safe-area spacing and a sticky primary action.

The builder contains:

- song artwork, title, and artist as compact context;
- a segmented purpose selector;
- selected eligible content grouped as Audio, Images, Documents, and Song details;
- one concise package summary;
- secondary `Preview` and primary `Create link` actions.

It removes the current introductory paragraph, optional email field, security explanation, repeated Uploaded pills, package history, and file-count placeholder preview. Ordinary eligibility is communicated by presence, not badges.

The loading state uses stable skeleton rows in the content area. A creation failure preserves every selection and places one actionable error next to `Create link`.

### Real preview

Preview is a full recipient preview powered by the same package presentation component as the public route. It shows the selected artwork, identity, playable audio, documents, metadata, and download permissions in their final hierarchy. Preview requests short-lived owner-authorized media access when playback or artwork is needed; a failed preview asset remains identifiable and does not block the rest of the preview.

Preview is not a count, summary card, or alternate visual approximation.

### Dedicated result state

After creation, the builder is replaced—not extended—by a calm success state:

- `Copy link` is primary;
- `Open package` opens the actual recipient route;
- `Send by email` reveals a single recipient field and send action;
- `Revoke link` is available as a quiet destructive action;
- `Create another package` returns to the builder.

The raw URL is not placed in a cramped multi-button row. It appears in one selectable field below the primary actions when useful. Copy success is announced inline and accessibly. Email failure leaves the link ready and offers a local retry.

Existing links live behind a secondary `Manage links` control in the share header. That view shows active packages first with purpose, recipient when present, creation time, opens, and Revoke. Revoked history is collapsed by default. History never competes with package creation.

## Recipient experience

The public route is a private listening and handoff page, not an Ordersounds dashboard and not a generic file list.

### Hierarchy

1. A minimal Ordersounds wordmark and `Shared privately` trust cue.
2. Artwork and song identity.
3. The primary audio player when audio is included.
4. The selected press copy or other long-form document when relevant.
5. Selected files grouped by Audio, Images, and Documents.
6. Selected song details in a compact definition list.

The page uses the app's typography, neutral palette, radii, focus treatment, and spacing, but removes the authenticated shell. On desktop it uses a compact editorial two-column hero when artwork exists. On mobile it becomes one column with artwork, identity, and playback above the fold.

Audio gets one prominent player. It is not repeated inside every download row. Artwork renders as imagery, not a generic file icon. Each downloadable item has one explicit action. Native documents are readable on the page and do not pretend to be downloadable files.

The page never exposes unselected song data, Manager analysis, missions, readiness, Rights, internal statuses, or storage terminology. It does not contain explanatory filler such as “this package contains only...” when the interface already proves that.

### Media delivery

The public function returns separate short-lived inline and download URLs where appropriate:

- inline URLs permit artwork rendering and audio playback;
- download URLs retain the intended filename and explicit download behavior.

The package remains a frozen snapshot. Later Song Room edits do not silently change previously shared content.

### Failure states

- Loading reserves the final artwork and player geometry with restrained skeletons.
- Revoked, expired, invalid, and unavailable links show one neutral message and no dead controls.
- An unavailable individual file is omitted or marked unavailable without breaking the entire valid package.
- Playback failure retains Download when the file remains downloadable.

## Canonical data contract

### Eligibility and metadata

The server remains authoritative for share eligibility. The UI may show only durable assets backed by an accessible uploaded file and accepted native documents with non-empty current content.

Canonical song details must resolve from all existing sources in this order:

1. user-saved `metadata.manual_details` overrides;
2. canonical top-level song metadata;
3. imported provider metadata;
4. canonical song columns such as title and release timestamp.

This fixes the current mismatch where Details can show a saved value but share creation reads an older or empty metadata location. The server returns only populated selected fields. The client does not offer empty metadata choices.

### Package projection

The public payload is extended backward-compatibly with:

- song title and primary artist;
- package purpose;
- artwork asset reference when selected;
- inline and download URLs per stored asset where applicable;
- selected native documents and song details;
- creation and optional expiry context needed for truthful presentation.

Existing asset-only share links continue to load. No destructive migration is required.

## Email handoff

The existing transactional email path remains. Its template becomes a restrained Ordersounds invitation:

- subject: `<artist> shared <song> with you`;
- sender context and package purpose;
- one `Open private package` button;
- a plain fallback URL;
- a short private-link/revocation note.

The email does not list every file, expose internal statuses, or imitate a marketing campaign. It works on narrow email clients and includes accessible text equivalents.

## Interaction and accessibility details

- One primary action per state.
- All dialogs trap focus, close with Escape, restore focus to Share, and prevent background scroll.
- Segmented choices, selections, Copy, Open, Email, and Revoke are keyboard accessible and have unambiguous names.
- Loading and copy/send/create/revoke results use polite live announcements.
- Touch targets are at least 44 px on mobile.
- Sticky mobile actions respect safe areas and never cover the last content row.
- Reduced-motion preferences remove nonessential transitions.
- Motion is limited to state replacement, selection changes, and success confirmation.

## Engineering boundaries

The implementation should extract focused components rather than grow `MusicScreens.tsx` further:

- `MusicShareDialog` owns builder, preview, result, and link-management states.
- `MusicSharePackageView` renders both authenticated preview and public package content.
- preset selection and canonical information resolution are pure functions with direct tests.
- the existing repository contract remains the application boundary; it is extended only for fields the new presentation actually needs.

No unrelated Song Room redesign is included.

## Verification

### Builder

- Each preset selects only eligible, existing content.
- Empty metadata and empty documents never appear or count.
- Manual Details overrides appear immediately in sharing.
- Custom selection survives preview and link-creation errors.
- Preview matches the public renderer.
- Mobile sheet remains usable at supported narrow widths.

### Result and management

- Copy, manual selection, Open package, email send/retry, create another, and revoke all work.
- Email failure preserves the created link.
- Active links and access counts load without crowding creation.
- Revoked links leave the active list and become unavailable publicly.

### Recipient

- Anonymous recipients can view selected identity, artwork, playback, documents, metadata, and allowed downloads.
- Unselected content never appears.
- Inline audio and artwork work independently of named downloads.
- Old asset-only links remain valid.
- Invalid, expired, and revoked routes are calm and truthful.

### Regression and deployment

- Files upload, artwork projection, Details persistence, Manager awareness, Rights, missions, and conversation behavior remain unchanged.
- Focused tests, full test suite, production build, desktop and mobile browser QA, authenticated link creation, anonymous recipient QA, email delivery, and production deployment all pass.

## Acceptance criteria

- An artist can understand and complete sharing without training.
- The builder contains no empty, duplicated, or explanatory content that does not change a decision.
- The preview is the real recipient experience.
- The generated link feels like a polished private music handoff.
- Every visible action works on desktop and mobile.
- Sharing uses the Song Room's actual current files, documents, and saved facts.
- The result remains native to Ordersounds while meeting the interaction standard validated by modern music-sharing products such as Untitled.
