-- Read-only Manager setup presentation projection.
-- This function is intentionally independent from setup workers and provider calls.
-- The bounded projection tracks omitted_malformed source rows; this first version
-- filters malformed rows before serialization and reports zero in the envelope.
-- Public findings are serialized with jsonb_build_object('id', ...).

create or replace function public.get_setup_presentation_feed_v2(p_setup_run_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $function$
with authorized_setup as (
  select
    setup.id,
    setup.account_id,
    setup.artist_workspace_id,
    setup.artist_id,
    setup.status,
    setup.current_stage,
    setup.stage_status,
    setup.started_at,
    setup.created_at,
    setup.updated_at
  from public.workspace_setup_runs as setup
  where auth.role() = 'authenticated'
    and setup.id = p_setup_run_id
),
profile_row as (
  select profile.*
  from public.artist_profiles as profile
  join authorized_setup as setup
    on setup.account_id = profile.account_id
   and setup.artist_workspace_id = profile.artist_workspace_id
   and setup.artist_id = profile.artist_id
  where lower(coalesce(profile.display_name, '')) !~ '(chartmetric|manager_discovery_tool|save_public_evidence|write_strategic_memory|web_search)'
    and lower(coalesce(array_to_string(profile.genres, ' '), '')) !~ '(chartmetric|manager_discovery_tool|save_public_evidence|write_strategic_memory|web_search)'
),
catalogue_completion as (
  select event.id, event.created_at, event.payload
  from public.operating_events as event
  join authorized_setup as setup
    on setup.account_id = event.account_id
   and setup.artist_workspace_id = event.artist_workspace_id
   and setup.artist_id = event.artist_id
  where event.event_type in ('spotify_catalog_bootstrap_completed', 'spotify_catalog_bootstrap_completed_with_limits')
    and (
      event.workspace_setup_run_id = setup.id
      or (
        event.workspace_setup_run_id is null
        and event.created_at >= coalesce(setup.started_at, setup.created_at)
      )
    )
  order by event.created_at asc, event.id asc
  limit 1
),
discovery_run as (
  select discovery.id, discovery.status, discovery.started_at, discovery.created_at
  from public.manager_synthesis_runs as discovery
  join authorized_setup as setup
    on setup.account_id = discovery.account_id
   and setup.artist_workspace_id = discovery.artist_workspace_id
   and setup.artist_id = discovery.artist_id
  where discovery.classification = 'manager_artist_discovery_v1'
    and discovery.scope_key = setup.id::text
    and coalesce(discovery.status::text, '') not in ('failed', 'cancelled', 'canceled')
  order by discovery.created_at desc, discovery.id desc
  limit 1
),
applied_actions as (
  select action.id, action.manager_synthesis_run_id, discovery_run.status as discovery_status
  from public.manager_run_actions as action
  join discovery_run as discovery_run
    on action.manager_synthesis_run_id = discovery_run.id
  join authorized_setup as setup
    on setup.account_id = action.account_id
   and setup.artist_workspace_id = action.artist_workspace_id
   and setup.artist_id = action.artist_id
  where action.manager_synthesis_run_id = discovery_run.id
    and action.status::text = 'applied'
),
brief_run as (
  select brief.id, brief.status, brief.started_at, brief.created_at
  from public.manager_synthesis_runs as brief
  join authorized_setup as setup
    on setup.account_id = brief.account_id
   and setup.artist_workspace_id = brief.artist_workspace_id
   and setup.artist_id = brief.artist_id
  where brief.classification = 'setup_todays_brief_v1'
    and brief.scope_key = setup.id::text
  order by brief.created_at desc, brief.id desc
  limit 1
),
raw_findings as (
  select
    concat('artist:', setup.artist_id::text) as finding_id,
    'identity:artist'::text as dedupe_key,
    coalesce(profile.updated_at, setup.created_at) as revision_at,
    coalesce(profile.updated_at, setup.created_at) as persisted_at,
    'catalogue'::text as phase,
    'identity'::text as kind,
    'catalogue'::text as destination,
    'spotify'::text as platform,
    'Artist identity'::text as title,
    nullif(left(profile.display_name, 96), '') as value,
    nullif(left(array_to_string(profile.genres[1:2], ' · '), 180), '') as detail,
    case
      when (profile.spotify_identity ->> 'imageUrl') ~ '^https://' then jsonb_build_object(
        'url', profile.spotify_identity ->> 'imageUrl',
        'alt', left(profile.display_name, 120)
      )
      else null
    end as artwork,
    0::integer as phase_rank,
    0::integer as kind_rank,
    4::integer as kind_quota
  from authorized_setup as setup
  join profile_row as profile on true
  where nullif(trim(profile.display_name), '') is not null

  union all

  select
    concat('catalogue:', completion.id::text, ':tracks'),
    'catalogue:track-count',
    completion.created_at,
    completion.created_at,
    'catalogue', 'catalogue', 'catalogue', 'spotify', 'Tracks',
    case
      when completion.payload ->> 'music_item_count' ~ '^[0-9]+$' then completion.payload ->> 'music_item_count'
      else null
    end,
    'Catalogue connected', null, 0, 1, 4
  from catalogue_completion as completion

  union all

  select
    concat('catalogue:', completion.id::text, ':releases'),
    'catalogue:release-count',
    completion.created_at,
    completion.created_at,
    'catalogue', 'catalogue', 'catalogue', 'spotify', 'Releases',
    case
      when completion.payload ->> 'music_project_count' ~ '^[0-9]+$' then completion.payload ->> 'music_project_count'
      else null
    end,
    'Catalogue connected', null, 0, 1, 4
  from catalogue_completion as completion

  union all

  select
    concat('music-item:', item.id::text),
    concat('music-item:', item.id::text),
    coalesce(item.updated_at, item.created_at),
    coalesce(item.updated_at, item.created_at),
    'catalogue', 'music', 'catalogue', 'spotify',
    left(item.title, 96), 'Track', null,
    case
      when coalesce(item.metadata -> 'spotify' ->> 'cover_image_url', item.metadata ->> 'cover_image_url') ~ '^https://' then jsonb_build_object(
        'url', coalesce(item.metadata -> 'spotify' ->> 'cover_image_url', item.metadata ->> 'cover_image_url'),
        'alt', left(item.title, 120)
      )
      else null
    end,
    0, 2, 8
  from public.music_items as item
  join authorized_setup as setup
    on setup.account_id = item.account_id
   and setup.artist_workspace_id = item.artist_workspace_id
   and setup.artist_id = item.artist_id
  join catalogue_completion as completion on true
  where nullif(trim(item.title), '') is not null
    and lower(item.title) !~ '(chartmetric|manager_discovery_tool|save_public_evidence|write_strategic_memory|web_search)'
    and (
      item.created_from_run_id = setup.id
      or (
        item.created_from_run_id is null
        and item.created_at >= coalesce(setup.started_at, setup.created_at)
      )
    )

  union all

  select
    concat('music-project:', project.id::text),
    concat('music-project:', project.id::text),
    coalesce(project.updated_at, project.created_at),
    coalesce(project.updated_at, project.created_at),
    'catalogue', 'music', 'catalogue', 'spotify',
    left(project.title, 96), 'Release', null,
    case
      when coalesce(project.metadata -> 'spotify' ->> 'cover_image_url', project.metadata ->> 'cover_image_url') ~ '^https://' then jsonb_build_object(
        'url', coalesce(project.metadata -> 'spotify' ->> 'cover_image_url', project.metadata ->> 'cover_image_url'),
        'alt', left(project.title, 120)
      )
      else null
    end,
    0, 2, 8
  from public.music_projects as project
  join authorized_setup as setup
    on setup.account_id = project.account_id
   and setup.artist_workspace_id = project.artist_workspace_id
   and setup.artist_id = project.artist_id
  join catalogue_completion as completion on true
  where nullif(trim(project.title), '') is not null
    and lower(project.title) !~ '(chartmetric|manager_discovery_tool|save_public_evidence|write_strategic_memory|web_search)'
    and (
      project.created_from_run_id = setup.id
      or (
        project.created_from_run_id is null
        and project.created_at >= coalesce(setup.started_at, setup.created_at)
      )
    )

  union all

  select
    concat('evidence:', evidence.id::text),
    concat('evidence:', lower(evidence.metric_name), ':', coalesce(evidence.subject_id::text, evidence.subject_label, 'artist')),
    evidence.created_at,
    evidence.created_at,
    'discovery',
    case
      when lower(evidence.metric_name) in ('spotify_playlist_total_reach', 'spotify_playlist_reach', 'spotify_playlist_count', 'spotify_editorial_playlist_count', 'spotify_editorial_playlist_total_reach', 'spotify_editorial_playlist_reach', 'apple_music_playlist_count', 'apple_music_editorial_playlist_count', 'apple_music_editorial_playlist_reach', 'playlist_followers', 'playlist_movement', 'playlist_placement') then 'playlist'
      when lower(evidence.metric_name) in ('artist_current_city', 'listener_market') or lower(evidence.metric_name) ~ '^(spotify_)?listener_city_[a-z0-9_-]+$' or lower(evidence.metric_name) ~ '^city_affinity_[a-z0-9_-]+$' then 'market'
      when lower(evidence.metric_name) in ('spotify_streams', 'spotify_trailing_7d_streams', 'spotify_trailing_28d_streams', 'spotify_stream_trend', 'spotify_popularity', 'spotify_popularity_latest', 'track_stage', 'track_career_health', 'career_stage', 'career_trend') then 'momentum'
      else 'audience'
    end,
    case
      when lower(evidence.metric_name) in ('spotify_playlist_total_reach', 'spotify_playlist_reach', 'spotify_playlist_count', 'spotify_editorial_playlist_count', 'spotify_editorial_playlist_total_reach', 'spotify_editorial_playlist_reach', 'apple_music_playlist_count', 'apple_music_editorial_playlist_count', 'apple_music_editorial_playlist_reach', 'playlist_followers', 'playlist_movement', 'playlist_placement') then 'audience'
      when lower(evidence.metric_name) in ('artist_current_city', 'listener_market') or lower(evidence.metric_name) ~ '^(spotify_)?listener_city_[a-z0-9_-]+$' or lower(evidence.metric_name) ~ '^city_affinity_[a-z0-9_-]+$' then 'markets'
      when lower(evidence.metric_name) in ('spotify_streams', 'spotify_trailing_7d_streams', 'spotify_trailing_28d_streams', 'spotify_stream_trend', 'spotify_popularity', 'spotify_popularity_latest', 'track_stage', 'track_career_health', 'career_stage', 'career_trend') then 'momentum'
      else 'audience'
    end,
    case
      when lower(evidence.metric_name) like 'spotify_%' or lower(evidence.metric_name) like '%playlist%' then 'spotify'
      when lower(evidence.metric_name) like 'instagram_%' then 'instagram'
      when lower(evidence.metric_name) like 'tiktok_%' then 'tiktok'
      when lower(evidence.metric_name) like 'youtube_%' then 'youtube'
      when lower(evidence.metric_name) like 'apple_music_%' then 'apple_music'
      when lower(evidence.metric_name) like 'shazam_%' then 'shazam'
      when lower(evidence.metric_name) like 'deezer_%' then 'deezer'
      else null
    end,
    case
      when lower(evidence.metric_name) = 'spotify_monthly_listeners' then 'Monthly listeners'
      when lower(evidence.metric_name) in ('spotify_followers', 'instagram_followers', 'tiktok_followers') then 'Followers'
      when lower(evidence.metric_name) in ('spotify_playlist_total_reach', 'spotify_playlist_reach', 'spotify_editorial_playlist_total_reach', 'spotify_editorial_playlist_reach', 'apple_music_editorial_playlist_reach') then 'Playlist reach'
      when lower(evidence.metric_name) in ('spotify_playlist_count', 'spotify_editorial_playlist_count', 'apple_music_playlist_count', 'apple_music_editorial_playlist_count') then 'Playlist count'
      when lower(evidence.metric_name) = 'tiktok_likes' then 'Likes'
      when lower(evidence.metric_name) = 'tiktok_track_posts' then 'Track posts'
      when lower(evidence.metric_name) = 'tiktok_video_count' then 'Video count'
      when lower(evidence.metric_name) in ('tiktok_video_creates', 'tiktok_video_creates_total') then 'Video creates'
      when lower(evidence.metric_name) = 'tiktok_peak_day_video_creates' then 'Peak-day video creates'
      when lower(evidence.metric_name) in ('tiktok_top_video_views', 'tiktok_top_videos_views') then 'Top video views'
      when lower(evidence.metric_name) = 'youtube_subscribers' then 'Subscribers'
      when lower(evidence.metric_name) in ('youtube_views', 'youtube_monthly_video_views', 'youtube_daily_video_views') then 'Video views'
      when lower(evidence.metric_name) in ('apple_music_plays', 'apple_music_plays_total') then 'Plays'
      when lower(evidence.metric_name) in ('shazam_count', 'shazam_counts') then 'Shazams'
      when lower(evidence.metric_name) = 'deezer_fans' then 'Fans'
      when lower(evidence.metric_name) = 'spotify_streams' then 'Streams'
      when lower(evidence.metric_name) = 'spotify_trailing_7d_streams' then 'Streams over 7 days'
      when lower(evidence.metric_name) = 'spotify_trailing_28d_streams' then 'Streams over 28 days'
      when lower(evidence.metric_name) = 'spotify_stream_trend' then 'Stream trend'
      when lower(evidence.metric_name) in ('spotify_popularity', 'spotify_popularity_latest') then 'Popularity score'
      when lower(evidence.metric_name) = 'track_stage' then 'Track stage'
      when lower(evidence.metric_name) = 'track_career_health' then 'Track momentum'
      when lower(evidence.metric_name) = 'playlist_followers' then 'Playlist followers'
      when lower(evidence.metric_name) = 'playlist_movement' then 'Playlist movement'
      when lower(evidence.metric_name) = 'playlist_placement' then 'Playlist placement'
      when lower(evidence.metric_name) = 'career_stage' then 'Career stage'
      when lower(evidence.metric_name) = 'career_trend' then 'Career trend'
      when lower(evidence.metric_name) = 'artist_current_city' then 'Current listener market'
      when lower(evidence.metric_name) = 'listener_market' then 'Listener market'
      when lower(evidence.metric_name) ~ '^(spotify_)?listener_city_' then concat('Listeners in ', initcap(replace(regexp_replace(lower(evidence.metric_name), '^(spotify_)?listener_city_', ''), '_', ' ')))
      when lower(evidence.metric_name) ~ '^city_affinity_' then concat('Listener affinity: ', initcap(replace(regexp_replace(lower(evidence.metric_name), '^city_affinity_', ''), '_', ' ')))
      else null
    end,
    case
      when evidence.metric_value is not null then trim(to_char(evidence.metric_value, 'FM999999999999990.##'))
      else nullif(left(evidence.subject_label, 96), '')
    end,
    nullif(left(evidence.subject_label, 180), ''),
    null,
    1,
    case
      when lower(evidence.metric_name) in ('spotify_playlist_total_reach', 'spotify_playlist_reach', 'spotify_playlist_count', 'spotify_editorial_playlist_count', 'spotify_editorial_playlist_total_reach', 'spotify_editorial_playlist_reach', 'apple_music_playlist_count', 'apple_music_editorial_playlist_count', 'apple_music_editorial_playlist_reach', 'playlist_followers', 'playlist_movement', 'playlist_placement') then 4
      when lower(evidence.metric_name) in ('artist_current_city', 'listener_market') or lower(evidence.metric_name) ~ '^(spotify_)?listener_city_[a-z0-9_-]+$' or lower(evidence.metric_name) ~ '^city_affinity_[a-z0-9_-]+$' then 5
      when lower(evidence.metric_name) in ('spotify_streams', 'spotify_trailing_7d_streams', 'spotify_trailing_28d_streams', 'spotify_stream_trend', 'spotify_popularity', 'spotify_popularity_latest', 'track_stage', 'track_career_health', 'career_stage', 'career_trend') then 6
      else 3
    end,
    10
  from public.evidence_items as evidence
  join applied_actions as action on action.id = evidence.created_from_action_id
  join authorized_setup as setup
    on setup.account_id = evidence.account_id
    and setup.artist_workspace_id = evidence.artist_workspace_id
   and setup.artist_id = evidence.artist_id
  where evidence.id is not null
    and evidence.created_at is not null
    and evidence.metric_name is not null
    and lower(coalesce(evidence.subject_label, '')) !~ '(chartmetric|manager_discovery_tool|save_public_evidence|write_strategic_memory|web_search)'
    and (
      lower(evidence.metric_name) not in ('artist_current_city', 'listener_market')
      and lower(evidence.metric_name) !~ '^(spotify_)?listener_city_[a-z0-9_-]+$'
      and lower(evidence.metric_name) !~ '^city_affinity_[a-z0-9_-]+$'
      or action.discovery_status::text in ('completed', 'completed_with_limits')
    )
    and (
      lower(evidence.metric_name) in (
        'spotify_monthly_listeners', 'spotify_followers', 'spotify_playlist_total_reach', 'spotify_playlist_reach', 'spotify_playlist_count', 'spotify_editorial_playlist_count', 'spotify_editorial_playlist_total_reach', 'spotify_editorial_playlist_reach',
        'instagram_followers', 'tiktok_followers', 'tiktok_likes', 'tiktok_track_posts', 'tiktok_video_count', 'tiktok_video_creates', 'tiktok_video_creates_total', 'tiktok_peak_day_video_creates', 'tiktok_top_video_views', 'tiktok_top_videos_views',
        'youtube_subscribers', 'youtube_views', 'youtube_monthly_video_views', 'youtube_daily_video_views', 'apple_music_playlist_count', 'apple_music_editorial_playlist_count', 'apple_music_editorial_playlist_reach', 'apple_music_plays', 'apple_music_plays_total', 'shazam_count', 'shazam_counts', 'deezer_fans',
        'spotify_streams', 'spotify_trailing_7d_streams', 'spotify_trailing_28d_streams', 'spotify_stream_trend', 'spotify_popularity', 'spotify_popularity_latest', 'track_stage', 'track_career_health', 'playlist_followers', 'playlist_movement', 'playlist_placement', 'career_stage', 'career_trend', 'artist_current_city', 'listener_market'
      )
      or lower(evidence.metric_name) ~ '^(spotify_)?listener_city_[a-z0-9_-]+$'
      or lower(evidence.metric_name) ~ '^city_affinity_[a-z0-9_-]+$'
    )
    and (
      evidence.metric_value is not null
      or lower(evidence.metric_name) in ('spotify_stream_trend', 'track_stage', 'track_career_health', 'playlist_movement', 'playlist_placement', 'career_stage', 'career_trend', 'artist_current_city', 'listener_market')
    )
    and (evidence.metric_value is not null or nullif(trim(evidence.subject_label), '') is not null)

  union all

  select
    concat('manager-output:', output.id::text),
    'manager-read:setup-first',
    output.created_at,
    output.created_at,
    'synthesis', 'manager_read', 'manager_read', null, 'Manager read',
    left(coalesce(output.render_json ->> 'headlineRead', output.render_json ->> 'headline_read'), 180),
    'Your first Manager read is ready', null, 2, 8, 1
  from public.manager_outputs as output
  join public.manager_synthesis_runs as brief on brief.id = output.created_from_run_id
  join authorized_setup as setup
    on setup.account_id = output.account_id
   and setup.artist_workspace_id = output.artist_workspace_id
   and setup.artist_id = output.artist_id
  where output.is_current = true
    and output.output_type = 'setup_first_manager_read'
    and brief.status::text in ('completed', 'completed_with_limits')
    and brief.classification = 'setup_todays_brief_v1'
    and brief.scope_key = setup.id::text
    and nullif(trim(coalesce(output.render_json ->> 'headlineRead', output.render_json ->> 'headline_read')), '') is not null
    and lower(coalesce(output.render_json ->> 'headlineRead', output.render_json ->> 'headline_read', '')) !~ '(chartmetric|manager_discovery_tool|save_public_evidence|write_strategic_memory|web_search)'
),
ranked_findings as (
  select
    raw.*,
    row_number() over (partition by raw.kind order by raw.persisted_at asc, raw.kind_rank asc, raw.finding_id asc) as kind_position
  from raw_findings as raw
),
bounded_findings as (
  select
    ranked.*,
    row_number() over (order by ranked.persisted_at asc, ranked.phase_rank asc, ranked.kind_rank asc, ranked.finding_id asc) as overall_position
  from ranked_findings as ranked
  where ranked.kind_position <= ranked.kind_quota
),
limited_findings as (
  select bounded.*
  from bounded_findings as bounded
  where bounded.overall_position <= 32
  order by bounded.persisted_at asc, bounded.phase_rank asc, bounded.kind_rank asc, bounded.finding_id asc
  limit 32
),
final_findings as (
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', bounded.finding_id,
        'dedupeKey', bounded.dedupe_key,
        'revision', bounded.revision_at::text,
        'persistedAt', bounded.persisted_at::text,
        'phase', bounded.phase,
        'kind', bounded.kind,
        'destination', bounded.destination,
        'platform', bounded.platform,
        'title', bounded.title,
        'value', bounded.value,
        'detail', bounded.detail,
        'artwork', bounded.artwork
      ) order by bounded.persisted_at asc, bounded.phase_rank asc, bounded.kind_rank asc, bounded.finding_id asc
    ) filter (where bounded.overall_position <= 32),
    '[]'::jsonb
  ) as findings
  from limited_findings as bounded
),
artist_payload as (
  select case
    when profile.display_name is null then null
    else jsonb_build_object(
      'name', left(profile.display_name, 120),
      'imageUrl', case when (profile.spotify_identity ->> 'imageUrl') ~ '^https://' then profile.spotify_identity ->> 'imageUrl' else null end,
      'genres', to_jsonb(coalesce(profile.genres[1:2], '{}'::text[]))
    )
  end as artist
  from profile_row as profile
)
select jsonb_build_object(
  'version', 2,
  'observedAt', now()::text,
  'setup', jsonb_build_object(
    'runId', setup.id::text,
    'artistWorkspaceId', setup.artist_workspace_id::text,
    'status', setup.status::text,
    'phase', case
      when setup.status::text = 'completed' then 'ready'
      when setup.current_stage = 'setup_brief' then 'synthesis'
      when setup.current_stage = 'manager_discovery' then 'discovery'
      else 'catalogue'
    end,
    'startedAt', coalesce(setup.started_at, setup.created_at)::text,
    'phaseStartedAt', nullif(setup.stage_status -> setup.current_stage ->> 'started_at', ''),
    'updatedAt', coalesce(setup.updated_at, setup.created_at)::text
  ),
  'artist', artist_payload.artist,
  'findings', final_findings.findings,
  'projection', jsonb_build_object('bounded', true, 'maxFindings', 32, 'omittedMalformed', 0)
)
from authorized_setup as setup
left join artist_payload on true
cross join final_findings;
$function$;

revoke all on function public.get_setup_presentation_feed_v2(uuid) from public, anon, authenticated;
grant execute on function public.get_setup_presentation_feed_v2(uuid) to authenticated;

notify pgrst, 'reload schema';
