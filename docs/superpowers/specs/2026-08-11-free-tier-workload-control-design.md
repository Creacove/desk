# Free-Tier Workload Control Design

## Purpose

Reduce avoidable database, Edge Function, network, and storage consumption without weakening payment or setup recovery. The design removes background work that currently produces no value, preserves bounded recovery paths, and keeps Supabase Cron history small.

## Production evidence

The linked production project currently has four active cron jobs:

| Job | Schedule | Runs per day | Current behavior |
|---|---:|---:|---|
| `billing-webhook-recovery` | every minute | 1,440 | Guarded and normally returns zero rows. The webhook is already the immediate path. |
| `workflow-recovery-worker` | every minute | 1,440 | Guarded and normally returns zero rows. It misses `running` setup rows whose lease is null. |
| `music-manager-read-refresh-worker` | every five minutes | 288 | Its 14-day event predicate remains true. Recent executions inspected 30 subjects and dispatched zero reads. |
| `music-audio-analysis-worker` | every ten minutes | 144 | `AUDIO_ANALYSIS_URL` is not configured. Every invocation returns `not_configured`. |

Together they produce 3,312 cron executions each day. `cron.job_run_details` contains approximately 52,972 rows and occupies 98 MB. The music schedules create recurring Edge invocations and database reads without completing useful work.

## Decisions

### One-time production cleanup

1. Resolve and record the exact active job IDs and current history count/size.
2. Unschedule `music-manager-read-refresh-worker` and `music-audio-analysis-worker`.
3. Replace the billing and setup schedules with five-minute safety sweeps.
4. Truncate only `cron.job_run_details` to remove all retained execution history and reclaim its pages. Do not truncate `cron.job`, business tables, workflow rows, billing events, or application logs.
5. Verify that the history table is empty, the two required recovery jobs remain active, and the two wasteful jobs are absent.

The historical cron rows are disposable operational metadata. The incident evidence needed for this design is already captured in the repository specification and does not justify retaining 98 MB in production.

### Bounded cron retention

Create one daily maintenance job that deletes `cron.job_run_details` rows older than seven days. It runs once per day and is the only unconditional maintenance schedule. With the two safety sweeps running every five minutes, the expected seven-day history is approximately 4,000 rows instead of unbounded monthly growth.

### Billing recovery

Keep Paddle webhook processing event-first. The webhook continues to dispatch processing immediately. The five-minute cron job remains only as a safety net and posts to the worker only when a due, failed, or stale-claimed Paddle event exists.

### Setup recovery

Keep setup event-first through the existing setup dispatch and profile-version trigger. The five-minute sweep handles only actionable recovery rows.

The recovery predicate must treat these as recoverable:

- `queued` and due;
- `running` with an expired lease;
- `running` with no lease and a stale heartbeat/update timestamp.

Recovery claims remain bounded, entitlement-aware, idempotent, and protected with `FOR UPDATE SKIP LOCKED`. A one-time reconciliation processes the currently orphaned setup runs through the same claim/recovery rules rather than directly marking them complete.

Retry accounting must use the current stage attempt for stage recovery. A successful transition through normal setup stages must not consume the whole workflow's failure retry budget.

### Music Manager Read replacement

Remove the 14-day polling model. When an eligible music operating event is written, create a unique queue row keyed by `trigger_event_id`. The request path attempts immediate dispatch after the source transaction completes. A pending row remains available if dispatch fails.

An hourly recovery sweep may be added only after the queue exists. Its SQL guard must require a due pending row, so idle work produces no Edge invocation. The worker claims a bounded batch with leases and never rescans 14 days of unrelated events.

### Audio analysis replacement

Do not schedule audio analysis while the analyzer URL is absent. When the analyzer is configured later, upload completion creates one unique queue row per `uploaded_file_id` and attempts immediate dispatch. A guarded hourly recovery sweep may process only due, unanalyzed files with fewer than three attempts.

Audio evidence must have a uniqueness constraint that prevents duplicate analysis evidence for the same uploaded file and metric.

## Failure behavior

Every worker, queue claim, dispatch, and recovery failure writes through the centralized error telemetry contract. Recovery failures reference their queue/workflow row and never rely solely on cron response bodies or `console.error`.

## Testing and rollout

- Contract tests verify the two wasteful schedules are removed.
- Migration tests verify five-minute billing/setup schedules and seven-day retention.
- Recovery tests cover stale null leases, expired leases, live leases, inactive entitlement, and stage-specific attempts.
- Queue tests cover uniqueness, concurrent claims, immediate dispatch failure, and recovery.
- Production rollout records before/after job definitions, history size, pending queues, active database connections, and Edge invocation counts.
- The deletion is considered complete only after a fresh production query reports zero cron history rows and confirms business tables were untouched.

## Explicit non-goals

- No Supabase plan upgrade.
- No broad database restart.
- No periodic music scan without a durable pending-work queue.
- No removal of payment or setup recovery.
