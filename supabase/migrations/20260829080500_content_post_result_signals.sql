-- Capture content-post outcomes as structured runtime evidence.
--
-- Content execution completes through result_note, not a raw-video upload. When
-- the artist reports a completed content Task, preserve any public post URLs in
-- task_results.raw_event and attach them to the checkpoint watched_signals. This
-- gives the existing Manager review/runtime a concrete signal subject without
-- pretending Desk observed private comments or video content.

create or replace function public.extract_public_result_urls_v1(p_text text)
returns text[]
language sql
immutable
set search_path = public
as $$
  select coalesce(array_agg(distinct cleaned order by cleaned), '{}'::text[])
  from (
    select nullif(
      regexp_replace(match_value, '[\]\[\)\(\}\{,.;:!?]+$', '', 'g'),
      ''
    ) as cleaned
    from regexp_matches(
      coalesce(p_text, ''),
      '(https?://[^[:space:]<>"'']+)',
      'gi'
    ) as matches(match_value)
  ) as urls
  where cleaned is not null;
$$;

create or replace function public.task_is_content_execution_v1(p_task_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  task_row public.tasks%rowtype;
  step_text text;
  execution_text text;
begin
  select * into task_row
  from public.tasks
  where id = p_task_id;

  if not found then return false; end if;
  if task_row.scope <> 'mission'::public.task_scope then return false; end if;
  if task_row.work_mode = 'manager_work' then return false; end if;

  select lower(coalesce(string_agg(step.body, ' ' order by step.order_index), ''))
  into step_text
  from public.task_steps as step
  where step.task_id = p_task_id;

  execution_text := lower(concat_ws(
    ' ',
    task_row.title,
    task_row.purpose,
    task_row.completion_expectation,
    task_row.manager_responsibility,
    task_row.user_responsibility,
    step_text
  ));

  return execution_text ~* '(\mcontent\M.{0,30}\m(video|piece|test|post|series)\M|\m(video|videos|tiktok|reel|reels|short-form|ugc|film|filming|shoot|shooting|carousel|social video)\M)';
end;
$$;

create or replace function public.capture_content_post_result_v1()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  urls text[];
begin
  if new.status <> 'completed'::public.task_result_status
     or not public.task_is_content_execution_v1(new.task_id) then
    return new;
  end if;

  urls := public.extract_public_result_urls_v1(new.user_note);
  new.raw_event := coalesce(new.raw_event, '{}'::jsonb) || jsonb_build_object(
    'result_kind', 'content_post_result',
    'external_refs', to_jsonb(urls),
    'external_ref_count', cardinality(urls)
  );

  return new;
end;
$$;

create or replace function public.publish_content_post_result_signal_v1()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  refs text[] := '{}';
  ref_value text;
begin
  if new.status <> 'completed'::public.task_result_status
     or coalesce(new.raw_event ->> 'result_kind', '') <> 'content_post_result' then
    return new;
  end if;

  if jsonb_typeof(new.raw_event -> 'external_refs') = 'array' then
    select coalesce(array_agg(value), '{}'::text[])
    into refs
    from jsonb_array_elements_text(new.raw_event -> 'external_refs') as item(value)
    where nullif(btrim(value), '') is not null;
  end if;

  if new.checkpoint_id is not null and cardinality(refs) > 0 then
    update public.checkpoints as checkpoint
    set watched_signals = (
          select coalesce(array_agg(distinct signal order by signal), '{}'::text[])
          from unnest(coalesce(checkpoint.watched_signals, '{}'::text[]) || refs) as item(signal)
        ),
        updated_at = now()
    where checkpoint.id = new.checkpoint_id
      and checkpoint.artist_workspace_id = new.artist_workspace_id
      and checkpoint.artist_id = new.artist_id;
  end if;

  insert into public.operating_events (
    account_id,
    artist_workspace_id,
    artist_id,
    event_type,
    actor_type,
    target_type,
    target_id,
    source_type,
    source_id,
    manager_synthesis_run_id,
    mission_id,
    checkpoint_id,
    task_id,
    dedupe_key,
    display_mode,
    refresh_scope,
    summary,
    payload
  ) values (
    new.account_id,
    new.artist_workspace_id,
    new.artist_id,
    'content_post_result_recorded',
    'user',
    'task',
    new.task_id,
    'task_result',
    new.id,
    new.created_from_run_id,
    new.mission_id,
    new.checkpoint_id,
    new.task_id,
    'content-post-result:' || new.id::text,
    'activity',
    array['missions', 'activity']::text[],
    case
      when cardinality(refs) > 0 then 'A content post result was recorded with a public reference.'
      else 'A content post result was recorded from the artist report.'
    end,
    jsonb_build_object(
      'taskResultId', new.id,
      'externalRefs', to_jsonb(refs),
      'observationBoundary', case
        when cardinality(refs) > 0 then 'public_reference_available'
        else 'artist_report_only'
      end
    )
  ) on conflict (artist_workspace_id, dedupe_key) where dedupe_key is not null do nothing;

  return new;
end;
$$;

revoke all on function public.extract_public_result_urls_v1(text) from public, anon, authenticated;
revoke all on function public.task_is_content_execution_v1(uuid) from public, anon, authenticated;
revoke all on function public.capture_content_post_result_v1() from public, anon, authenticated;
revoke all on function public.publish_content_post_result_signal_v1() from public, anon, authenticated;
grant execute on function public.extract_public_result_urls_v1(text) to service_role;
grant execute on function public.task_is_content_execution_v1(uuid) to service_role;

drop trigger if exists capture_content_post_result on public.task_results;
create trigger capture_content_post_result
before insert on public.task_results
for each row
execute function public.capture_content_post_result_v1();

drop trigger if exists publish_content_post_result_signal on public.task_results;
create trigger publish_content_post_result_signal
after insert on public.task_results
for each row
execute function public.publish_content_post_result_signal_v1();
