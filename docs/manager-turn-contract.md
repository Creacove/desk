# Manager turn artifact contract

The Manager is an open chat release-management surface, not a set of deterministic buttons. Every successful turn therefore owns its presentation explicitly.

## Product rules

1. The artist sees only work created or intentionally surfaced by the current Manager turn.
2. Canonical user deliverables use their native artifact surface. Song documents open in Files at the exact document ID.
3. Internal support artifacts such as the Release Narrative remain available to Manager reasoning but never render in Manager chat or artist-facing Files.
4. Compatibility receipts never render when a canonical artifact receipt exists.
5. Decision packages are optional user-facing decision memos. They are created only when the user explicitly asks for a decision/strategy/management memo, brief, or package. They are not the default response to EPK, press, playlist, readiness, post-release, research, or troubleshooting requests.
6. Specialized release-success and opportunity UI is activated by the tools actually completed on that turn, not by regex-matching the user's English.
7. A failed or unrelated new turn cannot inherit a stale decision package, release-success artifact, or opportunity surface from conversation history.
8. Historical messages without the turn contract retain a narrow compatibility fallback so old conversations remain readable.

## Release workflow coverage

The same contract applies across pre-release and post-release work, including release readiness/date planning, mission/task work, EPKs, bios, one-sheets, press releases, press angles, playlist/editorial pitches, press pitches/briefs, content plans, release calendars, credits, lyrics, distributor notes, playlist/press opportunity research, post-release evidence/review, outcome tracking, and private release-share preparation.

## Implementation

Manager messages persist `metadata.presentation` with a versioned list of turn surfaces and visible artifact IDs. Server-created work carries an explicit presentation role and visibility. The browser treats this structured contract as authoritative for new turns and uses text inference only for historical messages created before the contract existed.
