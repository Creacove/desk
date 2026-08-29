-- Gate 4 capability smoke: canonical split readiness -> exact permission ->
-- approve once -> one execution receipt -> persisted outcome -> adaptive continuation.

begin;

do $$
declare
  account_id uuid := gen_random_uuid();
  actor_id uuid := gen_random_uuid();
  artist_id uuid := gen_random_uuid();
  workspace_id uuid := gen_random_uuid();
  mission_id uuid := gen_random_uuid();
  plan_id uuid := gen_random_uuid();
  checkpoint_id uuid := gen_random_uuid();
  task_id uuid := gen_random_uuid();
  music_item_id uuid := gen_random_uuid();
  split_id uuid := gen_random_uuid();
  permission_id uuid;
  action_id uuid;
  receipt_id uuid;
  resolution jsonb;
  replay jsonb;
  completion jsonb;
  permission_count integer;
  receipt_count integer;
begin
  insert into public.accounts (id, name, status)
  values (account_id, 'Manager action producer smoke', 'active');

  insert into public.users (id, email, display_name, status)
  values (actor_id, 'manager-action-producer-smoke@example.com', 'Smoke Owner', 'active');

  insert into public.account_memberships (account_id, user_id, role, status)
  values (account_id, actor_id, 'owner', 'active');

  insert into public.artists (id, account_id, display_name)
  values (artist_id, account_id, 'Smoke Artist');

  insert into public.artist_workspaces (id, account_id, artist_id, name, status)
  values (workspace_id, account_id, artist_id, 'Smoke Workspace', 'active');

  insert into public.missions (
    id, account_id, artist_workspace_id, artist_id,
    title, objective, status, priority
  ) values (
    mission_id, account_id, workspace_id, artist_id,
    'Clear collaborator splits', 'Confirm the current split with collaborators.', 'active', 1
  );

  insert into public.mission_plan_versions (
    id, account_id, artist_workspace_id, artist_id,
    mission_id, version, status, summary
  ) values (
    plan_id, account_id, workspace_id, artist_id,
    mission_id, 1, 'active', 'Clear the split and continue the release work.'
  );

  update public.missions
  set active_plan_version_id = plan_id
  where id = mission_id;

  insert into public.checkpoints (
    id, account_id, artist_workspace_id, artist_id,
    mission_id, mission_plan_version_id, title, status, question
  ) values (
    checkpoint_id, account_id, workspace_id, artist_id,
    mission_id, plan_id, 'Split confirmations', 'waiting',
    'Have the collaborators received the exact agreed split?'
  );

  insert into public.tasks (
    id, account_id, artist_workspace_id, artist_id, scope,
    mission_id, mission_plan_version_id, primary_checkpoint_id,
    title, owner_role, work_mode, priority, status, approval_state,
    purpose, completion_expectation, manager_responsibility,
    user_responsibility, risk_if_late
  ) values (
    task_id, account_id, workspace_id, artist_id, 'mission',
    mission_id, plan_id, checkpoint_id,
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
    music_item_id, account_id, workspace_id, artist_id,
    'Smoke Song', 'song', 'ready', 'active'
  );

  insert into public.music_splits (
    id, account_id, artist_workspace_id, artist_id,
    music_item_id, status, linked_task_id, summary
  ) values (
    split_id, account_id, workspace_id, artist_id,
    music_item_id, 'draft', task_id, 'Two-way agreed split'
  );

  -- The first contributor is not a sendable exact effect yet.
  insert into public.music_split_contributors (
    account_id, artist_workspace_id, artist_id, music_split_id,
    name, role, email, publishing_share, master_share, approval_status
  ) values (
    account_id, workspace_id, artist_id, split_id,
    'Artist', 'Primary artist', 'artist@example.com', 50, 50, 'draft'
  );

  if exists (
    select 1 from public.permission_requests
    where parameters ->> 'splitId' = split_id::text
  ) then
    raise exception 'Producer created a permission before the split was canonically ready.';
  end if;

  -- This transition makes the exact effect ready. The trigger must create the
  -- permission transaction without another Manager/model prompt.
  insert into public.music_split_contributors (
    account_id, artist_workspace_id, artist_id, music_split_id,
    name, role, email, publishing_share, master_share, approval_status
  ) values (
    account_id, workspace_id, artist_id, split_id,
    'Producer', 'Producer', 'producer@example.com', 50, 50, 'draft'
  );

  select permission.id, permission.created_from_action_id
  into permission_id, action_id
  from public.permission_requests as permission
  where permission.mission_id = mission_id
    and permission.status = 'pending'
    and permission.parameters ->> 'actionKind' = 'send_split_confirmations'
    and permission.parameters ->> 'splitId' = split_id::text
    and permission.parameters ->> 'musicItemId' = music_item_id::text
  order by permission.created_at desc
  limit 1;

  if permission_id is null or action_id is null then
    raise exception 'Canonically ready split did not produce an exact approval transaction.';
  end if;

  if not exists (
    select 1
    from public.permission_requests as permission
    join public.manager_run_actions as action on action.id = permission.created_from_action_id
    where permission.id = permission_id
      and permission.parameters = action.payload
      and coalesce((permission.parameters ->> 'executable')::boolean, false)
      and jsonb_array_length(permission.parameters -> 'recipients') = 2
      and action.action_type = 'send_split_confirmations'
      and action.target_type = 'music_item'
      and action.target_id = music_item_id
      and action.status = 'approval_required'
      and action.approval_required
  ) then
    raise exception 'Produced permission is not bound to the exact frozen executable effect.';
  end if;

  -- Re-firing readiness with the exact same shares/addresses must replay the
  -- existing permission instead of creating a second external action.
  update public.music_split_contributors
  set email = email
  where music_split_id = split_id;

  select count(*) into permission_count
  from public.permission_requests
  where mission_id = mission_id
    and parameters ->> 'actionKind' = 'send_split_confirmations'
    and parameters ->> 'splitId' = split_id::text;

  if permission_count <> 1 then
    raise exception 'Exact split effect produced % permissions instead of one.', permission_count;
  end if;

  resolution := public.resolve_manager_permission_v1(permission_id, actor_id, 'approve', null);

  if coalesce((resolution ->> 'shouldExecute')::boolean, false) is not true
     or resolution ->> 'executionStatus' <> 'claimed' then
    raise exception 'First approval did not claim exactly one executable receipt: %', resolution;
  end if;

  receipt_id := nullif(resolution ->> 'executionReceiptId', '')::uuid;
  if receipt_id is null then
    raise exception 'Approval did not return an execution receipt.';
  end if;

  replay := public.resolve_manager_permission_v1(permission_id, actor_id, 'approve', null);

  if coalesce((replay ->> 'shouldExecute')::boolean, false)
     or nullif(replay ->> 'executionReceiptId', '')::uuid <> receipt_id
     or coalesce((replay ->> 'replayed')::boolean, false) is not true then
    raise exception 'Approval replay was not safely deduplicated: %', replay;
  end if;

  select count(*) into receipt_count
  from public.manager_action_execution_receipts
  where permission_request_id = permission_id;

  if receipt_count <> 1 then
    raise exception 'Approval produced % execution receipts instead of one.', receipt_count;
  end if;

  completion := public.complete_manager_action_execution_v1(
    receipt_id,
    jsonb_build_object(
      'provider', 'resend',
      'sent', 2,
      'failed', 0,
      'messageIds', jsonb_build_array('smoke-message-1', 'smoke-message-2')
    )
  );

  if completion ->> 'status' <> 'succeeded' then
    raise exception 'Execution outcome was not persisted as succeeded: %', completion;
  end if;

  if not exists (
    select 1
    from public.manager_action_execution_receipts as receipt
    join public.manager_run_actions as action on action.id = receipt.manager_run_action_id
    where receipt.id = receipt_id
      and receipt.status = 'succeeded'
      and action.id = action_id
      and action.status = 'applied'
  ) then
    raise exception 'Successful real-world outcome did not advance receipt/action state.';
  end if;

  if not exists (
    select 1
    from public.operating_events
    where event_type = 'manager_external_action_executed'
      and manager_run_action_id = action_id
  ) then
    raise exception 'Successful execution event is missing.';
  end if;

  if not exists (
    select 1
    from public.reviews
    where mission_id = mission_id
      and trigger_type = 'adaptive_replan'
      and trigger_object_type = 'manager_run_action'
      and trigger_object_id = action_id
      and status = 'due'
      and runtime_key = 'permission:' || permission_id::text || ':execution-succeeded'
  ) then
    raise exception 'Execution outcome did not queue automatic Manager continuation.';
  end if;

  if not exists (
    select 1
    from public.manager_synthesis_runs
    where mission_id = mission_id
      and classification = 'deterministic_external_action_producer_v1'
      and status = 'completed'
      and action_plan <> '[]'::jsonb
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
