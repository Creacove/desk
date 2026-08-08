-- Keep this migration ASCII-only so shell encoding cannot corrupt its repair text.
-- The damaged sequence is the three-character mojibake form of an em dash.

do $$
declare
  v_corrupt_dash text := chr(226) || chr(8364) || chr(8221);
  v_correct_dash text := chr(8212);
  v_function regprocedure;
  v_definition text;
begin
  v_function := to_regprocedure(
    'public.create_conversational_song_workspace_v2(uuid,uuid,uuid,uuid,text,public.music_item_type,public.music_lifecycle_stage,text,text,text,text,text,text,text,text,text,uuid)'
  );

  if v_function is not null then
    select pg_get_functiondef(v_function)
      into v_definition;

    if position(v_corrupt_dash in v_definition) > 0 then
      execute replace(v_definition, v_corrupt_dash, v_correct_dash);
    end if;
  end if;

  update public.conversations
     set topic = replace(topic, v_corrupt_dash, v_correct_dash)
   where position(v_corrupt_dash in topic) > 0;
end;
$$;

notify pgrst, 'reload schema';
