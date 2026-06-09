# Prototype Coverage Matrix

Purpose: strict page/action coverage for the current prototype. This supplements `page-action-inventory.md`.

## Coverage Rules

- Every visible surface must map to data reads, writes, services, and failure states.
- Production behavior must preserve the prototype navigation model: setup -> Label HQ -> Manager/Staff/Missions/Settings, with contextual drawers.
- Evidence, Review, and Manager are not top-level durable nav items in the desktop rail.
- Visible brief metrics, movement items, counts, timestamps, source labels, and warnings are dynamic data. They require the same provenance rules as evidence and memory.
- Every dynamic prototype field must satisfy `docs/workflows/prototype-data-lineage-contract.md`: source record, producer workflow, run/action provenance, evidence or limitation, and usage/cost record when AI/provider work was used.
- Prototype-only affordances must not become confusing product promises. If a route/drawer exists in code but is not reachable in the current UI, production can implement it only when a real workflow opens it.

## Matrix

| Surface | Primary actions | Reads | Writes | Service/artifact | Failure state |
| --- | --- | --- | --- | --- | --- |
| Desktop Rail / Mobile Nav | Label HQ, Music, Staff/Team, Missions, Manager entry, Profile/Settings | current route, workspace availability | route preference only | navigation shell | unavailable target |
| Connect Artist | Continue to artist context | Spotify public identity, existing artist | selected identity | profile/source service | identity missing/ambiguous |
| Setup / Context | Back, Enter Label HQ, edit fields | selected identity, profile | profile, source readiness, initial memory | profile/memory/source | save failure, invalid field |
| Label HQ priority strip | Open artist profile, blocked task, next task, active missions | profile, mission priority, blockers, active mission count | route preference only | daily operating run/mission aggregation | stale count or missing blocker |
| Label HQ | Open profile, tasks, missions, evidence, Manager, staff | profile, directive, missions, tasks, evidence, reports, recent operating events | optional brief snapshot/review trigger | daily operating run | stale brief, missing source |
| Today's Brief | Talk to Manager, View evidence | directive, missions, agent reports, evidence, source limitations, generated_at | optional directive/brief snapshot | Manager synthesis/evidence | low confidence, contradiction |
| Recent Movement | Open related surface when item is actionable | operating events, agent notes, task/checkpoint changes, source changes | none from read | operating events/memory service | event has no linked artifact |
| Music library | Switch Songs/Projects, open song/project | music items, music projects, project items, identifiers, assets, splits, linked missions | route/selection preference only | music service/read model | duplicate/ambiguous music match |
| Music song room | Change stage, inspect overview/files/details/rights, open linked mission/tasks/evidence | music item, assets, identifiers, credits, splits, distribution state, evidence, missions, memory | lifecycle update, asset/metadata/split/distribution writes when user acts | music service + evidence/permission | stale source, missing asset, unsupported rights claim |
| Music project room | Open project songs, inspect inherited blockers, open linked mission | music project, project items, linked music items, project assets, mission links | project membership/update when user acts | music service | missing tracklist, duplicated song state |
| Split confirmation portal | confirm/reject contributor split | scoped split proposal, contributor record, confirmation token | split confirmation, contributor status, operating event, review trigger | music/permission service | expired/revoked token, mismatched contributor |
| Music distribution hub | check readiness, request/approve/initiate distribution | music assets, metadata, credits, identifiers, splits, permission, provider status | distribution package/event, permission, provider log, lifecycle update after confirmation | music/distribution adapter | missing required asset, rights not cleared, provider failure |
| Staff | Open Manager or locked agent | agent profiles, source readiness | optional referral/source request | agent readiness | source unavailable |
| Manager Office context gate | answer context, use suggestion, save answer | profile, missing-context questions, prior answers | context answers, memory entries where durable | conversation router/profile memory | missing context/save failure |
| Manager Office composer | ask Manager, topic chips, see full history, recent conversations | profile, memory, conversations, active missions, source limits | message, conversation, Manager run | conversation router/synthesis | run failure/empty message |
| Conversation Workspace | continue thread, open created work | conversation, messages, linked artifacts | messages, run, possible artifacts | conversation/synthesis | thread/artifact missing |
| Investigation | back | run stages, retrieval status, evidence checks | run status | Manager synthesis | timeout/retrieval failure |
| Decision Package | back, open mission, evidence, thread, work links | decision, evidence, mission, conversation, created work | linked artifacts, memory, permissions | decision/artifact service | partial write/approval needed |
| Missions | select active/archived mission, open lanes, memory | missions, plans, tasks, checkpoints, notes, reviews | selected mission preference | mission engine | mission missing/stale state |
| Tasks | checkpoint tab, show details, approve, mark done, submit note | mission plan, tasks, checkpoints, approvals | task state event, result, memory, checkpoint update | task/checkpoint service | approval blocked/save failure |
| Checkpoint Review | select checkpoint | mission plan, checkpoints, tasks, evidence, prior checkpoint result | checkpoint state event, checkpoint result, review/memory if run | checkpoint/review service | missing evidence/conflict |
| Notes | inspect notes | notes, reports, evidence, mission | none from read; runs create notes | agent notes/inbox | missing linked evidence |
| Mission Memory | open recap drawer | mission memory, events, tasks, checkpoints, evidence | none from read | memory service | stale recap/no provenance |
| Settings / Artist Profile | edit profile/source context | profile, source readiness | profile, memory, source readiness | profile/source/memory | save conflict |
| Locked Agent | upload/connect, ask Manager prepare brief | agent profile, source readiness, required/optional proof | source request/referral/inbox item/upload event | agent/source/referral | source unsupported |
| Evidence Drawer | close/read evidence | evidence, source snapshots | none | evidence service | stale/missing snapshot |
| Review / What Changed | open mission, run review, snooze | review, prior decision, current evidence | review outcome/snooze/memory | review service | missing previous decision |
| Work Draft Drawer | edit/approve/export where enabled | draft, linked task/decision | draft version, permission, export event | draft/permission | approval missing |

## Acceptance Checks

- Every button that writes state creates an auditable record.
- Every navigation action loads the target artifact context.
- Every drawer is contextual to the artifact that opened it.
- Every failure state can be shown without breaking navigation.
- Every visible numeric or geographic claim in Today's Brief maps to an evidence item or explicit limitation.
- Every Recent Movement item maps to an operating event, agent note, task result, checkpoint update, source change, review, or memory entry.
- Every Checkpoint Review recommendation maps to checkpoint state, task results, evidence, dependency state, and the run that evaluated it.
- Every Music readiness count, blocker, lifecycle stage, rights line, and distribution line maps to first-class Music records rather than generic artist objects.
- Every AI/provider/tool workflow writes usage records or an explicit non-billable marker.
