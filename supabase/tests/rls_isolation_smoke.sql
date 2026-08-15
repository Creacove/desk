\set ON_ERROR_STOP on

begin;

insert into public.users (id, email, display_name, status)
values
  ('20000000-0000-0000-0000-000000000001', 'ci-a@example.com', 'CI A', 'active'),
  ('20000000-0000-0000-0000-000000000002', 'ci-b@example.com', 'CI B', 'active');

insert into public.accounts (id, name, plan, status)
values
  ('20000000-0000-0000-0000-000000000011', 'CI Account A', 'prototype', 'active'),
  ('20000000-0000-0000-0000-000000000012', 'CI Account B', 'prototype', 'active');

insert into public.artists (id, account_id, display_name)
values
  ('20000000-0000-0000-0000-000000000021', '20000000-0000-0000-0000-000000000011', 'Artist A'),
  ('20000000-0000-0000-0000-000000000022', '20000000-0000-0000-0000-000000000012', 'Artist B');

insert into public.artist_workspaces (id, account_id, artist_id, name, status)
values
  ('20000000-0000-0000-0000-000000000031', '20000000-0000-0000-0000-000000000011', '20000000-0000-0000-0000-000000000021', 'Workspace A', 'active'),
  ('20000000-0000-0000-0000-000000000032', '20000000-0000-0000-0000-000000000012', '20000000-0000-0000-0000-000000000022', 'Workspace B', 'active');

insert into public.account_memberships (account_id, user_id, role, status)
values
  ('20000000-0000-0000-0000-000000000011', '20000000-0000-0000-0000-000000000001', 'owner', 'active'),
  ('20000000-0000-0000-0000-000000000012', '20000000-0000-0000-0000-000000000002', 'owner', 'active');

insert into public.music_items (id, account_id, artist_workspace_id, artist_id, title, item_type, lifecycle_stage, status)
values
  ('20000000-0000-0000-0000-000000000041', '20000000-0000-0000-0000-000000000011', '20000000-0000-0000-0000-000000000031', '20000000-0000-0000-0000-000000000021', 'Song A', 'song', 'ready', 'active'),
  ('20000000-0000-0000-0000-000000000042', '20000000-0000-0000-0000-000000000012', '20000000-0000-0000-0000-000000000032', '20000000-0000-0000-0000-000000000022', 'Song B', 'song', 'ready', 'active');

insert into public.documents (id, account_id, artist_workspace_id, artist_id, title, document_type, origin, status)
values
  ('20000000-0000-0000-0000-000000000051', '20000000-0000-0000-0000-000000000011', '20000000-0000-0000-0000-000000000031', '20000000-0000-0000-0000-000000000021', 'A EPK', 'epk', 'manager_generated', 'accepted'),
  ('20000000-0000-0000-0000-000000000052', '20000000-0000-0000-0000-000000000012', '20000000-0000-0000-0000-000000000032', '20000000-0000-0000-0000-000000000022', 'B EPK', 'epk', 'manager_generated', 'accepted');

insert into public.music_share_links (
  id, account_id, artist_workspace_id, artist_id, music_item_id, label, preset, asset_manifest, information_manifest, token_hash, state
) values
  ('20000000-0000-0000-0000-000000000061', '20000000-0000-0000-0000-000000000011', '20000000-0000-0000-0000-000000000031', '20000000-0000-0000-0000-000000000021', '20000000-0000-0000-0000-000000000041', 'A package', 'epk_press', '[]'::jsonb, '{}'::jsonb, repeat('a', 64), 'active'),
  ('20000000-0000-0000-0000-000000000062', '20000000-0000-0000-0000-000000000012', '20000000-0000-0000-0000-000000000032', '20000000-0000-0000-0000-000000000022', '20000000-0000-0000-0000-000000000042', 'B package', 'epk_press', '[]'::jsonb, '{}'::jsonb, repeat('b', 64), 'active');

select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

do $$
declare
  v_count integer;
begin
  select count(*) into v_count from public.documents;
  if v_count <> 1 then
    raise exception 'RLS isolation failed for documents: user A saw % rows', v_count;
  end if;

  select count(*) into v_count from public.music_share_links;
  if v_count <> 1 then
    raise exception 'RLS isolation failed for share links: user A saw % rows', v_count;
  end if;

  begin
    insert into public.documents (
      account_id, artist_workspace_id, artist_id, title, document_type, origin, status
    ) values (
      '20000000-0000-0000-0000-000000000012',
      '20000000-0000-0000-0000-000000000032',
      '20000000-0000-0000-0000-000000000022',
      'Cross-account write', 'epk', 'user_uploaded', 'uploaded'
    );
    raise exception 'RLS isolation failed: cross-account document insert succeeded';
  exception
    when insufficient_privilege then
      null;
  end;
end;
$$;

reset role;
rollback;
