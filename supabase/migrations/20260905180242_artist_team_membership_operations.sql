-- Transactional Team membership and assignment mutations.
-- Lock order for every mutation: account, then invitation/membership/task.

create or replace function public._team_normalize_responsibilities_v1(
  p_operating_title text,
  p_responsibility_tags text[]
)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
declare
  title_value text := nullif(pg_catalog.btrim(coalesce(p_operating_title, '')), '');
  tags_value text[];
begin
  if title_value is not null and pg_catalog.char_length(title_value) > 80 then
    raise exception 'TEAM_BAD_INPUT';
  end if;
  if p_responsibility_tags is null then
    tags_value := '{}'::text[];
  else
    if exists (
      select 1
      from pg_catalog.unnest(p_responsibility_tags) as item(tag)
      where tag is null
        or pg_catalog.btrim(tag) = ''
        or pg_catalog.char_length(pg_catalog.btrim(tag)) > 48
    ) then
      raise exception 'TEAM_BAD_INPUT';
    end if;
    select coalesce(pg_catalog.array_agg(distinct pg_catalog.btrim(item.tag) order by pg_catalog.btrim(item.tag)), '{}'::text[])
    into tags_value
    from pg_catalog.unnest(p_responsibility_tags) as item(tag);
  end if;
  if pg_catalog.cardinality(tags_value) > 12 then
    raise exception 'TEAM_BAD_INPUT';
  end if;
  return pg_catalog.jsonb_build_object('operatingTitle', title_value, 'responsibilityTags', tags_value);
end;
$$;

create or replace function public._team_invitation_json_v1(p_invitation public.account_invitations)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'id', p_invitation.id,
    'artistWorkspaceId', p_invitation.artist_workspace_id,
    'email', p_invitation.email,
    'status', p_invitation.status,
    'expiresAt', p_invitation.expires_at,
    'operatingTitle', p_invitation.operating_title,
    'responsibilityTags', p_invitation.responsibility_tags
  );
$$;

create or replace function public._assert_team_owner_v1(
  p_actor_user_id uuid,
  p_artist_workspace_id uuid
)
returns public.artist_workspaces
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  workspace_row public.artist_workspaces%rowtype;
  capability jsonb;
  caller_role text := coalesce(auth.jwt()->>'role', '');
begin
  if p_actor_user_id is null or p_artist_workspace_id is null then
    raise exception 'TEAM_BAD_INPUT';
  end if;
  if caller_role <> 'service_role' and p_actor_user_id is distinct from auth.uid() then
    raise exception 'TEAM_FORBIDDEN';
  end if;

  select *
  into workspace_row
  from public.artist_workspaces workspace
  where workspace.id = p_artist_workspace_id;
  if not found then
    raise exception 'TEAM_NOT_FOUND';
  end if;

  perform 1
  from public.accounts account_row
  where account_row.id = workspace_row.account_id
  for update;

  if not exists (select 1 from auth.users auth_user where auth_user.id = p_actor_user_id)
     or not exists (
       select 1
       from public.users app_user
       where app_user.id = p_actor_user_id
         and app_user.status = 'active'
     )
     or not exists (
       select 1
       from public.account_memberships membership
       where membership.account_id = workspace_row.account_id
         and membership.user_id = p_actor_user_id
         and membership.role = 'owner'
         and membership.status = 'active'
     ) then
    raise exception 'TEAM_FORBIDDEN';
  end if;

  capability := public._workspace_team_capability_v1(p_artist_workspace_id);
  if not coalesce((capability->>'enabled')::boolean, false)
     or not coalesce((capability->>'entitled')::boolean, false) then
    raise exception 'TEAM_FORBIDDEN';
  end if;
  return workspace_row;
end;
$$;

create or replace function public.invite_account_member_v1(
  p_actor_user_id uuid,
  p_artist_workspace_id uuid,
  p_email text,
  p_token_hash text,
  p_operating_title text,
  p_responsibility_tags text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  workspace_row public.artist_workspaces%rowtype;
  invitation_row public.account_invitations%rowtype;
  email_value text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_email, '')));
  token_value text := pg_catalog.lower(coalesce(p_token_hash, ''));
  responsibilities jsonb;
  tags_value text[];
  title_value text;
  occupied_count integer;
  reserved_count integer;
begin
  if email_value !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
     or pg_catalog.char_length(email_value) > 254
     or token_value !~ '^[0-9a-f]{64}$' then
    raise exception 'TEAM_BAD_INPUT';
  end if;
  responsibilities := public._team_normalize_responsibilities_v1(p_operating_title, p_responsibility_tags);
  title_value := nullif(responsibilities->>'operatingTitle', '');
  select array_agg(value) into tags_value
  from jsonb_array_elements_text(responsibilities->'responsibilityTags') as item(value);
  tags_value := coalesce(tags_value, '{}'::text[]);

  workspace_row := public._assert_team_owner_v1(p_actor_user_id, p_artist_workspace_id);

  update public.account_invitations invitation
  set status = 'expired'
  where invitation.account_id = workspace_row.account_id
    and invitation.status = 'pending'
    and invitation.expires_at <= pg_catalog.now();

  if exists (
    select 1
    from public.account_memberships membership
    join public.users app_user on app_user.id = membership.user_id
    where membership.account_id = workspace_row.account_id
      and membership.status = 'active'
      and membership.role in ('owner', 'member')
      and pg_catalog.lower(app_user.email) = email_value
  ) then
    raise exception 'TEAM_CONFLICT';
  end if;
  -- encode(digest(...), 'hex') is used instead of a raw email in the log.
  if (
    select count(*)
    from public.account_team_request_log request_log
    where request_log.account_id = workspace_row.account_id
      and request_log.created_at > pg_catalog.now() - interval '1 hour'
  ) >= 20
  or (
    select count(*)
    from public.account_team_request_log request_log
    where request_log.account_id = workspace_row.account_id
      and request_log.normalized_email_hash = pg_catalog.encode(public.digest(pg_catalog.convert_to(email_value, 'UTF8'), 'sha256'), 'hex')
      and request_log.created_at > pg_catalog.now() - interval '1 hour'
  ) >= 3 then
    raise exception 'TEAM_RATE_LIMIT';
  end if;
  insert into public.account_team_request_log(account_id, normalized_email_hash, operation)
  values (
    workspace_row.account_id,
    pg_catalog.encode(public.digest(pg_catalog.convert_to(email_value, 'UTF8'), 'sha256'), 'hex'),
    'invite'
  );

  select count(*) into occupied_count
  from public.account_memberships membership
  where membership.account_id = workspace_row.account_id
    and membership.status = 'active'
    and membership.role in ('owner', 'member');
  select count(*) into reserved_count
  from public.account_invitations invitation
  where invitation.account_id = workspace_row.account_id
    and invitation.status = 'pending'
    and invitation.expires_at > pg_catalog.now();
  if occupied_count + reserved_count >= 6 then
    raise exception 'TEAM_CONFLICT';
  end if;

  begin
    insert into public.account_invitations(
      account_id, artist_workspace_id, artist_id, email, invited_by_user_id,
      token_hash, expires_at, operating_title, responsibility_tags
    ) values (
      workspace_row.account_id, workspace_row.id, workspace_row.artist_id, email_value,
      p_actor_user_id, token_value, pg_catalog.now() + interval '7 days', title_value, tags_value
    ) returning * into invitation_row;
  exception when unique_violation then
    raise exception 'TEAM_CONFLICT';
  end;
  return public._team_invitation_json_v1(invitation_row);
end;
$$;

create or replace function public.rotate_account_invitation_v1(
  p_actor_user_id uuid,
  p_invitation_id uuid,
  p_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  probe public.account_invitations%rowtype;
  invitation_row public.account_invitations%rowtype;
  workspace_row public.artist_workspaces%rowtype;
  token_value text := pg_catalog.lower(coalesce(p_token_hash, ''));
  occupied_count integer;
  reserved_count integer;
begin
  if p_invitation_id is null or token_value !~ '^[0-9a-f]{64}$' then
    raise exception 'TEAM_BAD_INPUT';
  end if;
  select * into probe from public.account_invitations invitation where invitation.id = p_invitation_id;
  if not found then raise exception 'TEAM_NOT_FOUND'; end if;
  workspace_row := public._assert_team_owner_v1(p_actor_user_id, probe.artist_workspace_id);
  select * into invitation_row
  from public.account_invitations invitation
  where invitation.id = p_invitation_id
    and invitation.account_id = workspace_row.account_id
    and invitation.artist_workspace_id = workspace_row.id
    and invitation.artist_id = workspace_row.artist_id
  for update;
  if not found then raise exception 'TEAM_NOT_FOUND'; end if;
  if invitation_row.status <> 'pending' then raise exception 'TEAM_GONE'; end if;

  -- Expired pending rows do not reserve a seat, but rotation may renew one
  -- only when the account still has room for the renewed reservation.
  select count(*) into occupied_count
  from public.account_memberships membership
  where membership.account_id = workspace_row.account_id
    and membership.status = 'active'
    and membership.role in ('owner', 'member');
  select count(*) into reserved_count
  from public.account_invitations invitation
  where invitation.account_id = workspace_row.account_id
    and invitation.status = 'pending'
    and invitation.expires_at > pg_catalog.now()
    and invitation.id <> invitation_row.id;
  if occupied_count + reserved_count >= 6 then raise exception 'TEAM_CONFLICT'; end if;

  if (
    select count(*) from public.account_team_request_log request_log
    where request_log.account_id = workspace_row.account_id
      and request_log.created_at > pg_catalog.now() - interval '1 hour'
  ) >= 20
  or (
    select count(*) from public.account_team_request_log request_log
    where request_log.account_id = workspace_row.account_id
      and request_log.normalized_email_hash = pg_catalog.encode(public.digest(pg_catalog.convert_to(invitation_row.email, 'UTF8'), 'sha256'), 'hex')
      and request_log.created_at > pg_catalog.now() - interval '1 hour'
  ) >= 3 then
    raise exception 'TEAM_RATE_LIMIT';
  end if;
  insert into public.account_team_request_log(account_id, normalized_email_hash, operation)
  values (
    workspace_row.account_id,
    pg_catalog.encode(public.digest(pg_catalog.convert_to(invitation_row.email, 'UTF8'), 'sha256'), 'hex'),
    'rotate_invite'
  );
  begin
    update public.account_invitations invitation
    set status = 'pending', token_hash = token_value, expires_at = pg_catalog.now() + interval '7 days'
    where invitation.id = invitation_row.id
    returning * into invitation_row;
  exception when unique_violation then
    raise exception 'TEAM_CONFLICT';
  end;
  return public._team_invitation_json_v1(invitation_row);
end;
$$;

create or replace function public.revoke_account_invitation_v1(
  p_actor_user_id uuid,
  p_invitation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  probe public.account_invitations%rowtype;
  workspace_row public.artist_workspaces%rowtype;
begin
  if p_invitation_id is null then raise exception 'TEAM_BAD_INPUT'; end if;
  select * into probe from public.account_invitations invitation where invitation.id = p_invitation_id;
  if not found then raise exception 'TEAM_NOT_FOUND'; end if;
  workspace_row := public._assert_team_owner_v1(p_actor_user_id, probe.artist_workspace_id);
  update public.account_invitations invitation
  set status = 'revoked'
  where invitation.id = p_invitation_id
    and invitation.account_id = workspace_row.account_id
    and invitation.artist_workspace_id = workspace_row.id
    and invitation.artist_id = workspace_row.artist_id
    and invitation.status = 'pending';
  if not found then raise exception 'TEAM_GONE'; end if;
  return pg_catalog.jsonb_build_object('ok', true);
end;
$$;

create or replace function public.accept_account_invitation_v1(
  p_actor_user_id uuid,
  p_email text,
  p_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  probe public.account_invitations%rowtype;
  invitation_row public.account_invitations%rowtype;
  workspace_row public.artist_workspaces%rowtype;
  existing_membership public.account_memberships%rowtype;
  email_value text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_email, '')));
  token_value text := pg_catalog.lower(coalesce(p_token_hash, ''));
  caller_role text := coalesce(auth.jwt()->>'role', '');
  occupied_count integer;
  reserved_count integer;
begin
  if p_actor_user_id is null
     or (caller_role <> 'service_role' and p_actor_user_id is distinct from auth.uid())
     or email_value !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
     or token_value !~ '^[0-9a-f]{64}$' then
    raise exception 'TEAM_BAD_INPUT';
  end if;
  if not exists (
    select 1 from auth.users auth_user
    where auth_user.id = p_actor_user_id
      and pg_catalog.lower(auth_user.email) = email_value
      and auth_user.email_confirmed_at is not null
  ) then
    raise exception 'TEAM_FORBIDDEN';
  end if;

  select * into probe
  from public.account_invitations invitation
  where invitation.token_hash = token_value;
  if not found then raise exception 'TEAM_NOT_FOUND'; end if;
  select * into workspace_row
  from public.artist_workspaces workspace
  where workspace.id = probe.artist_workspace_id
    and workspace.account_id = probe.account_id
    and workspace.artist_id = probe.artist_id;
  if not found then raise exception 'TEAM_NOT_FOUND'; end if;

  perform 1 from public.accounts account_row where account_row.id = workspace_row.account_id for update;
  select * into invitation_row
  from public.account_invitations invitation
  where invitation.id = probe.id
  for update;
  if not found then raise exception 'TEAM_NOT_FOUND'; end if;

  select * into existing_membership
  from public.account_memberships membership
  where membership.account_id = workspace_row.account_id
    and membership.user_id = p_actor_user_id
  for update;
  if invitation_row.status = 'accepted' and invitation_row.accepted_by_user_id = p_actor_user_id then
    if existing_membership.status = 'active' and existing_membership.role in ('owner', 'member') then
      return pg_catalog.jsonb_build_object(
        'accountId', workspace_row.account_id,
        'artistWorkspaceId', workspace_row.id,
        'artistId', workspace_row.artist_id
      );
    end if;
    raise exception 'TEAM_GONE';
  end if;
  if invitation_row.status <> 'pending' or invitation_row.expires_at <= pg_catalog.now() then
    update public.account_invitations invitation
    set status = 'expired'
    where invitation.id = invitation_row.id and invitation.status = 'pending';
    raise exception 'TEAM_GONE';
  end if;
  if invitation_row.email <> email_value then raise exception 'TEAM_FORBIDDEN'; end if;

  if not coalesce((public._workspace_team_capability_v1(workspace_row.id)->>'enabled')::boolean, false)
     or not coalesce((public._workspace_team_capability_v1(workspace_row.id)->>'entitled')::boolean, false) then
    raise exception 'TEAM_FORBIDDEN';
  end if;
  if existing_membership.id is not null and existing_membership.role = 'admin_support' then
    raise exception 'TEAM_FORBIDDEN';
  end if;

  select count(*) into occupied_count
  from public.account_memberships membership
  where membership.account_id = workspace_row.account_id
    and membership.status = 'active'
    and membership.role in ('owner', 'member');
  select count(*) into reserved_count
  from public.account_invitations invitation
  where invitation.account_id = workspace_row.account_id
    and invitation.status = 'pending'
    and invitation.expires_at > pg_catalog.now();
  if existing_membership.id is null or existing_membership.status <> 'active' then
    if occupied_count + reserved_count > 6 then raise exception 'TEAM_CONFLICT'; end if;
  end if;

  if exists (
    select 1 from public.users app_user
    where app_user.email = email_value and app_user.id <> p_actor_user_id
  ) then
    raise exception 'TEAM_CONFLICT';
  end if;
  insert into public.users(id, email, display_name, status)
  select auth_user.id,
    pg_catalog.lower(auth_user.email),
    coalesce(auth_user.raw_user_meta_data->>'name', auth_user.raw_user_meta_data->>'full_name'),
    'active'
  from auth.users auth_user
  where auth_user.id = p_actor_user_id
  on conflict (id) do update
    set email = excluded.email, status = 'active';

  insert into public.account_memberships(
    account_id, user_id, role, status, operating_title, responsibility_tags
  ) values (
    workspace_row.account_id, p_actor_user_id, 'member', 'active',
    invitation_row.operating_title, invitation_row.responsibility_tags
  )
  on conflict (account_id, user_id) do update
    set role = case when public.account_memberships.role = 'owner' then 'owner' else 'member' end,
        status = 'active',
        operating_title = excluded.operating_title,
        responsibility_tags = excluded.responsibility_tags;

  update public.account_invitations invitation
  set status = 'accepted', accepted_by_user_id = p_actor_user_id, accepted_at = pg_catalog.now()
  where invitation.id = invitation_row.id and invitation.status = 'pending';
  return pg_catalog.jsonb_build_object(
    'accountId', workspace_row.account_id,
    'artistWorkspaceId', workspace_row.id,
    'artistId', workspace_row.artist_id
  );
exception
  when unique_violation then
    raise exception 'TEAM_CONFLICT';
end;
$$;

create or replace function public.update_member_responsibilities_v1(
  p_actor_user_id uuid,
  p_artist_workspace_id uuid,
  p_member_user_id uuid,
  p_operating_title text,
  p_responsibility_tags text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  workspace_row public.artist_workspaces%rowtype;
  responsibilities jsonb;
  tags_value text[];
  title_value text;
begin
  if p_member_user_id is null then raise exception 'TEAM_BAD_INPUT'; end if;
  responsibilities := public._team_normalize_responsibilities_v1(p_operating_title, p_responsibility_tags);
  title_value := nullif(responsibilities->>'operatingTitle', '');
  select array_agg(value) into tags_value
  from jsonb_array_elements_text(responsibilities->'responsibilityTags') as item(value);
  tags_value := coalesce(tags_value, '{}'::text[]);
  workspace_row := public._assert_team_owner_v1(p_actor_user_id, p_artist_workspace_id);
  perform 1
  from public.account_memberships membership
  where membership.account_id = workspace_row.account_id
    and membership.user_id = p_member_user_id
  for update;
  update public.account_memberships membership
  set operating_title = title_value, responsibility_tags = tags_value
  where membership.account_id = workspace_row.account_id
    and membership.user_id = p_member_user_id
    and membership.status = 'active'
    and membership.role in ('owner', 'member');
  if not found then raise exception 'TEAM_NOT_FOUND'; end if;
  return pg_catalog.jsonb_build_object('ok', true);
end;
$$;

create or replace function public.remove_account_member_v1(
  p_actor_user_id uuid,
  p_artist_workspace_id uuid,
  p_member_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  workspace_row public.artist_workspaces%rowtype;
  member_row public.account_memberships%rowtype;
  affected_task record;
begin
  if p_member_user_id is null then raise exception 'TEAM_BAD_INPUT'; end if;
  workspace_row := public._assert_team_owner_v1(p_actor_user_id, p_artist_workspace_id);
  select * into member_row
  from public.account_memberships membership
  where membership.account_id = workspace_row.account_id
    and membership.user_id = p_member_user_id
  for update;
  if not found then raise exception 'TEAM_NOT_FOUND'; end if;
  if member_row.role = 'owner' then raise exception 'TEAM_FORBIDDEN'; end if;
  if member_row.role <> 'member' or member_row.status <> 'active' then raise exception 'TEAM_NOT_FOUND'; end if;

  update public.account_memberships membership
  set status = 'inactive'
  where membership.id = member_row.id and membership.status = 'active';

  for affected_task in
    select task.id
    from public.tasks task
    where task.account_id = workspace_row.account_id
      and task.artist_workspace_id = workspace_row.id
      and task.artist_id = workspace_row.artist_id
      and task.assignee_user_id = p_member_user_id
      and task.status in ('proposed', 'open', 'needs_approval', 'approved', 'in_progress', 'blocked', 'missed')
    for update
  loop
    update public.tasks task
    set assignee_user_id = null,
        assignment_reason = 'Assigned member was removed',
        assignment_source = 'owner',
        assignment_version = task.assignment_version + 1
    where task.id = affected_task.id;
  end loop;

  update public.reminder_queue reminder
  set status = 'cancelled', last_error = 'Assignment is no longer current'
  where reminder.account_id = workspace_row.account_id
    and reminder.artist_workspace_id = workspace_row.id
    and reminder.user_id = p_member_user_id
    and reminder.status in ('queued', 'processing');

  insert into public.operating_events(
    account_id, artist_workspace_id, artist_id, event_type, actor_type, actor_id,
    target_type, target_id, source_type, source_id, dedupe_key, display_mode,
    refresh_scope, summary, payload
  ) values (
    workspace_row.account_id, workspace_row.id, workspace_row.artist_id,
    'team_member_removed', 'user', p_actor_user_id, 'user', p_member_user_id,
    'team_membership', member_row.id,
    'team-member-removed:' || member_row.id::text || ':' || extract(epoch from pg_catalog.clock_timestamp())::bigint::text,
    'activity', array['team', 'today', 'activity']::text[],
    'A team member was removed and their open work needs an owner.',
    pg_catalog.jsonb_build_object('memberUserId', p_member_user_id)
  );
  return pg_catalog.jsonb_build_object('ok', true);
end;
$$;

create or replace function public.reassign_workspace_task_v1(
  p_actor_user_id uuid,
  p_task_id uuid,
  p_assignee_user_id uuid,
  p_expected_assignment_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  probe public.tasks%rowtype;
  task_row public.tasks%rowtype;
  workspace_row public.artist_workspaces%rowtype;
  changed boolean;
begin
  if p_task_id is null or p_expected_assignment_version is null or p_expected_assignment_version < 0 then
    raise exception 'TEAM_BAD_INPUT';
  end if;
  select * into probe from public.tasks task where task.id = p_task_id;
  if not found then raise exception 'TEAM_NOT_FOUND'; end if;
  workspace_row := public._assert_team_owner_v1(p_actor_user_id, probe.artist_workspace_id);
  select * into task_row
  from public.tasks task
  where task.id = p_task_id
    and task.account_id = workspace_row.account_id
    and task.artist_workspace_id = workspace_row.id
    and task.artist_id = workspace_row.artist_id
  for update;
  if not found then raise exception 'TEAM_NOT_FOUND'; end if;
  if task_row.assignment_version <> p_expected_assignment_version
     or task_row.status in ('completed', 'rejected', 'missed', 'archived', 'superseded') then
    raise exception 'TEAM_CONFLICT';
  end if;
  if task_row.work_mode = 'manager_work' then raise exception 'TEAM_CONFLICT'; end if;
  if p_assignee_user_id is not null and not exists (
    select 1
    from public.account_memberships membership
    join public.users app_user on app_user.id = membership.user_id
    where membership.account_id = task_row.account_id
      and membership.user_id = p_assignee_user_id
      and membership.status = 'active'
      and membership.role in ('owner', 'member')
      and app_user.status = 'active'
  ) then
    raise exception 'TEAM_BAD_INPUT';
  end if;

  changed := task_row.assignee_user_id is distinct from p_assignee_user_id;
  if changed then
    update public.tasks task
    set assignee_user_id = p_assignee_user_id,
        assignment_reason = 'Assigned by workspace owner',
        assignment_source = 'owner',
        assignment_version = task.assignment_version + 1
    where task.id = task_row.id
    returning * into task_row;
    insert into public.operating_events(
      account_id, artist_workspace_id, artist_id, event_type, actor_type, actor_id,
      target_type, target_id, source_type, source_id, dedupe_key, display_mode,
      refresh_scope, summary, payload
    ) values (
      task_row.account_id, task_row.artist_workspace_id, task_row.artist_id,
      'team_task_reassigned', 'user', p_actor_user_id, 'task', task_row.id,
      'team_assignment', task_row.id,
      'team-task-reassigned:' || task_row.id::text || ':' || task_row.assignment_version::text,
      'activity', array['team', 'today', 'missions', 'activity']::text[],
      case when p_assignee_user_id is null then 'Task moved to Needs an owner.' else 'Task assignment updated.' end,
      pg_catalog.jsonb_build_object('assigneeUserId', p_assignee_user_id, 'assignmentVersion', task_row.assignment_version)
    ) on conflict (artist_workspace_id, dedupe_key) where dedupe_key is not null do nothing;
  end if;
  return pg_catalog.jsonb_build_object(
    'taskId', task_row.id,
    'assigneeUserId', task_row.assignee_user_id,
    'assignmentVersion', task_row.assignment_version
  );
end;
$$;

revoke all on function public._team_normalize_responsibilities_v1(text, text[]) from public, anon, authenticated;
revoke all on function public._team_invitation_json_v1(public.account_invitations) from public, anon, authenticated;
revoke all on function public._assert_team_owner_v1(uuid, uuid) from public, anon, authenticated;
grant execute on function public._team_normalize_responsibilities_v1(text, text[]) to service_role;
grant execute on function public._team_invitation_json_v1(public.account_invitations) to service_role;
grant execute on function public._assert_team_owner_v1(uuid, uuid) to service_role;

revoke all on function public.invite_account_member_v1(uuid, uuid, text, text, text, text[]),
  public.rotate_account_invitation_v1(uuid, uuid, text),
  public.revoke_account_invitation_v1(uuid, uuid),
  public.accept_account_invitation_v1(uuid, text, text),
  public.remove_account_member_v1(uuid, uuid, uuid),
  public.update_member_responsibilities_v1(uuid, uuid, uuid, text, text[]),
  public.reassign_workspace_task_v1(uuid, uuid, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.invite_account_member_v1(uuid, uuid, text, text, text, text[]),
  public.rotate_account_invitation_v1(uuid, uuid, text),
  public.revoke_account_invitation_v1(uuid, uuid),
  public.accept_account_invitation_v1(uuid, text, text),
  public.remove_account_member_v1(uuid, uuid, uuid),
  public.update_member_responsibilities_v1(uuid, uuid, uuid, text, text[]),
  public.reassign_workspace_task_v1(uuid, uuid, uuid, integer)
  to service_role;

alter function public._team_normalize_responsibilities_v1(text, text[]) owner to postgres;
alter function public._team_invitation_json_v1(public.account_invitations) owner to postgres;
alter function public._assert_team_owner_v1(uuid, uuid) owner to postgres;
alter function public.invite_account_member_v1(uuid, uuid, text, text, text, text[]) owner to postgres;
alter function public.rotate_account_invitation_v1(uuid, uuid, text) owner to postgres;
alter function public.revoke_account_invitation_v1(uuid, uuid) owner to postgres;
alter function public.accept_account_invitation_v1(uuid, text, text) owner to postgres;
alter function public.remove_account_member_v1(uuid, uuid, uuid) owner to postgres;
alter function public.update_member_responsibilities_v1(uuid, uuid, uuid, text, text[]) owner to postgres;
alter function public.reassign_workspace_task_v1(uuid, uuid, uuid, integer) owner to postgres;

notify pgrst, 'reload schema';
