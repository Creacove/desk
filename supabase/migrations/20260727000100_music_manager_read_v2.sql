alter table public.manager_synthesis_runs
  add column if not exists subject_type text,
  add column if not exists subject_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'manager_synthesis_runs_music_read_v2_subject_check'
      and conrelid = 'public.manager_synthesis_runs'::regclass
  ) then
    alter table public.manager_synthesis_runs
      add constraint manager_synthesis_runs_music_read_v2_subject_check
      check (
        classification <> 'music_manager_read_v2'
        or (
          subject_id is not null
          and subject_type is not null
          and subject_type in ('music_item', 'music_project')
        )
      );
  end if;
end;
$$;

create index if not exists manager_synthesis_runs_music_subject_idx
on public.manager_synthesis_runs (
  account_id,
  artist_workspace_id,
  artist_id,
  classification,
  subject_type,
  subject_id,
  created_at desc
);

create unique index if not exists manager_synthesis_runs_active_music_read_v2_idx
on public.manager_synthesis_runs (
  account_id,
  artist_workspace_id,
  artist_id,
  classification,
  subject_type,
  subject_id
)
where subject_id is not null
  and classification = 'music_manager_read_v2'
  and status in ('queued', 'running');

create or replace function public.finalize_music_manager_read_v2(
  target_output_id uuid,
  target_usage_id uuid,
  target_run_status public.run_status,
  target_steps_payload jsonb,
  target_input_tokens integer,
  target_cached_input_tokens integer,
  target_output_tokens integer,
  target_reasoning_tokens integer,
  target_provider_request_count integer,
  target_usage_metadata jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  initial_output public.manager_outputs%rowtype;
  next_output public.manager_outputs%rowtype;
  synthesis_run public.manager_synthesis_runs%rowtype;
  usage_event public.ai_run_usage_events%rowtype;
  previous_output_id uuid;
  expected_usage_status public.usage_status;
  run_was_terminal boolean;
  usage_was_terminal boolean;
begin
  if target_run_status is null
    or target_run_status not in ('completed', 'completed_with_limits')
  then
    raise exception 'Music Manager Read finalization requires a completed run status.';
  end if;

  expected_usage_status := case target_run_status
    when 'completed' then 'succeeded'::public.usage_status
    else 'partial'::public.usage_status
  end;

  if target_input_tokens is null or target_input_tokens < 0
    or target_cached_input_tokens is null or target_cached_input_tokens < 0
    or target_output_tokens is null or target_output_tokens < 0
    or target_reasoning_tokens is null or target_reasoning_tokens < 0
    or target_provider_request_count is null or target_provider_request_count < 0
  then
    raise exception 'Music Manager Read usage counters must be nonnegative.';
  end if;

  if target_cached_input_tokens > target_input_tokens then
    raise exception 'Cached input tokens cannot exceed input tokens.';
  end if;

  if target_steps_payload is null
    or jsonb_typeof(target_steps_payload) <> 'array'
  then
    raise exception 'Terminal steps must be an array.';
  end if;

  if not exists (
      select 1
      from jsonb_array_elements(target_steps_payload) as step
      where step ->> 'step' = 'output_activation'
        and step ->> 'status' = 'completed'
    )
  then
    raise exception 'Terminal steps must include completed output activation.';
  end if;

  if target_usage_metadata is null
    or jsonb_typeof(target_usage_metadata) <> 'object'
    or octet_length(target_usage_metadata::text) > 8192
  then
    raise exception 'Music Manager Read usage metadata must be a bounded object.';
  end if;

  select *
  into initial_output
  from public.manager_outputs
  where id = target_output_id;

  if not found then
    raise exception 'Manager output was not found.';
  end if;

  if initial_output.schema_version <> 'music-manager-read-v2' then
    raise exception 'Only Music Manager Read v2 outputs can be finalized.';
  end if;

  if initial_output.subject_id is null then
    raise exception 'Music Manager Read outputs require a subject.';
  end if;

  if not (
    (initial_output.subject_type = 'music_item' and initial_output.output_type = 'song_manager_read')
    or (initial_output.subject_type = 'music_project' and initial_output.output_type = 'project_manager_read')
  ) then
    raise exception 'Output type does not match its Music Manager Read subject.';
  end if;

  if initial_output.subject_type = 'music_item' then
    perform 1
    from public.music_items
    where id = initial_output.subject_id
      and account_id = initial_output.account_id
      and artist_workspace_id = initial_output.artist_workspace_id
      and artist_id = initial_output.artist_id
    for update;

    if not found then
      raise exception 'Music item subject was not found for this output owner.';
    end if;
  elsif initial_output.subject_type = 'music_project' then
    perform 1
    from public.music_projects
    where id = initial_output.subject_id
      and account_id = initial_output.account_id
      and artist_workspace_id = initial_output.artist_workspace_id
      and artist_id = initial_output.artist_id
    for update;

    if not found then
      raise exception 'Music project subject was not found for this output owner.';
    end if;
  end if;

  select *
  into next_output
  from public.manager_outputs
  where id = target_output_id
  for update;

  if not found then
    raise exception 'Manager output was not found.';
  end if;

  if next_output.schema_version <> 'music-manager-read-v2' then
    raise exception 'Only Music Manager Read v2 outputs can be finalized.';
  end if;

  if next_output.subject_id is null then
    raise exception 'Music Manager Read outputs require a subject.';
  end if;

  if not (
    (next_output.subject_type = 'music_item' and next_output.output_type = 'song_manager_read')
    or (next_output.subject_type = 'music_project' and next_output.output_type = 'project_manager_read')
  ) then
    raise exception 'Output type does not match its Music Manager Read subject.';
  end if;

  if next_output.account_id is distinct from initial_output.account_id
    or next_output.artist_workspace_id is distinct from initial_output.artist_workspace_id
    or next_output.artist_id is distinct from initial_output.artist_id
    or next_output.output_type is distinct from initial_output.output_type
    or next_output.subject_type is distinct from initial_output.subject_type
    or next_output.subject_id is distinct from initial_output.subject_id
    or next_output.schema_version is distinct from initial_output.schema_version
    or next_output.created_from_run_id is distinct from initial_output.created_from_run_id
  then
    raise exception 'Manager output identity changed during finalization.';
  end if;

  if next_output.created_from_run_id is null then
    raise exception 'Music Manager Read output requires a synthesis run.';
  end if;

  select *
  into synthesis_run
  from public.manager_synthesis_runs
  where id = next_output.created_from_run_id
  for update;

  if not found then
    raise exception 'Music Manager Read synthesis run was not found.';
  end if;

  if next_output.created_from_run_id is distinct from synthesis_run.id
    or synthesis_run.classification is null
    or synthesis_run.classification <> 'music_manager_read_v2'
    or synthesis_run.account_id is distinct from next_output.account_id
    or synthesis_run.artist_workspace_id is distinct from next_output.artist_workspace_id
    or synthesis_run.artist_id is distinct from next_output.artist_id
    or synthesis_run.subject_type is distinct from next_output.subject_type
    or synthesis_run.subject_id is distinct from next_output.subject_id
  then
    raise exception 'Synthesis run does not match the staged Music Manager Read output.';
  end if;

  select *
  into usage_event
  from public.ai_run_usage_events
  where id = target_usage_id
  for update;

  if not found then
    raise exception 'Music Manager Read usage event was not found.';
  end if;

  if usage_event.manager_synthesis_run_id is distinct from synthesis_run.id
    or usage_event.account_id is distinct from next_output.account_id
    or usage_event.artist_workspace_id is distinct from next_output.artist_workspace_id
    or usage_event.artist_id is distinct from next_output.artist_id
    or usage_event.subject_type is distinct from next_output.subject_type
    or usage_event.subject_id is distinct from next_output.subject_id
    or usage_event.workflow_key <> 'music_readiness_run'
    or usage_event.run_type <> 'manager_synthesis'
    or usage_event.operation_key <> 'music_manager_read'
  then
    raise exception 'Usage event does not match the staged Music Manager Read output.';
  end if;

  run_was_terminal := synthesis_run.status in ('completed', 'completed_with_limits');
  usage_was_terminal := usage_event.status in ('succeeded', 'partial');

  if run_was_terminal then
    if synthesis_run.status is distinct from target_run_status
      or synthesis_run.steps_payload is distinct from target_steps_payload
      or synthesis_run.completed_at is null
      or synthesis_run.error is not null
    then
      raise exception 'Terminal synthesis run does not match this finalization replay.';
    end if;
  elsif synthesis_run.status not in ('queued', 'running') then
    raise exception 'Synthesis run is not eligible for successful finalization.';
  end if;

  if usage_was_terminal then
    if usage_event.status is distinct from expected_usage_status
      or usage_event.input_tokens is distinct from target_input_tokens
      or usage_event.cached_input_tokens is distinct from target_cached_input_tokens
      or usage_event.output_tokens is distinct from target_output_tokens
      or usage_event.reasoning_tokens is distinct from target_reasoning_tokens
      or usage_event.provider_request_count is distinct from target_provider_request_count
      or usage_event.metadata is distinct from target_usage_metadata
      or usage_event.completed_at is null
      or usage_event.failure_reason is not null
    then
      raise exception 'Terminal usage event does not match this finalization replay.';
    end if;
  elsif usage_event.status <> 'started' then
    raise exception 'Usage event is not eligible for successful finalization.';
  end if;

  if run_was_terminal is distinct from usage_was_terminal then
    raise exception 'Run and usage terminal state do not match.';
  end if;

  if run_was_terminal then
    if not next_output.is_current then
      raise exception 'Finalized output is no longer current.';
    end if;

    return next_output.id;
  elsif next_output.is_current then
    raise exception 'A staged output must not be current before finalization.';
  end if;

  select id
  into previous_output_id
  from public.manager_outputs
  where account_id = next_output.account_id
    and artist_workspace_id = next_output.artist_workspace_id
    and artist_id = next_output.artist_id
    and output_type = next_output.output_type
    and subject_type = next_output.subject_type
    and subject_id = next_output.subject_id
    and is_current = true
    and id <> next_output.id
  order by created_at desc
  limit 1
  for update;

  update public.manager_outputs
  set is_current = false
  where account_id = next_output.account_id
    and artist_workspace_id = next_output.artist_workspace_id
    and artist_id = next_output.artist_id
    and output_type = next_output.output_type
    and subject_type = next_output.subject_type
    and subject_id = next_output.subject_id
    and is_current = true
    and id <> next_output.id;

  update public.manager_outputs
  set
    is_current = true,
    supersedes_output_id = previous_output_id
  where id = next_output.id
    and account_id = next_output.account_id
    and artist_workspace_id = next_output.artist_workspace_id
    and artist_id = next_output.artist_id
    and output_type = next_output.output_type
    and subject_type = next_output.subject_type
    and subject_id = next_output.subject_id;

  update public.manager_synthesis_runs
  set
    status = target_run_status,
    steps_payload = target_steps_payload,
    completed_at = now(),
    error = null
  where id = synthesis_run.id;

  update public.ai_run_usage_events
  set
    status = expected_usage_status,
    input_tokens = target_input_tokens,
    cached_input_tokens = target_cached_input_tokens,
    output_tokens = target_output_tokens,
    reasoning_tokens = target_reasoning_tokens,
    provider_request_count = target_provider_request_count,
    completed_at = now(),
    failure_reason = null,
    metadata = target_usage_metadata
  where id = usage_event.id;

  return next_output.id;
end;
$$;

revoke execute on function public.finalize_music_manager_read_v2(uuid, uuid, public.run_status, jsonb, integer, integer, integer, integer, integer, jsonb)
from public, anon;

grant execute on function public.finalize_music_manager_read_v2(uuid, uuid, public.run_status, jsonb, integer, integer, integer, integer, integer, jsonb)
to authenticated, service_role;
