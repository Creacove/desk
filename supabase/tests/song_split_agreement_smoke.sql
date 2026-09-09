\set ON_ERROR_STOP on

begin;

do $$
declare
  v_account_id uuid := '30000000-0000-0000-0000-000000000001';
  v_artist_id uuid := '30000000-0000-0000-0000-000000000002';
  v_workspace_id uuid := '30000000-0000-0000-0000-000000000003';
  v_song_id uuid := '30000000-0000-0000-0000-000000000004';
  v_split_id uuid := '30000000-0000-0000-0000-000000000005';
  v_agreement_id uuid := '30000000-0000-0000-0000-000000000006';
  v_version_id uuid;
  v_participant_a uuid := '30000000-0000-0000-0000-000000000007';
  v_participant_b uuid := '30000000-0000-0000-0000-000000000008';
  v_request_id uuid;
  v_request_b_id uuid;
  v_vector_id uuid := '30000000-0000-0000-0000-000000000009';
  v_image_id uuid := '30000000-0000-0000-0000-000000000010';
  v_receipt jsonb;
  v_second_receipt jsonb;
  v_lock_retry jsonb;
  v_invalidation jsonb;
  v_repeat_invalidation jsonb;
  v_snapshot jsonb;
  v_readiness jsonb;
begin
  if not exists (
    select 1 from pg_type t join pg_enum e on e.enumtypid = t.oid
    where t.typnamespace = 'public'::regnamespace and t.typname = 'split_agreement_version_status'
      and e.enumlabel = 'expired'
  ) then
    raise exception 'version status enum is missing expired';
  end if;
  if not exists (select 1 from pg_trigger where tgrelid = 'public.split_agreement_participants'::regclass and tgname = 'split_agreement_participants_immutable_guard') then
    raise exception 'participant insert/update/delete guard is missing';
  end if;
  if not exists (select 1 from pg_trigger where tgrelid = 'public.split_agreement_versions'::regclass and tgname = 'split_agreement_versions_executed_guard') then
    raise exception 'executed artifact gate is missing';
  end if;
  if not exists (select 1 from pg_constraint where conname = 'split_agreement_events_participant_fk') then
    raise exception 'event participant scope FK is missing';
  end if;
  if to_regprocedure('public.lock_split_agreement_version_v1(uuid,jsonb,text,text,text,boolean,text,text)') is null then
    raise exception 'lock RPC signature is not installed';
  end if;
  if to_regprocedure('public.invalidate_split_signature_requests_v1(uuid,text,public.split_agreement_version_status,text)') is null then
    raise exception 'invalidate RPC signature is not installed';
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.split_agreement_versions'::regclass and contype = 'u' and pg_get_constraintdef(oid) like '%(document_id)%') then
    raise exception 'document id is not globally unique';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'split_agreement_artifacts_storage_service') then
    raise exception 'private split agreement storage policy is missing';
  end if;
  if not has_column_privilege('authenticated', 'public.split_signatures', 'version_id', 'SELECT') then
    raise exception 'authenticated lost split signature select grant';
  end if;
  if has_table_privilege('authenticated', 'public.split_signatures', 'INSERT') then
    raise exception 'authenticated can forge split signatures';
  end if;
  if has_table_privilege('authenticated', 'public.split_agreement_events', 'UPDATE') then
    raise exception 'authenticated can mutate append-only events';
  end if;
  if has_function_privilege('authenticated', to_regprocedure('public.submit_split_signature_v1(uuid,uuid,uuid,text,public.split_signature_kind,uuid,uuid,text,text,public.split_agreement_signing_authority,text,text,text,text,text,text,text,text,text,text,text)'), 'EXECUTE') then
    raise exception 'authenticated can call signature submission RPC';
  end if;
  if not has_function_privilege('service_role', to_regprocedure('public.submit_split_signature_v1(uuid,uuid,uuid,text,public.split_signature_kind,uuid,uuid,text,text,public.split_agreement_signing_authority,text,text,text,text,text,text,text,text,text,text,text)'), 'EXECUTE') then
    raise exception 'service role cannot call signature submission RPC';
  end if;

  insert into public.accounts(id, name) values (v_account_id, 'Split smoke account');
  insert into public.artists(id, account_id, display_name) values (v_artist_id, v_account_id, 'Split smoke artist');
  insert into public.artist_workspaces(id, account_id, artist_id, name, status)
  values (v_workspace_id, v_account_id, v_artist_id, 'Split smoke workspace', 'active');
  insert into public.music_items(id, account_id, artist_workspace_id, artist_id, title, item_type, lifecycle_stage, status)
  values (v_song_id, v_account_id, v_workspace_id, v_artist_id, 'Smoke Song', 'song', 'ready', 'active');
  insert into public.music_splits(id, account_id, artist_workspace_id, artist_id, music_item_id, status)
  values (v_split_id, v_account_id, v_workspace_id, v_artist_id, v_song_id, 'draft');
  insert into public.split_agreements(id, account_id, artist_workspace_id, artist_id, music_item_id, music_split_id, status)
  values (v_agreement_id, v_account_id, v_workspace_id, v_artist_id, v_song_id, v_split_id, 'draft');

  begin
    perform public.lock_split_agreement_version_v1(
      v_agreement_id,
      jsonb_build_object('metadata', jsonb_build_object('workTitle', 'Invalid'), 'participants', jsonb_build_array()),
      'terms-v1', 'consent-v1', repeat('a', 64), true, 'invalid smoke lock', 'smoke-invalid-lock'
    );
    raise exception 'lock accepted an empty participant snapshot';
  exception when others then
    if sqlerrm = 'lock accepted an empty participant snapshot' then raise; end if;
  end;

  select (public.lock_split_agreement_version_v1(
    v_agreement_id,
    jsonb_build_object(
      'metadata', jsonb_build_object(
        'workTitle', 'Smoke Song',
        'recordingTitle', 'Smoke Song - Main Version',
        'agreementDate', '2026-09-09',
        'dateCreated', '2026-09-01',
        'releaseScheduledOrReleased', false,
        'iswc', null,
        'isrc', null,
        'coordinatorParticipantId', v_participant_a,
        'coordinatorName', 'Ada Smoke',
        'coordinatorRole', 'Contributor'
      ),
      'participants', jsonb_build_array(
        jsonb_build_object('id', v_participant_a, 'legalName', 'Ada Smoke', 'stageName', null, 'participantType', 'individual', 'signingAuthority', 'self', 'parentGuardianLegalName', null, 'parentGuardianRelationship', null, 'organisationName', null, 'signingCapacity', null, 'roles', jsonb_build_array('songwriter'), 'otherRole', null, 'email', 'ada@example.test', 'telephone', '+234800000001', 'rightsSocietyMemberId', null, 'ipiCaeNumber', null, 'performing', 50, 'mechanical', 50, 'neighbouring', null, 'signatureRequired', true, 'nonSigningReason', null, 'displayOrder', 1),
        jsonb_build_object('id', v_participant_b, 'legalName', 'Bea Smoke', 'stageName', null, 'participantType', 'individual', 'signingAuthority', 'self', 'parentGuardianLegalName', null, 'parentGuardianRelationship', null, 'organisationName', null, 'signingCapacity', null, 'roles', jsonb_build_array('producer'), 'otherRole', null, 'email', 'bea@example.test', 'telephone', '+234800000002', 'rightsSocietyMemberId', null, 'ipiCaeNumber', null, 'performing', 50, 'mechanical', 50, 'neighbouring', null, 'signatureRequired', true, 'nonSigningReason', null, 'displayOrder', 2)
      )
    ),
    'terms-v1',
    'consent-v1',
    repeat('a', 64),
    true,
    'smoke lock',
    'smoke-lock'
  ) ->> 'versionId')::uuid into v_version_id;

  if not exists (select 1 from public.split_agreement_versions where id = v_version_id and status = 'ready_to_send' and document_id ~ '^OS-SA-[0-9]{4}-[0-9]{6}$') then
    raise exception 'locking RPC did not create a stable ready-to-send version';
  end if;
  if (select count(*) from public.split_agreement_participants where version_id = v_version_id) <> 2 then
    raise exception 'locking RPC did not snapshot participants';
  end if;
  begin
    insert into public.split_agreement_participants (
      id, version_id, account_id, artist_workspace_id, artist_id, legal_name,
      participant_type, signing_authority, participant_roles, email, telephone,
      performing, mechanical, signature_required, display_order
    ) values (
      '30000000-0000-0000-0000-000000000011', v_version_id, v_account_id,
      v_workspace_id, v_artist_id, 'Locked Insert', 'individual', 'self',
      array['songwriter']::public.split_agreement_participant_role[], 'locked@example.test', '+234800000011',
      100, 100, true, 3
    );
    raise exception 'locked version accepted a participant insert';
  exception when others then
    if sqlerrm = 'locked version accepted a participant insert' then raise; end if;
  end;
  begin
    update public.split_agreement_versions set status = 'executed' where id = v_version_id;
    raise exception 'version executed without signatures and final artifacts';
  exception when others then
    if sqlerrm = 'version executed without signatures and final artifacts' then raise; end if;
  end;
  select canonical_snapshot into v_snapshot from public.split_agreement_versions where id = v_version_id;
  v_lock_retry := public.lock_split_agreement_version_v1(v_agreement_id, v_snapshot, 'terms-v1', 'consent-v1', repeat('a', 64), true, 'smoke lock', 'smoke-lock');
  if v_lock_retry ->> 'versionId' <> v_version_id::text or v_lock_retry ->> 'receiptId' <> (select lock_receipt_id from public.split_agreement_versions where id = v_version_id) then
    raise exception 'lock retry did not return the original version receipt';
  end if;

  insert into public.split_agreement_artifacts(account_id, artist_workspace_id, artist_id, version_id, kind, storage_key, sha256, content_type, byte_length)
  values
    (v_account_id, v_workspace_id, v_artist_id, v_version_id, 'pre_signature_pdf', '30000000/smoke/pre.pdf', repeat('a', 64), 'application/pdf', 10),
    (v_account_id, v_workspace_id, v_artist_id, v_version_id, 'signature_vector', '30000000/smoke/a.vec', repeat('b', 64), 'application/json', 10),
    (v_account_id, v_workspace_id, v_artist_id, v_version_id, 'signature_image', '30000000/smoke/a.png', repeat('c', 64), 'image/png', 10)
  ;
  select id into v_vector_id from public.split_agreement_artifacts where storage_key = '30000000/smoke/a.vec';
  select id into v_image_id from public.split_agreement_artifacts where storage_key = '30000000/smoke/a.png';
  update public.split_agreement_versions
  set pre_signature_pdf_asset_id = (select id from public.split_agreement_artifacts where storage_key = '30000000/smoke/pre.pdf'),
      pre_signature_sha256 = repeat('a', 64)
  where id = v_version_id;

  insert into public.split_signature_requests(account_id, artist_workspace_id, artist_id, version_id, participant_id, capability_token_hash, otp_hash, status, expires_at, idempotency_key)
  values (v_account_id, v_workspace_id, v_artist_id, v_version_id, v_participant_a, repeat('d', 64), repeat('e', 64), 'verified', now() + interval '1 hour', 'smoke-request-a')
  returning id into v_request_id;

  v_receipt := public.submit_split_signature_v1(
    v_version_id, v_participant_a, v_request_id, (select pre_signature_sha256 from public.split_agreement_versions where id = v_version_id), 'participant', v_vector_id, v_image_id, repeat('9', 64), 'Ada Smoke', 'self', null, null, null, null, null, 'consent-v1', 'I agree', 'Africa/Lagos', repeat('f', 64), repeat('1', 64), 'smoke-signature-a'
  );
  v_second_receipt := public.submit_split_signature_v1(
    v_version_id, v_participant_a, v_request_id, (select pre_signature_sha256 from public.split_agreement_versions where id = v_version_id), 'participant', v_vector_id, v_image_id, repeat('9', 64), 'Ada Smoke', 'self', null, null, null, null, null, 'consent-v1', 'I agree', 'Africa/Lagos', repeat('f', 64), repeat('1', 64), 'smoke-signature-a'
  );
  if v_receipt ->> 'receiptId' is null or v_receipt ->> 'receiptId' <> v_second_receipt ->> 'receiptId' then
    raise exception 'duplicate signature submission did not return the original receipt';
  end if;
  if (select count(*) from public.split_signatures where idempotency_key = 'smoke-signature-a') <> 1 then
    raise exception 'signature idempotency created more than one evidence row';
  end if;

  insert into public.split_signature_requests(account_id, artist_workspace_id, artist_id, version_id, participant_id, capability_token_hash, otp_hash, status, expires_at, idempotency_key)
  values (v_account_id, v_workspace_id, v_artist_id, v_version_id, v_participant_b, repeat('1', 64), repeat('2', 64), 'verified', now() + interval '1 hour', 'smoke-request-b')
  returning id into v_request_b_id;

  v_readiness := public.can_finalize_split_agreement_v1(v_version_id);
  if coalesce((v_readiness ->> 'canFinalize')::boolean, true) then
    raise exception 'finalization readiness ignored unsigned required participant';
  end if;

  v_invalidation := public.invalidate_split_signature_requests_v1(v_version_id, 'correction requested', 'correction_requested', 'smoke-invalidate');
  v_repeat_invalidation := public.invalidate_split_signature_requests_v1(v_version_id, 'correction requested', 'correction_requested', 'smoke-invalidate');
  if v_invalidation ->> 'eventId' is null or v_invalidation ->> 'eventId' <> v_repeat_invalidation ->> 'eventId' then
    raise exception 'invalidation retry did not return the original event receipt';
  end if;
  if (select count(*) from public.split_agreement_events where version_id = v_version_id and idempotency_key = 'smoke-invalidate') <> 1 then
    raise exception 'invalidation retry created more than one event';
  end if;
  if (select status from public.split_signature_requests where id = v_request_id) <> 'signed' then
    raise exception 'request invalidation incorrectly changed a completed request';
  end if;
  if (select status from public.split_signature_requests where id = v_request_b_id) <> 'superseded' then
    raise exception 'request invalidation did not supersede the unsigned request';
  end if;
end;
$$;

rollback;
