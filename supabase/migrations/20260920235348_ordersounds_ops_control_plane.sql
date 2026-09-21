-- OrderSounds Ops control plane. This migration is additive: it introduces
-- internal relationship-management records without changing customer Desk
-- authorization, billing, entitlement, Teams, or Manager tables.

create schema if not exists private;

create table public.ordersounds_operators (
  user_id uuid primary key references public.users(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.ops_cases (
  id uuid primary key default gen_random_uuid(),
  display_name text not null check (btrim(display_name) <> ''),
  primary_contact_name text,
  primary_contact_email text,
  primary_contact_handle text,
  preferred_channel text,
  source text not null check (btrim(source) <> ''),
  stage text not null default 'new'
    check (stage in ('new', 'qualifying', 'meeting', 'activation', 'active', 'closed')),
  release_timing text not null
    check (release_timing in ('upcoming', 'released', 'unknown')),
  release_date date,
  -- Uploads are staged by inserting their target path before the object exists;
  -- the path is still a durable declaration of the supplied source.
  music_url text,
  music_file_path text,
  assigned_user_id uuid references public.users(id) on delete set null,
  desk_workspace_id uuid references public.artist_workspaces(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    nullif(btrim(primary_contact_email), '') is not null
    or nullif(btrim(primary_contact_handle), '') is not null
  ),
  check (music_url is not null or music_file_path is not null)
);

create table public.ops_meetings (
  id uuid primary key default gen_random_uuid(),
  ops_case_id uuid not null references public.ops_cases(id) on delete cascade,
  meeting_type text not null
    check (meeting_type in ('onboarding', 'check_in', 'monthly_review', 'other')),
  scheduled_at timestamptz,
  completed_at timestamptz,
  owner_user_id uuid references public.users(id) on delete set null,
  transcript text,
  outcome text
    check (outcome is null or outcome in ('ready_to_start', 'needs_follow_up', 'not_ready', 'inquiry_questions', 'not_a_fit')),
  processing_status text not null default 'unprocessed'
    check (processing_status in ('unprocessed', 'processing', 'processed', 'failed')),
  processed_at timestamptz,
  desk_run_id uuid references public.manager_synthesis_runs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (completed_at is null or scheduled_at is null or completed_at >= scheduled_at),
  check (processed_at is null or processing_status = 'processed')
);

create table public.ops_followups (
  id uuid primary key default gen_random_uuid(),
  ops_case_id uuid not null references public.ops_cases(id) on delete cascade,
  assigned_user_id uuid references public.users(id) on delete set null,
  due_at timestamptz not null,
  kind text not null check (btrim(kind) <> ''),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  check (completed_at is null or completed_at >= created_at)
);

create table public.ops_activity (
  id uuid primary key default gen_random_uuid(),
  ops_case_id uuid not null references public.ops_cases(id) on delete cascade,
  actor_user_id uuid references public.users(id) on delete set null,
  event_type text not null check (btrim(event_type) <> ''),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index ops_cases_stage_updated_idx on public.ops_cases(stage, updated_at desc);
create index ops_cases_assignee_stage_idx on public.ops_cases(assigned_user_id, stage);
create index ops_cases_workspace_idx on public.ops_cases(desk_workspace_id) where desk_workspace_id is not null;
create index ops_meetings_case_scheduled_idx on public.ops_meetings(ops_case_id, scheduled_at desc);
create index ops_meetings_processing_idx on public.ops_meetings(processing_status, completed_at desc);
create index ops_followups_open_due_idx on public.ops_followups(due_at, ops_case_id) where completed_at is null;
create index ops_activity_case_created_idx on public.ops_activity(ops_case_id, created_at desc);

create or replace function private.is_active_ordersounds_operator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.ordersounds_operators operator_row
    where operator_row.user_id = (select auth.uid())
      and operator_row.active = true
  );
$$;

revoke all on function private.is_active_ordersounds_operator() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_active_ordersounds_operator() to authenticated;

alter table public.ordersounds_operators enable row level security;
alter table public.ops_cases enable row level security;
alter table public.ops_meetings enable row level security;
alter table public.ops_followups enable row level security;
alter table public.ops_activity enable row level security;

revoke all on table public.ordersounds_operators, public.ops_cases, public.ops_meetings, public.ops_followups, public.ops_activity from public;
revoke all on table public.ordersounds_operators, public.ops_cases, public.ops_meetings, public.ops_followups, public.ops_activity from anon;
revoke all on table public.ordersounds_operators, public.ops_cases, public.ops_meetings, public.ops_followups, public.ops_activity from authenticated;
grant select on table public.ordersounds_operators to authenticated;
grant select, insert, update on table public.ops_cases, public.ops_meetings, public.ops_followups to authenticated;
grant select on table public.ops_activity to authenticated;
grant all on table public.ordersounds_operators, public.ops_cases, public.ops_meetings, public.ops_followups, public.ops_activity to service_role;

create policy ordersounds_operators_self_select
on public.ordersounds_operators for select to authenticated
using (user_id = (select auth.uid()) and active = true);

create policy ops_cases_operator_select
on public.ops_cases for select to authenticated
using ((select private.is_active_ordersounds_operator()));

create policy ops_cases_operator_insert
on public.ops_cases for insert to authenticated
with check ((select private.is_active_ordersounds_operator()));

create policy ops_cases_operator_update
on public.ops_cases for update to authenticated
using ((select private.is_active_ordersounds_operator()))
with check ((select private.is_active_ordersounds_operator()));

create policy ops_meetings_operator_select
on public.ops_meetings for select to authenticated
using ((select private.is_active_ordersounds_operator()));

create policy ops_meetings_operator_insert
on public.ops_meetings for insert to authenticated
with check ((select private.is_active_ordersounds_operator()));

create policy ops_meetings_operator_update
on public.ops_meetings for update to authenticated
using ((select private.is_active_ordersounds_operator()))
with check ((select private.is_active_ordersounds_operator()));

create policy ops_followups_operator_select
on public.ops_followups for select to authenticated
using ((select private.is_active_ordersounds_operator()));

create policy ops_followups_operator_insert
on public.ops_followups for insert to authenticated
with check ((select private.is_active_ordersounds_operator()));

create policy ops_followups_operator_update
on public.ops_followups for update to authenticated
using ((select private.is_active_ordersounds_operator()))
with check ((select private.is_active_ordersounds_operator()));

create policy ops_activity_operator_select
on public.ops_activity for select to authenticated
using ((select private.is_active_ordersounds_operator()));

create or replace function private.prevent_ops_activity_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'ops_activity_is_append_only' using errcode = '42501';
end;
$$;

create trigger ops_activity_immutable_guard
before update or delete on public.ops_activity
for each row execute function private.prevent_ops_activity_mutation();

create or replace function private.record_ops_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  case_id uuid;
  event_name text;
  details jsonb := '{}'::jsonb;
begin
  if tg_table_name = 'ops_cases' then
    case_id := coalesce(new.id, old.id);
    if tg_op = 'INSERT' then
      event_name := 'case_created';
      details := jsonb_build_object('stage', new.stage, 'source', new.source);
    elsif new.desk_workspace_id is distinct from old.desk_workspace_id then
      event_name := case when old.desk_workspace_id is null then 'desk_workspace_linked' else 'desk_workspace_relinked' end;
      details := jsonb_build_object('previousWorkspaceId', old.desk_workspace_id, 'workspaceId', new.desk_workspace_id);
    else
      event_name := 'case_updated';
      details := jsonb_build_object('stage', new.stage);
    end if;
  elsif tg_table_name = 'ops_meetings' then
    case_id := new.ops_case_id;
    if tg_op = 'INSERT' then
      event_name := 'meeting_created';
      details := jsonb_build_object('meetingId', new.id, 'meetingType', new.meeting_type);
    elsif new.completed_at is distinct from old.completed_at and new.completed_at is not null then
      event_name := 'meeting_completed';
      details := jsonb_build_object('meetingId', new.id, 'outcome', new.outcome);
    elsif coalesce(length(new.transcript), 0) <> coalesce(length(old.transcript), 0) and new.transcript is not null then
      event_name := 'transcript_saved';
      details := jsonb_build_object('meetingId', new.id, 'transcriptLength', length(new.transcript));
    else
      event_name := 'meeting_updated';
      details := jsonb_build_object('meetingId', new.id, 'processingStatus', new.processing_status);
    end if;
  else
    case_id := new.ops_case_id;
    if tg_op = 'INSERT' then
      event_name := 'followup_created';
      details := jsonb_build_object('followupId', new.id, 'kind', new.kind, 'dueAt', new.due_at);
    elsif old.completed_at is null and new.completed_at is not null then
      event_name := 'followup_completed';
      details := jsonb_build_object('followupId', new.id, 'completedAt', new.completed_at);
    else
      event_name := 'followup_updated';
      details := jsonb_build_object('followupId', new.id, 'dueAt', new.due_at);
    end if;
  end if;

  insert into public.ops_activity (ops_case_id, actor_user_id, event_type, metadata)
  values (case_id, (select auth.uid()), event_name, details);
  return new;
end;
$$;

revoke all on function private.record_ops_activity() from public, anon, authenticated;

create trigger ops_cases_activity
after insert or update on public.ops_cases
for each row execute function private.record_ops_activity();

create trigger ops_meetings_activity
after insert or update on public.ops_meetings
for each row execute function private.record_ops_activity();

create trigger ops_followups_activity
after insert or update on public.ops_followups
for each row execute function private.record_ops_activity();

drop trigger if exists ops_cases_set_updated_at on public.ops_cases;
create trigger ops_cases_set_updated_at before update on public.ops_cases for each row execute function public.set_updated_at();
drop trigger if exists ops_meetings_set_updated_at on public.ops_meetings;
create trigger ops_meetings_set_updated_at before update on public.ops_meetings for each row execute function public.set_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ops-music',
  'ops-music',
  false,
  52428800,
  array['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav', 'audio/flac', 'audio/aac']::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy ops_music_operator_select
on storage.objects for select to authenticated
using (
  bucket_id = 'ops-music'
  and (select private.is_active_ordersounds_operator())
  and exists (select 1 from public.ops_cases case_row where case_row.id::text = split_part(name, '/', 1))
);

create policy ops_music_operator_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'ops-music'
  and (select private.is_active_ordersounds_operator())
  and exists (select 1 from public.ops_cases case_row where case_row.id::text = split_part(name, '/', 1))
);

create policy ops_music_operator_update
on storage.objects for update to authenticated
using (
  bucket_id = 'ops-music'
  and (select private.is_active_ordersounds_operator())
  and exists (select 1 from public.ops_cases case_row where case_row.id::text = split_part(name, '/', 1))
)
with check (
  bucket_id = 'ops-music'
  and (select private.is_active_ordersounds_operator())
  and exists (select 1 from public.ops_cases case_row where case_row.id::text = split_part(name, '/', 1))
);

create or replace function public.list_ops_linkable_workspaces_v1(p_query text, p_limit integer default 20)
returns table (
  artist_workspace_id uuid,
  workspace_name text,
  workspace_status public.workspace_status,
  artist_name text,
  account_id uuid,
  account_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  query_text text := btrim(coalesce(p_query, ''));
  result_limit integer := greatest(1, least(coalesce(p_limit, 20), 50));
begin
  if not private.is_active_ordersounds_operator() then
    raise exception 'ops_operator_required' using errcode = '42501';
  end if;
  if length(query_text) < 2 then
    return;
  end if;

  return query
  select workspace.id, workspace.name, workspace.status, artist.display_name, account.id, account.name
  from public.artist_workspaces workspace
  join public.artists artist on artist.id = workspace.artist_id and artist.account_id = workspace.account_id
  join public.accounts account on account.id = workspace.account_id
  where workspace.name ilike '%' || query_text || '%'
     or artist.display_name ilike '%' || query_text || '%'
     or account.name ilike '%' || query_text || '%'
     or workspace.id::text = query_text
     or account.id::text = query_text
  order by artist.display_name, workspace.name
  limit result_limit;
end;
$$;

create or replace function public.link_ops_case_workspace_v1(
  p_ops_case_id uuid,
  p_artist_workspace_id uuid,
  p_expected_current_workspace_id uuid
)
returns public.ops_cases
language plpgsql
security definer
set search_path = public
as $$
declare
  case_row public.ops_cases%rowtype;
  workspace_exists boolean;
begin
  if not private.is_active_ordersounds_operator() then
    raise exception 'ops_operator_required' using errcode = '42501';
  end if;

  select exists (select 1 from public.artist_workspaces where id = p_artist_workspace_id)
    into workspace_exists;
  if not workspace_exists then
    raise exception 'ops_workspace_not_found' using errcode = 'P0002';
  end if;

  select * into case_row
  from public.ops_cases
  where id = p_ops_case_id
  for update;
  if case_row.id is null then
    raise exception 'ops_case_not_found' using errcode = 'P0002';
  end if;
  if case_row.desk_workspace_id is distinct from p_expected_current_workspace_id then
    raise exception 'ops_case_stale_link' using errcode = '40001';
  end if;

  update public.ops_cases
  set desk_workspace_id = p_artist_workspace_id,
      stage = case when stage = 'activation' then 'active' else stage end
  where id = p_ops_case_id
  returning * into case_row;
  return case_row;
end;
$$;

create or replace function public.list_ops_today_v1(p_now timestamptz default now())
returns table (
  item_key text,
  kind text,
  priority integer,
  case_id uuid,
  meeting_id uuid,
  followup_id uuid,
  display_name text,
  reason text,
  action text,
  due_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not private.is_active_ordersounds_operator() then
    raise exception 'ops_operator_required' using errcode = '42501';
  end if;

  return query
  with items as (
    select
      'meeting-failed:' || meeting.id::text as item_key,
      'failed_processing'::text as kind,
      10 as priority,
      case_row.id as case_id,
      meeting.id as meeting_id,
      null::uuid as followup_id,
      case_row.display_name,
      'Desk processing failed and needs attention.'::text as reason,
      'Retry'::text as action,
      coalesce(meeting.completed_at, meeting.updated_at) as due_at
    from public.ops_meetings meeting
    join public.ops_cases case_row on case_row.id = meeting.ops_case_id
    where meeting.processing_status = 'failed'

    union all

    select
      'followup-overdue:' || followup.id::text,
      'overdue_followup',
      20,
      case_row.id,
      null::uuid,
      followup.id,
      case_row.display_name,
      'Follow-up is due.'::text,
      'Follow up'::text,
      followup.due_at
    from public.ops_followups followup
    join public.ops_cases case_row on case_row.id = followup.ops_case_id
    where followup.completed_at is null and followup.due_at <= p_now

    union all

    select
      'meeting-today:' || meeting.id::text,
      'meeting_today',
      30,
      case_row.id,
      meeting.id,
      null::uuid,
      case_row.display_name,
      'Meeting is scheduled today.'::text,
      'Open meeting'::text,
      meeting.scheduled_at
    from public.ops_meetings meeting
    join public.ops_cases case_row on case_row.id = meeting.ops_case_id
    where meeting.scheduled_at >= date_trunc('day', p_now)
      and meeting.scheduled_at < date_trunc('day', p_now) + interval '1 day'

    union all

    select
      'transcript-missing:' || meeting.id::text,
      'transcript_missing',
      40,
      case_row.id,
      meeting.id,
      null::uuid,
      case_row.display_name,
      'Meeting is complete but the transcript is missing.'::text,
      'Paste transcript'::text,
      meeting.completed_at
    from public.ops_meetings meeting
    join public.ops_cases case_row on case_row.id = meeting.ops_case_id
    where meeting.completed_at is not null and nullif(btrim(meeting.transcript), '') is null

    union all

    select
      'transcript-ready:' || meeting.id::text,
      'transcript_ready',
      50,
      case_row.id,
      meeting.id,
      null::uuid,
      case_row.display_name,
      'Transcript is ready to process in Desk.'::text,
      'Process in Desk'::text,
      coalesce(meeting.completed_at, meeting.updated_at)
    from public.ops_meetings meeting
    join public.ops_cases case_row on case_row.id = meeting.ops_case_id
    where nullif(btrim(meeting.transcript), '') is not null
      and case_row.desk_workspace_id is not null
      and meeting.processing_status = 'unprocessed'

    union all

    select
      'desk-link-missing:' || case_row.id::text,
      'desk_link_missing',
      60,
      case_row.id,
      null::uuid,
      null::uuid,
      case_row.display_name,
      'Customer is expected to activate but Desk is not linked.'::text,
      'Link Desk'::text,
      case_row.updated_at
    from public.ops_cases case_row
    where case_row.stage = 'activation' and case_row.desk_workspace_id is null
  )
  select item_key, kind, priority, case_id, meeting_id, followup_id, display_name, reason, action, due_at
  from items
  order by priority, due_at nulls last, lower(display_name), item_key;
end;
$$;

revoke all on function public.list_ops_linkable_workspaces_v1(text, integer) from public, anon;
revoke all on function public.link_ops_case_workspace_v1(uuid, uuid, uuid) from public, anon;
revoke all on function public.list_ops_today_v1(timestamptz) from public, anon;
grant execute on function public.list_ops_linkable_workspaces_v1(text, integer) to authenticated;
grant execute on function public.link_ops_case_workspace_v1(uuid, uuid, uuid) to authenticated;
grant execute on function public.list_ops_today_v1(timestamptz) to authenticated;

notify pgrst, 'reload schema';
