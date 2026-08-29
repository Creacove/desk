\set ON_ERROR_STOP on

do $$
declare active_count integer;total_count integer;
begin
  select count(*) into active_count from public.manager_runtime_admissions where artist_workspace_id='80000000-0000-4000-8000-000000000003' and status='active';
  select count(*) into total_count from public.manager_runtime_admissions where artist_workspace_id='80000000-0000-4000-8000-000000000003';
  if active_count<>4 then raise exception 'Concurrent admission cap expected exactly 4 active reservations, got % (total rows %)',active_count,total_count; end if;
end$$;

delete from public.accounts where id='80000000-0000-4000-8000-000000000001';
