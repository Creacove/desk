-- Artist World Model + decision-changing Question Engine.
--
-- The World Model stores operational facts that can materially change how Desk
-- plans: people, places, equipment, money, time, skills, access, preferences,
-- team, language, mobility and learned execution behavior. Facts are scoped and
-- can expire; this is deliberately not another permanent profile blob.
--
-- Dynamic Manager questions are tied to the exact adaptive review they unblock.
-- Existing Manager conversation UI renders/answers them through contextRequestId
-- + contextAnswers. The database persists the answer as a World Model fact and
-- reactivates that exact review automatically.

create table if not exists public.artist_operating_facts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  domain text not null check (domain in (
    'people', 'places', 'equipment', 'money', 'time', 'skills', 'access',
    'preference', 'team', 'language', 'mobility', 'execution'
  )),
  fact_key text not null check (fact_key ~ '^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$'),
  scope_type text not null check (scope_type in ('artist', 'mission', 'task')),
  scope_key text not null,
  value_json jsonb not null default '{}'::jsonb,
  display_value text not null,
  source_type text not null check (source_type in (
    'user_answer', 'user_statement', 'task_result', 'manager_observation', 'import', 'inference'
  )),
  source_id uuid,
  confidence public.evidence_confidence not null default 'medium',
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  last_confirmed_at timestamptz,
  status text not null default 'active' check (status in ('active', 'superseded', 'expired')),
  supersedes_fact_id uuid references public.artist_operating_facts(id) on delete set null,
  superseded_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists artist_operating_facts_current_uidx
on public.artist_operating_facts (artist_workspace_id, fact_key, scope_type, scope_key)
where status = 'active';

create index if not exists artist_operating_facts_runtime_idx
on public.artist_operating_facts (artist_workspace_id, artist_id, scope_type, scope_key, valid_until, created_at desc)
where status = 'active';

create table if not exists public.manager_question_requests (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  mission_id uuid references public.missions(id) on delete cascade,
  review_id uuid not null references public.reviews(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  context_request_id text not null unique,
  question_key text not null,
  status text not null default 'pending' check (status in ('pending', 'answered', 'dismissed', 'superseded', 'expired')),
  question text not null,
  reason text not null,
  answer_kind text not null check (answer_kind in ('short_text', 'single_select', 'multi_select', 'money_range')),
  options text[] not null default '{}',
  recommended_answer text,
  recommendation_reason text,
  hypothesis text not null,
  fallback_if_no text not null,
  fact_domain text not null check (fact_domain in (
    'people', 'places', 'equipment', 'money', 'time', 'skills', 'access',
    'preference', 'team', 'language', 'mobility', 'execution'
  )),
  fact_key text not null check (fact_key ~ '^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$'),
  fact_scope_type text not null check (fact_scope_type in ('artist', 'mission', 'task')),
  fact_scope_key text not null,
  valid_for_hours integer not null default 168 check (valid_for_hours between 1 and 2160),
  answer text,
  answered_at timestamptz,
  answered_by_user_id uuid references public.users(id) on delete set null,
  expires_at timestamptz not null,
  created_from_run_id uuid references public.manager_synthesis_runs(id) on delete set null,
  dedupe_key text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (artist_workspace_id, dedupe_key)
);

create index if not exists manager_question_requests_pending_idx
on public.manager_question_requests (artist_workspace_id, status, expires_at, created_at)
where status = 'pending';

create index if not exists manager_question_requests_review_idx
on public.manager_question_requests (review_id, status, created_at desc);

create trigger artist_operating_facts_set_updated_at
before update on public.artist_operating_facts
for each row execute function public.set_updated_at();

create trigger manager_question_requests_set_updated_at
before update on public.manager_question_requests
for each row execute function public.set_updated_at();

alter table public.artist_operating_facts enable row level security;
create policy artist_operating_facts_account_members_select
on public.artist_operating_facts for select
using (public.is_account_member(account_id));

alter table public.manager_question_requests enable row level security;
create policy manager_question_requests_account_members_select
on public.manager_question_requests for select
using (public.is_account_member(account_id));

-- Application writes are performed by the Manager service role so question
-- answers cannot forge canonical operating facts through direct table writes.
grant select on public.artist_operating_facts to authenticated;
grant select on public.manager_question_requests to authenticated;
grant select, insert, update, delete on public.artist_operating_facts to service_role;
grant select, insert, update, delete on public.manager_question_requests to service_role;

create or replace function public.persist_manager_question_request_v1(
  p_review_id uuid,
  p_run_id uuid,
  p_question jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_variable
declare
  review_row public.reviews%rowtype;
  mission_row public.missions%rowtype;
  conversation_id uuid;
  request_id uuid := gen_random_uuid();
  context_request_id text := 'world-model:' || request_id::text;
  question_key text := trim(coalesce(p_question ->> 'key', ''));
  question_text text := trim(coalesce(p_question ->> 'question', ''));
  question_reason text := trim(coalesce(p_question ->> 'reason', ''));
  answer_kind text := trim(coalesce(p_question ->> 'answerKind', ''));
  hypothesis_text text := trim(coalesce(p_question ->> 'hypothesis', ''));
  fallback_text text := trim(coalesce(p_question ->> 'fallbackIfNo', ''));
  fact_domain_text text := trim(coalesce(p_question ->> 'factDomain', ''));
  fact_key_text text := trim(coalesce(p_question ->> 'factKey', ''));
  fact_scope_type_text text := trim(coalesce(p_question ->> 'factScopeType', ''));
  fact_scope_key_text text := trim(coalesce(p_question ->> 'factScopeKey', ''));
  valid_hours integer := greatest(1, least(2160, coalesce((p_question ->> 'validForHours')::integer, 168)));
  expires_at_value timestamptz;
  options_array text[] := '{}';
  existing_request public.manager_question_requests%rowtype;
  manager_message_id uuid;
begin
  select * into review_row
  from public.reviews
  where id = p_review_id
  for update;

  if not found then raise exception 'Manager question review was not found'; end if;
  if review_row.trigger_type <> 'adaptive_replan' or review_row.status <> 'running' then
    raise exception 'Manager question requires the running adaptive review';
  end if;
  if review_row.mission_id is null then raise exception 'Manager question review has no Mission'; end if;

  select * into mission_row
  from public.missions
  where id = review_row.mission_id
    and account_id = review_row.account_id
    and artist_workspace_id = review_row.artist_workspace_id
    and artist_id = review_row.artist_id
  for update;
  if not found then raise exception 'Manager question Mission was not found'; end if;

  if question_key = '' or question_text = '' or question_reason = ''
     or hypothesis_text = '' or fallback_text = '' or fact_key_text = '' then
    raise exception 'Manager question is incomplete';
  end if;
  if answer_kind not in ('short_text', 'single_select', 'multi_select', 'money_range') then
    raise exception 'Manager question answer kind is invalid';
  end if;
  if fact_domain_text not in (
    'people', 'places', 'equipment', 'money', 'time', 'skills', 'access',
    'preference', 'team', 'language', 'mobility', 'execution'
  ) then
    raise exception 'Manager question fact domain is invalid';
  end if;
  if fact_scope_type_text not in ('artist', 'mission', 'task') then
    raise exception 'Manager question fact scope is invalid';
  end if;
  if fact_key_text !~ ('^' || fact_domain_text || '\.[a-z0-9_]+(\.[a-z0-9_]+)*$') then
    raise exception 'Manager question fact key must be namespaced to its domain';
  end if;

  if fact_scope_type_text = 'artist' and fact_scope_key_text <> 'artist' then
    raise exception 'Artist-scoped fact key is invalid';
  end if;
  if fact_scope_type_text = 'mission' and fact_scope_key_text <> ('mission:' || review_row.mission_id::text) then
    raise exception 'Mission-scoped fact key is invalid';
  end if;
  if fact_scope_type_text = 'task' and (
    review_row.trigger_object_type <> 'task'
    or review_row.trigger_object_id is null
    or fact_scope_key_text <> ('task:' || review_row.trigger_object_id::text)
  ) then
    raise exception 'Task-scoped fact key is invalid';
  end if;

  select coalesce(array_agg(value), '{}') into options_array
  from jsonb_array_elements_text(coalesce(p_question -> 'options', '[]'::jsonb)) as option(value);
  if cardinality(options_array) > 5 then
    options_array := options_array[1:5];
  end if;

  -- A retry must not create a second live question for the same missing fact.
  select * into existing_request
  from public.manager_question_requests
  where artist_workspace_id = review_row.artist_workspace_id
    and review_id = review_row.id
    and fact_key = fact_key_text
    and fact_scope_type = fact_scope_type_text
    and fact_scope_key = fact_scope_key_text
    and status = 'pending'
  order by created_at desc
  limit 1;

  if found then
    update public.reviews
    set status = 'snoozed',
        snoozed_until = existing_request.expires_at,
        runtime_claimed_at = null
    where id = review_row.id;

    update public.manager_synthesis_runs
    set status = 'completed',
        classification = 'adaptive_plan_needs_context_v1',
        confidence = 'medium',
        steps_payload = jsonb_build_array(
          jsonb_build_object('step', 'review_claimed', 'status', 'completed'),
          jsonb_build_object('step', 'adaptive_plan_compiled', 'status', 'completed'),
          jsonb_build_object('step', 'context_requested', 'status', 'completed')
        ),
        action_plan = jsonb_build_array(jsonb_build_object('questionRequestId', existing_request.id)),
        completed_at = now()
    where id = p_run_id;

    return jsonb_build_object(
      'questionRequestId', existing_request.id,
      'conversationId', existing_request.conversation_id,
      'contextRequestId', existing_request.context_request_id,
      'status', 'pending'
    );
  end if;

  expires_at_value := now() + make_interval(hours => valid_hours);

  -- Reuse the Mission's originating conversation when it still belongs to this
  -- workspace. Otherwise use the latest Mission conversation or create one.
  if mission_row.originating_conversation_id is not null and exists (
    select 1 from public.conversations as conversation
    where conversation.id = mission_row.originating_conversation_id
      and conversation.account_id = review_row.account_id
      and conversation.artist_workspace_id = review_row.artist_workspace_id
      and conversation.artist_id = review_row.artist_id
  ) then
    conversation_id := mission_row.originating_conversation_id;
  else
    select conversation.id into conversation_id
    from public.conversations as conversation
    where conversation.account_id = review_row.account_id
      and conversation.artist_workspace_id = review_row.artist_workspace_id
      and conversation.artist_id = review_row.artist_id
      and conversation.linked_mission_id = review_row.mission_id
    order by conversation.last_update_at desc nulls last, conversation.created_at desc
    limit 1;
  end if;

  if conversation_id is null then
    insert into public.conversations (
      account_id, artist_workspace_id, artist_id, topic, status, summary,
      last_update_at, linked_mission_id
    ) values (
      review_row.account_id,
      review_row.artist_workspace_id,
      review_row.artist_id,
      mission_row.title || ': one thing Desk needs',
      'active',
      'Desk needs one piece of operating context before it changes the current plan.',
      now(),
      review_row.mission_id
    ) returning id into conversation_id;
  elsif exists (
    select 1 from public.conversations where id = conversation_id and linked_mission_id is null
  ) then
    update public.conversations
    set linked_mission_id = review_row.mission_id,
        last_update_at = now()
    where id = conversation_id;
  end if;

  insert into public.manager_question_requests (
    id,
    account_id,
    artist_workspace_id,
    artist_id,
    mission_id,
    review_id,
    task_id,
    conversation_id,
    context_request_id,
    question_key,
    status,
    question,
    reason,
    answer_kind,
    options,
    recommended_answer,
    recommendation_reason,
    hypothesis,
    fallback_if_no,
    fact_domain,
    fact_key,
    fact_scope_type,
    fact_scope_key,
    valid_for_hours,
    expires_at,
    created_from_run_id,
    dedupe_key,
    metadata
  ) values (
    request_id,
    review_row.account_id,
    review_row.artist_workspace_id,
    review_row.artist_id,
    review_row.mission_id,
    review_row.id,
    case when review_row.trigger_object_type = 'task' then review_row.trigger_object_id else null end,
    conversation_id,
    context_request_id,
    question_key,
    'pending',
    question_text,
    question_reason,
    answer_kind,
    options_array,
    nullif(trim(coalesce(p_question ->> 'recommendedAnswer', '')), ''),
    nullif(trim(coalesce(p_question ->> 'recommendationReason', '')), ''),
    hypothesis_text,
    fallback_text,
    fact_domain_text,
    fact_key_text,
    fact_scope_type_text,
    fact_scope_key_text,
    valid_hours,
    expires_at_value,
    p_run_id,
    'world-model:' || review_row.id::text || ':' || fact_scope_type_text || ':' || fact_scope_key_text || ':' || fact_key_text,
    jsonb_build_object(
      'compilerDecision', 'needs_context',
      'currentPlanId', mission_row.active_plan_version_id
    )
  );

  insert into public.conversation_messages (
    account_id,
    artist_workspace_id,
    artist_id,
    conversation_id,
    speaker,
    label,
    body,
    manager_synthesis_run_id,
    metadata
  ) values (
    review_row.account_id,
    review_row.artist_workspace_id,
    review_row.artist_id,
    conversation_id,
    'manager',
    'Manager',
    question_text,
    p_run_id,
    jsonb_build_object(
      'classification', 'manager_world_model_question_v1',
      'confidence', 'medium',
      'contextRequestId', context_request_id,
      'contextQuestions', jsonb_build_array(jsonb_build_object(
        'key', question_key,
        'question', question_text,
        'reason', question_reason,
        'answerKind', answer_kind,
        'options', to_jsonb(options_array),
        'recommendedAnswer', coalesce(p_question ->> 'recommendedAnswer', ''),
        'recommendationReason', coalesce(p_question ->> 'recommendationReason', '')
      )),
      'worldModelQuestionRequestId', request_id,
      'presentation', jsonb_build_object('kind', 'question')
    )
  ) returning id into manager_message_id;

  update public.conversations
  set status = 'Manager needs context',
      summary = question_text,
      last_update_at = now()
  where id = conversation_id;

  update public.reviews
  set status = 'snoozed',
      snoozed_until = expires_at_value,
      runtime_claimed_at = null,
      next_action = question_text
  where id = review_row.id;

  update public.manager_synthesis_runs
  set status = 'completed',
      classification = 'adaptive_plan_needs_context_v1',
      confidence = 'medium',
      steps_payload = jsonb_build_array(
        jsonb_build_object('step', 'review_claimed', 'status', 'completed'),
        jsonb_build_object('step', 'adaptive_plan_compiled', 'status', 'completed'),
        jsonb_build_object('step', 'context_requested', 'status', 'completed')
      ),
      action_plan = jsonb_build_array(jsonb_build_object(
        'questionRequestId', request_id,
        'contextRequestId', context_request_id,
        'hypothesis', hypothesis_text,
        'fallbackIfNo', fallback_text
      )),
      completed_at = now()
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
    'manager_context_needed',
    'manager',
    'conversation',
    conversation_id,
    'manager_question_request',
    request_id,
    p_run_id,
    review_row.mission_id,
    review_row.checkpoint_id,
    case when review_row.trigger_object_type = 'task' then review_row.trigger_object_id else null end,
    'world-model-question:' || request_id::text,
    'action',
    array['activity', 'conversations', 'mission:' || review_row.mission_id::text]::text[],
    'Desk needs one thing before it changes the ' || mission_row.title || ' plan.',
    jsonb_build_object(
      'questionRequestId', request_id,
      'conversationId', conversation_id,
      'contextRequestId', context_request_id,
      'question', question_text
    )
  ) on conflict (artist_workspace_id, dedupe_key) where dedupe_key is not null do nothing;

  return jsonb_build_object(
    'questionRequestId', request_id,
    'conversationId', conversation_id,
    'contextRequestId', context_request_id,
    'managerMessageId', manager_message_id,
    'status', 'pending'
  );
end;
$$;

revoke all on function public.persist_manager_question_request_v1(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.persist_manager_question_request_v1(uuid, uuid, jsonb) to service_role;

create or replace function public.capture_world_model_answer_v1()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  context_request text;
  request_row public.manager_question_requests%rowtype;
  answer_text text;
  old_fact public.artist_operating_facts%rowtype;
  new_fact_id uuid;
  project_url text;
  worker_secret text;
  answer_item jsonb;
begin
  if new.speaker <> 'artist' then return new; end if;
  context_request := trim(coalesce(new.metadata ->> 'contextRequestId', ''));
  if context_request = '' or context_request not like 'world-model:%' then return new; end if;

  select * into request_row
  from public.manager_question_requests
  where context_request_id = context_request
    and artist_workspace_id = new.artist_workspace_id
    and artist_id = new.artist_id
    and conversation_id = new.conversation_id
    and status = 'pending'
  for update;
  if not found then return new; end if;

  for answer_item in
    select value from jsonb_array_elements(coalesce(new.metadata -> 'contextAnswers', '[]'::jsonb)) as item(value)
  loop
    if trim(coalesce(answer_item ->> 'questionKey', '')) = request_row.question_key then
      answer_text := trim(coalesce(answer_item ->> 'answer', ''));
      exit;
    end if;
  end loop;
  if answer_text is null or answer_text = '' then return new; end if;

  select * into old_fact
  from public.artist_operating_facts
  where artist_workspace_id = request_row.artist_workspace_id
    and fact_key = request_row.fact_key
    and scope_type = request_row.fact_scope_type
    and scope_key = request_row.fact_scope_key
    and status = 'active'
  for update;

  if found then
    update public.artist_operating_facts
    set status = 'superseded',
        superseded_at = now()
    where id = old_fact.id;
  end if;

  insert into public.artist_operating_facts (
    account_id,
    artist_workspace_id,
    artist_id,
    domain,
    fact_key,
    scope_type,
    scope_key,
    value_json,
    display_value,
    source_type,
    source_id,
    confidence,
    valid_from,
    valid_until,
    last_confirmed_at,
    status,
    supersedes_fact_id,
    metadata
  ) values (
    request_row.account_id,
    request_row.artist_workspace_id,
    request_row.artist_id,
    request_row.fact_domain,
    request_row.fact_key,
    request_row.fact_scope_type,
    request_row.fact_scope_key,
    jsonb_build_object(
      'answer', answer_text,
      'answerKind', request_row.answer_kind,
      'options', to_jsonb(request_row.options)
    ),
    answer_text,
    'user_answer',
    request_row.id,
    'high',
    now(),
    now() + make_interval(hours => request_row.valid_for_hours),
    now(),
    'active',
    case when old_fact.id is not null then old_fact.id else null end,
    jsonb_build_object(
      'questionRequestId', request_row.id,
      'conversationId', new.conversation_id,
      'contextRequestId', context_request,
      'answerMessageId', new.id
    )
  ) returning id into new_fact_id;

  update public.manager_question_requests
  set status = 'answered',
      answer = answer_text,
      answered_at = now()
  where id = request_row.id;

  update public.reviews
  set status = 'due',
      review_at = now(),
      snoozed_until = null,
      runtime_claimed_at = null,
      runtime_last_error = null
  where id = request_row.review_id
    and status = 'snoozed';

  update public.conversations
  set status = 'Manager updating plan',
      summary = 'Desk got the operating context it needed and is updating the plan.',
      last_update_at = now()
  where id = new.conversation_id;

  insert into public.operating_events (
    account_id, artist_workspace_id, artist_id, event_type, actor_type,
    target_type, target_id, source_type, source_id, mission_id, task_id,
    dedupe_key, display_mode, refresh_scope, summary, payload
  ) values (
    request_row.account_id,
    request_row.artist_workspace_id,
    request_row.artist_id,
    'manager_context_answered',
    'user',
    'mission',
    request_row.mission_id,
    'manager_question_request',
    request_row.id,
    request_row.mission_id,
    request_row.task_id,
    'world-model-answer:' || request_row.id::text,
    'activity',
    array['activity', 'conversations', 'mission:' || request_row.mission_id::text]::text[],
    'Desk got the context it needed and is updating the plan.',
    jsonb_build_object(
      'questionRequestId', request_row.id,
      'factId', new_fact_id,
      'factKey', request_row.fact_key,
      'factScope', request_row.fact_scope_key,
      'reviewId', request_row.review_id
    )
  ) on conflict (artist_workspace_id, dedupe_key) where dedupe_key is not null do nothing;

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
        'reviewId', request_row.review_id,
        'source', 'world-model-answer'
      )
    );
  end if;

  return new;
end;
$$;

-- The user identity is not currently stored on conversation_messages. The fact
-- therefore records its provenance through the exact question request and answer
-- message, while answered_by_user_id remains null rather than being inferred.
drop trigger if exists capture_world_model_answer on public.conversation_messages;
create trigger capture_world_model_answer
after insert on public.conversation_messages
for each row execute function public.capture_world_model_answer_v1();

create or replace function public.reap_expired_manager_questions_v1()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  question_row record;
  reactivated integer := 0;
begin
  for question_row in
    update public.manager_question_requests
    set status = 'expired'
    where status = 'pending'
      and expires_at <= now()
    returning id, review_id
  loop
    update public.reviews
    set status = 'due',
        review_at = now(),
        snoozed_until = null,
        runtime_claimed_at = null,
        runtime_last_error = 'Context request expired; use the stored fallback instead of asking the same question again.'
    where id = question_row.review_id
      and status = 'snoozed';
    reactivated := reactivated + 1;
  end loop;
  return reactivated;
end;
$$;

revoke all on function public.reap_expired_manager_questions_v1() from public, anon, authenticated;
grant execute on function public.reap_expired_manager_questions_v1() to service_role;

-- Expired proactive questions are reactivated before due adaptive reviews are
-- dispatched. The compiler receives question history and must use the recorded
-- fallback instead of repeatedly asking the artist the same thing.
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
  perform public.reap_expired_manager_questions_v1();

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

grant execute on function public.dispatch_due_manager_runtime_reviews_v1() to service_role;

notify pgrst, 'reload schema';
