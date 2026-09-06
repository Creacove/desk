# Six-Person Artist Team Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` to implement this plan task by task. Steps use checkboxes for tracking. Do not begin implementation during the planning turn. Re-read the current working tree before editing; this plan is based on the inspected tree, not just the last commit.

**Goal:** Let one paying owner and up to five invited people work with the same Manager around one artist, with clear responsibility, personal execution views, shared artist state, and accountable continuation.

**Architecture:** Retain `accounts` as the collaboration/security boundary and `artist_workspaces` as the operating boundary. Extend the existing membership, task, runtime, billing, and operating-event systems. Add a small collaboration capability layer, one roster contract, and transactional membership/assignment operations; do not create organizations or a second Manager runtime.

**Tech stack:** React 18, TypeScript, Vite, Supabase Auth/Postgres/RLS/Realtime, Deno Edge Functions, Paddle with existing Paystack compatibility, Vitest, and the repository's real-Postgres CI jobs.

**Prepared:** Saturday, September 5, 2026. Meeting target: Monday, September 7, 2026, Africa/Lagos. Confirm the actual meeting hour before scheduling the final rehearsal.

**Confirmed commercial scope:** $99 USD/month; six people total, including the owner; one artist. Quantity at checkout is one workspace subscription, not six seat purchases.

**Naming:** Use **Team** as a provisional plan label and `team_6` as the stable internal plan key. It is not named “Desk.” Do not rename the existing application, repository, Manager, domains, or legacy strings as part of this work. Final public naming is a copy decision and must not affect database identifiers.

---

## 1. Executive decision

Build an authenticated, controlled team pilot first. Make Monday's claim specific: six people can share one artist, the Manager knows their responsibilities, each person sees their own executable work, and a blocker can lead to work for another member without fragmenting the artist's state.

The submitted plan is directionally sound but is not safe to implement verbatim. It omits commercial entitlements, assumes owner-only approval already exists, overlooks workspace selection, and treats reminder addressing as equivalent to recipient isolation. Several task producers also currently override assignment with an owner fallback.

The engineering lens here is critical-path ownership, bounded changes, measured behavior, and explicit release gates. This is our engineering judgment, not a claim about Greg Brockman's private views or an internal OpenAI process.

### Options considered

| Approach | Benefit | Cost/risk | Decision |
| --- | --- | --- | --- |
| Extend current account/runtime behind a pilot gate | Reuses working product; proves the central experience | Requires fixing multi-user assumptions throughout critical paths | **Recommended** |
| Build generic organizations, team workspaces, RBAC, chat | Flexible future platform | New security model, migration risk, much larger weekend scope | Reject for this release |
| Add a roster screen and manually assign demo tasks | Fast presentation | Does not establish Manager coordination or production readiness | Useful fallback only if clearly described as a walkthrough |

### Two separate acceptance milestones

**M1 — Monday pilot/demo:** real authenticated identities, real shared state, real access checks, six-seat enforcement, roster-aware generation, persistence, personal Today, correct in-app reminders, one cross-member blocker scenario, and solo regression. Pre-provisioned test users are acceptable. Public checkout and email invitations can remain hidden.

**M2 — customer-ready paid plan:** everything in M1 plus secure invite acceptance through signup/login, owner billing authority, verified `team_6` fulfillment/renewal/cancellation, upgrade handling, recipient privacy, real browser tests, provider sandbox verification, hosted canary, operational recovery, and release-runbook checks.

M1 is not authorization to sell an unfinished M2. If M1's access or persistence gates fail, present the existing working product and an explicitly labeled team walkthrough. Never weaken access control to meet the meeting date.

## 2. What the code actually contains

Paths below are relative to repository root `C:/Users/USER/Desktop/ai-record-label-prototype`. Function names are edit anchors; line positions will move. Existing paths were checked during this audit. New paths are explicitly labeled later.

| Area | Verified code | Consequence |
| --- | --- | --- |
| Membership | `supabase/migrations/20260526000100_core_operating_schema.sql`: `account_memberships`, roles `owner/member/admin_support`, status, unique `(account_id,user_id)` | Reuse; deactivate rather than delete membership history |
| Identity projection | Same migration: `public.users`; self-select RLS | Ordinary browser joins cannot be assumed to return other members' names; provide an authorized roster RPC |
| Membership visibility | Same migration: `account_memberships_member_select` allows account members to see account memberships | Querying the first visible membership is not a safe current-user selection strategy |
| Workspace loader | `src/services/productionSupabase.ts`: `createSupabaseWorkspaceLoader` selects active memberships with `.limit(1)`, no explicit current user filter, then latest workspace | Make user and workspace selection explicit before adding invitations |
| Human team UI | `src/features/settings/SettingsScreen.tsx` has Profile/Billing/Preferences/Account; `src/features/staff/StaffScreens.tsx` is AI staff | Add “Your team” to Settings; leave AI specialists intact |
| Task assignment | `20260829070000_manager_runtime_foundation.sql` adds `tasks.assignee_user_id` | Existing nullable column is the assignment destination; no parallel assignment table |
| Personal Today | `src/services/todayExecutionSupabase.ts` and `src/features/desk/todayProjection.ts` omit assignee/current viewer | Need loader, contract, projection, UI, and caller changes together |
| Permission decision | `supabase/functions/manager-permission-action/index.ts` checks `is_account_member` before service-role resolvers | “Owner approves” is new authorization work, not a preserved existing guarantee |
| Other approval bypass | `src/services/productionSupabase.ts`: `approveTask` directly updates task approval/status | Protect database writes as well as buttons and Edge Functions |
| Task execution | `manager-task-execution/index.ts` and `manager-review-task-result/index.ts` authenticate membership but do not enforce named assignee | Define and enforce owner/assignee execution authority at commit time |
| Initial graph tasks | `_shared/missionGraphPersistence.ts`, `writeMissionPlan` | Add validated assignment without breaking staged `manager_work` activation and the execution-step constraint |
| Replanned tasks | Latest `finalize_manager_replan_v1` is in `20260830213000_manager_live_failure_remediation.sql` | It writes an owner-selected assignee today; changing only TypeScript will lose routing |
| Review follow-up tasks | Latest `persist_manager_review_continuation()` is in that same migration | Also uses an owner-selected recipient; update this path too |
| Model contracts | `_shared/openaiManagerConversation.ts` re-exports contracts from `openaiManagerConversationLegacy.ts`; separate genesis, adaptive compiler, and result-review schemas exist | Add assignment fields to every actual producer/parser/schema, not just a new unused type |
| Reminders | SQL task lifecycle plus `_shared/reminders.ts` already use assignee and owner fallback | Preserve scheduling behavior; harden validation, processing races, and delivery |
| Reminder delivery | `manager-dispatcher/index.ts` inserts shared `operating_events`, recipient in JSON payload | Shared loaders currently omit the recipient; queue targeting alone does not make delivery personal |
| Notification permissions | Foundation migration grants account-wide modification on reminder queue/preferences | Replace overly broad policies for these personal/worker-owned records |
| Realtime | `src/services/workspaceLiveSync.ts`, `src/app/useWorkspaceLiveSync.ts` | Extend event invalidation and catch-up; do not introduce another subscription architecture |
| Attribution | Browser `writeOperatingEvent` writes `actor_type:user` without `actor_id`; mission mapping labels users “Artist” | Persist real actor identity and render roster name/fallback |
| Billing | `_shared/paddle.ts`: `readCanonicalPaddlePrice(interval)` knows Pro monthly/yearly only; checkout is interval-based | Six seats/$99 require a new plan identity, provider mapping, and verified capability |
| Existing beta access | `workspace_access_grants` is specifically tied to private-beta codes and checkout records | Do not overload it with fake paid subscriptions or invent a new grant shape without migration |
| Replan semantics | Runner instructions and SQL supersede nonterminal tasks when replacing a plan | Blocker continuation may replace a task ID; tests must follow logical work, not require an obsolete ID to reopen |
| Existing reliability | Runtime admission, stale-plan checks, dedupe, recovery, and real-Postgres CI already exist | Preserve them; six sessions must not multiply runtime work sixfold |

### Baseline and uncommitted work

Inspected HEAD: `dcbf5cf` (`fix: unblock paid subscription confirmation`). The working tree also contained:

- Modified `src/paddle-backend-contract.test.ts`.
- Modified `src/paid-workspace-setup-function.test.ts`.
- Modified `supabase/functions/paddle-process-webhooks/index.ts`.
- Modified `supabase/functions/paid-workspace-setup/index.ts`.
- Untracked `supabase/migrations/20260901000100_workspace_identity_boundary.sql`.
- Other untracked recovery/browser artifacts and an `AGENTS.md` containing NUL bytes rather than readable instructions.

Those changes are part of the current working product under review. Do not reset, overwrite, silently commit, or leave them behind by branching only from HEAD. The next implementation session must deliberately preserve the working-tree baseline and review the diff before modifying those files.

**Read-only baseline validation completed:** 7 focused Vitest files, 179 tests passed. Command:

```powershell
npm test -- src/manager-today-execution.test.ts src/manager-reminders.test.ts src/manager-adaptive-replan.test.ts src/manager-e2e-golden.test.ts src/production-supabase-service.test.ts src/paddle-backend-contract.test.ts src/paid-workspace-setup-function.test.ts
```

This is not a full release certification. No fresh database, hosted RLS, real payment, multi-browser, full-suite, or live model checks were performed in the planning turn. Existing “golden” TypeScript tests include source-contract checks; they are not proof of six authenticated browsers completing the scenario.

## 3. Product contract

### Included

- One workspace subscription for one artist; up to six active human seats including the owner.
- One owner for newly created team accounts; preserve historical owners if encountered, count every owner against seats, and flag legacy multi-owner accounts for review.
- Owners invite/remove members, edit operating responsibilities, reassign work, and approve consequential actions.
- Members see the shared artist workspace, talk to the same Manager, supply observations and task results, upload work, and execute work assigned to them.
- Every member sees the same missions, evidence, history, and canonical artist state. Shared conversations should be visibly described as shared; do not imply private chats.
- Assignment affects responsibility and personal presentation; it does not grant authority to spend, publish, accept a contract, change billing, or alter access.
- In-app task reminders only at first. The dispatcher deliberately skips unconfigured email/push/WhatsApp channels; do not advertise those as working.
- Six seats share existing workspace runtime budgets, concurrency limits, catalog, storage policies, and Manager capabilities. Do not advertise six times the AI capacity or unlimited usage.

### Explicit non-goals

No CBA-specific account hierarchy, course integration, faculty dashboard, grading, multi-artist team subscription, custom RBAC builder, team chat, comments, mentions, seat overages, annual Team billing, ownership transfer UI, or changes to which AI specialists are available. CBA can name an account/house and assign normal responsibilities.

### Seat rules

```text
occupied = active owner/member memberships
reserved = pending, unexpired invitations for people not already active
occupied + reserved <= 6
```

- Support-only memberships are excluded from sellable seats and from assignable roster candidates. No invite API can create support users.
- Creating an invitation reserves a seat. Expiry/revocation releases it.
- Acceptance exchanges a reservation for a membership in one transaction.
- An expired row with `status=pending` does not reserve a seat merely because cleanup has not run.
- An already-active recipient creates no additional reservation or seat.
- Repeated acceptance by the same authenticated person returns the same workspace/membership result; it never inserts twice. Another identity cannot reuse it.
- Lock the account before counting, inviting, accepting, reactivating, removing, or reconciling a plan. Simultaneous requests must not exceed six.

### Authority matrix

| Operation | Owner | Member | Support-only |
| --- | --- | --- | --- |
| Read shared artist workspace | Yes | Yes while eligible | Existing support access only; no new privileges |
| Read roster names/responsibilities | Yes | Yes | Excluded from normal team UX |
| Read pending invite emails/tokens | Owner sees emails; raw token only on issue/rotation | No | No via team API |
| Start/move/complete/report blocked | Any current human task; acting on behalf is attributed | Own assigned current task | No via team API |
| Execute an unassigned task | Claim/reassign first; solo owner fallback supported | No | No |
| Assign/reassign, invite/remove, change responsibilities | Yes | No in v1 | No |
| Approve permission, spend, release change, external send/share authorization | Yes | No | No new approval rights |
| Manage subscription/portal | Yes, with verified payer/workspace binding | No | No |
| Converse, supply observed facts, upload own deliverable | Yes | Yes | Existing support behavior only |

Existing shared music editing remains within the product's normal collaboration surface. A member observation must not be relabeled “artist-confirmed” merely because the authenticated speaker is a workspace member. Carry actor identity into understanding ingestion and distinguish owner confirmation from member evidence. Existing artist/owner authority remains the default until an explicit artist identity feature exists.

## 4. Data and service design

### 4.1 Extend membership and task records

Add these fields in new migrations, never by rewriting applied migrations:

```sql
alter table public.account_memberships
  add column operating_title text,
  add column responsibility_tags text[] not null default '{}',
  add column updated_at timestamptz not null default now();

alter table public.tasks
  add column assignment_reason text,
  add column assignment_source text,
  add column assignment_version integer not null default 0;
```

Validation: title nullable or trimmed 1–80 characters; at most 12 unique responsibility tags, each trimmed 1–48 characters; assignment reason nullable or at most 240 characters; source null or `manager`, `owner`, `solo_fallback`. Normalize/deduplicate tags without a fixed industry-job enum. The database must reject invalid writes, including service writes. New membership updates use the existing `set_updated_at` trigger convention.

Keep inactive members for provenance. Use `status='inactive'` for removal, not hard deletion. Existing membership PK and `(account_id,user_id)` uniqueness remain. A later valid invitation can reactivate the same row without reviving old task assignments.

### 4.2 Bind team capability to exactly one workspace

New table `workspace_team_settings`:

```sql
create table public.workspace_team_settings (
  account_id uuid primary key references public.accounts(id),
  artist_workspace_id uuid not null unique,
  artist_id uuid not null,
  enabled boolean not null default false,
  pilot_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (artist_workspace_id, account_id, artist_id)
    references public.artist_workspaces(id, account_id, artist_id)
);
```

The composite key above depends on the existing untracked `20260901000100_workspace_identity_boundary.sql`; include and verify that baseline migration before this table. If the implementation baseline has changed, verify the named unique constraint exists before applying the new migration.

`enabled` is an operator-controlled rollout gate, not a payment entitlement. `pilot_ends_at` is an explicit, expiring collaboration pilot permission; it does not create fake billing records or bypass base workspace access. Only service role can write settings. Browser reads use an authorized capability RPC, not direct privileged table reads.

Before enabling, assert the account has exactly one artist and exactly one artist workspace, including historical/archived rows, and that both match this row. Reject team activation on a legacy account containing another artist/workspace; do not silently share archived data through account-level RLS. Prevent another artist/workspace from being created under an existing team binding, even while the rollout switch is off. Do not auto-delete or migrate legacy data to make an account eligible. This deliberately conservative v1 rule preserves account-level RLS without inventing per-artist membership.

### 4.3 Commercial capability resolution

Add `billing_plan_catalog` with unique provider/product/price mapping, `plan_key` (`solo` or `team_6`), `billing_interval`, `seat_limit`, `artist_limit`, and `active`. Service-only writes. Map existing approved Pro prices to `solo`; add separately configured Team monthly price to `team_6`. Product IDs and price IDs come from the actual provider configuration; none are invented in migrations or tests.

Define an internal SQL function `_workspace_team_capability_v1(workspace_id)` and an authenticated wrapper `get_workspace_team_capability_v1(p_artist_workspace_id)` returning:

```ts
type WorkspaceTeamCapability = {
  accountId: string;
  artistWorkspaceId: string;
  artistId: string;
  planKey: "solo" | "team_6";
  enabled: boolean;
  entitled: boolean;
  source: "subscription" | "pilot" | "none";
  seatLimit: 1 | 6;
  occupiedSeats: number;
  reservedSeats: number;
  endsAt: string | null;
};
```

`entitled = base workspace entitlement AND (verified active team subscription OR unexpired explicit pilot)`. `enabled` must also be true for team mutation and AI delegation. The wrapper verifies the caller's current membership against the actual workspace scope. The internal function does not call the wrapper or depend on caller-controlled claims.

**Prevent a concrete recursion hazard:** the latest `has_active_workspace_entitlement` definition, in `20260714000200_hardened_multi_provider_billing.sql`, already calls `is_account_member`. Therefore a new `is_account_member → team capability → has_active_workspace_entitlement` chain would recurse. Extract its payment/time predicates into service-only `_workspace_has_base_access_v1(workspace_id)` with direct billing/grant reads, no `auth.uid()` predicate, and no membership-helper call. Preserve the latest provider-specific statuses (Paddle active/trialing; Paystack active/non-renewing/attention) and period/beta expiry rules. Both the existing public entitlement wrapper and internal Team resolver can consume that fact helper, but each public authorization boundary must still perform its own membership/identity check. Revoke public/authenticated execution on fact-only helpers. Add a test that evaluates member access and entitlement together on an enabled Team account without recursion and another showing an outsider cannot use the public wrapper to gain access.

Do not infer Team from amount, frontend selection, `accounts.plan`, user metadata, a success URL, a member's personal subscription, or arbitrary webhook `customData`. Preserve the existing paid/beta entitlement logic; Team is an additional capability.

For a configured team account, non-owner access must additionally require this capability and the bound workspace. Enforce that in the database membership/access helper and service mutation checks, not only in routing. Owner recovery/billing access remains available. Preserve old behavior for accounts with no team configuration. Do not globally demote or delete members when billing lapses.

On cancellation scheduled for period end, retain access through the verified period under existing entitlement rules. At effective expiry/downgrade: deny new member operations and non-owner workspace access, cancel unsent personal reminders, keep records/history, and show owners a recovery state. A verified renewal/re-upgrade restores eligibility without recreating memberships. A webhook delay may delay restoration; it must never create six seats from an unverified purchase.

The deadline path uses an existing entitled internal account plus an explicit pilot end time. Paid new purchases and existing-subscriber upgrades remain gated until their distinct tests pass.

### 4.4 Canonical roster

New shared file `_shared/workspaceRoster.ts` exports these contracts:

```ts
export type WorkspaceScope = {
  accountId: string;
  artistWorkspaceId: string;
  artistId: string;
};

export type WorkspaceMember = {
  userId: string;
  displayName: string;
  accessRole: "owner" | "member";
  operatingTitle: string | null;
  responsibilityTags: string[];
};

export type WorkspaceRoster = {
  scope: WorkspaceScope;
  members: WorkspaceMember[];
  loadedAt: string;
};
```

`loadActiveWorkspaceRoster(db, scope)` calls `get_workspace_roster_v1(p_artist_workspace_id)`; it never looks up by email or trusts model IDs. Authenticated calls require membership. Service calls require an explicit validated scope. The RPC joins `public.users` internally, returns active owner/member users only, and excludes inactive users and support. Sort owner first, then membership creation time, then user ID. Resolve missing name as “Team member” rather than exposing an email to the model.

Owner invite management uses a separate response containing invite email; ordinary roster/model responses omit email. Do not expand `users_self_select` into a globally readable users directory.

Fetch a fresh roster on each new generation/review run. Do not persist a second canonical roster in world-model memory. Treat names/titles/tags as untrusted data, not instructions. Bound the model roster to six humans with the validated field limits. If loading fails, report a degraded run, continue reasoning without delegation, and persist new work unassigned. A security/access failure is not a reason to return another account's roster.

### 4.5 Invitation record and API

Use `account_invitations`, not `workspace_invitations`, because membership is account-scoped. Store the bound workspace for unambiguous navigation and scope validation.

Fields: `id uuid`, `account_id`, `artist_workspace_id`, normalized `email`, `invited_by_user_id`, unique `token_hash`, `status` (`pending/accepted/expired/revoked`), `expires_at`, `accepted_by_user_id`, `accepted_at`, `created_at`, `updated_at`. Add indexes on account/status/expiry and account/lower(email). Only one pending row per account/email; mark expired pending rows before issuing a replacement. Store optional proposed operating title/tags so the owner can configure the recipient before acceptance.

Token: 32 cryptographically random bytes, base64url encoded, SHA-256 stored. Seven-day expiry. Raw token returned only by create/rotate; no database raw-token field, analytics event, activity event, or error context. Lost token means rotate, not recover. All timestamps are server timestamps.

Create one Edge Function `account-team` with POST operations:

```ts
type TeamOperation =
  | { action: "invite"; artistWorkspaceId: string; email: string; operatingTitle: string | null; responsibilityTags: string[] }
  | { action: "rotate_invite"; invitationId: string }
  | { action: "revoke_invite"; invitationId: string }
  | { action: "accept_invite"; token: string }
  | { action: "remove_member"; artistWorkspaceId: string; memberUserId: string }
  | { action: "update_responsibilities"; artistWorkspaceId: string; memberUserId: string; operatingTitle: string | null; responsibilityTags: string[] }
  | { action: "reassign_task"; taskId: string; assigneeUserId: string | null; expectedAssignmentVersion: number };
```

Each operation authenticates with `auth.getUser()`, derives actor ID and verified email from Auth, and calls a transaction RPC. Do not accept actor ID, role, plan, seat limit, or account ownership from request JSON. A service-only acceptance RPC receives the server-verified actor/email; revoke its execution from `PUBLIC`, `anon`, and `authenticated`. Prefer authenticated RPCs using `auth.uid()` for owner mutations; if an Edge service client invokes them, explicitly check the server-verified actor inside the transaction too.

RPC names: `invite_account_member_v1`, `rotate_account_invitation_v1`, `accept_account_invitation_v1`, `revoke_account_invitation_v1`, `remove_account_member_v1`, `update_member_responsibilities_v1`, `reassign_workspace_task_v1`.

Creation/rotation: at most 20 attempts/account/hour and 3/email/hour, persisted server-side and enforced atomically. Use a small `account_team_request_log` with account, normalized-email hash, operation, timestamp; no raw tokens. Return 429 and retry-after on exhaustion. This is internal abuse protection, not a new analytics system.

Return 400 for malformed input, 401 unauthenticated, 403 insufficient authority/wrong recipient, 404 unavailable resource, 409 full team/already changed, 410 expired/revoked token, and 429 rate limit. Do not reveal whether an arbitrary email has an existing account.

### 4.6 Assignment and transaction rules

The model proposes. The server validates. The database enforces the invariant at the final write.

```ts
export type TaskAssignmentProposal = {
  assigneeUserId: string | null;
  assignmentReason: string | null;
};
```

Extend actual model tasks with these two nullable fields. In strict JSON schemas both fields belong in `required`; nullable is different from optional. Legacy persisted output without them normalizes to null. Unknown/cross-account/inactive/support IDs normalize to null for model output and log `assignment_validation_failed`; explicit owner API requests with invalid IDs are rejected without changing the task.

Assignment priority:

1. Clear responsibility match among the supplied active roster.
2. Owner for explicit owner decisions and single-person legacy fallback.
3. Null for unresolved/ambiguous operational ownership. Surface under “Needs an owner.”

Never assign `manager_work`. Never interpret a responsibility title as authorization. If responsibilities overlap, do not invent a designated lead or infer one from array order. Do not reassign existing work merely because somebody edited their title.

Add database functions to resolve/validate model proposals and owner requests against active membership and matching account/workspace/artist. Acquire the account lock before task locks for all collaboration mutations and removal; document this lock order to avoid deadlocks. Revalidate after any model call before publishing the task/result; the roster may have changed while the model was running.

Task assignment changes increment `assignment_version`, preserve task/mission IDs, write an attributed event, and invoke existing reminder lifecycle rebuilding. Reassigning a terminal task is rejected. Stale version returns 409 with current assignment so the UI can reload.

Removal is one transaction: protect owners from removal in v1, deactivate the membership, null all nonterminal task assignments for that user in the bound workspace, increment versions, cancel queued/processing unsent reminders, and emit one shared removal event plus scoped task invalidations. Completed task attribution is retained. Owner sees newly unassigned work. Requests already in progress must recheck membership before persisting effects.

### 4.7 Mutation authority and direct-write protection

Hiding controls is not enforcement. Implement `assertWorkspaceOperation(db, { scope, actorUserId, operation, taskId? })` in `_shared/workspaceAuthorization.ts`, with operations `manage_team`, `approve`, `billing`, `execute_task`, `contribute`. All service-role paths call it. Its database commit operations repeat the membership/role/version check after slow provider/model work.

Protect direct SQL/PostgREST paths too. Replace overlapping permissive policies rather than merely adding a stricter permissive policy (permissive policies combine with OR). Cover:

- Membership/invitation/settings/catalog writes: RPC/service only.
- `tasks`: ordinary clients cannot change scope, assignee, assignment reason/source/version, approval state, generated task graph, or terminal result state outside the authorized operation.
- `task_results`, `task_state_events`, `task_steps`, deliverable finalization: cannot forge another person's result or change another person's execution through a direct insert/update/delete.
- `permission_requests`, permission execution receipts, release-date decisions, document approval/share activation, split-confirmation sends: owner-authorized commit, including service-role entrypoints and database resolvers.
- `reminder_queue`: worker/service writes only; recipient reads only if needed, otherwise no browser access.
- `notification_preferences`: self-only rows plus current workspace membership; owner cannot edit another person's preferences by direct request.
- `operating_events`: client user events must have actor ID equal to `auth.uid()`; clients cannot forge Manager events or recipient targeting.

Inventory current callers before revoking grants. Migrate required callers to the protected API in the same release so existing solo actions continue. Do not broadly revoke all workspace writes without updating their legitimate paths. For any external-effect path not hardened by M1, deny it to non-owners on the server; do not rely on a demo attendee avoiding its button.

### 4.8 Personal notifications over shared activity

Add nullable `operating_events.recipient_user_id` with user FK and an index supporting workspace/recipient/time reads. Shared state events have null. Personal reminders have the actual user ID.

For authenticated selection use account/workspace access AND `(recipient_user_id is null OR recipient_user_id = auth.uid())`. Replace existing broad select policies where necessary. Keep actual task status events shared so the whole team sees progress; only personal nudges are private. Backfill valid legacy reminder payload recipients, and suppress/quarantine malformed reminder rows rather than broadcasting them. Historical non-reminder activity remains shared.

The dispatcher must not simply check whether a task is terminal. Add service-only transaction `deliver_in_app_task_reminder_v1(p_reminder_id)` which locks in the agreed order, rechecks membership, capability, current assignment/version, active task/plan, channel and preference, inserts the personal event idempotently, and marks it sent. If reassigned/removed/expired, skip/cancel. A cancelled processing reminder must not later be marked sent by a stale worker. For null-assignee owner fallback, label the event as unassigned work needing ownership.

No external delivery adapter is added in M1. Previously delivered reminders cannot be unsent; stale action links must reload and reject old authority. “No ghost reminders” means no new delivery after reassignment/removal commits, not deletion of history or previously received messages.

## 5. UX and runtime behavior

### Workspace selection and invitation routing

- `loadActiveWorkspace(user, selection?)` explicitly filters `account_memberships.user_id=user.id` and active status.
- Selection priority: accepted invite's workspace, valid stored workspace for that user, the only eligible workspace, otherwise a small explicit workspace chooser. No unordered first row.
- Store selection under a user-scoped key. Verify it on every session bootstrap. A local-storage ID is never authorization.
- Render `/join` before checkout/new-artist onboarding. Carry token in URL fragment, move it to session storage, strip it from the displayed URL immediately, and never emit it to analytics. Retain only through the current acceptance/auth flow; clear on terminal acceptance/revocation/explicit cancel.
- New users sign up/verify email, then accept. Existing users sign in, then accept. The verified auth email must match; do not trust editable user metadata or a posted email.
- Joining never calls paid checkout, `create_initial_artist_workspace`, Spotify import, or artist setup. It opens the existing artist.
- Users who already own another workspace keep it; accepting does not merge, rename, or overwrite anything. All reload callers preserve the selected workspace.
- On removal or loss of eligibility: clear that workspace's cached data, unsubscribe, discard in-flight loads, show access unavailable/chooser, and avoid rendering stale private content. Already viewed information cannot be recalled.

### Settings → Your team

Display artist name, “X of 6 people,” active humans with responsibility titles/tags, and pending invitations separately. Owner controls: Add someone, edit responsibilities, assign/reassign, revoke invitation, remove member. Member view: roster only. Owner is visibly protected from removal. Use existing controls and visual primitives; no redesign of the whole Settings screen.

States: loading skeleton, failed load with Retry, no additional members, full team, pending invitation, expired invitation, resend/rotate link, saving, failed save preserving draft, expired Team access, unsupported multi-artist account. Copy-link functionality is available even if email delivery fails; email failure is shown honestly. Never show “email sent” before provider confirmation.

Invite email reuses `_shared/accessEmails.ts` and existing `transactional_email_deliveries` dedupe/status conventions. A join URL authorizes acceptance only for the intended verified identity. Link previews must not consume it. Owner chooses whether to send or copy the link.

### Today

Preserve current plan/checkpoint/date/approval filtering and priority ordering. Classify ownership before selecting the primary/top supporting actions; filtering after `.slice()` would hide a user's work behind teammates' work.

New projection sections:

- **Needs you:** own executable tasks and authorized questions; owner-only approvals.
- **Needs an owner:** visible/actionable to the owner, never advertised as every member's personal work.
- **Team:** compact shared state with assignee name and status, read-only controls for another person's task.
- **Manager is working/watching:** existing machine and reality-wait presentation.

For solo accounts, null-assignee legacy work remains actionable for the single owner. For six-person accounts, null does not mean everyone. A member with no personal work sees “No action needed from you right now” and shared team context.

Questions tied to a task route to its assignee; workspace/mission questions without a task default to owner. Permission decisions always route to owner. Enforce answer authority in the corresponding context-answer mutation, including conversation continuation, and make stale/double answers idempotent or return conflict. Do not create six copies of one question/permission.

Update Mission task sheets and work surfaces too; Today alone is not the only route to execution. Deep links and cached views recheck current authority before starting, moving, uploading, approving, completing, or reporting a blocker.

### Manager context and continuation

Put `activeTeam` into canonical context for conversation, genesis, adaptive replan, and task-result review. Keep it through reduced/compacted context (`compact...`/reduction branches in `manager-conversation/context.ts`), including continued conversation turns. Add viewer identity separately as `requestingUser`; never replace artist identity with the current teammate.

All three persistence families must honor validated assignment:

1. Mission graph creation from conversation/genesis.
2. Adaptive replacement plan SQL.
3. Result-review follow-up SQL trigger.

Cross-member blocker example: Sarah reports “Final master missing.” Manager reads roster and actual evidence, identifies Daniel's recording responsibility, creates an executable master-delivery task for Daniel, and keeps the original mission blocked/waiting until evidence supports resuming distribution. Daniel's completion wakes the existing continuation system, which re-evaluates Sarah's work. It must not mark the master received solely because a task status changed without the required evidence.

Use existing `artifact_links` relationships (`blocks`, `unblocks`, `depends_on`, `supersedes`) to record cross-task provenance; no new dependency engine. Generated follow-ups carry an optional source-task reference validated to the same mission/workspace. Dedupe on the source event/result and stable follow-up key, not an unconstrained retry or only a changing title.

If a replan supersedes Sarah's old task, the current replacement task remains assigned to Sarah and links to the previous logical work. Do not reopen a superseded task or create both an old and new actionable copy. Preserve admission limits, per-mission locks, stale-plan checks, task quality requirements, and current recovery behavior.

## 6. Implementation sequence

The tasks below are ordered by dependency. Each numbered checkbox is a concrete action. Use small commits per completed task after tests. Do not merge or deploy any task with a partially enabled team surface. Code blocks define required interfaces/logic; implement surrounding error handling and database operations to the explicit rules above, not by copying an incomplete sample as a finished function.

### Integration boundaries

Use three sequential review units, each based on the verified previous unit. Small internal commits are encouraged; these are not three parallel branches changing the same large files.

| Review unit | Tasks | Enablement |
| --- | --- | --- |
| 1. Collaborative identity and authority | 0–4, 6; relevant checks from 11 | Capability stays disabled for ordinary accounts; public invitation UI may remain hidden |
| 2. Multi-human Manager pilot | 5, 7–9; M1 checks from 11 | Enable one controlled internal workspace after all M1 gates pass |
| 3. Paid self-service Team | Complete public parts of 2–3, 10; M2 checks from 11 | Expose invites and $99 plan only after billing/auth/provider/hosted gates pass |

One implementation owner must review the entire vertical flow across these units. Do not allocate frontend and backend independent definitions of “member,” “owner,” “six seats,” or “entitled.” An unfinished later unit must not require enabling unfinished controls in an earlier one.

### Task 0 — Preserve and characterize the baseline (M1 prerequisite)

**Read:** the four modified code/test files above, the untracked identity migration, `docs/production-release-runbook.md`, `.github/workflows/ci.yml`, `.github/workflows/manager-runtime-safety.yml`.

**Create:** `docs/operations/team-release-evidence.md`.

- [ ] Run `git status --short`, `git diff --stat`, `git diff -- supabase/functions/paddle-process-webhooks/index.ts supabase/functions/paid-workspace-setup/index.ts`, and `git rev-parse HEAD`.
- [ ] Preserve the current uncommitted changes in the chosen implementation checkout. If using a worktree, explicitly carry the reviewed working-tree state; do not use a clean HEAD-only worktree and assume equivalence.
- [ ] Record baseline SHA, working-tree diff, Node version, and test results in the evidence file; never include secrets.
- [ ] Run the focused command in section 2. Expected: 7 files/179 tests on the audited baseline, or document changes if the baseline has moved.
- [ ] Establish full `npm test`, `npm run build`, browser type-regression, Deno, and fresh-DB baseline through the existing CI jobs before rollout. Classify failures; do not silently allowlist them.
- [ ] Record which migration history/environment is being tested. No local reset command may point at hosted production.

**Done when:** the implementer can reproduce the current product without losing payment/setup fixes and can distinguish existing failures from newly introduced ones.

### Task 1 — Capability, roster, and one-artist boundary (M1)

**Create:**

- `supabase/migrations/20260905000100_artist_team_foundation.sql`.
- `supabase/functions/_shared/workspaceRoster.ts`.
- `supabase/functions/_shared/workspaceAuthorization.ts`.
- `src/types/workspaceTeam.ts`.
- `src/services/workspaceTeamService.ts`.
- `src/workspace-team-roster.test.ts`.
- `supabase/tests/artist_team_foundation_smoke.sql`.

**Modify:** `_shared/entitlements.ts` only to expose separate team capability checks; preserve `assertActiveWorkspaceEntitlement` semantics. Extend the database access helper with the configured-team access/bound-workspace rule and the non-recursive base-access extraction described in section 4.3.

- [ ] Write SQL fixture accounts A/B, one owner plus members/support/inactive users, and two artists in a legacy account. Seed Auth/public user IDs consistently with existing smoke-test conventions.
- [ ] Test roster identity isolation, support/inactive exclusion, private-email omission, and false access from mismatched account/workspace/artist.
- [ ] Add membership/task columns, settings/catalog schema, capability/internal helpers, and authorized roster RPC with explicit grants/search paths.
- [ ] Implement the shared roster loader and browser service using the same serialized contract; no browser service-role key.
- [ ] Add tests showing one-artist enabling succeeds, a second artist/workspace is rejected even if archived, disabled/expired pilot fails, and a normal solo account remains accessible.
- [ ] Test both authenticated and service callers; the service path must still validate the supplied composite scope.
- [ ] Run `npm test -- src/workspace-team-roster.test.ts` and real SQL smoke. Expected: correct scoped names and capability; no global users-directory exposure.

**Done when:** an existing entitled pilot workspace can return an authenticated six-seat capability and safe roster while every other account remains unchanged.

### Task 2 — Transactional invitations, removal, and reassignment (M1 backend; M2 public invitations)

**Create:**

- `supabase/migrations/20260905000200_artist_team_membership_operations.sql`.
- `supabase/functions/account-team/index.ts`.
- `src/account-team-function.test.ts`.
- `supabase/tests/artist_team_membership_smoke.sql`.
- `supabase/tests/artist_team_seat_concurrency_setup.sql`.
- `supabase/tests/artist_team_seat_concurrency_verify.sql`.

**Modify:** `supabase/config.toml` for the new function using existing authenticated-function conventions; `_shared/accessEmails.ts` for invite email in M2.

- [ ] Create failing behavioral tests for every operation/status in section 4.5; test transaction RPCs with authenticated identities rather than text-searching the migration.
- [ ] Implement hashed invitation lifecycle, verified-email acceptance, expiration, seat reservation, rate limits, and account-first locks.
- [ ] Acceptance upserts `public.users` from server-verified Auth identity before membership; a newly registered user may not yet have a public user row.
- [ ] Implement remove/protect-owner/reactivate behavior, unassigning only nonterminal work and preserving actor history.
- [ ] Implement reassignment with expected version, scope checks, invalid-ID rejection, event creation, and reminder rebuilding.
- [ ] Run two independent database sessions against the final available seat. Verify at most one successful new reservation/membership and never seven occupied/reserved seats.
- [ ] Simultaneously accept/revoke and accept/remove/reactivate; verify deterministic serialized outcomes and no hidden extra membership.
- [ ] Exercise direct REST/RPC attempts as member, outsider, expired invite, wrong email, unverified email, reused token, and removed user.
- [ ] Verify error capture never stores raw request tokens or full join URLs. Add explicit redaction tests for `account-team` errors.

**Done when:** all membership mutations are safe under concurrency; no UI is needed to enforce six seats.

### Task 3 — Explicit workspace selection and join entry (M1 selection; M2 public join)

**Modify:** `src/types/productionApp.ts`, `src/services/productionSupabase.ts`, `src/services/fixtureRepositories.ts` where contracts require it, `src/app/ProductionApp.tsx`, `src/features/onboarding/FrontDoorAuth.tsx`.

**Create:** `src/features/team/AcceptTeamInvitation.tsx`, `src/features/team/WorkspaceChooser.tsx`, `src/services/teamInviteRoute.ts`, `src/team-invite-route.test.ts`, `src/workspace-selection.test.ts`, `src/team-join-flow.test.tsx`.

- [ ] Extend the existing loader signature without dropping the existing `ProductionUser` argument:

```ts
loadActiveWorkspace(
  user: ProductionUser,
  selection?: { artistWorkspaceId?: string }
): Promise<ProductionWorkspace | null>;
```

- [ ] Add a loader operation to list eligible workspaces for the explicit chooser; include current membership role and capability in each workspace model.
- [ ] Filter memberships by user ID before selecting an account. Resolve exact workspace selection; never choose a teammate's visible membership.
- [ ] Update every `loadActiveWorkspace` caller, including setup retries, access refresh, realtime reconciliation, and billing return, to preserve selection.
- [ ] Put join routing before checkout/profile/Spotify setup gates. Suppress normal workspace auto-creation while a join token is pending.
- [ ] Implement fragment/session-storage handling and auth resume; verify no token appears in telemetry, route logs, or server-rendered links.
- [ ] Test an existing owner joining another artist and switching back; test fresh signup/verified acceptance without creating a second artist or billing checkout.
- [ ] Test removed/stale stored workspace selection and a late response from a previously selected workspace; neither can overwrite current workspace state.

**Done when:** two users enter the same real workspace deterministically, and joining does not accidentally trigger the solo purchase/setup funnel.

### Task 4 — Enforce task and approval authority (M1)

**Create:** `supabase/migrations/20260905000300_artist_team_authority.sql`, `src/workspace-team-authority.test.ts`, `supabase/tests/artist_team_authority_smoke.sql`.

**Modify:** `_shared/workspaceAuthorization.ts`, `manager-task-execution/index.ts`, `manager-review-task-result/index.ts`, `manager-permission-action/index.ts`, `task-document-upload/index.ts`, `send-split-confirmations/index.ts`, `music-share-links/index.ts`, `release-plan-change/index.ts`, `manager-conversation/index.ts`, `manager-artist-understanding/index.ts`, `paddle-customer-portal/index.ts`, `paddle-create-checkout/index.ts`, `src/services/productionSupabase.ts`, `src/services/taskExecutionClient.ts`.

**Inspect and update the actual existing approval RPC definitions through a new migration:** `resolve_manager_permission_v1`, `resolve_manager_decision_permission_v1`, `approve_song_document_for_sharing_v1`, and `approve_release_date_change` (called by `release-plan-change/index.ts`). Also replace `capture_artist_understanding_from_operating_fact_v1()` from `20260829180100_artist_understanding_source_capture.sql` so member facts do not become artist-confirmed automatically.

- [ ] Write matrix tests: member executes own task, owner executes on behalf, wrong member denied, support denied, removed member denied, member approval/portal request denied.
- [ ] Add assignee/version to task loaders and authenticated operation contracts; do not use the supplied account ID as proof of access.
- [ ] Replace direct `approveTask` table mutation with owner-authorized RPC/endpoint while retaining its existing UI behavior for owners.
- [ ] Protect database role/scope/assignee/approval fields and direct result/event writes; audit overlapping `FOR ALL` policies and table grants.
- [ ] Revalidate membership, assignment version, active plan, and task status when committing after model review/upload finalization. Return 409 for superseded/reassigned work; preserve uploaded artifact for a legitimate retry.
- [ ] Preserve review idempotency and existing completion uniqueness. Concurrent duplicate completion creates one accepted result and one continuation, not two model effects.
- [ ] Ensure member conversation/tool requests cannot approve an action or write an owner-confirmed decision by bypassing the visible permission UI. Include understanding ingestion in this audit.
- [ ] Add nullable `conversation_messages.authored_by_user_id` referencing `public.users`, populated from verified Auth for new human messages; keep the existing speaker enum for compatibility. Use existing `manager_context_answers.created_by_user_id` and retain source actor identity on operating facts. Store a server-derived role-at-submission snapshot in source metadata so later role changes cannot rewrite historical authority. Null/unknown actors never gain new confirmation authority; preserve existing historical records without guessing their authors.
- [ ] In `manager-artist-understanding/index.ts`, `loadSourceMaterial` currently treats human conversation/context answers as artist-confirmed. Change new Team member material to `supported` with a member-specific source label; only authorized owner confirmation may use the existing highest-authority route. Apply the same rule in the operating-fact trigger. Test a member contradicting existing artist-confirmed meaning: the statement is retained as attributed evidence without silently overwriting the higher-authority fact.
- [ ] Run direct SQL/REST probes for protected fields and all authority tests. All negative cases must fail before external effects.

**Done when:** permissions match the product contract even with crafted requests and stale browser tabs. This task is a prerequisite to giving another human pilot access.

### Task 5 — Roster-aware model contracts and every persistence path (M1)

**Modify:**

- `supabase/functions/_shared/managerHumanTaskGenerationContract.ts`.
- `supabase/functions/_shared/openaiManagerConversationLegacy.ts` and `openaiManagerConversation.ts`.
- `supabase/functions/_shared/openaiMissionGenesis.ts`.
- `supabase/functions/_shared/openaiAdaptivePlanCompiler.ts`.
- `supabase/functions/_shared/manager-conversation/context.ts`.
- `supabase/functions/manager-conversation/index.ts`.
- `supabase/functions/mission-genesis/index.ts` (`buildArtistOperatingPacket`).
- `supabase/functions/manager-runtime-runner/index.ts` (`buildRuntimeContext`).
- `supabase/functions/manager-review-task-result/index.ts` (context, follow-up schema, persistence).
- `supabase/functions/_shared/missionGraphPersistence.ts`.

**Create:** `supabase/functions/_shared/taskAssignment.ts`, `supabase/migrations/20260905000400_artist_team_runtime_assignment.sql`, `src/manager-team-assignment.test.ts`, `src/manager-team-context.test.ts`, `supabase/tests/artist_team_assignment_smoke.sql`.

- [ ] Add failing tests for valid routing, invalid/stale IDs, support exclusion, null ambiguity, machine work, legacy output, and responsibility text containing instructions.
- [ ] Add `assigneeUserId` and `assignmentReason` to source types, JSON properties/required lists, parsers, normalization, and repair paths. For nullable fields use `type: ["string", "null"]`; do not relax `additionalProperties:false` globally.
- [ ] Put fresh `activeTeam` into all four contexts and into compact/reduced conversation representations. Test first and subsequent turns.
- [ ] Add bounded instructions that choose only from supplied IDs and explicitly separate execution responsibility from approval authority.
- [ ] Implement model normalization against roster and database final-write validation. UI-originated invalid reassignments return error rather than silently nulling.
- [ ] In graph persistence, stage tasks without a human assignee while `work_mode=manager_work`; activate real work mode and validated assignee together only after execution steps exist. Otherwise the no-assignment-on-machine-work invariant will conflict with current staging.
- [ ] Replace the latest definitions of `finalize_manager_replan_v1` and `persist_manager_review_continuation()` in a **new** migration, preserving all latest guards from `20260830213000_manager_live_failure_remediation.sql`. Do not edit only the older August 29 functions.
- [ ] Persist assignment/reason/source through all three families. For legacy solo payloads preserve owner fallback; for ambiguous Team payloads keep null.
- [ ] Recheck removal/downgrade between model response and SQL commit. Simulate it in a real database test.
- [ ] Keep existing quality gate and repair loops. A correct assignee does not excuse a non-executable task or hallucinated resources.

**Done when:** a member assignment survives conversation/genesis creation, adaptive replan, and review-generated follow-up, and never points outside the active artist team.

### Task 6 — Human roster setup UI (M1)

**Create:** `src/features/team/YourTeamPanel.tsx`, `src/features/team/MemberResponsibilitiesForm.tsx`, `src/your-team-panel.test.tsx`.

**Modify:** `src/features/settings/SettingsScreen.tsx`, `src/app/ProductionApp.tsx`, `src/services/workspaceTeamService.ts`.

- [ ] Add “Your team” as a Settings tab using existing tab primitives; adapt narrow-screen layout for five tabs without horizontal page overflow.
- [ ] Fetch roster and capability through the service. Show occupied/reserved seats separately and the artist boundary clearly.
- [ ] Render owner controls and member read-only state from server capabilities, with pending/error/conflict handling.
- [ ] Edit title/tags with explicit limits; keep access role out of the responsibilities form.
- [ ] Implement removal preview (“Their open work will need a new owner”), disable duplicate submissions, and reload from canonical response.
- [ ] For M1 display provisioned users; keep invite controls unavailable until Task 2 and Task 3 public acceptance are verified. For M2 expose send/copy/rotate/revoke.
- [ ] Add keyboard labels, focus return, mobile 360px test, six-seat full state, network-failure draft preservation, and support exclusion tests.

**Done when:** the owner can describe who handles what without changing permission roles or the existing AI Agents screen.

### Task 7 — Personal Today and consistent mission execution (M1)

**Modify:** `src/services/todayExecutionSupabase.ts`, `src/features/desk/todayProjection.ts`, `src/features/desk/TodayRuntimeExecution.tsx`, `src/features/desk/DeskHQ.tsx`, `src/types/cleanProduction.ts`, `src/services/productionSupabase.ts`, `src/features/missions/MissionTaskSheet.tsx`, `MissionWorkSurface.tsx`, `MissionWorkParts.tsx`, `src/app/ProductionApp.tsx`, `src/services/todayQuestionAction.ts`, `src/services/todayPermissionAction.ts`.

**Create:** `src/manager-team-today.test.ts`, `src/team-mission-actions.test.tsx`.

- [ ] Extend Today input with authenticated viewer ID/role, explicit workspace scope, roster, and team capability. Add assignee/reason/version to task read/mapping contracts.
- [ ] Extend projection with `team` and `unassigned` arrays; keep existing `primary/supporting/watches` shape for personal actions. Provide empty defaults for fixture compatibility.
- [ ] Classify tasks before primary selection using the section 5 rules. Preserve current phase/availability/approval gating.
- [ ] Make permission/approval items owner-only; route task-linked questions to assignee and general questions to owner. Update answer mutations, not just cards.
- [ ] Load/view teammate work in Missions with an assignee label and read-only action state. Owner can reassign via Task 2 with version conflict handling.
- [ ] Test Sarah/Favour separation, no-work member, owner unassigned queue, null-assignee solo fallback, phased future tasks, machine work, blocked work, and reassignment moving personal ownership.
- [ ] Test Today loader scope explicitly; do not infer the current workspace only from the first returned mission if a caller supplies mixed IDs.

Example behavioral test shape (use the existing task/mission fixtures for required fields):

```ts
const sarahView = projectTodayExecution({ ...packet, viewer: sarah });
const favourView = projectTodayExecution({ ...packet, viewer: favour });
expect(sarahView.primary?.taskId).toBe(dspTask.id);
expect(favourView.primary?.taskId).not.toBe(dspTask.id);
expect(favourView.team.some((item) => item.taskId === dspTask.id)).toBe(true);
```

`viewer` is the new explicit `{ userId, accessRole }` projection input, not global session state. Build the complete fixture in the test file; `packet`, `sarah`, `favour`, and `dspTask` above describe the named test fixtures rather than production globals.

**Done when:** personal work is accurate on every execution surface and existing single-owner Today tests still pass.

### Task 8 — Personal reminders, realtime, and attribution (M1)

**Create:** `supabase/migrations/20260905000500_artist_team_personal_reminders.sql`, `src/team-reminder-delivery.test.ts`, `supabase/tests/artist_team_reminder_smoke.sql`.

**Modify:** `supabase/functions/manager-dispatcher/index.ts`, `_shared/reminders.ts`, `src/services/workspaceLiveSync.ts`, `src/app/useWorkspaceLiveSync.ts`, `src/services/resourceRequestCoordinator.ts`, `src/features/notifications/WorkspaceActivityCenter.tsx`, `src/services/productionSupabase.ts`, `src/workspace-live-sync.test.ts`, `src/manager-reminders.test.ts`.

- [ ] Add recipient column/backfill/RLS and self-only preferences/worker-only queue writes.
- [ ] Implement transactional reminder finalization from section 4.8; change dispatcher to use it after claim.
- [ ] Add expected assignment version to queued payloads or equivalent row column. Both SQL queue producer and TypeScript queue producer must use the same stale-recipient rule.
- [ ] Test Sarah→Favour reassignment with a reminder already processing; Sarah receives no new personal event after the reassignment transaction commits.
- [ ] Test removal, user disabled, no entitlement, quiet hours, no-assignee owner fallback, terminal/superseded task, provider/channel unavailable, duplicate workers, and duplicate event delivery.
- [ ] Extend `WorkspaceOperatingEvent` mapping with actor/recipient; add `team`/`today` invalidation mappings where needed and preserve unknown-scope fallback.
- [ ] Emit shared invalidations for member/assignment changes without leaking personal reminder text; trigger roster reload and personal Today recalculation.
- [ ] Revalidate membership on focus/reconnect, before every mutation, and on a bounded active-session interval (30 seconds). Database access fails immediately at removal commit; UI clears on the next validation even if the removed user cannot receive the removal event through RLS.
- [ ] Include actor IDs for new browser-originated events, enforce attribution server-side, and render real names. Historical null actors display “Team member,” not a fabricated identity.
- [ ] Exercise two signed-in browser sessions, offline/reconnect catch-up, double delivery, and switch-user cache cleanup.

**Done when:** shared progress updates reach teammates and personal reminders reach only the intended member; removal does not depend on receiving an event the user is no longer authorized to read.

### Task 9 — Cross-member continuation and live model evaluation (M1)

**Create:** `supabase/tests/artist_team_continuation_smoke.sql`, `src/manager-team-continuation.test.ts`, `scripts/evals/team-assignment-cases.json`, `scripts/evals/run-team-assignment.mjs`, `docs/operations/team-demo-rehearsal.md`.

**Modify:** Task 5 runtime/persistence files only where required for source-task links and current-plan continuation. Preserve existing `manager_runtime_limits` and admission guards.

- [ ] Seed six authenticated test identities: owner, DSP, Content, PR, Recording, and Live/Operations; use obvious test accounts in a disposable/staging environment.
- [ ] Seed an entitled pilot workspace and real responsibility rows; never put passwords or tokens in tracked fixtures.
- [ ] Add source-task/continuation provenance using existing artifact links; validate same mission/workspace and preserve supersession links.
- [ ] Execute the scenario in section 8 with deterministic model outputs in SQL/integration tests. Assert exact state changes, recipients, dedupe, and active-plan ownership.
- [ ] Run a separate live-model evaluation using production-equivalent model configuration and actual generation code. It must validate generated assignments, not predefined example outputs. Implement `run-team-assignment.mjs` as an authenticated staging-endpoint harness, rather than trying to import Deno-only SDK modules into Node. Accept `--cases` and `--repetitions`; use isolated case fixtures and stop immediately if the configured target is production. Read credentials from an untracked `.env.team-eval`, redact them from output, and persist case IDs, expected/actual assignees, validator result, latency, and model/config identity in the release evidence.
- [ ] Use at least 24 cases covering obvious DSP/content/recording matches, overlapping roles, no match, absent legal authority, prompt injection in titles, removed member after generation, machine work, and replan/follow-up assignment.
- [ ] Run three repetitions. Require zero out-of-roster assignments, zero authority violations, zero machine-work human assignments; at least 90% correct clear-match routing; every ambiguous/invalid case safely unassigned or owner-routed only where owner authority is actually required. Record raw scored outcomes without private prompt content in telemetry.
- [ ] Verify six concurrent browser refreshes do not enqueue six redundant mission-genesis/career-watch/replan runs and do not multiply subscription budget.
- [ ] Record measured time from blocker acceptance to valid persisted follow-up; demo target <=90 seconds in three consecutive rehearsals. Treat this as a meeting target, not a sold SLA.

**Done when:** the app, database, and model all establish the handoff, and failed/incomplete model runs leave the last good plan intact with visible recovery.

### Task 10 — $99/month Team purchase and lifecycle (M2)

**Create:** `supabase/migrations/20260905000600_artist_team_billing.sql`, `src/team-billing-plan.test.ts`, `src/team-billing-lifecycle.test.ts`, `supabase/tests/artist_team_billing_smoke.sql`.

**Modify:** `_shared/paddle.ts`, `billing-pricing-config/index.ts`, `paddle-create-checkout/index.ts`, `paddle-process-webhooks/index.ts`, `paid-workspace-setup/index.ts`, `paddle-customer-portal/index.ts`, `src/types/productionApp.ts`, `src/services/productionSupabase.ts`, `src/lib/paddleBilling.ts`, `src/features/billing/workspaceCheckout.ts`, `SubscriptionPlanDialog.tsx`, `SubscriptionRecoveryGate.tsx`, `src/features/settings/SettingsScreen.tsx`.

- [ ] Add `planKey` distinct from interval to pricing/checkout/session/subscription contracts; legacy calls default to `solo`.
- [ ] Extend canonical price selection to `readCanonicalPaddlePrice(interval, planKey = "solo")`; for `team_6` accept monthly only and require `PADDLE_TEAM_PRODUCT_ID` and `PADDLE_TEAM_MONTHLY_PRICE_ID`. Preserve existing Pro env names/values.
- [ ] Create/verify the actual sandbox provider price at $99 USD/month, quantity one. Render localized/tax-inclusive price from provider preview where applicable; marketing base price must not be mistaken for every customer's final charged total.
- [ ] Bind plan key, interval, workspace, payer, and provider price in checkout idempotency/reuse checks. Same request ID with another plan returns 409.
- [ ] Verify webhook provider signature, authoritative subscription/product/price/quantity, checkout correlation, and payer/workspace ownership before Team capability is exposed. Preserve current paid-confirmation fixes, renewal replay handling, stale-event guards, and setup idempotency.
- [ ] Ensure initial Team purchase creates exactly one account/workspace/owner and enables capability only after existing base entitlement is valid.
- [ ] Treat **upgrade of an already active subscription** separately from starting a new checkout: update the existing provider subscription through an owner-authorized path, preview/confirm actual proration, then wait for verified provider state. Do not create a second active subscription for the same workspace. Until this path is implemented and sandbox-tested, display an assisted-upgrade state and disable self-serve upgrades; M2 is not complete if self-serve upgrade is advertised.
- [ ] Add an owner-only subscription-change operation to a new `supabase/functions/team-subscription-change/index.ts` if the current portal cannot enforce allowed catalog changes; include its Deno/type/security tests. It accepts workspace ID and an idempotent request ID, never an arbitrary amount/price.
- [ ] Prevent downgrade while >1 active seat or pending reservations remain; require owner to remove/revoke first. Also handle provider-initiated effective downgrade by denying member eligibility at the capability boundary while retaining history.
- [ ] Disable Team purchases through Paystack until it has its own verified Team catalog and lifecycle implementation. Existing Paystack solo purchases/renewals remain unchanged. Do not silently map Team to a Pro price.
- [ ] Test initial purchase, duplicate webhook, out-of-order update, renewal without new workspace, cancelled-at-period-end, effective lapse, recovery, Team→solo change, wrong price, quantity six, member portal access, and unrelated personal subscription.
- [ ] Verify no real charges/emails are generated by automated tests. Use provider sandbox and controlled recipients.

**Done when:** commercial Team access comes from verified subscription state and exactly one subscription covers six people around one artist. A $99 label alone is not completion.

### Task 11 — CI, release gates, and staged rollout (M1/M2)

**Modify:** `.github/workflows/manager-runtime-safety.yml`, `.github/workflows/ci.yml`, `docs/production-release-runbook.md`, `docs/operations/team-release-evidence.md`.

- [ ] Add the new files/migrations/functions to workflow path filters; otherwise a team-only PR may skip the runtime gates.
- [ ] Add all team test files to focused runtime checks and new SQL files to the fresh-DB job. Use `psql -v ON_ERROR_STOP=1` so SQL errors fail CI.
- [ ] Add real concurrent seat/acceptance/removal/reminder tests using separate database connections, following existing admission-stress conventions.
- [ ] Deno-check all changed Edge entrypoints and shared modules, including billing/new team functions; browser Vitest does not typecheck Deno deployment boundaries.
- [ ] Run full raw `npm test`, build, browser diagnostic comparison, production dependency audit, and all existing release checks on the exact candidate commit.
- [ ] Apply migrations to a disposable DB from empty history and to a populated copy with solo accounts, existing tasks, old reminders, and current subscriptions. Verify no forced user setup or lost history.
- [ ] Deploy schema first, Edge functions second, frontend third to staging; keep pilot gate false until all compatible pieces are deployed.
- [ ] Run real authenticated six-user/outsider/removed-user checks, 360px mobile checks, and three consecutive demo rehearsals.
- [ ] Enable one internal pilot, then one consenting beta team, then CBA pilot workspaces. No broad customer enablement based solely on Monday's demo.
- [ ] Store exact commit, migration versions, deployed functions, environment, run times, pass/fail evidence, and rollback result in the evidence file.

**Done when:** release evidence supports each claim at the scope being enabled.

## 7. Commands and execution guidance

Run commands from the repository root. Use Node 22 as specified in `package.json`. Existing `npm test` already selects jsdom and the vmThreads pool.

```powershell
# Focused new behavior, after the test files exist
npm test -- src/workspace-team-roster.test.ts src/account-team-function.test.ts src/workspace-team-authority.test.ts src/manager-team-assignment.test.ts src/manager-team-context.test.ts src/manager-team-today.test.ts src/team-reminder-delivery.test.ts src/manager-team-continuation.test.ts

# Existing critical regression set
npm test -- src/manager-execution-loop.test.ts src/manager-adaptive-replan.test.ts src/manager-world-model-question-engine.test.ts src/manager-today-execution.test.ts src/manager-reminders.test.ts src/manager-e2e-golden.test.ts src/manager-state-integrity.test.ts src/production-supabase-service.test.ts src/paddle-backend-contract.test.ts src/paid-workspace-setup-function.test.ts src/workspace-live-sync.test.ts

# Full browser regression and bundle
npm test
npm run build

# Interpret diagnostics against the baseline using existing CI comparison
npx tsc --noEmit --pretty false

# Example exact changed-runtime type check; include other changed entrypoints too
deno check supabase/functions/account-team/index.ts supabase/functions/manager-conversation/index.ts supabase/functions/mission-genesis/index.ts supabase/functions/manager-runtime-runner/index.ts supabase/functions/manager-review-task-result/index.ts supabase/functions/manager-task-execution/index.ts supabase/functions/manager-permission-action/index.ts supabase/functions/manager-dispatcher/index.ts

# Staging-only live model routing evaluation, after Task 9 creates the harness
node --env-file=.env.team-eval scripts/evals/run-team-assignment.mjs --cases scripts/evals/team-assignment-cases.json --repetitions 3
```

Expected: behavioral tests pass, no new browser type diagnostics versus the preserved baseline, Deno check passes, build completes. An unchanged pre-existing diagnostic is not a newly introduced Team defect, but existing release-gate failures must still be resolved before a broad release.

For the SQL tests, use the existing `.github/workflows/manager-runtime-safety.yml` disposable Vault-prerequisite setup and fresh `supabase db start` job. Add, in order, the six new migration families and the corresponding smoke files. Do not add fake Vault production secrets to a real migration. Windows local execution can use `psql -v ON_ERROR_STOP=1 -f <test-file>` against the verified disposable local database. Record the target before running; do not use hosted reset commands.

Real concurrency setup/verify is required in addition to each SQL smoke transaction. A test that performs six inserts sequentially does not prove a six-seat concurrency boundary.

## 8. Golden acceptance scenario

Use a controlled test artist/track and clearly synthetic users, not Godwin Tom's real account or a person's email without authorization. Odaeshi can remain the existing fixture's track if its current fixture context is reused accurately.

1. Owner opens the entitled pilot artist. Team shows six members, six occupied seats, no seventh-seat invite path.
2. Owner assigns responsibility tags: DSP to Sarah, Content to Favour, Recording/master coordination to Daniel; remaining members cover PR and operations.
3. Manager uses the artist's existing canonical meaning and constraints to propose a specific content action. The persisted task has Favour's real user ID, an executable brief, and at least two meaningful steps under the existing contract.
4. Favour's browser shows the action under Needs you. Sarah's browser shows it only as shared team work. Both reference the same mission and artist.
5. Favour starts and completes the task with evidence. One accepted result and one continuation exist. All shared views update.
6. Manager produces a DSP action for Sarah. Sarah reports the missing final master through the normal Blocked flow.
7. Manager reads the fresh roster and evidence, creates Daniel's specific master-delivery action, and links it to the blocker. Sarah is not asked to invent the next plan.
8. Daniel receives the personal in-app reminder; Favour and Sarah do not receive Daniel's personal nudge. Shared status remains visible.
9. Daniel uploads/provides the required result. Manager verifies it and resumes/replaces Sarah's distribution work on the current plan without duplicating logical tasks or reopening a superseded task.
10. Any consequential external send/publish/spend approval appears only for the owner. A member's crafted approval request returns forbidden.
11. Owner reassigns a current task while its reminder is processing. Only the new assignee can receive a new reminder after commit; the old tab cannot execute using stale assignment state.
12. Owner removes a member. New database/API reads and writes fail for that member immediately after commit; stale UI clears on validation. Open work appears in Needs an owner.
13. Sign into a pre-existing solo workspace. Its normal Today, Manager, catalog, billing recovery, and task-completion flow still work.

The scenario fails on cross-account visibility, wrong personal ownership, lost results, duplicate continuation, stale-recipient delivery after reassignment commit, authority mistakes, or a manual “what next?” prompt needed to awaken a continuation that should already be queued. A legitimate clarification about missing evidence is allowed; fabricated certainty is not.

## 9. Test matrix and release blockers

| Gate | Required evidence | Blocks |
| --- | --- | --- |
| A: Identity/access | Current-user workspace selection, roster scope, one artist, denied outsider and removed-user access | M1 and M2 |
| B: Seats/membership | Six includes owner; reserved invites; concurrent seventh rejected; verified email; replay safety; owner protected | M1 backend; full invite UX M2 |
| C: Authority | Assignee/owner execution; direct-write denial; owner-only approval/billing; member evidence not falsely artist-confirmed | M1 and M2 |
| D: Delegation | All producer schemas and SQL persistence paths; compaction; invalid-ID fallback; fresh roster after removal | M1 and M2 |
| E: Presentation | Sarah/Favour separation; owner unassigned work; shared mission; mobile; deep-link revalidation | M1 and M2 |
| F: Delivery | Recipient RLS; self-only preferences; worker-only queue; processing race; dedupe; realtime reconnect | M1 and M2 |
| G: Continuation | Real persisted blocker→other member→review→current plan plus model eval | M1 and M2 |
| H: Commercial | Provider-verified $99 monthly, one subscription, lifecycle/upgrade, legacy billing regression | M2 |
| I: Regression/deployment | Existing release runbook, fresh/populated DB, full suite, type checks, build, hosted canary, rollback drill | Scope of deployment |

Use unit tests for pure projection/validation, authenticated SQL/REST tests for permission behavior, multi-connection tests for races, browser tests for session routing, and live model evals for routing quality. Source-string assertions may supplement these but never replace them.

## 10. Weekend schedule and cut lines

These are timeboxes for managing the deadline, not a promise that one engineer can safely implement all M2 work in two days.

**Saturday remaining time:** Task 0 baseline, Tasks 1–4 identity/capability/security spine, provision controlled users, then prove one owner and one member can share the exact artist. If access tests are not passing by the end of Saturday, shrink Monday to an existing-product demo plus labeled walkthrough.

**Sunday first half:** Tasks 5–7 roster-aware assignment and personal Today, initially through one real task path then all persistence paths. Keep public invite/checkout hidden.

**Sunday second half:** Tasks 8–9 reminders/continuation and six-user rehearsal. Run existing regression/CI. Fix critical defects only. Capture a clearly labeled backup recording of the verified slice.

**Sunday evening:** freeze the demo candidate after three consecutive successful rehearsals. Record exact commit/environment/fixture state. Do not use Sunday night to introduce new billing migration behavior.

**Monday before meeting:** rehearse the frozen candidate at least two hours before the actual meeting, verify auth/network/runtime health, and use controlled browsers. If a live provider fails, show the backup as a recording and explain its scope honestly; do not present seeded results as live autonomous behavior.

**After meeting:** finish public invitations and Task 10 paid lifecycle, perform M2 gates, then enable an actual customer pilot.

If secure self-service is required before Monday, treat that as a changed release constraint with a substantially larger critical path. Do not imply that finishing UI copy turns a controlled pilot into a customer-ready paid plan.

## 11. Deployment, rollback, and observability

### Deployment order

1. Record current deployed versions and verify backups/recovery for the target environment.
2. Apply additive migrations, including the reviewed pre-existing identity migration, in timestamp order. Preserve grants, function signatures, foreign keys, existing quality gates, and PostgREST relationship hints.
3. Deploy every Edge Function affected by changed shared imports, not just the new `account-team` function.
4. Deploy frontend using the exact tested release SHA and existing `APP_RELEASE` convention.
5. Keep public Team purchase/invitation controls disabled; enable one entitled internal workspace explicitly.
6. Run hosted access/reminder/continuation canary and monitor failures before any additional workspace enablement.

### Kill switch and recovery

`workspace_team_settings.enabled=false` disables new team membership mutation and new AI delegation for that workspace. Keep owner access and the working solo product available. Non-owner access fails closed under the configured-team access helper; do not silently convert all member work into owner assignments.

Preserve roster, historical results, assignment provenance, and shared artist state. Pause affected reminder/continuation dispatch where needed, let the owner inspect unassigned/current work, and fix forward. Do not delete migrations or roll back the database after real team writes. A frontend rollback is permitted only to a version compatible with the new database and authority boundaries; the pre-team frontend can display shared work as personal, so it is not automatically a safe fallback for an enabled team account.

Test the switch with an active member, a pending invite, a running model request, and a processing reminder. No stale worker may publish a new unauthorized assignment/reminder after disablement. Re-enabling reloads capability/roster and uses canonical state rather than re-seeding the workspace.

### Instrumentation

Reuse current app error capture, operating events, run IDs, and analytics. Add events for member invite/join/removal, assignment/reassignment/unassigned fallback, assignment validation failure, rejected stale mutation, blocked/result continuation, skipped stale reminder, seat-limit rejection, and capability change.

Dimensions: release, account/workspace/artist IDs, mission/task/run IDs where applicable, actor, recipient, assignment source/version, outcome/error code. Exclude raw invitation tokens, join URLs, email bodies, private prompt contents, and unnecessary emails. Roster text is not telemetry.

Initial measurements: clear-match assignment success, manual reassignment rate, blocker-to-valid-follow-up latency, continuation completion/failure, stale-recipient skips, invalid assignment rate, and total workspace AI usage. A rising stale-recipient skip rate is an operational signal; a delivered wrong-recipient reminder is a release incident.

## 12. Handoff checklist

- [ ] Commercial terms remain $99/month, six total including owner, one artist.
- [ ] Team remains a provisional public label; no global product rename.
- [ ] The preserved uncommitted payment/setup/identity work is included in the implementation baseline.
- [ ] There is exactly one source of roster truth and one shared artist state.
- [ ] Task responsibility is distinct from approval authority.
- [ ] Each implemented task has behavioral tests and real database evidence where required.
- [ ] M1 claims are separated from M2 paid/self-service claims.
- [ ] No production deployment, provider charge, invite email to a real person, or application-code change occurred merely by writing this plan.

**Next implementation session starts at Task 0, then proceeds in dependency order. The first useful vertical slice is two authenticated humans, one artist, correct authority, and one persisted assigned task—not a new pricing card.**
