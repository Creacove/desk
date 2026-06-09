# State Machine Contract

Purpose: define allowed states and transitions for core records. Implementers should reject invalid transitions instead of silently coercing them.

## Run States

`agent_runs` and `manager_synthesis_runs`:

- `queued`
- `running`
- `needs_context`
- `completed`
- `completed_with_limits`
- `failed`
- `cancelled`

Allowed transitions: `queued -> running`, `running -> completed|completed_with_limits|needs_context|failed|cancelled`, `needs_context -> queued|cancelled`.

Invalid: `failed -> completed` without creating a new run.

## Mission States

- `candidate`
- `active`
- `blocked`
- `review`
- `paused`
- `complete`
- `archived`
- `cancelled`

Rules:

- Agent reports may create mission candidates only through Manager synthesis.
- `candidate -> active` requires Manager synthesis.
- `active -> blocked` requires blocker reason.
- `active|blocked -> review` requires review trigger.
- `complete|cancelled|archived` are terminal for active work; use a new mission or reactivation review to resume.

## Mission Plan States

- `draft`
- `active`
- `superseded`
- `archived`

Rules:

- One mission has one active plan at a time.
- Reordering checkpoint phases creates a new plan version.
- Removing or replacing tasks creates task state events and mission memory entries.

## Checkpoint States

- `waiting`
- `blocked`
- `ready_for_manager_check`
- `watching_signal`
- `needs_revision`
- `met`
- `skipped`

Rules:

- `met` requires required task results or evidence satisfying the decision rule.
- `blocked` requires blocker reason and usually creates/links a task or evidence request.
- `skipped` requires Manager synthesis explanation and mission memory entry.
- Later checkpoints cannot be `met` if required upstream checkpoints are still `blocked`, unless Manager synthesis explicitly revises the plan.

## Task States

- `proposed`
- `open`
- `needs_approval`
- `approved`
- `in_progress`
- `blocked`
- `completed`
- `rejected`
- `missed`
- `archived`
- `superseded`

Rules:

- Approval-gated task cannot move to `completed` unless approved.
- `blocked` requires blocker reason.
- `completed` requires task result.
- `archived` and `superseded` require reason and memory entry.
- A task can be prepared in parallel but should not be marked actionable if its checkpoint dependencies are not ready.

## Task Result States

- `completed`
- `blocked`
- `rejected`
- `revised`
- `missed`
- `superseded`

Every task result must include raw note/event, Manager interpretation, mission effect, checkpoint effect, and follow-up.

## Music States

`music_items.lifecycle_stage` and `music_projects.lifecycle_stage`:

- `idea`
- `recording`
- `production`
- `mixing`
- `mastering`
- `ready`
- `scheduled`
- `released`
- `catalog`
- `archived`

Rules:

- User/team actions or trusted integration events can update visible lifecycle stage.
- Manager suggestions can propose a stage change, but they must not silently mutate the visible stage.
- `released` requires provider/distributor or user-confirmed release evidence. `catalog` is for released work now managed as existing catalog.

`music_assets.status`:

- `missing`
- `draft`
- `uploaded`
- `confirmed`
- `replaced`
- `revoked`
- `failed`

Rules:

- `confirmed` requires user confirmation, trusted integration confirmation, or source-backed validation.
- Replacing an asset keeps prior uploaded file history readable through events and supersession.
- Failed processing keeps the uploaded file/source request recoverable; do not remove the asset trail.

`music_splits.status`:

- `missing`
- `draft`
- `pending_confirmation`
- `partially_confirmed`
- `cleared`
- `disputed`
- `superseded`
- `revoked`

Rules:

- `pending_confirmation` requires balanced proposed shares and at least one scoped confirmation request.
- `cleared` requires all required contributors confirmed or an explicit user/team override recorded as a permission-sensitive decision.
- `disputed`, `revoked`, and `superseded` must create operating events and usually trigger mission/checkpoint review if a release, sync, finance, or distribution mission depends on the split.

`music_split_confirmations.status`:

- `created`
- `sent`
- `opened`
- `confirmed`
- `rejected`
- `expired`
- `revoked`
- `superseded`

Rules:

- External confirmation links must be scoped to one contributor and one split proposal.
- Expired, revoked, or superseded confirmations cannot be reused.

`music_distribution_packages.status`:

- `draft`
- `blocked`
- `ready_for_approval`
- `approved`
- `submitting`
- `submitted`
- `accepted`
- `failed`
- `cancelled`
- `superseded`

Rules:

- `ready_for_approval` requires required assets, metadata, and rights readiness.
- `approved` requires explicit user permission.
- `submitting` and later states require an approved permission request or explicit user action.
- `accepted` requires provider confirmation; package creation or local success UI is not enough.

## Permission Request States

- `pending`
- `approved`
- `rejected`
- `edited`
- `expired`
- `revoked`
- `superseded`

Rules:

- External execution requires `approved`.
- Approval must name the action scope; approval for one task does not approve unrelated downstream actions.
- Edited permission creates a new proposed action or updates parameters with audit trail.

## Draft States

- `draft`
- `ready_for_review`
- `approved`
- `rejected`
- `revised`
- `sent_or_exported`
- `archived`

Rules:

- Drafts do not leave the system unless approved.
- `sent_or_exported` requires approved permission or explicit user action.

## Review States

- `scheduled`
- `due`
- `running`
- `completed`
- `snoozed`
- `cancelled`

Rules:

- Review output must compare previous recommendation to current state.
- Material recommendation change must update mission memory.

## Memory And Learning States

`operating_events`: append-only after creation.

`memory_entries`: append-only after creation; corrections create a new entry that supersedes or narrows the prior interpretation.

`memory_summaries`: `current`, `stale`, `superseded`, `regenerated`.

`outcome_observations`: `pending_evidence`, `observed`, `inconclusive`, `superseded_by_later_evidence`.

`pattern_outcomes`: `candidate`, `aggregate_ready`, `approved_for_guidance`, `retired`.

Rules:

- A summary can be regenerated, but the source events and entries remain unchanged.
- A wrong memory interpretation must be corrected by a new entry, not rewritten in place.
- An outcome observation must state confidence and causal limitation.
- A pattern outcome cannot become `approved_for_guidance` if it exposes private artist identity, unreleased strategy, rights/finance records, or sensitive context.
- Aggregate pattern guidance must not override artist-specific evidence, memory, or permission boundaries.

## Agent Note / Inbox States

`agent_notes`: `open`, `filed_to_memory`, `created_task`, `updated_checkpoint`, `no_action`, `superseded`.

`agent_inbox_items`: `pending`, `consumed`, `deferred`, `cancelled`.

Rules:

- Manager-to-agent notes can wait for the next run.
- Immediate conversation needs may trigger a run now.
- Agent-to-Manager notes feed Manager synthesis; they do not directly change missions.
