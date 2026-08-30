-- Trigger helpers execute as part of database-owned trigger paths. They are not
-- public RPCs and must not inherit PostgreSQL's default EXECUTE grant to PUBLIC.

revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
grant execute on function public.rls_auto_enable() to service_role;

revoke execute on function public.stale_campaign_documents_from_music_item() from public, anon, authenticated;
grant execute on function public.stale_campaign_documents_from_music_item() to service_role;

revoke execute on function public.stale_campaign_documents_from_music_child() from public, anon, authenticated;
grant execute on function public.stale_campaign_documents_from_music_child() to service_role;

-- Ordinary trigger helpers and a legacy diagnostic helper are internal too.
-- Pinning search_path prevents caller-controlled object resolution.
alter function public.set_updated_at() set search_path = pg_catalog, public;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
grant execute on function public.set_updated_at() to service_role;

alter function public.validate_task_transition() set search_path = pg_catalog, public;
revoke execute on function public.validate_task_transition() from public, anon, authenticated;
grant execute on function public.validate_task_transition() to service_role;

alter function public.get_guc_role() set search_path = pg_catalog, auth;
revoke execute on function public.get_guc_role() from public, anon, authenticated;
grant execute on function public.get_guc_role() to service_role;

notify pgrst, 'reload schema';
