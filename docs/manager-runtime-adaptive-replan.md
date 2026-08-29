# Manager Runtime — Adaptive Replan

## Product contract

A Mission is bad if the artist still has to manage the Mission.

When human reality changes, the artist should not have to inspect dependencies, decide which downstream task moved, or ask Desk what to do next.

The operating loop for this slice is:

> **Reality changes → Desk evaluates impact → current route is recompiled if needed → one new plan becomes current → next human work appears**

This PR is intentionally stacked on the Manager Runtime foundation and execution-loop PRs. It does not introduce another task system, another scheduler, or another chat surface.

## Why this exists

PR #27 can already detect that a human task move materially threatens a Mission and emit `plan_replan_required`.

Without this runtime, that event is still only an intelligent warning. The artist would still be responsible for translating the warning into a revised sequence of work.

This PR closes that gap.

## Core architecture

### 1. `plan_replan_required` creates a durable review

The operating event is converted into an `adaptive_replan` review tied to the Mission and originating task.

The review carries the changed reality already established by the execution loop. The runtime does not ask the artist to repeat it.

### 2. One hardened background-work gateway

Database events and cron never call the model-facing runtime directly with only a worker secret.

The route is:

> **Postgres / pg_cron → `workflow-recovery` + worker secret → internal Edge Function + service-role JWT**

`workflow-recovery` is the single intentionally worker-secret-protected gateway. `manager-runtime-runner` and `manager-dispatcher` remain JWT-protected internal functions.

### 3. Review claim and bounded retry

Adaptive replan reviews receive:

- a claim timestamp;
- an attempt count;
- a last runtime error;
- bounded retry with backoff;
- stale-running recovery.

Only one adaptive review may be `running` for a Mission at a time.

After repeated failure, Desk preserves the current plan and records that it could not safely compile a replacement. It never installs a speculative partial route.

### 4. Bounded current-state packet

The runner loads the current operating state rather than replaying an entire conversation:

- artist profile;
- Mission objective and current recommendation;
- active plan + structured `strategy_state`;
- current checkpoints;
- current human tasks and steps;
- trigger task and its changed availability;
- recent task results;
- fresh scoped memory only;
- recent Mission operating events;
- pending permissions;
- latest Manager intelligence packet.

### 5. Adaptive Plan Compiler

The compiler has one job: decide whether the current route still works.

It can return:

- `no_change`
- `replan`

It is not allowed to brainstorm a new career direction simply because one shoot moved.

Durable strategy is preserved where still valid:

- objective;
- strategic thesis;
- desired audience behavior;
- creative pillars;
- confirmed cultural meaning;
- constraints;
- scoped budget;
- resources;
- horizon;
- success indicators;
- rejected directions;
- guardrails.

### 6. Three-clock rule

The runtime preserves the product's clock model:

| Work | Calendar treatment |
| --- | --- |
| Human/team physical work | May have availability/deadline |
| Desk/Manager research, analysis, drafting, review, comparison, replanning | Runs now; never emitted as a human task |
| External reality that needs time | Watch/signal, not a fake AI workday |

The Adaptive Plan task schema structurally excludes `manager_work`.

### 7. No invented dates

The compiler receives two exact allow-lists:

- existing known task deadlines;
- existing known human availability times.

A replacement task may reuse one of those exact dates or leave its date empty. It cannot manufacture a deadline to make a calendar look tidy.

Changed availability remains availability. It is never silently converted into a new commitment.

### 8. Complete replacement route, not patch mutation

If `replan` is chosen, the model returns a coherent replacement graph for remaining work.

It does **not** say:

- move task A;
- delete task B;
- edit checkpoint C;

and let application code mutate the Mission incrementally.

Instead Postgres atomically:

1. creates plan version `N+1`;
2. persists the replacement `strategy_state`;
3. creates the replacement decision checkpoints;
4. creates the remaining human/collaborative tasks and exact steps;
5. creates any permission gates;
6. supersedes nonterminal work from the old plan;
7. marks the new plan active;
8. emits one `manager_replanned_mission` operating event.

If any part fails, the transaction rolls back and the old plan remains current.

### 9. Stale-plan concurrency guard

A model call can take time. During that time another Manager action could legitimately replace the Mission plan.

The runner records the active plan it actually read.

At the final `active_plan_version_id` swap, a database trigger checks that the Mission is still on that exact plan. If not, the transaction raises and rolls back.

On retry the runner rereads current reality. If the triggering task belongs to an older plan, the review becomes a deterministic `no_change` without another model call.

This prevents a slow autonomous action from overwriting a newer decision.

### 10. Telemetry is downstream of product state

Once the atomic plan finalizer succeeds, the Mission has successfully changed.

Usage-accounting failure after that point is handled best-effort and does not requeue the replan or return a false product failure.

## Odaeshi acceptance scenario

Starting state:

- Mission: establish Odaeshi as a cultural resilience anthem;
- strategy state includes the artist-confirmed resilience / bulletproof / still-standing meaning;
- current execution route includes a human shoot using two friends and access to a car;
- the artist has a concrete shoot task, not a generic content instruction.

Reality changes:

> Daniel cannot make the planned shoot. Both friends and the car are realistically available Sunday instead.

Expected experience:

1. Artist taps **Move it** and supplies Sunday plus the changed context.
2. PR #27 immediately saves the new human availability and reviews downstream impact.
3. If the route is materially threatened, `plan_replan_required` is emitted.
4. The adaptive runtime claims the review automatically.
5. Desk reads the existing Odaeshi strategy, current route, completed work, Sunday availability, fresh resource context and fixed dates.
6. Desk does all Manager reasoning immediately. There is no future-day “Desk replans” task.
7. If the current route still works, Desk records `no_change` and does not manufacture a new plan version.
8. If the route needs to change, Desk compiles the remaining route and Postgres installs one complete new plan version atomically.
9. Old unfinished work is superseded, not left beside the new route.
10. The new ready human work becomes the source of truth for Home/Missions/reminders automatically.
11. The artist never needs to type “what next?”

## Non-goals in this PR

This PR does not yet attempt to solve:

- a full Resource Graph / Artist World Model;
- the just-in-time Question Engine;
- WhatsApp delivery;
- Google Calendar mirroring;
- autonomous external sends/spend;
- a generic workflow-builder product;
- speculative long-range 30-day task calendars.

Those should build on this runtime rather than bypass it.

## Review invariants

A reviewer should reject the change if any of these become false:

1. Manager machine work can appear as dated human work.
2. The model can invent a deadline or availability time.
3. A replan mutates an active graph incrementally instead of atomically replacing it.
4. Compiler failure can leave half a replacement plan installed.
5. A stale compiler can overwrite a newer active plan.
6. Multiple adaptive compiler runs can own one Mission simultaneously.
7. Cron/database worker-secret calls bypass `workflow-recovery` for these Manager runtime paths.
8. A user must ask Desk to continue after `plan_replan_required`.
9. A telemetry failure can cause a successfully installed plan to be retried.
10. A changed task causes Desk to discard confirmed strategy without evidence that the strategy itself changed.
