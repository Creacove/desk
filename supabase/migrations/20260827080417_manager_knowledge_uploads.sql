-- Manager knowledge uploads reuse the existing private, versioned workspace
-- document foundation. This migration is additive and does not change song assets
-- or conversation subject links.

update storage.buckets as bucket
set allowed_mime_types = (
  select array_agg(distinct mime_type)
  from unnest(
    coalesce(bucket.allowed_mime_types, '{}'::text[])
    || array[
      'application/pdf',
      'text/plain',
      'text/markdown',
      'text/csv',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/json'
    ]::text[]
  ) as mime_type
)
where id = 'workspace-documents';

update storage.buckets as bucket
set allowed_mime_types = (
  select array_agg(distinct mime_type)
  from unnest(
    coalesce(bucket.allowed_mime_types, '{}'::text[])
    || array['application/vnd.openxmlformats-officedocument.wordprocessingml.document']::text[]
  ) as mime_type
)
where id = 'music-uploads'
  and not ('application/vnd.openxmlformats-officedocument.wordprocessingml.document' = any(coalesce(allowed_mime_types, '{}'::text[])));

drop policy if exists workspace_documents_objects_delete on storage.objects;
create policy workspace_documents_objects_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'workspace-documents'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  and public.is_account_member((storage.foldername(name))[1]::uuid)
);

create index if not exists documents_manager_knowledge_workspace_idx
on public.documents (artist_workspace_id, created_at desc)
where document_type = 'manager_knowledge' and status <> 'revoked';

create index if not exists document_versions_uploaded_file_idx
on public.document_versions (uploaded_file_id)
where uploaded_file_id is not null;

grant select, insert, update, delete on public.documents to authenticated, service_role;
grant select, insert, update, delete on public.document_versions to authenticated, service_role;

notify pgrst, 'reload schema';
