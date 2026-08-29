-- Gate 5: canonical Artist Understanding foundation.
-- Meaning is durable product truth with explicit source authority and supersession.

create type public.artist_understanding_scope as enum ('artist', 'music_item', 'music_project');
create type public.artist_understanding_source_kind as enum ('artist_statement', 'lyrics_document', 'uploaded_document', 'imported_provider', 'public_research', 'operating_fact', 'world_model_fact', 'manager_inference', 'manager_memory', 'other_trusted');
create type public.artist_understanding_authority as enum ('inferred', 'supported', 'trusted_source', 'artist_confirmed');
create type public.artist_understanding_status as enum ('current', 'superseded', 'rejected');

create table public.artist_understandings (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  scope_type public.artist_understanding_scope not null,
  scope_id uuid,
  understanding_key text not null,
  category text not null,
  statement text not null,
  structured_value jsonb not null default '{}'::jsonb,
  source_kind public.artist_understanding_source_kind not null,
  source_type text,
  source_id uuid,
  source_ref text,
  confidence public.evidence_confidence not null default 'unknown',
  authority public.artist_understanding_authority not null default 'inferred',
  status public.artist_understanding_status not null default 'current',
  supersedes_understanding_id uuid references public.artist_understandings(id) on delete set null,
  superseded_by_understanding_id uuid references public.artist_understandings(id) on delete set null,
  created_from_run_id uuid,
  created_by_type public.created_by_type not null default 'manager',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((scope_type = 'artist' and scope_id is null) or (scope_type <> 'artist' and scope_id is not null)),
  check (length(trim(understanding_key)) > 0),
  check (length(trim(statement)) > 0)
);

create unique index artist_understandings_current_key_idx
  on public.artist_understandings (artist_workspace_id, scope_type, coalesce(scope_id, '00000000-0000-0000-0000-000000000000'::uuid), understanding_key)
  where status = 'current';
create index artist_understandings_manager_context_idx
  on public.artist_understandings (artist_workspace_id, artist_id, status, authority, updated_at desc);

alter table public.artist_understandings enable row level security;
create policy artist_understandings_member_select on public.artist_understandings for select using (public.is_account_member(account_id));
create policy artist_understandings_member_insert on public.artist_understandings for insert with check (public.is_account_member(account_id));
create policy artist_understandings_member_update on public.artist_understandings for update using (public.is_account_member(account_id)) with check (public.is_account_member(account_id));

grant select, insert, update on public.artist_understandings to authenticated, service_role;

create trigger artist_understandings_set_updated_at before update on public.artist_understandings
for each row execute function public.set_updated_at();

create or replace function public.upsert_artist_understanding_v1(
  p_account_id uuid,
  p_artist_workspace_id uuid,
  p_artist_id uuid,
  p_scope_type public.artist_understanding_scope,
  p_scope_id uuid,
  p_understanding_key text,
  p_category text,
  p_statement text,
  p_structured_value jsonb,
  p_source_kind public.artist_understanding_source_kind,
  p_source_type text default null,
  p_source_id uuid default null,
  p_source_ref text default null,
  p_confidence public.evidence_confidence default 'unknown',
  p_authority public.artist_understanding_authority default 'inferred',
  p_created_from_run_id uuid default null,
  p_created_by_type public.created_by_type default 'manager'
) returns public.artist_understandings
language plpgsql security definer set search_path = public as $$
declare
  existing public.artist_understandings;
  inserted public.artist_understandings;
  incoming_rank int;
  existing_rank int;
begin
  if not exists (select 1 from artist_workspaces w where w.id=p_artist_workspace_id and w.account_id=p_account_id and w.artist_id=p_artist_id) then
    raise exception 'Artist understanding workspace scope is invalid.';
  end if;
  if p_scope_type='music_item' and not exists (select 1 from music_items m where m.id=p_scope_id and m.account_id=p_account_id and m.artist_workspace_id=p_artist_workspace_id and m.artist_id=p_artist_id) then raise exception 'Artist understanding music item scope is invalid.'; end if;
  if p_scope_type='music_project' and not exists (select 1 from music_projects m where m.id=p_scope_id and m.account_id=p_account_id and m.artist_workspace_id=p_artist_workspace_id and m.artist_id=p_artist_id) then raise exception 'Artist understanding music project scope is invalid.'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_artist_workspace_id::text||':'||p_scope_type::text||':'||coalesce(p_scope_id::text,'artist')||':'||p_understanding_key, 0));
  select * into existing from artist_understandings u where u.artist_workspace_id=p_artist_workspace_id and u.scope_type=p_scope_type and u.scope_id is not distinct from p_scope_id and u.understanding_key=p_understanding_key and u.status='current' for update;
  incoming_rank := case p_authority when 'artist_confirmed' then 4 when 'trusted_source' then 3 when 'supported' then 2 else 1 end;
  existing_rank := case existing.authority when 'artist_confirmed' then 4 when 'trusted_source' then 3 when 'supported' then 2 else 1 end;
  if existing.id is not null and incoming_rank < existing_rank then return existing; end if;
  if existing.id is not null and existing.statement=p_statement and existing.authority=p_authority and existing.confidence=p_confidence then return existing; end if;

  if existing.id is not null then update artist_understandings set status='superseded' where id=existing.id; end if;
  insert into artist_understandings(account_id,artist_workspace_id,artist_id,scope_type,scope_id,understanding_key,category,statement,structured_value,source_kind,source_type,source_id,source_ref,confidence,authority,supersedes_understanding_id,created_from_run_id,created_by_type)
  values(p_account_id,p_artist_workspace_id,p_artist_id,p_scope_type,p_scope_id,trim(p_understanding_key),trim(p_category),trim(p_statement),coalesce(p_structured_value,'{}'::jsonb),p_source_kind,p_source_type,p_source_id,p_source_ref,p_confidence,p_authority,existing.id,p_created_from_run_id,p_created_by_type)
  returning * into inserted;
  if existing.id is not null then update artist_understandings set superseded_by_understanding_id=inserted.id where id=existing.id; end if;
  return inserted;
end; $$;

grant execute on function public.upsert_artist_understanding_v1(uuid,uuid,uuid,public.artist_understanding_scope,uuid,text,text,text,jsonb,public.artist_understanding_source_kind,text,uuid,text,public.evidence_confidence,public.artist_understanding_authority,uuid,public.created_by_type) to authenticated, service_role;

create or replace function public.manager_artist_understanding_snapshot_v1(p_artist_workspace_id uuid, p_artist_id uuid)
returns jsonb language sql stable security definer set search_path=public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',u.id,'scopeType',u.scope_type,'scopeId',u.scope_id,'key',u.understanding_key,'category',u.category,'statement',u.statement,'value',u.structured_value,'sourceKind',u.source_kind,'sourceType',u.source_type,'sourceId',u.source_id,'sourceRef',u.source_ref,'confidence',u.confidence,'authority',u.authority,'updatedAt',u.updated_at) order by case u.authority when 'artist_confirmed' then 4 when 'trusted_source' then 3 when 'supported' then 2 else 1 end desc,u.updated_at desc),'[]'::jsonb)
  from artist_understandings u where u.artist_workspace_id=p_artist_workspace_id and u.artist_id=p_artist_id and u.status='current';
$$;
grant execute on function public.manager_artist_understanding_snapshot_v1(uuid,uuid) to authenticated, service_role;
