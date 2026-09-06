# Team tab and invitation design

## Goal

Make the Team tab feel like a quiet Settings surface for an artist workspace: show the people who share the workspace, make inviting someone the one obvious action, and let the owner choose a known role instead of writing implementation-shaped metadata. Make invitation delivery honest and recoverable when the email provider is unavailable.

## Scope and invariants

- Keep the existing `team_6` entitlement, six-person limit, annual/monthly billing, database RPCs, invitation token format, and join route unchanged.
- Keep DB-first invitation creation. A committed invitation must never be presented as if it failed to exist.
- Do not send a real external email as part of development or automated verification.
- Do not change artist discovery/setup, Manager behavior, task ownership, or billing prices.

## User experience

The owner sees a single Team header with the artist name and a quiet `N of 6 people` line. The roster is the primary content. Each row contains the person’s name, owner/member status, optional operating title, and responsibility chips. Remove the Occupied/Reserved metric cards and explanatory paragraphs that do not help a decision. Members see the same roster read-only.

The owner’s primary action is `Invite teammate`. It opens a compact inline form. The form asks for an email first, then a shared role preset. Presets are the existing roles from first-run setup: Artist Manager, A&R, DSP & Distribution, PR, Content & Social, Rights & Royalties, Marketing, and Other. Choosing a preset fills the title and responsibility chips. The owner can remove chips and choose `Other` to enter a custom title and responsibilities. The same picker is used when editing a member so invite and edit persist the same shape.

Pending invitations are a quiet list below the roster only when present. Each row shows the email, expiry, and `Resend`/`Revoke` actions. Seat availability is expressed inline beside the invite action; when all six seats are used, the action is disabled with one plain sentence.

After an invite mutation, `emailStatus: "sent"` displays `Invitation sent` and a copy-link action. `emailStatus: "failed"` displays `Invite created, but the email didn’t send` and makes the copy-link action primary, with retry available through the existing rotate action. Network or structured service failures use their safe message and do not fabricate an invitation link.

## Code boundaries

- Add `src/features/team/teamRolePresets.ts` as the one shared source for role labels, operating titles, and responsibility tags.
- Update `TeamFirstRunScreen.tsx`, `YourTeamPanel.tsx`, and `MemberResponsibilitiesForm.tsx` to consume that source and use the picker/chips.
- Keep `workspaceTeamService.ts` as the service boundary. Preserve structured error codes and add tests that exercise JSON error payloads from `functions.invoke`.
- Keep `accountTeamHandler.ts` and the transactional email contract DB-first. Add a safe retry path only where it reuses an existing invitation mutation; do not alter token persistence or billing.

## Error and accessibility rules

- Every form has a visible label, keyboard-selectable preset controls, and `aria-live` status for delivery results.
- A failed email is not a failed invitation. The copy link must remain usable and must never expose the token in telemetry.
- `TEAM_GONE`, `TEAM_FORBIDDEN`, `TEAM_CONFLICT`, and `TEAM_UNAVAILABLE` remain distinguishable at the UI boundary.
- Owner-only controls stay hidden for members; the owner cannot remove the protected owner.

## Verification

- Focused React tests cover roster hierarchy, owner/member access, preset autofill, custom roles, seat limits, pending invite actions, and sent/failed delivery states.
- Service/handler tests cover structured error propagation, email-after-DB ordering, and failed-email copy-link fallback.
- Run the focused Team tests, the full Vitest suite, `npm run build`, `git diff --check`, and Deno checks for changed Edge sources.
