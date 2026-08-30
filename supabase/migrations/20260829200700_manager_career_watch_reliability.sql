-- Keep Career Watch evidence advisory until it matches canonical active work,
-- serialize URL deduplication, and make provider usage idempotent per run.

alter table public.manager_career_watch_state
  add column if not exists execution_token uuid,
  add column if not exists execution_expires_at timestamptz,
  add column if not exists execution_started_at timestamptz;

create or replace function public.claim_due_manager_career_watch_v1(batch_size integer default 8)
returns setof public.manager_career_watch_state
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with due as (
    select s.account_id,s.artist_workspace_id,s.artist_id
    from public.manager_career_watch_state s
    where s.enabled
      and s.next_run_at <= now()
      and (s.execution_expires_at is null or s.execution_expires_at <= now())
    order by s.next_run_at asc
    for update skip locked
    limit greatest(1,least(coalesce(batch_size,8),20))
  )
  update public.manager_career_watch_state s
  set last_started_at = now(),
      next_run_at = now() + make_interval(hours => s.cadence_hours),
      last_error = null,
      execution_token = gen_random_uuid(),
      execution_expires_at = now() + interval '5 minutes',
      execution_started_at = null
  from due
  where s.account_id = due.account_id
    and s.artist_workspace_id = due.artist_workspace_id
    and s.artist_id = due.artist_id
  returning s.*;
end;
$$;
revoke all on function public.claim_due_manager_career_watch_v1(integer) from public,anon,authenticated;
grant execute on function public.claim_due_manager_career_watch_v1(integer) to service_role;

create or replace function public.begin_manager_career_watch_execution_v1(
  p_account_id uuid,
  p_artist_workspace_id uuid,
  p_artist_id uuid,
  p_execution_token uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
  update public.manager_career_watch_state
  set execution_started_at = now()
  where account_id = p_account_id
    and artist_workspace_id = p_artist_workspace_id
    and artist_id = p_artist_id
    and execution_token = p_execution_token
    and execution_expires_at > now()
    and execution_started_at is null
  returning true
$$;
revoke all on function public.begin_manager_career_watch_execution_v1(uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.begin_manager_career_watch_execution_v1(uuid,uuid,uuid,uuid) to service_role;

create or replace function public.finish_manager_career_watch_execution_v1(
  p_account_id uuid,
  p_artist_workspace_id uuid,
  p_artist_id uuid,
  p_execution_token uuid,
  p_run_id uuid,
  p_succeeded boolean,
  p_error text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.manager_career_watch_state
  set last_completed_at = case when p_succeeded then now() else last_completed_at end,
      last_run_id = case when p_succeeded then p_run_id else last_run_id end,
      last_error = case when p_succeeded then null else left(coalesce(p_error,'Career Watch failed.'),1000) end,
      next_run_at = case when p_succeeded then next_run_at else least(next_run_at, now() + interval '1 hour') end,
      execution_token = null,
      execution_expires_at = null,
      execution_started_at = null
  where account_id = p_account_id
    and artist_workspace_id = p_artist_workspace_id
    and artist_id = p_artist_id
    and execution_token = p_execution_token;
  return found;
end;
$$;
revoke all on function public.finish_manager_career_watch_execution_v1(uuid,uuid,uuid,uuid,uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.finish_manager_career_watch_execution_v1(uuid,uuid,uuid,uuid,uuid,boolean,text) to service_role;

create unique index if not exists ai_run_usage_events_career_watch_unique_idx
  on public.ai_run_usage_events (manager_synthesis_run_id, operation_key)
  where manager_synthesis_run_id is not null
    and operation_key = 'manager_career_watch_v1';

create or replace function public.persist_manager_career_watch_evidence_v1(
  p_account_id uuid,
  p_artist_workspace_id uuid,
  p_artist_id uuid,
  p_rows jsonb
)
returns setof public.evidence_items
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate public.evidence_items%rowtype;
  inserted public.evidence_items%rowtype;
begin
  if jsonb_typeof(coalesce(p_rows, '[]'::jsonb)) <> 'array' then
    raise exception 'Career Watch evidence payload must be an array.';
  end if;

  for candidate in
    select * from jsonb_populate_recordset(null::public.evidence_items, p_rows)
  loop
    if candidate.account_id is distinct from p_account_id
      or candidate.artist_workspace_id is distinct from p_artist_workspace_id
      or candidate.artist_id is distinct from p_artist_id
      or candidate.evidence_type is distinct from 'manager_career_watch'
      or nullif(trim(candidate.raw_ref), '') is null
    then
      raise exception 'Career Watch evidence scope or provenance is invalid.';
    end if;

    -- All writers through this service-only function serialize on the scoped URL.
    -- That makes the seven-day dedupe decision safe under concurrent workers.
    perform pg_advisory_xact_lock(hashtextextended(
      p_artist_workspace_id::text || ':' || lower(trim(candidate.raw_ref)),
      772007
    ));

    if exists (
      select 1
      from public.evidence_items existing
      where existing.account_id = p_account_id
        and existing.artist_workspace_id = p_artist_workspace_id
        and existing.artist_id = p_artist_id
        and existing.evidence_type = 'manager_career_watch'
        and lower(trim(existing.raw_ref)) = lower(trim(candidate.raw_ref))
        and existing.created_at >= now() - interval '7 days'
    ) then
      continue;
    end if;

    insert into public.evidence_items (
      account_id, artist_workspace_id, artist_id, source_snapshot_id,
      uploaded_file_id, provider_id, source, source_kind, evidence_type,
      subject_type, subject_id, subject_label, time_window_start,
      time_window_end, metric_name, metric_value, metric_unit, lens,
      freshness, confidence, provenance, limitation, raw_ref,
      created_from_run_id, metadata
    ) values (
      candidate.account_id, candidate.artist_workspace_id, candidate.artist_id,
      candidate.source_snapshot_id, candidate.uploaded_file_id,
      candidate.provider_id, candidate.source, candidate.source_kind,
      candidate.evidence_type, candidate.subject_type, candidate.subject_id,
      candidate.subject_label, candidate.time_window_start,
      candidate.time_window_end, candidate.metric_name, candidate.metric_value,
      candidate.metric_unit, candidate.lens, candidate.freshness,
      candidate.confidence, candidate.provenance, candidate.limitation,
      trim(candidate.raw_ref), candidate.created_from_run_id,
      coalesce(candidate.metadata, '{}'::jsonb)
    ) returning * into inserted;

    return next inserted;
  end loop;
  return;
end;
$$;
revoke all on function public.persist_manager_career_watch_evidence_v1(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.persist_manager_career_watch_evidence_v1(uuid,uuid,uuid,jsonb) to service_role;

create or replace function public.queue_manager_career_watch_review_v1(
  p_evidence_id uuid,
  p_run_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  e public.evidence_items%rowtype;
  m public.missions%rowtype;
  review_id uuid;
  v_objective text;
  next_move text;
  review_key text;
begin
  select * into e from public.evidence_items where id = p_evidence_id;
  if e.id is null
    or e.evidence_type <> 'manager_career_watch'
    or coalesce(e.metadata->>'recommended_decision', '') <> 'act'
  then
    return null;
  end if;

  v_objective := nullif(trim(e.metadata->>'mission_objective'), '');
  next_move := nullif(trim(e.metadata->>'next_move'), '');
  if v_objective is null then return null; end if;

  -- Public evidence can adapt existing canonical work, but cannot prove that a
  -- new opportunity is available or create an active Mission on its own.
  select * into m
  from public.missions
  where account_id = e.account_id
    and artist_workspace_id = e.artist_workspace_id
    and artist_id = e.artist_id
    and status not in('complete','archived','cancelled')
    and lower(coalesce(missions.objective, '')) = lower(v_objective)
  order by updated_at desc
  limit 1;
  if m.id is null then return null; end if;

  review_key := 'career-watch:' || e.id::text;
  insert into public.reviews(
    account_id,artist_workspace_id,artist_id,mission_id,trigger_type,
    trigger_object_type,trigger_object_id,previous_recommendation,current_read,
    what_changed,next_action,status,review_at,created_from_run_id,runtime_key
  ) values(
    e.account_id,e.artist_workspace_id,e.artist_id,m.id,'adaptive_replan',
    'evidence_item',e.id,m.current_recommendation,
    coalesce(e.metadata->>'claim',e.subject_label),
    coalesce(e.metadata->>'why_it_matters',e.metadata->>'fit_reason'),
    coalesce(next_move,'Evaluate whether this external development should change the active route.'),
    'due',now(),p_run_id,review_key
  )
  on conflict(artist_workspace_id,runtime_key) where runtime_key is not null
  do update set
    current_read = excluded.current_read,
    what_changed = excluded.what_changed,
    next_action = excluded.next_action,
    status = case when reviews.status = 'completed' then reviews.status else 'due'::public.review_status end,
    review_at = case when reviews.status = 'completed' then reviews.review_at else now() end,
    runtime_claimed_at = case when reviews.status = 'completed' then reviews.runtime_claimed_at else null end,
    runtime_last_error = case when reviews.status = 'completed' then reviews.runtime_last_error else null end
  returning id into review_id;
  return review_id;
end;
$$;
revoke all on function public.queue_manager_career_watch_review_v1(uuid,uuid) from public,anon,authenticated;
grant execute on function public.queue_manager_career_watch_review_v1(uuid,uuid) to service_role;

notify pgrst, 'reload schema';
