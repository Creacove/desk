\set ON_ERROR_STOP on

begin;

-- Real database smoke for the narrative-first document transaction.
-- This runs after the complete migration history on a fresh local Supabase DB.
do $$
declare
  v_account_id uuid := '10000000-0000-0000-0000-000000000001';
  v_artist_id uuid := '10000000-0000-0000-0000-000000000002';
  v_workspace_id uuid := '10000000-0000-0000-0000-000000000003';
  v_song_id uuid := '10000000-0000-0000-0000-000000000004';
  v_share_link_id uuid := '10000000-0000-0000-0000-000000000005';
  v_opportunity_id uuid := '10000000-0000-0000-0000-000000000006';
  v_first jsonb;
  v_second jsonb;
  v_third jsonb;
  v_press_angle jsonb;
  v_package jsonb;
  v_narrative_document_id uuid;
  v_press_angle_document_id uuid;
  v_prepared_share_link_id uuid;
  v_version_count integer;
  v_status text;
  v_stale jsonb;
  v_snapshot jsonb;
  v_stored_token_hash text;
  v_raw_token text;
  v_package_fields jsonb;
begin
  insert into public.accounts (id, name, plan, status)
  values (v_account_id, 'CI account', 'prototype', 'active');

  insert into public.artists (id, account_id, display_name)
  values (v_artist_id, v_account_id, 'CI Artist');

  insert into public.artist_workspaces (id, account_id, artist_id, name, status)
  values (v_workspace_id, v_account_id, v_artist_id, 'CI Workspace', 'active');

  insert into public.music_items (
    id, account_id, artist_workspace_id, artist_id, title, item_type, lifecycle_stage, status
  ) values (
    v_song_id, v_account_id, v_workspace_id, v_artist_id, 'Down Below', 'song', 'ready', 'active'
  );

  -- Recipient-facing campaign collateral must not exist before the internal narrative.
  begin
    perform public.persist_focused_song_document_v2(
      v_account_id, v_workspace_id, v_artist_id, v_song_id,
      'epk', 'Down Below EPK', '# EPK', '{}'::jsonb,
      '{"warnings":[]}'::jsonb, null, null
    );
    raise exception 'expected narrative-first guard to reject EPK';
  exception
    when others then
      if sqlerrm not like 'song_document_release_narrative_required:%' then
        raise;
      end if;
  end;

  -- The temporary press_angle transport must persist as the canonical internal type.
  v_first := public.persist_focused_song_document_v2(
    v_account_id, v_workspace_id, v_artist_id, v_song_id,
    'press_angle', 'Release narrative', '# Internal campaign strategy\n\nVersion one.',
    '{"purpose":"strategy"}'::jsonb,
    '{"warnings":[],"blockers":[],"score":100}'::jsonb,
    null, null
  );

  if v_first->>'documentType' <> 'release_narrative' then
    raise exception 'release narrative alias did not canonicalize: %', v_first;
  end if;

  v_narrative_document_id := (v_first->>'documentId')::uuid;

  -- Re-running the narrative must version the same canonical document, never duplicate it.
  v_second := public.persist_focused_song_document_v2(
    v_account_id, v_workspace_id, v_artist_id, v_song_id,
    'press_angle', 'Release narrative', '# Internal campaign strategy\n\nVersion two.',
    '{"purpose":"strategy"}'::jsonb,
    '{"warnings":[],"blockers":[],"score":100}'::jsonb,
    null, null
  );

  if (v_second->>'documentId')::uuid <> v_narrative_document_id then
    raise exception 'release narrative created a duplicate canonical document';
  end if;

  select count(*) into v_version_count
  from public.document_versions
  where document_id = v_narrative_document_id;

  if v_version_count <> 2 then
    raise exception 'expected 2 narrative versions, found %', v_version_count;
  end if;

  -- A genuine Press Angle must remain a separate artifact after the narrative exists.
  v_press_angle := public.persist_focused_song_document_v2(
    v_account_id, v_workspace_id, v_artist_id, v_song_id,
    'press_angle', 'Late-night restraint angle', '# Press angle\n\nA real recipient-facing angle.',
    '{"purpose":"press"}'::jsonb,
    '{"warnings":[],"blockers":[],"score":100}'::jsonb,
    null, null
  );

  v_press_angle_document_id := (v_press_angle->>'documentId')::uuid;
  if v_press_angle_document_id = v_narrative_document_id then
    raise exception 'press angle collided with the internal release narrative';
  end if;

  if not exists (
    select 1 from public.documents
    where id = v_narrative_document_id and document_type = 'release_narrative'
  ) then
    raise exception 'canonical release_narrative document was not stored';
  end if;

  if not exists (
    select 1 from public.documents
    where id = v_press_angle_document_id and document_type = 'press_angle'
  ) then
    raise exception 'genuine press_angle document was not stored separately';
  end if;

  -- Approve recipient-facing material and prove Manager package preparation against the real schema.
  update public.documents
  set status = 'accepted'
  where id in (v_narrative_document_id, v_press_angle_document_id);

  insert into public.release_opportunities (
    id, account_id, artist_workspace_id, artist_id, music_item_id,
    opportunity_type, target_name, source_url, safety_state, status, dedupe_key
  ) values (
    v_opportunity_id, v_account_id, v_workspace_id, v_artist_id, v_song_id,
    'press', 'CI Press Target', 'https://example.com/ci-press', 'clear', 'shortlisted', 'ci-press-target'
  );

  v_package := public.prepare_focused_release_share_package_v1(
    v_account_id, v_workspace_id, v_artist_id, v_song_id,
    'epk_press', null, v_opportunity_id, null
  );

  v_prepared_share_link_id := (v_package->>'shareLinkId')::uuid;
  v_raw_token := v_package->>'rawToken';

  if v_package->>'status' <> 'prepared' or v_raw_token !~ '^[0-9a-f]{64}$' then
    raise exception 'Manager package receipt is invalid: %', v_package;
  end if;

  select token_hash, information_manifest->'fields'
  into v_stored_token_hash, v_package_fields
  from public.music_share_links
  where id = v_prepared_share_link_id;

  if v_stored_token_hash = v_raw_token or v_stored_token_hash <> encode(digest(v_raw_token, 'sha256'), 'hex') then
    raise exception 'raw package token was stored or hash is incorrect';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_package_fields) field
    where field->>'documentType' = 'release_narrative'
       or lower(trim(field->>'title')) = 'release narrative'
  ) then
    raise exception 'internal Release Narrative leaked into prepared package';
  end if;

  if not exists (
    select 1
    from jsonb_array_elements(v_package_fields) field
    where field->>'documentType' = 'press_angle'
      and field->>'value' like '%recipient-facing angle%'
  ) then
    raise exception 'approved Press Angle was not frozen into prepared package';
  end if;

  if (select package_json->>'shareLinkId' from public.release_opportunities where id = v_opportunity_id) <> v_prepared_share_link_id::text then
    raise exception 'opportunity package relationship was not persisted';
  end if;

  if not exists (
    select 1 from public.artifact_links
    where source_type = 'music_share_link'
      and source_id = v_prepared_share_link_id
      and target_type = 'release_opportunity'
      and target_id = v_opportunity_id
      and relationship = 'references'
  ) then
    raise exception 'share link was not durably linked to the opportunity';
  end if;

  -- Simulate a separate frozen package created before a source-of-truth change.
  insert into public.music_share_links (
    id, account_id, artist_workspace_id, artist_id, music_item_id, label, preset,
    asset_manifest, information_manifest, token_hash, state
  ) values (
    v_share_link_id, v_account_id, v_workspace_id, v_artist_id, v_song_id,
    'Frozen CI package', 'epk_press', '[]'::jsonb,
    '{"version":2,"identity":{"title":"Down Below","artist":"CI Artist"},"fields":[{"key":"document:test","title":"Press angle","value":"Frozen recipient copy"}]}'::jsonb,
    repeat('c', 64), 'active'
  );

  -- Changing a release-plan fact must invalidate canonical Manager campaign artifacts.
  update public.music_items
  set planned_release_date = current_date + 14
  where id = v_song_id;

  select status, metadata->'stale'
  into v_status, v_stale
  from public.documents
  where id = v_press_angle_document_id;

  if v_status <> 'needs_revision' or v_stale is null then
    raise exception 'source change did not mark campaign artifact stale: status %, stale %', v_status, v_stale;
  end if;

  select information_manifest into v_snapshot
  from public.music_share_links
  where id = v_share_link_id;

  if v_snapshot #>> '{fields,0,value}' <> 'Frozen recipient copy' then
    raise exception 'existing share snapshot mutated after canonical source change';
  end if;

  -- Refreshing the canonical narrative creates a new version and clears its stale marker.
  v_third := public.persist_focused_song_document_v2(
    v_account_id, v_workspace_id, v_artist_id, v_song_id,
    'press_angle', 'Release narrative', '# Internal campaign strategy\n\nRefreshed after date change.',
    '{"purpose":"strategy"}'::jsonb,
    '{"warnings":[],"blockers":[],"score":100}'::jsonb,
    null, null
  );

  select status, metadata->'stale'
  into v_status, v_stale
  from public.documents
  where id = v_narrative_document_id;

  if v_status <> 'draft' or v_stale is not null then
    raise exception 'refreshed narrative did not clear staleness: status %, stale %', v_status, v_stale;
  end if;
end;
$$;

rollback;
