-- Reinstall the Career Watch cron with portable Vault-backed configuration for
-- databases that already applied the original Gate 6 migration.
do $$
begin
  if exists(select 1 from pg_extension where extname='pg_cron') then
    if not exists(select 1 from vault.decrypted_secrets where name='workflow_worker_secret') then
      raise exception 'Vault secret workflow_worker_secret must exist before scheduling Career Watch';
    end if;
    if not exists(select 1 from vault.decrypted_secrets where name='project_url') then
      raise exception 'Vault secret project_url must exist before scheduling Career Watch';
    end if;

    perform cron.unschedule(jobid)
    from cron.job
    where jobname='manager-career-watch-dispatcher';

    perform cron.schedule(
      'manager-career-watch-dispatcher',
      '17 * * * *',
      $cron$
        select net.http_post(
          url:=regexp_replace(endpoint.decrypted_secret,'/$','')||'/functions/v1/manager-career-watch-dispatcher',
          headers:=jsonb_build_object(
            'Content-Type','application/json',
            'x-workflow-worker-secret',secret.decrypted_secret
          ),
          body:='{}'::jsonb
        )
        from vault.decrypted_secrets secret
        cross join vault.decrypted_secrets endpoint
        where secret.name='workflow_worker_secret'
          and endpoint.name='project_url';
      $cron$
    );
  end if;
end$$;
