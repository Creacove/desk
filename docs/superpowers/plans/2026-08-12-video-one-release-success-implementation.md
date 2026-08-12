# Video One Release Success Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with the stated review checkpoints. Run with `gpt-5.6-luna` at `max` reasoning. Do not skip failing-test, focused-pass, phase-gate, or commit steps.

**Goal:** Make the production Desk conversation truthfully assess an unreleased song, recommend and safely apply a release-date change, reorganize only release-bound work, and then reuse that foundation for source-backed playlist/press research and canonical shareable documents.

**Architecture:** Add a small release-control layer around the existing Music record, attached mission, task graph, Manager Responses API loop, canonical song documents, share snapshots, operating events, and central error telemetry. OpenAI performs semantic interpretation, research, fit judgment, and drafting; deterministic TypeScript/SQL owns validation, readiness states, schedule math, approval, persistence, idempotency, and receipts.

**Tech Stack:** React 18, TypeScript 5.8, Vite, Vitest, Testing Library, Supabase/Postgres migrations and RPCs, Supabase Edge Functions/Deno, OpenAI Responses API function calling and web search.

---

## CTO execution contract for Luna Max

Read these files completely before editing:

1. `docs/superpowers/specs/2026-08-12-video-one-release-success-mission-design.md`
2. `docs/superpowers/specs/2026-08-11-central-error-telemetry-design.md`
3. `docs/workflows/manager-conversation-router.md`
4. `docs/workflows/mission-creation-and-update.md`
5. `docs/workflows/music-lifecycle-storage-contract.md`
6. `docs/workflows/source-confidence-contract.md`

### Non-negotiable constraints

- Work only in a dedicated `codex/video-one-release-success` worktree/branch. Do not implement on `main`.
- Treat `src/prototype/**`, `src/services/fixtureRepositories.ts`, and fixture release names as out of scope. No production behavior may import or copy fixture state.
- Reuse the one release mission already attached to the song. Never create a second mission because readiness was checked or the date changed.
- Keep provider/historical dates immutable. A planning action changes only the approved operational date.
- Move only tasks with an explicit active release-date binding. Never infer binding from task titles at approval time.
- Preserve fixed, manual, completed, archived, and external-commitment deadlines.
- Do not regenerate the mission graph for a date-only change. Preserve task/checkpoint IDs and existing deliverable links.
- Reuse canonical song documents, `artifact_links`, share links/snapshots, operating events, and `app_error_events`.
- Do not create a second Files system, EPK database, contact CRM, error table, event bus, approval system, or notification platform.
- V1 prepares public emails, submission links, pitches, documents, and packages. It never sends email or submits forms.
- The model may propose a date; only the approval RPC may apply it.
- Expected product outcomes such as no verified contact, no strong match, ineligibility, expiry, or user rejection are not application errors.
- Any unexpected failure must retain its trace ID, workflow IDs, stage, safe public message, and retry truth.
- Keep unrelated Hub behavior and visual design unchanged.
- Do not change model families, reasoning configuration, global navigation, billing, onboarding, artist discovery, Today's Brief, or specialist-agent locking.

### Working discipline

For every task:

1. Write the smallest behavioral test that proves the next contract.
2. Run that test and record the expected failure reason.
3. Implement only enough code to satisfy the contract.
4. Run the focused test.
5. Run the phase regression set when the task closes a phase.
6. Inspect `git diff --check` and `git status --short`.
7. Commit only the files named in that task.

If a task reveals that an approved invariant cannot be met with the stated architecture, stop and report the exact evidence. Do not silently invent an alternative architecture.

### Review framework

Every completed task receives four passes before its commit:

1. **Contract review:** Does the implementation satisfy the new failing test without weakening existing tests?
2. **Architecture review:** Does it reuse the approved system of record and avoid a parallel mission, document, approval, event, or error pathway?
3. **Truth review:** Can every visible claim be traced to persisted state, public evidence, or an explicit user declaration? Does the UI distinguish unknown, failed, and not applicable?
4. **Diff review:** Are all changed files named by the task, narrowly scoped, formatted, credential-safe, and free of unrelated cleanup?

At each phase gate, perform an additional integration review:

- inspect migrations for destructive writes, RLS gaps, mutable provider history, and non-idempotent RPCs;
- inspect Manager tools for excess authority, fabricated-contact paths, duplicated prompt rules, and missing strict schemas;
- inspect UI for duplicate artifacts, optimistic success, hidden limitations, mobile obstruction, and unfamiliar styling;
- inspect telemetry for missing correlation, sensitive payload leakage, and inability to distinguish rollback from refresh failure; and
- run the named cross-Hub suites before beginning the next phase.

### Product and visual quality rubric

The implementation is not accepted merely because tests pass. Review the real UI against these requirements:

- it must look like the current production Desk, using existing typography, colors, radii, controls, spacing, and motion language;
- the decision and next action must be visually dominant; technical evidence is secondary disclosure;
- one release artifact evolves in place; the conversation must not accumulate dashboard cards;
- progress labels describe observable work and never simulate chain of thought;
- approval text names the date and mutation scope;
- success appears only from persisted receipt data;
- errors explain what did and did not change and provide a retry/support reference where applicable;
- no playlist, press, or EPK screen introduces a global navigation destination in V1;
- desktop and mobile retain composer access, scroll-follow behavior, keyboard focus, and readable hit targets; and
- loading, empty, partial, stale, failed, and completed states all have designed behavior.

### Existing user files

Preserve unrelated untracked `.playwright-cli/**` artifacts. Never stage or delete them.

## File responsibility map

### New focused domain files

- `supabase/functions/_shared/release-success/types.ts` — strict release assessment, schedule preview, request, receipt, and opportunity contracts.
- `supabase/functions/_shared/release-success/readiness.ts` — pure deterministic gate evaluation from a normalized song packet.
- `supabase/functions/_shared/release-success/schedule.ts` — pure release-relative date calculations and preview formatting.
- `supabase/functions/_shared/release-success/opportunities.ts` — candidate normalization, deduplication, contact-route validation, and safety filtering.
- `supabase/functions/release-plan-change/index.ts` — authenticated propose/approve Edge boundary and central error capture.
- `src/features/manager/ReleaseSuccessArtifact.tsx` — the one evolving Video One artifact.
- `src/features/manager/OpportunityArtifact.tsx` — playlist/press shortlist and target-package UI.

### Existing files to modify narrowly

- `supabase/functions/_shared/manager-conversation/agentLoop.ts` — register intent-scoped release/opportunity tools.
- `supabase/functions/_shared/manager-conversation/toolExecutor.ts` — execute focused reads and internal opportunity/document writes.
- `supabase/functions/_shared/openaiManagerConversation.ts` — lean routing and approval boundaries.
- `supabase/functions/manager-conversation-stream/index.ts` — persist/stream release artifacts and canonical created work.
- `supabase/functions/_shared/mission-patterns/missionPatternRegistry.ts` — evolve the release pattern language.
- `src/types/cleanProduction.ts` — view models, stream events, and repository commands.
- `src/services/productionSupabase.ts` — hydrate operational dates/artifacts and invoke proposal/approval.
- `src/app/ProductionApp.tsx` — merge stream events, refresh exact surfaces, and route Files/Mission drill-downs.
- `src/features/manager/ManagerScreens.tsx` — render the new artifact components without redesigning the conversation.
- existing song document/share files — only to expose already-canonical outputs in Files/share selectors when needed.

### Migrations

- `supabase/migrations/20260812000100_release_success_foundation.sql` — operational release plans, date-change requests, task bindings, constraints, indexes, RLS, and authoritative RPCs.
- `supabase/migrations/20260812000200_release_opportunities.sql` — lightweight playlist/press opportunity records and public-source/contact provenance.

### Test files

- `src/release-success-schema.test.ts`
- `src/release-success-rpc-contract.test.ts`
- `src/release-success-readiness.test.ts`
- `src/release-success-schedule.test.ts`
- `src/release-plan-change-function.test.ts`
- `src/release-success-manager-tools.test.ts`
- `src/release-success-conversation.test.tsx`
- `src/release-opportunities-schema.test.ts`
- `src/release-opportunities.test.ts`
- `src/release-success-documents.test.tsx`
- `src/release-success-regression.test.ts`

## Phase A — Safe Video One foundation

### Task 1: Establish the baseline and branch guardrails

**Files:**
- Create: none
- Modify: none
- Test: existing suite only

- [ ] **Step 1: Create and enter the dedicated worktree**

Run from the repository root:

```powershell
git status --short
git worktree add ..\ai-record-label-video-one -b codex/video-one-release-success
Set-Location ..\ai-record-label-video-one
```

Expected: the new worktree is on `codex/video-one-release-success`; unrelated `.playwright-cli` files remain in the original worktree and are not copied into commits.

- [ ] **Step 2: Verify the approved documentation exists in branch history**

Run:

```powershell
git log -1 --oneline -- docs/superpowers/specs/2026-08-12-video-one-release-success-mission-design.md
git show --stat --oneline 97ba26a
```

Expected: commit `97ba26a` and the approved design are visible.

- [ ] **Step 3: Run the baseline contract set**

Run:

```powershell
npm test -- --run src/conversational-song-workspace-contract.test.ts src/manual-song-workspace-schema.test.ts src/manager-conversation-tool-executor.test.ts src/manager-conversation-stream.test.ts src/song-document-actions.test.tsx src/music-share-package.test.ts src/app-error-high-fidelity-contract.test.ts
```

Expected: all tests pass before any implementation change.

- [ ] **Step 4: Run the production build**

Run `npm run build`.

Expected: Vite completes successfully. If baseline fails, stop and report it separately; do not attribute it to Video One.

### Task 2: Add the release-control schema contract

**Files:**
- Create: `src/release-success-schema.test.ts`
- Create: `supabase/migrations/20260812000100_release_success_foundation.sql`

- [ ] **Step 1: Write the failing schema test**

Create `src/release-success-schema.test.ts` with exact assertions:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  "supabase/migrations/20260812000100_release_success_foundation.sql",
  "utf8",
);

describe("release success foundation schema", () => {
  it("adds one operational release plan per song without changing provider dates", () => {
    expect(sql).toMatch(/create table public\.music_release_plans/i);
    expect(sql).toMatch(/music_item_id uuid not null unique/i);
    expect(sql).toMatch(/approved_release_date date/i);
    expect(sql).toMatch(/revision bigint not null default 0/i);
    expect(sql).not.toMatch(/update public\.music_items set planned_release_date/i);
  });

  it("models approval and explicit schedule bindings", () => {
    expect(sql).toMatch(/create table public\.release_date_change_requests/i);
    expect(sql).toMatch(/expected_plan_revision bigint not null/i);
    expect(sql).toMatch(/preview_hash text not null/i);
    expect(sql).toMatch(/idempotency_key text not null/i);
    expect(sql).toMatch(/create table public\.release_task_schedule_bindings/i);
    expect(sql).toMatch(/offset_days integer not null/i);
    expect(sql).toMatch(/active boolean not null default true/i);
  });

  it("provides scoped proposal and atomic approval RPCs", () => {
    expect(sql).toMatch(/create or replace function public\.propose_release_date_change/i);
    expect(sql).toMatch(/create or replace function public\.approve_release_date_change/i);
    expect(sql).toMatch(/for update/i);
    expect(sql).toMatch(/expected_plan_revision/i);
    expect(sql).toMatch(/release_plan_changed/i);
  });

  it("keeps tables account-scoped and protected", () => {
    expect(sql).toMatch(/enable row level security/gi);
    expect(sql).toMatch(/artist_workspace_id uuid not null/gi);
    expect(sql).toMatch(/grant execute on function public\.approve_release_date_change/gi);
  });
});
```

- [ ] **Step 2: Run the test to verify red**

Run `npm test -- --run src/release-success-schema.test.ts`.

Expected: FAIL because the migration does not exist.

- [ ] **Step 3: Implement the additive schema**

Create the migration with:

```sql
create table public.music_release_plans (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  music_item_id uuid not null unique references public.music_items(id) on delete cascade,
  mission_id uuid references public.missions(id) on delete set null,
  status text not null default 'draft'
    check (status in ('draft','pending_approval','approved','released','cancelled')),
  approved_release_date date,
  revision bigint not null default 0,
  approved_at timestamptz,
  approved_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.release_date_change_requests (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  release_plan_id uuid not null references public.music_release_plans(id) on delete cascade,
  permission_request_id uuid references public.permission_requests(id) on delete set null,
  from_date date,
  proposed_date date not null,
  reason text not null,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','superseded','expired','failed')),
  expected_plan_revision bigint not null,
  preview_hash text not null,
  preview_json jsonb not null default '{}'::jsonb,
  result_json jsonb not null default '{}'::jsonb,
  idempotency_key text not null,
  expires_at timestamptz not null,
  requested_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, idempotency_key)
);

create table public.release_task_schedule_bindings (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  release_plan_id uuid not null references public.music_release_plans(id) on delete cascade,
  task_id uuid not null unique references public.tasks(id) on delete cascade,
  anchor text not null default 'approved_release_date'
    check (anchor = 'approved_release_date'),
  offset_days integer not null check (offset_days between -365 and 365),
  active boolean not null default true,
  applied_plan_revision bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Add indexes for release plan/song, pending requests, and active bindings. Enable RLS. Follow the repository's account-membership policy pattern; grant authenticated users only scoped selects and RPC execution, while writes remain inside security-definer RPCs. Set `search_path = public` on security-definer functions. Revoke direct insert/update/delete from `anon` and `authenticated`.

The proposal RPC must accept `music_item_id`, proposed date, reason, expected revision, preview JSON/hash, expiry, idempotency key, and authenticated user ID; verify account/workspace ownership and unreleased state; lazily create the release plan from the canonical `music_items.planned_release_date` only as an initial operational value; create the matching existing `permission_requests` row with `request_type = 'release_plan_change'`; and return the request unchanged on idempotent retry.

The approval RPC must lock the plan and request, reject stale revision/date/hash, update the plan, update only active bindings whose tasks are not completed/archived, update the permission request, mark the request approved, emit one `release_plan_changed` operating event, and return a JSON receipt. Do not update `music_items.metadata.spotify` or `released_at`.

- [ ] **Step 4: Run the schema test**

Run `npm test -- --run src/release-success-schema.test.ts`.

Expected: PASS.

- [ ] **Step 5: Run existing migration contracts and commit**

Run:

```powershell
npm test -- --run src/manual-song-workspace-schema.test.ts src/music-share-links-schema.test.ts src/app-error-events-schema.test.ts src/release-success-schema.test.ts
git diff --check
git add src/release-success-schema.test.ts supabase/migrations/20260812000100_release_success_foundation.sql
git commit -m "feat: add release success control schema"
```

Expected: all tests pass and only the two named files are committed.

### Task 3: Implement pure readiness and schedule rules

**Files:**
- Create: `supabase/functions/_shared/release-success/types.ts`
- Create: `supabase/functions/_shared/release-success/readiness.ts`
- Create: `supabase/functions/_shared/release-success/schedule.ts`
- Create: `src/release-success-readiness.test.ts`
- Create: `src/release-success-schedule.test.ts`

- [ ] **Step 1: Write failing readiness tests**

Define normalized inputs directly in the test. Cover:

```ts
expect(assessReleaseSuccess(completePacket).foundation.status).toBe("confirmed");
expect(assessReleaseSuccess({ ...completePacket, distributor: null }).foundation.gates)
  .toContainEqual(expect.objectContaining({ key: "distributor_delivery", state: "unknown" }));
expect(assessReleaseSuccess({ ...completePacket, campaign: { pressEnabled: false } }).campaign.gates)
  .toContainEqual(expect.objectContaining({ key: "press_package", state: "not_applicable" }));
expect(assessReleaseSuccess({ ...completePacket, splits: { state: "pending" } }).foundation.gates)
  .toContainEqual(expect.objectContaining({ key: "splits", state: "blocked" }));
expect(assessReleaseSuccess(catalogPacket).foundation.gates).toEqual([]);
```

Assert that every non-`not_applicable` gate has `evidence`, `freshness`, `limitation`, and `nextAction` fields. Assert that campaign deficiencies never rewrite a foundation state to `blocked`.

- [ ] **Step 2: Write failing schedule tests**

Cover leap-safe UTC date arithmetic and binding behavior:

```ts
expect(applyReleaseOffset("2026-09-09", -12)).toBe("2026-08-28");
expect(previewScheduleChange(input).changes.map((item) => item.taskId)).toEqual(["bound-open"]);
expect(previewScheduleChange(input).preserved.map((item) => item.taskId))
  .toEqual(["fixed", "manual", "completed", "archived"]);
expect(hashSchedulePreview(previewScheduleChange(input))).toMatch(/^[a-f0-9]{64}$/);
```

- [ ] **Step 3: Run both tests to verify red**

Run:

```powershell
npm test -- --run src/release-success-readiness.test.ts src/release-success-schedule.test.ts
```

Expected: FAIL because the modules do not exist.

- [ ] **Step 4: Define strict contracts**

In `types.ts`, define and export:

```ts
export type ReleaseGateState = "confirmed" | "blocked" | "at_risk" | "unknown" | "not_applicable";
export type ReleaseGateResult = {
  key: string;
  label: string;
  group: "foundation" | "campaign";
  state: ReleaseGateState;
  evidence: Array<{ source: string; ref?: string; observedAt?: string }>;
  freshness: string;
  limitation: string;
  nextAction: string;
};
export type ReleaseSuccessAssessment = {
  musicItemId: string;
  releasePlanRevision: number;
  assessedAt: string;
  foundation: ReleaseGateGroup;
  campaign: ReleaseGateGroup;
  unknownCount: number;
  recommendation: { kind: "keep" | "move" | "recover"; proposedDate?: string; reason: string };
};
```

Also define `ReleaseSuccessPacket`, `ReleaseScheduleBindingInput`, `ReleaseSchedulePreview`, `ReleaseDateChangeReceipt`, `ReleaseOpportunityCandidate`, `ReleaseOpportunitySongContext`, and `ReleaseOpportunityBrief`. Use JSON-safe primitives only.

- [ ] **Step 5: Implement deterministic rules**

In `readiness.ts`, implement pure functions. Foundation gates for V1 are final-master presence, artwork presence, required metadata, credits, splits, clearance declaration, operational date, distributor state, and applicable identifiers. Campaign gates are activated by campaign intent: Spotify editorial pitch, independent playlist research, press package, content plan, and post-release measurement.

Do not add audio QC. Do not treat a demo or rough mix as a final master. Do not invent required content counts. Recommendation logic must use policy constants with explicit names and tests, for example:

```ts
export const RELEASE_SUCCESS_POLICY = {
  spotifyEditorialMinimumDays: 7,
  minimumOperationalBufferDays: 14,
  preferredCampaignBufferDays: 28,
} as const;
```

Label the 7-day Spotify window as platform guidance and the other thresholds as OrderSounds operating policy.

In `schedule.ts`, parse `YYYY-MM-DD` manually into UTC, apply offsets, sort changes deterministically, and hash the canonical JSON with Web Crypto. A preview returns `changes`, `preserved`, `fromDate`, `proposedDate`, `expectedRevision`, and `previewHash`.

- [ ] **Step 6: Run focused tests and commit**

Run:

```powershell
npm test -- --run src/release-success-readiness.test.ts src/release-success-schedule.test.ts
git diff --check
git add supabase/functions/_shared/release-success src/release-success-readiness.test.ts src/release-success-schedule.test.ts
git commit -m "feat: add deterministic release success rules"
```

Expected: all focused tests pass.

### Task 4: Evolve the existing attached release mission

**Files:**
- Modify: `supabase/functions/_shared/mission-patterns/missionPatternRegistry.ts`
- Modify: `supabase/functions/_shared/openaiMissionGenesis.ts`
- Modify: `supabase/migrations/20260808000100_conversational_song_workspace.sql` only through a new forward migration in `20260812000100_release_success_foundation.sql`; do not edit an applied migration
- Modify: `src/mission-pattern-registry.test.ts`
- Modify: `src/conversational-song-workspace-contract.test.ts`
- Modify: `src/manual-song-workspace-schema.test.ts`

- [ ] **Step 1: Add failing mission-contract assertions**

Assert that `release_planning` is named `Release Success Mission`, contains the six workstream labels, separates Manager research from artist execution, and keeps external outreach/submission permission-gated. Assert both manual and conversational song workspace creation still return one mission and reuse it idempotently.

Add a migration assertion that new release tasks with stable machine keys receive bindings during workspace creation, while existing legacy tasks are not backfilled by title matching.

- [ ] **Step 2: Run the focused mission tests to verify red**

Run:

```powershell
npm test -- --run src/mission-pattern-registry.test.ts src/conversational-song-workspace-contract.test.ts src/manual-song-workspace-schema.test.ts
```

Expected: new workstream/binding assertions fail.

- [ ] **Step 3: Evolve the registry and generation prompt**

Change only the `release_planning` entry. Its success state must be campaign execution, not checklist completion. Add exact workstreams:

```ts
taskTypes: [
  "release foundation",
  "playlist and discovery",
  "press and media",
  "content rollout",
  "launch",
  "post-release",
]
```

Update mission generation instructions so research/comparison/drafting remains Manager work; artist tasks are approvals, private facts, external submissions, or recording outcomes. Require stable `scheduleKey` values for template-owned release tasks so bindings never depend on title text.

- [ ] **Step 4: Bind only newly generated canonical tasks**

Extend the forward migration functions used by manual/conversational song creation to lazily create one release plan linked to the one release mission and insert bindings for known schedule keys. Do not rewrite the 20260807/20260808 migration files. Use these initial offsets as OrderSounds policy, all covered by tests:

```text
distributor_delivery      -12
spotify_editorial_pitch    -8
playlist_shortlist         -7
epk_press_package          -6
content_rollout_start      -4
release_live_check          0
post_release_review        +2
```

Tasks not created from these keys remain unbound.

- [ ] **Step 5: Run mission tests and commit**

Run the three focused test files, then:

```powershell
git diff --check
git add supabase/functions/_shared/mission-patterns/missionPatternRegistry.ts supabase/functions/_shared/openaiMissionGenesis.ts supabase/migrations/20260812000100_release_success_foundation.sql src/mission-pattern-registry.test.ts src/conversational-song-workspace-contract.test.ts src/manual-song-workspace-schema.test.ts
git commit -m "feat: evolve release missions for campaign success"
```

Expected: one mission remains canonical and all tests pass.

### Task 5: Test and harden atomic proposal/approval behavior

**Files:**
- Modify: `src/release-success-schema.test.ts`
- Modify: `supabase/migrations/20260812000100_release_success_foundation.sql`
- Create: `src/release-success-rpc-contract.test.ts`

- [ ] **Step 1: Write failing RPC contract scenarios**

Test SQL text/contracts for:

- row locks on plan and request;
- authenticated ownership verification;
- unreleased-only guard;
- exact expected revision and from-date checks;
- request expiry and pending-status checks;
- preview hash verification;
- only active bound/open task updates;
- completed/archived task preservation;
- one operating event;
- permission request transition;
- request result receipt;
- idempotent proposal and approval retries; and
- exception behavior that leaves no partial state.

Use named SQL error codes such as `release_plan_stale`, `release_request_expired`, `release_request_not_pending`, and `release_already_live` so Edge code can project safe messages without parsing prose.

- [ ] **Step 2: Run the RPC tests to verify red**

Run `npm test -- --run src/release-success-schema.test.ts src/release-success-rpc-contract.test.ts`.

Expected: FAIL on missing guards/error codes.

- [ ] **Step 3: Implement the complete transaction contract**

The approval receipt must have this stable JSON shape:

```json
{
  "requestId": "uuid",
  "releasePlanId": "uuid",
  "musicItemId": "uuid",
  "missionId": "uuid-or-null",
  "fromDate": "2026-08-26",
  "approvedDate": "2026-09-09",
  "previousRevision": 2,
  "revision": 3,
  "moved": [{ "taskId": "uuid", "from": "iso-or-null", "to": "iso" }],
  "preserved": [{ "taskId": "uuid", "reason": "fixed|manual|completed|archived" }],
  "nextDeadline": { "taskId": "uuid", "title": "Distributor delivery", "deadline": "iso" }
}
```

The function must return the existing receipt when the same approved idempotency key is retried. It must never recompute and apply a materially different preview.

- [ ] **Step 4: Run focused tests and commit**

Run both schema/RPC tests, `git diff --check`, and commit with `fix: make release rescheduling atomic and idempotent`.

### Phase A gate

Run:

```powershell
npm test -- --run src/release-success-schema.test.ts src/release-success-rpc-contract.test.ts src/release-success-readiness.test.ts src/release-success-schedule.test.ts src/mission-pattern-registry.test.ts src/conversational-song-workspace-contract.test.ts src/manual-song-workspace-schema.test.ts src/song-rights.test.ts src/music-share-links-schema.test.ts
npm run build
```

Pass criteria:

- all tests pass;
- build passes;
- no provider date mutation exists;
- no legacy/manual/completed task can move;
- no second mission is created; and
- no fixture/prototype file changed.

Stop if this gate fails.

## Phase B — Manager orchestration and Video One UI

### Task 6: Add the authenticated release-plan Edge boundary

**Files:**
- Create: `supabase/functions/release-plan-change/index.ts`
- Create: `src/release-plan-change-function.test.ts`
- Modify: `supabase/config.toml` if function registration is required by the existing pattern

- [ ] **Step 1: Write the failing function contract test**

Assert the function:

- uses the authenticated user/session and derives workspace identity server-side;
- accepts only `propose` or `approve`;
- validates UUIDs, ISO dates, bounded reason, hash, and idempotency key;
- calls only the matching RPC;
- maps stale/expired/not-pending errors to `409`;
- maps validation to `400`, auth to `401/403`, and unexpected errors to `500`;
- calls `captureAppError()` for unexpected failures with stage `reschedule_preview` or `reschedule_approval`;
- returns the central error reference in the safe error response; and
- never logs preview bodies containing private document text.

- [ ] **Step 2: Run the test to verify red**

Run `npm test -- --run src/release-plan-change-function.test.ts`.

Expected: FAIL because the function does not exist.

- [ ] **Step 3: Implement the boundary**

Follow existing `appFunction.ts`/`captureAppError()` patterns. Generate or forward `x-request-id`. The handler payload is:

```ts
type ReleasePlanChangeRequest =
  | { action: "propose"; musicItemId: string; proposedDate: string; reason: string; expectedRevision: number; preview: ReleaseSchedulePreview; previewHash: string; idempotencyKey: string }
  | { action: "approve"; requestId: string; previewHash: string; idempotencyKey: string };
```

On success, return `{ status: "proposed", request }` or `{ status: "applied", receipt }`. Do not let model text enter SQL identifiers or unbounded error context.

- [ ] **Step 4: Run tests and commit**

Run the focused test plus `src/app-error-high-fidelity-contract.test.ts`, then commit with `feat: add release plan approval boundary`.

### Task 7: Expand the focused release packet and Manager tools

**Files:**
- Modify: `supabase/functions/_shared/manager-conversation/agentLoop.ts`
- Modify: `supabase/functions/_shared/manager-conversation/toolExecutor.ts`
- Modify: `supabase/functions/_shared/manager-conversation/musicSubject.ts`
- Modify: `supabase/functions/_shared/openaiManagerConversation.ts`
- Create: `src/release-success-manager-tools.test.ts`
- Modify: `src/manager-conversation-tool-executor.test.ts`
- Modify: `src/openai-manager-conversation-function.test.ts`

- [ ] **Step 1: Write failing tool tests**

Assert `read_focused_release_success` returns:

- exact song identity;
- provider/historical and approved operational dates separately;
- release plan ID/revision;
- attached mission and active tasks/bindings;
- assets, credits, splits, identifiers, clearance declarations, distributor state;
- existing canonical documents and opportunity counts;
- normalized gate evidence and limitations; and
- no broad unrelated workspace dump.

Assert `propose_focused_release_date_change` is available only for attached unreleased songs and returns a preview/request, never an applied mutation. Assert no `approve` tool is exposed to the model.

- [ ] **Step 2: Run focused tests to verify red**

Run:

```powershell
npm test -- --run src/release-success-manager-tools.test.ts src/manager-conversation-tool-executor.test.ts src/openai-manager-conversation-function.test.ts
```

Expected: FAIL on missing tools and packet fields.

- [ ] **Step 3: Register strict task-scoped tools**

Add strict function schemas:

```ts
{
  type: "function",
  name: "read_focused_release_success",
  description: "Read evidence-backed release foundation, campaign preparation, approved operational date, and linked mission schedule for the exact attached unreleased song.",
  strict: true,
  parameters: { type: "object", additionalProperties: false, properties: {}, required: [] },
}
```

and a proposal tool requiring `proposedDate` and `reason`. Keep approval outside model tools.

Route tool availability by intent: ordinary playlist research must not receive release mutation tools; date-readiness intent receives focused song/readiness/mission tools and proposal only.

- [ ] **Step 4: Implement normalized packet construction**

Use scoped queries and the pure readiness/schedule modules. Never accept `rough_mix` or `demo` as final master. Read canonical `planned_release_date` only as legacy initial operational data when no release plan exists. Return evidence source/freshness/limitations.

- [ ] **Step 5: Tighten Manager instructions**

Remove the phrase `prototype-style manager office`. Add one compact release-success operating block:

```text
For an attached unreleased-song readiness question, read the exact release-success packet and linked mission before answering. Distinguish release foundation, campaign preparation, and unknown evidence. Lead with the decision. Propose a date change only when the evidence and deterministic preview support it. Never claim the change was applied; application requires the user's explicit approval through the release-plan command. If the user keeps the date, produce the strongest realistic recovery plan and name lost opportunities.
```

State each permission rule once. Do not expose full internal checklists in prose when the structured artifact carries them.

- [ ] **Step 6: Run tests and commit**

Run the three focused tests and commit with `feat: add release success manager tools`.

### Task 8: Persist and stream one release-success artifact

**Files:**
- Modify: `src/types/cleanProduction.ts`
- Modify: `supabase/functions/manager-conversation-stream/index.ts`
- Modify: `src/services/managerConversationStream.ts`
- Modify: `src/services/productionSupabase.ts`
- Modify: `src/app/ProductionApp.tsx`
- Create: `src/release-success-conversation.test.tsx`
- Modify: `src/manager-conversation-stream.test.ts`

- [ ] **Step 1: Write failing stream/hydration tests**

Assert the stream can emit one `release_success.changed` event with states `investigating`, `assessed`, `proposed`, `awaiting_approval`, `applying`, `applied`, and `failed`. Assert events with the same artifact ID replace state rather than append cards. Assert completed conversation hydration recreates the latest state after refresh.

Assert tool progress labels are human-safe (`Release materials checked`) and never expose chain-of-thought text.

- [ ] **Step 2: Run tests to verify red**

Run:

```powershell
npm test -- --run src/release-success-conversation.test.tsx src/manager-conversation-stream.test.ts
```

Expected: FAIL on unknown event/artifact types.

- [ ] **Step 3: Add view-model contracts**

In `cleanProduction.ts`, define:

```ts
export type ReleaseSuccessArtifactViewModel = {
  id: string;
  musicItemId: string;
  missionId?: string;
  requestId?: string;
  state: "investigating" | "assessed" | "proposed" | "awaiting_approval" | "applying" | "applied" | "failed";
  subject: { title: string; itemType: string; approvedReleaseDate?: string };
  assessment?: ReleaseSuccessAssessmentViewModel;
  preview?: ReleaseSchedulePreviewViewModel;
  receipt?: ReleaseDateChangeReceiptViewModel;
  error?: { message: string; reference?: string; retryable: boolean };
};

export type ReleaseSuccessAssessmentViewModel = ReleaseSuccessAssessment;
export type ReleaseSchedulePreviewViewModel = ReleaseSchedulePreview;
export type ReleaseDateChangeReceiptViewModel = ReleaseDateChangeReceipt;
export type ReleaseDateChangeRequestViewModel = {
  id: string;
  releasePlanId: string;
  musicItemId: string;
  fromDate?: string;
  proposedDate: string;
  reason: string;
  status: "pending" | "approved" | "rejected" | "superseded" | "expired" | "failed";
  expectedPlanRevision: number;
  previewHash: string;
  preview: ReleaseSchedulePreviewViewModel;
  expiresAt: string;
};

export type ReleaseDateChangeProposalInput = {
  musicItemId: string;
  proposedDate: string;
  reason: string;
  expectedRevision: number;
  preview: ReleaseSchedulePreviewViewModel;
  previewHash: string;
  idempotencyKey: string;
};
```

Add `releaseSuccessArtifacts: ReleaseSuccessArtifactViewModel[]` to `ConversationViewModel` with hydration default `[]`, and add a `release_success.changed` stream event. Do not overload `createdWork` JSON strings.

- [ ] **Step 4: Persist artifacts through existing Manager outputs**

Use `manager_outputs` with `output_type = 'release_success_assessment'`, `subject_type = 'music_item'`, and `render_json` containing the strict artifact. Mark prior current outputs for the same song/conversation non-current. Link the output to the song and mission through `artifact_links`. Do not add a readiness table.

Stream the artifact after tool completion and after a proposal. Hydration reads current outputs and normalizes malformed/legacy values safely.

- [ ] **Step 5: Merge state without duplication**

In `ProductionApp.tsx`, upsert by artifact ID and refresh only Music/Missions/Desk surfaces named by the event. Preserve composer/scroll behavior.

- [ ] **Step 6: Run tests and commit**

Run focused stream/hydration tests plus `src/production-app-shell.test.tsx -t "Manager conversation"`, then commit with `feat: stream release success artifacts`.

### Task 9: Add repository proposal/approval commands

**Files:**
- Modify: `src/types/cleanProduction.ts`
- Modify: `src/services/productionSupabase.ts`
- Modify: `src/production-supabase-service.test.ts`

- [ ] **Step 1: Write failing repository tests**

Assert the repository sends the exact proposal/approval payload, forwards `x-request-id`, preserves the central error reference, returns typed request/receipt data, and does not mutate local date state optimistically before success.

- [ ] **Step 2: Run focused test to verify red**

Run `npm test -- --run src/production-supabase-service.test.ts -t "release plan change"`.

Expected: FAIL because methods do not exist.

- [ ] **Step 3: Add typed methods**

Add to `ManagerRepository`:

```ts
proposeReleaseDateChange(input: ReleaseDateChangeProposalInput): Promise<ReleaseDateChangeRequestViewModel>;
approveReleaseDateChange(input: { requestId: string; previewHash: string; idempotencyKey: string }): Promise<ReleaseDateChangeReceiptViewModel>;
```

Invoke `release-plan-change`. Normalize failures without discarding HTTP status, request ID, error code, or central event reference.

- [ ] **Step 4: Run tests and commit**

Run the focused service test and commit with `feat: connect release plan commands`.

### Task 10: Build the chat-native Video One artifact

**Files:**
- Create: `src/features/manager/ReleaseSuccessArtifact.tsx`
- Modify: `src/features/manager/ManagerScreens.tsx`
- Modify: `src/app/ProductionApp.tsx`
- Modify: `src/release-success-conversation.test.tsx`
- Modify: `src/production-app-shell.test.tsx`

- [ ] **Step 1: Write failing UI behavior tests**

Test:

- attached-song subject row;
- one evolving artifact, never duplicate cards;
- decision-first summary;
- separate foundation/campaign/unknown counts;
- top blockers with `Show all` disclosure;
- impact preview with moved and preserved deadlines;
- exact approval button text;
- keep-date recovery action;
- button disabling during apply;
- persisted receipt and remaining blocker;
- stale preview refresh message;
- transaction failure with no success copy;
- persisted success plus refresh failure distinction;
- keyboard focus and `aria-live` for state changes; and
- mobile composer clearance/scroll-follow behavior.

Mock repository promises so the test proves no optimistic success appears before resolution.

- [ ] **Step 2: Run focused UI tests to verify red**

Run:

```powershell
npm test -- --run src/release-success-conversation.test.tsx src/production-app-shell.test.tsx -t "release success|Video One"
```

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the artifact component**

`ReleaseSuccessArtifact.tsx` is presentation-only. It receives the artifact plus callbacks:

```ts
type Props = {
  artifact: ReleaseSuccessArtifactViewModel;
  onApprove(request: ReleaseDateChangeRequestViewModel): Promise<void>;
  onKeepDate(artifact: ReleaseSuccessArtifactViewModel): void;
  onReviewAll(artifact: ReleaseSuccessArtifactViewModel): void;
  onOpenSong(musicItemId: string): void;
  onOpenMission(missionId: string): void;
  onRetry(artifact: ReleaseSuccessArtifactViewModel): Promise<void>;
};
```

Use existing colors, typography, button primitives, spacing, and card language. Do not redesign Manager Chat. Render one frame with state-specific sections. Keep sources/limitations in disclosure controls.

- [ ] **Step 4: Wire authoritative apply behavior**

On approval, set only local artifact state to `applying`; call the repository; on success merge the receipt and request targeted Music/Mission refresh; on failure show the safe error/reference and leave retry available. Generate one idempotency key per user approval intent and reuse it on retry.

`Keep August 26 and show recovery plan` sends a new conversational request with the same song subject and explicit keep-date intent. It does not call approval.

- [ ] **Step 5: Run UI tests and commit**

Run focused tests, `git diff --check`, and commit with `feat: add chat native release success approval`.

### Phase B gate — Video One recordability

Run:

```powershell
npm test -- --run src/release-success-schema.test.ts src/release-success-rpc-contract.test.ts src/release-success-readiness.test.ts src/release-success-schedule.test.ts src/release-plan-change-function.test.ts src/release-success-manager-tools.test.ts src/release-success-conversation.test.tsx src/manager-conversation-stream.test.ts src/production-supabase-service.test.ts src/production-app-shell.test.tsx src/conversational-song-workspace-contract.test.ts src/song-rights.test.ts src/app-error-high-fidelity-contract.test.ts
npm test -- --run
npm run build
```

Then execute manually against a local production-schema Supabase workspace:

1. create/select a real unreleased song with one attached mission;
2. give it a date 14 days away, mixed ready/unknown campaign evidence, one bound task, one fixed task, and one completed task;
3. ask the exact Video One question in Desk;
4. verify the real tool steps, assessment, recommendation, and preview;
5. approve;
6. refresh the browser;
7. verify operational date, task deadlines, task IDs, fixed/completed dates, mission ID, operating event, permission request, and receipt;
8. query `app_error_events` by trace ID and confirm no hidden terminal failure; and
9. repeat approval with the same key and verify no duplicate mutation/event.

Pass criteria:

- Video One works without fixtures or direct database correction;
- one mission remains attached;
- only bound tasks move;
- receipt survives refresh;
- failures are truthfully rendered/logged; and
- all other Hub regressions pass.

Stop before Phase C if this gate fails.

## Phase C — Playlist and press opportunity infrastructure

### Task 11: Add the lightweight opportunity schema

**Files:**
- Create: `supabase/migrations/20260812000200_release_opportunities.sql`
- Create: `src/release-opportunities-schema.test.ts`

- [ ] **Step 1: Write the failing schema test**

Assert one table `release_opportunities` supports `playlist` and `press`, is account/workspace/artist/song/mission scoped, and contains:

- target name/type/platform;
- canonical public source URL;
- verified public contact kind/value/source URL/time;
- fit/evidence JSON;
- confidence/limitations;
- safety state;
- requirements/package JSON;
- linked pitch document/output IDs;
- status/manual outcome;
- dedupe key; and
- created/updated timestamps.

Assert there is no contacts table and no send/outbox table.

- [ ] **Step 2: Run test to verify red**

Run `npm test -- --run src/release-opportunities-schema.test.ts`.

Expected: FAIL because the migration does not exist.

- [ ] **Step 3: Implement the table and scoped policies**

Use constrained text states:

```sql
opportunity_type check (opportunity_type in ('playlist','press'))
contact_kind check (contact_kind is null or contact_kind in ('email','submission_form','contact_page'))
status check (status in ('watch','shortlisted','approved','submitted_manually','replied','accepted','declined','skipped'))
safety_state check (safety_state in ('clear','caution','excluded'))
```

Require HTTPS public source URLs at application validation, not a brittle SQL regex. Add unique `(music_item_id, opportunity_type, dedupe_key)`. Use authenticated scoped read and internal write patterns consistent with other account records.

- [ ] **Step 4: Run tests and commit**

Run schema tests and commit with `feat: add release opportunity records`.

### Task 12: Implement deterministic opportunity normalization

**Files:**
- Create: `supabase/functions/_shared/release-success/opportunities.ts`
- Create: `src/release-opportunities.test.ts`

- [ ] **Step 1: Write failing normalization tests**

Cover:

- case/URL duplicate playlists collapse to one candidate;
- a playlist without a source URL is rejected;
- an inferred or malformed email is removed;
- a verified submission form remains actionable;
- a strong match without a verified route becomes `watch`;
- guaranteed paid placement becomes `excluded`;
- source date/contact verification date are retained;
- press byline evidence and outlet evidence remain separate;
- fit reasons must reference at least one song criterion and one target criterion; and
- no strong match returns an empty shortlist instead of filler.

- [ ] **Step 2: Run test to verify red**

Run `npm test -- --run src/release-opportunities.test.ts`.

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement pure validators and ranking inputs**

Export:

```ts
normalizePublicUrl(value: string): string | null;
normalizePublicEmail(value: string): string | null;
dedupeOpportunityCandidates(candidates: ReleaseOpportunityCandidate[]): ReleaseOpportunityCandidate[];
classifyOpportunitySafety(candidate: ReleaseOpportunityCandidate): "clear" | "caution" | "excluded";
normalizeOpportunityBrief(candidate: ReleaseOpportunityCandidate, song: ReleaseOpportunitySongContext): ReleaseOpportunityBrief | null;
```

Do not calculate a fake universal success probability. Ranking can combine explicit fit dimensions, recency, actionable contact, and safety, while preserving the dimension breakdown for the model/user.

- [ ] **Step 4: Run tests and commit**

Run focused tests and commit with `feat: normalize release opportunities safely`.

### Task 13: Add playlist/press research tools and persistence

**Files:**
- Modify: `supabase/functions/_shared/manager-conversation/agentLoop.ts`
- Modify: `supabase/functions/_shared/manager-conversation/toolExecutor.ts`
- Modify: `supabase/functions/_shared/openaiManagerConversation.ts`
- Modify: `supabase/functions/manager-conversation-stream/index.ts`
- Modify: `src/release-success-manager-tools.test.ts`
- Modify: `src/release-opportunities.test.ts`

- [ ] **Step 1: Write failing workflow tests**

Playlist intent must expose focused song/evidence, web search, existing opportunities, save shortlist, and document tools—but no reschedule approval or email-send tools. Press intent receives the equivalent press route.

Assert:

- Spotify editorial route produces a pitch/handoff, not editor emails;
- independent playlist route requires public source/contact provenance;
- every saved target has song-specific fit reasoning;
- unsafe guaranteed-placement candidates are excluded;
- verified results survive a later partial search failure;
- repeated save calls are idempotent; and
- unexpected search/persistence failures call `captureAppError()` with `opportunity_search`, `contact_verification`, or `opportunity_persistence`.

- [ ] **Step 2: Run tests to verify red**

Run:

```powershell
npm test -- --run src/release-success-manager-tools.test.ts src/release-opportunities.test.ts
```

Expected: FAIL on missing opportunity tools.

- [ ] **Step 3: Add focused tools**

Add strict function tools for:

- `query_focused_release_opportunities`;
- `save_focused_release_opportunities`;
- `record_focused_release_opportunity_outcome`; and
- `create_focused_song_document`.

Use built-in web search for public research and preserve its native sources. The save tool accepts normalized evidence-backed candidates only; server validators reject source-less/invented contacts.

- [ ] **Step 4: Add lean workflow instructions**

Playlist instruction must separate Spotify editorial from independent outreach, return five to eight strong actionable targets when available, retain watch targets separately, and prefer fewer results over filler.

Press instruction must connect the target's demonstrated editorial coverage to the artist/song angle. Generic blog lists fail the workflow.

Neither instruction may claim placement, send, submit, or create private contact data.

- [ ] **Step 5: Persist source-backed opportunity records**

Use service-side scoped inserts/upserts with the stable dedupe key. Write one operating event per saved shortlist, not one toast/event per candidate. Link opportunity-created Manager outputs/documents to the song and mission.

- [ ] **Step 6: Run tests and commit**

Run focused tools/opportunity tests and commit with `feat: add playlist and press research workflows`.

## Phase D — Canonical EPK, pitch, Files, and sharing

### Task 14: Auto-link Manager-created release documents

**Files:**
- Modify: `supabase/functions/manager-conversation-stream/index.ts`
- Modify: `supabase/functions/_shared/songDocumentDraft.ts`
- Modify: `src/types/cleanProduction.ts`
- Modify: `src/services/productionSupabase.ts`
- Modify: `src/features/music/SongDocumentActions.tsx`
- Modify: `src/features/music/MusicShareDialog.tsx`
- Create: `src/release-success-documents.test.tsx`
- Modify: `src/song-document-actions.test.tsx`
- Modify: `src/music-share-dialog.test.tsx`

- [ ] **Step 1: Write failing canonical-document tests**

For EPK, Spotify pitch, playlist pitch, press target brief, press pitch, content plan, and release calendar, assert:

- Manager creates one canonical logical document;
- it is linked to the song and attached mission;
- it appears in the song Files surface after refresh;
- it appears in the existing share selector;
- updating creates a new version/current output instead of a duplicate logical document;
- draft and approved states are distinguishable;
- existing share snapshots retain their original version; and
- failed persistence creates no Files artifact or success event.

- [ ] **Step 2: Run tests to verify red**

Run:

```powershell
npm test -- --run src/release-success-documents.test.tsx src/song-document-actions.test.tsx src/music-share-dialog.test.tsx
```

Expected: new auto-link/version assertions fail.

- [ ] **Step 3: Reuse the canonical document pathway**

Extend allowed `SongDocumentType` values only where needed. The Manager tool must call the same canonical creation/versioning logic used by Song Files. Insert `artifact_links` from document/Manager output to `music_item` and `mission`; do not copy bodies into task rows or create a new EPK table.

When the conversation creates a document, emit one canonical created-work artifact that routes to the song Files destination. Existing `openCreatedWork(..., "files")` behavior must be reused.

- [ ] **Step 4: Preserve immutable sharing**

The existing share package captures selected document versions. New packages default to latest approved versions. Updating an EPK never mutates a previously published share snapshot.

- [ ] **Step 5: Run tests and commit**

Run focused document/share tests and commit with `feat: attach release documents to song files`.

### Task 15: Render opportunity and target-package artifacts

**Files:**
- Create: `src/features/manager/OpportunityArtifact.tsx`
- Modify: `src/features/manager/ManagerScreens.tsx`
- Modify: `src/types/cleanProduction.ts`
- Modify: `src/services/productionSupabase.ts`
- Modify: `src/app/ProductionApp.tsx`
- Modify: `src/release-success-conversation.test.tsx`
- Modify: `src/production-app-shell.test.tsx`

- [ ] **Step 1: Write failing UI tests**

Assert:

- shortlist leads with five to eight strongest matches;
- watch and excluded candidates are visually separate;
- source, contact route, verification date, fit explanation, confidence, and limitations are inspectable;
- Spotify editorial card opens Spotify for Artists and never displays editor email;
- `Prepare pitch` creates/opens the canonical document;
- target package shows selected Files, copyable pitch, contact/link, and share link;
- no Send button exists;
- manual status/outcome can be recorded; and
- partial failures preserve verified results and expose retry for the failed stage.

- [ ] **Step 2: Run tests to verify red**

Run focused conversation/shell tests with `-t "playlist opportunity|press opportunity|target package"`.

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Add strict view models and hydration**

Define opportunity artifacts with structured brief IDs rather than embedding arbitrary model HTML/Markdown. Hydrate from `release_opportunities` and linked documents. Keep public URLs external and safely rendered with `rel="noreferrer"`.

- [ ] **Step 4: Implement the component using existing visual language**

Render compact shortlist rows, one expanded target detail, and a target-package preview. Do not add a global Opportunities page or Hub navigation item. Actions remain in conversation; Files/Mission are drill-downs.

- [ ] **Step 5: Run tests and commit**

Run focused UI tests and commit with `feat: add release opportunity artifacts`.

### Phase C/D gate — reusable release-success infrastructure

Run:

```powershell
npm test -- --run src/release-opportunities-schema.test.ts src/release-opportunities.test.ts src/release-success-manager-tools.test.ts src/release-success-documents.test.tsx src/song-document-actions.test.tsx src/music-share-dialog.test.tsx src/music-share-package.test.ts src/release-success-conversation.test.tsx src/production-app-shell.test.tsx src/app-error-high-fidelity-contract.test.ts
npm test -- --run
npm run build
```

Manual production-like acceptance:

1. start playlist research from the same song conversation;
2. verify every actionable result has a public source and contact route;
3. verify unsafe paid-placement candidates are excluded;
4. create a playlist pitch and EPK;
5. verify both appear in song Files and the attached mission;
6. prepare a target package and share link;
7. verify no email/form was sent;
8. refresh and verify all artifacts persist;
9. run a press search and verify target-specific editorial reasoning; and
10. inspect central telemetry for hidden failures.

Stop if any artifact exists in chat but not Files, if a source/contact is fabricated, or if an existing share snapshot changes.

## Phase E — Cross-Hub regression, telemetry, and release review

### Task 16: Add explicit cross-Hub regression contracts

**Files:**
- Create: `src/release-success-regression.test.ts`
- Modify: tests only when an existing behavior needs a stronger assertion

- [ ] **Step 1: Write the regression contract**

The test must assert that Video One changes do not alter:

- authentication/account setup;
- Spotify catalog import and provider dates;
- manual and conversational song creation idempotency;
- Music list/detail hydration for songs with no release plan;
- project/EP/album screens;
- audio/artwork uploads;
- credit editing;
- split allocation and confirmation locking;
- mission list/detail and task completion;
- Today's Brief;
- artist discovery/Manager Read;
- document editing;
- public share access and immutable manifests;
- billing/entitlements;
- specialist agent lock states;
- global Hub navigation; and
- live-sync deduplication.

Use contract/source assertions only where behavior cannot be rendered cheaply; prefer behavioral repository/component tests for hydration and navigation.

- [ ] **Step 2: Run the regression test and fix only feature-caused failures**

Run `npm test -- --run src/release-success-regression.test.ts`.

Expected: PASS after feature integration. If it fails, identify the exact Video One change responsible; do not weaken the assertion to make it green.

- [ ] **Step 3: Run named Hub suites**

Run:

```powershell
npm test -- --run src/production-app-shell.test.tsx src/production-supabase-service.test.ts src/conversational-song-workspace-contract.test.ts src/manual-song-workspace-function.test.ts src/music-share-links-functions.test.ts src/public-music-share-portal.test.tsx src/song-rights.test.ts src/mission-task-deliverables.test.tsx src/manager-conversation-stream.test.ts src/music-manager-read-v2-workflow.test.ts src/app-error-high-fidelity-contract.test.ts
```

Expected: all pass without updating unrelated snapshots to hide regressions.

- [ ] **Step 4: Commit regression coverage**

Commit with `test: protect release success hub integrations`.

### Task 17: Verify complete error telemetry and retry truth

**Files:**
- Modify: `src/app-error-high-fidelity-contract.test.ts`
- Modify: `src/release-plan-change-function.test.ts`
- Modify: `src/release-opportunities.test.ts`
- Modify: `src/release-success-documents.test.tsx`

- [ ] **Step 1: Add controlled failure tests for every new boundary**

Assert central events contain these exact stage values when unexpected failures occur:

```text
subject_resolution
release_assessment
mission_read
opportunity_search
source_inspection
contact_verification
opportunity_persistence
document_generation
document_persistence
share_package_creation
reschedule_preview
reschedule_approval
schedule_recalculation
realtime_refresh
receipt_render
```

Each event must include available account/workspace/artist/song/conversation/run/mission/task/release-plan/request/opportunity/document IDs, request/trace ID, attempt, provider request ID, release version, and idempotency key. Assert prompt bodies, lyrics, documents, tokens, cookies, and signed URLs are scrubbed.

- [ ] **Step 2: Assert expected states are not logged as errors**

No verified contact, no match, excluded paid placement, Spotify ineligibility, request expiry, stale preview, and user rejection must return typed product states. Stale/expired approval may be a warning/product event but not an unexpected 500 error.

- [ ] **Step 3: Assert persistence truth**

Test these separately:

- transaction rolled back and no mutation persisted;
- transaction persisted but realtime refresh failed;
- research partially persisted and retry resumes only failed work;
- document generation succeeded but persistence failed, producing no phantom artifact; and
- central logging failed, preserving the original error and structured runtime log.

- [ ] **Step 4: Run telemetry tests and commit**

Run:

```powershell
npm test -- --run src/app-error-capture.test.ts src/app-error-high-fidelity-contract.test.ts src/release-plan-change-function.test.ts src/release-opportunities.test.ts src/release-success-documents.test.tsx
git diff --check
git add src/app-error-high-fidelity-contract.test.ts src/release-plan-change-function.test.ts src/release-opportunities.test.ts src/release-success-documents.test.tsx
git commit -m "test: cover release success failure telemetry"
```

Expected: all pass and no production logging architecture was added.

### Task 18: Final verification and CTO handback

**Files:**
- Modify: `docs/superpowers/plans/2026-08-12-video-one-release-success-implementation.md` only to check completed boxes during execution
- Create: no new summary document unless requested

- [ ] **Step 1: Run all focused feature suites**

```powershell
npm test -- --run src/release-success-schema.test.ts src/release-success-rpc-contract.test.ts src/release-success-readiness.test.ts src/release-success-schedule.test.ts src/release-plan-change-function.test.ts src/release-success-manager-tools.test.ts src/release-success-conversation.test.tsx src/release-opportunities-schema.test.ts src/release-opportunities.test.ts src/release-success-documents.test.tsx src/release-success-regression.test.ts
```

Expected: all pass.

- [ ] **Step 2: Run the complete test suite**

Run `npm test -- --run`.

Expected: zero failing tests. Do not claim success from focused tests alone.

- [ ] **Step 3: Build production**

Run `npm run build`.

Expected: Vite completes without TypeScript or bundle errors.

- [ ] **Step 4: Inspect scope and prohibited changes**

Run:

```powershell
git diff main...HEAD --check
git diff --name-only main...HEAD
git status --short
git log --oneline main..HEAD
```

Fail review if:

- any `src/prototype/**` or fixture repository changed;
- unrelated Hub navigation/design changed;
- a second mission/document/error/contact system exists;
- provider dates are overwritten;
- external send/submit code exists;
- tests were skipped or weakened; or
- unrelated untracked files are staged.

- [ ] **Step 5: Execute both manual acceptance flows**

Run the Phase B Video One flow and the Phase C/D playlist/press/EPK flow against production-like Supabase data. Capture the trace IDs, song ID, mission ID, request ID, receipt revision, opportunity IDs, document IDs, and share-link ID for the CTO review.

- [ ] **Step 6: Inspect central errors**

Query `app_error_events` for the captured trace IDs and current release version. Confirm no open unexpected feature error exists. If an expected controlled failure was exercised, verify the exact stage, fingerprint, IDs, scrubbing, and retry truth.

- [ ] **Step 7: Prepare the handback**

Report:

- branch and commit list;
- files changed grouped by schema/domain/Manager/UI/tests;
- focused/full/build command outputs;
- migration/RLS/RPC summary;
- Video One acceptance evidence;
- playlist/press/document acceptance evidence;
- cross-Hub regression evidence;
- telemetry query evidence;
- known limitations matching the approved V1 non-goals; and
- any deviation from this plan, with reason and CTO approval reference.

Do not merge, push to production, or delete the worktree unless the user separately authorizes it. The final implementation remains ready for GPT-5.6 Sol CTO inspection.

## Specification coverage map

Use this map during final self-review. Every row must have implementation evidence and passing tests.

| Approved requirement | Plan evidence |
| --- | --- |
| One existing Release Success Mission | Tasks 4, 5, 16 |
| Foundation versus campaign versus unknown | Tasks 3, 7, 10 |
| Deterministic preview and explicit approval | Tasks 2, 3, 5, 6, 9, 10 |
| Only release-bound deadlines move | Tasks 2–5 and Phase A/B gates |
| Keep-date recovery path | Tasks 7 and 10 |
| Persisted receipt survives refresh | Tasks 5, 8–10 |
| Playlist/press source-backed research | Tasks 11–13 |
| Spotify editorial kept separate | Tasks 12, 13, 15 |
| Verified public contact/link, no sending | Tasks 11–13, 15 |
| No fabricated or paid-guaranteed targets | Tasks 12, 13, 15 |
| Canonical EPK/pitch in Files/Mission/share | Task 14 |
| Existing share snapshots remain immutable | Tasks 14 and 16 |
| Lean OpenAI tools and approval boundaries | Tasks 7 and 13 |
| Existing telemetry with complete correlation | Tasks 6, 13, 17 |
| No hidden cross-Hub regressions | Tasks 16 and 18 |
| Video One recordable after core increments | Phase B gate |
| Playlist/press/EPK variants recordable later | Phase C/D gate |

## Luna Max stopping rules

Luna must stop and request CTO review if any of the following occurs:

- a migration must destructively rewrite existing rows;
- an applied migration appears to require editing;
- one-song/one-mission cannot be preserved;
- release-date authority remains ambiguous after reading current schema and source provenance;
- a date-only update would require replacing task IDs;
- canonical documents cannot appear in Files without creating a second copy;
- public contact verification requires scraping private or prohibited data;
- an external provider/API contract contradicts the source-confidence rules;
- a regression requires changing unrelated Hub behavior;
- a full-suite baseline failure cannot be separated from feature work; or
- central telemetry cannot distinguish rollback from persisted-success/refresh-failure.

These are design-boundary failures, not invitations to improvise.
