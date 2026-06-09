# Workflow-To-Schema Write Contract

Purpose: define exactly how prototype actions and workflow runs read, write, link, audit, and refresh data in the V1 operational schema.

Status: authoritative V1 write contract. Use this with `docs/workflows/future-schema-notes.md`, `docs/workflows/page-action-inventory.md`, `docs/workflows/prototype-data-lineage-contract.md`, and the workflow contracts in this folder.

## Core Rule

No workflow is real until it names its database writes.

No dynamic prototype field is real until it can trace to source records, producer workflow, evidence or limitation, and run/usage provenance when AI or provider work was involved.

Every action that changes operating state must define:

- trigger
- primary service owner
- required reads
- required writes
- conditional writes
- links
- audit event
- memory/review behavior
- failure behavior
- UI projection refreshed
- usage/cost accounting when AI, provider APIs, or billable tools are used

This document does not add schema tables. It explains how the V1 schema tables coordinate.

## Simplicity Gate

Before adding a new write path or table, confirm it passes all five checks:

1. A user action, Manager run, agent run, source sync, or provider callback clearly produces it.
2. A current UI/API path or Manager retrieval path clearly reads it.
3. It cannot be represented cleanly as an existing source record, `operating_events`, `artifact_links`, `evidence_links`, `memory_entries`, or a service projection.
4. It has an owner service and a failure state.
5. It improves trust, permissioning, billing, retrieval, or user clarity enough to justify the extra schema.

If any check fails, keep the data in the existing artifact payload or projection until usage proves a separate table is needed.

## Coordination Model

### Direct User Writes

Direct user actions can write simple records without first creating a Manager synthesis run when they are only recording user-owned state:

- profile edits
- Manager context answers
- permission decisions
- task approval/rejection where no interpretation is needed
- task completion note capture
- uploaded file creation
- draft edits
- navigation preference updates

Even direct user writes must create `operating_events` when they change operating meaning.

### AI/System Writes

AI/system writes use this sequence:

1. Create `manager_synthesis_runs` or `agent_runs`.
2. Persist proposed writes as `manager_run_actions` when the Manager may create/update operating artifacts.
3. Validate each action against state, evidence, ownership, and permission rules.
4. Apply safe internal writes.
5. Create `permission_requests` for approval-gated actions.
6. Create `operating_events`.
7. Write `memory_entries`, `reviews`, and `memory_summaries` when future behavior or recommendation state changes.
8. Write `ai_run_usage_events` for model, tool, and provider invocations that incurred usage.
9. Return refreshed UI projections from source-of-truth records.

Manager-triggered workflows should be boring to implement: retrieve context, produce typed actions, validate actions, write owned artifacts, attach lineage, refresh projections. Avoid hidden side effects where a Manager sentence changes state without a `manager_run_action` or a direct user write.

Specialist agents create `agent_reports`, `agent_notes`, and `agent_inbox_items`. They do not directly create/update missions, tasks, or checkpoints. Manager synthesis decides whether to apply specialist recommendations.

### Usage And Cost Writes

Every workflow that calls an AI model, paid provider API, billable extraction tool, or usage-metered connector must write `ai_run_usage_events`.

Required usage links:

- Manager synthesis and conversation runs link usage to `manager_synthesis_run_id`.
- Specialist runs link usage to `agent_run_id`.
- Review runs link usage to `review_id` and the Manager/agent run that performed the comparison.
- Music readiness, source matching, split-document extraction, and distribution-provider calls link usage to the relevant `music_item_id` or `music_project_id` through `subject_type` and `subject_id`.
- Source sync and evidence extraction link usage to `source_sync_job_id`, source snapshot, or evidence extraction job.
- Draft generation links usage to the draft and originating run/action.

Usage events must be written for failed or partial provider calls when cost was incurred. Billing and per-usage reporting must aggregate from `ai_run_usage_events`, not from UI text, memory summaries, or rendered run logs.

### Link Rules

Use links instead of hiding relationships in JSON:

- `evidence_links`: evidence supporting claims, limitations, missing proof, or conflicting proof.
- `artifact_links`: created/updated/referenced/superseded/dependent relationships between artifacts, including conversations, decisions, notes, reviews, drafts, permissions, and Music records.
- `mission_subject_links`: missions to the Music records or non-music artist objects they are about.
- `task_dependencies` and `checkpoint_dependencies`: mission plan graph.

## Action Contracts

### Action: Select Artist Identity

Trigger:
User confirms or selects the Spotify identity in the Connect Artist screen.

Primary owner:
Artist Profile Service with Source Connection Service.

Reads:

- `artists`
- `artist_profiles`
- `source_providers`
- `source_connections`
- Spotify public identity source snapshot when available

Writes:

- `artists` if the artist does not exist
- `artist_workspaces` if this is a new workspace
- `artist_profiles`
- `artist_profile_versions`
- `source_connections`
- `operating_events`

Conditional writes:

- `artist_aliases` if identity resolution includes aliases
- `source_requests` if identity is ambiguous or source is unavailable
- `memory_entries` if the selected identity affects future decisions

Links:

- `evidence_links` if identity proof is normalized as evidence
- `artifact_links` from source connection to profile version when useful for audit

Audit event:
`operating_events.event_type = artist_identity_selected`

Memory/review behavior:
No review. Write memory only if the identity choice includes durable context beyond the profile field.

Failure behavior:
If identity is missing, ambiguous, or source unavailable, do not create an active workspace state. Return setup-blocking failure and create/update `source_requests` if recovery is possible.

UI projection refreshed:
Setup / Context projection.

### Action: Save Setup Or Artist Profile Context

Trigger:
User enters setup context or edits Settings / Artist Profile.

Primary owner:
Artist Profile Service with Memory Service and Source Connection Service.

Reads:

- `artist_profiles`
- `artist_profile_versions`
- `source_connections`
- `source_capabilities`
- `memory_summaries`

Writes:

- `artist_profiles`
- `artist_profile_versions`
- `source_connections`
- `operating_events`

Conditional writes:

- `music_items` or `music_projects` for active recorded-work focus such as a song, demo, catalog track, single, EP, or album
- `music_identifiers` when stable provider/catalog identifiers are known
- `artist_objects` for non-music active focus objects such as a campaign, market, budget pool, live opportunity, team process, or source gap
- `memory_entries` for durable direction, constraints, budget posture, team capacity, do-not-repeat rules, or important corrections
- `source_requests` for missing private analytics, rights documents, royalty statements, campaign data, or source handles
- `evidence_items` only when user-supplied context is being treated as evidence
- `memory_summaries` regeneration

Links:

- `evidence_links` for user-supplied evidence
- `artifact_links` from profile version to active focus Music/non-music object when created

Audit event:
`operating_events.event_type = artist_profile_updated`

Memory/review behavior:
If profile changes alter active mission assumptions, create `reviews` or mark affected mission recommendations stale.

Failure behavior:
Reject invalid handles or conflicting identity changes. Do not silently overwrite prior profile meaning; create a new version.

UI projection refreshed:
Setup, Label HQ, Staff readiness, Manager Office context, Settings.

### Action: Create Or Edit Music Item Or Project

Trigger:
User creates/corrects a song, demo, catalog track, EP, album, single container, or project; Manager synthesis proposes a Music record from source evidence; provider matching finds a candidate; or setup/current focus points at recorded work.

Primary owner:
Music Service with Source/Evidence Service when source-backed.

Reads:

- `music_items`
- `music_projects`
- `music_project_items`
- `music_identifiers`
- `source_snapshots`
- `evidence_items`
- `missions`
- `memory_entries`

Writes:

- `music_items` or `music_projects`
- `music_project_items` when project membership changes
- `music_identifiers` when stable provider/catalog identifiers are known
- `operating_events`

Conditional writes:

- `evidence_items` and `evidence_links` when source-backed facts are normalized
- `memory_entries` when the change affects future Manager or agent behavior
- `reviews` when active missions depend on the changed Music state
- `source_requests` when identity or provider matching is ambiguous

Links:

- `artifact_links` from originating profile/conversation/run/source to the Music record
- `mission_subject_links` when an active mission is about the song/project
- `evidence_links` for claim-bearing fields

Audit event:
`operating_events.event_type = music_item_created`, `music_item_updated`, `music_project_created`, `music_project_updated`, or `music_project_tracklist_updated`

Memory/review behavior:
Write memory only for durable operating meaning, such as a focus song changing, a project tracklist locking, a material blocker appearing, or a Manager recommendation depending on the change.

Failure behavior:
If provider matching is ambiguous, create a candidate/source request and do not merge automatically. If a user correction conflicts with source data, preserve both through source limitation/evidence conflict handling.

UI projection refreshed:
Music Workspace, Label HQ focus/priority strip, Staff readiness, linked Missions, Manager context retrieval.

### Action: Upload Or Replace Music Asset

Trigger:
User uploads or replaces demo, rough mix, final master, clean version, instrumental, stems, artwork, metadata export, split sheet, pitch asset, lyrics, EPK, royalty statement, distributor export, or campaign report from a Music surface or source request.

Primary owner:
Music Service with Source/Evidence Service.

Reads:

- `music_items`
- `music_projects`
- `music_assets`
- `uploaded_files`
- `source_requests`
- `source_capabilities`

Writes:

- `uploaded_files`
- `music_assets`
- `source_snapshots` when the file is parsed or preserved as source
- `operating_events`

Conditional writes:

- `evidence_items` when facts are normalized from the file
- `evidence_links` to Music, missions, tasks, checkpoints, decisions, or notes
- `source_requests` fulfilled/dismissed/superseded state
- `reviews` when asset state changes mission readiness
- `memory_entries` when future behavior changes

Links:

- `artifact_links` from upload/source request to Music asset and affected artifacts
- `evidence_links` for source-backed claims or limitations

Audit event:
`operating_events.event_type = music_asset_uploaded`, `music_asset_replaced`, `source_snapshot_created`, and optionally `evidence_item_created`

Memory/review behavior:
Uploading a file is not memory by default. Write memory when it changes a blocker, confidence, recommendation, rights state, distribution readiness, or future retrieval context.

Failure behavior:
If processing fails, keep `uploaded_files.status = failed`, keep or mark `music_assets.status = failed`, create an operating event, and leave recovery/source request state visible.

UI projection refreshed:
Music Workspace, Evidence Drawer, Staff readiness, Tasks/Checkpoint Review if linked, Label HQ if source warning or blocker changed.

### Action: Update Music Metadata Credits Or Identifiers

Trigger:
User edits song/project details; provider matching updates identifiers; uploaded metadata is normalized; or Manager/source run proposes a correction.

Primary owner:
Music Service with Evidence Service when source-backed.

Reads:

- `music_items`
- `music_projects`
- `music_identifiers`
- `music_credits`
- `source_snapshots`
- `evidence_items`

Writes:

- `music_items` or `music_projects` for lifecycle/status/detail changes
- `music_identifiers`
- `music_credits`
- `operating_events`

Conditional writes:

- `evidence_items` and `evidence_links`
- `reviews` if active mission assumptions change
- `memory_entries` if the correction matters later

Links:

- `artifact_links` from source/upload/run/user correction to changed Music records
- `evidence_links` for claim-bearing details

Audit event:
`operating_events.event_type = music_metadata_updated`, `music_identifier_added`, or `music_credit_updated`

Memory/review behavior:
Manager suggestions must remain suggestions until user accepted or source-confirmed. If the edit changes release, sync, finance, rights, or campaign readiness, trigger review for linked missions.

Failure behavior:
Do not silently overwrite conflicting identifiers or credits. Preserve conflict with evidence/source limitations and request confirmation when needed.

UI projection refreshed:
Music Workspace, linked Missions, Staff readiness, Manager retrieval context.

### Action: Create And Confirm Music Split

Trigger:
User creates a split proposal, adds contributors, sends confirmation links, an invited contributor opens/confirms/rejects a split, or a split sheet upload is normalized.

Primary owner:
Music Service with Permission Service and Evidence Service.

Reads:

- `music_items`
- `music_splits`
- `music_split_contributors`
- `music_split_confirmations`
- `music_assets`
- `permission_requests`
- `tasks`
- `checkpoints`

Writes:

- `music_splits`
- `music_split_contributors`
- `music_split_confirmations`
- `permission_requests` and `permission_decisions` when sending external confirmation links requires approval
- `operating_events`

Conditional writes:

- `music_assets` when a split sheet document is uploaded/linked
- `task_state_events` or `task_results` when a linked split task is affected
- `checkpoint_state_events` or `checkpoint_results` when a rights gate changes
- `reviews`
- `memory_entries`
- `evidence_items` when signed/confirmed documents are normalized

Links:

- `artifact_links` from split proposal to linked task/checkpoint/mission/permission
- `evidence_links` from split evidence to claims and limitations

Audit event:
`operating_events.event_type = music_split_created`, `music_split_confirmation_sent`, `music_split_confirmed`, `music_split_rejected`, or `music_split_status_changed`

Memory/review behavior:
Split status changes that affect release, sync, finance, rights, or distribution readiness must trigger linked mission/checkpoint review and update mission memory if the recommendation changes.

Failure behavior:
Do not send confirmation links unless share totals and recipient scope are valid. Expired, revoked, or superseded links cannot confirm. A rejected or disputed confirmation blocks readiness until resolved or explicitly overridden.

UI projection refreshed:
Music Rights tab, Tasks, Checkpoint Review, Mission Memory, Label HQ blockers, Staff readiness.

### Action: Build Or Initiate Music Distribution Package

Trigger:
User or Manager prepares a distribution package, readiness is checked, user approves submission, or a provider adapter returns submission status.

Primary owner:
Music Service with Permission Service, Source/Evidence Service, and provider adapter.

Reads:

- `music_items`
- `music_projects`
- `music_assets`
- `music_identifiers`
- `music_credits`
- `music_splits`
- `music_distribution_packages`
- `music_distribution_events`
- `permission_requests`
- `source_capabilities`

Writes:

- `music_distribution_packages`
- `music_distribution_events`
- `permission_requests` when approval is needed
- `permission_decisions` when the user approves/rejects
- `operating_events`

Conditional writes:

- `music_items` or `music_projects` lifecycle updates only after provider/user-confirmed state changes
- `source_snapshots` and `evidence_items` for provider responses
- `reviews` when delivery state changes mission readiness
- `memory_entries` when recommendation or future behavior changes

Links:

- `artifact_links` from package to Music records, permission, mission/task/checkpoint, provider logs, and decision package
- `evidence_links` for provider-confirmed submission or limitation claims

Audit event:
`operating_events.event_type = music_distribution_package_created`, `music_distribution_approval_requested`, `music_distribution_submitted`, `music_distribution_accepted`, or `music_distribution_failed`

Memory/review behavior:
Package creation alone does not prove release success. Provider confirmation or explicit user confirmation can update Music lifecycle and linked mission/checkpoint state.

Failure behavior:
If required assets, metadata, rights, or permission are missing, keep package `blocked` and expose the blockers. Provider failure preserves package/event history and does not mark the Music item released.

UI projection refreshed:
Music Workspace, Tasks, Checkpoint Review, Mission Memory, Label HQ, Evidence Drawer when provider evidence exists.

### Action: Generate Or Load Label HQ Daily Brief

Trigger:
Daily operating run completes, user opens Label HQ and the brief is stale/missing, or an important source/task/checkpoint/review change affects today’s read.

Primary owner:
Manager Synthesis Service with Evidence Service and Memory Service.

Reads:

- `artist_profiles`
- `music_items`
- `music_projects`
- `artist_objects`
- `source_connections`
- `source_snapshots`
- `evidence_items`
- `agent_reports`
- `manager_synthesis_runs`
- `missions`
- `mission_plan_versions`
- `tasks`
- `checkpoints`
- `reviews`
- `permission_requests`
- `memory_entries`
- `memory_summaries`
- `operating_events`

Writes:

- `manager_synthesis_runs`
- `manager_run_actions`
- `operating_directives`
- `operating_events`

Conditional writes:

- `daily_brief_snapshots` only when exact replay, stale fallback, or notification history is needed
- `flagged_items` only when the UI needs queue behavior for permissions, source gaps, stale source warnings, blocked tasks, or due reviews
- `source_requests` if a critical proof gap blocks the brief
- `reviews` if changed evidence may alter a recommendation
- `memory_entries` when the brief changes future operating priority

Links:

- `evidence_links` from brief/directive claims to evidence or limitations
- `artifact_links` from brief/directive to missions, reviews, flagged items, or source requests

Audit event:
`operating_events.event_type = daily_brief_generated` or `daily_brief_refreshed`

Memory/review behavior:
Do not store the brief as memory by default. Store memory only for priority changes, new blockers, new rejected moves, or durable operating learnings.

Failure behavior:
If generation fails, return the last brief snapshot when snapshots are enabled; otherwise return a stale/limited Label HQ projection with failure reason. If a claim cannot be supported, downgrade it to a limitation or create a source request.

UI projection refreshed:
Label HQ, Today’s Brief, Recent Movement, Staff readiness, Flagged for you.

### Action: Save Manager Context Answer

Trigger:
User confirms a suggested answer or submits a typed answer in Manager Office.

Primary owner:
Conversation Service with Memory Service.

Reads:

- `manager_context_questions`
- `manager_context_answers`
- `artist_profiles`
- `memory_summaries`
- `conversations`

Writes:

- `manager_context_answers`
- `operating_events`

Conditional writes:

- `memory_entries` if the answer is durable context, constraint, approval boundary, capacity note, or correction
- `artist_profile_versions` only when the user explicitly changes profile facts
- `memory_summaries` regeneration

Links:

- `artifact_links` from context answer to conversation or memory entry when created

Audit event:
`operating_events.event_type = manager_context_answer_saved`

Memory/review behavior:
If the answer changes an active recommendation or mission assumption, create a `review`.

Failure behavior:
If required context is missing, do not start a decision run. Preserve draft state client-side or as an unsaved form state, not as confirmed context.

UI projection refreshed:
Manager Office context gate and conversation readiness.

### Action: Submit Manager Question Or Continue Conversation

Trigger:
User submits a Manager question, continues a thread, corrects prior context, approves/rejects a recommendation in conversation, or responds to a source/evidence request.

Primary owner:
Conversation Service, Manager Synthesis Service, then Artifact Service for applied writes.

Reads:

- `conversations`
- `conversation_messages`
- `artist_profiles`
- `music_items`
- `music_projects`
- `artist_objects`
- `memory_entries`
- `memory_summaries`
- `missions`
- `mission_patterns`
- `mission_pattern_versions`
- `mission_plan_versions`
- `tasks`
- `checkpoints`
- `agent_reports`
- `agent_notes`
- `evidence_items`
- `permission_requests`
- `reviews`

Writes:

- `conversations` if starting a new thread
- `conversation_messages` for the user message
- `manager_synthesis_runs`
- `manager_run_actions`
- `operating_events`

Conditional writes:

- `conversation_messages` for the Manager response
- `decision_packages`
- `decision_package_sections`
- `missions`
- `mission_subject_links`
- `mission_plan_versions`
- `checkpoints`
- `tasks`
- `task_steps`
- `agent_notes`
- `agent_inbox_items`
- `source_requests`
- `permission_requests`
- `work_drafts`
- `reviews`
- `memory_entries`
- `memory_summaries`

Links:

- `artifact_links` from conversation/message/run/action to created or updated artifacts
- `evidence_links` from Manager claims to supporting evidence or limitations

Audit event:
`operating_events.event_type = manager_question_submitted`, plus one event per meaningful artifact/state change.

Memory/review behavior:
Write memory only for durable context, explicit decisions, rejected moves, constraints, blockers, changed recommendations, or unresolved questions. Create review if a prior recommendation may change.

Failure behavior:
If run classification confidence is low, ask a narrowing question before creating durable work. If writes partially fail, keep the run and action statuses auditable and tell the UI which linked work was not created.

UI projection refreshed:
Manager Office, Conversation Workspace, Investigation, Decision Package, Label HQ if priority changed.

### Action: Persist Decision Package

Trigger:
Manager synthesis produces a management-grade answer that includes a recommendation, rationale, rejected moves, evidence, linked work, or review condition.

Primary owner:
Manager Synthesis Service with Decision/Artifact Service.

Reads:

- `manager_synthesis_runs`
- `manager_run_actions`
- `conversation_messages`
- `evidence_items`
- `missions`
- `tasks`
- `checkpoints`
- `reviews`
- `memory_summaries`

Writes:

- `decision_packages`
- `decision_package_sections`
- `operating_events`
- `conversation_messages` for the Manager answer

Conditional writes:

- `missions`, `mission_subject_links`, `mission_plan_versions`, `checkpoints`, `tasks`, and `task_steps` if the decision creates/updates work
- `permission_requests` for approval-gated actions
- `reviews` for follow-up/review condition
- `memory_entries` for recommendation, rejected moves, limits, and future decision rules
- `memory_summaries` regeneration

Links:

- `evidence_links` for every claim-bearing section
- `artifact_links` from decision package to conversation, mission, tasks, checkpoints, permission requests, reviews, drafts, and memory

Audit event:
`operating_events.event_type = decision_package_created`

Memory/review behavior:
Decision packages usually create mission/conversation memory. Rejected moves should be memory if they should affect future recommendations.

Failure behavior:
If linked work creation fails, keep the decision package but mark relevant `manager_run_actions` as `failed` and expose partial-write state.

UI projection refreshed:
Decision Package, Conversation Workspace, Missions, Label HQ if directive/flagged items changed.

### Action: Create Or Update Mission

Trigger:
Manager synthesis identifies a durable objective, risk, opportunity, source gap, user decision request, report finding, task result, checkpoint failure, or review result that requires coordinated work.

Primary owner:
Mission Engine Service.

Reads:

- `artist_profiles`
- `music_items`
- `music_projects`
- `artist_objects`
- `mission_patterns`
- `mission_pattern_versions`
- `missions`
- `mission_plan_versions`
- `agent_reports`
- `evidence_items`
- `memory_entries`
- `memory_summaries`
- `permission_requests`
- `reviews`

Writes:

- `manager_run_actions`
- `missions`
- `mission_subject_links`
- `mission_plan_versions`
- `checkpoints`
- `mission_plan_checkpoints`
- `tasks`
- `task_steps`
- `checkpoint_dependencies`
- `task_dependencies`
- `operating_events`

Conditional writes:

- `music_items` or `music_projects` if the mission needs a new recorded-work subject
- `music_identifiers` if external Music IDs are known
- `artist_objects` if the mission needs a new non-music subject/focus object
- `source_requests`
- `permission_requests`
- `agent_notes`
- `agent_inbox_items`
- `reviews`
- `memory_entries`
- `memory_summaries`

Links:

- `mission_subject_links` from mission to primary/supporting Music records or non-music artist objects
- `evidence_links` to evidence and limitations
- `artifact_links` from originating run/report/conversation/decision to mission and created artifacts

Audit event:
`operating_events.event_type = mission_created`, `mission_updated`, or `mission_plan_version_created`

Memory/review behavior:
Create mission memory seed for a new mission. For updates, create memory only when the objective, recommendation, blocker, plan, or next review changes.

Failure behavior:
If an existing active mission likely covers the objective, update that mission or ask a narrowing question. Do not create duplicates. If pattern confidence is low, use an ad hoc/narrow plan or ask for context.

UI projection refreshed:
Missions, Label HQ active missions, Tasks, Checkpoint Review, Notes, Mission Memory.

### Action: Approve Task

Trigger:
User approves an approval-gated task.

Primary owner:
Permission Service with Task Service.

Reads:

- `tasks`
- `permission_requests`
- `permission_decisions`
- `mission_plan_versions`
- `checkpoints`

Writes:

- `permission_decisions`
- `permission_requests`
- `task_state_events`
- `tasks`
- `operating_events`

Conditional writes:

- `memory_entries` if approval changes mission risk or future behavior
- `reviews` if approval changes recommendation timing or mission path

Links:

- `artifact_links` from permission decision to task

Audit event:
`operating_events.event_type = task_approved` or `permission_approved`

Memory/review behavior:
Approval is not blanket approval. Memory should capture the exact approved scope when it matters for future decisions.

Failure behavior:
Reject approval if the permission request is expired, revoked, superseded, outside user ownership, or not scoped to the task.

UI projection refreshed:
Tasks, Mission, Flagged for you.

### Action: Mark Task Done Or Submit Completion Note

Trigger:
User submits task completion note or trusted integration confirms completion.

Primary owner:
Task Result Service, then Manager Synthesis Service if interpretation is needed.

Reads:

- `tasks`
- `task_state_events`
- `permission_requests`
- `permission_decisions`
- `checkpoints`
- `mission_plan_versions`
- `missions`
- `evidence_items`
- `memory_summaries`

Writes:

- `task_state_events`
- `task_results`
- `operating_events`
- `memory_entries`

Conditional writes:

- `manager_synthesis_runs` and `manager_run_actions` if Manager interpretation is not deterministic
- `checkpoint_state_events` when readiness changes
- `checkpoint_results` when the task result answers a checkpoint question
- `reviews` if recommendation may change
- `source_requests` if proof is weak or missing
- `permission_requests` if follow-up crosses approval boundary
- `memory_summaries` regeneration

Links:

- `evidence_links` for proof used or missing
- `artifact_links` from task result to checkpoint, review, memory, and follow-up task when created

Audit event:
`operating_events.event_type = task_completed`, `task_blocked`, `task_rejected`, `task_revised`, or `task_missed`

Memory/review behavior:
Completion is never just a checkmark. Store the Manager interpretation, checkpoint effect, mission effect, and follow-up when it changes future behavior.

Failure behavior:
If approval is required and not granted, reject completion and create no task result. If note/proof is weak, accept with low confidence and create source/evidence request.

UI projection refreshed:
Tasks, Checkpoint Review, Mission Memory, Missions, Label HQ if priority changed.

### Action: Block, Reject, Revise, Archive, Or Supersede Task

Trigger:
User or Manager marks a task blocked/rejected/revised/missed/archived/superseded, or a run determines task state should change.

Primary owner:
Task Service with Memory Service.

Reads:

- `tasks`
- `task_results`
- `checkpoints`
- `missions`
- `mission_plan_versions`
- `memory_summaries`

Writes:

- `task_state_events`
- `tasks`
- `task_results` when there is interpreted outcome
- `operating_events`
- `memory_entries`

Conditional writes:

- `checkpoint_state_events`
- `reviews`
- `source_requests`
- `permission_requests`
- replacement `tasks` and `task_steps`
- `memory_summaries` regeneration

Links:

- `artifact_links` from old task to replacement/superseding task
- `evidence_links` if proof or limitation caused the change

Audit event:
`operating_events.event_type = task_blocked`, `task_rejected`, `task_revised`, `task_archived`, or `task_superseded`

Memory/review behavior:
Archive/supersede requires a memory entry explaining why if it affects mission understanding.

Failure behavior:
Reject state change if required reason is missing for blocked, archived, or superseded states.

UI projection refreshed:
Tasks, Checkpoint Review, Mission Memory, Label HQ if blocker/flag changed.

### Action: Recompute Checkpoint State

Trigger:
Task result, evidence change, agent report, review, source update, or Manager run affects checkpoint readiness.

Primary owner:
Checkpoint Service with Review Service.

Reads:

- `checkpoints`
- `checkpoint_dependencies`
- `mission_plan_checkpoints`
- `mission_plan_versions`
- `tasks`
- `task_results`
- `evidence_items`
- `agent_reports`
- `reviews`
- `memory_summaries`

Writes:

- `checkpoint_state_events`
- `checkpoints`
- `operating_events`

Conditional writes:

- `checkpoint_results`
- `reviews`
- `tasks` and `task_steps` for new work
- `source_requests` for missing proof
- `memory_entries`
- `memory_summaries` regeneration

Links:

- `evidence_links` to evidence and limitations used in readiness decision
- `artifact_links` from task result/report/evidence/review to checkpoint state event

Audit event:
`operating_events.event_type = checkpoint_state_changed` or `checkpoint_result_added`

Memory/review behavior:
Any material checkpoint change writes mission memory. Recommendation changes create or update review.

Failure behavior:
If required upstream checkpoints are blocked, do not mark downstream checkpoint met unless Manager synthesis revises the plan and records the reason.

UI projection refreshed:
Checkpoint Review, Tasks, Mission Memory, Missions, Label HQ if blocker/priority changed.

### Action: Create Agent Note Or Inbox Item

Trigger:
Manager prepares a specialist handoff, an agent reports back to Manager, or a mission/review/task/source event creates agent-to-agent coordination need.

Primary owner:
Agent Run Service with Manager Synthesis Service for downstream application.

Reads:

- `agent_profiles`
- `agent_runs`
- `agent_reports`
- `missions`
- `tasks`
- `checkpoints`
- `evidence_items`
- `source_connections`
- `memory_summaries`

Writes:

- `agent_notes`
- `agent_inbox_items` when a recipient agent should consume the note
- `operating_events`

Conditional writes:

- `memory_entries` if the note should affect future behavior
- `source_requests` if the note identifies missing evidence
- `manager_synthesis_runs` if immediate Manager synthesis is required

Links:

- `evidence_links` for note source basis
- `artifact_links` from note to mission/task/checkpoint/report/source request

Audit event:
`operating_events.event_type = agent_note_created` or `agent_inbox_item_created`

Memory/review behavior:
Notes are not approvals. If a note changes a mission path, Manager synthesis must apply the change and create memory/review as needed.

Failure behavior:
If a locked/sourced-incomplete agent cannot answer, create readiness/source request note instead of a full specialist conclusion.

UI projection refreshed:
Notes, Locked Agent Workspace, Mission Memory if note affects mission.

### Action: Consume Agent Inbox Item During Agent Run

Trigger:
Agent run starts with pending Manager-to-agent notes.

Primary owner:
Agent Run Service.

Reads:

- `agent_inbox_items`
- `agent_notes`
- `agent_profiles`
- `source_connections`
- `evidence_items`
- `memory_summaries`

Writes:

- `agent_runs`
- `agent_reports`
- `agent_inbox_items`
- `operating_events`

Conditional writes:

- `agent_notes` back to Manager
- `source_requests`
- `manager_synthesis_runs` if the agent report needs immediate Manager action

Links:

- `artifact_links` from inbox item/note to report
- `evidence_links` from report to evidence

Audit event:
`operating_events.event_type = agent_inbox_item_consumed` and `agent_report_created`

Memory/review behavior:
Agent reports do not directly change missions. Manager synthesis decides whether to write memory, review, task, checkpoint, or mission changes.

Failure behavior:
If source requirements are missing, complete with limits and record missing evidence.

UI projection refreshed:
Staff readiness, Notes, Manager synthesis inputs.

### Action: Connect Source Or Create Source Request

Trigger:
User starts a source connection, Manager asks for missing source, agent readiness needs proof, or setup detects missing source.

Primary owner:
Source Connection Service.

Reads:

- `source_providers`
- `source_capabilities`
- `source_connections`
- `agent_profiles`
- `source_requests`

Writes:

- `source_connections`
- `source_requests`
- `operating_events`

Conditional writes:

- `source_credentials` server-side only after successful authorization
- `source_sync_jobs`
- `memory_entries` if source availability changes decision confidence
- `flagged_items` for unresolved source gaps

Links:

- `artifact_links` from source request to mission/task/checkpoint/agent when relevant

Audit event:
`operating_events.event_type = source_requested`, `source_connected`, `source_failed`, or `source_disconnected`

Memory/review behavior:
If source status changes confidence on active recommendations, create `reviews` or mark affected recommendations stale.

Failure behavior:
If provider is unavailable or unsupported, keep a source request/limitation instead of implying connection.

UI projection refreshed:
Staff readiness, Label HQ source warnings, Locked Agent Workspace, Settings.

### Action: Upload File And Normalize Evidence

Trigger:
User uploads CSV, split sheet, royalty statement, campaign report, pitch asset, rights document, or other file.

Primary owner:
Source/Evidence Service.

Reads:

- `source_requests`
- `source_connections`
- `source_providers`
- `source_capabilities`
- `uploaded_files`

Writes:

- `uploaded_files`
- `source_sync_jobs`
- `source_snapshots`
- `evidence_items`
- `operating_events`

Conditional writes:

- `music_assets` if the file belongs to a song/project
- `artist_objects` or `artifact_links` if the file belongs to a non-music focus object
- `source_connections` readiness/status update
- `source_requests` fulfilled/dismissed/superseded state
- `reviews` if evidence changes recommendation
- `memory_entries` if evidence changes future behavior
- `flagged_items` resolved or created

Links:

- `evidence_links` from evidence to target mission/task/checkpoint/decision/note/brief
- `artifact_links` from upload/source request to evidence and affected artifacts

Audit event:
`operating_events.event_type = file_uploaded`, `source_snapshot_created`, and `evidence_item_created`

Memory/review behavior:
Evidence is not memory by default. Write memory only when the evidence changes operating interpretation, blockers, confidence, recommendation, or future retrieval context.

Failure behavior:
If processing fails, keep `uploaded_files.status = failed`, create operating event, and keep source request open.

UI projection refreshed:
Evidence Drawer, Staff readiness, Locked Agent Workspace, Tasks/Checkpoint Review if linked, Label HQ if source warning changed.

### Action: Link Or Read Evidence Drawer

Trigger:
User opens supporting evidence from Label HQ, mission, decision package, note, task, checkpoint, or review.

Primary owner:
Evidence Service.

Reads:

- `evidence_items`
- `evidence_links`
- `source_snapshots`
- `source_connections`

Writes:
None for read-only evidence drawer.

Conditional writes:

- `operating_events` only if the product later tracks evidence-open analytics; do not require this in V1.

Links:
No new links on read. Links must already exist from the artifact that opened the drawer.

Audit event:
None required in V1.

Memory/review behavior:
None.

Failure behavior:
If source snapshot is missing or stale, show limitation and source status. Do not invent proof.

UI projection refreshed:
Evidence Drawer only.

### Action: Run Or Snooze Review

Trigger:
Scheduled review is due, user clicks Run review, user snoozes review, evidence changes, task result arrives, checkpoint changes, or prior recommendation may change.

Primary owner:
Review Service with Manager Synthesis Service.

Reads:

- `reviews`
- `decision_packages`
- `missions`
- `mission_plan_versions`
- `tasks`
- `task_results`
- `checkpoints`
- `checkpoint_results`
- `evidence_items`
- `agent_reports`
- `memory_summaries`

Writes:

- `reviews`
- `manager_synthesis_runs` when review uses Manager synthesis
- `manager_run_actions`
- `operating_events`

Conditional writes:

- `missions`
- `mission_plan_versions`
- `tasks`
- `checkpoints`
- `permission_requests`
- `memory_entries`
- `memory_summaries`
- `outcome_observations`
- `flagged_items`

Links:

- `artifact_links` from review to previous decision/current evidence/task result/checkpoint result/new work
- `evidence_links` to current evidence and conflicting/missing proof

Audit event:
`operating_events.event_type = review_created`, `review_completed`, or `review_snoozed`

Memory/review behavior:
Completed reviews must write mission memory when recommendation changes, blocker changes, or next action changes. Outcome observations should be created when later signals can be compared to a prior recommendation.

Failure behavior:
If prior recommendation is missing, create a review failure state and ask Manager synthesis to reconstruct context from decision/memory/events before changing work.

UI projection refreshed:
Review / What Changed, Mission Memory, Missions, Label HQ flagged items.

### Action: Create, Revise, Approve, Or Export Work Draft

Trigger:
Manager or specialist creates a draft, user edits draft, user approves/rejects draft, or user exports/sends an approved draft.

Primary owner:
Draft/Artifact Service with Permission Service for external use.

Reads:

- `work_drafts`
- `work_draft_versions`
- `tasks`
- `decision_packages`
- `permission_requests`
- `permission_decisions`
- `evidence_items`
- `memory_summaries`

Writes:

- `work_drafts`
- `work_draft_versions`
- `operating_events`

Conditional writes:

- `permission_requests` for export/send/publish/external use
- `permission_decisions` if user approves/rejects
- `task_state_events` if draft approval completes or advances a task
- `memory_entries` if the draft locks durable public language, strategy, or rejected language

Links:

- `artifact_links` from draft to decision/task/mission/permission
- `evidence_links` for claims included in the draft

Audit event:
`operating_events.event_type = work_draft_created`, `work_draft_revised`, `work_draft_approved`, or `work_draft_exported`

Memory/review behavior:
Draft content is not memory by default. Store memory only when approved language or strategy should shape future recommendations.

Failure behavior:
Do not export/send/publish without approved permission or explicit user action. If approval is missing, create/return `permission_requests`.

UI projection refreshed:
Work Draft Drawer, Tasks, Decision Package, Mission if linked.

### Action: Approve, Reject, Edit, Revoke, Or Expire Permission

Trigger:
User decides on a permission request, edits approval parameters, revokes a prior approval, or expiry time passes.

Primary owner:
Permission Service.

Reads:

- `permission_requests`
- `permission_decisions`
- `tasks`
- `work_drafts`
- `decision_packages`
- `missions`

Writes:

- `permission_decisions`
- `permission_requests`
- `operating_events`

Conditional writes:

- `task_state_events` when permission changes task actionability
- `work_drafts` when draft status changes
- `manager_synthesis_runs` when approval/rejection changes the plan
- `reviews`
- `memory_entries`
- `flagged_items`

Links:

- `artifact_links` from permission decision to task/draft/decision/mission/action

Audit event:
`operating_events.event_type = permission_approved`, `permission_rejected`, `permission_edited`, `permission_revoked`, or `permission_expired`

Memory/review behavior:
Write memory if the decision sets a reusable boundary, rejects a move, changes budget posture, or affects future behavior.

Failure behavior:
Reject decisions outside user ownership, already superseded requests, expired requests unless the decision explicitly renews, or mismatched action scope.

UI projection refreshed:
Flagged for you, Tasks, Work Draft Drawer, Decision Package, Mission.

### Action: Write Memory And Regenerate Summary

Trigger:
Decision package, mission change, task result, checkpoint change, agent note/report, review, evidence change, profile correction, permission decision, user durable context, or outcome observation.

Primary owner:
Memory Service.

Reads:

- `operating_events`
- `memory_entries`
- `memory_summaries`
- source artifact that caused the memory write

Writes:

- `memory_entries`
- `memory_summaries`
- `operating_events` if the memory write itself needs traceability

Conditional writes:

- `outcome_observations` when later evidence can be compared to a prior expectation
- `reviews` if memory correction changes a prior recommendation

Links:

- `artifact_links` from memory entry to source object when not already covered by typed foreign keys
- `evidence_links` if memory is evidence-backed

Audit event:
`operating_events.event_type = memory_entry_created` or `memory_summary_regenerated`

Memory/review behavior:
Memory entries are append-only. Wrong interpretations are corrected by new entries, not rewrites. Summaries can be regenerated or superseded.

Failure behavior:
If extraction confidence is low, write a narrower entry or ask for clarification. Do not store speculation as fact.

UI projection refreshed:
Mission Memory, Manager context retrieval, Label HQ if memory changes daily read.

### Action: Record Outcome Observation

Trigger:
Review compares later evidence against a prior recommendation, task, checkpoint, mission plan, decision package, or agent report.

Primary owner:
Memory Service with Review Service.

Reads:

- `reviews`
- `decision_packages`
- `tasks`
- `task_results`
- `checkpoints`
- `checkpoint_results`
- `missions`
- `agent_reports`
- `evidence_items`
- `memory_entries`

Writes:

- `outcome_observations`
- `operating_events`
- `memory_entries` when the observation should affect future behavior

Conditional writes:

- `memory_summaries` regeneration
- `reviews` if the observation reopens a recommendation

Links:

- `evidence_links` to observed signals
- `artifact_links` from observation to recommendation/task/checkpoint/mission/report

Audit event:
`operating_events.event_type = outcome_observation_created`

Memory/review behavior:
Must state confidence, confounders, and causal limitation. Do not claim causation from correlation.

Failure behavior:
If evidence is insufficient, create inconclusive observation or pending evidence state instead of learning a false pattern.

UI projection refreshed:
Mission Memory, Review / What Changed.

### Action: Navigation Or Drawer Read

Trigger:
User navigates via desktop rail/mobile nav, selects mission/checkpoint, opens contextual drawer, or returns/back.

Primary owner:
Navigation Shell / relevant read service.

Reads:

- target artifact tables needed by the route or drawer
- `navigation_preferences` when restoring selected mission or last view

Writes:

- `navigation_preferences` only for durable selected mission/last view preferences

Conditional writes:
None.

Links:
None.

Audit event:
None required in V1.

Memory/review behavior:
None.

Failure behavior:
If target artifact is missing or inaccessible, show unavailable target state without changing operating records.

UI projection refreshed:
Target page/drawer only.

## Page Coverage Matrix

| Prototype surface | Contract actions |
| --- | --- |
| Desktop Rail / Mobile Nav | Navigation Or Drawer Read |
| Connect Artist | Select Artist Identity |
| Setup / Context | Save Setup Or Artist Profile Context |
| Label HQ priority strip | Navigation Or Drawer Read; Generate Or Load Label HQ Daily Brief |
| Label HQ | Generate Or Load Label HQ Daily Brief; Navigation Or Drawer Read |
| Today's Brief | Generate Or Load Label HQ Daily Brief; Link Or Read Evidence Drawer; Submit Manager Question Or Continue Conversation |
| Recent Movement | Navigation Or Drawer Read |
| Music library | Create Or Edit Music Item Or Project; Navigation Or Drawer Read |
| Music song room | Create Or Edit Music Item Or Project; Upload Or Replace Music Asset; Update Music Metadata Credits Or Identifiers; Create And Confirm Music Split; Build Or Initiate Music Distribution Package; Link Or Read Evidence Drawer; Navigation Or Drawer Read |
| Music project room | Create Or Edit Music Item Or Project; Update Music Metadata Credits Or Identifiers; Navigation Or Drawer Read |
| Split confirmation portal | Create And Confirm Music Split |
| Music distribution hub | Build Or Initiate Music Distribution Package |
| Staff | Navigation Or Drawer Read; Connect Source Or Create Source Request |
| Manager Office context gate | Save Manager Context Answer |
| Manager Office composer | Submit Manager Question Or Continue Conversation |
| Conversation Workspace | Submit Manager Question Or Continue Conversation; Navigation Or Drawer Read |
| Investigation | Submit Manager Question Or Continue Conversation |
| Decision Package | Persist Decision Package; Navigation Or Drawer Read; Link Or Read Evidence Drawer |
| Missions | Create Or Update Mission; Navigation Or Drawer Read |
| Tasks | Approve Task; Mark Task Done Or Submit Completion Note; Block, Reject, Revise, Archive, Or Supersede Task |
| Checkpoint Review | Recompute Checkpoint State; Navigation Or Drawer Read |
| Notes | Create Agent Note Or Inbox Item; Consume Agent Inbox Item During Agent Run; Navigation Or Drawer Read |
| Mission Memory | Write Memory And Regenerate Summary; Record Outcome Observation; Navigation Or Drawer Read |
| Settings / Artist Profile | Save Setup Or Artist Profile Context |
| Locked Agent Workspace | Connect Source Or Create Source Request; Upload File And Normalize Evidence; Create Agent Note Or Inbox Item |
| Evidence Drawer | Link Or Read Evidence Drawer |
| Review / What Changed | Run Or Snooze Review; Record Outcome Observation |
| Work Draft Drawer | Create, Revise, Approve, Or Export Work Draft |

## Table Write Coverage

Reference/static or owner setup tables:

- `accounts`, `users`, `account_memberships`, `source_providers`, `source_capabilities`, `agent_profiles`, `mission_patterns`, `mission_pattern_versions`, and `manager_context_questions` are seeded/admin/reference records in V1.

Runtime write sources:

- setup/profile writes: `artists`, `artist_workspaces`, `artist_aliases`, `artist_profiles`, `artist_profile_versions`, `music_items`, `music_projects`, `music_identifiers`, `artist_objects`
- source/evidence writes: `source_connections`, `source_credentials`, `source_sync_jobs`, `source_requests`, `uploaded_files`, `source_snapshots`, `evidence_items`, `evidence_links`
- music writes: `music_items`, `music_projects`, `music_project_items`, `music_assets`, `music_identifiers`, `music_credits`, `music_splits`, `music_split_contributors`, `music_split_confirmations`, `music_distribution_packages`, `music_distribution_events`
- agent/Manager writes: `agent_runs`, `agent_reports`, `agent_notes`, `agent_inbox_items`, `manager_synthesis_runs`, `manager_run_actions`, `quality_gate_results`, `ai_run_usage_events`
- operating picture writes: `daily_brief_snapshots`, `operating_directives`, `flagged_items`, `operating_events`, `navigation_preferences`
- conversation/decision writes: `conversations`, `conversation_messages`, `manager_context_answers`, `decision_packages`, `decision_package_sections`, `artifact_links`
- mission/task/checkpoint writes: `missions`, `mission_subject_links`, `mission_plan_versions`, `mission_plan_checkpoints`, `checkpoint_dependencies`, `task_dependencies`, `tasks`, `task_steps`, `task_state_events`, `task_results`, `checkpoints`, `checkpoint_state_events`, `checkpoint_results`
- review/permission/draft/memory writes: `reviews`, `permission_requests`, `permission_decisions`, `work_drafts`, `work_draft_versions`, `memory_entries`, `memory_summaries`, `outcome_observations`

## Acceptance Checks

- Every row in `page-action-inventory.md` maps to at least one action in this contract.
- Every workflow doc's "Artifacts Created Or Updated" maps to tables in the V1 schema.
- Every runtime schema table has at least one write source in this contract.
- No workflow updates mission/task/checkpoint meaning without an `operating_events` record.
- No AI/system-created operating artifact is written without `created_from_run_id` or `created_from_action_id` where applicable.
- No AI, provider API, or billable tool workflow completes without `ai_run_usage_events` or an explicit non-billable marker.
- No dynamic prototype field is accepted unless it can be traced through `prototype-data-lineage-contract.md` to source records, producer workflow, provenance, and evidence or limitation.
- No user-facing claim-bearing output lacks `evidence_links`, memory/profile/user-input provenance, report provenance, source snapshot provenance, or explicit limitation.
- No permission-gated action executes from task/draft/decision state alone; it requires scoped `permission_requests` and `permission_decisions`.
- UI projections are derived from source records and are not treated as source-of-truth tables in V1.
