\set ON_ERROR_STOP on

-- Disposable-only fixture for scripts/test-team-database.mjs.
-- The harness starts each concurrent RPC in a separate psql process/connection;
-- do not replace that invocation with one transaction or a sequential loop.

delete from public.accounts where id = '91000000-0000-4000-8000-000000000001';
delete from public.users where id in (
  '91000000-0000-4000-8000-000000000004',
  '91000000-0000-4000-8000-000000000005',
  '91000000-0000-4000-8000-000000000007'
);
delete from auth.users where id in (
  '91000000-0000-4000-8000-000000000004',
  '91000000-0000-4000-8000-000000000005',
  '91000000-0000-4000-8000-000000000007'
);

insert into public.accounts (id, name, status)
values ('91000000-0000-4000-8000-000000000001', 'Disposable team concurrency account', 'active');

insert into public.artists (id, account_id, display_name)
values ('91000000-0000-4000-8000-000000000002', '91000000-0000-4000-8000-000000000001', 'Disposable Team Artist');

insert into public.artist_workspaces (id, account_id, artist_id, name, status)
values ('91000000-0000-4000-8000-000000000003', '91000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000002', 'Disposable Team Workspace', 'active');

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
values
  ('91000000-0000-4000-8000-000000000004', 'team-owner-concurrency@example.invalid', now(), '{"name":"Team owner"}'::jsonb),
  ('91000000-0000-4000-8000-000000000005', 'acceptor-team-concurrency@example.invalid', now(), '{"name":"Team acceptor"}'::jsonb),
  ('91000000-0000-4000-8000-000000000007', 'team-outsider-concurrency@example.invalid', now(), '{"name":"Team outsider"}'::jsonb);

insert into public.users (id, email, display_name, status)
values
  ('91000000-0000-4000-8000-000000000004', 'team-owner-concurrency@example.invalid', 'Team owner', 'active'),
  ('91000000-0000-4000-8000-000000000005', 'acceptor-team-concurrency@example.invalid', 'Team acceptor', 'active'),
  ('91000000-0000-4000-8000-000000000007', 'team-outsider-concurrency@example.invalid', 'Team outsider', 'active');

insert into public.account_memberships (account_id, user_id, role, status)
values ('91000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000004', 'owner', 'active');

insert into public.workspace_team_settings (account_id, artist_workspace_id, artist_id, enabled, pilot_ends_at)
values ('91000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000003', '91000000-0000-4000-8000-000000000002', true, now() + interval '1 day');

insert into public.billing_plan_catalog (
  provider, provider_product_id, provider_price_id, plan_key, billing_interval, seat_limit, artist_limit, active
)
values ('paddle', 'ci-team-product', 'ci-team-price', 'team_6', 'monthly', 6, 1, true)
on conflict (provider, provider_product_id, provider_price_id) do update
set plan_key = excluded.plan_key,
    billing_interval = excluded.billing_interval,
    seat_limit = excluded.seat_limit,
    artist_limit = excluded.artist_limit,
    active = excluded.active;

insert into public.billing_subscriptions (
  account_id, artist_workspace_id, user_id, provider, provider_subscription_code,
  provider_plan_code, provider_product_id, provider_price_id, amount_minor, amount,
  currency, status, current_period_start, current_period_end, plan_key
)
values (
  '91000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000003',
  '91000000-0000-4000-8000-000000000004', 'paddle', 'ci-team-subscription',
  'ci-team-price', 'ci-team-product', 'ci-team-price', 9900, 99.00,
  'USD', 'active', now() - interval '1 hour', now() + interval '1 day', 'team_6'
);

-- Keep one known reservation for the acceptance race. The remaining four
-- available reservations are filled by eight concurrent invite calls.
insert into public.account_invitations (
  account_id, artist_workspace_id, email, invited_by_user_id, token_hash,
  expires_at, operating_title, responsibility_tags
)
values (
  '91000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000003',
  'acceptor-team-concurrency@example.invalid', '91000000-0000-4000-8000-000000000004',
  encode(digest('team-concurrency-accept-token-v1', 'sha256'), 'hex'),
  now() + interval '7 days', 'Operations', '{"operations"}'::text[]
);

insert into public.tasks (
  id, account_id, artist_workspace_id, artist_id, scope, title, owner_role,
  work_mode, status, approval_state, assignee_user_id, assignment_reason,
  assignment_source, assignment_version
)
values (
  '91000000-0000-4000-8000-000000000006',
  '91000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000003',
  '91000000-0000-4000-8000-000000000002',
  'setup_source', 'Disposable assigned task', 'Team', 'artist_action',
  'open', 'not_required', '91000000-0000-4000-8000-000000000005',
  'Seeded for removal race', 'owner', 0
);

insert into public.reminder_queue (
  account_id, artist_workspace_id, artist_id, user_id, task_id, kind,
  scheduled_for, channel, status, dedupe_key, payload
)
values (
  '91000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000003',
  '91000000-0000-4000-8000-000000000002',
  '91000000-0000-4000-8000-000000000005',
  '91000000-0000-4000-8000-000000000006', 'task_ready',
  now(), 'in_app', 'processing', 'team-concurrency-reminder-v1',
  '{"fixture":true}'::jsonb
);
