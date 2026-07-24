# Manager chat artifacts refinement

## Outcome

Manager task work should feel like a conversation around a document, not a document pasted into a conversation. A task-scoped chat must also stay scoped to the task and must not re-create or re-announce its parent mission.

## UX

- While the Manager is streaming, its answer remains visible as ordinary live text.
- Once a `task_draft` is saved, the long answer collapses into a bordered document artifact in the same message.
- The artifact shows a document label, title, short preview, saved state, and an accessible `Open draft` control.
- Expanding the artifact reveals the complete formatted draft inline. The user remains in chat and can ask follow-up questions beneath it.
- The existing task context strip remains the only parent-mission/task reminder in a task-scoped conversation.
- The composer is a stable dock across the conversation pane with a quiet top boundary. It preserves the current textarea, keyboard behavior, send state, safe-area support, and mobile navigation clearance.

## Data contract

Existing `createdWork` remains backward compatible. Task drafts add optional fields:

- `artifactKind: "task_draft"`
- `content`: the exact saved draft text
- `managerOutputId`: the exact version persisted in `manager_outputs`

Ordinary mission, task, and music artifacts continue to use the current rendering.

## Server behavior

- A Manager turn with `taskId` may persist a versioned task draft, memory, and normal conversation messages.
- It may not persist mission-graph decisions from that turn. Mission creation and mission updates remain available only from non-task Manager conversations.
- Both streaming and non-streaming endpoints enforce the same invariant.

## Rendering behavior

- A message containing a task-draft artifact does not repeat the entire draft as ordinary Manager prose after completion.
- Task-draft artifacts render before ordinary task artifacts.
- In a task-scoped conversation, mission artifacts are suppressed because the task context strip already identifies the work and provides the route back.

## Verification

- Component tests prove collapsed-by-default, expandable full content, and no repeated mission card in task context.
- source-level endpoint tests prove both Manager endpoints skip mission persistence for `taskId` and emit the exact draft artifact fields.
- Existing Manager conversation, mission, task, typecheck/build, and full test suites remain green.
- A production browser smoke check verifies the dock and artifact layout after deployment.
