-- Gate 4 autonomy smoke: ready canonical state may wake the Manager, but it may
-- only queue a bounded candidate. A permission exists only after an explicit
-- Manager decision is persisted as the typed preparation intent.

begin;

do $$
declare
  v_account_id uuid := gen_random_uuid();
  v_actor_id uuid := gen_random_uuid();
  v_artist_id uuid := gen_random_uuid();
  v_workspace_id uuid := gen_random_uuid();
  v_mission_id uuid := gen_random_uuid();
  v_plan_id uuid := gen_random_uuid();
  v_checkpoint_id uuid := gen_random_uuid();
  v_task_id uuid := gen_random_uuid();
  v_music_item_id uuid := gen_random_uuid();
  v_split_id uuid := gen_random_uuid();
  v_candidate_id uuid;
  v_run_id uuid := gen_random_uuid();
  v_intent_action_id uuid := gen_random_uuid();
  v_permission_id uuid;
  v_candidate_count integer;
  v_claim record;
begin
  insert into public.accounts (id, name, status)
  values (v_account_id, 'Manager candidate smoke', 'active');

  insert into public.users (id, email, display_name, status)
  values (v_actor_id, 'manager-candidate-smoke@example.com', 'Smoke Owner', 'active');

  insert into public.account_memberships (account_id, user_id, role, status)
  values (v_account_id, v_actor_id, 'owner', 'active');

  insert into public.artists (id, account_id, display_name)
  values (v_artist_id, v_account_id, 'Smoke Artist');

  insert into public.artist_workspaces (id, account_id, artist_id, name, status)
  values (v_workspace_id, v_account_id, v_artist_id, 'Smoke Workspace', 'active');

  insert into public.missions (
    id, account_id, artist_workspace_id, artist_id,
    title, objective, status, priority
  ) values (
    v_mission_id, v_account_id, v_workspace_id, v_artist_id,
    'Clear collaborator splits', 'Confirm the agreed split with collaborators.', 'active', 1
  );

  insert into public.mission_plan_versions (
    id, account_id, artist_workspace_id, artist_id,
    mission_id, version, status, summary
  ) values (
    v_plan_id, v_account_id, v_workspace_id, v_artist_id,
    v_mission_id, 1, 'active', 'Clear the split before downstream release work.'
  );

  update public.missions
  set active_plan_version_id = v_plan_id
  where id = v_mission_id;

  insert into public.checkpoints (
    id, account_id, artist_workspace_id, artist_id,
    mission_id, mission_plan_version_id, title, status, question
  ) values (
    v_checkpoint_id, v_account_id, v_workspace_id, v_artist_id,
    v_mission_id, v_plan_id, 'Split confirmations', 'waiting',
    'Have collaborators received the agreed split?'
  );

  insert into public.tasks (
    id, account_id, artist_workspace_id, artist_id, scope,
    mission_id, mission_plan_version_id, primary_checkpoint_id,
    title, owner_role, work_mode, priority, status, approval_state,
    purpose, completion_expectation, manager_responsibility,
    user_responsibility, risk_if_late
  ) values (
    v_task_id, v_account_id, v_workspace_id, v_artist_id, 'mission',
    v_mission_id, v_plan_id, v_checkpoint_id,
    'Confirm the agreed split', 'Artist / team', 'artist_action', 1, 'open', 'not_required',
    'Make the collaborator shares ready for formal confirmation.',
    'Shares total 100% and every collaborator has a valid email.',
    'Desk decides when confirmation should be prepared and requests approval before sending.',
    'Correct collaborator shares or email addresses when needed.',
    'Unresolved splits can block downstream release administration.'
  );

  insert into public.music_items (
    id, account_id, artist_workspace_id, artist_id,
    title, item_type, lifecycle_stage, status
  ) values (
    v_music_item_id, v_account_id, v_workspace_id, v_artist_id,
    'Smoke Song', 'song', 'ready', 'active'
  );

  insert into public.music_splits (
    id, account_id, artist_workspace_id, artist_id,
    music_item_id, status, linked_task_id, summary
  ) values (
    v_split_id, v_account_id, v_workspace_id, v_artist_id,
    v_music_item_id, 'draft', v_task_id, 'Two-way agreed split'
  );

  insert into public.music_split_contributors (
    account_id, artist_workspace_id, artist_id, music_split_id,
    name, role, email, publishing_share, master_share, approval_status
  ) values
  (
    v_account_id, v_workspace_id, v_artist_id, v_split_id,
    'Artist', 'Primary artist', 'artist@example.com', 50, 50, 'draft'
  ),
  (
    v_account_id, v_workspace_id, v_artist_id, v_split_id,
    'Producer', 'Producer', 'producer@example.com', 50, 50, 'draft'
  );

  select candidate.id into v_candidate_id
  from public.manager_action_candidates as candidate
  where candidate.account_id = v_account_id
    and candidate.artist_workspace_id = v_workspace_id
    and candidate.artist_id = v_artist_id
    and candidate.mission_id = v_mission_id
    and candidate.action_kind = 'prepare_split_confirmations_for_approval'
    and candidate.target_type = 'music_item'
    and candidate.target_id = v_music_item_id
    and candidate.status = 'due'
  order by candidate.created_at desc
  limit 1;

  if v_candidate_id is null then
    raise exception 'Ready canonical split did not queue a bounded Manager action candidate.';
  end if;

  if exists (
    select 1 from public.permission_requests as permission
    where permission.account_id = v_account_id
      and permission.parameters ->> 'splitId' = v_split_id::text
  ) then
    raise exception 'Candidate wake-up directly created an external-action permission.';
  end if;

  if exists (
    select 1 from public.manager_action_candidates as candidate
    where candidate.id = v_candidate_id
      and (
        candidate.context_payload ? 'splitId'
        or candidate.context_payload ? 'recipients'
        or candidate.context_payload ? 'emails'
        or candidate.context_payload ? 'shares'
      )
  ) then
    raise exception 'Bounded Manager candidate leaked executable target details into model context.';
  end if;

  -- A no-op canonical edit must replay the same exact candidate, not multiply it.
  update public.music_split_contributors as contributor
  set email = contributor.email
  where contributor.music_split_id = v_split_id;

  select count(*) into v_candidate_count
  from public.manager_action_candidates as candidate
  where candidate.account_id = v_account_id
    and candidate.artist_workspace_id = v_workspace_id
    and candidate.action_kind = 'prepare_split_confirmations_for_approval'
    and candidate.target_id = v_music_item_id;

  if v_candidate_count <> 1 then
    raise exception 'Exact canonical effect queued % Manager candidates instead of one.', v_candidate_count;
  end if;

  select * into v_claim
  from public.claim_manager_action_candidate_v1(v_candidate_id);

  if v_claim.id is null or v_claim.attempt_count <> 1 then
    raise exception 'Manager action candidate could not be claimed exactly once.';
  end if;

  if exists (
    select 1 from public.claim_manager_action_candidate_v1(v_candidate_id)
  ) then
    raise exception 'Already-running Manager action candidate was claimed twice.';
  end if;

  insert into public.manager_synthesis_runs (
    id, account_id, artist_workspace_id, artist_id,
    trigger_type, mission_id, status, classification, confidence,
    context_payload, steps_payload, action_plan, limitations, started_at
  ) values (
    v_run_id, v_account_id, v_workspace_id, v_artist_id,
    'review', v_mission_id, 'running', 'manager_external_action_decider_v1', 'unknown',
    jsonb_build_object(
      'scope', jsonb_build_object(
        'accountId', v_account_id,
        'artistWorkspaceId', v_workspace_id,
        'artistId', v_artist_id,
        'musicSubject', jsonb_build_object('type', 'music_item', 'id', v_music_item_id)
      ),
      'externalActionDecision', jsonb_build_object('candidateId', v_candidate_id)
    ),
    jsonb_build_array(
      jsonb_build_object('step', 'candidate_claimed', 'status', 'completed'),
      jsonb_build_object('step', 'manager_action_decided', 'status', 'completed')
    ),
    '[]'::jsonb, '{}'::text[], now()
  );

  -- Simulate the bounded AI Manager choosing PREPARE. This is the first moment
  -- authorization to create an approval transaction exists.
  insert into public.manager_run_actions (
    id, account_id, artist_workspace_id, artist_id,
    manager_synthesis_run_id, order_index, action_type, target_type,
    status, approval_required, payload, result_payload
  ) values (
    v_intent_action_id, v_account_id, v_workspace_id, v_artist_id,
    v_run_id, 0, 'prepare_split_confirmations_for_approval', 'focused_music_item',
    'pending', false,
    jsonb_build_object(
      'actionType', 'prepare_split_confirmations_for_approval',
      'targetType', 'focused_music_item',
      'title', 'Prepare split confirmations',
      'body', 'The agreed split is ready and confirmation is the next management move.',
      'approvalRequired', false
    ),
    '{}'::jsonb
  );

  if not exists (
    select 1 from public.manager_run_actions as action
    where action.id = v_intent_action_id
      and action.status = 'applied'
      and action.target_type = 'music_item'
      and action.target_id = v_music_item_id
      and action.result_payload ->> 'status' = 'prepared'
  ) then
    raise exception 'Explicit bounded Manager decision did not resolve to the canonical typed preparation.';
  end if;

  select permission.id into v_permission_id
  from public.permission_requests as permission
  where permission.account_id = v_account_id
    and permission.mission_id = v_mission_id
    and permission.parameters ->> 'actionKind' = 'send_split_confirmations'
    and permission.parameters ->> 'splitId' = v_split_id::text
    and permission.status = 'pending'
  order by permission.created_at desc
  limit 1;

  if v_permission_id is null then
    raise exception 'Manager PREPARE decision did not create the frozen artist approval transaction.';
  end if;

  perform public.complete_manager_action_candidate_v1(
    v_candidate_id,
    v_run_id,
    'prepare',
    'The agreed split is ready and confirmation is the next management move.'
  );

  if not exists (
    select 1 from public.manager_action_candidates as candidate
    where candidate.id = v_candidate_id
      and candidate.status = 'completed'
      and candidate.decision = 'prepare'
      and candidate.manager_synthesis_run_id = v_run_id
  ) then
    raise exception 'Manager external-action decision was not durably completed.';
  end if;

  if not exists (
    select 1 from public.manager_synthesis_runs as run
    where run.id = v_run_id
      and run.status = 'completed'
  ) then
    raise exception 'Manager external-action decision run did not complete.';
  end if;
end;
$$;

rollback;

do $$
begin
  if to_regclass('public.manager_action_candidates') is null then
    raise exception 'manager_action_candidates table is missing';
  end if;

  if to_regprocedure('public.claim_manager_action_candidate_v1(uuid)') is null then
    raise exception 'candidate claim RPC is missing';
  end if;

  if to_regprocedure('public.queue_split_confirmation_manager_candidate_v1(uuid)') is null then
    raise exception 'split candidate producer is missing';
  end if;

  if to_regprocedure('public.complete_manager_action_candidate_v1(uuid,uuid,text,text)') is null then
    raise exception 'candidate completion RPC is missing';
  end if;

  if not exists (
    select 1 from cron.job
    where jobname = 'manager-action-candidate-recovery'
  ) then
    raise exception 'Manager action candidate recovery cron is missing';
  end if;
end;
$$;
