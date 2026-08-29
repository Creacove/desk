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

## Combined operating loop

The runtime now converges on this sequence:

1. **Observe** — task result, blocker, move, signal, evidence, permission, elapsed watch.
2. **Decide** — determine whether action is needed.
3. **Load current world** — plan, strategy, results, evidence, memory, fresh operating facts.
4. **Ask only if necessary** — one decision-changing fact, with hypothesis/fallback.
5. **Act immediately where safe** — research, analyze, compare, draft, review, replan.
6. **Release exact human work** — only work a human/team must do.
7. **Follow up** — reminders/accountability based on real human time.
8. **Review result** — interpret what happened.
9. **Watch reality when needed** — do not invent fake Manager workdays.
10. **Adapt** — preserve durable strategy, change the route when evidence/reality requires it.

The artist should not have to prompt between these stages.

## Shared ontology

| Object | Meaning |
| --- | --- |
| Mission | outcome Desk is responsible for managing |
| Strategy state | durable current thesis/intent/constraints for the Mission |
| Plan version | current executable route |
| Task | human/team/external work that consumes real human time |
| Manager action | Desk-owned research/analysis/drafting/review/replanning; automatic |
| Question | one missing human fact that changes a current decision |
| Operating fact | scoped/fresh fact about the artist's execution reality |
| Permission request | Desk knows what to do but needs approval before the external/irreversible action |
| Review/watch | waiting for enough external reality/signal to make a decision |
| Checkpoint | meaningful phase-ending management decision gate |
| Result | evidence of what happened after human work |
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
- replanning.

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
8. Exact human content work appears.
9. Artist completes/submits result.
10. Desk reviews immediately.
11. Follow-up human work is released or a reality watch begins.
12. Enough evidence reaches a real checkpoint.
13. Desk chooses what expression deserves repetition and installs the next route.

Failure anywhere the artist must ask “what next?” is a Manager Runtime failure.

## Source-of-truth hierarchy

To prevent competing systems:

- Manager Runtime owns continuation.
- Mission owns the outcome.
- Strategy state owns durable campaign intent.
- Plan version owns the current route.
- Tasks own human execution.
- World Model owns scoped/fresh operational facts.
- Today should surface current work; it should not become another task database.
- Manager conversation is an interaction surface, not the only memory/state store.
- WhatsApp can later become a delivery/conversation surface, not a second Manager brain.
- Calendar can later mirror human time, not own the plan.

## Next documentation/implementation areas

After the World Model/Question Engine slice is fully green, the next Manager Runtime documents should cover:

1. **Today execution surface** — what appears first, how priorities are selected, how Desk-watching state appears without clutter.
2. **Content execution object** — full contract for shoot/script/hook/shot/edit/song cue/CTA/proof rather than generic task steps.
3. **Execution behavior learning** — how repeated task outcomes safely change future task sizing/timing without overfitting one event.
4. **Calendar mirror** — human-time-only sync and conflict behavior.
5. **WhatsApp delivery** — Manager Runtime remains source of truth; WhatsApp carries reminders/questions/results.
6. **External action permissions** — progressive trust for outreach, submissions, publishing and spend.

Do not jump to channel integrations before the core Manager loop is reliable.