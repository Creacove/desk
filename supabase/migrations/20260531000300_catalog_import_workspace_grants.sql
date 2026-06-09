-- Follow-up hosted grant repair for Spotify connect writes.

grant usage on schema public to authenticated, service_role;

grant select on public.accounts to authenticated, service_role;
grant select on public.users to authenticated, service_role;
grant select on public.account_memberships to authenticated, service_role;
grant select, insert, update on public.artists to authenticated, service_role;
grant select, insert, update on public.artist_workspaces to authenticated, service_role;
grant select, insert, update, delete on public.artist_profiles to authenticated, service_role;
grant select, insert, update, delete on public.artist_profile_versions to authenticated, service_role;

grant select on public.source_providers to anon, authenticated, service_role;
grant select, insert, update, delete on public.source_connections to authenticated, service_role;
grant select, insert, update, delete on public.source_sync_jobs to authenticated, service_role;
grant select, insert, update, delete on public.source_snapshots to authenticated, service_role;
grant select, insert, update, delete on public.music_projects to authenticated, service_role;
grant select, insert, update, delete on public.music_items to authenticated, service_role;
grant select, insert, update, delete on public.music_project_items to authenticated, service_role;
grant select, insert, update, delete on public.music_identifiers to authenticated, service_role;
grant select, insert on public.operating_events to authenticated, service_role;
