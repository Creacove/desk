\set ON_ERROR_STOP on

-- Disposable transactional proof for the multi-human Manager continuation.
begin;

insert into public.accounts (id, name, status) values
  ('92000000-0000-4000-8000-000000000001', 'Golden Team', 'active'),
  ('92000000-0000-4000-8000-000000000011', 'Foreign Team', 'active');
insert into public.artists (id, account_id, display_name) values
  ('92000000-0000-4000-8000-000000000002', '92000000-0000-4000-8000-000000000001', 'Golden Artist'),
  ('92000000-0000-4000-8000-000000000012', '92000000-0000-4000-8000-000000000011', 'Foreign Artist');
insert into public.artist_workspaces (id, account_id, artist_id, name, status) values
  ('92000000-0000-4000-8000-000000000003', '92000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000002', 'Golden Workspace', 'active'),
  ('92000000-0000-4000-8000-000000000013', '92000000-0000-4000-8000-000000000011', '92000000-0000-4000-8000-000000000012', 'Foreign Workspace', 'active');

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('92000000-0000-4000-8000-000000000004', 'temi-golden@example.invalid', now(), '{"name":"Temi"}'),
  ('92000000-0000-4000-8000-000000000005', 'sarah-golden@example.invalid', now(), '{"name":"Sarah"}'),
  ('92000000-0000-4000-8000-000000000006', 'daniel-golden@example.invalid', now(), '{"name":"Daniel"}'),
  ('92000000-0000-4000-8000-000000000014', 'foreign-golden@example.invalid', now(), '{"name":"Foreign user"}');
insert into public.users (id, email, display_name, status) values
  ('92000000-0000-4000-8000-000000000004', 'temi-golden@example.invalid', 'Temi', 'active'),
  ('92000000-0000-4000-8000-000000000005', 'sarah-golden@example.invalid', 'Sarah', 'active'),
  ('92000000-0000-4000-8000-000000000006', 'daniel-golden@example.invalid', 'Daniel', 'active'),
  ('92000000-0000-4000-8000-000000000014', 'foreign-golden@example.invalid', 'Foreign user', 'active');
insert into public.account_memberships (account_id, user_id, role, status, operating_title, responsibility_tags) values
  ('92000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000004', 'owner', 'active', 'Artist Manager', '{strategy,approvals}'),
  ('92000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000005', 'member', 'active', 'DSP & Distribution', '{distribution,DSP pitching}'),
  ('92000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000006', 'member', 'active', 'A&R', '{recording,final masters}'),
  ('92000000-0000-4000-8000-000000000011', '92000000-0000-4000-8000-000000000014', 'owner', 'active', 'Owner', '{}');
insert into public.workspace_team_settings (account_id, artist_workspace_id, artist_id, enabled, pilot_ends_at) values
  ('92000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000003', '92000000-0000-4000-8000-000000000002', true, now() + interval '1 day');

insert into public.billing_plan_catalog(provider, provider_product_id, provider_price_id, plan_key, billing_interval, seat_limit, artist_limit, active)
values ('paddle', 'golden-team-product', 'golden-team-price', 'team_6', 'monthly', 6, 1, true);
insert into public.billing_subscriptions(account_id, artist_workspace_id, user_id, provider, provider_subscription_code, provider_plan_code, provider_product_id, provider_price_id, amount_minor, amount, currency, status, current_period_start, current_period_end, plan_key)
values ('92000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000003', '92000000-0000-4000-8000-000000000004', 'paddle', 'golden-team-subscription', 'golden-team-price', 'golden-team-product', 'golden-team-price', 9900, 99, 'USD', 'active', now(), now() + interval '1 month', 'team_6');

insert into public.missions(id, account_id, artist_workspace_id, artist_id, title, objective, status)
values ('92000000-0000-4000-8000-000000000020', '92000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000003', '92000000-0000-4000-8000-000000000002', 'Release the single', 'Deliver the release', 'active');
insert into public.mission_plan_versions(id, account_id, artist_workspace_id, artist_id, mission_id, version, status)
values ('92000000-0000-4000-8000-000000000021', '92000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000003', '92000000-0000-4000-8000-000000000002', '92000000-0000-4000-8000-000000000020', 1, 'active');
update public.missions set active_plan_version_id = '92000000-0000-4000-8000-000000000021' where id = '92000000-0000-4000-8000-000000000020';
insert into public.checkpoints(id, account_id, artist_workspace_id, artist_id, mission_id, mission_plan_version_id, title, question)
values ('92000000-0000-4000-8000-000000000022', '92000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000003', '92000000-0000-4000-8000-000000000002', '92000000-0000-4000-8000-000000000020', '92000000-0000-4000-8000-000000000021', 'Master ready', 'Is the final master ready?');

-- Sarah reports the DSP task blocked; Manager hands the dependency to Daniel.
insert into public.operating_events(account_id, artist_workspace_id, artist_id, event_type, actor_type, target_type, target_id, source_type, source_id, mission_id, checkpoint_id, summary, payload)
values ('92000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000003', '92000000-0000-4000-8000-000000000002', 'task_blocked', 'manager', 'task', gen_random_uuid(), 'task_result', gen_random_uuid(), '92000000-0000-4000-8000-000000000020', '92000000-0000-4000-8000-000000000022', 'Sarah is blocked because the final master is unavailable.', jsonb_build_object('followUpTasks', jsonb_build_array(jsonb_build_object(
  'title','Deliver the final master','purpose','Unblock DSP delivery','ownerRole','A&R','workMode','artist_action','intent','human_action','steps',jsonb_build_array('Confirm the approved mix.','Export and upload the final master.'),'evidenceNeeded',jsonb_build_array('final master'),'completionExpectation','The final master is available to Sarah.','completionMode','result_note','managerResponsibility','Desk will validate the file and resume DSP work.','userResponsibility','Daniel exports and uploads the master.','riskIfLate','DSP delivery remains blocked.','estimatedMinutes',30,'assigneeUserId','92000000-0000-4000-8000-000000000006','assignmentReason','Daniel owns A&R and recording.'
))));

do $$
declare continuation_task public.tasks%rowtype;
begin
  select * into continuation_task from public.tasks where artist_workspace_id='92000000-0000-4000-8000-000000000003' and title='Deliver the final master';
  if continuation_task.id is null or continuation_task.assignee_user_id is distinct from '92000000-0000-4000-8000-000000000006'::uuid then raise exception 'Daniel did not receive the continuation task'; end if;
  if not exists (select 1 from public.reminder_queue where task_id=continuation_task.id and user_id='92000000-0000-4000-8000-000000000006' and status='queued') then raise exception 'Daniel reminder was not queued'; end if;
  if exists (select 1 from public.reminder_queue where task_id=continuation_task.id and user_id in ('92000000-0000-4000-8000-000000000004','92000000-0000-4000-8000-000000000005') and status in ('queued','processing')) then raise exception 'A stale reminder remained assigned to Temi or Sarah'; end if;
end $$;

-- Daniel completes the dependency; Manager can hand the now-actionable DSP work back to Sarah.
update public.tasks set status='completed' where artist_workspace_id='92000000-0000-4000-8000-000000000003' and title='Deliver the final master';
insert into public.operating_events(account_id, artist_workspace_id, artist_id, event_type, actor_type, target_type, target_id, source_type, source_id, mission_id, checkpoint_id, summary, payload)
values ('92000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000003', '92000000-0000-4000-8000-000000000002', 'task_completed', 'manager', 'task', gen_random_uuid(), 'task_result', gen_random_uuid(), '92000000-0000-4000-8000-000000000020', '92000000-0000-4000-8000-000000000022', 'Daniel supplied the master; DSP can continue.', jsonb_build_object('followUpTasks', jsonb_build_array(jsonb_build_object(
  'title','Resume the DSP submission','purpose','Submit the now-ready master','ownerRole','DSP & Distribution','workMode','artist_action','intent','human_action','steps',jsonb_build_array('Open the prepared DSP submission.','Attach the final master and submit.'),'evidenceNeeded',jsonb_build_array('DSP submission receipt'),'completionExpectation','The DSP submission is delivered.','completionMode','result_note','managerResponsibility','Desk validates the master and prepared release context.','userResponsibility','Sarah submits the prepared package.','riskIfLate','The release window may slip.','estimatedMinutes',20,'assigneeUserId','92000000-0000-4000-8000-000000000005','assignmentReason','Sarah owns DSP and distribution.'
))));
do $$ begin
  if not exists (select 1 from public.tasks where artist_workspace_id='92000000-0000-4000-8000-000000000003' and title='Resume the DSP submission' and assignee_user_id='92000000-0000-4000-8000-000000000005') then raise exception 'Manager did not continue by returning actionable DSP work to Sarah'; end if;
end $$;

-- A foreign user can never cross the account boundary; the task stays unassigned.
insert into public.operating_events(account_id, artist_workspace_id, artist_id, event_type, actor_type, target_type, target_id, source_type, source_id, mission_id, checkpoint_id, summary, payload)
values ('92000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000003', '92000000-0000-4000-8000-000000000002', 'task_blocked', 'manager', 'task', gen_random_uuid(), 'task_result', gen_random_uuid(), '92000000-0000-4000-8000-000000000020', '92000000-0000-4000-8000-000000000022', 'Invalid proposal test', jsonb_build_object('followUpTasks', jsonb_build_array(jsonb_build_object('title','Invalid foreign assignment','purpose','Prove fail closed','ownerRole','Team','workMode','collaborative','intent','collaborative_draft','steps',jsonb_build_array('Inspect the request.','Leave ownership unresolved.'),'evidenceNeeded','[]'::jsonb,'completionExpectation','Assignment is safely unresolved.','completionMode','manager_draft','managerResponsibility','Desk validates identity.','userResponsibility','An active member claims the work.','riskIfLate','Work remains unowned.','estimatedMinutes',10,'assigneeUserId','92000000-0000-4000-8000-000000000014','assignmentReason','Foreign identity'))));

do $$ begin
  if not exists (select 1 from public.tasks where artist_workspace_id='92000000-0000-4000-8000-000000000003' and title='Invalid foreign assignment' and assignee_user_id is null) then raise exception 'Foreign identity did not fail closed to an unassigned task'; end if;
end $$;

rollback;
