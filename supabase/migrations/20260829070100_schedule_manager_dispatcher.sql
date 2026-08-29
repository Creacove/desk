-- Run the Manager dispatcher only when due reminder work exists. This follows the
-- existing workflow-recovery pattern: one global guarded cron, never one cron per
-- workspace or artist.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'workflow_worker_secret') then
    raise exception 'Vault secret workflow_worker_secret must exist before scheduling Manager reminders';
  end if;
  if not exists (select 1 from vault.decrypted_secrets where name = 'project_url') then
    raise exception 'Vault secret project_url must contain this environment''s Supabase URL before scheduling Manager reminders';
  end if;

  perform cron.unschedule(jobid) from cron.job where jobname = 'manager-reminder-dispatcher';

  perform cron.schedule(
    'manager-reminder-dispatcher',
    '*/5 * * * *',
    $manager_reminder_schedule$
      select net.http_post(
        url := regexp_replace(endpoint.decrypted_secret, '/$', '') || '/functions/v1/manager-dispatcher',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-workflow-worker-secret', secret.decrypted_secret
        ),
        body := jsonb_build_object('source', 'scheduled-reminder-dispatch')
      )
      from vault.decrypted_secrets as secret
      cross join vault.decrypted_secrets as endpoint
      where secret.name = 'workflow_worker_secret'
        and endpoint.name = 'project_url'
        and exists (
          select 1
          from public.reminder_queue as reminder
          where reminder.status = 'queued'
            and reminder.scheduled_for <= now()
        );
    $manager_reminder_schedule$
  );
end;
$$;
