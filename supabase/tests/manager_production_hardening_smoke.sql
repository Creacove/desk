\set ON_ERROR_STOP on
begin;

do $$
declare
  v_account uuid:=gen_random_uuid();
  v_user uuid:=gen_random_uuid();
  v_artist uuid:=gen_random_uuid();
  v_workspace uuid:=gen_random_uuid();
  a1 jsonb; a2 jsonb; a3 jsonb; a4 jsonb; a5 jsonb; a6 jsonb; blocked jsonb;
  admission_id uuid;
  diagnostics jsonb;
  health jsonb;
begin
  if to_regclass('public.manager_runtime_admissions') is null then raise exception 'manager_runtime_admissions is missing'; end if;
  if to_regclass('public.manager_runtime_limits') is null then raise exception 'manager_runtime_limits is missing'; end if;
  if to_regclass('public.manager_runtime_incidents') is null then raise exception 'manager_runtime_incidents is missing'; end if;
  if to_regprocedure('public.claim_manager_runtime_admission_v1(uuid,uuid,uuid,text,integer,integer)') is null then raise exception 'runtime admission function is missing'; end if;
  if to_regprocedure('public.manager_runtime_diagnostics_v1(uuid)') is null then raise exception 'runtime diagnostics function is missing'; end if;
  if to_regprocedure('public.evaluate_manager_runtime_health_v1(uuid)') is null then raise exception 'runtime health evaluator is missing'; end if;

  insert into public.accounts(id,name,status) values(v_account,'Gate 8 hardening','active');
  insert into public.users(id,email,display_name,status) values(v_user,'gate8@example.com','Gate 8','active');
  insert into public.account_memberships(account_id,user_id,role,status) values(v_account,v_user,'owner','active');
  insert into public.artists(id,account_id,display_name) values(v_artist,v_account,'Gate 8 Artist');
  insert into public.artist_workspaces(id,account_id,artist_id,name,status) values(v_workspace,v_account,v_artist,'Gate 8 Artist','active');
  if not exists(select 1 from public.manager_runtime_limits where artist_workspace_id=v_workspace) then raise exception 'new workspace did not receive runtime limits'; end if;

  a1:=public.claim_manager_runtime_admission_v1(v_account,v_workspace,v_artist,'gate8-test',1,180);
  a2:=public.claim_manager_runtime_admission_v1(v_account,v_workspace,v_artist,'gate8-test',1,180);
  a3:=public.claim_manager_runtime_admission_v1(v_account,v_workspace,v_artist,'gate8-test',1,180);
  a4:=public.claim_manager_runtime_admission_v1(v_account,v_workspace,v_artist,'gate8-test',1,180);
  a5:=public.claim_manager_runtime_admission_v1(v_account,v_workspace,v_artist,'gate8-test',1,180);
  if coalesce((a1->>'allowed')::boolean,false) is not true or coalesce((a4->>'allowed')::boolean,false) is not true then raise exception 'normal bounded concurrency was rejected'; end if;
  if coalesce((a5->>'allowed')::boolean,false) is true or a5->>'reason'<>'workspace_concurrency_limit' then raise exception 'workspace concurrency limit did not stop the fifth active provider slot: %',a5; end if;

  admission_id:=(a1->>'admissionId')::uuid;
  if public.finish_manager_runtime_admission_v1(admission_id,'completed',null) is not true then raise exception 'admission completion failed'; end if;
  a6:=public.claim_manager_runtime_admission_v1(v_account,v_workspace,v_artist,'gate8-test',1,180);
  if coalesce((a6->>'allowed')::boolean,false) is not true then raise exception 'released admission slot did not become reusable: %',a6; end if;

  update public.manager_runtime_admissions set expires_at=now()-interval '1 second' where artist_workspace_id=v_workspace and status='active';
  perform public.claim_manager_runtime_admission_v1(v_account,v_workspace,v_artist,'after-expiry',1,180);
  if exists(select 1 from public.manager_runtime_admissions where artist_workspace_id=v_workspace and operation_key='gate8-test' and status='active' and expires_at<=now()) then raise exception 'expired admission remained active'; end if;

  update public.manager_runtime_admissions set status='failed',completed_at=now(),failure_reason='test cleanup' where artist_workspace_id=v_workspace and status='active';
  update public.manager_runtime_limits set background_ai_enabled=false where artist_workspace_id=v_workspace;
  blocked:=public.claim_manager_runtime_admission_v1(v_account,v_workspace,v_artist,'disabled-test',1,180);
  if coalesce((blocked->>'allowed')::boolean,false) is true or blocked->>'reason'<>'background_ai_disabled' then raise exception 'background AI kill switch did not fail closed: %',blocked; end if;
  update public.manager_runtime_limits set background_ai_enabled=true,max_tokens_day=50000 where artist_workspace_id=v_workspace;

  insert into public.ai_run_usage_events(account_id,artist_workspace_id,artist_id,workflow_key,run_type,operation_key,status,input_tokens,output_tokens,reasoning_tokens,provider_request_count,provider_cost_estimate)
  values(v_account,v_workspace,v_artist,'review_run','manager_synthesis','gate8-token-budget','succeeded',30000,15000,6000,1,1);
  blocked:=public.claim_manager_runtime_admission_v1(v_account,v_workspace,v_artist,'token-limit-test',1,180);
  if coalesce((blocked->>'allowed')::boolean,false) is true or blocked->>'reason'<>'daily_token_limit' then raise exception 'daily token budget did not block background AI: %',blocked; end if;
  update public.manager_runtime_limits set max_tokens_day=5000000 where artist_workspace_id=v_workspace;

  diagnostics:=public.manager_runtime_diagnostics_v1(v_account);
  if diagnostics is null or not (diagnostics ? 'providerRequests24h') or not (diagnostics ? 'indeterminateExternalActions') or not (diagnostics ? 'activeBackgroundAdmissions') then raise exception 'runtime diagnostics are incomplete: %',diagnostics; end if;

  insert into public.app_error_events(account_id,severity,source,function_name,operation,fingerprint,error_message)
  values(v_account,'critical','worker','manager-runtime-runner','gate8-test','gate8-critical','test critical runtime failure');
  health:=public.evaluate_manager_runtime_health_v1(v_account);
  if not exists(select 1 from public.manager_runtime_incidents where account_id=v_account and incident_key='open-critical-errors' and status='open' and resolved_at is null) then raise exception 'critical runtime error did not produce an operator incident: %',health; end if;
  update public.app_error_events set status='resolved',resolved_at=now() where account_id=v_account;
  perform public.evaluate_manager_runtime_health_v1(v_account);
  if exists(select 1 from public.manager_runtime_incidents where account_id=v_account and incident_key='open-critical-errors' and resolved_at is null) then raise exception 'cleared health condition did not resolve its incident'; end if;

  if has_table_privilege('authenticated','public.manager_intelligence_packets','INSERT') then raise exception 'authenticated can still forge Manager intelligence packets'; end if;
  if has_table_privilege('authenticated','public.manager_intelligence_packets','UPDATE') then raise exception 'authenticated can still overwrite Manager intelligence packets'; end if;
  if has_table_privilege('authenticated','public.manager_outputs','INSERT') then raise exception 'authenticated can still forge Manager outputs'; end if;
  if has_table_privilege('authenticated','public.manager_outputs','UPDATE') then raise exception 'authenticated can still overwrite Manager outputs'; end if;
  if not has_table_privilege('authenticated','public.manager_outputs','SELECT') then raise exception 'authenticated lost read access to Manager outputs'; end if;
  if has_function_privilege('authenticated',to_regprocedure('public.manager_runtime_diagnostics_v1(uuid)'),'EXECUTE') then raise exception 'runtime operator diagnostics leaked to authenticated clients'; end if;
  if has_table_privilege('authenticated','public.manager_runtime_incidents','SELECT') then raise exception 'operator incident ledger leaked to authenticated clients'; end if;
  if not has_function_privilege('service_role',to_regprocedure('public.manager_runtime_diagnostics_v1(uuid)'),'EXECUTE') then raise exception 'service role cannot read runtime diagnostics'; end if;
  if exists(select 1 from pg_extension where extname='pg_cron') and not exists(select 1 from cron.job where jobname='manager-runtime-health-evaluator') then raise exception 'runtime health evaluator cron is missing'; end if;
end$$;
rollback;
