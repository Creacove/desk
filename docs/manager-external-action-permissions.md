# Manager Runtime — external action permissions and progressive trust

## Product contract

Desk should do everything it safely can without bothering the artist.

When an action crosses a real external/irreversible boundary, Desk should arrive with the work already prepared and ask for the **smallest precise approval** necessary to execute it.

The desired experience is:

`Desk decides -> Desk prepares everything -> artist reviews one exact effect -> approves/edits/rejects -> Desk executes immediately -> outcome returns to runtime`

Not:

`Desk asks permission to start thinking -> artist explains what to do -> Desk drafts -> artist asks Desk to send -> artist asks what happened next`

The autonomy rule is:

> **Prepare freely. Ask at the effect boundary. Bind approval to the exact effect. Continue automatically after approval.**

---

# Existing permission primitive

The core schema already defines `permission_requests` with:

- Mission / Task / Checkpoint links;
- `draft_id` / `decision_package_id` references;
- `request_type`;
- title/body/risk;
- structured `parameters`;
- status;
- expiry;
- originating run/action IDs.

Current request types are:

- `spend`
- `external_outreach`
- `submission`
- `publish`
- `schedule`
- `release_plan_change`
- `legal_finance_rights`
- `sensitive_commitment`
- `draft_export`
- `source_connection`

Current statuses include:

- `pending`
- `approved`
- `rejected`
- `edited`
- `expired`
- `revoked`
- `superseded`

The runtime already creates permission requests from Manager review and adaptive planning. The next product layer should turn them into precise authorization + execution transactions rather than generic approval cards.

---

# Product-quality lenses

## Lens 1 — utility

A permission request should be the last gate before a meaningful action.

Good:

> **Send playlist pitch to Afrobeats Update**
> Desk has prepared the exact pitch and selected the Odaeshi press/listen package.
> Recipient: submissions@…
> Cost: ₦0
> **Review & send**

Bad:

> Allow Desk to work on playlist outreach?

The second request asks permission before Desk has done the useful preparation.

## Lens 2 — user effort

The artist should not assemble the action being approved.

Before asking, Desk should have completed all safe internal work:

- research target;
- qualify fit;
- verify public submission/contact path where possible;
- prepare pitch/content;
- choose relevant files/share package;
- calculate proposed spend;
- explain expected benefit/risk;
- identify what will happen immediately after approval.

The approval should be review, not project management.

## Lens 3 — context/memory

Permission requests must reflect current Plan Version, current target/resource, current user policy and current draft.

A request becomes stale when the underlying effect changes materially.

Examples:

- recipient changed;
- message body materially changed;
- spend amount changed;
- release date changed;
- attached file/share package changed;
- target changed;
- legal terms changed.

Do not silently reuse an old approval for a new effect.

## Lens 4 — reasoning quality

Desk should know:

- why this action is the next move;
- why this target/amount/timing was selected;
- what evidence supports it;
- what downside exists;
- what happens if the user rejects it.

Permission is not a substitute for Manager judgment.

## Lens 5 — runtime/harness

Approval must wake an execution path automatically.

The artist should not need to approve and then type:

> “Okay, send it.”

The runtime needs a durable link:

`permission request -> exact proposed effect -> approval -> external action runner -> execution receipt -> operating event/result -> next Manager decision`

## Lens 6 — autonomy boundary

The key distinction is **internal reversible preparation** vs **external effect**.

Desk normally does without approval:

- research;
- analysis;
- target shortlisting;
- drafting;
- package preparation;
- simulations/forecasts;
- internal scheduling recommendation;
- plan compilation;
- evaluating options.

Desk requests approval before configured external effect boundaries.

Do not ask the artist to approve internal thinking.

## Lens 7 — three clocks

Approval is human time only when a person genuinely must decide.

Desk should prepare the request immediately.
After approval, machine execution should happen immediately where possible.

Do not schedule:

> Tomorrow — Desk sends approved email.

unless the user explicitly approved a future send time.

## Lens 8 — execution quality

A permission request must be sufficiently specific that the artist understands exactly what clicking Approve will do.

It should answer:

1. What will happen?
2. To whom/where?
3. What content/assets/terms are involved?
4. What does it cost/commit?
5. Why now?
6. Can it be undone?
7. What will Desk do after it happens?

## Lens 9 — product coherence

Permission Request is the authorization object.

The external action itself should have a separate execution/run/receipt record.

Do not overload `permission_requests.status = approved` to mean the external effect definitely succeeded.

## Lens 10 — trust

Approval must be exact, fresh, attributable and auditable.

Never infer permission because:

- the artist approved a similar action before;
- “Stay on me” reminder mode is enabled;
- the Mission objective implies willingness;
- a manager/team member generally handles that area;
- the action seems low-risk to the model.

Progressive autonomy must come from explicit user policy, not behavioral inference.

## Lens 11 — 11-star feeling

The target reaction is:

> “Desk already did all the work. I only had to make the call that actually required me.”

---

# Action boundary matrix

## Research / analyze

Default: **automatic**

Examples:

- research playlist targets;
- evaluate distributor options;
- compare campaign results;
- inspect public opportunity requirements.

No approval.

## Draft / prepare

Default: **automatic**

Examples:

- outreach email;
- playlist pitch;
- caption;
- EPK/share package;
- proposed budget allocation;
- proposed release-date change;
- contract/deal question list.

No approval merely to prepare.

## External outreach

Default first implementation: **explicit approval before send**

Approval binds to:

- recipient/target;
- channel;
- exact message/draft revision;
- attachments/share link;
- send timing if scheduled.

## Submission

Default: **explicit approval**

Examples:

- playlist submission;
- sync brief submission;
- accelerator/application submission;
- distributor/pitch portal submission.

The user must see what is being submitted and where.

## Publish

Default: **explicit approval**

Examples:

- publish social post;
- schedule public content;
- change public artist-facing copy.

A future user-configured standing publishing policy may be possible for narrow cases, but never infer it.

## Spend

Default: **explicit approval per proposed transaction/budget action**

Show:

- amount;
- currency;
- vendor/channel;
- purpose;
- maximum charge;
- recurring vs one-time;
- expected tradeoff.

Do not turn a Mission budget into spending permission.

## Release-plan change

Default: **explicit approval**

Especially release date / distributor-facing schedule changes.

The existing release-date preview/approval pattern is a good reference: preview exact consequence before applying.

## Legal / finance / rights

Default: **explicit approval**

Never silently accept terms, modify rights, sign agreements, confirm financial commitments, or change ownership/splits.

## Sensitive commitment

Default: **explicit approval**

Anything with meaningful reputational, relationship, contractual or irreversible consequence.

## Source connection

Default: **explicit user authorization**

OAuth/provider connection is its own user consent boundary.

---

# Permission request contract

A user-facing request should project an exact effect object.

Conceptual:

```ts
type PermissionEffect = {
  requestId: string;
  requestType: PermissionRequestType;
  missionId?: string;
  taskId?: string;

  action: string;
  target: {
    type: string;
    id?: string;
    label: string;
    destination?: string;
  };

  content?: {
    draftId?: string;
    revision?: number;
    preview: string;
    assetIds?: string[];
    shareLinkId?: string;
  };

  spend?: {
    amountMinor: number;
    currency: string;
    vendor?: string;
    recurring: boolean;
  };

  timing?: {
    executeAt?: string;
    expiresAt?: string;
  };

  whyNow: string;
  risk: string;
  reversible: boolean;
  effectHash: string;
};
```

`effectHash` represents the material approved payload.

If a material field changes, the prior approval cannot authorize the changed effect.

---

# Approval transaction

## 1. Desk prepares

All safe internal work completes.

## 2. Desk persists exact request

Request parameters include the effect or stable references + revision/hash.

## 3. Artist reviews

Actions:

- Approve
- Edit
- Reject

## 4. Approve

Runtime validates:

- request still pending;
- not expired/revoked/superseded;
- current Plan/Mission context still valid;
- referenced draft/target/amount still matches `effectHash`;
- current user has authority;
- no duplicate execution already succeeded.

Then external action starts automatically.

## 5. Edit

Editing creates a new effect/revision and should normally supersede the old request.

Do not keep “approved” status on a payload the user changed.

## 6. Reject

Runtime records rejection as a decision signal.

Desk should continue:

- choose fallback;
- update strategy/plan if rejection changes route;
- remember the rejected move at correct scope when useful.

Reject must not dead-end the Mission unless no legitimate route remains.

## 7. Execution receipt

External runner records:

- provider/tool;
- request id;
- idempotency key;
- started/completed times;
- exact effect hash;
- external reference;
- outcome;
- error/retryability.

## 8. Continuation

Success/failure becomes an operating event/result and wakes the appropriate next Manager action/watch.

---

# External action execution object

Do not confuse authorization with execution.

Recommended future object:

```ts
type ExternalActionRun = {
  id: string;
  permissionRequestId: string;
  actionType: string;
  effectHash: string;
  idempotencyKey: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  provider?: string;
  externalRef?: string;
  result?: Record<string, unknown>;
  error?: string;
  startedAt?: string;
  completedAt?: string;
};
```

This can be a new table or reuse/extend `manager_run_actions` when its semantics fit.

The key invariant is:

> Approved != succeeded.

---

# Progressive trust

Progressive trust is useful, but it must be explicit.

## What Desk may learn automatically

Desk may learn execution preferences and behavior.

It may **not** learn authority/permission by observation.

Repeated approvals do not silently become standing authorization.

## Future explicit standing policies

A user may deliberately configure bounded policies.

Conceptual modes:

- `prepare_only`
- `always_ask`
- `preapproved_scope`
- `ask_above_limit`

Example:

> Desk may send playlist outreach for this Mission only to targets I have already approved, using the approved pitch template/share package, until September 30. Ask me again if the message or target list materially changes.

Or:

> Desk may spend up to ₦10,000 per approved campaign vendor, maximum ₦30,000 total this Mission. Ask above either limit.

The policy must contain explicit bounds such as:

- action type;
- Mission/workspace;
- target class/list;
- amount cap;
- total cap;
- allowed draft/template revision;
- frequency/count;
- time expiry;
- revocation state.

## Never standing-auto by default

Recommended always-explicit categories, at least initially:

- release-plan changes;
- legal/finance/rights;
- sensitive commitments;
- public publishing in the artist's voice;
- high-value/unbounded spend;
- source/OAuth authorization.

---

# Today projection

Pending permission that blocks the current route should appear in Today as `needs_you`.

Example:

**One approval before Desk can move outreach**

**Send Odaeshi pitch to Afrobeats Update**

Desk has the pitch and press/listen package ready. ₦0.

**Review**

Do not show a raw database status like `permission_request pending`.

---

# Permission review UI

Recommended structure:

## What Desk wants to do

Plain-language action.

## Why now

Manager rationale.

## Target / destination

Recipient, platform, vendor, release date, etc.

## Exact content / terms

Preview the actual draft/package/change.

## Cost / commitment

Amount and bounds when relevant.

## Risk / reversibility

Clear concise consequence.

## Actions

- Approve
- Edit
- Reject

For high-impact effects, label button with the action:

- **Send pitch**
- **Spend ₦10,000**
- **Move release to Sept 18**
- **Publish post**

This is better than a generic **Approve** when the effect deserves clarity.

---

# Outreach example

Desk research finds a public playlist submission path and qualifies fit.

Desk automatically:

1. confirms target/source;
2. checks song fit;
3. prepares pitch;
4. selects approved share package;
5. verifies no duplicate submission exists;
6. creates exact permission request.

Artist sees:

**Send Odaeshi to Afrobeats Update**

Why: Their current public criteria fit Odaeshi's sound/market and Desk has a verified submission path.

Message:
> [exact pitch preview]

Package:
- listen link
- artist bio
- artwork

Cost: ₦0

**Send pitch** · Edit · Reject

Artist taps Send pitch.

Desk executes immediately and records provider/submission outcome.

If no response requires waiting, start a watch rather than a “follow up tomorrow” Manager Task.

---

# Spend example

Desk decides a proven content concept warrants a small paid test.

Request:

**Run a ₦10,000 Odaeshi response test**

Why now:
The organic format produced enough participation to justify testing reach; broad ads were previously rejected before proof.

Spend:
- ₦10,000 maximum
- one-time
- Meta campaign
- 3-day test

Success condition:
- cost per meaningful response/comment/save threshold defined in plan

**Spend ₦10,000** · Edit budget · Reject

Approval binds to the exact capped spend/configuration.

Increasing budget later needs new approval unless explicit standing policy covers it.

---

# Publish example

Desk prepares a post after reviewing content.

Artist sees:

**Publish the first Odaeshi resilience story**

Video: approved cut v3
Caption: [preview]
CTA: “What tried to finish you?”
Platform: TikTok
Timing: now / approved scheduled time

**Publish** · Edit · Reject

The approval is for this exact media + caption + destination/timing.

A later changed caption/materially different cut cannot reuse the old approval.

---

# Release-plan change example

Keep the existing preview-first pattern.

The request should show:

- current date;
- proposed date;
- why change is recommended;
- tasks/milestones that move;
- fixed items preserved;
- consequence if unchanged.

Approval applies through the existing guarded release-plan change path.

Do not let a generic adaptive replan silently change an external release commitment.

---

# Rejection as useful context

A rejected permission is not failure noise.

Examples:

- “Don't spend on ads yet.”
- “I don't want to pitch this outlet.”
- “Don't publish in my voice automatically.”

Desk can persist a correctly scoped `rejected_move` / strategy guardrail when this should affect future decisions.

Do not convert every single rejection into permanent artist preference; scope/freshness rules still apply.

---

# Team authority

A multi-user workspace eventually needs action authority by role/user.

Do not assume every account member can approve every effect.

Future policy should distinguish:

- who may approve spend;
- who may publish;
- who may change release plans;
- who may approve rights/legal actions;
- who may connect sources.

The permission request should expose the correct authorized assignee.

If the current user lacks authority, show who/what is required rather than accepting an invalid approval.

---

# Idempotency and race safety

External effects need stricter guarantees than internal planning.

### Approval double-click

One external action.

### Worker retry after timeout

Do not blindly send/spend/publish twice.

### Request superseded while approval screen open

Reject stale approval and show the new effect.

### Plan changes while request pending

If the action is no longer valid, mark request superseded/cancelled before execution.

### Approval and rejection race from different team members

Use transactional state transition / version check. Only one terminal decision wins.

---

# Failure semantics

## Approval persisted, external execution fails

Do not ask the user to approve the exact same effect again merely because provider execution failed.

If approval is still fresh and effect unchanged, retry according to safe idempotency/provider semantics.

If the effect must change to retry, create a new permission request.

## Provider outcome uncertain

Reconcile before retrying when duplicate external effect would be harmful.

## Permission expires

Do not execute.
Manager re-evaluates whether the action is still relevant and may create a new request.

---

# Analytics

Measure:

- permission requests created;
- approval / edit / rejection / expiry rate by type;
- time to decision;
- approved -> execution success rate;
- duplicate-prevention/reconciliation events;
- percentage of requests where user edited effect;
- repeated rejection patterns that change strategy;
- execution outcomes after approval.

Do not optimize for maximum approval rate. A useful Manager should sometimes propose actions the artist rejects.

---

# Odaeshi acceptance case

After two organic response tests, Desk believes a ₦10k distribution/paid test is justified.

Correct flow:

1. Desk does the analysis automatically.
2. Desk prepares exact proposed spend/configuration.
3. Today shows one approval if it blocks the next route.
4. Artist reviews exact amount/purpose.
5. Approval triggers execution automatically.
6. Execution receipt returns to Desk.
7. Desk starts the appropriate response watch.
8. When evidence matures, Desk compares it to the success condition and adapts.

Failure examples:

- Desk asks “Can I explore paid ads?” before doing analysis;
- Desk treats ₦20k Mission budget as permission to spend;
- artist approves ₦10k and Desk spends ₦15k;
- approval requires the artist to type “go ahead” again;
- `approved` is displayed as if campaign successfully launched before provider confirmation;
- failed provider call causes duplicate spend on retry.

---

# Regression failures

Reject the permission system if any becomes true:

- internal research/drafting requires approval;
- approval is generic rather than bound to exact effect;
- repeated approvals silently create standing permission;
- approval status is treated as execution success;
- effect changes after approval without reauthorization;
- Task/Mission becomes blocked waiting for the artist to tell Desk to execute an already-approved action;
- rejected action dead-ends the Mission without Manager fallback;
- expired/superseded request can execute;
- double-click/retry can duplicate external effect;
- sensitive action uses a vague button;
- user lacking authority can approve;
- external action bypasses Plan/permission validity checks;
- channel reply can approve the wrong request by guessing context.

---

# Acceptance bar

A reviewer should be able to answer yes:

1. Did Desk finish every safe preparatory step before asking?
2. Does the user know the exact effect of approval?
3. Is approval cryptographically/logically bound to that effect/revision?
4. Does approval trigger execution without another prompt?
5. Is execution success recorded separately from authorization?
6. Can retries avoid duplicate external effects?
7. Does rejection become useful Manager context/fallback?
8. Is progressive autonomy always explicitly granted, bounded and revocable?
9. Are high-impact categories conservative by default?
10. Does the artist only make the decisions that genuinely require them?

The success criterion is:

> **Desk arrives at the boundary with the work done and the decision ready.**