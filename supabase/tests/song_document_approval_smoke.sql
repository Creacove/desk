\set ON_ERROR_STOP on

begin;

insert into public.users (id, email, display_name, status)
values ('30000000-0000-0000-0000-000000000001', 'approval-ci@example.com', 'Approval CI', 'active');

insert into public.accounts (id, name, plan, status)
values ('30000000-0000-0000-0000-000000000011', 'Approval CI Account', 'prototype', 'active');

insert into public.artists (id, account_id, display_name)
values ('30000000-0000-0000-0000-000000000021', '30000000-0000-0000-0000-000000000011', 'Approval CI Artist');

insert into public.artist_workspaces (id, account_id, artist_id, name, status)
values ('30000000-0000-0000-0000-000000000031', '30000000-0000-0000-0000-000000000011', '30000000-0000-0000-0000-000000000021', 'Approval CI Workspace', 'active');

insert into public.account_memberships (account_id, user_id, role, status)
values ('30000000-0000-0000-0000-000000000011', '30000000-0000-0000-0000-000000000001', 'owner', 'active');

insert into public.music_items (id, account_id, artist_workspace_id, artist_id, title, item_type, lifecycle_stage, status)
values ('30000000-0000-0000-0000-000000000041', '30000000-0000-0000-0000-000000000011', '30000000-0000-0000-0000-000000000031', '30000000-0000-0000-0000-000000000021', 'Approval Song', 'song', 'ready', 'active');

-- Seed one ready narrative and one ready external artifact through the real v2 transaction.
select public.persist_focused_song_document_v2(
  '30000000-0000-0000-0000-000000000011',
  '30000000-0000-0000-0000-000000000031',
  '30000000-0000-0000-0000-000000000021',
  '30000000-0000-0000-0000-000000000041',
  'press_angle', 'Release narrative', '# Internal campaign strategy',
  '{"purpose":"strategy"}'::jsonb,
  '{"score":100,"readiness":"ready","blockers":[],"warnings":[],"passed":[],"requiredSections":[],"schemaVersion":"song_document_v2"}'::jsonb,
  null, null
);

select public.persist_focused_song_document_v2(
  '30000000-0000-0000-0000-000000000011',
  '30000000-0000-0000-0000-000000000031',
  '30000000-0000-0000-0000-000000000021',
  '30000000-0000-0000-0000-000000000041',
  'press_angle', 'Approval press angle', '# Approval press angle',
  '{"purpose":"press"}'::jsonb,
  '{"score":100,"readiness":"ready","blockers":[],"warnings":[],"passed":[],"requiredSections":[],"schemaVersion":"song_document_v2"}'::jsonb,
  null, null
);

-- A second external artifact can be persisted for review but must not be approvable yet.
select public.persist_focused_song_document_v2(
  '30000000-0000-0000-0000-000000000011',
  '30000000-0000-0000-0000-000000000031',
  '30000000-0000-0000-0000-000000000021',
  '30000000-0000-0000-0000-000000000041',
  'one_sheet', 'Approval one-sheet', '# Approval one-sheet',
  '{"purpose":"recipient"}'::jsonb,
  '{"score":82,"readiness":"needs_review","blockers":[],"warnings":["needs a verified contact"],"passed":[],"requiredSections":[],"schemaVersion":"song_document_v2"}'::jsonb,
  null, null
);

select set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

do $$
declare
  v_press_id uuid;
  v_narrative_id uuid;
  v_review_id uuid;
  v_receipt jsonb;
begin
  select id into v_press_id
  from public.documents
  where account_id = '30000000-0000-0000-0000-000000000011'
    and title = 'Approval press angle';

  select id into v_narrative_id
  from public.documents
  where account_id = '30000000-0000-0000-0000-000000000011'
    and document_type = 'release_narrative';

  select id into v_review_id
  from public.documents
  where account_id = '30000000-0000-0000-0000-000000000011'
    and title = 'Approval one-sheet';

  v_receipt := public.approve_song_document_for_sharing_v1(
    '30000000-0000-0000-0000-000000000011',
    '30000000-0000-0000-0000-000000000031',
    '30000000-0000-0000-0000-000000000021',
    v_press_id
  );
  if v_receipt->>'status' <> 'accepted' then
    raise exception 'quality-ready Manager document was not approved: %', v_receipt;
  end if;

  if (select status from public.documents where id = v_press_id) <> 'accepted' then
    raise exception 'approved document status was not persisted';
  end if;

  begin
    perform public.approve_song_document_for_sharing_v1(
      '30000000-0000-0000-0000-000000000011',
      '30000000-0000-0000-0000-000000000031',
      '30000000-0000-0000-0000-000000000021',
      v_narrative_id
    );
    raise exception 'internal Release Narrative was approvable';
  exception
    when others then
      if sqlerrm <> 'song_document_approval_internal_narrative' then raise; end if;
  end;

  begin
    perform public.approve_song_document_for_sharing_v1(
      '30000000-0000-0000-0000-000000000011',
      '30000000-0000-0000-0000-000000000031',
      '30000000-0000-0000-0000-000000000021',
      v_review_id
    );
    raise exception 'needs-review Manager document was approvable';
  exception
    when others then
      if sqlerrm <> 'song_document_approval_needs_review' then raise; end if;
  end;
end;
$$;

reset role;
rollback;
