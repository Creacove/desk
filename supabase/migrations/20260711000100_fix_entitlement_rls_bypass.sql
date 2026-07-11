-- Fix has_active_workspace_entitlement to bypass RLS when checking billing_subscriptions.
-- The function is security definer but was missing 'set row_security = off', which meant
-- service-role calls could not read billing_subscriptions rows through RLS policies
-- that depend on auth.uid() (which is null for service-role invocations).

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
        or current_setting('request.jwt.claim.role', true) = 'service_role'
      )
  );
$$;
alter function public.has_active_workspace_entitlement(uuid) owner to postgres;
revoke all on function public.has_active_workspace_entitlement(uuid) from public;
grant execute on function public.has_active_workspace_entitlement(uuid) to authenticated, service_role;
