-- Read-only smoke cases for get_setup_presentation_feed_v2.
-- Run against a disposable Supabase database with fixtures for an authenticated
-- artist workspace, a foreign workspace, pending/failed actions, and malformed
-- evidence. This file never changes fixture state.

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);

do $$
declare
  feed jsonb;
  finding_count integer;
begin
  select public.get_setup_presentation_feed_v2('00000000-0000-0000-0000-000000000010'::uuid)
    into feed;

  if feed is null then
    raise exception 'authenticated setup feed unexpectedly hidden';
  end if;

  if feed ->> 'version' <> '2' then
    raise exception 'wrong feed version';
  end if;

  select count(*)
    into finding_count
  from jsonb_array_elements(coalesce(feed -> 'findings', '[]'::jsonb));

  if finding_count > 32 then
    raise exception 'feed exceeded limit 32';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(feed -> 'findings', '[]'::jsonb)) as finding
    where finding ? 'source'
       or finding ? 'source_kind'
       or finding ? 'provider_id'
       or finding ? 'metric_name'
       or finding ? 'raw_ref'
       or finding ? 'provenance'
  ) then
    raise exception 'display feed leaked internal fields';
  end if;
end;
$$;

-- A foreign workspace must return no feed under RLS.
select public.get_setup_presentation_feed_v2('00000000-0000-0000-0000-000000000099'::uuid) is null
  as foreign_workspace_isolated;

-- Pending and failed actions, plus malformed evidence, must not appear.
select count(*) = 0 as pending_failed_malformed_rows_are_excluded
from jsonb_array_elements(
  coalesce(
    public.get_setup_presentation_feed_v2('00000000-0000-0000-0000-000000000010'::uuid) -> 'findings',
    '[]'::jsonb
  )
) as finding
where lower(coalesce(finding ->> 'detail', '')) in ('pending', 'failed', 'malformed');

-- The projection order is stable and bounded before the client queue receives it.
select finding
from jsonb_array_elements(
  coalesce(
    public.get_setup_presentation_feed_v2('00000000-0000-0000-0000-000000000010'::uuid) -> 'findings',
    '[]'::jsonb
  )
) with ordinality as rows(finding, position)
order by position
limit 32;

rollback;

