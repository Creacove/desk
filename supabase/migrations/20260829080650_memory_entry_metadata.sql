-- Preserve structured provenance for Manager memories without overloading the
-- human-readable memory content/reason fields. This is used by the permission
-- transaction to link an explicit rejection back to the exact permission/action.

alter table public.memory_entries
  add column if not exists metadata jsonb not null default '{}'::jsonb;

notify pgrst, 'reload schema';
