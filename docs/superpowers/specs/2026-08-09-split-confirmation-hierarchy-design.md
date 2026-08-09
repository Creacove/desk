# Split Confirmation Hierarchy

## Decision

The Rights tab must never present fully allocated rights as fully confirmed rights. Allocation answers whether the proposal is complete; confirmation answers whether each collaborator has accepted their own stated share. They are separate states with separate moments in the workflow.

## Active confirmation state

Once confirmation links have been sent, the top of the ledger contains one human sentence and no status badge, allocation meter, aggregate count, or duplicate backend summary.

For one confirmed collaborator and one pending collaborator, the sentence is:

> Mureni confirmed their 50% publishing and 50% master share. Waiting for David.

For larger groups, use names when there is one confirmed and one pending collaborator. Otherwise use a concise count-based sentence. The contributor ledger remains the exact audit record.

The ledger labels rights unambiguously as `Publishing 50% · Master 50%`. A contributor who has signed is `Confirmed`; an invited contributor is `Awaiting confirmation`. The remove control is hidden once the proposal is locked, rather than leaving an inert dash.

## Draft allocation state

Before links are sent, the header explains the next required action. The existing balancing callout and send action retain allocation information only when it matters. No confirmation chrome appears before confirmation begins.

## Non-goals

- No changes to split arithmetic, persistence, confirmation links, or public-signing authorization.
- No additional dashboard, progress meter, or status rail.
- No fabricated interpretation of unconfirmed allocations as cleared rights.
