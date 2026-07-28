begin;

with transitional as (
  select id, render_json
  from public.manager_outputs
  where schema_version = 'music-manager-read-v2'
    and output_type in ('song_manager_read', 'project_manager_read')
    and is_current = true
    and jsonb_typeof(render_json) = 'object'
    and render_json ? 'signals'
    and render_json ? 'decision'
),
converted as (
  select
    transitional.id,
    transitional.render_json,
    coalesce((
      select jsonb_agg(
        jsonb_build_object('label', signal ->> 'label', 'value', signal ->> 'value', 'evidenceId', selected.evidence_id)
        order by signal_ordinality
      )
      from jsonb_array_elements(
        case
          when jsonb_typeof(transitional.render_json -> 'signals') = 'array'
            then transitional.render_json -> 'signals'
          else '[]'::jsonb
        end
      ) with ordinality as signal_rows(signal, signal_ordinality)
      cross join lateral (
        select evidence_value #>> '{}' as evidence_id
        from jsonb_array_elements(
          case
            when jsonb_typeof(signal -> 'evidenceIds') = 'array'
              then signal -> 'evidenceIds'
            else '[]'::jsonb
          end
        ) with ordinality as evidence_rows(evidence_value, evidence_ordinality)
        where jsonb_typeof(evidence_value) = 'string'
          and nullif(btrim(evidence_value #>> '{}'), '') is not null
        order by evidence_ordinality
        limit 1
      ) as selected
      where jsonb_typeof(signal) = 'object'
        and nullif(btrim(signal ->> 'label'), '') is not null
        and nullif(btrim(signal ->> 'value'), '') is not null
    ), '[]'::jsonb) as metrics,
    coalesce((
      select jsonb_agg(
        jsonb_build_object('id', evidence_value #>> '{}')
        order by evidence_ordinality
      )
      from jsonb_array_elements(
        case
          when jsonb_typeof(transitional.render_json -> 'evidenceIds') = 'array'
            then transitional.render_json -> 'evidenceIds'
          else '[]'::jsonb
        end
      ) with ordinality as evidence_rows(evidence_value, evidence_ordinality)
      where jsonb_typeof(evidence_value) = 'string'
        and nullif(btrim(evidence_value #>> '{}'), '') is not null
    ), '[]'::jsonb) as supporting_evidence
  from transitional
)
update public.manager_outputs
set render_json = jsonb_build_object(
      'position', converted.render_json -> 'position',
      'managementRole', converted.render_json -> 'managementRole',
      'body', converted.render_json -> 'body',
      'metrics', converted.metrics,
      'evidenceIds', coalesce(converted.render_json -> 'evidenceIds', '[]'::jsonb)
    ),
    primary_recommendation_json = jsonb_build_object('managerRead', converted.render_json->>'body'),
    avoid_json = '[]'::jsonb,
    confidence_json = '{}'::jsonb,
    supporting_evidence_json = converted.supporting_evidence
from converted
where public.manager_outputs.id = converted.id;

commit;
