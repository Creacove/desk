# Song Workspace First-Run Implementation Plan

> For agentic workers: use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Make manual unreleased-song creation provision one durable Song Room workspace, open directly in Files, and keep the Manager accurately scoped to that song.

**Architecture:** Add one server-owned initializer that uses the existing music, mission, conversation, task, and artifact-link records. Hydrate those existing links into the Song Room and conversation view models. Manager endpoints derive their subject and mission scope from the stored links on every turn; no model output can redirect song work to an unrelated mission.

**Tech Stack:** React 18, TypeScript, Vitest, Supabase Postgres RPC/migrations, Supabase Edge Functions, OpenAI Responses-backed Manager.

---

## Files and responsibilities

- supabase/migrations/20260807000400_manual_song_workspace.sql: idempotent transactional provisioning over current tables only.
- supabase/functions/initialize-song-workspace/index.ts: authenticated request boundary for the initializer.
- supabase/functions/_shared/manualSongWorkspace.ts: stage-to-first-task/opening-message policy.
- src/types/cleanProduction.ts and src/services/productionSupabase.ts: typed setup result and exact artifact-link hydration.
- src/features/music/MusicScreens.tsx: creation transition, Files-first routing, and sparse linked-work cards.
- src/features/manager/ManagerScreens.tsx and src/app/ProductionApp.tsx: persistent conversation subject and two-way navigation.
- supabase/functions/_shared/manager-conversation/musicSubject.ts, missionGraphPersistence.ts, and both Manager endpoints: durable scope resolution and mutation enforcement.
- supabase/functions/_shared/openaiManagerConversation.ts: bounded, stage-aware Manager behavior.
- supabase/functions/generate-music-summary/index.ts: reject activation of a stale read.

### Task 1: Prove and implement durable manual-song provisioning

**Files:**
- Create: supabase/migrations/20260807000400_manual_song_workspace.sql
- Create: supabase/functions/_shared/manualSongWorkspace.ts
- Create: src/manual-song-workspace-schema.test.ts
- Create: src/manual-song-workspace-policy.test.ts

- [ ] Step 1: Write failing contract tests.

  Assert that the migration defines create_manual_song_workspace_v1, inserts into missions and conversations, and creates mission-to-song and conversation-to-song artifact links. Assert that manualSongWorkspaceCopy for Debbie at mastering returns mission title Prepare Debbie for release, first task Add the current working audio, and an opening message containing Files.

- [ ] Step 2: Run npm test -- src/manual-song-workspace-schema.test.ts src/manual-song-workspace-policy.test.ts.

  Expected: FAIL because the policy module and migration do not exist.

- [ ] Step 3: Add the deterministic policy and atomic RPC.

  manualSongWorkspaceCopy supports idea, recording, production, mixing, mastering, ready, and scheduled. It returns exactly one first task and a deterministic Manager opening; it never says a file is present or commits a release.

  The RPC accepts workspace identity, bounded title/type/stage, and requestId. It uses only existing music_items, missions, mission_plan_versions, checkpoints, mission_plan_checkpoints, tasks, conversations, conversation_messages, and artifact_links. It creates:
  1. a manual music item;
  2. an active mission and active versioned plan;
  3. one checkpoint and one artist-action task;
  4. one conversation with linked_mission_id;
  5. one Manager opening message;
  6. mission-to-song and conversation-to-song reference links;
  7. one idempotent music_item_created operating event.

  Store requestId only under the private manual metadata key _manual_workspace_request_id. Add a partial unique index on artist_workspace_id and that key for manual songs. The security-definer RPC checks the account/workspace/artist tuple, grants execute only to service_role, and on a replay returns the same IDs without adding tasks or messages.

- [ ] Step 4: Run npm test -- src/manual-song-workspace-schema.test.ts src/manual-song-workspace-policy.test.ts.

  Expected: PASS.

- [ ] Step 5: Commit with message feat: initialize manual song workspaces atomically.

### Task 2: Add the authenticated client/server creation contract

**Files:**
- Create: supabase/functions/initialize-song-workspace/index.ts
- Modify: supabase/config.toml
- Modify: src/types/cleanProduction.ts
- Modify: src/services/productionSupabase.ts
- Modify: src/services/fixtureRepositories.ts
- Test: src/production-supabase-service.test.ts
- Test: src/manual-song-workspace-function.test.ts

- [ ] Step 1: Write failing tests that invoke repositories.music.createSongWorkspace for Debbie with a UUID request ID and assert the function name, body, authenticated bearer validation, and RPC name.

- [ ] Step 2: Run npm test -- src/production-supabase-service.test.ts src/manual-song-workspace-function.test.ts.

  Expected: FAIL because createSongWorkspace and the function do not exist.

- [ ] Step 3: Implement the contract.

  Add ManualSongWorkspaceResult with song, missionId, and conversation. Add createSongWorkspace to MusicRepository. Generate crypto.randomUUID in the browser repository, invoke initialize-song-workspace, then load the returned song and conversation through existing loaders.

  The Edge Function authenticates the bearer user via an anon client, validates membership and active entitlement, and only then constructs a service-role client to call create_manual_song_workspace_v1. It makes no OpenAI call. Set verify_jwt true in config. Update fixtures with one stable linked song/mission/conversation result.

- [ ] Step 4: Run the focused test command again.

  Expected: PASS.

- [ ] Step 5: Commit with message feat: expose manual song workspace setup.

### Task 3: Replace the empty creation landing with the Files-first flow

**Files:**
- Modify: src/features/music/MusicScreens.tsx
- Modify: src/app/ProductionApp.tsx
- Test: src/production-app-shell.test.tsx

- [ ] Step 1: Write UI tests that create Debbie at Mastering, observe Setting up your song workspace…, then observe the Song Room with Files selected. Write a second test where setup fails and Add song remains open with a retryable alert.

- [ ] Step 2: Run npm test -- src/production-app-shell.test.tsx -t "manual song workspace".

  Expected: FAIL because createMusicRecord calls createSong and selects Overview.

- [ ] Step 3: Use createSongWorkspace only in the manual song branch. Disable modal controls during provisioning, close the dialog only after a durable response, then set songRoomTab to files. Add onSongWorkspaceCreated in ProductionApp to refresh music/missions and store the official conversation before the Song Room opens. Preserve project creation and imported song behavior.

- [ ] Step 4: Run the focused UI test command.

  Expected: PASS.

- [ ] Step 5: Commit with message fix: open new song workspaces in files.

### Task 4: Hydrate links and make navigation unambiguous

**Files:**
- Modify: src/types/cleanProduction.ts
- Modify: src/services/productionSupabase.ts
- Modify: src/features/music/MusicScreens.tsx
- Modify: src/features/manager/ManagerScreens.tsx
- Modify: src/app/ProductionApp.tsx
- Test: src/production-supabase-service.test.ts
- Test: src/production-app-shell.test.tsx

- [ ] Step 1: Write tests that render Linked work with Debbie — song workspace, open that exact conversation, display conversation-music-context, and prove that normal message, context answer, and retry carry musicSubject music_item/song-debbie.

- [ ] Step 2: Run npm test -- src/production-supabase-service.test.ts src/production-app-shell.test.tsx -t "linked work|song context".

  Expected: FAIL because only a conversation ID is loaded and a conversation has no subject card.

- [ ] Step 3: Add structured musicSubject to ConversationViewModel and a managerConversation summary to MusicObjectViewModel. Hydrate exact conversation-to-music and mission-to-music artifact links in productionSupabase; retain text matching only as a legacy display fallback.

  Extend the existing Linked work panel with a Conversation card and existing Mission cards. Continue with Manager and Open conversation must use the same callback. Render a compact sticky conversation-music-context card below the title, outside scrolling messages. Its action returns to the Song Room.

- [ ] Step 4: Run the focused UI/service test command.

  Expected: PASS.

- [ ] Step 5: Commit with message feat: show durable song conversation context.

### Task 5: Resolve conversation scope on the server and enforce mission isolation

**Files:**
- Modify: supabase/functions/_shared/manager-conversation/musicSubject.ts
- Modify: supabase/functions/_shared/missionGraphPersistence.ts
- Modify: supabase/functions/manager-conversation/index.ts
- Modify: supabase/functions/manager-conversation-stream/index.ts
- Modify: supabase/functions/_shared/openaiManagerConversation.ts
- Test: src/manager-conversation-music-subject.test.ts
- Test: src/manager-conversation-tool-executor.test.ts
- Test: src/openai-manager-conversation-function.test.ts

- [ ] Step 1: Write tests proving resolveMusicConversationScope restores the stored song and linked mission when a follow-up omits musicSubject. Write a second test proving a graph decision for an artist strategy mission rejects with outside the linked song mission.

- [ ] Step 2: Run npm test -- src/manager-conversation-music-subject.test.ts src/manager-conversation-tool-executor.test.ts src/openai-manager-conversation-function.test.ts.

  Expected: FAIL because continued messages lose the subject and graph persistence accepts any mission ID.

- [ ] Step 3: Resolve the stored conversation-to-song link before every packet. Verify a client-supplied subject agrees with it. Read conversations.linked_mission_id and pass it as scopedMissionId to persistence.

  When scopedMissionId exists, mission graph persistence permits only update_existing_mission whose ID equals scopedMissionId, before any database write. Preserve unscoped conversation behavior.

  Update the Manager instructions: use fresh server-built song state; ask one highest-leverage question or one coherent related batch of at most four answers; never ask for current packet data; direct upload-only actions to Files/Rights; use Draft for inference; and never update broad work. Include the linked mission summary and ID in the packet. Expand parser/schema question capacity from one to four only for a related group.

- [ ] Step 4: Run the focused test command.

  Expected: PASS.

- [ ] Step 5: Commit with message fix: scope manager work to the linked song mission.

### Task 6: Make Manager Reads follow canonical song changes

**Files:**
- Modify: supabase/functions/_shared/music-manager-read/refreshPolicy.ts
- Modify: supabase/functions/generate-music-summary/index.ts
- Modify: src/features/music/MusicScreens.tsx
- Test: src/music-manager-read-refresh-policy.test.ts
- Test: src/music-manager-read-refresh-worker.test.ts

- [ ] Step 1: Write tests that music_item_created triggers a pre-release refresh and that a run whose trigger event has been superseded cannot activate a current read.

- [ ] Step 2: Run npm test -- src/music-manager-read-refresh-policy.test.ts src/music-manager-read-refresh-worker.test.ts.

  Expected: FAIL because manual creation is not refresh-eligible and activation does not compare later events.

- [ ] Step 3: Add music_item_created to the current refresh policy. Just before output activation, compare its trigger event to later canonical events for the same subject. If a later event exists, retain the historical output but do not mark it current; the existing worker handles the newest event. Do not add another worker.

  Change refreshing copy to Updating from latest song changes. Preserve immediate Files, Details, and Rights state if a background read fails.

- [ ] Step 4: Run the focused test command.

  Expected: PASS.

- [ ] Step 5: Commit with message fix: keep song manager reads current.

### Task 7: Verify the corrective release

**Files:**
- Modify: docs/superpowers/plans/2026-08-07-song-workspace-first-run.md

- [ ] Step 1: Run the focused suites.

  Command: npm test -- src/production-app-shell.test.tsx src/production-supabase-service.test.ts src/manager-conversation-music-subject.test.ts src/manager-conversation-tool-executor.test.ts src/openai-manager-conversation-function.test.ts src/music-manager-read-refresh-policy.test.ts src/music-manager-read-refresh-worker.test.ts

  Expected: PASS.

- [ ] Step 2: Run npm test and npm run build.

  Expected: both exit 0.

- [ ] Step 3: Perform local browser QA: create Debbie at Mastering; see pending then Files; confirm one official conversation and dedicated mission; open the sticky song context; upload a master; observe fresh Manager state; send a follow-up; confirm the broad artist mission is unchanged; and verify an imported/released song still follows the existing post-release route.

- [ ] Step 4: Mark verification complete and commit with message docs: record song workspace verification.

