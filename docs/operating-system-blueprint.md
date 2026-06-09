# Ordersounds Operating System Blueprint

Document purpose: implementation blueprint for turning the prototype into a real AI record label operating system  
Primary UI source of truth: `src/prototype/AiLabelPrototype.tsx`
Product references: `docs/ai-record-label-prd.md`, `docs/google-stitch-redesign-handoff.md`  
Status: living architecture document

## How To Use This Document

This master blueprint is the readable overview. The contract appendices are implementation authority. If an implementation detail is ambiguous here, use the stricter contracts in `docs/workflows/` before making a product or schema decision.

Implementation authority order:

1. Prototype visible behavior in `src/prototype/AiLabelPrototype.tsx`
2. This master blueprint for product doctrine and system boundaries
3. Contract appendices for data lineage, relationships, states, page coverage, personalization, source confidence, and mission patterns
4. PRD/design handoff for supporting product intent

## 1. Executive Standard

Ordersounds is not a dashboard with AI text added to it. It is a proactive operating system for an artist's label work. The visible prototype shows the desired surface: the artist enters a label workspace, the Manager understands the artist context, missions collect real work, and the system remembers what changed.

The implementation must make that behavior real without hard-coding the Night Bus release example as the system. Night Bus is one demo song and one demo release mission. The product needs a first-class Music domain for recorded work plus a generic mission engine that can handle career architecture, market expansion, A&R, release planning, budget allocation, source completeness, rights cleanup, creator validation, city validation, revenue investigation, sync readiness, partnerships, positioning, reputation/wellbeing, team operations, and future Manager-defined objectives.

The standard for this document is traceability:

- Every visible claim must trace to artist profile, user input, memory, evidence, agent report, or explicit limitation.
- Every dynamic prototype field must trace to a database source, producer workflow, run/action provenance, and evidence or limitation.
- Every background write must create or update a durable artifact.
- Every AI, provider API, or billable tool invocation must write usage/cost records so per-usage billing can explain what work was paid for.
- Every mission must explain why it exists, what pattern/playbook it used, what evidence it needs, what tasks/checkpoints were generated, and what would change the recommendation.
- Every automatic internal action must be explainable to the user and reversible or reviewable where appropriate.
- Every external, expensive, legal, financial, reputational, or sensitive action must require human approval.

## 2. Operating Doctrine

### Product Identity

Ordersounds is an AI record label operating layer. It helps an artist or artist team decide, act, and learn. It is not a BI tool, a passive analytics dashboard, a generic chatbot, or a rigid release checklist.

The Manager is the coordinating authority. Specialist agents provide domain-specific perspectives. Conversations are one input into the operating system, not the entire system.

The operating loop is:

1. Sources observe.
2. Agents interpret.
3. Manager synthesizes.
4. System organizes.
5. Human permits.
6. Approved actions execute.

### Core Rules

1. The Manager must be proactive. It can create or update internal operating artifacts when source changes, agent reports, task results, reviews, schedules, or conversations reveal work that needs to exist.
2. Music is first-class recorded-work state. Songs, demos, catalog tracks, projects, files, rights, splits, and distribution readiness belong in Music records, not generic artist objects.
3. Missions are dynamic operating objects. A release mission is one pattern, not the mission system.
4. Tasks and checkpoints are generated from the mission objective, selected pattern/playbook, evidence needs, dependencies, risk areas, agent reports, prior memory, Music state where relevant, and permission boundaries.
5. Work is durable. A music item/project, mission, task, checkpoint, note, memory entry, review, draft, directive, report, permission request, or referral must exist when the system says work was created or changed.
6. Evidence has limits. The system must not claim private analytics, conversion, rights certainty, revenue certainty, distribution success, or causation unless the source supports it.
7. Memory is operational, not decorative. Memory must influence future decisions and preserve important context, blockers, rejected moves, and open questions.
8. The human stays in command. The system can read, recommend, and organize internally; it cannot spend money, send external messages, make legal/financial conclusions, publish/schedule content, initiate distribution, change public release plans, or make sensitive commitments without approval.
9. Locked agents can still produce limited readiness/risk reports from available evidence and Music state, but they cannot produce full specialist conclusions without required sources.
10. UI projections are rebuildable. The prototype can have polished text, but production text that reflects state must come from records and lineage, not hand-authored constants.
11. The database should stay boring. New tables are justified by durable state, audit, permissioning, billing, retrieval, or repeated query needs; otherwise use existing artifacts, links, events, memory, or service projections.

### Authority Levels

- Read: inspect sources, memory, missions, tasks, evidence, conversations, and reports.
- Recommend: produce findings, reports, decisions, directives, and suggested work.
- Organize: internally create/update/archive missions, tasks, checkpoints, notes, memory, reviews, drafts, evidence requests, and referrals.
- Execute: spend money, contact third parties, submit materials, publish content, change public plans, or make sensitive commitments.

Agents and the Manager may read, recommend, and organize according to their role. Execution requires user permission.

## 3. Core System Primitives

### Artist Profile

Purpose: visible user-editable identity and operating context for one artist.  
Owner: user/team, with Manager allowed to suggest edits.  
Source of truth: profile record.  
User-facing representation: setup flow and Settings / Artist Profile workspace.  
Background role: scopes conversations, missions, evidence, source readiness, agent reports, and memory.  
Created by: first-run setup or imported workspace creation.  
Updated by: user edits, explicit profile update actions, or approved Manager suggestions.  
Never automatic: the system must not silently change identity, ownership, budget, artist direction, or connected handles.  
Schema candidate: `artists`, `artist_profiles`.

### Agent Run

Purpose: a traceable specialist or Manager analysis pass triggered by schedule, source change, task result, review, mission need, or conversation.  
Owner: the agent that ran.  
Source of truth: agent run record.  
User-facing representation: usually summarized through agent reports, notes, daily brief, missions, or Manager synthesis.  
Background role: lets each agent interpret available evidence through its own lens.  
Created by: daily operating cadence, weekly strategy cadence, mission run, evidence trigger, task-result trigger, conversation trigger, or review trigger.  
Updated by: run status and final report links.  
Never automatic: do not present a limited locked-agent run as a full specialist conclusion.  
Schema candidate: `agent_runs`.

### Agent Report

Purpose: a domain-specific finding from an agent run.  
Owner: reporting agent.  
Source of truth: agent report record linked to evidence and run.  
User-facing representation: agent note, daily brief input, Manager explanation, locked-agent readiness/risk read.  
Background role: feeds Manager synthesis with distinct perspectives.  
Created by: agent run completion.  
Updated by: new report version; original report remains auditable.  
Never automatic: do not let a specialist report directly override Manager synthesis, create missions directly, or execute external action. Specialist agents can propose mission candidates; the Manager decides whether to create or update the mission.  
Schema candidate: `agent_reports`.

### Manager Synthesis Run

Purpose: the coordinating run that reads agent reports, profile, memory, missions, tasks, checkpoints, notes, evidence, and conversations before deciding what should happen.  
Owner: Manager.  
Source of truth: synthesis run record plus action plan.  
User-facing representation: Today's Brief, decision package, mission update, review, or Manager response.  
Background role: final internal decision layer before writes or permission requests.  
Created by: daily operating run, weekly strategy run, mission run, evidence trigger, task result, review, or conversation.  
Updated by: synthesis stages and action outcomes.  
Never automatic: do not claim work was applied unless the action plan succeeded.  
Schema candidate: `manager_synthesis_runs`, `manager_run_actions`.

### Operating Directive

Purpose: the Manager's current prioritized instruction for what matters now.  
Owner: Manager.  
Source of truth: directive record linked to synthesis run.  
User-facing representation: Today's Brief, Label HQ priority stack, mission header.  
Background role: focuses the user and agents around the current most important move.  
Created by: Manager synthesis.  
Updated by: later synthesis or review.  
Never automatic: do not hide material recommendation changes; create a review or new directive.  
Schema candidate: `operating_directives`.

### Conversation

Purpose: persistent thread between user and Manager.  
Owner: user/team and Manager.  
Source of truth: conversation and message records.  
User-facing representation: Manager Office recent conversations and Conversation Workspace.  
Background role: contributes user intent, corrections, approvals, decisions, and context to the operating loop.  
Created by: user starting or continuing a Manager thread.  
Updated by: user messages, Manager responses, run status, linked artifacts.  
Never automatic: do not fabricate user messages or mutate history; corrections should be new records.  
Schema candidate: `conversations`, `conversation_messages`.

### Music Item

Purpose: durable recorded-work state for a song, demo, released track, catalog track, or alternate version.
Owner: user/team for entered/corrected facts; Music service for persisted state; Manager and agents may suggest changes.
Source of truth: Music item record plus assets, identifiers, credits, splits, evidence links, memory, and operating events.
User-facing representation: Music workspace song rows and Song Room.
Background role: gives Manager and specialist agents stable song context before deciding whether a source refresh is needed.
Created by: user entry, setup focus, source/catalog matching, upload normalization, or approved Manager action.
Updated by: user edits, trusted integration confirmations, uploaded files, split confirmations, distribution events, or approved Manager suggestions.
Never automatic: do not treat Music state as proof by itself; do not silently change visible lifecycle stage, rights state, or public release status from an AI suggestion.
Schema candidate: `music_items`, `music_assets`, `music_identifiers`, `music_credits`, `music_splits`.

### Music Project

Purpose: durable container for a single release package, EP, album, mixtape, compilation, deluxe, or unreleased body of work.
Owner: user/team for tracklist and release intent; Music service for persisted state.
Source of truth: project record plus `music_project_items`.
User-facing representation: Music workspace Projects tab and Project Room.
Background role: rolls up readiness from contained songs and project-level assets without duplicating song state.
Created by: user entry, catalog matching, distributor/project source, or approved Manager action.
Updated by: tracklist changes, user edits, trusted integration events, or approved Manager suggestions.
Never automatic: do not copy song-level splits, assets, identifiers, or blockers into project payloads.
Schema candidate: `music_projects`, `music_project_items`.

### Decision Package

Purpose: a management-grade answer that includes the call, rationale, facts, evidence, rejected moves, work created/updated, and review condition.  
Owner: Manager.  
Source of truth: decision package record linked to run and conversation or proactive synthesis.  
User-facing representation: Decision Package screen.  
Background role: durable decision artifact that can create or update missions, tasks, checkpoints, notes, reviews, memory, drafts, and permission requests.  
Created by: Manager synthesis when a decision is needed.  
Updated by: later review through a new version or linked review, not silent overwrite.  
Never automatic: do not execute external decisions; package remains recommendation until approved where needed.  
Schema candidate: `decision_packages`.

### Mission

Purpose: a dynamic operating object for a durable artist objective, risk, or opportunity.  
Owner: Manager operating layer, with user/team accountable for human tasks.  
Source of truth: mission record and linked artifacts.  
User-facing representation: Missions Workspace and Active Missions on Label HQ.  
Background role: organizes generated tasks, checkpoints, notes, memory, reviews, permissions, and recommendations around one objective.  
Created by: Manager synthesis when an objective, risk, or opportunity requires coordinated work and no active mission already covers it.  
Updated by: mission runs, task results, reviews, agent reports, source changes, checkpoint changes, conversations, and explicit user edits.  
Never automatic: do not create duplicate missions for the same objective; do not hard-code release-specific phases into the mission model.  
Schema candidate: `missions`, `mission_patterns`.

### Mission Plan

Purpose: the generated structure that turns a mission pattern into ordered checkpoint phases and task groups.  
Owner: Manager operating layer.  
Source of truth: mission plan version linked to mission.  
User-facing representation: mission checkpoint path, task groups under checkpoints, mission progress map.  
Background role: explains what must happen first, what each checkpoint is waiting for, and which tasks feed each checkpoint.  
Created by: mission creation or major mission re-plan.  
Updated by: Manager synthesis when tasks, evidence, agent reports, or reviews change the path.  
Never automatic: do not reorder phases or remove tasks silently; create a memory entry explaining why the path changed.  
Schema candidate: `mission_plans`, `mission_plan_versions`.

### Mission Pattern / Playbook

Purpose: an adaptable planning template used to generate mission-specific tasks, checkpoints, evidence needs, review rules, and permission boundaries.  
Owner: product/agent system, selected or adapted by Manager.  
Source of truth: pattern definition plus mission-specific generated plan.  
User-facing representation: mostly implicit through mission lanes and Manager explanation.  
Background role: keeps dynamic mission generation coherent without hard-coding one workflow.  
Created by: product-defined patterns or Manager-created ad hoc pattern when no existing pattern fits.  
Updated by: product iteration and learned mission outcomes.  
Never automatic: do not treat a pattern as mandatory if the mission objective needs a different plan.  
Schema candidate: `mission_patterns`, `mission_playbooks`.

### Task

Purpose: a plain-language action that a person, team, or integration can perform.  
Owner: assigned user/team role, prepared specialist, or approved integration.  
Source of truth: task record and task state events.  
User-facing representation: Tasks Workspace, mission surfaces, flagged queues.  
Background role: turns recommendations into executable work and feeds results back into mission state.  
Created by: Manager synthesis, mission plan generation, decision package, note outcome, evidence request, or review.  
Updated by: approval, completion note, blocked/rejected/revised state, Manager interpretation, dependency changes, or archive/supersede event.  
Never automatic: do not mark done without user/team action or trusted integration confirmation; approval-gated tasks cannot complete before approval.  
Schema candidate: `tasks`, `task_results`, `task_state_events`.

### Checkpoint

Purpose: an AI-owned question that determines whether a mission can continue, should change, should pause, or needs human review.  
Owner: Manager system, informed by relevant agents.  
Source of truth: checkpoint record.  
User-facing representation: Checkpoint Review workspace and mission progress map.
Background role: acts as a phase gate inside the mission plan. Each checkpoint groups the tasks, evidence, permissions, and agent findings needed to answer one mission question before the mission proceeds.  
Created by: dynamic mission plan generation, mission run, decision package, or review.  
Updated by: task results, source changes, agent reports, mission runs, reviews, and Manager assessment.  
Never automatic: do not require the user to manually track AI-owned checks; if human action is needed, create a task.  
Schema candidate: `checkpoints`.

### Task Result

Purpose: the interpreted result of a completed, blocked, rejected, revised, archived, superseded, or missed task.  
Owner: user/team for raw note; Manager for interpretation.  
Source of truth: task result record.  
User-facing representation: Manager note inside task details and mission memory.  
Background role: updates checkpoints, reviews, mission progress, and memory.  
Created by: task completion, integration event, archive/supersede decision, or explicit blocked/rejected state.  
Updated by: correction or new version; do not overwrite original user note.  
Never automatic: do not treat weak or missing proof as success.  
Schema candidate: `task_results`.

### Agent Note

Purpose: a read-only operational handoff between Manager and current/future agents.  
Owner: sending agent.  
Source of truth: note record.  
User-facing representation: Notes Workspace.  
Background role: preserves requests, findings, source gaps, resulting changes, and agent inbox/outbox communication. A Manager note to an agent can be consumed by that agent's next run; an agent note back to Manager can become a report input, mission candidate, task candidate, evidence request, or memory update.  
Created by: Manager synthesis, specialist run, mission activity, or review.  
Updated by: status/resulting change only; original note content remains immutable.  
Never automatic: user does not approve notes; if approval is needed, create a task, draft, budget request, or external recommendation.  
Schema candidate: `agent_notes`.

### Mission Memory

Purpose: living recap of one mission across objective, pattern, plan phases, task/checkpoint links, decisions, notes, blockers, evidence gaps, reviews, and recommendation changes.  
Owner: Manager system.  
Source of truth: mission-scoped memory entries and generated recap.  
User-facing representation: Mission Memory / Mission Record drawer.  
Background role: lets future runs understand what happened without rereading every artifact.  
Created by: mission creation.  
Updated by: mission runs, task results, checkpoint changes, plan changes, notes, reviews, decisions, reports, source changes, and important user messages.  
Never automatic: do not erase prior recommendations; append changes with reason and provenance.  
Schema candidate: `memory_entries` scoped by mission.

### Evidence Item

Purpose: normalized proof used by agents and displayed when the user asks why.  
Owner: source ingestion system.  
Source of truth: evidence record linked to raw snapshot.  
User-facing representation: Evidence Drawer and contextual evidence lines.  
Background role: grounds claims, confidence, limitations, and decision rules.  
Created by: source connection, upload, user reply, or derived extraction from a raw source.  
Updated by: new evidence version; old evidence remains auditable.  
Never automatic: do not promote noisy evidence to high confidence without source support.  
Schema candidate: `evidence_items`.

### Source Snapshot

Purpose: raw or semi-raw captured source state for audit and reprocessing.  
Owner: ingestion system.  
Source of truth: source snapshot storage.  
User-facing representation: raw reference in Evidence Drawer, not usually shown directly.  
Background role: supports provenance and future extraction.  
Created by: API sync, file upload, manual entry, or connector event.  
Updated by: append-only new snapshots.  
Never automatic: do not mutate historical raw snapshots.  
Schema candidate: `source_snapshots`.

### Review / What Changed

Purpose: follow-up evaluation when evidence, task results, agent reports, source changes, or time may change the recommendation.  
Owner: Manager.  
Source of truth: review record linked to mission, checkpoint, decision, task result, report, or source change.  
User-facing representation: Review / What Changed workspace and mission memory.  
Background role: compares previous recommendation with current state and decides whether to continue, revise, pause, escalate, or request permission.  
Created by: scheduled review, mission run, task result, checkpoint state change, source change, or evidence threshold.  
Updated by: review run status and final outcome.  
Never automatic: do not silently change a major recommendation without a review artifact.  
Schema candidate: `reviews`.

### Permission Request

Purpose: explicit ask for user approval before external, expensive, sensitive, legal, financial, or reputational action.  
Owner: Manager or specialist agent, approved by user/team.  
Source of truth: permission request record.  
User-facing representation: flagged item, task, decision package action, draft approval, or review action.  
Background role: separates internal organization from execution.  
Created by: Manager synthesis or agent report when proposed work crosses an approval boundary.  
Updated by: user approval, rejection, edit, expiry, or cancellation.  
Never automatic: do not infer approval from passive behavior.  
Schema candidate: `permission_requests`.

### Work Draft

Purpose: generated copy, plan, outreach, checklist, or other work product that requires human review before use.  
Owner: Manager or specialist agent, approved by user/team.  
Source of truth: draft record.  
User-facing representation: Work Draft drawer.  
Background role: turns recommendations into prepared materials.  
Created by: Manager/specialist run.  
Updated by: user edits, approved revisions, generated versions.  
Never automatic: do not send, publish, schedule, or externally submit drafts without explicit approval.  
Schema candidate: `work_drafts`.

### Specialist Referral

Purpose: structured transfer of a question or evidence package to a specialist agent.  
Owner: Manager as referrer, specialist as receiver when active.  
Source of truth: referral record.  
User-facing representation: locked agent workspace, notes, and future specialist room.  
Background role: preserves specialist context, missing evidence, and expected output.  
Created by: Manager synthesis when a mission or question needs a specialist lens.  
Updated by: specialist response, unlock state, evidence upload, or Manager-prepared brief.  
Never automatic: locked specialists cannot make unsupported specialist conclusions.  
Schema candidate: `specialist_referrals`.

## 4. Proactive Operating Loop

Conversation is one trigger. The full system loop is broader:

1. Scheduled cadence, source change, task result, review trigger, mission need, or user conversation starts a run.
2. Relevant agents run with role-specific prompts and source limits.
3. Agents produce reports with findings, confidence, evidence, limitations, risks/opportunities, recommended actions, and permission needs.
4. Manager synthesis reads agent reports, profile, Music state where relevant, memory, active missions, tasks, checkpoints, notes, evidence, reviews, and conversations.
5. Manager decides whether to do nothing, answer, update the daily brief, create/update a mission, generate or revise the mission plan, create tasks/checkpoints, create notes, update memory, trigger review, request evidence, create a draft, archive/supersede work, or ask for permission.
6. Safe internal organization writes are applied.
7. Permission-gated actions are shown to the user.
8. Label HQ, Today's Brief, Missions, Tasks, Checkpoint Review, Notes, Memory, Reviews, and Manager Office update.

## 5. Dynamic Mission Engine

A mission is created when Manager synthesis identifies a durable artist objective, risk, or opportunity that requires coordinated work, review points, and memory, and no active mission already covers it.

The system must support at least these mission patterns:

- Release planning
- Budget allocation
- Data/source completeness
- Rights cleanup
- Creator/content validation
- City/live-market validation
- Revenue investigation
- Sync/deal readiness
- Campaign review
- Career architecture
- Artist positioning
- A&R / focus asset selection
- Audience and fan development
- Market expansion
- Partnerships / brand / sync / deals
- Reputation / crisis / wellbeing
- Team operations
- Ad hoc Manager-defined objective

Each pattern defines when to use it, likely agents, common evidence needs, common task types, common checkpoint questions, permission boundaries, review triggers, success state, and blockage/failure state. The Manager can adapt a pattern or create an ad hoc pattern when the objective does not fit an existing one.

Mission generation follows:

1. Detect objective, risk, or opportunity.
2. Match or create mission pattern/playbook.
3. Search existing missions for overlap.
4. Define mission objective, reason, trigger, relevant agents, required evidence, missing evidence, and recommendation.
5. Generate an ordered mission plan made of checkpoint phases.
6. Place tasks under the checkpoint they unlock or inform.
7. Generate checkpoint dependencies so the system knows what needs to happen first and what later phases are waiting on.
8. Create notes, memory seed, review rules, and permission requests.
9. Link evidence, source limits, originating run, and conversation/report context.

Night Bus is a release-planning demo mission. It is not the architecture limit.

## 6. Dynamic Tasks And Checkpoint Review

Tasks are generated when a human/team action or approved integration action is needed. Each task must sit under a checkpoint phase, because task results are interpreted against the checkpoint question they help answer. Each task must include owner, purpose, dependency, linked checkpoint, evidence needed, approval state, completion result expectations, and risk if late or skipped.

Checkpoints are generated as AI-owned mission questions and ordered into phases. A checkpoint determines whether the mission can continue, should change, should pause, or needs human review. Checkpoints are generated from objective, pattern, evidence needs, dependencies, risks, agent reports, prior memory, and permission boundaries.

The visible surface is **Checkpoint Review**. It is not a separate task system. It reviews checkpoint state, required task results, evidence gaps, dependencies, watched signals, and the Manager recommendation for movement.

Checkpoint/task relationship:

- A checkpoint owns the question for one phase of the mission.
- Tasks under that checkpoint are the human/team/integration actions needed to answer the checkpoint.
- A task can depend on another task or checkpoint, but it has one primary checkpoint owner.
- Later checkpoints can depend on earlier checkpoints.
- Task results update the linked checkpoint, mission memory, and possibly the mission plan.
- If a task becomes unnecessary, it should be archived or superseded with a memory entry explaining why.

Examples:

- Release mission: "Is the release safe to distribute?"
- Budget mission: "Is there enough evidence to approve spend?"
- Rights mission: "Is ownership clear enough to proceed?"
- Touring mission: "Is city demand strong enough to test a show?"
- Data mission: "Are the required sources connected or uploaded?"

## 7. Run Cadence

- Daily Operating Run: synthesizes all active missions and agent reports into Today's Brief, one directive, flagged items, and priority changes.
- Weekly Strategy Run: reviews artist direction, active missions, source gaps, budget posture, and operating priorities.
- Mission Run: evaluates a specific mission based on pattern, tasks, checkpoints, evidence, reports, permissions, and memory.
- Evidence-Triggered Run: starts when important source data or upload changes.
- Task-Result Run: starts when a task is completed, blocked, rejected, revised, archived, superseded, or missed.
- Conversation Run: starts when the user asks, corrects, approves, rejects, or adds context.
- Review Run: compares a prior recommendation against current state.

Release campaigns can use these generic runs, but release-specific gates are not system infrastructure.

## 8. Evidence And Source Rules

Evidence is contextual, not a top-level destination. Each evidence item must include source, source kind, evidence type, subject, time window, metric/value, lens, freshness, confidence, provenance, limitation, and raw snapshot reference where available.

Different agents may use the same source differently. TikTok may be an attention signal for Marketing, a city-demand clue for Touring, and weak/non-financial evidence for Finance/Rights. Agent reports must state the lens they used.

The system must not claim private saves, source-of-stream, royalty revenue, payout timing, rights certainty, audience conversion, creator ROI, playlist impact, legal ownership, or causation unless supported by connected/uploaded evidence.

## 9. Memory Model

Memory has three practical scopes:

- Artist memory: durable strategy, positioning, constraints, known patterns, do-not-repeat items, and open questions.
- Mission memory: objective, pattern, current state, decisions, task results, checkpoint changes, notes, blockers, evidence gaps, rejected alternatives, recommendation changes, and next review timing.
- Conversation memory: thread-level context, unresolved questions, prior answer state, approvals/rejections, and linked work.

Memory writing should happen after synthesis/action planning, not before. The memory writer should decide what deserves durable storage, attach provenance, and avoid storing speculative claims as facts.

Memory is append-first. The system must not treat memory as one mutable summary blob. It must preserve:

- operating events: what happened
- memory entries: what the system believes matters for future behavior
- generated summaries: readable rollups derived from history
- outcome observations: whether prior decisions appeared to help, hurt, reduce uncertainty, or remain inconclusive
- pattern outcomes: privacy-safe aggregate learning across artists

The raw trail is the source of truth. Summaries can be regenerated or superseded, but source snapshots, messages, runs, reports, task events, task results, reviews, permission decisions, memory entries, and outcome observations must remain append-only.

The product should learn across artists through de-identified pattern outcomes, confidence calibration, and repeated blocker/success patterns. It must not leak one artist's private strategy, unreleased data, financial data, rights documents, or sensitive context into another artist's workspace. Aggregate learning can guide the Manager's questions and risk assessment; artist-specific decisions still require this artist's profile, evidence, memory, constraints, missions, and explicit limitations.

## 10. Human Approval Boundaries

Allowed internal organization without approval:

- create/update mission
- create/update/archive/supersede task with explanation
- create/update checkpoint
- create note
- update memory
- create review
- create draft
- create evidence request
- update daily brief
- prepare specialist referral

Requires explicit user approval:

- spending or budget changes
- contacting third parties
- sending outreach
- submitting distributor, DSP, pitch, or sync materials
- publishing or scheduling content
- changing public release plans
- approving legal, rights, royalty, ownership, or finance conclusions
- deleting important records
- overriding sensitive artist preferences
- making reputationally risky recommendations external

Approval should be represented as permission requests, tasks, draft states, or explicit decision package actions.

## 11. Page And Action Accountability Model

Every page and button must be documented as:

- visible purpose
- dynamic data
- current prototype behavior
- intended production behavior
- data reads
- data writes
- background action
- user-visible result
- failure state
- data lineage for state-bearing copy
- usage/cost provenance when the value came from AI/provider/tool work

The detailed inventory lives in `docs/workflows/page-action-inventory.md`.

## 12. Future Implementation Shape

The initial backend should be built around explicit records and traceable runs, not hidden prompt side effects.

Minimum service boundaries:

- Music service: songs, projects, assets, identifiers, credits, splits, confirmation links, distribution packages, Music readiness, and song/project retrieval.
- Source/evidence service: source snapshots, evidence extraction, provenance, confidence, limitations.
- Agent run service: scheduled/triggered agent runs, agent reports, source limits, and role-specific output.
- Manager synthesis service: report intake, mission-pattern selection, action planning, response generation, and run audit.
- Conversation service: messages, threads, run initiation, and linked artifacts.
- Mission engine service: mission patterns, mission generation, dynamic tasks/checkpoints, mission runs, and mission memory.
- Artifact service: tasks, checkpoints, notes, decision packages, reviews, directives, permissions, referrals, and drafts.
- Memory service: operating events, append-only memory entries, generated summaries, outcome observations, pattern outcomes, and retrieval.
- Permission service: approval-gated states for budget, external action, rights/finance/legal-sensitive decisions, drafts, and public actions.

The implementation can start simple, but these boundaries prevent the product from becoming untraceable AI chat or a hard-coded release checklist.

## 13. Appendix Index

- Schema relationship contract: `docs/workflows/schema-relationship-contract.md`
- Music lifecycle and storage contract: `docs/workflows/music-lifecycle-storage-contract.md`
- Prototype data lineage contract: `docs/workflows/prototype-data-lineage-contract.md`
- State machine contract: `docs/workflows/state-machine-contract.md`
- Prototype coverage matrix: `docs/workflows/prototype-coverage-matrix.md`
- Personalization contract: `docs/workflows/personalization-contract.md`
- Source confidence contract: `docs/workflows/source-confidence-contract.md`
- Mission pattern contract: `docs/workflows/mission-pattern-contract.md`
- Memory and learning contract: `docs/workflows/memory-and-learning-contract.md`
- Proactive agent runs: `docs/workflows/proactive-agent-runs.md`
- Manager conversation router: `docs/workflows/manager-conversation-router.md`
- Mission creation and update: `docs/workflows/mission-creation-and-update.md`
- Task result and checkpoint update: `docs/workflows/task-result-and-checkpoint-update.md`
- Notes, memory, and review: `docs/workflows/notes-memory-and-review.md`
- Daily brief generation: `docs/workflows/daily-brief-generation.md`
- Page action inventory: `docs/workflows/page-action-inventory.md`
- Data source map: `docs/workflows/data-source-map.md`
- Prompt and memory map: `docs/workflows/prompt-and-memory-map.md`
- Workflow-to-schema write contract: `docs/workflows/workflow-schema-write-contract.md`
- V1 operational database schema contract: `docs/workflows/future-schema-notes.md`
