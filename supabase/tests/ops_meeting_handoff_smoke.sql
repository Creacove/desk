-- Run with service_role against a disposable database. This is intentionally
-- a transaction-only smoke file: no customer memberships or billing rows are
-- created, and the meeting transcript never enters operator audit metadata.
begin;

select has_function_privilege('service_role', 'public.claim_ops_meeting_processing_v1(uuid,uuid)', 'execute') as service_can_claim;
select has_function_privilege('authenticated', 'public.claim_ops_meeting_processing_v1(uuid,uuid)', 'execute') as authenticated_cannot_claim;
select has_function_privilege('service_role', 'public.finalize_ops_meeting_processing_v1(uuid,uuid,text,text)', 'execute') as service_can_finalize;
select has_function_privilege('authenticated', 'public.finalize_ops_meeting_processing_v1(uuid,uuid,text,text)', 'execute') as authenticated_cannot_finalize;

select indexrelname = 'manager_synthesis_runs_idempotency_idx' as uses_existing_idempotency_boundary
from pg_stat_all_indexes
where indexrelname = 'manager_synthesis_runs_idempotency_idx';

select not exists (
  select 1
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'operator_workspace_events'
    and column_name = 'transcript'
) as operator_audit_excludes_transcript;

rollback;
