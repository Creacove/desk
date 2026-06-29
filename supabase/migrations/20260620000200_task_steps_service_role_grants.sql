-- Grant select and insert permissions on task_steps to service_role
grant select, insert on public.task_steps to service_role;

notify pgrst, 'reload schema';
