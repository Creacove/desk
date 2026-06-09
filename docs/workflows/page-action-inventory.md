# Page And Button Accountability Inventory

Purpose: account for every prototype surface and define current behavior, production behavior, dynamic data, reads, writes, and failure states.

Strict coverage matrix: `docs/workflows/prototype-coverage-matrix.md`. Use the matrix for implementation acceptance checks; use this inventory for detailed page notes.

Dynamic data lineage contract: `docs/workflows/prototype-data-lineage-contract.md`. Every state-bearing value listed here must trace to database records, producer workflow, evidence or limitation, and run/usage provenance when AI or provider work is involved.

## Source Of Truth

Visible prototype source: `src/prototype/AiLabelPrototype.tsx`

Important prototype records:

- `artist`
- `agents`
- `managerQuestions`
- `baseConversations`
- `baseMissions`
- `musicObjects`
- `taskRows`
- `missionCheckpoints`
- `departmentBriefs`
- `evidence`
- `decisionRecord`
- `missionReview`
- `testReviewImpact`
- `taskResults`
- `missionEvents`
- `workDrafts`
- `approvedTasks`
- `completedTasks`
- `testCheckpoint`

The prototype also contains route/drawer affordances that are not all equally live. Production should preserve the operating model, not blindly expose dormant paths:

- `testLabWorkspace` is the Checkpoint Review workspace in production naming.
- `briefsWorkspace` is the Notes / agent handoff workspace.
- `decisionRecord` drawer is Mission Memory / Mission Record.
- `workDraft` drawer exists as a future work-product surface and should open only from real drafts.
- `intelligence` drawer kind exists in the type but has no visible drawer body; do not implement it as a separate product surface unless a real workflow requires it.

## Connect Artist

What the user sees: first identity confirmation screen with selected Spotify identity.  
Dynamic data: artist name, Spotify identity.  
Current behavior: Continue moves to setup.  
Production behavior: confirm or select canonical artist identity, create/load artist profile, store identity source.  
Data read: Spotify public identity, existing artist profile if present.  
Data written: artist identity selection.  
Background action: source readiness check for public Spotify catalog.  
User-visible result: setup context screen.  
Failure state: no identity found, ambiguous identity, source unavailable.

## Setup / Context

What the user sees: profile fields, socials, budget, artist direction, private analytics warning.  
Dynamic data: artist profile fields.  
Current behavior: local state update; Enter Label HQ navigates to Label HQ.  
Production behavior: persist profile, mark missing sources, create initial artist operating context.  
Data read: selected identity, existing profile.  
Data written: artist profile, source readiness, initial memory entries for user-supplied context.  
Background action: normalize handles and identify missing private sources.  
User-visible result: Label HQ.  
Failure state: required identity missing, profile save failure, invalid source handle.

## Label HQ

What the user sees: daily operating room, Today's Brief, staff, active missions, attention/flagged items.  
Dynamic data: artist profile, missions, active mission count, evidence, staff readiness, blockers, priority strip, recent movement, generated brief timestamp.  
Current behavior: buttons navigate to Manager, Evidence Drawer, Missions, Tasks, Settings, locked agents.  
Production behavior: load daily operating read and prioritized work from live artifacts.  
Data read: profile, memory, missions, tasks, checkpoints, reviews, evidence, agents, operating events.  
Data written: usually none; brief snapshot or review trigger if configured.  
Background action: generate or fetch Today's Brief and priority stack.  
User-visible result: current operating picture.  
Failure state: stale sources, brief generation failure, missing mission data.

## Today's Brief

What the user sees: artist-level headline read, signal proof, Manager interpretation, one directive, evidence access, Talk to Manager.  
Dynamic data: artist, concrete signals, metrics, geography, source line, limitations, generated time, proof/manager-read panels.  
Current behavior: hardcoded narrative and evidence drawer link.  
Production behavior: Manager-authored synthesis generated from profile, memory, evidence, agent reports, active missions as supporting context, tasks, checkpoints, reviews, and recent decisions.  
Data read: profile, evidence, mission state, memory, agent reports, operating directive, source freshness.  
Data written: optional brief snapshot; possible evidence request/review trigger.  
Background action: rank what matters today.  
User-visible result: brief and source access.  
Failure state: no fresh data, conflicting evidence, missing proof, unsupported metric/geography claim.

Visible structure:

- Headline Read: artist state today.
- Signal Proof: concrete source-backed numbers or movements.
- Manager Read: what those signals mean for the artist.
- Today's Directive: one operating move.
- Source line: supporting context and limitations.

Agent reports inform the brief internally, but the user should not see agent-by-agent contributions inside Today's Brief.

Visible metric/source accountability:

- tracked streams must come from Spotify for Artists export, distributor analytics, smart-link/provider analytics, or another connected/uploaded source that actually contains the metric.
- TikTok hook movement must come from TikTok public/connected data and remain an attention signal unless conversion evidence exists.
- Chicago/Lagos/Nigeria movement must come from geography-capable streaming/social/comment evidence and must state whether it is comments, streams, clicks, or another signal.
- generated time must come from the `manager_synthesis_run` or brief snapshot timestamp.

## Recent Movement

What the user sees: short movement feed such as milestone, staff, and system updates.  
Dynamic data: recent operating events, agent notes, task state events, source updates, mission changes.  
Current behavior: static timeline copy.  
Production behavior: show only events that changed operating state or deserve user awareness.  
Data read: operating events, agent notes, task results, checkpoint updates, source snapshots, reviews.  
Data written: none from reading.  
Background action: event ranking and deduplication.  
User-visible result: recent changes that explain why Label HQ looks different today.  
Failure state: event missing linked artifact, stale movement, duplicate event.

## Music

What the user sees: the artist's recorded work under management, with simple `Songs` and `Projects` tabs, song lifecycle stage, blockers, split status, asset status, Manager next move, source limits, linked missions/tasks/evidence, assets, rights state, and project tracklists.  
Dynamic data: `music_items`, `music_projects`, project tracklists, Music identifiers, assets, credits, splits, split confirmations, distribution packages, source snapshots, evidence links, mission subject links, tasks, checkpoints, reviews, and memory summaries.
Current behavior: local mock `musicObjects` show `Night Bus`, `Glass Room EP`, released catalog, and demo material. Songs open into a four-tab song room: `Overview`, `Files`, `Details`, and `Rights`. `Night Bus` links to the existing release mission and visibly carries the split-sheet blocker. The Rights tab includes contributor splits, confirmation links, approval log, and a distribution-readiness hub.
Production behavior: load first-class Music records from Spotify public catalog, distributor data, user-entered unreleased material, uploaded assets, normalized evidence, and saved Music history while preserving source limitations.
Data read: `music_items`, `music_projects`, `music_project_items`, `music_assets`, `music_identifiers`, `music_credits`, `music_splits`, `music_split_contributors`, `music_split_confirmations`, `music_distribution_packages`, `music_distribution_events`, `mission_subject_links`, `missions`, `tasks`, `evidence_items`, `source_snapshots`, `memory_entries`, `reviews`, `permission_requests`.
Data written: usually none from browsing. User-created or corrected songs/projects write Music records, project membership, identifiers, assets, credits, splits, operating events, and possible memory entries. Split confirmation and distribution actions write permission/audit records and never execute externally without approved scope.
Background action: source matching, Music deduplication, readiness calculation, linked work aggregation, source-limit labeling, split-state recomputation, distribution readiness checks, and retrieval of saved Music history for Manager/agent runs.
User-visible result: a music operating surface that explains what exists, what stage each song is in, what is missing, what is blocked, and which operating work is attached. Projects roll up blockers from their songs without duplicating song state.  
Failure state: duplicate song/project records, ambiguous provider matches, unreleased material confused with public catalog, unsupported private analytics claims, missing tracklist relationships, stale source data.

Buttons:

- Songs / Projects: switches between atomic song objects and project containers.
- Song stage: allows a user to manually choose stage; Manager suggestions are visible but do not silently change the stage.
- Overview / Files / Details / Rights: reveals Manager read, source limits, linked operating work, upload affordances, song identity, credits, release details, identifiers, and split-sheet state without creating standalone song-task systems.
- Add collaborator / Send split confirmation links / Confirm split: updates split proposal and contributor confirmation state through scoped, auditable records.
- Initialize Global Distribution: creates or advances a permission-gated distribution package only when required assets, metadata, rights, and approval are ready; provider confirmation is required before release success is recorded.
- Open linked mission: opens the generic mission attached through `mission_subject_links`; missions are still allowed to have no Music subject.
- View tasks / View evidence: opens existing task or evidence surfaces in the context of the selected Music record when available.

## Staff

What the user sees: Manager online and locked specialist agents with source readiness.  
Dynamic data: agent status, tools, connected/missing sources, manager-prepared outputs.  
Current behavior: Manager opens Manager Office; locked agents open locked workspace.  
Production behavior: show agent readiness and source requirements based on real connections/uploads.  
Data read: agent profiles, source connections, evidence readiness.  
Data written: none unless user starts upload/connect flow or asks Manager to prepare brief.  
Background action: readiness calculation.  
User-visible result: agent room or Manager Office.  
Failure state: readiness unknown, connector unavailable.

## Manager Office

What the user sees: context questions, Ask Manager composer after questions are complete, recent conversations.  
Dynamic data: manager questions, answers, answer progress, topic chips, conversation list.  
Current behavior: answers stored in local state; ask starts Manager run path.  
Production behavior: context gate persists answers and starts router run.  
Data read: artist profile, missing context requirements, conversations, active missions, relevant memory.  
Data written: context answers, conversation message, manager run, memory entries for durable context.  
Background action: readiness gate and conversation router.  
User-visible result: investigation, decision package, or conversation thread.  
Failure state: missing required context, run start failure.

Buttons:

- Use suggested context: writes the suggested answer into the active context answer field; production should treat it as user-confirmed only after the user saves/submits it.
- Next Question / Submit Context: persists the current answer and advances the context gate.
- Topic chips: replace composer draft with a suggested directive; they do not start a run until the user submits.
- See full history: production should open/search conversation history; the current prototype button is visual only.

## Conversation Workspace

What the user sees: conversation list, selected thread, messages, linked created work, follow-up composer.  
Dynamic data: conversations, messages, linked mission/task/checkpoint.  
Current behavior: follow-up appends local mock Manager response; created work buttons navigate.  
Production behavior: continue thread through router, preserve linked artifacts and run history.  
Data read: conversation, messages, linked artifacts.  
Data written: user message, Manager message, run, possible artifacts.  
Background action: conversation router and retrieval.  
User-visible result: answer or linked work update.  
Failure state: thread not found, run failure, linked artifact missing.

## Investigation

What the user sees: Manager checking context, sources, evidence, risks, and execution package.  
Dynamic data: run steps and status.  
Current behavior: static progress screen.  
Production behavior: reflect manager run stages and action-plan status.  
Data read: manager run.  
Data written: run stage updates.  
Background action: classification, retrieval, evidence check, action planning.  
User-visible result: progress then decision/answer.  
Failure state: run timeout, retrieval failure, insufficient context.

## Decision Package

What the user sees: direct recommendation, budget/action facts, rationale, rejected moves, work created, evidence, mission/thread links.  
Dynamic data: decision package, evidence, linked mission, conversation.  
Current behavior: static package with navigation buttons.  
Production behavior: durable decision artifact linked to run and created/updated work.  
Data read: manager run, evidence, mission, tasks, conversation.  
Data written: decision package, memory, mission/task/checkpoint updates if selected by run.  
Background action: persist decision and linked artifacts.  
User-visible result: management call with action links.  
Failure state: partial artifact creation, approval required, missing evidence.

## Missions

What the user sees: mission list, selected mission overview, progress, review, mission work buttons.  
Dynamic data: missions, selected mission, progress, review, tasks/checkpoints/notes/memory counts.  
Current behavior: local mission selection and navigation.  
Production behavior: load active/archived missions and selected mission operating state.  
Data read: missions, tasks, checkpoints, notes, reviews, memory.  
Data written: selected mission preference only unless user action modifies work.  
Background action: mission state aggregation.  
User-visible result: selected mission workspace.  
Failure state: mission missing, stale progress, load failure.

## Tasks

What the user sees: tasks grouped by checkpoint/phase, details, approval, mark done, completion notes.  
Dynamic data: task rows, approved/completed state, checkpoint dependencies, task results.  
Current behavior: local approve/done state and task note capture.  
Production behavior: approval and completion create durable task events/results and update mission/checkpoint/memory.  
Data read: tasks, checkpoints, evidence, approvals.  
Data written: approval, task result, memory, checkpoint update, review trigger.  
Background action: task transition validation and result interpretation.  
User-visible result: task status, Manager note, mission effect.  
Failure state: approval required, dependency blocked, save failure, weak proof.

## Checkpoint Review

What the user sees: mission progress map, checkpoint list/detail, required tasks, decision rule, recommendation, and what changed since the last checkpoint read.
Dynamic data: checkpoint state, required task results, watched signals, recommendations.
Current behavior: local selected checkpoint; static checkpoint states.
Production behavior: AI-owned readiness checks updated from tasks/evidence/reviews.
Data read: checkpoints, tasks, task results, evidence, mission memory.
Data written: checkpoint state event, checkpoint result, review, memory, operating event, and usage event when AI evaluates the checkpoint.
Background action: readiness evaluation, dependency evaluation, delta comparison against the previous checkpoint result, and mission-plan impact calculation.
User-visible result: current checkpoint recommendation, blockers, cleared dependencies, and the reason progress changed or did not change.
Failure state: missing required tasks, missing evidence, conflicting source data.

## Notes

What the user sees: agent-to-agent operational notes.  
Dynamic data: sender, recipient, type, message, evidence used, linked mission, resulting change.  
Current behavior: static `departmentBriefs`.  
Production behavior: read-only notes created by Manager/specialist runs.  
Data read: agent notes, evidence, linked mission.  
Data written: none from reading; notes created by runs.  
Background action: agent handoff.  
User-visible result: operational context, not approval queue.  
Failure state: linked evidence unavailable, locked specialist cannot answer.

## Mission Memory

What the user sees: living recap, task/checkpoint/note updates, blockers, evidence limits, mission log.  
Dynamic data: decision record, mission events, task results, evidence IDs, review date.  
Current behavior: drawer from `decisionRecord` and related constants.  
Production behavior: generated recap from mission-scoped memory entries.  
Data read: memory entries, mission, tasks, checkpoints, notes, reviews, evidence.  
Data written: none from drawer; memory written by runs and task/review workflows.  
Background action: recap generation.  
User-visible result: understandable mission intelligence note.  
Failure state: memory generation stale or missing event provenance.

## Artist Profile / Settings

What the user sees: editable artist identity, focus, connected channels, private data needed.  
Dynamic data: profile fields and source readiness.  
Current behavior: local state updates.  
Production behavior: persist profile edits and create profile-change memory where useful.  
Data read: profile, source connections, memory.  
Data written: artist profile, possibly memory and evidence from user-supplied context.  
Background action: validation and source readiness update.  
User-visible result: updated profile.  
Failure state: invalid field, save failure, conflicting identity.

## Locked Agent Workspace

What the user sees: specialist purpose, what sources are needed, connected proof, optional context, Manager-prepared context, upload action.  
Dynamic data: selected agent profile and source readiness.  
Current behavior: static source requirements and nonfunctional upload button.  
Production behavior: source intake and specialist referral readiness.  
Data read: agent profile, source connections, evidence readiness.  
Data written: upload/connect request, uploaded file record, source snapshot, evidence extraction job, specialist referral, Manager-prepared brief.  
Background action: readiness calculation and source intake.  
User-visible result: unlock needs and available Manager help.  
Failure state: upload failure, source unsupported, specialist still locked.

## Evidence Drawer

What the user sees: normalized evidence file with source, type, subject, window, metric, lens, freshness, confidence, provenance, limitation.  
Dynamic data: evidence items.  
Current behavior: static evidence drawer.  
Production behavior: contextual evidence readout for the artifact that opened it.  
Data read: evidence items and source snapshots.  
Data written: none from reading.  
Background action: provenance display.  
User-visible result: proof and limitations.  
Failure state: source snapshot unavailable, evidence stale.

## Review / What Changed

What the user sees: review trigger, what changed, previous recommendation, Manager comparison, actions.  
Dynamic data: review record and linked mission.  
Current behavior: Open updated mission navigates; other buttons static.  
Production behavior: review run can open mission, run comparison, snooze review, or create next tasks.  
Data read: review, mission, prior decision, new evidence/task results.  
Data written: review outcome, mission/checkpoint/memory updates, snooze state.  
Background action: recommendation comparison.  
User-visible result: clear change/no-change explanation.  
Failure state: previous decision unavailable, evidence conflict unresolved.

Buttons:

- Open updated mission: navigates to the linked mission.
- Run review: starts a Review Run using the prior recommendation, current evidence, task results, checkpoint state, and memory.
- Snooze review: writes snooze state with reason, next review time, and risk of waiting.

## Work Draft Drawer

What the user sees: draft type, title, body, and clear status that nothing was sent.  
Dynamic data: draft record.  
Current behavior: drawer kind exists in type but is not a primary prototype path.  
Production behavior: show generated work product requiring approval.  
Data read: work draft and linked task/decision.  
Data written: draft edits, approval state, versions.  
Background action: draft generation and approval tracking.  
User-visible result: prepared material ready for review.  
Failure state: generation failure, approval required, external send unavailable.
