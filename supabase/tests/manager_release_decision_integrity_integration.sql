\set ON_ERROR_STOP on

begin;

do $$
declare
  v_account_id constant uuid := '91000000-0000-4000-8000-000000000001';
  v_artist_id constant uuid := '91000000-0000-4000-8000-000000000002';
  v_workspace_id constant uuid := '91000000-0000-4000-8000-000000000003';
  v_song_id constant uuid := '91000000-0000-4000-8000-000000000004';
  v_mission_id constant uuid := '91000000-0000-4000-8000-000000000005';
  v_release_plan_id constant uuid := '91000000-0000-4000-8000-000000000006';
  v_question_review_id constant uuid := '91000000-0000-4000-8000-000000000007';
  v_question_id constant uuid := '91000000-0000-4000-8000-000000000008';
  v_proposal jsonb;
  v_approval jsonb;
  v_replay jsonb;
  v_request_id uuid;
  v_effective jsonb;
  v_active_fact_count integer;
  v_projection_count integer;
  v_adaptive_review_count integer;
  v_question_status text;
  v_provider_date date;
  v_approved_date date;
  v_projection jsonb;
begin
  insert into public.accounts (id, name) values (v_account_id, 'Release decision regression');
  insert into public.artists (id, account_id, display_name) values (v_artist_id, v_account_id, 'Otmos regression');
  insert into public.artist_workspaces (id, account_id, artist_id, name, status) values (v_workspace_id, v_account_id, v_artist_id, 'Otmos', 'active');

  insert into public.music_items (id, account_id, artist_workspace_id, artist_id, title, item_type, lifecycle_stage, planned_release_date, metadata)
  values (v_song_id, v_account_id, v_workspace_id, v_artist_id, 'Odaeshi', 'song', 'scheduled', date '2026-09-05', jsonb_build_object('planned_release_date', '2026-09-05'));

  insert into public.missions (id, account_id, artist_workspace_id, artist_id, title, objective, status)
  values (v_mission_id, v_account_id, v_workspace_id, v_artist_id, 'Release Odaeshi', 'Release Odaeshi with enough runway.', 'active');

  insert into public.music_release_plans (id, account_id, artist_workspace_id, artist_id, music_item_id, mission_id, status, approved_release_date, revision)
  values (v_release_plan_id, v_account_id, v_workspace_id, v_artist_id, v_song_id, v_mission_id, 'approved', date '2026-09-05', 0);

  insert into public.reviews (id, account_id, artist_workspace_id, artist_id, mission_id, trigger_type, status, review_at)
  values (v_question_review_id, v_account_id, v_workspace_id, v_artist_id, v_mission_id, 'adaptive_replan', 'scheduled', now() + interval '1 day');

  insert into public.manager_question_requests (
    id, account_id, artist_workspace_id, artist_id, mission_id, review_id,
    context_request_id, question_key, question, reason, answer_kind,
    hypothesis, fallback_if_no, fact_domain, fact_key,
    fact_scope_type, fact_scope_key, expires_at, dedupe_key
  ) values (
    v_question_id, v_account_id, v_workspace_id, v_artist_id, v_mission_id, v_question_review_id,
    'release-date-regression-question', 'release_date_confirmation',
    'Do you still want September 26 as the release date?',
    'Old regression question that must disappear once the decision is approved.',
    'single_select', 'The artist wants September 26.', 'Keep the previous schedule.',
    'time', 'time.release_date', 'mission', 'mission:' || v_mission_id::text,
    now() + interval '7 days', 'release-date-regression-question'
  );

  v_proposal := public.propose_release_date_change(
    v_account_id, v_workspace_id, v_artist_id, v_song_id,
    date '2026-09-26', 'Give the release enough runway.', 0,
    jsonb_build_object('fromDate', '2026-09-05', 'proposedDate', '2026-09-26', 'expectedRevision', 0, 'previewHash', 'release-decision-regression-v1', 'changes', jsonb_build_array(), 'preserved', jsonb_build_array()),
    'release-decision-regression-v1', now() + interval '1 day', 'release-decision-regression-request-v1', null
  );

  v_request_id := nullif(v_proposal ->> 'requestId', '')::uuid;
  if v_request_id is null then raise exception 'regression proposal did not create a request'; end if;

  v_approval := public.approve_release_date_change(v_account_id, v_workspace_id, v_artist_id, v_request_id, 'release-decision-regression-v1', 'release-decision-regression-request-v1', null);
  if v_approval ->> 'approvedDate' is distinct from '2026-09-26' then raise exception 'approval result did not persist September 26: %', v_approval; end if;

  select planned_release_date into v_provider_date from public.music_items where id = v_song_id;
  if v_provider_date is distinct from date '2026-09-05' then raise exception 'provider/imported release date was rewritten: %', v_provider_date; end if;

  select approved_release_date into v_approved_date from public.music_release_plans where id = v_release_plan_id;
  if v_approved_date is distinct from date '2026-09-26' then raise exception 'canonical release plan did not move to September 26: %', v_approved_date; end if;

  v_effective := public.manager_effective_release_state_v1(v_song_id);
  if v_effective ->> 'effectiveReleaseDate' is distinct from '2026-09-26'
     or v_effective ->> 'approvedReleaseDate' is distinct from '2026-09-26'
     or v_effective ->> 'providerReleaseDate' is distinct from '2026-09-05'
     or v_effective ->> 'provenance' is distinct from 'approved_release_plan' then
    raise exception 'effective Manager release state is inconsistent after approval: %', v_effective;
  end if;

  select status into v_question_status from public.manager_question_requests where id = v_question_id;
  if v_question_status is distinct from 'superseded' then raise exception 'resolved release-date question survived approval: %', v_question_status; end if;

  select count(*) into v_active_fact_count
  from public.artist_operating_facts f
  where f.artist_workspace_id = v_workspace_id and f.artist_id = v_artist_id and f.fact_key = 'time.release_date'
    and f.scope_type = 'mission' and f.scope_key = 'mission:' || v_mission_id::text and f.status = 'active' and f.display_value = '2026-09-26';
  if v_active_fact_count <> 1 then raise exception 'expected exactly one canonical active release-date fact, got %', v_active_fact_count; end if;

  select count(*) into v_projection_count
  from public.memory_entries m
  where m.artist_workspace_id = v_workspace_id and m.source_type = 'canonical_release_plan' and m.source_id = v_release_plan_id;
  select m.content::jsonb into v_projection
  from public.memory_entries m
  where m.artist_workspace_id = v_workspace_id and m.source_type = 'canonical_release_plan' and m.source_id = v_release_plan_id
  limit 1;
  if v_projection_count <> 1 or v_projection ->> 'effectiveReleaseDate' is distinct from '2026-09-26' or v_projection ->> 'musicItemId' is distinct from v_song_id::text then
    raise exception 'bounded Manager opening projection is wrong: count %, projection %', v_projection_count, v_projection;
  end if;

  select count(*) into v_adaptive_review_count
  from public.reviews r
  where r.artist_workspace_id = v_workspace_id and r.runtime_key = 'release-date-change:' || v_request_id::text || ':approved';
  if v_adaptive_review_count <> 1 then raise exception 'expected exactly one adaptive replan review after approval, got %', v_adaptive_review_count; end if;

  v_replay := public.approve_release_date_change(v_account_id, v_workspace_id, v_artist_id, v_request_id, 'release-decision-regression-v1', 'release-decision-regression-request-v1', null);
  if v_replay is distinct from v_approval then raise exception 'idempotent approval replay returned a different result'; end if;

  select count(*) into v_active_fact_count
  from public.artist_operating_facts f
  where f.artist_workspace_id = v_workspace_id and f.artist_id = v_artist_id and f.fact_key = 'time.release_date'
    and f.scope_type = 'mission' and f.scope_key = 'mission:' || v_mission_id::text and f.status = 'active';
  select count(*) into v_projection_count from public.memory_entries m where m.artist_workspace_id = v_workspace_id and m.source_type = 'canonical_release_plan' and m.source_id = v_release_plan_id;
  select count(*) into v_adaptive_review_count from public.reviews r where r.artist_workspace_id = v_workspace_id and r.runtime_key = 'release-date-change:' || v_request_id::text || ':approved';

  if v_active_fact_count <> 1 or v_projection_count <> 1 or v_adaptive_review_count <> 1 then
    raise exception 'approval replay duplicated canonical state: facts %, projections %, reviews %', v_active_fact_count, v_projection_count, v_adaptive_review_count;
  end if;
end;
$$;

rollback;