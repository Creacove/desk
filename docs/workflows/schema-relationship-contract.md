# Schema Relationship Contract

Purpose: define required entity relationships, ownership, cardinality, and lifecycle anchors for implementation. This contract supports the V1 operational database schema in `future-schema-notes.md`.

## Core Rules

- One V1 workspace is scoped to one active artist.
- Every AI write must link to the run that produced it.
- Every claim-bearing output must link to evidence, memory, user input, or an explicit limitation.
- Every mission must have a current mission plan.
- Every task must have one primary checkpoint owner.
- Every permission-gated execution must have a permission request.
- Specialist agents may create reports and notes; only Manager synthesis creates or updates missions.
- Memory summaries are derived views; append-only events, memory entries, and outcome observations remain the learning source of truth.

## Entity Relationships

| Entity | Required parent | Cardinality | Required links |
| --- | --- | --- | --- |
| `artists` | none | root | profile, conversations, missions, sources |
| `artist_profiles` | artist | one current profile per artist | artist, updated_by |
| `artist_objects` | artist | many per artist | object type, status, optional source snapshot |
| `artist_object_identifiers` | artist object | many per object | provider identifier, confidence, optional source snapshot |
| `artist_object_assets` | artist object | many per object | uploaded file or asset record, asset type, status |
| `artist_object_relationships` | artist objects | many per object | from object, to object, relationship, optional order |
| `source_connections` | artist | many per artist | source, status, capability limits |
| `source_snapshots` | artist/source | many per source | connection/source, captured_at, raw_ref |
| `evidence_items` | artist | many per artist | source or user input, provenance, confidence, limitation |
| `operating_events` | artist | many per artist | event type, actor, target, created_at |
| `agent_runs` | artist | many per artist | agent, trigger_type, source refs |
| `agent_reports` | agent_run | one or more per run | evidence ids, missing evidence, limitations |
| `manager_synthesis_runs` | artist | many per artist | trigger, context refs, input reports |
| `manager_run_actions` | synthesis_run | many per run | action type, target, status |
| `operating_directives` | synthesis_run | zero or more per run | artist, optional mission, evidence |
| `conversations` | artist | many per artist | messages, optional linked mission |
| `conversation_messages` | conversation | many per conversation | speaker, body, optional run |
| `decision_packages` | synthesis_run | zero or more per run | recommendation, evidence, linked work |
| `mission_patterns` | system | reusable | version, evidence needs, checkpoint types |
| `missions` | artist | many per artist | pattern, origin trigger, current recommendation; optional subject links |
| `mission_subject_links` | mission | zero or more per mission | optional artist object subjects such as song, project, market, rights package, or source gap |
| `mission_plans` | mission | versioned; one active | pattern, generated_from_run |
| `mission_plan_checkpoints` | mission_plan | many per plan | checkpoint, order, dependencies |
| `checkpoints` | mission_plan/mission | many per mission | question, decision rule, required tasks |
| `tasks` | mission/checkpoint | many per checkpoint | primary checkpoint, owner, approval state |
| `task_state_events` | task | append-only | event type, actor, reason |
| `task_results` | task | many over time | user note or integration event, interpretation |
| `agent_notes` | run/report/mission | many | sender, recipient, subject, resulting change |
| `agent_inbox_items` | note | many | target agent, consume mode, status |
| `memory_entries` | artist/mission/conversation | many | scope, source object, confidence |
| `memory_summaries` | artist/mission/conversation | versioned; one current per scope | source memory/events, generated_from_run |
| `outcome_observations` | recommendation/task/checkpoint/mission | many | expected outcome, observed signals, confounders |
| `pattern_outcomes` | system aggregate | many | segment attributes, privacy level, sample count |
| `reviews` | mission/checkpoint/decision | many | trigger, previous read, current read |
| `permission_requests` | action/task/draft/mission | many | request type, status, decided_by |
| `work_drafts` | artist/mission/task | many | draft type, status, version |
| `specialist_referrals` | artist/mission | many | source agent, target agent, question |

## Required Foreign-Key Behavior

- Deleting is not a normal product behavior for operating records. Prefer archive, supersede, cancel, or revoke states.
- Historical messages, source snapshots, evidence items, operating events, task state events, task results, agent reports, reviews, permission decisions, memory entries, and outcome observations are append-only.
- A mission can be archived, but its plans, tasks, checkpoints, notes, memory, and reviews remain readable.
- A task can be archived or superseded, but its result history remains attached to mission memory.
- A permission request can be approved, rejected, expired, revoked, or superseded, but not erased.
- Memory summaries can be superseded or regenerated, but not used as the only source of operational truth.
- Pattern outcomes must be aggregate or privacy-safe; they cannot expose another artist's private strategy, unreleased data, rights/finance records, or sensitive context.

## Ownership Rules

- User/team owns profile facts, approvals, uploads, task completion notes, and permission decisions.
- User/team owns manually entered music objects, project tracklists, uploaded assets, and corrections to object identity.
- Manager owns synthesis, mission orchestration, operating directives, reviews, and mission memory.
- Specialist agents own their runs, reports, notes, and source-readiness claims.
- Evidence service owns source snapshots and normalized evidence.
- Memory service owns operating events, memory entries, summaries, outcome observations, and pattern outcomes.
- Permission service owns execution boundary state.

## Implementation Acceptance

- Any artifact visible in the prototype must map to one entity above.
- Any record written by AI must include `created_from_run_id` or equivalent provenance.
- Any user-facing recommendation must be reconstructable from profile, memory, evidence, reports, or limitations.
- No task may exist without a mission and primary checkpoint unless it is explicitly a setup/source task outside mission scope.
- No mission may be forced to have a music subject. Music links are optional context; missions remain objective-first.
- No music project may duplicate song state. Projects link to songs through object relationships.
- Song lifecycle fields may live in artist-object metadata in V1. Stage changes can be user-set or Manager-suggested, but AI suggestions must not silently mutate the user-visible song stage.
- Audio, artwork, metadata files, split sheets, stems, clean versions, instrumentals, and pitch assets belong in `artist_object_assets`; provider catalog IDs belong in `artist_object_identifiers`.
- Project readiness should be a rollup from contained songs and project-level assets, not an independent duplicate of every song blocker.
- Any learning claim must distinguish artist-specific evidence from aggregate pattern guidance.
- Any claim that a move worked must link to outcome observations and state causal limitations.
