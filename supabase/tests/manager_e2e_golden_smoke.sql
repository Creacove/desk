\set ON_ERROR_STOP on

-- Gate 7 golden: one artist/song/Mission crosses understanding, one necessary
-- human-only fact, exact work, a real result, bounded review, automatic next work,
-- proactive outside-world evidence, explicit permission, provider outcome, and
-- another Manager wake-up. The artist never has to ask "what next?".
begin;

do $$
declare
  v_account uuid:=gen_random_uuid(); v_user uuid:=gen_random_uuid();
  v_artist uuid:=gen_random_uuid(); v_workspace uuid:=gen_random_uuid();
  v_song uuid:=gen_random_uuid(); v_conversation uuid:=gen_random_uuid();
  v_mission uuid:=gen_random_uuid(); v_plan uuid:=gen_random_uuid(); v_checkpoint uuid:=gen_random_uuid();
  v_question_run uuid:=gen_random_uuid(); v_question_review uuid:=gen_random_uuid();
  v_task_one uuid:=gen_random_uuid(); v_task_two uuid:=gen_random_uuid();
  v_result_run uuid:=gen_random_uuid(); v_result uuid:=gen_random_uuid(); v_result_review uuid;
  v_watch_run uuid:=gen_random_uuid(); v_watch_evidence uuid:=gen_random_uuid(); v_watch_review uuid;
  v_split uuid:=gen_random_uuid(); v_action_run uuid:=gen_random_uuid(); v_intent uuid:=gen_random_uuid();
  v_permission uuid; v_action uuid; v_receipt uuid; v_resolution jsonb; v_completion jsonb;
  v_question jsonb; v_context_request text; v_knowledge jsonb; v_next record;
begin
  insert into public.accounts(id,name,status) values(v_account,'Gate 7 Golden','active');
  insert into public.users(id,email,display_name,status) values(v_user,'gate7-golden@example.com','Golden Owner','active');
  insert into public.account_memberships(account_id,user_id,role,status) values(v_account,v_user,'owner','active');
  insert into public.artists(id,account_id,display_name) values(v_artist,v_account,'Otmos');
  insert into public.artist_workspaces(id,account_id,artist_id,name,status) values(v_workspace,v_account,v_artist,'Otmos','active');
  insert into public.artist_profiles(account_id,artist_workspace_id,artist_id,display_name,genres,home_market,current_goal,artist_direction,budget_context)
  values(v_account,v_workspace,v_artist,'Otmos',array['Afrobeats'],'Nigeria','Move Odaeshi forward','Strength and unity','₦0 content budget');
  insert into public.music_items(id,account_id,artist_workspace_id,artist_id,title,item_type,lifecycle_stage,status,is_active_focus)
  values(v_song,v_account,v_workspace,v_artist,'Odaeshi','song','ready','active',true);

  perform public.upsert_artist_understanding_v1(v_account,v_workspace,v_artist,'music_item',v_song,'music.meaning','song_meaning','surviving difficult things that should have broken us and remaining standing','{}','artist_statement','conversation_message',null,'golden:odaeshi','high','artist_confirmed',null,'user');
  perform public.upsert_artist_understanding_v1(v_account,v_workspace,v_artist,'artist',null,'artist.identity','artist_identity','strength and unity are central to the artist world','{}','artist_statement','conversation_message',null,'golden:identity','high','artist_confirmed',null,'user');

  -- Two resource facts are already known. People availability is the one missing
  -- fact that actually changes the physical execution route.
  insert into public.artist_operating_facts(account_id,artist_workspace_id,artist_id,domain,fact_key,scope_type,scope_key,value_json,display_value,source_type,confidence)
  values
    (v_account,v_workspace,v_artist,'places','places.parked_car_access','artist','artist','{"available":true}','parked car is available','user_statement','high'),
    (v_account,v_workspace,v_artist,'money','money.content_budget','artist','artist','{"amount":0,"currency":"NGN"}','₦0 available for this content','user_statement','high');

  insert into public.conversations(id,account_id,artist_workspace_id,artist_id,topic,status)
  values(v_conversation,v_account,v_workspace,v_artist,'Odaeshi release','active');
  insert into public.missions(id,account_id,artist_workspace_id,artist_id,title,objective,reason,status,priority,current_recommendation,originating_conversation_id)
  values(v_mission,v_account,v_workspace,v_artist,'Make Odaeshi land','Find and execute the strongest Odaeshi release moves.','Artist wants to release Odaeshi.','active',1,'Use the song world to choose the next real test.',v_conversation);
  update public.conversations set linked_mission_id=v_mission where id=v_conversation;
  insert into public.mission_plan_versions(id,account_id,artist_workspace_id,artist_id,mission_id,version,status,summary)
  values(v_plan,v_account,v_workspace,v_artist,v_mission,1,'active','Use artist understanding and current resources to test the Odaeshi story.');
  update public.missions set active_plan_version_id=v_plan where id=v_mission;
  insert into public.checkpoints(id,account_id,artist_workspace_id,artist_id,mission_id,mission_plan_version_id,title,status,question,decision_rule)
  values(v_checkpoint,v_account,v_workspace,v_artist,v_mission,v_plan,'Test the resilience framing','waiting','Does the Odaeshi resilience framing earn a response?','Review the real post result before choosing the next route.');

  insert into public.manager_synthesis_runs(id,account_id,artist_workspace_id,artist_id,trigger_type,conversation_id,mission_id,status,classification,confidence,context_payload,steps_payload,action_plan,limitations,started_at)
  values(v_question_run,v_account,v_workspace,v_artist,'review',v_conversation,v_mission,'running','adaptive_plan_compiler_v1','medium',jsonb_build_object('musicSubject',jsonb_build_object('type','music_item','id',v_song)),'[]','[]','{}',now());
  insert into public.reviews(id,account_id,artist_workspace_id,artist_id,mission_id,checkpoint_id,trigger_type,trigger_object_type,trigger_object_id,current_read,what_changed,next_action,status,review_at,created_from_run_id,runtime_claimed_at)
  values(v_question_review,v_account,v_workspace,v_artist,v_mission,v_checkpoint,'adaptive_replan','mission',v_mission,'Odaeshi needs an executable content test.','Meaning is known but people availability is not.','Ask only for the missing execution resource.','running',now(),v_question_run,now());

  v_question:=public.persist_manager_question_request_v1(v_question_review,v_question_run,jsonb_build_object(
    'key','friends_for_content','question','Who can realistically be in this Odaeshi video with you?',
    'reason','Desk already knows the parked car and zero budget; people availability changes the concept.',
    'answerKind','short_text','options',jsonb_build_array(),
    'hypothesis','A small real-friends setup will make the resilience idea feel credible.',
    'fallbackIfNo','Use Otmos alone in the parked car and preserve the same resilience prompt.',
    'factDomain','people','factKey','people.friends_available_for_content','factScopeType','artist','factScopeKey','artist','validForHours',168
  ));
  v_context_request:=v_question->>'contextRequestId';
  if v_context_request is null or (select status from public.reviews where id=v_question_review)<>'snoozed' then
    raise exception 'Manager did not durably wait for the one necessary human-only fact.';
  end if;

  insert into public.conversation_messages(account_id,artist_workspace_id,artist_id,conversation_id,speaker,body,metadata)
  values(v_account,v_workspace,v_artist,v_conversation,'artist','Two friends can do it with me.',jsonb_build_object('contextRequestId',v_context_request,'contextAnswers',jsonb_build_array(jsonb_build_object('questionKey','friends_for_content','answer','two friends are available'))));
  if not exists(select 1 from public.artist_operating_facts where artist_workspace_id=v_workspace and fact_key='people.friends_available_for_content' and source_type='user_answer' and status='active' and display_value='two friends are available') then
    raise exception 'Artist answer did not become canonical operating reality.';
  end if;
  if (select status from public.reviews where id=v_question_review)<>'due' then raise exception 'The same adaptive review did not resume after the answer.'; end if;
  if not exists(select 1 from public.claim_manager_runtime_review_v2(v_question_review)) then raise exception 'Resumed question review is not claimable by the Manager runtime.'; end if;

  v_knowledge:=public.manager_knowledge_context_v1(v_account,v_workspace,v_artist,'music_item',v_song);
  if v_knowledge::text not like '%remaining standing%'
     or v_knowledge::text not like '%two friends are available%'
     or v_knowledge::text not like '%parked car is available%'
     or v_knowledge::text not like '%₦0 available%' then
    raise exception 'One Manager knowledge contract did not combine meaning and operating reality: %',v_knowledge;
  end if;

  -- Exact human work created from the combined meaning + resources. Only the
  -- content test is immediately open; rights/admin is the next proposed work.
  insert into public.tasks(id,account_id,artist_workspace_id,artist_id,scope,mission_id,mission_plan_version_id,primary_checkpoint_id,title,owner_role,work_mode,priority,status,approval_state,purpose,completion_expectation,manager_responsibility,user_responsibility,risk_if_late,estimated_minutes,created_from_run_id)
  values
    (v_task_one,v_account,v_workspace,v_artist,'mission',v_mission,v_plan,v_checkpoint,'Shoot “What couldn’t finish us?”','Artist / team','artist_action',2,'open','not_required','Test Odaeshi as a shared language for resilience with the people, place and budget already confirmed.','One vertical video is live on TikTok or Reels and the public post link or live confirmation is returned to Desk.','Desk chose the angle from Odaeshi meaning and current resources, prepared the route, and will review the result.','Otmos and the two friends record and post the physical/social content.','The current learning window for the resilience framing is lost.',40,v_question_run),
    (v_task_two,v_account,v_workspace,v_artist,'mission',v_mission,v_plan,v_checkpoint,'Confirm the Odaeshi collaborator split','Artist / team','artist_action',1,'proposed','not_required','Clear the exact collaborator shares so Desk can prepare confirmations if the Manager decides outreach is the next move.','The split totals 100% and collaborator emails are correct.','Desk validates the split, prepares any external action, and asks permission before sending.','Confirm the shares and collaborator emails.','Rights/admin uncertainty can block release execution.',15,v_question_run);
  insert into public.task_steps(account_id,artist_workspace_id,artist_id,task_id,order_index,body) values
    (v_account,v_workspace,v_artist,v_task_one,0,'Park the available car somewhere quiet, mount the phone vertically, and frame Otmos with the two available friends.'),
    (v_account,v_workspace,v_artist,v_task_one,1,'Ask each friend for one thing they thought they would not come back from; keep each answer to one natural sentence.'),
    (v_account,v_workspace,v_artist,v_task_one,2,'Otmos closes by saying “That’s Odaeshi,” then bring the Odaeshi song in immediately after the line.'),
    (v_account,v_workspace,v_artist,v_task_one,3,'Edit with simple hard cuts, post to TikTok or Reels with a prompt asking what people survived; if the parked car is unavailable, use a quiet room with all three people instead.'),
    (v_account,v_workspace,v_artist,v_task_two,0,'Read the current collaborator names, roles, shares and emails together.'),
    (v_account,v_workspace,v_artist,v_task_two,1,'Correct any wrong share or email and confirm the final split totals 100%.');

  -- The question-resumed Manager run installed a real route. `replanned` is the
  -- production outcome emitted when the adaptive compiler changes/installs work.
  update public.reviews set outcome='replanned',status='completed' where id=v_question_review;
  if not exists(select 1 from public.operating_events where source_id=v_question_review and event_type='manager_continuation_ready' and task_id=v_task_one) then
    raise exception 'Initial Manager direction did not surface the first exact Task automatically.';
  end if;

  -- Start, physically execute, and complete the post. Because this Task explicitly
  -- ends in a public post, production correctly uses a bounded response window
  -- rather than pretending a URL gives immediate platform performance data.
  update public.tasks set status='in_progress' where id=v_task_one;
  insert into public.manager_synthesis_runs(id,account_id,artist_workspace_id,artist_id,trigger_type,mission_id,status,classification,confidence,context_payload,steps_payload,action_plan,limitations,started_at,completed_at)
  values(v_result_run,v_account,v_workspace,v_artist,'task_result',v_mission,'completed','manager_task_result_review_v1','medium','{}','[]','[]','{}',now(),now());
  update public.tasks set status='completed' where id=v_task_one;
  insert into public.task_results(id,account_id,artist_workspace_id,artist_id,task_id,mission_id,checkpoint_id,status,user_note,raw_event,summary,manager_interpretation,mission_effect,checkpoint_effect,recommended_follow_up,confidence,created_from_run_id)
  values(v_result,v_account,v_workspace,v_artist,v_task_one,v_mission,v_checkpoint,'completed','Posted. People are replying with stories of things they survived.',jsonb_build_object('source','gate7-golden'),'The resilience prompt is producing the intended kind of response.','The Odaeshi strength/unity framing is credible enough to continue while rights/admin is cleared.','Keep the route and release the next existing work.','Content checkpoint has useful qualitative evidence.','Move to the next already-planned human task; do not recreate the completed post.','medium',v_result_run);

  if not exists(select 1 from public.task_results where id=v_result and raw_event->>'result_kind'='content_post_result') then raise exception 'Content result was not classified by the production result boundary.'; end if;
  if exists(select 1 from public.reviews where artist_workspace_id=v_workspace and runtime_key='task-result:'||v_result::text) then raise exception 'Content result incorrectly created a duplicate immediate adaptive review.'; end if;
  select id into v_result_review from public.reviews where artist_workspace_id=v_workspace and runtime_key='content-response:'||v_result::text;
  if v_result_review is null or not exists(select 1 from public.reviews where id=v_result_review and status='scheduled' and review_at>now()) then
    raise exception 'Content post did not schedule its bounded Manager response review.';
  end if;

  -- Fast-forward only the clock boundary. Then the exact production adaptive
  -- claimant owns the review; the artist-reported response is already in recent
  -- Task results and the Manager can make the next-route decision without a new prompt.
  update public.reviews set status='due',review_at=now()-interval '1 second' where id=v_result_review;
  if not exists(select 1 from public.claim_manager_runtime_review_v2(v_result_review)) then raise exception 'Content response review is not claimable by the adaptive runtime.'; end if;
  update public.reviews set outcome='no_change',status='completed' where id=v_result_review;
  select * into v_next from public.manager_next_executable_task_v1(v_mission,v_plan,v_task_one);
  if v_next.task_id is distinct from v_task_two then raise exception 'Manager continuation did not resolve the next exact Task.'; end if;
  if not exists(select 1 from public.operating_events where source_id=v_result_review and event_type='manager_continuation_ready' and task_id=v_task_two and payload->>'continuationKind'='next_task') then
    raise exception 'Today/Missions did not receive the next Task after response review.';
  end if;

  -- Gate 6 joins the same Manager loop: public-web provenance stays public-web,
  -- while Career Watch is the evidence pipeline that decides whether to act.
  insert into public.manager_synthesis_runs(id,account_id,artist_workspace_id,artist_id,trigger_type,mission_id,status,classification,confidence,context_payload,steps_payload,action_plan,limitations,started_at,completed_at)
  values(v_watch_run,v_account,v_workspace,v_artist,'evidence_triggered',v_mission,'completed','manager_career_watch_v1','medium','{}','[]','[]','{}',now(),now());
  insert into public.evidence_items(id,account_id,artist_workspace_id,artist_id,source,source_kind,evidence_type,subject_type,subject_label,confidence,provenance,limitation,raw_ref,created_from_run_id,metadata)
  values(v_watch_evidence,v_account,v_workspace,v_artist,'public_web','public_web','manager_career_watch','artist','Relevant Odaeshi press opening','high','example.com','Acceptance is not guaranteed.','https://example.com/open-call',v_watch_run,jsonb_build_object('pipeline','manager_career_watch','claim','A relevant press submission window is open.','why_it_matters','The resilience story fits the current Odaeshi release route.','fit_reason','Artist-confirmed meaning gives a specific press angle.','recommended_decision','act','urgency','now','mission_objective','Find and execute the strongest Odaeshi release moves.','next_move','Evaluate and prepare a focused press submission if it improves the active route.'));
  v_watch_review:=public.queue_manager_career_watch_review_v1(v_watch_evidence,v_watch_run);
  if v_watch_review is null or not exists(select 1 from public.reviews where id=v_watch_review and trigger_type='adaptive_replan' and status='due' and runtime_key='career-watch:'||v_watch_evidence::text) then
    raise exception 'Actionable Career Watch evidence did not enter the adaptive Manager runtime.';
  end if;
  if not exists(select 1 from public.claim_manager_runtime_review_v2(v_watch_review)) then raise exception 'Adaptive runtime could not claim Career Watch review.'; end if;
  update public.reviews set outcome='no_change',status='completed' where id=v_watch_review;

  -- External action remains impossible from readiness alone. Canonical split state
  -- becomes executable only after an explicit Manager preparation intent and an
  -- exact artist approval.
  update public.tasks set status='completed' where id=v_task_two;
  insert into public.music_splits(id,account_id,artist_workspace_id,artist_id,music_item_id,status,linked_task_id,summary)
  values(v_split,v_account,v_workspace,v_artist,v_song,'draft',v_task_two,'Odaeshi final collaborator split');
  insert into public.music_split_contributors(account_id,artist_workspace_id,artist_id,music_split_id,name,role,email,publishing_share,master_share,approval_status) values
    (v_account,v_workspace,v_artist,v_split,'Otmos','Primary artist','otmos@example.com',50,50,'draft'),
    (v_account,v_workspace,v_artist,v_split,'Producer','Producer','producer@example.com',50,50,'draft');
  if exists(select 1 from public.permission_requests where parameters->>'splitId'=v_split::text) then raise exception 'Readiness bypassed explicit Manager action intent.'; end if;

  insert into public.manager_synthesis_runs(id,account_id,artist_workspace_id,artist_id,trigger_type,conversation_id,mission_id,status,classification,confidence,context_payload,steps_payload,action_plan,limitations,started_at)
  values(v_action_run,v_account,v_workspace,v_artist,'conversation',v_conversation,v_mission,'running','manager_conversation_router_v1','high',jsonb_build_object('scope',jsonb_build_object('accountId',v_account,'artistWorkspaceId',v_workspace,'artistId',v_artist,'conversationId',v_conversation,'musicSubject',jsonb_build_object('type','music_item','id',v_song))),'[]','[]','{}',now());
  insert into public.manager_run_actions(id,account_id,artist_workspace_id,artist_id,manager_synthesis_run_id,order_index,action_type,target_type,status,approval_required,payload,result_payload)
  values(v_intent,v_account,v_workspace,v_artist,v_action_run,0,'prepare_split_confirmations_for_approval','focused_music_item','pending',false,jsonb_build_object('actionType','prepare_split_confirmations_for_approval','targetType','focused_music_item','title','Prepare Odaeshi split confirmations','body','Prepare the final Odaeshi split for collaborator confirmation.','approvalRequired',false),'{}');
  if not exists(select 1 from public.manager_run_actions where id=v_intent and status='applied' and target_id=v_song and result_payload->>'status'='prepared') then raise exception 'Explicit Manager intent did not resolve the canonical song safely.'; end if;

  select id,created_from_action_id into v_permission,v_action
  from public.permission_requests
  where mission_id=v_mission and status='pending' and parameters->>'actionKind'='send_split_confirmations' and parameters->>'splitId'=v_split::text
  order by created_at desc limit 1;
  if v_permission is null or v_action is null then raise exception 'Explicit Manager intent did not create the exact approval transaction.'; end if;

  v_resolution:=public.resolve_manager_permission_v1(v_permission,v_user,'approve',null);
  if coalesce((v_resolution->>'shouldExecute')::boolean,false) is not true then raise exception 'Artist approval did not claim the frozen effect: %',v_resolution; end if;
  v_receipt:=nullif(v_resolution->>'executionReceiptId','')::uuid;
  if v_receipt is null then raise exception 'Approved effect did not produce an execution receipt.'; end if;

  -- CI does not call Resend. It crosses the same durable provider-outcome boundary
  -- with a deterministic provider receipt; the production sender is separately Deno-checked.
  v_completion:=public.complete_manager_action_execution_v1(v_receipt,jsonb_build_object('provider','resend','sent',2,'failed',0,'messageIds',jsonb_build_array('gate7-1','gate7-2')));
  if v_completion->>'status'<>'succeeded' then raise exception 'Provider outcome did not become canonical action state.'; end if;
  if not exists(select 1 from public.operating_events where event_type='manager_external_action_executed' and manager_run_action_id=v_action) then raise exception 'Canonical external-action outcome event is missing.'; end if;
  if not exists(select 1 from public.reviews where mission_id=v_mission and trigger_type='adaptive_replan' and trigger_object_type='manager_run_action' and trigger_object_id=v_action and status='due' and runtime_key='permission:'||v_permission::text||':execution-succeeded') then
    raise exception 'Provider outcome did not automatically wake Manager continuation.';
  end if;
end;
$$;

-- Exercise the deferred generated-Human-Task contract after every Task step exists.
set constraints all immediate;
rollback;
