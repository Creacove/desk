-- Make semantic-understanding ingestion lease-owned, admission-aware, and atomic.
-- An expired worker must never persist or complete work after a newer worker reclaims it.

alter table public.artist_understanding_ingestion_queue
  add column if not exists lease_token uuid;

create or replace function public.claim_artist_understanding_ingestion_v1(batch_size integer default 1)
returns setof public.artist_understanding_ingestion_queue
language plpgsql security definer set search_path=public as $$
begin
  return query
  with candidates as (
    select q.id
    from public.artist_understanding_ingestion_queue q
    left join public.manager_runtime_limits limits
      on limits.account_id=q.account_id
     and limits.artist_workspace_id=q.artist_workspace_id
     and limits.artist_id=q.artist_id
    where (
      q.status='queued'
      or (q.status='processing' and q.locked_at < now() - interval '5 minutes')
    )
      and q.attempt_count < q.max_attempts
      and coalesce(limits.background_ai_enabled,true)
    order by q.created_at asc
    for update of q skip locked
    limit greatest(1, least(coalesce(batch_size,1),20))
  )
  update public.artist_understanding_ingestion_queue q
  set status='processing',
      attempt_count=q.attempt_count+1,
      locked_at=now(),
      lease_token=gen_random_uuid(),
      last_error=null,
      updated_at=now()
  from candidates c
  where q.id=c.id
  returning q.*;
end;
$$;
revoke all on function public.claim_artist_understanding_ingestion_v1(integer) from public,anon,authenticated;
grant execute on function public.claim_artist_understanding_ingestion_v1(integer) to service_role;

create or replace function public.defer_artist_understanding_ingestion_v1(
  p_queue_id uuid,
  p_lease_token uuid,
  p_reason text
) returns boolean
language plpgsql security definer set search_path=public as $$
begin
  update public.artist_understanding_ingestion_queue q
  set status='queued',
      attempt_count=greatest(0,q.attempt_count-1),
      locked_at=null,
      lease_token=null,
      last_error=left(coalesce(p_reason,'Manager runtime admission deferred.'),1000),
      updated_at=now()
  where q.id=p_queue_id and q.status='processing' and q.lease_token=p_lease_token;
  return found;
end;
$$;
revoke all on function public.defer_artist_understanding_ingestion_v1(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.defer_artist_understanding_ingestion_v1(uuid,uuid,text) to service_role;

create or replace function public.fail_artist_understanding_ingestion_v2(
  p_queue_id uuid,
  p_lease_token uuid,
  p_error text
) returns boolean
language plpgsql security definer set search_path=public as $$
begin
  update public.artist_understanding_ingestion_queue q
  set status=case when q.attempt_count >= q.max_attempts then 'failed' else 'queued' end,
      locked_at=null,
      lease_token=null,
      last_error=left(coalesce(p_error,'Unknown ingestion failure'),1000),
      updated_at=now()
  where q.id=p_queue_id and q.status='processing' and q.lease_token=p_lease_token;
  return found;
end;
$$;
revoke all on function public.fail_artist_understanding_ingestion_v2(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.fail_artist_understanding_ingestion_v2(uuid,uuid,text) to service_role;

create or replace function public.complete_artist_understanding_ingestion_v2(
  p_queue_id uuid,
  p_lease_token uuid
) returns boolean
language plpgsql security definer set search_path=public as $$
begin
  update public.artist_understanding_ingestion_queue q
  set status='completed',completed_at=now(),locked_at=null,lease_token=null,last_error=null,updated_at=now()
  where q.id=p_queue_id and q.status='processing' and q.lease_token=p_lease_token;
  return found;
end;
$$;
revoke all on function public.complete_artist_understanding_ingestion_v2(uuid,uuid) from public,anon,authenticated;
grant execute on function public.complete_artist_understanding_ingestion_v2(uuid,uuid) to service_role;

create or replace function public.finalize_artist_understanding_ingestion_v1(
  p_queue_id uuid,
  p_lease_token uuid,
  p_claims jsonb,
  p_source_label text,
  p_source_kind public.artist_understanding_source_kind,
  p_source_ref text
) returns boolean
language plpgsql security definer set search_path=public as $$
declare
  q public.artist_understanding_ingestion_queue%rowtype;
  claim jsonb;
  claim_scope public.artist_understanding_scope;
  claim_scope_id uuid;
  claim_confidence public.evidence_confidence;
  claim_authority public.artist_understanding_authority;
  claim_created_by public.created_by_type;
  claim_source_type text;
begin
  select * into q
  from public.artist_understanding_ingestion_queue
  where id=p_queue_id
  for update;

  if q.id is null or q.status<>'processing' or q.lease_token is distinct from p_lease_token then
    return false;
  end if;
  if jsonb_typeof(coalesce(p_claims,'[]'::jsonb))<>'array' or jsonb_array_length(coalesce(p_claims,'[]'::jsonb))>18 then
    raise exception 'Artist understanding claims payload is invalid.';
  end if;

  if q.source_kind in ('conversation_message','context_answer') then
    if p_source_kind<>'artist_statement' then raise exception 'Artist-controlled understanding must use artist_statement provenance.';end if;
    claim_authority:='artist_confirmed';
    claim_created_by:='user';
    claim_source_type:=q.source_kind;
  else
    if p_source_kind not in ('lyrics_document','uploaded_document') then raise exception 'Document understanding provenance is invalid.';end if;
    claim_authority:='supported';
    claim_created_by:='manager';
    claim_source_type:='document_semantic_extraction';

    update public.artist_understandings
    set status='superseded'
    where account_id=q.account_id
      and artist_workspace_id=q.artist_workspace_id
      and artist_id=q.artist_id
      and status='current'
      and source_type='document_semantic_extraction'
      and source_id=q.source_id
      and source_ref is distinct from p_source_ref;
  end if;

  for claim in select value from jsonb_array_elements(coalesce(p_claims,'[]'::jsonb)) loop
    claim_scope:=(claim->>'scopeType')::public.artist_understanding_scope;
    claim_scope_id:=case when claim_scope='artist' then null else nullif(claim->>'scopeId','')::uuid end;
    claim_confidence:=case claim->>'confidence' when 'high' then 'high'::public.evidence_confidence when 'low' then 'low'::public.evidence_confidence else 'medium'::public.evidence_confidence end;
    if claim_authority='artist_confirmed' and coalesce((claim->>'directlyAsserted')::boolean,false) is not true then
      raise exception 'Artist-confirmed understanding must be directly asserted.';
    end if;
    perform public.upsert_artist_understanding_v1(
      q.account_id,q.artist_workspace_id,q.artist_id,claim_scope,claim_scope_id,
      left(trim(claim->>'key'),160),left(trim(claim->>'category'),120),left(trim(claim->>'statement'),700),
      jsonb_build_object('extractedFrom',left(coalesce(p_source_label,''),240),'directlyAsserted',coalesce((claim->>'directlyAsserted')::boolean,false)),
      p_source_kind,claim_source_type,q.source_id,left(p_source_ref,1000),claim_confidence,
      claim_authority,null,claim_created_by
    );
  end loop;

  if jsonb_array_length(coalesce(p_claims,'[]'::jsonb))=0 and q.source_kind='document' then
    perform public.sync_manager_knowledge_projection_v1(q.account_id,q.artist_workspace_id,q.artist_id);
  end if;

  update public.artist_understanding_ingestion_queue target
  set status='completed',completed_at=now(),locked_at=null,lease_token=null,last_error=null,updated_at=now()
  where target.id=q.id and target.status='processing' and target.lease_token=p_lease_token;
  return found;
end;
$$;
revoke all on function public.finalize_artist_understanding_ingestion_v1(uuid,uuid,jsonb,text,public.artist_understanding_source_kind,text) from public,anon,authenticated;
grant execute on function public.finalize_artist_understanding_ingestion_v1(uuid,uuid,jsonb,text,public.artist_understanding_source_kind,text) to service_role;

-- Remove the tokenless mutation endpoints after the worker moves to the owned variants.
revoke all on function public.complete_artist_understanding_ingestion_v1(uuid) from public,anon,authenticated,service_role;
revoke all on function public.fail_artist_understanding_ingestion_v1(uuid,text) from public,anon,authenticated,service_role;
