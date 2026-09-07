-- Generic Mission Genesis task intent and artifact-first review lifecycle.
-- Generated copy never determines whether a task is an approval. The typed
-- intent, readiness, and review target below are the runtime authority.

alter table public.tasks
  add column if not exists task_intent text,
  add column if not exists readiness text,
  add column if not exists review_target_id uuid,
  add column if not exists review_target_type text,
  add column if not exists review_target_version_id uuid,
  add column if not exists review_target_status text,
  add column if not exists state_reason text;

update public.tasks
set task_intent = case
  when completion_mode = 'manager_draft' then 'collaborative_draft'
  when (approval_state = 'needs_approval' or status = 'needs_approval')
    and review_target_id is not null
    and review_target_type is not null
    and review_target_version_id is not null
    and review_target_status = 'ready_for_review' then 'review_approval'
  when work_mode = 'manager_work' then 'manager_work'
  else 'human_action'
end
where task_intent is null;

update public.tasks as task
set readiness = case
  when task.status in ('completed', 'approved') then 'completed'
  when task.status in ('blocked', 'rejected', 'missed') or task.approval_state in ('blocked', 'rejected') then 'blocked'
  when (task.status = 'needs_approval' or task.approval_state = 'needs_approval')
    and (task.task_intent <> 'review_approval' or task.review_target_id is null or task.review_target_version_id is null) then 'blocked'
  when task.task_intent = 'collaborative_draft'
    and not exists (
      select 1
      from public.manager_outputs output
      where output.artist_workspace_id = task.artist_workspace_id
        and output.artist_id = task.artist_id
        and output.output_type = 'task_draft'
        and output.subject_type = 'task'
        and output.subject_id = task.id
        and output.is_current
    ) then 'preparing'
  else 'ready'
end
where task.readiness is null;

-- Existing approval-like rows that could not prove a current artifact are
-- quarantined as blocked work. They remain visible in history, but cannot
-- enter Today or the execution endpoint until a new Manager draft creates a
-- versioned review target.
update public.tasks
set state_reason = 'review_target_missing'
where readiness = 'blocked'
  and (status = 'needs_approval' or approval_state = 'needs_approval')
  and (review_target_id is null or review_target_version_id is null)
  and state_reason is null;

alter table public.tasks
  alter column task_intent set default 'human_action',
  alter column task_intent set not null,
  alter column readiness set default 'ready',
  alter column readiness set not null;

alter table public.tasks
  drop constraint if exists tasks_task_intent_check,
  drop constraint if exists tasks_readiness_check,
  drop constraint if exists tasks_review_target_type_check,
  drop constraint if exists tasks_review_target_status_check,
  drop constraint if exists tasks_completion_mode_check;

alter table public.tasks
  add constraint tasks_task_intent_check
    check (task_intent in ('manager_work', 'human_action', 'collaborative_draft', 'review_approval')),
  add constraint tasks_readiness_check
    check (readiness in ('preparing', 'ready', 'needs_revision', 'completed', 'blocked')),
  add constraint tasks_review_target_type_check
    check (review_target_type is null or review_target_type in ('manager_output', 'song_document')),
  add constraint tasks_review_target_status_check
    check (review_target_status is null or review_target_status in ('draft', 'ready_for_review', 'accepted', 'needs_revision')),
  add constraint tasks_completion_mode_check
    check (completion_mode is null or completion_mode in ('result_note', 'manager_draft', 'evidence', 'approval'));

create index if not exists tasks_intent_readiness_idx
on public.tasks (artist_workspace_id, task_intent, readiness, updated_at desc);

create or replace function public.assert_mission_task_contract_v1(p_task jsonb)
returns void
language plpgsql
immutable
set search_path = public
as $$
declare
  task_intent text := lower(btrim(coalesce(p_task ->> 'taskIntent', '')));
  work_mode text := lower(btrim(coalesce(p_task ->> 'workMode', '')));
  completion_mode text := lower(btrim(coalesce(p_task ->> 'completionMode', '')));
  readiness text := lower(btrim(coalesce(p_task ->> 'readiness', '')));
  review_target_id text := btrim(coalesce(p_task ->> 'reviewTargetId', ''));
  review_target_type text := lower(btrim(coalesce(p_task ->> 'reviewTargetType', '')));
  review_target_version_id text := btrim(coalesce(p_task ->> 'reviewTargetVersionId', ''));
  review_target_status text := lower(btrim(coalesce(p_task ->> 'reviewTargetStatus', '')));
  approval_state text := lower(btrim(coalesce(p_task ->> 'approvalState', '')));
  task_status text := lower(btrim(coalesce(p_task ->> 'status', '')));
begin
  if task_intent not in ('manager_work', 'human_action', 'collaborative_draft', 'review_approval') then
    raise exception using errcode = '22023', message = 'mission_task_contract:task_intent_required';
  end if;

  if completion_mode = 'approval' and task_intent <> 'review_approval' then
    raise exception using errcode = '22023', message = 'mission_task_contract:approval_requires_review_intent';
  end if;

  if task_intent <> 'review_approval'
     and (review_target_id <> '' or review_target_type <> '' or review_target_version_id <> '' or review_target_status <> '') then
    raise exception using errcode = '22023', message = 'mission_task_contract:review_target_only_allowed_for_review_intent';
  end if;

  if task_intent = 'collaborative_draft' then
    if work_mode <> 'collaborative' or completion_mode <> 'manager_draft' then
      raise exception using errcode = '22023', message = 'mission_task_contract:collaborative_draft_requires_collaborative_manager_draft';
    end if;
  end if;

  if task_intent = 'review_approval' then
    if review_target_id = '' or review_target_type = '' or review_target_version_id = '' then
      raise exception using errcode = '22023', message = 'mission_task_contract:review_target_required';
    end if;
    if completion_mode <> 'approval' then
      raise exception using errcode = '22023', message = 'mission_task_contract:review_task_requires_approval_completion';
    end if;

    -- A review task has two valid durable states: waiting for the owner to
    -- approve the current version, or the terminal approved state. Keeping
    -- the terminal state inside the same contract prevents the deferred
    -- trigger from rejecting the approval transaction after the task update.
    if approval_state = 'approved'
       and readiness = 'completed'
       and task_status in ('approved', 'completed')
       and review_target_status = 'accepted' then
      return;
    end if;
    if review_target_status <> 'ready_for_review' then
      raise exception using errcode = '22023', message = 'mission_task_contract:review_target_must_be_ready';
    end if;
    if readiness <> 'ready' then
      raise exception using errcode = '22023', message = 'mission_task_contract:review_task_must_be_ready';
    end if;
    if approval_state <> 'needs_approval' then
      raise exception using errcode = '22023', message = 'mission_task_contract:review_task_must_need_approval';
    end if;
  end if;
end;
$$;

create or replace function public.enforce_mission_task_contract_v1()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  target_exists boolean;
begin
  perform public.assert_mission_task_contract_v1(jsonb_build_object(
    'taskIntent', new.task_intent,
    'workMode', new.work_mode,
    'completionMode', new.completion_mode,
    'readiness', new.readiness,
    'approvalState', new.approval_state,
    'status', new.status,
    'reviewTargetId', new.review_target_id,
    'reviewTargetType', new.review_target_type,
    'reviewTargetVersionId', new.review_target_version_id,
    'reviewTargetStatus', new.review_target_status
  ));

  if new.task_intent <> 'review_approval' then
    return new;
  end if;

  if new.review_target_type = 'manager_output' then
    select exists (
      select 1
      from public.manager_outputs output
      where output.id = new.review_target_id
        and output.account_id = new.account_id
        and output.artist_workspace_id = new.artist_workspace_id
        and output.artist_id = new.artist_id
        and output.output_type = 'task_draft'
        and output.subject_type = 'task'
        and output.subject_id = new.id
        and output.is_current
    ) into target_exists;
    if not target_exists then
      raise exception using errcode = '22023', message = 'mission_task_contract:manager_output_review_target_missing';
    end if;
    if new.review_target_version_id is distinct from new.review_target_id then
      raise exception using errcode = '22023', message = 'mission_task_contract:manager_output_review_target_stale';
    end if;
  elsif new.review_target_type = 'song_document' then
    select exists (
      select 1
      from public.documents document
      join public.document_versions version on version.document_id = document.id
      where document.id = new.review_target_id
        and document.account_id = new.account_id
        and document.artist_workspace_id = new.artist_workspace_id
        and document.artist_id = new.artist_id
        and document.current_version_id = version.id
        and version.id = new.review_target_version_id
        and document.status not in ('needs_revision', 'failed', 'revoked', 'superseded')
    ) into target_exists;
    if not target_exists then
      raise exception using errcode = '22023', message = 'mission_task_contract:song_document_review_target_missing_or_stale';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists tasks_enforce_mission_task_contract_v1 on public.tasks;
create constraint trigger tasks_enforce_mission_task_contract_v1
after insert or update on public.tasks
deferrable initially deferred
for each row execute function public.enforce_mission_task_contract_v1();

create or replace function public.activate_review_task_for_target_v1(
  p_account_id uuid,
  p_artist_workspace_id uuid,
  p_artist_id uuid,
  p_task_id uuid,
  p_artifact_type text,
  p_artifact_id uuid,
  p_version_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  task_row public.tasks%rowtype;
  output_row public.manager_outputs%rowtype;
begin
  select * into task_row
  from public.tasks
  where id = p_task_id
    and account_id = p_account_id
    and artist_workspace_id = p_artist_workspace_id
    and artist_id = p_artist_id
  for update;
  if not found then
    raise exception 'mission_task_contract:task_not_found';
  end if;

  if task_row.task_intent = 'review_approval'
     and task_row.review_target_id = p_artifact_id
     and task_row.review_target_version_id = p_version_id then
    return jsonb_build_object('status', 'already_ready', 'taskId', task_row.id, 'artifactId', p_artifact_id, 'versionId', p_version_id);
  end if;

  if task_row.task_intent <> 'collaborative_draft' or task_row.completion_mode <> 'manager_draft' then
    raise exception 'mission_task_contract:task_not_draft_capable';
  end if;
  if p_artifact_type <> 'manager_output' then
    raise exception 'mission_task_contract:unsupported_review_target_type';
  end if;

  select * into output_row
  from public.manager_outputs
  where id = p_artifact_id
    and account_id = p_account_id
    and artist_workspace_id = p_artist_workspace_id
    and artist_id = p_artist_id
    and output_type = 'task_draft'
    and subject_type = 'task'
    and subject_id = p_task_id
    and is_current
  for update;
  if not found then
    raise exception 'mission_task_contract:manager_output_review_target_missing';
  end if;
  if p_version_id is distinct from output_row.id then
    raise exception 'mission_task_contract:manager_output_review_target_stale';
  end if;

  update public.tasks
  set task_intent = 'review_approval',
      readiness = 'ready',
      review_target_id = output_row.id,
      review_target_type = 'manager_output',
      review_target_version_id = output_row.id,
      review_target_status = 'ready_for_review',
      completion_mode = 'approval',
      approval_state = 'needs_approval',
      status = 'needs_approval',
      state_reason = 'manager_draft_ready_for_review',
      updated_at = now()
  where id = task_row.id;

  insert into public.task_state_events (
    account_id, artist_workspace_id, artist_id, task_id, mission_id, checkpoint_id,
    event_type, from_status, to_status, actor_type, reason, payload
  ) values (
    task_row.account_id, task_row.artist_workspace_id, task_row.artist_id, task_row.id,
    task_row.mission_id, task_row.primary_checkpoint_id,
    'review_target_ready', task_row.status, 'needs_approval', 'manager',
    'Manager draft is ready for human review.',
    jsonb_build_object('artifactType', 'manager_output', 'artifactId', output_row.id, 'versionId', output_row.id)
  );

  return jsonb_build_object('status', 'ready_for_review', 'taskId', task_row.id, 'artifactId', output_row.id, 'versionId', output_row.id);
end;
$$;

create or replace function public.approve_mission_review_task_v1(p_task_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  task_row public.tasks%rowtype;
  caller_role text := coalesce(auth.jwt()->>'role', '');
begin
  select * into task_row
  from public.tasks
  where id = p_task_id
  for update;
  if not found then raise exception 'mission_task_contract:task_not_found'; end if;

  if caller_role <> 'service_role' and not exists (
    select 1
    from public.account_memberships membership
    where membership.account_id = task_row.account_id
      and membership.user_id = auth.uid()
      and membership.role = 'owner'
      and membership.status = 'active'
  ) then
    raise exception 'TEAM_FORBIDDEN';
  end if;

  if task_row.task_intent <> 'review_approval' then
    raise exception 'mission_task_contract:task_not_reviewable';
  end if;
  if task_row.status = 'approved' and task_row.readiness = 'completed' then
    return jsonb_build_object('status', 'already_approved', 'taskId', task_row.id);
  end if;

  update public.tasks
  set approval_state = 'approved',
      status = 'approved',
      readiness = 'completed',
      review_target_status = 'accepted',
      state_reason = 'human_review_approved',
      updated_at = now()
  where id = task_row.id;

  if task_row.review_target_type = 'manager_output' then
    update public.manager_outputs
    set render_json = jsonb_set(coalesce(render_json, '{}'::jsonb), '{status}', '"accepted"'::jsonb, true)
    where id = task_row.review_target_id
      and account_id = task_row.account_id
      and artist_workspace_id = task_row.artist_workspace_id
      and artist_id = task_row.artist_id
      and is_current;
  end if;

  insert into public.task_state_events (
    account_id, artist_workspace_id, artist_id, task_id, mission_id, checkpoint_id,
    event_type, from_status, to_status, actor_type, actor_id, reason, payload
  ) values (
    task_row.account_id, task_row.artist_workspace_id, task_row.artist_id, task_row.id,
    task_row.mission_id, task_row.primary_checkpoint_id,
    'review_approved', task_row.status, 'approved', 'user', auth.uid(),
    'Human approved the Manager draft.',
    jsonb_build_object('artifactType', task_row.review_target_type, 'artifactId', task_row.review_target_id, 'versionId', task_row.review_target_version_id)
  );

  return jsonb_build_object('status', 'approved', 'taskId', task_row.id);
end;
$$;

-- Persist the Manager draft and promote its task as one transaction. This is
-- the race boundary for duplicate clicks, retries, and a second draft version:
-- the task row is locked before the current artifact is replaced.
create or replace function public.persist_manager_task_draft_v1(
  p_account_id uuid,
  p_artist_workspace_id uuid,
  p_artist_id uuid,
  p_task_id uuid,
  p_conversation_id uuid,
  p_created_from_run_id uuid,
  p_title text,
  p_summary text,
  p_primary_recommendation_json jsonb,
  p_confidence_json jsonb,
  p_supporting_evidence_json jsonb,
  p_render_json jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  task_row public.tasks%rowtype;
  current_output public.manager_outputs%rowtype;
  draft_row public.manager_outputs%rowtype;
  activation jsonb;
  current_output_found boolean := false;
begin
  select * into task_row
  from public.tasks
  where id = p_task_id
    and account_id = p_account_id
    and artist_workspace_id = p_artist_workspace_id
    and artist_id = p_artist_id
  for update;
  if not found then raise exception 'mission_task_contract:task_not_found'; end if;
  -- A retry of the same Manager run returns the original version and does not
  -- create a second current artifact.
  select * into draft_row
  from public.manager_outputs
  where created_from_run_id = p_created_from_run_id
    and account_id = p_account_id
    and artist_workspace_id = p_artist_workspace_id
    and artist_id = p_artist_id
    and output_type = 'task_draft'
    and subject_type = 'task'
    and subject_id = p_task_id
  order by created_at desc
  limit 1
  for update;
  if found then
    return jsonb_build_object(
      'status', 'already_saved',
      'taskId', p_task_id,
      'artifactId', draft_row.id,
      'versionId', draft_row.id,
      'reviewStatus', case when draft_row.is_current then 'ready_for_review' else 'needs_revision' end
    );
  end if;

  if task_row.completion_mode <> 'manager_draft'
     and task_row.task_intent <> 'review_approval' then
    return jsonb_build_object('status', 'not_applicable', 'taskId', task_row.id);
  end if;

  -- Asking the Manager for a change starts a new draft version. The previous
  -- review target is retained as history but can no longer be approved.
  if task_row.task_intent = 'review_approval' then
    if task_row.review_target_id is not null then
      update public.manager_outputs
      set is_current = false,
          render_json = jsonb_set(coalesce(render_json, '{}'::jsonb), '{status}', '"needs_revision"'::jsonb, true)
      where id = task_row.review_target_id
        and account_id = p_account_id
        and artist_workspace_id = p_artist_workspace_id
        and artist_id = p_artist_id;
    end if;
    update public.tasks
    set task_intent = 'collaborative_draft',
        readiness = 'preparing',
        completion_mode = 'manager_draft',
        review_target_id = null,
        review_target_type = null,
        review_target_version_id = null,
        review_target_status = null,
        approval_state = 'not_required',
        status = 'in_progress',
        state_reason = 'human_requested_draft_revision',
        updated_at = now()
    where id = task_row.id;
  elsif task_row.task_intent <> 'collaborative_draft' then
    raise exception 'mission_task_contract:task_not_draft_capable';
  end if;

  select * into current_output
  from public.manager_outputs
  where account_id = p_account_id
    and artist_id = p_artist_id
    and artist_workspace_id = p_artist_workspace_id
    and output_type = 'task_draft'
    and subject_type = 'task'
    and subject_id = p_task_id
    and is_current
  order by created_at desc
  limit 1
  for update;
  current_output_found := found;
  if current_output_found then
    update public.manager_outputs
    set is_current = false,
        render_json = jsonb_set(coalesce(render_json, '{}'::jsonb), '{status}', '"needs_revision"'::jsonb, true)
    where id = current_output.id;
  end if;

  insert into public.manager_outputs (
    account_id,
    artist_workspace_id,
    artist_id,
    conversation_id,
    mission_id,
    subject_type,
    subject_id,
    output_type,
    dominant_situation,
    layout_pattern,
    tone,
    summary,
    primary_recommendation_json,
    confidence_json,
    supporting_evidence_json,
    render_json,
    supersedes_output_id,
    is_current,
    created_from_run_id
  ) values (
    p_account_id,
    p_artist_workspace_id,
    p_artist_id,
    p_conversation_id,
    task_row.mission_id,
    'task',
    p_task_id,
    'task_draft',
    'task_completion',
    'working_draft',
    'direct',
    nullif(btrim(p_summary), ''),
    coalesce(p_primary_recommendation_json, '{}'::jsonb),
    coalesce(p_confidence_json, '{}'::jsonb),
    coalesce(p_supporting_evidence_json, '[]'::jsonb),
    coalesce(p_render_json, '{}'::jsonb),
    case when current_output_found then current_output.id else null end,
    true,
    p_created_from_run_id
  ) returning * into draft_row;

  select public.activate_review_task_for_target_v1(
    p_account_id,
    p_artist_workspace_id,
    p_artist_id,
    p_task_id,
    'manager_output',
    draft_row.id,
    draft_row.id
  ) into activation;

  if not exists (
    select 1 from public.artifact_links link
    where link.account_id = p_account_id
      and link.artist_workspace_id = p_artist_workspace_id
      and link.artist_id = p_artist_id
      and link.source_type = 'manager_output'
      and link.source_id = draft_row.id
      and link.target_type = 'task'
      and link.target_id = p_task_id
      and link.relationship = 'response_to'
  ) then
    insert into public.artifact_links (
      account_id, artist_workspace_id, artist_id, source_type, source_id,
      target_type, target_id, relationship, created_from_run_id
    ) values (
      p_account_id, p_artist_workspace_id, p_artist_id, 'manager_output', draft_row.id,
      'task', p_task_id, 'response_to', p_created_from_run_id
    );
  end if;

  return jsonb_build_object(
    'status', 'ready_for_review',
    'taskId', p_task_id,
    'artifactId', draft_row.id,
    'versionId', draft_row.id,
    'reviewStatus', 'ready_for_review',
    'activation', activation
  );
end;
$$;

-- Replace the legacy continuation writer with a contract-first version. The
-- model's structured intent is the only routing signal: no task title or
-- prose is inspected to decide whether work is human or Manager-owned.
create or replace function public.persist_manager_review_continuation()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  follow_up jsonb;
  permission jsonb;
  follow_up_task_id uuid;
  active_plan_id uuid;
  owner_role_text text;
  intent_text text;
  work_mode_text text;
  completion_mode_text text;
  task_status public.task_status;
  task_readiness text;
  task_completion_mode text;
  task_dedupe_key text;
  step_text text;
  step_index integer;
  request_type_text text;
begin
  if new.source_type <> 'task_result'
     or new.actor_type <> 'manager'
     or new.mission_id is null
     or new.checkpoint_id is null then
    return new;
  end if;

  select mission.active_plan_version_id
  into active_plan_id
  from public.missions mission
  where mission.id = new.mission_id
    and mission.account_id = new.account_id
    and mission.artist_workspace_id = new.artist_workspace_id
    and mission.artist_id = new.artist_id;
  if active_plan_id is null then return new; end if;

  -- Two retries can arrive on separate database connections before either
  -- transaction has committed its child event. Serialize one originating
  -- Manager run so the stable dedupe key protects the task and reminder too,
  -- rather than relying on the event unique index after the fact.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(
    'manager-follow-up-run:' || coalesce(new.manager_synthesis_run_id::text, new.id::text)
  ));

  for follow_up in
    select item.value
    from jsonb_array_elements(coalesce(new.payload -> 'followUpTasks', '[]'::jsonb)) as item(value)
  loop
    owner_role_text := nullif(btrim(coalesce(follow_up ->> 'ownerRole', '')), '');
    intent_text := lower(btrim(coalesce(follow_up ->> 'intent', '')));
    work_mode_text := lower(btrim(coalesce(follow_up ->> 'workMode', '')));
    completion_mode_text := lower(btrim(coalesce(follow_up ->> 'completionMode', '')));

    -- Manager-owned work is represented by the Manager read and runtime, not
    -- by a human task or reminder. Missing/unknown intent is rejected by the
    -- Edge preflight and skipped here as a second fail-closed boundary.
    if owner_role_text is null
       or lower(owner_role_text) in ('manager', 'desk', 'ai', 'ai manager') then
      continue;
    end if;
    if intent_text not in ('human_action', 'collaborative_draft') then
      continue;
    end if;
    if intent_text = 'human_action'
       and (work_mode_text <> 'artist_action' or completion_mode_text <> 'result_note') then
      continue;
    end if;
    if intent_text = 'collaborative_draft'
       and (work_mode_text <> 'collaborative' or completion_mode_text <> 'manager_draft') then
      continue;
    end if;

    -- The run plus the exact structured follow-up is a stable identity. It
    -- survives event retries without comparing generated titles.
    task_dedupe_key := 'manager-follow-up:'
      || coalesce(new.manager_synthesis_run_id::text, new.id::text)
      || ':' || md5(follow_up::text);
    select event.target_id
    into follow_up_task_id
    from public.operating_events event
    where event.artist_workspace_id = new.artist_workspace_id
      and event.dedupe_key = task_dedupe_key
      and event.event_type = 'manager_follow_up_task_created'
    order by event.created_at desc
    limit 1;
    if follow_up_task_id is not null then
      follow_up_task_id := null;
      continue;
    end if;

    if intent_text = 'collaborative_draft' then
      task_status := 'in_progress';
      task_readiness := 'preparing';
      task_completion_mode := 'manager_draft';
    else
      task_status := 'open';
      task_readiness := 'ready';
      task_completion_mode := 'result_note';
    end if;

    -- Reuse the same server-side execution contract used by Genesis. If the
    -- event payload is malformed, the transaction fails before a partial task
    -- or reminder can be exposed.
    perform public.assert_generated_human_task_execution_contract_v1(
      jsonb_build_object(
        'scope', 'mission',
        'missionPlanVersionId', active_plan_id,
        'createdFromRunId', coalesce(new.manager_synthesis_run_id, new.id),
        'title', nullif(btrim(follow_up ->> 'title'), ''),
        'ownerRole', owner_role_text,
        'workMode', work_mode_text,
        'purpose', nullif(btrim(follow_up ->> 'purpose'), ''),
        'completionExpectation', nullif(btrim(follow_up ->> 'completionExpectation'), ''),
        'completionMode', task_completion_mode,
        'managerResponsibility', nullif(btrim(follow_up ->> 'managerResponsibility'), ''),
        'userResponsibility', nullif(btrim(follow_up ->> 'userResponsibility'), ''),
        'riskIfLate', nullif(btrim(follow_up ->> 'riskIfLate'), '')
      ),
      coalesce(array(select jsonb_array_elements_text(coalesce(follow_up -> 'steps', '[]'::jsonb))), '{}'::text[])
    );

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
      assignee_user_id,
      priority,
      status,
      approval_state,
      task_intent,
      readiness,
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
      new.account_id,
      new.artist_workspace_id,
      new.artist_id,
      'mission',
      new.mission_id,
      active_plan_id,
      new.checkpoint_id,
      nullif(btrim(follow_up ->> 'title'), ''),
      owner_role_text,
      -- Leave assignment to the validated assignment lifecycle. The child
      -- event carries any proposed assignee; pre-populating the owner here
      -- would create a stale owner reminder before that assignment is applied.
      null,
      1,
      task_status,
      'not_required',
      intent_text,
      task_readiness,
      nullif(btrim(follow_up ->> 'purpose'), ''),
      coalesce(array(select jsonb_array_elements_text(coalesce(follow_up -> 'evidenceNeeded', '[]'::jsonb))), '{}'::text[]),
      nullif(btrim(follow_up ->> 'completionExpectation'), ''),
      task_completion_mode,
      nullif(btrim(follow_up ->> 'deliverableTitle'), ''),
      coalesce(follow_up -> 'deliverableRequirements', '[]'::jsonb),
      nullif(btrim(follow_up ->> 'managerResponsibility'), ''),
      nullif(btrim(follow_up ->> 'userResponsibility'), ''),
      nullif(btrim(follow_up ->> 'riskIfLate'), ''),
      new.manager_synthesis_run_id
    ) returning id into follow_up_task_id;

    step_index := 0;
    for step_text in
      select value
      from jsonb_array_elements_text(coalesce(follow_up -> 'steps', '[]'::jsonb)) as item(value)
    loop
      step_index := step_index + 1;
      insert into public.task_steps (
        account_id, artist_workspace_id, artist_id, task_id, order_index, body
      ) values (
        new.account_id, new.artist_workspace_id, new.artist_id, follow_up_task_id, step_index, step_text
      );
    end loop;

    insert into public.operating_events (
      account_id, artist_workspace_id, artist_id, event_type, actor_type,
      target_type, target_id, source_type, source_id, manager_synthesis_run_id,
      mission_id, checkpoint_id, task_id, dedupe_key, display_mode,
      refresh_scope, summary, payload
    ) values (
      new.account_id, new.artist_workspace_id, new.artist_id,
      'manager_follow_up_task_created', 'manager', 'task', follow_up_task_id,
      'task_result', new.source_id, new.manager_synthesis_run_id,
      new.mission_id, new.checkpoint_id, follow_up_task_id, task_dedupe_key,
      case when intent_text = 'human_action' then 'action' else 'activity' end,
      array['missions', 'activity', 'today'],
      nullif(btrim(follow_up ->> 'title'), ''),
      jsonb_build_object(
        'originatingOperatingEventId', new.id,
        'originatingTaskId', new.task_id,
        'followUpTask', follow_up,
        'taskIntent', intent_text,
        'readiness', task_readiness
      )
    ) on conflict (artist_workspace_id, dedupe_key)
      where dedupe_key is not null do nothing;

    follow_up_task_id := null;
  end loop;

  for permission in
    select item.value
    from jsonb_array_elements(coalesce(new.payload -> 'permissionRequests', '[]'::jsonb)) as item(value)
  loop
    request_type_text := lower(btrim(coalesce(permission ->> 'requestType', '')));
    if request_type_text not in (
      'spend', 'external_outreach', 'submission', 'publish', 'schedule',
      'release_plan_change', 'legal_finance_rights', 'sensitive_commitment',
      'draft_export', 'source_connection'
    ) then
      continue;
    end if;

    if not exists (
      select 1
      from public.permission_requests existing_request
      where existing_request.artist_workspace_id = new.artist_workspace_id
        and existing_request.mission_id = new.mission_id
        and existing_request.created_from_run_id = new.manager_synthesis_run_id
        and lower(btrim(existing_request.title)) = lower(btrim(coalesce(permission ->> 'title', '')))
        and existing_request.status = 'pending'
    ) then
      insert into public.permission_requests (
        account_id, artist_workspace_id, artist_id, mission_id, task_id,
        checkpoint_id, request_type, title, body, risk, status, created_from_run_id
      ) values (
        new.account_id, new.artist_workspace_id, new.artist_id, new.mission_id,
        new.task_id, new.checkpoint_id, request_type_text::public.permission_request_type,
        nullif(btrim(permission ->> 'title'), ''),
        nullif(btrim(permission ->> 'body'), ''),
        nullif(btrim(permission ->> 'risk'), ''),
        'pending', new.manager_synthesis_run_id
      );
    end if;
  end loop;

  return new;
end;
$$;

-- Assignment follows the canonical continuation event and its task id. The
-- previous trigger located a task by matching generated title text, which can
-- select the wrong row when two follow-ups happen to share a title. The typed
-- continuation event is the durable identity; retries resolve that event by
-- its stable structured-payload hash instead.
create or replace function public.persist_team_continuation_assignments_v1()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  follow_up jsonb;
  follow_up_task_id uuid;
  task_row record;
  task_dedupe_key text;
  proposed_text text;
  proposed_user_id uuid;
  reason_text text;
begin
  -- The continuation writer emits a child event with the canonical task id.
  -- Apply its structured assignment immediately, without inspecting title
  -- copy or owner-role prose beyond the explicit Manager-owned exclusion.
  if new.event_type = 'manager_follow_up_task_created'
     and new.source_type = 'task_result'
     and new.task_id is not null then
    follow_up := coalesce(new.payload -> 'followUpTask', '{}'::jsonb);
    if lower(btrim(coalesce(follow_up ->> 'intent', ''))) not in ('human_action', 'collaborative_draft') then
      return new;
    end if;
    if lower(btrim(coalesce(follow_up ->> 'ownerRole', ''))) in ('', 'manager', 'desk', 'ai', 'ai manager') then
      return new;
    end if;
    select task.* into task_row
    from public.tasks task
    where task.id = new.task_id
      and task.account_id = new.account_id
      and task.artist_workspace_id = new.artist_workspace_id
      and task.artist_id = new.artist_id;
    if not found then return new; end if;

    proposed_text := nullif(btrim(coalesce(follow_up ->> 'assigneeUserId', '')), '');
    proposed_user_id := case
      when proposed_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then proposed_text::uuid
      else null
    end;
    reason_text := nullif(btrim(coalesce(follow_up ->> 'assignmentReason', '')), '');
    perform public._persist_model_assignment_v1(
      task_row.id,
      task_row.account_id,
      task_row.artist_workspace_id,
      task_row.artist_id,
      proposed_user_id,
      reason_text,
      proposed_text is not null and proposed_user_id is null
    );
    return new;
  end if;

  -- A retry of the originating result event may find the continuation already
  -- persisted. Resolve each child by the same hash used by the continuation
  -- writer so the assignment remains idempotent and title-independent.
  if new.source_type <> 'task_result'
     or new.actor_type <> 'manager'
     or new.mission_id is null
     or new.checkpoint_id is null then
    return new;
  end if;

  for follow_up in
    select item.value
    from jsonb_array_elements(coalesce(new.payload -> 'followUpTasks', '[]'::jsonb)) as item(value)
  loop
    if lower(btrim(coalesce(follow_up ->> 'intent', ''))) not in ('human_action', 'collaborative_draft')
       or lower(btrim(coalesce(follow_up ->> 'ownerRole', ''))) in ('', 'manager', 'desk', 'ai', 'ai manager') then
      continue;
    end if;

    task_dedupe_key := 'manager-follow-up:'
      || coalesce(new.manager_synthesis_run_id::text, new.id::text)
      || ':' || md5(follow_up::text);
    select event.target_id
    into follow_up_task_id
    from public.operating_events event
    where event.artist_workspace_id = new.artist_workspace_id
      and event.event_type = 'manager_follow_up_task_created'
      and event.dedupe_key = task_dedupe_key
    order by event.created_at desc
    limit 1;
    if follow_up_task_id is null then continue; end if;

    select task.* into task_row
    from public.tasks task
    where task.id = follow_up_task_id
      and task.account_id = new.account_id
      and task.artist_workspace_id = new.artist_workspace_id
      and task.artist_id = new.artist_id;
    if not found then continue; end if;

    proposed_text := nullif(btrim(coalesce(follow_up ->> 'assigneeUserId', '')), '');
    proposed_user_id := case
      when proposed_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then proposed_text::uuid
      else null
    end;
    reason_text := nullif(btrim(coalesce(follow_up ->> 'assignmentReason', '')), '');
    perform public._persist_model_assignment_v1(
      task_row.id,
      task_row.account_id,
      task_row.artist_workspace_id,
      task_row.artist_id,
      proposed_user_id,
      reason_text,
      proposed_text is not null and proposed_user_id is null
    );
  end loop;

  return new;
end;
$$;

-- Reminder lifecycle follows the typed readiness contract. Assignment changes
-- must create a new reminder version even when the task is still due in the
-- same minute; otherwise a cancelled reminder for the previous recipient can
-- win the unique dedupe key and suppress the new recipient's reminder.
create or replace function public._queue_task_reminder(
  target_task public.tasks,
  target_user_id uuid,
  target_kind text,
  target_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  if target_at is null or target_user_id is null then return; end if;
  insert into public.reminder_queue (
    account_id, artist_workspace_id, artist_id, user_id, mission_id, task_id,
    kind, scheduled_for, channel, status, dedupe_key, payload
  ) values (
    target_task.account_id,
    target_task.artist_workspace_id,
    target_task.artist_id,
    target_user_id,
    target_task.mission_id,
    target_task.id,
    target_kind,
    target_at,
    'in_app',
    'queued',
    'task:' || target_task.id::text || ':' || target_kind || ':'
      || pg_catalog.to_char(target_at at time zone 'UTC', 'YYYYMMDDHH24MI')
      || ':v' || coalesce(target_task.assignment_version, 0)::text,
    pg_catalog.jsonb_build_object(
      'taskTitle', target_task.title,
      'purpose', coalesce(target_task.purpose, ''),
      'riskIfLate', coalesce(target_task.risk_if_late, ''),
      'estimatedMinutes', target_task.estimated_minutes,
      'availableFrom', target_task.available_from,
      'deadline', target_task.deadline
    )
  ) on conflict (artist_workspace_id, dedupe_key) do nothing;
end;
$$;

create or replace function public.queue_reminders_for_task(target_task_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  task_row public.tasks%rowtype;
  recipient_id uuid;
  intensity text := 'standard';
  in_app_enabled boolean := true;
  start_at timestamptz;
  duration interval;
begin
  select * into task_row from public.tasks where id = target_task_id;
  if not found then return; end if;

  if task_row.status in ('completed', 'rejected', 'archived', 'superseded') then
    update public.reminder_queue
    set status = 'cancelled', last_error = 'task_is_terminal'
    where task_id = task_row.id and status in ('queued', 'processing');
    return;
  end if;

  if lower(trim(coalesce(task_row.owner_role, ''))) in ('manager', 'desk', 'ai', 'ai manager')
     or coalesce(task_row.work_mode, '') = 'manager_work' then
    update public.reminder_queue
    set status = 'cancelled', last_error = 'manager_owned_work'
    where task_id = task_row.id and status in ('queued', 'processing');
    return;
  end if;

  -- Desk-owned draft preparation and stale review targets are activity, not
  -- user work. Cancel any inherited reminder and keep Today quiet until the
  -- artifact activation RPC marks the task ready.
  if task_row.readiness in ('preparing', 'needs_revision')
     or (task_row.task_intent = 'review_approval'
         and (task_row.readiness <> 'ready'
              or task_row.status <> 'needs_approval'
              or task_row.approval_state <> 'needs_approval'
              or task_row.review_target_id is null
              or task_row.review_target_version_id is null
              or task_row.review_target_status <> 'ready_for_review')) then
    update public.reminder_queue
    set status = 'cancelled', last_error = 'task_not_ready'
    where task_id = task_row.id and status in ('queued', 'processing');
    return;
  end if;

  recipient_id := task_row.assignee_user_id;
  if recipient_id is null then
    select membership.user_id into recipient_id
    from public.account_memberships as membership
    where membership.account_id = task_row.account_id and membership.status = 'active'
    order by case when membership.role = 'owner' then 0 else 1 end, membership.created_at asc
    limit 1;
  end if;
  if recipient_id is null then return; end if;

  -- Assignment updates invoke this helper from both the task lifecycle trigger
  -- and the validated assignment RPC. If the first invocation already built an
  -- identical current reminder, the second invocation must leave it intact.
  if exists (
    select 1
    from public.reminder_queue reminder
    where reminder.task_id = task_row.id
      and reminder.status in ('queued', 'processing')
      and reminder.user_id = recipient_id
      and reminder.assignment_version = task_row.assignment_version
      and nullif(reminder.payload ->> 'purpose', '') is not distinct from nullif(task_row.purpose, '')
      and nullif(reminder.payload ->> 'riskIfLate', '') is not distinct from nullif(task_row.risk_if_late, '')
      and (case
        when nullif(reminder.payload ->> 'availableFrom', '') is null then null::timestamptz
        else (reminder.payload ->> 'availableFrom')::timestamptz
      end) is not distinct from task_row.available_from
      and (case
        when nullif(reminder.payload ->> 'deadline', '') is null then null::timestamptz
        else (reminder.payload ->> 'deadline')::timestamptz
      end) is not distinct from task_row.deadline
  ) then
    return;
  end if;

  select coalesce(pref.reminder_intensity, 'standard'), coalesce(pref.in_app_enabled, true)
  into intensity, in_app_enabled
  from public.notification_preferences as pref
  where pref.artist_workspace_id = task_row.artist_workspace_id
    and pref.user_id = recipient_id;

  intensity := coalesce(intensity, 'standard');
  in_app_enabled := coalesce(in_app_enabled, true);
  if not in_app_enabled then return; end if;

  update public.reminder_queue
  set status = 'cancelled', last_error = 'task_schedule_rebuilt'
  where task_id = task_row.id and status in ('queued', 'processing');

  if task_row.status = 'blocked' then
    perform public._queue_task_reminder(task_row, recipient_id, 'blocked_followup', pg_catalog.now() + interval '30 minutes');
    return;
  end if;

  start_at := greatest(pg_catalog.now(), coalesce(task_row.available_from, pg_catalog.now()));
  perform public._queue_task_reminder(
    task_row,
    recipient_id,
    case when task_row.available_from is not null and task_row.available_from > pg_catalog.now() + interval '1 minute' then 'task_start' else 'task_ready' end,
    start_at
  );

  if task_row.deadline is null then return; end if;

  if intensity = 'light' then
    perform public._queue_task_reminder(task_row, recipient_id, 'due_soon', greatest(pg_catalog.now(), task_row.deadline - interval '2 hours'));
    return;
  end if;

  duration := task_row.deadline - start_at;
  if intensity = 'stay_on_me' and duration >= interval '4 hours' then
    perform public._queue_task_reminder(
      task_row,
      recipient_id,
      'check_in',
      start_at + least(duration / 2, interval '6 hours')
    );
  end if;

  perform public._queue_task_reminder(task_row, recipient_id, 'due_soon', greatest(pg_catalog.now(), task_row.deadline - interval '2 hours'));
  perform public._queue_task_reminder(task_row, recipient_id, 'due_now', greatest(pg_catalog.now(), task_row.deadline));
  perform public._queue_task_reminder(
    task_row,
    recipient_id,
    'overdue',
    task_row.deadline + case when intensity = 'stay_on_me' then interval '1 hour' else interval '3 hours' end
  );
end;
$$;

create or replace function public._sync_task_reminder_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
begin
  if tg_op = 'INSERT' then
    if exists (
      select 1 from public.missions as mission
      where mission.id = new.mission_id and mission.status = 'active'
        and mission.active_plan_version_id = new.mission_plan_version_id
    ) then
      perform public.queue_reminders_for_task(new.id);
    end if;
    return new;
  end if;

  if new.status is distinct from old.status
     or new.deadline is distinct from old.deadline
     or new.available_from is distinct from old.available_from
     or new.assignee_user_id is distinct from old.assignee_user_id
     or new.reminder_policy is distinct from old.reminder_policy
     or new.task_intent is distinct from old.task_intent
     or new.readiness is distinct from old.readiness
     or new.approval_state is distinct from old.approval_state
     or new.review_target_id is distinct from old.review_target_id
     or new.review_target_version_id is distinct from old.review_target_version_id
     or new.review_target_status is distinct from old.review_target_status then
    perform public.queue_reminders_for_task(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists sync_task_reminder_lifecycle on public.tasks;
create trigger sync_task_reminder_lifecycle
after insert or update of status, deadline, available_from, assignee_user_id, reminder_policy,
  task_intent, readiness, approval_state, review_target_id, review_target_version_id, review_target_status
on public.tasks
for each row execute function public._sync_task_reminder_lifecycle();

-- Mission Genesis itself is finalized by the durable SQL finalizer. Preserve
-- that transaction boundary, but put a typed contract adapter in front of the
-- older graph writer so Genesis-created tasks receive the same intent and
-- readiness semantics as conversation-created tasks. The adapter never uses
-- task titles to classify work; it uses the persisted work mode and completion
-- mode that the generator already supplied.
do $$
begin
  if to_regprocedure('public._apply_mission_genesis_graph_v2(uuid,uuid,jsonb,uuid)') is not null
     and to_regprocedure('public._apply_mission_genesis_graph_legacy_v2(uuid,uuid,jsonb,uuid)') is null then
    alter function public._apply_mission_genesis_graph_v2(uuid, uuid, jsonb, uuid)
      rename to _apply_mission_genesis_graph_legacy_v2;
  end if;
end;
$$;

create or replace function public._apply_mission_genesis_graph_v2(
  target_run_id uuid,
  target_action_id uuid,
  decision jsonb,
  preferred_mission_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  result jsonb;
  applied_mission_id uuid;
  task_row record;
  generated_intent text;
  generated_completion_mode text;
  generated_work_mode text;
  generated_status public.task_status;
  generated_readiness text;
begin
  result := public._apply_mission_genesis_graph_legacy_v2(
    target_run_id,
    target_action_id,
    decision,
    preferred_mission_id
  );

  applied_mission_id := nullif(result ->> 'missionId', '')::uuid;
  if applied_mission_id is null
     or decision ->> 'outcome' not in ('activate_mission', 'update_existing_mission') then
    return result;
  end if;

  -- The legacy writer has already inserted task steps in this transaction.
  -- Normalize the newly-created rows before the deferred contract checks run.
  -- Approval-shaped output is quarantined because Genesis cannot own a durable
  -- artifact/version yet; only the Manager draft RPC may create that target.
  for task_row in
    select task.*
    from public.tasks task
    where task.account_id = (select run.account_id from public.manager_synthesis_runs run where run.id = target_run_id)
      and task.artist_workspace_id = (select run.artist_workspace_id from public.manager_synthesis_runs run where run.id = target_run_id)
      and task.artist_id = (select run.artist_id from public.manager_synthesis_runs run where run.id = target_run_id)
      and task.mission_id = applied_mission_id
      and task.created_from_run_id = target_run_id
      and task.status not in ('archived', 'superseded')
    order by task.created_at, task.id
  loop
    generated_completion_mode := lower(btrim(coalesce(task_row.completion_mode, '')));
    generated_work_mode := lower(btrim(coalesce(task_row.work_mode, '')));

    if generated_completion_mode = 'approval' then
      generated_intent := 'human_action';
      generated_completion_mode := 'result_note';
      generated_work_mode := case when generated_work_mode = 'collaborative' then 'collaborative' else 'artist_action' end;
      generated_status := 'blocked';
      generated_readiness := 'blocked';
    elsif generated_completion_mode = 'manager_draft' or generated_work_mode = 'collaborative' then
      generated_intent := 'collaborative_draft';
      generated_completion_mode := 'manager_draft';
      generated_work_mode := 'collaborative';
      generated_status := 'in_progress';
      generated_readiness := 'preparing';
    elsif generated_work_mode = 'manager_work' then
      generated_intent := 'manager_work';
      generated_status := 'proposed';
      generated_readiness := 'ready';
    else
      generated_intent := 'human_action';
      generated_completion_mode := case when generated_completion_mode in ('result_note', 'evidence') then generated_completion_mode else 'result_note' end;
      generated_work_mode := 'artist_action';
      generated_status := 'proposed';
      generated_readiness := 'ready';
    end if;

    update public.tasks
    set task_intent = generated_intent,
        work_mode = generated_work_mode,
        completion_mode = generated_completion_mode,
        readiness = generated_readiness,
        status = generated_status,
        approval_state = case when generated_readiness = 'blocked' then 'not_required' else approval_state end,
        state_reason = case when generated_readiness = 'blocked' then 'review_target_missing' else state_reason end,
        review_target_id = null,
        review_target_type = null,
        review_target_version_id = null,
        review_target_status = null,
        updated_at = now()
    where id = task_row.id;
  end loop;

  return result;
end;
$$;

revoke all on function public.assert_mission_task_contract_v1(jsonb) from public, anon, authenticated;
revoke all on function public.enforce_mission_task_contract_v1() from public, anon, authenticated;
revoke all on function public._apply_mission_genesis_graph_v2(uuid, uuid, jsonb, uuid) from public, anon, authenticated;
revoke all on function public._apply_mission_genesis_graph_legacy_v2(uuid, uuid, jsonb, uuid) from public, anon, authenticated, service_role;
revoke all on function public.activate_review_task_for_target_v1(uuid, uuid, uuid, uuid, text, uuid, uuid) from public, anon, authenticated;
revoke all on function public.approve_mission_review_task_v1(uuid) from public, anon;
revoke all on function public.persist_manager_task_draft_v1(uuid, uuid, uuid, uuid, uuid, uuid, text, text, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.assert_mission_task_contract_v1(jsonb) to service_role;
grant execute on function public.enforce_mission_task_contract_v1() to service_role;
grant execute on function public._apply_mission_genesis_graph_v2(uuid, uuid, jsonb, uuid) to service_role;
grant execute on function public.activate_review_task_for_target_v1(uuid, uuid, uuid, uuid, text, uuid, uuid) to service_role;
grant execute on function public.approve_mission_review_task_v1(uuid) to authenticated, service_role;
grant execute on function public.persist_manager_task_draft_v1(uuid, uuid, uuid, uuid, uuid, uuid, text, text, jsonb, jsonb, jsonb, jsonb) to service_role;

alter function public._apply_mission_genesis_graph_v2(uuid, uuid, jsonb, uuid)
  set search_path = public;
alter function public._apply_mission_genesis_graph_v2(uuid, uuid, jsonb, uuid)
  set row_security = off;
alter function public._apply_mission_genesis_graph_legacy_v2(uuid, uuid, jsonb, uuid)
  set search_path = public;
alter function public._apply_mission_genesis_graph_legacy_v2(uuid, uuid, jsonb, uuid)
  set row_security = off;
alter function public._apply_mission_genesis_graph_v2(uuid, uuid, jsonb, uuid) owner to postgres;
alter function public._apply_mission_genesis_graph_legacy_v2(uuid, uuid, jsonb, uuid) owner to postgres;

notify pgrst, 'reload schema';
