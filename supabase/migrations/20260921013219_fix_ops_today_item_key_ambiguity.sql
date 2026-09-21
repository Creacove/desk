-- Fix the ambiguous output-column reference in the deployed Ops Today RPC.
-- The function's RETURNS TABLE item_key is also a PL/pgSQL variable, so qualify
-- the CTE columns in the final RETURN QUERY.

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
  select items.item_key, items.kind, items.priority, items.case_id, items.meeting_id, items.followup_id,
         items.display_name, items.reason, items.action, items.due_at
  from items
  order by items.priority, items.due_at nulls last, lower(items.display_name), items.item_key;
end;
$$;

revoke all on function public.list_ops_today_v1(timestamptz) from public, anon;
grant execute on function public.list_ops_today_v1(timestamptz) to authenticated;

notify pgrst, 'reload schema';
