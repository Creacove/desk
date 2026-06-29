-- Expand Manager Intelligence packets into artist operating packets.

alter table public.manager_intelligence_packets
  add column if not exists domain_reads_json jsonb not null default '[]'::jsonb,
  add column if not exists public_context_json jsonb not null default '[]'::jsonb,
  add column if not exists open_decisions_json jsonb not null default '[]'::jsonb,
  add column if not exists do_not_do_json jsonb not null default '[]'::jsonb;

notify pgrst, 'reload schema';
