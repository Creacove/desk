# Manager Live Activity Orb Design

## Goal

Restore the existing 20px thinking orb to the V2 Manager conversation and replace internal run terminology with truthful, user-facing activity language derived from the actual live Manager event path.

## Evidence

The live `manager_synthesis_runs` table stores conversational progress as `packet_built` and `manager_synthesis`. The label `Starting Manager run` is not stored by the database; it is fabricated by the optimistic frontend state. During a live conversation, the streaming function emits workspace, analysis, tool, creation, and answer-preparation events. V2 currently displays their labels without the richer translation used by the legacy renderer and omits the existing orb.

## Design

- Replace the optimistic `Starting Manager run` label with `Reviewing your request`.
- Extend the shared Manager run-status helper to return both a user-facing label and an orb state.
- Preserve meaningful server phases such as `Working through the economics and trade-offs`.
- Translate internal or mechanical labels into product language:
  - workspace/packet work -> `Reviewing workspace context`
  - normal analysis -> `Working through the recommendation`
  - evidence/catalog/web work -> evidence-specific searching language
  - memory/mission review -> listening language
  - document/workspace creation -> creation language
  - answer preparation -> `Structuring the answer`
- Render `AppThinkingOrb` in V2 with `size={20}` and the mapped state.
- Hide the activity indicator as soon as Manager answer text begins streaming, matching the existing conversational behavior.
- Unknown raw tool identifiers and empty steps fall back to `Reviewing your request` rather than leaking implementation terms.

## Scope

This change does not alter database rows, orchestration, model calls, or response latency. Stale historical `running` rows are a separate data-reliability concern.

## Verification

- Unit tests cover initial, decision analysis, normal analysis, evidence, catalog, web, review, creation, composing, raw-tool, and completed-step behavior.
- UI tests confirm the 20px orb, accessible status, and live label are rendered only before streaming begins.
- The focused Manager suite and production build must pass before push.
