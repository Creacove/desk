-- Persist the continuation already produced by manager-review-task-result.
-- The review Edge Function writes followUpTasks and permissionRequests into the
-- task-result operating event. Previously those decisions stopped there. This
-- trigger turns safe human follow-up work into real tasks and permission gates
-- into real permission_requests, keeping the Mission moving without another
-- artist prompt.

create or replace function public.persist_manager_review_continuation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  follow_up jsonb;
  permission jsonb;
  follow_up_task_id uuid;
  active_plan_id uuid;
  reminder_user_id uuid;
  owner_role_text text;
  step_text text;
  step_index integer;
  request_type_text text;
begin
  if new.source_type <> 'task_result'
     or new.actor_type <> 'manager'
     or new.mission_id is null
     or new.checkpoint_id is null then
    return new;
  end if;

  select active_plan_version_id
  into active_plan_id
  from public.missions
  where id = new.mission_id
    and artist_workspace_id = new.artist_workspace_id;

  if active_plan_id is null then
    return new;
  end if;

  select membership.user_id
  into reminder_user_id
  from public.account_memberships as membership
  where membership.account_id = new.account_id
    and membership.status = 'active'
  order by case when membership.role = 'owner' then 0 else 1 end, membership.created_at asc
  limit 1;

  for follow_up in
    select value
    from jsonb_array_elements(coalesce(new.payload -> 'followUpTasks', '[]'::jsonb)) as item(value)
  loop
    owner_role_text := nullif(trim(coalesce(follow_up ->> 'ownerRole', '')), '');

    -- Manager-owned work is machine work. It must execute in the Manager loop,
    -- not become calendar work or a reminder sent to the artist.
    if owner_role_text is null or lower(owner_role_text) in ('manager', 'desk', 'ai', 'ai manager') then
      continue;
    end if;

    -- Event retries must not duplicate an already-created continuation task.
    select task.id
    into follow_up_task_id
    from public.tasks as task
    where task.artist_workspace_id = new.artist_workspace_id
      and task.mission_id = new.mission_id
      and task.mission_plan_version_id = active_plan_id
      and task.primary_checkpoint_id = new.checkpoint_id
      and lower(trim(task.title)) = lower(trim(coalesce(follow_up ->> 'title', '')))
      and task.status not in ('archived', 'superseded', 'rejected')
    order by task.created_at desc
    limit 1;

    if follow_up_task_id is null then
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
        assignee_user_id,
        priority,
        status,
        approval_state,
        purpose,
        evidence_needed,
        completion_expectation,
        completion_mode,
        user_responsibility,
        created_from_run_id
      ) values (
        new.account_id,
        new.artist_workspace_id,
        new.artist_id,
        'mission',
        new.mission_id,
        active_plan_id,
        new.checkpoint_id,
        coalesce(nullif(trim(follow_up ->> 'title'), ''), 'Continue the mission'),
        owner_role_text,
        reminder_user_id,
        1,
        'open',
        'not_required',
        nullif(trim(follow_up ->> 'purpose'), ''),
        coalesce(array(select jsonb_array_elements_text(coalesce(follow_up -> 'evidenceNeeded', '[]'::jsonb))), '{}'::text[]),
        'Complete the concrete steps and return the requested result to Desk.',
        'result_note',
        nullif(trim(follow_up ->> 'purpose'), ''),
        new.manager_synthesis_run_id
      )
      returning id into follow_up_task_id;

      step_index := 0;
      for step_text in
        select value
        from jsonb_array_elements_text(coalesce(follow_up -> 'steps', '[]'::jsonb)) as item(value)
      loop
        step_index := step_index + 1;
        insert into public.task_steps (
          account_id, artist_workspace_id, artist_id, task_id, order_index, body
        ) values (
          new.account_id, new.artist_workspace_id, new.artist_id, follow_up_task_id, step_index, step_text
        );
      end loop;

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
        manager_synthesis_run_id,
        mission_id,
        checkpoint_id,
        task_id,
        dedupe_key,
        display_mode,
        refresh_scope,
        summary,
        payload
      ) values (
        new.account_id,
        new.artist_workspace_id,
        new.artist_id,
        'manager_follow_up_task_created',
        'manager',
        'task',
        follow_up_task_id,
        'task_result',
        new.source_id,
        new.manager_synthesis_run_id,
        new.mission_id,
        new.checkpoint_id,
        follow_up_task_id,
        'manager-follow-up:' || new.id::text || ':' || follow_up_task_id::text,
        'activity',
        array['missions', 'activity'],
        coalesce(nullif(trim(follow_up ->> 'title'), ''), 'Manager created the next task.'),
        jsonb_build_object('originatingOperatingEventId', new.id, 'originatingTaskId', new.task_id)
      )
      on conflict (artist_workspace_id, dedupe_key) where dedupe_key is not null do nothing;

      if reminder_user_id is not null then
        insert into public.reminder_queue (
          account_id,
          artist_workspace_id,
          artist_id,
          user_id,
          mission_id,
          task_id,
          kind,
          scheduled_for,
          channel,
          status,
          dedupe_key,
          payload
        ) values (
          new.account_id,
          new.artist_workspace_id,
          new.artist_id,
          reminder_user_id,
          new.mission_id,
          follow_up_task_id,
          'task_ready',
          now(),
          'in_app',
          'queued',
          'task:' || follow_up_task_id::text || ':task_ready:continuation',
          jsonb_build_object(
            'taskTitle', coalesce(nullif(trim(follow_up ->> 'title'), ''), 'Continue the mission'),
            'purpose', coalesce(follow_up ->> 'purpose', ''),
            'estimatedMinutes', null,
            'riskIfLate', ''
          )
        )
        on conflict (artist_workspace_id, dedupe_key) do nothing;
      end if;
    end if;

    follow_up_task_id := null;
  end loop;

  for permission in
    select value
    from jsonb_array_elements(coalesce(new.payload -> 'permissionRequests', '[]'::jsonb)) as item(value)
  loop
    request_type_text := lower(trim(coalesce(permission ->> 'requestType', '')));
    if request_type_text not in (
      'spend', 'external_outreach', 'submission', 'publish', 'schedule',
      'release_plan_change', 'legal_finance_rights', 'sensitive_commitment',
      'draft_export', 'source_connection'
    ) then
      continue;
    end if;

    if not exists (
      select 1
      from public.permission_requests as existing_request
      where existing_request.artist_workspace_id = new.artist_workspace_id
        and existing_request.mission_id = new.mission_id
        and existing_request.created_from_run_id = new.manager_synthesis_run_id
        and lower(trim(existing_request.title)) = lower(trim(coalesce(permission ->> 'title', '')))
        and existing_request.status = 'pending'
    ) then
      insert into public.permission_requests (
        account_id,
        artist_workspace_id,
        artist_id,
        mission_id,
        task_id,
        checkpoint_id,
        request_type,
        title,
        body,
        risk,
        status,
        created_from_run_id
      ) values (
        new.account_id,
        new.artist_workspace_id,
        new.artist_id,
        new.mission_id,
        new.task_id,
        new.checkpoint_id,
        request_type_text::public.permission_request_type,
        coalesce(nullif(trim(permission ->> 'title'), ''), 'Manager needs approval'),
        nullif(trim(permission ->> 'body'), ''),
        nullif(trim(permission ->> 'risk'), ''),
        'pending',
        new.manager_synthesis_run_id
      );
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists persist_manager_review_continuation_on_event on public.operating_events;
create trigger persist_manager_review_continuation_on_event
after insert on public.operating_events
for each row
when (new.source_type = 'task_result' and new.actor_type = 'manager')
execute function public.persist_manager_review_continuation();
