-- Grants for the Manager Conversation Router edge function.

grant select on public.artist_workspaces to service_role;
grant select on public.artist_profiles to service_role;
grant select on public.evidence_items to service_role;
grant select on public.music_items to service_role;
grant select on public.music_projects to service_role;
grant select on public.memory_entries to service_role;
grant select on public.agent_reports to service_role;
grant select on public.missions to service_role;
grant select on public.tasks to service_role;
grant select on public.manager_intelligence_packets to service_role;
grant select on public.conversations to service_role;
grant select on public.conversation_messages to service_role;

grant select, insert, update on public.conversations to service_role;
grant select, insert, update on public.conversation_messages to service_role;
grant select, insert, update on public.manager_synthesis_runs to service_role;
grant select, insert, update on public.manager_run_actions to service_role;
grant select, insert, update on public.memory_entries to service_role;
grant select, insert, update on public.ai_run_usage_events to service_role;
grant select, insert, update on public.missions to service_role;
grant select, insert, update on public.mission_plan_versions to service_role;
grant select, insert, update on public.mission_plan_checkpoints to service_role;
grant select, insert, update on public.checkpoints to service_role;
grant select, insert, update on public.tasks to service_role;
grant select, insert, update on public.task_steps to service_role;
grant select, insert, update on public.permission_requests to service_role;
grant select, insert, update on public.operating_events to service_role;
