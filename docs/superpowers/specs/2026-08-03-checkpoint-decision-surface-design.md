# Checkpoint Decision Surface Design

## Goal

Checkpoint Review must give independent artists and their teams a calm answer to three questions: what has the Manager concluded, what must be true for this checkpoint to clear, and what should happen next. The default surface must compress the underlying task and evidence system instead of reproducing it.

## Root Cause

The current checkpoint accordion breaks the product contract at both the presentation and data-selection layers.

- The UI labels `checkpoint.question` as “Success condition.” The question is the phase decision being asked; `checkpoint.decisionRule` is the actual binary pass/fail rule.
- The UI computes the visible Manager read from `checkpoint.resultSummary` first. Production maps that field from `reason_for_checkpoint`, which Mission Genesis initially persists as the checkpoint question. It is therefore always populated and masks the live `checkpoint.recommendation` written by Manager task-result review.
- The task-result workflow produces useful checkpoint judgment (`checkpointRecommendation`, `checkpointEffect`, and `recommendedFollowUp`) but persists only the recommendation. The checkpoint’s next action and dependency effect remain creation-time values.
- When all checkpoint tasks are complete, `resolveCheckpointStatus` forces `ready_for_manager_check` even though the same OpenAI run was instructed to decide what the result means for the checkpoint. This can prevent the Manager’s `met` or `watching_signal` decision from becoming visible state.
- The collapsed row leads with internal structure and task count rather than the decision an artist needs.

## Product Principles

1. **Decision first.** The current Manager judgment is the primary content.
2. **One layer at a time.** Supporting tasks and evidence remain available, but they do not compete with the checkpoint decision.
3. **Plain language over schema language.** The interface describes what is clear, held, being watched, or ready rather than exposing workflow mechanics.
4. **Stable structure, adaptive content.** Every checkpoint is learned once; its wording changes with state.
5. **No invented certainty.** A waiting checkpoint must not present its creation rationale or mission-wide recommendation as a completed Manager evaluation.

## Selected Approach

Use a decision-first accordion with state-aware copy.

### Collapsed checkpoint

Show only:

- the phase marker;
- checkpoint title;
- a plain-language status badge;
- one concise state summary.

Remove the visible task count and the repeated “Phase N” metadata from the text hierarchy. The phase marker already communicates order. The summary is derived from real checkpoint state:

- **Waiting:** the immediate work or upstream dependency.
- **Ready for review:** the work is in and a checkpoint decision is pending.
- **Needs revision:** the concrete hold or repair.
- **Watching signal:** the signal or condition being observed.
- **Met:** the Manager’s conclusion that explains what was established.

Only one checkpoint is expanded at a time. The first unresolved, non-dependent checkpoint opens by default; when all earlier work is clear, the next actionable checkpoint opens.

### Expanded checkpoint

Render three content blocks in this order:

1. **Manager’s read** — the latest checkpoint-specific recommendation for evaluated states. For a checkpoint that has not been evaluated, show “What this checkpoint is deciding” using the decision question instead of pretending a Manager read exists.
2. **This clears when** — the actual `decisionRule`, written as the binary success condition.
3. **Next** — one action, one blocker, or one unlocked phase. For a met checkpoint, label this “What this opened.”

End with a quiet “See supporting work” action that opens the existing task surface. Do not render task lists, evidence lists, watched-signal arrays, dependency descriptions, and activity history inside the default accordion.

## State Copy Contract

### Waiting

- Primary block label: `What this checkpoint is deciding`
- Primary content: `question`
- Next content: blocking dependency when present, otherwise `nextAction`

### Ready for Manager review

- Primary block label: `Manager’s read`
- Primary content: latest checkpoint-specific `managerRead`
- Next content: the focused follow-up returned by the Manager workflow

### Needs revision

- Primary block label: `Manager’s read`
- Primary content: latest checkpoint-specific `managerRead`
- Next content: `blockedReason` when present, otherwise the focused follow-up

### Watching signal

- Primary block label: `Manager’s read`
- Primary content: latest checkpoint-specific `managerRead`
- Next content: focused follow-up; watched-signal detail remains supporting information unless no useful follow-up exists

### Met

- Primary block label: `Manager’s read`
- Primary content: the conclusion that explains why the condition passed
- Final block label: `What this opened`
- Final content: the next checkpoint title or the Manager’s mission-level follow-up when the mission is complete

## View-Model Contract

Separate creation context from evaluated judgment instead of overloading `resultSummary`:

```ts
type MissionCheckpointViewModel = {
  question: string;
  rationale: string;
  decisionRule: string;
  managerRead: string;
  nextAction: string;
  // existing identity, status, dependency, task, and signal fields remain
};
```

Production mapping uses:

- `question` from `checkpoints.question`;
- `rationale` from `checkpoints.reason_for_checkpoint`;
- `decisionRule` from `checkpoints.decision_rule`;
- `managerRead` from `checkpoints.recommendation`;
- `nextAction` from `checkpoints.next_action`.

The UI does not substitute `rationale` for `managerRead`. Fixtures follow the same contract so tests exercise production semantics.

## Manager Review Pipeline

The existing `manager-review-task-result` run remains the checkpoint evaluator; no second AI call or new workflow is introduced.

When it reviews a task result, persist the checkpoint output as one coherent projection:

- `status` from the validated checkpoint decision;
- `recommendation` from `checkpointRecommendation`;
- `dependency_impact` from `checkpointEffect`;
- `next_action` from `recommendedFollowUp`;
- `blocked_reason` from the checkpoint effect only when the result is blocked or needs revision, and clear stale blocker text when the checkpoint moves out of those states.

Status resolution must preserve dependency safety without discarding the Manager’s decision:

- a blocked or needs-revision task forces the corresponding checkpoint hold;
- `met` is rejected while other required checkpoint tasks remain incomplete;
- when all required tasks are complete, the Manager may set `met`, `watching_signal`, or `needs_revision` directly;
- a non-terminal or uncertain decision remains `ready_for_manager_check` rather than pretending the checkpoint passed.

The prompt explicitly asks for a checkpoint-level conclusion after the final required task, including why the decision rule did or did not pass. Existing run, usage, task-result, memory, and operating-event accountability remains unchanged.

## Visual Direction

Retain the application’s current design system and surface language. This is an information-hierarchy refinement, not a visual rebrand.

- Use spacing and type weight as the primary hierarchy; avoid adding cards inside cards.
- Keep one restrained status accent per checkpoint.
- The Manager read is the strongest text in the expanded state.
- The clearing rule is quieter but always readable.
- The next move receives a subtle tinted field because it is the actionable takeaway.
- Motion is limited to the existing accordion disclosure and respects reduced-motion behavior.
- Mobile keeps the same reading order and never places status, title, and actions into competing columns.

## Error and Legacy Handling

- Missing `decisionRule` falls back to a truthful evidence-based clearing statement, but the fallback is never sourced from the decision question.
- Missing `managerRead` on an unevaluated checkpoint shows the decision question under the waiting-state label.
- Missing `managerRead` on an evaluated checkpoint shows a concise unavailable-state message and the real next action; it never reuses the rationale as if it were a result.
- Existing rows do not require a migration. Their current recommendation remains readable, and the next Manager task-result run refreshes the coherent checkpoint projection.
- A failed Manager run leaves the previous good checkpoint projection intact.

## Testing Strategy

### UI contract

- The decision rule, not the question, renders under “This clears when.”
- The live Manager recommendation wins over creation rationale.
- Waiting checkpoints do not claim to have a completed Manager read.
- Met checkpoints explain what passed and what opened.
- Needs-revision and dependency-blocked checkpoints surface one concrete hold.
- Collapsed rows omit task-count clutter and expose one useful summary.
- Supporting work remains reachable through the existing task navigation.
- Mobile and desktop preserve the same content order.

### Service and workflow contract

- Production maps rationale and Manager read into separate fields.
- Task-result review persists recommendation, checkpoint effect, next action, and blocker lifecycle together.
- An incomplete checkpoint cannot become met.
- A final accepted task can produce met or watching-signal state.
- Revision and blocked outcomes override an optimistic model status.
- Existing run, usage, result, memory, and event writes remain intact.

### Verification

- Targeted checkpoint UI and Supabase service tests.
- Targeted Manager task-result Edge Function tests.
- Complete Vitest suite.
- Production build.
- Deno type-check of the affected Edge Function when the configured runtime is available.

## Out of Scope

- A new checkpoint-history timeline.
- A new evidence drawer or task-management surface.
- A schema migration or new checkpoint-results table.
- Automatic external actions when a checkpoint clears.
- Redesigning mission overview, task cards, or unrelated Manager and Music surfaces.

## Acceptance Criteria

The change is complete when an artist can scan a checkpoint and understand its current state in one sentence, open it and find one real Manager judgment, see the actual clearing condition, and know the single next consequence without being shown the underlying operating record by default. Passed checkpoints must preserve why they passed, unresolved checkpoints must not pretend to have been evaluated, and every visible line must come from the checkpoint decision pipeline rather than a mislabeled or masked field.
