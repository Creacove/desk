-- Let first-run setup collect only human-owned operating context.
-- Stage, home market, and genres are enrichment-derived and should not block setup.

create or replace function public.complete_artist_setup_context(
  p_artist_workspace_id uuid,
  p_stage text,
  p_home_market text,
  p_genres text[],
  p_artist_direction text,
  p_current_goal text,
  p_budget_context text,
  p_social_handles jsonb default '{}'::jsonb
)
returns table (
  account_id uuid,
  artist_workspace_id uuid,
  artist_id uuid,
  artist_name text,
  workspace_name text,
  status public.workspace_status,
  spotify_connected boolean,
  spotify_artist_id text,
  spotify_artist_name text,
  spotify_artist_url text,
  spotify_image_url text,
  context_complete boolean,
  latest_catalog_sync_status public.run_status
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_user_id uuid := auth.uid();
  v_workspace public.artist_workspaces%rowtype;
  v_artist public.artists%rowtype;
  v_profile_id uuid;
  v_profile_version_id uuid;
  v_next_version integer;
  v_latest_sync_status public.run_status;
  v_social_handles jsonb := coalesce(p_social_handles, '{}'::jsonb);
begin
  if v_user_id is null then
    raise exception 'complete_artist_setup_context requires an authenticated user';
  end if;

  select *
  into v_workspace
  from public.artist_workspaces
  where id = p_artist_workspace_id;

  if not found then
    raise exception 'artist workspace not found';
  end if;

  if not public.is_account_member(v_workspace.account_id) then
    raise exception 'forbidden';
  end if;

  if nullif(trim(p_artist_direction), '') is null
    or nullif(trim(p_budget_context), '') is null then
    raise exception 'artist direction and budget are required';
  end if;

  select *
  into v_artist
  from public.artists
  where id = v_workspace.artist_id
    and account_id = v_workspace.account_id;

  if not found then
    raise exception 'artist not found';
  end if;

  select id
  into v_profile_id
  from public.artist_profiles
  where artist_workspace_id = v_workspace.id
    and artist_id = v_workspace.artist_id
    and account_id = v_workspace.account_id
  order by created_at asc
  limit 1;

  if v_profile_id is null then
    insert into public.artist_profiles (
      account_id,
      artist_workspace_id,
      artist_id,
      display_name,
      updated_by_user_id
    )
    values (
      v_workspace.account_id,
      v_workspace.id,
      v_workspace.artist_id,
      v_artist.display_name,
      v_user_id
    )
    returning id into v_profile_id;
  end if;

  update public.artist_profiles
  set stage = coalesce(nullif(trim(p_stage), ''), stage),
      home_market = coalesce(nullif(trim(p_home_market), ''), home_market),
      genres = case when coalesce(array_length(p_genres, 1), 0) > 0 then p_genres else genres end,
      artist_direction = trim(p_artist_direction),
      current_goal = nullif(trim(p_current_goal), ''),
      budget_context = trim(p_budget_context),
      social_handles = v_social_handles,
      updated_by_user_id = v_user_id,
      updated_at = now()
  where id = v_profile_id;

  select coalesce(max(version), 0) + 1
  into v_next_version
  from public.artist_profile_versions
  where profile_id = v_profile_id;

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
  select
    profile.account_id,
    profile.artist_workspace_id,
    profile.artist_id,
    profile.id,
    v_next_version,
    jsonb_build_object(
      'display_name', profile.display_name,
      'spotify_identity', profile.spotify_identity,
      'genres', profile.genres,
      'home_market', profile.home_market,
      'stage', profile.stage,
      'current_goal', profile.current_goal,
      'budget_context', profile.budget_context,
      'social_handles', profile.social_handles,
      'artist_direction', profile.artist_direction
    ),
    'Completed first-run artist context.',
    'setup',
    'user',
    v_user_id
  from public.artist_profiles profile
  where profile.id = v_profile_id
  returning id into v_profile_version_id;

  update public.artist_profiles
  set current_version_id = v_profile_version_id
  where id = v_profile_id;

  update public.artist_workspaces
  set status = 'active',
      active_profile_version_id = v_profile_version_id,
      updated_at = now()
  where id = v_workspace.id;

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
    v_workspace.account_id,
    v_workspace.id,
    v_workspace.artist_id,
    'artist_setup_context_completed',
    'user',
    v_user_id,
    'artist_workspace',
    v_workspace.id,
    'Completed required artist setup context and opened Desk HQ.',
    jsonb_build_object(
      'required_fields', array['artist_direction','budget_context'],
      'enrichment_derived_fields', array['stage','home_market','genres'],
      'profile_version_id', v_profile_version_id
    )
  );

  select job.status
  into v_latest_sync_status
  from public.source_sync_jobs job
  where job.artist_workspace_id = v_workspace.id
    and job.job_type = 'spotify_catalog_bootstrap'
  order by job.created_at desc
  limit 1;

  return query
    select
      v_workspace.account_id,
      v_workspace.id,
      v_workspace.artist_id,
      v_artist.display_name,
      v_workspace.name,
      'active'::public.workspace_status,
      (v_artist.canonical_spotify_artist_id is not null),
      v_artist.canonical_spotify_artist_id,
      coalesce((profile.spotify_identity ->> 'name'), v_artist.display_name),
      v_artist.canonical_spotify_url,
      profile.spotify_identity ->> 'image_url',
      true,
      v_latest_sync_status
    from public.artist_profiles profile
    where profile.id = v_profile_id;
end;
$$;

revoke all on function public.complete_artist_setup_context(uuid, text, text, text[], text, text, text, jsonb) from public;
grant execute on function public.complete_artist_setup_context(uuid, text, text, text[], text, text, text, jsonb) to authenticated;
