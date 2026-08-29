\set ON_ERROR_STOP on

-- Fresh-database contract for the Artist World Model + Question Engine.
-- This intentionally validates durable schema/runtime wiring without fixtures.
do $$
declare
  definition text;
  relrowsecurity boolean;
begin
  if to_regclass('public.artist_operating_facts') is null then
    raise exception 'artist_operating_facts is missing';
  end if;
  if to_regclass('public.manager_question_requests') is null then
    raise exception 'manager_question_requests is missing';
  end if;

  if to_regprocedure('public.persist_manager_question_request_v1(uuid,uuid,jsonb)') is null then
    raise exception 'persist_manager_question_request_v1 is missing';
  end if;
  if to_regprocedure('public.capture_world_model_answer_v1()') is null then
    raise exception 'capture_world_model_answer_v1 is missing';
  end if;
  if to_regprocedure('public.reap_expired_manager_questions_v1()') is null then
    raise exception 'reap_expired_manager_questions_v1 is missing';
  end if;

  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'artist_operating_facts_current_uidx'
  ) then
    raise exception 'current operating fact uniqueness index is missing';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'artist_operating_facts'
      and column_name = 'valid_until'
  ) then
    raise exception 'artist_operating_facts.valid_until is missing';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'artist_operating_facts'
      and column_name = 'supersedes_fact_id'
  ) then
    raise exception 'artist_operating_facts.supersedes_fact_id is missing';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'manager_question_requests'
      and column_name = 'hypothesis'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'manager_question_requests'
      and column_name = 'fallback_if_no'
  ) then
    raise exception 'question hypothesis/fallback columns are missing';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'capture_world_model_answer'
      and not tgisinternal
  ) then
    raise exception 'conversation answer capture trigger is missing';
  end if;

  select c.relrowsecurity into relrowsecurity
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'artist_operating_facts';
  if relrowsecurity is not true then
    raise exception 'artist_operating_facts RLS is not enabled';
  end if;

  select c.relrowsecurity into relrowsecurity
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'manager_question_requests';
  if relrowsecurity is not true then
    raise exception 'manager_question_requests RLS is not enabled';
  end if;

  select pg_get_functiondef('public.capture_world_model_answer_v1()'::regprocedure)
  into definition;
  if position('/functions/v1/workflow-recovery' in definition) = 0
     or position('world-model-answer' in definition) = 0
     or position('manager_context_answered' in definition) = 0 then
    raise exception 'world model answer continuation is not wired through the recovery gateway';
  end if;

  select pg_get_functiondef('public.dispatch_due_manager_runtime_reviews_v1()'::regprocedure)
  into definition;
  if position('reap_expired_manager_questions_v1' in definition) = 0
     or position('/functions/v1/workflow-recovery' in definition) = 0 then
    raise exception 'runtime dispatcher does not recover expired questions safely';
  end if;
end;
$$;