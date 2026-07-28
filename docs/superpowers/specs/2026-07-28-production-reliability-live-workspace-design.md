# Production Reliability and Live Workspace Design

**Date:** 2026-07-28
**Status:** Approved for implementation planning
**Scope:** V1 production hardening for setup, background intelligence, live updates, notifications, and Supabase resource use

## Executive Decision

Ordersounds will use a small, additive reliability layer built on the stack it already operates: React, Supabase Postgres, Supabase Realtime, Supabase Edge Functions, and `pg_cron`.

The product will not adopt a general workflow engine, message broker, cache server, custom WebSocket gateway, or new frontend state-management framework for V1.

The governing contract is:

> Persist work before starting it, execute it from frozen inputs, make every material side effect safe to retry, recover interrupted work, store one terminal result, and refresh the affected product surface without requiring a page reload.

This design preserves the recently completed Music Manager Read, Manager Conversation, Mission Genesis, onboarding retry, billing, and entitlement contracts. It extends their reliability and delivery behavior rather than replacing their product logic.

## Why This Program Exists

The backend already persists important outputs, but execution and client freshness are inconsistent.

The audit found:

- setup activity is partly persisted and partly held only in local React state;
- `EdgeRuntime.waitUntil` is used as the practical continuation mechanism for several long-running workflows;
- running stages do not share a consistent lease, heartbeat, expiry, or watchdog contract;
- some discovery and setup side effects do not have independent idempotency keys;
- setup progress queries are workspace-scoped rather than active-run-scoped;
- selected music targets can be re-derived between discovery and later generation;
- the setup brief path can permit knowledge that is not grounded in the persisted evidence packet;
- most application view models load only at mount and remain stale until reload;
- notification counts are derived from an initial Desk snapshot rather than persisted unread state;
- polling is fragmented, broad, and expensive;
- the setup screen exposes internal language and renders duplicate completion icons.

The product must feel alive while consuming fewer Supabase resources than it does today.

## Existing Contracts We Will Reuse

The following are foundations, not targets for reinvention:

- `workspace_setup_runs` is the canonical paid-setup run.
- `workspace_setup_runs.stage_status` records setup-stage outcomes.
- `manager_synthesis_runs` is the canonical run record for Manager intelligence.
- `manager_intelligence_packets` holds reproducible intelligence inputs.
- `manager_outputs` holds versioned, current/superseded Manager results.
- `finalize_music_manager_read_v2` atomically activates a Music Manager Read and closes its usage/run records.
- the active Music Manager Read uniqueness constraint prevents concurrent runs for one subject.
- `operating_events` is the append-only operational history.
- existing Chartmetric snapshots and evidence are reused rather than repurchased.
- existing Manager Conversation server-sent events provide immediate updates for the active conversation.
- existing billing recovery demonstrates the `pg_cron` plus conditional Edge invocation pattern.

Earlier approved product-specific designs remain authoritative for the shape and quality of their outputs. This design governs execution durability, live delivery, resource use, and setup continuity across those products.

## Product Invariants

1. Existing completed workspaces continue to open without a migration or setup replay.
2. Existing current Manager outputs remain readable throughout deployment.
3. The last good Manager output remains current when a refresh fails.
4. A retry never duplicates an output, mission, evidence item, customer-visible event, or downstream stage.
5. A background run cannot remain `running` forever.
6. Setup progress belongs only to the active setup run.
7. Setup uses one frozen selection of music targets from discovery through generation.
8. A browser reload or reconnect restores the authoritative server state.
9. The user does not need to reload to see a normal background completion.
10. Routine work updates quietly; only important completion, failure, approval, or context requests interrupt.
11. Idle browser tabs do not issue repeating REST or Edge Function requests.
12. Realtime is a small invalidation signal; Postgres remains the source of truth.
13. Evidence-based output cannot present unsourced model knowledge as workspace evidence.
14. No production rollout combines destructive data conversion with new execution behavior.

## Non-Goals

V1 will not add:

- Temporal or another external workflow engine;
- Redis, Kafka, or a custom event bus;
- a custom WebSocket gateway;
- React Query, Redux, or a full application-state rewrite;
- offline-first editing;
- browser push or routine email notifications;
- exact percentage progress for model work;
- presence, typing indicators outside the existing conversation stream, or collaborative cursors;
- a generic user-configurable automation system;
- automatic reprocessing of historical workspaces;
- broad deletion of historical Manager outputs or operating events.

## Architecture Overview

The design has five cooperating parts:

1. **Durable run records** own workflow state and frozen inputs.
2. **Atomic stage transitions** claim, heartbeat, complete, or fail work safely.
3. **An opportunistic fast path plus conditional recovery** executes work promptly and reclaims interrupted runs.
4. **One filtered workspace Realtime channel** tells the client what became stale.
5. **Focused repository reloads and a durable activity projection** update only the affected surface.

There is no second source of truth and no parallel workflow model.

## 1. Durable Workflow State

### Workspace setup

`workspace_setup_runs` remains the setup workflow record. Add only the recovery metadata it lacks:

- `workflow_version`
- `input_refs`
- `scope_key`
- `idempotency_key`
- `max_attempts`
- `available_at`
- `lease_token`
- `lease_expires_at`
- `heartbeat_at`
- `last_attempt_started_at`

The existing `retry_count`, `last_error`, `current_stage`, `stage_status`, and terminal timestamps remain in use. Setup does not add a second attempt counter.

`input_refs` is a bounded JSON object containing stable references, not copied evidence:

- selected music-item IDs;
- selected music-project ID, when any;
- intelligence-packet ID or evidence revision;
- profile/context revision;
- selection timestamp;
- selection algorithm version.

Large evidence JSON remains in the existing intelligence packet and evidence tables.

### Manager intelligence

`manager_synthesis_runs` remains the workflow record for:

- setup and operating Today's Brief generation;
- song and project Manager Reads;
- Mission Genesis;
- public-context refresh;
- task-result review and other supported background Manager work.

Add the shared recovery metadata where it is absent:

- `workflow_version`
- `scope_key`
- `idempotency_key`
- `lease_token`
- `lease_expires_at`
- `heartbeat_at`
- `attempt_count`
- `max_attempts`
- `available_at`
- `last_attempt_started_at`

Existing `context_payload`, subject identity, classification, action plan, steps, limitations, and terminal fields remain authoritative.

Interactive Manager Conversation streaming does not move to the recovery worker in V1. It keeps its current SSE path, persists its run and messages, and must mark an interrupted run terminal so the conversation can reload cleanly.

### Source synchronization

`source_sync_jobs` remains the durable record for Spotify and provider enrichment work. Add the same bounded claim metadata plus:

- `scope_key`;
- `subject_type`;
- `subject_id`;
- `target_payload`;
- `workspace_setup_run_id`.

An active partial unique index prevents duplicate work for the same workspace, job type, and scope.

### Operating events

Add:

- an explicit nullable `workspace_setup_run_id` reference;
- a nullable `dedupe_key`;
- a nullable `display_mode`;
- a bounded `refresh_scope`;
- an optional recipient user ID for user-specific action events.

Setup and discovery events must include the setup run ID. Material terminal events use deterministic dedupe keys so retries do not append duplicates.

`display_mode` is null for audit-only records and one of `activity`, `toast`, or `action` for customer-visible events. `refresh_scope` is routing metadata, not application data.

Heartbeats and polling checks do not create operating events. Only meaningful transitions do:

- queued;
- stage started;
- stage completed;
- completed with limits;
- failed;
- action required;
- workflow completed.

## 2. Atomic Claims and Stage Transitions

The current read-modify-write handling of `stage_status` is vulnerable to concurrent updates replacing one another. V1 will add narrow database functions rather than a generalized workflow API.

Required operations:

- claim a queued or expired setup stage;
- claim a queued or expired source synchronization job;
- heartbeat a stage owned by the caller;
- heartbeat a source synchronization job;
- complete a stage owned by the caller;
- fail a stage owned by the caller;
- claim a queued or expired supported Manager run;
- heartbeat that Manager run;
- close it terminally.

Every operation verifies:

- run identity;
- account and workspace ownership;
- expected prior status;
- current lease owner where applicable;
- non-terminal state.

Claims update the run and return the claimed row in one transaction. Completion and failure reject stale workers whose lease token is no longer current.

Stage writes update one JSON path atomically. They do not replace the complete `stage_status` object using a previously read copy.

The concrete database boundary consists of narrow RPCs for Manager-run claim/heartbeat, source-job claim/heartbeat, setup-stage claim/merge, and expired-work reaping. Public and authenticated execution is revoked; only service-role workers may claim or reap.

## 3. Execution, Recovery, and Idempotency

### Fast path

The initiating function:

1. validates entitlement, ownership, and input;
2. creates or reuses a run from an idempotency key;
3. persists frozen input references;
4. marks the work queued;
5. attempts immediate dispatch;
6. returns the run ID.

`EdgeRuntime.waitUntil` may remain as an opportunistic fast path. It is not proof that the work will finish.

### Recovery path

One V1 recovery entry point handles only an allowlist of supported workflow classifications. It does not scan or execute arbitrary code.

The database schedule first checks whether eligible work exists. It invokes the Edge recovery function only when it finds:

- queued work not yet claimed;
- running work with an expired lease;
- retryable work whose `available_at` has arrived.

The worker claims a bounded batch of three to five rows and routes each row to the existing workflow implementation.

Normal completion should not wait for the scheduled recovery interval. Recovery exists for lost dispatches and dead workers.

Legacy rows with null reliability metadata are never assumed abandoned. Recovery processes only explicit supported `workflow_version` values after their new writers are deployed.

### Retry policy

Retries are bounded and classified:

- provider timeouts, rate limits, and transient server/database failures may retry;
- validation, authorization, invalid structured output after repair, and permanent source limitations do not retry indefinitely;
- exponential delay includes jitter;
- terminal failure preserves completed prior stages and last good outputs.

### Side-effect idempotency

Each material write uses an existing unique constraint or a deterministic key:

- evidence from one source snapshot;
- one current Manager output activation per completed run;
- one setup target record in `stage_status` per subject;
- one mission result per Mission Genesis run;
- one terminal operating event per run transition;
- one customer-visible operating event per user-facing outcome;
- one dispatch of a child stage.

Retries may repeat computation. They may not multiply product records.

### Workflow-specific decisions

#### Spotify, catalog, and discovery

- Source jobs receive stable subject scope and active-job uniqueness.
- Discovery creates one `manager_synthesis_runs` record with a dedicated classification.
- The candidate catalogue and paid enrichment targets are frozen in run context before tools execute.
- Tool actions use the existing `manager_run_actions` ledger and deterministic call keys.
- Retry reuses completed snapshots and executes only unfinished frozen targets.
- Discovery reconciliation preserves `completed_with_limits`; it never reconstructs that outcome as fully completed.

#### Today's Brief

- The endpoint adopts the existing durable `202 + runId` interaction used by Music Manager Read and Mission Genesis.
- Generation mode, evidence cutoff, setup-run ID, and target references are frozen before generation.
- Packet, output, evidence-link, memory, run, and usage completion are replay-safe.
- Current-output retirement and replacement occur in one transactional finalizer.
- The previous current brief remains current if the refresh fails.

#### Setup Music Manager Read wave

- The complete target tuple list is persisted before the first child dispatch.
- Each returned child run ID is merged independently into the setup stage.
- The backend three-minute polling loop is removed.
- Child terminalization updates the setup stage; recovery reconciles missed updates.
- All success is `completed`; any failed, cancelled, or exhausted child is `completed_with_limits`.
- This stage never revokes workspace access.

#### Individual Music Manager Read

- The existing active-subject uniqueness and `finalize_music_manager_read_v2` transaction remain.
- Staleness is determined by lease and heartbeat, not run creation time.
- Recovery, rather than the next user request, reclaims expired work.

#### Mission Genesis

- Initial and continuation requests use scope-specific idempotency keys.
- Continuation answers are persisted only after the run is claimed.
- The validated graph is applied through one replay-safe transactional finalizer.
- Duplicate invocation or recovery produces one answer batch, one action result, and one mission graph.

## 4. Setup Orchestration

### Canonical state

The browser never decides setup state from local flags alone. On mount and reconnect it loads the latest `workspace_setup_runs` row for the active workspace.

Routing rules:

- queued/running setup opens the setup activity screen at the persisted current stage;
- failed setup opens the failed stage with a safe retry;
- a ready initial brief permits workspace entry;
- setup music reads may continue after workspace entry;
- completed setup opens the workspace directly.

### Frozen selection

Discovery selects the setup focus assets once. Their IDs and selection version are stored on the setup run before enrichment or generation begins.

Every later step uses that frozen selection:

- enrichment;
- intelligence-packet projection;
- initial brief;
- setup Music Manager Reads;
- setup progress and limitations.

Catalog changes do not silently replace a target in an in-flight setup.

### Stage contract

Internal stage keys are stable:

- `catalog_bootstrap`
- `manager_discovery`
- `setup_brief`
- `music_reads`

The product maps them to customer language. It does not parse raw Edge Function summaries.

The initial brief is the entry gate. Setup Music Manager Reads are post-entry background work and may complete with limits.

### Setup recovery

Each stage can:

- short-circuit when already complete;
- resume when its lease expires;
- retry without repeating completed paid enrichment;
- complete with limits when minimum intelligence requirements are met;
- expose a terminal actionable error when requirements are not met.

The browser never calls a setup Edge Function every two seconds. It starts or retries work once, then observes the persisted run.

## 5. Live Workspace Delivery

### One workspace channel

The browser creates one Realtime channel for the visible active workspace.

The channel has one server-side workspace-filtered `INSERT` listener on `operating_events`. It does not subscribe directly to large run, output, mission, music, or evidence rows. It does not use Presence.

Realtime payloads select only small routing fields:

- event ID;
- workspace ID;
- event type;
- target type and ID;
- refresh scope;
- display mode;
- created/updated time.

Large `jsonb` output and evidence fields are never delivered through Realtime.

### Realtime is invalidation

The client treats an event as “this resource is stale,” then loads the authoritative record through an existing repository.

Refresh scopes are bounded:

- `workspace`
- `desk`
- `music-list`
- `music-object:<id>`
- `missions-list`
- `mission:<id>`
- `conversations-list`
- `conversation:<id>`
- `activity`

Events are debounced and in-flight requests are deduplicated.

### Catch-up and degraded mode

The app stores the last processed `{createdAt, id}` cursor per authenticated user and workspace in browser storage. The cursor contains no sensitive product data.

The app performs a focused, bounded catch-up when:

- the workspace channel reconnects;
- the browser returns online;
- the tab becomes visible;
- the active workspace changes.

Catch-up reads at most 50 events per page and at most three pages. If more history exists, the client performs one bounded resource reconciliation and advances the cursor rather than looping indefinitely.

Fallback polling is allowed only for a known active run when Realtime is degraded:

- query the exact run ID;
- wait 5 seconds, then 10, 20, and at most 30 seconds;
- schedule the next request only after the previous one finishes;
- stop in a hidden tab;
- stop at a terminal state;
- stop at a bounded deadline.

After a tab remains hidden for several minutes, it unsubscribes. Visibility restoration performs one catch-up and reconnect.

### Existing conversation stream

The active Manager Conversation continues using SSE for token and artifact updates. Its existing refresh hints call the same focused invalidation interface as Realtime, avoiding two refresh implementations.

## 6. Focused Data Access

### Application bootstrap

The application no longer loads every detailed product area before rendering.

Workspace entry loads:

- profile summary;
- Desk summary and current brief;
- lightweight attention/activity;
- lightweight music and mission summaries needed by the Desk.

Feature detail loads on demand:

- complete music detail when a song/project opens;
- full mission graph when a mission opens;
- conversation messages when a conversation opens;
- evidence when its drawer opens;
- documents when a task requests them.

### List/detail split

List queries exclude large render and evidence JSON.

Music list data includes identity, lifecycle, association, read status, and timestamps. A music-object loader fetches its full current Manager Read and related detail.

Mission lists exclude full checkpoints, steps, results, events, memories, and documents. A mission-detail loader fetches one mission graph.

Conversation lists exclude message bodies not required for their previews. A conversation-detail loader owns messages.

All list queries use explicit columns, workspace filters, deterministic ordering, and bounds or pagination.

### Resource cache

V1 uses a small session-memory request coordinator, not a new cache framework.

It provides:

- one in-flight request per resource key;
- last loaded value and timestamp;
- explicit invalidation;
- workspace isolation;
- cancellation on workspace change or unmount.

It does not persist sensitive application state to browser storage.

## 7. Notifications and Activity

V1 reuses customer-visible `operating_events` as the durable Activity Center source. It does not add a duplicate notification table.

Each visible event contains:

- account and workspace;
- optional recipient;
- event type;
- safe title/summary;
- target type and target ID;
- refresh scope;
- display mode;
- dedupe key;
- created time.

Display modes are:

- `activity`: quietly update the Activity Center;
- `toast`: restrained transient completion/failure notice plus persisted history;
- `action`: approval, question, blocker, or retry requiring attention.

Routine background progress does not create a toast.

The browser records the last seen event cursor per authenticated user and workspace. The badge is the count of newer visible events, not `attention.length + movement.length`. Reloading preserves the cursor and re-derives the count from durable events.

The Activity Center is shared by desktop and mobile and contains:

- Needs you
- Recently completed
- Background activity

Selecting an item deep-links to the exact object. Opening a toast is never required to recover the event.

The Activity Center initially loads 20 visible events and loads older history only on explicit request. V1 does not automatically delete operating history. It first stops creating noisy progress rows and measures database growth.

## 8. Setup Product Experience

The setup activity component moves out of the root application component and renders product-defined stages.

Recommended copy:

- Title: **Preparing your workspace**
- Body: **Your Manager is reviewing your music and preparing your first brief. This work will continue if you close this page.**
- Success: **Your workspace is ready**
- Partial success: **Your workspace is ready. Some music insights are still being prepared.**
- Failure: **Setup paused while preparing your workspace. Your completed work is safe.**

Visible stages:

1. Connecting your music
2. Understanding your catalogue
3. Learning about your artist profile
4. Preparing your workspace
5. Writing your first Manager brief

Post-entry background copy:

- Preparing Manager Reads for your selected music

UI rules:

- one status icon per row;
- completed, current, waiting, and failed states;
- no fake percentage;
- no raw provider/function/model language;
- no `Desk HQ` onboarding jargon;
- no duplicate checkmarks;
- no broken text encoding;
- one polite `aria-live` announcement for a meaningful stage change;
- reduced-motion support;
- retry targets the actual failed stage.

## 9. Grounded Intelligence

Every supported generation uses a versioned Manager intelligence packet or equivalent frozen evidence reference.

The prompt distinguishes:

- verified evidence;
- user-provided context;
- persisted application state;
- permitted interpretation;
- missing or stale information.

Evidence-based claims cannot treat broad model knowledge as sourced workspace truth.

Structured outputs include or resolve to:

- recommendation or interpretation;
- supporting evidence IDs;
- confidence;
- limitations;
- missing information;
- next action;
- prompt version;
- packet/schema version.

Fallback output is structurally and visibly marked as limited. It cannot masquerade as a fully grounded live result.

Existing Music Manager Read output shape remains governed by its approved single-surface design. This program strengthens its run recovery and delivery, not its visible content contract.

## 10. Supabase Cost Model

The design targets resource use proportional to meaningful work, not time spent with a tab open.

### Hard client rules

- zero repeating REST or Edge requests while idle;
- one Realtime connection per visible tab;
- no Presence;
- no large Realtime payloads;
- no full-library refresh for one changed object;
- no polling while hidden;
- no overlapping fallback requests;
- no indefinite polling deadline;
- no broad historical progress query.

### Internal V1 budgets

| Resource | Free allowance | Internal review threshold |
|---|---:|---:|
| Egress | 5 GB/month | 2.5 GB |
| Database size | 500 MB | 300 MB |
| Realtime messages | 2 million/month | 250,000 |
| Realtime peak connections | 200 | 100 |
| Edge Function invocations | 500,000/month | 100,000 |
| Idle repeating API traffic | n/a | zero |

The thresholds are operational review points, not quotas to consume.

### Current hotspots to remove first

- music detail polls every two seconds and reloads the complete multi-query music library;
- setup discovery polls all historical matching operating events every two seconds;
- setup contextualization can call an Edge Function every two seconds without a browser deadline;
- Mission Genesis can poll two database reads every 1.5 seconds for six minutes;
- setup music-read finalization polls run rows every two seconds for three minutes;
- initial application load eagerly fetches unrelated detailed resources.

### Conditional scheduled work

Cron performs an inexpensive indexed existence check before invoking recovery. With no eligible work, it makes no Edge request.

The existing billing recovery schedule should receive the same condition if measurement confirms that it invokes its worker with no pending webhook rows.

### Storage discipline

- store references and hashes instead of copied evidence packets;
- write events only for meaningful transitions;
- update heartbeat fields in place;
- bound list/history queries;
- add only indexes used by claims, visible-event catch-up, and workspace ordering;
- retain valuable outputs and audit history until measured database growth justifies a separate retention decision.

## 11. Error Handling

Errors are split into:

- safe user message;
- stable error code;
- retryability classification;
- restricted diagnostic metadata.

Provider bodies, database details, credentials, and internal identifiers do not reach customer-visible errors or large persistent event payloads.

If a refresh fails:

- keep the last good content;
- mark the refresh failed;
- offer retry where useful;
- do not clear the previous current output.

If live sync fails:

- show no alarming global failure while local data remains usable;
- enter bounded exact-run polling only for active work;
- catch up on reconnection.

If setup partially succeeds:

- preserve completed stages;
- enter the workspace once the initial brief is valid;
- mark remaining reads completed with limits or retryable failure;
- never strand the account behind an endless activity screen.

## 12. Security and Workspace Isolation

Every new table enables RLS.

Authenticated users may select operating events only for accounts and workspaces they belong to. User-specific action events must match the authenticated recipient when a recipient is present.

Run recovery uses service-role access and validates the stored account, workspace, artist, classification, and subject before processing.

Realtime subscriptions use authenticated clients and workspace filters. The client never receives the service-role key.

All focused loaders include workspace ownership filters in addition to row IDs.

Cross-workspace events are ignored defensively even after server-side filtering.

## 13. Testing Strategy

Implementation follows test-driven, phase-local changes.

### Contract tests

Cover:

- additive schema, constraints, indexes, grants, RLS, and Realtime publication;
- atomic claim/heartbeat/terminal transition behavior;
- stale lease rejection;
- idempotent finalization and operating-event dedupe;
- frozen setup targets and current-run event scoping;
- grounded prompt and structured-output requirements.

### Repository tests

Cover:

- list queries exclude large JSON;
- focused loaders fetch one target;
- Activity Center cursor and unread-count behavior;
- setup-run rehydration;
- workspace isolation;
- request deduplication and cancellation.

### UI tests

Cover:

- reload at every setup state;
- completion while viewing the same or another screen;
- quiet activity, toast, and action delivery;
- deep links;
- desktop/mobile Activity Center parity;
- hidden-tab suspension and visibility catch-up;
- online/reconnect catch-up;
- no duplicate setup icon or internal jargon;
- accessibility announcements and reduced motion.

### Cost behavior tests

With fake timers and repository spies:

- five idle minutes trigger zero repeating REST/Edge calls;
- one normal Music Manager Read causes one start, terminal signal, and focused result fetch;
- degraded Realtime uses exact-run exponential fallback;
- hidden tabs do not poll;
- setup never invokes an indefinite two-second status loop;
- an activity event does not reload unrelated product areas;
- list queries do not select full render JSON.

### End-to-end failure matrix

Cover:

- tab close/reopen;
- network loss;
- duplicate invocation;
- expired lease;
- worker death after external success but before finalization;
- out-of-order and duplicate Realtime events;
- two tabs;
- auth refresh;
- partial provider coverage;
- OpenAI timeout and invalid structured output;
- old current output plus failed refresh;
- existing completed workspace after migration.

## 14. Rollout

### Phase 0: Baseline

Record current Supabase usage, stuck-run counts, network request counts, and baseline test/build results.

### Phase 1: Remove resource hotspots

Replace broad polling with exact run/object loaders, bound existing loops, deduplicate requests, and split heavy list/detail payloads.

This phase must reduce usage before Realtime is enabled.

### Phase 2: Additive schema

Deploy nullable recovery metadata, atomic RPCs, run-scoping references, operating-event delivery fields, RLS, grants, and narrow indexes.

Old readers and writers continue working.

### Phase 3: Read-side live sync

Deploy focused loaders, the request coordinator, one filtered channel, visibility/online catch-up, and the durable Activity Center projection.

Realtime initially observes existing writers. It does not own workflow execution.

### Phase 4: Setup continuity and experience

Rehydrate setup, freeze targets, scope progress, replace raw stage text, allow post-brief entry, and ship the revised setup UI.

### Phase 5: Workflow recovery

Enable leases, heartbeats, idempotency, and conditional recovery one workflow at a time:

1. workspace setup;
2. setup Music Manager Read wave;
3. individual Music Manager Reads;
4. Mission Genesis;
5. Today's Brief and other explicitly supported background Manager work.

### Phase 6: Grounding and cleanup

Tighten remaining prompt/evidence contracts, remove obsolete polling and raw progress translation, and retain old compatibility paths until production observation is complete.

## Deployment Rules

Every phase follows:

1. add backwards-compatible database capability;
2. deploy readers that understand old and new records;
3. deploy new writers;
4. enable behavior for one workflow;
5. observe correctness and resource use;
6. remove the old path in a later deployment.

No production migration or Edge deployment is automatic from the implementation session. Production handoff must list exact order, smoke queries, observed test evidence, and rollback commands and must request explicit approval.

## Success Criteria

- no reload is required for normal background completion;
- active-tab completion is visible within five seconds under normal Realtime operation;
- reload restores the correct setup/run state;
- interrupted supported work is reclaimed within the configured recovery window;
- retries create no duplicate material records;
- setup progress is current-run-scoped;
- setup targets remain frozen;
- the first brief gates entry and later music reads update in place;
- visible background events survive reload, preserve the seen cursor, and use quiet delivery by default;
- idle tabs produce zero repeating REST/Edge traffic;
- changed objects refresh without full-library or full-workspace reloads;
- setup copy is clear, accessible, and free of internal jargon;
- grounded outputs expose evidence and limitations according to their existing product contracts;
- existing completed workspaces and current outputs remain functional;
- Supabase usage remains below the internal review thresholds.
