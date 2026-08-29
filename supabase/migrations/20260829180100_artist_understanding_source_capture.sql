-- Gate 5 source capture: reuse existing document and operating-fact infrastructure.
-- This deliberately captures source material as source-grounded understanding; semantic
-- synthesis may later supersede it but must never silently outrank artist-confirmed truth.

create or replace function public.capture_artist_understanding_from_document_v1(p_document_id uuid)
returns integer language plpgsql security definer set search_path=public as $$
declare d record; v record; link record; body text; captured int:=0; key text; source_kind artist_understanding_source_kind;
begin
  select * into d from documents where id=p_document_id;
  if d.id is null or d.status in ('archived','deleted') then return 0; end if;
  select * into v from document_versions where id=d.current_version_id;
  body := nullif(trim(coalesce(v.metadata->>'body','')), '');
  if body is null then return 0; end if;
  source_kind := case when d.document_type='lyrics' then 'lyrics_document'::artist_understanding_source_kind else 'uploaded_document'::artist_understanding_source_kind end;
  for link in select * from artifact_links where source_type='document' and source_id=d.id and target_type in ('music_item','music_project') and relationship='references' loop
    key := 'source.document.'||d.document_type||'.'||d.id::text;
    perform upsert_artist_understanding_v1(d.account_id,d.artist_workspace_id,d.artist_id,link.target_type::artist_understanding_scope,link.target_id,key,'source_material',left(body,12000),jsonb_build_object('documentType',d.document_type,'title',d.title,'versionId',v.id),source_kind,'document',d.id,d.title,'high','trusted_source',v.created_from_run_id,'system');
    captured:=captured+1;
  end loop;
  return captured;
end; $$;
grant execute on function public.capture_artist_understanding_from_document_v1(uuid) to authenticated, service_role;

create or replace function public.capture_artist_understanding_document_trigger_v1()
returns trigger language plpgsql security definer set search_path=public as $$ begin
  if new.current_version_id is distinct from old.current_version_id and new.current_version_id is not null then perform capture_artist_understanding_from_document_v1(new.id); end if;
  return new;
end; $$;
create trigger documents_capture_artist_understanding after update of current_version_id on public.documents for each row execute function public.capture_artist_understanding_document_trigger_v1();

-- Context-question answers are artist statements. Capture only answered facts with an
-- explicit fact key/scope, avoiding generic chat becoming authority by accident.
create or replace function public.capture_artist_understanding_from_operating_fact_v1()
returns trigger language plpgsql security definer set search_path=public as $$
declare scope artist_understanding_scope; sid uuid; begin
  if new.source_type not in ('manager_context_answer','artist_answer','user_supplied') then return new; end if;
  if new.fact_key is null or trim(new.fact_key)='' then return new; end if;
  if new.scope_type='music_item' then scope:='music_item'; sid:=nullif(new.scope_key,'')::uuid;
  elsif new.scope_type='music_project' then scope:='music_project'; sid:=nullif(new.scope_key,'')::uuid;
  else scope:='artist'; sid:=null; end if;
  perform upsert_artist_understanding_v1(new.account_id,new.artist_workspace_id,new.artist_id,scope,sid,'fact.'||new.fact_key,new.domain,coalesce(new.display_value,new.value::text),coalesce(new.value,'{}'::jsonb),'artist_statement','operating_fact',new.id,new.fact_key,new.confidence,'artist_confirmed',new.created_from_run_id,'user');
  return new;
exception when invalid_text_representation then return new;
end; $$;

do $$ begin
  if to_regclass('public.manager_operating_facts') is not null then
    execute 'create trigger manager_operating_facts_capture_understanding after insert or update on public.manager_operating_facts for each row execute function public.capture_artist_understanding_from_operating_fact_v1()';
  end if;
end $$;
