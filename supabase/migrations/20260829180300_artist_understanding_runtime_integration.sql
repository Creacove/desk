-- Gate 5 runtime integration: one Manager knowledge contract, durable ingestion queue,
-- and projections into the existing reasoning surfaces. Canonical ownership remains:
-- artist_understandings = semantic meaning/identity; artist_operating_facts = operational reality.

create table if not exists public.artist_understanding_ingestion_queue (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  artist_workspace_id uuid not null references public.artist_workspaces(id) on delete cascade,
  artist_id uuid not null references public.artists(id) on delete cascade,
  source_kind text not null check (source_kind in ('conversation_message','context_answer','document')),
  source_id uuid not null,
  source_version_id uuid,
  status text not null default 'queued' check (status in ('queued','processing','completed','failed')),
  attempt_count integer not null default 0,
  max_attempts integer not null default 5,
  locked_at timestamptz,
  completed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists artist_understanding_ingestion_dedupe_idx
on public.artist_understanding_ingestion_queue (
  artist_workspace_id,
  source_kind,
  source_id,
  coalesce(source_version_id, '00000000-0000-0000-0000-000000000000'::uuid)
);

create index if not exists artist_understanding_ingestion_due_idx
on public.artist_understanding_ingestion_queue (status, created_at)
where status in ('queued','processing');

alter table public.artist_understanding_ingestion_queue enable row level security;
grant select, insert, update on public.artist_understanding_ingestion_queue to service_role;
revoke all on public.artist_understanding_ingestion_queue from anon, authenticated;

create trigger artist_understanding_ingestion_queue_set_updated_at
before update on public.artist_understanding_ingestion_queue
for each row execute function public.set_updated_at();

-- This is the canonical Manager knowledge projection. It assembles, rather than copies,
-- the two owners of durable knowledge and can optionally focus semantic claims to one song/project.
create or replace function public.manager_knowledge_context_v1(
  p_account_id uuid,
  p_artist_workspace_id uuid,
  p_artist_id uuid,
  p_focus_type text default null,
  p_focus_id uuid default null
) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare
  semantic jsonb;
  operating jsonb;
  workspace_account_id uuid;
  jwt_role text;
begin
  select w.account_id into workspace_account_id
  from public.artist_workspaces w
  where w.id = p_artist_workspace_id
    and w.account_id = p_account_id
    and w.artist_id = p_artist_id;

  if workspace_account_id is null then
    raise exception 'Manager knowledge workspace scope is invalid.' using errcode='22023';
  end if;

  jwt_role := coalesce(current_setting('request.jwt.claim.role', true), '');
  -- Empty role is an internal database/trigger invocation. Authenticated API calls
  -- carry their JWT role and must pass membership; service-role Manager runtimes bypass it.
  if jwt_role not in ('', 'service_role') and not public.is_account_member(workspace_account_id) then
    raise exception 'Not authorized to read Manager knowledge.' using errcode='42501';
  end if;

  select coalesce(jsonb_agg(item order by authority_rank desc, updated_at desc), '[]'::jsonb)
  into semantic
  from (
    select jsonb_build_object(
      'id', u.id,
      'scopeType', u.scope_type,
      'scopeId', u.scope_id,
      'key', u.understanding_key,
      'category', u.category,
      'statement', u.statement,
      'value', u.structured_value,
      'sourceKind', u.source_kind,
      'sourceType', u.source_type,
      'sourceId', u.source_id,
      'sourceRef', u.source_ref,
      'confidence', u.confidence,
      'authority', u.authority,
      'updatedAt', u.updated_at
    ) as item,
    case u.authority when 'artist_confirmed' then 4 when 'trusted_source' then 3 when 'supported' then 2 else 1 end as authority_rank,
    u.updated_at
    from public.artist_understandings u
    where u.account_id = p_account_id
      and u.artist_workspace_id = p_artist_workspace_id
      and u.artist_id = p_artist_id
      and u.status = 'current'
      and (
        p_focus_type is null
        or u.scope_type = 'artist'
        or (p_focus_type = 'music_item' and u.scope_type = 'music_item' and u.scope_id = p_focus_id)
        or (p_focus_type = 'music_project' and u.scope_type = 'music_project' and u.scope_id = p_focus_id)
      )
    order by authority_rank desc, u.updated_at desc
    limit 80
  ) ranked;

  select coalesce(jsonb_agg(item order by created_at desc), '[]'::jsonb)
  into operating
  from (
    select jsonb_build_object(
      'id', f.id,
      'domain', f.domain,
      'key', f.fact_key,
      'scopeType', f.scope_type,
      'scopeKey', f.scope_key,
      'value', f.value_json,
      'displayValue', f.display_value,
      'sourceType', f.source_type,
      'confidence', f.confidence,
      'validFrom', f.valid_from,
      'validUntil', f.valid_until,
      'lastConfirmedAt', f.last_confirmed_at,
      'createdAt', f.created_at
    ) as item,
    f.created_at
    from public.artist_operating_facts f
    where f.account_id = p_account_id
      and f.artist_workspace_id = p_artist_workspace_id
      and f.artist_id = p_artist_id
      and f.status = 'active'
      and (f.valid_until is null or f.valid_until > now())
    order by f.created_at desc
    limit 80
  ) ranked_facts;

  return jsonb_build_object(
    'contractVersion', 'manager-knowledge-v1',
    'semanticUnderstanding', semantic,
    'operatingReality', operating,
    'rules', jsonb_build_array(
      'Artist Understanding owns semantic meaning, identity, themes, cultural context, creative intent, narrative and positioning.',
      'World Model operating facts own resources, access, collaborators, constraints, preferences, goals and current operating reality.',
      'Artist-confirmed semantic understanding outranks supported or inferred interpretation.',
      'Use relevant semantic understanding and operating reality before asking the artist or choosing work.',
      'Documents and lyrics are source evidence; derived Manager Reads and intelligence packets never outrank this canonical knowledge.'
    )
  );
end;
$$;

revoke all on function public.manager_knowledge_context_v1(uuid,uuid,uuid,text,uuid) from public, anon;
grant execute on function public.manager_knowledge_context_v1(uuid,uuid,uuid,text,uuid) to authenticated, service_role;

-- Materialize the current knowledge contract only as a disposable runtime projection.
-- Existing Mission Genesis, review, adaptive replan and conversation paths already consume
-- memory_entries, while Song Manager Read and Manager Intelligence consume the current packet.
create unique index if not exists memory_entries_manager_knowledge_current_idx
on public.memory_entries (artist_workspace_id, artist_id, source_type)
where source_type = 'manager_knowledge_v1';

create or replace function public.sync_manager_knowledge_projection_v1(
  p_account_id uuid,
  p_artist_workspace_id uuid,
  p_artist_id uuid
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  knowledge jsonb;
  latest_packet_id uuid;
begin
  knowledge := public.manager_knowledge_context_v1(
    p_account_id,
    p_artist_workspace_id,
    p_artist_id,
    null,
    null
  );

  insert into public.memory_entries (
    account_id, artist_workspace_id, artist_id, scope, kind, content,
    source_type, confidence, reason, payload
  ) values (
    p_account_id, p_artist_workspace_id, p_artist_id, 'artist', 'fact', knowledge::text,
    'manager_knowledge_v1', 'high',
    'Canonical current Manager knowledge projection. Semantic understanding and operating reality here outrank ordinary historical memory and derived Manager reads when they conflict.',
    knowledge
  )
  on conflict (artist_workspace_id, artist_id, source_type)
    where source_type = 'manager_knowledge_v1'
  do update set
    content = excluded.content,
    confidence = excluded.confidence,
    reason = excluded.reason,
    payload = excluded.payload,
    created_at = now();

  update public.artist_profiles
  set manager_profile_summary_json = coalesce(manager_profile_summary_json, '{}'::jsonb)
    || jsonb_build_object('managerKnowledge', knowledge)
  where account_id = p_account_id
    and artist_workspace_id = p_artist_workspace_id
    and artist_id = p_artist_id;

  select p.id into latest_packet_id
  from public.manager_intelligence_packets p
  where p.account_id = p_account_id
    and p.artist_workspace_id = p_artist_workspace_id
    and p.artist_id = p_artist_id
  order by p.created_at desc
  limit 1;

  if latest_packet_id is not null then
    update public.manager_intelligence_packets
    set profile_projection_json = coalesce(profile_projection_json, '{}'::jsonb)
      || jsonb_build_object('managerKnowledge', knowledge)
    where id = latest_packet_id;
  end if;

  return knowledge;
end;
$$;

revoke all on function public.sync_manager_knowledge_projection_v1(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.sync_manager_knowledge_projection_v1(uuid,uuid,uuid) to service_role;

create or replace function public.sync_manager_knowledge_from_understanding_v1()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  perform public.sync_manager_knowledge_projection_v1(
    coalesce(new.account_id, old.account_id),
    coalesce(new.artist_workspace_id, old.artist_workspace_id),
    coalesce(new.artist_id, old.artist_id)
  );
  return coalesce(new, old);
end;
$$;
revoke all on function public.sync_manager_knowledge_from_understanding_v1() from public, anon, authenticated;

drop trigger if exists zz_sync_manager_knowledge_understanding on public.artist_understandings;
create trigger zz_sync_manager_knowledge_understanding
after insert or update or delete on public.artist_understandings
for each row execute function public.sync_manager_knowledge_from_understanding_v1();

create or replace function public.sync_manager_knowledge_from_operating_fact_v1()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  perform public.sync_manager_knowledge_projection_v1(
    coalesce(new.account_id, old.account_id),
    coalesce(new.artist_workspace_id, old.artist_workspace_id),
    coalesce(new.artist_id, old.artist_id)
  );
  return coalesce(new, old);
end;
$$;
revoke all on function public.sync_manager_knowledge_from_operating_fact_v1() from public, anon, authenticated;

drop trigger if exists zz_sync_manager_knowledge_operating_fact on public.artist_operating_facts;
create trigger zz_sync_manager_knowledge_operating_fact
after insert or update or delete on public.artist_operating_facts
for each row execute function public.sync_manager_knowledge_from_operating_fact_v1();

-- Every new Manager Intelligence packet receives the current canonical knowledge overlay.
-- It is explicitly a derived projection; the canonical rows stay in their owner tables.
create or replace function public.attach_manager_knowledge_to_packet_v1()
returns trigger language plpgsql security definer set search_path=public as $$
declare
  knowledge jsonb;
begin
  knowledge := public.manager_knowledge_context_v1(new.account_id,new.artist_workspace_id,new.artist_id,null,null);
  update public.manager_intelligence_packets
  set profile_projection_json = coalesce(profile_projection_json, '{}'::jsonb)
    || jsonb_build_object('managerKnowledge', knowledge)
  where id = new.id;
  return new;
end;
$$;
revoke all on function public.attach_manager_knowledge_to_packet_v1() from public, anon, authenticated;

drop trigger if exists zz_attach_manager_knowledge_to_packet on public.manager_intelligence_packets;
create trigger zz_attach_manager_knowledge_to_packet
after insert on public.manager_intelligence_packets
for each row execute function public.attach_manager_knowledge_to_packet_v1();

-- Queue source material and artist-controlled answers for semantic extraction.
create or replace function public.enqueue_artist_understanding_source_v1(
  p_account_id uuid,
  p_artist_workspace_id uuid,
  p_artist_id uuid,
  p_source_kind text,
  p_source_id uuid,
  p_source_version_id uuid default null
) returns void
language plpgsql security definer set search_path=public as $$
begin
  insert into public.artist_understanding_ingestion_queue(
    account_id,artist_workspace_id,artist_id,source_kind,source_id,source_version_id,status
  ) values (
    p_account_id,p_artist_workspace_id,p_artist_id,p_source_kind,p_source_id,p_source_version_id,'queued'
  )
  on conflict (artist_workspace_id,source_kind,source_id,(coalesce(source_version_id,'00000000-0000-0000-0000-000000000000'::uuid)))
  do update set
    status = case when artist_understanding_ingestion_queue.status='completed' then 'completed' else 'queued' end,
    last_error = null,
    updated_at = now();
end;
$$;
revoke all on function public.enqueue_artist_understanding_source_v1(uuid,uuid,uuid,text,uuid,uuid) from public, anon, authenticated;
grant execute on function public.enqueue_artist_understanding_source_v1(uuid,uuid,uuid,text,uuid,uuid) to service_role;

create or replace function public.enqueue_artist_message_understanding_v1()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.speaker = 'artist' and length(trim(new.body)) > 0 then
    perform public.enqueue_artist_understanding_source_v1(
      new.account_id,new.artist_workspace_id,new.artist_id,'conversation_message',new.id,null
    );
  end if;
  return new;
end;
$$;
revoke all on function public.enqueue_artist_message_understanding_v1() from public, anon, authenticated;

drop trigger if exists enqueue_artist_message_understanding on public.conversation_messages;
create trigger enqueue_artist_message_understanding
after insert on public.conversation_messages
for each row execute function public.enqueue_artist_message_understanding_v1();

create or replace function public.enqueue_context_answer_understanding_v1()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if length(trim(new.answer)) > 0 then
    perform public.enqueue_artist_understanding_source_v1(
      new.account_id,new.artist_workspace_id,new.artist_id,'context_answer',new.id,null
    );
  end if;
  return new;
end;
$$;
revoke all on function public.enqueue_context_answer_understanding_v1() from public, anon, authenticated;

drop trigger if exists enqueue_context_answer_understanding on public.manager_context_answers;
create trigger enqueue_context_answer_understanding
after insert or update of answer on public.manager_context_answers
for each row execute function public.enqueue_context_answer_understanding_v1();

create or replace function public.enqueue_document_understanding_v1()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.current_version_id is not null
     and (tg_op='INSERT' or old.current_version_id is distinct from new.current_version_id) then
    perform public.enqueue_artist_understanding_source_v1(
      new.account_id,new.artist_workspace_id,new.artist_id,'document',new.id,new.current_version_id
    );
  end if;
  return new;
end;
$$;
revoke all on function public.enqueue_document_understanding_v1() from public, anon, authenticated;

drop trigger if exists enqueue_document_understanding on public.documents;
create trigger enqueue_document_understanding
after insert or update of current_version_id on public.documents
for each row execute function public.enqueue_document_understanding_v1();

create or replace function public.claim_artist_understanding_ingestion_v1(batch_size integer default 6)
returns setof public.artist_understanding_ingestion_queue
language plpgsql security definer set search_path=public as $$
begin
  return query
  with candidates as (
    select q.id
    from public.artist_understanding_ingestion_queue q
    where (
      q.status='queued'
      or (q.status='processing' and q.locked_at < now() - interval '15 minutes')
    )
      and q.attempt_count < q.max_attempts
    order by q.created_at asc
    for update skip locked
    limit greatest(1, least(batch_size, 20))
  )
  update public.artist_understanding_ingestion_queue q
  set status='processing',
      attempt_count=q.attempt_count+1,
      locked_at=now(),
      last_error=null,
      updated_at=now()
  from candidates c
  where q.id=c.id
  returning q.*;
end;
$$;
revoke all on function public.claim_artist_understanding_ingestion_v1(integer) from public, anon, authenticated;
grant execute on function public.claim_artist_understanding_ingestion_v1(integer) to service_role;

create or replace function public.complete_artist_understanding_ingestion_v1(p_queue_id uuid)
returns void language sql security definer set search_path=public as $$
  update public.artist_understanding_ingestion_queue
  set status='completed',completed_at=now(),locked_at=null,last_error=null,updated_at=now()
  where id=p_queue_id;
$$;
revoke all on function public.complete_artist_understanding_ingestion_v1(uuid) from public, anon, authenticated;
grant execute on function public.complete_artist_understanding_ingestion_v1(uuid) to service_role;

create or replace function public.fail_artist_understanding_ingestion_v1(p_queue_id uuid,p_error text)
returns void language plpgsql security definer set search_path=public as $$
begin
  update public.artist_understanding_ingestion_queue
  set status=case when attempt_count >= max_attempts then 'failed' else 'queued' end,
      locked_at=null,
      last_error=left(coalesce(p_error,'Unknown ingestion failure'),1000),
      updated_at=now()
  where id=p_queue_id;
end;
$$;
revoke all on function public.fail_artist_understanding_ingestion_v1(uuid,text) from public, anon, authenticated;
grant execute on function public.fail_artist_understanding_ingestion_v1(uuid,text) to service_role;

-- A question keyed to semantic truth is just as redundant as a question keyed to a World Model fact.
create or replace function public.reject_known_manager_question_v1()
returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if exists (
    select 1 from public.artist_operating_facts fact
    where fact.account_id=new.account_id
      and fact.artist_workspace_id=new.artist_workspace_id
      and fact.artist_id=new.artist_id
      and fact.fact_key=new.fact_key
      and fact.scope_type=new.fact_scope_type
      and fact.scope_key=new.fact_scope_key
      and fact.status='active'
      and (fact.valid_until is null or fact.valid_until > now())
  ) then
    raise exception using errcode='P0001', message='Manager question rejected because the canonical fact is already known and fresh.';
  end if;

  if new.fact_scope_type='artist' and exists (
    select 1 from public.artist_understandings u
    where u.account_id=new.account_id
      and u.artist_workspace_id=new.artist_workspace_id
      and u.artist_id=new.artist_id
      and u.scope_type='artist'
      and u.status='current'
      and u.understanding_key=new.fact_key
  ) then
    raise exception using errcode='P0001', message='Manager question rejected because canonical semantic understanding already answers it.';
  end if;

  return new;
end;
$$;
revoke all on function public.reject_known_manager_question_v1() from public, anon, authenticated;

-- Internal DB calls (migrations/triggers/tests) must be able to read the snapshot without
-- manufacturing a user JWT, while authenticated API calls still require account membership.
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
  where w.id=p_artist_workspace_id and w.artist_id=p_artist_id;
  if workspace_account_id is null then return '[]'::jsonb; end if;
  jwt_role := coalesce(current_setting('request.jwt.claim.role',true),'');
  if jwt_role not in ('','service_role') and not public.is_account_member(workspace_account_id) then
    raise exception 'Not authorized to read artist understanding.' using errcode='42501';
  end if;
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',u.id,'scopeType',u.scope_type,'scopeId',u.scope_id,'key',u.understanding_key,
      'category',u.category,'statement',u.statement,'value',u.structured_value,
      'sourceKind',u.source_kind,'sourceType',u.source_type,'sourceId',u.source_id,
      'sourceRef',u.source_ref,'confidence',u.confidence,'authority',u.authority,'updatedAt',u.updated_at
    ) order by case u.authority when 'artist_confirmed' then 4 when 'trusted_source' then 3 when 'supported' then 2 else 1 end desc,u.updated_at desc
  ),'[]'::jsonb) into result
  from public.artist_understandings u
  where u.artist_workspace_id=p_artist_workspace_id and u.artist_id=p_artist_id and u.status='current';
  return result;
end;
$$;
grant execute on function public.manager_artist_understanding_snapshot_v1(uuid,uuid) to authenticated,service_role;

-- Existing source material is not stranded: current documents are backfilled for semantic extraction.
insert into public.artist_understanding_ingestion_queue(
  account_id,artist_workspace_id,artist_id,source_kind,source_id,source_version_id,status
)
select d.account_id,d.artist_workspace_id,d.artist_id,'document',d.id,d.current_version_id,'queued'
from public.documents d
where d.current_version_id is not null
  and d.status not in ('superseded','revoked','failed')
on conflict do nothing;

-- Existing explicit context answers are also durable artist-controlled source material.
insert into public.artist_understanding_ingestion_queue(
  account_id,artist_workspace_id,artist_id,source_kind,source_id,status
)
select a.account_id,a.artist_workspace_id,a.artist_id,'context_answer',a.id,'queued'
from public.manager_context_answers a
where length(trim(a.answer)) > 0
on conflict do nothing;

-- Seed projections for workspaces that already have canonical knowledge.
do $$
declare r record;
begin
  for r in
    select distinct account_id,artist_workspace_id,artist_id
    from (
      select account_id,artist_workspace_id,artist_id from public.artist_understandings where status='current'
      union
      select account_id,artist_workspace_id,artist_id from public.artist_operating_facts where status='active'
    ) scoped
  loop
    perform public.sync_manager_knowledge_projection_v1(r.account_id,r.artist_workspace_id,r.artist_id);
  end loop;
end;
$$;

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name='workflow_worker_secret') then
    raise exception 'Vault secret workflow_worker_secret must exist before scheduling Artist Understanding ingestion';
  end if;
  if not exists (select 1 from vault.decrypted_secrets where name='project_url') then
    raise exception 'Vault secret project_url must exist before scheduling Artist Understanding ingestion';
  end if;

  perform cron.unschedule(jobid) from cron.job where jobname='artist-understanding-ingestion';
  perform cron.schedule(
    'artist-understanding-ingestion',
    '* * * * *',
    $schedule$
      select net.http_post(
        url := regexp_replace(endpoint.decrypted_secret, '/$', '') || '/functions/v1/manager-artist-understanding',
        headers := jsonb_build_object(
          'Content-Type','application/json',
          'x-workflow-worker-secret',secret.decrypted_secret
        ),
        body := jsonb_build_object('source','scheduled','batchSize',6)
      )
      from vault.decrypted_secrets secret
      cross join vault.decrypted_secrets endpoint
      where secret.name='workflow_worker_secret'
        and endpoint.name='project_url'
        and exists (
          select 1 from public.artist_understanding_ingestion_queue q
          where q.status='queued'
             or (q.status='processing' and q.locked_at < now() - interval '15 minutes')
        );
    $schedule$
  );
end;
$$;
