-- Gate 5 correction: Artist Understanding is semantic knowledge, not a second copy of
-- documents or the World Model. Runtime context assembles these canonical sources together.

-- Remove provisional capture paths that copied raw source material and operating facts into
-- artist_understandings. Documents remain evidence; artist_operating_facts remains the
-- canonical owner of operational reality.
drop trigger if exists documents_capture_artist_understanding on public.documents;
drop trigger if exists artist_operating_facts_capture_understanding on public.artist_operating_facts;
drop function if exists public.capture_artist_understanding_document_trigger_v1();
drop function if exists public.capture_artist_understanding_from_document_v1(uuid);
drop function if exists public.capture_artist_understanding_from_operating_fact_v1();

delete from public.artist_understandings
where category = 'source_material'
   or (source_type = 'operating_fact' and understanding_key like 'fact.%');

-- Clients may read semantic understanding through RLS, but only trusted server-side Manager
-- paths may author/supersede it. This prevents a client from forging artist_confirmed authority.
drop policy if exists artist_understandings_member_insert on public.artist_understandings;
drop policy if exists artist_understandings_member_update on public.artist_understandings;
revoke insert, update on public.artist_understandings from authenticated;
grant select on public.artist_understandings to authenticated;
grant select, insert, update on public.artist_understandings to service_role;

-- PostgreSQL functions are executable by PUBLIC unless explicitly revoked. Revoke both PUBLIC
-- and authenticated before granting the mutation path only to the service role.
revoke execute on function public.upsert_artist_understanding_v1(
  uuid,uuid,uuid,public.artist_understanding_scope,uuid,text,text,text,jsonb,
  public.artist_understanding_source_kind,text,uuid,text,public.evidence_confidence,
  public.artist_understanding_authority,uuid,public.created_by_type
) from public, authenticated;
grant execute on function public.upsert_artist_understanding_v1(
  uuid,uuid,uuid,public.artist_understanding_scope,uuid,text,text,text,jsonb,
  public.artist_understanding_source_kind,text,uuid,text,public.evidence_confidence,
  public.artist_understanding_authority,uuid,public.created_by_type
) to service_role;

-- The snapshot is a projection for Manager context, never a second source of truth.
-- Authenticated callers are constrained to their account membership; service-role Manager
-- runtimes may read the scoped workspace directly.
create or replace function public.manager_artist_understanding_snapshot_v1(
  p_artist_workspace_id uuid,
  p_artist_id uuid
) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare
  workspace_account_id uuid;
  jwt_role text;
  result jsonb;
begin
  select w.account_id into workspace_account_id
  from public.artist_workspaces w
  where w.id = p_artist_workspace_id and w.artist_id = p_artist_id;

  if workspace_account_id is null then
    return '[]'::jsonb;
  end if;

  jwt_role := coalesce(current_setting('request.jwt.claim.role', true), '');
  if jwt_role <> 'service_role' and not public.is_account_member(workspace_account_id) then
    raise exception 'Not authorized to read artist understanding.' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',u.id,
      'scopeType',u.scope_type,
      'scopeId',u.scope_id,
      'key',u.understanding_key,
      'category',u.category,
      'statement',u.statement,
      'value',u.structured_value,
      'sourceKind',u.source_kind,
      'sourceType',u.source_type,
      'sourceId',u.source_id,
      'sourceRef',u.source_ref,
      'confidence',u.confidence,
      'authority',u.authority,
      'updatedAt',u.updated_at
    )
    order by case u.authority
      when 'artist_confirmed' then 4
      when 'trusted_source' then 3
      when 'supported' then 2
      else 1
    end desc, u.updated_at desc
  ), '[]'::jsonb)
  into result
  from public.artist_understandings u
  where u.artist_workspace_id = p_artist_workspace_id
    and u.artist_id = p_artist_id
    and u.status = 'current';

  return result;
end;
$$;

revoke execute on function public.manager_artist_understanding_snapshot_v1(uuid,uuid) from public;
grant execute on function public.manager_artist_understanding_snapshot_v1(uuid,uuid) to authenticated, service_role;

comment on table public.artist_understandings is
  'Canonical semantic understanding: artist identity, music meaning, themes, cultural context, creative intent, narrative and positioning. Operational reality stays in artist_operating_facts; documents stay source evidence.';
