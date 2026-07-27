alter table public.manager_synthesis_runs
  add column if not exists subject_type text,
  add column if not exists subject_id uuid;

create index if not exists manager_synthesis_runs_music_subject_idx
on public.manager_synthesis_runs (
  account_id,
  artist_workspace_id,
  artist_id,
  classification,
  subject_type,
  subject_id,
  created_at desc
);

create unique index if not exists manager_synthesis_runs_active_music_read_v2_idx
on public.manager_synthesis_runs (
  account_id,
  artist_workspace_id,
  artist_id,
  classification,
  subject_type,
  subject_id
)
where subject_id is not null
  and classification = 'music_manager_read_v2'
  and status in ('queued', 'running');

create or replace function public.activate_music_manager_read_v2(target_output_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  next_output public.manager_outputs%rowtype;
  previous_output_id uuid;
begin
  select *
  into next_output
  from public.manager_outputs
  where id = target_output_id
  for update;

  if not found then
    raise exception 'Manager output was not found.';
  end if;

  if next_output.schema_version <> 'music-manager-read-v2' then
    raise exception 'Only Music Manager Read v2 outputs can be activated.';
  end if;

  if next_output.output_type not in ('song_manager_read', 'project_manager_read') then
    raise exception 'Output is not a Music Manager Read.';
  end if;

  select id
  into previous_output_id
  from public.manager_outputs
  where artist_workspace_id = next_output.artist_workspace_id
    and output_type = next_output.output_type
    and subject_type = next_output.subject_type
    and subject_id = next_output.subject_id
    and is_current = true
    and id <> next_output.id
  order by created_at desc
  limit 1
  for update;

  update public.manager_outputs
  set is_current = false
  where artist_workspace_id = next_output.artist_workspace_id
    and output_type = next_output.output_type
    and subject_type = next_output.subject_type
    and subject_id = next_output.subject_id
    and is_current = true
    and id <> next_output.id;

  update public.manager_outputs
  set
    is_current = true,
    supersedes_output_id = previous_output_id
  where id = next_output.id;

  return next_output.id;
end;
$$;

grant execute on function public.activate_music_manager_read_v2(uuid)
to authenticated, service_role;
