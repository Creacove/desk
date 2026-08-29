# Manager Runtime — Artist World Model + Question Engine

## Product contract

Desk should feel like a manager who already knows the artist, notices the one missing fact that matters, asks only when that fact changes the decision, remembers the answer for the right amount of time, and immediately continues the work.

The loop is:

`observe -> decide -> read fresh operating facts -> infer/research what can be known -> ask one decision-changing question only if still blocked -> persist answer -> resume the exact pending Manager review -> act/replan`

A Mission is still bad if the artist has to manage the Mission.

## Product-quality lenses

This slice must pass all of these lenses, not merely compile.

### Utility

A stored operating fact must change real execution: planning, sequencing, cost, format, ownership, timing or risk. Useful examples include current car access, two friends available for a shoot, a scoped campaign budget, creator comfort, current location, or learned execution behavior.

Do not collect profile trivia because it may be useful one day.

### Low user effort

Desk should use existing context before asking. The order is:

1. fresh World Model facts;
2. current Mission/task state;
3. relevant memory/results/evidence;
4. safe inference/research;
5. one question only when the answer materially changes the current decision.

Never make the artist inventory their whole life for Desk.

### Reliable runtime/harness

A question is not a chat detour. It is a suspended Manager action with a durable continuation point. The runtime must know which review is blocked, what fact is missing, why it matters, where the answer belongs, when it expires, and how to resume automatically.

### Reasoning quality

Desk should ask because it already has a management hypothesis.

Bad:

> What resources do you have for content creation?

Good:

> I have a stronger version of the first Odaeshi video if you can use a parked car for about 30 minutes. Can you get access to one this week?

The second question reveals the idea, the minimum requirement, and why the answer matters.

### 11-star feeling

The target feeling remains:

> “I don’t really know how to manage my career, but Desk does.”

The magic is not more profile fields. It is Desk turning the artist's actual world into executable work.

## World Model

`artist_operating_facts` stores operational context that needs stronger scope/freshness semantics than free-form memory.

Conceptually:

`People × Places × Equipment × Money × Time × Skills × Access × Preferences × Team × Language × Mobility × Execution behavior`

Supported domains in this slice:

- `people`
- `places`
- `equipment`
- `money`
- `time`
- `skills`
- `access`
- `preference`
- `team`
- `language`
- `mobility`
- `execution`

Every canonical operating fact carries domain, key, scope, source, confidence, validity window and supersession state.

## Scope

### Artist

Durable or semi-durable operating preferences/capabilities.

Examples: loose talking points preferred, CapCut skill, language comfort.

Scope key: `artist`

### Mission

Facts that are true for one campaign but should not automatically affect future Missions.

Examples: scoped Odaeshi budget, campaign-specific people/resources, visual guardrails.

Scope key: `mission:<mission-id>`

### Task

Short-lived facts that unblock one immediate action/review.

Examples: car access for this test, revised shoot window.

Scope key: `task:<task-id>`

Do not store short-lived task facts as permanent artist truth.

## Freshness

Temporary facts expire. Car access, location, current collaborator availability and weekly budget should normally have short validity windows. Preferences and skills can last longer, but still yield to newer contradictory evidence.

When an expired fact is still decision-critical, Desk may refresh it with one contextual question.

## Question Quality Gate

Desk may ask only if all are true:

1. Desk cannot safely infer/research the answer.
2. The artist has not already told Desk.
3. No stored answer is fresh enough.
4. The answer materially changes the current plan.
5. Desk knows exactly why it needs the answer.
6. Desk has a realistic fallback if the answer rules out the preferred route.
7. The question is minimal; one question by default.
8. The input is truly conversational. Uploads/rights/details edits remain workspace actions.

## Question object

A proactive question contains:

- stable `key`;
- user-facing `question`;
- `reason`;
- `answerKind` and bounded `options`;
- optional recommendation;
- Manager `hypothesis`;
- `fallbackIfNo`;
- target `factDomain` and `factKey`;
- `factScopeType` / `factScopeKey`;
- `validForHours`.

A question without a hypothesis and fallback is not ready to show.

## Adaptive compiler decisions

The adaptive compiler now has three valid outcomes:

### `no_change`

Current route still works. No replacement graph.

### `needs_context`

Exactly one decision-changing human fact is missing.

Rules:

- one question exactly;
- no replacement tasks;
- no replacement checkpoints;
- no permission requests beside it;
- current plan remains active;
- pending review is suspended, not discarded.

### `replan`

Enough context exists. Compile one complete replacement route under the existing atomic/stale-plan guards.

## Continuation runtime

1. `plan_replan_required` creates/queues an adaptive review.
2. Runner loads current plan, strategy state, task results, changed reality, fresh memory and fresh World Model facts.
3. Compiler returns `no_change | needs_context | replan`.
4. `needs_context` persists `manager_question_requests` and inserts a Manager message using the existing guided-question metadata shape.
5. Existing Manager UI collects `contextRequestId + contextAnswers`.
6. Answer resolution supersedes the prior scoped fact, writes the new fact with provenance/expiry, marks the question answered and reactivates the exact review.
7. Runtime rereads current state and continues automatically.

The artist must never need to type “continue.”

## Conversation ownership boundary

A `world-model:` answer belongs to an already-running adaptive Manager decision. The normal conversational Manager may acknowledge that answer, but it must not independently create a second Mission graph or competing replan from the same turn. Adaptive runtime remains the owner of the suspended review.

## Odaeshi golden scenario

Desk wants to test a parked-car version of “What couldn’t finish us?” with Otmos and two friends before broad spend.

It knows why the car matters, but not whether the artist can get one this week.

Correct question:

> I have a stronger version of the first Odaeshi video if you can use a parked car for about 30 minutes. Can you get access to one this week?

If yes, store short-lived scoped access and immediately compile the executable human work.

If no, first use known resources/places to select a fallback. Do not immediately ask a generic location inventory question.

Only if spend materially changes the next route should Desk ask what is actually available for Odaeshi now; profile monthly budget is not automatically spendable Mission money.

## Reject the implementation if

- Desk asks generic resource questionnaires;
- it asks for facts it already knows and that are still fresh;
- retries create duplicate pending questions;
- temporary access becomes permanent artist truth;
- one task-scoped answer leaks into unrelated Missions;
- `needs_context` also creates replacement work;
- conversational Manager creates a competing route from the answer turn;
- the artist must tell Desk to continue;
- expired facts are silently used for important decisions;
- a `no` answer dead-ends the Mission when a realistic fallback exists.

## Required regression coverage

Before merge, cover:

- fresh migration;
- scoped fact supersession;
- fact freshness/expiry;
- question dedupe;
- wrong Mission/task scope rejection;
- answer reactivates only linked review;
- `needs_context` contract validation;
- fresh facts packed before asking;
- expired facts may trigger refresh;
- pending question history prevents repeat asks;
- task moved -> question -> answer -> replan without another artist prompt;
- stale-plan protection remains valid while a question is pending;
- `world-model:` answer cannot independently persist a competing Mission graph;
- existing guided question UI renders/resolves the proactive question correctly.

## Acceptance bar

A reviewer should be able to say:

- Desk had a concrete idea before it asked me anything.
- It asked one thing, not a questionnaire.
- I understood why it needed the answer.
- My answer changed the plan.
- Desk remembered it after the chat turn.
- Desk did not remember temporary context forever.
- I did not tell Desk to continue.
- The resulting work was executable.
- The product felt more like a manager and less like a chatbot.