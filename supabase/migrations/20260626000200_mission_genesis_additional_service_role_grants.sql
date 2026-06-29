-- Grant update permissions on tables where mission-genesis needs to update rows.
grant update on public.mission_plan_versions to service_role;
grant update on public.checkpoints to service_role;
grant update on public.tasks to service_role;

notify pgrst, 'reload schema';
