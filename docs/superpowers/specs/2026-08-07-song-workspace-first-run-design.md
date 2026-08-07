# Song Workspace First-Run Design

**Date:** 2026-08-07  
**Status:** Approved design; implementation not started

## Problem

The current manual-song path creates a music record and opens the Song Room on
Overview. A new record therefore lands on a surface with no useful first action.
Starting the Manager creates a generic conversation that is not visibly bound to
the song and can update an unrelated workspace mission. The result is a weak
first-run experience and an unsafe work boundary: a song such as `Debbie` can
become an item inside a broad artist-positioning mission rather than receiving
its own operational mission.

The existing Song Room already has the correct canonical surfaces:

- **Files** owns uploaded audio, artwork, and supporting documents.
- **Details** owns editable song metadata.
- **Rights** owns contributor, split, and approval information.
- **Overview** owns the compact current-state summary.

This work must make those surfaces and the existing Manager system operate as a
single song workspace. It must not introduce another song dashboard, duplicate
metadata fields, or make the Manager a competing source of truth.

## Goals

- Make a manually created unreleased song immediately useful and self-directed.
- Provision exactly one dedicated song mission and one official song
  conversation for a manual song, using the existing mission, conversation,
  task, and artifact-link model.
- Keep Manager work strictly scoped to that song's linked mission unless the
  user explicitly changes scope.
- Make the song reference visible and persistent in the conversation, with
  direct navigation in both directions.
- Give the Manager fresh, server-built song state on every turn and refresh its
  Overview read when canonical song state changes.
- Preserve manual editing and useful behavior when an AI call or background
  read fails.
- Leave imported/released-song behavior intact except for additive linking and
  conversation-context improvements.

## Non-goals

- New tables for duplicate song, metadata, or workflow state.
- A new wizard, setup dashboard, or alternate Files/Details/Rights UI.
- Image generation or synthetic artwork.
- Letting the Manager upload audio, artwork, split documents, schedule a
  release, spend money, send external messages, or confirm legal rights without
  the required user action and approval.
- Replacing the existing Manager Read, mission system, or conversation system.

## Chosen Experience

### 1. Manual creation is a workspace-creation transaction

When a user selects **Create manually** and submits the song title and current
lifecycle stage, the product presents a short pending state: **Setting up your
song workspace…**. It does not show the previous catalogue screen or navigate
to a partially initialized Overview.

The server-owned initializer idempotently ensures these existing-domain records
and links for the new song:

1. the music item;
2. one dedicated song mission, titled with a stage-appropriate equivalent of
   `Prepare <Song> for release`;
3. one stage-appropriate first task inside that mission;
4. one official song conversation, titled `<Song> — song workspace`;
5. existing artifact links between the song, mission, and conversation.

The new song is opened on the existing **Files** tab. Its first-action panel is
derived from the actual stage and package state. A song without audio leads with
an action such as **Upload working audio**; it does not expose a generic release
plan or an empty Overview. The setup succeeds only when the durable song,
mission, and conversation links exist. It is safe to retry: the same song cannot
gain duplicate official conversations or missions.

The initial Manager message is deterministic, concise, and stage-aware rather
than a model-generated generic prompt. For example, a song at Mastering with no
file inventory begins by directing the user to upload the master or current
working audio in Files. Once the user replies, the Manager agent takes over with
fresh canonical context. This prevents a slow or failed model call from turning
creation into a blank or misleading experience.

### 2. One canonical conversation and one bounded mission

The official conversation is the song's operating thread, not an informal
unlinked chat. Its header contains a compact, persistent context card:

`Song · <title> · <current stage> · Open song`

The card remains visible while the message list scrolls and opens the existing
Song Room. The conversation's server record and every subsequent request are
resolved from its durable song link; a client-supplied song reference is useful
for navigation but never trusted for authorization or scope.

The dedicated mission starts deliberately small. Its first task is selected from
the song's stage and known package state, rather than a generic thirty-task
release plan. As confirmed information arrives, the Manager can create,
complete, or reorder work *only* within the song mission. Server-side scope
validation rejects attempts to update a broad artist mission, another song's
mission, or an unlinked task through this conversation.

The user can always edit canonical facts directly in Files, Details, and Rights.
The Manager may write existing editable fields when the user has provided the
value. Inferred data is saved as **Draft** and accompanied by an explanation and
a direct link to review it. Rights, splits, release commitments, external
distribution, and spending remain confirmation-gated.

### 3. Overview becomes a sparse link and state surface

Overview does not repeat data owned by Files, Details, Rights, or metadata.
Its existing **Linked work** area is extended, not replaced, with two compact
cards:

- **Conversation**: the official thread title, its current status or latest
  update, and an `Open conversation` action.
- **Mission**: the dedicated linked mission title, active-task count, and an
  `Open mission` action. Additional explicitly linked song missions may appear
  below it.

The existing **Continue with Manager** action is only a shortcut to that same
official conversation. It never creates a second conversation or competes with
the Conversation card. If the conversation is being recovered, the action
communicates that state rather than silently creating another one.

### 4. Manager context and conversation behavior

Every Manager turn constructs a fresh server-side song packet from the canonical
record and durable links. At minimum it contains lifecycle stage, available and
missing file categories, editable metadata state, rights/split state, linked
song mission progress, and recent canonical changes. Chat history provides
continuity but never replaces this packet.

The Manager instruction contract is:

- Start from the song's real stage and ask for the highest-leverage next action
  or answer.
- Never ask for data already present in the packet.
- Ask one concise question when one answer unlocks progress.
- Request a compact batch only when the values naturally belong together (for
  example genre, mood, and language; or collaborator names, roles, and emails).
- For an upload-only action, tell the user exactly which existing Files or
  Rights control to use and wait for the canonical change. It must not claim to
  have uploaded or received a file it cannot see.
- Explain why a task was added, changed, or blocked in plain language.
- Do not propose release, spend, external sending, or rights confirmation as a
  completed action without the required user approval.

The agent's available mutation tools enforce the same boundary. They can read
the focused song and its linked mission, make permitted draft/confirmed field
updates, and mutate only linked song work. They cannot use a mission-graph
decision to repurpose an unrelated mission.

### 5. Canonical-change synchronization

Files, Details, Rights, and stage changes remain the authoritative state. Each
successful canonical mutation emits the existing server-side song-change event
and schedules the existing Manager Read refresh path. The refreshed read is
built from the newest song snapshot; a delayed read from an earlier snapshot
cannot become the current result.

Immediately after a change, the canonical UI reflects it. Overview enters a
quiet **Updating from latest song changes** state while the Manager Read is
recomputed. It must not keep presenting an obsolete recommendation such as
`Upload the master` after a successful master upload. If the read refresh fails,
the UI reports that limited failure while Files, Details, Rights, the mission,
and manual editing continue to work.

When the user returns to the conversation or sends the next message, the
Manager's fresh packet sees the change and responds from it: for example, it
recognizes the uploaded master and moves to the next real blocker rather than
repeating the prior request.

## Architecture and Data Boundaries

The implementation reuses current tables and the existing artifact-link model.
It may add a narrowly scoped database RPC or Edge Function initializer and an
idempotency/uniqueness guarantee needed to atomically ensure the existing
records. It does not create a second music object, release-plan table, or
parallel workflow model.

The client receives a richer linked-work view containing the official
conversation's ID, title, status, and last-update metadata alongside the
existing linked missions. Conversation loading resolves the durable song link
into a structured `musicSubject` view used by the sticky header and by all send,
context-answer, and retry envelopes.

The current Manager Read worker and policy are extended rather than duplicated:
their input is the canonical song snapshot plus a monotonically comparable
change marker/snapshot identity. A completed result is published only if it is
still current for the song.

## Compatibility and Recovery

- Existing manually created songs are not backfilled automatically. Opening
  **Continue with Manager** for a legacy song uses an idempotent ensure path to
  create the missing official conversation and dedicated mission without
  changing unrelated missions.
- Existing imported/released songs retain their current lifecycle and linked
  work. They are never routed through the unreleased manual-song setup path.
- Existing conversations without a song link remain ordinary Manager
  conversations and receive no song header.
- If initial provisioning fails, the creation dialog stays actionable and
  exposes `Retry setup`; it does not redirect the user to a partly linked room.
- If the Manager service is unavailable after setup, the deterministic opening,
  song room, canonical editing, and mission remain usable. The chat provides a
  clear retry state.

## Testing Strategy

### Client and UX tests

- Manual creation displays the setup pending state, completes into Files, and
  never flashes a stale catalogue or blank Overview.
- The Files, Details, Rights, and Overview tabs remain their existing canonical
  surfaces; Overview has no duplicate metadata or file checklist.
- Linked work displays one official conversation and its linked mission; both
  open their existing destinations.
- Continue with Manager opens the same conversation and cannot create a second
  thread.
- A song conversation renders the persistent song context card; ordinary
  conversations do not.
- Every send, structured context answer, and retry carries/resolves the same
  song context.

### Service and agent tests

- Initializing the same manual song twice produces exactly one song mission,
  one official conversation, and one initial task.
- A new song's mission is linked to that song and no existing strategic mission
  is updated.
- Tool validation rejects an unlinked mission or task target from a song
  conversation.
- The initial message and first task vary correctly with lifecycle stage and
  known file state.
- The Manager receives canonical uploaded-file, metadata, and rights state on
  every turn and does not ask for present data.
- Manager-proposed field changes preserve Draft versus Confirmed semantics and
  keep user editing available.

### Read freshness tests

- Uploading, replacing, deleting, or classifying an asset triggers the existing
  refresh path.
- Metadata, rights, and lifecycle changes do the same.
- A newer canonical change prevents an older read result from being published
  as current.
- Refresh failure never removes or contradicts the canonical song state.

### Regression and release checks

- Imported/released song navigation and post-release Manager behavior remain
  unchanged.
- Full unit/integration suite and production build pass from `main`.
- Before deployment, test a new manual song end-to-end: creation, first Files
  action, official conversation, mission isolation, upload/read freshness,
  metadata update, rights update, and retry behavior.

## Acceptance Criteria

- A newly manual-created song opens on Files with a useful next action and has
  one durable official conversation and one dedicated mission.
- The conversation visibly and durably references the song on every turn.
- No song conversation can silently update an unrelated workspace mission.
- The Manager adapts to stage and canonical data, asks proportionate questions,
  and distinguishes user-only upload actions from fields it can update.
- Overview remains sparse and shows only the official linked conversation and
  genuine linked mission work.
- Canonical changes refresh the Manager Read without stale recommendations or
  late-result regression.
- Legacy and released-song behavior remains compatible.
