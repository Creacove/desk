-- Recover Paddle webhook work even when the opportunistic post-delivery dispatch fails.
-- The credential is provisioned separately in Supabase Vault and never stored in source.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if not exists (
    select 1 from vault.decrypted_secrets where name = 'billing_worker_secret'
  ) then
    raise exception 'Vault secret billing_worker_secret must exist before scheduling the billing worker';
  end if;
  if not exists (
    select 1 from vault.decrypted_secrets where name = 'project_url'
  ) then
    raise exception 'Vault secret project_url must contain this environment''s Supabase URL before scheduling the billing worker';
  end if;

  perform cron.unschedule(jobid)
  from cron.job
  where jobname = 'billing-webhook-recovery';

  perform cron.schedule(
    'billing-webhook-recovery',
    '* * * * *',
    $schedule$
      select net.http_post(
        url := regexp_replace(endpoint.decrypted_secret, '/$', '') || '/functions/v1/paddle-process-webhooks',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-billing-worker-secret', secret.decrypted_secret
        ),
        body := jsonb_build_object('source', 'scheduled-recovery')
      )
      from vault.decrypted_secrets secret
      cross join vault.decrypted_secrets endpoint
      where secret.name = 'billing_worker_secret'
        and endpoint.name = 'project_url';
    $schedule$
  );
end;
$$;
