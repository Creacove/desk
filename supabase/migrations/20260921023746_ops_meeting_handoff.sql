-- PR2 Ops -> Desk handoff state machine.
-- Claims/finalization are service-role-only. The transcript is stored only in
-- the Manager run packet, never copied into the append-only operator audit.

create or replace function private.prevent_ops_meeting_processing_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user <> 'service_role'
    and coalesce(current_setting('ordersounds.ops_meeting_service_mutation', true), 'false') <> 'true'
    and (
      new.processing_status in ('processing', 'processed', 'failed')
      or new.processed_at is not null
      or new.desk_run_id is distinct from old.desk_run_id
    ) then
    raise exception 'ops_meeting_processing_is_service_role_only' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists ops_meetings_processing_boundary on public.ops_meetings;
create trigger ops_meetings_processing_boundary
before update on public.ops_meetings
for each row execute function private.prevent_ops_meeting_processing_mutation();

revoke all on function private.prevent_ops_meeting_processing_mutation() from public, anon;
grant execute on function private.prevent_ops_meeting_processing_mutation() to authenticated, service_role;

create or replace function private.claim_ops_meeting_processing_v1(
  p_ops_meeting_id uuid,
  p_operator_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  meeting_row public.ops_meetings%rowtype;
  case_row public.ops_cases%rowtype;
  workspace_row record;
  run_row public.manager_synthesis_runs%rowtype;
  run_id uuid;
  idempotency text := 'ops-meeting:' || p_ops_meeting_id::text;
begin
  perform set_config('ordersounds.ops_meeting_service_mutation', 'true', true);
  if not exists (
    select 1
    from private.operator_access_config config
    join public.ordersounds_operators operator_row
      on operator_row.user_id = p_operator_user_id
     and operator_row.active = true
    where config.singleton = true
      and config.enabled = true
  ) then
    raise exception 'operator_access_not_available' using errcode = '42501';
  end if;

  select * into meeting_row
  from public.ops_meetings
  where id = p_ops_meeting_id
  for update;
  if not found then
    raise exception 'ops_meeting_not_found' using errcode = 'P0002';
  end if;

  select * into case_row
  from public.ops_cases
  where id = meeting_row.ops_case_id
  for update;
  if not found or case_row.desk_workspace_id is null then
    raise exception 'ops_meeting_workspace_link_required' using errcode = '22023';
  end if;

  if nullif(btrim(coalesce(meeting_row.transcript, '')), '') is null then
    raise exception 'ops_meeting_transcript_required' using errcode = '22023';
  end if;

  select id, account_id, artist_id, status
    into workspace_row
  from public.artist_workspaces
  where id = case_row.desk_workspace_id
    and status <> 'archived';
  if not found then
    raise exception 'ops_meeting_workspace_not_found' using errcode = '22023';
  end if;

  select * into run_row
  from public.manager_synthesis_runs
  where account_id = workspace_row.account_id
    and artist_workspace_id = case_row.desk_workspace_id
    and idempotency_key = idempotency
    and workflow_version = 'ops_meeting_ingestion_v1'
  for update;

  if meeting_row.processing_status = 'processed' then
    return jsonb_build_object(
      'state', 'processed',
      'runId', meeting_row.desk_run_id,
      'opsMeetingId', meeting_row.id,
      'artistWorkspaceId', case_row.desk_workspace_id,
      'opsCaseId', case_row.id
    );
  end if;

  if run_row.id is not null then
    run_id := run_row.id;
    if run_row.status in ('completed', 'completed_with_limits') then
      return jsonb_build_object(
        'state', 'review_ready',
        'runId', run_id,
        'opsMeetingId', meeting_row.id,
        'artistWorkspaceId', case_row.desk_workspace_id,
        'opsCaseId', case_row.id,
        'review', run_row.result_payload
      );
    end if;
    if run_row.status in ('queued', 'running') then
      return jsonb_build_object(
        'state', 'in_progress',
        'runId', run_id,
        'opsMeetingId', meeting_row.id,
        'artistWorkspaceId', case_row.desk_workspace_id,
        'opsCaseId', case_row.id
      );
    end if;

    -- A failed retry reuses the same logical run and idempotency key.
    update public.manager_synthesis_runs
    set status = 'running'::public.run_status,
        error = null,
        attempt_count = coalesce(attempt_count, 0) + 1,
        last_attempt_started_at = now(),
        started_at = coalesce(started_at, now()),
        available_at = now(),
        lease_token = gen_random_uuid(),
        lease_expires_at = now() + interval '10 minutes',
        heartbeat_at = now()
    where id = run_id;
  else
    insert into public.manager_synthesis_runs (
      account_id,
      artist_workspace_id,
      artist_id,
      trigger_type,
      status,
      classification,
      context_payload,
      result_payload,
      action_plan,
      workflow_version,
      idempotency_key,
      request_payload,
      input_refs,
      attempt_count,
      max_attempts,
      started_at,
      last_attempt_started_at,
      available_at,
      lease_token,
      lease_expires_at,
      heartbeat_at
    ) values (
      workspace_row.account_id,
      case_row.desk_workspace_id,
      workspace_row.artist_id,
      'manual'::public.manager_trigger_type,
      'running'::public.run_status,
      'ops_meeting_review_v1',
      jsonb_build_object(
        'source', jsonb_build_object(
          'type', 'ops_meeting',
          'sourceId', meeting_row.id,
          'opsCaseId', case_row.id,
          'meetingType', meeting_row.meeting_type,
          'operatorUserId', p_operator_user_id
        )
      ),
      '{}'::jsonb,
      '[]'::jsonb,
      'ops_meeting_ingestion_v1',
      idempotency,
      jsonb_build_object('opsMeetingId', meeting_row.id, 'operatorUserId', p_operator_user_id),
      jsonb_build_array(jsonb_build_object('type', 'ops_meeting', 'id', meeting_row.id)),
      1,
      3,
      now(),
      now(),
      now(),
      gen_random_uuid(),
      now() + interval '10 minutes',
      now()
    ) returning id into run_id;
  end if;

  update public.ops_meetings
  set processing_status = 'processing',
      processed_at = null,
      desk_run_id = run_id
  where id = meeting_row.id;

  return jsonb_build_object(
    'state', 'started',
    'runId', run_id,
    'opsMeetingId', meeting_row.id,
    'artistWorkspaceId', case_row.desk_workspace_id,
    'opsCaseId', case_row.id,
    'accountId', workspace_row.account_id,
    'artistId', workspace_row.artist_id
  );
end;
$$;

create or replace function private.finalize_ops_meeting_processing_v1(
  p_ops_meeting_id uuid,
  p_run_id uuid,
  p_status text,
  p_error text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  meeting_row public.ops_meetings%rowtype;
  run_row public.manager_synthesis_runs%rowtype;
  safe_error text := nullif(left(btrim(coalesce(p_error, '')), 500), '');
  next_payload jsonb;
begin
  perform set_config('ordersounds.ops_meeting_service_mutation', 'true', true);
  if p_status not in ('review_ready', 'applied', 'declined', 'failed') then
    raise exception 'invalid_ops_meeting_final_status' using errcode = '22023';
  end if;

  select * into meeting_row
  from public.ops_meetings
  where id = p_ops_meeting_id
  for update;
  if not found then
    raise exception 'ops_meeting_not_found' using errcode = 'P0002';
  end if;
  if meeting_row.desk_run_id is distinct from p_run_id then
    raise exception 'ops_meeting_run_mismatch' using errcode = '22023';
  end if;

  select * into run_row from public.manager_synthesis_runs where id = p_run_id for update;
  if not found then
    raise exception 'ops_meeting_run_not_found' using errcode = 'P0002';
  end if;

  next_payload := coalesce(run_row.result_payload, '{}'::jsonb)
    || jsonb_build_object('reviewStatus', p_status);

  if p_status = 'failed' then
    update public.manager_synthesis_runs
    set status = 'failed'::public.run_status,
        result_payload = next_payload,
        error = coalesce(safe_error, 'Ops meeting processing failed.'),
        completed_at = now(),
        lease_expires_at = null
    where id = p_run_id;
    update public.ops_meetings
    set processing_status = 'failed', processed_at = null
    where id = p_ops_meeting_id;
  elsif p_status = 'applied' then
    update public.manager_synthesis_runs
    set status = 'completed'::public.run_status,
        result_payload = next_payload,
        error = null,
        completed_at = coalesce(completed_at, now()),
        lease_expires_at = null
    where id = p_run_id;
    update public.ops_meetings
    set processing_status = 'processed', processed_at = coalesce(processed_at, now())
    where id = p_ops_meeting_id;
  else
    -- Review-ready and declined remain in processing until an explicit
    -- operator decision. Only an applied review is a processed handoff.
    update public.manager_synthesis_runs
    set status = 'completed'::public.run_status,
        result_payload = next_payload,
        error = null,
        completed_at = coalesce(completed_at, now()),
        lease_expires_at = null
    where id = p_run_id;
    update public.ops_meetings
    set processing_status = 'processing', processed_at = null
    where id = p_ops_meeting_id;
  end if;

  return jsonb_build_object(
    'state', p_status,
    'opsMeetingId', p_ops_meeting_id,
    'runId', p_run_id,
    'processingStatus', case when p_status = 'applied' then 'processed' when p_status = 'failed' then 'failed' else 'processing' end
  );
end;
$$;

revoke all on function private.claim_ops_meeting_processing_v1(uuid, uuid) from public, anon, authenticated;
revoke all on function private.finalize_ops_meeting_processing_v1(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function private.claim_ops_meeting_processing_v1(uuid, uuid) to service_role;
grant execute on function private.finalize_ops_meeting_processing_v1(uuid, uuid, text, text) to service_role;

-- PostgREST exposes RPCs from public. These wrappers keep the implementation
-- private while retaining a service-role-only execution boundary.
create or replace function public.claim_ops_meeting_processing_v1(
  p_ops_meeting_id uuid,
  p_operator_user_id uuid
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.claim_ops_meeting_processing_v1(p_ops_meeting_id, p_operator_user_id);
$$;

create or replace function public.finalize_ops_meeting_processing_v1(
  p_ops_meeting_id uuid,
  p_run_id uuid,
  p_status text,
  p_error text default null
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.finalize_ops_meeting_processing_v1(p_ops_meeting_id, p_run_id, p_status, p_error);
$$;

revoke all on function public.claim_ops_meeting_processing_v1(uuid, uuid) from public, anon, authenticated;
revoke all on function public.finalize_ops_meeting_processing_v1(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.claim_ops_meeting_processing_v1(uuid, uuid) to service_role;
grant execute on function public.finalize_ops_meeting_processing_v1(uuid, uuid, text, text) to service_role;

notify pgrst, 'reload schema';
