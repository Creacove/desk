# Team contracts v1 — frozen implementation handoff

Work only in `C:/Users/USER/Desktop/ai-record-label-prototype/.worktrees/artist-team`, branch `codex/artist-team`. Shared checkout with disjoint file ownership. Do not commit, reset, merge, deploy, edit secrets, run production commands, send emails, or change package dependencies. No subdelegation. Luna Max workers self-test and fix before one concise return; report only genuine blockers early.

Terms: $99/month, owner plus five humans, one artist. Team is provisional label, internal plan `team_6`. Existing product name and solo behavior preserved. All new team controls gated by server capability; disabled on existing accounts by default.

## Shared types (coordinator owns src/types/workspaceTeam.ts)

WorkspaceScope = {accountId, artistWorkspaceId, artistId}, UUID strings.
WorkspaceMember = {userId, displayName, accessRole:'owner'|'member', operatingTitle:string|null, responsibilityTags:string[]}.
WorkspaceRoster = {scope:WorkspaceScope, members:WorkspaceMember[], loadedAt:string}.
WorkspaceTeamCapability = {accountId,artistWorkspaceId,artistId,planKey:'solo'|'team_6',enabled:boolean,entitled:boolean,source:'subscription'|'pilot'|'none',seatLimit:1|6,occupiedSeats:number,reservedSeats:number,endsAt:string|null}.
TeamInvitation = {id,artistWorkspaceId,email,status:'pending'|'accepted'|'expired'|'revoked',expiresAt,operatingTitle:string|null,responsibilityTags:string[]}.
No raw token in roster/invitation records returned by list. New/rotated invite response {invitation:TeamInvitation, token:string}; client creates `${origin}/join#token=${encodeURIComponent(token)}`. No automatic email send in first implementation. Copy-link is real supported onboarding; email deliberately absent from API/UI until provider delivery exists.

## Browser services

createWorkspaceTeamService(client) returns loadRoster(workspaceId):Promise<WorkspaceRoster>, loadCapability(workspaceId):Promise<WorkspaceTeamCapability>, listInvitations(workspaceId):Promise<TeamInvitation[]>, invite(input), rotateInvitation(id), revokeInvitation(id), acceptInvitation(token):Promise<WorkspaceScope>, removeMember(workspaceId,userId), updateResponsibilities(input), reassignTask(input).
RPC roster/capability/list take {p_artist_workspace_id:uuid}. Call account-team Edge for mutations, operation JSON below. Responses use camelCase exact shared types. Errors throw useful sanitized messages.

account-team actions:
invite {artistWorkspaceId,email,operatingTitle,responsibilityTags}
rotate_invite {invitationId}
revoke_invite {invitationId}
accept_invite {token}
remove_member {artistWorkspaceId,memberUserId}
update_responsibilities {artistWorkspaceId,memberUserId,operatingTitle,responsibilityTags}
reassign_task {taskId,assigneeUserId:string|null,expectedAssignmentVersion:number}

Server verifies auth.getUser, then service-only SQL mutation RPC actor comes solely from verified auth (not body). Each mutating RPC receives p_actor_user_id; acceptance additionally p_email from verified auth plus p_token_hash. Edge derives email confirmation and rejects unverified. SQL must independently verify public user/auth identity, active membership and role inside transaction. All service-only RPC execute revoked PUBLIC/anon/authenticated. SQL read RPCs accept authenticated and service roles with correct caller/scope checks. Never trust email user metadata.

Exact mutation SQL signatures:
invite_account_member_v1(p_actor_user_id uuid,p_artist_workspace_id uuid,p_email text,p_token_hash text,p_operating_title text,p_responsibility_tags text[]) returns jsonb TeamInvitation
rotate_account_invitation_v1(p_actor_user_id uuid,p_invitation_id uuid,p_token_hash text) returns jsonb TeamInvitation
revoke_account_invitation_v1(p_actor_user_id uuid,p_invitation_id uuid) returns jsonb {ok:true}
accept_account_invitation_v1(p_actor_user_id uuid,p_email text,p_token_hash text) returns jsonb WorkspaceScope
remove_account_member_v1(p_actor_user_id uuid,p_artist_workspace_id uuid,p_member_user_id uuid) returns jsonb {ok:true}
update_member_responsibilities_v1(p_actor_user_id uuid,p_artist_workspace_id uuid,p_member_user_id uuid,p_operating_title text,p_responsibility_tags text[]) returns jsonb {ok:true}
reassign_workspace_task_v1(p_actor_user_id uuid,p_task_id uuid,p_assignee_user_id uuid,p_expected_assignment_version integer) returns jsonb {taskId,assigneeUserId,assignmentVersion}

Error message prefixes: TEAM_BAD_INPUT, TEAM_FORBIDDEN, TEAM_NOT_FOUND, TEAM_CONFLICT, TEAM_GONE, TEAM_RATE_LIMIT. Edge maps to 400/403/404/409/410/429, auth failure 401. Do not return internal SQL details or tokens.

## Database invariants

Plan sections 3–4 define schema and invariants. Match current latest migrations, not only original definitions. Account lock first, then task/invitation lock. Occupied(active owners/members)+reserved(pending,unexpired nonmember invites)<=6. Exclude support. Protect every owner from removal in v1. Atomic acceptance exchanges reservation; same-user replay idempotent. Normalize email trim/lower; compare verified auth email. Reactivate existing inactive row safely. Missing public user row created from verified auth.users during acceptance. New roles member only. Token SHA256 32 random bytes, expires 7 days. Store only hash. Atomic rate limit on invite/rotation 20/account/hour, 3/email/hour. Scope FK account/workspace/artist. Reject activation when account contains another artist/workspace including archived.

Settings enabled=false default; pilot requires existing base paid/beta entitlement plus explicit future pilot_ends_at. Catalog maps verified provider price to team_6; client never decides entitlement. Existing untracked 20260901000100 identity migration copied in baseline provides composite workspace FK. Existing has_active_workspace_entitlement calls is_account_member: extract fact-only base predicate to prevent recursion; preserve provider statuses/time conditions. Team-bound nonowner access requires enabled+entitled, owner retains recovery. No team settings = legacy semantics.

Assignment fields: assigneeUserId nullable, assignmentReason nullable, assignmentSource nullable manager|owner|solo_fallback, assignmentVersion integer. Model invalid ID normalizes null; owner API invalid ID rejects. DB final-write invariant active owner/member same account, never manager_work; increment assignment version on actual change. Removal unassigns nonterminal tasks and cancels unsent reminders atomically. History remains. All receipt/state/result commits recheck removed/reassigned/current-plan status.

## File ownership wave 1

A database: new 20260905000100_artist_team_foundation.sql, 20260905000200_artist_team_membership_operations.sql, 20260905000300_artist_team_authority.sql; _shared/workspaceRoster.ts, _shared/workspaceAuthorization.ts; tests src/workspace-team-roster.test.ts and src/workspace-team-authority.test.ts; SQL artist_team_foundation/membership/authority_smoke.sql. Do not edit existing Edge/browser files yet. Protect DB boundaries conditionally for team-bound accounts to preserve legitimate solo callers; no broad destructive revoke without integration.
B client: new src/features/team/*, src/services/workspaceTeamService.ts, src/services/teamInviteRoute.ts and corresponding new focused tests. No existing app/service/type file edits; coordinator owns shared type. Props/callback-driven modules await later wiring.
C verification: new scripts/test-team-database.mjs, supabase/tests/artist_team_seat_concurrency_setup.sql and verify.sql, docs/operations/team-release-evidence.md. Baseline full tests/build and local DB availability; no production changes, no secret outputs.

## Worker tests/report

Use meaningful failing tests before implementation; run scoped Vitest with --maxWorkers=2 to avoid process explosion. Do not weaken existing tests. SQL source checks do not prove DB correctness. Report actual DB availability distinctly. No repeated full-suite runs by each worker. Return <=400 words: files, behavior, test results, unresolved issues. Coordinator handles cross-package review/integration, workers fix local defects before return.
