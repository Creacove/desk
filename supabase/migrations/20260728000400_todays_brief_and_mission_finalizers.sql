create unique index if not exists manager_intelligence_packets_run_unique_idx
  on public.manager_intelligence_packets (created_from_run_id)
  where created_from_run_id is not null;

create unique index if not exists manager_outputs_run_type_unique_idx
  on public.manager_outputs (created_from_run_id, output_type)
  where created_from_run_id is not null;

create unique index if not exists evidence_links_run_target_unique_idx
  on public.evidence_links (created_from_run_id, evidence_item_id, target_type, target_id, usage)
  where created_from_run_id is not null;

create unique index if not exists memory_entries_run_seed_unique_idx
  on public.memory_entries (created_from_run_id, source_type, source_id, kind, md5(content))
  where created_from_run_id is not null;

create unique index if not exists ai_run_usage_events_todays_brief_unique_idx
  on public.ai_run_usage_events (manager_synthesis_run_id, operation_key)
  where manager_synthesis_run_id is not null
    and operation_key = 'setup_todays_brief_v1';

create or replace function public.finalize_todays_brief_v1(
  run_id uuid,
  current_lease_token uuid,
  packet_id uuid,
  output_id uuid,
  usage_id uuid,
  result_output jsonb,
  result_confidence public.evidence_confidence,
  result_limitations text[],
  actual_provider_request_count integer,
  actual_input_tokens integer,
  actual_cached_input_tokens integer,
  actual_output_tokens integer,
  actual_reasoning_tokens integer,
  setup_run_id uuid,
  setup_stage_lease_token uuid,
  setup_music_read_targets jsonb,
  terminal_event_type text,
  terminal_summary text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  run_row public.manager_synthesis_runs%rowtype;
  packet_row public.manager_intelligence_packets%rowtype;
  output_row public.manager_outputs%rowtype;
  usage_row public.ai_run_usage_events%rowtype;
  setup_row public.workspace_setup_runs%rowtype;
  setup_stage jsonb;
  target_count integer := jsonb_array_length(coalesce(setup_music_read_targets, '[]'::jsonb));
  event_id uuid;
begin
  select * into run_row from public.manager_synthesis_runs where id = run_id for update;
  if not found then raise exception 'Today''s Brief run was not found.'; end if;

  if run_row.status = 'completed' then
    if exists (
      select 1 from public.manager_outputs
      where id = output_id
        and created_from_run_id = run_id
        and source_packet_id = packet_id
        and render_json = result_output
    ) and exists (
      select 1 from public.manager_intelligence_packets
      where id = packet_id and created_from_run_id = run_id
    ) and exists (
      select 1 from public.ai_run_usage_events
      where id = usage_id and manager_synthesis_run_id = run_id
    ) and run_row.action_plan = jsonb_build_array(result_output) then
      return jsonb_build_object('run_id', run_id, 'packet_id', packet_id, 'output_id', output_id, 'replayed', true);
    end if;
    raise exception 'Conflicting Today''s Brief finalizer replay.';
  end if;

  if run_row.status <> 'running'
    or run_row.lease_token is distinct from current_lease_token
    or run_row.lease_expires_at is null
    or run_row.lease_expires_at <= now()
  then
    raise exception 'Today''s Brief lease is no longer active.';
  end if;

  select * into packet_row from public.manager_intelligence_packets where id = packet_id for update;
  if not found or packet_row.created_from_run_id is distinct from run_id
    or packet_row.account_id is distinct from run_row.account_id
    or packet_row.artist_workspace_id is distinct from run_row.artist_workspace_id
  then raise exception 'Today''s Brief packet does not belong to the run.'; end if;

  select * into output_row from public.manager_outputs where id = output_id for update;
  if not found or output_row.created_from_run_id is distinct from run_id
    or output_row.source_packet_id is distinct from packet_id
    or output_row.account_id is distinct from run_row.account_id
    or output_row.artist_workspace_id is distinct from run_row.artist_workspace_id
    or output_row.subject_type <> 'artist'
  then raise exception 'Today''s Brief output does not belong to the run.'; end if;

  select * into usage_row from public.ai_run_usage_events where id = usage_id for update;
  if not found or usage_row.manager_synthesis_run_id is distinct from run_id
  then raise exception 'Today''s Brief usage row does not belong to the run.'; end if;

  update public.manager_outputs as target
  set is_current = false
  where target.account_id = output_row.account_id
    and target.artist_workspace_id = output_row.artist_workspace_id
    and target.artist_id = output_row.artist_id
    and target.subject_type = output_row.subject_type
    and target.subject_id = output_row.subject_id
    and target.output_type = output_row.output_type
    and target.is_current = true
    and target.id <> output_id;

  update public.manager_outputs as target
  set is_current = true
  where target.id = output_id and target.created_from_run_id = run_id;

  update public.manager_intelligence_packets as target
  set status = 'completed'
  where target.id = packet_id and target.created_from_run_id = run_id;

  update public.artist_profiles as target
  set current_manager_packet_id = packet_id
  where target.account_id = run_row.account_id
    and target.artist_workspace_id = run_row.artist_workspace_id
    and target.artist_id = run_row.artist_id;

  update public.manager_synthesis_runs as target
  set status = 'completed',
      confidence = result_confidence,
      action_plan = jsonb_build_array(result_output),
      limitations = coalesce(result_limitations, '{}'::text[]),
      completed_at = now(),
      error = null,
      lease_token = null,
      lease_expires_at = null,
      heartbeat_at = now()
  where target.id = run_id and target.lease_token = current_lease_token;

  update public.ai_run_usage_events as target
  set status = 'succeeded',
      provider_request_count = greatest(coalesce(actual_provider_request_count, 0), 0),
      input_tokens = greatest(coalesce(actual_input_tokens, 0), 0),
      cached_input_tokens = greatest(coalesce(actual_cached_input_tokens, 0), 0),
      output_tokens = greatest(coalesce(actual_output_tokens, 0), 0),
      reasoning_tokens = greatest(coalesce(actual_reasoning_tokens, 0), 0),
      completed_at = now(),
      failure_reason = null
  where target.id = usage_id and target.manager_synthesis_run_id = run_id;

  if setup_run_id is not null then
    select * into setup_row from public.workspace_setup_runs where id = setup_run_id for update;
    if not found or setup_row.artist_workspace_id is distinct from run_row.artist_workspace_id then
      raise exception 'Today''s Brief setup run does not match the workspace.';
    end if;
    setup_stage := coalesce(setup_row.stage_status -> 'setup_brief', '{}'::jsonb);
    if setup_stage_lease_token is null
      or setup_stage ->> 'lease_token' is distinct from setup_stage_lease_token::text
      or coalesce((setup_stage ->> 'lease_expires_at')::timestamptz, '-infinity'::timestamptz) <= now()
    then raise exception 'Today''s Brief setup-stage lease is no longer active.'; end if;

    update public.workspace_setup_runs as target
    set status = 'completed',
        current_stage = 'music_reads',
        stage_status = jsonb_set(
          jsonb_set(target.stage_status, '{setup_brief}', setup_stage || jsonb_build_object(
            'status', 'completed', 'completed_at', now(), 'lease_token', null, 'lease_expires_at', null
          ), true),
          '{music_reads}', coalesce(target.stage_status -> 'music_reads', '{}'::jsonb) || jsonb_build_object(
            'status', case when target_count > 0 then 'running' else 'completed' end,
            'target_count', target_count,
            'targets', coalesce(setup_music_read_targets, '[]'::jsonb),
            'started_at', now(),
            'completed_at', case when target_count = 0 then to_jsonb(now()) else 'null'::jsonb end
          ), true
        ),
        completed_at = now(),
        last_error = null,
        heartbeat_at = now(),
        lease_token = null,
        lease_expires_at = null
    where target.id = setup_run_id;
  end if;

  insert into public.operating_events (
    account_id, artist_workspace_id, artist_id, event_type, actor_type,
    target_type, target_id, workspace_setup_run_id, dedupe_key, display_mode,
    refresh_scope, summary, payload
  ) values (
    run_row.account_id, run_row.artist_workspace_id, run_row.artist_id,
    terminal_event_type, 'manager', 'artist', run_row.artist_id, setup_run_id,
    run_id::text || ':todays_brief:completed', 'toast',
    array['desk-brief', 'activity', 'workspace'], terminal_summary,
    jsonb_build_object('manager_synthesis_run_id', run_id, 'manager_intelligence_packet_id', packet_id, 'manager_output_id', output_id)
  )
  on conflict (artist_workspace_id, dedupe_key) where dedupe_key is not null
  do update set summary = excluded.summary
  returning id into event_id;

  return jsonb_build_object('run_id', run_id, 'packet_id', packet_id, 'output_id', output_id, 'event_id', event_id, 'replayed', false);
end;
$$;

revoke all on function public.finalize_todays_brief_v1(
  uuid, uuid, uuid, uuid, uuid, jsonb, public.evidence_confidence, text[],
  integer, integer, integer, integer, integer, uuid, uuid, jsonb, text, text
) from public, anon, authenticated;
grant execute on function public.finalize_todays_brief_v1(
  uuid, uuid, uuid, uuid, uuid, jsonb, public.evidence_confidence, text[],
  integer, integer, integer, integer, integer, uuid, uuid, jsonb, text, text
) to service_role;

notify pgrst, 'reload schema';
