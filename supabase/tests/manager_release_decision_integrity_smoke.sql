\set ON_ERROR_STOP on

do $$
declare
  definition text;
  trigger_definition text;
begin
  if to_regprocedure('public.manager_effective_release_state_v1(uuid)') is null then raise exception 'manager_effective_release_state_v1 is missing'; end if;
  if to_regprocedure('public.apply_approved_release_decision_integrity_v1()') is null then raise exception 'apply_approved_release_decision_integrity_v1 is missing'; end if;
  if not exists (select 1 from pg_trigger where tgname = 'apply_approved_release_decision_integrity' and not tgisinternal) then raise exception 'approved release decision integrity trigger is missing'; end if;
  if not exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'memory_entries' and indexname = 'memory_entries_canonical_release_plan_projection_uidx' and indexdef ilike '%unique%') then raise exception 'canonical release Manager read projection uniqueness guard is missing'; end if;

  select pg_get_functiondef('public.manager_effective_release_state_v1(uuid)'::regprocedure) into definition;
  if position('approved_release_date' in definition) = 0 or position('effectiveReleaseDate' in definition) = 0 or position('approved_release_plan' in definition) = 0 or position('providerReleaseDate' in definition) = 0 then raise exception 'effective release state does not preserve approved-vs-provider truth'; end if;
  if definition ~* 'update[[:space:]]+public\.music_items' or definition ~* 'update[[:space:]]+music_items' then raise exception 'effective release state rewrites provider music metadata'; end if;

  select pg_get_functiondef('public.apply_approved_release_decision_integrity_v1()'::regprocedure) into definition;
  if position('time.release_date' in definition) = 0 or position('canonical_release_date_approved' in definition) = 0 or position('manager_question_requests' in definition) = 0 then raise exception 'approved release decision does not publish/supersede release-date World Model state'; end if;
  if position('canonical_release_plan' in definition) = 0 or position('canonical_release_plan_v1' in definition) = 0 or position('effectiveReleaseDate' in definition) = 0 then raise exception 'approved release decision does not publish the bounded Manager opening projection'; end if;
  if position('fact_domain = ''time''' in definition) = 0 or position('status = ''pending''' in definition) = 0 then raise exception 'release-date question retirement is not scoped to pending time questions'; end if;
  if position('adaptive_replan' in definition) = 0 or position('release-date-change:' in definition) = 0 or position('do not ask the artist to reconfirm' in definition) = 0 then raise exception 'approved release decision does not wake idempotent adaptive replanning'; end if;
  if definition ~* 'update[[:space:]]+public\.music_items' or definition ~* 'update[[:space:]]+music_items' then raise exception 'approved release decision trigger rewrites provider music metadata'; end if;

  select pg_get_triggerdef(t.oid) into trigger_definition from pg_trigger t where t.tgname = 'apply_approved_release_decision_integrity' and not t.tgisinternal;
  if position('UPDATE OF STATUS' in upper(trigger_definition)) = 0 or position('approved' in lower(trigger_definition)) = 0 then raise exception 'release decision trigger is not bound to approved status transitions'; end if;

  select pg_get_functiondef('public.approve_release_date_change(uuid,uuid,uuid,uuid,text,text,uuid)'::regprocedure) into definition;
  if position('approved_release_date = v_request.proposed_date' in definition) = 0 or position('revision = revision + 1' in definition) = 0 or position('release_task_schedule_bindings' in definition) = 0 then raise exception 'release approval no longer atomically updates canonical plan/schedule state'; end if;
  if definition ~* 'update[[:space:]]+public\.music_items' or definition ~* 'update[[:space:]]+music_items' then raise exception 'release approval rewrites provider music metadata'; end if;
end;
$$;