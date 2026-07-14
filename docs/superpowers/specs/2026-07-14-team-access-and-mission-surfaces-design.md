# Team Access and Mission Surfaces Design

## Goal

Present Team Agents as a complete plan-based product and bring mission checkpoints, activity, and progress into the same focused mobile-first visual system as Pulse and Tasks.

## Team Agents

The Team Agents page introduces the section with one durable product sentence:

> Your AI team helps plan, coordinate, and execute the work that moves your career forward.

The AI Manager remains the available agent and uses the compact state label `Available now`. Every unavailable specialist uses the state label and supporting text `Not available on this plan`. The interface must not mention testing, coming soon, future activation, or incomplete rollout.

Opening an unavailable specialist leads to an access-state screen rather than a development placeholder. It retains the agent identity and displays one direct message: `You don't have access to this agent on your current plan.` No upgrade purchase control is introduced until the separate subscription exists.

## Mission Masthead

The mission room header keeps the back action, mission title, and progress as one compact hierarchy. On mobile, the percentage and bar form one tightly spaced progress unit immediately below the title. On desktop, title and progress may share a row, but the progress block must not create a large vertical void below the masthead.

The masthead remains horizontally contained for long mission titles.

## Checkpoints

Mobile and tablet use an inline accordion list. Each checkpoint row contains its phase/status, title, question, concise task-state summary, and expand affordance. Expanding a checkpoint reveals the Manager review and required task results inside that checkpoint card. Collapsing it returns to the concise list. Only one checkpoint is expanded at a time.

Locked checkpoints remain visible and clearly identify their dependency, but cannot expand until their dependency is satisfied.

Desktop retains a two-column master-detail workspace: checkpoint list on the left and the selected Manager review on the right. The existing unused `CheckpointsPanel` provides the foundation for both responsive variants and replaces `SimplifiedCheckpointsPanel` in the active mission room.

## Activity

Activity becomes a contained mission surface consistent with Pulse, Tasks, and Checkpoints. It includes a compact heading, update count, and a chronological list of bordered update rows. Each row separates the source/type label from the update message without introducing decorative cards for every fragment.

The empty state stays inside the same surface and reads `No mission activity yet.`

## Component Boundaries

- `StaffWorkspace` owns durable team description and plan-access labels.
- `LockedAgentWorkspace` owns the unavailable-on-current-plan message.
- `MissionRoom` owns masthead layout and selects the active checkpoint/activity surfaces.
- `CheckpointsPanel` owns responsive accordion and desktop master-detail checkpoint behavior.
- `CheckpointReviewBody` remains the single review renderer shared by mobile and desktop.
- `ActivityPanel` owns the contained activity surface and update rows.

## Testing

Regression tests will verify:

- No Team Agents or locked-agent surface contains testing or coming-soon language.
- AI Manager displays `Available now`; specialist agents display `Not available on this plan`.
- Locked-agent detail displays the current-plan access message.
- The mission masthead uses compact mobile progress spacing.
- Mobile checkpoints render an accordion rather than a separate inspector below the list.
- Expanding a checkpoint reveals that checkpoint's review and required tasks inline.
- Desktop checkpoint master-detail remains available.
- Activity uses the contained surface, update count, consistent rows, and empty state.

The full Vitest suite and production build must pass before completion.

## Scope

This work changes presentation and responsive interaction only. It does not add subscription checkout, entitlement fields, agent activation, checkpoint persistence, or new mission data.
