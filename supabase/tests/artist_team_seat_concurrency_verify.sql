\set ON_ERROR_STOP on

-- This verification runs after independent psql connections have raced invite,
-- acceptance, and member-removal RPCs. It checks committed state, not source
-- strings or a sequential simulation.
do $$
declare
  active_seats integer;
  reserved_seats integer;
  accepted_count integer;
  inactive_count integer;
  task_assignee uuid;
  task_version integer;
  reminder_status text;
  rls_enabled boolean;
  routine_name text;
begin
  select count(*) into active_seats
  from public.account_memberships
  where account_id = '91000000-0000-4000-8000-000000000001'
    and status = 'active' and role in ('owner', 'member');
  select count(*) into reserved_seats
  from public.account_invitations
  where account_id = '91000000-0000-4000-8000-000000000001'
    and status = 'pending' and expires_at > now();
  if active_seats + reserved_seats > 6 then
    raise exception 'Team seat invariant exceeded: active %, reserved %', active_seats, reserved_seats;
  end if;
  if active_seats <> 1 or reserved_seats <> 4 then
    raise exception 'Expected owner plus four remaining reservations after races, got active % reserved %', active_seats, reserved_seats;
  end if;

  select count(*) into accepted_count
  from public.account_invitations
  where account_id = '91000000-0000-4000-8000-000000000001' and status = 'accepted';
  if accepted_count <> 1 then raise exception 'Expected one idempotently accepted invitation, got %', accepted_count; end if;

  select count(*) into inactive_count
  from public.account_memberships
  where account_id = '91000000-0000-4000-8000-000000000001'
    and user_id = '91000000-0000-4000-8000-000000000005' and status = 'inactive';
  if inactive_count <> 1 then raise exception 'Removed member was not committed as inactive'; end if;

  select assignee_user_id, assignment_version into task_assignee, task_version
  from public.tasks where id = '91000000-0000-4000-8000-000000000006';
  if task_assignee is not null or task_version <> 1 then
    raise exception 'Removal must unassign current work and increment version, got assignee % version %', task_assignee, task_version;
  end if;

  select status into reminder_status
  from public.reminder_queue where dedupe_key = 'team-concurrency-reminder-v1';
  if reminder_status <> 'cancelled' then raise exception 'Removed member reminder was not cancelled: %', reminder_status; end if;

  for routine_name in select unnest(array[
    'invite_account_member_v1', 'rotate_account_invitation_v1',
    'revoke_account_invitation_v1', 'accept_account_invitation_v1',
    'remove_account_member_v1', 'update_member_responsibilities_v1',
    'reassign_workspace_task_v1'
  ]) loop
    if exists (
      select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = routine_name
        and has_function_privilege('authenticated', p.oid, 'EXECUTE')
    ) then
      raise exception 'Authenticated role can execute service-only Team RPC %', routine_name;
    end if;
  end loop;

  for routine_name in select unnest(array['workspace_team_settings','account_invitations','account_team_request_log']) loop
    select c.relrowsecurity into rls_enabled
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = routine_name;
    if coalesce(rls_enabled, false) is not true then raise exception 'RLS is not enabled on %', routine_name; end if;
  end loop;
end $$;

-- Exercise the policies as an authenticated outsider, rather than merely
-- checking relrowsecurity metadata while connected as the postgres superuser.
begin;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"91000000-0000-4000-8000-000000000007","role":"authenticated"}',
  true
);
do $$
declare
  visible_invitations integer;
begin
  select count(*) into visible_invitations
  from public.account_invitations
  where account_id = '91000000-0000-4000-8000-000000000001';
  if visible_invitations <> 0 then
    raise exception 'Outsider can read private Team invitations';
  end if;

  begin
    insert into public.workspace_team_settings (account_id, artist_workspace_id, artist_id, enabled)
    values (
      '91000000-0000-4000-8000-000000000001',
      '91000000-0000-4000-8000-000000000003',
      '91000000-0000-4000-8000-000000000002',
      false
    );
    raise exception 'Authenticated outsider unexpectedly wrote Team settings';
  exception
    when insufficient_privilege then null;
  end;
end $$;
rollback;

-- No raw token is returned by list/read records and all fixture hashes are
-- lower-case SHA-256 strings.
do $$
begin
  if exists (
    select 1 from public.account_invitations
    where account_id = '91000000-0000-4000-8000-000000000001'
      and token_hash !~ '^[0-9a-f]{64}$'
  ) then raise exception 'Invitation token hash invariant failed'; end if;
end $$;
