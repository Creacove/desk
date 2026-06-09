# AI Record Label PRD

Document purpose: founding product and engineering brief for a clean new repo  
Product: Other Sounds AI Record Label  
First active agent: AI Manager  
Status: living PRD aligned to the standalone prototype as of May 12, 2026

## How To Use This Document

This document must be understandable without any prior conversation, previous repository, or existing database. Use it to start a new implementation discussion in a clean codebase and a clean Supabase project.

The current standalone prototype is the source of truth for the UI contract. When this PRD and the prototype disagree about visible flows, screen behavior, or interaction hierarchy, update this PRD to match the prototype unless the product direction has intentionally changed.

The product should feel ambitious enough to be a venture-scale company, but focused enough to ship a compelling V1. V1 proves the full AI record-label concept through one excellent active agent: the AI Manager.

## Current Prototype Sync - May 12, 2026

The current prototype is a standalone React/Vite front-end. It does not include backend source code, API routes, database migrations, authentication, connector adapters, or server-side persistence in this repository. Backend sections in this PRD therefore describe the implementation contract for the next build, not functionality already present in the prototype.

The visible prototype contract is:

- Brand name in the app chrome is `Ordersounds`.
- The first-run flow has two steps: `Step 1 / Identity` and `Step 2 / Context`.
- Step 1 centers a selected Spotify identity for Sable Day and advances with `Continue to Context`.
- Step 2 collects artist name, Spotify identity, artist stage, home market, genre, current goal, active release, monthly budget, TikTok, Instagram, YouTube, and X.
- Setup explicitly warns that private analytics, save rate, payouts, and conversion will not be available until connected or uploaded.
- After setup, the user enters `Label HQ`.
- The durable post-setup sidebar contains `Label HQ`, `Staff`, `Missions`, and bottom-pinned `Settings`. Manager is not a top-level nav item. Evidence is not a top-level nav item. Review is not a top-level nav item.
- `Settings` currently opens the Artist Profile workspace.
- Label HQ contains a top title, `Today's Operating Read`, `The Staff`, `Active missions`, and `Intelligence Alerts`.
- Music is a first-class workspace for recorded work. It shows `Songs` and `Projects`, song lifecycle, files, details, rights, split confirmations, distribution readiness, linked missions/tasks/evidence, and project tracklists.
- `Today's Brief` is a full narrative brief, not an expandable brief and not a metric-card dashboard.
- The prototype's primary active mission is a Release War Room mission: `Release Night Bus on June 12`.
- The Manager creates that mission from the user request `I want to drop a new song next week` and changes the plan by moving the release to `Friday, June 12, 2026` to protect delivery, DSP pitching, creator seeding, press, rights/metadata QA, and launch execution.
- `The Staff` shows five agents: Manager online, plus Marketing Lead, Sync & Deals, Touring Agent, and Finance/Rights locked.
- Intelligence alerts and mission surfaces should point to release-room blockers, including split sheet approval, distributor delivery, creator outreach, press/EPK readiness, and post-release signal reads.
- Active missions show compact mission rows/cards with progress, review point, task count, checkpoint count, and note count.
- The Missions workspace must make the operating feedback loop visible through `Tasks`, `Checkpoint Review`, `Notes`, and `Memory`. These are not separate boards; they are connected inputs into the next Manager review.
- Mission history should be presented as `Memory`, a living mission recap that explains what happened across tasks, checkpoints, notes, decisions, blockers, evidence gaps, and the next Manager review.
- User-facing tasks must be plain artist/team actions, such as `Confirm split sheet`, `Submit Spotify for Artists pitch`, `Build TikTok creator target list`, `Prepare press angle and EPK`, `Approve launch-week content pack`, or `Verify release live across platforms`. Do not assign humans vague analytics work unless the UI explains exactly what to open, upload, approve, contact, decide, or verify.
- Task completion must produce task results, not just a done state. The AI should interpret task results in the background and feed mission checkpoints, mission reviews, and mission memory.
- Blocked or weak task results must be visible as Manager reviews and may revise tasks, change checkpoints, move mission dates, or change the mission path.
- Internal validation tests may exist as rules and scoring logic, but `Checkpoint Review` is the primary user-facing surface for AI-owned progress checks. A checkpoint is not a human task.
- Agent-to-agent communication is shown as read-only `Notes`, not an approval queue. Users can inspect notes; they do not approve notes unless the note creates a human-facing task, draft, budget action, or external recommendation.
- Artist profile remains visible user context. Artist operating memory is a deeper AI-readable memory layer that should influence decisions without becoming a generic visible profile page.
- Recent conversations are passed into Label HQ and Manager Office and remain first-class thread objects.

Backend implementation must mirror this prototype contract. Do not add backend concepts that create different primary navigation, a generic dashboard, a global Evidence page, or a top-level Manager area unless the prototype is intentionally changed first. Every dynamic prototype value must trace to source database records, producer workflow, run/action provenance, and evidence or limitation; AI/provider/tool work must also trace to usage and cost records.

## 1. Executive Summary

Other Sounds AI Record Label is an artist-first operating system that gives an artist a digital label team.

It is not:

- a Spotify analytics dashboard
- a generic AI chatbot
- a royalty tracker
- a BI workspace
- a creator-content dashboard
- a passive reporting tool

It is:

> A digital record label team that watches the artist, interprets career signals, creates work, and helps the artist or team decide what to do next.

V1 presents the full AI record-label hub, but only the AI Manager is active. Future agents are visible and locked: Marketing Lead, Sync & Deals, Touring Agent, Finance/Rights, and other specialist roles.

The AI Manager is an in-app operator. It investigates signals, makes management-grade recommendations, creates missions, tasks, tests, department briefs, artist check-ins, drafts, and decision records, then follows up when evidence changes.

Core standard:

> Every Manager output should help the artist team decide, act, and learn.

## 2. Product Vision

The long-term product is an AI record label. The artist gets a team of specialist AI agents, each with its own tools, playbooks, evidence needs, and work products.

The Manager is the first active department. It is the artist's day-to-day management interface and general strategist. It does not own or boss every future agent. When a future specialist is better suited to a question, the Manager should refer the user to that agent or create a department brief if the agent is still locked.

Primary positioning:

> Your AI record label, starting with your AI Manager.

Manager-specific positioning:

> The artist manager in your pocket: decision-grade intelligence, real work products, and active follow-through for every release, campaign, market, and career decision.

## 3. Product Principles

### Simple Surface, Deep System

The user should see a calm, premium operating room. Underneath, the system runs playbook-based reasoning, evidence provenance, cross-platform signal interpretation, scoring, memory, work-product creation, and quality gates.

### Action Over Analysis

Every serious answer must create or update at least one operational artifact unless the answer is explicitly advisory:

- mission
- task
- test
- department brief
- artist check-in
- work draft
- decision record
- follow-up review

### Artist-First, Evidence-Aware

The Manager must protect:

- artist goals
- artist positioning
- artist capacity and wellbeing
- creative focus
- ownership and rights
- budget
- long-term leverage

It must not optimize a short-term metric in a way that damages the artist's career.

### No False Authority

The Manager must not claim:

- private Spotify for Artists analytics unless connected or uploaded
- private Instagram, TikTok, YouTube, or X metrics unless authorized or provided
- causation from correlation
- conversion from attention alone
- live-market readiness from social chatter alone
- rights ownership certainty without source documents
- legal, financial, medical, or contractual conclusions as final authority

### Human In Command

The Manager can create, recommend, challenge, and organize. The human approves anything external, expensive, sensitive, legal, financial, reputational, or artist-wellbeing related.

## 4. Target Users

Primary users:

- independent artists without full teams
- artist managers who need sharper operating intelligence
- small labels and rights holders who need management-grade decisions
- artist teams who need one active operating layer around an artist

Secondary future users:

- marketing leads
- A&R teams
- DSP/playlist teams
- touring agents
- rights/admin teams
- finance/business managers
- artist-owned labels

V1 should stay artist-first. Even if a label or manager has multiple artists later, every Manager Office is scoped to one active artist.

## 5. Demo Goal

The V1 demo should create a "this must exist" reaction.

Ideal demo flow:

1. User creates an artist profile in under two minutes.
2. User selects or connects the artist's Spotify identity.
3. User adds TikTok, Instagram, YouTube, and X handles if available.
4. User enters a premium Label HQ operating room.
5. User sees the artist identity, Today's Brief, one operating directive, The Staff, active missions, and the Flagged for you queue.
6. User can inspect supporting evidence, open a mission, handle a flagged item, open Settings, or enter the Manager Office.
7. User opens the Manager Office when they want to talk through a decision.
8. User answers required Manager context questions before asking for a decision.
9. User can reopen recent conversation threads directly under Ask Manager and continue inside the selected thread.
10. User asks a real management question:
   - "We have $5,000. What should we do this month?"
   - "Should we drop the video next week?"
   - "Is this TikTok attention real momentum?"
   - "How should we plan this release?"
11. Manager investigates, shows progress, answers with a decision and execution package.
12. Manager creates missions, tasks, tests, briefs, and a decision record.
13. User opens the connected mission workspace to inspect the selected mission, its work lanes, approval state, evidence, and review trigger.
14. User can approve, edit, reject, override, continue a conversation thread, or answer Manager follow-up questions.

The demo should not feel like a dashboard with a chat box. It should feel like the artist walked into a serious label office built around them.

## 6. Research Synthesis

Elite artist managers are 360-degree operators. They help with strategy, release planning, tours, marketing, A&R, business decisions, finance, legal coordination, publishing, PR, digital marketing, international markets, IP, team coordination, artist wellbeing, and long-term leverage.

The AI Manager should not copy any individual manager. It should distill durable management patterns:

- sit at the table with the artist and understand what success means for that artist
- protect the artist from unfocused decisions
- coordinate across departments without pretending to replace specialists
- turn weak and fragmented signals into careful tests
- build operating discipline around releases, campaigns, budget, markets, and audience
- preserve cultural positioning and long-term leverage
- know when to say no, wait, test, scale, or refer to a specialist

Data reality:

- platform data is fragmented and uneven
- public APIs do not always expose the most valuable private analytics
- social attention can appear before streaming or revenue signals
- fan data is scattered across platforms, partners, exports, and providers
- every evidence item needs provenance, freshness, confidence, and limitations

## 7. Agent Team Model

### Shared Artist Context

All agents use the same shared foundation:

- Artist Operating Profile
- source connections
- raw source snapshots
- Evidence Graph
- missions
- tasks
- tests
- department briefs
- decision records
- work drafts
- artist check-ins
- user overrides
- specialist memos
- memory

No agent owns the data. Sources produce evidence. Agents use evidence through their own playbooks, tools, and decision rules.

### AI Manager

The AI Manager owns day-to-day career management:

- priorities
- operating rhythm
- broad strategy
- plan review
- artist check-ins
- mission creation
- task/checkpoint follow-up
- department briefs while other agents are locked
- referral to future specialist agents

It can answer broad strategic questions directly. It should not pretend to have specialist tooling that belongs to future agents.

### Specialist Agents

Future agents include:

- Marketing Lead
- Sync & Deals
- Touring Agent
- Finance/Rights
- future specialist agents

Each specialist agent must have:

- agent profile
- capabilities
- connected sources
- required sources
- optional sources
- compact upload/connect actions
- tools
- playbook
- unlock state
- referral intake format
- output types
- specialist memory/briefs
- relationship to shared evidence

When active, specialists can answer directly, receive referrals, send helpful briefs into shared artist and mission memory, create domain-specific work products, cite evidence and limitations, and recommend another agent when appropriate.

## 8. Core Product Model

### Artist Profile

The primary unit is one Artist Profile, not a workspace.

Required fields:

- artist id
- artist name
- canonical Spotify artist id or selected identity
- aliases
- genre(s)
- home market
- current stage: emerging, developing, breakout, established, legacy/catalog
- positioning statement
- current goals
- active releases
- active campaigns
- current strategy
- known constraints
- budget context if provided
- team roles available
- connected sources
- social handles

Recommended fields:

- artist values and non-negotiables
- creative references
- audience thesis
- key markets
- live history
- release cadence
- brand/partnership constraints
- rights ownership notes
- prior recommendations
- open risks
- open tasks
- do-not-do list

Behavior:

- Profile updates should be versioned or audit-logged.
- User-provided context should be labeled as user-supplied evidence.
- The Manager must cite profile assumptions when using them.
- The Manager should ask for missing profile context only when it materially affects a decision.

### Label HQ

After setup, the user enters Label HQ: the daily operating room for the artist.

The hub asks:

> What is happening with this artist today, what is flagged for review, and which operating object should we open next?

V1 roster:

- AI Manager: active
- Marketing Lead: locked
- Sync & Deals: locked
- Touring Agent: locked
- Finance/Rights: locked

Locked agents must show:

- what the agent will do
- connected sources already available inside that agent
- minimum required sources before activation
- optional sources that improve the agent's specialist read
- compact upload/connect actions for those sources
- future tools/capabilities
- whether a limited Manager brief is possible today

## 9. UX Requirements

### Overall UX Standard

The product should feel like a Modern Label HQ:

- premium
- calm
- serious
- artist-centered
- operational
- focused
- not gimmicky
- not a generic SaaS admin panel
- not a creator dashboard
- not a blank AI chat

### First-Run Setup

Required:

- artist name
- selected Spotify identity

Recommended:

- TikTok handle
- Instagram handle
- YouTube channel
- X handle
- artist stage
- home market
- genre
- current goal
- active release
- budget if relevant

Setup behavior:

- setup is two explicit steps: `Step 1 / Identity` and `Step 2 / Context`
- user advances from the selected identity screen with `Continue to Context`
- user can `Skip for now` or `Enter Workspace` after context entry
- interface explains which decisions are limited without private analytics, save rate, payouts, and conversion
- social auth is not required in V1
- manual uploads are offered for teams with exports

### Label HQ

Label HQ is the main V1 product surface. It should open as the artist's daily operating room, not as an agent directory.

Required zones:

- Durable Sidebar: Label HQ, Staff, Missions, and bottom-pinned Settings only. Manager is not a top-level nav item; it is an active agent/action inside HQ or Staff.
- Page header: `Label HQ` with `Your daily operating picture.`
- Today's Brief: a prose-led label-wide readout about the artist's current career situation, with direct Manager entry
- One Thing To Do Today: one clear operating callout inside the brief
- The Staff: Manager online, Marketing Lead, Sync & Deals, Touring Agent, and Finance/Rights locked
- Active Missions: current objectives and work in progress
- Flagged For You: approvals, uploads needed, reviews due, and changed recommendations
- Evidence affordances: source/proof access stays contextual to briefs, agents, missions, and drawers instead of becoming a global nav destination

The first impression should be: "the label already knows what is happening with my artist today." The user should not have to open boards, tables, or an agent office to get value.

Missions, tasks, tests, and records are label operating memory first and inspectable user surfaces second. They can be created by the Manager in V1, but they belong to the Label HQ operating layer because future agents will also contribute to them.

The morning brief must not be a grid of metric cards. It should read like a concise label-written brief:

- a short headline for the day's situation
- 1-2 tight paragraphs explaining what is happening across connected sources
- inline metrics woven into the prose
- city movement, TikTok/video lift, revenue or royalty caution, and the main risk
- a final "what matters today" sentence or callout
- a subdued evidence/source line that makes clear where the read came from
- contextual supporting-evidence access
- no expandable "Read full brief" behavior is required in the current prototype

Prototype morning brief content currently centers on Sable Day / Night Bus:

- headline: "Momentum is building. Spend isn't cleared yet."
- total tracked streams: 128,400
- Atlanta remains the center
- Chicago is up 31% week over week
- Lagos comments repeat the same Night Bus lyric
- TikTok hook use is 4.8x above baseline
- YouTube comments show release intent
- strongest angle: late-night transit hook
- weakest angle: generic heartbreak copy
- private Spotify saves, source-of-stream, smart-link clicks, and royalty statements are missing
- recommendation: keep the content sprint going, cap spend at $1,850, and let the 72-hour review decide whether to scale

The Staff must keep the label-team model visible without turning the homepage into an agent directory:

- desktop: visible below the brief as a five-agent staff row/grid
- mobile: horizontally scrollable strip
- Manager opens the Manager Office
- locked agents open their department detail/unlock surface
- agent cards are staff controls, not homepage hero cards

The persistent post-setup navigation should remain small and durable:

- Label HQ: daily operating room
- Staff: label team roster, agent readiness, and department entry points
- Missions: operating objects and their work lanes
- Settings: currently opens the Artist Profile workspace

Do not add top-level Manager, Evidence, Review, Dashboard, Artist Profile, Catalog, or Finance navigation unless those become true product areas. Evidence belongs inside the agent/mission context that uses it. Review belongs inside mission records.

### Manager Office

The Manager Office is a focused conversation and decision room. It should not contain the global morning brief, active missions list, Flagged for you queue, or broad label-team operating status.

Required zones:

- Manager conversation room header
- Manager positioning/context panel
- Manager questions before context is ready
- Ask Manager composer after context is ready
- recent Manager conversation threads
- route into Manager run, decision package, and thread continuation

The Ask Manager area is gated by required context questions. Before context is complete, the Manager asks for missing artist/team information. After context is ready, the user sees:

- topic chips for Budget, Momentum, Release, and Revenue
- a management question composer
- recent conversation rows under the composer
- each recent conversation row includes topic, last update, status/outcome, and Continue
- Continue opens the conversation thread, not a prefilled composer

### Conversation

Conversation should feel like entering the Manager's office.

Required behavior:

- user asks a management question or brings a plan
- Manager shows investigation progress
- Manager answers with decision and execution package
- work products appear as side/inline objects
- user can approve, edit, reject, archive, assign, or mark done
- Manager can ask contextual questions and update memory from the reply

Conversation history is a first-class product surface, not only an input convenience. The current prototype includes a Conversation Workspace with:

- a left-side list of all conversations
- a selected conversation thread on the right
- prior user questions and Manager answers
- a thread summary
- a related mission action
- a "Continue this thread" composer
- follow-up messages appended to the selected thread

Recent conversations must not populate the Ask Manager input. They must open the selected conversation so the user can review and continue the thread in context.

The prototype's current recent conversation set includes:

- Night Bus budget allocation
- TikTok momentum check
- Rights and royalty evidence gap

### Manager Answer Package

After a Manager run, the answer should not look like a generic chat response. It should be a decision package with:

- original user question
- direct Manager answer
- budget/action facts
- why this call
- rejected moves
- work created
- mission link
- evidence link
- review/schedule action
- "Open thread" to continue from the decision context

Prototype budget answer:

- use $1,850 for a 10-day Night Bus validation test
- hold back $2,250 until the 72-hour signal review
- do not fund a full video or full paid-media push yet
- create/open the mission "Validate Night Bus before scale spend"

### Missions Workspace

The Missions Workspace should feel like a connected operating surface for the selected mission, not a loose collection of cards.

Required structure:

- left mission stack for selecting missions
- selected mission detail surface on the right
- mission status, review point, summary, and mission health
- integrated work lanes for Tasks, Checkpoint Review, Notes, and Memory
- current operating read explaining how the lanes connect to the Manager's decision

The selected mission should visually dominate the workspace. The mission list is navigation; the mission detail is the working object.

### Tasks, Checkpoint Review, Notes, And Memory

Tasks are owner-ready work items with purpose, dependency, linked evidence, approval state, steps, and completion notes. Tasks that require approval cannot be marked done until approved.

Checkpoints are AI-owned progress checks tied to the mission and, where relevant, linked to specific tasks. Checkpoints can be powered by internal validation tests, but the visible user surface must be `Checkpoint Review`.

Checkpoint Review must show:

- the plain-language question being checked
- status: Waiting for setup, Watching signal, Needs review, Met, or Needs change
- linked task when a human action unlocks the checkpoint
- what the AI is watching
- decision rule or next review rule
- explicit language that the user does not need to track analytics manually

Budget approval remains a task. A checkpoint can say the budget cap is still waiting, but the human-facing action must live in Tasks.

Notes are helpful agent-to-agent communications created by Manager runs, specialist runs, or mission activity. They should read like clear operational handoffs, not complaint threads, generic memos, or approval cards.

Notes must show:

- sender and recipient, such as Manager -> Marketing Lead or Finance/Rights -> Manager
- note type, such as request, run finding, source request, or future specialist request
- what was asked, found, or handed off
- why it matters
- evidence used
- linked mission
- resulting change: Filed to memory, Created task, Updated checkpoint, or No action yet
- status and export affordance

Notes are read-only in the mission UI. Users do not approve agent-to-agent notes. If a note produces a human-facing action, the Manager creates a task, draft, budget request, or external recommendation for approval.

Memory is the living AI-readable recap for the selected mission. It combines goal, current state, task updates, checkpoint status, note updates, review events, decisions, blockers, evidence gaps, what would change the recommendation, and next review timing. Review / What Changed is not a top-level destination; it becomes part of Memory when new evidence changes or confirms the recommendation.

Memory should read like a mission intelligence note, not a grid of fields. It should explain what happened, what the task/checkpoint/note activity changed, what is still unresolved, and what the next useful move is. Dense proof can sit at the end, but the main record should be readable in prose.

### Evidence Drawer And Contextual Sources

Evidence Drawer must show:

- source
- evidence type
- subject
- time window
- metric/value
- lens
- freshness
- confidence
- provenance
- limitations
- raw snapshot reference when available

It should be readable by a manager, not only an engineer.

Evidence is contextual. Each agent room owns its source readiness: connected sources, required sources, optional sources, and upload/connect actions. Finance/Rights requires royalty statements and split sheets before the agent can answer specialist finance/rights questions. Sync & Deals requires rights clarity and pitch assets before deal or sync opportunity work can be treated as credible.

## 10. Referral Experience

When the Manager detects that a question belongs to a specialist, it should route gracefully.

Example:

User asks:

> Why did revenue drop this quarter?

Manager response:

> This is mainly a Finance/Rights question. I can give a directional read from available campaign and catalog evidence, but the Finance/Rights agent can inspect royalty statements, splits, payout timing, ownership, and revenue sources. I will prepare the Finance/Rights context: active release, recent campaign, Track A focus, and the revenue concern.

If the specialist is active, the specialist room opens with context already loaded. If locked, the Manager creates an AgentNote and explains unlock requirements.

Referral context must include:

- original user question
- Manager interpretation
- active artist
- active mission
- relevant evidence
- missing evidence
- prior recommendations
- exact specialist question
- expected output

## 11. Evidence Architecture

### Core Principle

Sources produce evidence. Agents use evidence through playbooks.

Agents must not directly reason from raw connector payloads unless the raw payload has been normalized, labeled, and stored as evidence.

### Raw Source Snapshots

Raw snapshots store:

- source
- source connection
- retrieval/upload time
- reporting window
- raw payload/file reference
- data type
- user/source owner
- known limitations

Raw snapshots are preserved because one raw file or API response can produce many evidence items, and future agents may normalize the same raw source differently.

### Evidence Items

Each Evidence Item must include:

- evidence id
- artist id
- source
- source connection id
- source kind: real API, uploaded, provider-derived, mock/demo, user-supplied
- evidence type
- subject type: artist, track, release, video, post, market, campaign, rights item, finance item, recommendation
- subject id/name
- time window
- metric name
- metric value
- trend/comparison when available
- lens
- confidence score
- freshness
- provenance
- limitations
- raw snapshot reference
- normalization version

### Evidence Lenses

Attention:

- views
- impressions
- likes
- comments
- reposts
- reach
- mentions
- public conversation
- surface engagement

Participation:

- user-generated content
- sound reuse
- duets/stitches/remixes
- fan edits
- creator uptake
- repeated comments
- audience imitation
- challenges or memes forming

Conversion:

- streaming lift
- saves
- follows
- subscribers
- repeat listens
- playlist additions
- source-of-stream change
- YouTube watch depth
- email signups
- smart-link clicks
- pre-saves
- ticket waitlist
- merch purchase

Leverage:

- evidence strong enough to justify spend
- evidence strong enough to justify release timing
- evidence strong enough to justify collaborator outreach
- evidence strong enough to justify press or DSP push
- evidence strong enough to justify market focus
- evidence strong enough to justify live validation

Risk:

- one-platform dependency
- short-lived spike
- bot/fake playlist suspicion
- weak ownership/rights metadata
- budget concentration
- artist burnout
- strategy drift
- conflicting department incentives

Context:

- artist stage
- genre norms
- market/cultural context
- team capacity
- budget
- calendar
- release runway
- prior decisions

## 12. Source Capability Maps

The Manager requests evidence capabilities, not raw endpoints. This keeps the product provider-flexible and prevents the AI from improvising platform API behavior.

Each source capability must define:

- source name
- capability name
- description
- available in V1: yes/no/partial
- access mode: public, OAuth, upload, provider, demo
- returned evidence types
- freshness expectations
- known limitations
- confidence defaults
- required consent
- failure behavior

### Spotify Capabilities

V1 public:

- artist_identity
- catalog_overview
- top_tracks
- release_history
- market_availability
- public popularity/metadata

V1 via upload/manual:

- Spotify for Artists CSV stream counts
- audience timeline
- songs/playlists table
- source-of-stream notes
- city/country breakdown if exported

Future:

- direct Spotify for Artists authorized ingestion if available and compliant

Limitations:

- Spotify Web API is not private artist analytics.
- Do not claim saves, skip rate, listener cohorts, or source-of-stream details unless uploaded or authorized.

### YouTube Capabilities

V1 public:

- channel_identity
- video_catalog
- video_statistics
- Shorts-like video detection if inferable
- public comment samples

V1 authorized/upload:

- views by time
- subscribers gained/lost
- geography
- traffic sources
- audience retention or watch depth where available

Limitations:

- rich analytics require owner authorization
- public comments are noisy and can be unrepresentative

### TikTok Capabilities

V1 handle/provider/demo:

- profile_identity
- recent content list
- post/video performance
- comment samples
- estimated content velocity
- estimated sound reuse/UGC where provider supports it

Official Display API with permission:

- creator profile info
- recently uploaded video metadata

Limitations:

- handle-only data likely requires a provider or scraper
- sound reuse and UGC can be incomplete
- views do not prove demand

### Instagram Capabilities

V1 handle/provider/demo:

- profile identity
- recent posts/reels
- content performance
- comment samples
- visible engagement

Authorized business/creator:

- reach
- interactions
- accounts engaged
- follower trends
- demographics where thresholds are met

Limitations:

- public data is weaker than authenticated Insights
- some metrics are estimated, thresholded, or unavailable

### X Capabilities

V1 public:

- profile identity
- public posts
- public engagement
- conversation clusters
- press/story signals

Authorized:

- non-public post metrics
- click metrics
- organic/promoted breakdown where available

Limitations:

- conversation can indicate story momentum without proving music demand
- private metrics require user context and may have recency restrictions

### Manual/Upload Capabilities

V1:

- budget
- release plan
- campaign history
- marketing calendar
- Spotify for Artists exports
- YouTube Studio exports
- rights notes
- split sheets
- smart-link/pre-save exports
- team capacity

Manual and uploaded evidence must be labeled as user-supplied or uploaded and must preserve source/provenance.

## 13. Social Intelligence Layer

The Social Intelligence Layer converts public social activity into culture and demand evidence.

It should detect:

- profile identity
- content velocity changes
- post/reel/video outliers against artist baseline
- repeated comment themes
- fan demand comments
- sound reuse or UGC
- creator uptake
- language/location clues
- community clusters
- snippet demand
- attention without conversion
- conversion without culture
- old catalog resurfacing
- trend emergence

Example social evidence types:

- comment_demand_release_request
- sound_reuse_growth
- snippet_outperforming_baseline
- creator_cluster_forming
- market_language_overindex
- social_attention_no_streaming_lift
- streaming_lift_no_social_participation
- catalog_resurfacing_signal

All social evidence must include confidence, source kind, freshness, and limitations. Provider and scraping data can be noisy, unstable, incomplete, or platform-limited.

## 14. Manager Intelligence And Scoring

Scoring supports judgment. It does not replace judgment.

### Confidence Score

Inputs:

- source reliability
- freshness
- directness to decision
- cross-platform support
- sample size
- historical baseline availability
- contradiction penalty
- data limitation penalty

Output:

- low: directional only
- medium: useful for test or limited spend
- high: strong enough for meaningful action

Formula suggestion:

```text
confidence =
  0.25 * source_reliability
+ 0.20 * freshness
+ 0.20 * directness
+ 0.15 * cross_platform_support
+ 0.10 * baseline_quality
+ 0.10 * sample_quality
- contradiction_penalty
- limitation_penalty
```

### Momentum Score

Purpose: estimate whether the artist/track is gaining meaningful movement.

Inputs:

- attention score
- participation score
- conversion score
- leverage score
- freshness
- confidence

Formula suggestion:

```text
momentum_score =
  (0.20 * attention)
+ (0.25 * participation)
+ (0.35 * conversion)
+ (0.20 * leverage)
adjusted by freshness and confidence
```

Conversion should carry more weight than attention. Attention alone should never trigger scale spend.

### Conversion Index

Purpose: judge whether social attention is becoming music demand.

Inputs:

- social attention lift
- streaming lift
- save/follow/subscriber lift
- YouTube watch depth
- smart-link/pre-save/click data
- demand comments
- UGC/sound reuse

Output:

- no conversion evidence
- weak conversion
- forming conversion
- strong conversion

### Spend Readiness

Levels:

1. Observe: signal is too weak or noisy; no meaningful spend.
2. Test spend: enough evidence for capped experiment; short window, explicit stop/scale rules.
3. Scale spend: cross-platform conversion or strong leverage; larger spend with review cadence.

### Release Readiness

Inputs:

- release asset complete
- metadata and rights readiness
- Spotify pitch window
- content hooks tested
- artist story clear
- visual assets ready or intentionally deferred
- budget and owners assigned
- review checkpoints

Output:

- not ready
- ready for test runway
- ready for release
- ready for scale campaign

### Market Readiness

Inputs:

- streaming geography
- YouTube geography
- social location/language clues
- creator geography
- comment location demand
- live-market proxy
- local partner path

Output:

- watch
- validate
- activate
- route/partner

### Risk Score

Inputs:

- data weakness
- budget exposure
- one-platform dependency
- artist capacity
- rights uncertainty
- timing risk
- team bandwidth
- conflicting priorities

Output:

- low
- medium
- high

High risk requires explicit "what not to do," human approval, and a review date.

## 15. Default Decision Gates

These gates are V1 defaults and should be refined with design-partner data.

### Budget Gate

- Observe: one weak signal, no repeat behavior, no conversion evidence, or source confidence below medium.
- Test spend: one strong attention/participation signal plus at least one directional conversion or leverage clue.
- Scale spend: repeated participation plus conversion lift, or strong strategic leverage with accepted risk.

Default behavior:

- keep 30-50% of a small monthly budget uncommitted until the test reports back
- do not fund a high-cost video unless focus asset and conversion evidence are strong
- prefer short tests before long commitments

### Song Focus Gate

- One focus asset should be selected unless evidence proves multiple songs serve different goals.
- Manager should warn when the team is splitting attention.
- A song with lower streams can still win if it has stronger participation, conversion, or strategic leverage.

### Social Momentum Gate

- Attention is not enough.
- Participation suggests audience behavior is forming.
- Conversion suggests music demand is forming.
- Leverage requires evidence strong enough to change spend, timing, outreach, press, live, or market strategy.

### Release Timing Gate

- Release is not ready if metadata/rights, focus asset, content runway, owner roles, and review checkpoints are unresolved.
- A release can proceed with missing social evidence if the goal is catalog consistency, fan service, or strategic positioning, but the Manager must label risk.
- DSP pitch requirements and timing should be surfaced early when Spotify is part of the release plan.

### Market Gate

- Watch: weak social or conversation clues.
- Validate: repeated social/streaming/content signal.
- Activate: signal plus local partner/channel path.
- Route/live-ready: demand evidence plus live-market proxy.

## 16. Manager Decision Taxonomy

Initial decision types:

- career priority
- song push priority
- breakout detection
- release planning
- budget allocation
- content testing
- social-to-streaming conversion
- market validation
- collaboration/feature decision
- video spend decision
- press/story angle
- playlist/radio/DSP readiness
- tour/show readiness
- brand/partnership fit
- audience development
- catalog reactivation
- risk/focus diagnosis
- weekly priority planning

Each decision type must define:

- required evidence
- useful evidence
- relevant social evidence
- red flags
- confidence rules
- answer format
- recommended actions
- possible proactive triggers
- work products to create

## 17. Manager Playbook Requirements

The Manager Playbook is structured, versioned product logic. It is not one giant prompt.

Each playbook entry should include:

- decision_type
- description
- example_user_questions
- required_evidence
- useful_evidence
- minimum_viable_answer
- red_flags
- confidence_rules
- test_windows
- recommended_actions
- answer_must_include
- answer_must_not_claim
- work_products_to_create
- proactive_triggers

## 18. Manager Run Loop

For every first brief, question, or mission:

1. Load Artist Operating Profile.
2. Load relevant memory: active missions, tasks, tests, briefs, decisions, overrides, unresolved questions.
3. Interpret the user question or system trigger.
4. Identify the real decision type.
5. Select a versioned playbook entry.
6. Decide whether to answer directly, refer to a specialist, or create a locked-department brief.
7. Build an evidence plan.
8. Resolve evidence plan to source capabilities.
9. Retrieve fresh/cached raw snapshots or uploaded/manual evidence.
10. Normalize raw data into Evidence Items.
11. Score confidence, momentum, conversion, readiness, and risk where relevant.
12. Judge sufficiency, freshness, contradictions, and gaps.
13. Decide whether to answer, constrain, test, refer, or ask for missing input.
14. Generate structured answer and work products.
15. Run Quality Gate.
16. Store answer, evidence used, scores, decision record, tasks, tests, briefs, drafts, referrals, and follow-up timing.

## 19. Quality Gate

Purpose: prevent generic, unsupported, overconfident, or non-operational answers.

An answer must:

- identify the real decision
- cite evidence used
- separate attention, participation, conversion, and leverage when social evidence is involved
- include what to do
- include what not to do
- include at least one next action or explain why not
- state confidence and missing evidence
- state what would change the recommendation
- create or update work products when operational
- avoid claims beyond available evidence

If an answer fails:

- regenerate with constraints
- downgrade confidence
- add missing evidence statement
- convert advice into a test rather than a decision
- ask for necessary data only if no useful constrained answer is possible

## 20. Manager Work Products And Operating Rhythm

### ManagerMission

A mission is an active management objective.

Fields:

- mission_id
- artist_id
- title
- objective
- decision_type
- status
- priority
- start_date
- due_date
- owner_role
- artist_context
- evidence_plan
- success_criteria
- risks
- linked_tasks
- linked_tests
- linked_briefs
- linked_decision_record

Prototype UI requirements:

- appears in the Label HQ active mission list
- opens into the Missions Workspace
- can be selected from a mission stack
- shows status, progress/health, summary, review point, and work counts
- exposes Tasks, Checkpoint Review, Notes, and Memory as connected work lanes
- explains how the work lanes connect to the Manager's recommendation

### ManagerTask

A task turns recommendation into owner-ready work.

Fields:

- task_id
- mission_id
- artist_id
- task
- owner_role
- deadline
- priority
- status
- approval_state
- linked_evidence_ids
- dependencies
- completion_notes
- why_it_matters

Approval states:

- not_required
- needs_approval
- approved
- rejected

Prototype UI requirements:

- each task shows owner, deadline, purpose, dependency, linked evidence, steps, and completion note input
- task titles and steps must use plain artist/team language
- tasks assigned to humans must be concrete actions the user can actually perform, such as posting a TikTok, approving a budget, uploading a file, choosing an asset, answering a question, or confirming availability
- tracking, scoring, comparison, and interpretation should be handled by the AI unless the human is explicitly being asked to connect or upload the data source
- approval-required tasks expose Approve and Mark Done actions
- Mark Done is disabled until approval is granted when approval is required
- completion state changes should remain scoped to the task and mission

### MissionCheckpoint

A mission checkpoint is an AI-owned progress check that validates whether a mission is working before the team spends more money or changes strategy. Internal test logic can power checkpoints, but the visible user-facing surface is `Checkpoint Review`.

Fields:

- checkpoint_id
- mission_id
- plain_language_question
- reason_for_checkpoint
- channel
- asset
- audience_or_market_target
- budget
- budget_mode
- window_start
- window_end
- metric_threshold
- stop_rule
- continue_rule
- scale_rule
- linked_task_ids
- ai_signals_watched
- status: waiting_for_setup, watching_signal, needs_review, met, needs_change
- evidence_to_measure
- review_date

A 10-day validation path should include setup confirmation, early execution check, first signal review, midpoint adjustment, and final decision review.

Prototype UI requirements:

- Checkpoint Review is a dedicated mission-linked workspace
- the checkpoint surface shows the plain-language question, capped budget if relevant, what the AI is checking, linked task, and the Manager's decision rule
- the checkpoint surface must explicitly state when the user does not need to track metrics manually
- checkpoints are visibly staged and can show Waiting for setup, Watching signal, Needs review, Met, or Needs change
- budget cap approval is represented as a task; approving the cap must not be hidden inside Checkpoint Review
- a checkpoint may say that budget setup is waiting, but it does not own the human approval action

### AgentNote

Agents coordinate by producing helpful notes for each other. The Manager can request specialist runs/tools, and specialists can proactively note the Manager when a run finds something useful. These notes are operational handoffs, not agents complaining to each other and not a user approval queue.

Fields:

- note_id
- sender_agent
- recipient_agent
- note_type
- subject
- message
- why_it_matters
- evidence_used
- resulting_change: filed_to_memory, created_task, updated_checkpoint, no_action_yet
- linked_mission_id
- owner_role
- status
- due_date_or_checkpoint
- linked_referral_id

Prototype UI requirements:

- Notes Workspace presents agent-to-agent updates, requests, run findings, and handoffs in a human-readable operational format
- each note shows route, note type, subject, message, why it matters, evidence used, linked mission, resulting change, and status
- notes can be exported in the prototype
- notes cannot be approved for use; if the user needs to approve something, the Manager must create a task, draft, budget action, or external recommendation

### ArtistCheckIn

The Manager helps manage the artist relationship, not only the campaign.

Fields:

- checkin_id
- agenda
- questions_for_artist
- decisions_needed
- sensitive_issues
- energy/capacity flags
- next_commitments
- follow_up_date

### MissionRecord

Stores the living memory of a mission. This is what the AI reads to understand the mission before answering follow-up questions, updating work, or recommending the next move. The visible label is `Memory`.

Fields:

- mission_record_id
- mission_id
- mission_goal
- current_state
- task_updates
- checkpoint_status
- checkpoint_results
- note_updates
- review_events
- decisions_already_made
- blockers
- missing_evidence
- what_would_change_recommendation
- next_recommendation
- next_review_timing
- final_call
- alternatives_rejected
- confidence
- evidence_used
- review_date
- created_by
- quality_gate_result
- user_override_if_any

Prototype UI requirements:

- Memory lives primarily in the mission workspace/drawer as supporting memory
- it must show current mission read, task status summary, checkpoint status summary, agent notes that changed the mission, decisions already made, blockers and missing evidence, what would change the Manager's recommendation, next review timing, confidence, evidence used, alternatives rejected, override state, quality gate result, and linked mission
- it supports the Manager answer and future AI context, but should not replace the Manager answer

### MissionEvent

An immutable event ledger item for everything that changes mission understanding.

Fields:

- event_id
- artist_id
- mission_id
- event_type: manager_run, task_created, task_approved, task_completed, task_result_added, test_checkpoint_reached, test_result_added, evidence_added, brief_created, review_created, recommendation_changed, user_override, mission_paused, mission_cancelled, mission_completed, successor_mission_created
- source_object_type
- source_object_id
- event_summary
- evidence_ids
- created_by: user, manager, system, specialist_agent
- created_at
- audit_metadata

Behavior:

- Mission events are append-only.
- Mission events are used for provenance, auditability, and reconstructing how a recommendation changed.
- The AI should not rely only on the compressed mission record when exact sequence matters; it should retrieve the event ledger as supporting context.

### TaskResult

A task result captures what changed because a task was completed, blocked, missed, rejected, or revised.

Fields:

- task_result_id
- task_id
- mission_id
- result_status: completed, blocked, missed, rejected, revised
- result_summary
- user_note
- manager_interpretation
- evidence_ids
- effect_on_mission: strengthened_thesis, weakened_thesis, unblocked_work, created_risk, no_material_change, requires_review
- recommended_follow_up
- created_at

Behavior:

- Marking a task done must either collect or generate a task result.
- Task results feed mission review and may update mission checkpoints.
- A weak or failed task result should create a revised task or recommendation instead of pretending progress happened.

### CheckpointResult

A checkpoint result captures what a validation checkpoint proved or failed to prove.

Fields:

- checkpoint_result_id
- checkpoint_id
- mission_id
- result_summary
- measured_signals
- threshold_read
- stop_continue_scale_recommendation
- confidence
- evidence_ids
- created_at

Behavior:

- Checkpoint results are decision inputs, not decorative status updates.
- Each checkpoint must be able to recommend continue, modify, stop, replace checkpoint path, or create a new mission.
- Scale recommendations require stronger evidence than checkpoint-continuation recommendations.

### MissionReview

A mission review is the Manager's structured reassessment of an active mission after a meaningful event or scheduled run.

Triggers:

- task result added
- checkpoint reached
- new evidence arrives
- daily operating review
- user override
- budget/profile/source change
- conversation adds material context
- mission review date arrives

Fields:

- mission_review_id
- mission_id
- artist_id
- trigger_type
- trigger_object_id
- previous_recommendation
- new_recommendation
- recommendation_changed: boolean
- outcome: continue_mission, modify_task, replace_task, create_task, pause_task, continue_test, replace_test, stop_test, create_new_mission, pause_mission, cancel_mission, archive_mission, ask_user_for_approval, update_artist_memory
- reasoning
- evidence_used
- task_changes
- test_changes
- mission_changes
- artist_memory_updates
- approval_required
- next_review_date
- quality_gate_result

Behavior:

- Every mission review must update mission memory.
- Mission review may propose changes automatically, but human approval is required for expensive, external, sensitive, legal, financial, or reputation-affecting actions.
- A mission can be cancelled or replaced only with a recorded reason and successor path where appropriate.

### MissionMemorySummary

The compressed AI-readable summary of the mission's current operating truth.

Fields:

- mission_id
- current_thesis
- current_state
- latest_findings
- active_blockers
- active_risks
- open_tasks
- active_tests
- latest_test_read
- current_recommendation
- next_best_action
- decision_change_conditions
- do_not_do
- confidence
- updated_from_event_ids
- updated_at

Behavior:

- This summary is updated after every mission review.
- Manager runs should load this summary before answering mission-related questions.
- The user-facing Mission Record may show a readable version, but the internal summary is optimized for AI context retrieval.

### ArtistOperatingMemory

Artist operating memory is separate from the visible Artist Profile. It is the long-running strategic memory the AI uses to manage the artist over time.

Fields:

- artist_id
- current_strategy_thesis
- current_focus_asset
- active_goal_stack
- career_stage_read
- proven_patterns
- disproven_patterns
- market_learning
- audience_learning
- budget_learning
- team_capacity_learning
- do_not_repeat
- unresolved_questions
- active_risks
- completed_mission_lessons
- user_preferences_and_overrides
- last_updated_from_mission_ids
- updated_at

Behavior:

- Artist operating memory is not a primary visible UI surface in V1.
- It should influence Today’s Brief, Manager answers, mission creation, mission reviews, and quality gates.
- Important mission reviews may update artist memory when the lesson matters beyond one mission.
- The AI should distinguish stable profile facts from learned operating memory.

### WorkDraft

Draft operational materials for user approval, edit, copy, export, or future sending.

Types:

- creator brief
- DSP pitch note
- press angle
- content prompt
- collaborator outreach
- campaign recap
- meeting memo
- artist update
- partner update
- team task recap

V1 drafts are not sent automatically.

### ConversationThread

A conversation thread stores a user/Manager exchange that can be reopened and continued.

Fields:

- conversation_id
- artist_id
- topic
- status
- last_update
- summary
- linked_mission_id
- messages
- linked_work_products
- created_at
- updated_at

Message fields:

- message_id
- conversation_id
- speaker
- label
- body
- created_at
- linked_evidence_ids
- linked_work_product_ids

Prototype UI requirements:

- recent conversations appear directly below the Ask Manager composer after context is ready
- each recent row includes topic, last update, status/outcome, and Continue
- Continue opens the Conversation Workspace, not the Ask Manager composer
- thread follow-ups append below previous messages and retain the selected conversation context
- a thread can link to a related mission

## 21. Approval And Autonomy Boundaries

The Manager can:

- create tasks
- create tests
- create missions
- create briefs
- create check-ins
- create drafts
- create decision records
- suggest budget allocation
- suggest owner roles and deadlines
- suggest follow-up dates

It cannot automatically:

- spend money
- send messages externally
- sign contracts
- approve legal/rights decisions
- submit music to DSPs
- change platform accounts
- publish content
- book travel
- pay invoices
- make medical/wellbeing decisions

Require approval before:

- external outreach
- paid campaign activation
- public content publishing
- contractual recommendations
- rights/ownership edits
- artist-sensitive messaging
- anything affecting money, legal rights, public reputation, or personal wellbeing

## 22. Locked Agent Roadmap

Locked agents should be aspirational but honest.

Each locked card must show:

- what the agent will do
- connected sources
- required sources
- optional sources
- compact upload/connect actions
- future tools/capabilities
- whether a limited Manager brief is possible today

### Finance/Rights

Future capability:

- budget guardrails, royalties, recoupment, splits, statements, payout timing, metadata, ownership, and rights hygiene

Unlock evidence:

- royalty statements
- revenue reports
- split data
- contract terms
- payout history

Manager V1 can create Finance/Rights briefs and avoid final accounting/legal conclusions.

### Marketing Lead

Future capability:

- campaigns, content, platform strategy, creators, paid/organic growth

Unlock evidence:

- YouTube analytics
- TikTok data
- Instagram data
- X conversation
- campaign history
- smart-link/pre-save data

Manager V1 can create campaign briefs, content tests, and budget recommendations.

### Sync & Deals

Future capability:

- sync, brand, partnership, and deal opportunities when rights and pitch materials are credible

Unlock evidence:

- rights clarity
- pitch assets
- catalog metadata
- audience proof
- brand-fit notes
- clean instrumental and one-sheet when available

Manager V1 can create Sync & Deals readiness briefs, flag missing rights/pitch inputs, and avoid implying deal availability without source proof.

### Touring Agent

Future capability:

- city validation, show readiness, routing, live opportunities

Unlock evidence:

- streaming geography
- YouTube geography
- social demand
- ticketing/live proxies
- comment location clues

Manager V1 can create market validation briefs and avoid claiming show readiness without data.

### Rights Admin

Future capability:

- metadata, ownership, splits, claims, rights hygiene

Unlock evidence:

- rights metadata
- split sheets
- distributor records
- publishing/master ownership data
- claims

Manager V1 can flag rights risk and create rights/admin checklists.

### Sync/Deals

Future capability:

- sync, brand, partnership, and deal-fit opportunities

Unlock evidence:

- song metadata
- lyrics/theme/mood descriptors
- rights and clearance status
- artist positioning
- audience and brand fit
- deal history

Manager V1 can create Sync/Deals briefs and flag missing metadata or rights readiness.

## 23. Data Model Requirements

Current prototype status: the repository does not implement these tables yet. All artist, Music, mission, evidence, agent note, and conversation data is held inside the React prototype as local in-memory mock/demo data. A production backend must persist the same objects and relationships that the prototype exposes.

Backend implementation must preserve the current prototype object boundaries:

- `ArtistProfile` stores identity, market, genre, release, goal, budget, stage, and social handles.
- `MusicItem` stores atomic recorded work such as songs, demos, released tracks, catalog tracks, lifecycle stage, Manager read, source limits, blocker, rights state, and next move.
- `MusicProject` stores EPs, albums, singles-as-release-containers, mixtapes, compilations, and unreleased bodies of work; project tracklists link to `MusicItem` records without duplicating song state.
- `MusicAsset`, `MusicIdentifier`, `MusicCredit`, `MusicSplit`, `MusicSplitContributor`, `MusicSplitConfirmation`, and `MusicDistributionPackage` store files, provider IDs, credits, rights/splits, scoped confirmation links, and distribution readiness.
- `Agent` stores name, title, status, purpose, tools, evidence needs, connected sources, required sources, optional sources, source actions, and the Manager-prepared output available while locked.
- `Mission` stores title, status, progress, task/checkpoint/note counts, review point, and summary.
- `ManagerTask` stores owner, deadline, approval state, purpose, steps, linked evidence ids, dependency, and rationale.
- `MissionCheckpoint` stores AI-owned mission progress checks, linked tasks, status, watched signals, thresholds, and review rules.
- `EvidenceItem` stores source, source kind, type, subject, time window, metric/value, lens, freshness, confidence, provenance, limitation, and raw snapshot reference.
- `AgentNote` stores route, note type, subject, prose message, why it matters, evidence used, resulting change, status, and linked mission.
- `MissionRecord` stores current mission read, task status, checkpoint status, agent notes that changed the mission, decisions, blockers, missing evidence, recommendation-change condition, next review timing, confidence, quality gate, and override state.
- `WorkDraft` stores type, title, and body.
- `ConversationThread` stores topic, last update, status, prompt, summary, messages, and linked work context.

The backend should not introduce a different navigation model or split these work products into unrelated dashboards. It should support the prototype's operating-room flow: setup -> Label HQ -> Manager Office / conversations -> Manager run -> decision package -> mission workspaces and contextual drawers.

Authoritative V1 schema:

- The database contract lives in `docs/workflows/future-schema-notes.md`.
- Dynamic prototype lineage lives in `docs/workflows/prototype-data-lineage-contract.md`.
- That file is no longer a speculative future sketch; it is the V1 operational database schema contract.
- Backend implementation should derive migrations from that schema contract instead of maintaining a second table list in this PRD.
- The contract covers ownership/workspaces, artist profile, first-class Music, non-music artist work objects, source ingestion, evidence, agents, Manager runs, usage/cost events, Label HQ, conversations, decision packages, dynamic missions, tasks, checkpoints, reviews, permissions, drafts, memory, learning, and rebuildable UI projections.

Minimum security fields on sensitive records:

- user_id or account_id
- artist_id where relevant
- created_by
- updated_by
- created_at
- updated_at

Memory storage must include:

- prior decisions
- open tasks
- open checkpoints
- evidence used
- prior assumptions
- review dates
- baselines
- active risks
- do-not-do list
- user overrides
- specialist memos
- unresolved questions

The Manager should not forget decisions between sessions.

## 24. API And Service Requirements

Current prototype status: no API layer is implemented in this repo. The following services are the backend contract needed to make the production system behave like the prototype. Every service should return data shaped for the current UI surfaces, not for a generic analytics dashboard.

Implementation alignment requirements:

- Artist Profile Service must power Step 1 / Identity, Step 2 / Context, and the Settings/Artist Profile workspace.
- Music Service must power the Music workspace, song/project persistence, lifecycle state, assets, identifiers, credits, splits, split confirmation links, distribution packages, and Music retrieval for Manager/agent runs.
- Manager Run Service must preserve the current gated Manager Office flow: required context questions first, then Ask Manager, then investigation, then decision package.
- Work Product Service must create and update the same mission, task, checkpoint, note, memory, draft, and conversation objects currently shown in the prototype.
- Task Result Service must turn task completion, blockage, rejection, and revision into structured results that can change checkpoints, reviews, and mission memory.
- Checkpoint Result Service must interpret checkpoint progress against stop/continue/scale rules instead of treating checkpoints as passive progress indicators.
- Run Usage Service must record token, tool, and provider usage by workflow, run, subject, and status so per-usage billing can explain exactly what work happened.
- Mission Review Service must run after meaningful events and decide whether to continue, revise, pause, cancel, replace, or create mission work.
- Mission Memory Service must maintain both immutable mission events and compressed AI-readable mission summaries.
- Artist Operating Memory Service must maintain long-running learned context across missions without exposing it as a normal profile page.
- Evidence Service must support contextual evidence drawers and agent source readiness. It must not require a global Evidence page.
- Locked Agent Metadata Service must support The Staff, locked agent workspaces, connected/required/optional source readiness, and Manager-prepared notes.
- Review/Notification behavior currently appears through `Flagged for you` and the Review workspace, not through durable top-level Notifications navigation.

Core services:

- Artist Profile Service
- Source Connection Service
- Source Capability Service
- Raw Snapshot Service
- Evidence Normalization Service
- Music Service
- Music Distribution Adapter Service
- Manager Playbook Service
- Manager Run Service
- Run Usage Service
- Quality Gate Service
- Work Product Service
- Checkpoint Result Service
- Memory Service
- Referral Service
- Locked Agent Metadata Service
- Audit Event Service

### Manager Run API

Example request:

```json
{
  "artist_id": "artist_123",
  "thread_id": "thread_456",
  "user_question": "We have $5,000. What should we do this month?",
  "context": {
    "active_focus_object_id": "object_789",
    "budget": 5000
  }
}
```

Example response:

```json
{
  "run_id": "run_001",
  "decision_type": "budget_allocation",
  "answer": {
    "decision": "Run a capped 10-day conversion test before scaling spend.",
    "what_not_to_do": "Do not fund a full video or spread budget across the catalog yet.",
    "confidence": "medium"
  },
  "scores": {
    "confidence": "medium",
    "spend_readiness": "test_spend",
    "risk": "medium"
  },
  "work_products": {
    "missions": ["mission_001"],
    "tasks": ["task_001", "task_002"],
    "checkpoints": ["checkpoint_001"],
    "agent_notes": ["note_001", "note_002"],
    "decision_records": ["decision_001"]
  },
  "quality_gate": {
    "passed": true,
    "warnings": []
  }
}
```

### Work Product Update API

Users must be able to:

- approve
- edit
- assign
- mark blocked
- mark done
- archive
- link evidence
- add notes

Conversation updates should also be able to update work products. Example: if the user says "yes, I posted the three clips," the Manager can mark the linked task done and update the mission checkpoint.

Any work-product update that changes operating meaning must create a mission event and usually trigger a mission review. For example:

- "I posted the three clips" marks the task done, creates a task result, updates the mission checkpoint, creates a mission event, runs a mission review, and updates mission memory.
- "The clips did not perform" marks the task result as weakening the thesis, may create a revised creative task, may stop or replace the checkpoint path, and updates artist operating memory if it teaches a reusable lesson.
- "We decided not to spend this week" records a user override, updates budget learning in artist operating memory, blocks or revises budget tasks, and changes the next note.

## 25. AI Requirements

The Manager should use:

- system instruction defining role, boundaries, and answer quality
- Artist Operating Profile
- selected playbook entry
- Evidence Items
- prior memory
- work-product schemas
- quality gate checklist

The Manager should not rely on one giant prompt. Strategic reasoning must be structured as versioned product logic and playbooks.

Manager runs must produce structured JSON for:

- answer sections
- evidence used
- scores/readiness
- missions
- tasks
- tests
- department briefs
- artist check-ins
- decision records
- drafts
- referrals
- quality gate result

Every operational answer should include:

1. Decision
2. Why
3. What not to do
4. Evidence
5. Interpretation
6. Action plan
7. Work products created
8. Confidence
9. Missing evidence
10. What would change the decision

Manager voice:

- strategic
- direct
- calm
- evidence-aware
- artist-first
- opinionated but not reckless
- operational
- respectful of uncertainty

It should not be hype-driven, generic, overly technical, overconfident, too verbose by default, or afraid to say no.

## 26. Hero Workflows

### Budget Decision

User:

> We have $5,000. What should we do this month?

Manager should:

- interpret as budget allocation and campaign priority
- identify focus asset
- compare attention, participation, conversion, leverage
- recommend budget split
- hold back money if evidence is weak
- create a 10-day test
- create tasks
- create Marketing/DSP/Artist briefs
- create decision record
- set review date

Current prototype expression:

- question appears as "We have $5,000. What should we do this month?"
- Manager investigates source context, budget, artist capacity, missing private analytics, and social momentum
- Manager answer recommends a $1,850 capped validation test
- $2,250 remains held back until the 72-hour signal review
- the decision package shows why the call was made and which bigger moves were rejected
- direct work created links to the Night Bus validation mission
- follow-up continues through the conversation thread

### Momentum Triage

User:

> Is this TikTok attention real momentum?

Manager should:

- classify spike
- compare to baseline
- look for participation and conversion
- avoid vanity conclusions
- create 72-hour or 10-day validation plan
- decide whether budget remains held

Current prototype expression:

- momentum is framed around TikTok hook lift and repeated demand comments
- the Manager distinguishes heat worth testing from proof worth scaling
- the thread can be reopened as "TikTok momentum check"

### Release War Room

User:

> I want to drop a new song next week. What do we need to do?

Manager should:

- make a manager-grade timing call instead of accepting the requested date blindly
- move the target date when the requested timing creates delivery, rights, DSP, creator, press, or launch-execution risk
- create a release mission with a backwards calendar from the revised date
- create task groups for release strategy, rights and metadata, distribution, DSP/playlist pitching, creator seeding, press/tastemakers, content/owned audience, release day, and post-release signal
- require every task completion, blockage, rejection, or revision to create a TaskResult that the Manager reviews
- derive checkpoint readiness from task results and watched evidence, not from manual toggles
- create Marketing, DSP/playlist, PR/tastemaker, Sync & Deals, Finance/Rights, and Artist notes while locked specialists are not yet active
- include post-release checkpoints at 48 hours, 7 days, 14 days, and 28 days

Current prototype expression:

- the primary active mission is `Release Night Bus on June 12`
- the Manager starts from `I want to drop a new song next week` and changes the plan to `Friday, June 12, 2026`
- the mission exposes release-room `Tasks`, `Checkpoint Review`, `Notes`, and `Memory`
- tasks include split sheet confirmation, distributor package submission, Spotify pitch submission, TikTok creator target list, press/EPK package, launch content approval, release-day link verification, and 48-hour signal read
- task reviews feed checkpoint status; for example, a blocked split sheet changes the Rights & Metadata Gate to `Needs revision`
- Mission Memory includes the original request, the date move, task results, checkpoint reviews, mission changes, current recommendation, next best action, and append-only mission log events

### Weekly Priority

User:

> What should we focus on this week?

Manager should:

- review what changed
- review open tasks/tests
- pick one priority
- create do-not-do list
- create artist agenda
- update mission board

Current prototype expression:

- the morning brief performs the first daily prioritization
- "What matters today" is the priority callout
- the Attention Queue surfaces approvals, uploads needed, and review timing

## 27. Proactive Monitoring Architecture

V1 should ship mostly reactive Manager Office plus first brief and basic in-product follow-up. The data model must be proactive-ready.

Proactive principle:

> Alerts should only fire when a signal changes a decision.

Scheduled agent runs should:

1. Refresh relevant source evidence.
2. Compare latest evidence against baselines.
3. Compare evidence against prior recommendations and open tasks.
4. Detect decision triggers from the playbook.
5. Review task results, checkpoint results, notes, and mission events created since the last run.
6. Run mission reviews for any mission whose thesis, blockers, risk, or next action may have changed.
7. Update mission memory summaries.
8. Update artist operating memory when a lesson matters beyond one mission.
9. Decide whether the change matters.
10. Generate a note, task update, checkpoint change, mission review, new mission, or notification event only when warranted.

The daily operating review must not merely create a report. Its job is to keep the artist's operating system current: stale tasks should be revised, weak checkpoint paths should be stopped or replaced, stronger signals should create new follow-up work, and mission memory should stay sharp enough for the next Manager answer.

Decision triggers:

- breakout trigger
- false-positive trigger
- market trigger
- budget trigger
- release trigger
- focus trigger
- risk trigger
- social reuse trigger
- comment demand trigger
- snippet trigger
- culture-without-conversion trigger
- streaming-without-culture trigger
- catalog resurfacing trigger

## 28. Testing And Acceptance Criteria

### Golden Scenario Tests

Create fixtures for:

- $5,000 budget decision
- TikTok spike with no streaming lift
- TikTok spike plus Spotify lift
- release plan with missing rights/metadata
- video drop plan that Manager recommends delaying
- market validation from social location clues
- weekly priority with too many open tasks
- user override of Manager recommendation
- locked Finance/Rights referral
- task completion via conversation

### Quality Gate Tests

Verify:

- generic answers fail
- unsupported private-data claims fail
- attention/demand confusion fails
- answers without next action fail unless advisory
- legal/finance/wellbeing outputs are constrained

### Evidence Tests

Verify:

- raw snapshots are stored before normalization
- evidence items cite provenance and limitations
- uploaded evidence is labeled uploaded/user-supplied
- provider evidence is labeled provider-derived
- low-confidence evidence cannot support high-confidence action

### Security And Traceability Tests

Verify:

- user cannot access another user's artist data by changing IDs
- server-side APIs enforce ownership
- provider tokens are never returned to the client
- source disconnect removes or revokes token data where possible
- uploaded files have owner, artist, source type, file type, classification, and upload time metadata
- Manager run stores evidence ids and quality gate result
- work-product approval/rejection is logged
- user override is logged
- platform admin access/action is logged
- audit events are created for source connection, upload, Manager run, work-product approval, deletion, and permission-sensitive changes

### Work Product Tests

Verify:

- budget answers create a mission, checkpoints, tasks, notes, and decision record
- release answers create release mission and agent notes
- weekly priority answers update mission/task/check-in state
- user can approve/edit/reject/mark done

### Demo Acceptance

User can:

- select the Sable Day Spotify identity on `Step 1 / Identity`
- continue to `Step 2 / Context`
- edit artist name, Spotify identity, artist stage, market, genre, goal, active release, budget, and social handles
- add social handles
- enter Label HQ
- receive a narrative `Today's Brief` in Label HQ that explains what is happening across connected sources
- see `The Staff`, active missions, and `Flagged for you` in Label HQ
- use supporting evidence access without turning the brief into metric cards
- enter Manager Office from Label HQ
- complete required Manager questions before asking for a decision
- see recent conversations under Ask Manager after context is ready
- open a recent conversation as a thread without pre-filling the Ask Manager composer
- continue a prior thread with a follow-up question
- ask serious management question
- see investigation progress
- get a Manager answer / decision package with facts, rationale, rejected moves, direct work created, and continue-thread affordance
- open the created mission in the Missions Workspace
- select missions from the mission stack and see a dominant selected mission surface
- inspect evidence
- approve/edit tasks and observe approval-required task blocking
- view active checkpoints with AI-watched signals, linked tasks, status, decision rule, and no-manual-tracking language
- approve, edit, or reject budget caps from Tasks, not Checkpoint Review
- view read-only agent-to-agent notes with evidence used and resulting changes
- view mission memory for the 72-hour signal review, checkpoint results, decisions, blockers, and next recommendation
- inspect the mission record drawer
- open Settings to inspect the Artist Profile workspace
- return later and see memory

## 29. Product Metrics

Activation:

- artist profile created
- Spotify identity selected
- at least one social handle added
- first brief generated
- first mission created
- first user question asked

Value:

- percent of Manager answers that create work products
- percent of answers passing quality gate first time
- user approval/edit rate on generated tasks
- missions completed
- tests completed
- repeat use per artist per week
- evidence gaps resolved after Manager recommendation

Trust:

- contextual evidence/source surfaces are opened per answer, mission, or agent
- user edits due to wrong assumptions
- unsupported claim incidents
- user marks recommendation useful/not useful
- user accepts confidence level

Management outcomes:

- campaign tests completed
- budget saved from avoided premature spend
- release plan readiness improved
- conversion evidence detected
- market validation completed
- tasks completed on time

## 30. Security, Privacy, And Compliance

V1 is not seeking SOC 2 certification immediately. The product should still be built so SOC 2 Type I/Type II readiness later does not require a major rewrite.

Keep V1 permissions simple. A user logs in and owns or uses their artist profile. Platform admin access can exist for support and debugging, but it must be separate from normal user access and auditable. Do not build full enterprise RBAC, SSO, trust portals, vendor workflows, or formal compliance operations in V1 unless they become necessary for the implementation.

Priorities for V1:

- secure data handling
- clear ownership boundaries
- server-side enforcement
- auditability
- evidence provenance
- human approval boundaries
- traceable agent runs

Data handling:

- require login for product access
- every artist profile belongs to an authenticated user/account
- every sensitive table includes user/account and artist ownership fields where relevant
- server-side APIs enforce ownership and must not rely only on client-side filtering
- store platform tokens server-side only
- do not expose API keys in client
- encrypt sensitive tokens and uploads
- record source, consent, and data owner for every connection/upload
- allow user to delete source connection and associated data where required

Secrets and tokens:

- never return provider secrets or OAuth tokens to the client
- store token metadata such as source, owner, scopes, created time, expiry, and revocation/deletion status
- source disconnect should revoke or delete token data where possible
- V1 must not leave orphaned tokens

Audit logging:

- add `audit_events` or equivalent from V1
- log artist profile created/updated
- log source connected/disconnected
- log file uploaded/deleted
- log raw snapshot created
- log evidence normalized
- log Manager run created
- log work product created/edited/approved/rejected/marked done
- log user override recorded
- log deletion request/action
- log platform admin access/action
- include actor, artist/account, action, target object, timestamp, and metadata

Agent traceability:

- every Manager run stores run id, playbook version, evidence ids used, memory references used, work products created, quality gate result, and model/provider metadata where practical
- this supports debugging, trust, auditability, and future compliance work

Uploads:

- store uploaded files securely
- store upload owner, artist, source type, file type, classification, upload time, and raw snapshot link
- V1 can defer malware scanning, but the storage model should leave room for it later

Data deletion:

- user can disconnect a source
- deletion behavior must be explicit for raw snapshots, evidence, memories, work products, and audit events
- V1 can start simple, but must not keep active credentials after disconnect

Provenance:

Every claim must trace to:

- Evidence Item
- user-provided profile context
- playbook rule
- Manager inference

Legal/financial boundaries:

The Manager can prepare questions, checklists, briefs, risk summaries, and issue lists. It cannot provide final legal or accounting advice.

Wellbeing boundaries:

The Manager can flag workload risk, ask capacity questions, recommend reducing scope, and suggest professional support language. It cannot diagnose or provide medical advice.

Deferred until later:

- formal SOC 2 audit
- enterprise SSO/SAML
- complex org roles and permissions
- trust portal
- automated compliance evidence collection
- SIEM integration
- malware scanning pipeline
- DLP
- formal vendor risk workflow
- full policy library

## 31. Design Requirements

Visual direction:

- Modern Label HQ
- editorially premium
- quiet, focused, operational
- deep contrast with restrained color
- artist identity front and center
- work surfaces, not marketing cards
- clear hierarchy and scanability

Interaction direction:

- no blank chat as first screen
- no dashboard wall of charts
- no morning brief made from small metric cards
- every panel connects to action or decision
- evidence is inspectable but not overwhelming
- tasks/checkpoints/notes/memory feel like real management artifacts
- locked agents are honest and useful
- recent conversation rows open threads, not input-prefill shortcuts
- mission detail screens should make the selected mission feel like the active object
- checkpoint screens should show the question being checked, linked tasks, AI-watched signals, status, and decision rule

Primary surfaces:

- Label HQ
- Manager Office
- Conversation Workspace
- Manager Answer / Decision Package
- Missions Workspace
- Tasks Workspace
- Checkpoint Review Workspace
- Notes Workspace
- Mission Memory Drawer
- Evidence Drawer
- locked agent detail cards

Label HQ remains the main product surface. The Manager Office remains the main Manager conversation surface.

Current prototype visual contract:

- premium light-mode Label HQ operating room
- warm off-white background, white panels, subtle borders, restrained shadows
- compact durable sidebar with Label HQ, Staff, Missions, and Settings
- centered two-step setup flow before the operating room
- controlled Ordersounds purple, warm orange, green, and neutral status accents
- large display type only where it earns the space
- rounded, dense operating surfaces rather than marketing sections
- cards are acceptable for repeated objects, but primary surfaces should not feel like disconnected card grids
- Today's Brief is narrative but should not feel like a newspaper page
- The Staff is a compact AI department-head area, not an agent-grid homepage
- Flagged for you holds immediate approvals, evidence gaps, and review triggers
- drawers are evidence-heavy proof surfaces
- workspaces use left navigation plus a dominant selected object when reviewing conversations or missions

## 32. Non-Goals And Traps

Non-goals for V1:

- fully active future agents
- portfolio-level multi-artist analytics as main experience
- automatic paid ad spend
- automatic external sending
- legal or financial advice as final authority
- complete onboarding before first value
- full proactive notification system as launch blocker

Traps:

- generic AI advice
- pretty dashboard with no decisions
- one giant autonomous prompt
- treating all social engagement as equal
- treating streaming lift as culture
- treating social conversation as demand
- letting AI claim data it does not have
- locked agents that feel fake
- work products that are copied answer text
- overcomplicated UI that hides the next move
- making users manage boards when the Manager should drive the operating rhythm

## 33. Non-Functional Requirements

Performance:

- Manager Office should load stored data within 2 seconds on typical broadband.
- Manager run progress should appear immediately after question submission.
- Long-running evidence retrieval should show step status.
- Cached source snapshots should be reused when fresh enough for the playbook.

Reliability:

- failed connectors produce clear evidence gaps, not broken answers
- partial evidence runs produce constrained answers when useful
- work products are not lost if answer rendering fails

Auditability:

- every Manager decision must be reconstructable from run context, evidence used, playbook version, and quality gate result
- work product edits record user, timestamp, and changed fields

Extensibility:

- new sources are added through capability maps and normalizers
- new agents reuse Evidence Items and work-product infrastructure
- new decision types are added through Manager Playbook entries

Accessibility:

- Manager Office must be keyboard navigable
- evidence and work-product states must not rely only on color
- tables/cards must have readable labels and sufficient contrast

## 34. Recommended V1 Build Scope

V1 includes:

- auth-ready foundation
- artist profile creation
- Artist Operating Profile
- Spotify identity/catalog source
- social handle collection
- source capability map abstraction
- raw snapshot storage
- normalized evidence storage
- Manager Office
- Label HQ and Label Team Strip
- locked future agent cards
- first Manager Brief as first mission
- reactive Manager Q&A
- Manager run loop
- Manager playbooks for core decisions
- scoring/readiness gates
- quality gate
- Evidence Drawer
- missions, tasks, tests, agent briefs, artist check-ins, mission records, drafts
- referral object model and locked-agent department briefs
- approval/override boundaries
- simple login-required ownership model
- server-side artist/data scoping
- audit events for key product/security actions
- source token metadata
- secure upload metadata
- source disconnect/deletion path
- Manager run traceability
- structured recommendations and follow-ups
- tests for answer quality, evidence, and unsupported claims

V1 should include if feasible:

- manual evidence upload/entry for Spotify for Artists CSV, YouTube analytics export, budgets, release plan, rights notes, and campaign history
- demo/provider-labeled social evidence when real provider access is not ready
- copyable/exportable briefs and check-ins
- basic in-product follow-up reminders

V1 must not include:

- full active Marketing, Sync & Deals, Touring, Finance/Rights, or other specialist agents
- external sending without approval
- automatic paid ad spend
- full proactive notification system as launch blocker
- claims based on unavailable private analytics
- formal SOC 2 audit
- enterprise SSO/SAML
- complex org roles and permissions
- trust portal or compliance portal
- automated compliance evidence collection
- SIEM/DLP implementation
- malware scanning pipeline

## 35. V1 Build Phases

### Phase 1: Product Foundation

- app shell
- auth-ready user model
- artist profile setup
- Spotify identity selection
- social handle fields
- Artist Operating Profile
- Label HQ and locked agent cards

### Phase 2: Evidence Foundation

- source capability maps
- raw snapshot storage
- evidence item schema
- demo/provider/manual evidence ingestion
- Spotify catalog connector
- manual upload pathway if feasible
- source token metadata
- secure upload metadata
- audit events for source, upload, raw snapshot, and evidence operations

### Phase 3: Manager Brain

- Manager playbooks
- decision classifier
- evidence planner
- evidence sufficiency scorer
- confidence and risk scoring
- readiness gates
- quality gate
- structured answer generation
- memory retrieval

### Phase 4: Manager Work Products

- missions
- tasks
- tests
- department briefs
- artist check-ins
- decision records
- drafts
- approval/override states
- referral objects

### Phase 5: Manager Office UX

- Manager Office
- conversation
- Evidence Drawer
- Active Mission
- Attention Queue
- Work Stack
- Evidence Pulse
- Label Team Strip

### Phase 6: Verification

- golden tests
- quality gate tests
- evidence provenance tests
- ownership/API scoping tests
- token exposure tests
- audit event tests
- work-product creation tests
- referral/locked-agent tests
- demo scenario acceptance

## 36. Engineering Readiness Checklist

Before implementation starts, confirm:

- first demo artist scenario
- V1 stack and hosting
- database provider
- LLM provider and structured output strategy
- which Spotify capabilities are real in V1
- whether Spotify for Artists CSV upload ships in V1
- whether YouTube is public only or auth-ready in V1
- whether social data is provider, demo, manual, or delayed
- exact work-product schemas
- quality gate test fixtures
- approval-state rules
- minimum audit event taxonomy
- source disconnect/deletion behavior
- data retention and deletion policy
- design system direction

## 37. Suggested Starting Stack

Recommended stack:

- React + Vite or Next.js
- TypeScript end to end
- Supabase for auth, Postgres, storage, and edge functions
- OpenAI or another strong LLM provider for structured reasoning
- server-side connector adapters
- Postgres tables for raw snapshots, evidence, runs, memory, and work products

Keep connector logic server-side. Do not expose API keys in the client.

## 38. Research Sources

Artist manager role and ethics:

- Berklee Artist Manager: https://www.berklee.edu/careers/roles/artist-manager
- UK Music Music Manager: https://www.ukmusic.org/job-profiles/music-manager/
- MMF Code of Practice: https://themmf.net/about/code-of-practice/
- MMF Fan Data Guide: https://themmf.net/wp-content/uploads/2023/10/MMF-Fan-Data-Guide.pdf
- Soundcharts Mechanics of Artist Management: https://soundcharts.com/en/blog/the-mechanics-of-management
- MusicAdmin The Team: https://www.musicadmin.com/guides/the-team/
- Audiomack Artist Guide: https://guide.audiomack.com/getting-started/what-does-an-artist-manager-do

Platform and data capabilities:

- Spotify Web API Concepts: https://developer.spotify.com/documentation/web-api/concepts/api-calls
- Spotify for Artists Data: https://artists.spotify.com/en/blog/how-to-read-your-spotify-for-artists-data
- Spotify for Artists Exporting Data: https://support.spotify.com/us/artists/article/exporting-data/
- YouTube Analytics API: https://developers.google.com/youtube/analytics/channel_reports
- YouTube Data API: https://developers.google.com/youtube/v3/docs
- TikTok Display API: https://developers.tiktok.com/doc/display-api-overview
- Instagram Insights Help: https://www.facebook.com/help/instagram/788388387972460
- X API Metrics: https://docs.x.com/x-api/fundamentals/metrics

Market and social music context:

- TikTok and Luminate Music Impact Report: https://newsroom.tiktok.com/tiktok-and-luminate-release-the-latest-music-impact-report
- IFPI Engaging With Music: https://www.ifpi.org/
- Soundcharts Data Sources: https://soundcharts.com/en/datasources
- Viberate Music Analytics: https://www.viberate.com/
- Feature.fm: https://www.feature.fm/
