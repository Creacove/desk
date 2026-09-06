# Six-person artist team: Astra/Luna execution protocol

This supplements [the implementation plan](./2026-09-05-six-person-artist-team.md). Commercial terms and release gates remain unchanged: $99/month, six people including owner, one artist. This document defines the next implementation session; writing it does not launch workers or change application code.

## Working model

- Coordinator: Astra, responsible for architectural decisions, contract consistency, sensitive cross-system integration, consolidated review, and release judgment.
- Implementation workers: `gpt-5.6-luna`, reasoning effort `max`, as requested by the user.
- Start each worker with `fork_turns="none"` and a self-contained brief. Do not inherit the whole conversation or require every worker to read the entire long plan.
- Maximum concurrency in this session: coordinator plus three workers. Use fewer workers when dependencies or file ownership prevent useful parallel work.
- Workers own local implementation/test/repair loops and report completion once. Escalate earlier only for an actual missing contract, unexpected baseline conflict, unsafe migration, or dependency blocker.
- No recursive delegation, public deployment, real payment, or real invitation sends by workers.

Luna Max is a smaller model with maximum reasoning effort. It does not imply fewer generated tokens. Optimize total effort by reducing duplicated context, repeated investigation, integration conflicts, and coordinator repair cycles. Do not promise a fixed savings percentage or translate API prices into Codex account-limit savings without applicable evidence.

## Coordinator preparation

Before dispatch, preserve the implementation baseline and produce a small versioned contract pack containing only:

1. Scope and invariants: account/workspace identity, six-seat reservation rule, role matrix, legacy solo fallback.
2. Exact SQL RPC signatures, request/response types, errors, and authorization boundaries.
3. Roster/capability/assignment/viewer/notification contracts and sample serialized fixtures.
4. Database migration ordering and account-before-task lock ordering.
5. Exact ownership list for each package, including shared-file integration responsibilities.
6. Behavioral acceptance cases and commands with expected outcomes.

Freeze this contract before workers build dependent pieces. A worker cannot silently change an API to make its own implementation easier. The coordinator evaluates necessary amendments, records one versioned change, and sends only the relevant delta to affected workers.

Do not expand the blueprint into the complete implementation in prose or duplicated code: that spends Astra tokens on work Luna will redo. Specify decisions and tests precisely, then let workers write and debug their assigned code.

## Work packages and dependency waves

### Foundation wave

**Worker A — database identity and authority**

Own the new foundation, membership-operation, and authority migrations; their SQL tests; canonical roster/authorization server modules. Cover Tasks 1–2 database work and Task 4 database authority. Must verify non-recursive entitlement checks, one-artist boundary, reservation concurrency, owner protection, and direct-write restrictions.

**Worker B — team client modules**

Own new files under `src/features/team/`, `src/services/workspaceTeamService.ts`, invitation-route handling, and their component/service tests. Build against the frozen contracts and typed fixtures. Do not edit `ProductionApp.tsx`, `productionSupabase.ts`, or shared type files while others rely on them.

**Worker C — acceptance test infrastructure**

Own new team fixtures, multi-user/concurrency harnesses, and release-evidence templates. Derive negative cases from the frozen product contract, not merely from Worker A's implementation. Do not alter another worker's production code or migration tests. Never make tests pass by weakening requirements.

The coordinator prepares the baseline and integration contracts alongside this work. When the database foundation returns, inspect the security-critical diff and its actual test evidence before dependent runtime wiring. This is the one early architectural checkpoint.

### Runtime wave

Reuse completed workers with a concise delta when their context remains relevant; start a fresh narrowly briefed worker for unrelated work.

**Worker A — server integration and delegation**

Own `account-team`, existing task/permission entrypoint integration, generation schemas/context, graph persistence, and the runtime-assignment migration. This package is deliberately sequential within one owner because authority and task persistence touch many of the same files. Include source attribution and artist-understanding authority changes from Task 4.

**Worker B — application integration**

After the coordinator releases ownership, own `ProductionApp.tsx`, `productionSupabase.ts`, shared browser contracts, Settings integration, workspace selection, personal Today, and Mission controls. Integrate the previously built modules. Own all browser changes to these large files for this wave.

**Worker C — reminder/realtime backend**

Own the personal-reminder migration, reminder SQL/dispatcher/shared helper, and delivery concurrency tests. Specify required browser event fields to Worker B through the frozen contract. Worker B owns browser live-sync wiring so both workers do not edit the same frontend files.

The coordinator checks returned package evidence and performs one consolidated integration review when these packages complete. Avoid routine line-by-line commentary while workers are still implementing.

### Validation and commercial wave

- A completed worker executes authenticated end-to-end and model-eval checks against the integrated candidate and returns failures as one reproducible report. Do not run expensive end-to-end tests repeatedly against partially integrated code.
- The coordinator reviews identity/authority, concurrency, every assignment persistence path, and the full diff, then runs the existing release gates.
- Aggregate findings by owning package. Return one complete correction batch to each affected worker, with expected behavior and reproductions. Tiny obvious integration fixes can be handled directly by the coordinator.
- Billing is a later sequential package based on the integrated candidate. It touches the same large services and existing uncommitted payment fixes; do not develop it concurrently with app integration in those files.
- Monday pilot and paid self-service remain separate acceptance milestones. Passing worker tests alone does not authorize broad rollout.

## Required dispatch brief

Every worker receives this structure with actual paths, interfaces, and test cases filled in before dispatch:

```text
Outcome: The observable behavior this package must deliver.
Baseline: Exact checkout/path and reviewed baseline identity.
Read first: Only the relevant source files and contract-pack sections.
Own: Exact files/directories permitted for mutation.
Read only: Shared files needed for understanding but owned elsewhere.
Interfaces: Exact types, RPC signatures, error codes, and fixture examples.
Required behavior: Positive cases, negative cases, race cases, legacy behavior.
Constraints: Preserve existing work, security checks, and current public contracts.
Verification: Exact commands and what a successful result proves.
Completion: Implement, run tests, fix local failures, inspect your diff.
Escalation: Report contract/baseline blockers early; do not invent a new contract.
Return: Compact report, changed files, test evidence, unresolved risks.
```

The dispatched version must contain the concrete values. This reusable structure is not itself a sufficient worker assignment.

## Worker return contract

One report, normally no more than 400 words:

```text
Status: complete | blocked
Files changed: paths
Behavior delivered: brief bullets tied to acceptance cases
Verification: command, pass/fail counts, evidence file path
Contract deviations: none, or exact deviation requiring coordinator decision
Known limits: explicit, including checks unavailable in this environment
Integration notes: migration order or deployment dependency only
```

Store long logs locally in evidence files. Return concise failure excerpts only when needed. Never return full diffs, repeated plans, secrets, or lengthy chronological narration in the completion message.

## File ownership and isolation

All agents share the filesystem. A spawned agent does not automatically receive an isolated checkout. Before parallel mutation, either establish disjoint file ownership in the shared checkout or explicitly create and assign separate worktree paths from the preserved baseline.

Prefer disjoint ownership for new modules. Use sequential ownership for `ProductionApp.tsx`, `productionSupabase.ts`, central contracts, existing payment functions, and migration function replacements. Do not allow concurrent edits to the same file and hope Git will reconcile semantics.

Each contract and fixture has one owner. Test suites can run concurrently only when they do not mutate a shared database/fixture. Serialize database reset, schema migration, and shared staging-fixture operations.

## Efficiency rules

- Dispatch by coherent behavior, not by every checklist item. Keep related changes with one worker.
- Give workers relevant plan excerpts and source paths; omit meeting history and unrelated repository sections.
- Share stable contracts once. Send deltas rather than re-pasting the whole plan.
- Workers run focused tests and repair their own failures before reporting. The coordinator runs integrated/full gates at meaningful milestones.
- Keep reports short and avoid repeatedly polling unchanged progress.
- Use automated checks for mechanical requirements; reserve coordinator review for architecture, authority, state transitions, and integration.
- If a correction batch exposes a deeper misunderstanding, the coordinator resolves the narrow issue instead of sustaining an unbounded back-and-forth loop.
- Measure actual elapsed time, retries, tests passed, and available usage data. Model size alone is not evidence that a run was efficient.

## Acceptance of the coordination strategy

The objective is one complete delivery per package followed by consolidated review and bounded corrections when necessary. No reliable workflow can promise every package will be correct on its first attempt. Keep the early foundation checkpoint because a mistaken identity/permission contract would make downstream rework substantially more expensive.
