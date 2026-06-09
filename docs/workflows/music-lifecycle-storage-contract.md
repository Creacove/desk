# Music Lifecycle And Storage Contract

Purpose: define the first-class Music domain for V1. Music is the durable home for recorded work: songs, demos, released tracks, catalog tracks, projects, files, rights, splits, distribution readiness, Manager reads, linked missions, and song/project history.

This contract replaces the earlier idea that songs and music projects are only generic `artist_objects`. Non-music operating subjects can still use `artist_objects`, but recorded music needs its own tables because the product reads and writes song/project state across Manager runs, specialist reports, missions, tasks, checkpoints, evidence, memory, split confirmation, and distribution.

## Core Rules

- A song, demo, released track, or catalog track is a `music_item`.
- An EP, album, single release container, mixtape, compilation, deluxe, or unreleased body of work is a `music_project`.
- A project contains songs through `music_project_items`; it must not duplicate song-level lifecycle, assets, rights, identifiers, evidence, or blockers.
- Music state is durable product state, not proof by itself. Claims still require evidence, source snapshots, user input, memory, or explicit limitations.
- Every dynamic Music value in the prototype must trace through `docs/workflows/prototype-data-lineage-contract.md` to Music records, producer workflow, provenance, evidence or limitation, and usage/cost events when AI/provider work was used.
- Music can influence missions, tasks, checkpoints, agent reports, Manager decisions, and memory, but it does not create a separate Music task system.
- External, financial, legal, public, distributor, sync, or rights-affecting actions require permission.
- Manager and agent suggestions may recommend Music changes, but user-visible lifecycle, rights, or public release changes require user action, trusted integration confirmation, or approved workflow.
- Readiness counts and project blockers are projections from linked songs, assets, identifiers, credits, splits, distribution packages, evidence, and mission links. Do not persist duplicate readiness text unless an exact historical snapshot is needed.
- V1 Music should feel like one simple workspace to the user: songs, projects, files, details, rights, linked work, and distribution readiness. Keep specialist complexity in workflow records and evidence, not in extra visible Music sub-products.

## Schema

### `music_items`

Atomic recorded work.

Fields:

- `id`
- `account_id`
- `artist_workspace_id`
- `artist_id`
- `title`
- `item_type`: `song`, `demo`, `released_track`, `catalog_track`, `alternate_version`
- `lifecycle_stage`: `idea`, `recording`, `production`, `mixing`, `mastering`, `ready`, `scheduled`, `released`, `catalog`, `archived`
- `status`
- `is_active_focus`
- `manager_read`
- `manager_next_move`
- `manager_stage_suggestion`
- `blocker`
- `rights_state`
- `source_kind`
- `source_limit`
- `planned_release_date`
- `released_at`
- `metadata`
- `created_by_type`
- `created_by_id`
- `created_from_run_id`
- `created_from_action_id`
- `created_at`
- `updated_at`

Use `metadata` only for type-specific details that are not yet worth first-class fields. Do not hide identifiers, files, credits, splits, project membership, evidence, or mission links inside metadata.

### `music_projects`

Containers for music releases or bodies of work.

Fields:

- `id`
- `account_id`
- `artist_workspace_id`
- `artist_id`
- `title`
- `project_type`: `single`, `ep`, `album`, `mixtape`, `compilation`, `deluxe`, `unreleased_body`, `other`
- `lifecycle_stage`: `idea`, `recording`, `production`, `mixing`, `mastering`, `ready`, `scheduled`, `released`, `catalog`, `archived`
- `status`
- `is_active_focus`
- `manager_read`
- `manager_next_move`
- `blocker`
- `source_kind`
- `source_limit`
- `planned_release_date`
- `released_at`
- `metadata`
- `created_by_type`
- `created_by_id`
- `created_from_run_id`
- `created_from_action_id`
- `created_at`
- `updated_at`

Project readiness is a rollup from linked songs plus project-level assets and metadata. Do not copy song splits, file state, identifiers, or lifecycle state into the project.

### `music_project_items`

Ordered project tracklist membership.

Fields:

- `id`
- `account_id`
- `artist_workspace_id`
- `artist_id`
- `music_project_id`
- `music_item_id`
- `order_index`
- `disc_number`
- `display_title`
- `relationship`: `contains_track`, `lead_single`, `bonus_track`, `alternate_version`
- `created_from_run_id`
- `created_from_action_id`
- `created_at`

### `music_assets`

Files or materials attached to a song or project.

Fields:

- `id`
- `account_id`
- `artist_workspace_id`
- `artist_id`
- `music_item_id`
- `music_project_id`
- `asset_type`: `demo`, `rough_mix`, `final_master`, `clean_version`, `instrumental`, `stems`, `cover_art`, `alternate_artwork`, `metadata_export`, `split_sheet`, `pitch_asset`, `lyrics`, `epk`, `press_photo`, `royalty_statement`, `distributor_export`, `campaign_report`, `other`
- `title`
- `uploaded_file_id`
- `status`: `missing`, `draft`, `uploaded`, `confirmed`, `replaced`, `revoked`, `failed`
- `version_label`
- `notes`
- `source_snapshot_id`
- `created_by_type`
- `created_by_id`
- `created_from_run_id`
- `created_from_action_id`
- `created_at`
- `updated_at`

Use one table for asset types. Do not create separate V1 tables for masters, artwork, stems, split sheets, or pitch assets.

### `music_identifiers`

Provider, catalog, and business identifiers.

Fields:

- `id`
- `account_id`
- `artist_workspace_id`
- `artist_id`
- `music_item_id`
- `music_project_id`
- `identifier_type`: `isrc`, `upc`, `spotify_track_id`, `spotify_album_id`, `apple_music_id`, `youtube_video_id`, `tiktok_sound_id`, `distributor_id`, `chartmetric_id`, `soundcharts_id`, `custom`
- `identifier_value`
- `provider_id`
- `source_snapshot_id`
- `confidence`
- `created_from_run_id`
- `created_at`

### `music_credits`

Song/project credit facts.

Fields:

- `id`
- `account_id`
- `artist_workspace_id`
- `artist_id`
- `music_item_id`
- `music_project_id`
- `role`: `primary_artist`, `featured_artist`, `writer`, `producer`, `mix_engineer`, `mastering_engineer`, `publisher`, `label`, `other`
- `name`
- `status`: `missing`, `draft`, `confirmed`, `disputed`, `superseded`
- `source_snapshot_id`
- `created_by_type`
- `created_by_id`
- `created_from_run_id`
- `created_from_action_id`
- `created_at`
- `updated_at`

### `music_splits`

Split proposal or confirmed split package for one song.

Fields:

- `id`
- `account_id`
- `artist_workspace_id`
- `artist_id`
- `music_item_id`
- `status`: `missing`, `draft`, `pending_confirmation`, `partially_confirmed`, `cleared`, `disputed`, `superseded`, `revoked`
- `summary`
- `publishing_total`
- `master_total`
- `document_asset_id`
- `source_snapshot_id`
- `linked_task_id`
- `created_by_type`
- `created_by_id`
- `created_from_run_id`
- `created_from_action_id`
- `created_at`
- `updated_at`

The system can use split state for readiness and risk. It must not present legal certainty without human/legal review.

### `music_split_contributors`

Proposed or confirmed contributor shares.

Fields:

- `id`
- `account_id`
- `artist_workspace_id`
- `artist_id`
- `music_split_id`
- `name`
- `role`
- `email`
- `publishing_share`
- `master_share`
- `approval_status`: `draft`, `pending`, `confirmed`, `rejected`, `disputed`, `revoked`
- `created_at`
- `updated_at`

### `music_split_confirmations`

External confirmation records from collaborators.

Fields:

- `id`
- `account_id`
- `artist_workspace_id`
- `artist_id`
- `music_split_id`
- `music_split_contributor_id`
- `confirmation_token_hash`
- `status`: `created`, `sent`, `opened`, `confirmed`, `rejected`, `expired`, `revoked`, `superseded`
- `confirmed_at`
- `rejected_at`
- `expires_at`
- `ip_hash`
- `user_agent_hash`
- `confirmation_text`
- `created_from_run_id`
- `created_from_action_id`
- `created_at`
- `updated_at`

External confirmation links must expose only the relevant split proposal for the invited contributor. They must not expose the broader artist workspace, unrelated songs, missions, conversations, evidence, or financial records.

### `music_distribution_packages`

Distribution package readiness and submission state.

Fields:

- `id`
- `account_id`
- `artist_workspace_id`
- `artist_id`
- `music_item_id`
- `music_project_id`
- `provider_id`
- `status`: `draft`, `blocked`, `ready_for_approval`, `approved`, `submitting`, `submitted`, `accepted`, `failed`, `cancelled`, `superseded`
- `planned_release_date`
- `required_asset_state`
- `required_rights_state`
- `metadata_payload`
- `permission_request_id`
- `created_from_run_id`
- `created_from_action_id`
- `created_at`
- `updated_at`

Distribution initiation is a V1 target workflow, but it is approval-gated and provider-adapter based. Do not treat package creation as provider acceptance.

### `music_distribution_events`

Append-only provider submission and readiness events.

Fields:

- `id`
- `account_id`
- `artist_workspace_id`
- `artist_id`
- `music_distribution_package_id`
- `event_type`: `readiness_checked`, `approval_requested`, `approved`, `submission_started`, `provider_log`, `submitted`, `accepted`, `failed`, `cancelled`
- `status`
- `message`
- `provider_ref`
- `payload`
- `created_from_run_id`
- `created_from_action_id`
- `created_at`

### `music_events`

Optional Music-specific event view. V1 may store these as `operating_events` with `target_type = music_item|music_project|music_asset|music_split|music_distribution_package`. Create a separate table only if Music timeline queries become heavy.

## Links To The Operating System

- `mission_subject_links` can link a mission to `music_item` or `music_project`, or to a non-music `artist_object`.
- `evidence_items.subject_type` may be `music_item`, `music_project`, `music_asset`, `music_split`, or `music_distribution_package`.
- `artifact_links` can link conversations, decisions, drafts, reviews, agent notes, and permissions to Music records.
- `memory_entries.scope` can be `music_item` or `music_project` when the lesson should be retrieved for future song/project decisions.
- `agent_reports` can reference Music records through `artifact_links` and `evidence_links`; specialist reports do not directly mutate mission state.
- Manager synthesis decides whether Music changes create or update missions, tasks, checkpoints, reviews, memory, permissions, or source requests.

## Manager And Agent Retrieval

Before making a song/project decision, Manager synthesis should retrieve:

- artist profile and artist operating memory
- relevant `music_items` and `music_projects`
- lifecycle, source limits, Manager read, blocker, and next move
- assets, identifiers, credits, splits, confirmations, and distribution packages
- linked missions, tasks, checkpoints, reviews, decisions, and permissions
- evidence and source snapshots for claim-bearing facts
- recent Music-scoped events and memory entries
- specialist reports and notes relevant to the song/project

Specialist agents read the same Music source of truth through their role:

- Marketing reads focus song, hook/story context, assets, campaign readiness, public/private source limits, and linked campaign missions.
- Sync & Deals reads rights, clean/instrumental files, pitch assets, metadata, approved availability, and deal/sync permissions.
- Finance/Rights reads splits, royalty statements, ownership documents, metadata, distributor exports, and payout evidence.
- Touring may read Music signal as context, but must not infer live demand without geography, ticketing, live history, promoter, or venue evidence.

## Write Contracts Summary

- Create/edit song or project: write Music record, operating event, and memory only when future behavior changes.
- Upload/replace asset: write `uploaded_files`, `source_snapshots` where needed, `music_assets`, evidence when normalized, and operating event.
- Update metadata/credits/identifiers: write typed Music records and operating event; create evidence links when source-backed.
- Create split proposal: write `music_splits`, contributors, operating event, and a permission request if confirmation links will be sent.
- Send split confirmation links: write confirmation rows, permission decision where applicable, operating event, and scoped external access state.
- Confirm contributor split externally: update confirmation and contributor state, recompute split status, create operating event, and trigger mission/checkpoint review if release readiness changes.
- Build distribution package: write package and readiness event; block if required assets, rights, metadata, or permission are missing.
- Initiate distribution: requires approved permission; write package status, distribution events, provider logs, operating events, and review triggers.
- Save Music run/history: write agent/Manager run outputs through reports, evidence links, artifact links, memory entries, and operating events.

## Failure And Safety Rules

- Duplicate provider matches create candidate records or ambiguous source requests; do not merge automatically.
- Missing private analytics lowers confidence; it does not block browsing Music.
- Missing split totals, missing collaborator confirmation, missing final master, or missing artwork blocks distribution readiness.
- Contributor confirmation links can expire, be revoked, or be superseded.
- Distribution provider failure must preserve the package and event log; do not silently mark the song released.
- A manually changed lifecycle stage must create an event. AI suggestions must remain suggestions until accepted.
- Rights and finance reads must state source limits and avoid legal/accounting finality.

## Acceptance Checks

- Every visible Music workspace element maps to a Music table or linked operating artifact.
- Music projects roll up state from linked songs instead of duplicating song state.
- Manager decisions can use saved Music state and freshness before deciding whether a source refresh is needed.
- Every Music write has provenance, audit trail, failure state, and permission boundary.
- Split links are scoped, revocable, auditable, and limited to the invited proposal.
- Distribution is approval-gated and provider-confirmed; package creation is not treated as release success.
