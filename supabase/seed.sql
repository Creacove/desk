-- Reference seed for Phase 1. Runtime/demo artist data is intentionally deferred
-- until the schema and Spotify bootstrap workflow are in place.

insert into public.source_providers (provider_key, display_name, source_kind, default_confidence, claim_boundaries)
values
  ('spotify', 'Spotify Public Catalog', 'official_api', 'low', '{"supports":["identity","catalog","public metadata"],"forbidden":["private saves","source-of-stream","revenue","conversion"]}'::jsonb),
  ('spotify_for_artists', 'Spotify for Artists Export', 'uploaded_file', 'medium', '{"supports":["private analytics when uploaded"],"forbidden":["claims outside export fields"]}'::jsonb),
  ('youtube', 'YouTube Data API', 'official_api', 'medium', '{"supports":["public video and comment context"],"forbidden":["private analytics","conversion"]}'::jsonb),
  ('chartmetric', 'Chartmetric', 'third_party_provider', 'medium', '{"supports":["artist intelligence","track intelligence","project intelligence","playlist movement","chart movement","platform metrics","public social context"],"forbidden":["rights certainty","royalty revenue without royalty statements","campaign ROI without spend and conversion proof","private Spotify saves","source-of-stream"]}'::jsonb),
  ('tiktok', 'TikTok Public/Provider Signal', 'public_web', 'medium', '{"supports":["attention","participation"],"forbidden":["streaming conversion","spend ROI"]}'::jsonb),
  ('instagram', 'Instagram Public/Provider Signal', 'public_web', 'medium', '{"supports":["public social response"],"forbidden":["listener conversion without links"]}'::jsonb),
  ('x', 'X Public Signal', 'public_web', 'low', '{"supports":["conversation context"],"forbidden":["fan demand certainty"]}'::jsonb),
  ('manual_upload', 'Manual Upload', 'uploaded_file', 'medium', '{"supports":["facts contained in uploaded files"],"forbidden":["claims beyond file scope"]}'::jsonb)
on conflict (provider_key) do update
set display_name = excluded.display_name,
    source_kind = excluded.source_kind,
    default_confidence = excluded.default_confidence,
    claim_boundaries = excluded.claim_boundaries;

insert into public.agent_profiles (
  agent_key,
  name,
  title,
  status_default,
  purpose,
  tools,
  required_source_capabilities,
  optional_source_capabilities,
  manager_can_prepare,
  color
)
values
  ('manager', 'AI Manager', 'Available now', 'available', 'Coordinates priorities, decisions, missions, check-ins, and team briefs.', array['Decision reviews','Mission planner','Artist check-ins','Quality review'], array[]::text[], array['spotify_for_artists_export','smart_link_report'], array['Create missions','Write decision packages','Request sources','Prepare specialist referrals'], '#9A3BDC'),
  ('marketing', 'Marketing Lead', 'Locked', 'locked', 'Campaign planning, content tests, creators, paid/organic growth, and platform strategy.', array['Content test planner','Creator map','Campaign calendar','Paid spend gate'], array['spotify_for_artists_export','smart_link_report','campaign_report'], array['creator_list','paid_spend_history'], array['Content angle read','Creator target hypothesis','Campaign test plan'], '#ffc7a3'),
  ('sync_deals', 'Sync & Deals', 'Locked', 'locked', 'Sync, brand, partnership, and deal opportunities when rights and pitch materials are credible.', array['Opportunity fit map','Rights readiness gate','Pitch package builder','Deal-risk checklist'], array['signed_split_sheet','clean_master','pitch_assets'], array['prior_deal_notes','brand_target_list'], array['Pitch-readiness checklist','Missing-material list'], '#8cc7d2'),
  ('touring', 'Touring Agent', 'Locked', 'locked', 'City demand, live-readiness, routing, venue/promoter fit, and show risk.', array['City validation','Routing desk','Venue fit','Live-readiness check'], array['live_history','venue_promoter_notes','city_signal_coverage'], array['calendar_availability','ticketing_history'], array['City validation report','Live-readiness risk'], '#8ab17d'),
  ('finance_rights', 'Finance/Rights', 'Locked', 'locked', 'Budget, royalty, splits, payout timing, ownership risk, metadata hygiene, and rights readiness.', array['Royalty comparison','Split review','Budget guardrail','Metadata hygiene'], array['royalty_statements','signed_split_sheets','distributor_export'], array['ownership_notes','budget_history'], array['Finance/rights risk memo','Missing proof request'], '#d4a373')
on conflict (agent_key) do update
set name = excluded.name,
    title = excluded.title,
    status_default = excluded.status_default,
    purpose = excluded.purpose,
    tools = excluded.tools,
    required_source_capabilities = excluded.required_source_capabilities,
    optional_source_capabilities = excluded.optional_source_capabilities,
    manager_can_prepare = excluded.manager_can_prepare,
    color = excluded.color;

insert into public.manager_context_questions (question_key, question, suggested_answer, required_for, order_index, status)
values
  ('current_priority', 'What decision are we trying to make right now?', 'Validate the active release before approving scale spend.', array['manager_office','decision_package'], 1, 'active'),
  ('budget_boundary', 'What budget or resource boundary should the Manager protect?', 'Keep total monthly spend capped until stronger conversion evidence arrives.', array['manager_office','budget_decision'], 2, 'active'),
  ('team_capacity', 'Who can actually do the work this week?', 'Artist and small team can handle focused release prep, source uploads, and approvals.', array['manager_office','mission_planning'], 3, 'active'),
  ('risk_boundary', 'What should the Manager avoid or slow down?', 'Avoid public commitments, expensive spend, and rights-sensitive action without proof.', array['manager_office','permission_boundary'], 4, 'active')
on conflict (question_key) do update
set question = excluded.question,
    suggested_answer = excluded.suggested_answer,
    required_for = excluded.required_for,
    order_index = excluded.order_index,
    status = excluded.status;

with pattern as (
  insert into public.mission_patterns (pattern_key, name, management_domains, status)
  values (
    'release_planning',
    'Release Planning',
    array['Release Strategy','Rights/Finance','Marketing','A&R'],
    'active'
  )
  on conflict (pattern_key) do update
  set name = excluded.name,
      management_domains = excluded.management_domains,
      status = excluded.status
  returning id
),
version as (
  insert into public.mission_pattern_versions (
    mission_pattern_id,
    version,
    description,
    when_to_use,
    likely_agent_keys,
    artist_specific_inputs_required,
    evidence_needs,
    common_task_types,
    checkpoint_questions,
    permission_boundaries,
    review_triggers,
    success_state,
    blockage_state,
    change_conditions
  )
  select
    pattern.id,
    1,
    'Prepare, move, validate, or review a release without treating release work as the entire operating system.',
    'Use when a song/project needs release timing, rights, distribution, DSP pitch, content, launch, or post-release signal review.',
    array['manager','marketing','finance_rights','sync_deals'],
    array['active release','planned date','budget','team capacity','rights state','source availability'],
    array['split sheet','distributor status','DSP pitch readiness','content assets','social signal','private analytics when available'],
    array['confirm rights','submit distributor package','prepare pitch assets','approve content','verify live links','upload analytics export'],
    array['Is the release safe to distribute?','Is campaign preparation ready?','Are launch assets approved?','Is post-release signal strong enough to scale?'],
    array['public date changes','spend','submissions','outreach','rights/finance conclusions'],
    array['rights fail','source data changes','task result blocks launch','post-release signal changes recommendation'],
    'Release is safe, promoted appropriately, and reviewed after signal.',
    'Rights, delivery, missing assets, weak evidence, or no approval blocks progress.',
    array['rights fail','evidence strengthens','evidence weakens','team capacity changes']
  from pattern
  on conflict (mission_pattern_id, version) do update
  set description = excluded.description,
      when_to_use = excluded.when_to_use,
      likely_agent_keys = excluded.likely_agent_keys,
      artist_specific_inputs_required = excluded.artist_specific_inputs_required,
      evidence_needs = excluded.evidence_needs,
      common_task_types = excluded.common_task_types,
      checkpoint_questions = excluded.checkpoint_questions,
      permission_boundaries = excluded.permission_boundaries,
      review_triggers = excluded.review_triggers,
      success_state = excluded.success_state,
      blockage_state = excluded.blockage_state,
      change_conditions = excluded.change_conditions
  returning id, mission_pattern_id
)
update public.mission_patterns
set current_version_id = version.id
from version
where public.mission_patterns.id = version.mission_pattern_id;
