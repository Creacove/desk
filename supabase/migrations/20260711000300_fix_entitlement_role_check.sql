-- Update has_active_workspace_entitlement to use auth.role() = 'service_role'
-- instead of current_setting('request.jwt.claim.role', true) = 'service_role'
-- because the singular GUC setting is null in some PostgREST environments,
-- whereas auth.role() correctly parses the role from the claims object.

create or replace function public.has_active_workspace_entitlement(p_artist_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
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
  );
$$;
alter function public.has_active_workspace_entitlement(uuid) owner to postgres;
revoke all on function public.has_active_workspace_entitlement(uuid) from public;
grant execute on function public.has_active_workspace_entitlement(uuid) to authenticated, service_role;
