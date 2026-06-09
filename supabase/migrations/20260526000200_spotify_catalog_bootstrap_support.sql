-- Phase 2 support for Spotify catalog bootstrap.
-- Keeps raw public Spotify responses in source_snapshots before normalization.

alter table public.source_snapshots
  add column if not exists snapshot_type text,
  add column if not exists raw_payload jsonb;

alter table public.source_connections
  add column if not exists metadata jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'source_connections_unique_external_ref'
  ) then
    alter table public.source_connections
      add constraint source_connections_unique_external_ref
      unique (account_id, artist_workspace_id, provider_id, handle_or_external_ref);
  end if;
end;
$$;

create index if not exists source_snapshots_type_idx
  on public.source_snapshots (artist_workspace_id, snapshot_type, captured_at desc);

create index if not exists music_items_spotify_dedupe_idx
  on public.music_items ((metadata->>'dedupe_key'))
  where source_kind = 'spotify_public_catalog';

create index if not exists music_projects_spotify_dedupe_idx
  on public.music_projects ((metadata->>'dedupe_key'))
  where source_kind = 'spotify_public_catalog';
