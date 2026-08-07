-- Server-side, event-driven refresh for material song/project changes. The
-- worker deduplicates against the durable Manager Read run before invoking it,
-- so this job does no model work when nothing relevant changed.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'workflow_worker_secret') then
    raise exception 'Vault secret workflow_worker_secret must exist before scheduling music Manager Read refresh';
  end if;
  if not exists (select 1 from vault.decrypted_secrets where name = 'project_url') then
    raise exception 'Vault secret project_url must contain this environment''s Supabase URL before scheduling music Manager Read refresh';
  end if;

  perform cron.unschedule(jobid) from cron.job where jobname = 'music-manager-read-refresh-worker';
  perform cron.schedule(
    'music-manager-read-refresh-worker',
    '*/5 * * * *',
    $music_read_refresh$
      select net.http_post(
        url := regexp_replace(endpoint.decrypted_secret, '/$', '') || '/functions/v1/music-manager-read-refresh-worker',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-workflow-worker-secret', secret.decrypted_secret
        ),
        body := '{}'::jsonb
      )
      from vault.decrypted_secrets as secret
      cross join vault.decrypted_secrets as endpoint
      where secret.name = 'workflow_worker_secret'
        and endpoint.name = 'project_url'
        and exists (
          select 1
          from public.operating_events as event
          where event.created_at >= now() - interval '14 days'
            and event.target_type in ('music_item', 'music_project', 'music_split')
        );
    $music_read_refresh$
  );
end;
$$;
