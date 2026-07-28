# Production Reliability and Live Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make setup and background intelligence recoverable, make completed work appear without reload, and reduce idle and active Supabase resource use while preserving all existing production contracts.

**Architecture:** Reuse `workspace_setup_runs`, `source_sync_jobs`, `manager_synthesis_runs`, `manager_intelligence_packets`, `manager_outputs`, and `operating_events`. Remove broad polling first, then add focused list/detail loaders, one filtered `operating_events` Realtime channel, atomic leases and stage transitions, and a conditional allowlisted recovery worker. Realtime only invalidates focused resources; Postgres remains authoritative.

**Tech Stack:** React 18, TypeScript, Supabase Postgres/RLS/Realtime/Edge Functions, `pg_cron`, OpenAI Responses API, Vitest, Testing Library, PowerShell

**Approved design:** `docs/superpowers/specs/2026-07-28-production-reliability-live-workspace-design.md`

---

## Execution Rules

1. Work in a dedicated `codex/` worktree or branch.
2. Preserve the user's pre-existing `deno.lock` modification unless a task explicitly proves that the lockfile must change.
3. Do not deploy migrations, Edge Functions, secrets, schedules, or the frontend without explicit production approval.
4. Complete and verify each task before starting the next task.
5. Keep every migration additive and every reader compatible with legacy null reliability fields.
6. Do not reclaim legacy runs whose `workflow_version` or lease metadata is null.
7. Do not replace the existing `music-manager-read-v2` output schema or `finalize_music_manager_read_v2` behavior.
8. Do not run paid Chartmetric enrichment as a smoke test.
9. If a phase increases idle traffic, broad-query counts, duplicate active runs, or current-output duplicates, stop and roll back that phase.

## File and Responsibility Map

### New frontend units

- `src/services/resourceRequestCoordinator.ts` — workspace-scoped in-flight dedupe, invalidation, and stale-completion rejection.
- `src/services/activeRunFallback.ts` — visible/online exact-run fallback with bounded backoff.
- `src/services/workspaceLiveSync.ts` — event typing, classification, cursor catch-up, and one Realtime subscription.
- `src/app/useWorkspaceLiveSync.ts` — React lifecycle adapter for the live-sync service.
- `src/features/notifications/WorkspaceActivityCenter.tsx` — shared desktop/mobile quiet activity surface.
- `src/features/onboarding/SetupActivityScreen.tsx` — persisted setup-stage presentation and copy.

### New backend units

- `supabase/functions/_shared/durableWorkflow.ts` — lease-token claim/heartbeat helpers and retry classification.
- `supabase/functions/_shared/workflowErrors.ts` — stable public workflow failures and retryability mapping.
- `supabase/functions/_shared/workspaceEvents.ts` — one bounded operating-event/outbox writer.
- `supabase/functions/workflow-recovery/index.ts` — allowlisted, bounded recovery entry point.

### New migrations

- `supabase/migrations/20260728000200_production_reliability_v1.sql` — additive columns, partial indexes, RLS-compatible event fields, and atomic RPCs.
- `supabase/migrations/20260728000300_operating_events_realtime.sql` — idempotent Realtime publication.
- `supabase/migrations/20260728000400_todays_brief_and_mission_finalizers.sql` — transactional finalizers after the lease foundation is proven.
- `supabase/migrations/20260728000500_schedule_workflow_recovery.sql` — conditional schedule deployed last.

### New tests

- `src/resource-request-coordinator.test.ts`
- `src/active-run-fallback.test.ts`
- `src/workspace-live-sync.test.ts`
- `src/workspace-activity-center.test.tsx`
- `src/production-reliability-schema.test.ts`
- `src/workflow-recovery-function.test.ts`

### Existing compatibility boundaries

- `src/types/cleanProduction.ts`
- `src/types/productionApp.ts`
- `src/services/productionSupabase.ts`
- `src/services/fixtureRepositories.ts`
- `src/app/ProductionApp.tsx`
- `src/features/music/MusicScreens.tsx`
- `src/features/missions/MissionScreens.tsx`
- `src/features/manager/ManagerScreens.tsx`
- `supabase/functions/paid-workspace-setup/index.ts`
- `supabase/functions/spotify-catalog-bootstrap/index.ts`
- `supabase/functions/manager-artist-discovery/index.ts`
- `supabase/functions/generate-todays-brief/index.ts`
- `supabase/functions/generate-music-summary/index.ts`
- `supabase/functions/mission-genesis/index.ts`

## Phase A — Baseline and Cost Removal

### Task 1: Record the production baseline and protect completed contracts

**Files:**
- Create: `docs/operations/production-reliability-baseline.md`
- Modify: none
- Verify: existing focused suites

- [ ] **Step 1: Record repository and linked-project state**

Run:

```powershell
git status --short
git log -12 --oneline
npx supabase migration list --linked
npx supabase functions list --project-ref bbwbxmnanccwottrmkqu
```

Record the exact command output in `docs/operations/production-reliability-baseline.md`, including the pre-existing `deno.lock` state.

- [ ] **Step 2: Record current Supabase usage**

From the Supabase organization Usage page, record the current billing-period values for:

- egress;
- database size;
- Edge Function invocations;
- Realtime messages;
- Realtime peak connections.

Record the measurement time and these internal review thresholds:

```text
Egress: 2.5 GB
Database: 300 MB
Edge invocations: 100,000
Realtime messages: 250,000
Peak Realtime connections: 100
Idle repeating REST/Edge requests: 0
```

- [ ] **Step 3: Capture the request baseline**

In production browser DevTools, preserve the Network log and measure:

1. five visible idle minutes;
2. five hidden minutes;
3. one Music Manager Read;
4. one setup activity interval;
5. one Mission Genesis run.

Filter `rest/v1`, `functions/v1`, and WebSocket traffic. Record request counts and transferred bytes in the baseline document. Do not trigger paid enrichment.

- [ ] **Step 4: Run the baseline verification**

Run:

```powershell
npm test -- src/production-supabase-service.test.ts src/production-app-shell.test.tsx src/openai-music-summary-function.test.ts src/music-manager-read-v2-workflow.test.ts src/openai-todays-brief-function.test.ts src/openai-mission-genesis-function.test.ts src/paid-workspace-setup-function.test.ts --reporter=dot
npm run build
npx deno check --no-lock supabase/functions/generate-music-summary/index.ts supabase/functions/generate-todays-brief/index.ts supabase/functions/mission-genesis/index.ts supabase/functions/paid-workspace-setup/index.ts
```

Expected: record every exit code and failure verbatim. Do not call a pre-existing failure a regression later.

- [ ] **Step 5: Commit the baseline**

```powershell
git add -- docs/operations/production-reliability-baseline.md
git commit -m "docs: record production reliability baseline"
```

### Task 2: Add focused Music loading and remove full-library Manager Read polling

**Files:**
- Modify: `src/types/cleanProduction.ts`
- Modify: `src/services/productionSupabase.ts`
- Modify: `src/services/fixtureRepositories.ts`
- Modify: `src/features/music/MusicScreens.tsx`
- Test: `src/production-supabase-service.test.ts`
- Test: `src/production-app-shell.test.tsx`

- [ ] **Step 1: Write failing focused-loader tests**

Add repository tests requiring:

```ts
expect(repositories.music).toMatchObject({
  loadMusicList: expect.any(Function),
  loadMusicObject: expect.any(Function),
  loadManagerRun: expect.any(Function),
});
```

Assert:

- `loadMusicList()` excludes full `render_json`, workspace-wide evidence, assets, credits, splits, and 200-run history;
- `loadMusicObject(subjectId, subjectType)` filters account, workspace, artist, subject type, and subject ID;
- `loadManagerRun(runId)` filters the exact owner tuple and run ID;
- `startManagerRead()` calls one focused object reload, not `loadMusicLibrary()`;
- one active object refresh never calls `loadMusic()`.

- [ ] **Step 2: Verify RED**

```powershell
npm test -- src/production-supabase-service.test.ts src/production-app-shell.test.tsx --reporter=dot
```

Expected: failures show missing focused methods and the existing broad reload.

- [ ] **Step 3: Add the focused repository contract**

Add to `MusicRepository`:

```ts
loadMusicList(): Promise<MusicObjectViewModel[]>;
loadMusicObject(
  subjectId: string,
  subjectType: "music_item" | "music_project",
): Promise<MusicObjectViewModel | null>;
loadManagerRun(runId: string): Promise<{
  id: string;
  status: "queued" | "running" | "completed" | "completed_with_limits" | "failed" | "cancelled";
  subjectId: string;
  subjectType: "music_item" | "music_project";
  error?: string;
} | null>;
```

Keep `loadMusic()` as a temporary compatibility composition.

- [ ] **Step 4: Implement list/detail query separation**

In `productionSupabase.ts`:

- make `loadMusicList()` select identity, lifecycle, project membership, current-read presence, and latest subject-run status only;
- make `loadMusicObject()` issue subject-filtered detail queries for identifiers, assets, credits, splits, evidence, current output, and latest run;
- keep explicit columns and deterministic ordering;
- never select full render JSON for every list object.

Update fixtures with focused in-memory implementations.

- [ ] **Step 5: Replace broad post-start and active polling**

In `MusicScreens.tsx`:

- merge the `startManagerRead()` returned object by ID;
- remove the immediate second `onMusicChanged()` call;
- replace broad `onMusicChanged` with `onRefreshObject(id, type)`;
- preserve the previous current read while refresh is running or fails.

- [ ] **Step 6: Verify GREEN and cost behavior**

```powershell
npm test -- src/production-supabase-service.test.ts src/production-app-shell.test.tsx --reporter=dot
```

Expected: one requested object refresh performs no full-library load.

- [ ] **Step 7: Commit**

```powershell
git add -- src/types/cleanProduction.ts src/services/productionSupabase.ts src/services/fixtureRepositories.ts src/features/music/MusicScreens.tsx src/production-supabase-service.test.ts src/production-app-shell.test.tsx
git commit -m "perf: replace broad music read polling with focused loads"
```

### Task 3: Add a bounded exact-run fallback

**Files:**
- Create: `src/services/activeRunFallback.ts`
- Create: `src/active-run-fallback.test.ts`
- Modify: `src/features/music/MusicScreens.tsx`
- Modify: `src/services/productionSupabase.ts`

- [ ] **Step 1: Write failing timer tests**

Cover:

```ts
const fallback = createActiveRunFallback({
  delaysMs: [5_000, 10_000, 20_000, 30_000],
  deadlineMs: 6 * 60_000,
  isVisible: () => true,
  isOnline: () => true,
  check: vi.fn(),
  onTerminal: vi.fn(),
});
```

Assert:

- no overlapping `check` calls;
- delays cap at 30 seconds;
- hidden/offline state pauses;
- terminal state stops;
- deadline stops;
- `stop()` clears the timer;
- resuming performs one immediate exact check;
- payment confirmation stops after five minutes and exposes manual Retry;
- catalog synchronization uses one exact workspace-status check rather than a broad workspace reload.

- [ ] **Step 2: Verify RED**

```powershell
npm test -- src/active-run-fallback.test.ts --reporter=dot
```

Expected: module-not-found failure.

- [ ] **Step 3: Implement the fallback**

Export:

```ts
export type ActiveRunFallback = {
  start(): void;
  resume(): void;
  stop(): void;
};

export function createActiveRunFallback(input: {
  delaysMs: readonly number[];
  deadlineMs: number;
  isVisible(): boolean;
  isOnline(): boolean;
  check(): Promise<"active" | "terminal">;
  onTerminal(): void;
  onError?(error: unknown): void;
}): ActiveRunFallback;
```

Use recursive `setTimeout` after `check()` settles. Do not use `setInterval`.

- [ ] **Step 4: Use exact-run/object checks while legacy Realtime is absent**

Wire the fallback to `loadManagerRun(runId)` and `loadMusicObject(subjectId, subjectType)`. This is the temporary safety path until Task 9 enables Realtime. It must remain bounded after Realtime ships.

Replace the payment-return `setInterval(3000)` with a visible/online 3/6/12/20/30-second bounded fallback and an explicit Retry action after five minutes. Replace catalog `setInterval(4000)` with exact status backoff until Task 9 supplies its terminal event.

- [ ] **Step 5: Verify**

```powershell
npm test -- src/active-run-fallback.test.ts src/production-app-shell.test.tsx --reporter=dot
```

- [ ] **Step 6: Commit**

```powershell
git add -- src/services/activeRunFallback.ts src/active-run-fallback.test.ts src/features/music/MusicScreens.tsx src/services/productionSupabase.ts src/production-app-shell.test.tsx
git commit -m "feat: add bounded active run fallback"
```

### Task 4: Split heavy Desk, Mission, Conversation, and Evidence loading

**Files:**
- Modify: `src/types/cleanProduction.ts`
- Modify: `src/services/productionSupabase.ts`
- Modify: `src/services/fixtureRepositories.ts`
- Modify: `src/app/ProductionApp.tsx`
- Modify: `src/features/missions/MissionScreens.tsx`
- Modify: `src/features/manager/ManagerScreens.tsx`
- Test: `src/production-supabase-service.test.ts`
- Test: `src/production-app-shell.test.tsx`

- [ ] **Step 1: Write failing repository contract tests**

Require:

```ts
desk.loadBrief();
desk.loadActivity();
missions.loadMissionList();
missions.loadMission(missionId);
manager.loadConversationList();
manager.loadConversation(conversationId);
```

Assert:

- Desk activity does not reload current brief or sync jobs;
- mission list does not fetch checkpoints/tasks/steps/results/events/memories/documents;
- one mission detail filters child rows server-side by mission/task IDs;
- conversation list does not fetch all messages;
- one conversation detail filters by conversation ID;
- evidence is not loaded until its drawer opens.

- [ ] **Step 2: Verify RED**

```powershell
npm test -- src/production-supabase-service.test.ts src/production-app-shell.test.tsx --reporter=dot
```

- [ ] **Step 3: Add compatibility interfaces**

Add focused methods while retaining:

```ts
loadDesk();
loadMissions();
loadConversations();
```

as temporary compositions for unaffected callers.

- [ ] **Step 4: Implement focused queries**

In `productionSupabase.ts`:

- cap activity at 20 events;
- load the current brief separately;
- load mission summaries first and one mission graph on open;
- load conversation summaries first and one message history on open;
- reuse existing task document/draft helper boundaries;
- apply account/workspace/artist filters on every row-ID lookup.

- [ ] **Step 5: Make detail surfaces lazy**

In `ProductionApp.tsx` and feature screens:

- load conversation list on Manager Office entry;
- load conversation detail on selection;
- load mission detail when its room opens;
- load evidence when the evidence drawer opens;
- preserve selected IDs during refresh;
- use `aria-busy` on the targeted detail surface.

- [ ] **Step 6: Verify**

```powershell
npm test -- src/production-supabase-service.test.ts src/production-app-shell.test.tsx src/mission-workspace-simplification.test.tsx --reporter=dot
```

- [ ] **Step 7: Commit**

```powershell
git add -- src/types/cleanProduction.ts src/services/productionSupabase.ts src/services/fixtureRepositories.ts src/app/ProductionApp.tsx src/features/missions/MissionScreens.tsx src/features/manager/ManagerScreens.tsx src/production-supabase-service.test.ts src/production-app-shell.test.tsx
git commit -m "perf: lazy load workspace detail resources"
```

### Task 5: Add a small reusable request coordinator

**Files:**
- Create: `src/services/resourceRequestCoordinator.ts`
- Create: `src/resource-request-coordinator.test.ts`
- Modify: `src/app/ProductionApp.tsx`

- [ ] **Step 1: Write failing coordinator tests**

Test:

- concurrent reads for the same workspace/resource key share one promise;
- invalidation during an in-flight read schedules at most one follow-up;
- a different workspace never receives cached data;
- a generation change ignores an old completion;
- `clearWorkspace()` cancels/invalidates all owned entries.

- [ ] **Step 2: Verify RED**

```powershell
npm test -- src/resource-request-coordinator.test.ts --reporter=dot
```

- [ ] **Step 3: Implement the coordinator**

Export:

```ts
export type ResourceKey =
  | "workspace"
  | "desk-brief"
  | "activity"
  | "music-list"
  | `music-object:${string}`
  | "mission-list"
  | `mission:${string}`
  | "conversation-list"
  | `conversation:${string}`;

export function createResourceRequestCoordinator(): {
  load<T>(workspaceId: string, key: ResourceKey, loader: () => Promise<T>): Promise<T>;
  invalidate(workspaceId: string, key: ResourceKey): void;
  clearWorkspace(workspaceId: string): void;
};
```

Keep it in memory only. Do not add Redux, Zustand, or TanStack Query.

- [ ] **Step 4: Route existing reload callbacks through it**

Use the coordinator for Desk, music, mission, conversation, activity, and setup catch-up loads. Keep state in `ProductionApp`.

- [ ] **Step 5: Verify**

```powershell
npm test -- src/resource-request-coordinator.test.ts src/production-app-shell.test.tsx --reporter=dot
```

- [ ] **Step 6: Commit**

```powershell
git add -- src/services/resourceRequestCoordinator.ts src/resource-request-coordinator.test.ts src/app/ProductionApp.tsx src/production-app-shell.test.tsx
git commit -m "refactor: coordinate workspace resource requests"
```

## Phase B — Additive Reliability and Event Schema

### Task 6: Add reliability metadata and atomic lease RPCs

**Files:**
- Create: `supabase/migrations/20260728000200_production_reliability_v1.sql`
- Create: `src/production-reliability-schema.test.ts`
- Modify: `src/music-manager-read-v2-schema.test.ts`

- [ ] **Step 1: Write failing migration contract tests**

Require additive fields on the appropriate tables:

```text
workflow_version
input_refs
scope_key
idempotency_key
attempt_count
max_attempts
available_at
lease_token
lease_expires_at
heartbeat_at
last_attempt_started_at
```

`workspace_setup_runs` must reuse `retry_count` rather than adding another setup attempt counter.

`source_sync_jobs` must also add:

```text
subject_type
subject_id
target_payload
workspace_setup_run_id
```

Require:

- partial recovery indexes matching `status`, `available_at`, and `lease_expires_at`;
- active source-job uniqueness by workspace/job type/scope;
- active Today's Brief uniqueness by workspace/classification/scope;
- Mission Genesis initial and continuation scope uniqueness;
- preservation of the existing Music Manager Read active index.

- [ ] **Step 2: Add failing RPC assertions**

Require these functions with locked `search_path` and service-role-only execution:

```sql
claim_manager_synthesis_run(run_id uuid, lease_seconds integer)
claim_source_sync_job(job_id uuid, lease_seconds integer)
claim_workspace_setup_stage(setup_run_id uuid, stage_key text, expected_status text, lease_seconds integer)
heartbeat_manager_synthesis_run(run_id uuid, current_lease_token uuid, lease_seconds integer)
heartbeat_source_sync_job(job_id uuid, current_lease_token uuid, lease_seconds integer)
merge_workspace_setup_stage(setup_run_id uuid, stage_key text, current_lease_token uuid, stage_patch jsonb)
reap_expired_workflows(batch_size integer)
```

Assert setup stage updates use `jsonb_set` on one path and stale lease tokens cannot mutate terminal state.

- [ ] **Step 3: Verify RED**

```powershell
npm test -- src/production-reliability-schema.test.ts src/music-manager-read-v2-schema.test.ts --reporter=dot
```

- [ ] **Step 4: Implement the additive migration**

Rules:

- new columns are nullable or have backward-safe defaults;
- no existing status enum or output schema changes;
- unique indexes exclude legacy null scope/idempotency values;
- recovery RPCs process only explicit non-null `workflow_version`;
- public, anon, and authenticated claim/reap execution is revoked;
- completed historical rows are not rewritten.

- [ ] **Step 5: Exercise real local database behavior**

```powershell
npx supabase db reset
npx supabase db lint --local --level error
```

Run SQL transactions proving:

- two claims yield one lease owner;
- the old token cannot heartbeat or complete after reclaim;
- a valid heartbeat prevents reaping;
- attempts exhaust at `max_attempts`;
- two setup-stage updates preserve both JSON paths.

- [ ] **Step 6: Verify GREEN**

```powershell
npm test -- src/production-reliability-schema.test.ts src/music-manager-read-v2-schema.test.ts --reporter=dot
npx supabase db lint --local --level error
```

- [ ] **Step 7: Commit**

```powershell
git add -- supabase/migrations/20260728000200_production_reliability_v1.sql src/production-reliability-schema.test.ts src/music-manager-read-v2-schema.test.ts
git commit -m "feat: add durable workflow leases and claims"
```

### Task 7: Turn operating events into the narrow workspace outbox

**Files:**
- Modify: `supabase/migrations/20260728000200_production_reliability_v1.sql`
- Create: `supabase/migrations/20260728000300_operating_events_realtime.sql`
- Create: `supabase/functions/_shared/workspaceEvents.ts`
- Modify: `src/production-reliability-schema.test.ts`
- Create: `src/workspace-live-sync.test.ts`

- [ ] **Step 1: Write failing event schema tests**

Require additive `operating_events` fields:

```text
workspace_setup_run_id uuid
dedupe_key text
display_mode text
refresh_scope text[]
recipient_user_id uuid
```

Require:

- `display_mode` is null or `activity`, `toast`, `action`;
- unique non-null `(artist_workspace_id, dedupe_key)`;
- workspace/run/cursor index on `(artist_workspace_id, created_at, id)`;
- existing account-member read policy remains;
- setup-run foreign key uses `on delete set null`.

- [ ] **Step 2: Write failing publication and helper tests**

Require an idempotent publication migration for only `operating_events`.

Define:

```ts
export type WorkspaceEventInput = {
  accountId: string;
  artistWorkspaceId: string;
  artistId: string;
  eventType: string;
  summary: string;
  targetType?: string;
  targetId?: string;
  workspaceSetupRunId?: string;
  dedupeKey?: string;
  displayMode?: "activity" | "toast" | "action";
  refreshScope?: string[];
  recipientUserId?: string;
  payload?: Record<string, unknown>;
};
```

Assert payload and summary bounds and conflict-safe dedupe behavior.

- [ ] **Step 3: Verify RED**

```powershell
npm test -- src/production-reliability-schema.test.ts src/workspace-live-sync.test.ts --reporter=dot
```

- [ ] **Step 4: Implement event migration and writer**

`writeWorkspaceEvent(db, input)` must:

- sanitize and bound visible summaries;
- cap refresh scopes;
- omit internal provider bodies;
- insert once by dedupe key;
- return the persisted event ID;
- leave audit-only events with null `display_mode`.

- [ ] **Step 5: Verify local publication and RLS**

```powershell
npx supabase db reset
npx supabase db lint --local --level error
npm test -- src/production-reliability-schema.test.ts src/workspace-live-sync.test.ts --reporter=dot
```

- [ ] **Step 6: Commit**

```powershell
git add -- supabase/migrations/20260728000200_production_reliability_v1.sql supabase/migrations/20260728000300_operating_events_realtime.sql supabase/functions/_shared/workspaceEvents.ts src/production-reliability-schema.test.ts src/workspace-live-sync.test.ts
git commit -m "feat: add workspace event outbox"
```

## Phase C — Live Workspace and Setup Experience

### Task 8: Implement event classification, cursor catch-up, and one subscription

**Files:**
- Create: `src/services/workspaceLiveSync.ts`
- Modify: `src/workspace-live-sync.test.ts`
- Modify: `src/lib/supabaseClient.ts`
- Modify: `src/supabase-client.test.ts`

- [ ] **Step 1: Write failing live-sync behavior tests**

Cover:

- one channel named by workspace;
- one filtered `INSERT` listener on `public.operating_events`;
- small selected payload fields;
- event-to-resource classification;
- burst coalescing at approximately 250 ms;
- duplicate/out-of-order event dedupe by `(createdAt, id)`;
- catch-up page size 50 and maximum three pages;
- old-workspace events ignored after switching;
- unsubscribe on stop/unmount.

- [ ] **Step 2: Verify RED**

```powershell
npm test -- src/workspace-live-sync.test.ts src/supabase-client.test.ts --reporter=dot
```

- [ ] **Step 3: Implement pure event classification**

Export:

```ts
export type WorkspaceInvalidation =
  | { scope: "workspace" }
  | { scope: "desk-brief" }
  | { scope: "activity" }
  | { scope: "music-list" }
  | { scope: "music-object"; id: string }
  | { scope: "mission-list" }
  | { scope: "mission"; id: string }
  | { scope: "conversation-list" }
  | { scope: "conversation"; id: string };

export function classifyWorkspaceEvent(event: WorkspaceOperatingEvent): WorkspaceInvalidation[];
export function mergeWorkspaceInvalidations(
  current: WorkspaceInvalidation[],
  next: WorkspaceInvalidation[],
): WorkspaceInvalidation[];
```

Prefer explicit `refresh_scope`; use event-type mapping only for legacy events.

- [ ] **Step 4: Implement cursor catch-up**

Use local storage key:

```ts
ordersounds.activityCursor.v1:${userId}:${workspaceId}
```

Store only:

```ts
{ createdAt: string; id: string }
```

When more than 150 events exist, run one bounded summary reconciliation and advance the cursor. Do not loop indefinitely.

- [ ] **Step 5: Implement the single subscription**

Reuse the application Supabase client. Do not create a second browser client inside `ProductionApp`.

- [ ] **Step 6: Verify**

```powershell
npm test -- src/workspace-live-sync.test.ts src/supabase-client.test.ts --reporter=dot
```

- [ ] **Step 7: Commit**

```powershell
git add -- src/services/workspaceLiveSync.ts src/workspace-live-sync.test.ts src/lib/supabaseClient.ts src/supabase-client.test.ts
git commit -m "feat: subscribe to workspace activity events"
```

### Task 9: Add the React live-sync adapter and economical fallback

**Files:**
- Create: `src/app/useWorkspaceLiveSync.ts`
- Modify: `src/app/ProductionApp.tsx`
- Modify: `src/services/managerConversationStream.ts`
- Modify: `src/production-app-shell.test.tsx`
- Modify: `src/workspace-live-sync.test.ts`

- [ ] **Step 1: Write failing lifecycle tests**

Require:

- no fixture-mode subscription;
- one production subscription per active workspace;
- one catch-up on `SUBSCRIBED`, `online`, and hidden-to-visible;
- no fetches while hidden/offline;
- unsubscribe after prolonged hidden state and on unmount;
- active exact-run fallback at 5/10/20/30 seconds only when channel health is degraded;
- terminal signal stops fallback;
- Manager SSE refresh hints use the same invalidation callback.

- [ ] **Step 2: Verify RED**

```powershell
npm test -- src/workspace-live-sync.test.ts src/production-app-shell.test.tsx --reporter=dot
```

- [ ] **Step 3: Implement the hook**

The hook accepts:

```ts
useWorkspaceLiveSync({
  enabled,
  client,
  userId,
  workspaceId,
  coordinator,
  onInvalidations,
  activeRuns,
});
```

Use one environment gate during rollout:

```ts
const liveUpdatesEnabled =
  import.meta.env.VITE_WORKSPACE_LIVE_UPDATES === "true";
```

When enabled, legacy broad intervals must be disabled. Never run both.

- [ ] **Step 4: Connect focused reloads**

Map invalidations to:

- `loadBrief`;
- `loadActivity`;
- `loadMusicList`;
- `loadMusicObject`;
- `loadMissionList`;
- `loadMission`;
- `loadConversationList`;
- `loadConversation`;
- workspace/setup status.

Do not reload unrelated scopes.

- [ ] **Step 5: Add user-safe live status**

Visible status copy is limited to:

```text
Up to date
Catching up
Offline — updates resume when you're back
Updates delayed — Retry
```

Do not expose Supabase, Realtime, polling, packets, or provider internals.

- [ ] **Step 6: Verify**

```powershell
npm test -- src/workspace-live-sync.test.ts src/production-app-shell.test.tsx src/manager-conversation-stream.test.ts --reporter=dot
```

- [ ] **Step 7: Commit**

```powershell
git add -- src/app/useWorkspaceLiveSync.ts src/app/ProductionApp.tsx src/services/managerConversationStream.ts src/production-app-shell.test.tsx src/workspace-live-sync.test.ts
git commit -m "feat: keep workspace state live without broad polling"
```

### Task 10: Build the shared quiet Activity Center

**Files:**
- Create: `src/features/notifications/WorkspaceActivityCenter.tsx`
- Create: `src/workspace-activity-center.test.tsx`
- Modify: `src/app/ProductionApp.tsx`
- Modify: `src/design-system/components.tsx`
- Modify: `src/production-app-shell.test.tsx`

- [ ] **Step 1: Write failing notification behavior tests**

Cover:

- `activity` updates the list without a toast;
- `toast` creates one restrained transient notice plus durable history;
- `action` appears in Needs You;
- badge counts visible events after the saved cursor;
- opening the center advances the cursor idempotently;
- reload restores the cursor and derives the correct count;
- event ID is the React key;
- deep links target the exact object;
- desktop and mobile use the same component/data;
- one event does not reload unrelated repositories.

- [ ] **Step 2: Write failing accessibility tests**

Require:

- Radix dialog/sheet focus containment;
- Escape closes;
- close returns focus to trigger;
- trigger label includes unread count;
- one debounced polite status announcement;
- errors use `role="alert"`;
- reduced motion disables update animation.

- [ ] **Step 3: Verify RED**

```powershell
npm test -- src/workspace-activity-center.test.tsx src/production-app-shell.test.tsx --reporter=dot
```

- [ ] **Step 4: Implement the shared component**

Use existing Radix primitives. Render:

```text
Needs you
Recently completed
Background activity
```

Initially show 20 events. Load older history only after explicit user action.

- [ ] **Step 5: Replace the mobile-only sheet**

Delete the local `MobileNotificationSheet` implementation after desktop and mobile both use `WorkspaceActivityCenter`.

Replace:

```ts
notificationCount={mobileAttentionCount + movement.length}
```

with the cursor-derived visible-event count.

- [ ] **Step 6: Verify**

```powershell
npm test -- src/workspace-activity-center.test.tsx src/production-app-shell.test.tsx src/design-system/workspace-tabs.test.tsx --reporter=dot
```

- [ ] **Step 7: Commit**

```powershell
git add -- src/features/notifications/WorkspaceActivityCenter.tsx src/workspace-activity-center.test.tsx src/app/ProductionApp.tsx src/design-system/components.tsx src/production-app-shell.test.tsx
git commit -m "feat: add quiet workspace activity center"
```

### Task 11: Rehydrate setup and replace the generated-looking activity screen

**Files:**
- Create: `src/features/onboarding/SetupActivityScreen.tsx`
- Modify: `src/features/onboarding/OnboardingScreens.tsx`
- Modify: `src/app/ProductionApp.tsx`
- Modify: `src/types/productionApp.ts`
- Modify: `src/production-app-shell.test.tsx`
- Modify: `src/onboarding-responsive.test.tsx`
- Modify: `src/design-system/app-thinking-orb.test.tsx`

- [ ] **Step 1: Write failing setup rehydration tests**

Cover reload/remount at:

- queued;
- running discovery;
- completed with limits;
- failed;
- brief ready with music reads running;
- completed.

Assert the active setup run, not historical events, controls the screen.

- [ ] **Step 2: Write failing product and accessibility tests**

Require:

```text
Preparing your workspace
Your Manager is reviewing your music and preparing your first brief. This work will continue if you close this page.
Your workspace is ready
Your workspace is ready. Some music insights are still being prepared.
Setup paused while preparing your workspace. Your completed work is safe.
```

Assert:

- no `Desk HQ`;
- no provider/function/model names;
- no raw event parsing;
- no broken `â` encoding;
- one status icon per row;
- no fake percentage;
- one polite stage announcement;
- reduced-motion behavior.

- [ ] **Step 3: Verify RED**

```powershell
npm test -- src/production-app-shell.test.tsx src/onboarding-responsive.test.tsx src/design-system/app-thinking-orb.test.tsx --reporter=dot
```

- [ ] **Step 4: Implement stable stage mapping**

Map persisted internal stages to:

```ts
const setupStageCopy = {
  spotify_connected: "Connecting your music",
  catalog_bootstrap: "Understanding your catalogue",
  manager_discovery: "Learning about your artist profile",
  setup_brief: "Writing your first Manager brief",
  music_reads: "Preparing Manager Reads for your selected music",
} as const;
```

Do not parse `operating_events.summary`.

- [ ] **Step 5: Replace local-only routing**

On mount/reconnect:

- load the current setup run;
- show its persisted stage;
- enter the workspace when the initial brief is ready;
- continue music reads in the background;
- preserve failed-stage retry.

Remove the unbounded `generateContextualSetup` browser loop and the two-second discovery-history interval.

- [ ] **Step 6: Verify**

```powershell
npm test -- src/production-app-shell.test.tsx src/onboarding-responsive.test.tsx src/design-system/app-thinking-orb.test.tsx --reporter=dot
```

- [ ] **Step 7: Commit**

```powershell
git add -- src/features/onboarding/SetupActivityScreen.tsx src/features/onboarding/OnboardingScreens.tsx src/app/ProductionApp.tsx src/types/productionApp.ts src/production-app-shell.test.tsx src/onboarding-responsive.test.tsx src/design-system/app-thinking-orb.test.tsx
git commit -m "refactor: rehydrate and simplify workspace setup"
```

## Phase D — Durable Workflow Writers

### Task 12: Integrate leases into setup, catalog, and discovery

**Files:**
- Create: `supabase/functions/_shared/durableWorkflow.ts`
- Create: `supabase/functions/_shared/workflowErrors.ts`
- Modify: `supabase/functions/paid-workspace-setup/index.ts`
- Modify: `supabase/functions/billing-status/index.ts`
- Modify: `supabase/functions/connect-spotify-artist/index.ts`
- Modify: `supabase/functions/spotify-catalog-bootstrap/index.ts`
- Modify: `supabase/functions/manager-artist-discovery/index.ts`
- Modify: `src/paid-workspace-setup-function.test.ts`
- Modify: `src/spotify-catalog-bootstrap-function.test.ts`
- Modify: `src/manager-artist-discovery-function.test.ts`

- [ ] **Step 1: Write failing lease and replay tests**

Require:

- setup stage claimed before dispatch;
- a second caller receives current durable state without dispatch;
- stage updates use the lease token;
- stale workers cannot complete/fail;
- source jobs have stable scope and active uniqueness;
- `completed_with_limits` survives reconciliation;
- null legacy leases are not reclaimed;
- user-facing failures contain stable code/message/retryability and exclude raw provider/database text.

- [ ] **Step 2: Verify RED**

```powershell
npm test -- src/paid-workspace-setup-function.test.ts src/spotify-catalog-bootstrap-function.test.ts src/manager-artist-discovery-function.test.ts --reporter=dot
```

- [ ] **Step 3: Implement shared lease helpers**

Export:

```ts
export type DurableLease = {
  token: string;
  expiresAt: string;
  attempt: number;
};

export function nextAvailableAt(attempt: number, now?: Date): string;
```

In `workflowErrors.ts`, export:

```ts
export type PublicWorkflowFailure = {
  code: string;
  message: string;
  retryable: boolean;
};

export function publicWorkflowFailure(error: unknown): PublicWorkflowFailure;
```

RPC calls, not local timestamps, own claims.

The public failure projection must never contain provider response bodies, SQL details, secrets, raw packet JSON, or internal stack text. Restricted diagnostics remain in function logs.

- [ ] **Step 4: Replace setup JSON read/merge/write**

Use `claim_workspace_setup_stage` and `merge_workspace_setup_stage` for discovery, brief, and music-read updates. Preserve completed stages and actual limited status.

- [ ] **Step 5: Replace `waitUntil`-only source continuation**

Persist source jobs before opportunistic dispatch. `waitUntil` may call the worker fast path, but a lost dispatch leaves a queued recoverable row.

- [ ] **Step 6: Verify**

```powershell
npm test -- src/paid-workspace-setup-function.test.ts src/spotify-catalog-bootstrap-function.test.ts src/manager-artist-discovery-function.test.ts --reporter=dot
npx deno check --no-lock supabase/functions/paid-workspace-setup/index.ts supabase/functions/connect-spotify-artist/index.ts supabase/functions/spotify-catalog-bootstrap/index.ts supabase/functions/manager-artist-discovery/index.ts
```

- [ ] **Step 7: Commit**

```powershell
git add -- supabase/functions/_shared/durableWorkflow.ts supabase/functions/_shared/workflowErrors.ts supabase/functions/paid-workspace-setup/index.ts supabase/functions/billing-status/index.ts supabase/functions/connect-spotify-artist/index.ts supabase/functions/spotify-catalog-bootstrap/index.ts supabase/functions/manager-artist-discovery/index.ts src/paid-workspace-setup-function.test.ts src/spotify-catalog-bootstrap-function.test.ts src/manager-artist-discovery-function.test.ts
git commit -m "feat: lease setup and discovery work"
```

### Task 13: Freeze discovery targets and make tool side effects replay-safe

**Files:**
- Modify: `supabase/functions/manager-artist-discovery/index.ts`
- Modify: `supabase/functions/_shared/manager-agent/discoveryTools.ts`
- Modify: `supabase/functions/_shared/supabaseCatalogRepository.ts`
- Modify: `supabase/functions/chartmetric-artist-enrichment/index.ts`
- Modify: `supabase/functions/chartmetric-track-enrichment/index.ts`
- Modify: `supabase/functions/chartmetric-project-enrichment/index.ts`
- Modify: `src/manager-artist-discovery-function.test.ts`
- Modify: `src/manager-agent-loop.test.ts`
- Modify: `src/chartmetric-artist-enrichment-function.test.ts`
- Modify: `src/chartmetric-track-enrichment-function.test.ts`
- Modify: `src/chartmetric-project-enrichment-function.test.ts`

- [ ] **Step 1: Write failing frozen-target tests**

Require one `manager_synthesis_runs` row classified `manager_artist_discovery_v1` with context containing:

```ts
{
  setupRunId,
  selectedMusicItemIds,
  selectedMusicProjectId,
  selectionAlgorithmVersion,
  selectedAt,
}
```

Assert retry uses the stored IDs even when later catalog fixtures differ.

- [ ] **Step 2: Write failing side-effect replay tests**

Require:

- one `manager_run_actions` row per tool call key;
- completed calls return their persisted result on replay;
- evidence/snapshot writes dedupe by source snapshot and subject;
- paid calls run only for unfinished frozen targets;
- cached successful snapshots are reused;
- heartbeats occur before and after provider/OpenAI calls, not on a timer.

- [ ] **Step 3: Verify RED**

```powershell
npm test -- src/manager-artist-discovery-function.test.ts src/manager-agent-loop.test.ts src/chartmetric-artist-enrichment-function.test.ts src/chartmetric-track-enrichment-function.test.ts src/chartmetric-project-enrichment-function.test.ts --reporter=dot
```

- [ ] **Step 4: Implement frozen context and action ledger**

Persist the run and frozen target context before the first tool executes. Reuse `manager_run_actions`; do not create a new tool-call table.

- [ ] **Step 5: Emit scoped workspace events**

Use `writeWorkspaceEvent` for stage transitions with:

```ts
{
  workspaceSetupRunId: setupRunId,
  dedupeKey: `${runId}:${stage}:${status}`,
  refreshScope: ["activity", "workspace"],
}
```

- [ ] **Step 6: Verify**

```powershell
npm test -- src/manager-artist-discovery-function.test.ts src/manager-agent-loop.test.ts src/chartmetric-artist-enrichment-function.test.ts src/chartmetric-track-enrichment-function.test.ts src/chartmetric-project-enrichment-function.test.ts --reporter=dot
npx deno check --no-lock supabase/functions/manager-artist-discovery/index.ts
```

- [ ] **Step 7: Commit**

```powershell
git add -- supabase/functions/manager-artist-discovery/index.ts supabase/functions/_shared/manager-agent/discoveryTools.ts supabase/functions/_shared/supabaseCatalogRepository.ts supabase/functions/chartmetric-artist-enrichment/index.ts supabase/functions/chartmetric-track-enrichment/index.ts supabase/functions/chartmetric-project-enrichment/index.ts src/manager-artist-discovery-function.test.ts src/manager-agent-loop.test.ts src/chartmetric-artist-enrichment-function.test.ts src/chartmetric-track-enrichment-function.test.ts src/chartmetric-project-enrichment-function.test.ts
git commit -m "fix: freeze and replay discovery targets safely"
```

### Task 14: Make Today's Brief a durable run with atomic activation

**Files:**
- Create: `supabase/migrations/20260728000400_todays_brief_and_mission_finalizers.sql`
- Modify: `supabase/functions/generate-todays-brief/index.ts`
- Modify: `supabase/functions/_shared/openaiTodaysBrief.ts`
- Modify: `src/services/productionSupabase.ts`
- Modify: `src/openai-todays-brief-function.test.ts`
- Modify: `src/production-supabase-service.test.ts`
- Modify: `src/production-reliability-schema.test.ts`

- [ ] **Step 1: Write failing durable-response tests**

Require the endpoint to return:

```ts
{ status: "processing", runId: string }
```

after persisting:

- classification;
- generation mode;
- setup-run ID;
- evidence cutoff;
- packet/target references;
- idempotency and scope keys.

- [ ] **Step 2: Write failing finalizer tests**

Require `finalize_todays_brief_v1` to atomically:

- validate current lease token;
- activate the staged packet/output;
- retire the previous current output;
- complete the run;
- complete usage with actual provider request/token counters;
- insert one deduped terminal event.

Conflicting replay must fail; exact replay must return the same output.

- [ ] **Step 3: Verify RED**

```powershell
npm test -- src/openai-todays-brief-function.test.ts src/production-supabase-service.test.ts src/production-reliability-schema.test.ts --reporter=dot
```

- [ ] **Step 4: Implement staged generation and finalization**

Upsert packet, output, evidence links, and memory by `created_from_run_id`. Do not retire the previous brief until finalization succeeds.

- [ ] **Step 5: Update the client**

Use the same active-run/live invalidation contract as Manager Read. Keep exact-run fallback for degraded Realtime. Remove synchronous assumptions from setup and manual refresh.

- [ ] **Step 6: Verify**

```powershell
npm test -- src/openai-todays-brief-function.test.ts src/production-supabase-service.test.ts src/production-app-shell.test.tsx src/production-reliability-schema.test.ts --reporter=dot
npx deno check --no-lock supabase/functions/generate-todays-brief/index.ts
```

- [ ] **Step 7: Commit**

```powershell
git add -- supabase/migrations/20260728000400_todays_brief_and_mission_finalizers.sql supabase/functions/generate-todays-brief/index.ts supabase/functions/_shared/openaiTodaysBrief.ts src/services/productionSupabase.ts src/openai-todays-brief-function.test.ts src/production-supabase-service.test.ts src/production-reliability-schema.test.ts src/production-app-shell.test.tsx
git commit -m "feat: make todays brief activation durable"
```

### Task 15: Remove setup music-wave busy polling

**Files:**
- Modify: `supabase/functions/generate-todays-brief/index.ts`
- Modify: `supabase/functions/generate-music-summary/index.ts`
- Modify: `supabase/functions/paid-workspace-setup/index.ts`
- Modify: `src/openai-todays-brief-function.test.ts`
- Modify: `src/openai-music-summary-function.test.ts`
- Modify: `src/paid-workspace-setup-function.test.ts`

- [ ] **Step 1: Write failing parent/child lifecycle tests**

Require:

- full target tuples persisted before the first dispatch;
- exact returned run ID merged independently per target;
- no `waitForSetupMusicReadRuns`;
- child terminalization merges into the owning setup run;
- all success becomes `completed`;
- any exhausted/failed/cancelled child becomes `completed_with_limits`;
- workspace access never depends on this stage;
- recovery can reconcile a missed child event.

- [ ] **Step 2: Verify RED**

```powershell
npm test -- src/openai-todays-brief-function.test.ts src/openai-music-summary-function.test.ts src/paid-workspace-setup-function.test.ts --reporter=dot
```

- [ ] **Step 3: Persist-before-dispatch**

Write:

```ts
type SetupMusicReadTargetState = {
  subjectType: "music_item" | "music_project";
  subjectId: string;
  runId?: string;
  status: "queued" | "running" | "completed" | "completed_with_limits" | "failed";
};
```

to the setup stage before invoking children.

- [ ] **Step 4: Reconcile on child terminalization**

After Music Manager Read finalization, write one terminal workspace event and merge the child status into its parent setup run when a parent run ID is present.

- [ ] **Step 5: Delete backend busy polling**

Remove the two-second/three-minute loop and its timeout constants. Recovery owns missed reconciliation.

- [ ] **Step 6: Verify**

```powershell
npm test -- src/openai-todays-brief-function.test.ts src/openai-music-summary-function.test.ts src/paid-workspace-setup-function.test.ts src/production-app-shell.test.tsx --reporter=dot
npx deno check --no-lock supabase/functions/generate-todays-brief/index.ts supabase/functions/generate-music-summary/index.ts supabase/functions/paid-workspace-setup/index.ts
```

- [ ] **Step 7: Commit**

```powershell
git add -- supabase/functions/generate-todays-brief/index.ts supabase/functions/generate-music-summary/index.ts supabase/functions/paid-workspace-setup/index.ts src/openai-todays-brief-function.test.ts src/openai-music-summary-function.test.ts src/paid-workspace-setup-function.test.ts src/production-app-shell.test.tsx
git commit -m "perf: reconcile setup reads without busy polling"
```

### Task 16: Add heartbeat-based Music Manager Read recovery without changing its output

**Files:**
- Modify: `supabase/functions/generate-music-summary/index.ts`
- Modify: `supabase/migrations/20260728000200_production_reliability_v1.sql`
- Modify: `src/openai-music-summary-function.test.ts`
- Modify: `src/music-manager-read-v2-schema.test.ts`
- Modify: `src/music-manager-read-v2-workflow.test.ts`

- [ ] **Step 1: Write failing recovery tests**

Require:

- staleness uses `lease_expires_at`, not `created_at`;
- heartbeat-protected work is not reaped;
- a stale token cannot finalize;
- exact finalizer replay remains valid;
- conflicting replay fails;
- last good output remains current while refresh retries/fails;
- existing strict single-surface render contract is unchanged.

- [ ] **Step 2: Verify RED**

```powershell
npm test -- src/openai-music-summary-function.test.ts src/music-manager-read-v2-schema.test.ts src/music-manager-read-v2-workflow.test.ts --reporter=dot
```

- [ ] **Step 3: Claim and heartbeat around expensive boundaries**

Heartbeat before and after Chartmetric/OpenAI/finalization boundaries. Do not create a timer heartbeat.

- [ ] **Step 4: Remove next-request cleanup**

The recovery worker owns expired-run requeue/failure. A new user request reuses a valid active run and does not fail it merely because it is older than five minutes.

- [ ] **Step 5: Verify**

```powershell
npm test -- src/openai-music-summary-function.test.ts src/music-manager-read-v2-schema.test.ts src/music-manager-read-v2-workflow.test.ts src/production-supabase-service.test.ts --reporter=dot
npx deno check --no-lock supabase/functions/generate-music-summary/index.ts
```

- [ ] **Step 6: Commit**

```powershell
git add -- supabase/functions/generate-music-summary/index.ts supabase/migrations/20260728000200_production_reliability_v1.sql src/openai-music-summary-function.test.ts src/music-manager-read-v2-schema.test.ts src/music-manager-read-v2-workflow.test.ts src/production-supabase-service.test.ts
git commit -m "fix: recover music reads from heartbeat state"
```

### Task 17: Make Mission Genesis idempotent and transactionally replay-safe

**Files:**
- Modify: `supabase/migrations/20260728000400_todays_brief_and_mission_finalizers.sql`
- Modify: `supabase/functions/mission-genesis/index.ts`
- Modify: `supabase/functions/_shared/missionGraphPersistence.ts`
- Modify: `src/services/productionSupabase.ts`
- Modify: `src/openai-mission-genesis-function.test.ts`
- Modify: `src/mission-pattern-registry.test.ts`
- Modify: `src/production-supabase-service.test.ts`

- [ ] **Step 1: Write failing idempotency tests**

Require:

- initial scope is unique per workspace/request key;
- continuation scope is candidate ID plus answer-batch hash;
- duplicate continuation stores one canonical answer batch;
- answers/memories are not inserted before the run claim;
- duplicate completion creates one action result and one mission graph.

- [ ] **Step 2: Write failing transactional finalizer tests**

Require `finalize_mission_genesis_v2` to atomically:

- validate lease token and owner tuple;
- persist or reuse the validated action result;
- create/update mission, plan version, checkpoints, tasks, steps, permissions, memories, and event;
- close usage and run;
- return the same result on exact replay;
- reject conflicting replay.

- [ ] **Step 3: Verify RED**

```powershell
npm test -- src/openai-mission-genesis-function.test.ts src/mission-pattern-registry.test.ts src/production-supabase-service.test.ts src/production-reliability-schema.test.ts --reporter=dot
```

- [ ] **Step 4: Implement claim-before-side-effect**

Persist the durable run and action shell first. Apply continuation answers only after the scope is claimed.

- [ ] **Step 5: Implement staged graph finalization**

Keep the current candidate/context/activation semantics and strict output validation. Move multi-table graph application behind the replay-safe finalizer.

- [ ] **Step 6: Replace fixed client polling**

Use live invalidation plus the shared bounded exact-run fallback. Remove the fixed 1.5-second, 240-attempt loop.

- [ ] **Step 7: Verify**

```powershell
npm test -- src/openai-mission-genesis-function.test.ts src/mission-pattern-registry.test.ts src/production-supabase-service.test.ts src/production-app-shell.test.tsx --reporter=dot
npx deno check --no-lock supabase/functions/mission-genesis/index.ts
```

- [ ] **Step 8: Commit**

```powershell
git add -- supabase/migrations/20260728000400_todays_brief_and_mission_finalizers.sql supabase/functions/mission-genesis/index.ts supabase/functions/_shared/missionGraphPersistence.ts src/services/productionSupabase.ts src/openai-mission-genesis-function.test.ts src/mission-pattern-registry.test.ts src/production-supabase-service.test.ts src/production-app-shell.test.tsx
git commit -m "feat: finalize mission genesis transactionally"
```

## Phase E — Recovery, Grounding, and Production Handoff

### Task 18: Implement the allowlisted conditional recovery worker

**Files:**
- Create: `supabase/functions/workflow-recovery/index.ts`
- Create: `src/workflow-recovery-function.test.ts`
- Modify: `supabase/config.toml`
- Modify: `src/production-reliability-schema.test.ts`

- [ ] **Step 1: Write failing worker contract tests**

Require:

- service secret authentication;
- classifications allowlisted explicitly;
- batch size between three and five;
- queued claim;
- expired lease reclaim;
- bounded exponential retry with jitter;
- terminal failure after maximum attempts;
- permanent errors do not retry;
- owner/workspace/artist/subject revalidation;
- usage rows terminalized with failed/exhausted runs;
- legacy null-version/null-lease rows ignored;
- observation mode reports candidates without claiming.

- [ ] **Step 2: Verify RED**

```powershell
npm test -- src/workflow-recovery-function.test.ts src/production-reliability-schema.test.ts --reporter=dot
```

- [ ] **Step 3: Implement the worker**

Supported workflow versions are introduced one at a time:

```ts
const handlers = {
  "workspace-setup-v1": recoverWorkspaceSetup,
  "source-sync-v1": recoverSourceSync,
  "music-manager-read-v2": recoverMusicManagerRead,
  "mission-genesis-v2": recoverMissionGenesis,
  "todays-brief-v1": recoverTodaysBrief,
} as const;
```

Unknown versions are logged and ignored.

Add:

```toml
[functions.workflow-recovery]
verify_jwt = false
```

The function must then reject every request whose `x-workflow-worker-secret` does not match the Vault-provisioned secret using the same safe secret-comparison pattern as the billing worker.

- [ ] **Step 4: Add observation mode**

The deployed worker defaults to:

```ts
{ mode: "observe" }
```

It returns counts and IDs but performs no claims until the workflow gate is enabled.

- [ ] **Step 5: Verify**

```powershell
npm test -- src/workflow-recovery-function.test.ts src/production-reliability-schema.test.ts --reporter=dot
npx deno check --no-lock supabase/functions/workflow-recovery/index.ts
```

- [ ] **Step 6: Commit**

```powershell
git add -- supabase/functions/workflow-recovery/index.ts src/workflow-recovery-function.test.ts supabase/config.toml src/production-reliability-schema.test.ts
git commit -m "feat: add bounded workflow recovery worker"
```

### Task 19: Add the conditional recovery schedule last

**Files:**
- Create: `supabase/migrations/20260728000500_schedule_workflow_recovery.sql`
- Modify: `src/workflow-recovery-function.test.ts`
- Modify: `src/paddle-worker-schedule.test.ts`

- [ ] **Step 1: Write failing schedule tests**

Require:

- Vault secret preflight;
- existing job unscheduled idempotently;
- one-minute schedule;
- indexed `exists` check for eligible versioned queued/expired work;
- `net.http_post` executes only when eligible work exists;
- observation mode in the initial schedule;
- no secret literal in source.

Also require the existing billing schedule to skip its Edge invocation when no pending/retryable webhook event exists.

- [ ] **Step 2: Verify RED**

```powershell
npm test -- src/workflow-recovery-function.test.ts src/paddle-worker-schedule.test.ts --reporter=dot
```

- [ ] **Step 3: Implement the conditional schedule**

Follow the Vault and `pg_net` pattern in `20260714000300_schedule_billing_worker.sql`, but guard the HTTP call with the exact eligible-work predicates used by recovery indexes.

- [ ] **Step 4: Verify**

```powershell
npm test -- src/workflow-recovery-function.test.ts src/paddle-worker-schedule.test.ts --reporter=dot
npx supabase db reset
npx supabase db lint --local --level error
```

- [ ] **Step 5: Commit**

```powershell
git add -- supabase/migrations/20260728000500_schedule_workflow_recovery.sql src/workflow-recovery-function.test.ts src/paddle-worker-schedule.test.ts
git commit -m "feat: schedule conditional workflow recovery"
```

### Task 20: Tighten remaining grounding and fallback contracts

**Files:**
- Modify: `supabase/functions/_shared/openaiTodaysBrief.ts`
- Modify: `supabase/functions/_shared/openaiMissionGenesis.ts`
- Modify: `supabase/functions/_shared/openaiMusicManagerRead.ts`
- Modify: `supabase/functions/generate-todays-brief/index.ts`
- Modify: `supabase/functions/mission-genesis/index.ts`
- Modify: `src/openai-todays-brief-function.test.ts`
- Modify: `src/openai-mission-genesis-function.test.ts`
- Modify: `src/openai-music-summary-function.test.ts`
- Modify: `src/manager-intelligence-packet-builder.test.ts`

- [ ] **Step 1: Write failing evidence-boundary tests**

Require prompts to distinguish:

```text
VERIFIED_EVIDENCE
USER_CONTEXT
PERSISTED_WORKSPACE_STATE
PERMITTED_INFERENCE
MISSING_OR_STALE_INFORMATION
```

Require every visible evidence-based claim to resolve to an allowed frozen-packet evidence ID.

- [ ] **Step 2: Write failing version/fallback tests**

Require:

- prompt version persisted;
- packet/schema version persisted;
- fallback output structurally marked limited;
- missing evidence recorded as limitation;
- unsupported general knowledge cannot appear as sourced workspace fact;
- the existing Music Manager Read single-surface schema remains unchanged.

- [ ] **Step 3: Verify RED**

```powershell
npm test -- src/openai-todays-brief-function.test.ts src/openai-mission-genesis-function.test.ts src/openai-music-summary-function.test.ts src/manager-intelligence-packet-builder.test.ts --reporter=dot
```

- [ ] **Step 4: Implement the common evidence boundary**

Reuse Manager intelligence packet references and existing exact evidence-ID validation. Do not copy full evidence into run rows and do not expose chain-of-thought.

- [ ] **Step 5: Verify**

```powershell
npm test -- src/openai-todays-brief-function.test.ts src/openai-mission-genesis-function.test.ts src/openai-music-summary-function.test.ts src/manager-intelligence-packet-builder.test.ts --reporter=dot
npx deno check --no-lock supabase/functions/generate-todays-brief/index.ts supabase/functions/mission-genesis/index.ts supabase/functions/generate-music-summary/index.ts
```

- [ ] **Step 6: Commit**

```powershell
git add -- supabase/functions/_shared/openaiTodaysBrief.ts supabase/functions/_shared/openaiMissionGenesis.ts supabase/functions/_shared/openaiMusicManagerRead.ts supabase/functions/generate-todays-brief/index.ts supabase/functions/mission-genesis/index.ts src/openai-todays-brief-function.test.ts src/openai-mission-genesis-function.test.ts src/openai-music-summary-function.test.ts src/manager-intelligence-packet-builder.test.ts
git commit -m "fix: ground manager outputs in frozen evidence"
```

### Task 21: Remove obsolete broad loops and compatibility paths

**Files:**
- Modify: `src/app/ProductionApp.tsx`
- Modify: `src/features/music/MusicScreens.tsx`
- Modify: `src/services/productionSupabase.ts`
- Modify: `src/services/fixtureRepositories.ts`
- Modify: tests revealed by the scoped scan

- [ ] **Step 1: Add failing absence assertions**

Require production runtime absence of:

```text
discovery setInterval(2000)
catalog setInterval(4000)
music Manager Read setInterval(2000)
unbounded generateContextualSetup for (;;)
Mission Genesis 1500 ms x 240 polling
setup music-wave 2000 ms database polling
```

Do not reject the bounded shared fallback.

- [ ] **Step 2: Verify RED**

```powershell
npm test -- src/production-app-shell.test.tsx src/production-supabase-service.test.ts src/openai-todays-brief-function.test.ts --reporter=dot
```

- [ ] **Step 3: Remove old paths**

Delete:

- raw discovery-summary translation;
- redundant broad reload callbacks;
- compatibility loaders with no remaining callers;
- obsolete polling constants;
- duplicate Supabase client construction;
- old mobile-only Activity Center.

Preserve fixture-mode behavior and existing product output contracts.

- [ ] **Step 4: Verify idle behavior**

With fake timers, advance five minutes in a visible idle workspace and five hidden minutes.

Expected:

```text
Repeating REST calls: 0
Repeating Edge calls: 0
Realtime channels per visible workspace: 1
Hidden fallback checks: 0
```

- [ ] **Step 5: Commit**

```powershell
git add -- src/app/ProductionApp.tsx src/features/music/MusicScreens.tsx src/services/productionSupabase.ts src/services/fixtureRepositories.ts src/production-app-shell.test.tsx src/production-supabase-service.test.ts src/openai-todays-brief-function.test.ts
git commit -m "refactor: remove obsolete background polling"
```

### Task 22: Run complete verification and prepare production handoff

**Files:**
- Create: `docs/operations/production-reliability-rollout.md`
- Modify: none unless verification reveals a regression

- [ ] **Step 1: Run focused suites**

```powershell
npm test -- src/resource-request-coordinator.test.ts src/active-run-fallback.test.ts src/workspace-live-sync.test.ts src/workspace-activity-center.test.tsx src/production-reliability-schema.test.ts src/workflow-recovery-function.test.ts src/production-supabase-service.test.ts src/production-app-shell.test.tsx src/paid-workspace-setup-function.test.ts src/manager-artist-discovery-function.test.ts src/spotify-catalog-bootstrap-function.test.ts src/openai-todays-brief-function.test.ts src/openai-music-summary-function.test.ts src/music-manager-read-v2-schema.test.ts src/music-manager-read-v2-workflow.test.ts src/openai-mission-genesis-function.test.ts src/manager-conversation-stream.test.ts src/private-beta-access-contract.test.ts src/production-boundary.test.ts --reporter=dot
```

Expected: all pass.

- [ ] **Step 2: Run full verification**

```powershell
npm test -- --reporter=dot
npm run build
npx deno check --no-lock supabase/functions/workflow-recovery/index.ts supabase/functions/paid-workspace-setup/index.ts supabase/functions/spotify-catalog-bootstrap/index.ts supabase/functions/manager-artist-discovery/index.ts supabase/functions/generate-todays-brief/index.ts supabase/functions/generate-music-summary/index.ts supabase/functions/mission-genesis/index.ts
npx supabase db reset
npx supabase db lint --local --level error
npx supabase db lint --linked --level error
git diff --check
git status --short
```

Expected: every command exits zero; only intentional changes and the preserved user-owned `deno.lock` state remain.

- [ ] **Step 3: Request code review**

Invoke `superpowers:requesting-code-review` over the complete branch diff. Resolve every Critical and Important finding with a new failing test before the fix.

- [ ] **Step 4: Write the production deployment order**

In `docs/operations/production-reliability-rollout.md`, record:

1. preflight duplicate/stuck-run SQL results;
2. additive migration order;
3. frontend dual-reader deployment;
4. event-writer deployment;
5. live-sync flag enablement;
6. workflow function deployment order;
7. recovery worker observation deployment;
8. one-workflow-at-a-time recovery enablement;
9. schedule activation last;
10. post-deploy smoke results and resource measurements.

- [ ] **Step 5: Include exact production smoke queries**

Include and run, after explicit deployment approval:

```sql
select classification, status, count(*), min(created_at), max(created_at)
from public.manager_synthesis_runs
where created_at >= now() - interval '24 hours'
group by classification, status
order by classification, status;
```

```sql
select account_id, artist_workspace_id, artist_id,
       classification, subject_type, subject_id, count(*)
from public.manager_synthesis_runs
where status in ('queued', 'running')
group by 1,2,3,4,5,6
having count(*) > 1;
```

```sql
select account_id, artist_workspace_id, artist_id,
       output_type, subject_type, subject_id, count(*)
from public.manager_outputs
where is_current
group by 1,2,3,4,5,6
having count(*) > 1;
```

```sql
select id, status, current_stage, workflow_version,
       input_refs, lease_expires_at, heartbeat_at, updated_at
from public.workspace_setup_runs
order by updated_at desc
limit 50;
```

```sql
select event_type, workspace_setup_run_id, dedupe_key,
       display_mode, refresh_scope, created_at
from public.operating_events
where created_at >= now() - interval '24 hours'
order by created_at desc
limit 200;
```

```sql
select pg_size_pretty(pg_database_size(current_database()));
```

Duplicate queries must return zero rows. Every new setup event must have its setup-run ID.

- [ ] **Step 6: Document rollback order**

The rollback order is:

1. disable/unschedule recovery;
2. disable `VITE_WORKSPACE_LIVE_UPDATES`;
3. redeploy previous Edge Function versions;
4. redeploy the previous frontend artifact;
5. leave additive columns, RPCs, indexes, and events in place;
6. never drop reliability schema while any deployed code may reference it;
7. inspect and safely close only verified new-version leased runs.

- [ ] **Step 7: Re-measure cost budgets**

Repeat the Task 1 browser and Supabase Usage measurements.

Required results:

- five idle minutes: zero repeating REST/Edge requests;
- normal Music Manager Read: one start, small event delivery, one focused result fetch;
- hidden tab: zero fallback polling;
- no full-library refresh from one object event;
- no threshold regression.

- [ ] **Step 8: Commit the verified handoff**

```powershell
git add -- docs/operations/production-reliability-rollout.md
git commit -m "docs: prepare production reliability rollout"
```

## Production Enablement Gates

Enable workflows in this order, with an observation window after each:

1. read-side live sync;
2. workspace setup leases;
3. source/catalog recovery;
4. setup Music Manager Read reconciliation;
5. individual Music Manager Read recovery;
6. Mission Genesis recovery;
7. Today's Brief recovery;
8. scheduled reaping.

Stop the rollout immediately if:

- an old completed workspace cannot load;
- duplicate active runs or duplicate current outputs appear;
- a stale worker can terminalize a newer attempt;
- a refresh removes the previous good output;
- setup shows another run's progress;
- a cross-workspace focused loader returns data;
- idle REST or Edge traffic is nonzero;
- one object event triggers a broad library/workspace reload;
- Supabase usage crosses an internal review threshold unexpectedly.

## Deliberate Exclusions

Do not add:

- Temporal, Redis, Kafka, or another queue service;
- Redux, Zustand, TanStack Query, or a normalized global entity store;
- one Realtime channel per table/component/object;
- Presence or Broadcast;
- Web Push, service workers, or email for routine activity;
- cross-tab leader election;
- a duplicate notification table;
- exact AI percentage progress;
- automatic historical workflow migration or replay;
- broad data-retention deletion;
- deployment automation that bypasses explicit production approval.
