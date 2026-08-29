\set ON_ERROR_STOP on

-- Validate the generated human Task boundary without depending on fixture artists.
-- The pure assertion function is the same function called by the deferred Task
-- trigger after generated Plan Tasks and task_steps have landed atomically.

do $$
declare
  valid_content jsonb := jsonb_build_object(
    'title', 'Record “What couldn''t finish us?”',
    'purpose', 'Test Odaeshi as a shared language for resilience with a simple, relatable short-form video.',
    'completionExpectation', 'One vertical video is recorded and posted to TikTok or Reels; return the public post link or confirm it is live.',
    'managerResponsibility', 'Desk defines the concept, hook, shot sequence, song cue, caption direction and what response to watch next.',
    'userResponsibility', 'Otmos records the piece in a parked car with two friends and posts it from the normal social app.',
    'riskIfLate', 'The Mission loses the current content-learning window and Desk cannot evaluate whether the resilience framing is landing.'
  );
  generic_content jsonb := jsonb_build_object(
    'title', 'Create Odaeshi content',
    'purpose', 'Promote Odaeshi on social media.',
    'completionExpectation', 'Content is created.',
    'managerResponsibility', 'Desk will review results.',
    'userResponsibility', 'Create and post content.',
    'riskIfLate', 'Momentum may slow.'
  );
  non_content jsonb := jsonb_build_object(
    'title', 'Confirm collaborator split',
    'purpose', 'Resolve the remaining split confirmation before delivery.',
    'completionExpectation', 'The collaborator confirms the agreed percentage in writing.',
    'managerResponsibility', 'Desk keeps the split record and updates the release route after confirmation.',
    'userResponsibility', 'Send the prepared split summary to the collaborator and record the answer.',
    'riskIfLate', 'Distribution delivery remains blocked.'
  );
  manager_task jsonb := jsonb_build_object(
    'scope', 'mission',
    'missionPlanVersionId', gen_random_uuid(),
    'createdFromRunId', gen_random_uuid(),
    'ownerRole', 'Manager',
    'workMode', 'manager_work'
  );
  manual_task jsonb := jsonb_build_object(
    'scope', 'mission',
    'missionPlanVersionId', gen_random_uuid(),
    'ownerRole', 'Artist',
    'workMode', 'artist_action'
  );
begin
  if to_regprocedure('public.generated_human_task_requires_execution_contract_v1(jsonb)') is null then
    raise exception 'generated human Task applicability function is missing';
  end if;
  if to_regprocedure('public.assert_generated_human_task_execution_contract_v1(jsonb,text[])') is null then
    raise exception 'generated human Task assertion function is missing';
  end if;
  if to_regprocedure('public.enforce_generated_human_task_execution_contract_v1()') is null then
    raise exception 'generated human Task trigger function is missing';
  end if;
  if not exists (
    select 1 from pg_trigger
    where tgname = 'generated_human_task_execution_contract'
      and not tgisinternal
  ) then
    raise exception 'generated human Task deferred trigger is missing';
  end if;

  if public.generated_human_task_requires_execution_contract_v1(manager_task) then
    raise exception 'Manager machine work must not be governed as human execution work';
  end if;
  if public.generated_human_task_requires_execution_contract_v1(manual_task) then
    raise exception 'manual/non-generated Tasks must not be governed by the generated Plan contract';
  end if;
  if not public.generated_human_task_requires_execution_contract_v1(
    jsonb_build_object(
      'scope', 'mission',
      'missionPlanVersionId', gen_random_uuid(),
      'createdFromRunId', gen_random_uuid(),
      'ownerRole', 'Artist',
      'workMode', 'artist_action'
    )
  ) then
    raise exception 'generated human Mission work should be governed by the execution contract';
  end if;

  perform public.assert_generated_human_task_execution_contract_v1(
    non_content,
    array[
      'Send the prepared split summary and ask the collaborator to confirm the percentage in writing.',
      'Record the confirmed answer in the split workspace so Desk can continue the release route.'
    ]
  );

  perform public.assert_generated_human_task_execution_contract_v1(
    valid_content,
    array[
      'Setup: park the car somewhere quiet, place the phone vertically on the dashboard, and frame Otmos with the two friends visible.',
      'Opening hook: Otmos asks, “What is one thing you thought would finish you, but didn''t?” Keep the first answers conversational, not scripted.',
      'Film each friend answering in one short line; Otmos closes with “That''s Odaeshi.” Bring the Odaeshi song in immediately after that line.',
      'Edit with simple hard cuts, add a short caption asking people to share what they survived, and post to TikTok or Reels. If the car is unavailable, use a quiet room with the three people seated close together.'
    ]
  );

  begin
    perform public.assert_generated_human_task_execution_contract_v1(
      generic_content,
      array['Make a video about the song.', 'Post it on social media.']
    );
    raise exception 'expected generic content Task rejection did not happen';
  exception
    when sqlstate '22023' then
      if position('content_requires_at_least_four_execution_steps' in sqlerrm) = 0 then
        raise;
      end if;
  end;

  begin
    perform public.assert_generated_human_task_execution_contract_v1(
      valid_content,
      array[
        'Setup: sit in a parked car and place the phone vertically on the dashboard.',
        'Opening hook: ask the first friend what they survived.',
        'Film the answers and close with “That''s Odaeshi.”',
        'Upload the full video file to Desk so Manager can watch it before you post; if the car is unavailable, use a quiet room instead.'
      ]
    );
    raise exception 'expected raw campaign-video upload rejection did not happen';
  exception
    when sqlstate '22023' then
      if position('raw_campaign_video_upload_to_desk_forbidden' in sqlerrm) = 0 then
        raise;
      end if;
  end;

  begin
    perform public.assert_generated_human_task_execution_contract_v1(
      valid_content,
      array[
        'Setup: borrow a friend''s car and put the phone vertically on the dashboard.',
        'Opening hook: ask “What couldn''t finish you?”',
        'Film the answers and close with “That''s Odaeshi.”',
        'Edit with hard cuts and post to TikTok with a comment CTA.'
      ]
    );
    raise exception 'expected resource-dependent content fallback rejection did not happen';
  exception
    when sqlstate '22023' then
      if position('resource_dependent_content_requires_fallback' in sqlerrm) = 0 then
        raise;
      end if;
  end;
end;
$$;
