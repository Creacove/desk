\set ON_ERROR_STOP on
insert into public.accounts(id,name,status) values('80000000-0000-4000-8000-000000000001','Gate 8 concurrency','active');
insert into public.artists(id,account_id,display_name) values('80000000-0000-4000-8000-000000000002','80000000-0000-4000-8000-000000000001','Concurrency Artist');
insert into public.artist_workspaces(id,account_id,artist_id,name,status) values('80000000-0000-4000-8000-000000000003','80000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000002','Concurrency Artist','active');
update public.manager_runtime_limits set max_active_slots=4,operation_burst_slots_10m=100,max_provider_slots_hour=500,max_provider_slots_day=2000 where artist_workspace_id='80000000-0000-4000-8000-000000000003';
