-- Gate 1 capability smoke: canonical facts/decisions/current-plan work outrank history.

begin;

do $$
declare
  v_account uuid := gen_random_uuid();
  v_user uuid := gen_random_uuid();
  v_artist uuid := gen_random_uuid();
  v_workspace uuid := gen_random_uuid();
  v_conversation uuid := gen_random_uuid();
  v_mission uuid := gen_random_uuid();
  v_plan_current uuid := gen_random_uuid();
  v_plan_old uuid := gen_random_uuid();
  v_checkpoint_current uuid := gen_random_uuid();
  v_checkpoint_old uuid := gen_random_uuid();
  v_task_current uuid := gen_random_uuid();
  v_task_old uuid := gen_random_uuid();
  v_review uuid := gen_random_uuid();
  v_run uuid := gen_random_uuid();
  v_permission uuid := gen_random_uuid();
  v_snapshot jsonb;
  v_question_count integer;
begin
  insert into public.accounts (id, name, status) values (v_account, 'Gate 1 smoke', 'active');
  insert into public.users (id, email, display_name, status) values (v_user, 'gate1-smoke@example.com', 'Gate 1', 'active');
  insert into public.account_memberships (account_id, user_id, role, status) values (v_account, v_user, 'owner', 'active');
  insert into public.artists (id, account_id, display_name) values (v_artist, v_account, 'State Artist');
  insert into public.artist_workspaces (id, account_id, artist_id, name, status)
  values (v_workspace, v_account, v_artist, 'State Workspace', 'active');
  insert into public.conversations (id, account_id, artist_workspace_id, artist_id, topic, status)
  values (v_conversation, v_account, v_workspace, v_artist, 'State integrity', 'active');

  insert into public.missions (id, account_id, artist_workspace_id, artist_id, title, objective, status, priority)
  values (v_mission, v_account, v_workspace, v_artist, 'Current Mission', 'Keep canonical state coherent.', 'active', 1);

  insert into public.mission_plan_versions (id, account_id, artist_workspace_id, artist_id, mission_id, version, status, summary)
  values
    (v_plan_old, v_account, v_workspace, v_artist, v_mission, 1, 'superseded', 'Old route'),
    (v_plan_current, v_account, v_workspace, v_artist, v_mission, 2, 'active', 'Current route');
  update public.mission_plan_versions set superseded_by_plan_id = v_plan_current, superseded_at = now() where id = v_plan_old;
  update public.missions set active_plan_version_id = v_plan_current where id = v_mission;

  insert into public.checkpoints (id, account_id, artist_workspace_id, artist_id, mission_id, mission_plan_version_id, title, status, question)
  values
    (v_checkpoint_old, v_account, v_workspace, v_artist, v_mission, v_plan_old, 'Old checkpoint', 'skipped', 'Old?'),
    (v_checkpoint_current, v_account, v_workspace, v_artist, v_mission, v_plan_current, 'Current checkpoint', 'waiting', 'Current?');

  insert into public.tasks (
    id, account_id, artist_workspace_id, artist_id, scope, mission_id, mission_plan_version_id,
    primary_checkpoint_id, title, owner_role, work_mode, priority, status, approval_state,
    purpose, completion_expectation, manager_responsibility, user_responsibility, risk_if_late
  ) values
    (v_task_old, v_account, v_workspace, v_artist, 'mission', v_mission, v_plan_old,
     v_checkpoint_old, 'Stale old-plan task', 'Artist', 'artist_action', 1, 'superseded', 'not_required',
     'Old route.', 'Old route.', 'Old route.', 'Old route.', 'None'),
    (v_task_current, v_account, v_workspace, v_artist, 'mission', v_mission, v_plan_current,
     v_checkpoint_current, 'Current executable task', 'Artist', 'artist_action', 1, 'open', 'not_required',
     'Current route.', 'Complete current work.', 'Desk owns management.', 'Artist executes.', 'Delay');

  insert into public.artist_operating_facts (
    account_id, artist_workspace_id, artist_id, domain, fact_key, scope_type, scope_key,
    value_json, display_value, source_type, confidence, valid_until, last_confirmed_at
  ) values (
    v_account, v_workspace, v_artist, 'money', 'money.current_budget', 'artist', 'artist',
    jsonb_build_object('answer', '₦150,000'), '₦150,000', 'user_answer', 'high', now() + interval '7 days', now()
  );

  insert into public.permission_requests (
    id, account_id, artist_workspace_id, artist_id, mission_id, request_type,
    title, body, risk, parameters, status
  ) values (
    v_permission, v_account, v_workspace, v_artist, v_mission, 'external_outreach',
    'Old outreach decision', 'Do not ask again.', 'Low', jsonb_build_object('effect', 'same'), 'rejected'
  );

  -- Artist write occurs before every Manager packet and must refresh canonical truth.
  insert into public.conversation_messages (
    account_id, artist_workspace_id, artist_id, conversation_id, speaker, label, body, metadata
  ) values (
    v_account, v_workspace, v_artist, v_conversation, 'artist', 'You', 'What should we do next?', '{}'::jsonb
  );

  select memory.content::jsonb into v_snapshot
  from public.memory_entries as memory
  where memory.artist_workspace_id = v_workspace
    and memory.source_type = 'manager_canonical_state_v1'
  order by memory.created_at desc
  limit 1;

  if v_snapshot ->> 'projectionVersion' <> 'manager_canonical_state_v1' then
    raise exception 'Canonical state snapshot was not refreshed before Manager packet construction.';
  end if;

  if not exists (
    select 1 from jsonb_array_elements(v_snapshot -> 'operatingFacts') as item
    where item ->> 'factKey' = 'money.current_budget'
      and item ->> 'displayValue' = '₦150,000'
  ) then
    raise exception 'Fresh canonical operating fact is missing from Manager state.';
  end if;

  if exists (
    select 1 from jsonb_array_elements(v_snapshot -> 'activeTasks') as item
    where item ->> 'id' = v_task_old::text
  ) then
    raise exception 'Superseded old-plan Task leaked into canonical active work.';
  end if;

  if not exists (
    select 1 from jsonb_array_elements(v_snapshot -> 'activeTasks') as item
    where item ->> 'id' = v_task_current::text
  ) then
    raise exception 'Current-plan executable Task is missing from canonical state.';
  end if;

  if not exists (
    select 1 from jsonb_array_elements(v_snapshot -> 'decisions') as item
    where item ->> 'id' = v_permission::text
      and item ->> 'status' = 'rejected'
  ) then
    raise exception 'Rejected decision is not preserved in canonical Manager state.';
  end if;

  insert into public.reviews (
    id, account_id, artist_workspace_id, artist_id, mission_id, checkpoint_id,
    trigger_type, trigger_object_type, trigger_object_id, status, review_at
  ) values (
    v_review, v_account, v_workspace, v_artist, v_mission, v_checkpoint_current,
    'adaptive_replan', 'task', v_task_current, 'running', now()
  );

  insert into public.manager_synthesis_runs (
    id, account_id, artist_workspace_id, artist_id, trigger_type, mission_id,
    status, classification, confidence, context_payload, steps_payload, action_plan, limitations, started_at
  ) values (
    v_run, v_account, v_workspace, v_artist, 'review', v_mission,
    'running', 'adaptive_plan_compiler_v1', 'unknown', '{}'::jsonb, '[]'::jsonb, '[]'::jsonb, '{}'::text[], now()
  );

  begin
    perform public.persist_manager_question_request_v1(
      v_review,
      v_run,
      jsonb_build_object(
        'key', 'current_budget',
        'question', 'What budget do you have?',
        'reason', 'Budget changes the route.',
        'answerKind', 'short_text',
        'options', jsonb_build_array(),
        'hypothesis', 'Use current budget.',
        'fallbackIfNo', 'Use no-spend route.',
        'factDomain', 'money',
        'factKey', 'money.current_budget',
        'factScopeType', 'artist',
        'factScopeKey', 'artist',
        'validForHours', 168
      )
    );
    raise exception 'Known fresh fact was allowed to become a repeated question.';
  exception
    when others then
      if position('canonical fact is already known and fresh' in sqlerrm) = 0 then
        raise;
      end if;
  end;

  select count(*) into v_question_count
  from public.manager_question_requests
  where artist_workspace_id = v_workspace
    and fact_key = 'money.current_budget'
    and fact_scope_key = 'artist';

  if v_question_count <> 0 then
    raise exception 'Known fact still persisted % repeated question(s).', v_question_count;
  end if;
end;
$$;

rollback;

-- Guard the generic truth topology itself.
do $$
begin
  if to_regprocedure('public.manager_canonical_state_snapshot_v1(uuid,uuid,uuid)') is null then
    raise exception 'manager_canonical_state_snapshot_v1 is missing';
  end if;
  if to_regprocedure('public.reject_known_manager_question_v1()') is null then
    raise exception 'known-fact question guard is missing';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'reject_known_manager_question' and not tgisinternal) then
    raise exception 'known-fact question guard trigger is missing';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'zz_refresh_manager_canonical_state_memory' and not tgisinternal) then
    raise exception 'canonical conversation snapshot trigger is missing';
  end if;
end;
$$;
