# Daily Brief Generation Workflow

Purpose: define how Label HQ Today's Brief is generated as the Manager's artist-level daily read from agent reports, Manager synthesis, missions, memory, evidence, tasks, reviews, and user context.

## Trigger

Daily brief generation starts when:

- Daily Operating Run completes
- user opens Label HQ and a brief is stale or missing
- important source evidence changes
- agent reports identify a meaningful risk or opportunity
- mission/task/checkpoint/review state changes enough to alter the day's operating read
- Music state changes enough to alter the artist-level read, release blocker, or priority

The current prototype shows a narrative brief for Sable Day. Night Bus is one important signal inside that artist read, not the owner or structure of the brief.

## Required Context

- artist profile and artist operating memory
- active missions across all patterns as supporting context
- relevant Music state and Music-scoped memory/events when a song/project affects today's read
- current operating directive
- agent reports since the last brief, used internally by Manager synthesis
- mission health, task results, checkpoint state, notes, reviews, and permissions
- source/evidence freshness
- missing evidence limitations
- recent conversations and decisions
- weekly strategy context where relevant

## Source Data

Current prototype sources:

- `artist`
- `evidence`
- `baseMissions`
- `taskRows`
- `missionCheckpoints`
- `missionReview`
- `decisionRecord`
- `missionEvents`
- Label HQ panels and hardcoded narrative copy

Production sources:

- `artist_profiles`
- `memory_entries`
- `operating_events`
- `memory_summaries`
- `agent_reports`
- `manager_synthesis_runs`
- `operating_directives`
- `missions`
- `mission_patterns`
- `tasks`
- `checkpoints`
- `reviews`
- `permission_requests`
- `evidence_items`
- `source_snapshots`
- `decision_packages`
- `conversations`
- source-specific analytics capable of supporting visible metrics and geography claims
- `music_items`, `music_projects`, and linked Music assets/splits/distribution packages when the brief mentions recorded-work state
- `ai_run_usage_events` for AI/provider/tool work used by the daily run

## Classification Logic

The brief is not a generic report, not a mission digest, and not a release-only update. It should choose the most important artist-level operating read for today across all active missions, evidence, memory, and agent reports. Agents contribute in the background; the visible brief is Manager-authored.

- headline read about the artist's current state
- concrete signal proof that explains the read
- Manager interpretation of what the signals mean
- one thing the artist/team should do today
- mission priority changes only when they matter to the artist-level read
- evidence confidence and limitations
- source-backed metric and geography claims
- recent movement that actually changed operating state
- Manager entry point

If there is no meaningful new data, the brief should say what remains true about the artist and what is waiting. It should not invent movement or pad the brief with generic advice.

## Background Steps

1. Run or load the Daily Operating Run.
2. Load recent agent reports, source changes, operating events, and active mission state.
3. Rank artist-level signals by relevance to momentum, risk, opportunity, constraint, and decision timing.
4. Select the few concrete signals that best explain the artist's state today.
5. Identify missing evidence that limits the recommendation.
6. Validate every visible metric, geography, and source claim against evidence capability.
7. Select recent movement from operating events, task/checkpoint changes, source changes, reviews, and agent notes only when it changes the artist read.
8. Generate or update the operating directive.
9. Generate narrative brief with headline read, signal proof, Manager read, one directive, source line, generated time, and limitations.
10. Link evidence drawer, Manager Office, active missions, permission requests, and flagged items.
11. Write usage events for AI/model calls, provider API calls, and billable extraction/tool work.
12. Store generated brief snapshot if production needs history or exact replay.

## Artifacts Created Or Updated

The daily brief may create or update:

- daily brief snapshot
- operating directive
- review trigger if changed evidence/report state affects recommendation
- evidence request task if a critical source gap blocks decision quality
- mission priority marker
- permission request surfacing, not approval
- recent movement feed item sourced from an existing operating event
- usage/cost events for model/provider/tool work

## User-Facing Result

The user sees:

- Today's Brief
- one operating directive
- contextual evidence access
- active mission priorities
- staff/agent readiness
- flagged work and permission requests
- recent movement
- generated time/freshness
- Talk to Manager action

The brief must not become metric cards or a release-only checklist. It should explain the artist's current operating situation in management language and cite source limitations.

Visible structure:

- Headline Read: one strong sentence about the artist's current state.
- Signal Proof: 3-4 source-backed signals with numbers, trend, geography, or concrete source movement.
- Manager Read: short interpretation that connects the signals to the artist's career state.
- Today's Directive: one operating instruction for the artist/team.
- Source line: what the read is based on and what remains limited.

The brief must not show agent-by-agent commentary. Agent reports are internal inputs to Manager synthesis.

Every dynamic text group in the brief must satisfy `prototype-data-lineage-contract.md`: source records, producer workflow, run/action provenance, evidence or limitation, and usage records when billable work was used.

Visible metric rules:

- `tracked streams` requires a connected/uploaded source that actually contains stream counts for the stated window.
- `regional growth` requires geography-capable source data and must name whether the signal is streaming, social, smart-link, comments, or another source.
- social movement such as TikTok hook usage is attention evidence unless paired with saves, clicks, follows, or other conversion data.
- if the source cannot prove the claim, the brief must downgrade the sentence into a limitation or evidence request.

## Failure And Uncertainty Handling

If sources or agent reports are stale, the brief must make limitations clear. If evidence is contradictory, it should surface the conflict and route to Manager review instead of presenting false certainty. If no connected sources exist, it should rely on profile and user-supplied context while asking for priority source setup.

If Daily Operating Run fails, show the last known brief with freshness warning and provide a retry path.

## Approval Boundaries

The daily brief can recommend, organize, and route. It cannot approve spend, submit materials, send outreach, publish content, change public plans, or mark tasks done.

## Schema/API Implications

A future `daily_briefs` or `brief_snapshots` table is optional. More important records are `agent_reports`, `manager_synthesis_runs`, `ai_run_usage_events`, `operating_directives`, `operating_events`, evidence links, Music links when relevant, and mission priority links used to explain why the brief changed.
