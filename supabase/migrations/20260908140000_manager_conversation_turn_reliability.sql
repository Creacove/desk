-- Give every Manager turn one durable identity. The request payload is the
-- replay envelope: retries must not reconstruct a different conversation turn.
alter table public.manager_synthesis_runs
  add column if not exists request_id uuid,
  add column if not exists request_payload jsonb not null default '{}'::jsonb,
  add column if not exists result_payload jsonb not null default '{}'::jsonb;

alter table public.conversation_messages
  add column if not exists request_id uuid;

create unique index if not exists manager_conversation_request_unique_idx
  on public.manager_synthesis_runs (account_id, artist_workspace_id, request_id)
  where workflow_version = 'manager_conversation_v1'
    and request_id is not null;

create unique index if not exists conversation_messages_request_unique_idx
  on public.conversation_messages (account_id, artist_workspace_id, conversation_id, speaker, request_id)
  where request_id is not null;

create index if not exists manager_conversation_request_lookup_idx
  on public.manager_synthesis_runs (account_id, artist_workspace_id, idempotency_key, status)
  where workflow_version = 'manager_conversation_v1'
    and idempotency_key is not null;

create unique index if not exists ai_run_usage_events_manager_conversation_unique_idx
  on public.ai_run_usage_events (manager_synthesis_run_id, operation_key)
  where manager_synthesis_run_id is not null
    and operation_key = 'manager_conversation_router';

grant select, insert, update on public.conversation_messages to service_role;
grant select, insert, update on public.manager_synthesis_runs to service_role;

notify pgrst, 'reload schema';
