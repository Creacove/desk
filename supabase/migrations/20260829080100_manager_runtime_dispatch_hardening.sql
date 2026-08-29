-- Harden adaptive Manager dispatch around one worker-secret gateway.
--
-- workflow-recovery is the only cron/event endpoint that accepts the worker
-- secret directly. It then calls authenticated internal Edge Functions with the
-- service-role JWT. Replan claims are bounded and stale claims can be recovered
-- without ever mutating the active Mission plan.

alter table public.reviews
  add column if not exists runtime_claimed_at timestamptz,
  add column if not exists runtime_attempt_count integer not null default 0,
  add column if not exists runtime_last_error text;

alter table public.reviews
  drop constraint if exists reviews_runtime_attempt_count_check;
alter table public.reviews
  add constraint reviews_runtime_attempt_count_check
  check (runtime_attempt_count between 0 and 12);

create index if not exists reviews_adaptive_runtime_due_idx
on public.reviews (review_at, created_at, id)
where trigger_type = 'adaptive_replan'
  and status in ('due', 'scheduled');

create or replace function public.claim_manager_runtime_review_v2(p_review_id uuid)
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
  created_from_run_id uuid,
  runtime_attempt_count integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.reviews as review
  set status = 'running',
      runtime_claimed_at = now(),
      runtime_attempt_count = least(12, review.runtime_attempt_count + 1),
      runtime_last_error = null
  where review.id = p_review_id
    and review.trigger_type = 'adaptive_replan'
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
    review.created_from_run_id,
    review.runtime_attempt_count;
end;
$$;

revoke all on function public.claim_manager_runtime_review_v2(uuid) from public, anon, authenticated;
grant execute on function public.claim_manager_runtime_review_v2(uuid) to service_role;

create or replace function public.requeue_manager_runtime_review_v1(
  p_review_id uuid,
  p_error text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  review_row public.reviews%rowtype;
  next_status public.review_status;
  delay_seconds integer;
begin
  select * into review_row
  from public.reviews
  where id = p_review_id
  for update;

  if not found then return 'missing'; end if;
  if review_row.trigger_type <> 'adaptive_replan' then return 'ignored'; end if;
  if review_row.status = 'completed' then return 'completed'; end if;

  if review_row.runtime_attempt_count >= 5 then
    next_status := 'cancelled';
  else
    next_status := 'due';
  end if;

  delay_seconds := least(300, 10 * (2 ^ greatest(0, review_row.runtime_attempt_count - 1))::integer);

  update public.reviews
  set status = next_status,
      runtime_claimed_at = null,
      runtime_last_error = left(coalesce(p_error, 'Manager runtime failed.'), 1000),
      review_at = case when next_status = 'due' then now() + make_interval(secs => delay_seconds) else review_at end
  where id = p_review_id;

  if next_status = 'cancelled' and review_row.mission_id is not null then
    insert into public.operating_events (
      account_id,
      artist_workspace_id,
      artist_id,
      event_type,
      actor_type,
      target_type,
      target_id,
      source_type,
      source_id,
      mission_id,
      checkpoint_id,
      task_id,
      dedupe_key,
      display_mode,
      refresh_scope,
      summary,
      payload
    ) values (
      review_row.account_id,
      review_row.artist_workspace_id,
      review_row.artist_id,
      'manager_replan_deferred',
      'manager',
      'mission',
      review_row.mission_id,
      'manager_runtime_review',
      review_row.id,
      review_row.mission_id,
      review_row.checkpoint_id,
      review_row.trigger_object_id,
      'adaptive-replan:cancelled:' || review_row.id::text,
      'activity',
      array['missions', 'activity']::text[],
      'Desk kept the current plan because it could not safely compile a replacement.',
      jsonb_build_object(
        'reviewId', review_row.id,
        'attempts', review_row.runtime_attempt_count,
        'currentPlanPreserved', true
      )
    ) on conflict (artist_workspace_id, dedupe_key) do nothing;
  end if;

  return next_status::text;
end;
$$;

revoke all on function public.requeue_manager_runtime_review_v1(uuid, text) from public, anon, authenticated;
grant execute on function public.requeue_manager_runtime_review_v1(uuid, text) to service_role;

create or replace function public.reap_stale_manager_runtime_reviews_v1()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  recovered integer;
begin
  update public.reviews
  set status = case when runtime_attempt_count >= 5 then 'cancelled'::public.review_status else 'due'::public.review_status end,
      runtime_last_error = 'Manager runtime claim expired before completion.',
      runtime_claimed_at = null,
      review_at = case when runtime_attempt_count >= 5 then review_at else now() end
  where trigger_type = 'adaptive_replan'
    and status = 'running'
    and runtime_claimed_at is not null
    and runtime_claimed_at < now() - interval '10 minutes';

  get diagnostics recovered = row_count;
  return recovered;
end;
$$;

revoke all on function public.reap_stale_manager_runtime_reviews_v1() from public, anon, authenticated;
grant execute on function public.reap_stale_manager_runtime_reviews_v1() to service_role;

-- Replace the event nudge created in the preceding migration. The database talks
-- only to workflow-recovery with the worker secret; workflow-recovery owns the
-- service-role dispatch to manager-runtime-runner.
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
    review_at = case when public.reviews.status = 'completed' then public.reviews.review_at else now() end,
    runtime_claimed_at = case when public.reviews.status = 'completed' then public.reviews.runtime_claimed_at else null end,
    runtime_last_error = case when public.reviews.status = 'completed' then public.reviews.runtime_last_error else null end
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
      url := regexp_replace(project_url, '/$', '') || '/functions/v1/workflow-recovery',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-workflow-worker-secret', worker_secret
      ),
      body := jsonb_build_object(
        'mode', 'adaptive_replan',
        'reviewId', review_id,
        'source', 'operating-event'
      )
    );
  end if;

  return new;
end;
$$;

create or replace function public.dispatch_due_manager_runtime_reviews_v1()
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  due_review record;
  project_url text;
  worker_secret text;
  dispatched integer := 0;
begin
  perform public.reap_stale_manager_runtime_reviews_v1();

  select decrypted_secret into project_url
  from vault.decrypted_secrets
  where name = 'project_url'
  limit 1;

  select decrypted_secret into worker_secret
  from vault.decrypted_secrets
  where name = 'workflow_worker_secret'
  limit 1;

  if project_url is null or worker_secret is null then return 0; end if;

  for due_review in
    select review.id
    from public.reviews as review
    where review.status in ('due', 'scheduled')
      and coalesce(review.snoozed_until, review.review_at, now()) <= now()
      and review.trigger_type = 'adaptive_replan'
    order by coalesce(review.review_at, review.created_at) asc
    limit 10
  loop
    perform net.http_post(
      url := regexp_replace(project_url, '/$', '') || '/functions/v1/workflow-recovery',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-workflow-worker-secret', worker_secret
      ),
      body := jsonb_build_object(
        'mode', 'adaptive_replan',
        'reviewId', due_review.id,
        'source', 'scheduled-recovery'
      )
    );
    dispatched := dispatched + 1;
  end loop;

  return dispatched;
end;
$$;

revoke all on function public.dispatch_due_manager_runtime_reviews_v1() from public, anon, authenticated;
grant execute on function public.dispatch_due_manager_runtime_reviews_v1() to service_role;

-- Replace the direct cron from the previous migration with one call into the
-- hardened SQL dispatcher.
do $$
begin
  perform cron.unschedule(jobid)
  from cron.job
  where jobname = 'manager-runtime-review-recovery';

  perform cron.schedule(
    'manager-runtime-review-recovery',
    '* * * * *',
    'select public.dispatch_due_manager_runtime_reviews_v1();'
  );
end;
$$;

-- PR #26 scheduled reminders directly against manager-dispatcher. Route that
-- cadence through the same worker-secret gateway as all other scheduled Manager
-- work so manager-dispatcher can remain JWT-protected.
do $$
declare
  schedule_command text;
begin
  perform cron.unschedule(jobid)
  from cron.job
  where jobname = 'manager-reminder-dispatcher';

  schedule_command := $manager_reminder_schedule$
    select net.http_post(
      url := regexp_replace(endpoint.decrypted_secret, '/$', '') || '/functions/v1/workflow-recovery',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-workflow-worker-secret', secret.decrypted_secret
      ),
      body := jsonb_build_object(
        'mode', 'dispatch_reminders',
        'source', 'scheduled-reminder-dispatch'
      )
    )
    from vault.decrypted_secrets as secret
    cross join vault.decrypted_secrets as endpoint
    where secret.name = 'workflow_worker_secret'
      and endpoint.name = 'project_url'
      and exists (
        select 1
        from public.reminder_queue as reminder
        where reminder.status = 'queued'
          and reminder.scheduled_for <= now()
      );
  $manager_reminder_schedule$;

  perform cron.schedule(
    'manager-reminder-dispatcher',
    '*/5 * * * *',
    schedule_command
  );
end;
$$;
