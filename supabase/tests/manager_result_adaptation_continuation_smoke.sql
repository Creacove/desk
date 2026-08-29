-- Gate 3 continuation smoke contract.
-- Proves that a completed adaptive review leaves an explicit next human state
-- instead of requiring the artist to ask what happens next.

do $$
begin
  if to_regprocedure('public.manager_next_executable_task_v1(uuid,uuid,uuid)') is null then
    raise exception 'manager_next_executable_task_v1 is missing';
  end if;

  if to_regprocedure('public.apply_manager_review_continuation_v1()') is null then
    raise exception 'apply_manager_review_continuation_v1 is missing';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname = 'manager_review_continuation'
      and not tgisinternal
  ) then
    raise exception 'manager_review_continuation trigger is missing';
  end if;

  if not exists (
    select 1
    from pg_proc
    where oid = 'public.manager_next_executable_task_v1(uuid,uuid,uuid)'::regprocedure
      and prosecdef
  ) then
    raise exception 'manager_next_executable_task_v1 must remain security definer';
  end if;
end;
$$;

-- Static durable semantics that are easy to regress accidentally.
do $$
declare
  continuation_def text;
begin
  select pg_get_functiondef('public.apply_manager_review_continuation_v1()'::regprocedure)
  into continuation_def;

  if position('manager_continuation_ready' in continuation_def) = 0 then
    raise exception 'continuation event emission is missing';
  end if;

  if position('manager_next_executable_task_v1' in continuation_def) = 0 then
    raise exception 'continuation does not resolve the next executable Task';
  end if;

  if position('No human action is required right now' in continuation_def) = 0 then
    raise exception 'Manager checkpoint waiting state is not explicit';
  end if;

  if position('No further human action is currently required' in continuation_def) = 0 then
    raise exception 'no-human-work continuation state is not explicit';
  end if;

  if position('today' in continuation_def) = 0 then
    raise exception 'continuation does not refresh Today execution state';
  end if;
end;
$$;
