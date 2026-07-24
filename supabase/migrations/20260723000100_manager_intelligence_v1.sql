-- Manager Intelligence V1: explicit task completion contracts, native drafts,
-- and atomic document finalization.

alter table public.tasks
  add column if not exists completion_mode text,
  add column if not exists deliverable_title text,
  add column if not exists deliverable_requirements jsonb not null default '[]'::jsonb,
  add column if not exists manager_responsibility text,
  add column if not exists user_responsibility text;

alter table public.tasks
  drop constraint if exists tasks_completion_mode_check;

alter table public.tasks
  add constraint tasks_completion_mode_check
  check (completion_mode is null or completion_mode in ('result_note', 'manager_draft', 'evidence'));

alter table public.task_results
  add column if not exists submitted_manager_output_id uuid references public.manager_outputs(id) on delete set null,
  add column if not exists submitted_by_user_id uuid references public.users(id) on delete set null;

alter table public.manager_outputs
  drop constraint if exists manager_outputs_output_type_check;

alter table public.manager_outputs
  add constraint manager_outputs_output_type_check
  check (
    output_type in (
      'setup_first_manager_read',
      'recurring_todays_brief',
      'song_manager_read',
      'project_manager_read',
      'chat_answer',
      'decision_package',
      'review_read',
      'task_draft'
    )
  );

create index if not exists task_results_submitted_manager_output_idx
on public.task_results (submitted_manager_output_id)
where submitted_manager_output_id is not null;

grant select, insert, update on public.artifact_links to service_role;

create or replace function public.finalize_task_document_upload(
  p_account_id uuid,
  p_artist_workspace_id uuid,
  p_artist_id uuid,
  p_task_id uuid,
  p_uploaded_file_id uuid,
  p_title text,
  p_file_name text,
  p_file_type text,
  p_storage_bucket text,
  p_storage_ref text,
  p_submitted_by_user_id uuid
)
returns table(document_id uuid, document_version_id uuid)
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  v_document_id uuid;
  v_version_id uuid;
begin
  if p_storage_bucket <> 'workspace-documents' then
    raise exception 'INVALID_STORAGE_BUCKET';
  end if;

  if not exists (
    select 1
    from public.tasks task
    where task.id = p_task_id
      and task.account_id = p_account_id
      and task.artist_workspace_id = p_artist_workspace_id
      and task.artist_id = p_artist_id
  ) then
    raise exception 'TASK_NOT_FOUND';
  end if;

  if not exists (
    select 1
    from public.uploaded_files uploaded
    where uploaded.id = p_uploaded_file_id
      and uploaded.account_id = p_account_id
      and uploaded.artist_workspace_id = p_artist_workspace_id
      and uploaded.artist_id = p_artist_id
      and uploaded.storage_bucket = p_storage_bucket
      and uploaded.storage_ref = p_storage_ref
  ) then
    raise exception 'UPLOAD_INTENT_NOT_FOUND';
  end if;

  select version.document_id, version.id
  into v_document_id, v_version_id
  from public.document_versions version
  where version.uploaded_file_id = p_uploaded_file_id
  limit 1;

  if v_document_id is not null then
    return query select v_document_id, v_version_id;
    return;
  end if;

  insert into public.documents (
    account_id,
    artist_workspace_id,
    artist_id,
    title,
    document_type,
    origin,
    status,
    created_by_type,
    created_by_id,
    metadata
  )
  values (
    p_account_id,
    p_artist_workspace_id,
    p_artist_id,
    coalesce(nullif(trim(p_title), ''), p_file_name),
    'task_deliverable',
    'user_uploaded',
    'uploaded',
    'user',
    p_submitted_by_user_id,
    jsonb_build_object('task_id', p_task_id)
  )
  returning id into v_document_id;

  insert into public.document_versions (
    account_id,
    artist_workspace_id,
    artist_id,
    document_id,
    version_number,
    uploaded_file_id,
    file_name,
    file_type,
    storage_bucket,
    storage_ref,
    extraction_status,
    metadata
  )
  values (
    p_account_id,
    p_artist_workspace_id,
    p_artist_id,
    v_document_id,
    1,
    p_uploaded_file_id,
    p_file_name,
    p_file_type,
    p_storage_bucket,
    p_storage_ref,
    case
      when p_file_type in ('text/plain', 'text/markdown', 'text/csv', 'application/json') then 'completed'
      else 'pending'
    end,
    jsonb_build_object('task_id', p_task_id)
  )
  returning id into v_version_id;

  update public.documents
  set current_version_id = v_version_id,
      updated_at = now()
  where id = v_document_id;

  update public.uploaded_files
  set status = 'uploaded',
      error = null,
      updated_at = now()
  where id = p_uploaded_file_id;

  insert into public.artifact_links (
    account_id,
    artist_workspace_id,
    artist_id,
    source_type,
    source_id,
    target_type,
    target_id,
    relationship
  )
  values (
    p_account_id,
    p_artist_workspace_id,
    p_artist_id,
    'document',
    v_document_id,
    'task',
    p_task_id,
    'response_to'
  );

  insert into public.operating_events (
    account_id,
    artist_workspace_id,
    artist_id,
    event_type,
    actor_type,
    actor_id,
    target_type,
    target_id,
    source_type,
    source_id,
    summary,
    payload
  )
  values (
    p_account_id,
    p_artist_workspace_id,
    p_artist_id,
    'task_deliverable_uploaded',
    'user',
    p_submitted_by_user_id,
    'task',
    p_task_id,
    'document',
    v_document_id,
    format('Uploaded %s.', coalesce(nullif(trim(p_title), ''), p_file_name)),
    jsonb_build_object(
      'uploaded_file_id', p_uploaded_file_id,
      'storage_ref', p_storage_ref,
      'document_version_id', v_version_id
    )
  );

  return query select v_document_id, v_version_id;
end;
$$;

revoke all on function public.finalize_task_document_upload(
  uuid, uuid, uuid, uuid, uuid, text, text, text, text, text, uuid
) from public, anon, authenticated;

grant execute on function public.finalize_task_document_upload(
  uuid, uuid, uuid, uuid, uuid, text, text, text, text, text, uuid
) to service_role;

notify pgrst, 'reload schema';
