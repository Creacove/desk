# Manager Runtime — next implementation roadmap

## Purpose

The Manager Runtime now has strong backend foundations:

- human execution actions;
- reminder lifecycle;
- automatic Task-result continuation;
- adaptive replan;
- scoped/fresh Artist World Model;
- one-question `needs_context` continuation;
- runtime retries/concurrency/fail-closed behavior.

The next work should make that intelligence **felt in the product** and then extend execution safely.

This document converts the product contracts into a repo-specific implementation sequence for `Creacove/desk`.

Do not ship channel integrations or more agents before the artist-facing execution loop reaches the quality bar.

---

# Shipping order

Recommended stacked slices:

1. **Today Runtime Projection**
2. **Content Execution Task Contract**
3. **Task-scoped Media Results + Automatic Content Review**
4. **External Action Permission Execution**
5. **Execution Behavior Learning**
6. **Google Calendar Human-Time Mirror**
7. **WhatsApp Accountability Delivery**
8. **Career Watch + Semantic Evidence Packing**

Each slice should remain independently reviewable and green before the next implementation layer depends on it.

---

# Slice A — Today Runtime Projection

## Goal

Turn the existing `TodayExecution` section from “one next Task per active Mission” into one global Manager priority projection across:

- ready human Tasks;
- pending decision-changing questions;
- pending permissions;
- important blockers;
- quiet watches.

No OpenAI call on Home render.

## Current code to reuse

### `src/features/desk/DeskHQ.tsx`

Already has:

- Today before composer;
- `TodayExecution`;
- quiet `Desk is watching` state;
- correct composer copy: `Tell Desk what changed, or ask something`;
- Brief below execution.

Keep this structure.

### `src/features/missions/missionModel.ts`

Already has:

- `getNextArtistTask`;
- task work-mode filtering;
- checkpoint dependency logic;
- humanized checkpoint/task helpers.

Reuse its eligibility logic where appropriate, but move cross-Mission prioritization into a dedicated Today projection module.

### workspace live sync / Activity refresh

Today should refresh from the same runtime mutations/events rather than new polling.

## New projection type

Add a typed view model in `src/types/cleanProduction.ts` or a dedicated Today type module:

```ts
export type TodayManagerItem = {
  id: string;
  kind: "question" | "permission" | "task" | "watch";
  missionId: string;
  missionTitle: string;
  priorityTier: 0 | 1 | 2 | 3 | 4;
  priorityRank: number;
  headline: string;
  title: string;
  whyNow: string;
  cta: "answer" | "review" | "start" | "continue" | "fix" | "resolve" | "view";
  taskId?: string;
  contextRequestId?: string;
  conversationId?: string;
  permissionRequestId?: string;
  checkpointId?: string;
  estimatedMinutes?: number;
  owner?: string;
  costLabel?: string;
  resourceSummary?: string;
  availableFrom?: string;
  deadline?: string;
  sourcePlanVersionId?: string;
};

export type TodayExecutionViewModel = {
  headline: string;
  primary?: TodayManagerItem;
  supporting: TodayManagerItem[];
  watches: TodayManagerItem[];
};
```

## Repository/data changes

Prefer a deterministic repository projection instead of another persisted truth table.

Add to Desk repository contract something equivalent to:

```ts
loadTodayExecution(): Promise<TodayExecutionViewModel>
```

Likely implementation location:

- `src/services/productionSupabase.ts`
- shared pure projection helper under `src/features/desk/todayProjection.ts` or `src/services/todayProjection.ts`

Load bounded current rows:

- active Missions + `active_plan_version_id`;
- active-plan human Tasks;
- current Checkpoints;
- pending `manager_question_requests`;
- pending `permission_requests`;
- relevant due/running Reviews/watches;
- Task execution state (`available_from`, deadline, status, priority, estimated minutes);
- Mission priority/recommendation.

Do not load all history.

## Priority algorithm

Pure deterministic function.

Suggested tiers:

0. human input blocking runtime continuation — question / permission / unresolved human blocker;
1. fixed-time or consequence-sensitive ready human Task;
2. in-progress important Task;
3. other ready Task selected by active Plan;
4. nonblocking support work.

Tie breakers:

1. blocks current route;
2. real deadline/availability;
3. downstream dependency impact;
4. Mission priority;
5. in-progress;
6. Task priority;
7. checkpoint order;
8. stable creation/ID order.

No random or model-generated ordering at render time.

## UI changes

`DeskHQ.tsx`

Replace `TodayExecution({ missions })` with projection input.

Primary card behavior:

- question -> open exact Manager conversation/context request;
- permission -> open permission review;
- Task -> open Task Sheet directly if navigation architecture permits, otherwise Mission focused on Task;
- watch -> view Mission only.

CTA labels must match state:

- Answer
- Review
- Start
- Continue
- Fix
- Resolve

Avoid generic `Open` for the primary action.

## Required new navigation hooks

Home currently receives `onOpenMission` only for Today.

Likely extend props with:

- `onOpenTask(missionId, taskId)`
- `onOpenConversation(conversationId)`
- `onOpenPermission(permissionRequestId)`

Reuse existing application navigation/Task sheet state rather than adding Home-specific modal state when possible.

## Tests

Add a focused contract suite such as:

`src/manager-today-execution.test.ts`

Fixtures:

1. question blocks Mission + ready unrelated Task -> question wins if Mission is current priority/blocking route;
2. permission blocks next action -> Review projected;
3. one in-progress Task vs lower priority ready Tasks -> continuity preserved;
4. fixed deadline Task outranks nonblocking work;
5. superseded-plan Task never appears;
6. Manager-owned Task never appears;
7. expired World Model fact cannot produce resource summary;
8. watches remain secondary;
9. no runtime question/permission -> current ready Task shown;
10. no human need -> `Desk is watching` / calm state;
11. projection is deterministic;
12. no OpenAI function invocation from Today load/render path.

## Acceptance

Open Home and answer in under a few seconds:

- What matters most?
- What does Desk need from me?
- Why now?
- What do I press?

---

# Slice B — Content Execution Task Contract

## Goal

Make content Tasks structurally execution-ready instead of hiding creative production inside generic `steps[]`.

## Migration

Add to `public.tasks`:

```sql
task_kind text not null default 'general_action';
execution_brief jsonb not null default '{}'::jsonb;
```

Add constraints for supported task kinds.

Recommended first task kinds:

- `general_action`
- `content_capture`
- `content_edit`
- `content_publish`
- `content_response`
- `approval`
- `outreach`
- `event`
- `admin`
- `result_report`

Do not create a separate content campaign table.

## Compiler changes

### `supabase/functions/_shared/openaiAdaptivePlanCompiler.ts`

Extend `AdaptivePlanTask`:

- `taskKind`
- optional validated `executionBrief`

For `content_*` kinds, require the correct structured content brief.

The compiler must choose either:

1. complete content Task; or
2. `needs_context` for one missing decision-changing fact.

No vague content Task fallback.

### Mission Genesis / Manager conversation creation path

Content quality must also apply when Missions are created outside adaptive replan.

Update shared task contract in the Manager conversation/Mission graph schema, then update:

- `supabase/functions/_shared/openaiManagerConversationLegacy.ts` / exported contract as appropriate;
- `supabase/functions/_shared/missionGraphPersistence.ts`;
- Mission Genesis graph generation if it emits the same task object.

Goal: one content Task contract across all plan-generation paths.

## Persistence

### Adaptive finalizer

`supabase/migrations/20260829080000_adaptive_manager_replan.sql` currently writes Task fields inside `finalize_manager_replan_v1`.

Because that migration is already part of the stack, add a **new forward migration** that replaces the function with a version that writes:

- `task_kind`
- `execution_brief`

Do not edit an already-reviewed historical migration once it is merged.

### `missionGraphPersistence.ts`

Write the same fields for conversational/Mission creation.

## View model

Extend `MissionTaskViewModel` in `src/types/cleanProduction.ts`:

```ts
taskKind?: TaskKind;
executionBrief?: ContentExecutionBrief;
```

Add strict normalization from Supabase JSON.

Do not cast arbitrary JSON straight into the UI type.

## Repository query changes

`src/services/productionSupabase.ts`

Every Task selection used by Mission list/detail should include:

- `task_kind`
- `execution_brief`
- `estimated_minutes`
- `available_from`

Current Mission view mapping loses some execution fields; make the enriched shape consistent.

## Task Sheet UI

`src/features/missions/MissionTaskSheet.tsx`

Keep generic Task UI for ordinary work.

For content Task with valid execution brief, render structured sections:

1. What you're making
2. Why this now
3. Setup — time/cost/people/location/gear
4. Hook
5. What to say/do
6. Shot plan
7. Song use
8. Edit
9. Post / CTA
10. What to send back to Desk

Keep Start / Done / Move / Blocked unchanged.

Do not render internal fact IDs.

## Today preview

Projection should use brief fields for compact summary:

- estimated time;
- cost;
- people/resource;
- first creative instruction.

Do not render full brief on Home.

## Validation tests

Add pure parser tests for content brief.

Reject:

- content Task without hypothesis;
- no hook;
- invented required resource without source/fact grounding marker if contract includes grounding;
- empty shot plan for capture video;
- generic `use the song` without cue;
- generic edit direction;
- no desired audience response;
- no proof mode;
- no fallback for fragile resource when required;
- `manager_work` content Task emitted as human work.

Add Odaeshi snapshot/contract fixture.

---

# Slice C — Task-scoped Media Results + Automatic Content Review

## Goal

Allow the artist to submit raw video/image proof for a content Task and let Desk review it immediately without abusing canonical song `music_assets`.

## Storage model

Do not store campaign footage as song masters/assets.

Recommended new table:

```sql
task_result_assets (
  id uuid primary key,
  account_id uuid,
  artist_workspace_id uuid,
  artist_id uuid,
  mission_id uuid,
  task_id uuid,
  result_id uuid,
  storage_bucket text,
  storage_ref text,
  media_type text,
  file_name text,
  file_type text,
  file_size bigint,
  status text,
  metadata jsonb,
  created_at timestamptz
)
```

Private storage bucket / signed upload.

Supported first result types:

- raw video;
- draft cut;
- image/photo;
- published URL;
- note.

## Upload function

Create a dedicated Edge function similar to the secure task-document upload flow:

`task-result-media`

Actions:

- prepare signed upload;
- finalize metadata;
- link to Task/result;
- emit `task_result_media_uploaded` event.

Apply size/type policy.

## Review trigger

When required proof is available:

- complete/submit Task result;
- invoke existing Manager task-result review path with media references;
- add content-aware bounded context;
- immediately classify result:
  - approved;
  - edit only;
  - partial reshoot;
  - full reshoot;
  - blocked.

Do not create another generic content-review agent unless the existing Manager review cannot support the media reasoning boundary cleanly.

## Automatic continuation

After review:

- Manager actions execute immediately;
- exact human revision Task persists if needed;
- approval can release publish Task;
- published URL starts response watch;
- watch maturation wakes Manager.

## UI

Task Sheet shows media upload/proof state.

Manager review should surface the **smallest useful change** prominently.

Example:

> Cut the first 6 seconds and start on Tobi's answer. No reshoot needed.

## Tests

- unauthorized Task media upload rejected;
- wrong workspace/task rejected;
- media record is task-scoped;
- retry idempotent;
- Task cannot be marked accepted before required proof exists;
- review automatically starts once proof is submitted;
- edit-only review creates no reshoot Task;
- Manager review failure preserves uploaded proof/result and queues recovery;
- superseded Task media cannot reopen old Plan work.

---

# Slice D — External Action Permission Execution

## Goal

Turn current `permission_requests` from durable approval records into exact effect-bound authorization that automatically executes after approval.

## Schema evolution

Keep `permission_requests` as authorization object.

Add effect/version fields if needed:

- `effect_hash`
- `requested_by_run_id` already available through run/action refs;
- optional `approved_by_user_id`
- `decided_at`
- `decision_note`

Add external execution record or formally extend `manager_run_actions`.

Recommended dedicated table if provider execution becomes complex:

`external_action_runs`

Fields:

- permission request;
- action type;
- effect hash;
- idempotency key;
- provider;
- external ref;
- status;
- result/error;
- timestamps.

## API/functions

Bounded commands:

- load permission effect;
- approve;
- edit/supersede;
- reject;
- execute approved action.

Approval must be transactional and stale-safe.

## Today/UI

Pending blocking permission appears as `needs_you`.

Permission review displays exact effect, target, content, cost, risk and reversibility.

## Execution adapters

Do not implement every action type at once.

Start with a narrow safe effect already supported by product infrastructure, then extend.

Candidates:

- existing release-plan change path as reference;
- send an already-prepared share-link email/outreach through a controlled adapter;
- later publishing/spend.

## Tests

- approve only pending/current effect;
- effect hash mismatch rejects stale approval;
- double approval -> one execution;
- reject -> Manager continuation/fallback;
- approved != succeeded;
- provider failure retains approval if effect unchanged and safe retry allowed;
- changed effect requires new permission;
- unauthorized user cannot approve high-impact effect.

---

# Slice E — Execution Behavior Learning

## Goal

Use repeated Task execution outcomes to improve future planning fit.

## First implementation should be conservative

Do not create a new ML subsystem.

Start with a deterministic/Manager synthesis job over durable Task events.

Input:

- Task kind;
- estimated minutes;
- start/completion times;
- move count;
- blocked count;
- collaborator/resource context;
- result/revision count;
- reminder responses.

Output candidates:

- preferred task-duration band;
- collaboration completion advantage;
- useful action time window;
- travel friction;
- creative script mode;
- resource fragility.

## Persistence

Use `artist_operating_facts` with `domain = execution` for established patterns.

Metadata should contain:

- observation count;
- supporting Task IDs;
- contradiction count;
- first/last observed;
- applicable Task kinds.

## Confidence gate

1–2 observations: hypothesis only.
3+ consistent observations: emerging soft preference.
Repeated cross-Mission pattern or artist confirmation: canonical fact.

Never persist moral/personality labels.

## Triggering

Low-cost aggregation after terminal Task/result events, with rate limiting/dedupe.

Do not create a user Task or fixed daily AI run for this.

---

# Slice F — Google Calendar Human-Time Mirror

## Goal

Mirror real scheduled human work without making Calendar canonical.

## Connection model

Add provider connection/credential abstraction if one does not already exist for user-level integrations.

Store:

- user;
- provider;
- external account/calendar ref;
- connection status;
- secure credential reference.

Do not store OAuth secrets in normal readable rows.

## Mapping table

Add `calendar_task_links`:

- user;
- Task;
- calendar ID;
- provider event ID;
- provider etag/revision;
- Desk revision;
- sync state.

## First UX

- Connect Google Calendar in Settings;
- choose calendar;
- **Add to Calendar** for flexible Task;
- automatically mirror fixed sessions if preference enabled.

Do not auto-create an event for every Task.

## Reconciliation

Desk -> Calendar:

- create/update/delete/cancel mirror.

Calendar -> Desk:

- event time change -> treat as proposed human availability/schedule change; reuse Move impact path;
- event delete -> remove mirror only, not Task completion/cancellation;
- arbitrary title/description edit -> not Manager instruction.

## Tests

- one event per mapped Task;
- retry no duplicate;
- superseded Task removes/invalidates mirror;
- Calendar move cannot rewrite fixed deadline;
- provider failure does not change Task truth;
- disconnected Calendar leaves runtime unaffected.

---

# Slice G — WhatsApp Accountability Delivery

## Goal

Deliver the same Manager accountability loop in the channel many artists already use, without creating a second chatbot.

## Provider adapter

Consume `reminder_queue` with `channel = whatsapp`.

Before send, revalidate current Task/Plan state.

Persist provider message mapping + delivery receipts.

## Initial outbound types

- Task ready;
- start/check-in;
- due/overdue;
- blocked/plan at risk;
- exact Manager question;
- revision/follow-up;
- permission attention.

## Initial inbound commands

Bounded only:

- Start
- Done
- Move
- Blocked
- answer current Manager question

Resolve using message context/stable mapping.

Do not guess ambiguous Task references.

## Later inbound

Approval actions only after permission object resolution and authority checks are proven.

Broad conversational Manager can come later.

## Tests

- stale reminder cancelled before send;
- quiet hours respected;
- provider retry no duplicate;
- delivery/read != Task complete;
- inbound reply maps to exact Task/question;
- ambiguous context fails safely;
- Move reuses canonical Manager impact/replan path;
- provider outage leaves in-app runtime intact.

---

# Slice H — Career Watch + Semantic Evidence Packing

## Goal

Wake Manager on meaningful career changes without expensive constant research.

## Existing primitives

Reuse:

- `source_connections.next_sync_at`
- `freshness_target`
- `source_sync_jobs`
- `source_snapshots`
- `evidence_items`
- semantic `evidence_items.metadata`

## Separate three research modes

### Artist Discovery

Infrequent broad identity/career understanding.

### Career Watch

Lightweight change detection.

Examples:

- material audience movement;
- meaningful public press/career event;
- chart/market move;
- release status change;
- important partnership/collaboration signal.

### Mission Research

Decision-specific deeper research only when a current Mission needs it.

## Wake rule

Only meaningful new evidence should create a Manager review/event.

Do not run full web research on every inactive artist on a high-frequency fixed loop.

## Semantic packing

Manager packets should receive the most decision-relevant semantic fields directly rather than only metric labels.

Bound packet size and preserve source/provenance.

---

# Cross-slice invariants

Every PR must keep these green.

## Runtime

- no Manager machine work on human calendar;
- one source of truth;
- no user “continue” prompt required;
- stale Plan work cannot mutate current route;
- retries/idempotency protect external effects;
- user factual updates persist before model reasoning;
- model failure preserves user state.

## Questions

- one question by default;
- current hypothesis;
- decision-changing;
- fresh context checked first;
- fallback exists.

## Human Tasks

- only human/team/external work;
- executable without “how?”;
- real resources;
- realistic time/cost;
- proof/result defined;
- blocker path.

## Today

- one clear priority;
- no AI call to render;
- projection only;
- no superseded work.

## Content

- no generic strategy-restatement Tasks;
- structured execution brief;
- immediate Manager review;
- smallest useful revision.

## Permissions

- prepare before asking;
- exact effect binding;
- explicit user authority;
- approval != success;
- no learned external permission.

## Channels

- provider delivery is not Task truth;
- Calendar = human time only;
- WhatsApp = delivery/interaction surface;
- core runtime works when providers fail.

---

# PR review lens

For every implementation slice, reviewers should answer:

1. **Utility:** What real management work is now done for the artist?
2. **User effort:** What did the artist stop having to prompt/remember/coordinate?
3. **Context:** Which durable facts/state make the behavior specific?
4. **Reasoning:** What decision is Desk making and what would change it?
5. **Harness:** What automatically wakes the next step?
6. **Autonomy:** Is Desk doing everything safe before asking a human?
7. **Time:** Are human, Manager and reality clocks separated?
8. **Execution:** Can the user act without another “how?” prompt?
9. **Coherence:** Is there still one source of truth?
10. **Trust:** Can every material claim/action be traced and bounded?
11. **11-star:** Does this feel more like having a manager?

If a PR cannot answer those, it is not done even if the model response looks impressive.

---

# End-state experience

When these slices are complete, a normal artist should be able to:

1. open Desk;
2. see one clear current priority;
3. execute an exact Task built around their real resources;
4. get reminders where they prefer;
5. report a blocker/change naturally;
6. watch Desk adapt automatically;
7. submit work and receive immediate concrete review;
8. approve only the external effects that genuinely require them;
9. let Desk monitor response/reality;
10. receive the next move without asking.

The product should increasingly make the artist feel:

> **“I can focus on being the artist. Desk is running everything around it.”**