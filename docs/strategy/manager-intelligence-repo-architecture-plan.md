# Manager Intelligence Repo Architecture Plan

Source handoff: `docs/strategy/ordersounds-manager-intelligence-cto-handoff-v6.md`

This document translates the CTO handoff into this repository's architecture. The handoff is the product standard. This plan defines how to apply it here without losing context, weakening the ambition, or forcing the app into the wrong technical shape.

## CTO-Level Decision

Build the real Manager Intelligence spine now. The app is pre-launch, so we should not patch the current prompt chain. Today, the repo has separate flows for Today's Brief, music reads, and Mission Genesis. That lets each surface sound useful, but it creates competing intelligence sources. The handoff requires one durable Strategic Intelligence Packet that all product surfaces consume.

The target architecture is:

```text
Connected sources + internal state + user goals + prior memory
  -> Data normalization
  -> Artist Signal Snapshot
  -> Artist Operating Profile
  -> Manager Intelligence Engine
  -> Strategic Intelligence Packet
  -> Dynamic renderers and downstream generators
```

In this repo, the backend implementation belongs under:

```text
supabase/functions/_shared/manager-intelligence/
```

The frontend implementation belongs under:

```text
src/types/cleanProduction.ts
src/features/desk/
src/features/manager/
src/features/music/
src/features/missions/
src/services/productionSupabase.ts
```

The handoff's suggested `src/lib/manager-intelligence` path maps to Supabase shared function modules because this repo runs AI generation and persistence in Edge Functions. The frontend should render and route intelligence; it should not own the intelligence engine.

## Current Repo Reality

Existing useful foundations:

- `supabase/functions/generate-todays-brief/index.ts` builds an `ArtistBriefPacket` and directly renders a Today's Brief.
- `supabase/functions/_shared/openaiTodaysBrief.ts` has evidence ID validation and visible-copy sanitization.
- `supabase/functions/generate-music-summary/index.ts` builds a per-song/project `ManagerReadPacket`.
- `supabase/functions/_shared/openaiManagerRead.ts` validates evidence IDs and banned visible terms for music reads.
- `supabase/functions/mission-genesis/index.ts` builds its own artist operating packet and creates missions, tasks, checkpoints, and permissions.
- `supabase/migrations/20260526000100_core_operating_schema.sql` already has `manager_synthesis_runs`, `evidence_items`, `source_snapshots`, `music_items`, `music_projects`, `missions`, `checkpoints`, `tasks`, `memory_entries`, `conversations`, `conversation_messages`, and `ai_run_usage_events`.
- `src/features/desk/DeskHQ.tsx` renders the current Today's Brief as a fixed headline, metric grid, and Manager's Read.
- `src/features/music/MusicScreens.tsx` renders generated song/project reads from music metadata.
- `src/features/manager/ManagerScreens.tsx` has a Manager Office shell, but Manager Chat is not yet a real packet-grounded answer system.

Core mismatch:

- The current app has multiple packet builders and multiple prompts.
- The handoff requires one reusable Strategic Intelligence Packet.
- `manager_synthesis_runs` is currently being used as both run audit and quasi-output storage. It should remain audit/provenance, not the durable product intelligence source.

## Preservation Pass: What The Current App Already Gets Right

The CTO handoff is strong, but it was written from outside the implementation. The current app already contains operating-system scaffolding that should not be discarded. The new Manager Intelligence architecture must absorb these strengths instead of replacing them with a narrower brief generator.

### 1. Label HQ Is The Main Operating Room

Existing doctrine from `docs/ai-record-label-prd.md` and `docs/operating-system-blueprint.md` says Label HQ is the primary surface, not a dashboard and not a chat screen. The CTO handoff focuses heavily on Today's Brief, but the repo already frames the brief as one part of Label HQ alongside Staff, Missions, flagged work, recent movement, contextual evidence, and Manager entry.

Preserve this rule:

- Today's Brief is not the whole product.
- Manager Chat is not the whole product.
- The Strategic Intelligence Packet should feed the whole Label HQ operating room: brief, directive, flagged items, active missions, staff readiness, music focus, and recent movement.

Repo implication:

- `manager_outputs` stores the user-facing brief/read shown on each surface.
- A directive can be projected from the latest `manager_intelligence_packets` plus `manager_outputs`; do not add a separate directive table until the UI needs independent directive lifecycle.
- `operating_events` should continue to feed Recent Movement.
- `DeskHQ.tsx` should evolve into a dynamic intelligence renderer, not a metrics dashboard.

### 2. Action Over Analysis Still Matters

The CTO handoff correctly says Today's Brief must not become a task/checkpoint screen. The existing product doctrine says every serious Manager output should help the team decide, act, and learn, and may create operational artifacts.

These are not contradictory.

Resolution:

- Today's Brief can state the management move but not render full task/checkpoint/mission plans.
- Mission Genesis, decision packages, reviews, and conversation runs create or update work.
- The Strategic Intelligence Packet carries mission seeds and decision context so downstream systems can create work without scraping visible brief text.

Repo implication:

- Keep Mission Genesis and mission/task/checkpoint infrastructure.
- Add packet consumption to Mission Genesis.
- Do not remove work creation from Manager intelligence; move it to the correct downstream surface.

### 3. Mission Rooms, Tasks, Checkpoints, Notes, And Memory Are Valuable

The current implementation already has a serious mission model:

- `missions`
- `mission_plan_versions`
- `mission_plan_checkpoints`
- `tasks`
- `task_steps`
- `task_results`
- `task_state_events`
- `checkpoints`
- `permission_requests`
- `memory_entries`
- `operating_events`

`productionSupabase.ts` already updates checkpoint recommendation, mission progress, task result memory, and operating events when a task is completed or blocked. `mission-genesis/index.ts` already creates candidate missions, context questions, active missions, mission plan versions, checkpoint phases, task steps, and permission requests.

Preserve this rule:

- Do not rebuild mission work as a flat task list.
- Do not let the packet create tasks directly.
- The packet creates mission-ready direction; Mission Genesis creates durable work.

Repo implication:

- The new packet must include enough `mission_seed`, `management_insights`, `asset_reads`, `market_reads`, evidence IDs, and risk notes for Mission Genesis.
- Mission Genesis keeps ownership of tasks/checkpoints/permissions and should preserve candidate/needs-context behavior.

### 4. Data Lineage And Usage Accounting Are Core Product Features

The current docs already require every dynamic value to trace to a source record, producer workflow, run/action provenance, evidence or limitation, and usage/cost event when billable work was used. The schema already includes `ai_run_usage_events`, `manager_synthesis_runs`, and `manager_run_actions`.

The CTO handoff says "supporting evidence." The repo standard is stricter: every state-bearing UI value must be reconstructable.

Preserve this rule:

- A brief headline, Manager read, "what changed" item, music next move, mission recommendation, checkpoint result, and chat answer all need lineage.
- Provider/model/cost details are internal audit and billing data, not normal product copy.

Repo implication:

- `manager_intelligence_packets` and `manager_outputs` need `created_from_run_id`.
- User-facing dynamic fields should have evidence IDs and, where practical, source/run metadata available through debug/service-layer projection.
- `ai_run_usage_events` remains mandatory for model/provider/tool work.

### 5. Source Confidence Rules Are Already Strong

`docs/workflows/source-confidence-contract.md` and the existing Chartmetric normalizer already encode source confidence, limitations, freshness, provenance, and forbidden claims. `chartmetricEvidence.ts` already maps many Chartmetric values into `evidence_items` with `lens`, `confidence`, `limitation`, and `raw_ref`.

Preserve this rule:

- The new KPI layer should sit above evidence normalization, not replace it.
- Evidence ingestion answers "what source fact exists?"
- KPI interpretation answers "what does this mean for management?"

Repo implication:

- Keep `evidence_items` as the normalized proof layer.
- Keep `chartmetricEvidence.ts` as source normalization.
- Add `chartmetricKpiNormalize.ts` and `kpiInterpreter.ts` as interpretation layers over current evidence.

### 6. Music Is First-Class Recorded-Work State

The current app has a substantial Music workspace with songs, projects, assets, details, rights, split confirmations, identifiers, generated manager reads, source limitations, and project tracklists. The CTO handoff's song/project reads should not become disconnected content cards.

Preserve this rule:

- Song/project reads are projections over durable Music records plus evidence and packet asset reads.
- Music does not own mission tasks/checkpoints; mission work remains in missions.
- Music state is context, not proof by itself.

Repo implication:

- `asset_reads_json` should reference `music_items.id` and `music_projects.id`.
- Music screens should render `manager_outputs` for song/project reads while still showing lifecycle, files, details, rights, splits, source limits, and linked missions.
- On-demand `generate-music-summary` should become a packet-compatible asset-read refresh path, not a separate strategy brain.

### 7. Staff And Locked Agents Are Part Of The Product Shape

The CTO handoff focuses on Manager Intelligence, but the current app is an AI record label with a staff model. `agent_profiles` and locked-agent surfaces are not decorative; they are how the product shows future label departments.

Preserve this rule:

- Manager is the coordinating authority.
- Specialist agents provide domain-specific perspectives when active.
- Locked agents can still have readiness/risk summaries from available evidence, without pretending full specialist conclusions.

Repo implication:

- The Strategic Intelligence Packet should be usable by future specialist agent reports and referrals.
- Manager Chat should refer to or prepare specialist handoffs when the question belongs to Marketing, Sync & Deals, Touring, or Finance/Rights.
- Staff readiness should be able to use packet signals and source gaps later.

### 8. Conversation Is One Trigger, Not The Product

The existing Manager Conversation Router contract is more advanced than the CTO handoff's chat section. It classifies user messages into simple answer, decision request, mission update, task result, memory update, evidence response, specialist referral, permission response, and review trigger.

Preserve this rule:

- Manager Chat should answer from the packet, but it should also route actions into the operating system.
- Serious questions should create decision packages, reviews, missions, tasks, permission requests, or memory when warranted.

Repo implication:

- `managerChatContextBuilder.ts` is not enough by itself.
- We also need a packet-aware conversation router that outputs structured action plans and preserves approval boundaries.

### 9. Memory Must Stay Append-First

The CTO handoff suggests `manager_memory`. The repo already has a broader memory doctrine: operating events, memory entries, memory summaries, outcome observations, and pattern outcomes. We should not add a parallel Manager memory table that becomes a mutable blob and erases history.

Preserve this rule:

- Raw events and memory entries are source of truth.
- Summaries and operating profiles are derived strategic memory.
- When the Manager changes its mind, it writes a new event/memory/review, not a silent overwrite.

Repo implication:

- Extend `memory_entries` with structured `payload jsonb` and use it for packet/output/chat/mission-derived memory.
- The current operating profile can be stored as a packet projection and optional `artist_profiles` cache, but the evidence/history that caused the update remains in `operating_events`, `memory_entries`, packets, and reviews.

### 10. Permission Boundaries Are Non-Negotiable

The existing product already distinguishes internal organization from external execution. The CTO handoff's "what to do next" language must not accidentally imply the system can spend, submit, publish, send outreach, make legal/finance conclusions, or change release plans without approval.

Preserve this rule:

- Internal organization can be automatic when confidence is sufficient.
- External, expensive, sensitive, legal, financial, public, or reputational actions require permission.

Repo implication:

- Mission seeds and next moves should mark permission-sensitive downstream actions.
- Mission Genesis should continue creating `permission_requests` when needed.
- Briefs should recommend the move without implying it has been approved or executed.

### 11. Existing Guardrails Are Worth Keeping

Current generated-output code already includes useful guardrails:

- strict JSON schemas
- banned visible term sanitization
- evidence ID requirements
- repair/retry behavior
- safe fallback for parser failures
- failed-run logging
- usage event writes
- source limitation copy

Preserve this rule:

- New packet and renderer schemas should reuse these patterns.
- Do not loosen validation just because the new architecture is broader.

Repo implication:

- Build shared visible-copy guards instead of duplicating banned-term lists.
- Build parser/repair paths for packet generation, brief rendering, music reads, Mission Genesis, and chat.

## Database Consolidation Pass

The first version of this plan translated the handoff too literally and proposed too many new tables. The repo already has a strong operating schema. Because the app is pre-launch, the right move is not "keep everything forever"; it is to clarify the canonical responsibility of each table and remove parallel concepts before users depend on them.

Database rule:

- Reuse existing tables when the table already represents the same product primitive.
- Add columns when the primitive is right but the shape is incomplete.
- Add a new table only when the repo has no durable primitive for that object.
- Do not store the same intelligence output in several abandoned JSON columns.

### Existing Tables To Reuse

| Product need from handoff | Existing table to reuse | CTO decision |
|---|---|---|
| Raw provider/file captures | `source_snapshots` | Keep as raw/source capture only. Add snapshot metadata when needed, but do not store derived Manager Intelligence here. |
| Atomic source-backed facts | `evidence_items` | Keep as canonical evidence rows. Add derived signal fields only if we need queryable signal indexes; otherwise keep signal interpretation in packets. |
| Evidence attached to outputs | `evidence_links` | Reuse for packets, visible outputs, missions, reviews, tasks, and memory. Do not duplicate large evidence arrays without link rows. |
| User-editable artist facts | `artist_profiles` and `artist_profile_versions` | Keep as human/profile truth: identity, genre, home market, goals, budget, direction. Do not mix mutable user profile with model-derived strategy. |
| Recorded works and projects | `music_items`, `music_projects`, `music_project_items`, music asset/rights tables | Keep as canonical Music workspace state. Generated reads become linked Manager outputs, not permanent truth inside music metadata. |
| Manager/AI run audit | `manager_synthesis_runs` | Keep as run/provenance/audit. Stop using `action_plan` as the canonical product output store. |
| Run-produced actions | `manager_run_actions` | Keep for proposed/applied actions and approval state. Do not use visible briefs as actions. |
| Work execution | `missions`, `mission_plan_versions`, `checkpoints`, `tasks`, `task_steps`, `task_state_events`, `task_results`, `reviews`, `permission_requests` | Keep as the durable work system. Mission Genesis consumes packet intelligence but remains the only mission/task/checkpoint writer. |
| Chat state | `conversations`, `conversation_messages`, `manager_context_questions`, `manager_context_answers` | Keep. Add packet-grounded routing and output links instead of inventing a separate chat store. |
| Durable memory | `memory_entries` | Reuse and extend. Do not add `manager_memory`. |
| Recent movement/audit trail | `operating_events` | Reuse. Packets, outputs, mission changes, and task outcomes write events. |
| Staff/specialist inputs | `agent_profiles`, `agent_runs`, `agent_reports`, `agent_notes`, `agent_inbox_items` | Reuse as specialist signal sources feeding packets and Label HQ. |
| Cost and provider accounting | `ai_run_usage_events` | Reuse. Internal provider/model details live here, never in normal product copy. |

### Column-Level Ownership Decisions

These decisions are based on the current migrations, not the handoff's assumed schema.

| Table | Reuse these columns | Change/add | Do not use for |
|---|---|---|---|
| `artist_profiles` | `display_name`, `spotify_identity`, `genres`, `home_market`, `stage`, `current_goal`, `active_focus_object_id`, `budget_context`, `social_handles`, `artist_direction`, `current_version_id` | Optional cache fields: `current_manager_packet_id`, `manager_profile_summary_json` | Do not store daily model-authored strategy as editable profile truth. |
| `artist_profile_versions` | `profile_payload`, `change_reason`, `source`, `created_by_type`, `created_from_run_id` | No first-cut change | Do not version every packet; only version user/profile changes. |
| `source_snapshots` | `source_connection_id`, `provider_id`, `source_kind`, `captured_at`, `time_window_start`, `time_window_end`, `raw_ref`, `raw_hash`, `metadata`, `snapshot_type`, `raw_payload` | Add only source-capture metadata if needed | Do not store derived signal snapshots or Manager conclusions. |
| `evidence_items` | `source`, `source_kind`, `evidence_type`, `subject_type`, `subject_id`, `subject_label`, `metric_name`, `metric_value`, `metric_unit`, `lens`, `freshness`, `confidence`, `provenance`, `limitation`, `raw_ref`, `created_from_run_id` | Optional future indexed fields: `signal_type`, `signal_strength`, `normalized_payload` if packet queries become slow | Do not store full Manager reads or packet prose. |
| `evidence_links` | `evidence_item_id`, `target_type`, `target_id`, `usage`, `claim_text`, `created_from_run_id` | Add indexes for packet/output targets if needed | Do not duplicate source facts in every output JSON without links. |
| `manager_synthesis_runs` | `trigger_type`, `conversation_id`, `mission_id`, `status`, `classification`, `confidence`, `context_payload`, `steps_payload`, `limitations`, `started_at`, `completed_at`, `error` | Keep `action_plan` for compatibility during migration; later restrict to action summaries or deprecate | Do not use as canonical brief/read/packet storage. |
| `manager_run_actions` | `manager_synthesis_run_id`, `order_index`, `action_type`, `target_type`, `target_id`, `status`, `approval_required`, `payload`, `result_payload`, `error` | No first-cut change | Do not store passive visible reads as actions. |
| `memory_entries` | `scope`, `kind`, `content`, `source_type`, `source_id`, `operating_event_id`, `confidence`, `mission_pattern_key`, `reason`, `supersedes_memory_entry_id`, `created_from_run_id`, `created_from_action_id` | Add `payload jsonb not null default '{}'::jsonb` | Do not add `manager_memory` unless this table proves insufficient after implementation. |
| `music_items` | `title`, `item_type`, `lifecycle_stage`, `status`, `is_active_focus`, `blocker`, `rights_state`, `source_kind`, `source_limit`, `planned_release_date`, `released_at`, `metadata`, run/action provenance | Treat `manager_read`, `manager_next_move`, `manager_stage_suggestion` as compatibility projections | Do not make music records the canonical home of generated strategy. |
| `music_projects` | `title`, `project_type`, `lifecycle_stage`, `status`, `is_active_focus`, `blocker`, `source_kind`, `source_limit`, `planned_release_date`, `released_at`, `metadata`, run/action provenance | Treat `manager_read`, `manager_next_move` as compatibility projections | Do not store project Manager reads only in metadata/text fields. |
| `operating_events` | `event_type`, `actor_type`, `target_type`, `target_id`, `source_type`, `source_id`, `manager_synthesis_run_id`, `manager_run_action_id`, `agent_run_id`, `mission_id`, `checkpoint_id`, `task_id`, `summary`, `payload` | Add event types for packet/output creation and meaningful read changes | Do not use as the only store for current Manager output. |
| `conversations` / `conversation_messages` | `topic`, `status`, `summary`, `linked_mission_id`, `speaker`, `body`, `manager_synthesis_run_id`, `metadata` | Link durable chat answers/decision packages to `manager_outputs` through message metadata or `artifact_links` | Do not create a separate chat transcript store. |
| `missions` / `checkpoints` / `tasks` / `permission_requests` | Existing mission plan, checkpoint, task, approval, and permission fields | Feed from packet `mission_seed_json`; preserve candidate/context-question behavior | Do not let Today's Brief directly create task/checkpoint rows. |
| `agent_reports` | `agent_key`, `summary`, `confidence`, `limitations`, `finding`, `evidence_missing`, `risk_or_opportunity`, `recommended_internal_action`, `permission_required`, `suggested_follow_up` | Use as specialist inputs to packets and staff readiness | Do not duplicate specialist reports inside packet except as summarized evidence-backed inputs. |
| `ai_run_usage_events` | `workflow_key`, `run_type`, `manager_synthesis_run_id`, `agent_run_id`, `subject_type`, `subject_id`, `provider`, `model_or_tool`, `operation_key`, `status`, token/cost fields, `metadata` | Add workflow enum values only if packet/output generation cannot fit existing values | Do not expose provider/model/tool labels in normal Manager copy. |

### Tables To Add

Only two new durable tables are justified for the Manager Intelligence upgrade.

### `manager_intelligence_packets`

The central internal product object. This replaces surface-specific reasoning as the source of truth, while reusing existing source/evidence/run tables for lineage.

Required repo columns:

- `id`
- `account_id`
- `artist_workspace_id`
- `artist_id`
- `packet_date`
- `packet_type` (`setup`, `daily`, `manual_refresh`, later `campaign`)
- `status`
- `profile_projection_json`
- `signal_snapshot_json`
- `data_freshness_json`
- `executive_read_json`
- `strategic_diagnosis_json`
- `kpi_read_json`
- `signal_map_json`
- `management_insights_json`
- `asset_reads_json`
- `market_reads_json`
- `mission_seed_json`
- `conversation_memory_seed_json`
- `supporting_evidence_json`
- `internal_only_json`
- `schema_version`
- `created_from_run_id`
- `supersedes_packet_id`
- `created_at`

Why this replaces three proposed tables:

- The handoff's `artist_signal_snapshots` is a point-in-time derived read, so it belongs inside the packet as `signal_snapshot_json`; raw captures still live in `source_snapshots`.
- The handoff's `artist_operating_profiles` is an interpreted projection. The current projection belongs in `profile_projection_json`; durable memory facts belong in `memory_entries`; user-editable profile facts stay in `artist_profiles`.
- The packet is the right boundary for internal playbooks, signal maps, confidence, missing data, and mission/chat seeds.

Rule: this table may contain internal playbook routing in `internal_only_json`, but normal product UI must never read or render that field.

### `manager_outputs`

Stores the actual user-facing Manager output that was shown, regardless of surface. This avoids separate tables for setup briefs, daily briefs, song reads, project reads, chat decision packages, and future campaign reads.

Required repo columns:

- `id`
- `account_id`
- `artist_workspace_id`
- `artist_id`
- `source_packet_id`
- `conversation_id`
- `mission_id`
- `subject_type` (`artist`, `music_item`, `music_project`, `mission`, `task`, `checkpoint`, `conversation`)
- `subject_id`
- `output_type` (`setup_first_manager_read`, `recurring_todays_brief`, `song_manager_read`, `project_manager_read`, `chat_answer`, `decision_package`, `review_read`)
- `output_date`
- `dominant_situation`
- `layout_pattern`
- `tone`
- `hero_json`
- `blocks_json`
- `summary`
- `primary_recommendation_json`
- `avoid_json`
- `confidence_json`
- `what_changed_json`
- `supporting_evidence_json`
- `render_json`
- `internal_render_notes_json`
- `schema_version`
- `created_from_run_id`
- `supersedes_output_id`
- `is_current`
- `created_at`

Why this replaces `manager_briefs`: the repo already has several Manager-visible surfaces. A generic output table keeps one rendering/audit pattern while still allowing typed schemas by `output_type`.

### Existing Tables To Extend

`memory_entries` should gain structured payload support instead of creating `manager_memory`:

- Add `payload jsonb not null default '{}'::jsonb`.
- Use existing `scope`, `kind`, `content`, `source_type`, `source_id`, `operating_event_id`, `confidence`, `supersedes_memory_entry_id`, `created_from_run_id`, and `created_from_action_id`.
- Store packet-derived memory with `source_type='manager_intelligence_packet'` and `source_id=<packet id>`.
- Store output-derived memory with `source_type='manager_output'` and `source_id=<output id>`.

`artist_profiles` should remain user/profile truth, but can carry only lightweight current Manager projection pointers:

- Add `current_manager_packet_id` if fast lookup is needed.
- Add `manager_profile_summary_json` only as a cache/projection, not as canonical memory.
- Keep `artist_profile_versions.profile_payload` for user-visible profile changes, not daily model drift.

`music_items` and `music_projects` should stop being the canonical home for generated Manager reads:

- Keep lifecycle, rights, files, release, identifier, and active-focus fields.
- Treat `manager_read` and `manager_next_move` as temporary compatibility projections during migration.
- Store new song/project reads in `manager_outputs` with `subject_type='music_item'` or `subject_type='music_project'`.

`evidence_links` should become the main join table from evidence to packets/outputs/work:

- Link packet evidence with `target_type='manager_intelligence_packet'`.
- Link visible output evidence with `target_type='manager_output'`.
- Keep existing support for missions, reviews, tasks, and memory through `target_type`.

## Prompt, Playbook, And KPI Contract

This section is implementation law. The CTO handoff contains the reasoning standards that make the product feel like a real manager instead of a generic analytics wrapper. These rules must live in repo docs because they drive schemas, prompts, tests, and UI rendering.

### Internal Playbook Routing

Playbooks are internal reasoning frameworks. They may be stored in `manager_intelligence_packets.internal_only_json` for debug/admin review, but normal UI must never render playbook names, prompt structure, model/provider details, or reasoning labels.

The playbook router should consider all playbooks and may apply multiple playbooks to one packet.

| Playbook | Core use | Internal decision rule |
|---|---|---|
| Cultural Expansion | Strong city, language, diaspora, street, subculture, or regional identity; expansion outside home market; collaboration or international positioning decisions | Make the artist bigger as themselves. Do not dilute the artist to chase generic global validation. |
| Era Architecture | Single, EP, album, project, campaign identity, rollout direction, fans reacting without repeatable symbols or behavior | A release should become a recognizable era. Recommend repeatable campaign codes, not random content. |
| Artist-as-Business | Momentum plus deals, publishing, distribution, brand, label, rights, splits, metadata, ownership, partner leverage | Growth without structure creates chaos. Slow the team down when excitement can create a bad deal. |
| Prestige & Positioning | Collaborations, influencer campaigns, brand deals, press, overexposure, unclear public image | Reach and money are not enough. The move must improve long-term positioning. |
| Artist-First Development | Developing artist, forced persona, emotionally wrong strategy, patience/refinement/confidence issues | Creative alignment is risk management. Growth must be sustainable for the actual artist. |
| Song & Fan Trust | Song push, TikTok attention, playlist reach, unclear saves/returns/Shazams, over-marketing risk | The song and fan relationship matter more than clever marketing. Attention must become attachment. |
| Live Demand & Community | City decisions, shows, showcases, pop-ups, fan events, audience density, city-level movement | Do not tour the biggest streaming markets blindly. Choose markets dense enough to convert physically. |
| Authentic Growth | Fast spike, team skipping steps, over-polishing, premature scale in live/brand/media | Grow at the speed of real demand, not ego. Protect fan intimacy and authenticity while scaling. |
| World-Building | Songs without a recognizable universe, weak symbols/content codes/fan rituals/cultural ownership | Build a world around the artist so fans have something to recognize, repeat, and enter. |
| Fan Psychology & Ownership | Fan-favorite behavior, fandom deepening, event releases, direct-to-fan infrastructure | Fan participation is economic infrastructure. Fans should feel part of the story, not only consumers. |
| A&R Breakout | Fast-growing artist/song, one-platform attention, campaign scaling, breakout evaluation | One platform spike is not enough. Multiple agreeing signals create conviction. |
| Playlist & Discovery | Playlist adds/reach, playlist movement, spend decisions, durability of discovery | Playlist reach is not fan growth. Judge fit, retention, conversion, playlist type, and downstream movement. |
| Social Contagion | TikTok, Reels, Shorts, UGC, memes, sounds, creator activity, unclear conversion | Virality is not success unless it converts or strengthens identity. |
| No Engine | Always | A useful manager says no. Every output needs a specific avoid judgment. |

Playbook router requirements:

- Input: profile projection, signal snapshot, selected assets, market reads, evidence facts, source gaps, user goals, memory, missions, agent reports.
- Output: considered playbooks, applied playbooks, routing notes, and no-engine warning inside `internal_only_json`.
- User-facing output: only the resulting management read, next move, avoid, confidence, and evidence.
- Test: normal UI/output JSON must not expose playbook names or internal routing.

### Signal Classification Contract

Raw metrics must be classified before interpretation. The system should not treat TikTok views, playlist reach, Shazams, followers, listeners, saves, comments, city concentration, and brand affinity as equivalent facts.

Required signal types:

- `attention`: public visibility, views, reach, impressions, UGC volume.
- `conversion`: saves, follows, repeat listening, full-track movement, owned-audience capture.
- `discovery`: Shazams, search, playlist discovery, new listener entry points.
- `fan`: engagement density, comments, shares, fan rituals, direct relationship signals.
- `market`: city/country/diaspora concentration, affinity, rank, local discovery.
- `playlist`: playlist count, reach, type, position, fit, retention, downstream impact.
- `live`: market density, event readiness, city engagement, local fan behavior.
- `catalog`: older track/project resurgence, long-tail movement, project role.
- `risk`: rights/splits gaps, weak conversion, overexposure, brand mismatch, premature scale.

Rules:

- One signal is a spike; multiple agreeing signals create conviction.
- A strong attention signal without conversion is not a breakout.
- Playlist exposure without retention/conversion is exposure risk.
- City affinity can matter more than raw listener count.
- The newest song is not automatically the priority.
- Every insight and output block must carry evidence IDs or explicitly state that it is a low-confidence inference from available evidence.

### Chartmetric KPI Translation Contract

Chartmetric-style KPIs are not decorative metrics. They must be normalized, interpreted, stored in packet projections, and converted into Manager memory when they affect future decisions.

Normalize these artist-level fields when present:

- Chartmetric artist score.
- Chartmetric artist rank.
- Chartmetric career stage.
- Recent momentum / artist growth.
- Fan base rank.
- Engagement rank.
- Social engagement score.
- Network strength score.
- City affinity scores.
- Brand affinity scores.
- Mood tags.
- Genre tags.

Normalize these track-level fields when present:

- Chartmetric track score.
- Spotify popularity index.
- Playlist count/reach/type/position/retention proxies.
- Track rank/popularity movement.
- Subject links to `music_items.id` or `music_projects.id` where possible.

Interpretation rules:

- Artist Score is a broad 0-100 artist-strength signal, not a complete diagnosis. Use it for stage, relevance, benchmark, momentum confirmation, and competitive context.
- Artist Rank is relative. Rank can fall even when the artist improves if peers improve faster.
- Career Stage is long-term settled level. Momentum is current direction. Do not confuse them.
- Do not give a Developing artist a Superstar strategy, or a Superstar artist a Developing strategy.
- Fan Base Rank is durable audience. Engagement Rank is current heat. Their contrast is mandatory when both exist.
- Weak fanbase plus strong engagement means hot but not yet converted into durable fandom.
- Strong fanbase plus weak engagement means established but possibly cooling or passive.
- High social engagement for a Developing artist can signal strong early community; protect authenticity.
- High TikTok reach but low social engagement means people may be watching without attaching.
- Strong engagement but weak streaming conversion means the content is working but the funnel is weak.
- Network Strength is quality of connections and co-sign potential, not general popularity.
- High Network Strength with low popularity can mean tastemaker momentum; avoid over-commercializing too early.
- City Affinity identifies over-indexing markets. A smaller high-affinity city can be more strategic than a large passive city.
- Brand Affinity is a fit signal, not an automatic recommendation. Never recommend a brand move without artist-world and career-stage fit.
- Mood tags enrich artist world, playlist/sync targeting, and emotional clarity. Conflicting mood tags can flag positioning mismatch.
- Genre tags help detect genre drift, audience-perceived lane, subgenre communities, and positioning weakness.
- Chartmetric Track Score is playlist-weighted and can signal playlist durability or exposure, not necessarily fandom.
- Spotify Popularity is Spotify-relative. High Spotify popularity plus low cross-platform score means Spotify-heavy; high popularity plus weak social engagement means passive listening risk.

KPI output shape inside `manager_intelligence_packets.profile_projection_json`:

```json
{
  "kpi_profile": {
    "artist_score": {
      "value": 0,
      "direction": "up | down | flat | unknown",
      "read": "string",
      "management_meaning": "string",
      "confidence": "High | Medium | Low"
    },
    "artist_rank": {
      "value": 0,
      "direction": "up | down | flat | unknown",
      "read": "string",
      "relative_context": "string"
    },
    "career_stage": {
      "source_stage": "string | null",
      "interpreted_stage": "Emerging | Developing | Mid-Level | Mainstream | Superstar | Legendary | Unknown",
      "stage_reason": "string"
    },
    "momentum": {
      "direction": "rising | flat | cooling | volatile | unknown",
      "read": "string"
    },
    "fanbase_vs_engagement": {
      "fanbase_rank": 0,
      "engagement_rank": 0,
      "relationship": "fanbase_stronger | engagement_stronger | both_strong | both_weak | unknown",
      "read": "string"
    },
    "social_engagement_read": "string",
    "network_strength_read": "string",
    "city_affinity_reads": [
      {
        "city": "string",
        "score": 0,
        "role": "power_market | emerging_pocket | passive_scale | avoid_for_now | unknown",
        "read": "string"
      }
    ],
    "brand_affinity_reads": [
      {
        "brand_or_category": "string",
        "score": 0,
        "fit": "strong_fit | investigate | positioning_risk | unknown",
        "read": "string"
      }
    ],
    "mood_genre_read": "string",
    "track_score_reads": [
      {
        "music_item_id": "uuid | null",
        "track_name": "string",
        "chartmetric_track_score": 0,
        "spotify_popularity": 0,
        "read": "string",
        "risk": "string",
        "watch_metric": "string"
      }
    ]
  }
}
```

KPI memory rules:

- Store raw values in source payloads/evidence where available.
- Store interpreted current read in packet `profile_projection_json`.
- Write durable long-lived facts, risks, constraints, rejected moves, and outcome notes to `memory_entries`.
- Missing KPI fields lower confidence only when relevant. They must not cause hallucinated metrics or a weak "we cannot help" user experience.

### Prompt Builder Contracts

Prompts should be built from shared modules, not scattered strings. Each prompt builder must define:

- purpose
- allowed inputs
- hidden/internal fields
- user-visible forbidden terms
- required output schema
- evidence requirements
- missing-data behavior
- permission boundary rules
- repair/retry instructions

Shared prompt rule for missing data:

```text
Use the strongest available evidence. Do not complain about missing data. Mention missing metrics only when they materially affect confidence or the next decision. If a preferred metric is unavailable, use reasonable proxy signals and clearly state the read based on available evidence. The user-facing output should focus on what is known, what it means, and what to do next.
```

Core packet prompt contract:

- Purpose: create the internal Manager Intelligence Packet for all surfaces.
- Inputs: artist profile, KPI profile, normalized evidence, selected tracks/projects, market signals, playlist/social/discovery signals, source gaps, memory, user goals, missions, checkpoint/task outcomes, agent reports.
- Must classify career stage, platform shape, market shape, catalog shape, strongest signal, biggest risk, current priority, playbook routing, avoid judgment, mission seed, and chat memory seed.
- Must return strict JSON matching the packet schema.
- Must include internal playbooks only in `internal_only_json`.
- Must not write user-facing prose that references prompts, models, providers, APIs, or internal playbooks.

Setup Brief prompt contract:

- Purpose: first strategic read after setup.
- Inputs: setup profile, Chartmetric/KPI reads, selected tracks/projects, market/city affinity, playlist/social/discovery signals, genre/mood tags, brand affinity if available, similar artists if available, setup goals.
- Must not use previous mission history, checkpoint results, task status, or prior brief memory.
- Must produce opening diagnosis, operating read, what we see, first priority, first move, what not to do, songs/projects to watch, market read, confidence, evidence.
- Must seed memory and mission direction internally, but not render tasks/checkpoints/missions.

Recurring Today's Brief prompt contract:

- Purpose: user-facing daily/recurring read from latest packet and operating state.
- Inputs: latest packet, previous outputs, open missions, completed checkpoints, task outcomes, recent operating events, memory, changed evidence.
- Must explain what changed using prior state, current state, and evidence.
- Must include next move, avoid, confidence, and evidence.
- Must not render mission/task/checkpoint objects.

Dynamic renderer prompt contract:

- Do not force the same visible structure every time.
- Choose blocks based on dominant situation.
- Lead with what matters most: risk, asset, market, conversion, breakout, catalog, live demand, or setup.
- Keep output structured as `hero_json`, `blocks_json`, `supporting_evidence_json`, and `render_json`.
- Voice: tight, direct, calm, specific, protective, slightly opinionated, able to say no.
- Avoid: motivational fluff, generic marketing advice, robotic caveats, over-explaining, implementation language.

Mission seed prompt contract:

- Purpose: give Mission Genesis strategic direction only.
- Inputs: packet mission seed, evidence, open missions, goals, context answers, task/checkpoint state.
- Output: mission directions, do-not-generate list, required context, permission-sensitive actions.
- Must not render inside Today's Brief.
- Mission Genesis remains the only creator of missions, tasks, checkpoints, estimates, owners, and permission requests.

Manager Chat prompt contract:

- Purpose: answer from stored intelligence and route serious requests into the operating system.
- Inputs: packet, profile projection, previous outputs, memory, evidence, open missions, checkpoints, task results, conversation history, current data.
- Must classify user intent before answering: simple answer, decision request, mission update, task result/update, checkpoint review/update, memory update, evidence response, specialist referral, draft request, permission response, review trigger, unsupported/unsafe.
- Must create `manager_outputs` decision packages or linked artifacts when an answer needs durable retrieval.
- Must not execute external, expensive, legal, financial, public, reputational, or release-plan-changing actions without `permission_requests`.

Song/project read prompt contract:

- Purpose: render an asset-specific management read from packet `asset_reads_json` and latest subject evidence.
- Inputs: music record, linked project/track context, packet asset read, evidence, source limitations, rights/splits/readiness state.
- Must answer role, current read, strongest signal, biggest risk, next move, avoid, watch metrics, market/project relationship.
- Must write visible output to `manager_outputs`, not canonical music metadata.

### Dynamic Situation And Layout Contract

The renderer should choose a dominant situation and layout pattern. Required initial situations:

- Conversion Moment.
- Breakout Watch.
- Song-First Spike.
- Market Opening.
- Playlist Exposure Risk.
- Era Problem.
- Cooling Artist.
- Catalog Revival.
- Live Demand Signal.
- Structural Readiness Gap.

Required initial block types:

- opening_read
- manager_note
- signal_stack
- real_read
- next_move
- avoid
- asset_spotlight
- market_read
- confidence_note
- what_to_watch
- evidence_drawer
- manager_warning
- opportunity_window
- strategic_question

Required layout patterns:

- Sharp Diagnosis.
- Signal Stack.
- Asset-Led Read.
- Market-Led Read.
- Risk-Led Read.
- Setup First Read.
- Custom.

Acceptance checks:

- Two fixture artists with different dominant situations must not produce identical block ordering.
- Every user-facing output needs action, avoidance, confidence, and evidence.
- Missing data is shown as confidence/watch context only when relevant.
- The product fails tests if it sounds like a chatbot, a metric dump, a generic marketing adviser, or a task generator pasted into the brief.

## Manager Intelligence Modules

Create:

```text
supabase/functions/_shared/manager-intelligence/
  types.ts
  normalize/
    evidenceNormalize.ts
    chartmetricKpiNormalize.ts
    internalDataNormalize.ts
  selection/
    trackSelector.ts
    projectSelector.ts
  profile/
    artistOperatingProfile.ts
    kpiInterpreter.ts
    careerStageClassifier.ts
    platformShapeClassifier.ts
    marketShapeClassifier.ts
    catalogShapeClassifier.ts
  signals/
    signalClassifier.ts
    signalStrength.ts
    deltaComputer.ts
    situationDetector.ts
  playbooks/
    playbookDefinitions.ts
    playbookRouter.ts
    noEngine.ts
  packet/
    strategicIntelligencePacket.ts
    packetSchema.ts
    evidenceBuilder.ts
    confidence.ts
  renderers/
    dynamicBriefComposer.ts
    todaysBriefRenderer.ts
    setupBriefRenderer.ts
    managerChatContextBuilder.ts
    songReadRenderer.ts
    projectReadRenderer.ts
  downstream/
    missionSeedBuilder.ts
  memory/
    briefMemory.ts
    checkpointMemory.ts
    artistMemory.ts
```

These modules should be deterministic where possible and model-authored only where judgment is needed. For example, signal classification, track selection, evidence shaping, and schema validation should be code. Executive read, nuanced management insight, and dynamic brief composition can use model generation with strict schema validation.

## Traceability Matrix

| Handoff section | Repo equivalent | Design decision | Implementation work |
|---|---|---|---|
| 1. What changed from v1 | Product copy, prompts, UI renderers | Keep model/provider/prompt/playbook terms internal; Today's Brief does not render missions/tasks/checkpoints | Add shared visible-copy guard for all user-facing manager outputs; remove fixed mission/task affordances from brief content |
| 2. CTO architecture | Supabase shared Manager Intelligence layer | One Strategic Intelligence Packet feeds all surfaces | Build `manager-intelligence` shared modules and persist packets |
| 3. Product layers | Data sources, operating profile, engine, packet, renderers, mission generator | Separate fetching, normalization, profile, packet, rendering, and mission generation | Refactor `generate-todays-brief`, `generate-music-summary`, and `mission-genesis` onto the shared layer |
| 4. Screenshot assessment | Current `DeskHQ.tsx` and `openaiTodaysBrief.ts` | Current direction is useful but too dashboard-like and static | Replace fixed metric-led brief with dynamic management read blocks and stronger avoid/confidence/what-changed logic |
| 5. Product standard | QA rubric and tests | Judge output by manager usefulness, not metric completeness | Add quality tests for non-generic copy, evidence-backed advice, avoid judgment, and signal classification |
| 6. Internal playbooks | `playbooks/` modules | Playbooks are internal routing, not UI copy | Store applied playbooks only in `internal_only_json` and admin debug mode |
| 7A. Chartmetric KPI translation | `chartmetricEvidence.ts`, evidence rows, new KPI interpreter | Raw KPI rows are not enough; persist interpreted KPI memory | Normalize artist score/rank/stage/momentum/fanbase/engagement/network/city/brand/mood/genre/track score/popularity |
| 7B. KPI-to-memory mapping | `manager_intelligence_packets.profile_projection_json`, `asset_reads_json`, `memory_entries.payload` | Store interpreted KPI profile, not just values | Add KPI profile schema, packet projection, and selected append-first memory entries |
| 7C. KPI rules | Classifiers and confidence engine | Stage and momentum are separate; fanbase vs engagement comparison is mandatory when available | Implement classifier rules and tests for stage, momentum, and fanbase/engagement contrast |
| 7D. KPI examples | Test fixtures | Examples become regression scenarios | Add fixtures for developing-high-engagement, viral-weak-fanbase, mainstream-cooling, playlist-exposure, city-affinity |
| 7E. KPI improves chat | Manager Chat context builder | Chat answers should use KPI memory and packet evidence | Build `managerChatContextBuilder.ts` and chat generation endpoint later |
| 7F. Engineering requirements | Shared manager-intelligence files | Follow intent but place server-side under Supabase shared functions | Create normalizer, interpreter, career stage classifier, memory writer, packet `kpi_read` |
| 7G. KPI acceptance | Test suite | KPI fields are optional but interpreted when present | Tests assert missing KPIs lower confidence without hallucination |
| 7. Artist Operating Profile | Packet `profile_projection_json`, optional `artist_profiles` cache, `memory_entries` | This is the manager's map, not bio/profile data; do not create a parallel profile table unless current projection queries require it later | Generate/update before setup brief, recurring brief, chat, song/project reads, and mission generation |
| 8. Song/project selection | `trackSelector.ts`, `projectSelector.ts` | Do not default to newest; select assets that create management decisions | Implement explicit management-relevance scoring using latest, active, momentum, playlist, TikTok, Shazam, YouTube, market, user-referenced, strategic memory |
| 9. Signal classification | `signalClassifier.ts` | Every metric becomes attention/conversion/discovery/fan/market/playlist/live/catalog/risk before interpretation | Map existing `evidence_items.lens`, `evidence_type`, `metric_name`, and subject fields into signal types |
| 10. Signal rules | `signalStrength.ts`, `confidence.ts`, prompts | One signal is a spike; multiple agreeing signals raise conviction; every output needs avoid/confidence | Add deterministic signal agreement scoring and schema-required `avoid` |
| 10A. Evidence discipline | Prompt rules and renderer filters | Missing data is internal context, not the headline | Store missing fields in packet; surface only confidence reason/watch item/evidence caveat |
| 11. Strategic Intelligence Packet | `manager_intelligence_packets` table and schema | This is the source of truth | Build strict schema, parser, validator, persistence, and latest-packet loader |
| 12. Today's Brief renderer | `manager_outputs`, `DynamicBriefComposer`, `DeskHQ.tsx` | Today's Brief renders packet, not raw data | Refactor `generate-todays-brief` into packet generation plus visible output rendering |
| 12A-12H. Setup Brief | `manager_outputs.output_type=setup_first_manager_read` | First read is special and generated after setup with no mission history | Add setup renderer, schema, first-impression quality tests, and seed memory/mission seed without rendering them |
| 12I. Dynamic reads | `blocks_json`, dynamic UI renderer | Structured intelligence, fluid presentation | Add dynamic block schema, block renderer, dominant situation detector, layout patterns |
| 13. Today's Brief output schema | Typed `manager_outputs.render_json` plus derived columns | Keep canonical fields for tests/search, but render dynamic blocks | Update `TodayBriefViewModel` to support both legacy fixed fields and dynamic read fields during migration |
| 14. Mission relationship | `mission-genesis` | Mission Genesis consumes packet mission seed and creates work separately | Replace `buildArtistOperatingPacket` with latest packet + goals + missions + checkpoint results |
| 15. Manager Chat | `conversations`, `conversation_messages`, future chat endpoint | Chat must answer from profile, packet, briefs, missions, checkpoints, current data | Build packet-grounded chat context before adding full composer UI |
| 16. Song Manager Reads | `asset_reads_json`, `manager_outputs`, music pages | Song pages consume selected packet asset reads first | Store visible song reads as `manager_outputs.output_type=song_manager_read`; fall back to on-demand subject read only if no packet read exists |
| 17. Project Manager Reads | `asset_reads_json`, `manager_outputs`, project pages | Project pages consume project reads and track-carrying-project analysis | Store visible project reads as `manager_outputs.output_type=project_manager_read`; include project role and avoid |
| 18. Prompting principles | Shared prompt builders | Prompts must be strict, specific, anti-generic, and evidence-bound | Replace vague surface prompts with packet/renderer/mission-seed prompts and schema validators |
| 19. Core Manager Intelligence prompt | Packet generator | Internal only; produces strict Strategic Intelligence Packet | Implement system instructions in packet generator and validate all required fields |
| 20. Today's Brief prompt | Brief renderer | User-facing only; no internal machinery | Implement dynamic composer prompt with block schema and evidence constraints |
| 21. Mission Seed prompt | `missionSeedBuilder.ts`, Mission Genesis | Seed directions, not tasks/checkpoints | Store mission seed in packet; Mission Genesis expands it in mission workspace only |
| 22. Improved Mavo flow | Regression fixture | Use as scenario pattern, not hardcoded output | Add tests that confirm conversion moment, Lagos market focus, avoid broad spend, asset watch, mission seed |
| 23. UI recommendations | Desk UI, evidence drawer, admin debug | Clean brief, expandable evidence, internal debug hidden | Add dynamic brief renderer and admin-only packet/debug drawer later |
| 24. Code organization | Supabase shared modules plus frontend renderers | Adapt paths to repo architecture | Create shared server modules and thin frontend view models |
| 25. Data persistence | New migrations | Add scoped tables with RLS/service grants | Write migrations and update production service loaders |
| 26. Acceptance criteria | End-to-end tests | Treat as launch blockers | Add tests for no provider/model/playbook leakage, no tasks in brief, packet reuse, evidence, avoid, confidence |
| 27. Quality rubric | Output QA tests | Specificity/evidence/judgment are required | Add fixture-based rubric tests and parser guards |
| 28. Final standard | Product review | Product should feel like a professional management brain | Use as final acceptance language before launch |

## Producer Migration Map

This map prevents useful current implementation from getting lost while the architecture changes.

| Current producer/surface | What it does today | Keep | Change under new architecture |
|---|---|---|---|
| `generate-todays-brief` | Builds `ArtistBriefPacket`, calls model, stores output in `manager_synthesis_runs.action_plan` | Auth checks, run creation, usage events, evidence IDs, visible-copy sanitization, operating event writes | Split into packet generation plus setup/recurring output rendering; store durable rows in `manager_intelligence_packets` and `manager_outputs` |
| `_shared/openaiTodaysBrief.ts` | Defines Today's Brief schema, prompt rules, parser, source-line and banned-copy cleanup | Evidence validation, strict schema, sanitization posture, available-evidence discipline | Replace fixed schema as primary with dynamic brief schema; retain fixed fields as compatibility projection |
| `generate-music-summary` | Builds per-song/project packet and writes generated read into music metadata | Subject loading, related evidence loading, related record comparison, banned-copy retry/strip, usage/run logging | Consume latest packet `asset_reads_json`; on refresh, write a `manager_outputs` song/project read rather than isolated strategy stored in music metadata |
| `_shared/openaiManagerRead.ts` | Strong per-record Manager Read instructions and validation | Song/project specificity, avoid/do-not-do, source panel separation, claim audit, evidence IDs | Fold read schema into packet `asset_reads` and renderer-specific song/project read outputs |
| `mission-genesis` | Builds artist operating packet, asks model for mission/checkpoints/tasks/permissions, persists mission graph | Candidate-needs-context flow, context questions, run/actions, mission plan versions, checkpoint phases, task steps, permission requests, operating events | Replace its standalone packet builder with latest Manager Intelligence Packet + goals + missions + checkpoint/task state + context answers |
| `productionSupabase.ts` desk loader | Loads source sync jobs, operating events, latest brief run, fallback brief | Parallel loading, recent movement from `operating_events`, fallback posture | Load latest `manager_outputs` brief and latest packet-derived directive; support dynamic brief view model |
| `productionSupabase.ts` task completion | Writes task state events, task results, checkpoint recommendation, mission progress, memory entry, operating event | This is good operating-system behavior and should stay | Later route Manager interpretation through task-result/checkpoint-review intelligence, but keep append writes |
| `DeskHQ.tsx` | Shows brief, Staff, missions, attention, recent movement | Label HQ shape, Staff presence, active missions, contextual evidence button, compact mobile/desktop variants | Replace fixed metric card with dynamic block renderer; keep Label HQ as primary surface |
| `MusicScreens.tsx` | Shows songs/projects, files, details, rights, splits, source summary, generated manager read | First-class Music workspace and recorded-work state | Render `manager_outputs` song/project reads without losing lifecycle/files/rights/splits/linked work |
| `ManagerScreens.tsx` | Shows Manager Office shell, conversation history, Mission Genesis context UI | Manager Office as conversation/decision space, recent conversations, context question UX | Add real packet-grounded conversation router and decision package flow |
| `MissionScreens.tsx` | Shows Mission Genesis panel, empty state, missions, tasks/checkpoints/notes/memory | Mission workspace as durable work room | Consume mission work generated from packet seeds; keep tasks/checkpoints out of Today's Brief |
| `chartmetricEvidence.ts` | Normalizes Chartmetric payloads into evidence rows with lens/confidence/limitation | Strong source normalization layer | Add KPI interpretation above this layer; do not replace evidence rows |
| `ai_run_usage_events` | Tracks model/provider/tool usage | Mandatory for billing/audit | Link new packet/output/chat/read workflows to usage events |
| `manager_synthesis_runs` | Tracks manager runs and currently stores some outputs | Keep as audit/provenance and stage tracking | Stop using it as primary product output store |
| `operating_events` | Feeds movement and audit trail | Keep as recent movement and lineage source | Add packet/output/mission update events with source IDs |
| `memory_entries` | Stores interpreted mission/task memory | Keep append-first memory trail | Extend with structured `payload jsonb`; use packet/output source links instead of adding `manager_memory` |

## Tradeoff Decisions

### Dynamic Brief vs Rebuildable Lineage

Dynamic briefs make the product feel premium, but dynamic layouts can make lineage harder. The answer is not to abandon dynamic rendering. The answer is to store both:

- dynamic `hero_json` and `blocks_json` for product experience
- derived stable fields for querying, tests, compatibility, and audit
- evidence IDs per block/item
- `source_packet_id` and `created_from_run_id`

### Model Judgment vs Deterministic Classifiers

The handoff contains high-level reasoning. Some of it should be model-authored, but not all of it. Deterministic code should handle:

- source normalization
- KPI extraction
- track/project candidate selection
- signal classification
- evidence ID validation
- schema validation
- banned visible terms
- permission boundary checks

Model judgment should handle:

- executive read
- nuanced management insight
- artist-world interpretation when source-backed
- dynamic brief composition
- chat response prose
- mission plan expansion after service validation

### New Tables vs Existing Tables

The repo should add only the durable product objects it truly lacks. The database already has source snapshots, evidence rows, evidence links, run audit, usage accounting, Music records, mission work, chat, memory, operating events, and staff reports.

- Add `manager_intelligence_packets` because the repo lacks a durable internal intelligence object shared by every surface.
- Add `manager_outputs` because the repo lacks a durable user-facing Manager output object shared by briefs, song/project reads, chat answers, decision packages, and reviews.
- Do not add `artist_signal_snapshots`; derived signal state belongs inside the packet, while raw provider captures stay in `source_snapshots`.
- Do not add `manager_briefs`; brief is one `manager_outputs.output_type`.
- Do not add `manager_memory`; use and extend `memory_entries`.
- Do not add `artist_operating_profiles` in the first cut; use packet `profile_projection_json`, append facts to `memory_entries`, and add only lightweight cache pointers to `artist_profiles` if query performance needs them.
- `mission_seed_json` does not replace missions/tasks/checkpoints.

### Action Over Analysis vs Clean Today's Brief

The existing app values action. The handoff warns against turning Today's Brief into tasks. The correct split is:

- Today's Brief: read, reason, next move, avoid, evidence.
- Manager Chat/Decision Package: decision, rationale, rejected moves, linked work.
- Mission Genesis: missions, tasks, checkpoints, estimates, owners, permissions.
- Missions Workspace: execution and review.

### Provider Audit vs No Provider Language

The product must not expose model/provider/prompt mechanics in normal UI. But the repo's data lineage and cost accounting require internal provider/model/tool records.

Resolution:

- Keep provider/model/tool in `ai_run_usage_events`, source tables, and admin/debug surfaces.
- Never let normal user-facing management prose say "OpenAI authored," "Chartmetric says," "API found," or similar implementation language.
- Evidence drawer can name legitimate data sources as source labels when useful, but the Manager read should speak as the product.

## Implementation Roadmap

### Phase 0: Preserve and Govern the Handoff

Status: started.

Work:

- Keep the CTO handoff in `docs/strategy/ordersounds-manager-intelligence-cto-handoff-v6.md`.
- Keep this repo-specific plan beside it.
- Treat both as required reading before any Manager Intelligence change.
- Add future PR checklist items against sections 26 and 27.

### Phase 1: Schema and Type Contracts

Work:

- Add migration for `manager_intelligence_packets` and `manager_outputs`.
- Extend `memory_entries` with `payload jsonb not null default '{}'::jsonb`.
- Optionally add `artist_profiles.current_manager_packet_id` and `artist_profiles.manager_profile_summary_json` only if the loader needs a fast current projection; otherwise load latest packet by index.
- Include `account_id`, `artist_workspace_id`, and `artist_id` on every new table to match existing workspace/RLS patterns.
- Add indexes by `(account_id, artist_workspace_id, artist_id, created_at desc)`.
- Add output lookup indexes by `(artist_workspace_id, output_type, subject_type, subject_id, is_current, created_at desc)`.
- Add service role grants similar to existing manager/AI migrations.
- Preserve existing `manager_synthesis_runs`, `manager_run_actions`, `ai_run_usage_events`, `operating_events`, `memory_entries`, mission, task, checkpoint, permission, conversation, staff, and Music tables as core operating-system primitives.
- Mark `music_items.manager_read`, `music_items.manager_next_move`, `music_projects.manager_read`, and `music_projects.manager_next_move` as compatibility projections, not canonical generated-read storage.
- Add TypeScript schemas in `supabase/functions/_shared/manager-intelligence/types.ts`.
- Add parser/validator functions in `packet/packetSchema.ts`.
- Update frontend `TodayBriefViewModel` to support dynamic read fields while keeping current fields during migration.

Verification:

- Schema tests should confirm all tables exist and are scoped.
- Schema tests should confirm the old proposed parallel tables are not introduced: `artist_signal_snapshots`, `manager_briefs`, and `manager_memory`.
- Parser tests should reject packets without evidence IDs, avoid judgments, confidence reasons, or required signal classifications.
- Regression tests should confirm existing mission/task/checkpoint/usage/event tables remain untouched and compatible.

### Phase 2: Data Normalization and KPI Translation

Work:

- Build `evidenceNormalize.ts` to convert existing `evidence_items` into normalized evidence facts.
- Build `chartmetricKpiNormalize.ts` for Chartmetric-style fields already persisted by enrichment functions.
- Build `kpiInterpreter.ts` to translate artist score, rank, career stage, recent momentum, fanbase rank, engagement rank, social engagement, network strength, city affinity, brand affinity, mood/genre, track score, and Spotify popularity.
- Keep all KPI fields optional; absence lowers confidence only when relevant.
- Build signal snapshot assembly as an in-memory/packet projection, then persist it inside `manager_intelligence_packets.signal_snapshot_json`.

Verification:

- Unit tests for all KPI examples in section 7D.
- Tests for missing KPI fields: no hallucination, useful read still generated.

### Phase 3: Selection and Signal Intelligence

Work:

- Build `trackSelector.ts` and `projectSelector.ts`.
- Build `signalClassifier.ts`, `signalStrength.ts`, `deltaComputer.ts`, and `situationDetector.ts`.
- Map current evidence types and metric names into the required signal types.
- Add deterministic dominant situation candidates: Conversion Moment, Breakout Watch, Song-First Spike, Market Opening, Playlist Exposure Risk, Era Problem, Cooling Artist, Catalog Revival, Live Demand Signal, Structural Readiness Gap.

Verification:

- Fixtures prove the newest song is not automatically selected.
- Fixtures prove TikTok alone is a spike, TikTok + Shazam + conversion proxy is stronger momentum, and playlist reach without retention is exposure risk.

### Phase 4: Artist Operating Profile

Work:

- Build `artistOperatingProfile.ts`.
- Build classifiers for career stage, platform shape, market shape, and catalog shape.
- Persist `kpi_profile_json`, artist world, risks, current priority, and confidence inside packet `profile_projection_json`.
- Write durable learned facts, preferences, risks, rejected moves, and outcome notes to `memory_entries` with structured `payload`.
- Do not mutate user-editable `artist_profiles` except for optional current-packet cache fields.

Verification:

- Tests confirm career stage is not monthly-listener-only.
- Tests confirm platform shape, market shape, and catalog shape are stable enough for chat and mission generation.

### Phase 5: Strategic Intelligence Packet Generation

Work:

- Build `strategicIntelligencePacket.ts`.
- Build `evidenceBuilder.ts` and `confidence.ts`.
- Build `playbookDefinitions.ts`, `playbookRouter.ts`, and `noEngine.ts`.
- Use internal playbooks only inside packet generation and debug fields.
- Persist `manager_intelligence_packets`.
- Link supporting evidence through `evidence_links` with `target_type='manager_intelligence_packet'`.
- Keep `manager_synthesis_runs` as run audit with `created_from_run_id` linking to durable packet rows.
- Write `operating_events` when a packet changes the operating read enough to affect Label HQ.
- Write `ai_run_usage_events` for model/provider/tool work and never infer usage later from UI.

Verification:

- Packet schema requires executive read, diagnosis, signal map, management insights, asset reads, market reads, mission seed, chat memory seed, evidence, confidence, avoid, and internal-only isolation.
- Tests reject packets with recommendations lacking evidence IDs.
- Tests confirm a packet can be traced to run, usage, evidence links, source snapshots through evidence, and artist/workspace scope.

### Phase 6: Setup First Manager Read

Work:

- Build `setupBriefRenderer.ts`.
- Store first setup read in `manager_outputs` with `output_type=setup_first_manager_read`.
- Seed `memory_entries` from `conversation_memory_seed`.
- Seed `mission_seed_json` in the packet but do not render missions/tasks/checkpoints.
- Update `generate-todays-brief` setup trigger to generate snapshot -> profile -> packet -> setup brief.

Verification:

- First read includes operating diagnosis, first priority, first move, what not to do, songs/projects to watch, market read, confidence.
- Tests confirm no task/checkpoint/mission list renders in the brief.

### Phase 7: Recurring Dynamic Today's Brief

Work:

- Build `dynamicBriefComposer.ts` and `todaysBriefRenderer.ts`.
- Add dynamic block rendering to `DeskHQ.tsx`.
- Store `hero_json`, `blocks_json`, `dominant_situation`, `layout_pattern`, `tone`, and derived fixed fields in `manager_outputs`.
- Use previous briefs, open missions, completed checkpoint results, and task outcomes for recurring briefs.
- Keep Label HQ's existing surrounding operating room: Staff, Missions, attention/flagged items, recent movement, and contextual evidence.
- Keep Recent Movement sourced from `operating_events`; do not let the brief invent movement.

Verification:

- Two fixture artists with different situations render different block orders and dominant situations.
- Required ingredients still appear: main read, next move, avoid, evidence, confidence.
- "What changed" items must reference prior state, current state, and changed records when they claim movement.

### Phase 8: Mission Genesis Migration

Work:

- Replace `buildArtistOperatingPacket` in `supabase/functions/mission-genesis/index.ts` with a builder that loads latest Manager Intelligence Packet, packet `profile_projection_json`, mission seed, open missions, user goals, context answers, and checkpoint results.
- Keep Mission Genesis as the only place that creates missions, tasks, checkpoints, estimates, owners, and permissions.
- Remove visible wording like "OpenAI-authored" from persisted user-facing mission explanations. Keep provider/model data in usage events only.
- Preserve candidate mission/context-question flow.
- Preserve mission plan versions, checkpoint phases, task steps, and permission requests.
- Preserve duplicate-mission prevention and update-existing-mission behavior.

Verification:

- Mission Genesis can create work from `mission_seed_json`.
- Today's Brief never renders generated task/checkpoint objects.
- No UI-visible provider/model language.
- Candidate missions can still ask two to five material context questions before activation.

### Phase 9: Song and Project Read Migration

Work:

- Update music loaders in `productionSupabase.ts` to prefer current `manager_outputs` for selected songs/projects, backed by latest packet `asset_reads_json`.
- Update `generate-music-summary` to either refresh the whole packet or generate a packet-compatible `manager_outputs` song/project read, not an isolated strategy stored as music metadata.
- Keep existing `music_items.manager_read` and `music_projects.manager_read` as compatibility projections only during migration.
- Add fields to `MusicObjectViewModel` for `managementRole`, `strongestSignal`, `biggestRisk`, `avoid`, `marketsToWatch`, and `watchMetrics`.

Verification:

- Song page answers role, current read, conversion, market response, next move, avoid, watch metrics.
- Project page answers current era/catalog/inactive/revival role, carrying tracks, strategic value, next move, avoid.

### Phase 10: Manager Chat

Work:

- Build `managerChatContextBuilder.ts`.
- Add a real Manager Chat endpoint that reads packet `profile_projection_json`, latest Manager Intelligence Packet, previous `manager_outputs`, open mission state, checkpoint results, conversation history, and current data.
- Persist messages in `conversation_messages`, link manager answers to `manager_synthesis_runs`, and write durable answer/decision artifacts to `manager_outputs` when they need retrieval outside the message thread.
- Add a packet-aware conversation router, not just a chat completion endpoint.
- Preserve classification into simple answer, decision request, mission update, task result/update, checkpoint review/update, memory update, evidence response, specialist referral, draft request, permission response, review trigger, and unsupported/unsafe.
- Generate decision packages as `manager_outputs.output_type=decision_package` plus `artifact_links`/`permission_requests` when the conversation requires durable work.

Verification:

- Chat can answer "Why Lagos first?", "Which song should we push?", "Is this a breakout?", "Should we pitch labels?", and "What should we avoid?" from stored intelligence.
- Chat updates its read when new data contradicts old assumptions.
- Conversation runs do not create external/expensive/public/legal/financial/reputational actions without permission.

### Phase 11: Evidence Drawer and Admin Debug

Work:

- Upgrade evidence drawer to show metric, value, period, source, interpretation, confidence, and limitation.
- Add admin/dev-only packet debug view with playbooks applied, missing data, prompt/schema version, packet ID, validation result, and confidence notes.
- Keep normal users away from internal playbooks, prompt logic, model/provider details, and reasoning labels.

Verification:

- Normal UI cannot show internal-only fields.
- Admin debug is gated.

### Phase 12: Quality Gate

Work:

- Add fixture-based quality tests for the handoff's rubric.
- Add banned visible term tests across Today's Brief, setup brief, chat, song read, project read, mission surface.
- Add "no generic advice" heuristics.
- Add "no recommendation without evidence" schema checks.
- Add "avoid is mandatory" checks.
- Add "confidence reason is mandatory" checks.
- Add data-lineage checks for dynamic brief blocks, music reads, mission recommendations, chat answers, and "what changed" claims.
- Add consolidation checks proving generated reads live in `manager_outputs`, durable memory lives in `memory_entries`, raw captures live in `source_snapshots`, evidence lives in `evidence_items`, and run audit lives in `manager_synthesis_runs`.
- Add permission-boundary checks for next moves, mission seeds, chat answers, tasks, drafts, and decision packages.
- Add Label HQ preservation checks so Staff, Missions, attention/flagged items, evidence, and recent movement remain part of the operating room.

Verification:

- The system fails tests if it becomes a dashboard summary, generic marketing adviser, task generator pasted into a brief, or metric report.
- The system fails tests if it loses operating-system behavior and becomes only a brief/chat generator.
- The system fails tests if it reintroduces parallel storage such as `manager_memory`, `manager_briefs`, or generated music reads as canonical music metadata.

## Product Rules That Must Not Be Lost

- The product never exposes model names, providers, prompt logic, playbook names, or internal reasoning systems in normal user UI.
- Data source names can appear only where they are genuine evidence/source labels, not as "the provider says" copy in the management read.
- Internal playbooks are real, but they are not product copy.
- Today's Brief can state the next move, but it is not the mission/task/checkpoint generator.
- Mission Genesis is separate and consumes packet intelligence.
- The Setup Brief is a first strategic read, not a recurring daily brief.
- Dynamic presentation is required; fixed schemas are internal reliability tools.
- Every recommendation needs evidence.
- Every output needs an avoid judgment.
- Confidence must be explained by signal agreement, data freshness, and relevant missing fields.
- Missing data should not dominate the user experience.
- The newest song is not automatically the priority.
- Playlist reach is not fandom.
- Virality is not career growth until it converts or strengthens identity.
- City affinity can matter more than raw city size.
- Brand affinity is a fit signal, not an automatic recommendation.
- Career stage and recent momentum are separate.
- The final product standard is a professional management brain that understands the artist and knows the next move.

## First Implementation Cut

The first code change should not touch UI. It should establish the spine while preserving and consolidating the old operating-system scaffolding:

1. Migration for `manager_intelligence_packets`, `manager_outputs`, `memory_entries.payload`, and any optional `artist_profiles` current-packet cache fields.
2. `manager-intelligence/types.ts`.
3. `packetSchema.ts` validators.
4. `evidenceNormalize.ts` and `signalClassifier.ts`.
5. `chartmetricKpiNormalize.ts` and `kpiInterpreter.ts`.
6. Minimal packet generation path that persists a packet from existing evidence.
7. `evidence_links`, run/action/usage/event links from packet generation.
8. Tests proving packet persistence, evidence IDs, confidence reason, signal types, avoid requirements, source scope, run lineage, usage/event preservation, and no creation of `manager_memory`, `manager_briefs`, or `artist_signal_snapshots`.

After that, migrate Setup Brief and Today's Brief onto `manager_outputs`.

