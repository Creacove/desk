-- Gate 1: Manager State & Decision Integrity closure.
--
-- Canonical product state must outrank historical conversation, memory and derived
-- Manager reads on every turn. Known fresh facts must never become user-visible
-- repeat questions. This migration provides one generic current-state projection
-- and refreshes it immediately after every artist conversation write.

create or replace function public.manager_canonical_state_snapshot_v1(
  p_account_id uuid,
  p_artist_workspace_id uuid,
  p_artist_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'projectionVersion', 'manager_canonical_state_v1',
    'generatedAt', now(),
    'operatingFacts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', fact.id,
        'domain', fact.domain,
        'factKey', fact.fact_key,
        'scopeType', fact.scope_type,
        'scopeKey', fact.scope_key,
        'value', fact.value_json,
        'displayValue', fact.display_value,
        'sourceType', fact.source_type,
        'confidence', fact.confidence,
        'validUntil', fact.valid_until,
        'lastConfirmedAt', fact.last_confirmed_at
      ) order by coalesce(fact.last_confirmed_at, fact.created_at) desc)
      from (
        select *
        from public.artist_operating_facts
        where account_id = p_account_id
          and artist_workspace_id = p_artist_workspace_id
          and artist_id = p_artist_id
          and status = 'active'
          and (valid_until is null or valid_until > now())
        order by coalesce(last_confirmed_at, created_at) desc
        limit 40
      ) as fact
    ), '[]'::jsonb),
    'questionHistory', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', question.id,
        'missionId', question.mission_id,
        'taskId', question.task_id,
        'questionKey', question.question_key,
        'status', question.status,
        'question', question.question,
        'factKey', question.fact_key,
        'factScopeType', question.fact_scope_type,
        'factScopeKey', question.fact_scope_key,
        'answer', question.answer,
        'answeredAt', question.answered_at,
        'expiresAt', question.expires_at
      ) order by question.created_at desc)
      from (
        select *
        from public.manager_question_requests
        where account_id = p_account_id
          and artist_workspace_id = p_artist_workspace_id
          and artist_id = p_artist_id
        order by created_at desc
        limit 24
      ) as question
    ), '[]'::jsonb),
    'decisions', coalesce((
      select jsonb_agg(decision_row.payload order by decision_row.created_at desc)
      from (
        select permission.created_at,
          jsonb_build_object(
            'kind', 'permission',
            'id', permission.id,
            'missionId', permission.mission_id,
            'taskId', permission.task_id,
            'requestType', permission.request_type,
            'title', permission.title,
            'status', permission.status,
            'parameters', permission.parameters,
            'createdFromActionId', permission.created_from_action_id
          ) as payload
        from public.permission_requests as permission
        where permission.account_id = p_account_id
          and permission.artist_workspace_id = p_artist_workspace_id
          and permission.artist_id = p_artist_id
        order by permission.created_at desc
        limit 20
      ) as decision_row
    ), '[]'::jsonb),
    'managerActions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', action.id,
        'runId', action.manager_synthesis_run_id,
        'actionType', action.action_type,
        'targetType', action.target_type,
        'targetId', action.target_id,
        'status', action.status,
        'approvalRequired', action.approval_required,
        'payload', action.payload,
        'result', action.result_payload,
        'error', action.error
      ) order by action.created_at desc)
      from (
        select *
        from public.manager_run_actions
        where account_id = p_account_id
          and artist_workspace_id = p_artist_workspace_id
          and artist_id = p_artist_id
        order by created_at desc
        limit 24
      ) as action
    ), '[]'::jsonb),
    'activeMissions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', mission.id,
        'title', mission.title,
        'objective', mission.objective,
        'status', mission.status,
        'currentRecommendation', mission.current_recommendation,
        'activePlanVersionId', mission.active_plan_version_id,
        'updatedAt', mission.updated_at
      ) order by mission.priority desc, mission.updated_at desc)
      from public.missions as mission
      where mission.account_id = p_account_id
        and mission.artist_workspace_id = p_artist_workspace_id
        and mission.artist_id = p_artist_id
        and mission.status in ('candidate', 'active', 'blocked', 'review', 'paused')
    ), '[]'::jsonb),
    'activeTasks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', task.id,
        'missionId', task.mission_id,
        'missionPlanVersionId', task.mission_plan_version_id,
        'title', task.title,
        'status', task.status,
        'approvalState', task.approval_state,
        'workMode', task.work_mode,
        'purpose', task.purpose,
        'managerResponsibility', task.manager_responsibility,
        'userResponsibility', task.user_responsibility,
        'updatedAt', task.updated_at
      ) order by task.priority desc, task.updated_at desc)
      from public.tasks as task
      left join public.missions as mission on mission.id = task.mission_id
      where task.account_id = p_account_id
        and task.artist_workspace_id = p_artist_workspace_id
        and task.artist_id = p_artist_id
        and task.status in ('proposed', 'open', 'needs_approval', 'approved', 'in_progress', 'blocked', 'missed')
        and (
          task.scope = 'setup_source'
          or (
            task.mission_id is not null
            and mission.status in ('candidate', 'active', 'blocked', 'review', 'paused')
            and mission.active_plan_version_id is not null
            and task.mission_plan_version_id = mission.active_plan_version_id
          )
        )
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.manager_canonical_state_snapshot_v1(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.manager_canonical_state_snapshot_v1(uuid, uuid, uuid) to service_role;

-- Fail closed before a known fresh fact can become a repeated user-visible
-- question. The surrounding adaptive runtime requeues safely and already loads
-- fresh operating facts on its next pass.
create or replace function public.reject_known_manager_question_v1()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.artist_operating_facts as fact
    where fact.account_id = new.account_id
      and fact.artist_workspace_id = new.artist_workspace_id
      and fact.artist_id = new.artist_id
      and fact.fact_key = new.fact_key
      and fact.scope_type = new.fact_scope_type
      and fact.scope_key = new.fact_scope_key
      and fact.status = 'active'
      and (fact.valid_until is null or fact.valid_until > now())
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Manager question rejected because the canonical fact is already known and fresh.';
  end if;
  return new;
end;
$$;

revoke all on function public.reject_known_manager_question_v1() from public, anon, authenticated;

drop trigger if exists reject_known_manager_question on public.manager_question_requests;
create trigger reject_known_manager_question
before insert on public.manager_question_requests
for each row execute function public.reject_known_manager_question_v1();

-- Build the canonical projection after answer-capture triggers have had a chance
-- to update operating facts. PostgreSQL runs same-kind triggers by name, so the
-- zz_ prefix intentionally places this after capture_world_model_answer.
create or replace function public.refresh_manager_canonical_state_memory_v1()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  snapshot jsonb;
  prior_id uuid;
begin
  if new.speaker <> 'artist' then return new; end if;

  snapshot := public.manager_canonical_state_snapshot_v1(
    new.account_id,
    new.artist_workspace_id,
    new.artist_id
  );

  select memory.id into prior_id
  from public.memory_entries as memory
  where memory.account_id = new.account_id
    and memory.artist_workspace_id = new.artist_workspace_id
    and memory.artist_id = new.artist_id
    and memory.source_type = 'manager_canonical_state_v1'
  order by memory.created_at desc
  limit 1;

  delete from public.memory_entries
  where account_id = new.account_id
    and artist_workspace_id = new.artist_workspace_id
    and artist_id = new.artist_id
    and source_type = 'manager_canonical_state_v1';

  insert into public.memory_entries (
    account_id,
    artist_workspace_id,
    artist_id,
    conversation_id,
    scope,
    kind,
    content,
    source_type,
    source_id,
    confidence,
    reason,
    supersedes_memory_entry_id
  ) values (
    new.account_id,
    new.artist_workspace_id,
    new.artist_id,
    new.conversation_id,
    'conversation',
    'fact',
    snapshot::text,
    'manager_canonical_state_v1',
    new.conversation_id,
    'high',
    'Canonical current product state. This projection overrides older conversation, memory, stale plans, stale Tasks, and derived Manager reads when they conflict.',
    null
  );

  return new;
end;
$$;

revoke all on function public.refresh_manager_canonical_state_memory_v1() from public, anon, authenticated;

drop trigger if exists zz_refresh_manager_canonical_state_memory on public.conversation_messages;
create trigger zz_refresh_manager_canonical_state_memory
after insert on public.conversation_messages
for each row
when (new.speaker = 'artist')
execute function public.refresh_manager_canonical_state_memory_v1();
