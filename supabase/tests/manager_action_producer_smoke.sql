-- Gate 4 capability smoke: canonical readiness is necessary but never sufficient.
-- Only an explicit typed Manager preparation intent may create the frozen approval
-- transaction; approval then claims one receipt and a real terminal outcome wakes
-- the Manager continuation runtime.

begin;

do $$
declare
  v_account_id uuid := gen_random_uuid();
  v_actor_id uuid := gen_random_uuid();
  v_artist_id uuid := gen_random_uuid();
  v_workspace_id uuid := gen_random_uuid();
  v_conversation_id uuid := gen_random_uuid();
  v_mission_id uuid := gen_random_uuid();
  v_plan_id uuid := gen_random_uuid();
  v_checkpoint_id uuid := gen_random_uuid();
  v_task_id uuid := gen_random_uuid();
  v_music_item_id uuid := gen_random_uuid();
  v_split_id uuid := gen_random_uuid();
  v_run_id uuid := gen_random_uuid();
  v_intent_action_id uuid := gen_random_uuid();
  v_replay_intent_action_id uuid := gen_random_uuid();
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
  values (v_account_id, 'Manager explicit action intent smoke', 'active');

  insert into public.users (id, email, display_name, status)
  values (v_actor_id, 'manager-action-intent-smoke@example.com', 'Smoke Owner', 'active');

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
    'Desk validates canonical state, prepares the exact approval, and executes only after approval.',
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

  -- Canonical readiness alone must never authorize external outreach.
  if exists (
    select 1 from public.permission_requests as permission
    where permission.parameters ->> 'splitId' = v_split_id::text
  ) then
    raise exception 'Ready split created an external-action permission without explicit Manager intent.';
  end if;

  -- Ordinary canonical edits must also remain side-effect free.
  update public.music_split_contributors as contributor
  set email = contributor.email
  where contributor.music_split_id = v_split_id;

  update public.tasks set status = 'in_progress' where id = v_task_id;
  update public.missions set status = 'review' where id = v_mission_id;
  update public.missions set status = 'active' where id = v_mission_id;

  if exists (
    select 1 from public.permission_requests as permission
    where permission.parameters ->> 'splitId' = v_split_id::text
  ) then
    raise exception 'Canonical split/task/mission changes still behave like external-action intent.';
  end if;

  insert into public.conversations (
    id, account_id, artist_workspace_id, artist_id,
    topic, status, linked_mission_id
  ) values (
    v_conversation_id, v_account_id, v_workspace_id, v_artist_id,
    'Smoke Song workspace', 'active', v_mission_id
  );

  insert into public.manager_synthesis_runs (
    id, account_id, artist_workspace_id, artist_id,
    trigger_type, conversation_id, mission_id, status,
    classification, confidence, context_payload, steps_payload,
    action_plan, limitations, started_at
  ) values (
    v_run_id, v_account_id, v_workspace_id, v_artist_id,
    'conversation', v_conversation_id, v_mission_id, 'running',
    'manager_conversation_router_v1', 'high',
    jsonb_build_object(
      'scope', jsonb_build_object(
        'accountId', v_account_id,
        'artistWorkspaceId', v_workspace_id,
        'artistId', v_artist_id,
        'conversationId', v_conversation_id,
        'musicSubject', jsonb_build_object('type', 'music_item', 'id', v_music_item_id)
      )
    ),
    '[]'::jsonb, '[]'::jsonb, '{}'::text[], now()
  );

  -- This is the explicit machine-readable Manager command. It prepares review;
  -- it is not itself the external send and therefore does not require approval.
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
      'body', 'Prepare the current split for collaborator confirmation.',
      'approvalRequired', false
    ),
    '{}'::jsonb
  );

  if not exists (
    select 1 from public.manager_run_actions as intent
    where intent.id = v_intent_action_id
      and intent.status = 'applied'
      and intent.target_type = 'music_item'
      and intent.target_id = v_music_item_id
      and intent.result_payload ->> 'status' = 'prepared'
  ) then
    raise exception 'Explicit Manager intent was not safely resolved to the canonical focused song.';
  end if;

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
    raise exception 'Explicit Manager intent did not create an exact approval transaction.';
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
    raise exception 'Prepared permission is not bound to the exact frozen executable effect.';
  end if;

  -- A second Manager turn may reach the same conclusion. Exact-effect dedupe must
  -- bind that intent to the existing permission rather than create another send.
  insert into public.manager_run_actions (
    id, account_id, artist_workspace_id, artist_id,
    manager_synthesis_run_id, order_index, action_type, target_type,
    status, approval_required, payload, result_payload
  ) values (
    v_replay_intent_action_id, v_account_id, v_workspace_id, v_artist_id,
    v_run_id, 1, 'prepare_split_confirmations_for_approval', 'focused_music_item',
    'pending', false,
    jsonb_build_object(
      'actionType', 'prepare_split_confirmations_for_approval',
      'targetType', 'focused_music_item',
      'title', 'Prepare split confirmations',
      'body', 'Prepare the current split for collaborator confirmation.',
      'approvalRequired', false
    ),
    '{}'::jsonb
  );

  if not exists (
    select 1 from public.manager_run_actions as intent
    where intent.id = v_replay_intent_action_id
      and intent.status = 'applied'
      and intent.result_payload ->> 'status' = 'replayed'
      and nullif(intent.result_payload ->> 'permissionId', '')::uuid = v_permission_id
  ) then
    raise exception 'Repeated explicit intent did not replay the exact existing permission.';
  end if;

  select count(*) into v_permission_count
  from public.permission_requests as permission
  where permission.parameters ->> 'actionKind' = 'send_split_confirmations'
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
end;
$$;

rollback;

-- Guard the authorization topology separately from fixture behavior.
do $$
begin
  if to_regprocedure('public.prepare_manager_split_confirmation_intent_v1(uuid)') is null then
    raise exception 'explicit Manager split intent function is missing';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'prepare_split_permission_from_manager_intent'
      and not tgisinternal
  ) then
    raise exception 'explicit Manager intent trigger is missing';
  end if;

  if exists (select 1 from pg_trigger where tgname = 'produce_split_permission_from_split' and not tgisinternal) then
    raise exception 'unsafe split-readiness producer trigger still exists';
  end if;

  if exists (select 1 from pg_trigger where tgname = 'produce_split_permission_from_contributor' and not tgisinternal) then
    raise exception 'unsafe contributor-readiness producer trigger still exists';
  end if;

  if exists (select 1 from pg_trigger where tgname = 'produce_split_permission_from_task' and not tgisinternal) then
    raise exception 'unsafe Task-currentness producer trigger still exists';
  end if;

  if exists (select 1 from pg_trigger where tgname = 'produce_split_permission_from_mission' and not tgisinternal) then
    raise exception 'unsafe Mission-plan producer trigger still exists';
  end if;

  if to_regprocedure('public.maybe_prepare_split_confirmation_permission_v1(uuid)') is not null then
    raise exception 'legacy readiness-driven split permission function is still callable';
  end if;
end;
$$;
