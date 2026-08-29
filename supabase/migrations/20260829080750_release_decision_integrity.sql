-- Canonical release decision integrity for Manager Runtime.
--
-- Provider/imported release dates remain historical/provider truth on music_items.
-- The operational release plan is the source of truth once Desk has an approved
-- release-date decision. This migration publishes that state explicitly, mirrors
-- the approved decision into the World Model, retires stale release-date questions,
-- and wakes adaptive replanning exactly once after approval.

create or replace function public.manager_effective_release_state_v1(
  target_music_item_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  item_row public.music_items%rowtype;
  plan_row public.music_release_plans%rowtype;
  effective_date date;
  provenance text;
begin
  select * into item_row
  from public.music_items
  where id = target_music_item_id;

  if not found then
    return jsonb_build_object('status', 'not_found', 'musicItemId', target_music_item_id);
  end if;

  select * into plan_row
  from public.music_release_plans
  where music_item_id = item_row.id
    and account_id = item_row.account_id
    and artist_workspace_id = item_row.artist_workspace_id
    and artist_id = item_row.artist_id
  limit 1;

  if plan_row.id is not null
     and plan_row.approved_release_date is not null
     and plan_row.status <> 'cancelled' then
    effective_date := plan_row.approved_release_date;
    provenance := 'approved_release_plan';
  else
    effective_date := item_row.planned_release_date;
    provenance := case
      when item_row.planned_release_date is not null then 'provider_metadata'
      else 'unset'
    end;
  end if;

  return jsonb_build_object(
    'status', 'found',
    'musicItemId', item_row.id,
    'providerReleaseDate', item_row.planned_release_date,
    'approvedReleaseDate', plan_row.approved_release_date,
    'effectiveReleaseDate', effective_date,
    'provenance', provenance,
    'releasePlanId', plan_row.id,
    'releasePlanStatus', plan_row.status,
    'releasePlanRevision', coalesce(plan_row.revision, 0),
    'missionId', plan_row.mission_id,
    'approvedAt', plan_row.approved_at,
    'approvedBy', plan_row.approved_by
  );
end;
$$;

revoke all on function public.manager_effective_release_state_v1(uuid)
  from public, anon, authenticated;
grant execute on function public.manager_effective_release_state_v1(uuid)
  to service_role;

create or replace function public.apply_approved_release_decision_integrity_v1()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  plan_row public.music_release_plans%rowtype;
  existing_fact public.artist_operating_facts%rowtype;
  fact_scope_key_value text;
  review_key text;
begin
  -- Only a real transition into approved publishes a new canonical decision.
  -- Idempotent approval replays therefore cannot create duplicate facts/reviews.
  if new.status <> 'approved'
     or old.status is not distinct from new.status then
    return new;
  end if;

  select * into plan_row
  from public.music_release_plans
  where id = new.release_plan_id
    and account_id = new.account_id
    and artist_workspace_id = new.artist_workspace_id
    and artist_id = new.artist_id
  for update;

  if not found then
    raise exception 'Approved release decision has no matching release plan.';
  end if;
  if plan_row.approved_release_date is distinct from new.proposed_release_date then
    raise exception 'Approved release decision does not match canonical release plan state.';
  end if;

  if plan_row.mission_id is not null then
    fact_scope_key_value := 'mission:' || plan_row.mission_id::text;

    select * into existing_fact
    from public.artist_operating_facts f
    where f.artist_workspace_id = new.artist_workspace_id
      and f.fact_key = 'time.release_date'
      and f.scope_type = 'mission'
      and f.scope_key = fact_scope_key_value
      and f.status = 'active'
    for update;

    if existing_fact.id is not null then
      update public.artist_operating_facts
      set status = 'superseded',
          superseded_at = now(),
          updated_at = now()
      where id = existing_fact.id;
    end if;

    insert into public.artist_operating_facts (
      account_id, artist_workspace_id, artist_id,
      domain, fact_key, scope_type, scope_key,
      value_json, display_value, source_type, source_id,
      confidence, valid_from, valid_until, last_confirmed_at,
      status, supersedes_fact_id, metadata
    ) values (
      new.account_id, new.artist_workspace_id, new.artist_id,
      'time', 'time.release_date', 'mission', fact_scope_key_value,
      jsonb_build_object(
        'date', new.proposed_release_date,
        'musicItemId', plan_row.music_item_id,
        'releasePlanId', plan_row.id,
        'revision', plan_row.revision,
        'provenance', 'approved_release_plan'
      ),
      new.proposed_release_date::text,
      'manager_observation', new.id,
      'high', now(), null, now(),
      'active', existing_fact.id,
      jsonb_build_object(
        'decisionType', 'release_date_change',
        'releaseDateChangeRequestId', new.id,
        'approvalIdempotencyKey', new.approval_idempotency_key,
        'approvedBy', new.approved_by,
        'approvedAt', new.approved_at
      )
    );

    -- A durable approved decision answers any still-pending release-date question
    -- for this Mission. Do not retire unrelated time questions.
    update public.manager_question_requests q
    set status = 'superseded',
        metadata = coalesce(q.metadata, '{}'::jsonb) || jsonb_build_object(
          'supersededReason', 'canonical_release_date_approved',
          'releaseDateChangeRequestId', new.id,
          'approvedReleaseDate', new.proposed_release_date,
          'releasePlanRevision', plan_row.revision
        ),
        updated_at = now()
    where q.artist_workspace_id = new.artist_workspace_id
      and q.artist_id = new.artist_id
      and q.mission_id = plan_row.mission_id
      and q.status = 'pending'
      and q.fact_domain = 'time'
      and (
        q.fact_key ~* '(^|\.)release(_|\.)?date($|\.)'
        or q.question_key ~* 'release.*date|date.*release'
      );

    review_key := 'release-date-change:' || new.id::text || ':approved';
    insert into public.reviews (
      account_id, artist_workspace_id, artist_id, mission_id,
      trigger_type, trigger_object_type, trigger_object_id,
      current_read, what_changed, next_action,
      status, review_at, runtime_key
    ) values (
      new.account_id, new.artist_workspace_id, new.artist_id, plan_row.mission_id,
      'adaptive_replan', 'release_date_change_request', new.id,
      concat('The canonical approved operational release date is ', new.proposed_release_date::text,
        ' (release plan revision ', plan_row.revision::text, '). Provider/imported dates are not the current operating decision.'),
      concat('The artist approved moving the release date from ',
        coalesce(new.from_release_date::text, 'unset'), ' to ', new.proposed_release_date::text, '.'),
      'Replan from the approved release date. Supersede stale schedule assumptions and do not ask the artist to reconfirm this same release-date decision unless new evidence materially requires a new proposal.',
      'due', now(), review_key
    ) on conflict (artist_workspace_id, runtime_key)
      where runtime_key is not null do nothing;
  end if;

  return new;
end;
$$;

revoke all on function public.apply_approved_release_decision_integrity_v1()
  from public, anon, authenticated;
grant execute on function public.apply_approved_release_decision_integrity_v1()
  to service_role;

drop trigger if exists apply_approved_release_decision_integrity
  on public.release_date_change_requests;
create trigger apply_approved_release_decision_integrity
after update of status on public.release_date_change_requests
for each row
when (new.status = 'approved' and old.status is distinct from new.status)
execute function public.apply_approved_release_decision_integrity_v1();

-- Backfill the World Model projection for already-approved release plans without
-- mutating imported provider metadata. This is intentionally mission-scoped.
with approved as (
  select distinct on (rp.artist_workspace_id, rp.mission_id)
    rp.account_id,
    rp.artist_workspace_id,
    rp.artist_id,
    rp.mission_id,
    rp.music_item_id,
    rp.id as release_plan_id,
    rp.approved_release_date,
    rp.revision,
    rp.approved_at,
    rp.approved_by
  from public.music_release_plans rp
  where rp.mission_id is not null
    and rp.approved_release_date is not null
    and rp.status <> 'cancelled'
  order by rp.artist_workspace_id, rp.mission_id, rp.updated_at desc, rp.id desc
), superseded as (
  update public.artist_operating_facts f
  set status = 'superseded',
      superseded_at = now(),
      updated_at = now()
  from approved a
  where f.artist_workspace_id = a.artist_workspace_id
    and f.artist_id = a.artist_id
    and f.fact_key = 'time.release_date'
    and f.scope_type = 'mission'
    and f.scope_key = 'mission:' || a.mission_id::text
    and f.status = 'active'
  returning f.id
)
insert into public.artist_operating_facts (
  account_id, artist_workspace_id, artist_id,
  domain, fact_key, scope_type, scope_key,
  value_json, display_value, source_type, confidence,
  valid_from, last_confirmed_at, status, metadata
)
select
  a.account_id, a.artist_workspace_id, a.artist_id,
  'time', 'time.release_date', 'mission', 'mission:' || a.mission_id::text,
  jsonb_build_object(
    'date', a.approved_release_date,
    'musicItemId', a.music_item_id,
    'releasePlanId', a.release_plan_id,
    'revision', a.revision,
    'provenance', 'approved_release_plan'
  ),
  a.approved_release_date::text,
  'manager_observation', 'high',
  coalesce(a.approved_at, now()), coalesce(a.approved_at, now()), 'active',
  jsonb_build_object('decisionType', 'release_date_change', 'backfilled', true, 'approvedBy', a.approved_by)
from approved a
where not exists (
  select 1
  from public.artist_operating_facts f
  where f.artist_workspace_id = a.artist_workspace_id
    and f.artist_id = a.artist_id
    and f.fact_key = 'time.release_date'
    and f.scope_type = 'mission'
    and f.scope_key = 'mission:' || a.mission_id::text
    and f.status = 'active'
);
