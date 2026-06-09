# Prompt And Memory Map

Purpose: define prompt families and memory write rules needed for a proactive, dynamic mission operating system.

## Shared Prompt Requirements

Every prompt family should receive:

- artist profile
- relevant Music records and Music history when the question, mission, report, or decision concerns a song/project
- relevant artist and mission memory
- source/evidence summaries with limitations
- relevant agent reports
- current conversation or trigger
- active missions and pattern candidates
- allowed output types
- forbidden claims
- approval boundaries
- required structured output where writes are possible
- expected lineage fields for dynamic UI text that the prompt produces
- usage/cost capture requirements for model, provider, and tool calls

Prompt output should separate user-facing prose from machine-readable actions. User-facing prose that reflects state must include enough structured support for the API layer to attach source records, evidence or limitation, run/action provenance, and usage event IDs.

## Agent Run Prompts

Inputs: artist profile, mission context if any, relevant Music items/projects/assets/splits/distribution state, relevant sources, evidence items, source limitations, prior memory, trigger, pending Manager notes for this agent.
Outputs: finding, confidence, evidence used, evidence missing, limitations, risk/opportunity, recommended internal action, permission need, suggested follow-up, notes consumed, note back to Manager, mission candidate if needed.  
Forbidden: full specialist conclusions when required sources are missing; external execution.  
Write permissions: agent report and agent-to-Manager note. Manager synthesis applies downstream writes and decides whether to create missions.
Usage: write `ai_run_usage_events` for model/tool/provider work.

## Manager Synthesis Prompt

Inputs: agent reports, agent notes, artist profile, relevant Music state and Music-scoped memory/events, memory, active missions, mission patterns, mission plans, tasks, checkpoints, notes, evidence, reviews, conversations, permissions.
Outputs: action plan, operating directive, mission create/update/no-write decision, agent mission-candidate accept/reject decision, pattern selection/adaptation, task/checkpoint generation, permission requests, user-facing summary.  
Forbidden: treating one specialist report as final authority without synthesis; executing permission-gated actions.  
Write permissions: internal organization actions after service validation.
Usage: write `ai_run_usage_events` for synthesis, retrieval tools, provider refreshes, and action-generation work.

## Manager Conversation Router Prompt

Inputs: user message, conversation history, active artist, relevant Music state, active missions, mission patterns, tasks, checkpoints, notes, memory, evidence, agent reports, source limitations, agent readiness, permissions.
Outputs: classification, confidence, related artifacts/reports, mission pattern candidate, proposed actions, evidence IDs, limitations, approval requirements.  
Forbidden: creating work by prose only; claiming unsupported source facts.  
Write permissions: may propose conversation, run, memory, task, mission, checkpoint, note, review, draft, referral, permission, or evidence actions. Execution layer applies writes.
Usage: write `ai_run_usage_events` for router/model/tool work.

## Mission Pattern Selection Prompt

Inputs: objective/risk/opportunity, trigger, active missions, relevant Music/non-music subjects, available mission patterns, agent reports, evidence, memory, permissions.
Outputs: selected pattern, adapted pattern fields, ad hoc pattern if needed, rationale, likely agents, evidence needs, task/checkpoint plan.  
Forbidden: forcing release-planning pattern onto unrelated objectives.  
Write permissions: mission pattern selection/adaptation attached to mission plan.

## Dynamic Task And Checkpoint Generation Prompt

Inputs: mission objective, selected/adapted pattern, required evidence, missing evidence, dependencies, risk areas, agent reports, permission boundaries, prior memory, current mission plan if updating.  
Outputs: ordered checkpoint phases, task candidates under each checkpoint, checkpoint dependencies, task dependencies, evidence needs, approval states, review rules, unlock rules.  
Forbidden: generating tasks where no human/team action is needed; creating fixed release phases for non-release missions.  
Write permissions: mission plan version, tasks, checkpoints, evidence requests, permission requests after validation.
Lineage: each generated task/checkpoint must identify why it exists, what source or limitation triggered it, and which run/action created it.

## Decision Package Prompt

Inputs: decision request or proactive decision need, router/synthesis classification, evidence, profile, relevant Music state/history, memory, active work, budget/source constraints, rejected alternatives.
Outputs: direct recommendation, facts, why, rejected moves, work created/updated, evidence links, review condition.  
Forbidden: external execution, unsupported finance/rights/legal certainty.  
Write permissions: decision package and proposed linked work.

## Task Result Interpretation Prompt

Inputs: task, user note, approval state, linked checkpoint, mission plan version, mission context, selected pattern, evidence, agent reports.  
Outputs: normalized status, summary, interpretation, checkpoint effect, downstream dependency effect, mission effect, follow-up, evidence needs, archive/supersede recommendation if relevant.  
Forbidden: treating weak proof as full completion for high-risk work.  
Write permissions: task result, task state event, checkpoint update proposal, memory, review trigger.

## Checkpoint Review Prompt

Inputs: checkpoint question, checkpoint order, upstream/downstream dependencies, required tasks/results, watched signals, evidence, agent reports, decision rule, mission memory.  
Outputs: state, recommendation, blocker, downstream impact, next action, review need.  
Forbidden: asking the user to manually track AI-owned signals when the system should watch them.  
Write permissions: checkpoint update, review, task/evidence request.
Lineage: outputs power the Checkpoint Review surface and must include prior checkpoint result, current inputs, changed records, evidence/limitations, and usage events.

## Mission Memory Update Prompt

Inputs: mission, pattern, mission plan version, new event, task result, checkpoint update, note, review, decision package, agent report, evidence.  
Outputs: operating event when needed, scoped memory entry, summary delta, what changed in task/checkpoint relationships, unresolved questions, next review, possible outcome observation.  
Forbidden: overwriting prior mission history or storing speculation as fact.  
Write permissions: operating events, memory entries, generated summaries, outcome observations.
Lineage: every "what changed" sentence must identify prior state, current state, and changed records.

## Daily Brief Prompt

Inputs: artist profile, artist memory, relevant Music state/history, active missions as supporting context, internal agent reports, tasks, checkpoints, reviews, operating events, evidence freshness, source limitations, permissions, recent reviews/conversations.
Outputs: artist-level headline read, concrete signal proof, Manager interpretation, one daily directive, source/limitations line, evidence links, mission priority changes only when they affect the artist read.  
Forbidden: metric-card dashboard behavior, release-only assumptions, mission-digest framing, visible agent-by-agent commentary, unsupported private analytics, false certainty, generic advice without artist-specific evidence.  
Write permissions: optional brief snapshot, directive, and review/evidence-request triggers only.
Lineage: headline, proof, Manager read, directive, source line, and generated time must each map to source records and run/usage provenance.

## Specialist Referral Prompt

Inputs: original user question or mission need, Manager interpretation, active artist, active mission, relevant evidence, missing evidence, prior recommendations, specialist readiness.  
Outputs: referral context, exact specialist question, expected output, missing-source checklist, Manager-prepared fallback.  
Forbidden: locked specialist conclusions without required sources.  
Write permissions: specialist referral, agent note, source request task.

## Permission Request Prompt

Inputs: proposed action, mission, task/draft/decision, approval boundary, risk, evidence, user-facing explanation.  
Outputs: clear permission ask, consequences of approving/rejecting, editable parameters, expiry/review timing.  
Forbidden: bundling unrelated approvals or implying approval is already granted.  
Write permissions: permission request only.

## Memory Write Rules

Memory should be written only when it changes future behavior. The source of truth is append-only history plus memory entries; generated recaps are views.

Store:

- source or event that caused memory
- scope: artist, mission, conversation, task, checkpoint, source, run, music_item, or music_project
- confidence
- mission pattern where relevant
- expiration or review need where applicable
- reason this should affect future decisions
- whether the entry is fact, interpretation, preference, constraint, risk, blocker, hypothesis, rejected move, or outcome note
- linked operating event, evidence, run, report, message, task, checkpoint, or review

Use generated summaries for readability, but never as the only place where important history or learning exists.

Do not store:

- generic transcript summaries with no future use
- unsupported claims as facts
- sensitive judgments without provenance
- duplicate mission recap text when a structured event is enough
- cross-artist private context as if it were reusable pattern knowledge

Outcome observations should be created when later signals can be compared with a prior recommendation, task, checkpoint, mission plan, or agent report. They must include expected outcome, watched signals, actual signals, confidence, confounders, and causal limitation.

Pattern outcomes are allowed only as privacy-safe aggregate learning. Prompts may use them to calibrate questions and risk, but not as proof that the same move will work for the current artist.
