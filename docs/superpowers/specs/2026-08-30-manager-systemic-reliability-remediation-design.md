# Manager Systemic Reliability Remediation Design

**Status:** Approved direction; implementation planning pending review

**Date:** 2026-08-30

**Production system:** Desk Manager

## Objective

Make Desk safe enough to manage real paying artists without silently stopping,
losing the next action, duplicating work, acting without permission, crossing
artist or song context, or claiming an external result that did not happen.

The production failures found in the first test are treated as evidence of a
systemic contract problem, not as an isolated bug list. The remediation must
audit and harden every adjacent path that shares the same model-output,
authorization, persistence, projection, worker, retry, or external-effect
pattern.

## Evidence from the first production test

The linked production database and authenticated runtime exposed failures in
several independent layers:

- Today's Brief refresh fails because an authenticated user-scoped Supabase
  client attempts to write the service-owned `manager_synthesis_runs` table
  after ownership grants were correctly tightened. The internal database error
  is `42501 permission denied for table manager_synthesis_runs`.
- Approval requests displayed on Today can be legacy or newly-created decision
  records with no `created_from_action_id`. The resolver requires an exact
  bound Manager action and fails, while the Edge boundary replaces the useful
  cause with a generic 500 response.
- A Manager continuation generated a human task that violated the database
  contract requiring at least two execution steps. The database correctly
  rejected it with `generated_human_task_contract:at_least_two_execution_steps_required`,
  but the UI had already begun presenting provisional output.
- Released Spotify catalog music was described as released while the same turn
  requested generic pre-release audio and asset uploads. Existing prompt advice
  did not prevent contradictory persisted work.
- Career Watch recently failed on malformed or absent structured output,
  demonstrating that background generation can spend capacity without
  producing admissible work.
- Central error records frequently contain wrapper messages rather than the
  original exception, making failures slower to diagnose.

Green happy-path tests did not protect these runtime contracts.

## Design principles

1. **Prevent invalid output before persistence.** Give the model exact rules,
   use strict output schemas where possible, validate semantics, and permit at
   most one targeted repair attempt before the user sees completion.
2. **Keep durable invariants.** Prompts and application validation improve the
   normal path; database constraints, unique indexes, transactions, and worker
   fencing protect against concurrency, regressions, and bypasses.
3. **Canonical state outranks conversation history.** Lifecycle, active plan,
   ownership, known facts, permissions, and current work come from authoritative
   records. Chat can propose changes but cannot override them implicitly.
4. **Separate identity from service ownership.** A user-scoped client proves
   authentication, membership, entitlement, and permitted reads. A distinct
   service-role client performs authorized service-owned Manager mutations.
   Authenticated write grants must not be reopened as a shortcut.
5. **Make retries idempotent and stale work harmless.** Every retryable write
   has a stable operation identity; a stale worker or request cannot overwrite a
   newer terminal result.
6. **Treat external uncertainty honestly.** A provider timeout after dispatch
   is not a failure and is not success. Unknown outcomes enter an indeterminate
   state and are reconciled rather than automatically repeated.
7. **Project only valid current work.** Today and Missions are views of the
   active plan and admissible records, not historical rows that happen to remain
   pending.
8. **Preserve the real diagnostic.** User messages stay safe and useful while
   internal telemetry retains the original error, stage, trace, and correlated
   domain record.

## Canonical Manager context

All Manager generators use one bounded canonical-context builder. It resolves
and labels:

- authenticated account, workspace, artist, song, project, mission, and task;
- active plan and its generation/version identity;
- music lifecycle and release evidence;
- confirmed, provider-observed, inferred, and unknown facts;
- active questions and whether an answer is already known;
- existing work, permissions, reviews, drafts, and external actions;
- source freshness and limitations;
- budget/admission state.

Every identifier is resolved through the workspace relationship rather than
accepted as trusted user input. Cross-workspace or cross-song references fail
closed. Historical conversation is supplied as bounded narrative context, not
as authoritative state.

Facts use explicit provenance:

- `artist_confirmed`: stated or confirmed by the artist;
- `provider_observed`: obtained from an identified source;
- `manager_inferred`: useful hypothesis, never silently promoted;
- `unknown`: not established.

An answer updates canonical knowledge transactionally and closes equivalent
open questions. Generators must not ask again unless the fact is stale,
contradictory, or insufficient for a specifically stated action.

## Released and catalog music policy

Lifecycle policy is deterministic and is applied both before generation and
before persistence.

For released/catalog music:

- provider-confirmed release identity, release date, public artwork, and public
  link count as existing release evidence;
- absence of a duplicate in-app upload does not mean the asset does not exist;
- generic requests for audio, artwork, credits, rights packs, or pre-release
  readiness are prohibited;
- a file, right, or metadata correction may be requested only when the artist
  asks for it or a named post-release action genuinely requires it, and the task
  must state that dependency;
- unavailable performance data is represented as a source limitation or
  connection opportunity, not proof that the user has failed to supply a
  release package;
- default work concerns measurement, audience conversion, content and campaign
  tests, catalog movement, targeted playlist/press materials, optimization, and
  the next strategic move.

The persistence validator rejects prohibited work even if a model ignores the
prompt. Today also refuses to project legacy work that violates the lifecycle
policy. Existing invalid tasks are cancelled or superseded with an explicit
reason; they are not silently deleted.

## Model-output admission pipeline

Model output is untrusted input. Each workflow passes through the same stages:

1. Build bounded canonical context and workflow-specific policy.
2. Generate against a versioned structural schema. For example, generated human
   tasks require `steps.minItems = 2` where the provider/schema path supports it.
3. Parse the entire response before exposing it as completed.
4. Validate referential integrity and semantic rules, including lifecycle,
   plan, context, permission, evidence, task executability, and duplication.
5. If invalid and safely repairable, make one constrained repair request that
   includes only the rejected structure and exact validation findings.
6. Revalidate from the beginning.
7. Persist the accepted graph atomically.
8. Only after the commit succeeds, expose the authoritative result to the UI.

Database constraints remain the final guard. The system must not pad a task
with invented steps, weaken an invariant, or persist a plausible subset of a
failed graph merely to keep a conversation looking successful.

Conversational prose may be streamed only when it is clearly provisional and
does not claim durable work was created. The authoritative completion packet is
sent after validation and commit. If persistence fails, the existing
conversation and drafts remain intact and the response names the failed stage
with a support reference.

## Atomic plan and work-graph persistence

A plan generation owns its Missions, Tasks, questions, reviews, and proposed
permissions. Persistence occurs through a transaction/RPC that:

- locks or compare-and-swaps the current plan version;
- verifies every child belongs to the same account, workspace, artist, and
  intended song/project context;
- uses stable semantic/idempotency keys for graph nodes;
- inserts the complete accepted graph or nothing;
- marks the prior plan superseded only as part of the successful new-plan
  commit;
- cancels or makes non-projectable all unfinished prior-plan work;
- refuses a stale generation whose base plan version is no longer current;
- records why a task or permission was superseded.

The active-plan pointer is the source of truth. A stale retry after completion
returns the existing committed result; it does not recreate nodes or revive an
old plan.

## Human tasks, questions, reviews, and continuation

Human Task completion uses a stable submission identity. The result,
attachments, review request, review result, task transition, checkpoint change,
and next-work projection are transactionally correlated. Duplicate submissions
return the same result. A review worker may claim a review only through an
atomic lease; its completion is accepted only while its lease token and input
version are current.

Question handling follows the same rule: create equivalent questions once,
record one canonical answer, close duplicates, and resume work through an
idempotent continuation key. Duplicate answers or continuation retries cannot
create multiple plans or tasks. A late continuation is rejected when its plan
or knowledge version is stale.

## Permission model

Permissions are split into two explicit contracts:

### Decision permission

Records an artist's planning choice, such as approve, reject, or hold a proposed
direction. It may change Manager planning but cannot authorize an external
effect. It is bound to the relevant plan/proposal and becomes stale when that
plan is superseded.

### Execution permission

Authorizes one immutable, allowlisted external action with exact target,
payload digest, scope, provider, and idempotency key. Approval cannot be reused
for a modified payload or different target. Rejection is terminal. Execution
requires both an active approval and a matching prepared action.

Legacy unbound permissions are non-executable. They are migrated to a valid
decision record when their intent is unambiguous; otherwise they are cancelled
with a migration reason. Today never presents an approval button that the
resolver cannot legally process.

## External-effect state machine

External actions use an outbox-style state machine:

`proposed -> prepared -> approved -> claimed -> dispatched -> succeeded`

with terminal/holding branches for `rejected`, `failed`, `cancelled`, and
`indeterminate`.

- Claiming is atomic and lease-based.
- The provider idempotency key is stable when the provider supports one.
- A failure before dispatch may be retried under a bounded policy.
- A timeout, disconnect, or crash after possible dispatch becomes
  `indeterminate` unless the provider can prove the outcome.
- Reconciliation queries provider state using the provider request/object ID.
- An indeterminate action is never automatically sent again.
- Success requires provider evidence and persists the evidence reference.
- Failed bookkeeping cannot convert an external success into an apparent safe
  retry; it is escalated for reconciliation.

## Workers, leases, admission, and schedules

All workers claim work with a single atomic database operation that returns a
lease token and input version. Heartbeats extend only the matching active lease.
Completion updates include the lease token so an expired worker cannot win over
a replacement. Expired `running` work is recovered into a retryable or
indeterminate state according to whether an external effect may have occurred.

AI admission reserves capacity atomically before provider invocation. Concurrent
requests cannot all pass a read-then-increment check. Terminal bookkeeping
settles actual usage and releases unused reservation. Limits are enforced per
account/workspace/workflow as appropriate and cannot be bypassed through cron,
manual retries, or parallel tabs.

Scheduled work uses one stable schedule-window key per workspace and job type.
Cron invocation, worker recovery, and user-triggered refresh converge on the
same idempotent operation rather than multiplying work.

Career Watch remains paused or quarantined during remediation. Re-enablement
requires strict structured-output admission, evidence-quality validation,
deduplication against current opportunities/work, bounded cost admission, and
proof that an opportunity signal is not represented as confirmed availability.

## Today and Missions projection

Today is a deterministic projection, not another source of Manager truth. It
includes only records that:

- belong to the authenticated active workspace and intended subject;
- belong to the active plan or are explicitly plan-independent;
- remain actionable under current lifecycle and dependency rules;
- are not superseded, cancelled, terminal, duplicated, or stale;
- have a CTA that the backend is capable of resolving;
- have not been displaced by a newer canonical answer or result.

Today's Brief generation reads through the authenticated/authorized boundary
and writes its service-owned run and artifact through the service client. A
failed refresh preserves the last successful brief and displays its timestamp,
plus a precise retryable failure and trace reference. Refresh requests use a
stable key so repeated clicks do not create parallel generations.

## Error and observability contract

Every entry point preserves the original normalized error before producing a
public response. The error event records operation, stage, trace/request ID,
workflow and domain IDs, error code, safe bounded diagnostic, attempt, lease or
idempotency identity where relevant, and provider request ID. Secrets, raw
private content, and sensitive artist payloads are scrubbed.

The public response includes:

- a useful category (`validation`, `permission`, `temporary`, `conflict`, or
  `unknown_outcome`);
- a human explanation and safe next step;
- whether retry is safe;
- the trace/support reference.

Catch blocks must not replace the diagnostic before telemetry capture. Logging
failure cannot mask the original failure.

## Workflow failure audit matrix

Each critical workflow is audited through:

`before request -> during execution -> halfway failure -> retry -> concurrent duplicate retry -> successful completion -> stale retry after completion`

The required workflows are:

1. Manager review and adaptation;
2. Human Task completion and result handling;
3. question, answer, and resumed work;
4. plan supersession;
5. Career Watch;
6. permission creation, approval, rejection, and hold;
7. external provider execution;
8. provider outcome continuation and reconciliation;
9. background AI admission and settlement;
10. scheduled and recovery workers;
11. canonical Manager knowledge refresh;
12. Today/Missions projection of current work.

For every workflow, tests also vary account, workspace, artist, song/project,
plan version, worker identity, request identity, provider outcome, and timing.

## Test strategy

Tests reproduce failures instead of asserting implementation details.

### Database contract tests

- simultaneous inserts prove unique/idempotency constraints;
- concurrent plan commits prove only one current plan wins;
- stale worker completion proves lease fencing;
- clean-database migration applies every migration in order;
- RLS tests exercise anonymous, authenticated member, cross-account member, and
  service-role access;
- security-definer functions fix `search_path`, validate membership/ownership,
  and grant execute only to intended roles;
- trigger tests prove bounded, non-recursive activation;
- SQL harnesses fail the process on SQL errors rather than merely printing them.

### Edge and domain contract tests

- every user-invoked service-owned workflow uses split user/service clients;
- malformed, truncated, structurally invalid, and semantically invalid model
  output is rejected before persistence or visible completion;
- released-song scenarios cannot create generic pre-release requests;
- provider-confirmed facts do not become artist-confirmed facts;
- duplicate answers, submissions, approvals, refreshes, and cron calls converge
  on one result;
- external timeout-before-dispatch and timeout-after-dispatch produce different
  safe states;
- permission payload changes invalidate prior approval;
- failures retain original telemetry and produce useful public errors.

### Runtime and UI tests

- the last successful brief/read remains visible during refresh and failure;
- buttons are rendered only for resolvable transitions;
- authoritative completion is shown only after persistence;
- live updates cannot reintroduce superseded work;
- navigation preserves exact task/mission/song context;
- repeated clicks and multiple tabs do not duplicate work;
- error UI communicates retry safety and a trace reference.

## Data remediation

Before enabling the corrected runtime:

1. Inventory pending permissions, active plans, unfinished tasks, running jobs,
   duplicate semantic keys, and released-song pre-release work.
2. Classify rather than delete. Preserve an auditable reason for cancellation,
   supersession, migration, or quarantine.
3. Cancel invalid/unbound execution permissions and stale-plan approvals.
4. Supersede prohibited released-song tasks and regenerate only when there is a
   valid current objective.
5. Recover expired internal-only jobs; quarantine possibly-dispatched external
   actions as indeterminate.
6. Add constraints only after duplicate/conflicting rows are deterministically
   resolved.

The remediation is idempotent and testable against a production-shaped copy.

## Rollout and containment

Implementation is phased to reduce blast radius:

1. Contain unsafe background work and improve diagnostic fidelity.
2. Repair ownership boundaries and the broken Today/approval/conversation paths.
3. Introduce shared canonical context and model-output admission.
4. Harden plan/work persistence, projection, permissions, workers, and external
   effects.
5. Remediate existing data and apply stronger database invariants.
6. Verify on a clean database and controlled production-like environment.
7. Deploy migrations before dependent functions, then frontend changes.
8. Run authorized production smoke tests with one intentional operation at a
   time, inspect telemetry and durable state, and stop on duplication or an
   indeterminate effect.

No phase is declared safe solely because unit tests are green. Deployment gates
require code review, clean migration replay, focused concurrency/adversarial
tests, static/type checks, a production build, Edge checks, and direct durable
state inspection.

## Production-readiness standard

The work is not production-ready while any known path can silently stop
managing the artist, perform or display the wrong work, lose the next action,
duplicate work, act without exact permission, cross account/song context, or
misrepresent an internal or external outcome.

Residual risks and deferred provider limitations must be stated explicitly.
“No known critical failure remains” requires evidence from the implementation,
database invariants, adversarial tests, clean migration replay, and controlled
runtime verification.
