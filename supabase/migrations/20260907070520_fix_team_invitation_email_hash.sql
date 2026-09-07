-- The membership operation functions use an empty search_path.  pgcrypto is
-- installed in the extensions schema, so qualify digest where the rate-limit
-- hash is calculated.  Replacing the function definitions keeps their
-- security-definer settings and existing grants intact.
do $$
declare
  function_sql text;
begin
  function_sql := replace(
    pg_get_functiondef(
      'public.invite_account_member_v1(uuid, uuid, text, text, text, text[])'::regprocedure
    ),
    'public.digest(',
    'extensions.digest('
  );
  if position('public.' || 'digest(' in function_sql) > 0
     or position('extensions.digest(' in function_sql) = 0 then
    raise exception 'TEAM_MIGRATION_INVALID: invite hash function was not qualified';
  end if;
  execute function_sql;

  function_sql := replace(
    pg_get_functiondef(
      'public.rotate_account_invitation_v1(uuid, uuid, text)'::regprocedure
    ),
    'public.digest(',
    'extensions.digest('
  );
  if position('public.' || 'digest(' in function_sql) > 0
     or position('extensions.digest(' in function_sql) = 0 then
    raise exception 'TEAM_MIGRATION_INVALID: rotate hash function was not qualified';
  end if;
  execute function_sql;
end;
$$;
