# Desk Manager Runtime — implementation contract

This document is the review contract for `feat/manager-runtime-foundation`. It records the product behavior the code must preserve and separates the foundation implemented in this branch from the next slices. Do not reinterpret Desk as a chatbot, task generator, or generic marketing planner while reviewing or extending this work.

## Product contract

Desk is the operating manager for an artist's career.

The default loop is:

`observe -> decide -> ask only if blocked -> act -> assign exact human work -> follow up -> review result -> adapt`

The artist should not need to know what to prompt. Manager owns the next move unless the artist changes the objective or reality.

### Three clocks

1. **Human time** — recording, calling, approving, travelling, posting, performing, supplying private facts. These become Tasks and can have availability windows, deadlines and reminders.
2. **Manager time** — research, analysis, comparison, drafting, review and replanning. This executes as soon as prerequisites exist. It must not receive a fake calendar day.
3. **Reality time** — waiting for audience response, a collaborator, a release, or another external signal. Use Reviews/watches, not a Manager Task.

## Non-negotiable rules

- Manager owns the next move.
- If Desk can infer it, search it, or already knows it, do not ask the artist.
- A context question must exist because a concrete current decision changes depending on the answer.
- Monthly budget is background context. If the spend available for the immediate scoped work materially changes the plan, Manager asks for that scoped budget instead of assuming the whole monthly amount is available.
- Manager-owned work is never sent to the artist as a Task or reminder.
- A human Task must be executable without the artist asking “okay, but how?”
- Checkpoints are rare consequential decision gates. They are not headings created because every Task needs a container.
- Task completion, blocking, relevant new evidence and due reviews are continuation triggers, not stopping points.
- Desk never claims data it cannot actually observe.

## Foundation implemented in this branch

### Manager/accountability schema

`20260829070000_manager_runtime_foundation.sql`

Adds:

- semantic `evidence_items.metadata`
- operational memory metadata/freshness fields
- `mission_plan_versions.strategy_state`
- task `available_from`, `estimated_minutes`, assignee and reminder policy
- `notification_preferences`
- channel-agnostic `reminder_queue`

Reminder intensity is `light`, `standard`, or `stay_on_me`. Delivery channels are modeled independently (`in_app`, `email`, `push`, `whatsapp`) so WhatsApp can be added without redesigning management logic.

### Reminder worker

`manager-dispatcher`

- guarded by the existing workflow worker secret pattern
- sends only real configured in-app reminders today
- never reports email/push/WhatsApp as sent when no provider exists
- respects quiet hours before delivery
- writes actionable `operating_events` so existing Supabase Realtime + Activity Center receives reminders
- reminder payload exposes `start`, `done`, `move`, `blocked` as the intended task interaction contract

`20260829070100_schedule_manager_dispatcher.sql` creates one guarded five-minute cron. It invokes the worker only when due reminder rows exist. There is no per-artist cron.

### Task reminder lifecycle

`20260829070300_task_reminder_lifecycle.sql`

- activating a Mission plan creates reminder intents for human work
- Manager/Desk/AI work is excluded
- terminal work cancels outstanding reminders
- blocked work creates a blocker follow-up
- schedule/deadline/assignee changes rebuild reminder intents
- `stay_on_me` adds a check-in for sufficiently long work

### Automatic continuation after Task review

`20260829070200_persist_manager_review_continuation.sql`

The existing `manager-review-task-result` model already returns `followUpTasks` and `permissionRequests`. Previously they were stored only inside an activity payload. This trigger makes the safe continuation durable:

- human follow-up work becomes real Tasks/steps
- Manager-owned follow-up work is intentionally not converted into a human Task
- external/spend/publish/etc. gates become real `permission_requests`
- a new human follow-up Task gets an immediate `task_ready` reminder
- retries dedupe instead of duplicating work

This is the first concrete version of “the artist finishes something and Desk keeps going without another prompt.”

### Operational memory

The conversation memory qualifier now recognizes:

- operational facts/resources
- preferences
- constraints
- blockers
- execution outcomes
- rejected moves

Examples that should survive chat history:

- artist has access to a friend's car
- Daniel is unavailable for Saturday's shoot
- only ₦20k is available for this Mission this week
- artist prefers loose talking points rather than verbatim scripts
- personal resilience content outperformed the performance-led test
- broad ads were rejected until participation is proven

`valid_until` and `last_confirmed_at` allow temporary facts to expire later rather than becoming permanent truth.

### Web intelligence correctness

`refresh-public-context` no longer strips the semantic metadata produced by `publicWebContext.ts` before evidence insertion. Public findings can retain:

- claim
- management use
- public narrative
- artist identity clues
- collaboration clues
- market clues
- risk clues
- Mission implications

This fixes a previous information-loss bug. The next context-packing slice should explicitly compact the most relevant semantic fields into every Manager turn rather than relying only on subsequent Manager Intelligence synthesis.

### Checkpoint UX

`MissionWorkSurface.tsx` no longer renders a no-human-work checkpoint as `Step N · ... / 0 of 0 done`.

It renders:

- `Desk is watching` for signal watches
- `Desk review` for Manager-only decision state

and shows the Manager read/next action. Human checkpoints still show Step + completion progress.

## Reminder behavior

A reminder is not merely a notification. It is an accountability interaction.

Bad:

> Task due tomorrow.

Target:

> You've still got the first Odaeshi story today. It should take about 25 minutes. If it slips, tomorrow's response test moves.
>
> Start · Done · Move it · I'm blocked

The next UI slice must wire those actions to task state:

- **Start** -> in progress
- **Done** -> current task-result flow -> Manager review -> continuation
- **Move it** -> capture new availability -> Manager decides whether downstream plan must change
- **I'm blocked** -> capture blocker -> run Manager -> modify task / ask one decision-changing question / replan

The Activity Center already has actionable event semantics; do not create a second notification center.

## Odaesha/Odaeshi golden scenario

Use **Odaeshi** in product/test data.

Starting truth:

- song is already released
- intended artist-confirmed meaning: resilience / bulletproof toughness / tested but still standing / collective strength
- artist wants it to become a shared cultural expression rather than simply another record
- monthly budget may exist in profile but immediate campaign spend is not assumed

### Expected flow

1. Manager decides that audience participation should be tested before broad spend.
2. Manager has a concrete car-based content concept but does not know car access.
3. Manager asks one contextual question with the reason embedded: “I have a stronger version of the first Odaeshi video if you can use a parked car for about 30 minutes. Can you get access to one this week?”
4. Yes becomes operational memory. No causes an immediate alternative using actual available places/resources; it does not end the plan.
5. If immediate campaign budget materially changes execution, Manager asks what is actually available for this scoped test rather than treating the monthly budget as spendable.
6. Manager creates a precise human Task. A content Task must include enough practical detail to execute: concept/format, people/resources, setup/location, hook/talking points, song cue if relevant, edit treatment, CTA/desired response, approximate time/cost and completion signal.
7. Task gets reminders according to artist preference.
8. If the artist reports Daniel unavailable, Manager does not merely mark overdue. It adapts the task or plan.
9. When the Task result is submitted, Manager reviews immediately. Generated human follow-up work persists automatically.
10. A real-world performance wait is represented as a Review/watch.
11. After enough tests, a real checkpoint asks which expression deserves repetition. Manager decides based on available evidence and issues a new plan version.

### Golden failures

The scenario fails if any of these occur:

- artist must ask “what next?” after completing a Task
- `Day 4: Desk analyzes` or equivalent Manager calendar work appears
- a no-task checkpoint displays `0 of 0`
- a Task says only “create engaging content” or restates strategy
- Desk asks a generic resource questionnaire before having a decision it is trying to make
- Desk assumes car/location/budget access
- profile monthly budget is treated as the current Mission budget without confirmation when that matters
- a blocker only changes task color/status and does not trigger management
- Manager-generated follow-up work disappears into an activity payload
- Desk claims TikTok comment sentiment without comment evidence

## Next implementation slices

These are required for the full Manager Runtime but deliberately not faked in this foundation PR.

### 1. Task action UX + continuation entry point

Wire `Start / Done / Move / Blocked` from Today, Task Sheet and Activity Center. Consolidate the resulting event handling into a bounded `run-manager` orchestration entry point. Reuse current `manager-review-task-result`; do not duplicate its reasoning.

### 2. Mission execution-quality contract

Keep the good existing Mission Genesis boundaries (Manager analysis is not a visible Task), but tighten generation for execution-heavy Missions:

- several Tasks may live under one checkpoint
- checkpoints only when a consequential decision is possible
- near horizon (roughly next 5–7 days) must be concrete; longer horizon can remain directional
- content Tasks must be executable with the artist's real resources
- questions must be justified by a current decision
- no human Task can require an additional “how?” prompt
- no future day exists solely for Manager analysis

Persist the strategy state that already exists in conversation (creative pillars, intended meaning, target behavior, scoped budget, rejected directions) into `mission_plan_versions.strategy_state` so “turn this into a Mission” cannot erase good strategy.

### 3. Today/Home

Preserve the current intelligence-first Home when Desk does not yet have enough active work. When an active Mission has ready human work, Home becomes execution-first:

- Manager call / what changed
- Your work today
- Manager is handling
- Waiting on
- deeper Manager Read
- conversation as escape hatch, not prerequisite

### 4. Semantic evidence packing

`evidence_items.metadata` is now durable. Add bounded semantic public-web fields to Manager opening context so a nomination, press item or public career event can directly influence the next decision without long raw summaries.

### 5. Career Watch

Use existing `source_connections.next_sync_at` and `freshness_target`. Separate:

- Artist Discovery — infrequent identity/career research
- Career Watch — lightweight material-change checks
- Mission Research — decision-specific deeper research

Only meaningful new evidence should wake Manager. Never run expensive web research for every inactive artist on a fixed high-frequency loop.

### 6. TikTok official integration

Use the official creator-authorized TikTok path for the artist's own public posts/metrics. Reuse `source_providers`, `source_connections`, `source_sync_jobs`, `source_snapshots` and `evidence_items`.

Do not build product behavior that depends on arbitrary TikTok comment text. Do not require video upload to Supabase.

### 7. External reminder adapters

Email/push/WhatsApp consume `reminder_queue`; they do not own reminder policy. Google Calendar is a schedule mirror, not the Manager's source of truth.

## Review standard

The important question for every change is not “does the AI answer sound smart?” It is:

> Does this reduce the amount of management the artist has to do themselves?

Primary product metric should eventually be: **of the important actions Desk determined mattered this week, how many actually got done?**
