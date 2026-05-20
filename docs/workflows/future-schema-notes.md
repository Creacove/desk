# V1 Operational Database Schema Contract

Purpose: define the real V1 database contract for turning the current prototype into a durable AI record label operating system.

Status: authoritative V1 schema contract. This document replaces the earlier future-schema notes. Keep the filename so existing references remain valid, but treat this file as the schema source of truth for V1 planning and migrations.

## Authority Order

Use these documents together:

1. Current prototype behavior in `src/pages/AiLabelPrototype.tsx`
2. This V1 operational schema contract
3. `docs/workflows/schema-relationship-contract.md`
4. `docs/workflows/state-machine-contract.md`
5. `docs/workflows/source-confidence-contract.md`
6. `docs/workflows/memory-and-learning-contract.md`
7. PRD, blueprint, and design handoff for product intent

If this document and a stricter contract differ, use the stricter rule unless the prototype is intentionally changed first.

## CTO Standard

The database is the product foundation. It must not become a generic analytics schema, a chatbot transcript store, or a hard-coded release checklist.

The schema must support:

- one active artist workspace in V1
- contextual evidence, not a top-level evidence dashboard
- Manager-led synthesis, not independent agent writes into the operating plan
- dynamic missions generated from patterns/playbooks
- generic artist work objects that missions can reference without becoming release-specific infrastructure
- task/checkpoint feedback loops
- explicit permission boundaries
- append-first memory and audit trails
- source-backed user-facing claims
- rebuildable UI projections for speed

Core rule: if the prototype shows it, the database must account for it. If the Manager claims it, the database must explain where it came from. If AI creates or changes it, the database must link it to the run and action that produced it.

## Design Principles

### Source Of Truth Vs Read Model

Separate durable truth from UI convenience.

- Source-of-truth records: artists, profiles, sources, evidence, runs, reports, conversations, missions, plans, tasks, checkpoints, permissions, drafts, reviews, memory, and operating events.
- Append-only records: messages, snapshots, evidence, runs, reports, run actions, task events, task results, checkpoint events, permission decisions, reviews, memory entries, and outcome observations.
- UI projections: Label HQ, mission workspace, staff readiness, and conversation summaries. These can be rebuilt from source-of-truth records and should not start as required persisted tables unless performance proves they are needed.

### AI Write Provenance

Every AI-created or AI-updated operating artifact must include:

- `created_from_run_id`
- `created_from_action_id` where the write came from a Manager action plan
- `created_by_type`
- `created_by_id`
- linked evidence, memory, user input, report, snapshot, or explicit limitation when the artifact contains a claim

This applies to missions, plans, tasks, checkpoints, notes, reviews, directives, decision packages, memory entries, permission requests, and drafts.

### Explicit Links Over Hidden JSON

Use JSONB for provider payloads, flexible metadata, run context summaries, and display payloads. Do not hide important product relationships only inside JSON.

Use join/link tables for:

- evidence used by an artifact
- artifacts created by a decision package or run action
- run inputs and outputs
- mission plan checkpoint ordering
- task/checkpoint dependencies
- source snapshots normalized into evidence
- conversations linked to missions, tasks, decisions, and drafts

### No Silent History Rewrites

Historical records are append-only. Mutable product objects change through versioning, supersession, archive/cancel states, or explicit operating events.

Append-only:

- `source_snapshots`
- `evidence_items`
- `conversation_messages`
- `agent_runs`
- `agent_reports`
- `manager_synthesis_runs`
- `manager_run_actions`
- `operating_events`
- `task_state_events`
- `task_results`
- `checkpoint_state_events`
- `checkpoint_results`
- `reviews`
- `permission_decisions`
- `memory_entries`
- `outcome_observations`

Versioned or superseded:

- `artist_profile_versions`
- `mission_pattern_versions`
- `mission_plan_versions`
- `daily_brief_snapshots`
- `operating_directives`
- `memory_summaries`
- `work_draft_versions`
- recommendation fields on missions and decision packages

### Deletion Policy

Deleting important operating records is not normal product behavior. Prefer:

- `archived`
- `cancelled`
- `superseded`
- `expired`
- `revoked`
- `stale`

If the product later needs legal deletion or privacy deletion, handle it through explicit deletion request records and audit-safe redaction policies.

## Shared Columns

Use UUID primary keys unless a provider-native ID must be stored as a separate external identifier.

Artist-scoped tables should include:

- `id`
- `account_id`
- `artist_workspace_id`
- `artist_id`
- `created_at`
- `updated_at` where mutable
- `created_by_type`: `user`, `manager`, `agent`, `system`, `admin`, `integration`
- `created_by_id`
- `created_from_run_id` where AI/system generated
- `created_from_action_id` where generated by Manager action plan
- `status` where lifecycle matters

Sensitive tables must include ownership fields even if they can also be reached through joins. This keeps Supabase RLS straightforward and avoids accidental cross-artist reads.

## Ownership And Workspace

### `accounts`

Team or customer owner.

Fields:

- `id`
- `name`
- `plan`
- `status`
- `created_at`
- `updated_at`

### `users`

Authenticated human user.

Fields:

- `id`
- `email`
- `display_name`
- `status`
- `created_at`
- `updated_at`

### `account_memberships`

Links users to accounts.

Fields:

- `id`
- `account_id`
- `user_id`
- `role`: `owner`, `member`, `admin_support`
- `status`
- `created_at`

V1 can stay simple. Do not build enterprise RBAC, but do make ownership explicit.

### `artist_workspaces`

One active artist operating workspace.

Fields:

- `id`
- `account_id`
- `artist_id`
- `name`
- `status`: `setup`, `active`, `paused`, `archived`
- `active_profile_version_id`
- `created_at`
- `updated_at`

### `artists`

Stable artist identity.

Fields:

- `id`
- `account_id`
- `display_name`
- `canonical_spotify_artist_id`
- `canonical_spotify_url`
- `created_at`
- `updated_at`

### `artist_aliases`

Search and identity aliases.

Fields:

- `id`
- `account_id`
- `artist_id`
- `alias`
- `source`
- `confidence`
- `created_at`

### `artist_profiles`

Current editable operating profile.

Fields:

- `id`
- `account_id`
- `artist_workspace_id`
- `artist_id`
- `current_version_id`
- `display_name`
- `spotify_identity`
- `genres`
- `home_market`
- `stage`
- `current_goal`
- `active_focus_object_id`
- `budget_context`
- `social_handles`
- `artist_direction`
- `updated_by_user_id`
- `updated_at`

### `artist_profile_versions`

Version history for profile changes.

Fields:

- `id`
- `account_id`
- `artist_workspace_id`
- `artist_id`
- `profile_id`
- `version`
- `profile_payload`
- `change_reason`
- `source`: `setup`, `settings`, `approved_manager_suggestion`, `import`
- `created_by_type`
- `created_by_id`
- `created_from_run_id`
- `created_at`

Profile facts are user/team owned. The Manager may suggest edits but must not silently change identity, budget, direction, connected handles, or ownership facts.

## Artist Objects And Context

This layer stores durable things the artist team works around: songs, music projects, music packages, campaigns, rights packages, pitch packages, markets, budget pools, partnerships, tours, files, and other focus objects.

Important distinction: these objects are not missions. A mission is an operating objective or question. An artist object is the subject, asset, package, market, budget, opportunity, or body of work the mission may be about.

Example:

- Artist object: `Night Bus`, type `song`
- Mission: `Release Night Bus on June 12`
- Pattern: `release_planning`
- Tasks/checkpoints: generated dynamically from the mission objective and pattern

Do not create a table per mission type. Do not create release-only infrastructure for release-planning missions. Use generic object records plus mission patterns.

### `artist_objects`

Generic subject/focus objects for artist work.

Fields:

- `id`
- `account_id`
- `artist_workspace_id`
- `artist_id`
- `object_type`: `song`, `music_project`, `music_package`, `campaign`, `market`, `budget_pool`, `rights_package`, `pitch_package`, `live_opportunity`, `deal_opportunity`, `audience_segment`, `team_process`, `source_gap`, `creative_asset`, `other`
- `title`
- `description`
- `status`
- `is_active_focus`
- `metadata`
- `source_snapshot_id`
- `created_at`
- `updated_at`

`metadata` can hold type-specific fields such as lifecycle stage, planned release date, distributor, territory, market, budget amount, asset format, opportunity owner, or provider-native IDs. Stable external identifiers belong in `artist_object_identifiers`. If a type-specific field becomes heavily queried across V1 usage, promote it later through a migration. Do not prematurely create release-specific tables.

Music object conventions:

- `song` is the atomic recorded-work object. Use it for demos, unreleased songs, released tracks, catalog songs, sync candidates, and song-level rights or performance reads.
- `music_project` is a container for a single, EP, album, mixtape, deluxe edition, compilation, or unreleased body of work.
- `music_package` is optional and later-facing for sync bundles, pitch packages, or campaign bundles that intentionally group multiple songs/projects for an operating purpose.
- A released Spotify album and an unreleased EP draft are both `music_project` records, but their `source_snapshot_id`, identifiers, lifecycle metadata, and evidence limits must make their source status clear.
- Song lifecycle in V1 should stay metadata-backed until usage proves otherwise. Stages such as `idea`, `recording`, `production`, `mixing`, `mastering`, `ready`, `scheduled`, `released`, and `catalog` can be user-set or Manager-suggested, but Manager suggestions should not silently overwrite the user-visible stage.

### `artist_object_identifiers`

Provider, catalog, and business identifiers for generic artist objects.

Fields:

- `id`
- `account_id`
- `artist_workspace_id`
- `artist_id`
- `artist_object_id`
- `identifier_type`: `spotify_artist_id`, `spotify_track_id`, `spotify_album_id`, `isrc`, `upc`, `youtube_video_id`, `tiktok_sound_id`, `chartmetric_id`, `soundcharts_id`, `distributor_id`, `custom`
- `identifier_value`
- `provider_id`
- `source_snapshot_id`
- `confidence`
- `created_at`

Keep identifiers separate from `artist_objects` so a market, rights package, budget pool, creator campaign, or team process is not forced into track/release-shaped columns.

### `artist_object_relationships`

Explicit relationships between artist objects.

Fields:

- `id`
- `account_id`
- `artist_workspace_id`
- `artist_id`
- `from_artist_object_id`
- `to_artist_object_id`
- `relationship`: `contains_song`, `appears_on_project`, `alternate_version_of`, `belongs_to_rights_package`, `belongs_to_pitch_package`, `supports_campaign`, `related_to`
- `order_index`
- `created_from_run_id`
- `created_from_action_id`
- `created_at`

Use this for music project tracklists and durable object-to-object relationships. Do not duplicate song state inside a project payload. A project contains song references; each song keeps its own identifiers, assets, evidence, rights state, and linked missions.

### `artist_object_assets`

Files or materials attached to a generic artist object.

Fields:

- `id`
- `account_id`
- `artist_workspace_id`
- `artist_id`
- `artist_object_id`
- `asset_type`: `master`, `artwork`, `pitch_asset`, `epk`, `clean_instrumental`, `metadata`, `split_sheet`, `press_photo`, `royalty_statement`, `campaign_report`, `creator_brief`, `other`
- `title`
- `uploaded_file_id`
- `status`
- `notes`
- `created_at`
- `updated_at`

Do not add separate V1 tables for artist goals or constraints. Current goal belongs in `artist_profiles`, active operating goals belong in `missions`, and durable constraints/do-not-repeat rules belong in `memory_entries` with `kind = constraint`, `preference`, `risk`, or `rejected_move`. This avoids three sources of truth for the same management context.

Music lifecycle files should remain asset records, not a separate file subsystem in V1. Audio uploads can be classified through `asset_type`, `title`, and metadata as demo, rough mix, final master, clean, instrumental, or stems. Artwork, split sheets, metadata exports, and pitch assets follow the same `artist_object_assets` path with status and provenance notes.

Do not add separate V1 object-version tables. Important object changes should create `operating_events` and, when they affect future decisions, `memory_entries`. Use `artist_object_relationships` for durable artist-object relationships such as project tracklists; use `artifact_links` for broader cross-artifact links such as conversations, decisions, drafts, or briefs pointing at objects.

## Sources, Files, And Evidence

### `source_providers`

Provider catalog.

Fields:

- `id`
- `provider_key`: `spotify`, `spotify_for_artists`, `youtube`, `tiktok`, `instagram`, `x`, `chartmetric`, `soundcharts`, `bright_data`, `distributor`, `smart_link`, `royalty_statement`, `split_sheet`, `manual_upload`
- `display_name`
- `source_kind`: `official_api`, `third_party_provider`, `public_web`, `uploaded_file`, `user_supplied`, `manual`
- `default_confidence`
- `claim_boundaries`
- `created_at`

### `source_connections`

Artist-specific source connection/readiness.

Fields:

- `id`
- `account_id`
- `artist_workspace_id`
- `artist_id`
- `provider_id`
- `handle_or_external_ref`
- `status`: `not_configured`, `candidate`, `resolved`, `unresolved`, `ambiguous`, `connected`, `disconnected`, `unavailable`, `failed`
- `last_sync_at`
- `next_sync_at`
- `freshness_target`
- `limitations`
- `created_at`
- `updated_at`

### `source_capabilities`

What a source can and cannot support.

Fields:

- `id`
- `provider_id`
- `capability_key`
- `supports_claims`
- `forbidden_claims`
- `freshness_target`
- `default_confidence`
- `required_for_agent_keys`
- `metadata`

### `source_credentials`

Server-only credential metadata.

Fields:

- `id`
- `account_id`
- `artist_workspace_id`
- `artist_id`
- `source_connection_id`
- `credential_ref`
- `status`
- `scopes`
- `expires_at`
- `revoked_at`
- `created_at`
- `updated_at`

Never return this table from client APIs.

### `source_sync_jobs`

Ingestion job history.

Fields:

- `id`
- `account_id`
- `artist_workspace_id`
- `artist_id`
- `source_connection_id`
- `trigger_type`: `scheduled`, `manual`, `setup`, `evidence_gap`, `review`, `agent_run`
- `status`: `queued`, `running`, `completed`, `completed_with_limits`, `failed`, `cancelled`
- `started_at`
- `completed_at`
- `error`
- `snapshot_ids`
- `created_from_run_id`
- `created_at`

### `source_requests`

Requests to connect/upload/provide missing evidence.

Fields:

- `id`
- `account_id`
- `artist_workspace_id`
- `artist_id`
- `mission_id`
- `task_id`
- `checkpoint_id`
- `agent_profile_id`
- `provider_id`
- `request_type`: `connect_source`, `upload_file`, `verify_identity`, `manual_answer`
- `reason`
- `needed_for`
- `status`: `open`, `fulfilled`, `dismissed`, `expired`, `superseded`
- `created_from_run_id`
- `created_from_action_id`
- `created_at`
- `updated_at`

### `uploaded_files`

User or integration uploads.

Fields:

- `id`
- `account_id`
- `artist_workspace_id`
- `artist_id`
- `uploaded_by_user_id`
- `file_name`
- `file_type`
- `classification`: `spotify_for_artists_export`, `royalty_statement`, `split_sheet`, `campaign_report`, `pitch_asset`, `rights_document`, `other`
- `storage_ref`
- `status`: `uploaded`, `processing`, `processed`, `failed`, `revoked`
- `source_request_id`
- `created_at`
- `updated_at`

### `source_snapshots`

Append-only raw or semi-raw captured source state.

Fields:

- `id`
- `account_id`
- `artist_workspace_id`
- `artist_id`
- `source_connection_id`
- `uploaded_file_id`
- `provider_id`
- `source_kind`
- `captured_at`
- `time_window_start`
- `time_window_end`
- `raw_ref`
- `raw_hash`
- `metadata`
- `created_at`

### `evidence_items`

Append-only normalized proof.

Fields:

- `id`
- `account_id`
- `artist_workspace_id`
- `artist_id`
- `source_snapshot_id`
- `uploaded_file_id`
- `provider_id`
- `source`
- `source_kind`
- `evidence_type`
- `subject_type`
- `subject_id`
- `subject_label`
- `time_window_start`
- `time_window_end`
- `metric_name`
- `metric_value`
- `metric_unit`
- `lens`: `identity`, `catalog`, `attention`, `participation`, `conversion`, `readiness`, `risk`, `context`, `finance`, `rights`, `geography`
- `freshness`
- `confidence`: `high`, `medium`, `low`, `unknown`
- `provenance`
- `limitation`
- `raw_ref`
- `created_from_run_id`
- `created_at`

### `evidence_links`

Strict links from evidence to artifacts.

Fields:

- `id`
- `account_id`
- `artist_workspace_id`
- `artist_id`
- `evidence_item_id`
- `target_type`
- `target_id`
- `usage`: `supports_claim`, `supports_limitation`, `missing_evidence`, `conflicting_evidence`, `source_basis`
- `claim_text`
- `created_from_run_id`
- `created_at`

## Agents And Runs

### `agent_profiles`

Staff/agent metadata.

Fields:

- `id`
- `agent_key`: `manager`, `marketing`, `sync_deals`, `touring`, `finance_rights`
- `name`
- `title`
- `status_default`: `available`, `locked`
- `purpose`
- `tools`
- `evidence_needs`
- `required_source_capabilities`
- `optional_source_capabilities`
- `manager_can_prepare`
- `color`
- `created_at`
- `updated_at`

### `agent_runs`

Append-only specialist or Manager-adjacent agent run.

Fields:

- `id`
- `account_id`
- `artist_workspace_id`
- `artist_id`
- `agent_profile_id`
- `trigger_type`: `artist_wide`, `mission_specific`, `conversation`, `task_result`, `evidence_triggered`, `daily`, `weekly`, `review`, `manual`, `agent_inbox`
- `mission_id`
- `conversation_id`
- `status`: `queued`, `running`, `needs_context`, `completed`, `completed_with_limits`, `failed`, `cancelled`
- `source_refs`
- `limitations`
- `started_at`
- `completed_at`
- `error`
- `created_at`

### `agent_reports`

Append-only agent findings.

Fields:

- `id`
- `account_id`
- `artist_workspace_id`
- `artist_id`
- `agent_run_id`
- `agent_profile_id`
- `mission_id`
- `mission_pattern_key`
- `finding`
- `confidence`
- `evidence_missing`
- `limitations`
- `risk_or_opportunity`
- `recommended_internal_action`
- `permission_required`
- `suggested_follow_up`
- `created_at`

Evidence used is stored through `evidence_links`.

### `agent_notes`

Agent-to-agent operational handoffs.

Fields:

- `id`
- `account_id`
- `artist_workspace_id`
- `artist_id`
- `mission_id`
- `sender_agent_profile_id`
- `recipient_agent_profile_id`
- `note_type`
- `subject`
- `message`
- `source_basis`
- `recommended_action`
- `resulting_change`: `filed_to_memory`, `created_task`, `updated_checkpoint`, `created_referral`, `source_request`, `no_action`, `superseded`
- `status`: `open`, `filed_to_memory`, `created_task`, `updated_checkpoint`, `no_action`, `superseded`
- `agent_run_id`
- `agent_report_id`
- `created_from_run_id`
- `created_from_action_id`
- `created_at`
- `updated_at`

### `agent_inbox_items`

Requests for future agent consumption.

Fields:

- `id`
- `account_id`
- `artist_workspace_id`
- `artist_id`
- `mission_id`
- `note_id`
- `from_agent_profile_id`
- `to_agent_profile_id`
- `priority`
- `consume_mode`: `next_relevant_run`, `immediate`, `manual_review`
- `status`: `pending`, `consumed`, `deferred`, `cancelled`
- `consumed_by_run_id`
- `created_at`
- `updated_at`

### `manager_synthesis_runs`

Append-only Manager coordination run.

Fields:

- `id`
- `account_id`
- `artist_workspace_id`
- `artist_id`
- `trigger_type`: `daily`, `weekly`, `mission`, `evidence_triggered`, `task_result`, `conversation`, `review`, `manual`
- `conversation_id`
- `mission_id`
- `status`: `queued`, `running`, `needs_context`, `completed`, `completed_with_limits`, `failed`, `cancelled`
- `classification`
- `classification_confidence`
- `context_refs`
- `input_report_ids`
- `steps_payload`
- `limitations`
- `started_at`
- `completed_at`
- `error`
- `created_at`

Store V1 investigation-screen steps in `steps_payload`. Do not create a separate `manager_run_steps` table until the product needs streaming step updates, step-level retries, or step-level analytics.

### `manager_run_actions`

Append-only action plan and execution audit.

Fields:

- `id`
- `account_id`
- `artist_workspace_id`
- `artist_id`
- `manager_synthesis_run_id`
- `order_index`
- `action_type`
- `target_type`
- `target_id`
- `status`: `pending`, `applied`, `approval_required`, `failed`, `skipped`
- `approval_required`
- `payload`
- `result_payload`
- `error`
- `created_at`

### `quality_gate_results`

Quality validation for runs and outputs.

Fields:

- `id`
- `account_id`
- `artist_workspace_id`
- `artist_id`
- `manager_synthesis_run_id`
- `target_type`
- `target_id`
- `passed`
- `warnings`
- `failures`
- `constraints_applied`
- `created_at`

## Label HQ Operating Picture

### `daily_brief_snapshots`

Versioned/generated Today's Brief.

Fields:

- `id`
- `account_id`
- `artist_workspace_id`
- `artist_id`
- `manager_synthesis_run_id`
- `version`
- `headline_read`
- `signal_proof`
- `manager_read`
- `directive_id`
- `source_line`
- `limitations`
- `generated_at`
- `status`: `current`, `stale`, `superseded`, `failed`
- `superseded_at`
- `created_at`

Every metric, geography, movement, and source claim in the brief must link through `evidence_links`, `operating_events`, reports, memory, profile context, or explicit limitations.

### `operating_directives`

Manager priority instruction.

Fields:

- `id`
- `account_id`
- `artist_workspace_id`
- `artist_id`
- `mission_id`
- `manager_synthesis_run_id`
- `title`
- `body`
- `priority`
- `status`: `active`, `superseded`, `expired`, `archived`
- `active_until`
- `created_from_run_id`
- `created_from_action_id`
- `created_at`
- `updated_at`

### `flagged_items`

Flagged for you queue.

Fields:

- `id`
- `account_id`
- `artist_workspace_id`
- `artist_id`
- `title`
- `body`
- `kind`: `permission`, `source_gap`, `review_due`, `blocked_task`, `stale_source`, `mission_attention`
- `priority`
- `target_type`
- `target_id`
- `status`: `open`, `resolved`, `dismissed`, `superseded`
- `created_from_run_id`
- `created_from_action_id`
- `created_at`
- `updated_at`

### `operating_events`

Append-only product activity ledger.

Fields:

- `id`
- `account_id`
- `artist_workspace_id`
- `artist_id`
- `event_type`
- `actor_type`
- `actor_id`
- `target_type`
- `target_id`
- `source_type`
- `source_id`
- `manager_synthesis_run_id`
- `manager_run_action_id`
- `agent_run_id`
- `mission_id`
- `checkpoint_id`
- `task_id`
- `summary`
- `payload`
- `created_at`

Recent Movement is a ranked view of operating events, agent notes, task/checkpoint changes, source changes, reviews, and memory entries.

### `navigation_preferences`

Lightweight user/UI preference.

Fields:

- `id`
- `account_id`
- `artist_workspace_id`
- `user_id`
- `selected_mission_id`
- `last_view`
- `payload`
- `updated_at`

## Conversations And Decisions

### `conversations`

Persistent Manager threads.

Fields:

- `id`
- `account_id`
- `artist_workspace_id`
- `artist_id`
- `topic`
- `status`
- `summary`
- `last_update_at`
- `linked_mission_id`
- `archived_at`
- `created_at`
- `updated_at`

### `conversation_messages`

Append-only user/Manager messages.

Fields:

- `id`
- `account_id`
- `artist_workspace_id`
- `artist_id`
- `conversation_id`
- `speaker`: `artist`, `manager`, `system`
- `label`
- `body`
- `manager_synthesis_run_id`
- `metadata`
- `created_at`

### `manager_context_questions`

Context gate questions.

Fields:

- `id`
- `question_key`
- `question`
- `suggested_answer`
- `required_for`
- `order_index`
- `status`
- `created_at`
- `updated_at`

### `manager_context_answers`

User-confirmed context answers.

Fields:

- `id`
- `account_id`
- `artist_workspace_id`
- `artist_id`
- `question_id`
- `conversation_id`
- `answer`
- `source`: `typed`, `suggestion_confirmed`, `imported`
- `created_by_user_id`
- `memory_entry_id`
- `created_at`
- `updated_at`

### `decision_packages`

Durable management calls.

Fields:

- `id`
- `account_id`
- `artist_workspace_id`
- `artist_id`
- `manager_synthesis_run_id`
- `conversation_id`
- `mission_id`
- `question`
- `recommendation`
- `facts`
- `why`
- `rejected_moves`
- `review_condition`
- `confidence`
- `status`: `active`, `superseded`, `archived`
- `created_from_action_id`
- `created_at`
- `updated_at`

### `decision_package_sections`

Structured sections for UI rendering and export.

Fields:

- `id`
- `account_id`
- `artist_workspace_id`
- `artist_id`
- `decision_package_id`
- `section_type`: `direct_recommendation`, `facts`, `why`, `rejected_moves`, `work_created`, `evidence`, `review_condition`, `permission_needed`
- `title`
- `body`
- `payload`
- `order_index`

### `artifact_links`

Generic but explicit artifact relationships.

Fields:

- `id`
- `account_id`
- `artist_workspace_id`
- `artist_id`
- `source_type`
- `source_id`
- `target_type`
- `target_id`
- `relationship`: `created`, `updated`, `references`, `supersedes`, `depends_on`, `blocks`, `unblocks`, `review_of`, `response_to`
- `created_from_run_id`
- `created_from_action_id`
- `created_at`

Use this for decision package to mission/task/checkpoint links, conversation to created work, review to prior decision, and draft to task.

## Dynamic Mission Engine

### `mission_patterns`

Stable pattern family.

Fields:

- `id`
- `pattern_key`
- `name`
- `management_domains`
- `status`
- `current_version_id`
- `created_at`
- `updated_at`

### `mission_pattern_versions`

Versioned adaptable playbooks.

Fields:

- `id`
- `mission_pattern_id`
- `version`
- `description`
- `when_to_use`
- `likely_agent_keys`
- `artist_specific_inputs_required`
- `evidence_needs`
- `common_task_types`
- `checkpoint_questions`
- `permission_boundaries`
- `review_triggers`
- `success_state`
- `blockage_state`
- `change_conditions`
- `created_at`

### `missions`

Dynamic operating objectives.

Fields:

- `id`
- `account_id`
- `artist_workspace_id`
- `artist_id`
- `title`
- `objective`
- `reason`
- `status`: `candidate`, `active`, `blocked`, `review`, `paused`, `complete`, `archived`, `cancelled`
- `priority`
- `progress`
- `health`
- `summary`
- `pattern_id`
- `pattern_version_id`
- `pattern_name`
- `pattern_confidence`
- `originating_trigger`
- `originating_run_id`
- `originating_report_id`
- `originating_conversation_id`
- `required_evidence`
- `missing_evidence`
- `current_recommendation`
- `change_conditions`
- `review_point`
- `active_plan_version_id`
- `archived_at`
- `created_from_run_id`
- `created_from_action_id`
- `created_at`
- `updated_at`

Only Manager synthesis creates or updates missions.

### `mission_subject_links`

Links a mission to the object or objects it is about.

Fields:

- `id`
- `account_id`
- `artist_workspace_id`
- `artist_id`
- `mission_id`
- `artist_object_id`
- `relationship`: `primary_subject`, `supporting_subject`, `blocked_by`, `evidence_target`, `permission_target`
- `created_from_run_id`
- `created_from_action_id`
- `created_at`

Use this instead of adding mission-type-specific foreign keys such as `release_id`, `market_id`, `campaign_id`, or `rights_package_id` to `missions`.

### `mission_plan_versions`

Generated task/checkpoint relationship map.

Fields:

- `id`
- `account_id`
- `artist_workspace_id`
- `artist_id`
- `mission_id`
- `version`
- `status`: `draft`, `active`, `superseded`, `archived`
- `generated_from_run_id`
- `generated_from_action_id`
- `pattern_id`
- `pattern_version_id`
- `summary`
- `superseded_by_plan_id`
- `superseded_at`
- `created_at`

### `mission_plan_checkpoints`

Checkpoint order inside a plan.

Fields:

- `id`
- `account_id`
- `artist_workspace_id`
- `artist_id`
- `mission_plan_version_id`
- `mission_id`
- `checkpoint_id`
- `order_index`
- `phase_label`
- `unlock_rule`
- `blocked_reason`
- `created_at`

### `checkpoint_dependencies`

Checkpoint dependency graph.

Fields:

- `id`
- `account_id`
- `artist_workspace_id`
- `artist_id`
- `mission_id`
- `mission_plan_version_id`
- `checkpoint_id`
- `depends_on_checkpoint_id`
- `dependency_type`: `requires_met`, `requires_review`, `requires_not_blocked`, `informational`
- `created_at`

### `task_dependencies`

Task dependency graph.

Fields:

- `id`
- `account_id`
- `artist_workspace_id`
- `artist_id`
- `mission_id`
- `mission_plan_version_id`
- `task_id`
- `depends_on_task_id`
- `depends_on_checkpoint_id`
- `dependency_type`
- `created_at`

## Tasks And Checkpoints

### `tasks`

Human/team/integration action records.

Fields:

- `id`
- `account_id`
- `artist_workspace_id`
- `artist_id`
- `scope`: `mission`, `setup_source`
- `mission_id`
- `mission_plan_version_id`
- `primary_checkpoint_id`
- `title`
- `owner_role`
- `deadline`
- `priority`
- `status`: `proposed`, `open`, `needs_approval`, `approved`, `in_progress`, `blocked`, `completed`, `rejected`, `missed`, `archived`, `superseded`
- `approval_state`: `not_required`, `needs_approval`, `approved`, `rejected`, `blocked`
- `purpose`
- `dependency`
- `evidence_needed`
- `completion_expectation`
- `risk_if_late`
- `risk_if_skipped`
- `created_from_run_id`
- `created_from_action_id`
- `created_at`
- `updated_at`
- `archived_at`

Tasks normally require a mission and primary checkpoint. Setup/source tasks may be outside a mission only when `scope = setup_source`.

### `task_steps`

Plain-language task steps.

Fields:

- `id`
- `account_id`
- `artist_workspace_id`
- `artist_id`
- `task_id`
- `order_index`
- `body`
- `created_at`

### `task_state_events`

Append-only task state changes.

Fields:

- `id`
- `account_id`
- `artist_workspace_id`
- `artist_id`
- `task_id`
- `mission_id`
- `checkpoint_id`
- `event_type`
- `from_status`
- `to_status`
- `actor_type`
- `actor_id`
- `reason`
- `payload`
- `created_from_run_id`
- `created_from_action_id`
- `created_at`

### `task_results`

Append-only task outcome and Manager interpretation.

Fields:

- `id`
- `account_id`
- `artist_workspace_id`
- `artist_id`
- `task_id`
- `mission_id`
- `checkpoint_id`
- `status`: `completed`, `blocked`, `rejected`, `revised`, `missed`, `superseded`
- `user_note`
- `raw_event`
- `summary`
- `manager_interpretation`
- `mission_effect`
- `checkpoint_effect`
- `downstream_effect`
- `recommended_follow_up`
- `confidence`
- `created_from_run_id`
- `created_from_action_id`
- `created_at`

### `checkpoints`

AI-owned mission questions.

Fields:

- `id`
- `account_id`
- `artist_workspace_id`
- `artist_id`
- `mission_id`
- `mission_plan_version_id`
- `title`
- `status`: `waiting`, `blocked`, `ready_for_manager_check`, `watching_signal`, `needs_revision`, `met`, `skipped`
- `question`
- `reason_for_checkpoint`
- `watched_signals`
- `decision_rule`
- `recommendation`
- `next_action`
- `blocked_reason`
- `dependency_impact`
- `required_evidence`
- `missing_evidence`
- `generated_from_pattern_id`
- `custom_reason`
- `created_from_run_id`
- `created_from_action_id`
- `created_at`
- `updated_at`

### `checkpoint_state_events`

Append-only checkpoint state changes.

Fields:

- `id`
- `account_id`
- `artist_workspace_id`
- `artist_id`
- `checkpoint_id`
- `mission_id`
- `mission_plan_version_id`
- `from_status`
- `to_status`
- `reason`
- `task_result_id`
- `review_id`
- `created_from_run_id`
- `created_from_action_id`
- `created_at`

### `checkpoint_results`

Append-only checkpoint interpretations.

Fields:

- `id`
- `account_id`
- `artist_workspace_id`
- `artist_id`
- `checkpoint_id`
- `mission_id`
- `mission_plan_version_id`
- `result_summary`
- `measured_signals`
- `threshold_read`
- `recommendation`: `continue`, `modify`, `stop`, `wait`, `replace_path`, `create_new_mission`
- `confidence`
- `created_from_run_id`
- `created_from_action_id`
- `created_at`

Evidence is linked through `evidence_links`.

## Reviews, Permissions, Drafts

### `reviews`

Append-only recommendation comparison.

Fields:

- `id`
- `account_id`
- `artist_workspace_id`
- `artist_id`
- `mission_id`
- `checkpoint_id`
- `decision_package_id`
- `trigger_type`
- `trigger_object_type`
- `trigger_object_id`
- `previous_recommendation`
- `current_read`
- `what_changed`
- `what_did_not_change`
- `recommendation_changed`
- `outcome`
- `next_action`
- `status`: `scheduled`, `due`, `running`, `completed`, `snoozed`, `cancelled`
- `review_at`
- `snoozed_until`
- `quality_gate_result_id`
- `created_from_run_id`
- `created_from_action_id`
- `created_at`

### `permission_requests`

Approval boundary records.

Fields:

- `id`
- `account_id`
- `artist_workspace_id`
- `artist_id`
- `mission_id`
- `task_id`
- `checkpoint_id`
- `draft_id`
- `decision_package_id`
- `request_type`: `spend`, `external_outreach`, `submission`, `publish`, `schedule`, `release_plan_change`, `legal_finance_rights`, `sensitive_commitment`, `draft_export`, `source_connection`
- `title`
- `body`
- `risk`
- `parameters`
- `status`: `pending`, `approved`, `rejected`, `edited`, `expired`, `revoked`, `superseded`
- `expires_at`
- `created_from_run_id`
- `created_from_action_id`
- `created_at`
- `updated_at`

### `permission_decisions`

Append-only approval/rejection history.

Fields:

- `id`
- `account_id`
- `artist_workspace_id`
- `artist_id`
- `permission_request_id`
- `decision`: `approved`, `rejected`, `edited`, `revoked`, `expired`
- `decided_by_user_id`
- `decision_note`
- `edited_parameters`
- `created_at`

### `work_drafts`

Generated work products requiring review.

Fields:

- `id`
- `account_id`
- `artist_workspace_id`
- `artist_id`
- `mission_id`
- `task_id`
- `decision_package_id`
- `draft_type`
- `title`
- `status`: `draft`, `ready_for_review`, `approved`, `rejected`, `revised`, `sent_or_exported`, `archived`
- `current_version_id`
- `created_from_run_id`
- `created_from_action_id`
- `created_at`
- `updated_at`

### `work_draft_versions`

Versioned draft bodies.

Fields:

- `id`
- `account_id`
- `artist_workspace_id`
- `artist_id`
- `work_draft_id`
- `version`
- `title`
- `body`
- `change_reason`
- `created_by_type`
- `created_by_id`
- `created_from_run_id`
- `created_from_action_id`
- `created_at`

## Memory And Learning

### `memory_entries`

Append-only interpreted memory.

Fields:

- `id`
- `account_id`
- `artist_workspace_id`
- `artist_id`
- `mission_id`
- `conversation_id`
- `task_id`
- `checkpoint_id`
- `source_connection_id`
- `agent_run_id`
- `scope`: `artist`, `mission`, `conversation`, `task`, `checkpoint`, `source`, `run`
- `kind`: `fact`, `interpretation`, `preference`, `constraint`, `risk`, `blocker`, `hypothesis`, `rejected_move`, `outcome_note`, `open_question`
- `content`
- `source_type`
- `source_id`
- `operating_event_id`
- `confidence`
- `mission_pattern_key`
- `reason`
- `supersedes_memory_entry_id`
- `created_from_run_id`
- `created_from_action_id`
- `created_at`

### `memory_summaries`

Generated readable or AI-readable rollups.

Fields:

- `id`
- `account_id`
- `artist_workspace_id`
- `artist_id`
- `mission_id`
- `conversation_id`
- `scope`: `artist`, `mission`, `conversation`
- `version`
- `summary`
- `source_memory_entry_ids`
- `source_operating_event_ids`
- `generated_from_run_id`
- `status`: `current`, `stale`, `superseded`, `regenerated`
- `created_at`
- `superseded_at`

### `outcome_observations`

Append-only comparison of expected and observed results.

Fields:

- `id`
- `account_id`
- `artist_workspace_id`
- `artist_id`
- `mission_id`
- `checkpoint_id`
- `task_id`
- `decision_package_id`
- `agent_report_id`
- `recommendation_ref`
- `expected_outcome`
- `review_window_start`
- `review_window_end`
- `watched_signals`
- `observed_signals`
- `outcome_class`: `helped`, `hurt`, `reduced_uncertainty`, `inconclusive`, `no_material_change`
- `status`: `pending_evidence`, `observed`, `inconclusive`, `superseded_by_later_evidence`
- `confidence`
- `confounders`
- `causal_limitation`
- `learning_note`
- `eligible_for_pattern_learning`
- `created_from_run_id`
- `created_from_action_id`
- `created_at`

Do not create `pattern_outcomes` in the first V1 migration. Cross-artist aggregate learning should wait until there are enough artists, enough outcome observations, and an explicit privacy policy. V1 should record artist-scoped `outcome_observations`; aggregate `pattern_outcomes` can be added later without changing the core operating schema.

## UI Projections

Do not create persisted read-model tables in the first V1 migration.

Build these as API response shapes, SQL views, or materialized views only after profiling shows the source queries are too slow:

- Label HQ projection: current brief, directive, active missions, flagged items, recent movement, and staff readiness.
- Mission projection: selected mission, active plan, task counts, checkpoint counts, notes, review summary, and memory summary.
- Staff readiness projection: agent profile plus source connection/readiness status.
- Conversation projection: thread summary, latest message, and linked artifacts.

Projection rule: if a field matters for audit, memory, evidence, or future Manager behavior, it must live in a source-of-truth table above, not only in a projection payload.

## Prototype Mapping

The current prototype constants map to schema records as follows:

| Prototype source | Database home |
| --- | --- |
| `artist` | `artists`, `artist_profiles`, `artist_profile_versions`, `artist_objects` for active focus objects such as Night Bus |
| `musicObjects` | `artist_objects`, `artist_object_identifiers`, `artist_object_assets`, `artist_object_relationships`, `mission_subject_links` |
| `agents` | `agent_profiles`, `source_capabilities`, `source_connections`; staff readiness is a projection |
| `managerQuestions` | `manager_context_questions`, `manager_context_answers` |
| `baseConversations` | `conversations`, `conversation_messages`, `artifact_links` |
| `baseMissions` | `missions`, `mission_subject_links`; mission workspace state is a projection |
| `taskRows` | `tasks`, `task_steps`, `task_dependencies`, `evidence_links` |
| `missionCheckpoints` | `checkpoints`, `mission_plan_checkpoints`, `checkpoint_dependencies` |
| `departmentBriefs` | `agent_notes`, `agent_inbox_items`, `evidence_links` |
| `evidence` | `source_snapshots`, `evidence_items` |
| `decisionRecord` | `decision_packages`, `memory_summaries`, `artifact_links` |
| `missionReview` | `reviews` |
| `taskResults` | `task_results`, `task_state_events`, `checkpoint_state_events` |
| `missionEvents` | `operating_events` |
| `workDrafts` | `work_drafts`, `work_draft_versions` |
| `approvedTasks` | `permission_requests`, `permission_decisions`, `task_state_events` |
| `completedTasks` | `task_state_events`, `task_results` |
| `testCheckpoint` | `checkpoint_state_events`, `checkpoint_results`; mission progress is a projection |

## Workflow Write Paths

### Setup

1. Create or load artist workspace.
2. Resolve Spotify identity.
3. Write artist profile and profile version.
4. Create source connections/readiness records.
5. Create initial memory entries for durable user-supplied context.
6. Create operating events for setup completion and source readiness.

### Daily Brief

1. Manager synthesis run loads profile, memory, missions, tasks, checkpoints, reviews, reports, evidence, permissions, and recent events.
2. Run validates every visible claim against evidence capability.
3. Create operating directive.
4. Create daily brief snapshot.
5. Create or update flagged items.
6. Return or refresh the Label HQ projection from source records.

### Manager Conversation

1. Store user message.
2. Create Manager synthesis run with `steps_payload` for the investigation UI.
3. Persist action plan as manager run actions.
4. Validate proposed writes against state, evidence, and permission rules.
5. Apply safe internal writes.
6. Create permission requests for approval-gated actions.
7. Store Manager response and linked artifacts.
8. Create operating events, memory entries, reviews, and refresh affected UI projections.

### Mission Creation Or Update

1. Manager synthesis detects objective, risk, opportunity, or existing mission update.
2. Select/adapt mission pattern.
3. Create/update mission.
4. Create mission plan version.
5. Create checkpoints and tasks.
6. Create dependency records.
7. Link evidence, limitations, reports, conversations, and source requests.
8. Create notes, memory seed, permission requests, reviews, and operating events.

### Task Completion Or Blockage

1. Validate task transition.
2. Create task state event.
3. Create task result with raw note and Manager interpretation.
4. Update linked checkpoint through checkpoint event/result.
5. Trigger review if recommendation may change.
6. Append mission memory.
7. Return or refresh the mission projection.

### Permission Decision

1. Create permission decision.
2. Update permission request status.
3. Create task state event or draft state change if applicable.
4. Create operating event.
5. Trigger Manager synthesis or review when approval/rejection changes the plan.

## State Rules

Use these lifecycle enums from `state-machine-contract.md`:

- runs: `queued`, `running`, `needs_context`, `completed`, `completed_with_limits`, `failed`, `cancelled`
- missions: `candidate`, `active`, `blocked`, `review`, `paused`, `complete`, `archived`, `cancelled`
- mission plans: `draft`, `active`, `superseded`, `archived`
- checkpoints: `waiting`, `blocked`, `ready_for_manager_check`, `watching_signal`, `needs_revision`, `met`, `skipped`
- tasks: `proposed`, `open`, `needs_approval`, `approved`, `in_progress`, `blocked`, `completed`, `rejected`, `missed`, `archived`, `superseded`
- permissions: `pending`, `approved`, `rejected`, `edited`, `expired`, `revoked`, `superseded`
- drafts: `draft`, `ready_for_review`, `approved`, `rejected`, `revised`, `sent_or_exported`, `archived`
- reviews: `scheduled`, `due`, `running`, `completed`, `snoozed`, `cancelled`

Implementation must reject invalid transitions instead of silently coercing them.

## Supabase Security Notes

Minimum RLS expectations:

- Users can read/write only rows where they belong to the row's `account_id`.
- Artist-scoped reads require membership in the owning account.
- Admin/support access must be separate and auditable.
- Provider credentials are server-only.
- Uploaded files require account and artist ownership checks.
- Raw snapshots may be hidden from normal client reads unless needed for an evidence drawer or admin/debug view.
- Do not ship cross-artist aggregate pattern outcomes until the product has enough data and an explicit privacy policy.

## Acceptance Tests

Before backend implementation is accepted:

- Seed Sable Day and the Night Bus prototype from database records only.
- Reconstruct Label HQ, Today's Brief, Staff readiness, Manager Office, Conversation Workspace, Investigation, Decision Package, Missions, Tasks, Checkpoints, Notes, Mission Memory, Review, Evidence Drawer, and Work Draft Drawer without hardcoded UI data.
- Prove every visible metric, geography, timestamp, source line, warning, and recommendation links to evidence, memory, report, event, user input, or explicit limitation.
- Prove every button that writes state creates an auditable record.
- Prove every Manager-created artifact links to `manager_synthesis_runs` and `manager_run_actions`.
- Reject unsupported private analytics, revenue, rights certainty, conversion, geography, and causation claims.
- Reject invalid task, checkpoint, mission, permission, draft, review, and run transitions.
- Verify task completion creates a task state event, task result, checkpoint update, mission memory entry, and review when needed.
- Verify permission-gated tasks cannot complete or execute externally before approval.
- Verify memory summaries can be regenerated from operating events and memory entries.
- Verify RLS blocks access to another account's artist workspace.

## Seed Data Required For Prototype Parity

The first seed set should include:

- one account and user
- one Sable Day artist workspace
- current artist profile and profile version
- Spotify, TikTok, YouTube, rights, distributor, and artist-reply source records
- evidence items matching `EV-TTK-0426`, `EV-YT-1190`, `EV-SP-3302`, `EV-ART-0007`, `EV-RGT-0612`, and `EV-DSP-0612`
- agent profiles for Manager, Marketing Lead, Sync & Deals, Touring Agent, and Finance/Rights
- Manager context questions
- Night Bus artist object and release-planning mission
- mission subject link from the Night Bus mission to the Night Bus artist object
- release-planning mission pattern version
- active mission plan version with five checkpoint phases
- all prototype tasks and task steps
- task results for positioning, split sheet, and Spotify pitch
- agent notes shown in Notes
- mission review and mission memory summary
- operating events shown in Mission log and Recent Movement
- work drafts for creator brief, team recap, and DSP pitch note
- recent conversations and linked work artifacts

Night Bus seed data is demo content. It must not become release-specific infrastructure.

## Non-Goals For V1 Schema

Do not add:

- enterprise RBAC
- generic BI dashboard tables
- a global evidence dashboard model
- hard-coded release-only task/checkpoint tables
- direct external execution without permission records
- cross-artist private learning
- complex event sourcing beyond the append-only records named here

The schema should be deep enough to preserve trust and learning, but not so abstract that V1 cannot ship.
