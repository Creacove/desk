-- Re-enter the Manager runtime immediately after a permission path reaches a
-- state the Manager can safely reason from. Executable approval itself does not
-- create a review: Desk first waits for the real provider outcome. Rejections,
-- prepared-only approvals, and terminal execution outcomes are safe wake points.
-- The existing one-minute recovery dispatcher remains the retry/safety net.

create or replace function public._nudge_manager_permission_outcome_review_v1()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  project_url text;
  worker_secret text;
begin
  if new.trigger_type <> 'adaptive_replan'
     or new.status not in ('due', 'scheduled')
     or new.runtime_key is null
     or new.runtime_key !~ '^permission:[0-9a-fA-F-]+:(rejected|approved-prepared-only|execution-(succeeded|failed|indeterminate))$'
     or coalesce(new.snoozed_until, new.review_at, now()) > now() then
    return new;
  end if;

  select decrypted_secret into project_url
  from vault.decrypted_secrets
  where name = 'project_url'
  limit 1;

  select decrypted_secret into worker_secret
  from vault.decrypted_secrets
  where name = 'workflow_worker_secret'
  limit 1;

  if project_url is null or worker_secret is null then
    return new;
  end if;

  perform net.http_post(
    url := regexp_replace(project_url, '/$', '') || '/functions/v1/workflow-recovery',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-workflow-worker-secret', worker_secret
    ),
    body := jsonb_build_object(
      'mode', 'adaptive_replan',
      'reviewId', new.id,
      'source', 'permission-outcome'
    )
  );

  return new;
end;
$$;

revoke all on function public._nudge_manager_permission_outcome_review_v1()
  from public, anon, authenticated, service_role;

drop trigger if exists nudge_manager_permission_outcome_review on public.reviews;
create trigger nudge_manager_permission_outcome_review
after insert on public.reviews
for each row
when (
  new.trigger_type = 'adaptive_replan'
  and new.status in ('due', 'scheduled')
  and new.runtime_key is not null
)
execute function public._nudge_manager_permission_outcome_review_v1();
