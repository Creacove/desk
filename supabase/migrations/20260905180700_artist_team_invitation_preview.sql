-- Safe, unauthenticated invitation preview. Only the SHA-256 token hash is
-- accepted and the response intentionally contains no account, workspace,
-- recipient, or credential fields.

create or replace function public.preview_account_invitation_v1(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $$
declare
  invitation_row public.account_invitations%rowtype;
  team_name_value text;
  artist_name_value text;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'TEAM_BAD_INPUT';
  end if;

  select invitation.*
    into invitation_row
  from public.account_invitations invitation
  where invitation.token_hash = pg_catalog.lower(p_token_hash)
    and invitation.status = 'pending'
    and invitation.expires_at > pg_catalog.now();

  if not found then
    raise exception 'TEAM_GONE';
  end if;

  select account_row.name, artist.display_name
    into team_name_value, artist_name_value
  from public.accounts account_row
  join public.artists artist
    on artist.id = invitation_row.artist_id
   and artist.account_id = invitation_row.account_id
  join public.artist_workspaces workspace
    on workspace.id = invitation_row.artist_workspace_id
   and workspace.account_id = invitation_row.account_id
   and workspace.artist_id = invitation_row.artist_id
  where account_row.id = invitation_row.account_id;

  if nullif(pg_catalog.btrim(coalesce(team_name_value, '')), '') is null
     or nullif(pg_catalog.btrim(coalesce(artist_name_value, '')), '') is null then
    raise exception 'TEAM_UNAVAILABLE';
  end if;

  return pg_catalog.jsonb_build_object(
    'teamName', pg_catalog.btrim(team_name_value),
    'artistName', pg_catalog.btrim(artist_name_value),
    'operatingTitle', invitation_row.operating_title,
    'responsibilityTags', invitation_row.responsibility_tags,
    'expiresAt', invitation_row.expires_at
  );
end;
$$;

revoke all on function public.preview_account_invitation_v1(text) from public, anon, authenticated;
grant execute on function public.preview_account_invitation_v1(text) to service_role;
alter function public.preview_account_invitation_v1(text) owner to postgres;

notify pgrst, 'reload schema';
