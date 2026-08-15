-- Keep Manager-built campaign artifacts honest when their source-of-truth song data changes.
-- Existing public share links remain immutable snapshots because this only marks canonical Files
-- documents for revision; it never rewrites a music_share_links manifest.

create or replace function public.mark_song_campaign_documents_stale(
  p_music_item_id uuid,
  p_reason text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  if p_music_item_id is null then
    return 0;
  end if;

  update public.documents document
  set
    status = 'needs_revision',
    metadata = jsonb_set(
      coalesce(document.metadata, '{}'::jsonb),
      '{stale}',
      jsonb_build_object(
        'at', now(),
        'reason', coalesce(nullif(trim(p_reason), ''), 'source_of_truth_changed')
      ),
      true
    )
  where document.origin = 'manager_generated'
    and document.document_type in (
      'release_narrative',
      'epk',
      'spotify_editorial_pitch',
      'playlist_pitch',
      'press_target_brief',
      'press_pitch',
      'content_plan',
      'release_calendar',
      'press_release',
      'press_angle',
      'artist_biography',
      'one_sheet',
      'credits',
      'distributor_notes'
    )
    and document.status not in ('needs_revision', 'superseded', 'revoked', 'failed')
    and exists (
      select 1
      from public.artifact_links link
      where link.account_id = document.account_id
        and link.artist_workspace_id = document.artist_workspace_id
        and link.artist_id = document.artist_id
        and link.source_type = 'document'
        and link.source_id = document.id
        and link.target_type = 'music_item'
        and link.target_id = p_music_item_id
        and link.relationship = 'references'
    );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.mark_song_campaign_documents_stale(uuid,text) from public, anon, authenticated;
grant execute on function public.mark_song_campaign_documents_stale(uuid,text) to service_role;

create or replace function public.stale_campaign_documents_from_music_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.title is distinct from new.title
    or old.lifecycle_stage is distinct from new.lifecycle_stage
    or old.planned_release_date is distinct from new.planned_release_date
    or old.released_at is distinct from new.released_at
    or old.metadata is distinct from new.metadata then
    perform public.mark_song_campaign_documents_stale(new.id, 'song_identity_or_release_plan_changed');
  end if;
  return new;
end;
$$;

create or replace function public.stale_campaign_documents_from_music_child()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_music_item_id uuid;
begin
  if tg_op = 'DELETE' then
    v_music_item_id := old.music_item_id;
  else
    v_music_item_id := new.music_item_id;
  end if;

  if v_music_item_id is not null then
    perform public.mark_song_campaign_documents_stale(v_music_item_id, tg_table_name || '_changed');
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function public.clear_document_staleness_on_new_version()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.current_version_id is distinct from old.current_version_id then
    new.metadata := coalesce(new.metadata, '{}'::jsonb) - 'stale';
  end if;
  return new;
end;
$$;

drop trigger if exists music_items_campaign_documents_stale on public.music_items;
create trigger music_items_campaign_documents_stale
after update of title, lifecycle_stage, planned_release_date, released_at, metadata on public.music_items
for each row execute function public.stale_campaign_documents_from_music_item();

drop trigger if exists music_assets_campaign_documents_stale on public.music_assets;
create trigger music_assets_campaign_documents_stale
after insert or update or delete on public.music_assets
for each row execute function public.stale_campaign_documents_from_music_child();

drop trigger if exists music_credits_campaign_documents_stale on public.music_credits;
create trigger music_credits_campaign_documents_stale
after insert or update or delete on public.music_credits
for each row execute function public.stale_campaign_documents_from_music_child();

drop trigger if exists music_identifiers_campaign_documents_stale on public.music_identifiers;
create trigger music_identifiers_campaign_documents_stale
after insert or update or delete on public.music_identifiers
for each row execute function public.stale_campaign_documents_from_music_child();

drop trigger if exists music_splits_campaign_documents_stale on public.music_splits;
create trigger music_splits_campaign_documents_stale
after insert or update or delete on public.music_splits
for each row execute function public.stale_campaign_documents_from_music_child();

drop trigger if exists documents_clear_campaign_stale on public.documents;
create trigger documents_clear_campaign_stale
before update of current_version_id on public.documents
for each row execute function public.clear_document_staleness_on_new_version();

notify pgrst, 'reload schema';
