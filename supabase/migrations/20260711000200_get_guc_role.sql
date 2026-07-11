-- Temporary function to inspect JWT GUC settings.
create or replace function public.get_guc_role()
returns table (
  guc_role text,
  auth_role text,
  jwt_claims text
)
language sql
stable
security invoker
as $$
  select 
    current_setting('request.jwt.claim.role', true),
    auth.role(),
    current_setting('request.jwt.claims', true);
$$;
revoke all on function public.get_guc_role() from public;
grant execute on function public.get_guc_role() to authenticated, service_role;
