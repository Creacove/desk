-- Gate 6: proactive Manager Career Watch.
-- Public-world findings remain evidence until the Manager decides they should change work.

create table if not exists public.manager_career_watch_state (
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  enabled boolean not null default true,
  cadence_hours integer not null default 24 check (cadence_hours between 6 and 168),
  last_started_at timestamptz,
  last_completed_at timestamptz,
  next_run_at timestamptz not null default now(),
  last_run_id uuid references public.manager_synthesis_runs(id) on delete set null,
  last_error text,
  updated_at timestamptz not null default now(),
  primary key (account_id,artist_workspace_id,artist_id)
);

alter table public.manager_career_watch_state enable row level security;
revoke all on public.manager_career_watch_state from public,anon,authenticated;
grant select on public.manager_career_watch_state to authenticated;
grant all on public.manager_career_watch_state to service_role;

create policy manager_career_watch_state_member_read on public.manager_career_watch_state
for select to authenticated using (public.is_account_member(account_id));

create or replace function public.set_manager_career_watch_updated_at_v1()
returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
drop trigger if exists set_manager_career_watch_updated_at on public.manager_career_watch_state;
create trigger set_manager_career_watch_updated_at before update on public.manager_career_watch_state for each row execute function public.set_manager_career_watch_updated_at_v1();

create or replace function public.queue_manager_career_watch_review_v1(
  p_evidence_id uuid,
  p_run_id uuid
) returns uuid
language plpgsql security definer set search_path=public as $$
declare
  e public.evidence_items%rowtype;
  m public.missions%rowtype;
  review_id uuid;
  objective text;
  next_move text;
begin
  select * into e from public.evidence_items where id=p_evidence_id;
  if e.id is null or e.source_kind <> 'career_watch' or coalesce(e.metadata->>'recommended_decision','') <> 'act' then
    return null;
  end if;
  objective := nullif(trim(e.metadata->>'mission_objective'),'');
  next_move := nullif(trim(e.metadata->>'next_move'),'');
  if objective is null then return null; end if;

  select * into m
  from public.missions
  where account_id=e.account_id and artist_workspace_id=e.artist_workspace_id and artist_id=e.artist_id
    and status not in ('complete','archived','cancelled')
    and lower(coalesce(objective,''))=lower(objective)
  order by updated_at desc limit 1;

  if m.id is null then
    insert into public.missions(account_id,artist_workspace_id,artist_id,title,objective,reason,status,progress,health,summary,current_recommendation,required_evidence,missing_evidence,created_from_run_id)
    values(e.account_id,e.artist_workspace_id,e.artist_id,left(coalesce(e.subject_label,'Career opportunity'),120),objective,coalesce(e.metadata->>'why_it_matters','Career Watch found a relevant external development.'),'active',0,'on_track',coalesce(e.metadata->>'claim',''),next_move,array['career_watch_evidence'],array[]::text[],p_run_id)
    returning * into m;
  end if;

  insert into public.reviews(account_id,artist_workspace_id,artist_id,mission_id,trigger_type,trigger_object_type,trigger_object_id,current_read,what_changed,next_action,status,created_from_run_id)
  values(e.account_id,e.artist_workspace_id,e.artist_id,m.id,'evidence','evidence_item',e.id,coalesce(e.metadata->>'claim',e.subject_label),coalesce(e.metadata->>'why_it_matters',e.metadata->>'fit_reason'),next_move,'queued',p_run_id)
  on conflict do nothing
  returning id into review_id;

  if review_id is null then
    select id into review_id from public.reviews
    where artist_workspace_id=e.artist_workspace_id and artist_id=e.artist_id and trigger_object_type='evidence_item' and trigger_object_id=e.id
    order by created_at desc limit 1;
  end if;
  return review_id;
end $$;
revoke all on function public.queue_manager_career_watch_review_v1(uuid,uuid) from public,anon,authenticated;
grant execute on function public.queue_manager_career_watch_review_v1(uuid,uuid) to service_role;

create or replace function public.claim_due_manager_career_watch_v1(batch_size integer default 8)
returns setof public.manager_career_watch_state
language plpgsql security definer set search_path=public as $$
begin
  return query
  with due as (
    select account_id,artist_workspace_id,artist_id
    from public.manager_career_watch_state
    where enabled and next_run_at<=now()
    order by next_run_at asc
    for update skip locked
    limit greatest(1,least(coalesce(batch_size,8),20))
  )
  update public.manager_career_watch_state s
  set last_started_at=now(), next_run_at=now()+make_interval(hours=>s.cadence_hours), last_error=null
  from due
  where s.account_id=due.account_id and s.artist_workspace_id=due.artist_workspace_id and s.artist_id=due.artist_id
  returning s.*;
end $$;
revoke all on function public.claim_due_manager_career_watch_v1(integer) from public,anon,authenticated;
grant execute on function public.claim_due_manager_career_watch_v1(integer) to service_role;

insert into public.manager_career_watch_state(account_id,artist_workspace_id,artist_id,next_run_at)
select account_id,id,artist_id,now() from public.artist_workspaces
on conflict do nothing;

create or replace function public.enable_manager_career_watch_for_workspace_v1()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.manager_career_watch_state(account_id,artist_workspace_id,artist_id,next_run_at)
  values(new.account_id,new.id,new.artist_id,now()) on conflict do nothing;
  return new;
end $$;
drop trigger if exists enable_manager_career_watch_for_workspace on public.artist_workspaces;
create trigger enable_manager_career_watch_for_workspace after insert on public.artist_workspaces for each row execute function public.enable_manager_career_watch_for_workspace_v1();
