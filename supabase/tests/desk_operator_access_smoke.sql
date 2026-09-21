\set ON_ERROR_STOP on

begin;

insert into public.users (id, email, display_name, status)
values
  ('71000000-0000-0000-0000-000000000001', 'operator-access-ci@example.com', 'Operator Access CI', 'active'),
  ('71000000-0000-0000-0000-000000000002', 'inactive-operator-ci@example.com', 'Inactive Operator CI', 'active'),
  ('71000000-0000-0000-0000-000000000003', 'not-operator-ci@example.com', 'Not Operator CI', 'active');

insert into public.accounts (id, name, plan, status)
values
  ('71000000-0000-0000-0000-000000000011', 'Operator Access Account A', 'prototype', 'active'),
  ('71000000-0000-0000-0000-000000000012', 'Operator Access Account B', 'prototype', 'active');

insert into public.artists (id, account_id, display_name)
values
  ('71000000-0000-0000-0000-000000000021', '71000000-0000-0000-0000-000000000011', 'Operator Access Artist A'),
  ('71000000-0000-0000-0000-000000000022', '71000000-0000-0000-0000-000000000012', 'Operator Access Artist B');

insert into public.artist_workspaces (id, account_id, artist_id, name, status)
values
  ('71000000-0000-0000-0000-000000000031', '71000000-0000-0000-0000-000000000011', '71000000-0000-0000-0000-000000000021', 'Operator Workspace A', 'active'),
  ('71000000-0000-0000-0000-000000000032', '71000000-0000-0000-0000-000000000012', '71000000-0000-0000-0000-000000000022', 'Operator Workspace B', 'active');

insert into public.ordersounds_operators (user_id, active)
values
  ('71000000-0000-0000-0000-000000000001', true),
  ('71000000-0000-0000-0000-000000000002', false);

insert into public.artist_profiles (account_id, artist_workspace_id, artist_id, display_name)
values
  ('71000000-0000-0000-0000-000000000011', '71000000-0000-0000-0000-000000000031', '71000000-0000-0000-0000-000000000021', 'Operator Profile A'),
  ('71000000-0000-0000-0000-000000000012', '71000000-0000-0000-0000-000000000032', '71000000-0000-0000-0000-000000000022', 'Operator Profile B');

insert into public.music_items (id, account_id, artist_workspace_id, artist_id, title, item_type, lifecycle_stage, status)
values
  ('71000000-0000-0000-0000-000000000041', '71000000-0000-0000-0000-000000000011', '71000000-0000-0000-0000-000000000031', '71000000-0000-0000-0000-000000000021', 'Operator Song A', 'song', 'ready', 'active'),
  ('71000000-0000-0000-0000-000000000042', '71000000-0000-0000-0000-000000000012', '71000000-0000-0000-0000-000000000032', '71000000-0000-0000-0000-000000000022', 'Operator Song B', 'song', 'ready', 'active');

insert into public.missions (id, account_id, artist_workspace_id, artist_id, title, objective, status)
values
  ('71000000-0000-0000-0000-000000000051', '71000000-0000-0000-0000-000000000011', '71000000-0000-0000-0000-000000000021', 'Operator Mission A', 'Operator objective', 'active');

update private.operator_access_config
set enabled = false, updated_at = now(), updated_by = null
where singleton;

select set_config('request.jwt.claims', '{"sub":"71000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from public.artist_profiles
  where artist_workspace_id = '71000000-0000-0000-0000-000000000031';
  if v_count <> 0 then
    raise exception 'disabled operator access exposed % rows', v_count;
  end if;
end;
$$;

reset role;
update private.operator_access_config
set enabled = true, updated_at = now(), updated_by = '71000000-0000-0000-0000-000000000001'
where singleton;

select set_config('request.jwt.claims', '{"sub":"71000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.artist_profiles;
  if v_count <> 1 then
    raise exception 'active operator saw % artist profile rows; expected one targeted workspace', v_count;
  end if;

  select count(*) into v_count from public.music_items;
  if v_count <> 1 then
    raise exception 'active operator saw % music rows; expected one targeted workspace', v_count;
  end if;

  begin
    insert into public.music_items (account_id, artist_workspace_id, artist_id, title, item_type, lifecycle_stage, status)
    values ('71000000-0000-0000-0000-000000000011', '71000000-0000-0000-0000-000000000031', '71000000-0000-0000-0000-000000000021', 'Operator Write', 'song', 'ready', 'active');
    raise exception 'operator inserted a Desk-domain row';
  exception
    when insufficient_privilege then null;
  end;

  begin
    update public.music_items
    set title = 'Operator Update'
    where artist_workspace_id = '71000000-0000-0000-0000-000000000031';
    raise exception 'operator updated a Desk-domain row';
  exception
    when insufficient_privilege then null;
  end;

  begin
    delete from public.music_items
    where artist_workspace_id = '71000000-0000-0000-0000-000000000031';
    raise exception 'operator deleted a Desk-domain row';
  exception
    when insufficient_privilege then null;
  end;

  if has_table_privilege('authenticated', 'public.account_memberships', 'INSERT') then
    raise exception 'authenticated role can insert account memberships';
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claims', '{"sub":"71000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.artist_profiles;
  if v_count <> 0 then
    raise exception 'inactive operator saw % rows', v_count;
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claims', '{"sub":"71000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;

do $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.artist_profiles;
  if v_count <> 0 then
    raise exception 'non-operator saw % rows', v_count;
  end if;
end;
$$;

reset role;
rollback;
