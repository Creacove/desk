-- Adaptive Manager replanning.
--
-- The model proposes one complete replacement plan. Postgres installs that plan
-- atomically so an artist can never see half of the old route and half of the
-- new route. A plan_replan_required operating event creates a due review and
-- nudges one global worker; a guarded cron is only a recovery safety net.

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create unique index if not exists reviews_manager_replan_trigger_uidx
on public.reviews (trigger_type, trigger_object_type, trigger_object_id, created_from_run_id)
where trigger_type = 'adaptive_replan'
  and trigger_object_type = 'task'
  and created_from_run_id is not null;

create or replace function public.claim_manager_runtime_review_v1(p_review_id uuid)
returns table (
  id uuid,
  account_id uuid,
  artist_workspace_id uuid,
  artist_id uuid,
  mission_id uuid,
  checkpoint_id uuid,
  trigger_type text,
  trigger_object_type text,
  trigger_object_id uuid,
  current_read text,
  what_changed text,
  next_action text,
  created_from_run_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.reviews as review
  set status = 'running'
  where review.id = p_review_id
    and review.status in ('due', 'scheduled')
    and coalesce(review.snoozed_until, review.review_at, now()) <= now()
  returning
    review.id,
    review.account_id,
    review.artist_workspace_id,
    review.artist_id,
    review.mission_id,
    review.checkpoint_id,
    review.trigger_type,
    review.trigger_object_type,
    review.trigger_object_id,
    review.current_read,
    review.what_changed,
    review.next_action,
    review.created_from_run_id;
end;
$$;

revoke all on function public.claim_manager_runtime_review_v1(uuid) from public, anon, authenticated;
grant execute on function public.claim_manager_runtime_review_v1(uuid) to service_role;

create or replace function public.finalize_manager_replan_v1(
  p_review_id uuid,
  p_run_id uuid,
  p_output jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  review_row public.reviews%rowtype;
  mission_row public.missions%rowtype;
  active_plan_id uuid;
  new_plan_id uuid;
  next_version integer;
  owner_user_id uuid;
  checkpoint_item jsonb;
  task_item jsonb;
  permission_item jsonb;
  step_text text;
  checkpoint_id uuid;
  task_id uuid;
  checkpoint_key text;
  checkpoint_map jsonb := '{}'::jsonb;
  has_human_work boolean;
  decision text := coalesce(p_output ->> 'decision', '');
  recommendation text := coalesce(p_output ->> 'missionRecommendation', '');
  plan_summary text := coalesce(p_output ->> 'planSummary', '');
  strategy_state jsonb := coalesce(p_output -> 'strategyState', '{}'::jsonb);
  now_at timestamptz := now();
begin
  select * into review_row
  from public.reviews
  where id = p_review_id
  for update;

  if not found then raise exception 'Manager runtime review not found'; end if;
  if review_row.status <> 'running' then raise exception 'Manager runtime review is not running'; end if;
  if review_row.mission_id is null then raise exception 'Adaptive replan requires a mission'; end if;
  if decision not in ('no_change', 'replan') then raise exception 'Adaptive replan decision is invalid'; end if;

  select * into mission_row
  from public.missions
  where id = review_row.mission_id
    and account_id = review_row.account_id
    and artist_workspace_id = review_row.artist_workspace_id
    and artist_id = review_row.artist_id
  for update;

  if not found then raise exception 'Adaptive replan mission not found'; end if;

  if not exists (
    select 1 from public.manager_synthesis_runs as run
    where run.id = p_run_id
      and run.account_id = review_row.account_id
      and run.artist_workspace_id = review_row.artist_workspace_id
      and run.artist_id = review_row.artist_id
      and run.mission_id = review_row.mission_id
      and run.status = 'running'
  ) then
    raise exception 'Adaptive replan run is not active for this mission';
  end if;

  if decision = 'no_change' then
    if recommendation <> '' then
      update public.missions
      set current_recommendation = recommendation,
          updated_at = now_at
      where id = mission_row.id;
    end if;

    update public.reviews
    set current_read = coalesce(nullif(p_output ->> 'reason', ''), current_read),
        what_changed = coalesce(nullif(p_output ->> 'whatChanged', ''), what_changed),
        recommendation_changed = false,
        outcome = 'no_change',
        next_action = coalesce(nullif(recommendation, ''), next_action),
        status = 'completed'
    where id = review_row.id;

    update public.manager_synthesis_runs
    set status = 'completed',
        confidence = 'medium',
        steps_payload = jsonb_build_array(
          jsonb_build_object('step', 'review_claimed', 'status', 'completed'),
          jsonb_build_object('step', 'adaptive_plan_compiled', 'status', 'completed'),
          jsonb_build_object('step', 'plan_finalized', 'status', 'completed')
        ),
        action_plan = jsonb_build_array(p_output),
        completed_at = now_at
    where id = p_run_id;

    insert into public.operating_events (
      account_id, artist_workspace_id, artist_id, event_type, actor_type,
      target_type, target_id, source_type, source_id, manager_synthesis_run_id,
      mission_id, checkpoint_id, task_id, dedupe_key, display_mode, refresh_scope,
      summary, payload
    ) values (
      review_row.account_id,
      review_row.artist_workspace_id,
      review_row.artist_id,
      'manager_replan_not_needed',
      'manager',
      'mission',
      mission_row.id,
      'manager_runtime_review',
      review_row.id,
      p_run_id,
      mission_row.id,
      review_row.checkpoint_id,
      review_row.trigger_object_id,
      'adaptive-replan:no-change:' || review_row.id::text,
      'activity',
      array['missions', 'activity']::text[],
      coalesce(nullif(p_output ->> 'reason', ''), 'Desk checked the change. The current plan still holds.'),
      p_output
    ) on conflict (artist_workspace_id, dedupe_key) do nothing;

    return jsonb_build_object('decision', 'no_change', 'missionId', mission_row.id, 'planId', mission_row.active_plan_version_id);
  end if;

  if jsonb_array_length(coalesce(p_output -> 'checkpoints', '[]'::jsonb)) = 0 then
    raise exception 'Replacement plan requires at least one checkpoint';
  end if;

  active_plan_id := mission_row.active_plan_version_id;
  select coalesce(max(version), 0) + 1 into next_version
  from public.mission_plan_versions
  where mission_id = mission_row.id;

  insert into public.mission_plan_versions (
    account_id,
    artist_workspace_id,
    artist_id,
    mission_id,
    version,
    status,
    generated_from_run_id,
    summary,
    strategy_state
  ) values (
    review_row.account_id,
    review_row.artist_workspace_id,
    review_row.artist_id,
    mission_row.id,
    next_version,
    'active',
    p_run_id,
    plan_summary,
    strategy_state
  ) returning id into new_plan_id;

  if active_plan_id is not null then
    update public.mission_plan_versions
    set status = 'superseded',
        superseded_at = now_at,
        superseded_by_plan_id = new_plan_id
    where mission_id = mission_row.id
      and id <> new_plan_id
      and status in ('active', 'draft');

    update public.checkpoints
    set status = 'skipped', updated_at = now_at
    where mission_id = mission_row.id
      and mission_plan_version_id <> new_plan_id
      and status in ('waiting', 'blocked', 'ready_for_manager_check', 'watching_signal', 'needs_revision');

    update public.tasks
    set status = 'superseded', updated_at = now_at
    where mission_id = mission_row.id
      and mission_plan_version_id <> new_plan_id
      and status in ('proposed', 'open', 'needs_approval', 'approved', 'in_progress', 'blocked', 'missed');
  end if;

  for checkpoint_item in
    select value from jsonb_array_elements(p_output -> 'checkpoints')
  loop
    checkpoint_key := lower(regexp_replace(coalesce(checkpoint_item ->> 'key', ''), '[^a-zA-Z0-9]+', '_', 'g'));
    checkpoint_key := trim(both '_' from checkpoint_key);
    if checkpoint_key = '' then raise exception 'Replacement checkpoint key is missing'; end if;
    if checkpoint_map ? checkpoint_key then raise exception 'Replacement checkpoint key is duplicated: %', checkpoint_key; end if;

    select exists (
      select 1
      from jsonb_array_elements(coalesce(p_output -> 'tasks', '[]'::jsonb)) as item
      where lower(regexp_replace(coalesce(item ->> 'checkpointKey', ''), '[^a-zA-Z0-9]+', '_', 'g')) = checkpoint_key
    ) into has_human_work;

    insert into public.checkpoints (
      account_id,
      artist_workspace_id,
      artist_id,
      mission_id,
      mission_plan_version_id,
      title,
      status,
      question,
      reason_for_checkpoint,
      watched_signals,
      decision_rule,
      recommendation,
      next_action,
      dependency_impact,
      created_from_run_id
    ) values (
      review_row.account_id,
      review_row.artist_workspace_id,
      review_row.artist_id,
      mission_row.id,
      new_plan_id,
      coalesce(nullif(checkpoint_item ->> 'title', ''), 'Manager review'),
      case when has_human_work then 'waiting'::public.checkpoint_status else 'watching_signal'::public.checkpoint_status end,
      coalesce(nullif(checkpoint_item ->> 'question', ''), 'Does the current evidence support the next move?'),
      coalesce(nullif(checkpoint_item ->> 'question', ''), 'Adaptive Manager decision gate'),
      array(select jsonb_array_elements_text(coalesce(checkpoint_item -> 'watchedSignals', '[]'::jsonb))),
      coalesce(nullif(checkpoint_item ->> 'decisionRule', ''), 'Manager decides when sufficient evidence exists.'),
      coalesce(checkpoint_item ->> 'managerRead', ''),
      coalesce(checkpoint_item ->> 'nextAction', ''),
      'Downstream human work waits for this decision gate when dependencies require it.',
      p_run_id
    ) returning id into checkpoint_id;

    checkpoint_map := checkpoint_map || jsonb_build_object(checkpoint_key, checkpoint_id::text);

    insert into public.mission_plan_checkpoints (
      account_id, artist_workspace_id, artist_id, mission_plan_version_id,
      mission_id, checkpoint_id, order_index, phase_label, unlock_rule
    ) values (
      review_row.account_id,
      review_row.artist_workspace_id,
      review_row.artist_id,
      new_plan_id,
      mission_row.id,
      checkpoint_id,
      (select count(*) from public.mission_plan_checkpoints where mission_plan_version_id = new_plan_id) + 1,
      coalesce(nullif(checkpoint_item ->> 'title', ''), 'Manager review'),
      coalesce(nullif(checkpoint_item ->> 'decisionRule', ''), 'Manager decision')
    );
  end loop;

  select membership.user_id into owner_user_id
  from public.account_memberships as membership
  where membership.account_id = review_row.account_id
    and membership.status = 'active'
  order by case when membership.role = 'owner' then 0 else 1 end, membership.created_at asc
  limit 1;

  for task_item in
    select value from jsonb_array_elements(coalesce(p_output -> 'tasks', '[]'::jsonb))
  loop
    if coalesce(task_item ->> 'workMode', '') not in ('artist_action', 'collaborative') then
      raise exception 'Replacement plan attempted to schedule Manager-owned work as a task';
    end if;

    checkpoint_key := lower(regexp_replace(coalesce(task_item ->> 'checkpointKey', ''), '[^a-zA-Z0-9]+', '_', 'g'));
    checkpoint_key := trim(both '_' from checkpoint_key);
    checkpoint_id := nullif(checkpoint_map ->> checkpoint_key, '')::uuid;
    if checkpoint_id is null then raise exception 'Replacement task references unknown checkpoint: %', checkpoint_key; end if;

    insert into public.tasks (
      account_id,
      artist_workspace_id,
      artist_id,
      scope,
      mission_id,
      mission_plan_version_id,
      primary_checkpoint_id,
      title,
      owner_role,
      work_mode,
      deadline,
      available_from,
      estimated_minutes,
      assignee_user_id,
      priority,
      status,
      approval_state,
      purpose,
      evidence_needed,
      completion_expectation,
      completion_mode,
      deliverable_title,
      deliverable_requirements,
      manager_responsibility,
      user_responsibility,
      risk_if_late,
      created_from_run_id
    ) values (
      review_row.account_id,
      review_row.artist_workspace_id,
      review_row.artist_id,
      'mission',
      mission_row.id,
      new_plan_id,
      checkpoint_id,
      coalesce(nullif(task_item ->> 'title', ''), 'Mission work'),
      coalesce(nullif(task_item ->> 'ownerRole', ''), 'Artist / team'),
      task_item ->> 'workMode',
      nullif(task_item ->> 'deadline', '')::timestamptz,
      nullif(task_item ->> 'availableFrom', '')::timestamptz,
      greatest(5, least(240, coalesce((task_item ->> 'estimatedMinutes')::integer, 30))),
      owner_user_id,
      1,
      'open',
      'not_required',
      coalesce(task_item ->> 'purpose', ''),
      '{}'::text[],
      coalesce(task_item ->> 'completionExpectation', ''),
      task_item ->> 'completionMode',
      null,
      '{}'::text[],
      coalesce(task_item ->> 'managerResponsibility', ''),
      coalesce(task_item ->> 'userResponsibility', ''),
      coalesce(task_item ->> 'riskIfLate', ''),
      p_run_id
    ) returning id into task_id;

    for step_text in
      select value from jsonb_array_elements_text(coalesce(task_item -> 'steps', '[]'::jsonb))
    loop
      insert into public.task_steps (
        account_id, artist_workspace_id, artist_id, task_id, order_index, body
      ) values (
        review_row.account_id,
        review_row.artist_workspace_id,
        review_row.artist_id,
        task_id,
        (select count(*) from public.task_steps where public.task_steps.task_id = task_id) + 1,
        step_text
      );
    end loop;
  end loop;

  for permission_item in
    select value from jsonb_array_elements(coalesce(p_output -> 'permissionRequests', '[]'::jsonb))
  loop
    insert into public.permission_requests (
      account_id,
      artist_workspace_id,
      artist_id,
      mission_id,
      request_type,
      title,
      body,
      risk,
      status,
      created_from_run_id
    ) values (
      review_row.account_id,
      review_row.artist_workspace_id,
      review_row.artist_id,
      mission_row.id,
      (permission_item ->> 'requestType')::public.permission_request_type,
      coalesce(nullif(permission_item ->> 'title', ''), 'Manager approval'),
      coalesce(permission_item ->> 'body', ''),
      coalesce(permission_item ->> 'risk', ''),
      'pending',
      p_run_id
    );
  end loop;

  update public.missions
  set active_plan_version_id = new_plan_id,
      current_recommendation = coalesce(nullif(recommendation, ''), current_recommendation),
      review_point = coalesce((p_output -> 'checkpoints' -> 0 ->> 'title'), review_point),
      updated_at = now_at
  where id = mission_row.id;

  update public.reviews
  set previous_recommendation = mission_row.current_recommendation,
      current_read = coalesce(nullif(p_output ->> 'reason', ''), current_read),
      what_changed = coalesce(nullif(p_output ->> 'whatChanged', ''), what_changed),
      recommendation_changed = true,
      outcome = 'replanned',
      next_action = coalesce(nullif(recommendation, ''), next_action),
      status = 'completed'
  where id = review_row.id;

  update public.manager_synthesis_runs
  set status = 'completed',
      confidence = 'medium',
      steps_payload = jsonb_build_array(
        jsonb_build_object('step', 'review_claimed', 'status', 'completed'),
        jsonb_build_object('step', 'adaptive_plan_compiled', 'status', 'completed'),
        jsonb_build_object('step', 'plan_finalized', 'status', 'completed')
      ),
      action_plan = jsonb_build_array(p_output),
      completed_at = now_at
  where id = p_run_id;

  insert into public.operating_events (
    account_id, artist_workspace_id, artist_id, event_type, actor_type,
    target_type, target_id, source_type, source_id, manager_synthesis_run_id,
    mission_id, checkpoint_id, task_id, dedupe_key, display_mode, refresh_scope,
    summary, payload
  ) values (
    review_row.account_id,
    review_row.artist_workspace_id,
    review_row.artist_id,
    'manager_replanned_mission',
    'manager',
    'mission',
    mission_row.id,
    'manager_runtime_review',
    review_row.id,
    p_run_id,
    mission_row.id,
    review_row.checkpoint_id,
    review_row.trigger_object_id,
    'adaptive-replan:completed:' || review_row.id::text,
    'action',
    array['missions', 'activity']::text[],
    coalesce(nullif(p_output ->> 'whatChanged', ''), 'Desk changed the plan because operating reality changed.'),
    p_output || jsonb_build_object('newPlanId', new_plan_id, 'previousPlanId', active_plan_id)
  ) on conflict (artist_workspace_id, dedupe_key) do nothing;

  return jsonb_build_object(
    'decision', 'replan',
    'missionId', mission_row.id,
    'planId', new_plan_id,
    'previousPlanId', active_plan_id,
    'version', next_version
  );
end;
$$;

revoke all on function public.finalize_manager_replan_v1(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.finalize_manager_replan_v1(uuid, uuid, jsonb) to service_role;

create or replace function public._queue_adaptive_replan_review()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  review_id uuid;
  project_url text;
  worker_secret text;
begin
  if new.event_type <> 'plan_replan_required'
     or new.task_id is null
     or new.mission_id is null then
    return new;
  end if;

  insert into public.reviews (
    account_id,
    artist_workspace_id,
    artist_id,
    mission_id,
    checkpoint_id,
    trigger_type,
    trigger_object_type,
    trigger_object_id,
    previous_recommendation,
    current_read,
    what_changed,
    next_action,
    status,
    review_at,
    created_from_run_id
  )
  select
    new.account_id,
    new.artist_workspace_id,
    new.artist_id,
    new.mission_id,
    new.checkpoint_id,
    'adaptive_replan',
    'task',
    new.task_id,
    mission.current_recommendation,
    coalesce(new.payload ->> 'managerInterpretation', new.summary),
    new.summary,
    coalesce(new.payload ->> 'nextHumanMove', 'Recompile the active plan from the changed operating reality.'),
    'due',
    now(),
    new.manager_synthesis_run_id
  from public.missions as mission
  where mission.id = new.mission_id
  on conflict (trigger_type, trigger_object_type, trigger_object_id, created_from_run_id)
    where trigger_type = 'adaptive_replan'
      and trigger_object_type = 'task'
      and created_from_run_id is not null
  do update set
    current_read = excluded.current_read,
    what_changed = excluded.what_changed,
    next_action = excluded.next_action,
    status = case when public.reviews.status = 'completed' then public.reviews.status else 'due'::public.review_status end,
    review_at = case when public.reviews.status = 'completed' then public.reviews.review_at else now() end
  returning id into review_id;

  if review_id is null then return new; end if;

  select decrypted_secret into project_url
  from vault.decrypted_secrets
  where name = 'project_url'
  limit 1;

  select decrypted_secret into worker_secret
  from vault.decrypted_secrets
  where name = 'workflow_worker_secret'
  limit 1;

  if project_url is not null and worker_secret is not null then
    perform net.http_post(
      url := regexp_replace(project_url, '/$', '') || '/functions/v1/manager-runtime-runner',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-workflow-worker-secret', worker_secret
      ),
      body := jsonb_build_object('reviewId', review_id, 'source', 'operating-event')
    );
  end if;

  return new;
end;
$$;

drop trigger if exists queue_adaptive_replan_review on public.operating_events;
create trigger queue_adaptive_replan_review
after insert on public.operating_events
for each row
when (new.event_type = 'plan_replan_required')
execute function public._queue_adaptive_replan_review();

do $$
begin
  perform cron.unschedule(jobid)
  from cron.job
  where jobname = 'manager-runtime-review-recovery';

  perform cron.schedule(
    'manager-runtime-review-recovery',
    '* * * * *',
    $manager_runtime_schedule$
      select net.http_post(
        url := regexp_replace(endpoint.decrypted_secret, '/$', '') || '/functions/v1/manager-runtime-runner',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-workflow-worker-secret', secret.decrypted_secret
        ),
        body := jsonb_build_object('reviewId', due_review.id, 'source', 'scheduled-recovery')
      )
      from vault.decrypted_secrets as secret
      cross join vault.decrypted_secrets as endpoint
      cross join lateral (
        select review.id
        from public.reviews as review
        where review.status in ('due', 'scheduled')
          and coalesce(review.snoozed_until, review.review_at, now()) <= now()
          and review.trigger_type = 'adaptive_replan'
        order by coalesce(review.review_at, review.created_at) asc
        limit 10
      ) as due_review
      where secret.name = 'workflow_worker_secret'
        and endpoint.name = 'project_url';
    $manager_runtime_schedule$
  );
end;
$$;
