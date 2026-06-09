-- Phase 3 support for first production workspace onboarding.
-- Authenticated users need a narrow security-definer path to create their first
-- account/membership/workspace because account-scoped RLS is intentionally closed
-- before membership exists.

create or replace function public.create_initial_artist_workspace(
  p_artist_display_name text,
  p_workspace_name text default null
)
returns table (
  account_id uuid,
  artist_workspace_id uuid,
  artist_id uuid,
  artist_name text,
  workspace_name text,
  status public.workspace_status,
  spotify_connected boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text := coalesce(nullif(auth.jwt() ->> 'email', ''), auth.uid()::text || '@authenticated.local');
  v_artist_name text := nullif(trim(p_artist_display_name), '');
  v_workspace_name text := nullif(trim(p_workspace_name), '');
  v_account_id uuid;
  v_artist_id uuid;
  v_artist_workspace_id uuid;
  v_existing record;
begin
  if v_user_id is null then
    raise exception 'create_initial_artist_workspace requires an authenticated user';
  end if;

  if v_artist_name is null then
    raise exception 'artist display name is required';
  end if;

  v_workspace_name := coalesce(v_workspace_name, v_artist_name || ' HQ');

  insert into public.users (id, email, display_name)
  values (v_user_id, v_email, v_artist_name)
  on conflict (id) do update
    set email = excluded.email,
        display_name = coalesce(public.users.display_name, excluded.display_name),
        updated_at = now();

  select
    workspace.account_id,
    workspace.id as artist_workspace_id,
    artist.id as artist_id,
    artist.display_name as artist_name,
    workspace.name as workspace_name,
    workspace.status,
    (artist.canonical_spotify_artist_id is not null) as spotify_connected
  into v_existing
  from public.account_memberships membership
  join public.artist_workspaces workspace on workspace.account_id = membership.account_id
  join public.artists artist on artist.id = workspace.artist_id
  where membership.user_id = v_user_id
    and membership.status = 'active'
    and workspace.status in ('setup', 'active')
  order by workspace.created_at desc
  limit 1;

  if found then
    return query
      select
        v_existing.account_id,
        v_existing.artist_workspace_id,
        v_existing.artist_id,
        v_existing.artist_name,
        v_existing.workspace_name,
        v_existing.status,
        v_existing.spotify_connected;
    return;
  end if;

  select membership.account_id
  into v_account_id
  from public.account_memberships membership
  where membership.user_id = v_user_id
    and membership.status = 'active'
  order by membership.created_at asc
  limit 1;

  if v_account_id is null then
    insert into public.accounts (name)
    values (v_workspace_name)
    returning id into v_account_id;
  end if;

  insert into public.account_memberships (account_id, user_id, role, status)
  values (v_account_id, v_user_id, 'owner', 'active')
  on conflict (account_id, user_id) do update
    set role = public.account_memberships.role,
        status = 'active';

  insert into public.artists (account_id, display_name)
  values (v_account_id, v_artist_name)
  returning id into v_artist_id;

  insert into public.artist_workspaces (account_id, artist_id, name, status)
  values (v_account_id, v_artist_id, v_workspace_name, 'setup')
  returning id into v_artist_workspace_id;

  insert into public.artist_profiles (
    account_id,
    artist_workspace_id,
    artist_id,
    display_name,
    updated_by_user_id
  )
  values (
    v_account_id,
    v_artist_workspace_id,
    v_artist_id,
    v_artist_name,
    v_user_id
  );

  insert into public.operating_events (
    account_id,
    artist_workspace_id,
    artist_id,
    event_type,
    actor_type,
    actor_id,
    target_type,
    target_id,
    summary,
    payload
  )
  values (
    v_account_id,
    v_artist_workspace_id,
    v_artist_id,
    'artist_workspace_created',
    'user',
    v_user_id,
    'artist_workspace',
    v_artist_workspace_id,
    'Created initial production artist workspace.',
    jsonb_build_object('artist_name', v_artist_name, 'workspace_name', v_workspace_name)
  );

  return query
    select
      v_account_id,
      v_artist_workspace_id,
      v_artist_id,
      v_artist_name,
      v_workspace_name,
      'setup'::public.workspace_status,
      false;
end;
$$;

revoke all on function public.create_initial_artist_workspace(text, text) from public;
grant execute on function public.create_initial_artist_workspace(text, text) to authenticated;
