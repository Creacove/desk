-- Keep an older asynchronous Music Manager Read from replacing the current
-- recommendation after a later canonical song change. The existing output and
-- run remain auditable; only publication is skipped.

create or replace function public.finalize_latest_leased_music_manager_read_v2(
  target_run_id uuid,
  target_lease_token uuid,
  target_output_id uuid,
  target_usage_id uuid,
  target_run_status public.run_status,
  target_steps_payload jsonb,
  target_input_tokens integer,
  target_cached_input_tokens integer,
  target_output_tokens integer,
  target_reasoning_tokens integer,
  target_provider_request_count integer,
  target_usage_metadata jsonb,
  target_trigger_event_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  synthesis_run public.manager_synthesis_runs%rowtype;
  staged_output public.manager_outputs%rowtype;
  usage_event public.ai_run_usage_events%rowtype;
  trigger_event public.operating_events%rowtype;
  later_event_id uuid;
  finalized_output_id uuid;
  expected_usage_status public.usage_status;
  affected_rows integer;
begin
  if target_run_status is null or target_run_status not in ('completed', 'completed_with_limits') then
    raise exception 'Music Manager Read finalization requires a completed run status.';
  end if;
  if target_input_tokens < 0 or target_cached_input_tokens < 0
    or target_output_tokens < 0 or target_reasoning_tokens < 0
    or target_provider_request_count < 0 or target_cached_input_tokens > target_input_tokens then
    raise exception 'Music Manager Read usage counters are invalid.';
  end if;

  select * into synthesis_run
  from public.manager_synthesis_runs
  where id = target_run_id
  for update;
  if not found then raise exception 'Music Manager Read run was not found.'; end if;

  select * into staged_output
  from public.manager_outputs
  where id = target_output_id
  for update;
  if not found then raise exception 'Manager output was not found.'; end if;
  if staged_output.created_from_run_id is distinct from synthesis_run.id
    or staged_output.schema_version <> 'music-manager-read-v2'
    or staged_output.subject_id is null
    or staged_output.account_id is distinct from synthesis_run.account_id
    or staged_output.artist_workspace_id is distinct from synthesis_run.artist_workspace_id
    or staged_output.artist_id is distinct from synthesis_run.artist_id
    or staged_output.subject_type is distinct from synthesis_run.subject_type
    or staged_output.subject_id is distinct from synthesis_run.subject_id then
    raise exception 'Music Manager Read output does not match its synthesis run.';
  end if;

  if synthesis_run.status in ('completed', 'completed_with_limits') then
    return jsonb_build_object('outputId', staged_output.id, 'published', staged_output.is_current);
  end if;
  if synthesis_run.workflow_version is distinct from 'music_manager_read_v2'
    or synthesis_run.classification is distinct from 'music_manager_read_v2'
    or synthesis_run.status <> 'running'
    or synthesis_run.lease_token is distinct from target_lease_token
    or synthesis_run.lease_expires_at <= now() then
    raise exception 'Music Manager Read lease is no longer active.';
  end if;

  select * into usage_event
  from public.ai_run_usage_events
  where id = target_usage_id
  for update;
  if not found
    or usage_event.manager_synthesis_run_id is distinct from synthesis_run.id
    or usage_event.account_id is distinct from synthesis_run.account_id
    or usage_event.artist_workspace_id is distinct from synthesis_run.artist_workspace_id
    or usage_event.artist_id is distinct from synthesis_run.artist_id
    or usage_event.subject_type is distinct from staged_output.subject_type
    or usage_event.subject_id is distinct from staged_output.subject_id
    or usage_event.status <> 'started' then
    raise exception 'Music Manager Read usage event does not match its synthesis run.';
  end if;

  if target_trigger_event_id is not null then
    select * into trigger_event
    from public.operating_events
    where id = target_trigger_event_id
      and account_id = synthesis_run.account_id
      and artist_workspace_id = synthesis_run.artist_workspace_id
      and artist_id = synthesis_run.artist_id
      and (
        (target_type = staged_output.subject_type::text and target_id = staged_output.subject_id)
        or (
          staged_output.subject_type = 'music_item'
          and target_type = 'music_split'
          and payload ->> 'music_item_id' = staged_output.subject_id::text
        )
      )
    for update;
    if not found then raise exception 'Music Manager Read trigger event was not found for this subject.'; end if;

    select id into later_event_id
    from public.operating_events
    where account_id = synthesis_run.account_id
      and artist_workspace_id = synthesis_run.artist_workspace_id
      and artist_id = synthesis_run.artist_id
      and created_at > trigger_event.created_at
      and event_type = any (array[
        'music_item_created',
        'music_asset_uploaded',
        'music_asset_upload_failed',
        'music_audio_analysis_completed',
        'music_audio_analysis_failed',
        'music_lifecycle_updated',
        'music_metadata_updated',
        'music_credit_updated',
        'music_identifier_added',
        'music_split_contributor_saved',
        'music_split_contributor_removed',
        'music_split_confirmation_sent',
        'music_split_confirmation_completed',
        'music_release_brief_updated',
        'music_delivery_status_updated',
        'music_post_release_evidence_updated'
      ]::text[])
      and (
        (target_type = staged_output.subject_type::text and target_id = staged_output.subject_id)
        or (
          staged_output.subject_type = 'music_item'
          and target_type = 'music_split'
          and payload ->> 'music_item_id' = staged_output.subject_id::text
        )
      )
    order by created_at desc, id desc
    limit 1;
  end if;

  if later_event_id is null then
    select public.finalize_leased_music_manager_read_v2(
      target_run_id,
      target_lease_token,
      target_output_id,
      target_usage_id,
      target_run_status,
      target_steps_payload,
      target_input_tokens,
      target_cached_input_tokens,
      target_output_tokens,
      target_reasoning_tokens,
      target_provider_request_count,
      target_usage_metadata
    ) into finalized_output_id;
    return jsonb_build_object('outputId', finalized_output_id, 'published', true);
  end if;

  expected_usage_status := case target_run_status
    when 'completed' then 'succeeded'::public.usage_status
    else 'partial'::public.usage_status
  end;

  update public.manager_synthesis_runs
  set status = target_run_status,
      steps_payload = target_steps_payload,
      completed_at = now(),
      error = null,
      lease_token = null,
      lease_expires_at = null,
      heartbeat_at = now()
  where id = synthesis_run.id
    and status = 'running'
    and lease_token = target_lease_token;
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then raise exception 'Music Manager Read synthesis run could not be terminalized.'; end if;

  update public.ai_run_usage_events
  set status = expected_usage_status,
      input_tokens = target_input_tokens,
      cached_input_tokens = target_cached_input_tokens,
      output_tokens = target_output_tokens,
      reasoning_tokens = target_reasoning_tokens,
      provider_request_count = target_provider_request_count,
      completed_at = now(),
      failure_reason = null,
      metadata = coalesce(target_usage_metadata, '{}'::jsonb) || jsonb_build_object('superseded_by_event_id', later_event_id)
  where id = usage_event.id
    and status = 'started';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then raise exception 'Music Manager Read usage event could not be terminalized.'; end if;

  return jsonb_build_object('outputId', staged_output.id, 'published', false, 'supersededByEventId', later_event_id);
end;
$$;

revoke all on function public.finalize_latest_leased_music_manager_read_v2(
  uuid, uuid, uuid, uuid, public.run_status, jsonb, integer, integer, integer, integer, integer, jsonb, uuid
) from public, anon, authenticated;

grant execute on function public.finalize_latest_leased_music_manager_read_v2(
  uuid, uuid, uuid, uuid, public.run_status, jsonb, integer, integer, integer, integer, integer, jsonb, uuid
) to service_role;
