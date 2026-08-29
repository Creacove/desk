-- Gate 5 source capture: reuse existing document and operating-fact infrastructure.
-- Source material is captured without pretending source text is semantic inference.

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

-- World-model answers are artist-grounded operating facts. Artist-scoped facts become
-- artist understanding; mission/task-scoped facts remain in the world model until a
-- semantic layer can attach them to a music/project scope without guessing.
create or replace function public.capture_artist_understanding_from_operating_fact_v1()
returns trigger language plpgsql security definer set search_path=public as $$ begin
  if new.source_type not in ('user_answer','user_statement') or new.status <> 'active' or new.scope_type <> 'artist' then return new; end if;
  perform upsert_artist_understanding_v1(new.account_id,new.artist_workspace_id,new.artist_id,'artist',null,'fact.'||new.fact_key,new.domain,new.display_value,new.value_json,'artist_statement','operating_fact',new.id,new.fact_key,new.confidence,'artist_confirmed',null,'user');
  return new;
end; $$;
create trigger artist_operating_facts_capture_understanding after insert or update on public.artist_operating_facts for each row execute function public.capture_artist_understanding_from_operating_fact_v1();
