\set ON_ERROR_STOP on

do $$
declare
  urls text[];
  definition text;
begin
  if to_regprocedure('public.extract_public_result_urls_v1(text)') is null then
    raise exception 'extract_public_result_urls_v1 is missing';
  end if;
  if to_regprocedure('public.task_is_content_execution_v1(uuid)') is null then
    raise exception 'task_is_content_execution_v1 is missing';
  end if;
  if to_regprocedure('public.capture_content_post_result_v1()') is null then
    raise exception 'capture_content_post_result_v1 is missing';
  end if;
  if to_regprocedure('public.publish_content_post_result_signal_v1()') is null then
    raise exception 'publish_content_post_result_signal_v1 is missing';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'capture_content_post_result'
      and not tgisinternal
  ) then
    raise exception 'content result capture trigger is missing';
  end if;
  if not exists (
    select 1 from pg_trigger
    where tgname = 'publish_content_post_result_signal'
      and not tgisinternal
  ) then
    raise exception 'content result publish trigger is missing';
  end if;

  urls := public.extract_public_result_urls_v1(
    'Live now: https://www.tiktok.com/@otmos/video/12345). Backup: https://instagram.com/reel/ABC123! Same again https://www.tiktok.com/@otmos/video/12345'
  );
  if urls <> array['https://instagram.com/reel/ABC123', 'https://www.tiktok.com/@otmos/video/12345']::text[] then
    raise exception 'public result URL extraction is wrong: %', urls;
  end if;

  select pg_get_functiondef('public.capture_content_post_result_v1()'::regprocedure)
  into definition;
  if position('content_post_result' in definition) = 0
     or position('external_refs' in definition) = 0
     or position('external_ref_count' in definition) = 0 then
    raise exception 'content result capture does not persist structured external refs';
  end if;

  select pg_get_functiondef('public.publish_content_post_result_signal_v1()'::regprocedure)
  into definition;
  if position('watched_signals' in definition) = 0
     or position('content_post_result_recorded' in definition) = 0
     or position('public_reference_available' in definition) = 0
     or position('artist_report_only' in definition) = 0 then
    raise exception 'content result signal does not preserve observation boundaries';
  end if;

  -- This slice captures only accessible evidence subjects. It must not claim
  -- private/social comment-body visibility or raw-video understanding.
  if position('comment text' in lower(definition)) > 0
     or position('raw video analysis' in lower(definition)) > 0 then
    raise exception 'content result signal overclaims unavailable observation capability';
  end if;
end;
$$;
