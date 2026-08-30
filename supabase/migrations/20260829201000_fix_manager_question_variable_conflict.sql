-- persist_manager_question_request_v1 returns JSON but operates on tables that
-- gained columns sharing names with its local variables. Make the intended
-- local-variable precedence explicit so question persistence cannot fail at
-- runtime with an ambiguous-column error.

do $migration$
declare
  function_body text;
begin
  select prosrc
  into function_body
  from pg_proc
  where oid = 'public.persist_manager_question_request_v1(uuid,uuid,jsonb)'::regprocedure;

  if function_body is null then
    raise exception 'persist_manager_question_request_v1 is missing';
  end if;

  if function_body not like '#variable_conflict use_variable%' then
    function_body := E'#variable_conflict use_variable\n' || function_body;
  end if;

  execute format($definition$
    create or replace function public.persist_manager_question_request_v1(
      p_review_id uuid,
      p_run_id uuid,
      p_question jsonb
    )
    returns jsonb
    language plpgsql
    security definer
    set search_path = public
    as %L
  $definition$, function_body);
end;
$migration$;

revoke all on function public.persist_manager_question_request_v1(uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.persist_manager_question_request_v1(uuid,uuid,jsonb) to service_role;
