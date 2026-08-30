do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'manager_synthesis_runs',
    'manager_run_actions',
    'ai_run_usage_events',
    'reviews',
    'permission_requests',
    'memory_entries'
  ] loop
    if has_table_privilege('authenticated', 'public.' || table_name, 'INSERT')
      or has_table_privilege('authenticated', 'public.' || table_name, 'UPDATE')
      or has_table_privilege('authenticated', 'public.' || table_name, 'DELETE')
    then
      raise exception 'authenticated can mutate service-owned Manager table %', table_name;
    end if;
    if not has_table_privilege('authenticated', 'public.' || table_name, 'SELECT') then
      raise exception 'authenticated cannot read account-scoped Manager table %', table_name;
    end if;
    if not has_table_privilege('service_role', 'public.' || table_name, 'INSERT')
      or not has_table_privilege('service_role', 'public.' || table_name, 'UPDATE')
      or not has_table_privilege('service_role', 'public.' || table_name, 'DELETE')
    then
      raise exception 'service_role cannot maintain Manager table %', table_name;
    end if;
    if exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = table_name
        and policyname = table_name || '_account_members_modify'
    ) then
      raise exception 'member modify policy remains on service-owned Manager table %', table_name;
    end if;
  end loop;
end;
$$;

do $$
declare
  helper_signature text;
begin
  foreach helper_signature in array array[
    'public.rls_auto_enable()',
    'public.stale_campaign_documents_from_music_item()',
    'public.stale_campaign_documents_from_music_child()',
    'public.set_updated_at()',
    'public.validate_task_transition()',
    'public.get_guc_role()'
  ] loop
    if has_function_privilege('anon', helper_signature, 'execute')
      or has_function_privilege('authenticated', helper_signature, 'execute') then
      raise exception 'internal security-definer helper remains client-executable: %', helper_signature;
    end if;
  end loop;
end;
$$;
