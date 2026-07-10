-- Billing checkout functions create/update the public user mirror after auth.
grant select, insert, update, delete on public.users to service_role;
