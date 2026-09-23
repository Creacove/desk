-- Keep workspace team configuration private while allowing RLS policies to
-- check whether a workspace is configured. The previous policy queried the
-- revoked table directly, which caused every operator activity read to fail.
create or replace function private.workspace_team_settings_configured(
  p_account_id uuid,
  p_artist_workspace_id uuid,
  p_artist_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select exists (
    select 1
    from public.workspace_team_settings settings
    where settings.account_id = p_account_id
      and settings.artist_workspace_id = p_artist_workspace_id
      and settings.artist_id = p_artist_id
  );
$$;

alter function private.workspace_team_settings_configured(uuid, uuid, uuid) owner to postgres;
revoke all on function private.workspace_team_settings_configured(uuid, uuid, uuid) from public, anon;
grant execute on function private.workspace_team_settings_configured(uuid, uuid, uuid) to authenticated, service_role;

drop policy if exists operating_events_personal_select on public.operating_events;
create policy operating_events_personal_select
on public.operating_events for select
using (
  public.is_account_member(account_id)
  and (recipient_user_id is null or recipient_user_id = (select auth.uid()))
  and (
    not private.workspace_team_settings_configured(account_id, artist_workspace_id, artist_id)
    or exists (
      select 1
      from public.account_memberships membership
      where membership.account_id = operating_events.account_id
        and membership.user_id = (select auth.uid())
        and membership.status = 'active'
        and membership.role = 'owner'
    )
    or public.has_active_workspace_entitlement(artist_workspace_id)
  )
);
