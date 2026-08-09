-- Keep the Rights ledger valid under concurrent clients and allow capability-token
-- edge functions to operate with the service-role client they explicitly create.

grant select, insert, update, delete on public.music_split_confirmations to service_role;
grant select, insert, update, delete on public.music_split_contributors to service_role;
grant select, insert, update, delete on public.music_splits to service_role;
grant select on public.music_items to service_role;
grant insert on public.operating_events to service_role;

create or replace function public.validate_music_split_allocation()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  existing_publishing numeric;
  existing_master numeric;
begin
  -- Serialize allocation writes for a split so two valid-looking requests cannot
  -- race each other past 100%.
  perform pg_advisory_xact_lock(hashtextextended(new.music_split_id::text, 0));

  select
    coalesce(sum(publishing_share), 0),
    coalesce(sum(master_share), 0)
  into existing_publishing, existing_master
  from public.music_split_contributors
  where music_split_id = new.music_split_id
    and (tg_op = 'INSERT' or id <> new.id);

  if tg_op = 'INSERT' and existing_publishing >= 100 and existing_master >= 100 then
    raise exception 'Split allocation is already complete. Remove or edit a contributor before adding another.';
  end if;

  if existing_publishing + new.publishing_share > 100 then
    raise exception 'Publishing allocation cannot exceed 100%%.';
  end if;

  if existing_master + new.master_share > 100 then
    raise exception 'Master allocation cannot exceed 100%%.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_music_split_allocation_trigger on public.music_split_contributors;
create trigger validate_music_split_allocation_trigger
before insert or update of music_split_id, publishing_share, master_share
on public.music_split_contributors
for each row execute function public.validate_music_split_allocation();

