-- Gate 4 safety closure: external-action preparation must come from an explicit,
-- machine-readable Manager intent. Canonical split readiness alone is never
-- authorization to create an approval request.
--
-- The Manager persists `prepare_split_confirmations_for_approval` against its
-- current run. The server then resolves the exact focused music item from the
-- trusted run context, validates the canonical split, freezes the recipient
-- effect, and creates the existing approval-gated `send_split_confirmations`
-- child action. The model never supplies a split id, recipient id, email, share,
-- or executable target id.

-- Remove the previous readiness-driven producers. These triggers made canonical
-- data changes act like execution intent, which is too broad: linked_task_id is
-- contextual linkage, not authorization for external outreach.
drop trigger if exists produce_split_permission_from_split on public.music_splits;
drop trigger if exists produce_split_permission_from_contributor on public.music_split_contributors;
drop trigger if exists produce_split_permission_from_task on public.tasks;
drop trigger if exists produce_split_permission_from_mission on public.missions;

drop function if exists public._produce_split_permission_from_split_v1();
drop function if exists public._produce_split_permission_from_contributor_v1();
drop function if exists public._produce_split_permission_from_task_v1();
drop function if exists public._produce_split_permission_from_mission_v1();
drop function if exists public.maybe_prepare_split_confirmation_permission_v1(uuid);

create or replace function public.prepare_manager_split_confirmation_intent_v1(
  target_intent_action_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  intent_action public.manager_run_actions%rowtype;
  run_row public.manager_synthesis_runs%rowtype;
  split_row public.music_splits%rowtype;
  music_item_row public.music_items%rowtype;
  task_row public.tasks%rowtype;
  mission_row public.missions%rowtype;
  subject_type text;
  subject_id_text text;
  subject_id uuid;
  mission_id uuid;
  recipient_snapshot jsonb := '[]'::jsonb;
  publishing_sum numeric := 0;
  master_sum numeric := 0;
  active_contributor_count integer := 0;
  draft_recipient_count integer := 0;
  missing_email_count integer := 0;
  existing_permission_id uuid;
  existing_action_id uuid;
  existing_status public.permission_request_status;
  prepared jsonb;
begin
  select * into intent_action
  from public.manager_run_actions
  where id = target_intent_action_id
  for update;

  if not found then
    return jsonb_build_object('status', 'ignored', 'reason', 'intent_action_not_found');
  end if;

  if intent_action.action_type <> 'prepare_split_confirmations_for_approval' then
    return jsonb_build_object(
      'status', 'ignored',
      'reason', 'unsupported_intent_action',
      'actionId', intent_action.id
    );
  end if;

  if intent_action.approval_required then
    return jsonb_build_object(
      'status', 'not_ready',
      'reason', 'preparation_intent_must_not_claim_external_approval',
      'actionId', intent_action.id
    );
  end if;

  select * into run_row
  from public.manager_synthesis_runs
  where id = intent_action.manager_synthesis_run_id
    and account_id = intent_action.account_id
    and artist_workspace_id = intent_action.artist_workspace_id
    and artist_id = intent_action.artist_id
  for update;

  if not found then
    return jsonb_build_object('status', 'ignored', 'reason', 'manager_run_not_found');
  end if;

  subject_type := nullif(trim(coalesce(run_row.context_payload #>> '{scope,musicSubject,type}', '')), '');
  subject_id_text := nullif(trim(coalesce(run_row.context_payload #>> '{scope,musicSubject,id}', '')), '');

  if subject_type <> 'music_item' or subject_id_text is null then
    return jsonb_build_object(
      'status', 'not_ready',
      'reason', 'focused_music_item_required',
      'actionId', intent_action.id
    );
  end if;

  begin
    subject_id := subject_id_text::uuid;
  exception when invalid_text_representation then
    return jsonb_build_object(
      'status', 'not_ready',
      'reason', 'focused_music_item_id_invalid',
      'actionId', intent_action.id
    );
  end;

  select * into music_item_row
  from public.music_items
  where id = subject_id
    and account_id = run_row.account_id
    and artist_workspace_id = run_row.artist_workspace_id
    and artist_id = run_row.artist_id;

  if not found then
    return jsonb_build_object(
      'status', 'not_ready',
      'reason', 'focused_music_item_not_found',
      'musicItemId', subject_id
    );
  end if;

  select * into split_row
  from public.music_splits
  where account_id = run_row.account_id
    and artist_workspace_id = run_row.artist_workspace_id
    and artist_id = run_row.artist_id
    and music_item_id = subject_id
    and status = 'draft'
  order by created_at desc, id desc
  limit 1;

  if not found then
    return jsonb_build_object(
      'status', 'not_ready',
      'reason', 'no_draft_split',
      'musicItemId', subject_id
    );
  end if;

  -- Serialize explicit preparation attempts for this canonical split so retries,
  -- concurrent Manager turns, and model replays cannot create duplicate effects.
  perform pg_advisory_xact_lock(hashtextextended(split_row.id::text, 0));

  -- Mission linkage scopes the approval and continuation. It is deliberately not
  -- the authorization boundary: the explicit typed Manager action above is.
  if split_row.linked_task_id is not null then
    select * into task_row
    from public.tasks
    where id = split_row.linked_task_id
      and account_id = run_row.account_id
      and artist_workspace_id = run_row.artist_workspace_id
      and artist_id = run_row.artist_id;
    if found then mission_id := task_row.mission_id; end if;
  end if;

  if mission_id is null and run_row.mission_id is not null then
    mission_id := run_row.mission_id;
  end if;

  if mission_id is null and run_row.conversation_id is not null then
    select conversation.linked_mission_id into mission_id
    from public.conversations as conversation
    where conversation.id = run_row.conversation_id
      and conversation.account_id = run_row.account_id
      and conversation.artist_workspace_id = run_row.artist_workspace_id
      and conversation.artist_id = run_row.artist_id;
  end if;

  if mission_id is null then
    return jsonb_build_object(
      'status', 'not_ready',
      'reason', 'mission_scope_required',
      'splitId', split_row.id,
      'musicItemId', subject_id
    );
  end if;

  select * into mission_row
  from public.missions
  where id = mission_id
    and account_id = run_row.account_id
    and artist_workspace_id = run_row.artist_workspace_id
    and artist_id = run_row.artist_id;

  if not found or mission_row.status not in ('active', 'blocked', 'review') then
    return jsonb_build_object(
      'status', 'not_ready',
      'reason', 'mission_scope_is_not_current',
      'splitId', split_row.id,
      'missionId', mission_id
    );
  end if;

  select
    coalesce(sum(contributor.publishing_share), 0),
    coalesce(sum(contributor.master_share), 0),
    count(*)::integer,
    count(*) filter (where contributor.approval_status = 'draft')::integer,
    count(*) filter (where nullif(trim(contributor.email), '') is null)::integer
  into publishing_sum, master_sum, active_contributor_count, draft_recipient_count, missing_email_count
  from public.music_split_contributors as contributor
  where contributor.music_split_id = split_row.id
    and contributor.approval_status <> 'revoked';

  if active_contributor_count = 0
     or round(publishing_sum, 2) <> 100
     or round(master_sum, 2) <> 100
     or missing_email_count > 0
     or draft_recipient_count = 0 then
    return jsonb_build_object(
      'status', 'not_ready',
      'reason', 'split_effect_is_not_sendable',
      'splitId', split_row.id,
      'musicItemId', subject_id,
      'publishingTotal', publishing_sum,
      'masterTotal', master_sum,
      'activeContributorCount', active_contributor_count,
      'draftRecipientCount', draft_recipient_count,
      'missingEmailCount', missing_email_count
    );
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'contributorId', contributor.id,
      'name', contributor.name,
      'role', contributor.role,
      'email', trim(contributor.email),
      'publishingShare', contributor.publishing_share::text,
      'masterShare', contributor.master_share::text
    ) order by contributor.id
  ), '[]'::jsonb)
  into recipient_snapshot
  from public.music_split_contributors as contributor
  where contributor.music_split_id = split_row.id
    and contributor.approval_status = 'draft';

  -- Dedupe by the exact frozen effect. A rejected exact effect remains rejected;
  -- Desk does not silently ask again until canonical recipients/shares change.
  select permission.id, permission.created_from_action_id, permission.status
  into existing_permission_id, existing_action_id, existing_status
  from public.permission_requests as permission
  where permission.account_id = run_row.account_id
    and permission.artist_workspace_id = run_row.artist_workspace_id
    and permission.artist_id = run_row.artist_id
    and permission.parameters ->> 'actionKind' = 'send_split_confirmations'
    and permission.parameters ->> 'splitId' = split_row.id::text
    and coalesce(permission.parameters -> 'recipients', '[]'::jsonb) = recipient_snapshot
    and permission.status not in ('superseded', 'revoked')
  order by permission.created_at desc, permission.id desc
  limit 1;

  if existing_permission_id is not null then
    return jsonb_build_object(
      'status', 'replayed',
      'reason', 'exact_effect_already_has_permission',
      'intentActionId', intent_action.id,
      'splitId', split_row.id,
      'musicItemId', subject_id,
      'missionId', mission_id,
      'permissionId', existing_permission_id,
      'actionId', existing_action_id,
      'permissionStatus', existing_status
    );
  end if;

  prepared := public.prepare_split_confirmation_manager_permission_v1(
    run_row.id,
    mission_id,
    subject_id,
    'Send split confirmations for ' || music_item_row.title,
    'Desk is ready to email the current split confirmation to the collaborators shown here.',
    'This sends external email to the listed collaborators using the frozen addresses and publishing/master shares.'
  );

  return prepared || jsonb_build_object(
    'status', 'prepared',
    'intentActionId', intent_action.id,
    'splitId', split_row.id,
    'musicItemId', subject_id,
    'missionId', mission_id
  );
end;
$$;

revoke all on function public.prepare_manager_split_confirmation_intent_v1(uuid)
  from public, anon, authenticated;
grant execute on function public.prepare_manager_split_confirmation_intent_v1(uuid)
  to service_role;

create or replace function public._prepare_split_permission_from_manager_intent_v1()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  prepared jsonb;
  prepared_status text;
  failure_message text;
begin
  if new.action_type <> 'prepare_split_confirmations_for_approval' then
    return new;
  end if;

  begin
    prepared := public.prepare_manager_split_confirmation_intent_v1(new.id);
    prepared_status := coalesce(prepared ->> 'status', 'failed');

    update public.manager_run_actions
    set status = case
          when prepared_status in ('prepared', 'replayed') then 'applied'::public.manager_action_status
          when prepared_status in ('not_ready', 'ignored') then 'skipped'::public.manager_action_status
          else 'failed'::public.manager_action_status
        end,
        target_type = case
          when nullif(prepared ->> 'musicItemId', '') is not null then 'music_item'
          else target_type
        end,
        target_id = coalesce(nullif(prepared ->> 'musicItemId', '')::uuid, target_id),
        result_payload = prepared,
        error = case when prepared_status = 'failed' then coalesce(prepared ->> 'error', 'Split confirmation preparation failed.') else null end
    where id = new.id;
  exception when others then
    get stacked diagnostics failure_message = message_text;

    -- Failure isolation is intentional. A Manager automation failure must never
    -- abort the canonical write/turn that caused this intent action to be saved.
    update public.manager_run_actions
    set status = 'failed',
        result_payload = jsonb_build_object(
          'status', 'failed',
          'reason', 'permission_preparation_failed',
          'error', left(coalesce(failure_message, 'Split confirmation preparation failed.'), 1000)
        ),
        error = left(coalesce(failure_message, 'Split confirmation preparation failed.'), 1000)
    where id = new.id;
  end;

  return new;
end;
$$;

revoke all on function public._prepare_split_permission_from_manager_intent_v1()
  from public, anon, authenticated, service_role;

drop trigger if exists prepare_split_permission_from_manager_intent on public.manager_run_actions;
create trigger prepare_split_permission_from_manager_intent
after insert on public.manager_run_actions
for each row
when (new.action_type = 'prepare_split_confirmations_for_approval')
execute function public._prepare_split_permission_from_manager_intent_v1();
