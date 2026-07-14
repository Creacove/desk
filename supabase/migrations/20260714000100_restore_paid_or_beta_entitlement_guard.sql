-- Preserve private-beta access without regressing the earlier RLS and service-role fixes.

create or replace function public.has_active_workspace_entitlement(p_artist_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select
    exists (
      select 1
      from public.billing_subscriptions subscription
      join public.artist_workspaces workspace on workspace.id = subscription.artist_workspace_id
      where subscription.artist_workspace_id = p_artist_workspace_id
        and subscription.status in ('active', 'non-renewing', 'attention')
        and (subscription.current_period_end is null or subscription.current_period_end > now())
        and (
          public.is_account_member(workspace.account_id)
          or auth.role() = 'service_role'
        )
    )
    or exists (
      select 1
      from public.workspace_access_grants grant_record
      join public.artist_workspaces workspace on workspace.id = grant_record.artist_workspace_id
      where grant_record.artist_workspace_id = p_artist_workspace_id
        and grant_record.access_type = 'private_beta'
        and grant_record.status = 'active'
        and grant_record.starts_at <= now()
        and grant_record.ends_at > now()
        and (
          grant_record.user_id = auth.uid()
          or public.is_account_member(workspace.account_id)
          or auth.role() = 'service_role'
        )
    );
$$;
