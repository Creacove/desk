-- The conversation mission adapter writes tasks and task_steps through separate
-- PostgREST transactions. Human tasks are therefore inserted as manager_work,
-- their steps are written, and only then is work_mode activated. Validate that
-- activation against the same complete execution contract used at insert time.

drop trigger if exists generated_human_task_execution_contract_on_activation on public.tasks;
create trigger generated_human_task_execution_contract_on_activation
after update of work_mode on public.tasks
for each row
when (old.work_mode is distinct from new.work_mode)
execute function public.enforce_generated_human_task_execution_contract_v1();
