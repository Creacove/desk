-- Harden Music upload storage policies so browser uploads fail loudly only when
-- the authenticated user is not an active member of the account path prefix.

grant execute on function public.is_account_member(uuid) to authenticated, service_role;

drop policy if exists music_uploads_objects_select on storage.objects;
drop policy if exists music_uploads_objects_insert on storage.objects;
drop policy if exists music_uploads_objects_update on storage.objects;

create policy music_uploads_objects_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'music-uploads'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  and public.is_account_member((storage.foldername(name))[1]::uuid)
);

create policy music_uploads_objects_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'music-uploads'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  and public.is_account_member((storage.foldername(name))[1]::uuid)
);

create policy music_uploads_objects_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'music-uploads'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  and public.is_account_member((storage.foldername(name))[1]::uuid)
)
with check (
  bucket_id = 'music-uploads'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
  and public.is_account_member((storage.foldername(name))[1]::uuid)
);
