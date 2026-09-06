-- Team authority boundaries.  Team-bound accounts use service-owned commit
-- paths while accounts without a Team settings row retain the existing solo
-- PostgREST behavior.

alter table public.conversation_messages
  add column if not exists authored_by_user_id uuid references public.users(id) on delete set null;

create index if not exists conversation_messages_workspace_author_idx
  on public.conversation_messages (artist_workspace_id, authored_by_user_id, created_at desc)
  where authored_by_user_id is not null;

create or replace function public._team_request_is_service_role_v1()
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role'
      or coalesce(auth.jwt()->>'role', '') = 'service_role';
$$;

create or replace function public._team_scope_is_configured_v1(
  p_account_id uuid,
  p_artist_workspace_id uuid,
  p_artist_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select exists (
    select 1
    from public.workspace_team_settings settings
    where settings.account_id = p_account_id
      and settings.artist_workspace_id = p_artist_workspace_id
      and settings.artist_id = p_artist_id
  );
$$;

-- One shared authorization resolver is used by service-only Edge handlers.
-- It intentionally accepts the scope as input and verifies every component
-- against the workspace row before looking at membership or a task.
create or replace function public.assert_workspace_operation_v1(
  p_account_id uuid,
  p_artist_workspace_id uuid,
  p_artist_id uuid,
  p_actor_user_id uuid,
  p_operation text,
  p_task_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  workspace_row public.artist_workspaces%rowtype;
  membership_row public.account_memberships%rowtype;
  task_row public.tasks%rowtype;
  capability jsonb;
  caller_role text := coalesce(auth.jwt()->>'role', current_setting('request.jwt.claim.role', true), '');
  configured boolean;
begin
  if p_account_id is null or p_artist_workspace_id is null or p_artist_id is null
     or p_actor_user_id is null
     or p_operation not in ('manage_team', 'approve', 'billing', 'execute_task', 'contribute') then
    raise exception 'TEAM_BAD_INPUT';
  end if;
  if caller_role <> 'service_role' and p_actor_user_id is distinct from auth.uid() then
    raise exception 'TEAM_FORBIDDEN';
  end if;

  select * into workspace_row
  from public.artist_workspaces workspace
  where workspace.id = p_artist_workspace_id
    and workspace.account_id = p_account_id
    and workspace.artist_id = p_artist_id;
  if not found then raise exception 'TEAM_NOT_FOUND'; end if;

  select * into membership_row
  from public.account_memberships membership
  where membership.account_id = p_account_id
    and membership.user_id = p_actor_user_id
    and membership.status = 'active'
    and membership.role in ('owner', 'member');
  if not found then raise exception 'TEAM_FORBIDDEN'; end if;
  if not exists (
    select 1 from public.users app_user
    where app_user.id = p_actor_user_id and app_user.status = 'active'
  ) then
    raise exception 'TEAM_FORBIDDEN';
  end if;

  configured := public._team_scope_is_configured_v1(p_account_id, p_artist_workspace_id, p_artist_id);
  capability := public._workspace_team_capability_v1(p_artist_workspace_id);

  -- Team members lose new workspace operations when the rollout or verified
  -- entitlement is off. Owners retain recovery and billing access.
  if configured and membership_row.role = 'member'
     and (not coalesce((capability->>'enabled')::boolean, false)
          or not coalesce((capability->>'entitled')::boolean, false)) then
    raise exception 'TEAM_FORBIDDEN';
  end if;

  if p_operation in ('manage_team', 'approve', 'billing')
     and membership_row.role <> 'owner' then
    raise exception 'TEAM_FORBIDDEN';
  end if;
  if p_operation = 'manage_team'
     and (not coalesce((capability->>'enabled')::boolean, false)
          or not coalesce((capability->>'entitled')::boolean, false)) then
    raise exception 'TEAM_FORBIDDEN';
  end if;

  if p_operation = 'execute_task' then
    if p_task_id is null then raise exception 'TEAM_BAD_INPUT'; end if;
    select * into task_row
    from public.tasks task
    where task.id = p_task_id
      and task.account_id = p_account_id
      and task.artist_workspace_id = p_artist_workspace_id
      and task.artist_id = p_artist_id;
    if not found then raise exception 'TEAM_NOT_FOUND'; end if;
    if task_row.status in ('completed', 'rejected', 'missed', 'archived', 'superseded')
       or lower(coalesce(task_row.work_mode, '')) = 'manager_work' then
      raise exception 'TEAM_CONFLICT';
    end if;
    if membership_row.role <> 'owner'
       and task_row.assignee_user_id is distinct from p_actor_user_id then
      raise exception 'TEAM_FORBIDDEN';
    end if;
    return pg_catalog.jsonb_build_object(
      'authorized', true,
      'role', membership_row.role,
      'membershipId', membership_row.id,
      'assignmentVersion', task_row.assignment_version,
      'assigneeUserId', task_row.assignee_user_id
    );
  end if;

  return pg_catalog.jsonb_build_object(
    'authorized', true,
    'role', membership_row.role,
    'membershipId', membership_row.id
  );
end;
$$;

-- Final-write assignment invariant.  It runs for every account so service
-- writes cannot accidentally create a cross-scope or machine-work assignee.
create or replace function public.validate_team_task_assignment_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  if new.assignment_version is null or new.assignment_version < 0 then
    raise exception 'TEAM_BAD_INPUT';
  end if;
  if not exists (
    select 1
    from public.artist_workspaces workspace
    where workspace.id = new.artist_workspace_id
      and workspace.account_id = new.account_id
      and workspace.artist_id = new.artist_id
  ) then
    raise exception 'TEAM_CONFLICT';
  end if;
  if new.assignee_user_id is not null
     and (lower(coalesce(new.work_mode, '')) = 'manager_work'
          or lower(coalesce(new.owner_role, '')) in ('manager', 'desk', 'ai', 'ai manager')) then
    raise exception 'TEAM_CONFLICT';
  end if;
  if new.assignee_user_id is not null
     and not exists (
       select 1
       from public.account_memberships membership
       join public.users app_user on app_user.id = membership.user_id
       where membership.account_id = new.account_id
         and membership.user_id = new.assignee_user_id
         and membership.status = 'active'
         and membership.role in ('owner', 'member')
         and app_user.status = 'active'
     ) then
    raise exception 'TEAM_CONFLICT';
  end if;

  if tg_op = 'UPDATE' then
    if (new.assignee_user_id is distinct from old.assignee_user_id
        or new.assignment_reason is distinct from old.assignment_reason
        or new.assignment_source is distinct from old.assignment_source)
       and new.assignment_version <> old.assignment_version + 1 then
      raise exception 'TEAM_CONFLICT';
    end if;
    if new.assignment_version is distinct from old.assignment_version
       and new.assignee_user_id is not distinct from old.assignee_user_id
       and new.assignment_reason is not distinct from old.assignment_reason
       and new.assignment_source is not distinct from old.assignment_source then
      raise exception 'TEAM_CONFLICT';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists team_task_assignment_invariant on public.tasks;
create trigger team_task_assignment_invariant
before insert or update on public.tasks
for each row execute function public.validate_team_task_assignment_v1();

-- A configured Team does not accept direct task graph/authority writes. The
-- existing account-member policy remains intact for solo accounts.
create or replace function public.guard_team_task_direct_write_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  account_value uuid;
  workspace_value uuid;
  artist_value uuid;
begin
  if public._team_request_is_service_role_v1() then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  if tg_op = 'DELETE' then
    account_value := old.account_id;
    workspace_value := old.artist_workspace_id;
    artist_value := old.artist_id;
  else
    account_value := new.account_id;
    workspace_value := new.artist_workspace_id;
    artist_value := new.artist_id;
  end if;
  if not public._team_scope_is_configured_v1(account_value, workspace_value, artist_value) then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  if tg_op = 'INSERT' or tg_op = 'DELETE' then
    raise exception 'TEAM_FORBIDDEN';
  end if;
  if new.account_id is distinct from old.account_id
     or new.artist_workspace_id is distinct from old.artist_workspace_id
     or new.artist_id is distinct from old.artist_id
     or new.scope is distinct from old.scope
     or new.mission_id is distinct from old.mission_id
     or new.mission_plan_version_id is distinct from old.mission_plan_version_id
     or new.primary_checkpoint_id is distinct from old.primary_checkpoint_id
     or new.title is distinct from old.title
     or new.owner_role is distinct from old.owner_role
     or new.deadline is distinct from old.deadline
     or new.priority is distinct from old.priority
     or new.status is distinct from old.status
     or new.approval_state is distinct from old.approval_state
     or new.purpose is distinct from old.purpose
     or new.dependency is distinct from old.dependency
     or new.evidence_needed is distinct from old.evidence_needed
     or new.completion_expectation is distinct from old.completion_expectation
     or new.risk_if_late is distinct from old.risk_if_late
     or new.risk_if_skipped is distinct from old.risk_if_skipped
     or new.work_mode is distinct from old.work_mode
     or new.available_from is distinct from old.available_from
     or new.estimated_minutes is distinct from old.estimated_minutes
     or new.assignee_user_id is distinct from old.assignee_user_id
     or new.assignment_reason is distinct from old.assignment_reason
     or new.assignment_source is distinct from old.assignment_source
     or new.assignment_version is distinct from old.assignment_version
     or new.reminder_policy is distinct from old.reminder_policy
     or new.completion_mode is distinct from old.completion_mode
     or new.deliverable_title is distinct from old.deliverable_title
     or new.deliverable_requirements is distinct from old.deliverable_requirements
     or new.manager_responsibility is distinct from old.manager_responsibility
     or new.user_responsibility is distinct from old.user_responsibility
     or new.archived_at is distinct from old.archived_at then
    raise exception 'TEAM_FORBIDDEN';
  end if;
  return new;
end;
$$;

drop trigger if exists team_task_direct_write_guard on public.tasks;
create trigger team_task_direct_write_guard
before insert or update or delete on public.tasks
for each row execute function public.guard_team_task_direct_write_v1();

-- Worker-owned rows cannot be forged by an authenticated member of a Team.
create or replace function public.guard_team_service_owned_write_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  account_value uuid;
  workspace_value uuid;
  artist_value uuid;
begin
  if public._team_request_is_service_role_v1() then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  if tg_op = 'DELETE' then
    account_value := old.account_id;
    workspace_value := old.artist_workspace_id;
    artist_value := old.artist_id;
  else
    account_value := new.account_id;
    workspace_value := new.artist_workspace_id;
    artist_value := new.artist_id;
  end if;
  if public._team_scope_is_configured_v1(account_value, workspace_value, artist_value) then
    raise exception 'TEAM_FORBIDDEN';
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

drop trigger if exists team_task_steps_service_write_guard on public.task_steps;
create trigger team_task_steps_service_write_guard
before insert or update or delete on public.task_steps
for each row execute function public.guard_team_service_owned_write_v1();
drop trigger if exists team_task_state_events_service_write_guard on public.task_state_events;
create trigger team_task_state_events_service_write_guard
before insert or update or delete on public.task_state_events
for each row execute function public.guard_team_service_owned_write_v1();
drop trigger if exists team_task_results_service_write_guard on public.task_results;
create trigger team_task_results_service_write_guard
before insert or update or delete on public.task_results
for each row execute function public.guard_team_service_owned_write_v1();

create or replace function public.guard_team_operating_event_write_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  if public._team_request_is_service_role_v1()
     or not public._team_scope_is_configured_v1(new.account_id, new.artist_workspace_id, new.artist_id) then
    return new;
  end if;
  if new.recipient_user_id is not null then
    raise exception 'TEAM_FORBIDDEN';
  end if;
  if new.actor_type <> 'user' then
    raise exception 'TEAM_FORBIDDEN';
  end if;
  if new.actor_id is not null and new.actor_id is distinct from auth.uid() then
    raise exception 'TEAM_FORBIDDEN';
  end if;
  if new.actor_id is null
     and not (
       new.event_type = 'manager_context_answered'
       and new.source_type = 'manager_question_request'
       and exists (
         select 1 from public.manager_question_requests request_row
         where request_row.id = new.source_id
           and request_row.account_id = new.account_id
           and request_row.artist_workspace_id = new.artist_workspace_id
           and request_row.status = 'answered'
       )
     ) then
    raise exception 'TEAM_FORBIDDEN';
  end if;
  if not exists (
    select 1
    from public.account_memberships membership
    where membership.account_id = new.account_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
      and membership.role in ('owner', 'member')
  ) then
    raise exception 'TEAM_FORBIDDEN';
  end if;
  return new;
end;
$$;

drop trigger if exists team_operating_event_write_guard on public.operating_events;
create trigger team_operating_event_write_guard
before insert or update on public.operating_events
for each row execute function public.guard_team_operating_event_write_v1();

create or replace function public.guard_team_conversation_author_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  configured boolean := public._team_scope_is_configured_v1(new.account_id, new.artist_workspace_id, new.artist_id);
  author_role text;
begin
  if tg_op = 'UPDATE'
     and old.authored_by_user_id is not null
     and new.authored_by_user_id is distinct from old.authored_by_user_id then
    raise exception 'TEAM_FORBIDDEN';
  end if;
  if new.speaker = 'artist'::public.conversation_speaker then
    if public._team_request_is_service_role_v1() then
      if configured and new.authored_by_user_id is null then
        raise exception 'TEAM_FORBIDDEN';
      end if;
    else
      if auth.uid() is null then
        if configured then raise exception 'TEAM_FORBIDDEN'; end if;
      elsif new.authored_by_user_id is null then
        new.authored_by_user_id := auth.uid();
      elsif new.authored_by_user_id is distinct from auth.uid() then
        raise exception 'TEAM_FORBIDDEN';
      end if;
    end if;
    if new.authored_by_user_id is not null then
      select membership.role into author_role
      from public.account_memberships membership
      where membership.account_id = new.account_id
        and membership.user_id = new.authored_by_user_id
        and membership.status = 'active'
        and (not configured or membership.role in ('owner', 'member'));
      if author_role is null then raise exception 'TEAM_FORBIDDEN'; end if;
      new.metadata := coalesce(new.metadata, '{}'::jsonb)
        || pg_catalog.jsonb_build_object(
          'authoredByUserId', new.authored_by_user_id,
          'authoredByRoleAtSubmission', author_role
        );
    end if;
  elsif new.authored_by_user_id is not null
        and not public._team_request_is_service_role_v1() then
    raise exception 'TEAM_FORBIDDEN';
  end if;
  return new;
end;
$$;

drop trigger if exists team_conversation_author_guard on public.conversation_messages;
create trigger team_conversation_author_guard
before insert or update on public.conversation_messages
for each row execute function public.guard_team_conversation_author_v1();

create or replace function public.guard_team_context_answer_author_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  if public._team_request_is_service_role_v1()
     or not public._team_scope_is_configured_v1(new.account_id, new.artist_workspace_id, new.artist_id) then
    return new;
  end if;
  if new.created_by_user_id is distinct from auth.uid()
     or not exists (
       select 1 from public.account_memberships membership
       where membership.account_id = new.account_id
         and membership.user_id = auth.uid()
         and membership.status = 'active'
         and membership.role in ('owner', 'member')
     ) then
    raise exception 'TEAM_FORBIDDEN';
  end if;
  return new;
end;
$$;

drop trigger if exists team_context_answer_author_guard on public.manager_context_answers;
create trigger team_context_answer_author_guard
before insert or update on public.manager_context_answers
for each row execute function public.guard_team_context_answer_author_v1();

-- Existing document approval remains available to solo callers. A Team member
-- cannot use the authenticated approval RPC to bypass owner authority.
create or replace function public.guard_team_document_approval_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  if tg_op = 'UPDATE'
     and new.status = 'accepted'
     and old.status is distinct from new.status
     and not public._team_request_is_service_role_v1()
     and public._team_scope_is_configured_v1(new.account_id, new.artist_workspace_id, new.artist_id)
     and not exists (
       select 1 from public.account_memberships membership
       where membership.account_id = new.account_id
         and membership.user_id = auth.uid()
         and membership.status = 'active'
         and membership.role = 'owner'
     ) then
    raise exception 'TEAM_FORBIDDEN';
  end if;
  return new;
end;
$$;

drop trigger if exists team_document_approval_guard on public.documents;
create trigger team_document_approval_guard
before update on public.documents
for each row execute function public.guard_team_document_approval_v1();

revoke all on function public._team_request_is_service_role_v1() from public, anon, authenticated;
revoke all on function public._team_scope_is_configured_v1(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.validate_team_task_assignment_v1() from public, anon, authenticated;
revoke all on function public.guard_team_task_direct_write_v1() from public, anon, authenticated;
revoke all on function public.guard_team_service_owned_write_v1() from public, anon, authenticated;
revoke all on function public.guard_team_operating_event_write_v1() from public, anon, authenticated;
revoke all on function public.guard_team_conversation_author_v1() from public, anon, authenticated;
revoke all on function public.guard_team_context_answer_author_v1() from public, anon, authenticated;
revoke all on function public.guard_team_document_approval_v1() from public, anon, authenticated;
revoke all on function public.assert_workspace_operation_v1(uuid, uuid, uuid, uuid, text, uuid) from public, anon, authenticated;
grant execute on function public._team_request_is_service_role_v1() to service_role;
grant execute on function public._team_scope_is_configured_v1(uuid, uuid, uuid) to service_role;
grant execute on function public.assert_workspace_operation_v1(uuid, uuid, uuid, uuid, text, uuid) to service_role;

alter function public._team_request_is_service_role_v1() owner to postgres;
alter function public._team_scope_is_configured_v1(uuid, uuid, uuid) owner to postgres;
alter function public.assert_workspace_operation_v1(uuid, uuid, uuid, uuid, text, uuid) owner to postgres;
alter function public.validate_team_task_assignment_v1() owner to postgres;
alter function public.guard_team_task_direct_write_v1() owner to postgres;
alter function public.guard_team_service_owned_write_v1() owner to postgres;
alter function public.guard_team_operating_event_write_v1() owner to postgres;
alter function public.guard_team_conversation_author_v1() owner to postgres;
alter function public.guard_team_context_answer_author_v1() owner to postgres;
alter function public.guard_team_document_approval_v1() owner to postgres;

notify pgrst, 'reload schema';
