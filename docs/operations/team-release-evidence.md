# Artist Team release evidence

Use this record for an M1 controlled pilot or an M2 paid release. Copy the
template for each candidate SHA and fill it from command output and hosted
observations. A blank, `not run`, or source-only check is not evidence that a
gate passed. Do not place invitation tokens, join URLs, email bodies, private
prompts, provider secrets, or access tokens in this file.

## Candidate and scope

| Field | Value |
| --- | --- |
| Release SHA / `APP_RELEASE` | `TBD` |
| Scope | `M1 pilot` / `M2 paid` |
| Environment | `local disposable` / `staging` / `hosted canary` |
| Operator and UTC run time | `TBD` |
| Supabase project/environment | `TBD` |
| Migration versions applied | `TBD` |
| Edge functions deployed | `TBD` |
| Frontend deployment URL | `TBD` |
| Rollback or forward-fix result | `TBD` |

### Local candidate record — 2026-09-06

| Field | Value |
| --- | --- |
| Base SHA | `dcbf5cf53aaa1f529af68bde287a03a357bc08a6` |
| Candidate | Committed `codex/artist-team` branch; record exact SHA with `git rev-parse HEAD` when staging begins |
| Environment | Windows local; Node `v22.19.0`; Deno `2.7.4` |
| Operator and UTC run time | Codex coordinator; `2026-09-06T03:58:55Z` |
| Hosted deployment | Not performed; separate-account staging is the next release phase |

## Automated evidence

Record the exact command, result, timestamp, and a link to the retained log or
CI run. Use `PASS`, `FAIL`, `BLOCKED`, or `NOT RUN`; never infer `PASS` from a
source assertion or from a different commit. If Docker or a local disposable
database is unavailable, record `BLOCKED` with the command and error; it cannot
be converted to `PASS` by running source-only checks.

| Gate | Required evidence | Command / evidence path | Status | Run time |
| --- | --- | --- | --- | --- |
| Browser types | No new diagnostics versus the base commit | `.github/workflows/ci.yml` type-regression run | `TBD` | `TBD` |
| Team browser contracts | Roster, client, handler, authority, assignment, Today, plan, settings, and Team UI tests | `npm test -- src/account-team-function.test.ts src/workspace-team-roster.test.ts src/workspace-team-authority.test.ts src/workspace-team-service.test.ts src/manager-team-assignment.test.ts src/manager-team-today.test.ts src/team-billing-plan.test.ts src/features/team/AcceptTeamInvitation.test.tsx src/features/team/TaskAssigneeControl.test.tsx src/features/team/YourTeamPanel.test.tsx src/features/settings/SettingsScreen.test.tsx` | `TBD` | `TBD` |
| Team Deno boundaries | Changed account-team and shared Edge modules typecheck | `deno check supabase/functions/account-team/index.ts supabase/functions/_shared/accountTeamHandler.ts supabase/functions/_shared/workspaceAuthorization.ts supabase/functions/_shared/workspaceRoster.ts supabase/functions/_shared/taskAssignment.ts` | `TBD` | `TBD` |
| Team source contract | Migration order, grants, JWT boundary, token storage, authority RPC | `node scripts/test-team-database.mjs --source-only` | `TBD` | `TBD` |
| Fresh database | All migrations apply from empty history; team smoke passes | `supabase db start` then CI database smoke job | `TBD` | `TBD` |
| Separate-connection races | Seat, acceptance replay, removal, and reminder cancellation use independent psql connections | `node scripts/test-team-database.mjs --target local --docker-container <local-container>` | `TBD` | `TBD` |
| Full browser suite/build | Existing regressions and production bundle pass | `npm test` and `npm run build` | `TBD` | `TBD` |
| Dependency/config gates | Production audit and environment contract pass | CI `dependency-audit`, `production-config`, and `build` jobs | `TBD` | `TBD` |

Local candidate results:

| Gate | Result | Evidence |
| --- | --- | --- |
| Team browser contracts plus billing/workspace/mission regressions | `PASS` | Focused Vitest run: 16 files, 203 tests passed |
| Team Deno boundaries | `PASS` | 11 changed Edge entrypoints checked successfully |
| Team source contract | `PASS` | `node scripts/test-team-database.mjs --source-only`; identity/order/grants/JWT/token/authority checks passed |
| Production bundle | `PASS` | `npm run build`; 1,796 modules transformed |
| Browser type regression | `NOT RUN` | Raw TypeScript retains the repository's large baseline; CI base-diff gate is required on the candidate commit |
| Fresh Supabase database and connection races | `BLOCKED` | Local Docker/Supabase runtime unavailable; CI job is configured to apply all migrations and run the separate-connection harness |
| Full browser suite | `BLOCKED` | 1,645 passed and 5 skipped; three load-sensitive failures passed when rerun in isolation. CI must establish the exact candidate result |

The concurrency harness is intentionally disposable and synthetic. For a
direct local connection, use an explicit loopback URL:

```powershell
node scripts/test-team-database.mjs --target disposable --db-url postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

The harness rejects hosted URLs and does not read `DATABASE_URL` or any hosted
secret. `--keep-fixture` is for local debugging only; delete the synthetic
fixture before sharing evidence. Never run the harness against a production,
staging, or customer database.

## Authenticated pilot checks

Use synthetic, authorized users and one controlled artist. Record user labels,
workspace/artist IDs, timestamps, and observed result codes; do not record
passwords, tokens, or private message content.

| Scenario | Expected result | Evidence |
| --- | --- | --- |
| Owner opens entitled Team workspace | One artist, six-seat capability, owner visible | `TBD` |
| Active member opens same workspace | Same shared artist state; member sees own work | `TBD` |
| Outsider and removed member | Reads and writes fail closed after commit | `TBD` |
| Seventh reservation | Concurrent reservations preserve `occupied + reserved <= 6`; excess attempt is `TEAM_CONFLICT` | `TBD` |
| Invitation replay | Same verified recipient is idempotent; another identity is rejected | `TBD` |
| Assignment and machine work | Human assignment is in roster; `manager_work` has no human assignee | `TBD` |
| Owner authority | Only owner can invite, remove, reassign, approve, bill, and authorize consequential sends | `TBD` |
| Member evidence | Member contribution keeps actor identity and is not labelled artist-confirmed | `TBD` |
| Reassignment/removal during reminder processing | Stale worker skips; only current assignee can receive a new reminder | `TBD` |
| Blocker continuation | Persisted blocker routes executable follow-up to the responsible member without duplicate work | `TBD` |
| Solo regression | Existing solo Today, Manager, billing recovery, catalog, and task flow remain usable | `TBD` |
| Mobile/deep link | 360px flow and invite deep-link revalidation pass | `TBD` |

## Deployment and rollback record

1. Verify the target project, current migration history, backup/recovery point,
   and the exact candidate SHA.
2. Apply additive migrations in timestamp order and record each version.
3. Deploy every changed Edge entrypoint and shared import before the frontend.
4. Deploy the frontend with the same SHA in `APP_RELEASE`.
5. Keep Team controls disabled, then enable one explicitly entitled internal
   workspace for the canary.
6. Run the authenticated owner/member/outsider/removal checks and monitor
   errors before expanding exposure.
7. For a failure, pause Team enablement and use a tested compatible frontend
   rollback or a forward-fix migration. Do not reverse a migration after team
   writes exist. Record the affected IDs and the recovery result here.

## Findings and blockers

| Severity | Finding / release impact | Owner | Reproduction or evidence | Resolution |
| --- | --- | --- | --- | --- |
| `TBD` | `TBD` | `TBD` | `TBD` | `TBD` |
