alter table public.manager_synthesis_runs
  add column if not exists subject_type text,
  add column if not exists subject_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'manager_synthesis_runs_music_read_v2_subject_check'
      and conrelid = 'public.manager_synthesis_runs'::regclass
  ) then
    alter table public.manager_synthesis_runs
      add constraint manager_synthesis_runs_music_read_v2_subject_check
      check (
        classification <> 'music_manager_read_v2'
        or (
          subject_id is not null
          and subject_type is not null
          and subject_type in ('music_item', 'music_project')
        )
      );
  end if;
end;
$$;

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
  initial_output public.manager_outputs%rowtype;
  next_output public.manager_outputs%rowtype;
  previous_output_id uuid;
begin
  select *
  into initial_output
  from public.manager_outputs
  where id = target_output_id;

  if not found then
    raise exception 'Manager output was not found.';
  end if;

  if initial_output.schema_version <> 'music-manager-read-v2' then
    raise exception 'Only Music Manager Read v2 outputs can be activated.';
  end if;

  if initial_output.subject_id is null then
    raise exception 'Music Manager Read outputs require a subject.';
  end if;

  if not (
    (initial_output.subject_type = 'music_item' and initial_output.output_type = 'song_manager_read')
    or (initial_output.subject_type = 'music_project' and initial_output.output_type = 'project_manager_read')
  ) then
    raise exception 'Output type does not match its Music Manager Read subject.';
  end if;

  if initial_output.subject_type = 'music_item' then
    perform 1
    from public.music_items
    where id = initial_output.subject_id
      and account_id = initial_output.account_id
      and artist_workspace_id = initial_output.artist_workspace_id
      and artist_id = initial_output.artist_id
    for update;

    if not found then
      raise exception 'Music item subject was not found for this output owner.';
    end if;
  elsif initial_output.subject_type = 'music_project' then
    perform 1
    from public.music_projects
    where id = initial_output.subject_id
      and account_id = initial_output.account_id
      and artist_workspace_id = initial_output.artist_workspace_id
      and artist_id = initial_output.artist_id
    for update;

    if not found then
      raise exception 'Music project subject was not found for this output owner.';
    end if;
  end if;

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

  if next_output.subject_id is null then
    raise exception 'Music Manager Read outputs require a subject.';
  end if;

  if not (
    (next_output.subject_type = 'music_item' and next_output.output_type = 'song_manager_read')
    or (next_output.subject_type = 'music_project' and next_output.output_type = 'project_manager_read')
  ) then
    raise exception 'Output type does not match its Music Manager Read subject.';
  end if;

  if next_output.account_id is distinct from initial_output.account_id
    or next_output.artist_workspace_id is distinct from initial_output.artist_workspace_id
    or next_output.artist_id is distinct from initial_output.artist_id
    or next_output.output_type is distinct from initial_output.output_type
    or next_output.subject_type is distinct from initial_output.subject_type
    or next_output.subject_id is distinct from initial_output.subject_id
  then
    raise exception 'Manager output identity changed during activation.';
  end if;

  if next_output.is_current then
    return next_output.id;
  end if;

  select id
  into previous_output_id
  from public.manager_outputs
  where account_id = next_output.account_id
    and artist_workspace_id = next_output.artist_workspace_id
    and artist_id = next_output.artist_id
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
  where account_id = next_output.account_id
    and artist_workspace_id = next_output.artist_workspace_id
    and artist_id = next_output.artist_id
    and output_type = next_output.output_type
    and subject_type = next_output.subject_type
    and subject_id = next_output.subject_id
    and is_current = true
    and id <> next_output.id;

  update public.manager_outputs
  set
    is_current = true,
    supersedes_output_id = previous_output_id
  where id = next_output.id
    and account_id = next_output.account_id
    and artist_workspace_id = next_output.artist_workspace_id
    and artist_id = next_output.artist_id
    and output_type = next_output.output_type
    and subject_type = next_output.subject_type
    and subject_id = next_output.subject_id;

  return next_output.id;
end;
$$;

revoke execute on function public.activate_music_manager_read_v2(uuid)
from public, anon;

grant execute on function public.activate_music_manager_read_v2(uuid)
to authenticated, service_role;
