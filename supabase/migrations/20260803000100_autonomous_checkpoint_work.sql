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
        question, reason_for_checkpoint, watched_signals, decision_rule, recommendation, next_action,
        required_evidence, missing_evidence, custom_reason, created_from_run_id, created_from_action_id
      ) values (
        run_row.account_id, run_row.artist_workspace_id, run_row.artist_id, applied_mission_id, plan_id,
        checkpoint ->> 'title',
        case when exists (
          select 1
          from jsonb_array_elements(coalesce(decision -> 'tasks', '[]'::jsonb)) as candidate_task(value)
          where candidate_task.value ->> 'primaryCheckpointKey' = checkpoint ->> 'key'
            and lower(trim(coalesce(candidate_task.value ->> 'ownerRole', ''))) <> 'manager'
        ) then 'waiting'::public.checkpoint_status
        else 'watching_signal'::public.checkpoint_status
        end,
        checkpoint ->> 'question', checkpoint ->> 'question',
        public._mission_genesis_text_array(checkpoint -> 'sourceRefs'), checkpoint ->> 'decisionRule',
        checkpoint ->> 'managerRead', checkpoint ->> 'nextAction',
        public._mission_genesis_text_array(checkpoint -> 'requiredEvidence'),
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
