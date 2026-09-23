# OrderSounds Ops Control Plane Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a private mobile-first Ops app at `ops.ordersounds.com` that manages serious prospects, meetings, transcripts, follow-ups, Desk linking, and a computed Today queue without changing any customer Desk flow.

**Architecture:** Add four `ops_` tables and one shared internal-user allow-list to the existing Supabase project. A separate Vite app under `ops/` uses the normal Supabase user session and RLS; no service credential enters its bundle. Direct RLS covers ordinary Ops CRUD, while narrow database functions own cross-domain workspace search/linking and append-only activity.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, Supabase Auth/Postgres/RLS/Storage, Vercel

---

## Fixed decisions

- Deploy `ops/` as a separate Vercel project rooted at that directory. Desk remains built and deployed from the repository root.
- Create `ordersounds_operators` in PR 1, although the handover groups it under PR 2. This is the one internal operator allow-list for both surfaces: an active row grants access to the Ops control plane now and the Desk operator/admin surface in PR 2. Do not add a second admin table, a `desk_access_enabled` flag, or a separate login/role split; PR 2 reuses the same active-row gate while preserving its own least-privilege Desk policies.
- Use public `ops_` tables because the current project already exposes `public` through PostgREST. Enable RLS, revoke `anon`, and grant only required operations to `authenticated`.
- Store uploaded prospect music in a private `ops-music` bucket at `<ops_case_id>/<uuid>-<sanitized-name>`; store only the object path in `ops_cases.music_file_path`.
- Use `uuid` for `ops_meetings.desk_run_id`, matching `manager_synthesis_runs.id`.
- Keep stages coarse: `new`, `qualifying`, `meeting`, `activation`, `active`, `closed`. UI actions set them; users do not edit raw stage values.
- Do not add a `today_tasks` table. `list_ops_today_v1()` derives work from cases, meetings, and follow-ups.

## Current implementation map

**Additive files only**

- `supabase/migrations/<generated>_ordersounds_ops_control_plane.sql` - tables, constraints, indexes, RLS, storage policies, activity trigger, Today query, and workspace-link RPCs.
- `supabase/tests/ordersounds_ops_control_plane_smoke.sql` - transactional RLS, linkage, audit, and Today checks.
- `src/ordersounds-ops-schema.test.ts` - static migration contract and forbidden-scope assertions.
- `ops/package.json`, `ops/package-lock.json`, `ops/index.html`, `ops/vite.config.ts`, `ops/tsconfig.json` - isolated frontend build.
- `ops/src/main.tsx`, `ops/src/App.tsx`, `ops/src/index.css` - app entry, route shell, mobile layout.
- `ops/src/lib/supabase.ts`, `ops/src/lib/types.ts`, `ops/src/lib/opsService.ts`, `ops/src/lib/deriveNextAction.ts` - session, typed data access, writes, and deterministic presentation logic.
- `ops/src/features/auth/OpsSignIn.tsx` - sign-in only; no public sign-up.
- `ops/src/features/today/TodayScreen.tsx`
- `ops/src/features/pipeline/PipelineScreen.tsx`
- `ops/src/features/cases/CaseDetailScreen.tsx`
- `ops/src/features/cases/CaseIntakeScreen.tsx`
- `ops/src/features/cases/DeskWorkspaceLinker.tsx`
- `ops/src/features/meetings/MeetingsScreen.tsx`
- `ops/src/features/meetings/MeetingDetailScreen.tsx`
- `ops/src/components/OpsShell.tsx`, `ops/src/components/AsyncState.tsx`
- Co-located `*.test.ts` and `*.test.tsx` files for services and screens.
- `docs/runbooks/ordersounds-ops-deployment.md` - Vercel root, domain, environment, allow-list bootstrap, and rollback.

**Customer-critical paths that must remain untouched**

- `src/main.tsx`, `src/app/ProductionApp.tsx`, and `src/services/productionSupabase.ts`
- `public.account_memberships` and every customer membership policy
- `public.has_active_workspace_entitlement(...)`
- Paystack/Paddle functions, paywall, setup/discovery, Team, Manager, Mission, task, and invitation code
- Existing `music-uploads` and `workspace-documents` buckets

## Task 1: Create the migration and schema contract test

- [ ] **Step 1: Ask the installed CLI for the supported migration command**

Run:

```powershell
npx supabase migration new --help
npx supabase migration new ordersounds_ops_control_plane
```

Expected: one generated file ending in `_ordersounds_ops_control_plane.sql`. Do not hand-invent the timestamp.

- [ ] **Step 2: Write the failing schema contract test**

Create `src/ordersounds-ops-schema.test.ts`. Resolve the generated migration with `readdirSync`, assert exactly one matching filename, then assert that it contains:

```ts
const requiredTables = [
  "ordersounds_operators",
  "ops_cases",
  "ops_meetings",
  "ops_followups",
  "ops_activity",
];

const forbidden = [
  /alter table public\.account_memberships/i,
  /has_active_workspace_entitlement/i,
  /create table .*today_tasks/i,
  /service_role.*VITE_/i,
];
```

Also require RLS on all five tables, a private `ops-music` bucket, `list_ops_today_v1`, `list_ops_linkable_workspaces_v1`, and `link_ops_case_workspace_v1`.

- [ ] **Step 3: Run the focused test and confirm RED**

Run:

```powershell
npm test -- src/ordersounds-ops-schema.test.ts
```

Expected: FAIL because the migration is still empty.

- [ ] **Step 4: Implement the tables and constraints**

In the generated migration, implement the handover columns plus these correctness constraints:

```sql
create table public.ordersounds_operators (
  user_id uuid primary key references public.users(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ops_cases: all specified columns; defaults and checks below.
assigned_user_id uuid references public.users(id) on delete set null,
desk_workspace_id uuid references public.artist_workspaces(id) on delete set null,
stage text not null default 'new'
  check (stage in ('new','qualifying','meeting','activation','active','closed')),
release_timing text not null
  check (release_timing in ('upcoming','released','unknown')),
check (music_url is not null or music_file_path is not null),
check (primary_contact_email is not null or primary_contact_handle is not null)

-- ops_meetings additions to the specified shape.
ops_case_id uuid not null references public.ops_cases(id) on delete cascade,
owner_user_id uuid references public.users(id) on delete set null,
meeting_type text not null
  check (meeting_type in ('onboarding','check_in','monthly_review','other')),
outcome text check (outcome in ('ready_to_start','needs_follow_up','not_ready','inquiry_questions','not_a_fit')),
processing_status text not null default 'unprocessed'
  check (processing_status in ('unprocessed','processing','processed','failed')),
desk_run_id uuid references public.manager_synthesis_runs(id) on delete set null,
check (completed_at is null or scheduled_at is null or completed_at >= scheduled_at)

-- ops_followups.
ops_case_id uuid not null references public.ops_cases(id) on delete cascade,
assigned_user_id uuid references public.users(id) on delete set null,
check (completed_at is null or completed_at >= created_at)
```

Use `on delete cascade` from activity to case, with `actor_user_id references public.users(id) on delete set null`. Add `set_updated_at()` triggers to cases and meetings. Do not add budget, goals, audience, Mission, task, Team, memory, or evidence columns.

- [ ] **Step 5: Add indexes matching V1 queries**

Add:

```sql
create index ops_cases_stage_updated_idx on public.ops_cases(stage, updated_at desc);
create index ops_cases_assignee_stage_idx on public.ops_cases(assigned_user_id, stage);
create index ops_cases_workspace_idx on public.ops_cases(desk_workspace_id) where desk_workspace_id is not null;
create index ops_meetings_case_scheduled_idx on public.ops_meetings(ops_case_id, scheduled_at desc);
create index ops_meetings_processing_idx on public.ops_meetings(processing_status, completed_at desc);
create index ops_followups_open_due_idx on public.ops_followups(due_at, ops_case_id) where completed_at is null;
create index ops_activity_case_created_idx on public.ops_activity(ops_case_id, created_at desc);
```

- [ ] **Step 6: Commit the schema slice**

```powershell
git add src/ordersounds-ops-schema.test.ts supabase/migrations
git commit -m "feat: add OrderSounds Ops data model"
```

## Task 2: Lock the schema down with RLS and append-only audit

- [ ] **Step 1: Extend the failing contract test**

Require:

```ts
for (const table of requiredTables) {
  expect(sql).toMatch(new RegExp(`alter table public\\.${table} enable row level security`, "i"));
}
expect(sql).toMatch(/revoke all on table[\s\S]+from anon/i);
expect(sql).toMatch(/ops_activity[\s\S]+before update or delete[\s\S]+raise exception/i);
expect(sql).not.toMatch(/grant (?:all|delete)[\s\S]+ops_/i);
```

- [ ] **Step 2: Run RED**

Run `npm test -- src/ordersounds-ops-schema.test.ts`.

Expected: FAIL on missing policies and immutable audit guard.

- [ ] **Step 3: Add one private authorization helper**

Create `private.is_active_ordersounds_operator()` as `stable security definer set search_path = ''`. It must return true only when `(select auth.uid())` has an active row. Revoke execute from `public, anon`; grant schema usage and execute only to `authenticated`. Never inspect email or `user_metadata`.

- [ ] **Step 4: Add explicit operation policies**

For `ops_cases`, `ops_meetings`, and `ops_followups`, add separate `select`, `insert`, and `update` policies `to authenticated`; every predicate calls `(select private.is_active_ordersounds_operator())`. Update policies need both `using` and `with check`. Do not create delete policies.

For `ordersounds_operators`, allow an authenticated user to select only their own row; mutations remain service/admin SQL only. For `ops_activity`, allow select to active operators and insert only when `actor_user_id = (select auth.uid())`; block updates/deletes with an immutable trigger.

- [ ] **Step 5: Add database-owned activity for critical events**

Use trigger/RPC writes so the client cannot omit these events:

- `case_created`
- `meeting_created`
- `meeting_completed`
- `transcript_saved` (metadata contains length, never body)
- `followup_created` and `followup_completed`
- `desk_workspace_linked` and `desk_workspace_relinked`

Activity metadata must contain IDs and changed state only; never transcript text or uploaded file content.

- [ ] **Step 6: Commit authorization**

```powershell
git add src/ordersounds-ops-schema.test.ts supabase/migrations
git commit -m "feat: secure Ops data with operator RLS"
```

## Task 3: Add private music upload and workspace-link boundaries

- [ ] **Step 1: Add failing storage/link assertions**

Require a private `ops-music` bucket, a 50 MB limit, audio MIME allow-list, object policies scoped to an active operator, and a path whose first segment is a real `ops_cases.id`. Require the link RPC to accept `p_expected_current_workspace_id`.

- [ ] **Step 2: Run RED**

Run `npm test -- src/ordersounds-ops-schema.test.ts`.

- [ ] **Step 3: Implement storage**

Create private bucket `ops-music` with MIME types `audio/mpeg`, `audio/mp4`, `audio/wav`, `audio/x-wav`, `audio/flac`, and `audio/aac`. Add select/insert/update policies; no delete policy in V1. Validate the first path segment as UUID and verify that case exists. The frontend must reject files over 50 MB before upload.

- [ ] **Step 4: Implement narrow workspace search**

`list_ops_linkable_workspaces_v1(p_query text, p_limit integer default 20)` must:

1. Require an active operator.
2. Clamp limit to 1-50 and require at least two trimmed search characters.
3. Return only `artist_workspace_id`, `workspace_name`, `workspace_status`, `artist_name`, `account_id`, and `account_name`.
4. Search names and exact UUID; never return billing, membership, Team, profile, or entitlement records.

- [ ] **Step 5: Implement optimistic, audited linking**

`link_ops_case_workspace_v1(p_ops_case_id, p_artist_workspace_id, p_expected_current_workspace_id)` must lock the case row, verify the target workspace exists, reject stale expected IDs, update the link, and append linked/relinked activity with old/new workspace IDs. It must not mutate Desk tables.

- [ ] **Step 6: Commit**

```powershell
git add src/ordersounds-ops-schema.test.ts supabase/migrations
git commit -m "feat: add safe Ops uploads and Desk linking"
```

## Task 4: Implement the computed Today contract

- [ ] **Step 1: Write the SQL smoke fixture first**

Create `supabase/tests/ordersounds_ops_control_plane_smoke.sql` as a transaction. Seed an operator, non-operator, cases, meetings, and follow-ups. Assert this priority order:

```text
10 failed_processing
20 overdue_followup
30 meeting_today
40 transcript_missing
50 transcript_ready
60 desk_link_missing
```

For active-customer check-ins, use an open `ops_followups.kind = 'check_in'`; do not invent a recurrence engine.

- [ ] **Step 2: Implement `list_ops_today_v1(p_now timestamptz default now())`**

Return stable fields:

```ts
type OpsTodayItem = {
  itemKey: string;
  kind: "failed_processing" | "overdue_followup" | "meeting_today" | "transcript_missing" | "transcript_ready" | "desk_link_missing";
  priority: number;
  caseId: string;
  meetingId?: string;
  followupId?: string;
  displayName: string;
  reason: string;
  action: "Retry" | "Follow up" | "Open meeting" | "Paste transcript" | "Process in Desk" | "Link Desk";
  dueAt?: string;
};
```

Deduplicate by source record, not case: one case may correctly show an overdue follow-up and today's meeting. Order by priority, due time, then display name.

- [ ] **Step 3: Verify SQL behavior**

Run the smoke file against the disposable/local Supabase database used by the repository, then roll back. Expected: no exception and no persisted rows.

- [ ] **Step 4: Commit**

```powershell
git add supabase/tests/ordersounds_ops_control_plane_smoke.sql supabase/migrations
git commit -m "feat: derive the Ops Today queue"
```

## Task 5: Scaffold the isolated Ops app and authentication

- [ ] **Step 1: Create the app with pinned dependencies**

Under `ops/`, pin versions compatible with the root app: React 18.3.1, Supabase JS 2.106.2, Vite 5.4.19, TypeScript 5.8.3, Vitest 3.2.4, Testing Library, jsdom, and lucide-react 0.462.0. Commit `ops/package-lock.json`.

Required scripts:

```json
{
  "dev": "vite --host 127.0.0.1 --port 5180",
  "build": "tsc --noEmit && vite build",
  "test": "vitest run --environment jsdom"
}
```

- [ ] **Step 2: Write auth tests**

Test signed-out, signed-in non-operator, disabled operator, and active operator. Non/disabled operators must render a generic unavailable screen and no Ops data.

- [ ] **Step 3: Implement sign-in and access check**

`OpsSignIn.tsx` supports email/password sign-in only. `App.tsx` reads the session, then selects the caller's own `ordersounds_operators` row. Do not offer signup, inspect email suffix, or put role state in local storage.

- [ ] **Step 4: Build the route shell**

Use History API routes: `/`, `/pipeline`, `/meetings`, `/cases/new`, `/cases/:id`, `/meetings/:id`. Bottom navigation contains Today, Pipeline, Meetings. Case detail is never a top-level tab.

- [ ] **Step 5: Verify**

```powershell
npm --prefix ops test
npm --prefix ops run build
```

Expected: all tests pass and `ops/dist/index.html` exists.

- [ ] **Step 6: Commit**

```powershell
git add ops
git commit -m "feat: scaffold private Ops app"
```

## Task 6: Implement typed Ops services

- [ ] **Step 1: Write service tests with a fake Supabase client**

Cover list/load/create/update for cases, meetings, follow-ups, Today, activity, upload, workspace search, and linking. Assert that no service method reads Desk-domain tables directly except the two approved RPCs.

- [ ] **Step 2: Define types and validation**

In `ops/src/lib/types.ts`, use the exact database enums. In `opsService.ts`, reject empty display name, missing contact, missing music link/file, invalid release date for `unknown`, meeting completion without outcome, and processing attempts without transcript/link.

- [ ] **Step 3: Implement upload order safely**

Create the case first, upload to its case-prefixed path, then update `music_file_path`. If upload fails, keep the case and show retry; never silently create a second case.

- [ ] **Step 4: Implement deterministic next action**

`deriveNextAction.ts` applies the same order as Today, then `Book meeting` for new/qualifying, `Link Desk` for activation without a link, and `Schedule check-in` for active without an open follow-up. It does not persist a duplicate next-action field.

- [ ] **Step 5: Verify and commit**

```powershell
npm --prefix ops test
git add ops/src/lib
git commit -m "feat: add typed Ops data services"
```

## Task 7: Build Today, Pipeline, and intake

- [ ] **Step 1: Write component tests first**

Cover loading/error/empty/success states, mobile navigation, queue ordering, stage filtering, search, and intake conditional release date. Test visible labels: `Follow up`, `Book meeting`, `Paste transcript`, `Link Desk`, `Process in Desk`; prohibit CRM copy such as `opportunity lifecycle` and `disposition`.

- [ ] **Step 2: Implement Today**

Each card shows display name, one-line reason, due time when present, and exactly one primary action. Failed processing and overdue follow-ups remain visible.

- [ ] **Step 3: Implement Pipeline**

Search locally over the loaded V1 result set and filter by the six stages. Each row shows display name, release timing, assigned owner label, derived next action, and stage.

- [ ] **Step 4: Implement short intake**

Fields are only those in the handover. Music uses an exclusive link-or-file choice. Save creates one case and navigates to its detail page.

- [ ] **Step 5: Verify at mobile width and commit**

```powershell
npm --prefix ops test
npm --prefix ops run build
git add ops/src
git commit -m "feat: add Ops Today pipeline and intake"
```

Manual gate: at 390x844, no horizontal scroll, clipped controls, or hidden primary actions.

## Task 8: Build Case Detail, Meetings, follow-ups, and Desk linking

- [ ] **Step 1: Write component tests first**

Cover the one-scroll Case Detail order, transcript save, outcomes, quick follow-up dates, failed retry state, wrong-link confirmation, optimistic relink conflict, and absent prerequisites for processing.

- [ ] **Step 2: Implement Case Detail**

Render header, NEXT, release/music, contact, Desk link, meetings, and activity in that order. Do not add tabs. Use signed download URLs for private music; never make the bucket public.

- [ ] **Step 3: Implement Meetings screens**

Meetings has Today/Upcoming and Recent. Detail supports schedule/completion, owner, transcript textarea, outcome, processing state, follow-up shortcuts, and link back to the case. No recording, Whisper API, diarization, editor, or summary.

- [ ] **Step 4: Implement safe link confirmation**

Show artist, workspace, account, and current status before confirmation. Relinking requires the user to type the target artist/workspace name and sends the currently observed workspace ID as `p_expected_current_workspace_id`.

- [ ] **Step 5: Prepare the PR 2 handoff without a dead button**

Add `VITE_DESK_OPERATOR_URL` as optional. Show `Process in Desk` only when transcript, completed meeting, linked workspace, and this URL exist. The URL is:

```text
<VITE_DESK_OPERATOR_URL>/admin/workspaces/<desk_workspace_id>?opsMeetingId=<ops_meeting_id>
```

Until PR 2 deploys, show the processing state but not the action.

- [ ] **Step 6: Verify and commit**

```powershell
npm --prefix ops test
npm --prefix ops run build
git add ops/src ops/.env.example
git commit -m "feat: complete Ops case and meeting workflow"
```

## Task 9: Deployment, regression, and PR 1 merge gate

- [ ] **Step 1: Write the deployment runbook**

Document Vercel project root `ops`, build `npm run build`, output `dist`, domain `ops.ordersounds.com`, and browser-safe variables only: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, optional `VITE_DESK_OPERATOR_URL`. Bootstrap operators with reviewed SQL against known user UUIDs; never by email domain.

- [ ] **Step 2: Run database checks**

Use the installed CLI's documented commands (`npx supabase --help` first), apply to a disposable branch/local database, run `ordersounds_ops_control_plane_smoke.sql`, and run database advisors. Fix every security finding involving the new objects.

- [ ] **Step 3: Run application checks**

```powershell
npm --prefix ops test
npm --prefix ops run build
npm test -- src/ordersounds-ops-schema.test.ts src/main-branch-release-gates.test.ts
npm run build
git diff --check
```

Expected: all pass; root Desk build output remains `dist`, Ops output remains `ops/dist`.

- [ ] **Step 4: Execute the acceptance scenario**

As an active operator: create Donny Crown, attach music, book/complete meeting, paste transcript, select outcome, add follow-up, move to activation, search and confirm the real workspace link, and see correct Today cards. As non-operator: confirm no table rows, storage objects, link results, or useful error details are exposed.

- [ ] **Step 5: Review forbidden diffs**

```powershell
git diff --name-only HEAD~9..HEAD
```

Expected: no changes to customer membership, billing, entitlement, Team, onboarding, Manager, Mission, `ProductionApp`, or root Supabase service code.

- [ ] **Step 6: Merge gate**

Do not begin PR 2 until PR 1 is deployed to a preview/staging project, the full workflow above passes on a phone-sized viewport, and disabling/removing the Ops deployment has no effect on Desk.
