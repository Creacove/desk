# Manager Runtime — reminder channels, Google Calendar and WhatsApp

## Product contract

Desk owns the plan, accountability state and next move.

External channels help the artist **notice and act on** that state.

The hierarchy is:

> **Desk = source of truth. WhatsApp = active delivery/conversation surface. Google Calendar = human-time mirror.**

Neither integration may become a second task database, second reminder policy engine, or second Manager brain.

This document describes the product/architecture contract. Provider details were checked against the current official Google Calendar developer documentation and Meta's official WhatsApp Business Platform / Cloud API collection on August 29, 2026.

---

# Existing runtime foundation

The Manager Runtime already has the right neutral primitives.

`notification_preferences` contains per-user/workspace:

- timezone;
- reminder intensity: `light | standard | stay_on_me`;
- quiet hours;
- `in_app_enabled`;
- `email_enabled`;
- `push_enabled`;
- `whatsapp_enabled`.

`reminder_queue` contains:

- Mission / Task;
- reminder kind;
- scheduled time;
- channel;
- delivery status;
- dedupe key;
- payload;
- attempt/error state.

Current queue channels are:

`in_app | email | push | whatsapp`

Google Calendar should **not** simply become another reminder queue channel. A calendar event is a durable schedule mirror with its own lifecycle and provider identifier. It should be modeled separately from a one-time reminder delivery.

---

# Product-quality lenses

## Lens 1 — utility

A channel should make important human work more likely to happen.

WhatsApp is useful for:

- task-ready nudges;
- start/check-in/due follow-up;
- contextual Manager questions;
- blocker replies;
- concise revision instructions;
- “plan changed” notices.

Calendar is useful for:

- real human time blocks;
- sessions/shoots/meetings/travel/recording;
- fixed deadlines/events;
- tasks the artist deliberately schedules.

Do not mirror every Desk object into every channel.

## Lens 2 — user effort

The artist should set preferences once and then act naturally.

Do not make them:

- copy Task details into Calendar;
- re-create Desk reminders manually;
- return to the app simply to say “done” after replying through a supported WhatsApp action;
- reconcile a moved Calendar event with an unchanged Desk Task themselves.

Where a channel can safely capture a user action, route it back to the same Manager Runtime command.

## Lens 3 — context/memory

Channel messages should be generated from canonical Task/question/permission/review state.

They should use:

- correct assignee;
- current active Plan Version;
- fresh availability/deadline;
- current reminder intensity;
- timezone/quiet hours;
- relevant dependency impact;
- concise Task execution context.

Do not use stale pre-replan copy after a Plan Version is superseded.

## Lens 4 — reasoning quality

Reminder policy is not “send more messages.”

A reminder should communicate why action matters.

Bad:

> Odaeshi task due soon.

Good:

> You still have the first Odaeshi story today. It should take about 25 minutes. If it slips, Desk loses the response window it planned for tomorrow.

The reason comes from current dependency/plan state, not invented urgency.

## Lens 5 — runtime/harness

Channels consume the same durable runtime objects and return actions to the same command/review paths.

No WhatsApp-specific Mission state.
No Calendar-specific Task state.
No provider callback should directly mutate arbitrary planning data.

Provider events are normalized, validated, deduped and then translated into runtime commands/events.

## Lens 6 — autonomy boundary

Desk may automatically send reminders the user has enabled within policy/quiet-hour rules.

External actions that are more than reminders remain permission-bound where applicable.

A WhatsApp message saying “Approve outreach?” must not make the outreach happen unless the user performs the explicit approval action and the runtime validates it.

## Lens 7 — three clocks

Only **human time** belongs in Calendar.

Calendar-eligible examples:

- record vocals;
- content shoot;
- call distributor;
- rehearsal;
- travel;
- meeting;
- scheduled post when the user must perform it;
- fixed submission deadline.

Never create Calendar events for:

- Desk analyzes;
- Desk writes caption;
- Desk reviews footage;
- Desk replans;
- Desk researches playlists.

Reality waits also do not become Calendar work unless there is a meaningful human check/action at the end.

## Lens 8 — execution quality

A channel message should be concise, but the user must be able to reach the exact execution detail in one action.

WhatsApp can carry:

- Task title;
- time estimate;
- why now;
- one key instruction;
- Start / Done / Move / Blocked action path.

Calendar description can carry:

- concise Task summary;
- Desk deep link;
- time/cost/resource summary;
- fixed deadline context.

Do not paste a 1,000-word content brief into a calendar description or reminder message.

## Lens 9 — product coherence

If Calendar or WhatsApp disagrees with Desk, Desk wins.

External representations must carry stable Desk IDs so they can be reconciled.

## Lens 10 — trust

Never mark a reminder sent unless the provider accepted it.
Never mark a Task completed merely because a message was delivered/read.
Never claim the user changed a Task because a provider event was ambiguous.
Never move a fixed external deadline because a Calendar event moved.

## Lens 11 — 11-star feeling

The ideal experience is not “Desk has integrations.”

It is:

> “My manager reaches me where I already work, and everything stays in sync.”

---

# Reminder policy remains channel-neutral

The runtime decides **that a reminder should exist** before deciding how it is delivered.

Conceptually:

`Task/runtime state -> reminder intent -> user preferences -> channel adapter -> delivery receipt`

The provider adapter must not independently decide Task urgency or reminder cadence.

### Example

Runtime creates:

```json
{
  "kind": "check_in",
  "taskId": "task-123",
  "scheduledFor": "...",
  "payload": {
    "title": "Record the first Tough Skin Story",
    "estimatedMinutes": 25,
    "dependencyImpact": "Tomorrow's response test depends on this capture."
  }
}
```

Delivery layer decides:

- in-app only;
- in-app + WhatsApp;
- skip because quiet hours;
- reschedule according to channel policy.

It does not change the underlying Task.

---

# Reminder intensity

## Light

Use only meaningful moments:

- Task ready;
- due soon when a real deadline exists;
- blocker/plan-risk follow-up.

No repeated “still working?” nudges by default.

## Standard

Use:

- Task ready/start window;
- one appropriate check-in for meaningful work;
- due-soon/due;
- blocker/plan-risk follow-up.

## Stay on me

Use stronger accountability while remaining bounded:

- start prompt;
- check-in for longer work;
- due reminder;
- overdue/blocked follow-up;
- plan-risk notice.

Do not spam the artist every few minutes or repeatedly resend an unchanged reminder.

Behavior learning may later optimize soft reminder timing, but real deadlines remain real deadlines.

---

# WhatsApp architecture

## Role

WhatsApp is an active execution/conversation surface for Manager Runtime.

It should not start as a general-purpose second chatbot.

First supported jobs should be narrow and high-value:

1. deliver Task/accountability reminders;
2. open the exact Task/Desk deep link;
3. accept bounded Task actions where safe;
4. ask/receive one decision-changing Manager question;
5. surface a concise Manager revision/follow-up;
6. notify when a materially changed plan requires human attention.

## Provider facts

Meta's official WhatsApp Cloud API supports sending text, media and message templates through the phone-number `/messages` endpoint. Message IDs can be tracked through Webhooks, including delivery/read/failure states.

Cloud API setup requires WhatsApp Business Platform assets such as a Meta business portfolio, WABA and business phone number; messaging uses appropriate WhatsApp Business permissions/tokens.

Template objects are managed separately and have approval/status lifecycle.

Provider delivery/read status is **delivery telemetry**, not evidence that the artist completed the Task.

## Outbound model

Add a WhatsApp adapter that consumes `reminder_queue` rows where:

- `channel = whatsapp`;
- preference is enabled;
- quiet-hour checks pass;
- user has a verified/mapped WhatsApp destination;
- reminder is still relevant to current Plan/Task state.

Before send, revalidate:

- Task still exists;
- Task not terminal/superseded;
- active Plan Version still owns it;
- reminder dedupe key not sent;
- scheduled timing still relevant.

## Provider delivery state

Store provider-facing delivery data separately from canonical Task state.

Conceptual:

```ts
type ChannelDelivery = {
  reminderQueueId: string;
  channel: "whatsapp";
  provider: "meta_whatsapp_cloud";
  providerMessageId: string;
  status: "accepted" | "sent" | "delivered" | "read" | "failed";
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  failedAt?: string;
  providerError?: string;
};
```

Do not overload `reminder_queue.status` with every provider-specific state if richer channel auditing is needed.

## Inbound model

Inbound Webhooks are normalized into a bounded command parser.

Initial supported actions should be explicit, not open-ended autonomous chat:

- Start
- Done
- Move
- Blocked
- answer current question
- approve/reject a clearly linked permission where safe

Each inbound action must resolve to exactly one current runtime object using stable IDs/context.

If ambiguous:

> Open Desk to choose the right item.

Do not guess which Mission/Task the user meant.

## Message context

Where WhatsApp supports reply context/message IDs, retain mapping from provider message to reminder/question/task so a simple reply can be associated with the correct object.

Still validate that object is current before mutation.

## Suggested reminder copy

### Task ready

> **Odaeshi is the priority today.**
> Record the first Tough Skin Story — about 25 min, ₦0.
> Start on the strongest story; don't record an intro first.
>
> Start · Move it · I'm blocked

### Check-in

> Still on the Odaeshi shoot? If it slipped, tell Desk now so it can protect the rest of the plan.
>
> Done · Move it · I'm blocked

### Revision

> **One fix before posting.**
> Cut the first 6 seconds and start on Tobi's answer. No reshoot needed.
>
> Continue

### Question

> I have a stronger version of the first Odaeshi video if you can use a parked car for 30 minutes. Can you get one this week?
>
> Yes · No

The question must be the same canonical `manager_question_request`, not a WhatsApp-only question.

---

# WhatsApp template strategy

Do not create dozens of templates mirroring every Task kind.

Start with a small reusable set whose variables carry canonical runtime copy.

Possible template families:

- `desk_task_ready`
- `desk_task_check_in`
- `desk_task_due`
- `desk_plan_attention`
- `desk_manager_question`

Keep content policy/Meta template requirements in the provider adapter layer.

The Manager Runtime produces semantic reminder content; the adapter fits it into an approved provider template when a template is required.

Do not let template wording dictate the underlying runtime ontology.

---

# WhatsApp quiet hours and frequency

Respect `notification_preferences.timezone`, `quiet_hours_start`, `quiet_hours_end` before provider send.

If a reminder becomes irrelevant while deferred through quiet hours, cancel/skip it rather than sending stale pressure later.

Example:

- Task completed in-app at 23:50.
- WhatsApp `due_now` reminder was waiting for quiet hours to end.
- Adapter must revalidate and cancel it in the morning.

---

# Google Calendar architecture

## Role

Calendar mirrors **scheduled human time** from Desk.

It is not the canonical Task scheduler.

A Task can exist without a Calendar event.
A Calendar connection can be disabled without affecting Mission logic.

## Provider facts

The Google Calendar API supports creating events through `events.insert`; events have explicit start/end values and can be updated/read/deleted. Google exposes event-focused OAuth scopes such as `calendar.events` and narrower owned-calendar variants. The API also supports event change watching.

Use the narrowest scope compatible with the final product behavior and complete Google's OAuth consent/verification requirements as applicable.

## Which Desk work becomes an event?

Create/mirror a Calendar event when at least one is true:

- Task has a user-selected time block;
- Task has a fixed session/meeting/rehearsal/shoot time;
- user explicitly chooses **Add to Calendar**;
- runtime has a real scheduled external event the user must attend/do.

Do **not** automatically create calendar events for every Task that merely has a deadline.

A deadline can appear as event metadata or optional all-day marker later, but auto-blocking the artist's calendar for every Task would create clutter.

## Event mapping

Persist mapping in Desk.

Conceptual table:

```sql
calendar_task_links (
  id,
  account_id,
  artist_workspace_id,
  user_id,
  task_id,
  provider,
  calendar_id,
  provider_event_id,
  desk_revision,
  last_provider_etag,
  sync_state,
  created_at,
  updated_at
)
```

Unique active mapping per `(user, task, provider)`.

## Event content

Summary:

> Odaeshi — record first Tough Skin Story

Description:

- 25 min;
- concise setup/resource note;
- why this matters;
- deep link to Desk Task.

Do not copy the full execution brief.

Store stable Desk identifiers using supported provider metadata/private extended properties if appropriate, or in the local link table. Do not depend only on matching event titles.

## Create/update/delete rules

### Create

Only from current human Task state.

### Task moves in Desk

If the user changes availability/time in Desk and a mirrored event exists:

- update the event if the Task represents that scheduled time;
- keep Desk as canonical;
- record provider result/error.

### Task completes/cancels/supersedes

Do not leave misleading active future events.

Depending on product policy:

- delete event; or
- mark/cancel it visibly.

Use one consistent behavior.

### Plan replan

When a Task is superseded by a new Plan Version:

- linked calendar event must not remain as active work;
- replacement Task only gets an event if it has a real schedule/user choice.

## User edits event in Google Calendar

This needs an explicit product rule.

Recommended behavior:

### If user changes start/end for a flexible Desk Task

Treat it as **proposed human availability/schedule change**, not as a silent deadline rewrite.

Flow:

1. provider event change arrives;
2. resolve mapped Desk Task;
3. validate current active Task;
4. store new user-selected scheduled window / availability;
5. run the same Manager impact path used by **Move it** when the change can affect downstream work;
6. if route changes, adaptive replan continues.

Do not directly modify a fixed deadline.

### If user changes summary/description

Do not interpret arbitrary calendar text as Manager instructions by default.

Desk remains canonical for title/brief. The next sync may restore Desk-controlled fields or preserve user notes in a separate safe field depending on UX choice.

### If user deletes the event

Do **not** mark the Task done/cancelled automatically.

Interpret deletion as “remove calendar mirror” unless the user explicitly chose a Desk action to cancel/move work.

## Calendar conflict/free-busy

Later, if Calendar read/free-busy access is enabled, availability can help Desk propose realistic human time windows.

Important boundary:

- busy/free data can inform scheduling;
- Desk should not infer private meeting contents unnecessarily;
- do not ingest full calendar titles/descriptions when free/busy is sufficient.

This follows the low-context principle: request/use only what materially improves the decision.

---

# Connection settings

Settings should communicate purpose, not provider jargon.

Example:

### Reminders

**How should Desk stay on you?**

- In app ✓
- WhatsApp
- Email
- Push

Intensity:

- Light
- Standard
- Stay on me

Quiet hours:

- From … to …

### Calendar

**Mirror scheduled work to Google Calendar**

- Connect Google Calendar
- Choose calendar
- Automatically add fixed sessions: on/off
- Add flexible Tasks only when I choose a time: recommended

Do not require channel setup during onboarding before the core Manager experience works.

---

# Channel preference model evolution

`notification_preferences` currently has booleans for channels. That is enough for the current foundation.

Future WhatsApp delivery will also need a verified destination/connection record. Do not store phone numbers directly in reminder payloads.

Conceptual:

```ts
type UserChannelConnection = {
  userId: string;
  channel: "whatsapp" | "google_calendar";
  provider: string;
  status: "pending" | "connected" | "revoked" | "failed";
  externalAccountRef?: string;
  encryptedCredentialRef?: string;
  metadata: Record<string, unknown>;
};
```

Provider credentials/tokens belong in secure secret/credential storage, not user-readable application tables.

---

# Delivery idempotency

Every external send/create/update must be idempotent.

## WhatsApp

Use reminder ID/dedupe key + persisted provider message record so retries cannot send duplicate pressure messages.

## Calendar

Use Task-provider link + event ID/revision so retries update/reconcile instead of creating duplicate calendar events.

Provider timeout does not mean failure. Reconcile uncertain writes before retry where possible.

---

# Failure semantics

External channel failure must never corrupt the Manager Runtime.

### WhatsApp failure

- reminder remains represented in Desk;
- adapter records failed delivery;
- in-app path can still show the reminder;
- Task state does not change.

### Calendar failure

- Task remains scheduled in Desk;
- mapping records sync error;
- user sees connection/sync issue where relevant;
- runtime continues.

Do not block Mission progress because a convenience integration is unavailable.

---

# Analytics

Measure channel effectiveness without confusing delivery with completion.

Useful funnel:

`reminder queued -> provider accepted -> delivered/read -> Desk action -> Task state/result`

Metrics:

- reminder-to-start rate;
- reminder-to-completion rate;
- Move/Blocked capture rate;
- stale reminder cancellation rate;
- WhatsApp delivery failure rate;
- Calendar sync failure/conflict rate;
- completion rate by reminder intensity;
- opt-out / channel disable rate.

Do not optimize only for message opens. The goal is execution.

---

# Odaeshi end-to-end channel example

## Desk

Current Task:

**Record “What couldn't finish us?”**
25 min · Saturday 16:00 · Otmos + 2 friends · ₦0

## Calendar

If the artist scheduled it:

**Odaeshi — record first Tough Skin Story**
Saturday 16:00–16:30

Description links back to the exact Desk Task.

## WhatsApp at start window

> **Odaeshi is the priority today.**
> You've got the first Tough Skin Story at 4 PM — about 25 min, no spend.
> Start on the strongest story; skip the intro.
>
> Start · Move it · I'm blocked

## Artist replies Move

> Sunday afternoon instead. Daniel can't make today but both friends can do Sunday and I still have the car.

The system should not merely edit a WhatsApp reminder.

It should:

1. resolve the canonical Task;
2. capture changed availability/context;
3. update/cancel current reminder intents;
4. run Manager impact logic;
5. update Calendar mirror if appropriate;
6. replan if downstream work is materially threatened;
7. send only the new relevant follow-up.

---

# Implementation order

Do not build both providers before the core execution surfaces are solid.

Recommended order:

## Phase 1 — settings + adapter contracts

- channel connection model;
- verify reminder preferences/quiet hours;
- adapter interface;
- delivery receipts/idempotency.

## Phase 2 — Google Calendar mirror

Calendar is lower conversational complexity and validates human-time modeling.

- OAuth connection;
- select calendar;
- Add to Calendar / fixed-session sync;
- local Task-event mapping;
- Desk -> Calendar updates;
- provider edit/deletion reconciliation;
- Move impact path reuse.

## Phase 3 — WhatsApp outbound accountability

- verified destination;
- approved template strategy where required;
- send adapter;
- delivery Webhooks;
- deep links/actions.

## Phase 4 — WhatsApp bounded inbound actions

- Start;
- Done;
- Move;
- Blocked;
- answer current Manager question.

Do not open broad autonomous WhatsApp chat until object resolution, safety and continuation behavior are proven.

## Phase 5 — richer Manager conversation

Only after the bounded execution loop is reliable.

---

# Regression failures

Reject channel work if any becomes true:

- WhatsApp or Calendar owns Task truth;
- reminder cadence is implemented separately per channel;
- Calendar contains Manager machine work;
- deleting a Calendar event marks a Task complete/cancelled;
- moving a Calendar event silently changes a fixed deadline;
- provider delivery/read status marks Task done;
- stale reminders send after Task completion/replan;
- WhatsApp reply guesses the wrong Mission/Task;
- same reminder is sent multiple times after retry;
- full Task brief is spammed into every channel;
- channel outage blocks Mission execution;
- provider token/phone destination is stored in reminder payload;
- WhatsApp becomes a second generic chatbot before bounded execution actions work;
- Calendar creates an event for every small Task automatically;
- quiet hours are ignored;
- channel copy invents urgency/dependency impact.

---

# Acceptance bar

A reviewer should be able to say:

1. Desk remains the source of truth.
2. Calendar contains only real human time.
3. WhatsApp delivers actionable Manager accountability, not duplicate planning.
4. Every external object maps to a canonical Desk object.
5. Replies/changes reuse the same Task/question/permission runtime paths.
6. Retries cannot duplicate sends/events.
7. Quiet hours/preferences are respected.
8. Provider failure degrades gracefully.
9. The artist does less coordination work.
10. The experience feels like the same manager reaching the artist through another surface.

---

# Official provider references checked

Google Calendar:

- https://developers.google.com/workspace/calendar/api/guides/create-events
- https://developers.google.com/workspace/calendar/api/auth
- https://developers.google.com/workspace/calendar/api/v3/reference/events

Meta WhatsApp Business Platform / Cloud API official Postman collection:

- https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api
- https://www.postman.com/meta/whatsapp-business-platform/folder/o48mro7/messages
- https://www.postman.com/meta/whatsapp-business-platform/folder/lczy75a/templates
- https://www.postman.com/meta/whatsapp-business-platform/folder/vzaxn16/webhook-payload-reference