-- First-class workspace documents for mission task deliverables.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'workspace-documents',
  'workspace-documents',
  false,
  52428800,
  array[
    'application/pdf',
    'text/plain',
    'text/markdown',
    'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/json',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  title text not null,
  document_type text not null default 'task_deliverable',
  origin text not null default 'user_uploaded' check (origin in ('user_uploaded', 'manager_generated', 'system_generated', 'imported')),
  status text not null default 'uploaded' check (status in ('draft', 'missing', 'uploading', 'uploaded', 'checking', 'accepted', 'needs_revision', 'failed', 'superseded', 'revoked')),
  summary text,
  current_version_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_by_type public.created_by_type not null default 'user',
  created_by_id uuid,
  created_from_run_id uuid,
  created_from_action_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.document_versions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  version_number integer not null,
  uploaded_file_id uuid references public.uploaded_files(id) on delete set null,
  manager_output_id uuid references public.manager_outputs(id) on delete set null,
  file_name text,
  file_type text,
  storage_bucket text,
  storage_ref text,
  checksum text,
  extraction_status text not null default 'pending' check (extraction_status in ('pending', 'processing', 'completed', 'failed', 'not_required')),
  extracted_text_ref text,
  metadata jsonb not null default '{}'::jsonb,
  created_from_run_id uuid,
  created_at timestamptz not null default now(),
  unique (document_id, version_number)
);

create table if not exists public.document_validation_results (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  document_version_id uuid references public.document_versions(id) on delete set null,
  requirement_id uuid,
  verdict text not null default 'inconclusive' check (verdict in ('accepted', 'rejected', 'needs_revision', 'inconclusive')),
  extracted_facts jsonb not null default '{}'::jsonb,
  missing_items jsonb not null default '[]'::jsonb,
  manager_reasoning text,
  confidence public.evidence_confidence not null default 'unknown',
  created_from_run_id uuid,
  created_at timestamptz not null default now()
);

create trigger documents_set_updated_at
before update on public.documents
for each row execute function public.set_updated_at();

alter table public.documents enable row level security;
alter table public.document_versions enable row level security;
alter table public.document_validation_results enable row level security;

create policy documents_account_members_select
on public.documents
for select
using (public.is_account_member(account_id));

create policy documents_account_members_modify
on public.documents
for all
using (public.is_account_member(account_id))
with check (public.is_account_member(account_id));

create policy document_versions_account_members_select
on public.document_versions
for select
using (public.is_account_member(account_id));

create policy document_versions_account_members_modify
on public.document_versions
for all
using (public.is_account_member(account_id))
with check (public.is_account_member(account_id));

create policy document_validation_results_account_members_select
on public.document_validation_results
for select
using (public.is_account_member(account_id));

create policy document_validation_results_account_members_modify
on public.document_validation_results
for all
using (public.is_account_member(account_id))
with check (public.is_account_member(account_id));

grant select, insert, update, delete on public.documents to authenticated, service_role;
grant select, insert, update, delete on public.document_versions to authenticated, service_role;
grant select, insert, update, delete on public.document_validation_results to authenticated, service_role;
grant select on public.artifact_links to service_role;

create index if not exists documents_workspace_idx
on public.documents (artist_workspace_id, created_at desc);

create index if not exists document_versions_document_idx
on public.document_versions (document_id, version_number desc);

create index if not exists document_validation_results_document_idx
on public.document_validation_results (document_id, created_at desc);

create policy workspace_documents_objects_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'workspace-documents'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  and public.is_account_member((storage.foldername(name))[1]::uuid)
);

create policy workspace_documents_objects_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'workspace-documents'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  and public.is_account_member((storage.foldername(name))[1]::uuid)
);

create policy workspace_documents_objects_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'workspace-documents'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  and public.is_account_member((storage.foldername(name))[1]::uuid)
)
with check (
  bucket_id = 'workspace-documents'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  and public.is_account_member((storage.foldername(name))[1]::uuid)
);

notify pgrst, 'reload schema';
