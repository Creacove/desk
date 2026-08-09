# Song Asset Library, Sharing, and Lifecycle Design

**Date:** 2026-08-09
**Status:** Approved design; implementation plan not started

## Product standard

The Song Room is the authoritative operating record for a song before and after
release. Before release, it helps the artist assemble, clear, understand, and
share the release. After release, it preserves that work as a useful catalog
record for press, licensing, delivery, corrections, and Manager decisions.

The implementation extends the application's existing upload, asset, metadata,
rights, share-link, public portal, activity, mission, conversation, and Manager
context primitives. It does not introduce a parallel EPK product, file manager,
release wizard, rights system, or Manager memory store.

The interface follows a strict restraint rule: every visible element must earn
its place. One state is communicated once, one primary action leads each
surface, and decorative readiness counters do not compete with the user's work.

## Current problems

The current Song Room contains the right high-level ownership boundaries, but
several projections and interactions weaken them:

- Files behaves like a release checklist rather than the song's durable asset
  library.
- A split-sheet document appears in Files even though Rights already owns the
  split proposal and confirmation lifecycle.
- file grouping only represents Audio, Artwork, and Splits, so lyrics, press
  releases, one-sheets, and other useful documents cannot be presented cleanly.
- Files repeats overall and per-section readiness counts and missing states,
  creating unnecessary visual competition.
- the Share composer selects stored assets only and cannot include canonical
  lyrics, credits, or other song information.
- client-side share eligibility is inferred from presentation status even though
  the server correctly requires a durable uploaded file; the two boundaries can
  disagree and make Create Link fail.
- Details uses Draft, Confirmed, and Missing as both provenance and completion
  states. User-entered facts can remain Draft, while provider-confirmed fields
  become read-only even when the artist needs to correct them.
- a successful canonical change is not consistently understood as Files state,
  mission activity, and fresh Manager context.
- the same Song Room renders before and after release without sufficiently
  changing the meaning of its guidance.

## Product model

The user-facing ownership contract is:

> Files stores the song's assets. Details stores its facts. Rights stores its
> agreements. Share packages assemble selected material for a specific audience.
> The Manager understands the current state across all three.

The tab remains named **Files**. It is not renamed to EPK because it supports
more than press: production, delivery, licensing, catalog, and internal handoff
all use the same source library. The EPK is one type of package created from the
library, not a second source of truth.

## Files: canonical song asset library

### Header and hierarchy

The Files surface is titled **Song assets** and uses a short description such
as `Everything used to finish, deliver, and share this song.` The header contains:

- **Upload files** as the primary action;
- **Share** as a secondary action when at least one share-eligible item exists;
- one quiet inventory summary, for example `7 files · 186 MB`.

The current overall ready count, missing count, and per-section readiness counts
are removed. Release readiness belongs in the Manager and linked mission. Files
communicates only file states that affect a file action.

### Categories

Actual stored assets are organized into three groups:

1. **Audio**: working mixes, final masters, clean versions, instrumentals, stems,
   and other audio.
2. **Artwork & images**: cover artwork, press photos, and campaign artwork.
3. **Documents**: lyrics documents, press releases, biographies, press angles,
   one-sheets, credits, distributor notes, and other supporting documents.

These categories organize real assets; they are not a permanent wall of missing
placeholders. A stage-aware first action may still recommend the most useful
missing asset for a new unreleased song, but empty categories use a quiet add
action rather than a scoreboard.

### Rights boundary

Files does not project a required split-sheet placeholder or a Rights documents
section. Rights owns contributors, allocations, confirmation requests, and the
final agreement.

A finalized Rights artifact can be downloaded from Rights and may be explicitly
included in a share package. That does not make it a Files readiness requirement
or duplicate its legal lifecycle.

### Asset rows

Each stored asset presents:

- a file-type icon, audio affordance, or image thumbnail;
- a human-readable label;
- filename, size, and upload date;
- one actionable state: `Uploading`, `Processing`, `Ready`, or `Needs attention`;
- an overflow menu for download, replace, rename, reclassify, and delete.

The row must not simultaneously present Uploaded, Confirmed, Ready, and a
readiness count. A durably stored file is Ready even if optional technical
analysis continues. Audio rows may add duration, BPM, and key only after the
protected analyzer has produced trusted evidence.

### Upload behavior

The existing standard and resumable upload paths remain authoritative. The
surface supports one or multiple selected files and lets the user classify them
in plain language. Media type and filename can suggest a category, but the user
can correct it.

Each active upload shows filename, transferred size, numeric progress, and a
plain-language phase: preparing, uploading, saving, processing, or complete.
Failure preserves the selected file and provides retry. A successful file
appears from canonical repository state without moving the user away from Files
or resetting their scroll position.

Analysis updates the same row asynchronously and never blocks upload completion.

### Lyrics

Canonical lyrics text lives in Details and can be used by the Manager and share
packages without requiring an uploaded document. An optional original lyrics
file can also live in Files.

If text extraction is introduced for an uploaded lyrics document, extracted
text is a reviewable suggestion. It never silently overwrites canonical lyrics.
Sharing may include canonical formatted lyrics, the original document, or both.

### Download behavior

Every stored file has a reliable direct download. Multi-select may expose
**Download selected** only when a supported server path can fulfill it reliably.
A ZIP or Download all control must not be rendered before that capability exists.

## Selective share packages

### Existing foundation

The existing `music_share_links` lifecycle, hashed capability tokens, expiry,
revocation, selected-asset manifest, optional recipient restriction, and public
portal remain the foundation. Sharing stays owned by Files; there is no separate
EPK builder or database.

### Package composer

Share opens one focused composer. The user selects an audience or purpose:

- Press
- Producer
- Distributor
- Custom

These are selection presets, not separate workflows. A preset recommends
relevant items, and the user can add or remove anything before creation.

The composer has two content groups:

1. **Files** contains only assets the server marks share-eligible because a
   durable, accessible uploaded file exists.
2. **Song information** contains selectable canonical facts such as title,
   artists, featured artists, credits, lyrics, genre, mood, language, release
   date, and available identifiers.

Server-authoritative eligibility is returned explicitly. The client does not
infer downloadability from labels such as Confirmed or Cleared.

### Snapshot contract

The package stores a versioned snapshot of the selected song information and
the existing selected-file manifest. Later edits to the Song Room do not
silently change a package already sent to a recipient.

The implementation should add the smallest backward-compatible representation
possible, such as a nullable versioned information manifest alongside the
existing asset manifest. Existing links and portals must continue to load.

### Preview and creation

The composer provides **Preview package** using the same presentational
component as the public portal. The preview shows only what the recipient will
receive.

After creation, the success state exposes:

- copy link;
- open link;
- optional recipient email;
- expiration;
- revoke link.

If optional email delivery fails after link creation, the created link remains
visible and usable. Package success and email-delivery success are separate
states.

### Recipient experience

The public page requires no account and presents:

- cover artwork and song identity;
- the package purpose or intended recipient when supplied;
- selected canonical song information;
- audio preview where permitted;
- clearly grouped selected files;
- reliable individual downloads;
- a truthful expired, revoked, or invalid-link state.

Download all is added only when its backend is reliable. Contacts, comments,
approvals, external uploads, and granular collaboration permissions are outside
this phase.

## Metadata and provenance

### User-facing semantics

Metadata readiness and provenance are separate concepts. The UI uses these
states only when useful:

- **Missing**: no value exists.
- **Suggested**: the Manager or document extraction inferred a value that needs
  review.
- **Saved**: the user entered or approved the value; it is canonical and usable.
- **Verified**: the value agrees with a trusted provider or imported source.
- **Needs review**: saved and trusted source values conflict.

Direct user input becomes Saved, not Draft. A Manager update grounded in an
explicit user statement may also become Saved. Inferred themes or facts remain
Suggested until accepted.

The implementation first derives these labels from existing values, status,
and source metadata. It adds one narrow provenance or review attribute only if
the existing structure cannot safely distinguish user-saved data from inference.

### Editability

User-owned facts remain editable, including featured artists, credits, lyrics,
genre, mood, language, release information, descriptions, and press copy.
Provider verification does not permanently lock ordinary fields.

Editing a provider value creates or updates the canonical user override while
preserving the imported evidence internally. Externally assigned identifiers
such as ISRC may require a deliberate replacement action and must show their
source.

Featured-artist editing reuses the canonical metadata/contributor model and
must not create a second feature-credit list. Changes propagate immediately to
Details, sharing, Manager context, and relevant credit projections.

The Details page removes confirmed/draft/missing scoreboards and repeated
section counts. Ordinary saved values are quiet. Missing values use an inline
Add action, and suggestions or conflicts receive the visible review treatment.

## Manager awareness

### Canonical context, not parallel memory

The Manager's durable song memory is the canonical Song Room. Every focused-song
turn receives a fresh, server-built, authorization-scoped packet containing:

- song identity and lifecycle stage;
- current asset inventory and processing states;
- canonical lyrics;
- metadata, credits, and featured artists;
- Rights allocations and collaborator confirmations;
- trusted technical audio evidence;
- recent song activity;
- linked mission, tasks, and blockers;
- a current change marker or revision.

The browser never supplies this packet as trusted truth. The server resolves it
from the conversation's durable song link.

### Canonical-change pipeline

Every successful upload, replacement, deletion, metadata edit, Rights change,
or analysis result:

1. updates the existing canonical record;
2. emits the existing operating event;
3. links the event to the song mission when one exists;
4. advances or derives the song's current change marker;
5. refreshes visible repository and Manager Read state.

Existing timestamps and operating events should supply the change marker when
they are sufficient. A new monotonic revision is justified only if concurrency
tests demonstrate that existing markers cannot prevent stale publication.

An open Manager conversation may render one quiet activity receipt, such as
`Final master uploaded · Analysis pending`. It does not generate an unsolicited
AI response for every mutation.

Before answering, the Manager compares its last-known state marker with current
canonical state and reloads when the song changed. If the user says they just
uploaded a file, the Manager reads current state rather than trusting chat
history. Delayed Manager Reads cannot replace results based on newer song state.

### Interpretation boundary

In this phase, the Manager reasons from canonical lyrics, metadata, credits,
asset types, safely extracted text from relevant documents, technical audio
analysis, lifecycle stage, and mission progress.

It may describe a theme as a lyrics-based interpretation. It must not claim to
have heard vocal delivery, production texture, emotion, or other semantic audio
qualities. Actual semantic audio understanding is outside this phase.

Large documents and binary files are not inserted into every prompt. The packet
contains bounded summaries and references; relevant extracted text is retrieved
only when needed using the existing document-retrieval pattern.

### Failure isolation

Canonical work never depends on AI availability. Uploads and edits succeed and
appear immediately even when Manager refresh or analysis fails. Activity remains
durable, and the next Manager request rebuilds directly from canonical state.
Unavailable analysis is labeled Pending or Unavailable and is never fabricated.

The Manager may complete evidence-backed tasks and mutate work only in the
linked song mission. Existing approval gates remain for Rights confirmation,
external sends, spending, and release commitments.

## Lifecycle: before and after release

The Song Room remains one product across the lifecycle. Its ownership model is
stable while its operating emphasis changes.

| Surface | Before release | After release |
| --- | --- | --- |
| Overview | release state, real blockers, current Manager recommendation, linked release work | performance interpretation, opportunities, post-release recommendation, linked campaigns |
| Files | working assets, masters, artwork, documents, delivery preparation | durable asset archive, EPK/licensing/press sharing, alternate-version additions |
| Details | assemble and review lyrics, credits, metadata, dates, and identifiers | authoritative released metadata, provider identifiers, corrections, historical release facts |
| Rights | allocate splits, collect confirmations, resolve clearance | preserve finalized terms and evidence; surface registration, royalty, or dispute follow-up without reopening clearance |
| Share | producer, press, and distributor preparation | continuing EPK, press, licensing, sync, and catalog handoffs |

### Released Files behavior

A song released through Ordersounds retains its final masters, alternates,
artwork, lyrics, credits, press materials, documents, and package history. Files
stops emphasizing pre-release missing assets and becomes the durable archive and
sharing source.

An imported released/catalog song may have provider metadata without private
files. That is not a failed or incomplete release. Its Files empty state invites
the artist to attach controlled masters, artwork, and press materials to make
the catalog record shareable.

### Released Details and Rights behavior

Released Details prioritizes release date, artists, credits, lyrics, identifiers,
distributor/label facts, provider links, and provenance. The UI explains that an
Ordersounds correction does not itself mutate a distributor or DSP.

Released Rights preserves final allocations, confirmation history, agreements,
and unresolved post-release issues. An imported song without connected proof is
described as `Rights agreement not connected in Ordersounds`, not release blocked
or legally uncleared.

### Released Manager behavior

The existing pre-release, release-window, and released Manager modes are
extended. After release, the Manager stops reopening completed pre-release
gates and reasons from release age, available platform signals, audience and
geographic evidence, campaign material, package activity, current metadata or
Rights risk, and linked post-release work.

The release mission may close with a release receipt and suggest one bounded
post-release review. It does not automatically create a large campaign or a
second song workspace.

### Transition contract

Moving to Released records the release date, changes the operating mode,
refreshes Manager context, and changes relevant recommendations. It does not
move, copy, or discard assets, metadata, Rights, conversation, mission, package,
or activity history.

Released and Catalog remain locked post-release modes under the existing policy;
implementation must not accidentally reopen pre-release mutation paths.

## Future distribution foundation

The resulting canonical song data supplies the correct future distribution
boundary:

- canonical metadata;
- eligible delivery assets;
- artwork;
- Rights state;
- release information;
- a versioned package snapshot.

Human share links and distribution APIs are separate delivery channels that may
consume the same canonical package. A share link grants controlled human access;
a future distribution adapter submits authenticated structured data and files to
a provider. No distribution abstraction or provider integration is added now.

External collaborator upload links and electronic-signature/DocuSign workflows
are also explicitly deferred. They require distinct write-capability and legal
authorization models and must not be hidden inside the read-oriented share link.

## Engineering guardrails

### Reuse

Implementation reuses:

- Song Room tabs and navigation;
- `uploaded_files` and `music_assets`;
- standard and resumable upload paths;
- the protected audio-analysis worker contract;
- `music_share_links`, token authorization, and public portal;
- existing metadata and contributor records;
- Rights confirmation records and endpoints;
- operating events and song-to-mission links;
- focused-song conversations, Manager packet, retrieval tools, and released-mode
  policy.

### Explicit non-goals

- a separate EPK database or page;
- a parallel file manager or release wizard;
- a duplicate split-sheet workflow;
- a background Manager memory service;
- external uploads, comments, approvals, or contact management;
- DocuSign or another electronic-signature provider;
- semantic audio understanding;
- distribution API integration;
- speculative ZIP/download-all controls;
- decorative readiness dashboards.

### UI rules

- One primary action per surface.
- Secondary actions remain visually secondary.
- A status appears only when it changes what the user can or should do.
- The same state is not repeated through badges, counters, banners, and prose.
- Empty states explain one meaningful next action.
- Advanced row actions use progressive disclosure.
- Canonical mutations provide immediate feedback and preserve tab and scroll
  context.
- Desktop and mobile preserve the same information hierarchy.
- Motion explains upload, processing, insertion, and completion; it does not
  decorate static content.

## Delivery sequence

The implementation plan should preserve independently verifiable boundaries:

1. Add characterization tests for current projections, uploads, share creation,
   public links, metadata edits, Manager context, and released behavior.
2. Correct the asset projection and types to represent Audio, Artwork, and
   Documents while removing the duplicate Rights placeholder.
3. Simplify Files and preserve current upload behavior.
4. Diagnose and repair Create Link at the server boundary, then expose explicit
   share eligibility.
5. Add the backward-compatible song-information snapshot and extend the current
   composer and public portal.
6. Correct metadata editability and provenance semantics using the narrowest
   compatible data change.
7. Enrich and refresh the existing Manager packet from canonical mutations.
8. Adapt presentation and Manager guidance for released/catalog songs.
9. Run focused tests, the full suite, production build, and real browser QA.
10. Deploy additive database and Edge Function changes before their compatible
    frontend, then verify production and rollback boundaries.

The detailed implementation plan may split these boundaries into separate
commits or deployments. No partial deployment may expose a frontend control
before its server contract is available.

## Verification matrix

### Unreleased song

- Upload audio, artwork, and documents with progress, retry, and stable page
  context.
- Confirm successful files appear from canonical state and can be downloaded.
- Confirm no split-sheet requirement appears in Files.
- Save lyrics, featured artists, and other user metadata as canonical Saved
  values.
- Review and accept or reject a Manager/document suggestion.
- Confirm the Manager sees uploaded assets, lyrics, metadata, Rights, recent
  activity, and linked mission state on the next turn.
- Confirm stale recommendations do not survive a newer canonical change.

### Sharing

- Create Press, Producer, Distributor, and Custom packages from selected assets
  and selected song information.
- Confirm only server-eligible files can be selected.
- Preview and public portal render the same selected content.
- Open and download without an app session.
- Confirm optional email failure preserves the link.
- Expire and revoke links truthfully.
- Load previously created asset-only links successfully.

### Released and imported catalog songs

- A manually released song retains all canonical records and changes to
  post-release presentation and Manager guidance.
- An imported released song without private files receives an invitation, not a
  false missing-release warning.
- Released Rights does not reopen pre-release clearance because Ordersounds lacks
  historical confirmation evidence.
- Existing released/catalog stage locks and Manager non-regression policy remain
  intact.

### Regression and production

- Rights allocation and public confirmation continue to work independently of
  Files.
- Song creation, official conversation, linked mission, upload analysis,
  Manager Read, catalog import, and ordinary Manager conversations remain intact.
- Mobile and desktop hierarchy is verified at supported breakpoints.
- Focused tests, full automated suite, type checking, linting where configured,
  and production build pass.
- Production QA uses one unreleased song, one manually released song, one
  imported catalog song, and an anonymous share recipient.

## Acceptance criteria

- Files is a restrained, durable asset library for Audio, Artwork & images, and
  Documents.
- Rights owns split agreements without a duplicate Files requirement.
- Uploads provide clear progress and canonical results without displacing the
  user.
- Users can create, preview, open, download, and revoke selective packages made
  from stored files and canonical song information.
- User-entered metadata is Saved and editable; inferred data is Suggested;
  provider evidence remains visible without taking ownership away from the user.
- The Manager receives fresh, bounded canonical song context and does not ask for
  data the user just supplied.
- The Manager makes lyrics-based interpretations without claiming semantic audio
  understanding.
- The same Song Room moves cleanly from release preparation to durable
  post-release catalog operations.
- Existing asset, Rights, mission, conversation, catalog, and share-link behavior
  remains backward compatible.
- Deferred collaboration, electronic signature, semantic audio, and distribution
  work is not accidentally introduced in this phase.
