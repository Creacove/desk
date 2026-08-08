-- A conversation-created song must be a complete Song Workspace, never a
-- bare music row. This additive command adopts the current Manager conversation
-- and delegates to the existing manual command when no conversation is supplied.

create or replace function public.create_conversational_song_workspace_v2(
  p_account_id uuid,
  p_artist_workspace_id uuid,
  p_artist_id uuid,
  p_request_id uuid,
  p_title text,
  p_item_type public.music_item_type,
  p_lifecycle_stage public.music_lifecycle_stage,
  p_mission_title text,
  p_mission_objective text,
  p_mission_summary text,
  p_checkpoint_title text,
  p_checkpoint_question text,
  p_checkpoint_decision_rule text,
  p_first_task_title text,
  p_first_task_purpose text,
  p_opening_message text,
  p_conversation_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_song_id uuid;
  v_mission_id uuid;
  v_plan_id uuid;
  v_checkpoint_id uuid;
  v_task_id uuid;
  v_conversation_id uuid;
  v_existing_target_type text;
  v_existing_target_id uuid;
  v_song_title text;
  v_song_lifecycle_stage public.music_lifecycle_stage;
begin
  if p_conversation_id is null then
    return public.create_manual_song_workspace_v1(
      p_account_id,
      p_artist_workspace_id,
      p_artist_id,
      p_request_id,
      p_title,
      p_item_type,
      p_lifecycle_stage,
      p_mission_title,
      p_mission_objective,
      p_mission_summary,
      p_checkpoint_title,
      p_checkpoint_question,
      p_checkpoint_decision_rule,
      p_first_task_title,
      p_first_task_purpose,
      p_opening_message
    );
  end if;

  if nullif(trim(p_title), '') is null then
    raise exception 'Song title is required.';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_artist_workspace_id::text || ':' || p_conversation_id::text));

  if not exists (
    select 1
    from public.artist_workspaces
    where id = p_artist_workspace_id
      and account_id = p_account_id
      and artist_id = p_artist_id
  ) then
    raise exception 'Artist workspace does not match the requested account and artist.';
  end if;

  select id into v_conversation_id
  from public.conversations
  where id = p_conversation_id
    and account_id = p_account_id
    and artist_workspace_id = p_artist_workspace_id
    and artist_id = p_artist_id
  for update;

  if v_conversation_id is null then
    raise exception 'Manager conversation was not found.';
  end if;

  select link.target_type, link.target_id
  into v_existing_target_type, v_existing_target_id
  from public.artifact_links as link
  where link.account_id = p_account_id
    and link.artist_workspace_id = p_artist_workspace_id
    and link.artist_id = p_artist_id
    and link.source_type = 'conversation'
    and link.source_id = v_conversation_id
    and link.target_type in ('music_item', 'music_project')
    and link.relationship = 'references'
  order by link.created_at asc, link.target_id asc
  limit 1;

  if v_existing_target_id is not null and v_existing_target_type <> 'music_item' then
    raise exception 'Conversation is already linked to another Music subject.';
  end if;

  v_song_id := v_existing_target_id;

  if v_song_id is null then
    insert into public.music_items (
      account_id,
      artist_workspace_id,
      artist_id,
      title,
      item_type,
      lifecycle_stage,
      source_kind,
      source_limit,
      metadata,
      created_by_type,
      created_from_run_id
    ) values (
      p_account_id,
      p_artist_workspace_id,
      p_artist_id,
      trim(p_title),
      p_item_type,
      p_lifecycle_stage,
      'manual',
      'Manager-created release workspace. Confirm files, credits, identifiers, rights, and release details before operational use.',
      jsonb_build_object(
        '_conversational_workspace_conversation_id', v_conversation_id::text,
        '_conversational_workspace_request_id', p_request_id::text
      ),
      'manager',
      p_request_id
    ) returning id into v_song_id;

    insert into public.artifact_links (
      account_id,
      artist_workspace_id,
      artist_id,
      source_type,
      source_id,
      target_type,
      target_id,
      relationship,
      created_from_run_id
    ) values (
      p_account_id,
      p_artist_workspace_id,
      p_artist_id,
      'conversation',
      v_conversation_id,
      'music_item',
      v_song_id,
      'references',
      p_request_id
    );
  end if;

  select title, lifecycle_stage
  into v_song_title, v_song_lifecycle_stage
  from public.music_items
  where id = v_song_id
    and account_id = p_account_id
    and artist_workspace_id = p_artist_workspace_id
    and artist_id = p_artist_id;

  if v_song_title is null then
    raise exception 'Manager conversation song was not found.';
  end if;

  select link.source_id into v_mission_id
  from public.artifact_links as link
  join public.missions as mission on mission.id = link.source_id
  where link.account_id = p_account_id
    and link.artist_workspace_id = p_artist_workspace_id
    and link.artist_id = p_artist_id
    and link.source_type = 'mission'
    and link.target_type = 'music_item'
    and link.target_id = v_song_id
    and link.relationship = 'references'
    and mission.status not in ('archived', 'cancelled')
  order by link.created_at asc, link.source_id asc
  limit 1;

  if v_mission_id is null then
    insert into public.missions (
      account_id,
      artist_workspace_id,
      artist_id,
      title,
      objective,
      reason,
      status,
      priority,
      progress,
      summary,
      pattern_name,
      originating_trigger,
      originating_conversation_id,
      current_recommendation,
      change_conditions,
      review_point,
      required_evidence,
      missing_evidence
    ) values (
      p_account_id,
      p_artist_workspace_id,
      p_artist_id,
      trim(p_mission_title),
      trim(p_mission_objective),
      'A Manager-created song needs one dedicated operational home before its package and release work can be trusted.',
      'active',
      1,
      0,
      trim(p_mission_summary),
      'manual_song_workspace',
      'manager_conversation_song_created',
      v_conversation_id,
      trim(p_first_task_title),
      array['Update this mission only from the linked song workspace.'],
      trim(p_checkpoint_title),
      array['Current working audio or a verified package state.'],
      array['The current song package has not yet been verified.']
    ) returning id into v_mission_id;

    insert into public.mission_plan_versions (
      account_id,
      artist_workspace_id,
      artist_id,
      mission_id,
      version,
      status,
      summary
    ) values (
      p_account_id,
      p_artist_workspace_id,
      p_artist_id,
      v_mission_id,
      1,
      'active',
      trim(p_mission_summary)
    ) returning id into v_plan_id;

    insert into public.checkpoints (
      account_id,
      artist_workspace_id,
      artist_id,
      mission_id,
      mission_plan_version_id,
      title,
      status,
      question,
      reason_for_checkpoint,
      decision_rule,
      recommendation,
      next_action,
      required_evidence,
      missing_evidence,
      custom_reason
    ) values (
      p_account_id,
      p_artist_workspace_id,
      p_artist_id,
      v_mission_id,
      v_plan_id,
      trim(p_checkpoint_title),
      'waiting',
      trim(p_checkpoint_question),
      'The Manager needs verified song state before it adds release work or external commitments.',
      trim(p_checkpoint_decision_rule),
      trim(p_opening_message),
      trim(p_first_task_title),
      array['Current working audio or a verified package state.'],
      array['Current song package evidence.'],
      'Seeded during conversational song workspace creation.'
    ) returning id into v_checkpoint_id;

    insert into public.mission_plan_checkpoints (
      account_id,
      artist_workspace_id,
      artist_id,
      mission_plan_version_id,
      mission_id,
      checkpoint_id,
      order_index,
      phase_label,
      unlock_rule
    ) values (
      p_account_id,
      p_artist_workspace_id,
      p_artist_id,
      v_plan_id,
      v_mission_id,
      v_checkpoint_id,
      1,
      trim(p_checkpoint_title),
      trim(p_checkpoint_decision_rule)
    );

    insert into public.tasks (
      account_id,
      artist_workspace_id,
      artist_id,
      scope,
      mission_id,
      mission_plan_version_id,
      primary_checkpoint_id,
      title,
      owner_role,
      work_mode,
      priority,
      status,
      approval_state,
      purpose,
      evidence_needed,
      completion_expectation,
      completion_mode,
      deliverable_requirements,
      manager_responsibility,
      user_responsibility,
      risk_if_late
    ) values (
      p_account_id,
      p_artist_workspace_id,
      p_artist_id,
      'mission',
      v_mission_id,
      v_plan_id,
      v_checkpoint_id,
      trim(p_first_task_title),
      'Artist / team',
      'artist_action',
      1,
      'open',
      'not_required',
      trim(p_first_task_purpose),
      array['Current audio file or package confirmation.'],
      'The Song Room shows the current package state and the artist reports what was added or confirmed.',
      'result_note',
      '[]'::jsonb,
      'Read the updated Song Room and select the next useful question or task.',
      'Add or verify the package item in the existing Song Room.',
      'Without a real song package, later release planning can be misleading.'
    ) returning id into v_task_id;

    insert into public.task_steps (
      account_id,
      artist_workspace_id,
      artist_id,
      task_id,
      order_index,
      body
    ) values (
      p_account_id,
      p_artist_workspace_id,
      p_artist_id,
      v_task_id,
      1,
      'Open Files and add the current working audio, or confirm the package state there.'
    );

    update public.missions
    set active_plan_version_id = v_plan_id
    where id = v_mission_id;

    insert into public.artifact_links (
      account_id,
      artist_workspace_id,
      artist_id,
      source_type,
      source_id,
      target_type,
      target_id,
      relationship,
      created_from_run_id
    ) values (
      p_account_id,
      p_artist_workspace_id,
      p_artist_id,
      'mission',
      v_mission_id,
      'music_item',
      v_song_id,
      'references',
      p_request_id
    );
  end if;

  select id into v_task_id
  from public.tasks
  where mission_id = v_mission_id
    and account_id = p_account_id
    and artist_workspace_id = p_artist_workspace_id
    and artist_id = p_artist_id
    and status not in ('archived', 'rejected', 'superseded')
  order by created_at asc, id asc
  limit 1;

  if v_task_id is null then
    raise exception 'Release workspace mission has no initial task.';
  end if;

  update public.conversations
  set topic = v_song_title || ' — release planning',
      linked_mission_id = v_mission_id,
      updated_at = now()
  where id = v_conversation_id;

  insert into public.operating_events (
    account_id,
    artist_workspace_id,
    artist_id,
    event_type,
    actor_type,
    target_type,
    target_id,
    source_type,
    source_id,
    mission_id,
    dedupe_key,
    display_mode,
    refresh_scope,
    summary,
    payload
  ) values (
    p_account_id,
    p_artist_workspace_id,
    p_artist_id,
    'music_item_created',
    'manager',
    'music_item',
    v_song_id,
    'manager_conversation',
    v_conversation_id,
    v_mission_id,
    'conversational-song-workspace:' || v_conversation_id::text,
    'activity',
    array['music', 'missions', 'conversations'],
    'Created song ' || v_song_title || ' and its release workspace from Manager chat.',
    jsonb_build_object(
      'music_item_id', v_song_id,
      'mission_id', v_mission_id,
      'conversation_id', v_conversation_id,
      'request_id', p_request_id
    )
  ) on conflict (artist_workspace_id, dedupe_key) where dedupe_key is not null do nothing;

  return jsonb_build_object(
    'songId', v_song_id,
    'missionId', v_mission_id,
    'taskId', v_task_id,
    'conversationId', v_conversation_id,
    'songTitle', v_song_title,
    'lifecycleStage', v_song_lifecycle_stage
  );
end;
$$;

revoke all on function public.create_conversational_song_workspace_v2(
  uuid, uuid, uuid, uuid, text, public.music_item_type, public.music_lifecycle_stage,
  text, text, text, text, text, text, text, text, text, uuid
) from public;

grant execute on function public.create_conversational_song_workspace_v2(
  uuid, uuid, uuid, uuid, text, public.music_item_type, public.music_lifecycle_stage,
  text, text, text, text, text, text, text, text, text, uuid
) to service_role;
