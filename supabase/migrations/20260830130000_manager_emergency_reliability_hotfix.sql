-- Emergency containment and permission-contract split after the first live
-- Manager runtime test. Career Watch is deliberately paused until its model
-- output can pass the same semantic admission contract as interactive work.
update public.manager_career_watch_state
set enabled = false,
    last_error = 'Temporarily paused for structured-output reliability remediation.'
where enabled;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'manager-career-watch-dispatcher';
  end if;
end
$$;

create or replace function public.enable_manager_career_watch_for_workspace_v1()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.manager_career_watch_state (
    account_id,
    artist_workspace_id,
    artist_id,
    enabled,
    next_run_at
  ) values (new.account_id, new.id, new.artist_id, false, now())
  on conflict do nothing;
  return new;
end
$$;

revoke all on function public.enable_manager_career_watch_for_workspace_v1()
  from public, anon, authenticated;

-- Planning decisions are intentionally separate from immutable approvals that
-- may authorize an external effect. This resolver can never execute anything.
create or replace function public.resolve_manager_decision_permission_v1(
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
  is_new_decision boolean := false;
  target_status public.permission_request_status;
  review_key text;
begin
  if decision not in ('approve', 'reject') then
    raise exception 'Permission decision must be approve or reject.';
  end if;

  select * into permission_row
  from public.permission_requests
  where id = target_permission_id
  for update;

  if not found then
    raise exception 'Permission request was not found.';
  end if;
  if permission_row.created_from_action_id is not null then
    raise exception 'Action-bound permission must use the execution permission resolver.';
  end if;
  if lower(coalesce(permission_row.parameters ->> 'executable', 'false')) = 'true' then
    raise exception 'An executable permission cannot be resolved without an immutable Manager action.';
  end if;

  target_status := case
    when decision = 'approve' then 'approved'::public.permission_request_status
    else 'rejected'::public.permission_request_status
  end;

  if permission_row.status = 'pending' then
    is_new_decision := true;
    update public.permission_requests
    set status = target_status,
        resolved_at = now(),
        resolved_by_user_id = actor_user_id,
        decision_note = nullif(trim(coalesce(note, '')), '')
    where id = permission_row.id;
  elsif permission_row.status = target_status then
    null;
  else
    raise exception 'Permission request already has a conflicting or terminal decision.';
  end if;

  if is_new_decision then
    insert into public.operating_events (
      account_id,
      artist_workspace_id,
      artist_id,
      event_type,
      actor_type,
      actor_id,
      target_type,
      target_id,
      source_type,
      source_id,
      manager_synthesis_run_id,
      mission_id,
      dedupe_key,
      display_mode,
      refresh_scope,
      summary,
      payload
    ) values (
      permission_row.account_id,
      permission_row.artist_workspace_id,
      permission_row.artist_id,
      case when decision = 'approve' then 'manager_decision_approved' else 'manager_decision_rejected' end,
      'user',
      actor_user_id,
      'permission_request',
      permission_row.id,
      'permission_request',
      permission_row.id,
      permission_row.created_from_run_id,
      permission_row.mission_id,
      'manager-decision:' || permission_row.id::text || ':' || decision,
      'activity',
      array['today', 'missions', 'activity'],
      case when decision = 'approve'
        then 'Artist approved a proposed Manager direction.'
        else 'Artist rejected a proposed Manager direction.'
      end,
      jsonb_build_object(
        'permissionRequestId', permission_row.id,
        'decision', decision,
        'decisionOnly', true,
        'note', nullif(trim(coalesce(note, '')), '')
      )
    ) on conflict (artist_workspace_id, dedupe_key)
      where dedupe_key is not null do nothing;

    if permission_row.mission_id is not null then
      review_key := 'decision-permission:' || permission_row.id::text || ':' || decision;
      insert into public.reviews (
        account_id,
        artist_workspace_id,
        artist_id,
        mission_id,
        trigger_type,
        trigger_object_type,
        trigger_object_id,
        current_read,
        what_changed,
        next_action,
        status,
        review_at,
        created_from_run_id,
        runtime_key
      ) values (
        permission_row.account_id,
        permission_row.artist_workspace_id,
        permission_row.artist_id,
        permission_row.mission_id,
        'adaptive_replan',
        'permission_request',
        permission_row.id,
        case when decision = 'approve'
          then 'The artist approved the proposed Manager direction.'
          else 'The artist rejected the proposed Manager direction.'
        end,
        concat(
          'Decision ', decision, ': ', permission_row.title,
          case when nullif(trim(coalesce(note, '')), '') is not null then '. Human note: ' || trim(note) else '' end
        ),
        case when decision = 'approve'
          then 'Continue from the approved direction without claiming that any external action occurred.'
          else 'Respect the rejection and choose a different supported next move.'
        end,
        'due',
        now(),
        permission_row.created_from_run_id,
        review_key
      ) on conflict (artist_workspace_id, runtime_key)
        where runtime_key is not null do nothing;
    end if;
  end if;

  return jsonb_build_object(
    'permissionId', permission_row.id,
    'actionId', null,
    'permissionStatus', target_status::text,
    'decisionOnly', true,
    'shouldExecute', false,
    'executionStatus', 'not_applicable',
    'replayed', not is_new_decision
  );
end
$$;

revoke all on function public.resolve_manager_decision_permission_v1(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.resolve_manager_decision_permission_v1(uuid, uuid, text, text)
  to service_role;

-- Stop already-persisted generic pre-release asset requests from surviving in
-- Today for provider-confirmed released/catalog songs. Preserve the rows and an
-- explicit reason instead of deleting history. Narrow post-release licensing,
-- sync, clearance, dispute and correction work is intentionally excluded.
with invalid_released_tasks as (
  select distinct task.id
  from public.tasks as task
  join public.artifact_links as link
    on link.source_type = 'mission'
   and link.source_id = task.mission_id
   and link.target_type in ('music_item', 'music_project')
  left join public.music_items as item
    on link.target_type = 'music_item'
   and item.id = link.target_id
   and item.account_id = task.account_id
   and item.artist_workspace_id = task.artist_workspace_id
   and item.artist_id = task.artist_id
  left join public.music_projects as project
    on link.target_type = 'music_project'
   and project.id = link.target_id
   and project.account_id = task.account_id
   and project.artist_workspace_id = task.artist_workspace_id
   and project.artist_id = task.artist_id
  cross join lateral (
    select lower(concat_ws(
      ' ',
      task.title,
      task.purpose,
      array_to_string(task.evidence_needed, ' '),
      task.completion_expectation
    )) as task_text
  ) as text_value
  where task.status in ('proposed', 'open', 'needs_approval', 'approved', 'in_progress', 'blocked', 'missed')
    and (
      item.released_at is not null
      or lower(coalesce(item.lifecycle_stage::text, '')) in ('released', 'catalog', 'catalogued', 'archived')
      or project.released_at is not null
      or lower(coalesce(project.lifecycle_stage::text, '')) in ('released', 'catalog', 'catalogued', 'archived')
    )
    and text_value.task_text ~ '(upload|provide|add|attach|supply|collect|complete|submit|gather|need|required|missing|open files).{0,160}(audio|master|artwork|cover art|credit|rights|split|release asset|release package)'
    and text_value.task_text !~ '(sync|licen[cs]|clearance|dispute|takedown|replace|correct|amend|wrong|incorrect)'
)
update public.tasks as task
set status = 'superseded',
    dependency = 'Superseded by released/catalog policy: public release evidence cannot be blocked by generic pre-release asset collection.',
    updated_at = now()
from invalid_released_tasks as invalid
where task.id = invalid.id;
