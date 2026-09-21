-- Make workspace linking and operator search resilient when names are reused.
-- Emails are identifiers only; this does not grant customer membership or
-- expose any write capability.

drop function if exists public.list_ops_linkable_workspaces_v1(text, integer);

create function public.list_ops_linkable_workspaces_v1(p_query text, p_limit integer default 20)
returns table (
  artist_workspace_id uuid,
  workspace_name text,
  workspace_status public.workspace_status,
  artist_name text,
  account_id uuid,
  account_name text,
  account_member_emails text[],
  contact_emails text[]
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  query_text text := btrim(coalesce(p_query, ''));
  result_limit integer := greatest(1, least(coalesce(p_limit, 20), 50));
begin
  if not private.is_active_ordersounds_operator() then
    raise exception 'ops_operator_required' using errcode = '42501';
  end if;
  if length(query_text) < 2 then
    return;
  end if;

  return query
  select
    workspace.id,
    workspace.name,
    workspace.status,
    artist.display_name,
    account.id,
    account.name,
    coalesce(member_identifiers.emails, '{}'::text[]),
    coalesce(contact_identifiers.emails, '{}'::text[])
  from public.artist_workspaces workspace
  join public.artists artist on artist.id = workspace.artist_id and artist.account_id = workspace.account_id
  join public.accounts account on account.id = workspace.account_id
  left join lateral (
    select array_agg(distinct lower(btrim(person.email)) order by lower(btrim(person.email)))
      filter (where person.email is not null and btrim(person.email) <> '') as emails
    from public.account_memberships membership
    join public.users person on person.id = membership.user_id
    where membership.account_id = workspace.account_id
      and membership.status = 'active'
  ) member_identifiers on true
  left join lateral (
    select array_agg(distinct lower(btrim(case_row.primary_contact_email)) order by lower(btrim(case_row.primary_contact_email)))
      filter (where case_row.primary_contact_email is not null and btrim(case_row.primary_contact_email) <> '') as emails
    from public.ops_cases case_row
    where case_row.desk_workspace_id = workspace.id
  ) contact_identifiers on true
  where workspace.name ilike '%' || query_text || '%'
     or artist.display_name ilike '%' || query_text || '%'
     or account.name ilike '%' || query_text || '%'
     or workspace.id::text = query_text
     or account.id::text = query_text
     or exists (
       select 1
       from public.account_memberships membership
       join public.users person on person.id = membership.user_id
       where membership.account_id = workspace.account_id
         and membership.status = 'active'
         and person.email ilike '%' || query_text || '%'
     )
     or exists (
       select 1
       from public.ops_cases case_row
       where case_row.desk_workspace_id = workspace.id
         and (
           case_row.primary_contact_email ilike '%' || query_text || '%'
           or case_row.primary_contact_handle ilike '%' || query_text || '%'
         )
     )
  order by artist.display_name, workspace.name, workspace.id
  limit result_limit;
end;
$$;

revoke all on function public.list_ops_linkable_workspaces_v1(text, integer) from public, anon;
grant execute on function public.list_ops_linkable_workspaces_v1(text, integer) to authenticated;

notify pgrst, 'reload schema';
