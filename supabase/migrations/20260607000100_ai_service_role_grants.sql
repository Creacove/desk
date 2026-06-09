grant usage on schema public to service_role;

grant select, insert, update on public.manager_synthesis_runs to service_role;
grant select, insert, update on public.ai_run_usage_events to service_role;

notify pgrst, 'reload schema';
