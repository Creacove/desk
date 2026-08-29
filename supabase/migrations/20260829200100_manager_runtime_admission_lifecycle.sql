-- Release adaptive-runtime admission reservations as soon as the review leaves
-- running. Expiry remains the crash-recovery fallback.

create or replace function public.bind_manager_runtime_admission_to_review_v1()
returns trigger language plpgsql security definer set search_path=public as $$
declare admission_id uuid;
begin
  if new.trigger_type='adaptive_replan' and new.status='running'
     and (old.status is distinct from new.status) then
    select a.id into admission_id
    from public.manager_runtime_admissions a
    where a.account_id=new.account_id
      and a.artist_workspace_id=new.artist_workspace_id
      and a.artist_id=new.artist_id
      and a.operation_key='adaptive_replan'
      and a.status='active'
      and not (a.metadata ? 'reviewId')
    order by a.claimed_at desc
    limit 1
    for update;
    if admission_id is not null then
      update public.manager_runtime_admissions
      set metadata=metadata||jsonb_build_object('reviewId',new.id)
      where id=admission_id;
    end if;
  end if;

  if old.status='running' and new.status<>'running' and new.trigger_type='adaptive_replan' then
    update public.manager_runtime_admissions
    set status=case when new.status='completed' then 'completed' else 'failed' end,
        completed_at=now(),
        failure_reason=case when new.status='completed' then null else left(coalesce(new.runtime_last_error,'Adaptive review left running without completion.'),1000) end
    where artist_workspace_id=new.artist_workspace_id
      and operation_key='adaptive_replan'
      and status='active'
      and metadata->>'reviewId'=new.id::text;
  end if;
  return new;
end$$;

revoke all on function public.bind_manager_runtime_admission_to_review_v1() from public,anon,authenticated;

drop trigger if exists bind_manager_runtime_admission_to_review on public.reviews;
create trigger bind_manager_runtime_admission_to_review
after update of status on public.reviews
for each row execute function public.bind_manager_runtime_admission_to_review_v1();
