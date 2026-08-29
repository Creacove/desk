# Manager Runtime — Execution Loop

This is the second stacked implementation slice after `manager-runtime-foundation`.

The product contract is simple:

> Desk tells the artist what matters, the artist acts, and Desk immediately knows what to do next.

The artist should not have to become the project manager for the Mission.

## What this slice implements

### Home becomes execution-first

Home now consumes active Missions before opening with a blank conversation prompt.

Order:

1. **Today** — up to three next human actions across active Missions.
2. Passive **Desk is watching** state when an active Mission has no human action but a signal checkpoint is live.
3. Conversation escape hatch — `Tell Desk what changed, or ask something`.
4. Today's Brief and deeper Manager intelligence.

This deliberately changes the mental model from:

> What should I ask Desk?

into:

> My manager already knows the plan. What does it need from me today?

### Human task operating actions

A human task now has four plain actions:

- **Start**
- **Done**
- **Move it**
- **I'm blocked**

`Done` and `I'm blocked` continue through the existing `manager-review-task-result` workflow. That path already has the richer evidence/result review, checkpoint update, Mission update, memory writing, permission logic, and PR #26 follow-up persistence.

`Start` and `Move it` use the new bounded `manager-task-execution` command.

### Start is deterministic

Starting work should not cost an AI call.

`Start`:

- checks authorization and entitlement;
- rejects terminal or Manager-owned machine work;
- respects approval gates;
- sets the existing task to `in_progress`;
- clears a prior `available_from` hold;
- writes `task_state_events` and `operating_events`;
- lets the existing reminder lifecycle react to the task state change.

No second task model or execution database was created.

### Move means availability, not a new deadline

The artist is answering one operational question:

> When can you realistically get back to this?

The UI offers fast choices plus an exact date/time and an optional short note explaining changed reality.

Examples:

- Daniel cannot make it tonight; Sunday works.
- I only have access to the car on Saturday.
- The photographer cancelled.
- I can finish this after class tomorrow.

The system writes `tasks.available_from`. It does **not** silently rewrite `tasks.deadline`.

The PR #26 reminder trigger then rebuilds reminder intent from the new availability.

### Move triggers Manager reasoning immediately

After availability is saved, Desk loads a bounded Mission context and reviews the impact.

The review returns:

- `planImpact`: `no_change | local_change | downstream_risk`
- `summary`
- `managerInterpretation`
- `missionRecommendation`
- `nextHumanMove`
- `requiresReplan`

Rules enforced in the Manager prompt:

- Manager/Desk machine work does not consume calendar days.
- `availableFrom` is human availability, not a deadline.
- Never invent or silently move a release date, external commitment, spend, or artistic decision.
- Only flag `requiresReplan` when the current route actually needs to change.
- Do not generate generic project-management advice.

When the move is harmless, Desk says so and keeps the plan.

When a downstream dependency is materially threatened, Desk emits an actionable `plan_replan_required` operating event and the Mission recommendation changes immediately.

### Failure semantics

Human state is saved before AI reasoning.

If the Manager impact review fails:

1. the artist's new availability remains saved;
2. the Manager synthesis run is marked failed;
3. a `reviews` row is persisted as `due`;
4. Activity states that the timing was saved and Manager review is queued.

The application must never lose changed reality because an AI call failed.

The bounded central Manager runner in the next slice will consume this due review.

### Operational memory

An optional note supplied while moving work becomes task-scoped, artist-supplied operational memory with a short validity window.

This is appropriate for facts such as temporary collaborator availability, access to a location or resource, and short-lived scheduling constraints.

It is intentionally not written as permanent artist identity.

## Odaeshi acceptance flow

Assume the first concrete Odaeshi task is a low-cost resilience-story video using a parked car and two friends.

### Start

Otmos opens Home.

Home says the Odaeshi Mission is the priority and shows the exact next human task.

Otmos opens it and taps **Start**.

Task becomes `in_progress`. No Manager model call is needed.

### Move

Daniel cannot make the shoot.

Otmos taps **Move it**, chooses Sunday afternoon, and writes:

> Daniel can't make today. Both friends can do Sunday and I still have the car.

Desk immediately:

1. saves Sunday as human availability;
2. remembers the temporary resource/scheduling fact;
3. checks the Mission impact;
4. tells Otmos whether anything downstream is now at risk.

Otmos does not need to type “what should I do now?”

### Blocked

If the car becomes unavailable entirely, Otmos taps **I'm blocked** and states that fact.

This uses the existing task-result Manager review. Desk should decide whether to use a no-car fallback, ask one decision-changing resource question, or change the Mission route. PR #26 persists any resulting human follow-up work automatically.

### Done

When the video/result is submitted, the existing task-result review runs immediately. Manager interpretation, memory, checkpoint state, permissions and safe human continuation remain on the same path.

## OpenAI-style shipping principles used here

### One source of truth

Missions, Tasks, task states, reviews, operating events and reminders remain the existing product primitives. The UI does not create a parallel client-side workflow system.

### Deterministic where possible, model-driven where valuable

Starting a task is a state transition, not a reasoning problem.

Moving a task can alter dependencies and therefore earns Manager reasoning.

### State before inference

The user's factual change is durably written before calling the model.

### Bounded autonomy

Desk may interpret, recommend and mark that replanning is required. This slice does not silently rewrite fixed external dates or perform permissioned external actions.

### Auditable agent behavior

State transitions and Manager impact reviews produce durable run/event records.

### Graceful degradation

An OpenAI failure must not erase a user's update.

## Explicitly deferred to PR #28

PR #27 intentionally stops at a durable `requiresReplan` signal.

PR #28 should implement the central Manager runner and adaptive plan compiler:

1. consume trigger events / due reviews;
2. execute Manager-owned machine actions immediately;
3. classify `question | permission_request | watch | replan | no-op`;
4. consume `mission_plan_versions.strategy_state`;
5. create a new plan version when reality actually changes the route;
6. supersede old human work safely;
7. release the next ready human task;
8. never put Manager analysis on a future human calendar day.

That runner should reuse `manager-review-task-result`, plan versioning and existing Manager action records rather than inventing a generic workflow engine.

## Regression failures

This slice is wrong if any of these become true:

- Home again requires a blank prompt before the artist knows what to do.
- Start triggers an unnecessary OpenAI call.
- Move silently changes a deadline.
- Manager-owned machine work becomes a human reminder or calendar task.
- changed user availability is lost because Manager review failed.
- a moved task only becomes “overdue” without a Manager impact read.
- the artist has to ask Desk whether moving work changed the Mission.
- Task Sheet uses generic project-management language instead of Start / Done / Move it / I'm blocked.
