-- Gate 4 capability smoke: canonical split readiness -> exact permission ->
-- approve once -> one execution receipt -> persisted outcome -> adaptive continuation.

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
  v_permission_id uuid;
  v_action_id uuid;
  v_receipt_id uuid;
  v_resolution jsonb;
  v_replay jsonb;
  v_completion jsonb;
  v_permission_count integer;
  v_receipt_count integer;
begin
  insert into public.accounts (id, name, status)
  values (v_account_id, 'Manager action producer smoke', 'active');

  insert into public.users (id, email, display_name, status)
  values (v_actor_id, 'manager-action-producer-smoke@example.com', 'Smoke Owner', 'active');

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
    'Clear collaborator splits', 'Confirm the current split with collaborators.', 'active', 1
  );

  insert into public.mission_plan_versions (
    id, account_id, artist_workspace_id, artist_id,
    mission_id, version, status, summary
  ) values (
    v_plan_id, v_account_id, v_workspace_id, v_artist_id,
    v_mission_id, 1, 'active', 'Clear the split and continue the release work.'
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
    'Have the collaborators received the exact agreed split?'
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
    'Make the agreed collaborator shares ready for formal confirmation.',
    'The split totals 100% and every collaborator has a valid email.',
    'Desk validates the exact effect and prepares the confirmation send.',
    'Provide or correct collaborator shares and email addresses.',
    'The release can carry unresolved rights/admin risk.'
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

  -- The first contributor is not a sendable exact effect yet.
  insert into public.music_split_contributors (
    account_id, artist_workspace_id, artist_id, music_split_id,
    name, role, email, publishing_share, master_share, approval_status
  ) values (
    v_account_id, v_workspace_id, v_artist_id, v_split_id,
    'Artist', 'Primary artist', 'artist@example.com', 50, 50, 'draft'
  );

  if exists (
    select 1 from public.permission_requests as permission
    where permission.parameters ->> 'splitId' = v_split_id::text
  ) then
    raise exception 'Producer created a permission before the split was canonically ready.';
  end if;

  -- This transition makes the exact effect ready. The trigger must create the
  -- permission transaction without another Manager/model prompt.
  insert into public.music_split_contributors (
    account_id, artist_workspace_id, artist_id, music_split_id,
    name, role, email, publishing_share, master_share, approval_status
  ) values (
    v_account_id, v_workspace_id, v_artist_id, v_split_id,
    'Producer', 'Producer', 'producer@example.com', 50, 50, 'draft'
  );

  select permission.id, permission.created_from_action_id
  into v_permission_id, v_action_id
  from public.permission_requests as permission
  where permission.mission_id = v_mission_id
    and permission.status = 'pending'
    and permission.parameters ->> 'actionKind' = 'send_split_confirmations'
    and permission.parameters ->> 'splitId' = v_split_id::text
    and permission.parameters ->> 'musicItemId' = v_music_item_id::text
  order by permission.created_at desc
  limit 1;

  if v_permission_id is null or v_action_id is null then
    raise exception 'Canonically ready split did not produce an exact approval transaction.';
  end if;

  if not exists (
    select 1
    from public.permission_requests as permission
    join public.manager_run_actions as action on action.id = permission.created_from_action_id
    where permission.id = v_permission_id
      and permission.parameters = action.payload
      and coalesce((permission.parameters ->> 'executable')::boolean, false)
      and jsonb_array_length(permission.parameters -> 'recipients') = 2
      and action.action_type = 'send_split_confirmations'
      and action.target_type = 'music_item'
      and action.target_id = v_music_item_id
      and action.status = 'approval_required'
      and action.approval_required
  ) then
    raise exception 'Produced permission is not bound to the exact frozen executable effect.';
  end if;

  -- Re-firing readiness with the exact same shares/addresses must replay the
  -- existing permission instead of creating a second external action.
  update public.music_split_contributors as contributor
  set email = contributor.email
  where contributor.music_split_id = v_split_id;

  select count(*) into v_permission_count
  from public.permission_requests as permission
  where permission.mission_id = v_mission_id
    and permission.parameters ->> 'actionKind' = 'send_split_confirmations'
    and permission.parameters ->> 'splitId' = v_split_id::text;

  if v_permission_count <> 1 then
    raise exception 'Exact split effect produced % permissions instead of one.', v_permission_count;
  end if;

  v_resolution := public.resolve_manager_permission_v1(v_permission_id, v_actor_id, 'approve', null);

  if coalesce((v_resolution ->> 'shouldExecute')::boolean, false) is not true
     or v_resolution ->> 'executionStatus' <> 'claimed' then
    raise exception 'First approval did not claim exactly one executable receipt: %', v_resolution;
  end if;

  v_receipt_id := nullif(v_resolution ->> 'executionReceiptId', '')::uuid;
  if v_receipt_id is null then
    raise exception 'Approval did not return an execution receipt.';
  end if;

  v_replay := public.resolve_manager_permission_v1(v_permission_id, v_actor_id, 'approve', null);

  if coalesce((v_replay ->> 'shouldExecute')::boolean, false)
     or nullif(v_replay ->> 'executionReceiptId', '')::uuid <> v_receipt_id
     or coalesce((v_replay ->> 'replayed')::boolean, false) is not true then
    raise exception 'Approval replay was not safely deduplicated: %', v_replay;
  end if;

  select count(*) into v_receipt_count
  from public.manager_action_execution_receipts as receipt
  where receipt.permission_request_id = v_permission_id;

  if v_receipt_count <> 1 then
    raise exception 'Approval produced % execution receipts instead of one.', v_receipt_count;
  end if;

  v_completion := public.complete_manager_action_execution_v1(
    v_receipt_id,
    jsonb_build_object(
      'provider', 'resend',
      'sent', 2,
      'failed', 0,
      'messageIds', jsonb_build_array('smoke-message-1', 'smoke-message-2')
    )
  );

  if v_completion ->> 'status' <> 'succeeded' then
    raise exception 'Execution outcome was not persisted as succeeded: %', v_completion;
  end if;

  if not exists (
    select 1
    from public.manager_action_execution_receipts as receipt
    join public.manager_run_actions as action on action.id = receipt.manager_run_action_id
    where receipt.id = v_receipt_id
      and receipt.status = 'succeeded'
      and action.id = v_action_id
      and action.status = 'applied'
  ) then
    raise exception 'Successful real-world outcome did not advance receipt/action state.';
  end if;

  if not exists (
    select 1
    from public.operating_events as event
    where event.event_type = 'manager_external_action_executed'
      and event.manager_run_action_id = v_action_id
  ) then
    raise exception 'Successful execution event is missing.';
  end if;

  if not exists (
    select 1
    from public.reviews as review
    where review.mission_id = v_mission_id
      and review.trigger_type = 'adaptive_replan'
      and review.trigger_object_type = 'manager_run_action'
      and review.trigger_object_id = v_action_id
      and review.status = 'due'
      and review.runtime_key = 'permission:' || v_permission_id::text || ':execution-succeeded'
  ) then
    raise exception 'Execution outcome did not queue automatic Manager continuation.';
  end if;

  if not exists (
    select 1
    from public.manager_synthesis_runs as run
    where run.mission_id = v_mission_id
      and run.classification = 'deterministic_external_action_producer_v1'
      and run.status = 'completed'
      and run.action_plan <> '[]'::jsonb
  ) then
    raise exception 'Deterministic action producer audit run was not completed.';
  end if;
end;
$$;

rollback;

-- Guard the trigger/function topology separately from the fixture behavior.
do $$
begin
  if to_regprocedure('public.maybe_prepare_split_confirmation_permission_v1(uuid)') is null then
    raise exception 'maybe_prepare_split_confirmation_permission_v1 is missing';
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'produce_split_permission_from_split' and not tgisinternal) then
    raise exception 'split readiness producer trigger is missing';
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'produce_split_permission_from_contributor' and not tgisinternal) then
    raise exception 'contributor readiness producer trigger is missing';
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'produce_split_permission_from_task' and not tgisinternal) then
    raise exception 'Task-currentness producer trigger is missing';
  end if;

  if not exists (select 1 from pg_trigger where tgname = 'produce_split_permission_from_mission' and not tgisinternal) then
    raise exception 'Mission-plan activation producer trigger is missing';
  end if;
end;
$$;
