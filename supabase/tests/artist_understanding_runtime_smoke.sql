begin;
select plan(14);

select has_table('public','artist_understanding_ingestion_queue','semantic ingestion queue exists');
select has_function('public','manager_knowledge_context_v1',array['uuid','uuid','uuid','text','uuid'],'one Manager knowledge assembler exists');
select has_function('public','sync_manager_knowledge_projection_v1',array['uuid','uuid','uuid'],'Manager knowledge projection sync exists');
select has_function('public','claim_artist_understanding_ingestion_v1',array['integer'],'durable semantic ingestion claim exists');

insert into accounts(id,name) values('20000000-0000-0000-0000-000000000001','Gate5 runtime');
insert into artists(id,account_id,display_name) values('20000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','Otmos Runtime');
insert into artist_workspaces(id,account_id,artist_id,name,status) values('20000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','Otmos Runtime','active');
insert into artist_profiles(account_id,artist_workspace_id,artist_id,display_name) values('20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000002','Otmos Runtime');
insert into music_items(id,account_id,artist_workspace_id,artist_id,title) values
('20000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000002','Odaeshi'),
('20000000-0000-0000-0000-000000000005','20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000002','Other Song');

select lives_ok($$select upsert_artist_understanding_v1(
'20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000002',
'music_item','20000000-0000-0000-0000-000000000004','music.meaning','song_meaning',
'surviving difficult things and remaining standing','{}','artist_statement','conversation_message',null,'artist:odaeshi','high','artist_confirmed',null,'user')$$,
'artist-confirmed song meaning persists and projects');

insert into artist_operating_facts(
  account_id,artist_workspace_id,artist_id,domain,fact_key,scope_type,scope_key,value_json,display_value,source_type,confidence
) values (
  '20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000002',
  'people','people.friends_available_for_content','artist','artist','{"count":2}'::jsonb,'two friends available for content','user_answer','high'
);

select is((select count(*)::int from memory_entries where artist_workspace_id='20000000-0000-0000-0000-000000000003' and source_type='manager_knowledge_v1'),1,'one current Manager knowledge memory projection exists');
select ok((select content like '%surviving difficult things%' and content like '%two friends%' from memory_entries where artist_workspace_id='20000000-0000-0000-0000-000000000003' and source_type='manager_knowledge_v1'),'Mission/review/replan memory projection carries semantic and operating truth together');

select is(jsonb_array_length(manager_knowledge_context_v1(
  '20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000002','music_item','20000000-0000-0000-0000-000000000004'
)->'semanticUnderstanding'),1,'focused song knowledge contains the relevant song understanding');

select lives_ok($$select upsert_artist_understanding_v1(
'20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000002',
'music_item','20000000-0000-0000-0000-000000000005','music.meaning','song_meaning',
'a completely different song world','{}','artist_statement','conversation_message',null,'artist:other','high','artist_confirmed',null,'user')$$,
'unrelated song understanding persists separately');
select is(jsonb_array_length(manager_knowledge_context_v1(
  '20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000002','music_item','20000000-0000-0000-0000-000000000004'
)->'semanticUnderstanding'),1,'focused Manager knowledge prevents cross-song semantic leakage');

insert into manager_intelligence_packets(account_id,artist_workspace_id,artist_id,packet_type)
values('20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000002','manual_refresh');
select ok((select profile_projection_json ? 'managerKnowledge' from manager_intelligence_packets where artist_workspace_id='20000000-0000-0000-0000-000000000003' order by created_at desc limit 1),'new Manager Intelligence packets carry canonical knowledge for Song Manager Read and downstream reasoning');

insert into conversations(id,account_id,artist_workspace_id,artist_id,topic)
values('20000000-0000-0000-0000-000000000006','20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000002','Gate 5 source');
insert into conversation_messages(id,account_id,artist_workspace_id,artist_id,conversation_id,speaker,body)
values('20000000-0000-0000-0000-000000000007','20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000006','artist','This song is about the things that should have broken us but did not.');
select is((select count(*)::int from artist_understanding_ingestion_queue where source_kind='conversation_message' and source_id='20000000-0000-0000-0000-000000000007'),1,'artist conversation statements automatically enter semantic ingestion');

insert into documents(id,account_id,artist_workspace_id,artist_id,title,document_type,origin,status)
values('20000000-0000-0000-0000-000000000008','20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000002','Odaeshi lyrics','lyrics','user_uploaded','accepted');
insert into document_versions(id,account_id,artist_workspace_id,artist_id,document_id,version_number,extraction_status,metadata)
values('20000000-0000-0000-0000-000000000009','20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000008',1,'completed','{"body":"lyrics source text"}'::jsonb);
update documents set current_version_id='20000000-0000-0000-0000-000000000009' where id='20000000-0000-0000-0000-000000000008';
insert into artifact_links(account_id,artist_workspace_id,artist_id,source_type,source_id,target_type,target_id,relationship)
values('20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000002','document','20000000-0000-0000-0000-000000000008','music_item','20000000-0000-0000-0000-000000000004','references');
select is((select count(*)::int from artist_understanding_ingestion_queue where source_kind='document' and source_id='20000000-0000-0000-0000-000000000008' and source_version_id='20000000-0000-0000-0000-000000000009'),1,'real existing song documents automatically enter semantic ingestion');

select ok((select count(*) > 0 from cron.job where jobname='artist-understanding-ingestion'),'semantic ingestion worker is scheduled durably');
select ok((select count(*) > 0 from claim_artist_understanding_ingestion_v1(6)),'queued semantic sources can be claimed safely for worker processing');

select * from finish();
rollback;
