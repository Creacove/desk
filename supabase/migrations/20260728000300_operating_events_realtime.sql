alter table public.operating_events
  add column if not exists workspace_setup_run_id uuid references public.workspace_setup_runs(id) on delete set null,
  add column if not exists dedupe_key text,
  add column if not exists display_mode text,
  add column if not exists refresh_scope text[] not null default '{}',
  add column if not exists recipient_user_id uuid references auth.users(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'operating_events_display_mode_check'
      and conrelid = 'public.operating_events'::regclass
  ) then
    alter table public.operating_events
      add constraint operating_events_display_mode_check
      check (display_mode is null or display_mode in ('activity', 'toast', 'action'));
  end if;
end;
$$;

create unique index if not exists operating_events_workspace_dedupe_idx
  on public.operating_events (artist_workspace_id, dedupe_key)
  where dedupe_key is not null;

create index if not exists operating_events_workspace_cursor_idx
  on public.operating_events (artist_workspace_id, created_at, id);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'operating_events'
    ) then
    alter publication supabase_realtime add table public.operating_events;
  end if;
end;
$$;
