# Proactive Agent Runs

Purpose: define how agents run proactively and feed Manager synthesis across any mission pattern.

## Trigger

Agent runs can start from:

- Daily Operating Run
- Weekly Strategy Run
- Mission Run
- Evidence-Triggered Run
- Task-Result Run
- Conversation Run
- Review Run
- manual user request to inspect a specialist perspective
- pending Manager notes or requests in the agent inbox

These are generic run types. A release campaign may use them, but release-specific gates are not core infrastructure.

## Agent Roles And Lenses

### Manager

Lens: prioritization, synthesis, decision quality, mission/task orchestration, permission requests.  
Output: synthesis, directive, decision package, mission plan/update, review, permission request.  
Authority: final coordinator for internal organization.

### Marketing Lead

Lens: audience, content, creators, campaign fit, creative angle, spend-readiness.  
Output: marketing report, content/campaign risks, creator opportunities, source gaps.  
Source use: social signals, campaign history, smart-link data, comments, content performance.
Music use: focus song/project, approved assets, source limits, lifecycle stage, and linked campaign mission context.

### Sync & Deals

Lens: rights-readiness, pitch assets, brand fit, sync/deal opportunity, deal-risk.  
Output: readiness/risk report, missing materials, pitch-prep recommendation.  
Source use: rights documents, pitch assets, catalog metadata, audience proof.
Music use: Music assets, clean/instrumental/stems status, identifiers, credits, splits, confirmation state, and pitch package readiness.

### Touring Agent

Lens: city demand, live-readiness, routing, venue/promoter fit.  
Output: city validation report, live-readiness risk, routing opportunity.  
Source use: geography, comments, streaming location, ticketing/live history, venue notes.
Music use: song/project signal as context only; do not treat Music state as live demand without geography or live-market evidence.

### Finance/Rights

Lens: budget, royalty, splits, payout timing, ownership risk, metadata hygiene.  
Output: finance/rights readiness report, risk memo, missing proof request.  
Source use: budget context, royalty statements, split sheets, distributor metadata, payout data.
Music use: splits, split confirmations, rights documents, distributor events, royalty/payout evidence, metadata hygiene, and ownership limitations.

## Locked Agent Limits

Locked or source-incomplete agents can produce limited readiness/risk reports only. They may say what is missing, what is directionally suggested by available sources, and what the Manager can safely prepare. They may not issue full specialist conclusions when required sources are missing.

Example: Finance/Rights can say "split sheet missing blocks confidence." It cannot conclude royalty health without royalty statements.

## Report Format

Each agent report must include:

- agent
- trigger
- mission_id if mission-specific
- mission_pattern if relevant
- finding
- confidence
- evidence used
- evidence missing
- limitations
- risk or opportunity
- recommended internal action
- permission required, if any
- suggested follow-up run or review timing
- notes consumed from Manager, if any
- notes sent back to Manager, if any

## Agent Inbox And Outbox

Agents should have an inbox/outbox relationship with the Manager.

Manager-to-agent notes:

- can be mission-specific or artist-wide
- may contain questions, source requests, context, prior Manager concerns, or instructions for the next run
- do not require an immediate agent response unless the active conversation needs one now
- should be consumed on the agent's next relevant run

Agent-to-Manager notes:

- summarize what the agent found, what evidence was used, what is missing, and what the agent recommends
- can be mission-specific or artist-wide
- may propose a task, checkpoint update, evidence request, review, permission request, or mission candidate
- should feed Manager synthesis rather than directly changing the operating plan

The best authority model is: agents can propose mission candidates, but the Manager creates or updates missions. This prevents separate agents from fragmenting the artist's operating plan.

## Manager Synthesis

Manager synthesis reads agent reports alongside artist profile, relevant Music state/history, operating memory, missions, tasks, checkpoints, notes, evidence, reviews, conversations, and permissions.

The Manager decides whether to:

- do nothing
- update Today's Brief
- create or update mission
- accept or reject an agent-proposed mission candidate
- select/adapt mission pattern
- create/update/archive/supersede task
- create/update checkpoint
- create note
- update memory
- trigger review
- request evidence
- create draft
- create permission request
- answer or ask a clarifying question

Specialist reports inform the Manager. They do not directly execute or override the operating plan.

## Mission Awareness

Agent runs can be artist-wide or mission-specific.

Artist-wide runs look for new risks, opportunities, source gaps, and strategic shifts.

Mission-specific runs evaluate a mission through the selected pattern/playbook. The same source can support different agent lenses. For example, TikTok comments may be:

- marketing evidence for creator/content fit
- touring evidence for city demand if locations are visible
- weak finance evidence because attention does not prove revenue
- Manager evidence for whether a validation mission deserves more work

## Failure And Uncertainty Handling

If source confidence is low, the report must say so and recommend evidence intake instead of a strong action. If agent reports conflict, Manager synthesis should create a review or narrow next task rather than hiding the conflict. If a run fails, the daily brief and mission surfaces should show stale/limited status where relevant.

## Approval Boundaries

Agents may recommend and organize internal work through Manager synthesis. Permission is required before spend, external outreach, submissions, publication, public release-plan changes, legal/financial/rights conclusions, sensitive commitments, or deletion of important records.

## Schema/API Implications

Required candidates:

- `agent_runs`
- `agent_reports`
- `manager_synthesis_runs`
- `operating_directives`
- `permission_requests`
- mission links from runs/reports
- evidence links from reports
- `ai_run_usage_events` for every billable model, provider, or tool invocation

Run records should be auditable and should distinguish `artist_wide`, `mission_specific`, `conversation`, `task_result`, `evidence_triggered`, `daily`, `weekly`, and `review` triggers. Usage records should make per-usage billing explainable by workflow, agent, mission, song/project, provider, status, and cost estimate.
