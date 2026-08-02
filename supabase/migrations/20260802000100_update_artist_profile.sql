-- Persist explicit Settings changes without re-opening or re-running workspace setup.

create or replace function public.update_artist_profile(
  p_artist_workspace_id uuid,
  p_display_name text,
  p_stage text,
  p_home_market text,
  p_genres text[],
  p_artist_direction text,
  p_budget_context text,
  p_social_handles jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_workspace public.artist_workspaces%rowtype;
  v_profile public.artist_profiles%rowtype;
  v_profile_version_id uuid;
  v_next_version integer;
  v_social_handles jsonb := coalesce(p_social_handles, '{}'::jsonb);
begin
  if v_user_id is null then
    raise exception 'update_artist_profile requires an authenticated user';
  end if;

  select *
  into v_workspace
  from public.artist_workspaces
  where id = p_artist_workspace_id
  for update;

  if not found then
    raise exception 'artist workspace not found';
  end if;

  if not public.is_account_member(v_workspace.account_id) then
    raise exception 'forbidden';
  end if;

  if nullif(trim(p_display_name), '') is null then
    raise exception 'artist name is required';
  end if;

  if nullif(trim(p_artist_direction), '') is null or nullif(trim(p_budget_context), '') is null then
    raise exception 'artist goals and monthly budget are required';
  end if;

  if jsonb_typeof(v_social_handles) <> 'object' then
    raise exception 'social handles must be an object';
  end if;

  select *
  into v_profile
  from public.artist_profiles
  where account_id = v_workspace.account_id
    and artist_workspace_id = v_workspace.id
    and artist_id = v_workspace.artist_id
  order by created_at asc
  limit 1
  for update;

  if not found then
    raise exception 'artist profile not found';
  end if;

  update public.artist_profiles
  set display_name = trim(p_display_name),
      stage = nullif(trim(p_stage), ''),
      home_market = nullif(trim(p_home_market), ''),
      genres = coalesce(p_genres, '{}'::text[]),
      artist_direction = trim(p_artist_direction),
      current_goal = trim(p_artist_direction),
      budget_context = trim(p_budget_context),
      social_handles = v_social_handles,
      updated_by_user_id = v_user_id,
      updated_at = now()
  where id = v_profile.id
  returning * into v_profile;

  select coalesce(max(version), 0) + 1
  into v_next_version
  from public.artist_profile_versions
  where profile_id = v_profile.id;

  insert into public.artist_profile_versions (
    account_id,
    artist_workspace_id,
    artist_id,
    profile_id,
    version,
    profile_payload,
    change_reason,
    source,
    created_by_type,
    created_by_id
  )
  values (
    v_profile.account_id,
    v_profile.artist_workspace_id,
    v_profile.artist_id,
    v_profile.id,
    v_next_version,
    jsonb_build_object(
      'display_name', v_profile.display_name,
      'spotify_identity', v_profile.spotify_identity,
      'genres', v_profile.genres,
      'home_market', v_profile.home_market,
      'stage', v_profile.stage,
      'current_goal', v_profile.current_goal,
      'budget_context', v_profile.budget_context,
      'social_handles', v_profile.social_handles,
      'artist_direction', v_profile.artist_direction
    ),
    'Updated workspace settings.',
    'settings',
    'user',
    v_user_id
  )
  returning id into v_profile_version_id;

  update public.artist_profiles
  set current_version_id = v_profile_version_id
  where id = v_profile.id;

  update public.artist_workspaces
  set active_profile_version_id = v_profile_version_id,
      updated_at = now()
  where id = v_workspace.id;
end;
$$;

revoke all on function public.update_artist_profile(uuid, text, text, text, text[], text, text, jsonb) from public;
grant execute on function public.update_artist_profile(uuid, text, text, text, text[], text, text, jsonb) to authenticated;
