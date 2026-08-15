-- Allow Manager to prepare (never send) a frozen, revocable release package from
-- approved canonical Files content. The raw capability token is returned once to
-- the service-role caller and only its SHA-256 hash is persisted.

create or replace function public.prepare_focused_release_share_package_v1(
  p_account_id uuid,
  p_artist_workspace_id uuid,
  p_artist_id uuid,
  p_music_item_id uuid,
  p_preset text default 'epk_press',
  p_label text default null,
  p_opportunity_id uuid default null,
  p_run_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_music public.music_items%rowtype;
  v_opportunity public.release_opportunities%rowtype;
  v_share_link_id uuid;
  v_raw_token text;
  v_token_hash text;
  v_preset text;
  v_artist_name text;
  v_label text;
  v_asset_manifest jsonb := '[]'::jsonb;
  v_document_fields jsonb := '[]'::jsonb;
  v_information_manifest jsonb := '{}'::jsonb;
  v_asset_count integer := 0;
  v_document_count integer := 0;
begin
  if p_preset not in ('listen', 'epk_press', 'delivery', 'custom') then
    raise exception 'release_share_package_preset_invalid';
  end if;
  v_preset := p_preset;

  select item.* into v_music
  from public.music_items item
  where item.id = p_music_item_id
    and item.account_id = p_account_id
    and item.artist_workspace_id = p_artist_workspace_id
    and item.artist_id = p_artist_id;
  if not found then
    raise exception 'release_share_package_song_not_found';
  end if;

  if p_opportunity_id is not null then
    select opportunity.* into v_opportunity
    from public.release_opportunities opportunity
    where opportunity.id = p_opportunity_id
      and opportunity.account_id = p_account_id
      and opportunity.artist_workspace_id = p_artist_workspace_id
      and opportunity.artist_id = p_artist_id
      and opportunity.music_item_id = p_music_item_id;
    if not found then
      raise exception 'release_share_package_opportunity_not_found';
    end if;
    if v_opportunity.safety_state = 'excluded' or v_opportunity.status = 'skipped' then
      raise exception 'release_share_package_opportunity_not_allowed';
    end if;
  end if;

  select coalesce(profile.display_name, '') into v_artist_name
  from public.artist_profiles profile
  where profile.account_id = p_account_id
    and profile.artist_workspace_id = p_artist_workspace_id
    and profile.artist_id = p_artist_id
  order by profile.updated_at desc
  limit 1;
  v_artist_name := coalesce(v_artist_name, '');

  -- Freeze only uploaded/processed song assets that are useful to a recipient.
  select coalesce(jsonb_agg(asset_row.payload order by asset_row.priority, asset_row.updated_at desc), '[]'::jsonb)
  into v_asset_manifest
  from (
    select
      case asset.asset_type
        when 'final_master' then 1
        when 'clean_version' then 2
        when 'cover_art' then 3
        when 'press_photo' then 4
        when 'demo' then 5
        else 10
      end as priority,
      asset.updated_at,
      jsonb_build_object(
        'assetId', asset.id,
        'title', asset.title,
        'assetType', asset.asset_type,
        'fileName', uploaded.file_name,
        'fileType', uploaded.file_type,
        'bucket', uploaded.storage_bucket,
        'path', uploaded.storage_ref
      ) as payload
    from public.music_assets asset
    join public.uploaded_files uploaded on uploaded.id = asset.uploaded_file_id
    where asset.account_id = p_account_id
      and asset.artist_workspace_id = p_artist_workspace_id
      and asset.artist_id = p_artist_id
      and asset.music_item_id = p_music_item_id
      and asset.status in ('uploaded', 'confirmed')
      and uploaded.status in ('uploaded', 'processed')
      and asset.asset_type in ('final_master', 'clean_version', 'cover_art', 'press_photo', 'demo', 'pitch_asset')
    order by priority, asset.updated_at desc
    limit 8
  ) asset_row;

  -- Freeze approved/readable canonical document versions. Internal Release Narrative
  -- and unapproved Manager drafts are excluded in SQL even if a caller is compromised.
  select coalesce(jsonb_agg(document_row.payload order by document_row.priority, document_row.updated_at desc), '[]'::jsonb)
  into v_document_fields
  from (
    select
      case document.document_type
        when 'epk' then 1
        when 'one_sheet' then 2
        when 'artist_biography' then 3
        when 'press_release' then 4
        when 'press_angle' then 5
        when 'playlist_pitch' then 5
        when 'press_target_brief' then 6
        when 'press_pitch' then 7
        when 'spotify_editorial_pitch' then 7
        else 20
      end as priority,
      document.updated_at,
      jsonb_build_object(
        'key', 'document:' || document.id::text,
        'title', document.title,
        'value', version.metadata->>'body',
        'documentType', document.document_type,
        'versionId', version.id
      ) as payload
    from public.documents document
    join public.artifact_links link
      on link.account_id = p_account_id
      and link.artist_workspace_id = p_artist_workspace_id
      and link.artist_id = p_artist_id
      and link.source_type = 'document'
      and link.source_id = document.id
      and link.target_type = 'music_item'
      and link.target_id = p_music_item_id
      and link.relationship = 'references'
    join public.document_versions version on version.id = document.current_version_id
    where document.account_id = p_account_id
      and document.artist_workspace_id = p_artist_workspace_id
      and document.artist_id = p_artist_id
      and document.document_type <> 'release_narrative'
      and lower(trim(document.title)) <> 'release narrative'
      and nullif(trim(coalesce(version.metadata->>'body', '')), '') is not null
      and (
        (document.origin = 'manager_generated' and document.status = 'accepted')
        or (document.origin <> 'manager_generated' and document.status in ('uploaded', 'accepted'))
      )
      and (
        p_opportunity_id is null
        or (v_opportunity.opportunity_type = 'playlist' and document.document_type in ('epk','one_sheet','artist_biography','playlist_pitch','spotify_editorial_pitch'))
        or (v_opportunity.opportunity_type = 'press' and document.document_type in ('epk','one_sheet','artist_biography','press_release','press_angle','press_target_brief','press_pitch'))
      )
    order by priority, document.updated_at desc
    limit 12
  ) document_row;

  v_asset_count := jsonb_array_length(v_asset_manifest);
  v_document_count := jsonb_array_length(v_document_fields);
  if v_asset_count = 0 and v_document_count = 0 then
    raise exception 'release_share_package_no_approved_materials';
  end if;

  v_information_manifest := jsonb_build_object(
    'version', 2,
    'identity', jsonb_build_object('title', v_music.title, 'artist', v_artist_name),
    'fields', v_document_fields
  );

  v_raw_token := encode(gen_random_bytes(32), 'hex');
  v_token_hash := encode(digest(v_raw_token, 'sha256'), 'hex');
  v_label := coalesce(
    nullif(trim(p_label), ''),
    case when p_opportunity_id is not null
      then v_music.title || ' · ' || v_opportunity.target_name
      else v_music.title || ' private package'
    end
  );
  if length(v_label) > 180 then
    v_label := left(v_label, 180);
  end if;

  insert into public.music_share_links (
    account_id, artist_workspace_id, artist_id, music_item_id,
    label, access_mode, preset, asset_manifest, information_manifest,
    token_hash, state, created_from_run_id
  ) values (
    p_account_id, p_artist_workspace_id, p_artist_id, p_music_item_id,
    v_label, 'link', v_preset, v_asset_manifest, v_information_manifest,
    v_token_hash, 'active', p_run_id
  ) returning id into v_share_link_id;

  if p_opportunity_id is not null then
    insert into public.artifact_links (
      account_id, artist_workspace_id, artist_id,
      source_type, source_id, target_type, target_id, relationship, created_from_run_id
    )
    select p_account_id, p_artist_workspace_id, p_artist_id,
      'music_share_link', v_share_link_id, 'release_opportunity', p_opportunity_id, 'references', p_run_id
    where not exists (
      select 1 from public.artifact_links
      where source_type = 'music_share_link' and source_id = v_share_link_id
        and target_type = 'release_opportunity' and target_id = p_opportunity_id
        and relationship = 'references'
    );

    update public.release_opportunities
    set package_json = coalesce(package_json, '{}'::jsonb) || jsonb_build_object(
      'shareLinkId', v_share_link_id,
      'preparedAt', now(),
      'preset', v_preset,
      'documentCount', v_document_count,
      'assetCount', v_asset_count
    )
    where id = p_opportunity_id;
  end if;

  insert into public.operating_events (
    account_id, artist_workspace_id, artist_id, event_type, actor_type,
    target_type, target_id, source_type, source_id, manager_synthesis_run_id,
    display_mode, refresh_scope, summary, payload
  ) values (
    p_account_id, p_artist_workspace_id, p_artist_id,
    'music_share_link_prepared', 'manager', 'music_item', p_music_item_id,
    'music_share_link', v_share_link_id, p_run_id,
    'activity', array['music-list','activity'],
    'Manager prepared a private release package for review.',
    jsonb_build_object(
      'share_link_id', v_share_link_id,
      'opportunity_id', p_opportunity_id,
      'preset', v_preset,
      'document_count', v_document_count,
      'asset_count', v_asset_count
    )
  );

  return jsonb_build_object(
    'status', 'prepared',
    'shareLinkId', v_share_link_id,
    'rawToken', v_raw_token,
    'label', v_label,
    'preset', v_preset,
    'musicItemId', p_music_item_id,
    'opportunityId', p_opportunity_id,
    'documentCount', v_document_count,
    'assetCount', v_asset_count
  );
end;
$$;

revoke all on function public.prepare_focused_release_share_package_v1(uuid,uuid,uuid,uuid,text,text,uuid,uuid) from public, anon, authenticated;
grant execute on function public.prepare_focused_release_share_package_v1(uuid,uuid,uuid,uuid,text,text,uuid,uuid) to service_role;

notify pgrst, 'reload schema';
