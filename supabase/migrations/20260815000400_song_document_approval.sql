-- Artist approval for Manager-built campaign documents. Approval preserves the
-- exact canonical version; it does not create or rewrite content.

create or replace function public.approve_song_document_for_sharing_v1(
  p_account_id uuid,
  p_artist_workspace_id uuid,
  p_artist_id uuid,
  p_document_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_document public.documents%rowtype;
  v_version public.document_versions%rowtype;
  v_quality jsonb;
  v_music_item_id uuid;
begin
  if not public.is_account_member(p_account_id) then
    raise exception 'song_document_approval_forbidden';
  end if;

  select document.* into v_document
  from public.documents document
  where document.id = p_document_id
    and document.account_id = p_account_id
    and document.artist_workspace_id = p_artist_workspace_id
    and document.artist_id = p_artist_id;
  if not found then
    raise exception 'song_document_approval_not_found';
  end if;

  if v_document.origin <> 'manager_generated' then
    raise exception 'song_document_approval_manager_only';
  end if;

  if v_document.document_type = 'release_narrative'
    or lower(trim(v_document.title)) = 'release narrative' then
    raise exception 'song_document_approval_internal_narrative';
  end if;

  if v_document.status = 'accepted' then
    return jsonb_build_object(
      'status', 'accepted',
      'documentId', v_document.id,
      'versionId', v_document.current_version_id,
      'alreadyAccepted', true
    );
  end if;

  if v_document.status <> 'draft' then
    raise exception 'song_document_approval_not_ready:%', v_document.status;
  end if;

  if v_document.current_version_id is null then
    raise exception 'song_document_approval_version_missing';
  end if;

  select version.* into v_version
  from public.document_versions version
  where version.id = v_document.current_version_id
    and version.document_id = v_document.id
    and version.account_id = p_account_id
    and version.artist_workspace_id = p_artist_workspace_id
    and version.artist_id = p_artist_id;
  if not found then
    raise exception 'song_document_approval_version_not_found';
  end if;

  v_quality := coalesce(v_version.metadata->'quality', '{}'::jsonb);
  if coalesce(v_quality->>'schemaVersion', v_version.metadata->>'schemaVersion', '') <> 'song_document_v2' then
    raise exception 'song_document_approval_quality_missing';
  end if;
  if coalesce(v_quality->>'readiness', '') <> 'ready' then
    raise exception 'song_document_approval_needs_review';
  end if;
  if jsonb_typeof(coalesce(v_quality->'blockers', '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(v_quality->'blockers', '[]'::jsonb)) > 0 then
    raise exception 'song_document_approval_blocked';
  end if;

  update public.documents
  set status = 'accepted',
      metadata = coalesce(metadata, '{}'::jsonb) - 'stale'
  where id = v_document.id;

  select link.target_id into v_music_item_id
  from public.artifact_links link
  where link.account_id = p_account_id
    and link.artist_workspace_id = p_artist_workspace_id
    and link.artist_id = p_artist_id
    and link.source_type = 'document'
    and link.source_id = v_document.id
    and link.target_type = 'music_item'
    and link.relationship = 'references'
  order by link.created_at desc
  limit 1;

  insert into public.operating_events (
    account_id, artist_workspace_id, artist_id,
    event_type, actor_type, target_type, target_id,
    source_type, source_id, display_mode, refresh_scope,
    summary, payload
  ) values (
    p_account_id, p_artist_workspace_id, p_artist_id,
    'song_document_approved', 'user',
    case when v_music_item_id is null then 'document' else 'music_item' end,
    coalesce(v_music_item_id, v_document.id),
    'document', v_document.id,
    'activity', array['music-list','activity'],
    v_document.title || ' approved for sharing.',
    jsonb_build_object(
      'document_id', v_document.id,
      'version_id', v_document.current_version_id,
      'document_type', v_document.document_type,
      'music_item_id', v_music_item_id
    )
  );

  return jsonb_build_object(
    'status', 'accepted',
    'documentId', v_document.id,
    'versionId', v_document.current_version_id,
    'alreadyAccepted', false
  );
end;
$$;

revoke all on function public.approve_song_document_for_sharing_v1(uuid,uuid,uuid,uuid) from public, anon;
grant execute on function public.approve_song_document_for_sharing_v1(uuid,uuid,uuid,uuid) to authenticated, service_role;

notify pgrst, 'reload schema';
