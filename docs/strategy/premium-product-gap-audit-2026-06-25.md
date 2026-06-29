# Premium Product Gap Audit - June 25, 2026

## Executive Verdict

The product is not yet at the $1,000/month independent-artist-team standard, and it is not yet at the level where a serious major-label team would say the product is strategically indispensable.

The ambition is correct. The docs describe a serious AI record label operating system. The schema already contains many of the right durable objects: sources, evidence, manager outputs, missions, checkpoints, tasks, task results, reviews, permissions, conversations, memory, agent reports, and operating events.

The live behavior is not yet matching that ambition. Today, the product can produce useful reads and create mission scaffolding, but too much of the system is still:

- single-lane analysis instead of multi-domain management
- prompt/output driven instead of operating-loop driven
- public-data heavy instead of private-evidence aware
- UI-shell complete but workflow shallow
- mission creation focused on conversion/source readiness instead of the full artist management range
- conversation and decision-package shaped, but not yet a real Manager router

For a Drake, Justin Bieber, Asake, major-label, or serious independent team, the current product would feel promising but not yet operationally deep enough to run the artist's work.

## What Is Already Strong

The product has a strong foundation. These should be protected and expanded, not replaced:

- The product doctrine is excellent: an AI record label, not an analytics dashboard or generic chatbot.
- The mission pattern contract has the right management domains: career architecture, positioning, A&R, release strategy, audience development, market expansion, marketing operations, touring, partnerships, rights/finance, team operations, reputation/wellbeing, and data intelligence.
- Supabase schema already anticipates a real operating system: missions, tasks, checkpoints, task results, reviews, permissions, memory, conversations, agent reports, source snapshots, and evidence links.
- Chartmetric and Spotify catalog ingestion are partially real, with raw snapshots, source sync jobs, normalized evidence, and usage tracking.
- Manager Intelligence now has an initial packet spine under `supabase/functions/_shared/manager-intelligence/`.
- Today's Brief and music reads are moving toward generated Manager language instead of static fixture copy.
- Mission Genesis already runs server-side, persists missions/tasks/checkpoints/permission requests, and uses OpenAI for mission authoring.
- The frontend has the correct surface map: Label HQ, Staff, Missions, Music, Manager Office, supporting evidence, and Settings.

## Core Product Gap

The app currently knows how to talk about management better than it knows how to operate like management.

A premium artist team is not paying $1,000/month for a good paragraph. They are paying for the system to:

- understand the artist's actual situation
- identify the real constraint or opportunity
- decide what matters now
- create the correct work
- assign reviewable tasks
- protect the artist from bad moves
- use evidence with confidence boundaries
- learn from task results, source changes, and prior decisions
- coordinate across management domains
- preserve memory and explain what changed

The product is still too often producing a read, then a narrow mission, instead of running that full loop.

## Gap 1: Today's Brief Leaks Internal Evidence Reads

Current issue:

- `DeskHQ.tsx` renders `ManagerEvidenceReadList` inside the visible Manager's Read area.
- The UI already has `View supporting evidence`, so this duplicates the evidence surface.
- `managerEvidenceReads` should be internal input for synthesis and optional supporting evidence context, not a separate visible section inside the Manager read.

Why it lowers product quality:

- It makes the Manager's Read feel like assembled evidence cards instead of one premium management judgment.
- It exposes the packet mechanics instead of making the intelligence feel native.
- It works against the product rule that playbooks, internal reasoning, and evidence interpretation should feed the Manager output rather than become visible scaffolding.

Fix:

- Stop rendering `managerEvidenceReads` inside the Manager's Read.
- Keep `managerEvidenceReads` in the packet and prompt context.
- Let OpenAI synthesize them into the narrative Manager's Read.
- Keep detailed source/evidence inspection behind `View supporting evidence`.

## Gap 2: Manager Intelligence Packet Is Too Shallow

Current issue:

- `strategicIntelligencePacket.ts` builds one primary management insight, one primary asset read, shallow market reads, and a thin mission seed.
- The playbook router applies useful labels, but those labels barely shape the packet.
- The packet's `mission_seed_json` is effectively "conversion" or "source readiness."
- The packet does not yet produce enough structured intelligence for elite management decisions across domains.

Why it lowers product quality:

- The system cannot consistently reason like a manager across career, market, rights, A&R, touring, partnerships, operations, and wellbeing.
- Missions inherit the thin packet and become repetitive.
- Rich metrics like artist score, rank, fanbase vs engagement, market concentration, Shazams, playlist reach, TikTok activity, and source limitations are not being turned into a complete management map.

Fix:

- Expand the Strategic Intelligence Packet into a true artist operating packet.
- Add structured sections for:
  - career stage and leverage
  - artist positioning
  - catalog/asset roles
  - audience quality
  - market concentration and expansion logic
  - conversion vs attention
  - rights/business risk
  - team capacity
  - source confidence
  - active work and open decisions
  - recommended mission candidates across multiple domains
  - what not to do
  - what would change the recommendation
- Keep playbook names internal, but make their influence operationally visible through the packet fields.

## Gap 3: Mission Genesis Is Structurally Single-Mission

Current issue:

- `openaiMissionGenesis.ts` schema returns one `mission`, one set of checkpoints, and one set of tasks.
- The user expectation is that the system may create several missions depending on workspace data.
- The mission seed currently points the model toward the strongest attention or source-readiness lane.

Why it lowers product quality:

- Serious artist teams rarely have only one active management objective.
- Drake or Asake's team might need simultaneous missions for market expansion, rights cleanup, creator validation, release review, touring readiness, brand/sync readiness, and team operations.
- A single mission engine keeps forcing the product into "promote the best track" mode.

Fix:

- Introduce mission candidate generation before activation.
- Let the Manager return multiple mission candidates with worthiness scores and domain composition.
- Persist only the missions that pass worthiness and context gates.
- Keep one mission focused on one durable objective, but allow several missions to exist when the artist's data supports them.

## Gap 4: Mission Domains Are Documented But Not Implemented As Runtime Logic

Current issue:

- `docs/workflows/mission-pattern-contract.md` defines a strong domain model.
- Runtime packet generation does not yet use those domains as a real mission-selection system.
- The code has a playbook router, but not a mission-pattern registry that can compose domains and generate domain-specific tasks/checkpoints.

Why it lowers product quality:

- Missions over-index on marketing/conversion.
- The app misses high-value team work like rights cleanup, sync readiness, revenue investigation, city/live-market validation, team operations, career architecture, artist positioning, reputation/wellbeing, and data completeness.
- The product cannot yet feel like a label team.

Fix:

- Build a runtime mission pattern registry from the contract.
- Each pattern should define:
  - when to use it
  - required evidence
  - missing evidence questions
  - common task types
  - checkpoint questions
  - permission boundaries
  - review triggers
  - success/blockage states
  - change conditions
- Mission Genesis should select, compose, or create ad hoc patterns from the registry.

## Gap 5: Manager Office Is Mostly A Shell

Current issue:

- `ManagerScreens.tsx` renders Ask Manager, conversation history, investigation, and decision package screens.
- `productionSupabase.ts` only loads conversation headers and maps messages/created work to empty arrays.
- The Ask Manager input navigates to a static investigation/decision package flow instead of sending a real Manager conversation run.
- The static decision package says "Budget call" regardless of actual artist context.

Why it lowers product quality:

- This is where a premium team expects the most depth.
- A real artist team will ask: "Should we move this release?", "Should we accept this deal?", "What do we do with this market?", "What do we tell the artist?"
- The current UI implies those workflows exist, but production behavior does not yet perform the routing, persistence, decision package creation, or artifact updates.

Fix:

- Implement the Manager Conversation Router described in `docs/workflows/manager-conversation-router.md`.
- Persist user and Manager messages.
- Classify the message.
- Load related missions, tasks, checkpoints, memory, evidence, source limits, agent reports, permissions, and prior decisions.
- Create real decision packages, mission updates, tasks, reviews, drafts, permission requests, or memory entries as appropriate.
- Return linked work to the UI.

## Gap 6: Task Completion Does Not Yet Trigger True AI Review

Current issue:

- `completeTask` writes task state events, task results, memory, and operating events.
- `interpretTaskResult` and `buildCheckpointReview` are deterministic strings.
- There is no real Manager review run that compares the task result against the checkpoint question, evidence, mission goal, and prior recommendation.

Why it lowers product quality:

- Premium teams need the system to learn from completed or blocked work.
- "Done" should not only change progress. It should answer: did this change the mission, prove the market, unlock spend, create a blocker, or require a pivot?

Fix:

- Add a checkpoint review Edge Function.
- On task result, run Manager review against:
  - task result
  - checkpoint decision rule
  - mission objective
  - linked evidence
  - prior recommendation
  - source limitations
  - memory
- Persist review, checkpoint update, memory entry, and any created/updated tasks.

## Gap 7: Specialist Agents Are Visible But Not Operational

Current issue:

- Staff agents exist in seed data and UI.
- Agent report tables exist.
- Mission Genesis loads agent reports.
- Locked agent workspaces are mostly informational.
- There is no real specialist-report generation loop for Marketing, Sync & Deals, Touring, or Finance/Rights.

Why it lowers product quality:

- A premium AI label should feel like a coordinated team, even if only Manager is fully active.
- Locked agents can still produce limited readiness reports or source requests without pretending to execute unavailable specialist work.

Fix:

- Add specialist readiness/report runs.
- Locked agents should produce:
  - what they can assess now
  - what evidence is missing
  - what they recommend the Manager consider
  - what action requires unlock/permission/source connection
- Feed these reports into Today's Brief, Mission Genesis, Manager Chat, and decision packages.

## Gap 8: Source Depth Is Not Yet Premium Enough

Current issue:

- The strongest current data paths are public Spotify catalog and Chartmetric.
- The docs correctly identify that private Spotify for Artists, YouTube Studio, TikTok/Instagram private analytics, smart-link reports, royalty statements, campaign reports, split sheets, and uploaded context are needed for premium decisions.
- Some upload infrastructure exists, but source ingestion and evidence normalization are still incomplete for the most valuable private data.

Why it lowers product quality:

- Elite teams already have surface-level public data.
- The premium value comes from combining public signal with private proof: saves, source-of-stream, listeners, retention, spend, revenue, rights, payout, owned fan capture, ticketing, and campaign results.

Fix:

- Prioritize source readiness and upload workflows for:
  - Spotify for Artists CSV/export
  - smart-link reports
  - campaign reports
  - royalty/distributor statements
  - split sheets and rights documents
  - creator/content test results
  - live history/ticketing notes
- Normalize these into evidence with provenance, confidence, freshness, and limitations.

## Gap 9: Evidence Lineage Is Partial, Not Yet Decision-Grade

Current issue:

- Evidence items and evidence links exist.
- Today's Brief persists evidence links.
- Mission Genesis validates source refs.
- But UI lineage is not yet consistent across Manager reads, missions, tasks, decisions, reviews, and conversations.

Why it lowers product quality:

- Premium users need trust. They must know what the system knows, what it does not know, and why it is making a call.
- Evidence should support claims without turning the main read into a source dump.

Fix:

- Every Manager output should have claim-level evidence references internally.
- UI should expose evidence on demand through supporting evidence drawers, decision-package evidence, mission evidence, and review evidence.
- Avoid evidence-card duplication inside narrative reads.

## Gap 10: Tests Guard Architecture But Not Premium Scenario Quality

Current issue:

- The repo has many tests, but many are source-string tests or structural tests.
- There are fewer golden scenario tests that prove the product produces premium outputs for realistic artist situations.

Why it lowers product quality:

- A generic mission can pass schema checks.
- A weak Manager read can pass storage/prompt tests.
- The real question is whether the output would help a serious team act.

Fix:

- Add golden scenario tests for:
  - Drake-level global artist with multiple active markets and brand/sync constraints
  - Bieber-level legacy catalog plus new-cycle positioning
  - Asake-level home-market power plus diaspora/global expansion
  - emerging artist with TikTok spike but no private conversion proof
  - artist with rights blocker before release
  - artist with campaign spend but weak conversion
  - artist with strong city signal needing live-market validation
  - artist with revenue question requiring royalty upload
- Tests should assert mission diversity, evidence grounding, non-generic tasks, permission gates, and "what not to do."

## Recommended Repair Approach

### Option A: Patch The Current Screens And Prompts

This is fastest. It can remove the visible Evidence Read, strengthen the prompt, and improve Mission Genesis wording.

Risk: it will not solve the underlying operating-system gap. The product will still be prompt-led and single-mission shaped.

### Option B: Build The Manager Intelligence And Mission Engine Spine First

This is recommended.

The system should become:

```text
Sources + profile + music + memory + missions + tasks + evidence + agent reports
  -> Strategic Intelligence Packet
  -> Today's Brief
  -> Mission Candidate Engine
  -> Manager Conversation Router
  -> Decision Packages
  -> Task/Checkpoint Reviews
  -> Memory and operating events
```

Why this is the right path:

- It fixes the reason outputs feel generic.
- It makes all surfaces consume the same intelligence.
- It supports multiple missions.
- It lets Today&apos;s Brief stay clean while still feeding missions and decisions.
- It turns the product from a good read generator into an operating system.

### Option C: Polish UX First

This can improve demo perception but is risky.

Risk: the product will look premium but collapse when a serious team asks real management questions.

## Recommended Implementation Plan

### Phase 1: Correct Today's Brief And Packet Synthesis

- Remove visible `ManagerEvidenceReadList` from the Manager's Read.
- Keep evidence reads in the OpenAI packet and prompt.
- Expand KPI/playbook instructions so OpenAI knows how to interpret scores, ranks, fanbase vs engagement, market concentration, attention vs conversion, and source limits.
- Add tests that assert the visible brief does not render "Evidence read" while supporting evidence remains available.

### Phase 2: Upgrade Strategic Intelligence Packet

- Expand `strategicIntelligencePacket.ts` into a multi-domain artist operating packet.
- Add domain reads, source readiness, confidence, risks, "do not do," change conditions, and mission candidate seeds.
- Convert playbook routing from labels into structured packet influence.
- Add packet tests for multiple lenses and multiple mission candidate directions.

### Phase 3: Build Mission Pattern Runtime

- Create a mission pattern registry based on `mission-pattern-contract.md`.
- Let the Manager compose patterns.
- Change Mission Genesis schema to support multiple mission candidates before activation.
- Persist several active missions when justified.
- Remove generic safe-parser fallback questions/tasks/checkpoints.

### Phase 4: Implement Manager Conversation Router

- Add Edge Function for Manager Office messages.
- Persist conversations and messages.
- Produce structured Manager run plans.
- Create decision packages, mission updates, tasks, reviews, work drafts, permission requests, and memory entries.
- Replace static investigation/decision package UI with real run output.

### Phase 5: Add AI Checkpoint Review Loop

- On task completion/block, run Manager review.
- Update checkpoint status/recommendation from AI synthesis, not deterministic text.
- Persist review and memory.
- Let reviews create follow-up tasks or mission changes when appropriate.

### Phase 6: Source And Upload Premium Data

- Add private-data upload paths and normalization for the highest-value sources.
- Start with Spotify for Artists export, smart-link report, campaign report, royalty/distributor statement, and split sheet.
- Make source readiness visible as an operating concern, not a generic warning.

### Phase 7: Specialist Readiness Reports

- Add locked-agent limited reports.
- Feed reports into packet, brief, missions, and Manager Chat.
- Do not imply external action or unlocked specialist execution.

### Phase 8: Golden Scenario Quality Gates

- Add scenario tests for Drake, Bieber, Asake, emerging artist, rights blocker, campaign review, city validation, and revenue investigation.
- Tests should fail when outputs collapse into playlist saves, counts, generic promotion, or "push the strongest song."

## First Fixes To Make Immediately

1. Remove the visible "Evidence read" section from Today's Brief.
2. Keep `managerEvidenceReads` internal and prompt-fed.
3. Strengthen the Today's Brief prompt so evidence reads are synthesized into the Manager's Read.
4. Replace the thin `mission_seed_json` with multi-domain mission candidate directions.
5. Remove generic safe-parser fallback mission questions/tasks/checkpoints.
6. Add mission pattern registry scaffolding.
7. Let Mission Genesis return multiple mission candidates or no mission.
8. Implement real conversation message loading and persistence.
9. Replace static decision-package UI with real Manager run output.
10. Add golden scenario tests that fail on generic promotion/playlist-save missions.

## Product Bar For Acceptance

The product reaches the premium bar when these are true:

- Today's Brief reads like a senior manager wrote one synthesized operating judgment.
- Supporting evidence is inspectable but not duplicated as visible scaffolding.
- The system creates different kinds of missions depending on artist reality.
- Missions are not all promotion campaigns.
- Tasks are concrete team actions, not vague metric requests.
- Task results change checkpoints, reviews, memory, and next actions.
- Manager Office can answer serious questions and create/update real work.
- Source limitations are explicit without making the product feel weak.
- Locked specialists contribute limited reports without pretending to be fully active.
- A serious artist team can use the product to decide, act, and learn every week.

