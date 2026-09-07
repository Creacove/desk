\set ON_ERROR_STOP on

do $$
declare
  target_id uuid := gen_random_uuid();
  review_without_target jsonb := jsonb_build_object(
    'taskIntent', 'review_approval',
    'readiness', 'ready',
    'approvalState', 'needs_approval',
    'completionMode', 'approval'
  );
  review_with_target jsonb := jsonb_build_object(
    'taskIntent', 'review_approval',
    'readiness', 'ready',
    'approvalState', 'needs_approval',
    'completionMode', 'approval',
    'reviewTargetId', target_id,
    'reviewTargetType', 'manager_output',
    'reviewTargetVersionId', target_id,
    'reviewTargetStatus', 'ready_for_review'
  );
  draft_task jsonb := jsonb_build_object(
    'taskIntent', 'collaborative_draft',
    'readiness', 'preparing',
    'approvalState', 'not_required',
    'completionMode', 'manager_draft',
    'workMode', 'collaborative'
  );
  human_task jsonb := jsonb_build_object(
    'taskIntent', 'human_action',
    'readiness', 'ready',
    'approvalState', 'not_required',
    'completionMode', 'result_note',
    'workMode', 'artist_action'
  );
begin
  if to_regprocedure('public.assert_mission_task_contract_v1(jsonb)') is null then
    raise exception 'mission task contract assertion function is missing';
  end if;

  begin
    perform public.assert_mission_task_contract_v1(review_without_target);
    raise exception 'review task without a target was accepted';
  exception
    when sqlstate '22023' then
      if position('review_target_required' in sqlerrm) = 0 then raise; end if;
  end;

  perform public.assert_mission_task_contract_v1(review_with_target);
  perform public.assert_mission_task_contract_v1(draft_task);
  perform public.assert_mission_task_contract_v1(human_task);

  begin
    perform public.assert_mission_task_contract_v1(
      human_task || jsonb_build_object('completionMode', 'approval')
    );
    raise exception 'human action with approval completion was accepted';
  exception
    when sqlstate '22023' then
      if position('approval_requires_review_intent' in sqlerrm) = 0 then raise; end if;
  end;

  begin
    perform public.assert_mission_task_contract_v1(
      jsonb_build_object(
        'taskIntent', 'collaborative_draft',
        'workMode', 'artist_action',
        'completionMode', 'result_note'
      )
    );
    raise exception 'invalid collaborative draft was accepted';
  exception
    when sqlstate '22023' then
      if position('collaborative_draft_requires' in sqlerrm) = 0 then raise; end if;
  end;

  begin
    perform public.assert_mission_task_contract_v1(
      review_with_target || jsonb_build_object('reviewTargetStatus', 'draft')
    );
    raise exception 'draft review target was accepted as ready';
  exception
    when sqlstate '22023' then
      if position('review_target_must_be_ready' in sqlerrm) = 0 then raise; end if;
  end;

  perform public.assert_mission_task_contract_v1(
    review_with_target || jsonb_build_object(
      'approvalState', 'approved',
      'status', 'approved',
      'readiness', 'completed',
      'reviewTargetStatus', 'accepted'
    )
  );
end;
$$;
