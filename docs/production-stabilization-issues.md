# Production Stabilization Issue Register

**Purpose:** Track the production issues found after the reliability/live-workspace rollout and fix them in priority order without mixing unrelated changes.

**Release context:** The new backend/functions/frontend are deployed. Core migrations through `20260728000400` are applied. Scheduler migration `20260728000500_schedule_workflow_recovery.sql` is still pending because it needs database Vault secrets.

## Priority Order

### P0. Manager agent requests exceed OpenAI TPM

**Symptom:** Manager agent fails with `429` because the request asks for more than the organization TPM limit. Example: requested `202669` tokens against a `200000` TPM limit.

**Impact:** Setup discovery, Manager conversations, or task work can fail even though the app is otherwise running.

**Likely root cause:** `supabase/functions/_shared/manager-conversation/agentLoop.ts` sends full serialized context/tool outputs back to the Responses API. Manager discovery and conversation tools can return too much data, then the loop compounds it with `previous_response_id` plus fresh tool outputs.

**Files to inspect/fix:**
- `supabase/functions/_shared/manager-conversation/agentLoop.ts`
- `supabase/functions/manager-artist-discovery/index.ts`
- `supabase/functions/manager-conversation/index.ts`
- `supabase/functions/manager-conversation-stream/index.ts`
- `supabase/functions/_shared/manager-agent/discoveryTools.ts`
- `supabase/functions/_shared/manager-conversation/toolExecutor.ts`
- `src/manager-agent-loop.test.ts`

**Fix direction:**
- Add a hard request-size budget before each OpenAI call.
- Bound tool result JSON before returning it to the model.
- Prefer compact summaries and IDs over full rows.
- Return a user-safe failure message instead of leaking provider/org/rate-limit details.
- Add tests that fail if a manager request can exceed the configured character budget.

**Acceptance criteria:**
- Oversized context is reduced before the model call.
- Provider 429 details are not shown raw to users.
- Manager discovery and task conversations still have enough evidence to act.

**Implementation and deployment verification (2026-08-02):**
- Manager conversation requests now set `max_output_tokens: 6000` and server-side Responses compaction at `64000` tokens.
- The first Manager turn receives a bounded opening brief; continued turns use the stored response chain plus only the new message, context answers, and workspace scope pointer.
- Successful local-tool outputs are capped at 12,000 characters. Prior Manager documents are listed as metadata and retrieved only through a current-workspace section reader capped at 7,000 characters.
- The cache key is stable per workspace (`manager:<workspace>:v1`) with explicit cache mode. This improves reuse without polling, extra database work, or a vector-store copy of existing Supabase documents.
- Token/context-limit 429s and other provider failures now preserve diagnostics only in run/usage records; users receive a safe recovery message.
- Before closing this issue in production: deploy both Manager conversation functions, run a long-existing-thread smoke test, confirm the user never receives a raw provider error, and inspect the resulting usage row to verify the initial request stays within the safe envelope.

### P0. Private-beta paywall depends on fragile build env

**Symptom:** Paywall showed only `View artist source` instead of the private-beta code CTA.

**Impact:** Invited beta users cannot redeem codes from the paywall.

**Root cause found:** The code was not removed. The deployed frontend bundle was built without `VITE_PRIVATE_BETA_ENABLED=true`, so `PaywallPreviewScreen` correctly fell back to the artist-source secondary link.

**Current status:** Hotfixed by rebuilding and redeploying with `VITE_PRIVATE_BETA_ENABLED=true`. Live bundle contains `Have a private-beta code?`.

**Files to inspect/fix:**
- `src/app/ProductionApp.tsx`
- `src/features/onboarding/OnboardingScreens.tsx`
- `src/private-beta-ui.test.tsx`
- `src/private-beta-access-contract.test.ts`
- Netlify production environment settings

**Fix direction:**
- Persist `VITE_PRIVATE_BETA_ENABLED=true` in Netlify production env.
- Add a deployment preflight script that fails production builds if required `VITE_` flags are missing.
- Add a post-deploy smoke check for the beta CTA.

**Acceptance criteria:**
- Beta CTA appears on production paywall after normal Netlify builds.
- Artist-source link only appears when private beta is explicitly disabled.

### P1. Song/project rooms hide existing Manager Reads

**Symptom:** Song/project rooms show `No Manager Read yet` while the button already says `Refresh Manager Read`, which implies a read exists.

**Impact:** Users think their saved read disappeared. It makes background refresh feel like data loss.

**Likely root cause:** The room can receive `managerReadStatus` such as `stale`, `fresh`, or `refreshing` without `managerRead` content hydrated. `MusicManagerReadContent` only renders content when `subject.managerRead` exists, so state and data can contradict each other.

**Files to inspect/fix:**
- `src/features/music/MusicScreens.tsx`
- `src/services/productionSupabase.ts`
- `src/production-supabase-service.test.ts`
- `src/production-app-shell.test.tsx`

**Fix direction:**
- If status implies an existing read, load and render the last active/staged read before showing refresh UI.
- During refresh, keep the previous read visible until a newer one is activated.
- If no read content exists, do not label the button `Refresh Manager Read`; use `Check status` or `Ask Manager for a read`.

**Acceptance criteria:**
- Opening a song/project with a prior read always shows that read before/during refresh.
- Empty state only appears when no read actually exists.
- Refresh failure keeps the previous read visible.

### P1. Activity Center is not behaving like a real workspace event surface

**Symptom:** Activity panel feels disconnected from background work, missions, tasks, and generated outputs.

**Impact:** Users cannot trust it as the live workspace log. It feels like static prototype UI instead of real app state.

**Likely root cause:** The UI reads `operating_events`, but not every background process writes consistent events with usable `display_mode`, `target_type`, `target_id`, and `refresh_scope`. Also, the app still has a fixture/legacy fallback path that can make the Activity Center look populated without being connected to real events.

**Files to inspect/fix:**
- `src/features/notifications/WorkspaceActivityCenter.tsx`
- `src/app/ProductionApp.tsx`
- `src/services/workspaceLiveSync.ts`
- `src/app/useWorkspaceLiveSync.ts`
- `src/services/productionSupabase.ts`
- `supabase/functions/_shared/workspaceEvents.ts`
- `supabase/functions/generate-todays-brief/index.ts`
- `supabase/functions/generate-music-summary/index.ts`
- `supabase/functions/mission-genesis/index.ts`
- `supabase/functions/manager-conversation/index.ts`
- `src/workspace-activity-center.test.tsx`
- `src/workspace-live-sync.test.ts`
- `src/production-app-shell.test.tsx`

**Fix direction:**
- Define event taxonomy for setup, reads, missions, tasks, conversations, and failures.
- Ensure every completed/failed background workflow writes a real `operating_events` row.
- Route event clicks to the exact target.
- Remove or clearly isolate legacy fallback activity in production.
- Add tests that insert/emit real event shapes and verify Activity Center grouping/routing.

**Acceptance criteria:**
- New mission/task/read/brief events appear without page reload.
- Activity rows route to the correct mission, task, song, project, or conversation.
- Empty states only appear when the real event feed is empty.

### P1. Task `Work with Manager` collides with mission-creation conversations

**Symptom:** Clicking `Work with Manager` from a mission task opens the Manager conversation, but the task work can get inserted into the existing mission-creation thread. Mission creation artifacts, task drafts, prompts, and files become mixed together.

**Impact:** The conversation loses meaning. Users cannot tell which work belongs to mission planning versus a specific task deliverable.

**Likely root cause:** Conversation identity is not scoped tightly enough. Task work can reuse the parent mission or mission-genesis conversation instead of creating/opening a task-scoped Manager thread.

**Files to inspect/fix:**
- `src/app/ProductionApp.tsx`
- `src/features/manager/ManagerScreens.tsx`
- `src/features/missions/MissionScreens.tsx`
- `src/services/productionSupabase.ts`
- `supabase/functions/manager-conversation/index.ts`
- `supabase/functions/manager-conversation-stream/index.ts`
- Manager conversation database tables/migrations
- `src/mission-task-deliverables.test.tsx`
- `src/production-app-shell.test.tsx`

**Fix direction:**
- Create deterministic conversation scopes: `mission_creation`, `mission`, and `task`.
- Task-scoped Manager work should open a task-specific conversation or clearly separated sub-thread.
- Keep task context pinned at the top of the chat.
- Put prior mission-created files/drafts into an artifact area instead of interleaving them as current task work.

**Acceptance criteria:**
- Starting Manager work from a task never appends to the mission genesis thread unless explicitly selected.
- Task context remains visible and pinned.
- Drafts/files are grouped under the correct task.

### P1. Task CTA lifecycle is unclear after Manager work

**Symptom:** After working with Manager, the task still says `Work with Manager`, and the user may need to return to the task to press a separate submit button. The next action is unclear.

**Impact:** Users cannot tell whether Manager work completed, whether a draft is ready, or whether they must submit a deliverable.

**Files to inspect/fix:**
- `src/features/missions/MissionScreens.tsx`
- `src/features/manager/ManagerScreens.tsx`
- `src/app/ProductionApp.tsx`
- `src/mission-task-deliverables.test.tsx`

**Fix direction:**
- Model task CTA states explicitly: `Work with Manager`, `Continue Manager draft`, `Review draft`, `Submit deliverable`, `Mark complete`.
- When Manager produces a task draft, surface the next CTA inside the chat and on the task.
- Keep task completion tied to persisted deliverables/results, not just chat completion.

**Acceptance criteria:**
- A completed Manager draft changes the task CTA.
- The chat has a clear next action back to the task or submit flow.
- The task status matches persisted work.

### P1. Task review state does not reliably propagate through checkpoints and the live workspace

**Symptom:** After a task is reviewed, the user can need a manual reload before the task CTA, checkpoint blocker, downstream checkpoint, and locked/open states agree. Returning from Manager work can also appear to land on the mission list instead of the exact task.

**Impact:** The system may have made the correct durable decision, while the visible workspace still describes the previous state. That breaks trust in task completion and makes the next action unclear.

**Root cause found:** Direct task submission does re-read the reviewed mission, but background review completion writes an `operating_events` row without the live event fields (`display_mode`, `refresh_scope`). In addition, checkpoint unlocks are derived from persisted checkpoint statuses, while task review allows the model to return those statuses without a deterministic transition guard. The return-to-task path needs a regression test that proves the mission room opens to the highlighted task, not merely the mission list.

**Files to inspect/fix:**
- `supabase/functions/manager-review-task-result/index.ts`
- `src/app/ProductionApp.tsx`
- `src/services/productionSupabase.ts`
- `src/features/missions/MissionScreens.tsx`
- `src/workspace-live-sync.test.ts`
- `src/production-supabase-service.test.ts`
- `src/production-app-shell.test.tsx`

**Fix direction:**
- Publish a real live event for completed, revised, and blocked task reviews, scoped to the mission list and workspace activity.
- Make accepted-task checkpoint progression deterministic from the task/checkpoint graph; do not leave a completed single-task checkpoint waiting because of an arbitrary model status.
- On any task review completion, refresh the current mission detail and derive the visible blocker/next checkpoint from that persisted result.
- Verify `Back to task` opens the task tab, selected mission, and highlighted task in one navigation.

**Acceptance criteria:**
- Completing/revising/blocking a task updates its CTA, result, checkpoint, mission recap, and activity without reload.
- A cleared dependency immediately unlocks the downstream checkpoint; a real blocker remains clearly identified.
- Background completions update an open workspace through the normal quiet live-sync path.
- Returning from task Manager work lands on that task, not a generic mission list.

### P2. Desk HQ naming is inconsistent

**Symptom:** The right panel uses `Top focus` for missions, while updates also use similar `Top focus` language.

**Impact:** Users cannot tell whether the section is about missions, updates, or general attention.

**Files to inspect/fix:**
- `src/features/desk/DeskHQ.tsx`
- `src/production-app-shell.test.tsx`

**Fix direction:**
- Use one product vocabulary:
  - Mission section: `Missions`
  - Event/update section: `Workspace updates` or `Recent activity`
  - Attention section: `Needs attention`
- Remove duplicate labels with different meanings.

**Acceptance criteria:**
- Mission-only sections are labeled `Missions`.
- Activity/update sections are not labeled like mission focus.

### P2. Manager Read presentation is repetitive and inefficient on small screens

**Symptom:** Song and project rooms repeat the song/project name and an extra read label before the metrics. On mobile, metrics stack in one long column instead of using the available width.

**Impact:** The room spends too much vertical space on framing instead of the Manager's actual read and makes scanning metrics unnecessarily slow.

**Files to inspect/fix:**
- `src/features/music/MusicScreens.tsx`
- `src/production-app-shell.test.tsx`

**Fix direction:**
- Keep the room title as the single subject identifier; remove duplicate Manager Read title/subtitle framing above metrics.
- Use a responsive metric grid: two columns on mobile when there is room, then expand naturally on larger screens.
- Preserve readable metric labels and avoid changing the Manager Read data contract.

**Acceptance criteria:**
- A song/project name appears once in the Manager Read header area.
- Mobile shows a compact two-column metric grid rather than one metric per row.
- Desktop retains a balanced, scannable metric layout.

### P2. Scheduler recovery migration remains pending

**Symptom:** `20260728000500_schedule_workflow_recovery.sql` is still not applied.

**Impact:** Normal workflows still run, but cron-based automatic recovery is not scheduled yet.

**Reason:** The migration requires database Vault secrets `workflow_worker_secret` and `billing_worker_secret`. Edge secrets exist, but database Vault secrets need to be set safely before applying the scheduler migration.

**Files to inspect/fix:**
- `supabase/migrations/20260728000500_schedule_workflow_recovery.sql`
- `docs/production-reliability-live-workspace-rollout.md`

**Fix direction:**
- Set DB Vault secrets through Supabase SQL editor or a secure DB connection.
- Apply the scheduler migration.
- Keep `WORKFLOW_RECOVERY_ENABLED_VERSIONS` empty first.

**Acceptance criteria:**
- Cron jobs exist but call workers only when eligible work exists.
- Workflow recovery remains in observation mode until explicitly allowlisted.

## Suggested Fix Sequence

1. Fix P0 Manager token budget and raw provider error leakage.
2. Make private-beta env deployment durable.
3. Fix Music Manager Read hydration/display mismatch.
4. Fix Activity Center event taxonomy and routing.
5. Split task-scoped Manager conversations from mission-creation conversations.
6. Fix task CTA lifecycle after Manager work.
7. Clean up Desk HQ naming.
8. Enable scheduler recovery after DB Vault is set.

## Deployment Rule For These Fixes

Each fix should ship as a small patch with:

- A failing test first.
- Focused implementation.
- Focused regression tests.
- Production build.
- Edge Function Deno check when an Edge Function changes.
- One production smoke check after deploy.
