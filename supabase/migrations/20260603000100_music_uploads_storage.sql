-- Production Music upload storage.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'music-uploads',
  'music-uploads',
  false,
  5368709120,
  array[
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/x-wav',
    'audio/aiff',
    'audio/flac',
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'text/plain',
    'text/csv',
    'application/json',
    'application/zip',
    'application/x-zip-compressed'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.uploaded_files (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  uploaded_by_user_id uuid references public.users(id),
  file_name text not null,
  file_type text,
  classification text not null check (
    classification in (
      'spotify_for_artists_export',
      'royalty_statement',
      'split_sheet',
      'campaign_report',
      'pitch_asset',
      'rights_document',
      'final_master',
      'clean_version',
      'instrumental',
      'stems',
      'cover_art',
      'lyrics',
      'other'
    )
  ),
  storage_bucket text not null default 'music-uploads',
  storage_ref text not null,
  status text not null default 'processing' check (status in ('processing', 'uploaded', 'processed', 'failed', 'revoked')),
  source_request_id uuid,
  error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (storage_bucket, storage_ref)
);

create trigger uploaded_files_set_updated_at
before update on public.uploaded_files
for each row execute function public.set_updated_at();

alter table public.uploaded_files enable row level security;

create policy uploaded_files_account_members_select
on public.uploaded_files
for select
using (public.is_account_member(account_id));

create policy uploaded_files_account_members_modify
on public.uploaded_files
for all
using (public.is_account_member(account_id))
with check (public.is_account_member(account_id));

grant select, insert, update, delete on public.uploaded_files to authenticated, service_role;

create index if not exists uploaded_files_workspace_idx
on public.uploaded_files (artist_workspace_id, created_at desc);

create index if not exists uploaded_files_storage_ref_idx
on public.uploaded_files (storage_bucket, storage_ref);

create policy music_uploads_objects_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'music-uploads'
  and public.is_account_member((storage.foldername(name))[1]::uuid)
);

create policy music_uploads_objects_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'music-uploads'
  and public.is_account_member((storage.foldername(name))[1]::uuid)
);

create policy music_uploads_objects_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'music-uploads'
  and public.is_account_member((storage.foldername(name))[1]::uuid)
)
with check (
  bucket_id = 'music-uploads'
  and public.is_account_member((storage.foldername(name))[1]::uuid)
);
