begin;
select plan(15);

select has_table('public','artist_understandings','canonical understanding table exists');
select has_function('public','upsert_artist_understanding_v1',array['uuid','uuid','uuid','artist_understanding_scope','uuid','text','text','text','jsonb','artist_understanding_source_kind','text','uuid','text','evidence_confidence','artist_understanding_authority','uuid','created_by_type'],'understanding upsert exists');
select ok(has_table_privilege('authenticated','public.artist_understandings','SELECT'),'authenticated members may read understanding through RLS');
select ok(not has_table_privilege('authenticated','public.artist_understandings','INSERT'),'authenticated clients cannot forge understanding rows');
select ok(not has_table_privilege('authenticated','public.artist_understandings','UPDATE'),'authenticated clients cannot forge understanding authority');
select ok(not has_function_privilege('authenticated',to_regprocedure('public.upsert_artist_understanding_v1(uuid,uuid,uuid,public.artist_understanding_scope,uuid,text,text,text,jsonb,public.artist_understanding_source_kind,text,uuid,text,public.evidence_confidence,public.artist_understanding_authority,uuid,public.created_by_type)'),'EXECUTE'),'authenticated clients cannot call trusted understanding upsert');
select ok(has_function_privilege('service_role',to_regprocedure('public.upsert_artist_understanding_v1(uuid,uuid,uuid,public.artist_understanding_scope,uuid,text,text,text,jsonb,public.artist_understanding_source_kind,text,uuid,text,public.evidence_confidence,public.artist_understanding_authority,uuid,public.created_by_type)'),'EXECUTE'),'service role owns trusted understanding mutation');

insert into accounts(id,name) values('10000000-0000-0000-0000-000000000001','Gate5');
insert into artists(id,account_id,display_name) values('10000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Otmos');
insert into artist_workspaces(id,account_id,artist_id,name,status) values('10000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','Otmos','active');
insert into music_items(id,account_id,artist_workspace_id,artist_id,title) values('10000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002','Odaeshi');

select lives_ok($$select upsert_artist_understanding_v1('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002','music_item','10000000-0000-0000-0000-000000000004','song.meaning','meaning','resilience','{}','manager_inference',null,null,null,'medium','inferred',null,'manager')$$,'inference persists');
select lives_ok($$select upsert_artist_understanding_v1('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002','music_item','10000000-0000-0000-0000-000000000004','song.meaning','meaning','surviving difficult things and remaining standing','{}','artist_statement',null,null,null,'high','artist_confirmed',null,'user')$$,'artist correction supersedes inference');
select is((select count(*)::int from artist_understandings where understanding_key='song.meaning' and status='current'),1,'one current truth');
select is((select statement from artist_understandings where understanding_key='song.meaning' and status='current'),'surviving difficult things and remaining standing','artist truth wins');
select is((select count(*)::int from artist_understandings where understanding_key='song.meaning' and status='superseded'),1,'old truth superseded');
select lives_ok($$select upsert_artist_understanding_v1('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002','music_item','10000000-0000-0000-0000-000000000004','song.meaning','meaning','generic toughness','{}','manager_inference',null,null,null,'medium','inferred',null,'manager')$$,'weaker later inference is safely ignored');
select is((select statement from artist_understandings where understanding_key='song.meaning' and status='current'),'surviving difficult things and remaining standing','weaker inference cannot override artist truth');
select is(jsonb_array_length(manager_artist_understanding_snapshot_v1('10000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000002')),1,'snapshot exposes only current understanding');
select is((select superseded_by_understanding_id is not null from artist_understandings where status='superseded' limit 1),true,'supersession chain is durable');
select * from finish();
rollback;
