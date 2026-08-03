alter table public.tasks
  add column if not exists work_mode text;

alter table public.tasks
  drop constraint if exists tasks_work_mode_check;

alter table public.tasks
  add constraint tasks_work_mode_check
  check (work_mode is null or work_mode in ('artist_action', 'collaborative', 'manager_work'));

update public.tasks
set work_mode = case
  when completion_mode = 'manager_draft' then 'collaborative'
  when lower(trim(coalesce(owner_role, ''))) = 'manager'
    and nullif(trim(coalesce(user_responsibility, '')), '') is not null
    and lower(trim(user_responsibility)) not in ('none', 'n/a', 'nothing', 'nothing needed', 'nothing required', 'not required')
    then 'collaborative'
  when lower(trim(coalesce(owner_role, ''))) = 'manager' then 'manager_work'
  else 'artist_action'
end
where work_mode is null;

create or replace function public.set_task_work_mode_v1()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.work_mode is null then
    new.work_mode := case
      when new.completion_mode = 'manager_draft' then 'collaborative'
      when lower(trim(coalesce(new.owner_role, ''))) = 'manager'
        and nullif(trim(coalesce(new.user_responsibility, '')), '') is not null
        and lower(trim(new.user_responsibility)) not in ('none', 'n/a', 'nothing', 'nothing needed', 'nothing required', 'not required')
        then 'collaborative'
      when lower(trim(coalesce(new.owner_role, ''))) = 'manager' then 'manager_work'
      else 'artist_action'
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_set_work_mode_v1 on public.tasks;
create trigger tasks_set_work_mode_v1
before insert or update of work_mode, owner_role, completion_mode, user_responsibility
on public.tasks
for each row execute function public.set_task_work_mode_v1();

create or replace function public.open_checkpoint_for_blocking_task_v1()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.primary_checkpoint_id is not null
    and new.work_mode <> 'manager_work'
    and new.status not in ('completed', 'archived', 'rejected', 'superseded') then
    update public.checkpoints
    set status = 'waiting', updated_at = now()
    where id = new.primary_checkpoint_id
      and status = 'watching_signal';
  end if;
  return new;
end;
$$;

drop trigger if exists tasks_open_checkpoint_for_blocking_work_v1 on public.tasks;
create trigger tasks_open_checkpoint_for_blocking_work_v1
after insert on public.tasks
for each row execute function public.open_checkpoint_for_blocking_task_v1();

grant execute on function public.set_task_work_mode_v1() to service_role;
grant execute on function public.open_checkpoint_for_blocking_task_v1() to service_role;
