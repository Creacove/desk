# Autonomous Checkpoint Work Design

## Problem

Mission Genesis currently turns some Manager analysis into artist-facing tasks. A task such as “validate whether a song converts discovery into artist-owned leverage” can be owned by `Manager`, contain research the operating packet already supports, and still be rendered as a required artist upload. The frontend then synthesizes a missing deliverable from the task title, disables completion, and the review function independently rejects completion without a document.

This produces three failures:

- the artist cannot tell what they are actually expected to do;
- an optional private-data contribution becomes a workflow gate;
- checkpoints display a generic mission recommendation instead of a checkpoint-specific Manager read.

## Product principles

1. The app proceeds with the evidence it already has.
2. A missing upload lowers confidence or changes the safe recommendation; it never blocks use of the app.
3. The artist task list contains only work a person must decide, approve, perform outside the app, or report back.
4. Research, comparison, synthesis, and recommendation are Manager work and appear as a checkpoint read, not as an artist task.
5. Every checkpoint answers three questions with progressive disclosure:
   - What does the Manager think now?
   - What decision is this checkpoint protecting?
   - What, if anything, is needed from me?
6. High-stakes uncertainty produces a conservative recommendation such as “hold spend” or “do not submit yet,” not an upload wall.

## Architecture decision

Use the contracts and tables already present. Do not add a task orchestrator, background queue, new task enum, or destructive data migration.

Mission Genesis will add two checkpoint-specific output fields:

- `managerRead`: the current evidence-backed judgment for that checkpoint;
- `nextAction`: the single next artist/team action, or a clear statement that nothing is needed from them.

These map to existing `checkpoints.recommendation` and `checkpoints.next_action` columns. Existing `requiredEvidence` and `missingEvidence` remain evidence context and limitations; they no longer imply a required upload.

Mission plans may contain checkpoints with zero user tasks. Those checkpoints persist as `watching_signal`. A visible task is valid only when a person must:

- make or approve a decision;
- perform an external action the app cannot perform;
- confirm an offline fact or outcome;
- review a Manager-prepared draft.

`manager_draft` remains the route for substantive artifacts the Manager can prepare. `result_note` remains the normal human completion route. `evidence` remains readable for legacy rows but Mission Genesis stops generating it as a required completion contract.

## New-mission behavior

Mission Genesis receives the complete operating packet and writes the initial checkpoint read itself. It must not create a task whose owner is exactly `Manager`, or whose substantive action is only to review, analyze, compare, research, validate, or issue a recommendation.

A plan may therefore look like:

- Checkpoint: “Is Cough building Odo-level leverage?”
- Manager read: “Public stream and discovery signals show breakout attention, but available evidence does not yet prove durable artist attachment. Keep validation active; do not scale broadly.”
- Evidence limit: “Private saves and source-of-stream data are unavailable.”
- Next: “Nothing needed from you. The Manager is watching repeat-listening and artist-profile movement.”
- Artist tasks: none.

If a real human action exists, the task describes that action directly, for example “Approve the artist-centered campaign angle” or “Report the outcome of the Lagos listening session.”

## Optional uploads

Uploads remain available as evidence enrichment. On a task, “Add context” is a secondary disclosure beneath the main work. An attachment can be submitted with the task result and included in Manager review, but:

- there is no `Missing` badge;
- no primary action is disabled because a file is absent;
- no synthetic deliverable repeats the task title;
- the backend accepts completion with zero documents;
- attached documents continue through the existing upload, validation, and review path.

## Legacy compatibility

Do not rewrite active mission data in place.

The read projection treats a task whose normalized owner is exactly `Manager` as internal Manager work:

- it is excluded from the artist task list and checkpoint task counts;
- it is excluded from `nextTask` selection;
- a waiting checkpoint with no remaining artist tasks and a real recommendation displays as `Watching signal`;
- Manager review completion calculations ignore these internal rows.

This fixes existing missions immediately without guessing from task-title verbs or mutating their history. Mixed owners such as `Manager / Marketing` are not automatically hidden because they may represent a real team handoff.

## Checkpoint UI hierarchy

The checkpoint surface keeps the compact decision design already in the app:

1. Status and title.
2. Manager’s read as the primary sentence.
3. Next action.
4. Expandable decision rule, evidence used, and evidence limitations.

The Tasks tab shows an empty state for a checkpoint with no artist work: “Nothing needed from you. The Manager is handling this read.” It does not show `0/0 tasks` as if work were missing.

## Safety and rollout

- Keep database schema unchanged.
- Keep the existing document upload service unchanged.
- Keep `manager_draft` validation unchanged.
- Change generation and both persistence paths together so Edge Function and SQL-finalizer writes remain equivalent.
- Preserve legacy `evidence` rows, but reinterpret their documents as optional.
- Cover new generation, legacy projection, optional completion, uploaded-document review, and Manager-draft regression with focused tests before the full suite and build.

## Non-goals

- No automatic connection to private Spotify analytics.
- No new background Manager-task executor.
- No semantic migration based on task-title keywords.
- No deletion of historical tasks or documents.
- No redesign of the full Missions information architecture.

## Success criteria

- A checkpoint can be useful with no artist task.
- Every new checkpoint has a specific Manager read and next action.
- Mission Genesis cannot persist Manager analysis as a visible task.
- Users can complete legacy evidence tasks without attaching a file.
- Optional files still reach Manager review when supplied.
- Existing Manager-draft and result-note flows continue to work.
