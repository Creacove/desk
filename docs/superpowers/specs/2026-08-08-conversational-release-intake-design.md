# Conversational Release Intake Design

**Date:** 2026-08-08  
**Status:** Approved for implementation

## Decision

An artist can start an unreleased-song release workflow from any Ask Manager
composer. Conversation is the launchpad, the existing Song Room remains the
canonical Music surface, and the existing mission system remains the execution
surface. Chat must not create a parallel release product or a bare Music record.

The user-facing result is one calm, durable moment: after the artist names a
song and supplies enough current-state context, this conversation becomes the
official song thread and presents one Song Workspace artifact. That artifact
links to the focused Song Room and makes the dedicated release mission visible
without turning the chat into a project-management dashboard.

## Goals

- Let an artist begin with natural language such as `I want to release a new
  song` rather than navigating to Music first.
- Reuse the existing manual-song workspace model: one song, one dedicated
  mission, one first task/checkpoint, one official conversation, and durable
  artifact links.
- Adopt the initiating conversation as the official song conversation. Do not
  create a second thread for the same song.
- Keep the creation receipt visually focused on the Song Workspace, with the
  mission presented as supporting operational context.
- Make retries safe and make partial workspaces impossible.
- Preserve the current Catalog/manual path, imported catalog behavior, ordinary
  Manager conversations, and all Music/Rights/Files ownership boundaries.

## Non-goals

- A second release-plan data model, a new dashboard, a wizard, a Kanban board,
  or a separate task system.
- Model-owned direct database writes for song creation.
- Auto-sending, distribution submission, spending, schedule changes, public
  release state changes, or rights confirmation.
- Replacing the existing Song Room, Manager Read, mission graph, or chat
  transport.

## Product Rules

### New versus existing song

When the artist requests a new song release, Manager asks only for the title
and the current stage when those facts are not clear. It must not start a broad
release questionnaire. When title and stage are clear in the opening message,
Manager can create the workspace in that turn.

When the artist names an existing song, Manager resolves the existing Song Room
instead of creating a duplicate. If multiple plausible matches exist, it asks
the artist to choose before creating or attaching anything.

If the title is known but stage is not, the Manager may create the workspace at
the conservative `idea` stage and immediately ask the artist to confirm the
real stage. The response must say that the stage still needs confirmation.

### Durable workspace invariant

A conversational release workspace is valid only when all of the following
exist in the same transaction:

1. a `music_item` for the unreleased song;
2. a dedicated linked release-preparation mission;
3. its first plan/checkpoint/task;
4. one official conversation linked to the song;
5. the conversation's `linked_mission_id` pointing to that mission; and
6. an operating event carrying the creation origin and idempotency key.

If the transaction fails, none of those records may persist. If a request is
replayed after a timeout, it returns the same song, mission, and conversation.

### Conversation scope

After a song is bound, the conversation is permanently scoped to that one Music
subject unless an explicit future scope-change flow is introduced. Manager
mission graph decisions from this thread may update only the attached mission.
They must never select an artist-wide mission, a different song's mission, or
an unrelated task.

## Experience

### Conversation states

| State | Visible product behavior | Durable behavior |
| --- | --- | --- |
| Intent detected | One focused prompt for title/current stage | No new records |
| Clarifying | Natural Manager question or existing compact context control | No new records |
| Provisioning | A quiet inline `Preparing <song>'s release workspace` progress row | One idempotent transaction in flight |
| Ready | One Song Workspace receipt card and persistent song context card | Song, mission, conversation, links, and event committed |
| Operating | Stage-aware questions and linked work | Fresh canonical Song Room packet on every turn |
| Recoverable failure | Inline failure copy and `Retry` | No partial workspace; retry reuses idempotency key |

The composer is disabled only while the provisioning turn is resolving, to keep
conversation ordering deterministic. It becomes available immediately after a
success or recoverable failure.

### Receipt and motion

The creation receipt is a product-owned artifact, not generic model prose. It
uses the existing Manager conversation card language and presents:

- `Song workspace` eyebrow;
- song title and confirmed/current lifecycle stage;
- a small `release mission linked` status;
- the next canonical action; and
- one `Open song` action.

The artifact appears only after the server commits. A temporary progress row
can fade/expand into it; it must not claim success based on a predicted model
tool call. Motion is short, restrained, and uses the existing product palette,
surfaces, typography, and reduced-motion rules. It does not introduce a new
visual system or an animated project timeline.

The artist remains in chat after creation. `Open song` selects the most useful
existing Song Room surface: Files when package assets are absent, Rights when
rights are the immediate blocker, and Overview otherwise. Returning to Manager
opens the same conversation.

### Mission behavior

Provisioning seeds the existing `Prepare <song> for release` mission with only
the first stage-aware action. It is an internal operating home, not a public
release commitment. The Manager grows the same mission only when canonical
state and artist context justify a next checkpoint or task.

## Architecture

### Workspace command

Add an additive `create_conversational_song_workspace_v2` RPC (or equivalently
named versioned command) beside the current manual initializer. It receives the
same trusted workspace identities and song input plus an existing conversation
ID and request ID.

The current manual initializer continues to provision a new official
conversation. The conversational initializer validates that the supplied
conversation belongs to the workspace, is not already linked to another Music
subject, and adopts it as the official conversation. Both routes reuse the
same song/mission/task/checkpoint/link creation rules.

### Manager tool boundary

Replace the Manager agent's bare `create_music_song` mutation tool with a
strict `ensure_song_release_workspace` tool. The server injects conversation
identity, manager run identity, and the idempotency key; the model supplies only
title and allowed unreleased stage. The tool returns the created song, linked
mission, and official conversation context. It emits canonical created-work
receipts for the UI.

The tool is not available for an already song-scoped conversation, and all
lower-level model creation paths are removed from the conversation tool list.

### API and streaming contract

Conversation result view models must carry the resolved `musicSubject` when a
tool binds the conversation during that turn. Stream clients need a subject-bound
event or terminal result that lets the sticky context card and Song Workspace
artifact appear without reload. The completion response remains the source of
truth; stream updates are optimistic visual progress only.

### Reconciliation

After a successful command, invalidate/reload the Music list and mission list
from their existing repository paths. The conversation response itself supplies
the immediately renderable subject receipt. A reopen always reloads durable
links rather than trusting local state.

## Error Handling

- Conversation lookup failure, subject conflict, mission conflict, or any
  insert failure rolls back the RPC transaction and returns actionable error
  text.
- Network failure after a committed transaction keeps the same request ID for
  retry. The response finds and returns the existing workspace.
- A Manager run may fail after the workspace command succeeds. The committed
  Song Room and mission remain usable; the conversation shows a retryable
  Manager failure rather than invalidating the workspace.
- Existing-song ambiguity never creates a new Music item automatically.

## Acceptance Criteria

- A new-release conversation can create a song workspace without Catalog.
- Chat-created and manually created unreleased songs meet the same durable
  workspace invariant.
- The initiating thread is the only official conversation for the new song.
- The thread immediately renders its persistent Music subject and one compact
  Song Workspace receipt once the command commits.
- A new song conversation cannot alter an unrelated mission.
- Retry cannot create duplicate songs, official conversations, missions, or
  first tasks.
- Existing Music, Manager, and Catalog workflows continue to pass their
  regression suites.
