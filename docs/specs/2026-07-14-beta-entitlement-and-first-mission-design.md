# Beta entitlement and first-mission design

## Goal

An authenticated workspace with either a current paid subscription or a current private-beta grant receives the same protected product capabilities. The empty Missions action starts the existing Manager conversation workflow instead of the separate Mission Genesis workflow.

## Entitlement boundary

`public.has_active_workspace_entitlement(uuid)` remains the single authorization decision used by protected Edge Functions. Its final definition must:

- return true for an active paid subscription that has not ended;
- return true for an active `private_beta` workspace grant within its start/end window;
- require the caller to belong to the workspace account, except for trusted service-role orchestration;
- use `security definer` with `row_security = off`, because both billing subscriptions and access grants are protected by RLS;
- use `auth.role() = 'service_role'`, which is reliable in PostgREST, instead of reading the legacy singular JWT GUC;
- return false for expired, revoked, future, wrong-workspace, or unrelated-user grants.

The shared TypeScript guard will describe the requirement as paid or beta access, not subscription-only access. Every user-triggered protected Edge Function must import and invoke that guard. Preview/search endpoints used before activation remain intentionally outside the paid-or-beta boundary.

## First mission

The empty Missions page keeps one primary action. Selecting it sends the exact directive `Create the first mission for this workspace.` through `sendManagerMessage`, which uses the existing Manager conversation endpoint/stream, persists any mission graph created by its tools, shows the optimistic conversation immediately, and refreshes missions from the server completion hint.

The empty-state and Manager Office no longer render Mission Genesis outcomes, questions, errors, or continuation controls. The legacy repository and Edge Function can remain for backward compatibility, but no user-facing first-mission action calls them.

## Verification and release

Contract tests enumerate every protected function and assert the final SQL guard keeps paid, beta, RLS-bypass, and service-role semantics. A UI regression test proves the empty-state action calls Manager conversation with the hard-coded first-mission directive and does not call Mission Genesis. After the focused and full suites and production build pass, push the migration, redeploy every Edge Function that bundles the shared guard, inspect live deployment state, and push the verified commit to `origin/main`.
