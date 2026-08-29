-- Bind human approval to one immutable Manager action, record execution separately,
-- and re-enter the existing Manager runtime after approval/rejection/execution.
--
-- This intentionally does not make legacy prose permissions executable. Legacy
-- requests are rebound to prepared_external_action rows so approval can never be
-- mistaken for completion. The first supported executable effect is sending an
-- already-prepared music split to its frozen collaborator recipient set.

alter table public.permission_requests
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by_user_id uuid,
  add column if not exists decision_note text;

create table if not exists public.manager_action_execution_receipts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  manager_run_action_id uuid not null references public.manager_run_actions(id) on delete cascade,
  permission_request_id uuid not null references public.permission_requests(id) on delete cascade,
  execution_key text not null,
  status text not null default 'claimed' check (status in ('claimed', 'succeeded', 'failed', 'indeterminate')),
  provider text,
  request_payload jsonb not null default '{}'::jsonb,
  result_payload jsonb not null default '{}'::jsonb,
  error text,
  claimed_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (manager_run_action_id),
  unique (permission_request_id),
  unique (execution_key)
);

create index if not exists manager_action_execution_receipts_status_idx
  on public.manager_action_execution_receipts (status, claimed_at, id);

alter table public.music_split_confirmations
  add column if not exists provider_message_id text,
  add column if not exists manager_action_execution_id uuid references public.manager_action_execution_receipts(id) on delete set null;

alter table public.manager_action_execution_receipts enable row level security;

drop policy if exists manager_action_execution_receipts_account_members_select
  on public.manager_action_execution_receipts;
create policy manager_action_execution_receipts_account_members_select
  on public.manager_action_execution_receipts
  for select using (public.is_account_member(account_id));

grant select on public.manager_action_execution_receipts to authenticated;
grant select, insert, update, delete on public.manager_action_execution_receipts to service_role;

drop trigger if exists manager_action_execution_receipts_set_updated_at
  on public.manager_action_execution_receipts;
create trigger manager_action_execution_receipts_set_updated_at
before update on public.manager_action_execution_receipts
for each row execute function public.set_updated_at();

create or replace function public._protect_permission_bound_manager_action_v1()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.permission_requests as permission
    where permission.created_from_action_id = old.id
  ) and (
    new.action_type is distinct from old.action_type
    or new.target_type is distinct from old.target_type
    or new.target_id is distinct from old.target_id
    or new.payload is distinct from old.payload
    or new.approval_required is distinct from old.approval_required
  ) then
    raise exception 'A permission-bound Manager action effect cannot be mutated.';
  end if;
  return new;
end;
$$;

revoke all on function public._protect_permission_bound_manager_action_v1() from public, anon, authenticated, service_role;

drop trigger if exists protect_permission_bound_manager_action
  on public.manager_run_actions;
create trigger protect_permission_bound_manager_action
before update of action_type, target_type, target_id, payload, approval_required
on public.manager_run_actions
for each row execute function public._protect_permission_bound_manager_action_v1();

create or replace function public._rebind_legacy_manager_permission_v1()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  source_action public.manager_run_actions%rowtype;
  child_action_id uuid := gen_random_uuid();
  child_order integer;
  frozen_payload jsonb;
begin
  if new.created_from_action_id is null or coalesce(new.parameters, '{}'::jsonb) <> '{}'::jsonb then
    return new;
  end if;

  select * into source_action
  from public.manager_run_actions
  where id = new.created_from_action_id
  for update;

  if not found or source_action.approval_required then
    return new;
  end if;

  select coalesce(max(action.order_index), 0) + 1
  into child_order
  from public.manager_run_actions as action
  where action.manager_synthesis_run_id = source_action.manager_synthesis_run_id;

  frozen_payload := jsonb_build_object(
    'effectVersion', 1,
    'executable', false,
    'requestedActionKind', new.request_type::text,
    'reason', 'This permission was produced without an exact executable effect. Approval records intent only and must return to the Manager for a supported next action.',
    'title', new.title,
    'body', new.body,
    'risk', new.risk
  );

  insert into public.manager_run_actions (
    id, account_id, artist_workspace_id, artist_id, manager_synthesis_run_id,
    order_index, action_type, target_type, target_id, status, approval_required,
    payload, result_payload, action_key
  ) values (
    child_action_id, new.account_id, new.artist_workspace_id, new.artist_id,
    source_action.manager_synthesis_run_id, child_order, 'prepared_external_action',
    case when new.mission_id is not null then 'mission' else source_action.target_type end,
    coalesce(new.mission_id, source_action.target_id), 'approval_required', true,
    frozen_payload, '{}'::jsonb, 'permission:' || new.id::text
  );

  update public.permission_requests
  set created_from_action_id = child_action_id,
      parameters = frozen_payload
  where id = new.id;

  return new;
end;
$$;

revoke all on function public._rebind_legacy_manager_permission_v1() from public, anon, authenticated, service_role;

drop trigger if exists rebind_legacy_manager_permission
  on public.permission_requests;
create trigger rebind_legacy_manager_permission
after insert on public.permission_requests
for each row execute function public._rebind_legacy_manager_permission_v1();

-- Backfill unresolved legacy permissions that still point at a non-gated action.
do $$
declare
  permission_row public.permission_requests%rowtype;
  source_action public.manager_run_actions%rowtype;
  child_action_id uuid;
  child_order integer;
  frozen_payload jsonb;
begin
  for permission_row in
    select permission.*
    from public.permission_requests as permission
    join public.manager_run_actions as action on action.id = permission.created_from_action_id
    where permission.status = 'pending'
      and coalesce(permission.parameters, '{}'::jsonb) = '{}'::jsonb
      and action.approval_required = false
    order by permission.created_at, permission.id
  loop
    select * into source_action
    from public.manager_run_actions
    where id = permission_row.created_from_action_id
    for update;

    child_action_id := gen_random_uuid();
    select coalesce(max(action.order_index), 0) + 1
    into child_order
    from public.manager_run_actions as action
    where action.manager_synthesis_run_id = source_action.manager_synthesis_run_id;

    frozen_payload := jsonb_build_object(
      'effectVersion', 1,
      'executable', false,
      'requestedActionKind', permission_row.request_type::text,
      'reason', 'Legacy permission had no exact executable effect. Approval is prepared-only.',
      'title', permission_row.title,
      'body', permission_row.body,
      'risk', permission_row.risk
    );

    insert into public.manager_run_actions (
      id, account_id, artist_workspace_id, artist_id, manager_synthesis_run_id,
      order_index, action_type, target_type, target_id, status, approval_required,
      payload, result_payload, action_key
    ) values (
      child_action_id, permission_row.account_id, permission_row.artist_workspace_id,
      permission_row.artist_id, source_action.manager_synthesis_run_id, child_order,
      'prepared_external_action',
      case when permission_row.mission_id is not null then 'mission' else source_action.target_type end,
      coalesce(permission_row.mission_id, source_action.target_id), 'approval_required', true,
      frozen_payload, '{}'::jsonb, 'permission:' || permission_row.id::text
    );

    update public.permission_requests
    set created_from_action_id = child_action_id,
        parameters = frozen_payload
    where id = permission_row.id;
  end loop;
end;
$$;

create or replace function public.prepare_split_confirmation_manager_permission_v1(
  target_run_id uuid,
  target_mission_id uuid,
  target_music_item_id uuid,
  permission_title text,
  permission_body text,
  permission_risk text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  run_row public.manager_synthesis_runs%rowtype;
  mission_row public.missions%rowtype;
  split_row public.music_splits%rowtype;
  action_id uuid := gen_random_uuid();
  permission_id uuid := gen_random_uuid();
  action_order integer;
  recipient_snapshot jsonb;
  frozen_payload jsonb;
  publishing_sum numeric;
  master_sum numeric;
begin
  select * into run_row
  from public.manager_synthesis_runs
  where id = target_run_id
  for update;
  if not found then raise exception 'Manager run was not found.'; end if;

  select * into mission_row
  from public.missions
  where id = target_mission_id
    and account_id = run_row.account_id
    and artist_workspace_id = run_row.artist_workspace_id
    and artist_id = run_row.artist_id;
  if not found then raise exception 'Mission does not match the Manager run owner.'; end if;

  if not exists (
    select 1 from public.music_items as item
    where item.id = target_music_item_id
      and item.account_id = run_row.account_id
      and item.artist_workspace_id = run_row.artist_workspace_id
      and item.artist_id = run_row.artist_id
  ) then
    raise exception 'Music item does not match the Manager run owner.';
  end if;

  select split.* into split_row
  from public.music_splits as split
  where split.account_id = run_row.account_id
    and split.artist_workspace_id = run_row.artist_workspace_id
    and split.artist_id = run_row.artist_id
    and split.music_item_id = target_music_item_id
    and split.status = 'draft'
  order by split.created_at desc, split.id desc
  limit 1;
  if not found then
    raise exception 'No draft split is ready to prepare for confirmation.';
  end if;

  select
    coalesce(sum(contributor.publishing_share), 0),
    coalesce(sum(contributor.master_share), 0)
  into publishing_sum, master_sum
  from public.music_split_contributors as contributor
  where contributor.music_split_id = split_row.id
    and contributor.approval_status <> 'revoked';

  if round(publishing_sum, 2) <> 100 or round(master_sum, 2) <> 100 then
    raise exception 'Publishing and master split totals must both equal 100%% before approval can be requested.';
  end if;

  if exists (
    select 1 from public.music_split_contributors as contributor
    where contributor.music_split_id = split_row.id
      and contributor.approval_status <> 'revoked'
      and nullif(trim(contributor.email), '') is null
  ) then
    raise exception 'Every active split contributor needs an email before approval can be requested.';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'contributorId', contributor.id,
      'name', contributor.name,
      'role', contributor.role,
      'email', trim(contributor.email),
      'publishingShare', contributor.publishing_share::text,
      'masterShare', contributor.master_share::text
    ) order by contributor.id
  ), '[]'::jsonb)
  into recipient_snapshot
  from public.music_split_contributors as contributor
  where contributor.music_split_id = split_row.id
    and contributor.approval_status = 'draft';

  if jsonb_array_length(recipient_snapshot) = 0 then
    raise exception 'There are no draft collaborators awaiting a first split-confirmation send.';
  end if;

  frozen_payload := jsonb_build_object(
    'effectVersion', 1,
    'executable', true,
    'actionKind', 'send_split_confirmations',
    'musicItemId', target_music_item_id,
    'splitId', split_row.id,
    'splitStatus', split_row.status::text,
    'recipients', recipient_snapshot
  );

  select coalesce(max(action.order_index), 0) + 1
  into action_order
  from public.manager_run_actions as action
  where action.manager_synthesis_run_id = target_run_id;

  insert into public.manager_run_actions (
    id, account_id, artist_workspace_id, artist_id, manager_synthesis_run_id,
    order_index, action_type, target_type, target_id, status, approval_required,
    payload, result_payload, action_key
  ) values (
    action_id, run_row.account_id, run_row.artist_workspace_id, run_row.artist_id,
    target_run_id, action_order, 'send_split_confirmations', 'music_item', target_music_item_id,
    'approval_required', true, frozen_payload, '{}'::jsonb, 'permission:' || permission_id::text
  );

  insert into public.permission_requests (
    id, account_id, artist_workspace_id, artist_id, mission_id,
    request_type, title, body, risk, parameters, status,
    created_from_run_id, created_from_action_id
  ) values (
    permission_id, run_row.account_id, run_row.artist_workspace_id, run_row.artist_id,
    target_mission_id, 'external_outreach', permission_title, permission_body, permission_risk,
    frozen_payload, 'pending', target_run_id, action_id
  );

  return jsonb_build_object(
    'permissionId', permission_id,
    'actionId', action_id,
    'parameters', frozen_payload
  );
end;
$$;

revoke all on function public.prepare_split_confirmation_manager_permission_v1(uuid, uuid, uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.prepare_split_confirmation_manager_permission_v1(uuid, uuid, uuid, text, text, text)
  to service_role;

create or replace function public.resolve_manager_permission_v1(
  target_permission_id uuid,
  actor_user_id uuid,
  decision text,
  note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  permission_row public.permission_requests%rowtype;
  action_row public.manager_run_actions%rowtype;
  receipt_row public.manager_action_execution_receipts%rowtype;
  receipt_id uuid;
  execution_key text;
  is_new_decision boolean := false;
  should_execute boolean := false;
  action_executable boolean := false;
  review_key text;
  event_id uuid;
begin
  if decision not in ('approve', 'reject') then
    raise exception 'Permission decision must be approve or reject.';
  end if;

  select * into permission_row
  from public.permission_requests
  where id = target_permission_id
  for update;
  if not found then raise exception 'Permission request was not found.'; end if;
  if permission_row.created_from_action_id is null then
    raise exception 'Permission request is not bound to a Manager action.';
  end if;

  select * into action_row
  from public.manager_run_actions
  where id = permission_row.created_from_action_id
    and account_id = permission_row.account_id
    and artist_workspace_id = permission_row.artist_workspace_id
    and artist_id = permission_row.artist_id
  for update;
  if not found or not action_row.approval_required then
    raise exception 'Permission request is not bound to an approval-gated Manager action.';
  end if;
  if action_row.payload is distinct from permission_row.parameters then
    raise exception 'Permission parameters no longer match the frozen Manager action.';
  end if;

  if permission_row.status = 'pending' then
    is_new_decision := true;
    update public.permission_requests
    set status = case when decision = 'approve' then 'approved'::public.permission_request_status else 'rejected'::public.permission_request_status end,
        resolved_at = now(),
        resolved_by_user_id = actor_user_id,
        decision_note = nullif(trim(coalesce(note, '')), '')
    where id = target_permission_id;
    permission_row.status := case when decision = 'approve' then 'approved'::public.permission_request_status else 'rejected'::public.permission_request_status end;
  elsif permission_row.status = 'approved' and decision = 'approve' then
    null;
  elsif permission_row.status = 'rejected' and decision = 'reject' then
    null;
  else
    raise exception 'Permission request already has a conflicting or terminal decision.';
  end if;

  if decision = 'reject' then
    if action_row.status in ('approval_required', 'pending') then
      update public.manager_run_actions
      set status = 'skipped',
          result_payload = jsonb_build_object(
            'executionStatus', 'not_executed',
            'reason', 'human_rejected',
            'permissionRequestId', permission_row.id,
            'decisionNote', nullif(trim(coalesce(note, '')), '')
          ),
          error = null
      where id = action_row.id;
    end if;

    if is_new_decision then
      insert into public.memory_entries (
        account_id, artist_workspace_id, artist_id, mission_id,
        scope, kind, content, source_type, source_id, confidence, reason, metadata
      ) values (
        permission_row.account_id, permission_row.artist_workspace_id, permission_row.artist_id,
        permission_row.mission_id, 'mission', 'rejected_move',
        concat('Artist rejected Manager action: ', permission_row.title,
          case when nullif(trim(coalesce(note, '')), '') is not null then '. Reason: ' || trim(note) else '' end),
        'user', actor_user_id, 'high', 'Explicit human rejection of an external Manager action.',
        jsonb_build_object('permissionRequestId', permission_row.id, 'managerRunActionId', action_row.id, 'requestType', permission_row.request_type)
      );

      insert into public.operating_events (
        account_id, artist_workspace_id, artist_id, event_type, actor_type, actor_id,
        target_type, target_id, source_type, source_id, manager_synthesis_run_id,
        manager_run_action_id, mission_id, dedupe_key, display_mode, refresh_scope,
        summary, payload
      ) values (
        permission_row.account_id, permission_row.artist_workspace_id, permission_row.artist_id,
        'manager_permission_rejected', 'user', actor_user_id, 'permission_request', permission_row.id,
        'permission_request', permission_row.id, action_row.manager_synthesis_run_id,
        action_row.id, permission_row.mission_id,
        'manager-permission:' || permission_row.id::text || ':rejected', 'activity',
        array['missions', 'activity'], 'Artist rejected a proposed Desk action.',
        jsonb_build_object('permissionRequestId', permission_row.id, 'actionId', action_row.id, 'note', nullif(trim(coalesce(note, '')), ''))
      ) on conflict (artist_workspace_id, dedupe_key) where dedupe_key is not null do nothing
      returning id into event_id;

      if permission_row.mission_id is not null then
        review_key := 'permission:' || permission_row.id::text || ':rejected';
        insert into public.reviews (
          account_id, artist_workspace_id, artist_id, mission_id, trigger_type,
          trigger_object_type, trigger_object_id, current_read, what_changed,
          next_action, status, review_at, created_from_run_id, created_from_action_id,
          runtime_key
        ) values (
          permission_row.account_id, permission_row.artist_workspace_id, permission_row.artist_id,
          permission_row.mission_id, 'adaptive_replan', 'permission_request', permission_row.id,
          'The artist rejected a proposed external Manager action.',
          concat('Permission rejected: ', permission_row.title,
            case when nullif(trim(coalesce(note, '')), '') is not null then '. Human reason: ' || trim(note) else '' end),
          'Respect the rejection, do not repeat the same move, and choose the best supported next action for the Mission.',
          'due', now(), action_row.manager_synthesis_run_id, action_row.id, review_key
        ) on conflict (artist_workspace_id, runtime_key) where runtime_key is not null do nothing;
      end if;
    end if;

    return jsonb_build_object(
      'permissionId', permission_row.id,
      'actionId', action_row.id,
      'permissionStatus', 'rejected',
      'actionStatus', 'skipped',
      'shouldExecute', false,
      'replayed', not is_new_decision
    );
  end if;

  action_executable := action_row.action_type = 'send_split_confirmations'
    and coalesce((action_row.payload ->> 'executable')::boolean, false)
    and action_row.payload ->> 'actionKind' = 'send_split_confirmations';

  if is_new_decision then
    insert into public.operating_events (
      account_id, artist_workspace_id, artist_id, event_type, actor_type, actor_id,
      target_type, target_id, source_type, source_id, manager_synthesis_run_id,
      manager_run_action_id, mission_id, dedupe_key, display_mode, refresh_scope,
      summary, payload
    ) values (
      permission_row.account_id, permission_row.artist_workspace_id, permission_row.artist_id,
      'manager_permission_approved', 'user', actor_user_id, 'permission_request', permission_row.id,
      'permission_request', permission_row.id, action_row.manager_synthesis_run_id,
      action_row.id, permission_row.mission_id,
      'manager-permission:' || permission_row.id::text || ':approved', 'activity',
      array['missions', 'activity'], 'Artist approved a proposed Desk action.',
      jsonb_build_object('permissionRequestId', permission_row.id, 'actionId', action_row.id, 'executable', action_executable)
    ) on conflict (artist_workspace_id, dedupe_key) where dedupe_key is not null do nothing;
  end if;

  if not action_executable then
    if is_new_decision and permission_row.mission_id is not null then
      review_key := 'permission:' || permission_row.id::text || ':approved-prepared-only';
      insert into public.reviews (
        account_id, artist_workspace_id, artist_id, mission_id, trigger_type,
        trigger_object_type, trigger_object_id, current_read, what_changed,
        next_action, status, review_at, created_from_run_id, created_from_action_id,
        runtime_key
      ) values (
        permission_row.account_id, permission_row.artist_workspace_id, permission_row.artist_id,
        permission_row.mission_id, 'adaptive_replan', 'permission_request', permission_row.id,
        'The artist approved a prepared external move, but Desk has no supported executable effect bound to it.',
        concat('Approval recorded for: ', permission_row.title, '. Nothing external was executed.'),
        'Continue the Mission from the approval without claiming the external action happened. Prepare a supported action or give the artist the next required human step.',
        'due', now(), action_row.manager_synthesis_run_id, action_row.id, review_key
      ) on conflict (artist_workspace_id, runtime_key) where runtime_key is not null do nothing;
    end if;

    return jsonb_build_object(
      'permissionId', permission_row.id,
      'actionId', action_row.id,
      'permissionStatus', 'approved',
      'actionStatus', action_row.status::text,
      'shouldExecute', false,
      'executionStatus', 'prepared_only',
      'replayed', not is_new_decision
    );
  end if;

  select * into receipt_row
  from public.manager_action_execution_receipts
  where manager_run_action_id = action_row.id
  for update;

  if found then
    return jsonb_build_object(
      'permissionId', permission_row.id,
      'actionId', action_row.id,
      'permissionStatus', 'approved',
      'actionStatus', action_row.status::text,
      'shouldExecute', false,
      'executionReceiptId', receipt_row.id,
      'executionStatus', receipt_row.status,
      'executionKey', receipt_row.execution_key,
      'result', receipt_row.result_payload,
      'replayed', true
    );
  end if;

  if action_row.status <> 'approval_required' then
    raise exception 'Executable Manager action is not waiting for approval execution.';
  end if;

  receipt_id := gen_random_uuid();
  execution_key := 'manager-action:' || action_row.id::text;
  insert into public.manager_action_execution_receipts (
    id, account_id, artist_workspace_id, artist_id, manager_run_action_id,
    permission_request_id, execution_key, status, provider, request_payload
  ) values (
    receipt_id, permission_row.account_id, permission_row.artist_workspace_id, permission_row.artist_id,
    action_row.id, permission_row.id, execution_key, 'claimed', 'resend', action_row.payload
  );
  should_execute := true;

  return jsonb_build_object(
    'permissionId', permission_row.id,
    'actionId', action_row.id,
    'managerRunId', action_row.manager_synthesis_run_id,
    'missionId', permission_row.mission_id,
    'accountId', permission_row.account_id,
    'artistWorkspaceId', permission_row.artist_workspace_id,
    'artistId', permission_row.artist_id,
    'permissionStatus', 'approved',
    'actionStatus', action_row.status::text,
    'actionType', action_row.action_type,
    'actionPayload', action_row.payload,
    'shouldExecute', should_execute,
    'executionReceiptId', receipt_id,
    'executionStatus', 'claimed',
    'executionKey', execution_key,
    'replayed', false
  );
end;
$$;

revoke all on function public.resolve_manager_permission_v1(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.resolve_manager_permission_v1(uuid, uuid, text, text)
  to service_role;

create or replace function public.complete_manager_action_execution_v1(
  target_receipt_id uuid,
  actual_result jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  receipt_row public.manager_action_execution_receipts%rowtype;
  action_row public.manager_run_actions%rowtype;
  permission_row public.permission_requests%rowtype;
  review_key text;
begin
  select * into receipt_row
  from public.manager_action_execution_receipts
  where id = target_receipt_id
  for update;
  if not found then raise exception 'Manager action execution receipt was not found.'; end if;

  select * into action_row from public.manager_run_actions
  where id = receipt_row.manager_run_action_id for update;
  select * into permission_row from public.permission_requests
  where id = receipt_row.permission_request_id for update;

  if permission_row.status <> 'approved' then
    raise exception 'Manager action execution cannot complete without approved permission.';
  end if;
  if action_row.payload is distinct from receipt_row.request_payload
    or permission_row.parameters is distinct from receipt_row.request_payload then
    raise exception 'Execution receipt no longer matches the approved immutable effect.';
  end if;

  if receipt_row.status = 'succeeded' then
    if receipt_row.result_payload = coalesce(actual_result, '{}'::jsonb) then
      return jsonb_build_object('receiptId', receipt_row.id, 'actionId', action_row.id, 'status', 'succeeded', 'replayed', true);
    end if;
    raise exception 'Conflicting execution completion replay.';
  end if;
  if receipt_row.status <> 'claimed' then
    raise exception 'Manager action execution is already terminal.';
  end if;

  update public.manager_action_execution_receipts
  set status = 'succeeded', result_payload = coalesce(actual_result, '{}'::jsonb),
      error = null, completed_at = now()
  where id = receipt_row.id;

  update public.manager_run_actions
  set status = 'applied', result_payload = coalesce(actual_result, '{}'::jsonb), error = null
  where id = action_row.id;

  insert into public.operating_events (
    account_id, artist_workspace_id, artist_id, event_type, actor_type,
    target_type, target_id, source_type, source_id, manager_synthesis_run_id,
    manager_run_action_id, mission_id, dedupe_key, display_mode, refresh_scope,
    summary, payload
  ) values (
    permission_row.account_id, permission_row.artist_workspace_id, permission_row.artist_id,
    'manager_external_action_executed', 'manager', 'manager_run_action', action_row.id,
    'manager_action_execution', receipt_row.id, action_row.manager_synthesis_run_id,
    action_row.id, permission_row.mission_id,
    'manager-action-execution:' || action_row.id::text || ':succeeded', 'toast',
    array['missions', 'activity'], 'Desk completed the approved external action.',
    coalesce(actual_result, '{}'::jsonb) || jsonb_build_object('permissionRequestId', permission_row.id, 'executionReceiptId', receipt_row.id)
  ) on conflict (artist_workspace_id, dedupe_key) where dedupe_key is not null do nothing;

  if permission_row.mission_id is not null then
    review_key := 'permission:' || permission_row.id::text || ':execution-succeeded';
    insert into public.reviews (
      account_id, artist_workspace_id, artist_id, mission_id, trigger_type,
      trigger_object_type, trigger_object_id, current_read, what_changed,
      next_action, status, review_at, created_from_run_id, created_from_action_id,
      runtime_key
    ) values (
      permission_row.account_id, permission_row.artist_workspace_id, permission_row.artist_id,
      permission_row.mission_id, 'adaptive_replan', 'manager_run_action', action_row.id,
      'The approved external Manager action completed and has a persisted execution receipt.',
      concat('Desk executed: ', permission_row.title, '.'),
      'Reason from the real execution result now. Advance, watch, or adapt the Mission without asking the artist to continue manually.',
      'due', now(), action_row.manager_synthesis_run_id, action_row.id, review_key
    ) on conflict (artist_workspace_id, runtime_key) where runtime_key is not null do nothing;
  end if;

  return jsonb_build_object('receiptId', receipt_row.id, 'actionId', action_row.id, 'status', 'succeeded', 'replayed', false);
end;
$$;

revoke all on function public.complete_manager_action_execution_v1(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.complete_manager_action_execution_v1(uuid, jsonb)
  to service_role;

create or replace function public.fail_manager_action_execution_v1(
  target_receipt_id uuid,
  failure_message text,
  actual_result jsonb default '{}'::jsonb,
  is_indeterminate boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  receipt_row public.manager_action_execution_receipts%rowtype;
  action_row public.manager_run_actions%rowtype;
  permission_row public.permission_requests%rowtype;
  terminal_status text := case when is_indeterminate then 'indeterminate' else 'failed' end;
  review_key text;
begin
  select * into receipt_row
  from public.manager_action_execution_receipts
  where id = target_receipt_id
  for update;
  if not found then raise exception 'Manager action execution receipt was not found.'; end if;

  select * into action_row from public.manager_run_actions
  where id = receipt_row.manager_run_action_id for update;
  select * into permission_row from public.permission_requests
  where id = receipt_row.permission_request_id for update;

  if receipt_row.status in ('failed', 'indeterminate') then
    return jsonb_build_object('receiptId', receipt_row.id, 'actionId', action_row.id, 'status', receipt_row.status, 'replayed', true);
  end if;
  if receipt_row.status <> 'claimed' then
    raise exception 'Manager action execution is already terminal.';
  end if;

  update public.manager_action_execution_receipts
  set status = terminal_status,
      result_payload = coalesce(actual_result, '{}'::jsonb),
      error = left(coalesce(failure_message, 'External execution failed.'), 2000),
      completed_at = now()
  where id = receipt_row.id;

  update public.manager_run_actions
  set status = 'failed',
      result_payload = coalesce(actual_result, '{}'::jsonb) || jsonb_build_object('executionStatus', terminal_status),
      error = left(coalesce(failure_message, 'External execution failed.'), 2000)
  where id = action_row.id;

  insert into public.operating_events (
    account_id, artist_workspace_id, artist_id, event_type, actor_type,
    target_type, target_id, source_type, source_id, manager_synthesis_run_id,
    manager_run_action_id, mission_id, dedupe_key, display_mode, refresh_scope,
    summary, payload
  ) values (
    permission_row.account_id, permission_row.artist_workspace_id, permission_row.artist_id,
    case when is_indeterminate then 'manager_external_action_indeterminate' else 'manager_external_action_failed' end,
    'manager', 'manager_run_action', action_row.id, 'manager_action_execution', receipt_row.id,
    action_row.manager_synthesis_run_id, action_row.id, permission_row.mission_id,
    'manager-action-execution:' || action_row.id::text || ':' || terminal_status,
    'action', array['missions', 'activity'],
    case when is_indeterminate
      then 'Desk cannot safely confirm whether the approved external action completed.'
      else 'The approved external action did not complete.' end,
    coalesce(actual_result, '{}'::jsonb) || jsonb_build_object(
      'permissionRequestId', permission_row.id,
      'executionReceiptId', receipt_row.id,
      'error', left(coalesce(failure_message, ''), 2000),
      'automaticRetryAllowed', false
    )
  ) on conflict (artist_workspace_id, dedupe_key) where dedupe_key is not null do nothing;

  if permission_row.mission_id is not null then
    review_key := 'permission:' || permission_row.id::text || ':execution-' || terminal_status;
    insert into public.reviews (
      account_id, artist_workspace_id, artist_id, mission_id, trigger_type,
      trigger_object_type, trigger_object_id, current_read, what_changed,
      next_action, status, review_at, created_from_run_id, created_from_action_id,
      runtime_key
    ) values (
      permission_row.account_id, permission_row.artist_workspace_id, permission_row.artist_id,
      permission_row.mission_id, 'adaptive_replan', 'manager_run_action', action_row.id,
      case when is_indeterminate
        then 'An approved external action entered an indeterminate state. It must not be retried automatically because the real-world side effect may already have happened.'
        else 'An approved external action failed with a persisted execution receipt.' end,
      left(coalesce(failure_message, 'External execution failed.'), 2000),
      'Use the persisted receipt and real-world state to choose a safe next move. Never report the action as completed unless there is positive execution evidence.',
      'due', now(), action_row.manager_synthesis_run_id, action_row.id, review_key
    ) on conflict (artist_workspace_id, runtime_key) where runtime_key is not null do nothing;
  end if;

  return jsonb_build_object('receiptId', receipt_row.id, 'actionId', action_row.id, 'status', terminal_status, 'replayed', false);
end;
$$;

revoke all on function public.fail_manager_action_execution_v1(uuid, text, jsonb, boolean)
  from public, anon, authenticated;
grant execute on function public.fail_manager_action_execution_v1(uuid, text, jsonb, boolean)
  to service_role;

notify pgrst, 'reload schema';
