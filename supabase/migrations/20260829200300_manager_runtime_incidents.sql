-- Service-role-only operational incident ledger. This is deliberately separate
-- from artist Activity and customer-facing Manager outputs.
create table if not exists public.manager_runtime_incidents (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references public.accounts(id) on delete cascade,
  incident_key text not null,
  severity text not null check(severity in('warning','error','critical')),
  title text not null,
  detail text not null,
  status text not null default 'open' check(status in('open','acknowledged','resolved')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);
create unique index if not exists manager_runtime_incidents_open_uidx on public.manager_runtime_incidents(account_id,incident_key) where resolved_at is null;
create index if not exists manager_runtime_incidents_status_idx on public.manager_runtime_incidents(status,severity,last_seen_at desc);
alter table public.manager_runtime_incidents enable row level security;
revoke all on public.manager_runtime_incidents from public,anon,authenticated;
grant all on public.manager_runtime_incidents to service_role;

create or replace function public.upsert_manager_runtime_incident_v1(p_account_id uuid,p_incident_key text,p_severity text,p_title text,p_detail text,p_metadata jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
  insert into public.manager_runtime_incidents(account_id,incident_key,severity,title,detail,status,metadata)
  values(p_account_id,left(p_incident_key,180),p_severity,left(p_title,300),left(p_detail,2000),'open',coalesce(p_metadata,'{}'::jsonb))
  on conflict(account_id,incident_key) where resolved_at is null do update set severity=excluded.severity,title=excluded.title,detail=excluded.detail,last_seen_at=now(),metadata=excluded.metadata,status=case when manager_runtime_incidents.status='resolved' then 'open' else manager_runtime_incidents.status end
  returning id into v_id;
  return v_id;
end$$;
revoke all on function public.upsert_manager_runtime_incident_v1(uuid,text,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.upsert_manager_runtime_incident_v1(uuid,text,text,text,text,jsonb) to service_role;

create or replace function public.resolve_manager_runtime_incident_v1(p_account_id uuid,p_incident_key text)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  update public.manager_runtime_incidents set status='resolved',resolved_at=now(),last_seen_at=now() where account_id is not distinct from p_account_id and incident_key=p_incident_key and resolved_at is null;
  return found;
end$$;
revoke all on function public.resolve_manager_runtime_incident_v1(uuid,text) from public,anon,authenticated;
grant execute on function public.resolve_manager_runtime_incident_v1(uuid,text) to service_role;

create or replace function public.evaluate_manager_runtime_health_v1(p_account_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare d jsonb;stale_count integer;failed_count integer;critical_count integer;indeterminate_count integer;
begin
  d:=public.manager_runtime_diagnostics_v1(p_account_id);
  stale_count:=coalesce((d->>'staleAdaptiveReviews')::integer,0);failed_count:=coalesce((d->>'failedManagerRuns24h')::integer,0);critical_count:=coalesce((d->>'openCriticalErrors')::integer,0);indeterminate_count:=coalesce((d->>'indeterminateExternalActions')::integer,0);
  if stale_count>0 then perform public.upsert_manager_runtime_incident_v1(p_account_id,'stale-adaptive-reviews','error','Manager reviews are stuck',stale_count||' adaptive review(s) have exceeded the runtime lease.',jsonb_build_object('count',stale_count)); else perform public.resolve_manager_runtime_incident_v1(p_account_id,'stale-adaptive-reviews'); end if;
  if failed_count>=5 then perform public.upsert_manager_runtime_incident_v1(p_account_id,'manager-run-failure-spike','critical','Manager run failures are elevated',failed_count||' Manager synthesis runs failed in the last 24 hours.',jsonb_build_object('count',failed_count)); else perform public.resolve_manager_runtime_incident_v1(p_account_id,'manager-run-failure-spike'); end if;
  if critical_count>0 then perform public.upsert_manager_runtime_incident_v1(p_account_id,'open-critical-errors','critical','Critical Manager errors require attention',critical_count||' critical application error(s) remain open.',jsonb_build_object('count',critical_count)); else perform public.resolve_manager_runtime_incident_v1(p_account_id,'open-critical-errors'); end if;
  if indeterminate_count>0 then perform public.upsert_manager_runtime_incident_v1(p_account_id,'indeterminate-external-actions','critical','External action outcome is indeterminate',indeterminate_count||' external action(s) have an unknown provider outcome and must not be retried automatically.',jsonb_build_object('count',indeterminate_count)); else perform public.resolve_manager_runtime_incident_v1(p_account_id,'indeterminate-external-actions'); end if;
  return jsonb_build_object('diagnostics',d,'openIncidents',(select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'key',i.incident_key,'severity',i.severity,'title',i.title,'detail',i.detail,'status',i.status,'firstSeenAt',i.first_seen_at,'lastSeenAt',i.last_seen_at,'metadata',i.metadata) order by i.severity desc,i.last_seen_at desc),'[]'::jsonb) from public.manager_runtime_incidents i where i.account_id=p_account_id and i.resolved_at is null));
end$$;
revoke all on function public.evaluate_manager_runtime_health_v1(uuid) from public,anon,authenticated;
grant execute on function public.evaluate_manager_runtime_health_v1(uuid) to service_role;

create or replace function public.evaluate_all_manager_runtime_health_v1()
returns integer language plpgsql security definer set search_path=public as $$
declare r record;n integer:=0;
begin
  for r in select id from public.accounts where status='active' loop perform public.evaluate_manager_runtime_health_v1(r.id);n:=n+1;end loop;return n;
end$$;
revoke all on function public.evaluate_all_manager_runtime_health_v1() from public,anon,authenticated;
grant execute on function public.evaluate_all_manager_runtime_health_v1() to service_role;

do $$begin
  if exists(select 1 from pg_extension where extname='pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname='manager-runtime-health-evaluator';
    perform cron.schedule('manager-runtime-health-evaluator','*/5 * * * *','select public.evaluate_all_manager_runtime_health_v1();');
  end if;
end$$;
