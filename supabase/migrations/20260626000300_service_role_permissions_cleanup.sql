-- Grant select, insert, update, delete permissions on all mission genesis tables to service_role.
grant select, insert, update, delete on public.missions to service_role;
grant select, insert, update, delete on public.mission_plan_versions to service_role;
grant select, insert, update, delete on public.checkpoints to service_role;
grant select, insert, update, delete on public.mission_plan_checkpoints to service_role;
grant select, insert, update, delete on public.tasks to service_role;
grant select, insert, update, delete on public.task_steps to service_role;
grant select, insert, update, delete on public.permission_requests to service_role;
grant select, insert, update, delete on public.manager_context_questions to service_role;
grant select, insert, update, delete on public.manager_context_answers to service_role;
grant select, insert, update, delete on public.memory_entries to service_role;
grant select, insert, update, delete on public.operating_events to service_role;
grant select, insert, update, delete on public.manager_synthesis_runs to service_role;
grant select, insert, update, delete on public.ai_run_usage_events to service_role;
grant select, insert, update, delete on public.manager_run_actions to service_role;

notify pgrst, 'reload schema';
