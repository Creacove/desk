-- Keep song documents canonical across Files, Manager, Missions, and sharing.

alter table public.music_share_links
  add column if not exists information_manifest jsonb not null default '{}'::jsonb;

create index if not exists artifact_links_song_documents_idx
  on public.artifact_links (target_type, target_id, source_type)
  where target_type = 'music_item' and source_type = 'document';

notify pgrst, 'reload schema';
