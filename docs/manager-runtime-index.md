# Desk Manager Runtime — documentation map

This is the entry point for the Manager Runtime work.

The system should be read as one operating loop, not as independent AI features.

## North star

Desk is the operating manager for the artist.

The artist should experience:

`Desk understands -> Desk decides -> Desk does what it can -> Desk gives exact human work -> Desk follows up -> Desk reviews reality -> Desk adapts`

The artist should not need to know the right prompt or manage the Mission graph.

## Product review standard

Start with:

- [`manager-runtime-product-lenses.md`](./manager-runtime-product-lenses.md)

Every Manager Runtime slice must reduce management effort, preserve trust, model time correctly, have durable continuation, and move the experience toward “I have a manager now.”

## Runtime sequence

### 1. Foundation

- [`manager-runtime-foundation.md`](./manager-runtime-foundation.md)

Introduces the core operating contract:

- three clocks;
- operational memory/freshness primitives;
- human task reminder lifecycle;
- automatic continuation after task review;
- checkpoint UX distinction between human work and Desk watching/review;
- channel-agnostic reminder architecture.

Core rule:

> Manager-owned work is not a human task.

### 2. Human execution loop

- [`manager-runtime-execution-loop.md`](./manager-runtime-execution-loop.md)

Turns Tasks into accountability interactions rather than static list items.

Human actions include:

- Start;
- Done;
- Move it;
- I'm blocked.

The important product shift is that a change in human reality is a Manager trigger, not merely a task-status update.

Core rule:

> Human reality changes -> Desk evaluates the consequence.

### 3. Adaptive replan

- [`manager-runtime-adaptive-replan.md`](./manager-runtime-adaptive-replan.md)

Closes the gap between “Desk noticed the plan is at risk” and “Desk actually changed the plan.”

Adds:

- durable adaptive reviews;
- bounded retries;
- one replan owner per Mission;
- complete replacement plan compilation;
- atomic plan installation;
- stale-plan concurrency guard;
- no invented dates;
- fail-closed behavior.

Core rule:

> If the current route no longer works, Desk compiles and installs one coherent replacement route without another artist prompt.

### 4. Artist World Model + Question Engine

- [`manager-world-model-question-engine.md`](./manager-world-model-question-engine.md)
- [`manager-world-model-acceptance-matrix.md`](./manager-world-model-acceptance-matrix.md)

Adds a structured operational understanding of the artist's real world:

`People × Places × Equipment × Money × Time × Skills × Access × Preferences × Team × Language × Mobility × Execution behavior`

It also gives the adaptive compiler a third outcome:

`no_change | needs_context | replan`

A question is allowed only when one missing human fact genuinely changes the current management decision.

Core rule:

> Desk asks only when it already has a hypothesis and needs one fact to choose the route.

### 5. Today execution surface

- [`manager-today-execution-surface.md`](./manager-today-execution-surface.md)

Turns Home into the Manager's current assignment surface rather than a multi-Mission task browser.

Defines:

- one global current priority;
- `needs_you | human_action | human_follow_up | desk_watch` projections;
- deterministic priority tiers from durable runtime state;
- no OpenAI call on Home render;
- question/permission/task/watch projection without duplicating source objects;
- Today vs Today's Brief separation;
- composer as changed-reality escape hatch.

Core rule:

> Opening Desk should answer “what does my manager need from me now?” before the artist types anything.

### 6. Content execution object

- [`manager-content-execution-object.md`](./manager-content-execution-object.md)

Defines a first-class production brief for content Tasks so strategy cannot collapse into “make engaging content.”

The brief carries, when relevant:

- objective/hypothesis;
- concept;
- resources/setup;
- hook;
- script mode/talking points;
- shot plan;
- song cue;
- edit direction;
- CTA/desired response;
- proof/result mode;
- fallback.

It also defines the automatic:

`capture -> Manager review -> smallest useful revision -> publish -> response watch -> Manager evaluation`

loop.

Core rule:

> A content Task is not ready until the artist can make it without another “how?” prompt.

### 7. Execution behavior learning

- [`manager-execution-behavior-learning.md`](./manager-execution-behavior-learning.md)

Defines how Desk can learn from repeated real execution without turning one missed Task into a permanent judgment.

Potential learned patterns include:

- realistic task duration;
- collaboration advantage;
- useful response windows;
- travel burden;
- script/production mode;
- resource fragility.

Patterns require repeated observation, confidence, recency and contradiction handling.

Core rule:

> Desk should increasingly assign work this artist actually completes, without scoring or judging the artist.

### 8. Reminder channels, Calendar and WhatsApp

- [`manager-reminder-channels-calendar-whatsapp.md`](./manager-reminder-channels-calendar-whatsapp.md)

Preserves one source of truth while adding external delivery surfaces.

Defines:

- channel-neutral reminder intent;
- reminder intensity/quiet-hour behavior;
- WhatsApp outbound accountability and bounded inbound actions;
- provider delivery receipts vs Task state;
- Google Calendar human-time-only mirroring;
- Calendar edit/delete conflict behavior;
- idempotency/reconciliation;
- graceful provider failure.

Core rule:

> Desk owns management state; WhatsApp delivers accountability; Calendar mirrors real human time.

## Combined operating loop

The runtime now converges on this sequence:

1. **Observe** — task result, blocker, move, signal, evidence, permission, elapsed watch.
2. **Decide** — determine whether action is needed.
3. **Load current world** — plan, strategy, results, evidence, memory, fresh operating facts.
4. **Ask only if necessary** — one decision-changing fact, with hypothesis/fallback.
5. **Act immediately where safe** — research, analyze, compare, draft, review, replan.
6. **Release exact human work** — only work a human/team must do.
7. **Project Today** — show the one current priority/need without recomputing strategy.
8. **Follow up** — reminders/accountability based on real human time.
9. **Review result** — interpret what happened.
10. **Watch reality when needed** — do not invent fake Manager workdays.
11. **Learn execution patterns cautiously** — improve task fit from repeated behavior.
12. **Adapt** — preserve durable strategy, change the route when evidence/reality requires it.

The artist should not have to prompt between these stages.

## Shared ontology

| Object | Meaning |
| --- | --- |
| Mission | outcome Desk is responsible for managing |
| Strategy state | durable current thesis/intent/constraints for the Mission |
| Plan version | current executable route |
| Task | human/team/external work that consumes real human time |
| Content execution brief | structured production instructions attached to a content Task |
| Manager action | Desk-owned research/analysis/drafting/review/replanning; automatic |
| Question | one missing human fact that changes a current decision |
| Operating fact | scoped/fresh fact about the artist's execution reality |
| Execution pattern | repeated, confidence-bounded evidence about how the artist actually completes work |
| Permission request | Desk knows what to do but needs approval before the external/irreversible action |
| Review/watch | waiting for enough external reality/signal to make a decision |
| Checkpoint | meaningful phase-ending management decision gate |
| Result | evidence of what happened after human work |
| Reminder intent | channel-neutral accountability delivery request |
| Channel delivery | provider-specific delivery receipt/state; never Task truth |
| Calendar link | mapping between a real human Task/time block and provider event |
| Today projection | current human-facing priority projection of runtime state |
| Operating event | durable trigger/audit record for runtime continuation |

Do not collapse these back into one generic task object.

## Three clocks

### Human time

Calendar/reminder eligible:

- filming;
- recording;
- calling;
- meetings;
- travel;
- approvals;
- posting;
- physical/offline work.

### Manager time

Runs as soon as prerequisites exist:

- research;
- analysis;
- comparison;
- drafting;
- review;
- synthesis;
- replanning;
- execution-pattern aggregation.

### Reality time

Represented as watch/review:

- audience response;
- platform signal;
- collaborator reply;
- release/event timing;
- external outcomes.

Never schedule `Day 4 — Desk analyzes`.

## Odaeshi golden path

Use Odaeshi as the cross-slice acceptance scenario.

1. Desk understands the artist-confirmed resilience / bulletproof / tested-but-still-standing / collective-strength meaning.
2. Strategy chooses participation proof before broad spend.
3. Desk has a specific first content hypothesis.
4. One required resource fact is unknown.
5. Desk asks one contextual question, not a questionnaire.
6. Artist answer becomes scoped/fresh operating fact.
7. Runtime continues automatically.
8. Today projects the exact next human action.
9. Full content execution brief tells the artist exactly what to make.
10. Artist completes/submits raw result.
11. Desk reviews immediately and chooses the smallest useful revision.
12. Follow-up human work is released or a reality watch begins.
13. Calendar/WhatsApp may mirror/deliver the same canonical work according to preference.
14. Enough evidence reaches a real checkpoint.
15. Desk chooses what expression deserves repetition and installs the next route.
16. Repeated execution outcomes can cautiously improve how future work is sized/timed.

Failure anywhere the artist must ask “what next?” or reconcile competing systems is a Manager Runtime failure.

## Source-of-truth hierarchy

To prevent competing systems:

- Manager Runtime owns continuation.
- Mission owns the outcome.
- Strategy state owns durable campaign intent.
- Plan version owns the current route.
- Tasks own human execution.
- Content execution brief describes a content Task; it does not own a separate campaign.
- World Model owns scoped/fresh operational facts.
- Execution learning summarizes repeated behavior; it does not become a separate planner.
- Today projects current work; it does not become another task database.
- Manager conversation is an interaction surface, not the only memory/state store.
- WhatsApp is a delivery/conversation surface, not a second Manager brain.
- Calendar mirrors human time, not the plan.

## Remaining documentation/implementation areas

The next important contracts are:

1. **External action permissions / progressive trust** — outreach, submissions, publishing, spend and irreversible external actions.
2. **Today/content implementation plan** — exact migrations/components/compiler/finalizer changes from the new specs.
3. **Media result pipeline** — task-scoped video/image evidence storage and Manager review without misusing canonical song assets.
4. **Career Watch** — material-change event detection that wakes Manager without expensive constant research.
5. **Semantic evidence packing** — bounded public/private evidence fields in every relevant Manager opening packet.
6. **Calendar/WhatsApp provider implementation** — only after core Today/content execution remains green.

Do not jump to broad channel/chat integrations before the core Manager loop is reliable.