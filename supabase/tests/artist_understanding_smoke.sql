\set ON_ERROR_STOP on
begin;

do $$
declare
  v_upsert regprocedure := to_regprocedure('public.upsert_artist_understanding_v1(uuid,uuid,uuid,public.artist_understanding_scope,uuid,text,text,text,jsonb,public.artist_understanding_source_kind,text,uuid,text,public.evidence_confidence,public.artist_understanding_authority,uuid,public.created_by_type)');
  v_snapshot jsonb;
begin
  if to_regclass('public.artist_understandings') is null then
    raise exception 'canonical understanding table is missing';
  end if;
  if v_upsert is null then
    raise exception 'understanding upsert is missing';
  end if;
  if not has_table_privilege('authenticated','public.artist_understandings','SELECT') then
    raise exception 'authenticated members cannot read understanding through RLS';
  end if;
  if has_table_privilege('authenticated','public.artist_understandings','INSERT') then
    raise exception 'authenticated clients can forge understanding rows';
  end if;
  if has_table_privilege('authenticated','public.artist_understandings','UPDATE') then
    raise exception 'authenticated clients can forge understanding authority';
  end if;
  if has_function_privilege('authenticated',v_upsert,'EXECUTE') then
    raise exception 'authenticated clients can call trusted understanding upsert';
  end if;
  if not has_function_privilege('service_role',v_upsert,'EXECUTE') then
    raise exception 'service role does not own trusted understanding mutation';
  end if;

  insert into accounts(id,name) values('10000000-0000-0000-0000-000000000001','Gate5');
  insert into artists(id,account_id,display_name) values('10000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Otmos');
  insert into artist_workspaces(id,account_id,artist_id,name,status) values('10000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','Otmos','active');
  insert into music_items(id,account_id,artist_workspace_id,artist_id,title) values('10000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002','Odaeshi');

  perform upsert_artist_understanding_v1('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002','music_item','10000000-0000-0000-0000-000000000004','song.meaning','meaning','resilience','{}','manager_inference',null,null,null,'medium','inferred',null,'manager');
  perform upsert_artist_understanding_v1('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002','music_item','10000000-0000-0000-0000-000000000004','song.meaning','meaning','surviving difficult things and remaining standing','{}','artist_statement',null,null,null,'high','artist_confirmed',null,'user');

  if (select count(*) from artist_understandings where understanding_key='song.meaning' and status='current') <> 1 then
    raise exception 'expected exactly one current song meaning';
  end if;
  if (select statement from artist_understandings where understanding_key='song.meaning' and status='current') <> 'surviving difficult things and remaining standing' then
    raise exception 'artist-confirmed truth did not win';
  end if;
  if (select count(*) from artist_understandings where understanding_key='song.meaning' and status='superseded') <> 1 then
    raise exception 'old understanding was not superseded exactly once';
  end if;

  perform upsert_artist_understanding_v1('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002','music_item','10000000-0000-0000-0000-000000000004','song.meaning','meaning','generic toughness','{}','manager_inference',null,null,null,'medium','inferred',null,'manager');
  if (select statement from artist_understandings where understanding_key='song.meaning' and status='current') <> 'surviving difficult things and remaining standing' then
    raise exception 'weaker later inference overrode artist truth';
  end if;

  v_snapshot := manager_artist_understanding_snapshot_v1('10000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002');
  if jsonb_array_length(v_snapshot) <> 1 then
    raise exception 'snapshot does not expose exactly current understanding';
  end if;
  if not coalesce((select superseded_by_understanding_id is not null from artist_understandings where status='superseded' limit 1),false) then
    raise exception 'supersession chain is not durable';
  end if;
end;
$$;

rollback;
