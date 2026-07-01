-- Allow the authenticated manager-review-task-result Edge Function to read the
-- mission graph and write Manager-owned review artifacts through service role.

grant select on public.artist_workspaces to service_role;
grant select on public.artist_profiles to service_role;
grant select on public.manager_intelligence_packets to service_role;
grant select on public.missions to service_role;
grant select on public.checkpoints to service_role;
grant select on public.tasks to service_role;
grant select on public.task_steps to service_role;
grant select on public.task_results to service_role;
grant select on public.memory_entries to service_role;
grant select on public.operating_events to service_role;

grant select, insert, update on public.manager_synthesis_runs to service_role;
grant select, insert, update on public.manager_outputs to service_role;
grant select, insert, update on public.task_state_events to service_role;
grant select, insert, update on public.task_results to service_role;
grant select, insert, update on public.memory_entries to service_role;
grant select, insert, update on public.operating_events to service_role;
grant select, insert, update on public.ai_run_usage_events to service_role;

notify pgrst, 'reload schema';
