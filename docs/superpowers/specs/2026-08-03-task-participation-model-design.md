# Task Participation Model Design

## Problem

The production mission projection currently treats an exact `owner_role = 'Manager'` as invisible artist-internal work. That shortcut hides legitimate collaborative tasks, including completed Manager drafts, their steps, drafts, results, and review history. When the projected task list becomes empty, the UI also creates a synthetic fallback task whose checkpoint id does not match the persisted checkpoints. The result is the false “Manager watching / Nothing needed from you” state visible in production.

Ownership, participation, completion, visibility, and blocking are different concepts. One string cannot safely represent all five.

## Product contract

Every persisted task is visible on its checkpoint, including completed and Manager-owned work. Visibility never depends on owner.

Tasks have one explicit participation mode:

- `artist_action`: an artist or team member must decide, perform, or report an action. An incomplete task counts as open work and blocks its checkpoint.
- `collaborative`: the artist/team and Manager create, review, or approve an outcome together. An incomplete task counts as open work and blocks its checkpoint.
- `manager_work`: research, monitoring, or synthesis the Manager handles independently. It stays visible for transparency, but it does not count as actionable artist work and does not block the checkpoint.

`owner_role` remains descriptive. `completion_mode` remains the completion mechanism. Neither controls visibility.

The Tasks badge counts only incomplete `artist_action` and `collaborative` tasks. Completed and `manager_work` tasks remain available inside the tab without inflating that badge.

## Storage and compatibility

Add nullable `tasks.work_mode` constrained to the three values above. Backfill existing rows without changing task status, result, draft, step, or event history:

- `completion_mode = 'manager_draft'` becomes `collaborative`.
- exact Manager ownership with legacy `evidence` completion becomes `manager_work`.
- exact Manager ownership with substantive user responsibility becomes `collaborative`.
- remaining exact Manager tasks become `manager_work`.
- all remaining tasks become `artist_action`.

Readers retain the same classifier as a fallback for null or older rows during rollout.

## Checkpoint lifecycle

Required checkpoint work is the set of `artist_action` and `collaborative` tasks. `manager_work` never blocks an artist-facing checkpoint.

- required work incomplete: `waiting`;
- required work complete and awaiting a decision: `ready_for_manager_check`;
- no incomplete required work while the Manager monitors or researches: `watching_signal`;
- decision passed: `met`;
- revision required: `needs_revision`.

Manager review completion calculations use this same participation contract. An unfinished collaborative Manager draft must participate in completion checks; a Manager-only research row must not.

## UI behavior

The Tasks surface uses persisted task rows whenever `mission.tasks` is defined, including an explicit empty array. A synthetic legacy task is used only when an older mission payload has no `tasks` property at all.

Every checkpoint lists every real task. Completed tasks remain expandable and show their steps, draft, result, and responsibility context. Open collaborative tasks retain “Work with Manager” and “Submit for review.” Manager work is labeled “Manager working” or “Manager watching,” exposes its details, and has no required completion action. Optional context or attachments may be supplied but never block progress.

“Nothing needed from you” is shown only when a checkpoint truly has no task records. It is not a replacement for hidden work.

## Generation and persistence

Mission Genesis and Manager Conversation share the same task participation contract:

- generated tasks explicitly include `workMode`;
- Manager drafts are `collaborative`;
- human/offline outcome tasks are `artist_action`;
- uploads remain optional and new `evidence` completion tasks are not generated;
- immediate Manager analysis belongs in the checkpoint read, not a task;
- active missions may legitimately have zero tasks.

The direct Edge Function writer and SQL finalizer persist `work_mode` and derive checkpoint status from blocking modes, not ownership. Manager Conversation applies the same validation before persistence so the bug cannot recur through that path.

## Rollout and safety

1. Add and backfill the nullable column.
2. Deploy functions that read/write `work_mode` with fallback classification.
3. Deploy the frontend projection and UI.
4. Verify the affected live mission and a newly generated collaborative task.

The migration is additive and preserves all historical work. No task is deleted, reopened, or marked complete by the migration.

## Acceptance criteria

- An exact Manager-owned `manager_draft` remains visible and actionable as collaborative work.
- A completed collaborative task still exposes steps, drafts, results, and history.
- Manager-only research remains visible but never blocks or increments the actionable badge.
- An explicit empty task list never creates a phantom task.
- Manager review includes collaborative work and excludes only `manager_work` from required completion.
- Both generation paths persist an explicit valid mode and do not create upload gates.

