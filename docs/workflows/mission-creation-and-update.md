# Dynamic Mission Creation And Update Workflow

Purpose: define the generic mission engine. Missions are dynamic operating objects, not release-specific workflows.

## Trigger

Mission workflow can start from:

- Manager synthesis run
- specialist agent report
- user conversation
- source/evidence change
- task result
- checkpoint failure
- review trigger
- detected opportunity
- detected risk
- missing evidence that blocks important decisions

The Night Bus release mission in the prototype is one demo mission pattern. It must not become hard-coded infrastructure.

## Required Context

- artist profile and artist operating memory
- relevant artist objects such as songs, music projects, campaigns, markets, rights packages, pitch packages, or source gaps
- artist object relationships when the objective depends on a container or grouping, such as an EP tracklist or pitch package
- active missions and archived mission summaries
- current mission patterns/playbooks
- originating trigger and run/report/conversation context
- relevant agent reports and source limitations
- evidence items, source snapshots, and missing evidence
- related mission memory
- permission boundaries
- relevant tasks, checkpoints, notes, and reviews
- locked specialist readiness where relevant

## Source Data

Current prototype sources:

- `artist` for Sable Day profile fields
- `baseMissions` for demo mission list and summaries
- `taskRows` for one release-pattern example
- `missionCheckpoints` for one release-pattern checkpoint set
- `departmentBriefs` for notes
- `decisionRecord` and `missionReview` for memory/review
- `evidence` for normalized proof and limitations

Production sources:

- `artist_profiles`
- `artist_objects`
- `artist_object_relationships`
- `missions`
- `mission_patterns`
- `agent_reports`
- `tasks`
- `checkpoints`
- `agent_notes`
- `memory_entries`
- `decision_packages`
- `evidence_items`
- `source_snapshots`
- `permission_requests`
- `mission_plans`
- `mission_plan_versions`
- `mission_subject_links`

## Mission Pattern System

A mission pattern is an adaptable planning template. It is not a hard-coded workflow. The Manager selects, adapts, or creates a pattern based on the objective.

Each pattern defines:

- when to use it
- likely agents involved
- common evidence needs
- common task types
- common checkpoint questions and ordering
- common permission boundaries
- common review triggers
- what success looks like
- what failure or blockage looks like

Initial pattern examples:

- Release planning: rights, distributor, DSP pitch, creator, press, launch, post-release signal.
- Budget allocation: spend options, risk, signal proof, approval, holdback, review.
- Rights cleanup: split sheets, metadata, ownership notes, missing documents, legal/finance caution.
- Audience signal: content movement, comments, saves, follows, smart-link clicks, confidence level.
- Data/source completeness: source gaps, uploads, connector setup, evidence quality.
- Touring validation: city demand, live history, venue fit, routing readiness.
- Sync/deal readiness: rights clarity, pitch materials, clean assets, brand fit, deal-risk checklist.
- Campaign review: performance, spend, creative angle, source gaps, next iteration.
- Career architecture: long-term leverage, sequencing, values, do-not-do rules, and next career unlock.
- Artist positioning: audience thesis, creative lane, brand risk, long-term strategy.
- A&R/focus asset selection: song choice, creative development, collaboration fit, and catalog strategy.
- Market expansion/global breakout: local-to-global path, city/country/diaspora signal, cultural bridge strategy.
- Reputation/crisis/wellbeing: public risk, artist protection, workload, sensitive decisions, and response safety.
- Team operations: recurring work, roles, approvals, process blockers.
- Ad hoc objective: Manager-defined pattern when no existing pattern fits.

## Classification Logic

Create a new mission when all are true:

- Manager synthesis identifies a durable artist objective, risk, or opportunity.
- The work needs coordinated tasks, checkpoints, notes, memory, reviews, or permission requests.
- No active mission already covers the same objective.
- The system can state why the mission exists and what would count as progress.

Update an existing mission when any are true:

- the trigger maps to an active mission objective
- new evidence affects mission confidence, blockers, tasks, checkpoints, review, or recommendation
- an agent report adds a relevant perspective
- the user adds information about current mission work
- a task result changes readiness or direction
- a review changes or confirms the current recommendation

Do not create a mission when:

- the system only needs to answer a simple question
- the finding is too weak to justify durable work
- the objective is already covered by an active mission
- the system lacks enough information to define objective, pattern, or first useful step
- the proposed work is only external execution and needs permission before organization makes sense

## Background Steps

1. Run Manager synthesis or conversation router classification.
2. Detect objective, risk, or opportunity.
3. Search active and archived missions for semantic and structured overlap.
4. Select, adapt, or create mission pattern/playbook.
5. Define mission objective, reason it exists, originating trigger, relevant agents, required evidence, missing evidence, current recommendation, and change conditions.
5a. Link zero, one, or many artist-object subjects only when they clarify what the mission is about. Do not force a song/project link for artist-wide, market, team, positioning, source, or process missions.
5b. If the objective depends on a song lifecycle blocker, link the relevant `song` or `music_project` and reference the missing asset/identifier/state in mission context. Do not create standalone song tasks outside the mission plan; operational work should remain mission/checkpoint/task driven.
6. Generate an ordered mission plan made of checkpoint phases.
7. Generate tasks only where human/team/integration action is needed and attach each task to its primary checkpoint.
8. Generate checkpoint dependencies so later phases know which earlier checks must clear first.
9. Create notes for relevant agent handoffs.
10. Create permission requests for external, expensive, sensitive, legal, financial, reputational, or public actions.
11. Create mission memory seed and review rules.
12. Link evidence, source limitations, run/report/conversation context, and related artifacts.
13. Return mission link or updated mission state in the relevant UI.

## Mission Plan Structure

A mission plan is the generated relationship map between checkpoints and tasks. It should be visible in the UI as a path or phase list, like the prototype's mission checkpoint/task relationship, but generated dynamically per mission pattern.

Each mission plan must define:

- checkpoint order
- checkpoint dependency links
- tasks under each checkpoint
- task dependency links
- evidence required for each checkpoint
- permission requests tied to tasks or checkpoints
- what checkpoint state unlocks next work
- what happens when a task is blocked, missed, archived, or superseded

The plan should answer:

- what needs to happen first
- what can be prepared in parallel
- what is blocked by missing proof
- what is waiting for user permission
- what later work should not start yet

## Dynamic Task Rules

Tasks are generated when a human/team action or approved integration action is needed. They are not fixed release checklist items. Every task has one primary checkpoint owner, because the task result is interpreted against the checkpoint question it helps answer.

Each task must include:

- owner
- purpose
- dependency
- linked checkpoint
- evidence needed
- approval state
- expected completion result
- risk if late or skipped

Example task shapes:

- Upload Spotify for Artists export.
- Approve capped spend.
- Confirm split sheet.
- Build creator list.
- Add live history.
- Upload royalty statement.
- Approve outreach draft.
- Verify city demand source.
- Review revised positioning.

## Dynamic Checkpoint Rules

A checkpoint is an AI-owned question that determines whether the mission can continue, should change, should pause, or needs human review.

Checkpoints also serve as mission phases. A checkpoint owns the current question for that phase, and the tasks underneath it are the actions needed to answer the question. Later checkpoints can depend on earlier checkpoints, but the phase structure is generated from the mission pattern and objective.

Checkpoints are generated from:

- mission objective
- mission pattern
- required evidence
- dependencies
- risk areas
- agent reports
- prior memory
- permission boundaries

Examples:

- Release mission: "Is the release safe to distribute?"
- Budget mission: "Is there enough evidence to approve spend?"
- Rights mission: "Is ownership clear enough to proceed?"
- Touring mission: "Is city demand strong enough to test a show?"
- Data mission: "Are the required sources connected or uploaded?"

## Artifacts Created Or Updated

Create path:

- mission
- optional mission subject links
- mission pattern selection/adaptation
- mission memory entry
- mission plan / mission plan version
- tasks
- checkpoints
- operating directive or decision package when needed
- agent notes/referrals
- evidence requests
- permission requests
- review rules

Update path:

- mission status, summary, health, progress, recommendation, or review point
- task records, task state events, or task results
- checkpoint questions/states
- mission plan version when ordering, dependencies, or task/checkpoint links change
- notes
- mission memory
- reviews
- permission request state

## User-Facing Result

The user should see:

- why the mission exists
- whether it was created proactively, from conversation, from a report, or from evidence/task/review change
- selected/adapted mission pattern in plain language
- generated checkpoint phases and task groups
- generated notes/memory
- next human action or permission request
- evidence limitations
- review timing or change condition

The UI should not imply the mission is a release checklist unless the selected mission pattern is actually release planning.

## Failure And Uncertainty Handling

If a mission match is ambiguous, ask whether to update the likely mission or create a separate objective. If pattern confidence is low, create an ad hoc mission plan with a narrow first checkpoint/task group or ask a clarifying question. If evidence is missing, create an evidence request or task instead of pretending confidence is high.

If mission creation partially succeeds, show what was created and what failed. If an agent report conflicts with Manager memory, create a review rather than silently choosing one.

## Approval Boundaries

Mission creation, mission updates, task creation, checkpoint creation, notes, memory, reviews, drafts, and evidence requests are internal organization and can happen automatically when confidence is sufficient.

The system must request permission before spend, third-party contact, submissions, publication, public release-plan changes, legal/financial/rights conclusions, or sensitive commitments.

## Schema/API Implications

Mission records need fields for `pattern_id`, `pattern_name`, `pattern_confidence`, `originating_trigger`, `originating_run_id`, `originating_report_id`, `required_evidence`, `missing_evidence`, `current_recommendation`, `change_conditions`, and `permission_request_ids`.

Tasks and checkpoints must be generated records, not fixed arrays. Checkpoints should support custom questions and decision rules per mission. A mission plan version should preserve checkpoint order, checkpoint dependencies, and task-to-checkpoint links so the system can explain why the mission path changed.
