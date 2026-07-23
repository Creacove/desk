# Agentic Onboarding Retry Recovery Design

**Date:** 2026-07-23  
**Status:** Approved design awaiting implementation planning

## Objective

Make paid workspace onboarding tolerate partial catalog-provider coverage and ensure that the Retry setup action restarts the stage that actually failed without paying to repeat successful Chartmetric enrichment.

This is a surgical reliability change. It must preserve the existing onboarding architecture and successful behavior.

## Incident Summary

On 2026-07-22, a paid onboarding run successfully completed:

- Spotify catalog bootstrap;
- Chartmetric artist enrichment with 15 evidence signals;
- one project enrichment;
- three of five requested focus-track enrichments;
- public-context collection; and
- strategic-memory writes.

Two focus-track lookups returned no Chartmetric entity ID. The requests themselves did not fail. The provider simply could not match those Spotify track identifiers, and the catalog rows did not contain ISRC identifiers for a fallback lookup.

`assertRequiredDiscoveryCompleted` treated any unresolved focus asset as fatal. The discovery function returned HTTP 500 even though it had enough successful intelligence to continue.

After contextualization was attempted, the setup run's `current_stage` became `setup_brief`. The Retry setup path selected its retry phase from `current_stage`, so it retried contextualization instead of the failed discovery stage. The run remained stuck and repeated retries incremented its retry count.

## Product Invariants

The implementation must preserve these invariants:

1. Provider-backed artist intelligence remains required.
2. When the imported catalog contains assets, discovery requires at least one successfully enriched track or project.
3. One or more unresolved focus assets must produce `completed_with_limits`, not HTTP 500, when the minimum successful intelligence threshold is met.
4. A retry must be routed from the actual failed stage, not merely from `current_stage`.
5. Successful Chartmetric artist, track, and project snapshots must be reused during retry while they are fresh.
6. Retry must not delete or overwrite successful evidence, memories, catalog records, or completed setup stages.
7. Repeated retry requests must be idempotent at the setup-stage level and must not launch concurrent duplicate discovery runs.
8. Existing fully successful onboarding behavior must remain unchanged.

## Scope

### In scope

- Correct the discovery completion decision for partially unresolved focus assets.
- Record unresolved focus assets as discovery limitations.
- Correct setup retry routing when manager discovery failed.
- Verify that retries use the existing 24-hour Chartmetric snapshot cache.
- Add focused behavioral regression tests.
- Repair the affected failed setup run only after the production fix is deployed and verified.

### Out of scope

- UI redesign.
- Database schema changes.
- Billing or entitlement changes.
- Changes to Spotify catalog bootstrap.
- Changes to Manager prompts or focus-asset selection.
- A new job queue or per-track checkpointing subsystem.
- Broad refactoring of the onboarding functions.
- Changing the requirement for provider-backed artist intelligence.

## Design

### 1. Classify discovery results

Replace the binary assertion over all asset results with a small, deterministic classification:

- `failed`: artist enrichment is absent, failed, or unresolved.
- `failed`: the catalog has assets but no track or project enrichment succeeded or was served from cache.
- `completed_with_limits`: the minimum success threshold is met and at least one requested tool failed or returned `unresolved`.
- `completed`: the minimum success threshold is met and no requested tool failed or returned `unresolved`.

For this classification, `completed` and `cached` are successful enrichment statuses. `unresolved` is a limitation, not a thrown provider failure.

The discovery function will continue writing the normal completion event. When limitations exist, it will also write `manager_discovery_completed_with_limits`, including sanitized limitation metadata. Setup stage completion will receive the classification result rather than deriving `limited` only from thrown tool failures.

### 2. Route retry from stage state

The billing-status retry path must load `stage_status` with the setup run.

Retry selection order:

1. If `manager_discovery.status` is `failed`, invoke `paid-workspace-setup` with phase `discovery` and `explicitRetry: true`.
2. Otherwise, if `setup_brief.status` is `failed` or `current_stage` is `setup_brief`, invoke phase `contextualize`.
3. Otherwise, invoke phase `discovery`.

This precedence prevents a later setup-brief failure marker from hiding the earlier discovery failure.

### 3. Reuse successful paid enrichment

The current discovery tools check for a matching fresh `source_snapshot` before constructing the Chartmetric client or making a provider request. Matching is scoped by workspace, snapshot type, subject metadata, and a 24-hour freshness window.

The surgical patch will retain that mechanism. The regression tests must verify the following ordering remains present for artist, track, and project enrichment:

1. resolve the internal subject;
2. check for a fresh matching snapshot;
3. return cached evidence when present;
4. only then create the provider client and perform a Chartmetric lookup.

On an explicit discovery retry, the Manager loop may run again, but completed paid enrichments must be served from stored snapshots. Only unresolved assets without snapshots may generate new Chartmetric lookups.

No new cache table, cache invalidation scheme, or checkpoint subsystem will be introduced in this patch.

### 4. Prevent duplicate recovery runs

Before dispatching discovery, the setup orchestrator must continue to claim/update the setup stage deterministically. An explicit retry may transition a terminal failed discovery stage to running. A request received while discovery is already running must return the running state without dispatching another discovery function.

The patch must not weaken the existing completed-stage short circuit.

### 5. Affected production run

The failed run from 2026-07-22 must not be manually advanced before the code fix is verified. After deployment:

1. invoke the normal Retry setup path;
2. confirm discovery re-enters `running`;
3. confirm existing successful Chartmetric snapshots are reused;
4. confirm discovery becomes `completed_with_limits`;
5. confirm contextualization completes and Desk HQ opens.

This validates the real recovery path rather than masking it with a direct database edit.

## Failure Handling

- A provider lookup that returns no entity ID is `unresolved`.
- A provider authentication, rate-limit, timeout, or server error remains a tool failure and is recorded as a limitation when the minimum successful intelligence threshold is still met.
- If artist intelligence is unavailable, discovery remains failed because downstream Manager output would lack its required foundation.
- If the catalog has assets but every focus-asset enrichment is unavailable, discovery remains failed and Retry setup remains available.
- Retry cannot guarantee that a continuing provider outage will recover immediately. It must, however, target the correct stage, preserve completed work, and remain safe to press again.

## Testing

Add behavioral tests for:

1. Artist and all requested assets succeed: discovery is `completed`.
2. Artist, project, and some tracks succeed while other tracks are unresolved: discovery is `completed_with_limits`.
3. Artist succeeds but every requested asset is unresolved: discovery fails.
4. Artist enrichment is unresolved or fails: discovery fails.
5. A failed manager-discovery stage with `current_stage = setup_brief` retries discovery.
6. A failed setup brief after completed discovery retries contextualization.
7. A running discovery stage does not dispatch a duplicate run.
8. Fresh subject-specific snapshots are returned before Chartmetric client creation.
9. Existing onboarding, billing, production-shell, and function contract tests remain green.

Verification must include the focused test files, the full test suite, and a production build.

## Deployment and Rollback

Deploy only the affected Edge Functions after local verification. Do not combine this patch with unrelated application changes.

Canary the recovery flow with a low-coverage artist before the important demo or broader onboarding. Confirm the setup events and stage transitions in production.

Rollback consists of redeploying the previous function versions. No database rollback is required because this design introduces no schema migration and preserves existing event and stage-status shapes.

## Success Criteria

- Partial provider coverage no longer strands onboarding.
- Retry selects the actual failed stage.
- Successful paid Chartmetric work is reused from stored snapshots.
- Repeated retry requests do not create concurrent duplicate discovery runs.
- Fully successful onboarding behaves exactly as before.
- The previously failed production setup run recovers through the normal Retry setup action.
