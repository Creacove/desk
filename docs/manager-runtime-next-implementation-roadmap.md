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

The next work should make that intelligence felt in the product while preserving the constraints already chosen for Desk.

## Hard constraint carried through every slice

**Do not make OrderSounds/Supabase a campaign-video or campaign-image storage product.**

The artist should not have to upload rough cuts, TikTok videos, Reels, photos or other campaign media into Desk for the core Manager Runtime to work.

Content execution should rely on:

- exact pre-production briefs;
- normal creation/editing in the artist's existing tools;
- public post URL or connected-platform post identity;
- platform metrics when connected;
- artist-reported lightweight results when necessary.

If future integrations legitimately expose media without Desk becoming the storage layer, visual review can be added as an optional capability later.

---

# Shipping order

Recommended stacked slices:

1. **Today Runtime Projection**
2. **Content Execution Task Contract**
3. **Connected Post Evidence + Response Watch**
4. **External Action Permission Execution**
5. **Execution Behavior Learning**
6. **Google Calendar Human-Time Mirror**
7. **WhatsApp Accountability Delivery**
8. **Career Watch + Semantic Evidence Packing**

---

# Slice A — Today Runtime Projection

## Goal

Turn current `TodayExecution` from “one next Task per Mission” into one global Manager priority projection across:

- ready human Tasks;
- pending Manager questions;
- pending permissions;
- blockers;
- quiet watches.

No OpenAI call on Home render.

## Reuse

- `src/features/desk/DeskHQ.tsx`
- `src/features/missions/missionModel.ts`
- workspace Realtime/live-sync
- active Mission/Plan/Task/Question/Permission/Review state

## Projection

Add a typed `TodayExecutionViewModel` with:

- headline;
- one primary item;
- supporting items;
- watches.

Possible item kinds:

- question
- permission
- task
- watch

CTA states:

- Answer
- Review
- Start
- Continue
- Fix
- Resolve

## Priority

Deterministic order:

1. human input blocking runtime continuation;
2. real fixed-time/consequence-sensitive Task;
3. in-progress Task;
4. next ready active-plan Task;
5. supporting work.

Use persisted Manager/runtime state. Do not hide a model call inside Home ranking.

## Tests

Cover:

- blocking question beats unrelated Task;
- permission projects correctly;
- in-progress continuity;
- real deadline priority;
- superseded-plan Task excluded;
- Manager-owned work excluded;
- watches secondary;
- deterministic projection;
- no OpenAI call in render/load path.

---

# Slice B — Content Execution Task Contract

## Goal

Make content Tasks structurally executable rather than generic `steps[]` strategy restatements.

## Migration

Add to `public.tasks`:

```sql
task_kind text not null default 'general_action';
execution_brief jsonb not null default '{}'::jsonb;
```

Supported first kinds:

- general_action
- content_capture
- content_edit
- content_publish
- content_response
- approval
- outreach
- event
- admin
- result_report

## Compiler changes

Extend Adaptive Plan / Mission graph task contracts with:

- `taskKind`
- validated `executionBrief`

For content Tasks require:

- objective/hypothesis;
- concept;
- setup/resources;
- hook;
- performance/talking points;
- shot plan;
- song cue;
- edit direction;
- CTA/desired response;
- success signal;
- lightweight completion proof;
- fallback.

The compiler must either emit a complete content brief or return `needs_context` for one decision-changing missing fact.

No vague fallback such as “create engaging content.”

## Persistence

Update:

- adaptive finalizer through a new forward migration;
- `missionGraphPersistence.ts`;
- relevant Manager/Mission task schemas.

## UI

`MissionTaskSheet.tsx` renders content sections when `task_kind` is content-related.

No campaign-media upload control.

Completion evidence should be:

- connected platform post;
- public post URL;
- result note/attestation when no observable public post exists.

## Tests

Reject:

- missing hypothesis/hook/shot plan/song cue;
- invented resources;
- generic edit instruction;
- no desired audience behavior;
- no proof mode;
- campaign media upload as required proof;
- Manager-owned work emitted as a human content Task.

Use Odaeshi as golden fixture.

---

# Slice C — Connected Post Evidence + Response Watch

## Goal

Let Desk know that content was posted and evaluate the response **without storing the artist's campaign media**.

## Evidence sources

Preferred order:

1. connected TikTok creator-authorized API identifies the artist's public post and metrics;
2. artist pastes the public TikTok/Reels/Shorts URL;
3. artist supplies a lightweight result note/metrics when the platform is not connected.

## Data model

Do not create a media-asset table.

Create a lightweight normalized post-evidence object/table only if existing `evidence_items` is not sufficient.

Preferred first approach: reuse `evidence_items` + metadata, linked to Task/Mission.

Useful fields:

- task/mission;
- platform;
- external post ID;
- public URL;
- posted time;
- source type (`connected_api | public_url | artist_report`);
- views;
- likes;
- comments count;
- shares;
- captured time;
- observation window.

No raw campaign-video bytes.

## TikTok integration

Use existing source architecture:

- `source_providers`
- `source_connections`
- `source_sync_jobs`
- `source_snapshots`
- `evidence_items`

Add TikTok as official API provider when OAuth/app approval is ready.

First useful capability:

- artist's own public videos;
- post identity/URL;
- creation time;
- description;
- views;
- likes;
- comments count;
- shares.

Do not claim comment sentiment because normal creator API access does not provide arbitrary comment text.

## Post association

A content publish Task should be associable with the resulting post through:

- expected platform;
- posting time window;
- artist account;
- public URL/external ID;
- optional user confirmation when matching is ambiguous.

Never guess silently between multiple candidate posts.

## Response watch

When post evidence exists:

1. start a `review`/watch for configured observation window;
2. dispatcher wakes it when due;
3. refresh available platform metrics;
4. Manager compares response with hypothesis + artist baseline;
5. Manager emits next Task/replan/no-change.

No user “continue” message.

## Manager output boundaries

Valid:

> Share rate is 2.1× the recent baseline; repeat the personal-story direction.

Invalid without visual/comment evidence:

> The opening shot is weak.

> People are discussing resilience in the comments.

## Tests

- connected post evidence links to correct Task;
- ambiguous match requires confirmation;
- URL result stores metadata, not media;
- watch starts automatically;
- watch maturation wakes Manager;
- stale/superseded Task cannot reopen old plan;
- TikTok metric review does not claim unavailable comment text;
- no Supabase campaign-media storage dependency.

---

# Slice D — External Action Permission Execution

## Goal

Turn `permission_requests` into exact effect-bound authorization that automatically executes after approval.

Keep approval separate from actual execution success.

Possible schema evolution:

- `effect_hash`
- approver/decision timestamp
- external execution run/receipt

Rules:

- prepare before asking;
- bind approval to exact target/content/amount/timing;
- changed effect requires new permission;
- double-click/retry cannot duplicate external effect;
- reject wakes Manager fallback;
- repeated approvals never silently create permission.

Start with one narrow controlled external action before spend/publishing expansion.

---

# Slice E — Execution Behavior Learning

## Goal

Use repeated Task outcomes to improve future task fit.

Inputs can come from existing lightweight runtime state:

- task kind;
- estimated minutes;
- started/completed times;
- move/block counts;
- collaborator/resource context;
- reminder response;
- public post completion/result signal.

No video upload required.

Persist established patterns as `artist_operating_facts` with `domain = execution` and evidence metadata.

No one-event overfitting and no moral/personality labels.

---

# Slice F — Google Calendar Human-Time Mirror

## Goal

Mirror real scheduled human work without making Calendar canonical.

Add:

- provider/user connection;
- secure credential reference;
- Task ↔ Calendar event link.

Rules:

- only human time goes to Calendar;
- no event for Desk research/review/replan;
- Calendar move becomes proposed human availability change and reuses Move impact path;
- deleting event does not complete/cancel Task;
- retry cannot create duplicate event;
- provider failure does not alter Task truth.

---

# Slice G — WhatsApp Accountability Delivery

## Goal

Deliver the same Manager accountability loop through WhatsApp without creating a second chatbot.

Outbound first:

- Task ready/start/check-in/due;
- blocker/plan-risk;
- exact Manager question;
- revision/follow-up;
- permission attention.

Bounded inbound:

- Start
- Done
- Move
- Blocked
- answer current Manager question

Every inbound action resolves to one canonical Desk object.

No broad free-form autonomous WhatsApp Manager until bounded object resolution is proven.

---

# Slice H — Career Watch + Semantic Evidence Packing

## Goal

Wake Manager on meaningful career changes without expensive constant research.

Reuse:

- `source_connections.next_sync_at`
- `freshness_target`
- source sync jobs/snapshots
- `evidence_items.metadata`

Research modes:

- Artist Discovery — infrequent broad context;
- Career Watch — lightweight material changes;
- Mission Research — deeper decision-specific search.

Only meaningful evidence creates a Manager trigger.

---

# Cross-slice invariants

## Runtime

- no Manager work on human calendar;
- no user “continue” prompt;
- stale plan cannot mutate current route;
- retries/idempotency protect state/effects;
- user factual updates persist before reasoning.

## Questions

- one question by default;
- hypothesis exists;
- decision-changing;
- fresh context checked first;
- fallback exists.

## Human Tasks

- human/team/external work only;
- executable without “how?”;
- real resources;
- realistic time/cost;
- lightweight proof;
- blocker path.

## Today

- one clear priority;
- no AI render call;
- projection only;
- no superseded work.

## Content

- structured execution brief;
- no media-upload dependency;
- platform/link evidence after posting;
- honest about what Desk can observe;
- response watch + automatic continuation.

## Permissions

- prepare before asking;
- exact effect binding;
- approval != success;
- no learned external permission.

## Channels

- provider delivery is not Task truth;
- Calendar = human time only;
- WhatsApp = delivery/interaction surface;
- core runtime survives provider failure.

---

# End-state experience

A normal artist should be able to:

1. open Desk;
2. see one clear priority;
3. execute an exact content/operational Task around real resources;
4. post through the tools/platforms they already use;
5. let Desk identify/watch the public result through connected platforms or a link;
6. get reminders where preferred;
7. report blockers naturally;
8. watch Desk adapt automatically;
9. approve only external effects that genuinely require them;
10. receive the next move without asking.

The target is:

> **I can focus on being the artist. Desk is running everything around it.**