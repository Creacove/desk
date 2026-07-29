-- Conditional one-minute safety nets. Both jobs use indexed EXISTS checks so idle
-- workspaces do not call Edge Functions or consume network egress.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'workflow_worker_secret') then
    raise exception 'Vault secret workflow_worker_secret must exist before scheduling workflow recovery';
  end if;
  if not exists (select 1 from vault.decrypted_secrets where name = 'billing_worker_secret') then
    raise exception 'Vault secret billing_worker_secret must exist before scheduling billing recovery';
  end if;

  perform cron.unschedule(jobid) from cron.job where jobname = 'workflow-recovery-observer';
  perform cron.unschedule(jobid) from cron.job where jobname = 'billing-webhook-recovery';

  perform cron.schedule(
    'workflow-recovery-observer',
    '* * * * *',
    $workflow_schedule$
      select net.http_post(
        url := 'https://bbwbxmnanccwottrmkqu.supabase.co/functions/v1/workflow-recovery',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-workflow-worker-secret', secret.decrypted_secret
        ),
        body := jsonb_build_object('mode', 'observe')
      )
      from vault.decrypted_secrets as secret
      where secret.name = 'workflow_worker_secret'
        and (
          exists (
            select 1 from public.manager_synthesis_runs as run
            where run.workflow_version is not null
              and (
                (run.status = 'queued' and run.available_at <= now())
                or (run.status = 'running' and run.lease_expires_at is not null and run.lease_expires_at <= now())
              )
          )
          or exists (
            select 1 from public.source_sync_jobs as job
            where job.workflow_version is not null
              and (
                (job.status = 'queued' and job.available_at <= now())
                or (job.status = 'running' and job.lease_expires_at is not null and job.lease_expires_at <= now())
              )
          )
          or exists (
            select 1 from public.workspace_setup_runs as setup
            where setup.workflow_version is not null
              and setup.status in ('queued', 'running')
              and setup.available_at <= now()
              and (setup.status = 'queued' or (setup.lease_expires_at is not null and setup.lease_expires_at <= now()))
          )
        );
    $workflow_schedule$
  );

  -- Predicate matches billing_webhook_events_queue_idx and the worker claim RPC.
  perform cron.schedule(
    'billing-webhook-recovery',
    '* * * * *',
    $billing_schedule$
      select net.http_post(
        url := 'https://bbwbxmnanccwottrmkqu.supabase.co/functions/v1/paddle-process-webhooks',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-billing-worker-secret', secret.decrypted_secret
        ),
        body := jsonb_build_object('source', 'scheduled-recovery')
      )
      from vault.decrypted_secrets as secret
      where secret.name = 'billing_worker_secret'
        and exists (
          select 1 from public.billing_webhook_events as event
          where event.provider = 'paddle'
            and (
              (event.processing_status in ('received', 'failed') and coalesce(event.next_attempt_at, now()) <= now())
              or (event.processing_status = 'processing' and event.claimed_at < now() - interval '5 minutes')
            )
        );
    $billing_schedule$
  );
end;
$$;
