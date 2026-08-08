# Conversational Release Intake Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (\`- [ ]\`) syntax for tracking.

**Goal:** Let a Manager conversation create one durable, officially linked song release workspace and reveal it in the active thread without navigating the artist away from chat.

**Architecture:** A versioned Supabase transaction reuses the current manual song-workspace rules but adopts the active Manager conversation. The strict Manager tool calls that transaction rather than inserting a bare song. Both Manager transports reload the durable Music subject and return the committed creation receipts; the existing conversation UI renders a focused Song Workspace receipt.

**Tech Stack:** React 18, TypeScript, Vitest, Supabase Postgres/RPC, Supabase Edge Functions, OpenAI Responses API tools.

---

## File map

- \`supabase/migrations/20260808000100_conversational_song_workspace.sql\` — atomic, idempotent conversation-adopting workspace RPC.
- \`supabase/functions/_shared/manager-conversation/agentLoop.ts\` — strict tool registration.
- \`supabase/functions/_shared/manager-conversation/toolExecutor.ts\` — RPC tool call and created-work receipts.
- \`supabase/functions/_shared/openaiManagerConversation.ts\` — narrow release-intake instruction.
- \`supabase/functions/manager-conversation/index.ts\` and \`manager-conversation-stream/index.ts\` — post-tool subject/scope reconciliation and result models.
- \`src/services/productionSupabase.ts\`, \`src/app/ProductionApp.tsx\`, and \`src/features/manager/ManagerScreens.tsx\` — preserve and render bound subject/receipt.
- \`src/conversational-song-workspace-contract.test.ts\`, \`src/production-supabase-service.test.ts\`, and \`src/production-app-shell.test.tsx\` — regression coverage.

## Task 1: Add the atomic conversational workspace command

**Files:**
- Create: \`src/conversational-song-workspace-contract.test.ts\`
- Create: \`supabase/migrations/20260808000100_conversational_song_workspace.sql\`

- [ ] **Step 1: Write the failing contract test.**

\`\`\`ts
it("adopts a Manager conversation in one versioned workspace command", () => {
  const migration = source("supabase/migrations/20260808000100_conversational_song_workspace.sql");
  expect(migration).toContain("create_conversational_song_workspace_v2");
  expect(migration).toContain("p_conversation_id uuid");
  expect(migration).toContain("Conversation is already linked to another Music subject.");
  expect(migration).toContain("linked_mission_id = v_mission_id");
  expect(migration).toContain("conversational-song-workspace:");
});
\`\`\`

- [ ] **Step 2: Run the test and verify RED.**

Run: \`npm test -- src/conversational-song-workspace-contract.test.ts\`

Expected: FAIL because the migration does not exist.

- [ ] **Step 3: Implement the additive RPC.**

Create \`create_conversational_song_workspace_v2\` with current manual-workspace inputs plus \`p_conversation_id uuid default null\`. It must acquire an advisory lock based on the conversation or request ID, validate the supplied conversation belongs to the account/workspace/artist, reject a conflicting Music link, find an existing conversation-linked song before inserting, and atomically create/find the song, mission, plan, checkpoint, task, artifact links, and operating event.

When a conversation is supplied, update it to:

\`\`\sql
topic = trim(p_title) || ' — release planning',
linked_mission_id = v_mission_id,
updated_at = now()
\`\`\`

Return song ID/title/stage, mission ID, and conversation ID. The existing manual initializer remains unchanged and its v1 function remains available.

- [ ] **Step 4: Run the contract test and verify GREEN.**

Run: \`npm test -- src/conversational-song-workspace-contract.test.ts\`

Expected: PASS.

- [ ] **Step 5: Commit.**

\`\`\`bash
git add src/conversational-song-workspace-contract.test.ts supabase/migrations/20260808000100_conversational_song_workspace.sql
git commit -m "feat: add conversational song workspace transaction"
\`\`\`

## Task 2: Replace the bare Manager song insert

**Files:**
- Modify: \`supabase/functions/_shared/manager-conversation/agentLoop.ts\`
- Modify: \`supabase/functions/_shared/manager-conversation/toolExecutor.ts\`
- Modify: \`supabase/functions/_shared/openaiManagerConversation.ts\`
- Modify: \`src/conversational-song-workspace-contract.test.ts\`

- [ ] **Step 1: Write the failing Manager tool contract.**

\`\`\`ts
it("exposes the workspace command instead of a bare song insert", () => {
  expect(source("supabase/functions/_shared/manager-conversation/agentLoop.ts"))
    .toContain('name: "ensure_song_release_workspace"');
  expect(source("supabase/functions/_shared/manager-conversation/toolExecutor.ts"))
    .toContain('db.rpc("create_conversational_song_workspace_v2"');
  expect(source("supabase/functions/_shared/manager-conversation/agentLoop.ts"))
    .not.toContain('name: "create_music_song"');
});
\`\`\`

- [ ] **Step 2: Run the test and verify RED.**

Run: \`npm test -- src/conversational-song-workspace-contract.test.ts\`

Expected: FAIL because \`create_music_song\` is still exposed.

- [ ] **Step 3: Implement the strict workspace tool.**

Register \`ensure_song_release_workspace\` with the existing strict title/stage schema. Extend the executor input with an RPC method and mutable \`createdWork\` list. The executor calls the new RPC with the active conversation and manager-run IDs, sets \`input.musicSubject\` to the returned song, and appends only these receipts:

\`\`\`ts
{ type: "music_item", id: songId, title: songTitle, body: "Song workspace ready.", status: "created" }
{ type: "mission", id: missionId, title: \`Prepare \${songTitle} for release\`, body: "Dedicated release mission linked.", status: "created" }
\`\`\`

The Manager instruction asks only for title/current stage when required, calls this tool for confirmed new-song intent, and never emits a mission graph decision in the command's successful turn.

- [ ] **Step 4: Run the contract test and verify GREEN.**

Run: \`npm test -- src/conversational-song-workspace-contract.test.ts\`

Expected: PASS.

- [ ] **Step 5: Commit.**

\`\`\`bash
git add supabase/functions/_shared/manager-conversation/agentLoop.ts supabase/functions/_shared/manager-conversation/toolExecutor.ts supabase/functions/_shared/openaiManagerConversation.ts src/conversational-song-workspace-contract.test.ts
git commit -m "feat: create release workspaces from Manager chat"
\`\`\`

## Task 3: Reconcile the committed subject in both Manager transports

**Files:**
- Modify: \`supabase/functions/manager-conversation/index.ts\`
- Modify: \`supabase/functions/manager-conversation-stream/index.ts\`
- Modify: \`src/conversational-song-workspace-contract.test.ts\`

- [ ] **Step 1: Write the failing endpoint contract.**

\`\`\`ts
it("reloads committed song scope after Manager tool execution", () => {
  for (const path of managerPaths) {
    const content = source(path);
    expect(content).toContain("resolveConversationMusicSubject");
    expect(content).toContain("toolCreatedWork");
    expect(content).toContain("resolveConversationMissionScope(db, input, conversationId");
  }
});
\`\`\`

- [ ] **Step 2: Run the test and verify RED.**

Run: \`npm test -- src/conversational-song-workspace-contract.test.ts\`

Expected: FAIL because an in-turn song link is not reloaded.

- [ ] **Step 3: Implement sync/stream reconciliation.**

Make the agent-loop wrapper return \`toolCreatedWork\`. Both endpoints reload the conversation's Music subject after the tool loop, recompute the linked mission scope before persisting graph decisions, and merge tool receipts with persisted task/mission work. Pass the resolved subject into \`toConversationViewModel\`. The streaming \`conversation.completed\` event includes that subject and emits only committed receipts.

Preserve the transaction-owned \`<song> — release planning\` title on the opening turn instead of allowing model output to overwrite it.

- [ ] **Step 4: Run focused function contracts.**

Run: \`npm test -- src/conversational-song-workspace-contract.test.ts src/manager-conversation-song-scope.test.ts\`

Expected: PASS.

- [ ] **Step 5: Commit.**

\`\`\`bash
git add supabase/functions/manager-conversation/index.ts supabase/functions/manager-conversation-stream/index.ts src/conversational-song-workspace-contract.test.ts
git commit -m "feat: return chat-created song workspace context"
\`\`\`

## Task 4: Render the calm in-thread Song Workspace receipt

**Files:**
- Modify: \`src/services/productionSupabase.ts\`
- Modify: \`src/app/ProductionApp.tsx\`
- Modify: \`src/features/manager/ManagerScreens.tsx\`
- Modify: \`src/production-supabase-service.test.ts\`
- Modify: \`src/production-app-shell.test.tsx\`

- [ ] **Step 1: Write failing parser and streaming UI tests.**

\`\`\`ts
expect(conversation.musicSubject).toEqual({
  type: "music_item", id: "song-taz", title: "Taz", lifecycleStage: "mastering",
});
expect(screen.getByTestId("conversation-music-subject")).toHaveTextContent("Taz");
expect(screen.getByTestId("song-workspace-artifact")).toHaveTextContent("Release mission linked");
\`\`\`

Make the stream fixture emit a \`conversation.completed\` result carrying the new subject and Music/Mission created work. Assert the user remains in the conversation and can open the song.

- [ ] **Step 2: Run focused tests and verify RED.**

Run: \`npm test -- src/production-supabase-service.test.ts src/production-app-shell.test.tsx\`

Expected: FAIL because response parsing drops the newly bound subject and Music work is generic.

- [ ] **Step 3: Implement the client integration.**

Map \`musicSubject\` in the service parser. Merge a completed stream subject into the active/history conversation, refresh existing Music and mission projections when completion receipts contain those artifacts, and remain on the active thread.

Render newly created Music work as a compact \`data-testid="song-workspace-artifact"\` card with Song Workspace eyebrow, title, stage, \`Release mission linked\`, next action, and \`Open song\`. Use existing product surfaces and a short CSS-only entry transition; do not add new navigation or redirect chat.

- [ ] **Step 4: Run focused tests and verify GREEN.**

Run: \`npm test -- src/production-supabase-service.test.ts src/production-app-shell.test.tsx\`

Expected: PASS.

- [ ] **Step 5: Commit.**

\`\`\`bash
git add src/services/productionSupabase.ts src/app/ProductionApp.tsx src/features/manager/ManagerScreens.tsx src/production-supabase-service.test.ts src/production-app-shell.test.tsx
git commit -m "feat: reveal song workspaces in Manager chat"
\`\`\`

## Task 5: Verify, merge, and deploy

- [ ] **Step 1: Run release-flow tests.**

Run: \`npm test -- src/conversational-song-workspace-contract.test.ts src/manager-conversation-song-scope.test.ts src/manual-song-workspace-function.test.ts src/production-supabase-service.test.ts src/production-app-shell.test.tsx\`

Expected: PASS.

- [ ] **Step 2: Run the full suite and production build with non-secret test values.**

Run:

\`\`\`powershell
$env:VITE_SUPABASE_URL='https://example.supabase.co'
$env:VITE_SUPABASE_ANON_KEY='test-anon-key'
npm test
npm run build
\`\`\`

Expected: all tests pass and Vite exits 0.

- [ ] **Step 3: Inspect exact scope.**

Run: \`git diff --check main...HEAD; git status --short; git log --oneline main..HEAD\`

Expected: only the planned migration, Manager functions/tooling, app UI, tests, and docs.

- [ ] **Step 4: Merge and deploy.**

Fast-forward merge this verified branch into \`main\`, push it, deploy the additive migration plus the two Manager functions, deploy the verified frontend, and make only read-only production checks. Do not create a test song in a live artist workspace.
