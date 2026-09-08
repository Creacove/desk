-- A one-person Team workspace is operationally the same as a solo workspace.
-- Keep assignment automatic even when the team feature is enabled.

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
  active_people integer;
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
  select count(*)::integer into active_people
  from public.account_memberships membership
  join public.users app_user on app_user.id = membership.user_id
  where membership.account_id = p_account_id
    and membership.status = 'active'
    and membership.role in ('owner', 'member')
    and app_user.status = 'active';

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
  elsif selected_user_id is null and (not configured or active_people = 1) then
    -- Legacy solo output and one-person Team output both have one obvious
    -- human owner. Preserve a valid existing owner, then use the oldest
    -- active owner/member as the safe fallback.
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
        and membership.role in ('owner', 'member')
        and app_user.status = 'active'
      order by case when membership.role = 'owner' then 0 else 1 end, membership.created_at asc
      limit 1;
    end if;
    if selected_user_id is not null then
      selected_source := 'solo_fallback';
      selected_reason := null;
    end if;
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

revoke all on function public._persist_model_assignment_v1(uuid, uuid, uuid, uuid, uuid, text, boolean) from public, anon, authenticated;
grant execute on function public._persist_model_assignment_v1(uuid, uuid, uuid, uuid, uuid, text, boolean) to service_role;
alter function public._persist_model_assignment_v1(uuid, uuid, uuid, uuid, uuid, text, boolean) owner to postgres;

notify pgrst, 'reload schema';
