# Prototype Data Lineage Contract

Purpose: define how every dynamic prototype value traces back to database records, producer workflows, run history, usage/cost records, evidence, and permission boundaries.

Status: authoritative V1 handoff contract for UI data provenance. This is not an audit artifact. It is the implementation contract that prevents the prototype from saying one thing while the database and workflows say another.

Use this with:

- `docs/workflows/page-action-inventory.md`
- `docs/workflows/workflow-schema-write-contract.md`
- `docs/workflows/future-schema-notes.md`
- `docs/workflows/music-lifecycle-storage-contract.md`
- `docs/workflows/schema-relationship-contract.md`

## Core Rule

If the prototype displays a dynamic value, the implementation must be able to answer five questions:

1. Which database record supplies the value?
2. Which workflow created or last changed that record?
3. Which run, user action, source snapshot, or external provider event produced the change?
4. Which evidence, memory entry, or explicit limitation supports the claim?
5. Which usage/cost records exist if AI, provider APIs, or billable tools were used?

Static interface labels such as button names can live in code. State-bearing text cannot. A headline, blocker, status, count, recommendation, source limit, readiness score, "what changed" sentence, Manager note, agent note, or Music readiness line must be a projection from source-of-truth records.

## Universal Projection Metadata

The implementation does not need a database row for every rendered text node. It does not need to send full lineage metadata to the client by default. It does need the service layer to be able to expose this metadata for dynamic fields when debugging, reviewing, billing, or explaining a Manager decision:

- `field_key`: stable UI field identifier, such as `music.song.manager_next_move` or `mission.checkpoint_review.current_recommendation`
- `display_value`: rendered text/value
- `source_table`
- `source_id`
- `source_version_id` when the source is versioned
- `source_field`
- `produced_by_workflow`: workflow key from the write contract
- `created_from_run_id` or `updated_from_run_id` when AI/system-generated
- `created_from_action_id` when produced by a Manager action
- `created_from_user_action_id` when user-entered
- `evidence_link_ids`
- `memory_entry_ids`
- `operating_event_ids`
- `usage_event_ids` when billable AI/tool/provider work was involved
- `freshness_status`: `fresh`, `stale`, `unknown`, `not_applicable`
- `confidence`: `high`, `medium`, `low`, `limitation`, `conflict`
- `permission_boundary`: `none`, `internal_only`, `approval_required`, `external_confirmation_required`

This metadata can be produced by service-layer assemblers instead of persisted UI projections. Persist a projection snapshot only when needed for speed, notification history, exact historical replay, or stale-state fallback.

## Run And Usage Accounting

Every Manager, agent, review, Music readiness, evidence extraction, provider sync, and draft-generation workflow that uses AI, billable APIs, or billable tools must create usage records.

Use one append-only usage table in V1:

### `ai_run_usage_events`

One row per billable model/tool/provider invocation or grouped provider call batch.

Required fields:

- `id`
- `account_id`
- `artist_workspace_id`
- `artist_id`
- `workflow_key`: `daily_operating_run`, `manager_conversation_run`, `mission_run`, `task_result_run`, `checkpoint_review_run`, `review_run`, `music_readiness_run`, `music_source_match`, `evidence_extraction`, `agent_run`, `draft_generation`, `source_sync`
- `run_type`: `manager_synthesis`, `agent`, `review`, `source_sync`, `evidence_extraction`, `music_readiness`, `draft_generation`, `tool_call`
- `manager_synthesis_run_id`
- `agent_run_id`
- `review_id`
- `source_sync_job_id`
- `created_from_action_id`
- `subject_type`: `artist`, `mission`, `task`, `checkpoint`, `music_item`, `music_project`, `conversation`, `source`
- `subject_id`
- `provider`: model provider, API provider, or tool provider
- `model_or_tool`
- `operation_key`
- `status`: `started`, `succeeded`, `failed`, `cancelled`, `rate_limited`, `partial`
- `input_tokens`
- `cached_input_tokens`
- `output_tokens`
- `reasoning_tokens`
- `tool_call_count`
- `provider_request_count`
- `provider_cost_estimate`
- `billable_units`
- `currency`
- `started_at`
- `completed_at`
- `failure_reason`
- `metadata`

Rules:

- Usage records are append-only and never inferred later from rendered UI.
- A failed or partial run still writes usage if cost was incurred.
- UI surfaces may show summarized usage by workflow, mission, song/project, or run, but billing logic reads `ai_run_usage_events`.
- Provider source spend caps and refresh policies live with source sync configuration, but actual incurred usage lives here.
- A Manager answer cannot say a run happened unless its run record exists. A billing line cannot exist without the run/tool/provider event that caused it.

## Surface Lineage Matrix

### Label HQ

| Prototype field group | Database source | Producer workflow | Run/usage/accountability |
|---|---|---|---|
| Artist name, image, release focus, budget posture | `artists`, `artist_profiles`, `artist_profile_versions`, `music_items`, `music_projects` | identity selection, setup/profile save, Music create/edit | `operating_events`; usage only if AI normalized profile context |
| Active mission count and mission cards | `missions`, `mission_subject_links`, `tasks`, `checkpoints`, `reviews` | mission creation/update, mission run, review run | `manager_synthesis_runs`, `manager_run_actions`, `ai_run_usage_events` |
| Today's Brief card | `operating_directives`, `manager_synthesis_runs`, `evidence_items`, `agent_reports`, `memory_entries` | daily operating run or user-triggered Manager run | run record, evidence links, usage events |
| Priority strip and flagged blockers | `operating_directives`, `tasks`, `permission_requests`, `reviews`, `source_requests`, `music_splits`, `music_distribution_packages` | Manager synthesis, task result, source sync, Music readiness | operating events and usage events for AI/provider work |
| Recent Movement | `operating_events`, `task_state_events`, `task_results`, `checkpoint_state_events`, `reviews`, `music_distribution_events`, `source_snapshots` | any workflow that changes operating state | no movement line without linked event id |

### Today's Brief

| Prototype field group | Database source | Producer workflow | Run/usage/accountability |
|---|---|---|---|
| Headline read | `operating_directives`, `manager_synthesis_runs`, linked evidence and memory | daily operating run | Manager run, evidence links, usage |
| Signal proof | `evidence_items`, `source_snapshots`, `source_connections` | source sync and evidence normalization | source snapshot id, evidence confidence, provider usage if applicable |
| Manager interpretation | `manager_synthesis_runs`, `agent_reports`, `memory_entries`, active mission state | Manager synthesis | run/action ids and usage |
| Today's directive | `operating_directives`, `permission_requests`, `tasks` | Manager synthesis/action planning | action id, permission boundary |
| Source line and limitations | `evidence_items`, `source_snapshots`, `source_requests`, `source_capabilities` | source confidence evaluation | no usage unless generated by AI extraction |

### Music Library, Song Room, And Project Room

| Prototype field group | Database source | Producer workflow | Run/usage/accountability |
|---|---|---|---|
| Song/project title, type, status, lifecycle stage | `music_items`, `music_projects` | Music create/edit, setup focus, provider match | Music operating event; approval if AI suggests change |
| Songs and projects tabs | `music_items`, `music_projects`, `music_project_items` | Music retrieval and project membership updates | no separate Music task system |
| Files readiness | `music_assets` | upload/replace asset, provider import, evidence extraction | source snapshot/upload record; usage if extracted/analyzed |
| Details readiness | `music_identifiers`, `music_credits`, Music metadata fields | metadata/credits/identifier update, source match | evidence links for provider-backed fields |
| Rights status and split blockers | `music_splits`, `music_split_contributors`, `music_split_confirmations`, rights evidence | split proposal and confirmation workflows | scoped confirmation token, permission/audit event, usage if AI parsed split docs |
| Manager next move | `manager_synthesis_runs`, `music_distribution_packages`, `reviews`, `tasks`, `memory_entries` | Music readiness run or mission run | run/action ids and usage |
| Source limits | `source_requests`, `source_snapshots`, `evidence_items`, `source_capabilities` | source confidence evaluation | provider usage when refreshed |
| Linked missions/tasks/evidence | `mission_subject_links`, `missions`, `tasks`, `evidence_links`, `artifact_links` | mission creation/update, task creation, evidence linking | originating run/action ids |
| Project track count and ready track count | `music_project_items` plus linked `music_items`, `music_assets`, `music_splits`, identifiers | project readiness aggregation | projection derived from linked records, not duplicated fields |
| Distribution readiness/log | `music_distribution_packages`, `music_distribution_events`, `permission_requests`, `music_assets`, `music_splits`, identifiers | build package, request approval, initiate provider adapter, receive provider callback | approval id, provider event id, usage/provider call record |

Music state is durable operating state, not proof by itself. A claim like "split cleared" needs confirmation records or uploaded/source evidence. A claim like "released on Spotify" needs provider/catalog evidence or a trusted distributor event.

### Missions

| Prototype field group | Database source | Producer workflow | Run/usage/accountability |
|---|---|---|---|
| Mission title, objective, status, priority | `missions`, `mission_plan_versions`, `operating_directives` | mission creation/update | Manager run/action ids and usage |
| Mission progress | `tasks`, `task_results`, `checkpoints`, `checkpoint_results`, `checkpoint_state_events` | task result interpretation, checkpoint review, mission run | run/action ids; no manual percentage without backing state |
| Review summary and next review | `reviews`, `memory_entries`, `operating_events` | review scheduling and review run | review id, prior decision link, usage |
| Linked Music or non-music subject | `mission_subject_links`, `music_items`, `music_projects`, `artist_objects` | mission creation/update, Music linking | link event id |
| Mission work buttons/counts | `tasks`, `checkpoints`, `agent_notes`, `memory_entries`, `work_drafts`, `permission_requests` | mission plan generation and Manager synthesis | originating action ids |

Missions stay objective-first. Music can be the subject or context for a mission, but Music does not own mission tasks or checkpoints.

### Tasks

| Prototype field group | Database source | Producer workflow | Run/usage/accountability |
|---|---|---|---|
| Task title, owner, due state, approval state | `tasks`, `task_state_events`, `permission_requests` | mission plan generation, Manager action, user approval | action/event ids |
| Grouping under phase/checkpoint | `checkpoints`, `mission_plan_checkpoints`, `task_dependencies` | mission plan generation/update | plan version id |
| Availability/blocking label | `task_dependencies`, `checkpoint_dependencies`, `checkpoint_results`, `source_requests`, `permission_requests` | dependency evaluation | operating event id |
| Completion note and Manager note | `task_results`, `memory_entries`, `reviews` | task completion and task-result run | user action id, Manager run id, usage |
| Mission effect | `checkpoint_state_events`, `checkpoint_results`, `mission_plan_versions`, `reviews` | task-result interpretation | run/action ids |

### Checkpoint Review

The prototype route currently uses `testLabWorkspace`; the product surface should be named **Checkpoint Review**. Backend records can remain `checkpoints` because a checkpoint is the phase-gate object. The visible workspace is a review of checkpoint state, task results, blockers, and recommended movement.

| Prototype field group | Database source | Producer workflow | Run/usage/accountability |
|---|---|---|---|
| Progress map and checkpoint list | `checkpoints`, `mission_plan_checkpoints`, `checkpoint_dependencies` | mission plan generation/update | plan version and action ids |
| Decision rule | `checkpoint_results`, `mission_patterns`, `mission_plan_versions` | checkpoint review run | run id and usage |
| Required tasks and watched signals | `tasks`, `evidence_requirements`, `source_requests`, `evidence_items` | mission plan generation and source evaluation | evidence links |
| Recommendation | `checkpoint_results`, `reviews`, `agent_reports`, `memory_entries` | checkpoint review or mission run | Manager/agent run ids and usage |
| What opened next / what stayed blocked | `checkpoint_state_events`, `task_state_events`, `operating_events` | checkpoint state transition | event ids |

### Review / What Changed

| Prototype field group | Database source | Producer workflow | Run/usage/accountability |
|---|---|---|---|
| Previous recommendation | `decision_packages`, `operating_directives`, `reviews`, `memory_entries` | prior Manager synthesis/review | prior run/action ids |
| Current state | `evidence_items`, `task_results`, `checkpoint_results`, `agent_reports`, `music_items`, `music_projects`, `operating_events` | current review retrieval | source/evidence/run links |
| What changed | `reviews`, `operating_events`, `task_results`, `checkpoint_state_events`, `source_snapshots`, `music_distribution_events` | review run comparison | review run id and usage |
| Manager comparison | `reviews`, `manager_synthesis_runs`, `evidence_links` | review run | run/action ids and usage |
| Actions | `tasks`, `permission_requests`, `mission_plan_versions`, `memory_entries` | review action plan | action ids and approval boundaries |

"What changed" must be computed from deltas between prior recommendation state and current records. It should not be free-floating copy.

### Manager Office, Conversation, Investigation, Decision Package

| Prototype field group | Database source | Producer workflow | Run/usage/accountability |
|---|---|---|---|
| Context questions and answers | `manager_context_questions`, `manager_context_answers`, `artist_profiles`, `memory_entries` | context gate and profile setup | user action ids; usage if generated |
| Conversation messages | `conversations`, `conversation_messages` | conversation router | Manager run id and usage for AI response |
| Investigation progress | `manager_synthesis_runs`, `manager_run_actions` | Manager synthesis stages | run stage records and usage |
| Recommendation/rationale/rejected moves | `decision_packages`, `evidence_links`, `manager_run_actions` | decision package creation | run/action ids and usage |
| Work created | `artifact_links`, `missions`, `tasks`, `reviews`, `work_drafts`, `permission_requests` | Manager action application | action ids and operating events |

### Staff, Locked Agents, Notes

| Prototype field group | Database source | Producer workflow | Run/usage/accountability |
|---|---|---|---|
| Agent role/status/source needs | `agent_profiles`, `source_capabilities`, `source_connections`, `source_requests` | readiness calculation | no AI usage unless summarized |
| Locked-agent Manager-prepared context | `specialist_referrals`, `manager_synthesis_runs`, `agent_reports`, `evidence_items`, `music_items`, `music_projects` | Manager-prepared specialist brief | run/action ids and usage |
| Notes/handoffs | `agent_notes`, `agent_inbox_items`, `agent_reports`, `evidence_links`, `artifact_links` | agent run or Manager synthesis | run ids and usage |

### Mission Memory, Evidence Drawer, Work Draft

| Prototype field group | Database source | Producer workflow | Run/usage/accountability |
|---|---|---|---|
| Living recap | `memory_entries`, `memory_summaries`, `operating_events`, linked mission/task/checkpoint/music records | memory writer and summary regeneration | run ids and usage if AI-generated |
| Evidence file | `evidence_items`, `source_snapshots`, `evidence_links`, `source_connections` | source sync, upload, evidence extraction | source snapshot id; usage if extraction/provider call |
| Draft body/status | `work_drafts`, `work_draft_versions`, `permission_requests` | draft generation or user edit | run/action ids, usage, approval event |

## Producer Workflow Map

| Workflow | Produces | Must write |
|---|---|---|
| Identity/setup/profile save | profile fields, source readiness, active focus | profile versions, operating events, optional Music/non-music objects, source requests |
| Source sync/upload | raw source state, evidence, source limitations | source snapshots, evidence items, evidence links, source requests, usage events for provider calls |
| Daily operating run | Today's Brief, directive, priorities, recent movement | Manager run, actions, directive, reviews/tasks as needed, usage events |
| Manager conversation run | answers, decision packages, created work | conversation messages, Manager run/actions, artifacts, usage events |
| Agent run | specialist report, note, source limitation | agent run, agent report, note, evidence links, usage events |
| Mission creation/update | mission, plan, tasks, checkpoints, subject links | missions, plan versions, tasks, checkpoints, links, events, memory, usage events |
| Task-result run | task interpretation, checkpoint update, mission effect | task result, checkpoint result/event, memory, review if needed, usage events |
| Checkpoint review run | checkpoint recommendation, blocked/unlocked state | checkpoint result/event, review/memory as needed, usage events |
| Review run | previous/current comparison and next action | review outcome, possible mission/task/checkpoint changes, memory, usage events |
| Music create/edit/readiness | song/project state, blockers, linked work | Music records/assets/identifiers/splits/events, reviews/memory as needed, usage events |
| Split confirmation | contributor response and split status | split confirmation, contributor status, operating event, permission/audit records |
| Distribution package workflow | readiness package, provider event log | distribution package/events, permission request, provider confirmation, usage/provider call event |
| Draft generation | prepared work product | draft/version, permission request when external use is proposed, usage event |

## Acceptance Checks

- No dynamic prototype claim is backed only by hardcoded data in production.
- Every Music row, status, blocker, file count, rights state, distribution line, and Manager next move maps to first-class Music records plus evidence/limitations.
- Every mission, task, and Checkpoint Review line maps to mission plan records, task results, checkpoint results/events, reviews, or memory.
- Every "what changed" line has a prior state, current state, and linked changed records.
- Every AI/provider/tool run that could be billed writes `ai_run_usage_events`.
- Every generated recommendation or write has provenance, evidence links or explicit limitations, and a permission boundary.
- UI projections are rebuildable from source-of-truth records.
