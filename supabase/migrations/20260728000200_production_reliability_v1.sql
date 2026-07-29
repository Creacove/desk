alter table public.manager_synthesis_runs
  add column if not exists workflow_version text,
  add column if not exists input_refs jsonb not null default '[]'::jsonb,
  add column if not exists scope_key text,
  add column if not exists idempotency_key text,
  add column if not exists attempt_count integer not null default 0,
  add column if not exists max_attempts integer not null default 3,
  add column if not exists available_at timestamptz not null default now(),
  add column if not exists lease_token uuid,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists heartbeat_at timestamptz,
  add column if not exists last_attempt_started_at timestamptz;

alter table public.source_sync_jobs
  add column if not exists workflow_version text,
  add column if not exists input_refs jsonb not null default '[]'::jsonb,
  add column if not exists scope_key text,
  add column if not exists idempotency_key text,
  add column if not exists attempt_count integer not null default 0,
  add column if not exists max_attempts integer not null default 3,
  add column if not exists available_at timestamptz not null default now(),
  add column if not exists lease_token uuid,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists heartbeat_at timestamptz,
  add column if not exists last_attempt_started_at timestamptz,
  add column if not exists subject_type text,
  add column if not exists subject_id uuid,
  add column if not exists target_payload jsonb not null default '{}'::jsonb,
  add column if not exists workspace_setup_run_id uuid references public.workspace_setup_runs(id) on delete set null;

alter table public.workspace_setup_runs
  add column if not exists workflow_version text,
  add column if not exists input_refs jsonb not null default '[]'::jsonb,
  add column if not exists scope_key text,
  add column if not exists idempotency_key text,
  add column if not exists max_attempts integer not null default 3,
  add column if not exists available_at timestamptz not null default now(),
  add column if not exists lease_token uuid,
  add column if not exists lease_expires_at timestamptz,
  add column if not exists heartbeat_at timestamptz,
  add column if not exists last_attempt_started_at timestamptz;

alter table public.workspace_setup_runs
  alter column workflow_version set default 'workspace_setup_v1';

update public.workspace_setup_runs
set workflow_version = 'workspace_setup_v1'
where workflow_version is null and status = 'queued';

create index if not exists manager_synthesis_runs_recovery_idx
  on public.manager_synthesis_runs (status, available_at, lease_expires_at)
  where workflow_version is not null and status in ('queued', 'running');

create index if not exists source_sync_jobs_recovery_idx
  on public.source_sync_jobs (status, available_at, lease_expires_at)
  where workflow_version is not null and status in ('queued', 'running');

create index if not exists workspace_setup_runs_recovery_idx
  on public.workspace_setup_runs (status, available_at, lease_expires_at)
  where workflow_version is not null and status in ('queued', 'running');

create unique index if not exists source_sync_jobs_active_scope_idx
  on public.source_sync_jobs (account_id, artist_workspace_id, job_type, scope_key)
  where workflow_version is not null
    and scope_key is not null
    and status in ('queued', 'running');

create unique index if not exists manager_synthesis_runs_active_brief_scope_idx
  on public.manager_synthesis_runs (account_id, artist_workspace_id, classification, scope_key)
  where workflow_version is not null
    and scope_key is not null
    and classification in ('setup_todays_brief_v1', 'recurring_todays_brief_v1')
    and status in ('queued', 'running');

create unique index if not exists manager_synthesis_runs_active_mission_genesis_scope_idx
  on public.manager_synthesis_runs (account_id, artist_workspace_id, classification, scope_key)
  where workflow_version is not null
    and scope_key is not null
    and classification in ('mission_genesis_v2', 'mission_genesis_continue_v2')
    and status in ('queued', 'running');

create unique index if not exists manager_synthesis_runs_idempotency_idx
  on public.manager_synthesis_runs (account_id, artist_workspace_id, idempotency_key)
  where workflow_version is not null and idempotency_key is not null;

create unique index if not exists source_sync_jobs_idempotency_idx
  on public.source_sync_jobs (account_id, artist_workspace_id, idempotency_key)
  where workflow_version is not null and idempotency_key is not null;

create or replace function public.claim_manager_synthesis_run(run_id uuid, lease_seconds integer)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed_token uuid := gen_random_uuid();
begin
  if lease_seconds < 5 or lease_seconds > 3600 then
    raise exception 'lease_seconds must be between 5 and 3600';
  end if;

  update public.manager_synthesis_runs as target
  set status = 'running',
      attempt_count = target.attempt_count + 1,
      lease_token = claimed_token,
      lease_expires_at = now() + make_interval(secs => lease_seconds),
      heartbeat_at = now(),
      last_attempt_started_at = now(),
      started_at = coalesce(target.started_at, now()),
      error = null
  where target.id = run_id
    and target.workflow_version is not null
    and target.attempt_count < target.max_attempts
    and target.available_at <= now()
    and (
      target.status = 'queued'
      or (target.status = 'running' and target.lease_expires_at is not null and target.lease_expires_at <= now())
    );

  if not found then return null; end if;
  return claimed_token;
end;
$$;

create or replace function public.claim_source_sync_job(job_id uuid, lease_seconds integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed_token uuid := gen_random_uuid();
begin
  if lease_seconds < 5 or lease_seconds > 3600 then
    raise exception 'lease_seconds must be between 5 and 3600';
  end if;

  update public.source_sync_jobs as target
  set status = 'running',
      attempt_count = target.attempt_count + 1,
      lease_token = claimed_token,
      lease_expires_at = now() + make_interval(secs => lease_seconds),
      heartbeat_at = now(),
      last_attempt_started_at = now(),
      started_at = coalesce(target.started_at, now()),
      error = null
  where target.id = job_id
    and target.workflow_version is not null
    and target.attempt_count < target.max_attempts
    and target.available_at <= now()
    and (
      target.status = 'queued'
      or (target.status = 'running' and target.lease_expires_at is not null and target.lease_expires_at <= now())
    );

  if not found then return null; end if;
  return jsonb_build_object(
    'token', claimed_token,
    'expires_at', now() + make_interval(secs => lease_seconds),
    'attempt', (select attempt_count from public.source_sync_jobs where id = job_id)
  );
end;
$$;

create or replace function public.heartbeat_manager_synthesis_run(run_id uuid, current_lease_token uuid, lease_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if lease_seconds < 5 or lease_seconds > 3600 then return false; end if;
  update public.manager_synthesis_runs as target
  set heartbeat_at = now(),
      lease_expires_at = now() + make_interval(secs => lease_seconds)
  where target.id = run_id
    and target.workflow_version is not null
    and target.status = 'running'
    and target.lease_token = current_lease_token
    and target.lease_expires_at > now();
  return found;
end;
$$;

create or replace function public.heartbeat_source_sync_job(job_id uuid, current_lease_token uuid, lease_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if lease_seconds < 5 or lease_seconds > 3600 then return false; end if;
  update public.source_sync_jobs as target
  set heartbeat_at = now(),
      lease_expires_at = now() + make_interval(secs => lease_seconds)
  where target.id = job_id
    and target.workflow_version is not null
    and target.status = 'running'
    and target.lease_token = current_lease_token
    and target.lease_expires_at > now();
  return found;
end;
$$;

create or replace function public.finish_source_sync_job(
  job_id uuid,
  current_lease_token uuid,
  next_status public.run_status,
  public_error text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if next_status not in ('completed', 'completed_with_limits', 'failed') then return false; end if;
  update public.source_sync_jobs as target
  set status = next_status,
      completed_at = now(),
      error = case when next_status = 'failed' then public_error else null end,
      lease_token = null,
      lease_expires_at = null,
      heartbeat_at = now()
  where target.id = job_id
    and target.workflow_version is not null
    and target.status = 'running'
    and target.lease_token = current_lease_token
    and target.lease_expires_at > now();
  return found;
end;
$$;

create or replace function public.claim_workspace_setup_stage(
  setup_run_id uuid,
  stage_key text,
  expected_status text,
  lease_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  setup_run public.workspace_setup_runs%rowtype;
  current_stage_state jsonb;
  claimed_token uuid := gen_random_uuid();
begin
  if lease_seconds < 5 or lease_seconds > 3600 or stage_key is null or stage_key = '' then return null; end if;
  select * into setup_run from public.workspace_setup_runs where id = setup_run_id for update;
  if not found or setup_run.workflow_version is null or (setup_run.status = 'completed' and stage_key <> 'music_reads') then return null; end if;
  if setup_run.available_at > now() then return null; end if;

  current_stage_state := coalesce(setup_run.stage_status -> stage_key, '{}'::jsonb);
  if coalesce(current_stage_state ->> 'status', 'queued') is distinct from expected_status then return null; end if;
  if coalesce(nullif(current_stage_state ->> 'attempt', '')::integer, 0) >= setup_run.max_attempts then return null; end if;
  if current_stage_state ->> 'status' = 'running'
    and (
      nullif(current_stage_state ->> 'lease_expires_at', '') is null
      or nullif(current_stage_state ->> 'lease_expires_at', '')::timestamptz > now()
    ) then return null;
  end if;

  update public.workspace_setup_runs
  set status = case when stage_key = 'music_reads' then setup_run.status else 'running' end,
      current_stage = stage_key,
      stage_status = jsonb_set(setup_run.stage_status, array[stage_key], current_stage_state || jsonb_build_object(
        'status', 'running',
        'lease_token', claimed_token,
        'lease_expires_at', now() + make_interval(secs => lease_seconds),
        'heartbeat_at', now(),
        'attempt', coalesce(nullif(current_stage_state ->> 'attempt', '')::integer, 0) + 1
      ), true),
      retry_count = setup_run.retry_count + 1,
      lease_token = claimed_token,
      lease_expires_at = now() + make_interval(secs => lease_seconds),
      heartbeat_at = now(),
      last_attempt_started_at = now(),
      started_at = coalesce(setup_run.started_at, now()),
      last_error = null
  where id = setup_run_id;
  return jsonb_build_object(
    'token', claimed_token,
    'expires_at', now() + make_interval(secs => lease_seconds),
    'attempt', coalesce(nullif(current_stage_state ->> 'attempt', '')::integer, 0) + 1
  );
end;
$$;

create or replace function public.merge_workspace_setup_stage(
  setup_run_id uuid,
  stage_key text,
  current_lease_token uuid,
  stage_patch jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  setup_run public.workspace_setup_runs%rowtype;
  current_stage_state jsonb;
  next_stage_state jsonb;
  next_stage_patch jsonb;
  next_stage_key text;
  merged_stage_status jsonb;
begin
  if jsonb_typeof(stage_patch) <> 'object' then return false; end if;
  select * into setup_run from public.workspace_setup_runs where id = setup_run_id for update;
  if not found or setup_run.workflow_version is null or (setup_run.status = 'completed' and stage_key <> 'music_reads') then return false; end if;
  current_stage_state := coalesce(setup_run.stage_status -> stage_key, '{}'::jsonb);
  if current_stage_state ->> 'lease_token' is distinct from current_lease_token::text then return false; end if;
  if current_stage_state ->> 'status' <> 'running' then return false; end if;
  if nullif(current_stage_state ->> 'lease_expires_at', '') is null
    or nullif(current_stage_state ->> 'lease_expires_at', '')::timestamptz <= now() then return false;
  end if;

  next_stage_patch := coalesce(stage_patch -> 'next_stage_patch', '{}'::jsonb);
  next_stage_state := current_stage_state || (stage_patch - 'next_stage_patch');
  next_stage_key := case
    when stage_key = 'catalog_bootstrap' then 'manager_discovery'
    when stage_key = 'manager_discovery' then 'setup_brief'
    when stage_key = 'setup_brief' then 'music_reads'
    else null
  end;
  merged_stage_status := jsonb_set(setup_run.stage_status, array[stage_key], next_stage_state, true);
  if next_stage_key is not null and jsonb_typeof(next_stage_patch) = 'object' and next_stage_patch <> '{}'::jsonb then
    merged_stage_status := jsonb_set(
      merged_stage_status,
      array[next_stage_key],
      coalesce(merged_stage_status -> next_stage_key, '{}'::jsonb) || next_stage_patch,
      true
    );
  end if;
  update public.workspace_setup_runs
  set stage_status = merged_stage_status,
      status = case
        when stage_key = 'music_reads' then setup_run.status
        when next_stage_state ->> 'status' = 'failed' then 'failed'
        when stage_key = 'setup_brief' and next_stage_state ->> 'status' in ('completed', 'completed_with_limits') then 'completed'
        else 'running'
      end,
      current_stage = case
        when next_stage_state ->> 'status' = 'failed' then stage_key
        when stage_key = 'catalog_bootstrap' and next_stage_state ->> 'status' in ('completed', 'completed_with_limits') then 'manager_discovery'
        when stage_key = 'manager_discovery' and next_stage_state ->> 'status' in ('completed', 'completed_with_limits') then 'setup_brief'
        when stage_key = 'setup_brief' and next_stage_state ->> 'status' in ('completed', 'completed_with_limits') then 'music_reads'
        else setup_run.current_stage
      end,
      completed_at = case
        when stage_key = 'setup_brief' and next_stage_state ->> 'status' in ('completed', 'completed_with_limits') then now()
        else setup_run.completed_at
      end,
      last_error = case
        when stage_key = 'music_reads' then setup_run.last_error
        when next_stage_state ->> 'status' = 'failed' then next_stage_state ->> 'error'
        else null
      end,
      heartbeat_at = now(),
      lease_token = case when next_stage_state ->> 'status' in ('completed', 'completed_with_limits', 'failed') then null else setup_run.lease_token end,
      lease_expires_at = case when next_stage_state ->> 'status' in ('completed', 'completed_with_limits', 'failed') then null else setup_run.lease_expires_at end
  where id = setup_run_id;
  return true;
end;
$$;

create or replace function public.heartbeat_workspace_setup_stage(
  setup_run_id uuid,
  stage_key text,
  current_lease_token uuid,
  lease_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_stage_state jsonb;
begin
  if lease_seconds < 5 or lease_seconds > 3600 then return false; end if;
  select stage_status -> stage_key into current_stage_state
  from public.workspace_setup_runs
  where id = setup_run_id for update;
  if not found or current_stage_state ->> 'status' <> 'running' then return false; end if;
  if current_stage_state ->> 'lease_token' is distinct from current_lease_token::text then return false; end if;
  if nullif(current_stage_state ->> 'lease_expires_at', '') is null
    or nullif(current_stage_state ->> 'lease_expires_at', '')::timestamptz <= now() then return false;
  end if;

  update public.workspace_setup_runs
  set stage_status = jsonb_set(stage_status, array[stage_key], current_stage_state || jsonb_build_object(
        'lease_expires_at', now() + make_interval(secs => lease_seconds),
        'heartbeat_at', now()
      ), true),
      lease_expires_at = now() + make_interval(secs => lease_seconds),
      heartbeat_at = now()
  where id = setup_run_id;
  return true;
end;
$$;

create or replace function public.reap_expired_workflows(batch_size integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer := 0;
  row_count_value integer := 0;
begin
  if batch_size < 1 or batch_size > 500 then return 0; end if;

  with expired as (
    select id from public.manager_synthesis_runs
    where workflow_version is not null and status = 'running' and lease_expires_at <= now()
    order by lease_expires_at for update skip locked limit batch_size
  )
  update public.manager_synthesis_runs as target
  set status = case when target.attempt_count >= target.max_attempts then 'failed'::public.run_status else 'queued'::public.run_status end,
      available_at = case when target.attempt_count >= target.max_attempts then target.available_at else now() end,
      error = case when target.attempt_count >= target.max_attempts then coalesce(target.error, 'Maximum attempts exhausted.') else target.error end,
      lease_token = null, lease_expires_at = null, heartbeat_at = null
  where target.id in (select id from expired);
  get diagnostics row_count_value = row_count;
  affected := affected + row_count_value;

  with expired as (
    select id from public.source_sync_jobs
    where workflow_version is not null and status = 'running' and lease_expires_at <= now()
    order by lease_expires_at for update skip locked limit batch_size
  )
  update public.source_sync_jobs as target
  set status = case when target.attempt_count >= target.max_attempts then 'failed'::public.run_status else 'queued'::public.run_status end,
      available_at = case when target.attempt_count >= target.max_attempts then target.available_at else now() end,
      error = case when target.attempt_count >= target.max_attempts then coalesce(target.error, 'Maximum attempts exhausted.') else target.error end,
      lease_token = null, lease_expires_at = null, heartbeat_at = null
  where target.id in (select id from expired);
  get diagnostics row_count_value = row_count;
  affected := affected + row_count_value;

  with expired as (
    select id, current_stage, stage_status,
      coalesce(nullif(stage_status -> current_stage ->> 'attempt', '')::integer, 0) as stage_attempt,
      max_attempts
    from public.workspace_setup_runs
    where workflow_version is not null
      and (status = 'running' or (status = 'completed' and current_stage = 'music_reads'))
      and lease_expires_at is not null
      and lease_expires_at <= now()
    order by lease_expires_at for update skip locked limit batch_size
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
      available_at = case when expired.stage_attempt >= expired.max_attempts then target.available_at else now() end,
      last_error = case
        when expired.current_stage = 'music_reads' then target.last_error
        when expired.stage_attempt >= expired.max_attempts then coalesce(target.last_error, 'Maximum attempts exhausted.')
        else target.last_error
      end,
      lease_token = null, lease_expires_at = null, heartbeat_at = null
  from expired where target.id = expired.id;
  get diagnostics row_count_value = row_count;
  affected := affected + row_count_value;

  return affected;
end;
$$;

revoke all on function public.claim_manager_synthesis_run(uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_manager_synthesis_run(uuid, integer) to service_role;
revoke all on function public.claim_source_sync_job(uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_source_sync_job(uuid, integer) to service_role;
revoke all on function public.claim_workspace_setup_stage(uuid, text, text, integer) from public, anon, authenticated;
grant execute on function public.claim_workspace_setup_stage(uuid, text, text, integer) to service_role;
revoke all on function public.heartbeat_manager_synthesis_run(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.heartbeat_manager_synthesis_run(uuid, uuid, integer) to service_role;
revoke all on function public.heartbeat_source_sync_job(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.heartbeat_source_sync_job(uuid, uuid, integer) to service_role;
revoke all on function public.finish_source_sync_job(uuid, uuid, public.run_status, text) from public, anon, authenticated;
grant execute on function public.finish_source_sync_job(uuid, uuid, public.run_status, text) to service_role;
revoke all on function public.merge_workspace_setup_stage(uuid, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.merge_workspace_setup_stage(uuid, text, uuid, jsonb) to service_role;
revoke all on function public.heartbeat_workspace_setup_stage(uuid, text, uuid, integer) from public, anon, authenticated;
grant execute on function public.heartbeat_workspace_setup_stage(uuid, text, uuid, integer) to service_role;
revoke all on function public.reap_expired_workflows(integer) from public, anon, authenticated;
grant execute on function public.reap_expired_workflows(integer) to service_role;
