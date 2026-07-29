# Production Reliability Live Workspace Rollout

This runbook covers the reliability and live-update work for setup, discovery, Today's Brief, Manager Reads, Mission Genesis, and workflow recovery.

Do not run Docker-dependent local database commands for this project. The operator should apply the migrations from a normal Supabase CLI environment that is linked to the intended project.

## Migration Order

Apply these migrations in order:

1. `20260728000100_workspace_operating_events.sql`
2. `20260728000200_production_reliability_v1.sql`
3. `20260728000300_workflow_recovery_candidates.sql`
4. `20260728000400_todays_brief_and_mission_finalizers.sql`
5. `20260728000500_schedule_workflow_recovery.sql`

The scheduling migration preflights Vault secrets and uses conditional `exists` checks before invoking workers. It should not create idle Edge Function traffic when no eligible work exists.

## Required Secrets

Set these before applying the scheduling migration:

- Supabase Vault secret `workflow_worker_secret`
- Supabase Vault secret `billing_worker_secret`
- Edge Function environment `WORKFLOW_WORKER_SECRET`
- Edge Function environment `BILLING_WORKER_SECRET`

Keep `WORKFLOW_RECOVERY_ENABLED_VERSIONS` empty during observation mode. Enable recovery later with an explicit comma-separated allowlist, for example:

```text
setup-todays-brief-v2,mission-genesis-v2,music-manager-read-v2
```

## Functions To Deploy

Deploy these functions together with the migrations:

- `paid-workspace-setup`
- `manager-discovery`
- `spotify-catalog-bootstrap`
- `generate-todays-brief`
- `generate-music-summary`
- `mission-genesis`
- `workflow-recovery`
- `paddle-process-webhooks`

## Cost Controls

The frontend should not busy-poll when idle. Live workspace updates use one Realtime channel when the rollout gate is enabled, defer reads while the tab is hidden, and use bounded fallback checks only for active visible work.

Workflow recovery is intentionally conservative:

- Cron runs every minute, but the SQL command calls the Edge Function only when indexed eligible work exists.
- Recovery starts in observation mode.
- Recovery execution is allowlisted by workflow version.
- Recovery batches are capped.
- Hidden or offline browser tabs do not run fallback checks.
- Setup and read status reconciliation uses exact workflow state, not broad reload loops.

## Smoke Checks

After deployment, verify:

- Reload during setup resumes the active run and does not restart Spotify discovery.
- Completing setup shows the generated setup map, Today's Brief, and queued music reads without a manual page reload.
- A generated Today's Brief appears from saved manager output and uses the grounded packet versions.
- A song or project Manager Read finishes and appears in its room without a page reload.
- Mission Genesis completion writes the mission/action/event through `finalize_mission_genesis_v2`.
- Notifications and operating events appear through live updates without refreshing the app.
- Hidden tabs do not continue fallback checks until visible again.

Useful SQL checks:

```sql
select jobname, schedule, active
from cron.job
where jobname in ('workflow-recovery-observer', 'billing-webhook-recovery');

select workflow_version, status, count(*)
from public.manager_synthesis_runs
group by workflow_version, status
order by workflow_version, status;

select *
from public.list_workflow_recovery_candidates(4);
```

For egress/compute monitoring, compare Edge Function invocations before and after enabling the rollout. Idle minutes should show no recovery worker invocation unless an eligible queued, running-expired, or retryable row exists.

## Rollback

Rollback should first stop background invocation, then revert application code if needed:

1. Clear `WORKFLOW_RECOVERY_ENABLED_VERSIONS`.
2. Unschedule cron jobs if the scheduler is suspected:

```sql
select cron.unschedule('workflow-recovery-observer')
where exists (select 1 from cron.job where jobname = 'workflow-recovery-observer');

select cron.unschedule('billing-webhook-recovery')
where exists (select 1 from cron.job where jobname = 'billing-webhook-recovery');
```

3. Redeploy the previous Edge Functions if a function regression is confirmed.
4. Keep the database finalizers in place unless a specific migration issue is identified. They are replay-safe and protect against duplicate writes.

## Verification Performed In This Worktree

No production migrations were applied. No Docker commands were used.

Local verification is recorded in the implementation commits. Before deployment, rerun the focused test suites and production build from the final branch state.
