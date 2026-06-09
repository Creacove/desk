# Task Result And Dynamic Checkpoint Update Workflow

Purpose: define how task activity becomes interpreted results, dynamic Checkpoint Review changes, mission progress, reviews, and memory updates. Tasks and checkpoints are generated from the mission objective and pattern; this workflow must not assume a fixed release checklist.

## Trigger

This workflow starts when:

- user approves a task
- user marks a task done
- user adds completion notes
- user reports a task blocked, rejected, missed, or revised
- an integration confirms completion or failure
- a Manager run learns new task-relevant information

Prototype examples include approving a launch-week content task, marking a task done, and showing Manager notes from `taskResults`.

## Required Context

- task record and approval state
- mission objective, selected pattern/playbook, and mission memory
- checkpoint phase linked to the task
- task dependencies and risk if late
- user completion note or integration event
- evidence linked to the task
- prior task results
- checkpoint dependency graph and review rules

## Source Data

Current prototype sources:

- `taskRows` as the prototype's release-pattern example
- `approvedTasks`
- `completedTasks`
- `taskResults`
- `missionCheckpoints`
- `missionReview`
- `testReviewImpact`

Production sources:

- `tasks`
- `task_results`
- `task_state_events`
- `checkpoints`
- `mission_plans`
- `missions`
- `memory_entries`
- `evidence_items`
- `reviews`
- `ai_run_usage_events` when Manager interpretation or checkpoint evaluation uses AI/provider/tool work

## Classification Logic

Task update types:

- Approval: user explicitly approves an approval-gated task.
- Completion: user or trusted source confirms the task was done.
- Blocked: missing dependency prevents progress.
- Rejected: user declines recommended task.
- Revised: task details changed materially.
- Missed: deadline passed without completion.

Checkpoint Review update types are generic across mission patterns:

- Waiting: required tasks, evidence, reports, or permissions are not ready.
- Ready for Manager check: required task results are present.
- Needs revision: blocker or weak result prevents progress.
- Watching signal: post-action or source evidence is being monitored.
- Met: decision rule passed.

## Checkpoint And Task Relationship

The mission plan owns the relationship between checkpoints and tasks.

- A checkpoint is the AI-owned question for a mission phase.
- Tasks underneath that checkpoint are the actions needed to answer that question.
- Every task has one primary checkpoint owner.
- A task may depend on another task or checkpoint, but it should not float outside the mission plan.
- A checkpoint can depend on earlier checkpoints.
- A later checkpoint should not be treated as clear if an earlier required checkpoint is still blocking.
- When a task result arrives, the system updates the linked checkpoint first, then updates mission progress, review state, and memory.
- The visible workspace is Checkpoint Review: it explains checkpoint state, the task/evidence inputs that changed it, and the Manager recommendation.

## Background Steps

1. Validate task transition is allowed.
2. Store raw user note or integration event.
3. Create task result with status, summary, interpretation, mission effect, and follow-up.
4. Recompute linked checkpoint readiness against its decision rule.
5. Recompute downstream checkpoint dependency state if this checkpoint changed.
6. If the linked dynamic checkpoint changed, create checkpoint state event and checkpoint result records.
7. If recommendation may change, trigger review.
8. Update mission progress and status if appropriate.
9. Write usage events for any AI/provider/tool work used to interpret the result.
10. Append mission memory entry explaining the task result, checkpoint effect, and any path change.
11. Return updated task/Checkpoint Review/mission UI state.

## Artifacts Created Or Updated

- task
- task result
- task state event
- checkpoint
- downstream checkpoint dependency state
- mission progress/status
- mission memory
- review
- evidence item if the completion includes source proof

## User-Facing Result

The user should see:

- task status changed
- completion note preserved
- Manager interpretation of what the result means
- effect on mission
- linked checkpoint state
- downstream checkpoint impact if the task unblocks or blocks later work
- what changed since the previous checkpoint result
- next recommended action

Completion should never be just a checkmark. It is input into the operating loop.

## Failure And Uncertainty Handling

If the user tries to mark an approval-gated task done before approval, block completion and explain the approval requirement. If completion note is weak or missing for a critical task, accept the update but mark confidence low and request proof. If a task result conflicts with evidence, trigger review instead of hiding the conflict.

## Approval Boundaries

Approving a task is not the same as approving every downstream external action. A task can authorize a specific action only if the task scope clearly names that action. Budget, public, legal, financial, and external actions require explicit approval states.

## Schema/API Implications

Task state and task result should be separate. The task says what should happen; the result says what happened and how the Manager interpreted it. Checkpoint state should reference task result IDs, mission plan version, checkpoint dependency state, prior checkpoint result, usage events, and mission pattern context so the system can explain why readiness changed for that specific mission.
