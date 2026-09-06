-- Persist validated model assignments through the two existing Manager runtime
-- producers. The legacy producers still own plan/review guards and graph
-- idempotency; this migration only resolves the final human assignment.

do $$
begin
  if to_regprocedure('public.finalize_manager_replan_v1(uuid,uuid,jsonb)') is not null
     and to_regprocedure('public._finalize_manager_replan_legacy_v1(uuid,uuid,jsonb)') is null then
    alter function public.finalize_manager_replan_v1(uuid, uuid, jsonb)
      rename to _finalize_manager_replan_legacy_v1;
  end if;
end;
$$;

create or replace function public._persist_model_assignment_v1(
  p_task_id uuid,
  p_account_id uuid,
  p_artist_workspace_id uuid,
  p_artist_id uuid,
  p_proposed_assignee_user_id uuid,
  p_assignment_reason text,
  p_invalid_proposal boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  task_row public.tasks%rowtype;
  configured boolean;
  selected_user_id uuid;
  selected_source text;
  selected_reason text;
  changed boolean;
  invalid_proposal boolean := coalesce(p_invalid_proposal, false);
begin
  -- Every assignment mutation follows account -> task lock order.
  perform 1 from public.accounts account_row where account_row.id = p_account_id for update;
  select * into task_row
  from public.tasks task
  where task.id = p_task_id
    and task.account_id = p_account_id
    and task.artist_workspace_id = p_artist_workspace_id
    and task.artist_id = p_artist_id
  for update;
  if not found then raise exception 'TEAM_NOT_FOUND'; end if;

  configured := public._team_scope_is_configured_v1(p_account_id, p_artist_workspace_id, p_artist_id);
  selected_user_id := p_proposed_assignee_user_id;
  selected_reason := nullif(pg_catalog.left(pg_catalog.btrim(coalesce(p_assignment_reason, '')), 240), '');

  if selected_user_id is not null and not exists (
    select 1
    from public.account_memberships membership
    join public.users app_user on app_user.id = membership.user_id
    where membership.account_id = p_account_id
      and membership.user_id = selected_user_id
      and membership.status = 'active'
      and membership.role in ('owner', 'member')
      and app_user.status = 'active'
  ) then
    invalid_proposal := true;
    selected_user_id := null;
  end if;

  if lower(coalesce(task_row.work_mode, '')) = 'manager_work' then
    selected_user_id := null;
    selected_reason := null;
  elsif selected_user_id is null and not configured then
    -- Legacy solo output has no assignment fields. Preserve its current owner
    -- when valid, then fall back to the account owner if a producer left it
    -- blank.
    if task_row.assignee_user_id is not null and exists (
      select 1
      from public.account_memberships membership
      join public.users app_user on app_user.id = membership.user_id
      where membership.account_id = p_account_id
        and membership.user_id = task_row.assignee_user_id
        and membership.status = 'active'
        and membership.role in ('owner', 'member')
        and app_user.status = 'active'
    ) then
      selected_user_id := task_row.assignee_user_id;
    else
      select membership.user_id into selected_user_id
      from public.account_memberships membership
      join public.users app_user on app_user.id = membership.user_id
      where membership.account_id = p_account_id
        and membership.status = 'active'
        and membership.role = 'owner'
        and app_user.status = 'active'
      order by membership.created_at asc
      limit 1;
    end if;
    if selected_user_id is not null then selected_source := 'solo_fallback'; end if;
  elsif selected_user_id is not null then
    selected_source := 'manager';
  end if;

  if configured and selected_user_id is null and invalid_proposal then
    selected_reason := coalesce(selected_reason, 'Assignment did not match an active team member.');
  end if;
  if selected_user_id is null then
    selected_source := null;
  elsif selected_source is null then
    selected_source := case when configured then 'manager' else 'solo_fallback' end;
  end if;

  changed := task_row.assignee_user_id is distinct from selected_user_id
    or task_row.assignment_reason is distinct from selected_reason
    or task_row.assignment_source is distinct from selected_source;
  if changed then
    update public.tasks task
    set assignee_user_id = selected_user_id,
        assignment_reason = selected_reason,
        assignment_source = selected_source,
        assignment_version = task.assignment_version + 1
    where task.id = task_row.id
    returning * into task_row;

    insert into public.operating_events(
      account_id, artist_workspace_id, artist_id, event_type, actor_type,
      target_type, target_id, source_type, source_id, dedupe_key, display_mode,
      refresh_scope, summary, payload
    ) values (
      task_row.account_id, task_row.artist_workspace_id, task_row.artist_id,
      case when invalid_proposal then 'assignment_validation_failed' else 'team_task_assigned' end,
      'manager', 'task', task_row.id, 'manager_assignment', task_row.id,
      'team-assignment:' || task_row.id::text || ':' || task_row.assignment_version::text,
      'activity', array['missions', 'today', 'activity']::text[],
      case when selected_user_id is null then 'This task needs an owner.' else 'Manager assigned a team task.' end,
      pg_catalog.jsonb_build_object(
        'taskId', task_row.id,
        'assigneeUserId', selected_user_id,
        'assignmentSource', selected_source,
        'assignmentVersion', task_row.assignment_version,
        'validationFailed', invalid_proposal
      )
    ) on conflict (artist_workspace_id, dedupe_key) where dedupe_key is not null do nothing;

    perform public.queue_reminders_for_task(task_row.id);
  end if;

  return pg_catalog.jsonb_build_object(
    'taskId', task_row.id,
    'assigneeUserId', task_row.assignee_user_id,
    'assignmentReason', task_row.assignment_reason,
    'assignmentSource', task_row.assignment_source,
    'assignmentVersion', task_row.assignment_version,
    'validationFailed', invalid_proposal
  );
end;
$$;

create or replace function public.finalize_manager_replan_v1(
  p_review_id uuid,
  p_run_id uuid,
  p_output jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  result jsonb;
  task_row record;
  task_item jsonb;
  proposal_count integer;
  proposed_text text;
  proposed_user_id uuid;
  reason_text text;
begin
  result := public._finalize_manager_replan_legacy_v1(p_review_id, p_run_id, p_output);
  if coalesce(result->>'decision', '') <> 'replan' then return result; end if;

  for task_row in
    select task.*
    from public.tasks task
    where task.created_from_run_id = p_run_id
      and task.status not in ('archived', 'superseded', 'rejected')
      and task.work_mode in ('artist_action', 'collaborative')
    order by task.created_at, task.id
  loop
    -- Match by title within this generated run. Duplicate model titles are
    -- deliberately treated as ambiguous and therefore remain unassigned on a
    -- Team account.
    select count(*) into proposal_count
    from pg_catalog.jsonb_array_elements(coalesce(p_output -> 'tasks', '[]'::jsonb)) as item(value)
    where pg_catalog.lower(pg_catalog.btrim(coalesce(item.value ->> 'title', ''))) = pg_catalog.lower(pg_catalog.btrim(task_row.title));
    task_item := null;
    if proposal_count = 1 then
      select item.value into task_item
      from pg_catalog.jsonb_array_elements(coalesce(p_output -> 'tasks', '[]'::jsonb)) as item(value)
      where pg_catalog.lower(pg_catalog.btrim(coalesce(item.value ->> 'title', ''))) = pg_catalog.lower(pg_catalog.btrim(task_row.title))
      limit 1;
    end if;

    proposed_text := nullif(pg_catalog.btrim(coalesce(task_item ->> 'assigneeUserId', '')), '');
    proposed_user_id := case
      when proposed_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then proposed_text::uuid
      else null
    end;
    reason_text := nullif(pg_catalog.btrim(coalesce(task_item ->> 'assignmentReason', '')), '');
    perform public._persist_model_assignment_v1(
      task_row.id,
      task_row.account_id,
      task_row.artist_workspace_id,
      task_row.artist_id,
      proposed_user_id,
      reason_text,
      proposed_text is not null and proposed_user_id is null
    );
  end loop;
  return result;
end;
$$;

-- The latest continuation trigger remains the source of task/step/event
-- idempotency. This after-trigger applies its assignment proposal once those
-- rows exist, including retries of the same result event.
create or replace function public.persist_team_continuation_assignments_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  active_plan_id uuid;
  follow_up jsonb;
  task_row record;
  proposed_text text;
  proposed_user_id uuid;
  reason_text text;
begin
  if new.source_type <> 'task_result'
     or new.actor_type <> 'manager'
     or new.mission_id is null
     or new.checkpoint_id is null then
    return new;
  end if;
  select mission.active_plan_version_id into active_plan_id
  from public.missions mission
  where mission.id = new.mission_id
    and mission.account_id = new.account_id
    and mission.artist_workspace_id = new.artist_workspace_id
    and mission.artist_id = new.artist_id;
  if active_plan_id is null then return new; end if;

  for follow_up in
    select item.value
    from pg_catalog.jsonb_array_elements(coalesce(new.payload -> 'followUpTasks', '[]'::jsonb)) as item(value)
    where lower(pg_catalog.btrim(coalesce(item.value ->> 'ownerRole', ''))) not in ('', 'manager', 'desk', 'ai', 'ai manager')
  loop
    select task.* into task_row
    from public.tasks task
    where task.account_id = new.account_id
      and task.artist_workspace_id = new.artist_workspace_id
      and task.artist_id = new.artist_id
      and task.mission_id = new.mission_id
      and task.mission_plan_version_id = active_plan_id
      and task.primary_checkpoint_id = new.checkpoint_id
      and task.status not in ('archived', 'superseded', 'rejected')
      and pg_catalog.lower(pg_catalog.btrim(task.title)) = pg_catalog.lower(pg_catalog.btrim(coalesce(follow_up ->> 'title', 'Continue the mission')))
    order by task.created_at desc, task.id desc
    limit 1;
    if not found then continue; end if;

    proposed_text := nullif(pg_catalog.btrim(coalesce(follow_up ->> 'assigneeUserId', '')), '');
    proposed_user_id := case
      when proposed_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then proposed_text::uuid
      else null
    end;
    reason_text := nullif(pg_catalog.btrim(coalesce(follow_up ->> 'assignmentReason', '')), '');
    perform public._persist_model_assignment_v1(
      task_row.id,
      task_row.account_id,
      task_row.artist_workspace_id,
      task_row.artist_id,
      proposed_user_id,
      reason_text,
      proposed_text is not null and proposed_user_id is null
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists zz_persist_team_continuation_assignments on public.operating_events;
create trigger zz_persist_team_continuation_assignments
after insert on public.operating_events
for each row execute function public.persist_team_continuation_assignments_v1();

-- The legacy functions remain service-only and execute with fixed privileges.
alter function public._finalize_manager_replan_legacy_v1(uuid, uuid, jsonb)
  set search_path = '';
alter function public._finalize_manager_replan_legacy_v1(uuid, uuid, jsonb)
  set row_security = off;
alter function public.persist_manager_review_continuation()
  set search_path = '';
alter function public.persist_manager_review_continuation()
  set row_security = off;

revoke all on function public._finalize_manager_replan_legacy_v1(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public._persist_model_assignment_v1(uuid, uuid, uuid, uuid, uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.finalize_manager_replan_v1(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.persist_team_continuation_assignments_v1() from public, anon, authenticated;
revoke all on function public.persist_manager_review_continuation() from public, anon, authenticated;
grant execute on function public._finalize_manager_replan_legacy_v1(uuid, uuid, jsonb) to service_role;
grant execute on function public._persist_model_assignment_v1(uuid, uuid, uuid, uuid, uuid, text, boolean) to service_role;
grant execute on function public.finalize_manager_replan_v1(uuid, uuid, jsonb) to service_role;

alter function public._finalize_manager_replan_legacy_v1(uuid, uuid, jsonb) owner to postgres;
alter function public._persist_model_assignment_v1(uuid, uuid, uuid, uuid, uuid, text, boolean) owner to postgres;
alter function public.finalize_manager_replan_v1(uuid, uuid, jsonb) owner to postgres;
alter function public.persist_team_continuation_assignments_v1() owner to postgres;
alter function public.persist_manager_review_continuation() owner to postgres;

notify pgrst, 'reload schema';
