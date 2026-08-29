\set ON_ERROR_STOP on

do $$declare definition text;begin
  if to_regclass('public.manager_career_watch_state') is null then raise exception 'manager_career_watch_state is missing';end if;
  if to_regprocedure('public.claim_due_manager_career_watch_v1(integer)') is null then raise exception 'Career Watch claim function is missing';end if;
  if to_regprocedure('public.queue_manager_career_watch_review_v1(uuid,uuid)') is null then raise exception 'Career Watch review routing is missing';end if;
  select pg_get_functiondef('public.queue_manager_career_watch_review_v1(uuid,uuid)'::regprocedure) into definition;
  if position('evidence_type' in definition)=0 or position('manager_career_watch' in definition)=0 or position('recommended_decision' in definition)=0 or position('public.reviews' in definition)=0 then raise exception 'Career Watch does not route actionable public-web evidence through the existing Manager review runtime';end if;
  if position('adaptive_replan' in definition)=0 or position('''due''' in definition)=0 or position('runtime_key' in definition)=0 then raise exception 'Career Watch review is durable but cannot be claimed by the adaptive Manager runtime';end if;
  if not exists(select 1 from pg_trigger where tgname='enable_manager_career_watch_for_workspace' and not tgisinternal) then raise exception 'new workspaces do not get Career Watch state';end if;
  if exists(select 1 from pg_extension where extname='pg_cron') and not exists(select 1 from cron.job where jobname='manager-career-watch-dispatcher') then raise exception 'Career Watch dispatcher cron is missing';end if;
end$$;
