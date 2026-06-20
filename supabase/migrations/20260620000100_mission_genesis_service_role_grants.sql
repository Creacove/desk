-- Mission Genesis authenticates the caller with their JWT, verifies account
-- membership, then uses service_role to assemble and persist the complete graph.
-- Keep that server boundary explicit instead of relying on project defaults.

grant usage on schema public to service_role;

grant select on public.artist_profiles to service_role;
grant select on public.artist_workspaces to service_role;
grant select on public.evidence_items to service_role;
grant select on public.music_items to service_role;
grant select on public.music_projects to service_role;
grant select on public.source_connections to service_role;
grant select on public.agent_reports to service_role;

grant select, insert, update on public.manager_synthesis_runs to service_role;
grant select, insert, update on public.ai_run_usage_events to service_role;
grant select, insert, update on public.manager_run_actions to service_role;
grant select, insert, update on public.missions to service_role;

grant select, insert on public.mission_plan_versions to service_role;
grant select, insert on public.checkpoints to service_role;
grant select, insert on public.tasks to service_role;
grant select, insert on public.manager_context_questions to service_role;
grant select, insert on public.memory_entries to service_role;

grant insert on public.mission_plan_checkpoints to service_role;
grant insert on public.permission_requests to service_role;
grant insert on public.manager_context_answers to service_role;
grant insert on public.operating_events to service_role;

notify pgrst, 'reload schema';
