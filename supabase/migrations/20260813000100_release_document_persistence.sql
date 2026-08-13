-- Atomic canonical Files persistence for Manager-created song documents.

create or replace function public.persist_focused_song_document_v1(
  p_account_id uuid,
  p_artist_workspace_id uuid,
  p_artist_id uuid,
  p_music_item_id uuid,
  p_document_type text,
  p_title text,
  p_body text,
  p_run_id uuid default null,
  p_manager_output_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_document public.documents%rowtype;
  v_version_id uuid;
  v_version_number integer;
  v_mission_id uuid;
  v_created boolean := false;
begin
  if p_document_type not in ('epk','spotify_editorial_pitch','playlist_pitch','press_target_brief','press_pitch','content_plan','release_calendar','press_release','press_angle','artist_biography','one_sheet','lyrics','credits','distributor_notes') then
    raise exception 'song_document_type_invalid';
  end if;
  if nullif(trim(p_title), '') is null or length(trim(p_title)) > 240
    or nullif(trim(p_body), '') is null or length(p_body) > 60000 then
    raise exception 'song_document_content_invalid';
  end if;
  if not exists (
    select 1 from public.music_items item
    where item.id = p_music_item_id and item.account_id = p_account_id
      and item.artist_workspace_id = p_artist_workspace_id and item.artist_id = p_artist_id
  ) then
    raise exception 'song_document_subject_not_found';
  end if;

  perform pg_advisory_xact_lock(hashtext('song-document:' || p_music_item_id::text || ':' || p_document_type));

  select plan.mission_id into v_mission_id
  from public.music_release_plans plan
  where plan.music_item_id = p_music_item_id and plan.account_id = p_account_id
    and plan.artist_workspace_id = p_artist_workspace_id and plan.artist_id = p_artist_id
  for update;

  select document.* into v_document
  from public.documents document
  join public.artifact_links link on link.source_type = 'document' and link.source_id = document.id
  where document.account_id = p_account_id and document.artist_workspace_id = p_artist_workspace_id
    and document.artist_id = p_artist_id and document.origin = 'manager_generated'
    and document.document_type = p_document_type and link.target_type = 'music_item'
    and link.target_id = p_music_item_id and link.relationship = 'references'
  order by document.updated_at desc, document.id
  limit 1
  for update of document;

  if not found then
    insert into public.documents (
      account_id, artist_workspace_id, artist_id, title, document_type, origin,
      status, summary, created_by_type, created_from_run_id
    ) values (
      p_account_id, p_artist_workspace_id, p_artist_id, trim(p_title), p_document_type,
      'manager_generated', 'draft', 'Manager draft for ' || trim(p_title) || '.', 'agent', p_run_id
    ) returning * into v_document;
    v_created := true;
  end if;

  select coalesce(max(version.version_number), 0) + 1 into v_version_number
  from public.document_versions version where version.document_id = v_document.id;

  insert into public.document_versions (
    account_id, artist_workspace_id, artist_id, document_id, version_number,
    manager_output_id, file_type, extraction_status, metadata, created_from_run_id
  ) values (
    p_account_id, p_artist_workspace_id, p_artist_id, v_document.id, v_version_number,
    p_manager_output_id, 'text/markdown', 'not_required', jsonb_build_object('body', p_body), p_run_id
  ) returning id into v_version_id;

  update public.documents set current_version_id = v_version_id, status = 'draft',
    created_from_run_id = p_run_id, title = trim(p_title), updated_at = now()
  where id = v_document.id;

  insert into public.artifact_links (account_id, artist_workspace_id, artist_id, source_type, source_id, target_type, target_id, relationship, created_from_run_id)
  select p_account_id, p_artist_workspace_id, p_artist_id, 'document', v_document.id, 'music_item', p_music_item_id, 'references', p_run_id
  where not exists (select 1 from public.artifact_links where source_type = 'document' and source_id = v_document.id and target_type = 'music_item' and target_id = p_music_item_id and relationship = 'references');

  if v_mission_id is not null then
    insert into public.artifact_links (account_id, artist_workspace_id, artist_id, source_type, source_id, target_type, target_id, relationship, created_from_run_id)
    select p_account_id, p_artist_workspace_id, p_artist_id, 'document', v_document.id, 'mission', v_mission_id, 'references', p_run_id
    where not exists (select 1 from public.artifact_links where source_type = 'document' and source_id = v_document.id and target_type = 'mission' and target_id = v_mission_id and relationship = 'references');
  end if;

  if p_manager_output_id is not null then
    insert into public.artifact_links (account_id, artist_workspace_id, artist_id, source_type, source_id, target_type, target_id, relationship, created_from_run_id)
    select p_account_id, p_artist_workspace_id, p_artist_id, 'manager_output', p_manager_output_id, 'music_item', p_music_item_id, 'references', p_run_id
    where not exists (select 1 from public.artifact_links where source_type = 'manager_output' and source_id = p_manager_output_id and target_type = 'music_item' and target_id = p_music_item_id and relationship = 'references');

    if v_mission_id is not null then
      insert into public.artifact_links (account_id, artist_workspace_id, artist_id, source_type, source_id, target_type, target_id, relationship, created_from_run_id)
      select p_account_id, p_artist_workspace_id, p_artist_id, 'manager_output', p_manager_output_id, 'mission', v_mission_id, 'references', p_run_id
      where not exists (select 1 from public.artifact_links where source_type = 'manager_output' and source_id = p_manager_output_id and target_type = 'mission' and target_id = v_mission_id and relationship = 'references');
    end if;
  end if;

  insert into public.operating_events (
    account_id, artist_workspace_id, artist_id, event_type, actor_type, target_type,
    target_id, source_type, source_id, mission_id, display_mode, refresh_scope, summary, payload
  ) values (
    p_account_id, p_artist_workspace_id, p_artist_id, 'song_document_created', 'manager',
    'music_item', p_music_item_id, 'document', v_document.id, v_mission_id, 'activity',
    array['music-list','activity'], trim(p_title) || ' is ready to review in Files.',
    jsonb_build_object('document_id', v_document.id, 'document_type', p_document_type, 'version_id', v_version_id, 'mission_id', v_mission_id)
  );

  return jsonb_build_object(
    'documentId', v_document.id, 'versionId', v_version_id, 'musicItemId', p_music_item_id,
    'missionId', v_mission_id, 'documentType', p_document_type, 'title', trim(p_title),
    'status', 'draft', 'created', v_created
  );
end;
$$;

revoke all on function public.persist_focused_song_document_v1(uuid,uuid,uuid,uuid,text,text,text,uuid,uuid) from public, anon, authenticated;
grant execute on function public.persist_focused_song_document_v1(uuid,uuid,uuid,uuid,text,text,text,uuid,uuid) to service_role;

notify pgrst, 'reload schema';
