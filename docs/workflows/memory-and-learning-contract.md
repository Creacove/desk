# Memory And Learning Contract

Purpose: define how the operating system preserves artist intelligence without overwriting the history needed to learn what actually moved work forward.

This is not a full event-sourcing mandate for V1. It is a minimum audit and learning contract: keep the raw trail append-only, derive summaries from it, and record outcomes so future Manager and agent decisions can improve without leaking one artist's private context into another artist's workspace.

## Core Doctrine

Memory is not a mutable profile blob.

The system must separate:

- operating history: what happened
- interpreted memory: what the system believes matters for future decisions
- generated summaries: readable recaps derived from history and memory
- outcome learning: what later evidence suggests worked, failed, or remains unclear

If these layers collapse into one editable summary, the product loses the ability to explain decisions, audit mistakes, reverse bad assumptions, or learn across artists.

## Memory Layers

### 1. Operating Events

Append-only records of important product activity. Examples:

- source connected, disconnected, synced, or failed
- evidence item created or invalidated
- conversation message received
- Manager run completed
- agent report produced
- mission created, updated, archived, or superseded
- mission plan version created
- checkpoint state changed
- task created, approved, completed, blocked, skipped, archived, or superseded
- permission requested, approved, rejected, revoked, or expired
- recommendation changed
- work draft created or revised

Operating events answer: what happened, when, who/what caused it, and which artifact changed?

### 2. Memory Entries

Append-only interpreted records that explain why an event matters. They may be scoped to artist, mission, conversation, task, checkpoint, source, or agent run.

Memory entries answer: what should the Manager or an agent remember next time?

Every memory entry must include:

- scope, including artist, mission, conversation, task, checkpoint, source, run, music item, or music project
- content
- source object
- source type
- confidence
- whether it is fact, interpretation, preference, constraint, risk, blocker, hypothesis, rejected move, or outcome note
- created-from run or user action
- reason it should influence future behavior

### 3. Memory Summaries

Generated readable rollups derived from memory entries and operating events. They may be updated for usability, but previous versions must remain recoverable or the summary must be regenerable from append-only inputs.

Memory summaries answer: what does the user or Manager need to understand quickly?

Summaries are convenience views, not source of truth. A summary can be stale, wrong, or incomplete; the raw event and memory trail remains authoritative.

### 4. Outcome Observations

Records that compare a prior recommendation, task, checkpoint, mission, or campaign move against later evidence.

Outcome observations answer: did this appear to move the artist forward, hurt progress, reduce risk, expose a false assumption, or remain inconclusive?

Every outcome observation must include:

- linked recommendation, mission, checkpoint, task, review, or agent report
- expected outcome
- review window
- watched signals
- actual observed signals
- confidence
- confounders
- causal limitation
- learning note
- whether it is artist-specific only or eligible for aggregate pattern learning

The system must not claim causation from correlation. It can say a move coincided with better evidence, reduced uncertainty, or matched a pattern, but causal claims require stronger support.

### 5. Pattern Outcomes

De-identified or privacy-safe aggregate records used to improve future decisions across artists.

Pattern outcomes answer: under which artist context, mission pattern, evidence quality, budget band, market, and constraint set did a recommendation tend to work or fail?

Pattern outcomes should store segment attributes, not private artist identity by default:

- artist stage
- market/region
- genre/lane
- budget band
- source completeness
- audience signal type
- mission pattern
- action type
- permission boundary
- confidence before action
- outcome class
- confounders

Private artist data, rights documents, financial statements, unreleased strategy, and sensitive reputation context must not become cross-artist learning material unless the product has explicit permission and a safe aggregation path.

## No-Overwrite Rules

These records are append-only:

- source snapshots
- evidence items
- conversation messages
- agent runs and reports
- Manager synthesis runs and actions
- operating events
- task state events
- task results
- reviews
- permission decisions
- memory entries
- outcome observations

These records may be revised only through versioning, supersession, or regeneration:

- artist profile fields
- mission plans
- mission summaries
- memory summaries
- recommendations
- operating directives
- work drafts
- mission pattern versions

When the system changes its mind, it creates a new record or marks the old record superseded. It does not silently rewrite history.

## Learning Loop

1. Product activity creates operating events.
2. Manager or agent runs create interpreted memory entries when the event changes future behavior.
3. The memory service updates generated summaries from append-only inputs.
4. Reviews compare prior recommendations against current evidence.
5. Outcome observations record what happened after the decision, including uncertainty and confounders.
6. Eligible observations become privacy-safe pattern outcomes.
7. Manager synthesis and agent prompts may use pattern outcomes as weak guidance, never as artist-specific proof.

## Artist-Specific Use

For the active artist, the Manager should retrieve:

- durable artist memory
- relevant Music-scoped memory and recent Music events when a song/project is part of the question or mission
- mission memory for relevant missions
- recent operating events
- prior recommendations and outcomes
- do-not-repeat rules
- known constraints
- source completeness
- pattern outcomes only as contextual guidance

The answer must still be grounded in this artist's profile, evidence, memory, current missions, and limitations. Aggregate learning can guide questions and risk assessment; it cannot replace artist-specific evidence.

## Cross-Artist Learning Boundaries

Allowed without exposing private artist context:

- aggregate pattern performance
- evidence-quality heuristics
- common blocker patterns
- common task/checkpoint sequences that reduce risk
- source freshness expectations
- confidence calibration

Not allowed without explicit policy and permission:

- copying one artist's private strategy into another artist's workspace
- using unreleased catalog, rights, finance, or private analytics as public pattern proof
- training recommendations on sensitive personal context without governance
- claiming that an action will work because it worked for another artist

## Minimum V1 Schema

The first backend does not need a complex learning platform. It needs enough structure to avoid destroying future leverage:

- `operating_events`
- `memory_entries`
- `memory_summaries`
- `outcome_observations`
- `pattern_outcomes`

These sit beside existing source snapshots, evidence, runs, reports, tasks, checkpoints, reviews, and permissions.

## Acceptance Checks

- A developer can reconstruct why a mission, task, checkpoint, recommendation, or memory changed.
- A memory summary can be regenerated without losing the original trail.
- A task result can be traced to checkpoint effect, mission effect, review effect, and memory entry.
- A prior recommendation can be compared to later evidence.
- The system can say "this is inconclusive" instead of inventing causation.
- Cross-artist learning uses aggregate, de-identified pattern outcomes unless explicit permission and governance exist.
- No important AI or user decision is stored only in a mutable summary.
