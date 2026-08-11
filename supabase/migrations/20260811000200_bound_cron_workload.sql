-- Keep event-driven work immediate, retain only guarded recovery sweeps, and
-- remove disposable pg_cron execution history. No public/business table is
-- modified by this migration.

do $$
declare
  billing_command text;
  workflow_command text;
  history_rows_before bigint;
  history_rows_after bigint;
  history_bytes_before bigint;
  active_jobs_before jsonb;
  expected_active_jobs integer;
begin
  select count(*), pg_total_relation_size('cron.job_run_details'::regclass)
    into history_rows_before, history_bytes_before
  from cron.job_run_details;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'jobid', jobid,
        'jobname', jobname,
        'schedule', schedule,
        'active', active
      ) order by jobid
    ),
    '[]'::jsonb
  )
    into active_jobs_before
  from cron.job
  where active;

  select command into billing_command
  from cron.job
  where jobname = 'billing-webhook-recovery'
    and active
  order by jobid desc
  limit 1;

  select command into workflow_command
  from cron.job
  where jobname = 'workflow-recovery-worker'
    and active
  order by jobid desc
  limit 1;

  if billing_command is null then
    raise exception 'Required guarded cron job billing-webhook-recovery was not found';
  end if;
  if workflow_command is null then
    raise exception 'Required guarded cron job workflow-recovery-worker was not found';
  end if;

  raise notice 'Cron cleanup before state: rows=%, bytes=%, active_jobs=%',
    history_rows_before,
    history_bytes_before,
    active_jobs_before;

  -- These polling workers were producing recurring invocations without useful
  -- work. They can return only after durable event queues exist.
  perform cron.unschedule(jobid)
  from cron.job
  where jobname = 'music-manager-read-refresh-worker';

  perform cron.unschedule(jobid)
  from cron.job
  where jobname = 'music-audio-analysis-worker';

  -- Preserve the existing indexed guards and vault-backed commands while
  -- reducing the safety-net cadence from every minute to every five minutes.
  perform cron.unschedule(jobid)
  from cron.job
  where jobname = 'billing-webhook-recovery';

  perform cron.unschedule(jobid)
  from cron.job
  where jobname = 'workflow-recovery-worker';

  perform cron.unschedule(jobid)
  from cron.job
  where jobname = 'cron-history-retention';

  perform cron.schedule(
    'billing-webhook-recovery',
    '*/5 * * * *',
    billing_command
  );

  perform cron.schedule(
    'workflow-recovery-worker',
    '*/5 * * * *',
    workflow_command
  );

  perform cron.schedule(
    'cron-history-retention',
    '17 3 * * *',
    $retention$
      delete from cron.job_run_details
      where end_time < now() - interval '7 days'
    $retention$
  );

  -- Historical scheduler responses are disposable operational metadata. This
  -- is intentionally the only truncated relation.
  truncate table cron.job_run_details;

  select count(*) into history_rows_after from cron.job_run_details;
  if history_rows_after <> 0 then
    raise exception 'Cron history cleanup did not empty cron.job_run_details';
  end if;

  select count(*) into expected_active_jobs
  from cron.job
  where active
    and jobname in (
      'billing-webhook-recovery',
      'workflow-recovery-worker',
      'cron-history-retention'
    );

  if expected_active_jobs <> 3
    or exists (
      select 1 from cron.job
      where jobname in (
        'music-manager-read-refresh-worker',
        'music-audio-analysis-worker'
      )
    )
  then
    raise exception 'Unexpected cron job set after workload cleanup';
  end if;

  raise notice 'Cron cleanup complete: removed_rows=%, reclaimed_relation_bytes_before=%, retained_jobs=3',
    history_rows_before,
    history_bytes_before;
end
$$;
