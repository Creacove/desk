\set ON_ERROR_STOP on
begin;

do $$
declare
  v_context jsonb;
  v_memory text;
  v_claimed_count integer;
  v_queue_id uuid;
  v_old_lease uuid;
  v_new_lease uuid;
  v_finalized boolean;
begin
  if to_regclass('public.artist_understanding_ingestion_queue') is null then
    raise exception 'semantic ingestion queue is missing';
  end if;
  if to_regprocedure('public.manager_knowledge_context_v1(uuid,uuid,uuid,text,uuid)') is null then
    raise exception 'one Manager knowledge assembler is missing';
  end if;
  if to_regprocedure('public.sync_manager_knowledge_projection_v1(uuid,uuid,uuid)') is null then
    raise exception 'Manager knowledge projection sync is missing';
  end if;
  if to_regprocedure('public.claim_artist_understanding_ingestion_v1(integer)') is null then
    raise exception 'durable semantic ingestion claim is missing';
  end if;

  insert into accounts(id,name) values('20000000-0000-0000-0000-000000000001','Gate5 runtime');
  insert into artists(id,account_id,display_name) values('20000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001','Otmos Runtime');
  insert into artist_workspaces(id,account_id,artist_id,name,status) values('20000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','Otmos Runtime','active');
  insert into artist_profiles(account_id,artist_workspace_id,artist_id,display_name) values('20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000002','Otmos Runtime');
  insert into music_items(id,account_id,artist_workspace_id,artist_id,title) values
  ('20000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000002','Odaeshi'),
  ('20000000-0000-0000-0000-000000000005','20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000002','Other Song');

  perform upsert_artist_understanding_v1(
    '20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000002',
    'music_item','20000000-0000-0000-0000-000000000004','music.meaning','song_meaning',
    'surviving difficult things and remaining standing','{}','artist_statement','conversation_message',null,'artist:odaeshi','high','artist_confirmed',null,'user'
  );

  insert into artist_operating_facts(
    account_id,artist_workspace_id,artist_id,domain,fact_key,scope_type,scope_key,value_json,display_value,source_type,confidence
  ) values (
    '20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000002',
    'people','people.friends_available_for_content','artist','artist','{"count":2}'::jsonb,'two friends available for content','user_answer','high'
  );

  if (select count(*) from memory_entries where artist_workspace_id='20000000-0000-0000-0000-000000000003' and source_type='manager_knowledge_v1') <> 1 then
    raise exception 'expected one current Manager knowledge memory projection';
  end if;
  select content into v_memory from memory_entries where artist_workspace_id='20000000-0000-0000-0000-000000000003' and source_type='manager_knowledge_v1';
  if v_memory not like '%surviving difficult things%' or v_memory not like '%two friends%' then
    raise exception 'Manager knowledge projection did not combine semantic and operating truth';
  end if;

  v_context := manager_knowledge_context_v1(
    '20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000002','music_item','20000000-0000-0000-0000-000000000004'
  );
  if jsonb_array_length(v_context->'semanticUnderstanding') <> 1 then
    raise exception 'focused song knowledge does not contain exactly the relevant song understanding';
  end if;

  perform upsert_artist_understanding_v1(
    '20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000002',
    'music_item','20000000-0000-0000-0000-000000000005','music.meaning','song_meaning',
    'a completely different song world','{}','artist_statement','conversation_message',null,'artist:other','high','artist_confirmed',null,'user'
  );
  v_context := manager_knowledge_context_v1(
    '20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000002','music_item','20000000-0000-0000-0000-000000000004'
  );
  if jsonb_array_length(v_context->'semanticUnderstanding') <> 1 then
    raise exception 'focused Manager knowledge leaked unrelated song understanding';
  end if;

  insert into manager_intelligence_packets(account_id,artist_workspace_id,artist_id,packet_type)
  values('20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000002','manual_refresh');
  if not coalesce((select profile_projection_json ? 'managerKnowledge' from manager_intelligence_packets where artist_workspace_id='20000000-0000-0000-0000-000000000003' order by created_at desc limit 1),false) then
    raise exception 'new Manager Intelligence packet is missing canonical managerKnowledge';
  end if;

  insert into conversations(id,account_id,artist_workspace_id,artist_id,topic)
  values('20000000-0000-0000-0000-000000000006','20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000002','Gate 5 source');
  insert into conversation_messages(id,account_id,artist_workspace_id,artist_id,conversation_id,speaker,body)
  values('20000000-0000-0000-0000-000000000007','20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000006','artist','This song is about the things that should have broken us but did not.');
  if (select count(*) from artist_understanding_ingestion_queue where source_kind='conversation_message' and source_id='20000000-0000-0000-0000-000000000007') <> 1 then
    raise exception 'artist conversation statement did not enter semantic ingestion';
  end if;

  insert into documents(id,account_id,artist_workspace_id,artist_id,title,document_type,origin,status)
  values('20000000-0000-0000-0000-000000000008','20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000002','Odaeshi lyrics','lyrics','user_uploaded','accepted');
  insert into document_versions(id,account_id,artist_workspace_id,artist_id,document_id,version_number,extraction_status,metadata)
  values('20000000-0000-0000-0000-000000000009','20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000008',1,'completed','{"body":"lyrics source text"}'::jsonb);
  update documents set current_version_id='20000000-0000-0000-0000-000000000009' where id='20000000-0000-0000-0000-000000000008';
  insert into artifact_links(account_id,artist_workspace_id,artist_id,source_type,source_id,target_type,target_id,relationship)
  values('20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000002','document','20000000-0000-0000-0000-000000000008','music_item','20000000-0000-0000-0000-000000000004','references');
  if (select count(*) from artist_understanding_ingestion_queue where source_kind='document' and source_id='20000000-0000-0000-0000-000000000008' and source_version_id='20000000-0000-0000-0000-000000000009') <> 1 then
    raise exception 'song document did not enter semantic ingestion';
  end if;

  -- Hosted smoke tests share the queue with real work. Make only these
  -- transaction-scoped fixtures oldest so the global claim contract selects
  -- them deterministically; rollback restores every timestamp.
  update artist_understanding_ingestion_queue
  set created_at='2000-01-02 00:00:00+00'::timestamptz
  where artist_workspace_id='20000000-0000-0000-0000-000000000003';
  update artist_understanding_ingestion_queue
  set created_at='2000-01-01 00:00:00+00'::timestamptz
  where source_kind='conversation_message'
    and source_id='20000000-0000-0000-0000-000000000007';

  if not exists(select 1 from cron.job where jobname='artist-understanding-ingestion') then
    raise exception 'semantic ingestion worker is not scheduled';
  end if;
  select count(*) into v_claimed_count from claim_artist_understanding_ingestion_v1(6);
  if v_claimed_count <= 0 then
    raise exception 'queued semantic sources could not be claimed safely';
  end if;

  select id,lease_token into v_queue_id,v_old_lease
  from artist_understanding_ingestion_queue
  where source_kind='conversation_message' and source_id='20000000-0000-0000-0000-000000000007';
  if v_old_lease is null then
    raise exception 'target semantic ingestion fixture was not included in the initial claim';
  end if;
  -- Isolate the reclaim candidate. claim(1) is intentionally global/oldest-first,
  -- so another fixture row must not be allowed to consume the one-row batch.
  update artist_understanding_ingestion_queue
  set status='completed',completed_at=now(),locked_at=null,lease_token=null
  where artist_workspace_id='20000000-0000-0000-0000-000000000003'
    and id<>v_queue_id;
  update artist_understanding_ingestion_queue set locked_at=now()-interval '6 minutes' where id=v_queue_id;
  select lease_token into v_new_lease from claim_artist_understanding_ingestion_v1(1) where id=v_queue_id;
  if v_new_lease is null or v_new_lease=v_old_lease then
    raise exception 'expired semantic ingestion did not receive a new ownership token';
  end if;

  v_finalized:=finalize_artist_understanding_ingestion_v1(
    v_queue_id,v_old_lease,
    '[{"scopeType":"artist","scopeId":"","key":"artist.identity.stale","category":"artist_identity","statement":"stale worker must not persist","confidence":"high","directlyAsserted":true}]'::jsonb,
    'Artist conversation statement','artist_statement','conversation_message:20000000-0000-0000-0000-000000000007'
  );
  if v_finalized or exists(select 1 from artist_understandings where understanding_key='artist.identity.stale') then
    raise exception 'stale semantic worker persisted after lease reclaim';
  end if;

  v_finalized:=finalize_artist_understanding_ingestion_v1(
    v_queue_id,v_new_lease,
    '[{"scopeType":"artist","scopeId":"","key":"artist.identity.current","category":"artist_identity","statement":"The artist explicitly centers resilience.","confidence":"high","directlyAsserted":true}]'::jsonb,
    'Artist conversation statement','artist_statement','conversation_message:20000000-0000-0000-0000-000000000007'
  );
  if not v_finalized or not exists(select 1 from artist_understandings where understanding_key='artist.identity.current' and authority='artist_confirmed') then
    raise exception 'current semantic worker could not atomically finalize its claim';
  end if;

  update manager_runtime_limits set background_ai_enabled=false
  where artist_workspace_id='20000000-0000-0000-0000-000000000003';
  insert into conversation_messages(id,account_id,artist_workspace_id,artist_id,conversation_id,speaker,body)
  values('20000000-0000-0000-0000-00000000000a','20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000003','20000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000006','artist','This statement must wait while background AI is disabled.');
  perform claim_artist_understanding_ingestion_v1(6);
  if not exists(
    select 1 from artist_understanding_ingestion_queue
    where source_kind='conversation_message'
      and source_id='20000000-0000-0000-0000-00000000000a'
      and status='queued'
      and lease_token is null
  ) then
    raise exception 'semantic ingestion ignored the background AI kill switch';
  end if;
end;
$$;

rollback;
