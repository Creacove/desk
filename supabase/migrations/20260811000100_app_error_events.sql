create table public.app_error_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  environment text not null default 'production',
  release_version text,
  severity text not null default 'error'
    check (severity in ('warning', 'error', 'critical')),
  status text not null default 'open'
    check (status in ('open', 'investigating', 'resolved')),
  resolved_at timestamptz,
  resolution_note text,
  fixed_release text,

  source text not null
    check (source in ('client', 'edge', 'worker', 'database', 'provider')),
  function_name text not null,
  operation text not null,
  route text,
  error_class text,
  error_code text,
  fingerprint text not null,

  error_message text not null,
  error_details jsonb not null default '{}'::jsonb
    check (jsonb_typeof(error_details) = 'object'),
  stack_trace text,
  public_message text,
  context jsonb not null default '{}'::jsonb
    check (jsonb_typeof(context) = 'object'),

  user_id uuid references public.users(id) on delete set null,
  account_email text,
  account_id uuid references public.accounts(id) on delete set null,
  artist_workspace_id uuid references public.artist_workspaces(id) on delete set null,
  artist_id uuid references public.artists(id) on delete set null,

  trace_id uuid,
  request_id uuid,
  parent_error_event_id uuid references public.app_error_events(id) on delete set null,
  provider text,
  provider_request_id text,
  http_status integer check (http_status is null or http_status between 100 and 599),
  provider_status integer check (provider_status is null or provider_status between 100 and 599),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),

  setup_run_id uuid references public.workspace_setup_runs(id) on delete set null,
  manager_run_id uuid references public.manager_synthesis_runs(id) on delete set null,
  source_sync_job_id uuid references public.source_sync_jobs(id) on delete set null,
  usage_event_id uuid references public.ai_run_usage_events(id) on delete set null,
  billing_event_id uuid references public.billing_webhook_events(id) on delete set null,
  operating_event_id uuid references public.operating_events(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  mission_id uuid references public.missions(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  music_item_id uuid references public.music_items(id) on delete set null,
  music_project_id uuid references public.music_projects(id) on delete set null,
  stage text,
  attempt integer check (attempt is null or attempt >= 0),

  check ((status = 'resolved') = (resolved_at is not null))
);

create index app_error_events_occurred_at_idx
  on public.app_error_events (occurred_at desc);

create index app_error_events_open_severity_idx
  on public.app_error_events (status, severity, occurred_at desc)
  where status <> 'resolved';

create index app_error_events_fingerprint_idx
  on public.app_error_events (fingerprint, occurred_at desc);

create index app_error_events_account_email_idx
  on public.app_error_events (account_email, occurred_at desc)
  where account_email is not null;

create index app_error_events_request_id_idx
  on public.app_error_events (request_id)
  where request_id is not null;

create index app_error_events_setup_run_idx
  on public.app_error_events (setup_run_id, occurred_at desc)
  where setup_run_id is not null;

create index app_error_events_manager_run_idx
  on public.app_error_events (manager_run_id, occurred_at desc)
  where manager_run_id is not null;

alter table public.app_error_events enable row level security;

revoke all on public.app_error_events from public;
revoke all on public.app_error_events from anon, authenticated;
grant select, insert, update, delete on public.app_error_events to service_role;

comment on table public.app_error_events is
  'Service-role-only application failure ledger. Never expose this table through customer activity feeds.';

notify pgrst, 'reload schema';
