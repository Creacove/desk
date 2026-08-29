-- Deterministically turn a canonically ready, current-plan split into one exact
-- approval-gated Manager action. No model or prose matching chooses the target.
-- The split -> Task -> active Mission plan relationship is the intent boundary;
-- the existing permission transaction freezes and later revalidates the effect.

create or replace function public.maybe_prepare_split_confirmation_permission_v1(
  target_split_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  split_row public.music_splits%rowtype;
  task_row public.tasks%rowtype;
  mission_row public.missions%rowtype;
  music_item_row public.music_items%rowtype;
  producer_run_id uuid;
  existing_permission_id uuid;
  existing_action_id uuid;
  existing_status public.permission_request_status;
  recipient_snapshot jsonb := '[]'::jsonb;
  publishing_sum numeric := 0;
  master_sum numeric := 0;
  active_contributor_count integer := 0;
  draft_recipient_count integer := 0;
  missing_email_count integer := 0;
  prepared jsonb;
  failure_message text;
begin
  if target_split_id is null then
    return jsonb_build_object('status', 'ignored', 'reason', 'missing_split_id');
  end if;

  -- Serialize readiness transitions for one split so concurrent contributor
  -- edits cannot create duplicate approval transactions.
  perform pg_advisory_xact_lock(hashtextextended(target_split_id::text, 0));

  select * into split_row
  from public.music_splits
  where id = target_split_id;

  if not found then
    return jsonb_build_object('status', 'ignored', 'reason', 'split_not_found');
  end if;

  if split_row.status <> 'draft' then
    return jsonb_build_object('status', 'not_ready', 'reason', 'split_not_draft', 'splitId', split_row.id);
  end if;

  if split_row.linked_task_id is null then
    return jsonb_build_object('status', 'not_ready', 'reason', 'split_not_linked_to_task', 'splitId', split_row.id);
  end if;

  select * into task_row
  from public.tasks
  where id = split_row.linked_task_id
    and account_id = split_row.account_id
    and artist_workspace_id = split_row.artist_workspace_id
    and artist_id = split_row.artist_id;

  if not found or task_row.mission_id is null or task_row.mission_plan_version_id is null then
    return jsonb_build_object('status', 'not_ready', 'reason', 'linked_task_has_no_current_mission_plan', 'splitId', split_row.id);
  end if;

  if task_row.status not in ('proposed', 'open', 'needs_approval', 'approved', 'in_progress', 'blocked', 'completed') then
    return jsonb_build_object('status', 'ignored', 'reason', 'linked_task_is_terminal_or_obsolete', 'splitId', split_row.id, 'taskId', task_row.id);
  end if;

  select * into mission_row
  from public.missions
  where id = task_row.mission_id
    and account_id = split_row.account_id
    and artist_workspace_id = split_row.artist_workspace_id
    and artist_id = split_row.artist_id;

  if not found
     or mission_row.status not in ('active', 'blocked', 'review')
     or mission_row.active_plan_version_id is null
     or mission_row.active_plan_version_id <> task_row.mission_plan_version_id then
    return jsonb_build_object('status', 'ignored', 'reason', 'linked_task_is_not_on_current_mission_plan', 'splitId', split_row.id, 'taskId', task_row.id);
  end if;

  select * into music_item_row
  from public.music_items
  where id = split_row.music_item_id
    and account_id = split_row.account_id
    and artist_workspace_id = split_row.artist_workspace_id
    and artist_id = split_row.artist_id;

  if not found then
    return jsonb_build_object('status', 'ignored', 'reason', 'music_item_not_found', 'splitId', split_row.id);
  end if;

  select
    coalesce(sum(contributor.publishing_share), 0),
    coalesce(sum(contributor.master_share), 0),
    count(*)::integer,
    count(*) filter (where contributor.approval_status = 'draft')::integer,
    count(*) filter (where nullif(trim(contributor.email), '') is null)::integer
  into publishing_sum, master_sum, active_contributor_count, draft_recipient_count, missing_email_count
  from public.music_split_contributors as contributor
  where contributor.music_split_id = split_row.id
    and contributor.approval_status <> 'revoked';

  if active_contributor_count = 0
     or round(publishing_sum, 2) <> 100
     or round(master_sum, 2) <> 100
     or missing_email_count > 0
     or draft_recipient_count = 0 then
    return jsonb_build_object(
      'status', 'not_ready',
      'reason', 'split_effect_is_not_sendable',
      'splitId', split_row.id,
      'publishingTotal', publishing_sum,
      'masterTotal', master_sum,
      'activeContributorCount', active_contributor_count,
      'draftRecipientCount', draft_recipient_count,
      'missingEmailCount', missing_email_count
    );
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

  -- Dedupe by the exact frozen effect, not by title or permission prose. A
  -- rejected exact effect stays rejected; it is not silently proposed again.
  select permission.id, permission.created_from_action_id, permission.status
  into existing_permission_id, existing_action_id, existing_status
  from public.permission_requests as permission
  where permission.account_id = split_row.account_id
    and permission.artist_workspace_id = split_row.artist_workspace_id
    and permission.artist_id = split_row.artist_id
    and permission.mission_id = mission_row.id
    and permission.parameters ->> 'actionKind' = 'send_split_confirmations'
    and permission.parameters ->> 'splitId' = split_row.id::text
    and coalesce(permission.parameters -> 'recipients', '[]'::jsonb) = recipient_snapshot
    and permission.status not in ('superseded', 'revoked')
  order by permission.created_at desc, permission.id desc
  limit 1;

  if existing_permission_id is not null then
    return jsonb_build_object(
      'status', 'replayed',
      'reason', 'exact_effect_already_has_permission',
      'splitId', split_row.id,
      'permissionId', existing_permission_id,
      'actionId', existing_action_id,
      'permissionStatus', existing_status
    );
  end if;

  insert into public.manager_synthesis_runs (
    account_id,
    artist_workspace_id,
    artist_id,
    trigger_type,
    mission_id,
    status,
    classification,
    confidence,
    context_payload,
    steps_payload,
    action_plan,
    limitations,
    started_at
  ) values (
    split_row.account_id,
    split_row.artist_workspace_id,
    split_row.artist_id,
    'review',
    mission_row.id,
    'running',
    'deterministic_external_action_producer_v1',
    'high',
    jsonb_build_object(
      'producerVersion', 'manager-split-permission-producer-v1',
      'splitId', split_row.id,
      'musicItemId', split_row.music_item_id,
      'linkedTaskId', task_row.id,
      'missionId', mission_row.id,
      'activePlanVersionId', mission_row.active_plan_version_id,
      'reason', 'A current-plan linked split became canonically ready for collaborator confirmation.'
    ),
    jsonb_build_array(
      jsonb_build_object('step', 'canonical_readiness_checked', 'status', 'completed'),
      jsonb_build_object('step', 'exact_effect_frozen', 'status', 'running'),
      jsonb_build_object('step', 'permission_persisted', 'status', 'pending')
    ),
    '[]'::jsonb,
    '{}'::text[],
    now()
  ) returning id into producer_run_id;

  begin
    select public.prepare_split_confirmation_manager_permission_v1(
      producer_run_id,
      mission_row.id,
      split_row.music_item_id,
      'Send split confirmations for ' || music_item_row.title,
      'Desk is ready to email the current split confirmation to the collaborators shown here.',
      'This sends external email to the listed collaborators using the frozen addresses and publishing/master shares.'
    ) into prepared;
  exception when others then
    get stacked diagnostics failure_message = message_text;

    update public.manager_synthesis_runs
    set status = 'failed',
        error = left(coalesce(failure_message, 'Split permission preparation failed.'), 1000),
        steps_payload = jsonb_build_array(
          jsonb_build_object('step', 'canonical_readiness_checked', 'status', 'completed'),
          jsonb_build_object('step', 'exact_effect_frozen', 'status', 'failed')
        ),
        completed_at = now()
    where id = producer_run_id;

    insert into public.operating_events (
      account_id, artist_workspace_id, artist_id, event_type, actor_type,
      target_type, target_id, source_type, source_id, manager_synthesis_run_id,
      mission_id, task_id, dedupe_key, display_mode, refresh_scope, summary, payload
    ) values (
      split_row.account_id, split_row.artist_workspace_id, split_row.artist_id,
      'manager_external_action_prepare_failed', 'system', 'music_split', split_row.id,
      'manager_action_producer', producer_run_id, producer_run_id, mission_row.id, task_row.id,
      'manager-action-producer:' || producer_run_id::text || ':failed', 'activity',
      array['missions', 'activity'],
      'Desk kept the split unchanged because it could not safely prepare the external action.',
      jsonb_build_object('splitId', split_row.id, 'taskId', task_row.id, 'error', left(coalesce(failure_message, ''), 1000))
    ) on conflict (artist_workspace_id, dedupe_key) where dedupe_key is not null do nothing;

    return jsonb_build_object(
      'status', 'failed',
      'splitId', split_row.id,
      'runId', producer_run_id,
      'error', left(coalesce(failure_message, 'Split permission preparation failed.'), 1000)
    );
  end;

  update public.manager_synthesis_runs
  set status = 'completed',
      steps_payload = jsonb_build_array(
        jsonb_build_object('step', 'canonical_readiness_checked', 'status', 'completed'),
        jsonb_build_object('step', 'exact_effect_frozen', 'status', 'completed'),
        jsonb_build_object('step', 'permission_persisted', 'status', 'completed')
      ),
      action_plan = jsonb_build_array(prepared),
      completed_at = now()
  where id = producer_run_id;

  insert into public.operating_events (
    account_id, artist_workspace_id, artist_id, event_type, actor_type,
    target_type, target_id, source_type, source_id, manager_synthesis_run_id,
    manager_run_action_id, mission_id, task_id, dedupe_key, display_mode,
    refresh_scope, summary, payload
  ) values (
    split_row.account_id,
    split_row.artist_workspace_id,
    split_row.artist_id,
    'manager_external_action_ready_for_approval',
    'manager',
    'permission_request',
    nullif(prepared ->> 'permissionId', '')::uuid,
    'manager_action_producer',
    producer_run_id,
    producer_run_id,
    nullif(prepared ->> 'actionId', '')::uuid,
    mission_row.id,
    task_row.id,
    'manager-action-producer:permission:' || (prepared ->> 'permissionId'),
    'action',
    array['missions', 'tasks', 'today', 'activity'],
    'Desk prepared an exact external action for approval.',
    prepared || jsonb_build_object(
      'splitId', split_row.id,
      'musicItemId', split_row.music_item_id,
      'taskId', task_row.id,
      'producerRunId', producer_run_id
    )
  ) on conflict (artist_workspace_id, dedupe_key) where dedupe_key is not null do nothing;

  return prepared || jsonb_build_object(
    'status', 'prepared',
    'splitId', split_row.id,
    'runId', producer_run_id
  );
end;
$$;

revoke all on function public.maybe_prepare_split_confirmation_permission_v1(uuid)
  from public, anon, authenticated;
grant execute on function public.maybe_prepare_split_confirmation_permission_v1(uuid)
  to service_role;

create or replace function public._produce_split_permission_from_split_v1()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.maybe_prepare_split_confirmation_permission_v1(new.id);
  return new;
end;
$$;

revoke all on function public._produce_split_permission_from_split_v1()
  from public, anon, authenticated, service_role;

drop trigger if exists produce_split_permission_from_split on public.music_splits;
create trigger produce_split_permission_from_split
after insert or update of status, linked_task_id, music_item_id
on public.music_splits
for each row execute function public._produce_split_permission_from_split_v1();

create or replace function public._produce_split_permission_from_contributor_v1()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  split_id uuid;
begin
  split_id := case when tg_op = 'DELETE' then old.music_split_id else new.music_split_id end;
  perform public.maybe_prepare_split_confirmation_permission_v1(split_id);
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public._produce_split_permission_from_contributor_v1()
  from public, anon, authenticated, service_role;

drop trigger if exists produce_split_permission_from_contributor on public.music_split_contributors;
create trigger produce_split_permission_from_contributor
after insert or delete or update of email, publishing_share, master_share, approval_status, music_split_id
on public.music_split_contributors
for each row execute function public._produce_split_permission_from_contributor_v1();

create or replace function public._produce_split_permission_from_task_v1()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  split_id uuid;
begin
  for split_id in
    select split.id
    from public.music_splits as split
    where split.linked_task_id = new.id
  loop
    perform public.maybe_prepare_split_confirmation_permission_v1(split_id);
  end loop;
  return new;
end;
$$;

revoke all on function public._produce_split_permission_from_task_v1()
  from public, anon, authenticated, service_role;

drop trigger if exists produce_split_permission_from_task on public.tasks;
create trigger produce_split_permission_from_task
after insert or update of status, mission_id, mission_plan_version_id
on public.tasks
for each row execute function public._produce_split_permission_from_task_v1();

create or replace function public._produce_split_permission_from_mission_v1()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  split_id uuid;
begin
  if new.active_plan_version_id is null then
    return new;
  end if;

  for split_id in
    select split.id
    from public.music_splits as split
    join public.tasks as task on task.id = split.linked_task_id
    where task.mission_id = new.id
      and task.mission_plan_version_id = new.active_plan_version_id
  loop
    perform public.maybe_prepare_split_confirmation_permission_v1(split_id);
  end loop;

  return new;
end;
$$;

revoke all on function public._produce_split_permission_from_mission_v1()
  from public, anon, authenticated, service_role;

drop trigger if exists produce_split_permission_from_mission on public.missions;
create trigger produce_split_permission_from_mission
after insert or update of active_plan_version_id, status
on public.missions
for each row execute function public._produce_split_permission_from_mission_v1();
