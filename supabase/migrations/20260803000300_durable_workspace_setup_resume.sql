-- Make the human-to-automation setup handoff durable without introducing a
-- second queue. workspace_setup_runs remains the single source of truth.

create or replace function public.prepare_workspace_setup_resume(
  setup_run_id uuid,
  explicit_retry boolean default false
)
returns public.workspace_setup_runs
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_variable
declare
  setup_row public.workspace_setup_runs%rowtype;
  stages jsonb;
  stage_state jsonb;
  target_stage text;
  catalog_state text;
  discovery_state text;
  brief_state text;
  context_ready boolean := false;
  lease_is_live boolean := false;
begin
  select target.* into setup_row
  from public.workspace_setup_runs as target
  where target.id = setup_run_id
  for update;

  if not found then
    raise exception 'workspace setup run was not found';
  end if;
  if not public.has_active_workspace_entitlement(setup_row.artist_workspace_id) then
    raise exception 'active workspace entitlement is required';
  end if;
  if setup_row.status = 'completed' then
    return setup_row;
  end if;

  select exists (
    select 1
    from public.artist_profiles as profile
    where profile.account_id = setup_row.account_id
      and profile.artist_workspace_id = setup_row.artist_workspace_id
      and profile.artist_id = setup_row.artist_id
      and coalesce(
        nullif(trim(profile.artist_direction), ''),
        nullif(trim(profile.current_goal), ''),
        ''
      ) <> ''
      and coalesce(trim(profile.budget_context), '') <> ''
  ) into context_ready;

  stages := coalesce(setup_row.stage_status, '{}'::jsonb);
  stages := jsonb_set(
    stages,
    '{context_received}',
    coalesce(stages -> 'context_received', '{}'::jsonb) || jsonb_build_object(
      'status', case when context_ready then 'completed' else 'waiting' end,
      'completed_at', case when context_ready then now() else null end
    ),
    true
  );

  catalog_state := coalesce(stages -> 'catalog_bootstrap' ->> 'status', 'queued');
  discovery_state := coalesce(stages -> 'manager_discovery' ->> 'status', 'queued');
  brief_state := coalesce(stages -> 'setup_brief' ->> 'status', 'queued');

  if catalog_state not in ('completed', 'completed_with_limits') then
    target_stage := 'catalog_bootstrap';
  elsif discovery_state not in ('completed', 'completed_with_limits') then
    target_stage := 'manager_discovery';
  elsif not context_ready then
    update public.workspace_setup_runs as target
    set status = 'running',
        current_stage = 'setup_brief',
        stage_status = jsonb_set(stages, '{setup_brief}',
          coalesce(stages -> 'setup_brief', '{}'::jsonb) || jsonb_build_object('status', 'waiting_for_context'), true),
        lease_token = null,
        lease_expires_at = null,
        heartbeat_at = now()
    where target.id = setup_run_id
    returning target.* into setup_row;
    return setup_row;
  elsif brief_state in ('completed', 'completed_with_limits') then
    update public.workspace_setup_runs as target
    set status = 'completed',
        current_stage = 'music_reads',
        stage_status = stages,
        completed_at = coalesce(target.completed_at, now()),
        lease_token = null,
        lease_expires_at = null,
        heartbeat_at = now(),
        last_error = null
    where target.id = setup_run_id
    returning target.* into setup_row;
    return setup_row;
  else
    target_stage := 'setup_brief';
  end if;

  stage_state := coalesce(stages -> target_stage, '{}'::jsonb);
  lease_is_live := stage_state ->> 'status' = 'running'
    and nullif(stage_state ->> 'lease_expires_at', '') is not null
    and (stage_state ->> 'lease_expires_at')::timestamptz > now();

  if lease_is_live then
    update public.workspace_setup_runs as target
    set stage_status = stages,
        heartbeat_at = now()
    where target.id = setup_run_id
    returning target.* into setup_row;
    return setup_row;
  end if;

  if stage_state ->> 'status' = 'failed' and not explicit_retry then
    update public.workspace_setup_runs as target
    set stage_status = stages,
        heartbeat_at = now()
    where target.id = setup_run_id
    returning target.* into setup_row;
    return setup_row;
  end if;

  stage_state := (stage_state - array[
    'error', 'failure', 'failed_at', 'lease_token', 'lease_expires_at', 'heartbeat_at'
  ]) || jsonb_build_object(
    'status', 'queued',
    'attempt', case
      when explicit_retry and (setup_row.status = 'failed' or stage_state ->> 'status' = 'failed') then 0
      else coalesce(nullif(stage_state ->> 'attempt', '')::integer, 0)
    end
  );
  stages := jsonb_set(stages, array[target_stage], stage_state, true);

  update public.workspace_setup_runs as target
  set status = 'queued',
      current_stage = target_stage,
      stage_status = stages,
      workflow_version = coalesce(target.workflow_version, 'workspace_setup_v1'),
      available_at = now(),
      lease_token = null,
      lease_expires_at = null,
      heartbeat_at = null,
      last_error = null,
      completed_at = null
  where target.id = setup_run_id
    and target.status <> 'completed'
  returning target.* into setup_row;

  return setup_row;
end;
$$;

revoke all on function public.prepare_workspace_setup_resume(uuid, boolean) from public, anon, authenticated;
grant execute on function public.prepare_workspace_setup_resume(uuid, boolean) to service_role;

create or replace function public.queue_setup_after_context_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_setup_run_id uuid;
begin
  select target.id into target_setup_run_id
  from public.workspace_setup_runs as target
  where target.account_id = new.account_id
    and target.artist_workspace_id = new.artist_workspace_id
    and target.artist_id = new.artist_id
    and target.status <> 'completed'
    and public.has_active_workspace_entitlement(target.artist_workspace_id)
  order by target.updated_at desc
  limit 1;

  if target_setup_run_id is not null then
    perform public.prepare_workspace_setup_resume(target_setup_run_id, false);
  end if;
  return new;
end;
$$;

revoke all on function public.queue_setup_after_context_version() from public, anon, authenticated;

drop trigger if exists artist_profile_versions_queue_setup_after_context on public.artist_profile_versions;
create trigger artist_profile_versions_queue_setup_after_context
after insert on public.artist_profile_versions
for each row
when (new.source = 'setup')
execute function public.queue_setup_after_context_version();

-- Automatic setup recovery is deliberately isolated from other workflow
-- families. This keeps onboarding durable without enabling broader AI work.
create or replace function public.reap_expired_workspace_setup_runs(batch_size integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer := 0;
begin
  if batch_size < 1 or batch_size > 500 then return 0; end if;

  with expired as (
    select id, current_stage, stage_status,
      coalesce(nullif(stage_status -> current_stage ->> 'attempt', '')::integer, 0) as stage_attempt,
      max_attempts
    from public.workspace_setup_runs
    where workflow_version in ('workspace_setup_v1', 'workspace-setup-v1')
      and (status = 'running' or (status = 'completed' and current_stage = 'music_reads'))
      and lease_expires_at is not null
      and lease_expires_at <= now()
      and public.has_active_workspace_entitlement(artist_workspace_id)
    order by lease_expires_at
    for update skip locked
    limit batch_size
  )
  update public.workspace_setup_runs as target
  set status = case
        when expired.current_stage = 'music_reads' then 'completed'
        when expired.stage_attempt >= expired.max_attempts then 'failed'
        else 'queued'
      end,
      stage_status = jsonb_set(expired.stage_status, array[expired.current_stage],
        coalesce(expired.stage_status -> expired.current_stage, '{}'::jsonb) || jsonb_build_object(
          'status', case
            when expired.current_stage = 'music_reads' and expired.stage_attempt >= expired.max_attempts then 'completed_with_limits'
            when expired.stage_attempt >= expired.max_attempts then 'failed'
            else 'queued'
          end,
          'lease_token', null,
          'lease_expires_at', null
        ), true),
      available_at = case
        when expired.stage_attempt >= expired.max_attempts then target.available_at
        else public.workflow_retry_at(expired.stage_attempt)
      end,
      last_error = case
        when expired.current_stage = 'music_reads' then target.last_error
        when expired.stage_attempt >= expired.max_attempts then coalesce(target.last_error, 'Maximum attempts exhausted.')
        else target.last_error
      end,
      lease_token = null,
      lease_expires_at = null,
      heartbeat_at = null
  from expired
  where target.id = expired.id;
  get diagnostics affected = row_count;
  return affected;
end;
$$;

create or replace function public.list_workspace_setup_recovery_candidates(batch_size integer)
returns setof jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'entity_type', 'workspace_setup_run',
    'id', setup.id,
    'workflow_version', setup.workflow_version,
    'account_id', setup.account_id,
    'artist_workspace_id', setup.artist_workspace_id,
    'artist_id', setup.artist_id,
    'status', setup.status,
    'attempt_count', setup.retry_count,
    'max_attempts', setup.max_attempts,
    'available_at', setup.available_at,
    'lease_expires_at', setup.lease_expires_at,
    'payload', jsonb_build_object(
      'checkout_session_id', setup.checkout_session_id,
      'current_stage', setup.current_stage,
      'stage_status', setup.stage_status,
      'input_refs', setup.input_refs
    )
  )
  from public.workspace_setup_runs as setup
  where setup.workflow_version in ('workspace_setup_v1', 'workspace-setup-v1')
    and setup.status in ('queued', 'running')
    and setup.available_at <= now()
    and (setup.status = 'queued' or (setup.lease_expires_at is not null and setup.lease_expires_at <= now()))
    and public.has_active_workspace_entitlement(setup.artist_workspace_id)
  order by coalesce(setup.lease_expires_at, setup.available_at), setup.id
  limit least(greatest(batch_size, 1), 5);
$$;

revoke all on function public.reap_expired_workspace_setup_runs(integer) from public, anon, authenticated;
grant execute on function public.reap_expired_workspace_setup_runs(integer) to service_role;
revoke all on function public.list_workspace_setup_recovery_candidates(integer) from public, anon, authenticated;
grant execute on function public.list_workspace_setup_recovery_candidates(integer) to service_role;

-- Never spend recovery work on expired or abandoned setup rows.
update public.workspace_setup_runs as target
set workflow_version = null,
    lease_token = null,
    lease_expires_at = null
where target.status in ('queued', 'running', 'failed')
  and not public.has_active_workspace_entitlement(target.artist_workspace_id);

-- Adopt and reconcile every currently entitled unfinished setup once. The
-- transition preserves completed stage payloads and only requeues the first
-- incomplete stage.
do $$
declare
  candidate record;
begin
  for candidate in
    select target.id
    from public.workspace_setup_runs as target
    where target.status in ('queued', 'running', 'failed')
      and public.has_active_workspace_entitlement(target.artist_workspace_id)
    order by target.created_at
  loop
    update public.workspace_setup_runs
    set workflow_version = 'workspace_setup_v1',
        available_at = now()
    where id = candidate.id;
    perform public.prepare_workspace_setup_resume(candidate.id, true);
  end loop;
end;
$$;

-- Replace the observation-only safety net with a setup-only recovery worker.
-- The indexed EXISTS guard means idle minutes do not call the Edge Function.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'workflow_worker_secret') then
    raise exception 'Vault secret workflow_worker_secret must exist before scheduling workflow recovery';
  end if;
  if not exists (select 1 from vault.decrypted_secrets where name = 'project_url') then
    raise exception 'Vault secret project_url must contain this environment''s Supabase URL before scheduling workflow recovery';
  end if;

  perform cron.unschedule(jobid) from cron.job where jobname = 'workflow-recovery-observer';
  perform cron.unschedule(jobid) from cron.job where jobname = 'workflow-recovery-worker';

  perform cron.schedule(
    'workflow-recovery-worker',
    '* * * * *',
    $workflow_schedule$
      select net.http_post(
        url := regexp_replace(endpoint.decrypted_secret, '/$', '') || '/functions/v1/workflow-recovery',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-workflow-worker-secret', secret.decrypted_secret
        ),
        body := jsonb_build_object('mode', 'run')
      )
      from vault.decrypted_secrets as secret
      cross join vault.decrypted_secrets as endpoint
      where secret.name = 'workflow_worker_secret'
        and endpoint.name = 'project_url'
        and exists (
          select 1
          from public.workspace_setup_runs as setup
          where setup.workflow_version in ('workspace_setup_v1', 'workspace-setup-v1')
            and setup.status in ('queued', 'running')
            and setup.available_at <= now()
            and (
              setup.status = 'queued'
              or (setup.lease_expires_at is not null and setup.lease_expires_at <= now())
            )
            and public.has_active_workspace_entitlement(setup.artist_workspace_id)
        );
    $workflow_schedule$
  );
end;
$$;
