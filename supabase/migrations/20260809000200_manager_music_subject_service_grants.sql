-- Manager conversation functions use a service-role PostgREST client after
-- authenticating and scoping the caller. Keep its exact subject reads explicit.
grant select on public.music_assets to service_role;
grant select on public.music_credits to service_role;

