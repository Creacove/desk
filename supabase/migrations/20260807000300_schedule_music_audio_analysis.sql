-- Audio is analyzed only by a protected server worker. The worker exits safely
-- until an AUDIO_ANALYSIS_URL is configured in the Edge Function environment.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'workflow_worker_secret') then
    raise exception 'Vault secret workflow_worker_secret must exist before scheduling music audio analysis';
  end if;
  if not exists (select 1 from vault.decrypted_secrets where name = 'project_url') then
    raise exception 'Vault secret project_url must contain this environment''s Supabase URL before scheduling music audio analysis';
  end if;

  perform cron.unschedule(jobid) from cron.job where jobname = 'music-audio-analysis-worker';
  perform cron.schedule(
    'music-audio-analysis-worker',
    '*/10 * * * *',
    $music_audio_analysis$
      select net.http_post(
        url := regexp_replace(endpoint.decrypted_secret, '/$', '') || '/functions/v1/music-audio-analysis-worker',
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
          from public.music_assets
          where asset_type in ('demo', 'rough_mix', 'final_master', 'clean_version', 'instrumental', 'stems')
            and status in ('uploaded', 'confirmed')
            and uploaded_file_id is not null
        );
    $music_audio_analysis$
  );
end;
$$;
