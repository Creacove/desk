-- Team first-run state and owner-owned identity/responsibility completion.
-- This is intentionally additive and does not participate in artist setup.

alter table public.workspace_team_settings
  add column if not exists first_run_completed_at timestamptz;

create or replace function public._workspace_team_capability_v1(p_artist_workspace_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  with workspace as (
    select
      workspace.id,
      workspace.account_id,
      workspace.artist_id,
      settings.enabled,
      settings.pilot_ends_at,
      settings.first_run_completed_at,
      (settings.account_id is not null) as configured
    from public.artist_workspaces workspace
    left join public.workspace_team_settings settings
      on settings.artist_workspace_id = workspace.id
    where workspace.id = p_artist_workspace_id
  ),
  team_subscription as (
    select
      coalesce(bool_or(true), false) as paid,
      max(subscription.current_period_end) as ends_at
    from public.billing_subscriptions subscription
    join public.billing_plan_catalog catalog
      on catalog.provider = subscription.provider
      and catalog.provider_product_id = subscription.provider_product_id
      and catalog.provider_price_id = subscription.provider_price_id
      and catalog.plan_key = 'team_6'
      and catalog.active = true
    where subscription.artist_workspace_id = p_artist_workspace_id
      and subscription.plan_key = 'team_6'
      and (
        (subscription.provider = 'paddle' and subscription.status in ('active', 'trialing'))
        or
        (subscription.provider = 'paystack' and subscription.status in ('active', 'non-renewing', 'attention'))
      )
      and (subscription.current_period_end is null or subscription.current_period_end > pg_catalog.now())
  ),
  capability as (
    select
      workspace.*,
      public._workspace_has_base_access_v1(workspace.id) as base_access,
      team_subscription.paid,
      team_subscription.ends_at as paid_ends_at,
      (workspace.pilot_ends_at is not null and workspace.pilot_ends_at > pg_catalog.now()) as pilot_active
    from workspace
    cross join team_subscription
  )
  select pg_catalog.jsonb_build_object(
    'accountId', capability.account_id,
    'artistWorkspaceId', capability.id,
    'artistId', capability.artist_id,
    'planKey', case when capability.paid or capability.pilot_active then 'team_6' else 'solo' end,
    'enabled', coalesce(capability.enabled, false),
    'entitled', capability.base_access and (capability.paid or capability.pilot_active),
    'source', case when capability.paid then 'subscription' when capability.pilot_active then 'pilot' else 'none' end,
    'seatLimit', case when capability.paid or capability.pilot_active then 6 else 1 end,
    'occupiedSeats', (
      select count(*)
      from public.account_memberships membership
      where membership.account_id = capability.account_id
        and membership.status = 'active'
        and membership.role in ('owner', 'member')
    ),
    'reservedSeats', (
      select count(*)
      from public.account_invitations invitation
      where invitation.account_id = capability.account_id
        and invitation.status = 'pending'
        and invitation.expires_at > pg_catalog.now()
    ),
    'endsAt', case
      when capability.paid then capability.paid_ends_at
      when capability.pilot_active then capability.pilot_ends_at
      else null
    end,
    'firstRunCompletedAt', capability.first_run_completed_at
  )
  from capability;
$$;

create or replace function public.complete_team_first_run_v1(
  p_artist_workspace_id uuid,
  p_team_name text,
  p_operating_title text,
  p_responsibility_tags text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  workspace_row public.artist_workspaces%rowtype;
  settings_row public.workspace_team_settings%rowtype;
  responsibilities jsonb;
  tags_value text[];
  title_value text;
  team_name_value text := nullif(pg_catalog.btrim(coalesce(p_team_name, '')), '');
  capability jsonb;
begin
  if team_name_value is null or pg_catalog.char_length(team_name_value) > 120 then
    raise exception 'TEAM_BAD_INPUT';
  end if;

  workspace_row := public._assert_team_owner_v1(auth.uid(), p_artist_workspace_id);

  select *
  into settings_row
  from public.workspace_team_settings settings
  where settings.account_id = workspace_row.account_id
  for update;
  if not found
     or settings_row.artist_workspace_id is distinct from workspace_row.id
     or settings_row.artist_id is distinct from workspace_row.artist_id then
    raise exception 'TEAM_FORBIDDEN';
  end if;

  capability := public._workspace_team_capability_v1(workspace_row.id);
  if coalesce(capability->>'planKey', 'solo') <> 'team_6'
     or not coalesce((capability->>'enabled')::boolean, false)
     or not coalesce((capability->>'entitled')::boolean, false) then
    raise exception 'TEAM_FORBIDDEN';
  end if;

  responsibilities := public._team_normalize_responsibilities_v1(p_operating_title, p_responsibility_tags);
  title_value := nullif(responsibilities->>'operatingTitle', '');
  select coalesce(pg_catalog.array_agg(value order by value), '{}'::text[])
  into tags_value
  from jsonb_array_elements_text(responsibilities->'responsibilityTags') as item(value);

  -- A retry after a lost response is safe and does not reopen first-run.
  if settings_row.first_run_completed_at is not null then
    return public._workspace_team_capability_v1(workspace_row.id);
  end if;

  update public.accounts account_row
  set name = team_name_value,
      updated_at = pg_catalog.now()
  where account_row.id = workspace_row.account_id;

  update public.account_memberships membership
  set operating_title = title_value,
      responsibility_tags = tags_value,
      updated_at = pg_catalog.now()
  where membership.account_id = workspace_row.account_id
    and membership.user_id = auth.uid()
    and membership.role = 'owner'
    and membership.status = 'active';

  update public.workspace_team_settings settings
  set first_run_completed_at = pg_catalog.now(),
      updated_at = pg_catalog.now()
  where settings.account_id = workspace_row.account_id
    and settings.artist_workspace_id = workspace_row.id
    and settings.artist_id = workspace_row.artist_id;

  return public._workspace_team_capability_v1(workspace_row.id);
end;
$$;

revoke all on function public.complete_team_first_run_v1(uuid, text, text, text[])
  from public, anon;
grant execute on function public.complete_team_first_run_v1(uuid, text, text, text[])
  to authenticated, service_role;

alter function public._workspace_team_capability_v1(uuid) owner to postgres;
alter function public.complete_team_first_run_v1(uuid, text, text, text[]) owner to postgres;

notify pgrst, 'reload schema';
