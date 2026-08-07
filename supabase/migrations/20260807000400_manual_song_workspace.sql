-- A manual unreleased song becomes a complete workspace before the client can
-- navigate to it. This reuses the existing music, mission, conversation, task,
-- and artifact-link model; it does not create a parallel release-planning table.

create unique index if not exists music_items_manual_workspace_request_unique
  on public.music_items (artist_workspace_id, ((metadata ->> '_manual_workspace_request_id')))
  where source_kind = 'manual' and metadata ? '_manual_workspace_request_id';

create or replace function public.create_manual_song_workspace_v1(
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
  p_opening_message text
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
  v_conversation_id uuid;
  v_task_id uuid;
begin
  if nullif(trim(p_title), '') is null then
    raise exception 'Song title is required.';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_artist_workspace_id::text || ':' || p_request_id::text));

  if not exists (
    select 1
    from public.artist_workspaces
    where id = p_artist_workspace_id
      and account_id = p_account_id
      and artist_id = p_artist_id
  ) then
    raise exception 'Artist workspace does not match the requested account and artist.';
  end if;

  select id into v_song_id
  from public.music_items
  where account_id = p_account_id
    and artist_workspace_id = p_artist_workspace_id
    and artist_id = p_artist_id
    and source_kind = 'manual'
    and metadata ->> '_manual_workspace_request_id' = p_request_id::text
  limit 1;

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
      created_by_type
    ) values (
      p_account_id,
      p_artist_workspace_id,
      p_artist_id,
      trim(p_title),
      p_item_type,
      p_lifecycle_stage,
      'manual',
      'User-created song. Add files, credits, identifiers, and evidence before treating it as operationally confirmed.',
      jsonb_build_object('_manual_workspace_request_id', p_request_id::text),
      'user'
    ) returning id into v_song_id;
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
      'A manual song needs one dedicated operational home before its package and release work can be trusted.',
      'active',
      1,
      0,
      trim(p_mission_summary),
      'manual_song_workspace',
      'manual_song_created',
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
      'Seeded during manual song workspace creation.'
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
      relationship
    ) values (
      p_account_id,
      p_artist_workspace_id,
      p_artist_id,
      'mission',
      v_mission_id,
      'music_item',
      v_song_id,
      'references'
    );
  end if;

  select link.source_id into v_conversation_id
  from public.artifact_links as link
  join public.conversations as conversation on conversation.id = link.source_id
  where link.account_id = p_account_id
    and link.artist_workspace_id = p_artist_workspace_id
    and link.artist_id = p_artist_id
    and link.source_type = 'conversation'
    and link.target_type = 'music_item'
    and link.target_id = v_song_id
    and link.relationship = 'references'
    and conversation.status <> 'archived'
  order by link.created_at asc, link.source_id asc
  limit 1;

  if v_conversation_id is null then
    insert into public.conversations (
      account_id,
      artist_workspace_id,
      artist_id,
      topic,
      status,
      summary,
      last_update_at,
      linked_mission_id
    ) values (
      p_account_id,
      p_artist_workspace_id,
      p_artist_id,
      trim(p_title) || ' — song workspace',
      'active',
      trim(p_opening_message),
      now(),
      v_mission_id
    ) returning id into v_conversation_id;

    insert into public.artifact_links (
      account_id,
      artist_workspace_id,
      artist_id,
      source_type,
      source_id,
      target_type,
      target_id,
      relationship
    ) values (
      p_account_id,
      p_artist_workspace_id,
      p_artist_id,
      'conversation',
      v_conversation_id,
      'music_item',
      v_song_id,
      'references'
    );
  else
    update public.conversations
    set linked_mission_id = v_mission_id,
        updated_at = now()
    where id = v_conversation_id
      and linked_mission_id is distinct from v_mission_id;
  end if;

  if not exists (
    select 1
    from public.conversation_messages
    where conversation_id = v_conversation_id
      and metadata ->> 'kind' = 'manual_song_workspace_opening'
  ) then
    insert into public.conversation_messages (
      account_id,
      artist_workspace_id,
      artist_id,
      conversation_id,
      speaker,
      label,
      body,
      metadata
    ) values (
      p_account_id,
      p_artist_workspace_id,
      p_artist_id,
      v_conversation_id,
      'manager',
      'Manager',
      trim(p_opening_message),
      jsonb_build_object('kind', 'manual_song_workspace_opening')
    );
  end if;

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
    'user',
    'music_item',
    v_song_id,
    'manual_song_workspace',
    v_conversation_id,
    v_mission_id,
    'manual-song-workspace:' || p_request_id::text,
    'activity',
    array['music', 'missions'],
    'Created song ' || trim(p_title) || ' and its song workspace.',
    jsonb_build_object('music_item_id', v_song_id, 'mission_id', v_mission_id, 'conversation_id', v_conversation_id)
  ) on conflict (artist_workspace_id, dedupe_key) where dedupe_key is not null do nothing;

  return jsonb_build_object(
    'songId', v_song_id,
    'missionId', v_mission_id,
    'conversationId', v_conversation_id
  );
end;
$$;

revoke all on function public.create_manual_song_workspace_v1(
  uuid, uuid, uuid, uuid, text, public.music_item_type, public.music_lifecycle_stage,
  text, text, text, text, text, text, text, text, text
) from public;

grant execute on function public.create_manual_song_workspace_v1(
  uuid, uuid, uuid, uuid, text, public.music_item_type, public.music_lifecycle_stage,
  text, text, text, text, text, text, text, text, text
) to service_role;
