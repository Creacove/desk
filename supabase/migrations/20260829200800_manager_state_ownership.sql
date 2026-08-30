-- Manager reasoning, approvals, reviews, memory, and usage accounting are
-- service-owned. Account membership grants read visibility, not authorship.

revoke insert, update, delete on public.manager_synthesis_runs from authenticated;
revoke insert, update, delete on public.manager_synthesis_runs from public, anon;
drop policy if exists manager_synthesis_runs_account_members_modify on public.manager_synthesis_runs;
grant select on public.manager_synthesis_runs to authenticated;
grant select, insert, update, delete on public.manager_synthesis_runs to service_role;

revoke insert, update, delete on public.manager_run_actions from authenticated;
revoke insert, update, delete on public.manager_run_actions from public, anon;
drop policy if exists manager_run_actions_account_members_modify on public.manager_run_actions;
grant select on public.manager_run_actions to authenticated;
grant select, insert, update, delete on public.manager_run_actions to service_role;

revoke insert, update, delete on public.ai_run_usage_events from authenticated;
revoke insert, update, delete on public.ai_run_usage_events from public, anon;
drop policy if exists ai_run_usage_events_account_members_modify on public.ai_run_usage_events;
grant select on public.ai_run_usage_events to authenticated;
grant select, insert, update, delete on public.ai_run_usage_events to service_role;

revoke insert, update, delete on public.reviews from authenticated;
revoke insert, update, delete on public.reviews from public, anon;
drop policy if exists reviews_account_members_modify on public.reviews;
grant select on public.reviews to authenticated;
grant select, insert, update, delete on public.reviews to service_role;

revoke insert, update, delete on public.permission_requests from authenticated;
revoke insert, update, delete on public.permission_requests from public, anon;
drop policy if exists permission_requests_account_members_modify on public.permission_requests;
grant select on public.permission_requests to authenticated;
grant select, insert, update, delete on public.permission_requests to service_role;

revoke insert, update, delete on public.memory_entries from authenticated;
revoke insert, update, delete on public.memory_entries from public, anon;
drop policy if exists memory_entries_account_members_modify on public.memory_entries;
grant select on public.memory_entries to authenticated;
grant select, insert, update, delete on public.memory_entries to service_role;

notify pgrst, 'reload schema';
