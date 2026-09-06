-- A workspace is the single ownership boundary for manager state. The composite
-- scope foreign keys preserve tenant/artist consistency without exposing the
-- state tables as accidental account/workspace/artist junction tables to PostgREST.

alter table public.artist_workspaces
  add constraint artist_workspaces_identity_scope_key
  unique (id, account_id, artist_id);

alter table public.manager_career_watch_state
  add constraint manager_career_watch_state_workspace_scope_fkey
  foreign key (artist_workspace_id, account_id, artist_id)
  references public.artist_workspaces (id, account_id, artist_id)
  on delete cascade
  not valid;

alter table public.manager_runtime_limits
  add constraint manager_runtime_limits_workspace_scope_fkey
  foreign key (artist_workspace_id, account_id, artist_id)
  references public.artist_workspaces (id, account_id, artist_id)
  on delete cascade
  not valid;

alter table public.manager_career_watch_state
  validate constraint manager_career_watch_state_workspace_scope_fkey;

alter table public.manager_runtime_limits
  validate constraint manager_runtime_limits_workspace_scope_fkey;

alter table public.manager_career_watch_state
  drop constraint if exists manager_career_watch_state_account_id_fkey,
  drop constraint if exists manager_career_watch_state_artist_workspace_id_fkey,
  drop constraint if exists manager_career_watch_state_artist_id_fkey;

alter table public.manager_runtime_limits
  drop constraint if exists manager_runtime_limits_account_id_fkey,
  drop constraint if exists manager_runtime_limits_artist_workspace_id_fkey,
  drop constraint if exists manager_runtime_limits_artist_id_fkey;

notify pgrst, 'reload schema';
