# Manager Runtime — Today execution surface

## Product contract

Home should answer one question before the artist has to type anything:

> **What does my manager need from me now?**

Today is not a prettier task list and it is not a second planning system. It is a projection of the current Manager Runtime state.

The desired sequence is:

`Manager already decided -> Home shows the current priority -> artist acts/answers/approves -> runtime continues -> Home changes automatically`

The artist should not open Desk and see a blank prompt as the primary interaction.

---

## Current implementation baseline

`DeskHQ.tsx` already makes the correct structural move:

1. `TodayExecution`
2. Manager composer — `Tell Desk what changed, or ask something`
3. Today's Brief
4. deeper intelligence

Current `TodayExecution`:

- loads active Missions;
- takes one `getNextArtistTask(...)` per Mission;
- shows up to three human tasks;
- shows passive `Watching signal` checkpoints when that Mission has no human task;
- opens the Mission when an item is selected.

This is the right direction. The next step is to make Today reflect the complete Manager Runtime ontology and global priority rather than simply taking the first open task from several Missions.

---

# Product-quality lenses

## Lens 1 — utility

Today must end in action, not awareness.

A visible primary item should be one of:

- **Do this** — a ready human Task;
- **Answer this** — a decision-changing Manager question;
- **Approve this** — a pending permission required for the route;
- **Resolve this** — a real human blocker that cannot be handled automatically.

Passive runtime states such as Manager analysis and signal watches are secondary.

The surface fails if the user still has to open several Missions and compare them to decide what matters.

## Lens 2 — user effort

Today should remove prioritization work from the artist.

Bad:

> Three unrelated tasks from three Missions. You decide what to do first.

Good:

> **Odaeshi is the priority today.**
> The first response test is blocked on one thing only: whether you can get the car.
> **Answer**

Or:

> **Odaeshi is the priority today.**
> Record the first Tough Skin Story.
> 20 min · ₦0 · Otmos + 2 friends
> **Start**

Desk may show supporting work, but there should be one clear primary focus unless the product genuinely has no basis to choose.

## Lens 3 — context/memory

The Today projection may use only current durable runtime state:

- active Mission plan version;
- Mission priority/health;
- ready human Tasks;
- task availability/deadline;
- pending Manager questions;
- pending permissions;
- task/result/blocker state;
- reviews/watches;
- fresh World Model facts;
- fixed external anchors already stored in the plan.

Opening Home must not ask a model to reconstruct the artist's priority from scratch.

## Lens 4 — reasoning quality

The Manager decides priority when planning/replanning/reviewing, not at render time.

Today may deterministically project that decision.

The visible reason should answer:

> Why this, now?

Examples:

- “This is the only thing blocking the first Odaeshi test.”
- “The shoot is available today and the next post depends on it.”
- “Desk needs this answer before it can safely change the plan.”
- “This approval is the last gate before outreach can go out.”

Avoid generic reasons such as “high priority” or “move the Mission forward.”

## Lens 5 — runtime/harness

Every Today action must map to an existing durable runtime object.

No client-only tasks.
No client-only question state.
No duplicated approval object.
No new Home-specific workflow engine.

The action should continue through the same source-of-truth path used elsewhere.

## Lens 6 — autonomy

Do not show the artist work Desk can safely do itself.

Never show Today cards such as:

- Analyze audience response
- Research content formats
- Compare campaign performance
- Draft caption
- Replan Odaeshi
- Review uploaded result

Those are Manager actions and should run automatically.

Today may quietly show that Desk is working/watching when useful, but not as work assigned to the artist.

## Lens 7 — three clocks

Today contains **human time** only as primary work.

Reality time appears as quiet watches.
Manager machine time should normally be invisible or represented as transient system status, never as a dated action.

## Lens 8 — execution quality

The primary Task preview should contain enough information to let the user decide “I can do this now” without opening a vague title.

Minimum preview when available:

- exact action;
- estimated minutes;
- owner;
- cost/cap;
- critical people/resource/location;
- real deadline/availability if one exists.

Full execution detail may open in the Task/Execution sheet.

## Lens 9 — product coherence

Today is a **projection**, not the source of truth.

Source-of-truth hierarchy:

- Mission = outcome;
- active Plan Version = route;
- Task = human work;
- Manager Question Request = missing human fact;
- Permission Request = approval gate;
- Review/Watch = external reality wait;
- Today = current human-facing projection of those objects.

If Today and a Mission disagree, the runtime objects win and Today must refresh.

## Lens 10 — trust

Today must not manufacture urgency.

Never imply:

- “due today” when there is no real deadline;
- “urgent” because a model prefers the task;
- resource availability that has expired;
- an external commitment that is not confirmed.

Use actual dates/availability and Manager-stored priority reasons.

## Lens 11 — 11-star feeling

The ideal reaction on opening Home is:

> “Desk already knows what I should be doing.”

Not:

> “Desk has organized my tasks nicely.”

---

# Today projection model

Today should project four categories.

## 1. `needs_you`

Human input that blocks the Manager from continuing.

Subtypes:

- `question`
- `permission`
- `blocking_decision`

These normally outrank ordinary ready Tasks when they block the active priority route.

### Example

**Desk needs one thing for Odaeshi**

I have a stronger version of the first video if you can use a parked car for 30 minutes. Can you get access to one this week?

**Answer**

This should open the existing guided Manager question surface, not a new Home form implementation.

## 2. `human_action`

A ready human/team Task.

### Example

**Odaeshi is the priority today**

**Record “What couldn’t finish us?”**

20 min · Otmos + 2 friends · ₦0

Park the car somewhere quiet. Start directly on the strongest resilience story; do not record an intro first.

**Start**

The full execution sheet provides the complete brief.

## 3. `human_follow_up`

A human action generated after Manager review.

Examples:

- trim/reshoot one section;
- send one missing approval;
- reply to five high-signal comments;
- provide one result the Manager cannot observe.

This is still a Task, but the UI can communicate that it came from reviewing prior work.

### Example

**One fix before posting**

Your friend's first answer is stronger than the setup. Cut the first six seconds; no reshoot needed.

10 min

**Continue**

## 4. `desk_watch`

No human action required.

Examples:

- waiting for audience response window;
- waiting for collaborator reply;
- waiting for a platform signal;
- Manager review already running.

### Example

**Desk is watching**

Odaeshi response test — no action needed from you right now.

A watch must never visually compete with the primary human action.

---

# Global priority contract

Current Home takes one next Task per active Mission and slices to three. That is a useful MVP but does not fully answer which Mission matters most.

The next projection should rank **ready human needs across all active Missions**.

Do not call OpenAI on Home render.

Priority is derived from persisted Manager/runtime state.

## Priority tiers

### Tier 0 — blocking human input for the current route

- unanswered decision-changing question;
- pending permission without which the next route cannot continue;
- human blocker explicitly awaiting a decision/action.

### Tier 1 — fixed-time / consequence-sensitive human work

A ready Task with a real stored deadline, external commitment or dependency impact that makes delay costly.

### Tier 2 — in-progress work

If the artist already started important work, preserve continuity unless another item truly outranks it.

### Tier 3 — ready work selected by the active Plan

Use Mission priority, Task priority, checkpoint order and Manager-stored recommendation/impact.

### Tier 4 — useful but nonblocking supporting work

May appear below the primary item if capacity exists.

## Tie-breaking

Use deterministic fields where possible:

1. blocks runtime continuation;
2. real deadline/availability window;
3. downstream dependency impact;
4. Mission priority;
5. in-progress state;
6. task priority;
7. current checkpoint order;
8. plan creation/order as final stable tie-break.

Do not introduce random ordering.

## Manager override

If Manager reasoning has explicitly selected a different current focus, persist that selection/reason as part of Mission/plan state and let Today project it.

Do not hide a model call inside a ranking helper.

---

# Primary-focus copy contract

The primary header should be a Manager judgment, not a generic page label.

Good:

- “Odaeshi is the priority today.”
- “Finish the first Odaeshi test before adding spend.”
- “Desk needs one answer before it can move this plan.”
- “The release package is ready except for your split approval.”

Bad:

- “Your tasks for today”
- “3 things to do”
- “High-priority items”
- “Mission actions”

The header should be generated/persisted when the plan/review changes or composed deterministically from that state—not generated fresh every Home load.

---

# Card/action states

## Ready

CTA: **Start**

`Start` keeps the deterministic task execution transition.

## In progress

CTA: **Continue**

Do not make the artist tap Start twice.

## Needs answer

CTA: **Answer**

Open exact conversation/context request.

## Needs approval

CTA: **Review** or **Approve** depending on risk and detail required.

Never one-click a sensitive commitment without showing the approval context.

## Needs revision

CTA: **Fix** / **Continue**

Show the Manager's concrete review in the preview.

## Blocked

CTA: **Resolve**

If Desk can resolve the blocker automatically, it should not appear as a human blocker.

## Watching

No CTA required beyond optional **View Mission**.

---

# Home composition

Recommended order:

1. Workspace header / Activity
2. **Today** — primary focus + up to two supporting human needs
3. quiet **Desk is watching** line if relevant
4. Manager composer escape hatch
5. Today's Brief
6. evidence/intelligence/Manager Read

The Brief remains intelligence. Today remains execution.

Do not merge both into one large feed.

---

# Composer role

Current copy is correct:

> `Tell Desk what changed, or ask something`

The composer is for:

- changed reality;
- disagreement;
- new opportunity;
- new constraint;
- questions;
- attaching new private context.

Examples:

- Photographer cancelled.
- I got another ₦50k.
- I don't like this idea.
- A friend can get us the venue Saturday.
- I was offered a show next week.
- Can we move the release?

It is not the prerequisite for receiving management.

---

# Today projection schema

Prefer a server/runtime projection or deterministic repository projection rather than hand-building UI logic around every table.

Conceptual shape:

```ts
type TodayManagerItem = {
  id: string;
  kind: "question" | "permission" | "task" | "watch";
  missionId: string;
  priorityTier: 0 | 1 | 2 | 3 | 4;
  priorityRank: number;
  headline: string;
  title: string;
  whyNow: string;
  cta: "answer" | "review" | "start" | "continue" | "fix" | "resolve" | "view";
  taskId?: string;
  contextRequestId?: string;
  permissionRequestId?: string;
  reviewId?: string;
  estimatedMinutes?: number;
  owner?: string;
  costLabel?: string;
  resourceSummary?: string;
  availableFrom?: string;
  deadline?: string;
  sourcePlanVersionId?: string;
};
```

This is a projection. Do not persist a duplicate canonical task/question object unless cache/performance later requires it.

---

# Refresh behavior

Today should update when runtime state changes, including:

- Task started;
- Task completed/blocked/moved;
- Manager review finishes;
- new follow-up Task appears;
- adaptive replan installs a new Plan Version;
- proactive question appears/gets answered;
- permission becomes pending/resolved;
- watch becomes actionable;
- Mission completes/pauses/cancels.

Reuse workspace live-sync/event refresh scopes rather than polling a model.

---

# Odaeshi golden sequence

## State 1 — question blocks route

**Today**

**Desk needs one thing for Odaeshi**

I have a stronger first video if you can use a parked car for 30 minutes. Can you get one this week?

**Answer**

Artist answers yes.

No “continue” message.

## State 2 — plan resumes

Today automatically becomes:

**Odaeshi is the priority today.**

**Record “What couldn’t finish us?”**

20 min · Otmos + 2 friends · ₦0

Park somewhere quiet. Start on the strongest answer, then bring Odaeshi in.

**Start**

## State 3 — result submitted

Desk reviews immediately.

If opening is weak but footage is usable:

**One fix before posting**

Cut the first six seconds. Start on your friend's answer. No reshoot needed.

10 min

**Continue**

## State 4 — posted

If response needs time:

**Desk is watching**

Odaeshi response test — no action needed from you right now.

The Brief can separately explain what Desk is looking for.

## State 5 — signal matures

Manager automatically evaluates and either:

- releases next human Task;
- changes route;
- asks one decision-changing question;
- requests permission;
- closes/advances checkpoint.

Home changes from the runtime result.

---

# Regression failures

Reject the Today implementation if any becomes true:

- Home returns to a blank-prompt-first experience;
- Home calls OpenAI merely to rank/render current work;
- user sees Manager-owned analysis as a human Task;
- three Missions are shown with no clear current priority;
- expired World Model facts appear as current resource availability;
- fake deadlines/urgency are introduced for visual effect;
- a question is duplicated as both Home form and Manager conversation request;
- a permission object is copied into a second Home-only state;
- Today continues showing work from a superseded Plan Version;
- watches visually compete with human action;
- Today's Brief turns into the task list;
- artist still has to ask “what should I do first?”

---

# Acceptance bar

A reviewer should be able to open Home in each golden-state fixture and immediately answer:

1. What is the artist's current priority?
2. What, if anything, does Desk need from the artist right now?
3. Why does that matter now?
4. What button should the artist press?
5. What is Desk handling without the artist?

If any answer requires inspecting several Missions or asking Manager, Today is not finished.