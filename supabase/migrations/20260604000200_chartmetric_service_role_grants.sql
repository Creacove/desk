-- Keep server-side verification and failure logging explicit for Chartmetric.
-- Authenticated users perform normal scoped writes through RLS. Service role is
-- used by edge functions for safe failure logging and by operational smoke
-- checks that verify provider snapshots/evidence were persisted.

grant select on public.source_providers to anon, authenticated, service_role;
grant select, insert, update, delete on public.source_connections to authenticated, service_role;
grant select, insert, update, delete on public.source_sync_jobs to authenticated, service_role;
grant select, insert, update, delete on public.source_snapshots to authenticated, service_role;
grant select, insert, update, delete on public.evidence_items to authenticated, service_role;
grant select, insert, update, delete on public.evidence_links to authenticated, service_role;
grant select, insert on public.operating_events to authenticated, service_role;
