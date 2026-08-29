# Desk Manager Runtime — product quality lenses

This is the shared product-review system for Manager Runtime work.

It exists to prevent a common failure mode: shipping technically impressive AI behavior that still makes the artist do the management work.

Every meaningful Manager capability should be reviewed through these lenses in order.

## Lens 1 — Utility

**Question:** Does this help the artist get an important real-world job done?

A capability is not useful merely because the model can produce an intelligent answer.

Strong utility ends in movement:

- a decision made;
- a deliverable prepared;
- a human action made executable;
- a blocker resolved;
- an opportunity qualified;
- a plan updated;
- a result reviewed;
- a next move released.

Weak utility ends in another explanation the artist must translate into work.

### Review test

Ask:

> What can the artist or team do now that they could not do before this feature?

If the answer is only “understand something better,” the feature may still be incomplete for Manager Runtime.

---

## Lens 2 — User effort

**Question:** How much thinking, prompting, remembering and coordination are we asking the artist to do?

Desk is the Manager. The artist should not have to:

- know the right prompt;
- choose the correct internal workflow;
- repeatedly provide known context;
- inspect dependencies to find the next task;
- remember to ask Desk to continue;
- translate strategy into execution;
- decide when Desk should research/review/replan;
- manually reconcile two competing plans.

Prefer:

`short intent / real-world update -> Desk resolves the operating work`

over:

`prompt engineering -> long answer -> more prompting -> manual coordination`

### Review test

Ask:

> What work did we remove from the artist?

If the feature adds a new surface but does not remove user effort, it may not be a product improvement.

---

## Lens 3 — Context and memory

**Question:** Does Desk know enough of the artist's world to make a specific decision without becoming intrusive?

Use context in this order:

1. canonical workspace state;
2. current Mission/strategy/task state;
3. fresh operating facts;
4. results and durable memory;
5. connected/public evidence;
6. safe inference;
7. one decision-changing question if truly blocked.

Context should be scoped and fresh.

Do not turn every useful fact into permanent identity.

### Review test

Ask:

> Would a competent human manager who already works with this artist ask this question again?

If no, Desk should not ask it either.

---

## Lens 4 — Reasoning quality

**Question:** Is Desk making a professional management judgment, or just producing plausible text?

Good Manager reasoning:

- starts from an objective;
- has a hypothesis;
- uses evidence/context;
- distinguishes known fact from inference;
- understands constraints;
- chooses rather than dumps options;
- has fallback routes;
- understands downstream consequences;
- knows when evidence is insufficient;
- preserves durable strategy when only execution reality changed.

### Review test

Ask:

> What decision is Desk making, and what would make it change that decision?

If neither is clear, the output is probably commentary rather than management.

---

## Lens 5 — Harness/runtime reliability

**Question:** Can the management loop continue safely after the model finishes one turn?

The model is one component inside a runtime.

The runtime must handle:

- bounded context loading;
- durable state;
- tool calls;
- human tasks;
- automatic Manager actions;
- questions;
- permissions;
- watches/reviews;
- reminders;
- results;
- retries;
- dedupe/idempotency;
- concurrency;
- stale-work protection;
- replanning;
- termination conditions.

The product must not depend on the user remembering to re-invoke the model.

### Review test

Ask:

> After this step completes, what wakes Desk up next?

There should be a concrete trigger, not “the user can ask again.”

---

## Lens 6 — Autonomy boundary

**Question:** Is Desk doing everything safe that it can do itself while asking permission only where a real boundary exists?

Desk should normally do automatically:

- research;
- analysis;
- comparison;
- drafting;
- task-result review;
- internal planning;
- signal evaluation;
- plan recompilation;
- preparation of external work.

Human/permission boundaries remain for actions such as:

- recording/performing/offline physical work;
- artistic intent changes;
- spending;
- publishing;
- external outreach/submission where approval is required;
- release-plan changes;
- sensitive/legal/finance/rights commitments;
- irreversible external actions.

### Review test

Ask:

> Is the artist doing this because only a human should/can do it, or because the product has not automated it yet?

Do not disguise missing automation as “collaboration.”

---

## Lens 7 — Three clocks

**Question:** Is the product treating time correctly?

### Human time

Real calendar time:

- filming;
- meetings;
- calls;
- travel;
- approvals;
- recording;
- posting;
- physical/offline work.

These may become Tasks/reminders.

### Manager/machine time

No fake calendar delay:

- research;
- analysis;
- drafting;
- review;
- comparison;
- synthesis;
- replanning.

Run as soon as prerequisites exist.

### Reality time

External time:

- wait for audience response;
- collaborator reply;
- platform data;
- event/release time;
- external outcome.

Represent as a watch/review, not a fake Desk task.

### Review test

Ask:

> Is any calendar day present only because the AI supposedly needs time to think?

If yes, reject it.

---

## Lens 8 — Execution quality

**Question:** Can the artist execute the next human action without another “okay, but how?” prompt?

A strong human task includes whatever matters for that work:

- exact action;
- owner;
- why now;
- start/deadline if genuinely known;
- estimated time;
- cost/budget cap;
- people/resources/location;
- practical steps;
- content hook/script/talking points when relevant;
- format/shot plan/song moment/edit treatment when relevant;
- CTA/desired response;
- expected output;
- proof/result type;
- dependency;
- risk if missed;
- blocker/fallback behavior.

### Review tests

1. **How test:** Could the artist do this now without asking Desk how?
2. **Swap test:** Could the artist/song name be swapped and the task still work?

If the first answer is no or the second answer is yes, the task is not ready.

---

## Lens 9 — Product coherence

**Question:** Is there one source of truth, or are we creating another competing system?

Examples:

- Desk is the source of truth; WhatsApp is a delivery/conversation surface.
- Desk is the source of truth; Calendar mirrors human time.
- Mission owns the outcome; Today surfaces current human work.
- Manager Runtime owns continuation; chat is an interaction surface.
- structured strategy state owns durable campaign intent; conversation transcript is not the only source.

### Review test

Ask:

> If two surfaces disagree, which one wins?

If the answer is unclear, the architecture is not ready.

---

## Lens 10 — Trust and evidence

**Question:** Does Desk distinguish what it knows from what it assumes?

Desk must not:

- invent access/resources;
- invent budgets;
- invent dates;
- claim private platform behavior without evidence;
- claim external action succeeded without confirmation;
- convert weak inference into durable truth;
- hide source limitations when they materially change the decision.

Evidence can stay visually quiet, but the reasoning must remain source-aware internally.

### Review test

Ask:

> If this claim is wrong, can we tell where it came from and why Desk believed it?

---

## Lens 11 — 11-star manager feeling

**Question:** Does this move the mental model from “AI tool” toward “I have a manager now”?

The target progression is:

- Desk answers;
- Desk understands;
- Desk plans;
- Desk executes what it can;
- Desk gives exact human work;
- Desk follows up;
- Desk notices reality changes;
- Desk adapts automatically;
- Desk learns how this artist actually works.

The target user reaction is not:

> “That was a smart AI response.”

It is:

> “Desk already knew what to do next.”

---

# Shared acceptance rule

Before shipping a Manager feature, finish this sentence:

> The artist does **less management work** because Desk now __________ automatically/reliably.

Then prove:

1. the outcome is useful;
2. user effort went down;
3. context is specific and fresh;
4. reasoning has a decision/hypothesis;
5. runtime continuation is durable;
6. autonomy boundaries are respected;
7. time is modeled correctly;
8. human work is executable;
9. product surfaces have one source of truth;
10. claims are evidence-safe;
11. the experience feels more like having a manager.

If we cannot prove those, the feature is not finished even if the model output looks impressive.