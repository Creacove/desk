\set ON_ERROR_STOP on
begin;

do $$
declare
  operator_id uuid := '61000000-0000-0000-0000-000000000001';
  non_operator_id uuid := '61000000-0000-0000-0000-000000000007';
  account_id uuid := '61000000-0000-0000-0000-000000000002';
  artist_id uuid := '61000000-0000-0000-0000-000000000003';
  workspace_id uuid := '61000000-0000-0000-0000-000000000004';
  case_id uuid := '61000000-0000-0000-0000-000000000005';
  meeting_id uuid := '61000000-0000-0000-0000-000000000006';
  today_count integer;
begin
  if to_regclass('public.ordersounds_operators') is null
    or to_regclass('public.ops_cases') is null
    or to_regclass('public.ops_meetings') is null
    or to_regclass('public.ops_followups') is null
    or to_regclass('public.ops_activity') is null then
    raise exception 'Ops control-plane tables are missing';
  end if;

  if not has_table_privilege('authenticated', 'public.ops_cases', 'INSERT')
    or has_table_privilege('anon', 'public.ops_cases', 'SELECT') then
    raise exception 'Ops table grants are not private';
  end if;
  if not has_function_privilege('authenticated', 'public.list_ops_today_v1(timestamptz)', 'EXECUTE')
    or has_function_privilege('anon', 'public.list_ops_today_v1(timestamptz)', 'EXECUTE') then
    raise exception 'Ops Today RPC grants are incorrect';
  end if;

  insert into public.accounts (id, name) values (account_id, 'Ops smoke account');
  insert into public.users (id, email, display_name) values (operator_id, 'ops-smoke@example.com', 'Ops Smoke');
  insert into public.users (id, email, display_name) values (non_operator_id, 'ops-non-operator-smoke@example.com', 'Non Operator');
  insert into public.artists (id, account_id, display_name) values (artist_id, account_id, 'Ops Smoke Artist');
  insert into public.artist_workspaces (id, account_id, artist_id, name, status)
  values (workspace_id, account_id, artist_id, 'Ops Smoke Workspace', 'active');
  insert into public.ordersounds_operators (user_id) values (operator_id);

  perform set_config('request.jwt.claims', json_build_object('sub', operator_id::text, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', operator_id::text, true);

  insert into public.ops_cases (
    id, display_name, primary_contact_handle, source, release_timing, music_url, stage
  ) values (
    case_id, 'Ops Smoke Case', '@ops-smoke', 'smoke', 'upcoming', 'https://example.com/smoke', 'activation'
  );
  insert into public.ops_meetings (
    id, ops_case_id, meeting_type, scheduled_at, completed_at, transcript, processing_status
  ) values (
    meeting_id, case_id, 'onboarding', now(), now(), 'Transcript smoke', 'unprocessed'
  );
  insert into public.ops_followups (ops_case_id, due_at, kind)
  values (case_id, now() - interval '1 hour', 'Smoke follow-up');

  if not exists (select 1 from public.ops_activity where ops_case_id = case_id and event_type = 'case_created') then
    raise exception 'Case activity was not recorded';
  end if;
  select count(*) into today_count
  from public.list_ops_today_v1(now()) as today_item
  where today_item.case_id = case_id;
  if today_count < 2 then
    raise exception 'Today did not derive meeting/follow-up work from source records';
  end if;

  if (select desk_workspace_id from public.link_ops_case_workspace_v1(case_id, workspace_id, null)) <> workspace_id then
    raise exception 'Desk workspace link RPC did not link the case';
  end if;
  if (select stage from public.ops_cases where id = case_id) <> 'active' then
    raise exception 'Workspace link RPC did not promote activation case to active';
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', non_operator_id::text, 'role', 'authenticated')::text, true);
  begin
    perform public.list_ops_today_v1(now());
    raise exception 'Non-operator unexpectedly received Ops data';
  exception
    when sqlstate '42501' then null;
  end;
end;
$$;

rollback;
