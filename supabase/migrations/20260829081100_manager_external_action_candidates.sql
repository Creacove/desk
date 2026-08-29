-- Gate 4 autonomy closure.
--
-- Canonical state changes may wake the Manager, but they never authorize an
-- external effect. They only enqueue a bounded, server-built action candidate.
-- A separate Manager decision worker must explicitly select that candidate;
-- only then is the existing typed preparation intent persisted and allowed to
-- create the immutable approval-gated external action.

create table if not exists public.manager_action_candidates (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  mission_id uuid references public.missions(id) on delete cascade,
  action_kind text not null,
  target_type text not null,
  target_id uuid not null,
  effect_fingerprint text not null,
  status text not null default 'due',
  attempt_count integer not null default 0,
  available_at timestamptz not null default now(),
  claimed_at timestamptz,
  completed_at timestamptz,
  manager_synthesis_run_id uuid references public.manager_synthesis_runs(id) on delete set null,
  decision text,
  decision_reason text,
  context_payload jsonb not null default '{}'::jsonb,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint manager_action_candidates_kind_check
    check (action_kind in ('prepare_split_confirmations_for_approval')),
  constraint manager_action_candidates_target_check
    check (target_type in ('music_item')),
  constraint manager_action_candidates_status_check
    check (status in ('due', 'running', 'completed', 'cancelled')),
  constraint manager_action_candidates_attempt_check
    check (attempt_count between 0 and 8),
  constraint manager_action_candidates_decision_check
    check (decision is null or decision in ('prepare', 'hold'))
);

create unique index if not exists manager_action_candidates_exact_effect_uidx
on public.manager_action_candidates (
  artist_workspace_id,
  action_kind,
  target_type,
  target_id,
  effect_fingerprint
);

create index if not exists manager_action_candidates_due_idx
on public.manager_action_candidates (available_at, created_at, id)
where status = 'due';

alter table public.manager_action_candidates enable row level security;
revoke all on table public.manager_action_candidates from public, anon, authenticated;
grant select, insert, update, delete on table public.manager_action_candidates to service_role;

create or replace function public.claim_manager_action_candidate_v1(p_candidate_id uuid)
returns table (
  id uuid,
  account_id uuid,
  artist_workspace_id uuid,
  artist_id uuid,
  mission_id uuid,
  action_kind text,
  target_type text,
  target_id uuid,
  effect_fingerprint text,
  attempt_count integer,
  context_payload jsonb
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.manager_action_candidates as candidate
  set status = 'running',
      attempt_count = least(8, candidate.attempt_count + 1),
      claimed_at = now(),
      last_error = null,
      updated_at = now()
  where candidate.id = p_candidate_id
    and candidate.status = 'due'
    and candidate.available_at <= now()
  returning
    candidate.id,
    candidate.account_id,
    candidate.artist_workspace_id,
    candidate.artist_id,
    candidate.mission_id,
    candidate.action_kind,
    candidate.target_type,
    candidate.target_id,
    candidate.effect_fingerprint,
    candidate.attempt_count,
    candidate.context_payload;
end;
$$;

revoke all on function public.claim_manager_action_candidate_v1(uuid) from public, anon, authenticated;
grant execute on function public.claim_manager_action_candidate_v1(uuid) to service_role;

create or replace function public.complete_manager_action_candidate_v1(
  p_candidate_id uuid,
  p_run_id uuid,
  p_decision text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate_row public.manager_action_candidates%rowtype;
begin
  if p_decision not in ('prepare', 'hold') then
    raise exception 'Manager action candidate decision is invalid';
  end if;

  select * into candidate_row
  from public.manager_action_candidates
  where id = p_candidate_id
  for update;

  if not found then raise exception 'Manager action candidate not found'; end if;
  if candidate_row.status <> 'running' then
    raise exception 'Manager action candidate is not running';
  end if;

  if not exists (
    select 1
    from public.manager_synthesis_runs as run
    where run.id = p_run_id
      and run.account_id = candidate_row.account_id
      and run.artist_workspace_id = candidate_row.artist_workspace_id
      and run.artist_id = candidate_row.artist_id
      and run.status = 'running'
  ) then
    raise exception 'Manager action decision run is not active for this candidate';
  end if;

  update public.manager_action_candidates
  set status = 'completed',
      manager_synthesis_run_id = p_run_id,
      decision = p_decision,
      decision_reason = left(coalesce(p_reason, ''), 1000),
      claimed_at = null,
      completed_at = now(),
      updated_at = now()
  where id = p_candidate_id;

  update public.manager_synthesis_runs
  set status = 'completed',
      confidence = 'medium',
      steps_payload = jsonb_build_array(
        jsonb_build_object('step', 'candidate_claimed', 'status', 'completed'),
        jsonb_build_object('step', 'manager_action_decided', 'status', 'completed'),
        jsonb_build_object('step', 'decision_persisted', 'status', 'completed')
      ),
      action_plan = jsonb_build_array(jsonb_build_object(
        'candidateId', p_candidate_id,
        'actionKind', candidate_row.action_kind,
        'decision', p_decision,
        'reason', left(coalesce(p_reason, ''), 1000)
      )),
      completed_at = now()
  where id = p_run_id;

  return jsonb_build_object(
    'candidateId', p_candidate_id,
    'decision', p_decision,
    'runId', p_run_id
  );
end;
$$;

revoke all on function public.complete_manager_action_candidate_v1(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.complete_manager_action_candidate_v1(uuid, uuid, text, text) to service_role;

create or replace function public.requeue_manager_action_candidate_v1(
  p_candidate_id uuid,
  p_error text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  candidate_row public.manager_action_candidates%rowtype;
  next_status text;
  delay_seconds integer;
begin
  select * into candidate_row
  from public.manager_action_candidates
  where id = p_candidate_id
  for update;

  if not found then return 'missing'; end if;
  if candidate_row.status = 'completed' then return 'completed'; end if;

  next_status := case when candidate_row.attempt_count >= 5 then 'cancelled' else 'due' end;
  delay_seconds := least(300, 10 * (2 ^ greatest(0, candidate_row.attempt_count - 1))::integer);

  update public.manager_action_candidates
  set status = next_status,
      claimed_at = null,
      last_error = left(coalesce(p_error, 'Manager action decision failed.'), 1000),
      available_at = case when next_status = 'due' then now() + make_interval(secs => delay_seconds) else available_at end,
      updated_at = now()
  where id = p_candidate_id;

  return next_status;
end;
$$;

revoke all on function public.requeue_manager_action_candidate_v1(uuid, text) from public, anon, authenticated;
grant execute on function public.requeue_manager_action_candidate_v1(uuid, text) to service_role;

create or replace function public.reap_stale_manager_action_candidates_v1()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  recovered integer;
begin
  update public.manager_action_candidates
  set status = case when attempt_count >= 5 then 'cancelled' else 'due' end,
      claimed_at = null,
      last_error = 'Manager action candidate claim expired before completion.',
      available_at = case when attempt_count >= 5 then available_at else now() end,
      updated_at = now()
  where status = 'running'
    and claimed_at is not null
    and claimed_at < now() - interval '10 minutes';

  get diagnostics recovered = row_count;
  return recovered;
end;
$$;

revoke all on function public.reap_stale_manager_action_candidates_v1() from public, anon, authenticated;
grant execute on function public.reap_stale_manager_action_candidates_v1() to service_role;

create or replace function public.queue_split_confirmation_manager_candidate_v1(p_split_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  split_row public.music_splits%rowtype;
  task_row public.tasks%rowtype;
  mission_row public.missions%rowtype;
  music_item_row public.music_items%rowtype;
  publishing_sum numeric := 0;
  master_sum numeric := 0;
  active_contributor_count integer := 0;
  draft_recipient_count integer := 0;
  missing_email_count integer := 0;
  recipient_snapshot jsonb := '[]'::jsonb;
  fingerprint text;
  candidate_id uuid;
  project_url text;
  worker_secret text;
begin
  select * into split_row
  from public.music_splits
  where id = p_split_id;

  if not found or split_row.status <> 'draft' or split_row.linked_task_id is null then
    return jsonb_build_object('status', 'ignored', 'reason', 'split_not_candidate_scoped');
  end if;

  select * into task_row
  from public.tasks
  where id = split_row.linked_task_id
    and account_id = split_row.account_id
    and artist_workspace_id = split_row.artist_workspace_id
    and artist_id = split_row.artist_id;

  if not found or task_row.mission_id is null then
    return jsonb_build_object('status', 'ignored', 'reason', 'linked_task_not_found');
  end if;

  select * into mission_row
  from public.missions
  where id = task_row.mission_id
    and account_id = split_row.account_id
    and artist_workspace_id = split_row.artist_workspace_id
    and artist_id = split_row.artist_id;

  if not found
     or mission_row.status not in ('active', 'blocked', 'review')
     or mission_row.active_plan_version_id is distinct from task_row.mission_plan_version_id
     or task_row.status not in ('proposed', 'open', 'needs_approval', 'approved', 'in_progress', 'blocked', 'missed') then
    return jsonb_build_object('status', 'ignored', 'reason', 'mission_task_scope_not_current');
  end if;

  select * into music_item_row
  from public.music_items
  where id = split_row.music_item_id
    and account_id = split_row.account_id
    and artist_workspace_id = split_row.artist_workspace_id
    and artist_id = split_row.artist_id;

  if not found then
    return jsonb_build_object('status', 'ignored', 'reason', 'music_item_not_found');
  end if;

  select
    coalesce(sum(contributor.publishing_share), 0),
    coalesce(sum(contributor.master_share), 0),
    count(*)::integer,
    count(*) filter (where contributor.approval_status = 'draft')::integer,
    count(*) filter (where nullif(trim(contributor.email), '') is null)::integer
  into publishing_sum, master_sum, active_contributor_count, draft_recipient_count, missing_email_count
  from public.music_split_contributors as contributor
  where contributor.music_split_id = split_row.id
    and contributor.approval_status <> 'revoked';

  if active_contributor_count = 0
     or round(publishing_sum, 2) <> 100
     or round(master_sum, 2) <> 100
     or missing_email_count > 0
     or draft_recipient_count = 0 then
    return jsonb_build_object(
      'status', 'not_ready',
      'reason', 'split_effect_is_not_sendable',
      'splitId', split_row.id
    );
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'contributorId', contributor.id,
      'email', lower(trim(contributor.email)),
      'publishingShare', contributor.publishing_share::text,
      'masterShare', contributor.master_share::text
    ) order by contributor.id
  ), '[]'::jsonb)
  into recipient_snapshot
  from public.music_split_contributors as contributor
  where contributor.music_split_id = split_row.id
    and contributor.approval_status = 'draft';

  fingerprint := md5(jsonb_build_object(
    'splitId', split_row.id,
    'musicItemId', split_row.music_item_id,
    'missionId', mission_row.id,
    'planId', mission_row.active_plan_version_id,
    'recipients', recipient_snapshot
  )::text);

  insert into public.manager_action_candidates (
    account_id, artist_workspace_id, artist_id, mission_id,
    action_kind, target_type, target_id, effect_fingerprint,
    status, context_payload
  ) values (
    split_row.account_id,
    split_row.artist_workspace_id,
    split_row.artist_id,
    mission_row.id,
    'prepare_split_confirmations_for_approval',
    'music_item',
    split_row.music_item_id,
    fingerprint,
    'due',
    jsonb_build_object(
      'candidateVersion', 'manager-action-candidate-v1',
      'actionKind', 'prepare_split_confirmations_for_approval',
      'targetRef', 'focused_music_item',
      'musicTitle', music_item_row.title,
      'missionTitle', mission_row.title,
      'missionObjective', mission_row.objective,
      'currentRecommendation', mission_row.current_recommendation,
      'linkedTaskTitle', task_row.title,
      'linkedTaskStatus', task_row.status,
      'recipientCount', draft_recipient_count,
      'canonicalReady', true,
      'serverDecisionBoundary', 'Manager may choose prepare or hold. This candidate does not authorize sending email.'
    )
  )
  on conflict (artist_workspace_id, action_kind, target_type, target_id, effect_fingerprint)
  do update set
    context_payload = excluded.context_payload,
    updated_at = now()
  returning id into candidate_id;

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
        'mode', 'external_action_decision',
        'candidateId', candidate_id,
        'source', 'split-state-change'
      )
    );
  end if;

  return jsonb_build_object(
    'status', 'queued',
    'candidateId', candidate_id,
    'effectFingerprint', fingerprint
  );
end;
$$;

revoke all on function public.queue_split_confirmation_manager_candidate_v1(uuid) from public, anon, authenticated;
grant execute on function public.queue_split_confirmation_manager_candidate_v1(uuid) to service_role;

-- Wake-up functions deliberately swallow automation failures. Canonical split,
-- contributor, Task, and Mission edits must never be rolled back because the
-- Manager decision runtime is unavailable.
create or replace function public._queue_split_candidate_from_split_v1()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    perform public.queue_split_confirmation_manager_candidate_v1(new.id);
  exception when others then
    null;
  end;
  return new;
end;
$$;

create or replace function public._queue_split_candidate_from_contributor_v1()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_split_id uuid;
begin
  target_split_id := coalesce(new.music_split_id, old.music_split_id);
  begin
    perform public.queue_split_confirmation_manager_candidate_v1(target_split_id);
  exception when others then
    null;
  end;
  return coalesce(new, old);
end;
$$;

create or replace function public._queue_split_candidate_from_task_v1()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  linked_split record;
begin
  for linked_split in
    select split.id
    from public.music_splits as split
    where split.linked_task_id = new.id
  loop
    begin
      perform public.queue_split_confirmation_manager_candidate_v1(linked_split.id);
    exception when others then
      null;
    end;
  end loop;
  return new;
end;
$$;

revoke all on function public._queue_split_candidate_from_split_v1() from public, anon, authenticated, service_role;
revoke all on function public._queue_split_candidate_from_contributor_v1() from public, anon, authenticated, service_role;
revoke all on function public._queue_split_candidate_from_task_v1() from public, anon, authenticated, service_role;

drop trigger if exists queue_split_action_candidate_from_split on public.music_splits;
create trigger queue_split_action_candidate_from_split
after insert or update of status, linked_task_id on public.music_splits
for each row execute function public._queue_split_candidate_from_split_v1();

drop trigger if exists queue_split_action_candidate_from_contributor on public.music_split_contributors;
create trigger queue_split_action_candidate_from_contributor
after insert or update or delete on public.music_split_contributors
for each row execute function public._queue_split_candidate_from_contributor_v1();

drop trigger if exists queue_split_action_candidate_from_task on public.tasks;
create trigger queue_split_action_candidate_from_task
after update of status, mission_plan_version_id on public.tasks
for each row execute function public._queue_split_candidate_from_task_v1();

create or replace function public.dispatch_due_manager_action_candidates_v1()
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  due_candidate record;
  project_url text;
  worker_secret text;
  dispatched integer := 0;
begin
  perform public.reap_stale_manager_action_candidates_v1();

  select decrypted_secret into project_url
  from vault.decrypted_secrets
  where name = 'project_url'
  limit 1;

  select decrypted_secret into worker_secret
  from vault.decrypted_secrets
  where name = 'workflow_worker_secret'
  limit 1;

  if project_url is null or worker_secret is null then return 0; end if;

  for due_candidate in
    select candidate.id
    from public.manager_action_candidates as candidate
    where candidate.status = 'due'
      and candidate.available_at <= now()
    order by candidate.available_at, candidate.created_at, candidate.id
    limit 10
  loop
    perform net.http_post(
      url := regexp_replace(project_url, '/$', '') || '/functions/v1/workflow-recovery',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-workflow-worker-secret', worker_secret
      ),
      body := jsonb_build_object(
        'mode', 'external_action_decision',
        'candidateId', due_candidate.id,
        'source', 'scheduled-recovery'
      )
    );
    dispatched := dispatched + 1;
  end loop;

  return dispatched;
end;
$$;

revoke all on function public.dispatch_due_manager_action_candidates_v1() from public, anon, authenticated;
grant execute on function public.dispatch_due_manager_action_candidates_v1() to service_role;

do $$
begin
  perform cron.unschedule(jobid)
  from cron.job
  where jobname = 'manager-action-candidate-recovery';

  perform cron.schedule(
    'manager-action-candidate-recovery',
    '* * * * *',
    'select public.dispatch_due_manager_action_candidates_v1();'
  );
end;
$$;
