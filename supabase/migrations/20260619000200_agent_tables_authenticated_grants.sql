-- Repair grants for agent operating tables created for Mission Genesis.
-- RLS policies already restrict rows by account membership; authenticated still
-- needs table privileges for PostgREST to reach those policies.

grant select, insert, update, delete on public.agent_runs to authenticated;
grant select, insert, update, delete on public.agent_reports to authenticated;
grant select, insert, update, delete on public.agent_notes to authenticated;
grant select, insert, update, delete on public.agent_inbox_items to authenticated;

notify pgrst, 'reload schema';
