-- Gate 4 continuation topology: only safe terminal permission/execution states
-- wake the adaptive Manager immediately. The scheduled dispatcher remains the
-- recovery path if the HTTP nudge cannot be sent.

do $$
declare
  function_def text;
begin
  if to_regprocedure('public._nudge_manager_permission_outcome_review_v1()') is null then
    raise exception '_nudge_manager_permission_outcome_review_v1 is missing';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname = 'nudge_manager_permission_outcome_review'
      and not tgisinternal
  ) then
    raise exception 'nudge_manager_permission_outcome_review trigger is missing';
  end if;

  select pg_get_functiondef('public._nudge_manager_permission_outcome_review_v1()'::regprocedure)
  into function_def;

  if position('workflow-recovery' in function_def) = 0
     or position('adaptive_replan' in function_def) = 0
     or position('permission-outcome' in function_def) = 0 then
    raise exception 'Permission outcome nudge does not route through the hardened Manager gateway.';
  end if;

  if position('approved-prepared-only' in function_def) = 0
     or position('execution-(succeeded|failed|indeterminate)' in function_def) = 0
     or position('rejected' in function_def) = 0 then
    raise exception 'Permission outcome nudge is missing a safe terminal wake state.';
  end if;

  -- Executable approval is deliberately absent: provider execution must finish
  -- before the Manager reasons from the outcome.
  if position(':approved$' in function_def) > 0 then
    raise exception 'Executable approval would wake the Manager before the real external outcome.';
  end if;
end;
$$;
