\set ON_ERROR_STOP on

-- Product regression for the old failure mode:
-- provider date A -> Manager proposes B -> artist approves B -> next Manager state
-- must treat B as canonical, retire the old release-date question and keep provider
-- history unchanged. Replaying approval must not duplicate the transition.
begin;

do $$
declare
  account_id constant uuid := '91000000-0000-4000-8000-000000000001';
  artist_id constant uuid := '91000000-0000-4000-8000-000000000002';
  workspace_id constant uuid := '91000000-0000-4000-8000-000000000003';
  song_id constant uuid := '91000000-0000-4000-8000-000000000004';
  mission_id constant uuid := '91000000-0000-4000-8000-000000000005';
  release_plan_id constant uuid := '91000000-0000-4000-8000-000000000006';
  question_review_id constant uuid := '91000000-0000-4000-8000-000000000007';
  question_id constant uuid := '91000000-0000-4000-8000-000000000008';
  proposal jsonb;
  approval jsonb;
  replay jsonb;
  request_id uuid;
  effective jsonb;
  active_fact_count integer;
  projection_count integer;
  adaptive_review_count integer;
  question_status text;
  provider_date date;
  approved_date date;
  projection jsonb;
begin
  insert into public.accounts (id, name) values (account_id, 'Release decision regression');
  insert into public.artists (id, account_id, display_name)
  values (artist_id, account_id, 'Otmos regression');
  insert into public.artist_workspaces (id, account_id, artist_id, name, status)
  values (workspace_id, account_id, artist_id, 'Otmos', 'active');

  insert into public.music_items (
    id, account_id, artist_workspace_id, artist_id,
    title, item_type, lifecycle_stage, planned_release_date, metadata
  ) values (
    song_id, account_id, workspace_id, artist_id,
    'Odaeshi', 'song', 'scheduled', date '2026-09-05',
    jsonb_build_object('planned_release_date', '2026-09-05')
  );

  insert into public.missions (
    id, account_id, artist_workspace_id, artist_id,
    title, objective, status
  ) values (
    mission_id, account_id, workspace_id, artist_id,
    'Release Odaeshi', 'Release Odaeshi with enough runway.', 'active'
  );

  insert into public.music_release_plans (
    id, account_id, artist_workspace_id, artist_id,
    music_item_id, mission_id, status, approved_release_date, revision
  ) values (
    release_plan_id, account_id, workspace_id, artist_id,
    song_id, mission_id, 'approved', date '2026-09-05', 0
  );

  insert into public.reviews (
    id, account_id, artist_workspace_id, artist_id, mission_id,
    trigger_type, status, review_at
  ) values (
    question_review_id, account_id, workspace_id, artist_id, mission_id,
    'adaptive_replan', 'scheduled', now() + interval '1 day'
  );

  insert into public.manager_question_requests (
    id, account_id, artist_workspace_id, artist_id, mission_id, review_id,
    context_request_id, question_key, question, reason, answer_kind,
    hypothesis, fallback_if_no, fact_domain, fact_key,
    fact_scope_type, fact_scope_key, expires_at, dedupe_key
  ) values (
    question_id, account_id, workspace_id, artist_id, mission_id, question_review_id,
    'release-date-regression-question', 'release_date_confirmation',
    'Do you still want September 26 as the release date?',
    'Old regression question that must disappear once the decision is approved.',
    'single_select', 'The artist wants September 26.', 'Keep the previous schedule.',
    'time', 'time.release_date', 'mission', 'mission:' || mission_id::text,
    now() + interval '7 days', 'release-date-regression-question'
  );

  proposal := public.propose_release_date_change(
    account_id,
    workspace_id,
    artist_id,
    song_id,
    date '2026-09-26',
    'Give the release enough runway.',
    0,
    jsonb_build_object(
      'fromDate', '2026-09-05',
      'proposedDate', '2026-09-26',
      'expectedRevision', 0,
      'previewHash', 'release-decision-regression-v1',
      'changes', jsonb_build_array(),
      'preserved', jsonb_build_array()
    ),
    'release-decision-regression-v1',
    now() + interval '1 day',
    'release-decision-regression-request-v1',
    null
  );

  request_id := nullif(proposal ->> 'requestId', '')::uuid;
  if request_id is null then
    raise exception 'regression proposal did not create a request';
  end if;

  approval := public.approve_release_date_change(
    account_id,
    workspace_id,
    artist_id,
    request_id,
    'release-decision-regression-v1',
    'release-decision-regression-request-v1',
    null
  );

  if approval ->> 'approvedDate' is distinct from '2026-09-26' then
    raise exception 'approval result did not persist September 26: %', approval;
  end if;

  select planned_release_date into provider_date
  from public.music_items where id = song_id;
  if provider_date is distinct from date '2026-09-05' then
    raise exception 'provider/imported release date was rewritten: %', provider_date;
  end if;

  select approved_release_date into approved_date
  from public.music_release_plans where id = release_plan_id;
  if approved_date is distinct from date '2026-09-26' then
    raise exception 'canonical release plan did not move to September 26: %', approved_date;
  end if;

  effective := public.manager_effective_release_state_v1(song_id);
  if effective ->> 'effectiveReleaseDate' is distinct from '2026-09-26'
     or effective ->> 'approvedReleaseDate' is distinct from '2026-09-26'
     or effective ->> 'providerReleaseDate' is distinct from '2026-09-05'
     or effective ->> 'provenance' is distinct from 'approved_release_plan' then
    raise exception 'effective Manager release state is inconsistent after approval: %', effective;
  end if;

  select status into question_status
  from public.manager_question_requests where id = question_id;
  if question_status is distinct from 'superseded' then
    raise exception 'resolved release-date question survived approval: %', question_status;
  end if;

  select count(*) into active_fact_count
  from public.artist_operating_facts
  where artist_workspace_id = workspace_id
    and artist_id = artist_id
    and fact_key = 'time.release_date'
    and scope_type = 'mission'
    and scope_key = 'mission:' || mission_id::text
    and status = 'active'
    and display_value = '2026-09-26';
  if active_fact_count <> 1 then
    raise exception 'expected exactly one canonical active release-date fact, got %', active_fact_count;
  end if;

  select count(*), max(content::jsonb)
  into projection_count, projection
  from public.memory_entries
  where artist_workspace_id = workspace_id
    and source_type = 'canonical_release_plan'
    and source_id = release_plan_id;
  if projection_count <> 1
     or projection ->> 'effectiveReleaseDate' is distinct from '2026-09-26'
     or projection ->> 'musicItemId' is distinct from song_id::text then
    raise exception 'bounded Manager opening projection is wrong: count %, projection %', projection_count, projection;
  end if;

  select count(*) into adaptive_review_count
  from public.reviews
  where artist_workspace_id = workspace_id
    and runtime_key = 'release-date-change:' || request_id::text || ':approved';
  if adaptive_review_count <> 1 then
    raise exception 'expected exactly one adaptive replan review after approval, got %', adaptive_review_count;
  end if;

  -- The artist pressing Approve again / a client replay must return the original
  -- result without creating another canonical fact, read projection or review.
  replay := public.approve_release_date_change(
    account_id,
    workspace_id,
    artist_id,
    request_id,
    'release-decision-regression-v1',
    'release-decision-regression-request-v1',
    null
  );
  if replay is distinct from approval then
    raise exception 'idempotent approval replay returned a different result';
  end if;

  select count(*) into active_fact_count
  from public.artist_operating_facts
  where artist_workspace_id = workspace_id
    and fact_key = 'time.release_date'
    and scope_type = 'mission'
    and scope_key = 'mission:' || mission_id::text
    and status = 'active';
  select count(*) into projection_count
  from public.memory_entries
  where artist_workspace_id = workspace_id
    and source_type = 'canonical_release_plan'
    and source_id = release_plan_id;
  select count(*) into adaptive_review_count
  from public.reviews
  where artist_workspace_id = workspace_id
    and runtime_key = 'release-date-change:' || request_id::text || ':approved';

  if active_fact_count <> 1 or projection_count <> 1 or adaptive_review_count <> 1 then
    raise exception 'approval replay duplicated canonical state: facts %, projections %, reviews %',
      active_fact_count, projection_count, adaptive_review_count;
  end if;
end;
$$;

rollback;