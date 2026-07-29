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

create unique index if not exists ai_run_usage_events_mission_genesis_unique_idx
  on public.ai_run_usage_events (manager_synthesis_run_id)
  where manager_synthesis_run_id is not null
    and operation_key in ('mission_genesis_initial_v2', 'mission_genesis_continue_v2');

create unique index if not exists manager_run_actions_mission_genesis_result_unique_idx
  on public.manager_run_actions (manager_synthesis_run_id, action_key)
  where action_key = 'mission-genesis-result';

create unique index if not exists memory_entries_mission_genesis_answer_unique_idx
  on public.memory_entries (created_from_run_id, source_type, source_id)
  where created_from_run_id is not null
    and source_type = 'manager_context_answer'
    and source_id is not null;

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

create or replace function public.merge_setup_music_read_target_v1(
  setup_run_id uuid,
  target_subject_type text,
  target_subject_id uuid,
  child_run_id uuid,
  target_status public.run_status
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  setup_row public.workspace_setup_runs%rowtype;
  child_row public.manager_synthesis_runs%rowtype;
  music_stage jsonb;
  current_targets jsonb;
  merged_targets jsonb;
  existing_setup_ids jsonb;
  effective_status public.run_status := target_status;
  all_terminal boolean;
  any_limited boolean;
  matching_targets integer;
  failures jsonb;
begin
  if target_subject_type not in ('music_item', 'music_project') then
    raise exception 'Unsupported setup music-read subject type.';
  end if;
  if target_status not in ('queued', 'running', 'completed', 'completed_with_limits', 'failed', 'cancelled') then
    raise exception 'Unsupported setup music-read status.';
  end if;

  select * into setup_row from public.workspace_setup_runs where id = setup_run_id for update;
  if not found then raise exception 'Setup run was not found for music-read reconciliation.'; end if;
  music_stage := coalesce(setup_row.stage_status -> 'music_reads', '{}'::jsonb);
  current_targets := coalesce(music_stage -> 'targets', '[]'::jsonb);
  if jsonb_typeof(current_targets) <> 'array' then
    raise exception 'Setup music-read targets are not an array.';
  end if;

  select count(*) into matching_targets
  from jsonb_array_elements(current_targets) as target
  where target ->> 'subjectType' = target_subject_type
    and target ->> 'subjectId' = target_subject_id::text;
  if matching_targets <> 1 then
    raise exception 'Setup music-read target tuple was not found exactly once.';
  end if;

  if child_run_id is not null then
    select * into child_row from public.manager_synthesis_runs where id = child_run_id for update;
    if not found
      or child_row.account_id is distinct from setup_row.account_id
      or child_row.artist_workspace_id is distinct from setup_row.artist_workspace_id
      or child_row.artist_id is distinct from setup_row.artist_id
      or child_row.classification <> 'music_manager_read_v2'
      or child_row.subject_type is distinct from target_subject_type
      or child_row.subject_id is distinct from target_subject_id
    then raise exception 'Music Manager Read child does not match its setup target.'; end if;
    effective_status := child_row.status;
    existing_setup_ids := coalesce(child_row.context_payload -> 'setupRunIds', '[]'::jsonb);
    if jsonb_typeof(existing_setup_ids) <> 'array' then existing_setup_ids := '[]'::jsonb; end if;
    if not existing_setup_ids @> jsonb_build_array(setup_run_id::text) then
      update public.manager_synthesis_runs as target
      set context_payload = jsonb_set(
        coalesce(target.context_payload, '{}'::jsonb),
        '{setupRunIds}',
        existing_setup_ids || jsonb_build_array(setup_run_id::text),
        true
      )
      where target.id = child_run_id;
    end if;
  elsif target_status <> 'failed' then
    raise exception 'Only a dispatch failure may omit the child run ID.';
  end if;

  select jsonb_agg(
    case
      when target ->> 'subjectType' = target_subject_type and target ->> 'subjectId' = target_subject_id::text
      then target || jsonb_strip_nulls(jsonb_build_object(
        'runId', child_run_id,
        'status', effective_status::text,
        'updatedAt', now()
      ))
      else target
    end
    order by ordinality
  ) into merged_targets
  from jsonb_array_elements(current_targets) with ordinality as items(target, ordinality);

  select
    bool_and(coalesce(target ->> 'status', 'queued') in ('completed', 'completed_with_limits', 'failed', 'cancelled')),
    bool_or(coalesce(target ->> 'status', 'queued') in ('completed_with_limits', 'failed', 'cancelled')),
    coalesce(jsonb_agg(target) filter (
      where coalesce(target ->> 'status', 'queued') in ('completed_with_limits', 'failed', 'cancelled')
    ), '[]'::jsonb)
  into all_terminal, any_limited, failures
  from jsonb_array_elements(merged_targets) as target;

  music_stage := music_stage || jsonb_build_object(
    'status', case when all_terminal then case when any_limited then 'completed_with_limits' else 'completed' end else 'running' end,
    'targets', merged_targets,
    'failures', failures,
    'completed_at', case when all_terminal then to_jsonb(now()) else 'null'::jsonb end
  );
  update public.workspace_setup_runs as target
  set stage_status = jsonb_set(target.stage_status, '{music_reads}', music_stage, true),
      heartbeat_at = now()
  where target.id = setup_run_id;
  return music_stage;
end;
$$;

create or replace function public._mission_genesis_text_array(value jsonb)
returns text[]
language sql
immutable
set search_path = public
as $$
  select coalesce(array_agg(item order by ordinality), '{}'::text[])
  from jsonb_array_elements_text(case when jsonb_typeof(value) = 'array' then value else '[]'::jsonb end)
    with ordinality as items(item, ordinality);
$$;

create or replace function public._apply_mission_genesis_graph_v2(
  target_run_id uuid,
  target_action_id uuid,
  decision jsonb,
  preferred_mission_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  run_row public.manager_synthesis_runs%rowtype;
  mission_row public.missions%rowtype;
  mission_data jsonb := coalesce(decision -> 'mission', '{}'::jsonb);
  outcome text := decision ->> 'outcome';
  applied_mission_id uuid;
  plan_id uuid;
  next_plan_version integer;
  checkpoint jsonb;
  checkpoint_id uuid;
  checkpoint_ids jsonb := '{}'::jsonb;
  checkpoint_index integer := 0;
  task jsonb;
  applied_task_id uuid;
  step_body text;
  permission jsonb;
  question jsonb;
  persisted_questions jsonb := '[]'::jsonb;
  applied_question_key text;
  event_type text;
  evidence_needed text[] := public._mission_genesis_text_array(decision -> 'evidenceNeeded');
  applied_required_evidence text[];
  applied_missing_evidence text[];
begin
  select * into run_row from public.manager_synthesis_runs where id = target_run_id for update;
  if not found then raise exception 'Mission Genesis run was not found.'; end if;

  if preferred_mission_id is not null then
    select * into mission_row from public.missions
    where id = preferred_mission_id
      and account_id = run_row.account_id
      and artist_workspace_id = run_row.artist_workspace_id
      and artist_id = run_row.artist_id
    for update;
    if not found then raise exception 'Mission Genesis candidate does not match the run owner.'; end if;
  end if;

  if outcome in ('no_mission', 'request_evidence') then
    if preferred_mission_id is not null and mission_row.status = 'candidate' then
      update public.missions
      set status = 'archived', archived_at = now(), current_recommendation = decision ->> 'decisionSummary', updated_at = now()
      where id = preferred_mission_id;
    end if;
    insert into public.operating_events (
      account_id, artist_workspace_id, artist_id, event_type, actor_type, target_type, target_id,
      source_type, source_id, manager_synthesis_run_id, manager_run_action_id,
      dedupe_key, display_mode, refresh_scope, summary, payload
    ) values (
      run_row.account_id, run_row.artist_workspace_id, run_row.artist_id,
      'mission_genesis_' || outcome, 'manager', 'artist', run_row.artist_id,
      'mission_genesis', target_run_id, target_run_id, target_action_id,
      target_run_id::text || ':mission-genesis:' || outcome, 'activity', array['missions', 'activity'],
      decision ->> 'decisionSummary', jsonb_build_object('outcome', outcome, 'reasons', decision -> 'reasons', 'evidenceNeeded', decision -> 'evidenceNeeded')
    ) on conflict (artist_workspace_id, dedupe_key) where dedupe_key is not null do nothing;
    return jsonb_build_object(
      'outcome', outcome, 'missionId', null, 'missionIds', '[]'::jsonb,
      'activatedMissionIds', '[]'::jsonb, 'candidateMissionIds', '[]'::jsonb, 'questions', '[]'::jsonb
    );
  end if;

  select coalesce(array_agg(distinct value), '{}'::text[])
  into applied_required_evidence
  from jsonb_array_elements(coalesce(decision -> 'checkpoints', '[]'::jsonb)) as item,
       jsonb_array_elements_text(coalesce(item -> 'requiredEvidence', '[]'::jsonb)) as value;
  select coalesce(array_agg(distinct value), '{}'::text[])
  into applied_missing_evidence
  from (
    select value from unnest(evidence_needed) as value
    union
    select value
    from jsonb_array_elements(coalesce(decision -> 'checkpoints', '[]'::jsonb)) as item,
         jsonb_array_elements_text(coalesce(item -> 'missingEvidence', '[]'::jsonb)) as value
  ) as missing;

  if outcome = 'update_existing_mission' then
    applied_mission_id := nullif(decision ->> 'existingMissionId', '')::uuid;
    select * into mission_row from public.missions
    where id = applied_mission_id
      and account_id = run_row.account_id
      and artist_workspace_id = run_row.artist_workspace_id
      and artist_id = run_row.artist_id
    for update;
    if not found then raise exception 'Mission Genesis update target does not match the run owner.'; end if;
  elsif preferred_mission_id is not null then
    applied_mission_id := preferred_mission_id;
  else
    insert into public.missions (
      account_id, artist_workspace_id, artist_id, title, objective, reason, status, priority, progress,
      summary, pattern_name, pattern_confidence, originating_trigger, originating_run_id,
      required_evidence, missing_evidence, current_recommendation, change_conditions, review_point,
      created_from_run_id, created_from_action_id
    ) values (
      run_row.account_id, run_row.artist_workspace_id, run_row.artist_id,
      mission_data ->> 'title', mission_data ->> 'objective', mission_data ->> 'reason', 'candidate', 0, 0,
      mission_data ->> 'summary', mission_data ->> 'patternName',
      case when decision ->> 'confidence' = 'limited' then 'low'::public.evidence_confidence
        else coalesce(nullif(decision ->> 'confidence', ''), 'unknown')::public.evidence_confidence end,
      'manual_mission_genesis_openai', target_run_id,
      applied_required_evidence, applied_missing_evidence, mission_data ->> 'currentRecommendation',
      public._mission_genesis_text_array(mission_data -> 'changeConditions'),
      coalesce(decision -> 'checkpoints' -> 0 ->> 'title', 'Manager review'),
      target_run_id, target_action_id
    ) returning id into applied_mission_id;
  end if;

  if outcome = 'update_existing_mission' or preferred_mission_id is not null then
    update public.missions
    set title = mission_data ->> 'title', objective = mission_data ->> 'objective', reason = mission_data ->> 'reason',
        summary = mission_data ->> 'summary', pattern_name = mission_data ->> 'patternName',
        pattern_confidence = case when decision ->> 'confidence' = 'limited' then 'low'::public.evidence_confidence
          else coalesce(nullif(decision ->> 'confidence', ''), 'unknown')::public.evidence_confidence end,
        current_recommendation = coalesce(nullif(mission_data ->> 'currentRecommendation', ''), decision ->> 'decisionSummary'),
        change_conditions = public._mission_genesis_text_array(mission_data -> 'changeConditions'),
        review_point = coalesce(decision -> 'checkpoints' -> 0 ->> 'title', 'Manager review'),
        required_evidence = applied_required_evidence, missing_evidence = applied_missing_evidence,
        originating_trigger = 'manual_mission_genesis_openai', originating_run_id = target_run_id,
        created_from_run_id = coalesce(created_from_run_id, target_run_id),
        created_from_action_id = coalesce(created_from_action_id, target_action_id), updated_at = now()
    where id = applied_mission_id;
  end if;

  if outcome = 'candidate_needs_context' then
    for question in select value from jsonb_array_elements(coalesce(decision -> 'questions', '[]'::jsonb)) loop
      applied_question_key := 'mission_genesis:' || applied_mission_id::text || ':' || trim(both '-' from regexp_replace(lower(coalesce(question ->> 'key', 'question')), '[^a-z0-9]+', '-', 'g'));
      insert into public.manager_context_questions (question_key, question, suggested_answer, required_for, order_index, status)
      values (
        applied_question_key, question ->> 'question', null, array['mission_genesis'],
        jsonb_array_length(persisted_questions) + 1, 'active'
      )
      on conflict (question_key) do update set question = excluded.question
      returning manager_context_questions.question_key into applied_question_key;
      persisted_questions := persisted_questions || jsonb_build_array(question || jsonb_build_object('key', applied_question_key));
    end loop;
  else
    select coalesce(max(version), 0) + 1 into next_plan_version
    from public.mission_plan_versions as existing_plan where existing_plan.mission_id = applied_mission_id;

    insert into public.mission_plan_versions (
      account_id, artist_workspace_id, artist_id, mission_id, version, status,
      generated_from_run_id, generated_from_action_id, summary
    ) values (
      run_row.account_id, run_row.artist_workspace_id, run_row.artist_id, applied_mission_id, next_plan_version, 'active',
      target_run_id, target_action_id, concat_ws('. ', mission_data ->> 'timeline', mission_data ->> 'summary')
    ) returning id into plan_id;

    update public.mission_plan_versions set status = 'superseded', superseded_at = now(), superseded_by_plan_id = plan_id
    where mission_plan_versions.mission_id = applied_mission_id and id <> plan_id and status in ('active', 'draft');
    update public.checkpoints set status = 'skipped', updated_at = now()
    where mission_plan_version_id in (
      select id from public.mission_plan_versions where mission_plan_versions.mission_id = applied_mission_id and id <> plan_id
    ) and status in ('waiting', 'blocked', 'ready_for_manager_check', 'watching_signal', 'needs_revision');
    update public.tasks set status = 'superseded', updated_at = now()
    where mission_plan_version_id in (
      select id from public.mission_plan_versions where mission_plan_versions.mission_id = applied_mission_id and id <> plan_id
    ) and status in ('proposed', 'open', 'needs_approval', 'approved', 'in_progress', 'blocked', 'missed');

    for checkpoint in select value from jsonb_array_elements(coalesce(decision -> 'checkpoints', '[]'::jsonb)) loop
      checkpoint_index := checkpoint_index + 1;
      insert into public.checkpoints (
        account_id, artist_workspace_id, artist_id, mission_id, mission_plan_version_id, title, status,
        question, reason_for_checkpoint, watched_signals, decision_rule, recommendation,
        required_evidence, missing_evidence, custom_reason, created_from_run_id, created_from_action_id
      ) values (
        run_row.account_id, run_row.artist_workspace_id, run_row.artist_id, applied_mission_id, plan_id,
        checkpoint ->> 'title', 'waiting', checkpoint ->> 'question', checkpoint ->> 'question',
        public._mission_genesis_text_array(checkpoint -> 'sourceRefs'), checkpoint ->> 'decisionRule',
        mission_data ->> 'currentRecommendation', public._mission_genesis_text_array(checkpoint -> 'requiredEvidence'),
        public._mission_genesis_text_array(checkpoint -> 'missingEvidence'),
        'Manager-authored checkpoint grounded in packet refs: ' || array_to_string(public._mission_genesis_text_array(checkpoint -> 'sourceRefs'), ', '),
        target_run_id, target_action_id
      ) returning id into checkpoint_id;
      checkpoint_ids := checkpoint_ids || jsonb_build_object(checkpoint ->> 'key', checkpoint_id);
      insert into public.mission_plan_checkpoints (
        account_id, artist_workspace_id, artist_id, mission_plan_version_id, mission_id,
        checkpoint_id, order_index, phase_label, unlock_rule
      ) values (
        run_row.account_id, run_row.artist_workspace_id, run_row.artist_id, plan_id, applied_mission_id,
        checkpoint_id, checkpoint_index, checkpoint ->> 'title', checkpoint ->> 'decisionRule'
      );
    end loop;

    for task in select value from jsonb_array_elements(coalesce(decision -> 'tasks', '[]'::jsonb)) loop
      checkpoint_id := nullif(checkpoint_ids ->> (task ->> 'primaryCheckpointKey'), '')::uuid;
      if checkpoint_id is null then raise exception 'Mission Genesis task references a missing checkpoint.'; end if;
      insert into public.tasks (
        account_id, artist_workspace_id, artist_id, scope, mission_id, mission_plan_version_id,
        primary_checkpoint_id, title, owner_role, priority, status, approval_state, purpose,
        evidence_needed, completion_expectation, completion_mode, deliverable_title, deliverable_requirements,
        manager_responsibility, user_responsibility, risk_if_late, created_from_run_id, created_from_action_id
      ) values (
        run_row.account_id, run_row.artist_workspace_id, run_row.artist_id, 'mission', applied_mission_id, plan_id,
        checkpoint_id, task ->> 'title', coalesce(nullif(task ->> 'ownerRole', ''), 'Manager'), 1, 'proposed', 'not_required',
        task ->> 'purpose', public._mission_genesis_text_array(task -> 'evidenceNeeded'), task ->> 'completionExpectation',
        nullif(task ->> 'completionMode', ''), nullif(task ->> 'deliverableTitle', ''), coalesce(task -> 'deliverableRequirements', '[]'::jsonb),
        nullif(task ->> 'managerResponsibility', ''), nullif(task ->> 'userResponsibility', ''), task ->> 'riskIfLate',
        target_run_id, target_action_id
      ) returning id into applied_task_id;
      for step_body in select value from jsonb_array_elements_text(coalesce(task -> 'steps', '[]'::jsonb)) loop
        insert into public.task_steps (account_id, artist_workspace_id, artist_id, task_id, order_index, body)
        values (run_row.account_id, run_row.artist_workspace_id, run_row.artist_id, applied_task_id,
          (select count(*) + 1 from public.task_steps as existing_step where existing_step.task_id = applied_task_id), step_body);
      end loop;
    end loop;

    for permission in select value from jsonb_array_elements(coalesce(decision -> 'permissionRequests', '[]'::jsonb)) loop
      insert into public.permission_requests (
        account_id, artist_workspace_id, artist_id, mission_id, request_type, title, body, risk,
        status, created_from_run_id, created_from_action_id
      ) values (
        run_row.account_id, run_row.artist_workspace_id, run_row.artist_id, applied_mission_id,
        (permission ->> 'requestType')::public.permission_request_type, permission ->> 'title',
        permission ->> 'body', permission ->> 'risk', 'pending', target_run_id, target_action_id
      );
    end loop;
    update public.missions set active_plan_version_id = plan_id, status = 'active', priority = 1, updated_at = now()
    where id = applied_mission_id;
  end if;

  event_type := case outcome when 'activate_mission' then 'mission_activated'
    when 'candidate_needs_context' then 'mission_candidate_created' else 'mission_genesis_' || outcome end;
  insert into public.operating_events (
    account_id, artist_workspace_id, artist_id, event_type, actor_type, target_type, target_id,
    source_type, source_id, manager_synthesis_run_id, manager_run_action_id, mission_id,
    dedupe_key, display_mode, refresh_scope, summary, payload
  ) values (
    run_row.account_id, run_row.artist_workspace_id, run_row.artist_id, event_type, 'manager', 'mission', applied_mission_id,
    'mission_genesis', target_run_id, target_run_id, target_action_id, applied_mission_id,
    target_run_id::text || ':mission-genesis:' || applied_mission_id::text, 'toast', array['missions', 'activity'],
    decision ->> 'decisionSummary', jsonb_build_object('outcome', outcome, 'reasons', decision -> 'reasons', 'evidenceNeeded', decision -> 'evidenceNeeded')
  ) on conflict (artist_workspace_id, dedupe_key) where dedupe_key is not null do nothing;

  return jsonb_build_object(
    'outcome', outcome, 'missionId', applied_mission_id, 'missionIds', jsonb_build_array(applied_mission_id),
    'activatedMissionIds', case when outcome in ('activate_mission', 'update_existing_mission') then jsonb_build_array(applied_mission_id) else '[]'::jsonb end,
    'candidateMissionIds', case when outcome = 'candidate_needs_context' then jsonb_build_array(applied_mission_id) else '[]'::jsonb end,
    'questions', persisted_questions
  );
end;
$$;

create or replace function public.finalize_mission_genesis_v2(
  run_id uuid,
  current_lease_token uuid,
  usage_id uuid,
  result_output jsonb,
  actual_provider_request_count integer,
  actual_input_tokens integer,
  actual_cached_input_tokens integer,
  actual_output_tokens integer,
  actual_reasoning_tokens integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  run_row public.manager_synthesis_runs%rowtype;
  usage_row public.ai_run_usage_events%rowtype;
  action_row public.manager_run_actions%rowtype;
  action_id uuid;
  graph_result jsonb;
  candidate jsonb;
  candidate_result jsonb;
  mission_ids jsonb := '[]'::jsonb;
  activated_ids jsonb := '[]'::jsonb;
  candidate_ids jsonb := '[]'::jsonb;
  questions jsonb := '[]'::jsonb;
  preferred_mission_id uuid;
begin
  select * into run_row from public.manager_synthesis_runs where id = run_id for update;
  if not found then raise exception 'Mission Genesis run was not found.'; end if;

  select * into action_row from public.manager_run_actions
  where manager_synthesis_run_id = run_id and action_key = 'mission-genesis-result'
  for update;
  if run_row.status = 'completed' then
    if found and action_row.payload = result_output and exists (
      select 1 from public.ai_run_usage_events as replay_usage
      where replay_usage.id = usage_id
        and replay_usage.manager_synthesis_run_id = run_id
        and replay_usage.status = 'succeeded'
        and replay_usage.provider_request_count = greatest(coalesce(actual_provider_request_count, 0), 0)
        and replay_usage.input_tokens = greatest(coalesce(actual_input_tokens, 0), 0)
        and replay_usage.cached_input_tokens = greatest(coalesce(actual_cached_input_tokens, 0), 0)
        and replay_usage.output_tokens = greatest(coalesce(actual_output_tokens, 0), 0)
        and replay_usage.reasoning_tokens = greatest(coalesce(actual_reasoning_tokens, 0), 0)
    ) then
      return action_row.result_payload || jsonb_build_object('replayed', true);
    end if;
    raise exception 'Conflicting Mission Genesis finalizer replay.';
  end if;

  if run_row.workflow_version is distinct from 'mission-genesis-v2'
    or run_row.classification not in ('mission_genesis_v2', 'mission_genesis_continue_v2')
    or run_row.status <> 'running'
    or run_row.lease_token is distinct from current_lease_token
    or run_row.lease_expires_at is null or run_row.lease_expires_at <= now()
  then raise exception 'Mission Genesis lease is no longer active.'; end if;

  select * into usage_row from public.ai_run_usage_events where id = usage_id for update;
  if not found or usage_row.manager_synthesis_run_id is distinct from run_id
    or usage_row.account_id is distinct from run_row.account_id
    or usage_row.artist_workspace_id is distinct from run_row.artist_workspace_id
    or usage_row.artist_id is distinct from run_row.artist_id
    or usage_row.operation_key not in ('mission_genesis_initial_v2', 'mission_genesis_continue_v2')
  then raise exception 'Mission Genesis usage row does not match the run owner.'; end if;

  if run_row.classification = 'mission_genesis_continue_v2' then
    preferred_mission_id := run_row.mission_id;
    if not exists (
      select 1 from public.memory_entries
      where created_from_run_id = run_id and source_type = 'manager_context_answer'
    ) then raise exception 'Mission Genesis continuation has no canonical answer memory.'; end if;
  end if;

  insert into public.manager_run_actions (
    account_id, artist_workspace_id, artist_id, manager_synthesis_run_id, order_index, action_type,
    target_type, target_id, status, approval_required, payload, result_payload, action_key
  ) values (
    run_row.account_id, run_row.artist_workspace_id, run_row.artist_id, run_id, 1, result_output ->> 'outcome',
    case when result_output ->> 'outcome' in ('no_mission', 'request_evidence') then 'artist' else 'mission' end,
    preferred_mission_id, 'pending', false, result_output, '{}'::jsonb, 'mission-genesis-result'
  ) returning id into action_id;

  if preferred_mission_id is null and jsonb_array_length(coalesce(result_output -> 'missionCandidates', '[]'::jsonb)) > 1 then
    for candidate in select value from jsonb_array_elements(result_output -> 'missionCandidates') loop
      candidate_result := public._apply_mission_genesis_graph_v2(
        run_id, action_id,
        result_output || jsonb_build_object(
          'outcome', candidate ->> 'outcome', 'confidence', candidate ->> 'confidence',
          'decisionSummary', coalesce(candidate -> 'mission' ->> 'summary', result_output ->> 'decisionSummary'),
          'reasons', candidate -> 'reasons', 'evidenceNeeded', candidate -> 'evidenceNeeded',
          'existingMissionId', '', 'questions', candidate -> 'questions', 'mission', candidate -> 'mission',
          'checkpoints', candidate -> 'checkpoints', 'tasks', candidate -> 'tasks',
          'permissionRequests', candidate -> 'permissionRequests', 'missionCandidates', jsonb_build_array(candidate)
        ), null
      );
      mission_ids := mission_ids || coalesce(candidate_result -> 'missionIds', '[]'::jsonb);
      activated_ids := activated_ids || coalesce(candidate_result -> 'activatedMissionIds', '[]'::jsonb);
      candidate_ids := candidate_ids || coalesce(candidate_result -> 'candidateMissionIds', '[]'::jsonb);
      questions := questions || coalesce(candidate_result -> 'questions', '[]'::jsonb);
    end loop;
    graph_result := jsonb_build_object(
      'outcome', result_output ->> 'outcome', 'missionId', coalesce(activated_ids -> 0, candidate_ids -> 0, mission_ids -> 0),
      'missionIds', mission_ids, 'activatedMissionIds', activated_ids, 'candidateMissionIds', candidate_ids, 'questions', questions
    );
  else
    graph_result := public._apply_mission_genesis_graph_v2(run_id, action_id, result_output, preferred_mission_id);
  end if;

  update public.manager_run_actions
  set target_id = nullif(graph_result ->> 'missionId', '')::uuid,
      status = case when result_output ->> 'outcome' = 'request_evidence' then 'skipped' else 'applied' end,
      result_payload = graph_result
  where id = action_id;

  update public.ai_run_usage_events
  set status = 'succeeded', provider_request_count = greatest(coalesce(actual_provider_request_count, 0), 0),
      input_tokens = greatest(coalesce(actual_input_tokens, 0), 0),
      cached_input_tokens = greatest(coalesce(actual_cached_input_tokens, 0), 0),
      output_tokens = greatest(coalesce(actual_output_tokens, 0), 0),
      reasoning_tokens = greatest(coalesce(actual_reasoning_tokens, 0), 0), completed_at = now(), failure_reason = null
  where id = usage_id and manager_synthesis_run_id = run_id;

  update public.manager_synthesis_runs
  set mission_id = nullif(graph_result ->> 'missionId', '')::uuid, status = 'completed',
      confidence = case when result_output ->> 'confidence' = 'limited' then 'low'::public.evidence_confidence
        else coalesce(nullif(result_output ->> 'confidence', ''), 'unknown')::public.evidence_confidence end,
      steps_payload = jsonb_build_array(
        jsonb_build_object('step', 'packet_built', 'status', 'completed'),
        jsonb_build_object('step', 'openai_synthesis', 'status', 'completed'),
        jsonb_build_object('step', 'decision_persisted', 'status', 'completed')
      ),
      action_plan = coalesce(result_output -> 'tasks', '[]'::jsonb),
      limitations = public._mission_genesis_text_array(result_output -> 'evidenceNeeded'),
      completed_at = now(), error = null, lease_token = null, lease_expires_at = null, heartbeat_at = now()
  where id = run_id and lease_token = current_lease_token;

  return graph_result || jsonb_build_object('actionId', action_id, 'replayed', false);
end;
$$;

revoke all on function public._mission_genesis_text_array(jsonb) from public, anon, authenticated, service_role;
revoke all on function public._apply_mission_genesis_graph_v2(uuid, uuid, jsonb, uuid) from public, anon, authenticated, service_role;
revoke all on function public.finalize_mission_genesis_v2(
  uuid, uuid, uuid, jsonb, integer, integer, integer, integer, integer
) from public, anon, authenticated;
grant execute on function public.finalize_mission_genesis_v2(
  uuid, uuid, uuid, jsonb, integer, integer, integer, integer, integer
) to service_role;

revoke all on function public.finalize_todays_brief_v1(
  uuid, uuid, uuid, uuid, uuid, jsonb, public.evidence_confidence, text[],
  integer, integer, integer, integer, integer, uuid, uuid, jsonb, text, text
) from public, anon, authenticated;
grant execute on function public.finalize_todays_brief_v1(
  uuid, uuid, uuid, uuid, uuid, jsonb, public.evidence_confidence, text[],
  integer, integer, integer, integer, integer, uuid, uuid, jsonb, text, text
) to service_role;

revoke all on function public.merge_setup_music_read_target_v1(
  uuid, text, uuid, uuid, public.run_status
) from public, anon, authenticated;
grant execute on function public.merge_setup_music_read_target_v1(
  uuid, text, uuid, uuid, public.run_status
) to service_role;

notify pgrst, 'reload schema';
