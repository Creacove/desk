# Desk Manager Runtime — documentation map

This is the entry point for the Manager Runtime work.

## North star

Desk is the operating manager for the artist.

The artist should experience:

`Desk understands -> Desk decides -> Desk does what it can -> Desk gives exact human work -> Desk follows up -> Desk watches results -> Desk adapts`

The artist should not need the right prompt or have to manage the Mission graph.

## Shared review standard

- [`manager-runtime-product-lenses.md`](./manager-runtime-product-lenses.md)

Every slice must improve real utility, reduce user effort, use fresh context, have bounded reasoning, continue durably, preserve autonomy/trust boundaries, model the three clocks correctly, and move the experience toward **“I have a manager now.”**

---

# Runtime sequence

## 1. Foundation

- [`manager-runtime-foundation.md`](./manager-runtime-foundation.md)

Core rule:

> Manager-owned work is not a human task.

## 2. Human execution loop

- [`manager-runtime-execution-loop.md`](./manager-runtime-execution-loop.md)

Human actions:

- Start
- Done
- Move it
- I'm blocked

Core rule:

> Human reality changes -> Desk evaluates the consequence.

## 3. Adaptive replan

- [`manager-runtime-adaptive-replan.md`](./manager-runtime-adaptive-replan.md)

Core rule:

> If the current route no longer works, Desk installs one coherent replacement route without another artist prompt.

## 4. Artist World Model + Question Engine

- [`manager-world-model-question-engine.md`](./manager-world-model-question-engine.md)
- [`manager-world-model-acceptance-matrix.md`](./manager-world-model-acceptance-matrix.md)

World Model:

`People × Places × Equipment × Money × Time × Skills × Access × Preferences × Team × Language × Mobility × Execution behavior`

Adaptive decisions:

`no_change | needs_context | replan`

Core rule:

> Desk asks only when it already has a hypothesis and needs one fact to choose the route.

## 5. Today execution surface

- [`manager-today-execution-surface.md`](./manager-today-execution-surface.md)

Defines one global current priority, question/permission/task/watch projection, no OpenAI call on Home render, and separation between Today execution and Today's Brief intelligence.

Core rule:

> Opening Desk should answer “what does my manager need from me now?” before the artist types anything.

## 6. Content execution object

- [`manager-content-execution-object.md`](./manager-content-execution-object.md)

Content Tasks carry, where relevant:

- objective/hypothesis;
- concept;
- resources/setup;
- hook;
- talking points;
- shot plan;
- song cue;
- edit direction;
- CTA/desired response;
- success signal;
- lightweight proof;
- fallback.

### Hard constraint

**Desk does not require artists to upload campaign videos/images to OrderSounds/Supabase.**

The normal content loop is:

`exact brief -> artist creates/posts in existing tools -> connected platform or public URL identifies the post -> response watch -> Manager evaluates available metrics/evidence -> next move`

Desk must not claim visual or comment-level insight it did not actually receive.

Core rule:

> A content Task is not ready until the artist can make it without another “how?” prompt.

## 7. Execution behavior learning

- [`manager-execution-behavior-learning.md`](./manager-execution-behavior-learning.md)

Core rule:

> Desk should increasingly assign work this artist actually completes, without scoring or judging them.

## 8. Reminder channels, Calendar and WhatsApp

- [`manager-reminder-channels-calendar-whatsapp.md`](./manager-reminder-channels-calendar-whatsapp.md)

Core rule:

> Desk owns management state; WhatsApp delivers accountability; Calendar mirrors real human time.

## 9. External action permissions

- [`manager-external-action-permissions.md`](./manager-external-action-permissions.md)

Core rule:

> Prepare freely. Ask at the effect boundary. Bind approval to the exact effect. Continue automatically after approval.

---

# Build sequence

- [`manager-runtime-next-implementation-roadmap.md`](./manager-runtime-next-implementation-roadmap.md)

Recommended implementation order:

1. Today Runtime Projection
2. Content Execution Task Contract
3. Connected Post Evidence + Response Watch
4. External Action Permission Execution
5. Execution Behavior Learning
6. Google Calendar Human-Time Mirror
7. WhatsApp Accountability Delivery
8. Career Watch + Semantic Evidence Packing

There is deliberately **no campaign-media upload/storage slice**.

---

# Shared ontology

| Object | Meaning |
| --- | --- |
| Mission | outcome Desk manages |
| Strategy state | durable current thesis/intent/constraints |
| Plan version | current executable route |
| Task | human/team/external work consuming human time |
| Content execution brief | structured instructions attached to a content Task |
| Manager action | Desk-owned research/analysis/drafting/review/replan; automatic |
| Question | one missing human fact changing a decision |
| Operating fact | scoped/fresh fact about execution reality |
| Execution pattern | repeated confidence-bounded evidence about how the artist executes |
| Permission request | exact authorization before external/irreversible effect |
| External action run | actual provider/tool execution after authorization |
| Review/watch | waiting for external reality/signal |
| Checkpoint | meaningful management decision gate |
| Result | evidence of what happened |
| Post evidence | platform post identity/URL/metrics; no campaign media bytes required |
| Reminder intent | channel-neutral accountability request |
| Channel delivery | provider delivery state; never Task truth |
| Calendar link | mapping from human Task/time block to provider event |
| Today projection | current human-facing projection of runtime state |
| Operating event | durable trigger/audit record |

---

# Three clocks

## Human time

Calendar/reminder eligible:

- filming;
- recording;
- calls;
- meetings;
- travel;
- approvals;
- posting;
- physical/offline work.

## Manager time

Runs immediately when prerequisites exist:

- research;
- analysis;
- drafting;
- comparison;
- synthesis;
- replanning;
- response evaluation;
- execution-pattern aggregation.

## Reality time

Represented as watch/review:

- audience response;
- platform metrics;
- collaborator reply;
- release/event timing;
- external outcomes.

Never schedule `Day 4 — Desk analyzes`.

---

# Odaeshi golden path

1. Desk understands the artist-confirmed Odaeshi meaning.
2. Strategy chooses participation proof before broad spend.
3. Desk has a specific content hypothesis.
4. One resource fact is unknown.
5. Desk asks one contextual question.
6. Answer becomes scoped/fresh operating fact.
7. Runtime continues automatically.
8. Today projects the exact next human action.
9. Content execution brief says exactly what to make.
10. Artist creates and posts through normal tools/platforms.
11. TikTok connection identifies the post automatically where possible; otherwise artist pastes the public URL.
12. Desk starts a response watch.
13. Available post metrics mature.
14. Desk evaluates the campaign signal without pretending it watched unseen footage or read unavailable comments.
15. Desk releases the next Task, asks one needed question, requests permission, or replans.
16. If an external effect is recommended, Desk prepares it fully before asking approval.
17. Calendar/WhatsApp may mirror/deliver the same canonical work according to preference.
18. Repeated outcomes can cautiously improve future task fit.

Failure anywhere the artist has to ask **“what next?”** or reconcile competing systems is a Manager Runtime failure.

---

# Source-of-truth hierarchy

- Manager Runtime owns continuation.
- Mission owns the outcome.
- Strategy state owns durable campaign intent.
- Plan version owns the current route.
- Tasks own human execution.
- Content execution brief describes the Task; it does not own a separate campaign.
- World Model owns scoped/fresh operating facts.
- Post evidence owns lightweight public/result evidence; it does not store campaign media.
- Execution learning summarizes repeated behavior; it is not another planner.
- Permission Request authorizes an exact effect; External Action Run records whether it happened.
- Today projects current work; it is not another task database.
- Manager conversation is an interaction surface, not the only state store.
- WhatsApp is a delivery/conversation surface, not a second Manager brain.
- Calendar mirrors human time, not the plan.

---

# Remaining deeper contracts

1. **TikTok / connected post evidence implementation** — OAuth, post matching, metric snapshots, response watches.
2. **Career Watch** — material-change detection without expensive constant research.
3. **Semantic evidence packing** — bounded public/private evidence fields in Manager packets.
4. **Team authority model** — who can approve spend/publish/rights/release actions.
5. **Provider-specific Calendar/WhatsApp runbooks** — when those integrations are implemented.

Do not add campaign-media upload infrastructure to recover capabilities the core product explicitly does not depend on.