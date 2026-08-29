-- Generated human Task execution contract.
--
-- Manager-authored Mission Plans are installed atomically: the Task row and its
-- task_steps land in the same transaction. A deferred constraint trigger can
-- therefore validate the complete human handoff at commit time without creating
-- a second task system or blocking manual/admin Tasks.
--
-- The model/compiler remains responsible for judgment and specificity. This
-- boundary only rejects clearly incomplete human work and clearly incomplete
-- content-execution briefs before they become an active Plan.

create or replace function public.generated_human_task_requires_execution_contract_v1(p_task jsonb)
returns boolean
language sql
immutable
set search_path = public
as $$
  select
    lower(coalesce(p_task ->> 'scope', '')) = 'mission'
    and nullif(btrim(coalesce(p_task ->> 'missionPlanVersionId', '')), '') is not null
    and nullif(btrim(coalesce(p_task ->> 'createdFromRunId', '')), '') is not null
    and lower(coalesce(p_task ->> 'workMode', '')) <> 'manager_work'
    and lower(btrim(coalesce(p_task ->> 'ownerRole', ''))) <> 'manager';
$$;

create or replace function public.assert_generated_human_task_execution_contract_v1(
  p_task jsonb,
  p_steps text[]
)
returns void
language plpgsql
immutable
set search_path = public
as $$
declare
  title_text text := btrim(coalesce(p_task ->> 'title', ''));
  purpose_text text := btrim(coalesce(p_task ->> 'purpose', ''));
  completion_text text := btrim(coalesce(p_task ->> 'completionExpectation', ''));
  completion_mode_text text := lower(btrim(coalesce(p_task ->> 'completionMode', '')));
  manager_text text := btrim(coalesce(p_task ->> 'managerResponsibility', ''));
  user_text text := btrim(coalesce(p_task ->> 'userResponsibility', ''));
  risk_text text := btrim(coalesce(p_task ->> 'riskIfLate', ''));
  steps_text text := lower(array_to_string(coalesce(p_steps, '{}'::text[]), ' '));
  execution_text text;
  nonempty_step_count integer;
  is_content_execution boolean;
  has_special_resource_dependency boolean;
begin
  if title_text = '' then
    raise exception using errcode = '22023', message = 'generated_human_task_contract:title_required';
  end if;
  if purpose_text = '' then
    raise exception using errcode = '22023', message = 'generated_human_task_contract:purpose_required';
  end if;
  if completion_text = '' then
    raise exception using errcode = '22023', message = 'generated_human_task_contract:completion_expectation_required';
  end if;
  if manager_text = '' then
    raise exception using errcode = '22023', message = 'generated_human_task_contract:manager_responsibility_required';
  end if;
  if user_text = '' then
    raise exception using errcode = '22023', message = 'generated_human_task_contract:user_responsibility_required';
  end if;
  if risk_text = '' then
    raise exception using errcode = '22023', message = 'generated_human_task_contract:risk_if_late_required';
  end if;

  select count(*)::integer
  into nonempty_step_count
  from unnest(coalesce(p_steps, '{}'::text[])) as step(body)
  where nullif(btrim(step.body), '') is not null;

  if nonempty_step_count < 2 then
    raise exception using errcode = '22023', message = 'generated_human_task_contract:at_least_two_execution_steps_required';
  end if;

  execution_text := lower(concat_ws(
    ' ',
    title_text,
    purpose_text,
    completion_text,
    manager_text,
    user_text,
    risk_text,
    steps_text
  ));

  -- Detect only strong media/content cues. Ordinary admin/release Tasks should
  -- not be forced through a filming brief just because they use a word like
  -- "post-release" or "record" in another sense.
  is_content_execution := execution_text ~* '(\mcontent\M.{0,30}\m(video|piece|test|post|series)\M|\m(video|videos|tiktok|reel|reels|short-form|ugc|film|filming|shoot|shooting|carousel|social video)\M)';

  if not is_content_execution then
    return;
  end if;

  if nonempty_step_count < 4 then
    raise exception using errcode = '22023', message = 'generated_human_task_contract:content_requires_at_least_four_execution_steps';
  end if;

  -- A content-execution Task must resolve through a note/link/result path, not
  -- the generic file-deliverable uploader. Otherwise the existing Task Sheet can
  -- accidentally recreate a "upload your video to Desk" requirement even when
  -- the prose never says it.
  if completion_mode_text = 'evidence' then
    raise exception using errcode = '22023', message = 'generated_human_task_contract:content_file_deliverable_forbidden';
  end if;

  -- A usable content Task must explain the format/setup, the opening message,
  -- the physical/creative action, and how the piece is finished or published.
  if execution_text !~* '\m(scene|setup|location|shot|frame|camera|phone|selfie|parked|room|street|outside|indoors|studio|vertical|9:16|carousel|graphic|screen|visual|performance)\M' then
    raise exception using errcode = '22023', message = 'generated_human_task_contract:content_setup_or_format_required';
  end if;

  if execution_text !~* '(\mhook\M|\mopening\M|\mfirst line\M|\mtalking point\M|\mtext on screen\M|\mstart with\M|\msay\M|\mask\M|\mquestion\M|\mprompt\M)' then
    raise exception using errcode = '22023', message = 'generated_human_task_contract:content_hook_or_message_required';
  end if;

  if execution_text !~* '\m(film|record|shoot|capture|say|ask|show|perform|reply|edit|cut|post|publish)\M' then
    raise exception using errcode = '22023', message = 'generated_human_task_contract:content_creator_action_required';
  end if;

  if execution_text !~* '(\medit\M|\mcut\M|\mcaption\M|\mcta\M|\mcall to action\M|\mcomment\M|\msave\M|\mshare\M|\mpost\M|\mpublish\M|\mexport\M|\mtiktok\M|\mreel\M|\minstagram\M)' then
    raise exception using errcode = '22023', message = 'generated_human_task_contract:content_finish_or_distribution_direction_required';
  end if;

  -- Desk does not require full/raw campaign-video files as proof. Artists make
  -- and post in their normal tools; a public link, confirmation or available
  -- platform metrics can become the result instead.
  if execution_text ~* '(upload|attach|send|submit).{0,80}(raw video|rough cut|video file|full video).{0,120}\mdesk\M'
     or execution_text ~* '\mdesk\M.{0,120}(upload|attach|send|submit).{0,80}(raw video|rough cut|video file|full video)' then
    raise exception using errcode = '22023', message = 'generated_human_task_contract:raw_campaign_video_upload_to_desk_forbidden';
  end if;

  has_special_resource_dependency := lower(concat_ws(' ', purpose_text, user_text, steps_text)) ~*
    '\m(access|borrow|rent|bring|get|use|with)\M.{0,80}\m(car|venue|photographer|tripod|friend|friends|crew|dancer|dancers|stylist|studio|rooftop|equipment)\M';

  if has_special_resource_dependency
     and execution_text !~* '(\mfallback\M|\motherwise\M|\minstead\M|\mif not\M|\mif unavailable\M|\mif .*cannot\M|\mif .*can''t\M)' then
    raise exception using errcode = '22023', message = 'generated_human_task_contract:resource_dependent_content_requires_fallback';
  end if;
end;
$$;

create or replace function public.enforce_generated_human_task_execution_contract_v1()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  task_payload jsonb;
  step_bodies text[];
begin
  task_payload := jsonb_build_object(
    'scope', new.scope::text,
    'missionPlanVersionId', new.mission_plan_version_id,
    'createdFromRunId', new.created_from_run_id,
    'title', new.title,
    'ownerRole', new.owner_role,
    'workMode', new.work_mode,
    'purpose', new.purpose,
    'completionExpectation', new.completion_expectation,
    'completionMode', new.completion_mode,
    'managerResponsibility', new.manager_responsibility,
    'userResponsibility', new.user_responsibility,
    'riskIfLate', new.risk_if_late
  );

  if not public.generated_human_task_requires_execution_contract_v1(task_payload) then
    return new;
  end if;

  select coalesce(array_agg(step.body order by step.order_index), '{}'::text[])
  into step_bodies
  from public.task_steps as step
  where step.task_id = new.id;

  perform public.assert_generated_human_task_execution_contract_v1(task_payload, step_bodies);
  return new;
end;
$$;

revoke all on function public.generated_human_task_requires_execution_contract_v1(jsonb) from public, anon, authenticated;
revoke all on function public.assert_generated_human_task_execution_contract_v1(jsonb, text[]) from public, anon, authenticated;
revoke all on function public.enforce_generated_human_task_execution_contract_v1() from public, anon, authenticated;
grant execute on function public.generated_human_task_requires_execution_contract_v1(jsonb) to service_role;
grant execute on function public.assert_generated_human_task_execution_contract_v1(jsonb, text[]) to service_role;

drop trigger if exists generated_human_task_execution_contract on public.tasks;
create constraint trigger generated_human_task_execution_contract
after insert on public.tasks
deferrable initially deferred
for each row
execute function public.enforce_generated_human_task_execution_contract_v1();
