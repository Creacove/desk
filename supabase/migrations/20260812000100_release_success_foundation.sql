-- Release Success foundation.
--
-- This layer stores operational release planning separately from provider
-- history. Date-only changes update the approved plan and explicitly bound
-- task deadlines; they never rewrite imported Music metadata.

create table public.music_release_plans (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  music_item_id uuid not null unique references public.music_items(id) on delete cascade,
  mission_id uuid references public.missions(id) on delete set null,
  status text not null default 'draft'
    check (status in ('draft', 'pending_approval', 'approved', 'released', 'cancelled')),
  approved_release_date date,
  revision bigint not null default 0 check (revision >= 0),
  approved_at timestamptz,
  approved_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.release_date_change_requests (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  release_plan_id uuid not null references public.music_release_plans(id) on delete cascade,
  permission_request_id uuid references public.permission_requests(id) on delete set null,
  from_date date,
  proposed_date date not null,
  reason text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'superseded', 'expired', 'failed')),
  expected_plan_revision bigint not null,
  preview_hash text not null,
  preview_json jsonb not null default '{}'::jsonb,
  result_json jsonb not null default '{}'::jsonb,
  idempotency_key text not null,
  expires_at timestamptz not null,
  requested_by uuid,
  approved_by uuid,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, idempotency_key)
);

create table public.release_task_schedule_bindings (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  release_plan_id uuid not null references public.music_release_plans(id) on delete cascade,
  task_id uuid not null unique references public.tasks(id) on delete cascade,
  anchor text not null default 'approved_release_date'
    check (anchor = 'approved_release_date'),
  offset_days integer not null check (offset_days between -365 and 365),
  active boolean not null default true,
  applied_plan_revision bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index music_release_plans_workspace_idx
  on public.music_release_plans (account_id, artist_workspace_id, artist_id, status);
create index release_date_change_requests_pending_idx
  on public.release_date_change_requests (release_plan_id, status, created_at desc);
create index release_task_schedule_bindings_plan_idx
  on public.release_task_schedule_bindings (release_plan_id, active, offset_days);

create trigger music_release_plans_set_updated_at
before update on public.music_release_plans
for each row execute function public.set_updated_at();

create trigger release_date_change_requests_set_updated_at
before update on public.release_date_change_requests
for each row execute function public.set_updated_at();

create trigger release_task_schedule_bindings_set_updated_at
before update on public.release_task_schedule_bindings
for each row execute function public.set_updated_at();

alter table public.music_release_plans enable row level security;
alter table public.release_date_change_requests enable row level security;
alter table public.release_task_schedule_bindings enable row level security;

create policy music_release_plans_account_members_select
on public.music_release_plans for select
using (public.is_account_member(account_id));

create policy release_date_change_requests_account_members_select
on public.release_date_change_requests for select
using (public.is_account_member(account_id));

create policy release_task_schedule_bindings_account_members_select
on public.release_task_schedule_bindings for select
using (public.is_account_member(account_id));

revoke all on public.music_release_plans from public, anon, authenticated;
revoke all on public.release_date_change_requests from public, anon, authenticated;
revoke all on public.release_task_schedule_bindings from public, anon, authenticated;

grant select on public.music_release_plans to authenticated, service_role;
grant select on public.release_date_change_requests to authenticated, service_role;
grant select on public.release_task_schedule_bindings to authenticated, service_role;
grant insert, update, delete on public.music_release_plans to service_role;
grant insert, update, delete on public.release_date_change_requests to service_role;
grant insert, update, delete on public.release_task_schedule_bindings to service_role;

-- Template-owned release tasks carry a machine key. Legacy/manual tasks stay
-- null and therefore cannot be inferred into the release schedule by title.
alter table public.tasks
  add column if not exists schedule_key text;

create unique index if not exists tasks_release_schedule_key_unique
  on public.tasks (mission_id, schedule_key)
  where schedule_key is not null;

create or replace function public.release_schedule_offset_days_v1(p_schedule_key text)
returns integer
language sql
immutable
strict
set search_path = public
as $$
  select case lower(trim(p_schedule_key))
    when 'distributor_delivery' then -12
    when 'spotify_editorial_pitch' then -8
    when 'playlist_shortlist' then -7
    when 'epk_press_package' then -6
    when 'content_rollout_start' then -4
    when 'release_live_check' then 0
    when 'post_release_review' then 2
    else null
  end;
$$;

-- The manual and conversational workspace RPCs both finish by linking the
-- release mission to the song. This forward hook extends both RPCs without
-- rewriting their applied migrations or creating a second mission.
create or replace function public.ensure_release_success_workspace_v1(
  p_account_id uuid,
  p_artist_workspace_id uuid,
  p_artist_id uuid,
  p_music_item_id uuid,
  p_mission_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_song public.music_items%rowtype;
  v_plan public.music_release_plans%rowtype;
  v_mission_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('release-success:' || p_music_item_id::text));

  select * into v_song
  from public.music_items
  where id = p_music_item_id
    and account_id = p_account_id
    and artist_workspace_id = p_artist_workspace_id
    and artist_id = p_artist_id
  for update;

  if not found then
    return null;
  end if;

  if v_song.released_at is not null
    or v_song.lifecycle_stage in ('released', 'catalog', 'archived') then
    return null;
  end if;

  select link.source_id into v_mission_id
  from public.artifact_links link
  join public.missions mission on mission.id = link.source_id
  where link.account_id = p_account_id
    and link.artist_workspace_id = p_artist_workspace_id
    and link.artist_id = p_artist_id
    and link.source_type = 'mission'
    and (p_mission_id is null or link.source_id = p_mission_id)
    and link.target_type = 'music_item'
    and link.target_id = p_music_item_id
    and link.relationship = 'references'
    and mission.status not in ('archived', 'cancelled')
    and mission.pattern_name in ('manual_song_workspace', 'release_planning')
  order by link.created_at asc, link.source_id asc
  limit 1;

  if v_mission_id is null then
    return null;
  end if;

  select * into v_plan
  from public.music_release_plans
  where music_item_id = p_music_item_id
    and account_id = p_account_id
    and artist_workspace_id = p_artist_workspace_id
    and artist_id = p_artist_id
  for update;

  if not found then
    insert into public.music_release_plans (
      account_id,
      artist_workspace_id,
      artist_id,
      music_item_id,
      mission_id,
      status,
      approved_release_date
    ) values (
      p_account_id,
      p_artist_workspace_id,
      p_artist_id,
      p_music_item_id,
      v_mission_id,
      case when v_song.planned_release_date is null then 'draft' else 'approved' end,
      v_song.planned_release_date
    )
    on conflict (music_item_id) do nothing;

    select * into v_plan
    from public.music_release_plans
    where music_item_id = p_music_item_id
    for update;
  elsif v_plan.mission_id is null then
    update public.music_release_plans
    set mission_id = v_mission_id,
        updated_at = now()
    where id = v_plan.id;
    v_plan.mission_id := v_mission_id;
  end if;

  insert into public.release_task_schedule_bindings (
    account_id,
    artist_workspace_id,
    artist_id,
    release_plan_id,
    task_id,
    offset_days,
    applied_plan_revision
  )
  select
    p_account_id,
    p_artist_workspace_id,
    p_artist_id,
    v_plan.id,
    task.id,
    public.release_schedule_offset_days_v1(task.schedule_key),
    v_plan.revision
  from public.tasks task
  where task.account_id = p_account_id
    and task.artist_workspace_id = p_artist_workspace_id
    and task.artist_id = p_artist_id
    and task.mission_id = v_mission_id
    and task.schedule_key is not null
    and public.release_schedule_offset_days_v1(task.schedule_key) is not null
    and task.status::text not in ('archived', 'rejected', 'superseded')
  on conflict (task_id) do nothing;

  return v_plan.id;
end;
$$;

create or replace function public.link_release_success_workspace_v1()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pattern_name text;
begin
  if new.source_type = 'mission'
    and new.target_type = 'music_item'
    and new.relationship = 'references' then
    select pattern_name into v_pattern_name
    from public.missions
    where id = new.source_id;

    if v_pattern_name in ('manual_song_workspace', 'release_planning') then
      perform public.ensure_release_success_workspace_v1(
        new.account_id,
        new.artist_workspace_id,
        new.artist_id,
        new.target_id,
        new.source_id
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists artifact_links_release_success_workspace on public.artifact_links;
create trigger artifact_links_release_success_workspace
after insert on public.artifact_links
for each row execute function public.link_release_success_workspace_v1();

create or replace function public.bind_release_success_task_v1()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan public.music_release_plans%rowtype;
  v_offset integer;
begin
  if new.schedule_key is null
    or new.mission_id is null
    or new.status::text in ('archived', 'rejected', 'superseded') then
    return new;
  end if;

  v_offset := public.release_schedule_offset_days_v1(new.schedule_key);
  if v_offset is null then
    return new;
  end if;

  select plan.* into v_plan
  from public.music_release_plans plan
  where plan.mission_id = new.mission_id
    and plan.account_id = new.account_id
    and plan.artist_workspace_id = new.artist_workspace_id
    and plan.artist_id = new.artist_id
  for update;

  if not found then
    return new;
  end if;

  insert into public.release_task_schedule_bindings (
    account_id,
    artist_workspace_id,
    artist_id,
    release_plan_id,
    task_id,
    offset_days,
    applied_plan_revision
  ) values (
    new.account_id,
    new.artist_workspace_id,
    new.artist_id,
    v_plan.id,
    new.id,
    v_offset,
    v_plan.revision
  ) on conflict (task_id) do nothing;

  return new;
end;
$$;

drop trigger if exists tasks_release_success_schedule_binding on public.tasks;
create trigger tasks_release_success_schedule_binding
after insert or update of schedule_key, mission_id, status on public.tasks
for each row execute function public.bind_release_success_task_v1();

revoke all on function public.release_schedule_offset_days_v1(text) from public, anon, authenticated;
revoke all on function public.ensure_release_success_workspace_v1(uuid, uuid, uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.link_release_success_workspace_v1() from public, anon, authenticated;
revoke all on function public.bind_release_success_task_v1() from public, anon, authenticated;
grant execute on function public.release_schedule_offset_days_v1(text) to service_role;
grant execute on function public.ensure_release_success_workspace_v1(uuid, uuid, uuid, uuid, uuid) to service_role;
grant execute on function public.link_release_success_workspace_v1() to service_role;
grant execute on function public.bind_release_success_task_v1() to service_role;

-- Release-success assessments are current Manager outputs, not a second
-- readiness table. The check constraint predates this workflow.
alter table public.manager_outputs
  drop constraint if exists manager_outputs_output_type_check;

alter table public.manager_outputs
  add constraint manager_outputs_output_type_check
  check (output_type in (
    'setup_first_manager_read',
    'recurring_todays_brief',
    'song_manager_read',
    'project_manager_read',
    'chat_answer',
    'decision_package',
    'review_read',
    'release_success_assessment',
    'release_opportunity_brief'
  ));

create or replace function public.propose_release_date_change(
  p_account_id uuid,
  p_artist_workspace_id uuid,
  p_artist_id uuid,
  p_music_item_id uuid,
  p_proposed_date date,
  p_reason text,
  p_expected_plan_revision bigint,
  p_preview jsonb,
  p_preview_hash text,
  p_expires_at timestamptz,
  p_idempotency_key text,
  p_requested_by uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_song public.music_items%rowtype;
  v_plan public.music_release_plans%rowtype;
  v_existing public.release_date_change_requests%rowtype;
  v_permission_id uuid;
  v_request public.release_date_change_requests%rowtype;
  v_request_created boolean := false;
begin
  if p_proposed_date is null then
    raise exception 'release_date_required';
  end if;
  if nullif(trim(p_reason), '') is null or length(trim(p_reason)) > 2000 then
    raise exception 'release_reason_invalid';
  end if;
  if nullif(trim(p_preview_hash), '') is null or length(trim(p_preview_hash)) > 128 then
    raise exception 'release_preview_hash_invalid';
  end if;
  if nullif(trim(p_idempotency_key), '') is null or length(trim(p_idempotency_key)) > 160 then
    raise exception 'release_idempotency_key_invalid';
  end if;
  if p_expires_at is null or p_expires_at <= now() then
    raise exception 'release_request_expired';
  end if;
  if p_expected_plan_revision is null or p_expected_plan_revision < 0 then
    raise exception 'release_plan_revision_invalid';
  end if;
  if p_requested_by is not null and not exists (
    select 1
    from public.account_memberships membership
    where membership.account_id = p_account_id
      and membership.user_id = p_requested_by
      and membership.status = 'active'
  ) then
    raise exception 'release_request_owner_invalid';
  end if;
  if jsonb_typeof(coalesce(p_preview, '{}'::jsonb)) <> 'object'
    or p_preview ->> 'proposedDate' is distinct from p_proposed_date::text
    or p_preview ->> 'expectedRevision' is distinct from p_expected_plan_revision::text
    or p_preview ->> 'previewHash' is distinct from trim(p_preview_hash) then
    raise exception 'release_preview_mismatch';
  end if;

  select * into v_existing
  from public.release_date_change_requests
  where account_id = p_account_id
    and idempotency_key = trim(p_idempotency_key)
  for update;

  if found then
    if v_existing.release_plan_id is distinct from (
      select id
      from public.music_release_plans
      where music_item_id = p_music_item_id
        and account_id = p_account_id
        and artist_workspace_id = p_artist_workspace_id
        and artist_id = p_artist_id
      limit 1
    )
      or v_existing.proposed_date is distinct from p_proposed_date
      or v_existing.preview_hash is distinct from trim(p_preview_hash) then
      raise exception 'release_idempotency_conflict';
    end if;
    return jsonb_build_object(
      'requestId', v_existing.id,
      'releasePlanId', v_existing.release_plan_id,
      'musicItemId', p_music_item_id,
      'status', v_existing.status,
      'fromDate', v_existing.from_date,
      'proposedDate', v_existing.proposed_date,
      'expectedPlanRevision', v_existing.expected_plan_revision,
      'previewHash', v_existing.preview_hash,
      'preview', v_existing.preview_json,
      'expiresAt', v_existing.expires_at,
      'result', v_existing.result_json
    );
  end if;

  select * into v_song
  from public.music_items
  where id = p_music_item_id
    and account_id = p_account_id
    and artist_workspace_id = p_artist_workspace_id
    and artist_id = p_artist_id
  for update;

  if not found then
    raise exception 'release_song_not_found';
  end if;
  if v_song.released_at is not null
    or v_song.lifecycle_stage in ('released', 'catalog', 'archived') then
    raise exception 'release_already_live';
  end if;

  select * into v_plan
  from public.music_release_plans
  where music_item_id = p_music_item_id
    and account_id = p_account_id
    and artist_workspace_id = p_artist_workspace_id
    and artist_id = p_artist_id
  for update;

  if not found then
    insert into public.music_release_plans (
      account_id,
      artist_workspace_id,
      artist_id,
      music_item_id,
      mission_id,
      status,
      approved_release_date
    )
    values (
      p_account_id,
      p_artist_workspace_id,
      p_artist_id,
      p_music_item_id,
      (
        select link.source_id
        from public.artifact_links link
        join public.missions mission on mission.id = link.source_id
        where link.account_id = p_account_id
          and link.artist_workspace_id = p_artist_workspace_id
          and link.artist_id = p_artist_id
          and link.source_type = 'mission'
          and link.target_type = 'music_item'
          and link.target_id = p_music_item_id
          and link.relationship = 'references'
          and mission.status not in ('archived', 'cancelled')
        order by link.created_at asc, link.source_id asc
        limit 1
      ),
      case when v_song.planned_release_date is null then 'draft' else 'approved' end,
      v_song.planned_release_date
    )
    returning * into v_plan;
  end if;

  if p_expected_plan_revision <> v_plan.revision then
    raise exception 'release_plan_stale';
  end if;
  if p_preview ->> 'fromDate' is distinct from v_plan.approved_release_date::text then
    raise exception 'release_preview_mismatch';
  end if;
  if v_plan.status in ('released', 'cancelled') then
    raise exception 'release_plan_not_editable';
  end if;
  if v_plan.approved_release_date is not null
    and v_plan.approved_release_date = p_proposed_date then
    raise exception 'release_date_noop';
  end if;

  begin
    insert into public.permission_requests (
      account_id,
      artist_workspace_id,
      artist_id,
      mission_id,
      request_type,
      title,
      body,
      risk,
      parameters,
      status,
      expires_at,
      created_from_action_id
    ) values (
      p_account_id,
      p_artist_workspace_id,
      p_artist_id,
      v_plan.mission_id,
      'release_plan_change',
      'Approve release date change',
      trim(p_reason),
      'Changing the release date recalculates only explicitly release-bound mission deadlines.',
      jsonb_build_object(
        'music_item_id', p_music_item_id,
        'release_plan_id', v_plan.id,
        'from_date', v_plan.approved_release_date,
        'proposed_date', p_proposed_date,
        'expected_plan_revision', v_plan.revision,
        'preview_hash', trim(p_preview_hash)
      ),
      'pending',
      p_expires_at,
      null
    ) returning id into v_permission_id;

    insert into public.release_date_change_requests (
      account_id,
      artist_workspace_id,
      artist_id,
      release_plan_id,
      permission_request_id,
      from_date,
      proposed_date,
      reason,
      expected_plan_revision,
      preview_hash,
      preview_json,
      idempotency_key,
      expires_at,
      requested_by
    ) values (
      p_account_id,
      p_artist_workspace_id,
      p_artist_id,
      v_plan.id,
      v_permission_id,
      v_plan.approved_release_date,
      p_proposed_date,
      trim(p_reason),
      v_plan.revision,
      trim(p_preview_hash),
      coalesce(p_preview, '{}'::jsonb),
      trim(p_idempotency_key),
      p_expires_at,
      p_requested_by
    ) on conflict (account_id, idempotency_key) do nothing returning * into v_request;
    if not found then
      delete from public.permission_requests
      where id = v_permission_id;
      select * into v_request
      from public.release_date_change_requests
      where account_id = p_account_id
        and idempotency_key = trim(p_idempotency_key)
      for update;
      if not found then
        raise exception 'release_idempotency_race';
      end if;
    else
      v_request_created := true;
    end if;
  exception when unique_violation then
    select * into v_request
    from public.release_date_change_requests
    where account_id = p_account_id
      and idempotency_key = trim(p_idempotency_key)
    for update;
    if not found then
      raise;
    end if;
  end;

  if not v_request_created then
    if v_request.release_plan_id is distinct from v_plan.id
      or v_request.proposed_date is distinct from p_proposed_date
      or v_request.expected_plan_revision is distinct from p_expected_plan_revision
      or v_request.preview_hash is distinct from trim(p_preview_hash) then
      raise exception 'release_idempotency_conflict';
    end if;
    return jsonb_build_object(
      'requestId', v_request.id,
      'releasePlanId', v_request.release_plan_id,
      'musicItemId', p_music_item_id,
      'status', v_request.status,
      'fromDate', v_request.from_date,
      'proposedDate', v_request.proposed_date,
      'expectedPlanRevision', v_request.expected_plan_revision,
      'previewHash', v_request.preview_hash,
      'preview', v_request.preview_json,
      'expiresAt', v_request.expires_at,
      'result', v_request.result_json
    );
  end if;

  update public.music_release_plans
  set status = 'pending_approval'
  where id = v_plan.id;

  return jsonb_build_object(
    'requestId', v_request.id,
    'releasePlanId', v_request.release_plan_id,
    'musicItemId', p_music_item_id,
    'missionId', v_plan.mission_id,
    'status', v_request.status,
    'fromDate', v_request.from_date,
    'proposedDate', v_request.proposed_date,
    'expectedPlanRevision', v_request.expected_plan_revision,
    'previewHash', v_request.preview_hash,
    'preview', v_request.preview_json,
    'expiresAt', v_request.expires_at
  );
end;
$$;

create or replace function public.approve_release_date_change(
  p_account_id uuid,
  p_artist_workspace_id uuid,
  p_artist_id uuid,
  p_request_id uuid,
  p_preview_hash text,
  p_idempotency_key text,
  p_approved_by uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.release_date_change_requests%rowtype;
  v_plan public.music_release_plans%rowtype;
  v_song public.music_items%rowtype;
  v_permission public.permission_requests%rowtype;
  v_binding record;
  v_task public.tasks%rowtype;
  v_preview_item jsonb;
  v_from_deadline timestamptz;
  v_new_deadline timestamptz;
  v_binding_offset integer;
  v_preview_to date;
  v_moved jsonb := '[]'::jsonb;
  v_preserved jsonb := '[]'::jsonb;
  v_next_task jsonb := null;
  v_previous_revision bigint;
  v_event_id uuid;
begin
  if nullif(trim(p_preview_hash), '') is null then
    raise exception 'release_preview_hash_invalid';
  end if;
  if nullif(trim(p_idempotency_key), '') is null then
    raise exception 'release_idempotency_key_invalid';
  end if;
  if p_approved_by is not null and not exists (
    select 1
    from public.account_memberships membership
    where membership.account_id = p_account_id
      and membership.user_id = p_approved_by
      and membership.status = 'active'
  ) then
    raise exception 'release_approval_owner_invalid';
  end if;

  select * into v_request
  from public.release_date_change_requests
  where id = p_request_id
    and account_id = p_account_id
    and artist_workspace_id = p_artist_workspace_id
    and artist_id = p_artist_id
  for update;

  if not found then
    raise exception 'release_request_not_found';
  end if;

  if v_request.status = 'approved' then
    if v_request.idempotency_key <> trim(p_idempotency_key)
      or v_request.preview_hash <> trim(p_preview_hash) then
      raise exception 'release_idempotency_conflict';
    end if;
    return v_request.result_json;
  end if;
  if v_request.status <> 'pending' then
    raise exception 'release_request_not_pending';
  end if;
  if v_request.expires_at <= now() then
    update public.release_date_change_requests
    set status = 'expired'
    where id = v_request.id;
    update public.permission_requests
    set status = 'expired'
    where id = v_request.permission_request_id
      and status = 'pending';
    raise exception 'release_request_expired';
  end if;
  if v_request.idempotency_key <> trim(p_idempotency_key)
    or v_request.preview_hash <> trim(p_preview_hash) then
    raise exception 'release_idempotency_conflict';
  end if;
  if v_request.preview_json ->> 'previewHash' is distinct from v_request.preview_hash then
    raise exception 'release_preview_mismatch';
  end if;

  select * into v_plan
  from public.music_release_plans
  where id = v_request.release_plan_id
    and account_id = p_account_id
    and artist_workspace_id = p_artist_workspace_id
    and artist_id = p_artist_id
  for update;

  if not found then
    raise exception 'release_plan_not_found';
  end if;
  if v_plan.revision <> v_request.expected_plan_revision
    or v_plan.approved_release_date is distinct from v_request.from_date then
    raise exception 'release_plan_stale';
  end if;
  if v_request.preview_json ->> 'fromDate' is distinct from v_plan.approved_release_date::text
    or v_request.preview_json ->> 'proposedDate' is distinct from v_request.proposed_date::text
    or v_request.preview_json ->> 'expectedRevision' is distinct from v_request.expected_plan_revision::text then
    raise exception 'release_preview_mismatch';
  end if;
  if v_plan.status in ('released', 'cancelled') then
    raise exception 'release_already_live';
  end if;

  select * into v_permission
  from public.permission_requests
  where id = v_request.permission_request_id
    and account_id = p_account_id
    and artist_workspace_id = p_artist_workspace_id
    and artist_id = p_artist_id
  for update;

  if not found or v_permission.status <> 'pending' then
    raise exception 'release_request_not_pending';
  end if;
  if v_permission.expires_at is not null and v_permission.expires_at <= now() then
    raise exception 'release_request_expired';
  end if;

  select * into v_song
  from public.music_items
  where id = v_plan.music_item_id
    and account_id = p_account_id
    and artist_workspace_id = p_artist_workspace_id
    and artist_id = p_artist_id
  for update;

  if not found or v_song.released_at is not null
    or v_song.lifecycle_stage in ('released', 'catalog', 'archived') then
    raise exception 'release_already_live';
  end if;

  -- The preview records each currently open task deadline. Compare those
  -- values before writing so approval cannot silently apply a stale cascade.
  for v_preview_item in
    select value from jsonb_array_elements(coalesce(v_request.preview_json -> 'changes', '[]'::jsonb))
  loop
    select * into v_task
    from public.tasks
    where id = nullif(v_preview_item ->> 'taskId', '')::uuid
      and account_id = p_account_id
      and artist_workspace_id = p_artist_workspace_id
      and artist_id = p_artist_id
    for update;
    if not found then
      raise exception 'release_schedule_stale';
    end if;
    if v_task.deadline is distinct from nullif(v_preview_item ->> 'from', '')::timestamptz then
      raise exception 'release_schedule_stale';
    end if;
    select binding.offset_days into v_binding_offset
    from public.release_task_schedule_bindings binding
    where binding.release_plan_id = v_plan.id
      and binding.task_id = v_task.id
      and binding.account_id = p_account_id
      and binding.artist_workspace_id = p_artist_workspace_id
      and binding.artist_id = p_artist_id
      and binding.active
    for update;
    if not found then
      raise exception 'release_schedule_stale';
    end if;
    if nullif(v_preview_item ->> 'to', '') !~ '^\d{4}-\d{2}-\d{2}$' then
      raise exception 'release_preview_mismatch';
    end if;
    v_preview_to := to_date(v_preview_item ->> 'to', 'YYYY-MM-DD');
    if to_char(v_preview_to, 'YYYY-MM-DD') <> v_preview_item ->> 'to' then
      raise exception 'release_preview_mismatch';
    end if;
    if v_preview_to is distinct from v_request.proposed_date + v_binding_offset then
      raise exception 'release_preview_mismatch';
    end if;
  end loop;

  for v_binding in
    select binding.*, task.title, task.deadline, task.status as task_status
    from public.release_task_schedule_bindings binding
    join public.tasks task on task.id = binding.task_id
    where binding.release_plan_id = v_plan.id
      and binding.account_id = p_account_id
      and binding.artist_workspace_id = p_artist_workspace_id
      and binding.artist_id = p_artist_id
      and binding.active
      and task.status::text in ('open', 'proposed', 'needs_approval', 'approved', 'in_progress', 'blocked', 'missed', 'completed', 'archived')
    order by binding.offset_days, binding.task_id
    for update of task
  loop
    v_from_deadline := v_binding.deadline;
    if v_binding.task_status not in ('open', 'proposed', 'needs_approval', 'approved', 'in_progress', 'blocked', 'missed', 'completed', 'archived') then
      if not exists (
        select 1
        from jsonb_array_elements(coalesce(v_request.preview_json -> 'preserved', '[]'::jsonb)) item
        where item ->> 'taskId' = v_binding.task_id::text
      ) then
        raise exception 'release_schedule_stale';
      end if;
      v_preserved := v_preserved || jsonb_build_array(jsonb_build_object(
        'taskId', v_binding.task_id,
        'reason', 'inactive'
      ));
      continue;
    end if;
    if v_binding.task_status in ('completed', 'archived') then
      if not exists (
        select 1
        from jsonb_array_elements(coalesce(v_request.preview_json -> 'preserved', '[]'::jsonb)) item
        where item ->> 'taskId' = v_binding.task_id::text
      ) then
        raise exception 'release_schedule_stale';
      end if;
      v_preserved := v_preserved || jsonb_build_array(jsonb_build_object(
        'taskId', v_binding.task_id,
        'reason', case when v_binding.task_status = 'completed' then 'completed' else 'archived' end
      ));
      continue;
    end if;

    if not exists (
      select 1
      from jsonb_array_elements(coalesce(v_request.preview_json -> 'changes', '[]'::jsonb)) item
      where item ->> 'taskId' = v_binding.task_id::text
    ) then
      raise exception 'release_schedule_stale';
    end if;

    v_new_deadline := ((v_request.proposed_date + v_binding.offset_days)::timestamp at time zone 'UTC');
    update public.tasks
    set deadline = v_new_deadline,
        updated_at = now()
    where id = v_binding.task_id;

    update public.release_task_schedule_bindings
    set applied_plan_revision = v_plan.revision + 1,
        updated_at = now()
    where id = v_binding.id;

    v_moved := v_moved || jsonb_build_array(jsonb_build_object(
      'taskId', v_binding.task_id,
      'title', v_binding.title,
      'from', v_from_deadline,
      'to', v_new_deadline
    ));

    if v_new_deadline >= now()
      and (v_next_task is null or v_new_deadline < (v_next_task ->> 'deadline')::timestamptz) then
      v_next_task := jsonb_build_object(
        'taskId', v_binding.task_id,
        'title', v_binding.title,
        'deadline', v_new_deadline
      );
    end if;
  end loop;

  v_previous_revision := v_plan.revision;
  update public.music_release_plans
  set approved_release_date = v_request.proposed_date,
      status = 'approved',
      revision = revision + 1,
      approved_at = now(),
      approved_by = coalesce(p_approved_by, auth.uid()),
      updated_at = now()
  where id = v_plan.id;

  update public.permission_requests
  set status = 'approved',
      updated_at = now()
  where id = v_request.permission_request_id
    and status = 'pending';

  v_event_id := gen_random_uuid();
  insert into public.operating_events (
    id,
    account_id,
    artist_workspace_id,
    artist_id,
    event_type,
    actor_type,
    actor_id,
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
    v_event_id,
    p_account_id,
    p_artist_workspace_id,
    p_artist_id,
    'release_plan_changed',
    'user',
    coalesce(p_approved_by, auth.uid()),
    'music_item',
    v_plan.music_item_id,
    'release_plan_change',
    v_request.id,
    v_plan.mission_id,
    'release-plan-change:' || v_request.id::text,
    'activity',
    array['music', 'missions', 'desk', 'conversations'],
    'Updated the operational release date and release-bound mission deadlines.',
    jsonb_build_object(
      'request_id', v_request.id,
      'release_plan_id', v_plan.id,
      'previous_revision', v_previous_revision,
      'revision', v_plan.revision + 1,
      'from_date', v_request.from_date,
      'approved_date', v_request.proposed_date,
      'moved_count', jsonb_array_length(v_moved),
      'preserved_count', jsonb_array_length(v_preserved)
    )
  ) on conflict (artist_workspace_id, dedupe_key) where dedupe_key is not null do nothing;

  update public.release_date_change_requests
  set status = 'approved',
      approved_by = coalesce(p_approved_by, auth.uid()),
      approved_at = now(),
      result_json = jsonb_build_object(
        'requestId', v_request.id,
        'releasePlanId', v_plan.id,
        'musicItemId', v_plan.music_item_id,
        'missionId', v_plan.mission_id,
        'fromDate', v_request.from_date,
        'approvedDate', v_request.proposed_date,
        'previousRevision', v_previous_revision,
        'revision', v_plan.revision + 1,
        'moved', v_moved,
        'preserved', v_preserved,
        'nextDeadline', v_next_task,
        'operatingEventId', v_event_id
      ),
      updated_at = now()
  where id = v_request.id;

  return (select result_json from public.release_date_change_requests where id = v_request.id);
end;
$$;

revoke all on function public.propose_release_date_change(
  uuid, uuid, uuid, uuid, date, text, bigint, jsonb, text, timestamptz, text, uuid
) from public, anon, authenticated;

revoke all on function public.approve_release_date_change(
  uuid, uuid, uuid, uuid, text, text, uuid
) from public, anon, authenticated;

grant execute on function public.propose_release_date_change(
  uuid, uuid, uuid, uuid, date, text, bigint, jsonb, text, timestamptz, text, uuid
) to service_role;

grant execute on function public.approve_release_date_change(
  uuid, uuid, uuid, uuid, text, text, uuid
) to service_role;

notify pgrst, 'reload schema';
