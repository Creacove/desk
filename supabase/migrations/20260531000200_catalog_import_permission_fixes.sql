-- Ensure hosted catalog import permissions match the app's RLS design.
-- The edge functions run with the authenticated user's JWT for workspace-scoped
-- writes, so membership checks must not fail before RLS can evaluate them.

grant usage on schema public to anon, authenticated, service_role;

grant select on public.account_memberships to anon, authenticated, service_role;
grant execute on function public.is_account_member(uuid) to anon, authenticated, service_role;

create or replace function public.is_account_member(target_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.account_memberships membership
    where membership.account_id = target_account_id
      and membership.user_id = auth.uid()
      and membership.status = 'active'
  );
$$;

alter function public.is_account_member(uuid) owner to postgres;
grant execute on function public.is_account_member(uuid) to anon, authenticated, service_role;

grant select on public.source_providers to anon, authenticated, service_role;
grant select, insert, update, delete on public.source_connections to authenticated, service_role;
grant select, insert, update, delete on public.source_sync_jobs to authenticated, service_role;
grant select, insert, update, delete on public.source_snapshots to authenticated, service_role;
grant select, insert, update, delete on public.music_projects to authenticated, service_role;
grant select, insert, update, delete on public.music_items to authenticated, service_role;
grant select, insert, update, delete on public.music_project_items to authenticated, service_role;
grant select, insert, update, delete on public.music_identifiers to authenticated, service_role;
grant select, insert on public.operating_events to authenticated, service_role;

insert into public.source_providers (
  provider_key,
  display_name,
  source_kind,
  default_confidence,
  claim_boundaries
)
values (
  'spotify',
  'Spotify Public Catalog',
  'official_api',
  'low',
  jsonb_build_object(
    'supports', array['identity', 'catalog', 'public metadata'],
    'forbidden', array['private saves', 'source-of-stream', 'revenue', 'conversion']
  )
)
on conflict (provider_key) do update
set display_name = excluded.display_name,
    source_kind = excluded.source_kind,
    default_confidence = excluded.default_confidence,
    claim_boundaries = excluded.claim_boundaries;
