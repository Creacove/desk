# Team identity, settings, and invitation UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Team plan identity, settings, onboarding, member responsibilities, invitation authentication, workspace navigation, and Manager execution feel direct and music-industry-appropriate without assuming that the workspace payer or owner is the artist. Close the known Manager planning, assignment, and reliability failures that make detailed requests fail or appear completed before they are durable.

**Architecture:** Keep three identities separate: the team/company account (`accounts.name` and `WorkspaceTeamCapability.teamName`), the managed artist (`artists.display_name` and `ArtistProfileViewModel`), and the signed-in person (`ProductionUser.displayName` and their membership). Use one shared team identity treatment in the app shell and Team settings, one compact invitation composer for setup and settings, and an invite-specific authentication context that preserves the existing token and DB-first membership boundaries. Feed the canonical team roster into every Manager mission/task generation path, validate structured output before persistence, persist one complete work graph atomically, and expose authoritative completion only after durable writes succeed.

**Tech Stack:** React 18 + TypeScript, Tailwind CSS, Radix UI Dialog, Supabase RPCs and Edge Functions, Vitest + Testing Library, Vite, and Deno checks for changed Edge sources.

---

## Product decisions to preserve

### Identity hierarchy

The UI must communicate this hierarchy everywhere it matters:

```text
CBA — House 3       Team/company workspace, billing and membership boundary
Godwinton            Artist profile and work being managed
Ada Mensah           Signed-in human account
```

- `Owner` and `Member` are access permissions, not industry roles.
- `Team / house coordinator`, `Manager / project lead`, `Artist / performer`, and the other operating titles describe what a person does.
- An owner may be a label manager, school coordinator, teacher, finance lead, or artist. Never infer “Artist” from ownership.
- Use “Team” in customer-facing UI for the account-level group. Keep `artist_workspace` as an internal/data term.
- Do not introduce multi-workspace switching in this change. The invitation target remains the only active workspace after acceptance.

### Directness rules

- Remove explanatory paragraphs that do not help the next decision.
- Keep one primary action visible at a time.
- Use dropdowns for the role catalog and three visible responsibility slots; reveal more only through `Add responsibility`.
- Do not ask the inviter for the invitee’s name. The invitee owns their personal name and supplies it during account creation.
- Pending invitations display email addresses. Accepted members display their account names.
- Keep team identity in app chrome, Team settings, invitations, join authentication, and billing context. Do not repeat it inside every mission or task.

### Scope boundary

This plan supersedes the inline-invite presentation in `docs/superpowers/plans/2026-09-06-team-tab-invitation.md` and consolidates the known Manager reliability work from `docs/superpowers/plans/2026-08-30-manager-production-reliability-hotfix.md` and `docs/superpowers/plans/2026-09-07-task-contract-reliability.md`. It keeps the existing six-seat entitlement, invitation token format, DB-first invitation creation, role data shape, safe error codes, billing prices, and artist setup behavior unless a task below explicitly changes the invitation preview payload or Manager request contract.

## Manager operating model

The Manager is an operating layer for the artist and their team, not a generic checklist generator. It must use canonical workspace data, make the normal decision itself, and ask the human only for a decision or fact it genuinely cannot resolve.

### Assignment decision table

| Workspace state | Human work created by Manager | Assignment surface |
| --- | --- | --- |
| Solo plan with one owner | Route to the only workspace human automatically | Hidden; there is nobody else to choose |
| Team plan with one active person | Route to that person automatically | Hidden; a one-person team has no meaningful picker |
| Team plan with multiple people | Match the task to one active roster member using operating title and responsibility tags | No assignment question during creation; owner can use the compact task control only for review or correction |
| Multiple people but no defensible match | Keep the task unassigned and record the limitation | Surface one compact `Needs owner` state to the owner; never invent a person or silently assign the artist |
| Manager/system work | Keep it internal to Desk | No human assignee and no human assignment control |

The roster, team name, operating titles, and responsibility tags are bounded context, not instructions. The model may propose only an ID present in the active roster; the server validates the ID, scope, access role, and task work mode again before commit. Ownership is never treated as an artist role, and assignment never grants approval, billing, release, spending, external-send, or workspace-administration authority.

### Detailed plans and recovery

For a request such as “create a plan for this month, everything I need to do to get the song popping,” the Manager should create one durable mission rather than a huge prose dump or one task per day:

- 4–8 milestone Tasks covering the critical path, with repeated daily actions grouped into a cadence and each human Task detailed in 3–6 ordered steps.
- Checkpoints that explain the decision being watched, the evidence needed, the next action, and when the route changes.
- Manager research, synthesis, drafting, and replanning completed as Manager work or internal checkpoint reads; human Tasks contain only work the named person can execute now.
- A concise response that points to the created mission and first next step; the full detail lives in the durable Task graph.

The request must have one stable request identity. Both streamed and non-streamed Manager paths must use the same bounded canonical context, strict structured-output schema, semantic validator, mission/task persistence boundary, error classifier, and retry behavior. A retry of the same request returns or resumes the existing run; it does not create duplicate artist messages, Manager messages, missions, Tasks, drafts, actions, or usage records. Authoritative assistant text is emitted only after the complete accepted graph and conversation result are durable. If the model output is truncated, malformed, invalid, or too large, the run fails or performs one constrained repair; it never persists a plausible subset.

### Failure classes that must be closed

The implementation must reproduce and close the known failures, with the original diagnostic retained in telemetry and a safe actionable message shown to the user:

- long/detailed Manager requests failing from output truncation, context growth, provider limits, or downstream persistence;
- generated Tasks failing database contracts after provisional output was already displayed;
- duplicate work or lost structured context when the user retries;
- Today’s Brief or background Manager runs using the wrong authenticated/service write boundary;
- decision-only approvals being sent through an execution resolver that cannot legally resolve them;
- released/catalog music receiving contradictory pre-release upload work;
- malformed background Career Watch output consuming capacity without admissible work;
- wrapper errors hiding the real PostgREST/provider failure, phase, request ID, or run ID;
- duplicate evidence writes and billing/reconciliation replays where the existing reliability contracts cover those paths.

Do not claim that “everything is fixed” from browser tests alone. The final verification must include focused tests, full-suite/build evidence, changed Edge-function type checks, migration/deployment evidence, and a controlled reproduction of the original detailed-plan request plus its retry.

## Target user experience

### Team first run

After Team entitlement is confirmed, the owner sees four focused moments:

1. `Name your team` — one `Team or company name` field.
2. `Your role` — one role dropdown. The role is the owner’s operating title, not their access level.
3. `What will you handle?` — three responsibility slots visible; the first is required, the other two may remain empty; `Add responsibility` reveals more.
4. `Invite people` — optional. `Invite people` opens the shared invite dialog; `Skip for now` completes setup.

The first three decisions are required. Inviting people is never required to enter Desk. Keep the existing one-decision-at-a-time layout, but remove the noisy progress labels and redundant copy. The final screen should identify the created team and offer only `Invite people` and `Skip for now` until the owner chooses one.

### Settings information architecture

Team plan tabs, in this exact order:

```text
Account | Artist | Team | Preferences | Billing
```

Solo plan tabs:

```text
Account | Artist | Preferences | Billing
```

`Account` is the signed-in person: display name, email, password, and session. `Artist` is the creative profile currently called `Profile`. `Team` is the company/team identity, members, roles, responsibilities, and invitations. `Team` must not be the last tab.

Settings should open on `Account`, so the person immediately sees who the app considers them to be. The Team page header must show the team name first and the artist as quiet secondary context.

### Persistent identity surfaces

Desktop sidebar:

```text
Ordersounds
CBA — House 3
Godwinton · Artist
```

Mobile top bar uses the same team/artist context above the current page title. While the Team capability is loading, show a neutral loading treatment; use the artist-desk fallback only after the app knows the workspace is solo. Never present a stale or invented team name.

Team settings header:

```text
CBA — House 3                         2 of 6 people
Godwinton · artist workspace
```

Billing/access context should identify the Team plan as belonging to `CBA — House 3`. Tasks, missions, Manager conversations, and catalog content remain artist-focused.

### Team page and invitations

The Team page is roster-first. Show the owner/member rows, operating title, and responsibility tags. Keep the current viewer marked `You`. Keep owner-only edit/remove controls hidden from members.

The `Invite teammate` action opens a compact Radix dialog on desktop and a full-width bottom-sheet presentation on mobile. It must not append a form below the roster or move the page scroll.

Dialog sequence:

1. Focus `Email address` immediately.
2. Keep role details collapsed behind `Add role details`.
3. If opened, show `Their role` and three `What they handle` slots.
4. Submit with `Send invitation`.
5. On success, show a short delivery result with `Done` and `Invite another`.

If email delivery fails, make `Copy invite link` the primary recovery action and state that the invitation was created. If email is sent, do not imply that copying the link is required.

Pending invitations remain below the roster in a collapsed `Invitations · N pending` disclosure. The invite dialog is the only visible invitation creation surface.

### Invitee authentication

`/join#token=…` remains the only invitation entry point. The route scrubs the fragment and stores the token as it does today.

An unauthenticated invitee goes directly to an invite-specific authentication screen, not a generic preview page with a second Sign in button. The invitation email is prefilled and read-only.

- New invitee: default to `Create account`, showing locked email, `Your name`, and password.
- Existing invitee: a small `Already have an account? Sign in` link switches to password-only sign-in with the same locked email.
- The invitee’s email cannot be edited inside this flow.
- Preserve the token through email confirmation.
- Once authenticated, accept the invitation automatically and redirect directly to Desk/Home. Do not show a second “You’re in” landing page or a workspace chooser.
- Do not collect an invitee name from the inviter. The account-creation name becomes the member display name.

The invitation context should be visually minimal:

```text
Join CBA — House 3
For Godwinton
Content & Social · Content planning · Social publishing
```

Remove the current labelled preview card, “Desk knows you as” language, long authentication explanation, and repeated artist/team copy.

## File map

Create:

- `src/features/team/TeamInviteDialog.tsx` — shared invite composer and delivery result used by setup and Team settings.
- `src/features/team/TeamInviteDialog.test.tsx` — dialog focus, progressive disclosure, submit, cancel, and delivery-state tests.
- `src/design-system/workspaceIdentity.tsx` — shared compact team/artist identity presentation for the shell and settings.
- `src/design-system/workspace-identity.test.tsx` — shared identity rendering and loading/fallback tests.
- `supabase/migrations/20260908130000_team_invitation_preview_email.sql` — add the invited email to the token-authorized preview response.
- `supabase/migrations/20260908140000_manager_conversation_turn_reliability.sql` — add the additive request-identity/index/finalization boundary required for replay-safe Manager conversation turns, after confirming which existing reliability columns can be reused.
- `docs/operations/manager-reliability-evidence.md` — retain the reproduction, verification commands, fingerprints, and controlled live smoke evidence for the known Manager failures.

Modify:

- `src/types/workspaceTeam.ts` — add the safe `invitedEmail` preview field.
- `src/features/team/TeamFirstRunScreen.tsx` — keep only the three required decisions plus optional shared invite dialog.
- `src/features/team/TeamRolePicker.tsx` — keep the compact dropdown/three-slot model and context-aware labels.
- `src/features/team/MemberResponsibilitiesForm.tsx` — remove explanatory filler and reuse the compact picker.
- `src/features/team/YourTeamPanel.tsx` — use shared identity, collapsed pending invitations, and dialog-based inviting.
- `src/features/settings/SettingsScreen.tsx` — reorder tabs, separate Account/Artist/Team, and display the signed-in name.
- `src/design-system/components.tsx` — consume the shared identity presentation in `DeskRail` and `MobileChrome`.
- `src/app/ProductionApp.tsx` — pass `ProductionUser` and stable team/artist context into Settings and the shell.
- `src/features/team/AcceptTeamInvitation.tsx` — replace the large preview card with compact context and retain auto-accept behavior.
- `src/features/team/TeamJoinRoute.tsx` — enter invite auth directly and redirect to Desk after acceptance.
- `src/features/onboarding/FrontDoorAuth.tsx` — support locked invitation email, invite-specific copy, and create-account-first mode.
- `supabase/functions/preview-team-invitation/index.ts` — validate and return the preview email.
- `supabase/functions/_shared/teamInvitationEmail.ts` — simplify invitation copy around team, artist, and role context.
- `src/types/cleanProduction.ts` — carry a stable Manager request identity and complete retry envelope.
- `src/services/productionSupabase.ts` — send request identity to both Manager endpoints and preserve structured retry data.
- `src/features/manager/ManagerConversationV2.tsx` — show durable progress, safe failure, and retry states without presenting uncommitted completion.
- `supabase/functions/_shared/taskAssignment.ts` — validate roster-based assignment and the one-person fallback.
- `supabase/functions/_shared/managerHumanTaskGenerationContract.ts` — keep the strict human-task and assignment rules in the shared prompt contract.
- `supabase/functions/_shared/openaiManagerConversation.ts` — keep detailed-plan scope, bounded output, and structured schema rules aligned.
- `supabase/functions/_shared/openaiManagerConversationLegacy.ts` — enforce the same output, lifecycle, and mission/task rules in the legacy generator.
- `supabase/functions/_shared/missionGraphPersistence.ts` — validate and commit one complete mission graph, including team-aware assignment.
- `supabase/functions/manager-conversation/index.ts` — use the request identity, canonical finalization, and accurate failure phase.
- `supabase/functions/manager-conversation-stream/index.ts` — match non-streaming retry/finalization behavior and stream authoritative text only after commit.
- `supabase/functions/mission-genesis/index.ts` — include the active roster and preserve atomic/idempotent mission creation.
- `supabase/functions/manager-review-task-result/index.ts` — apply the same human-task and follow-up assignment contract.
- `supabase/functions/generate-todays-brief/index.ts` — keep service-owned synthesis writes on the service boundary.
- `supabase/functions/manager-permission-action/index.ts` — route decision-only and executable permission records to their correct resolvers.
- `src/services/todayPermissionAction.ts` — surface the real safe permission failure response.
- `supabase/functions/chartmetric-track-enrichment/index.ts` — deduplicate evidence writes before insert.
- `supabase/functions/paddle-process-webhooks/index.ts` — preserve replay-safe billing recovery.
- `supabase/functions/paid-workspace-setup/index.ts` — preserve explicit relationship selection during reconciliation.
- `supabase/functions/manager-career-watch/index.ts` and `supabase/functions/manager-career-watch-dispatcher/index.ts` — keep malformed background output quarantined and observable.
- `supabase/functions/_shared/appError.ts` — retain structured internal diagnostics while returning safe public errors.
- `.deploy-bundles/manager-conversation.ts`, `.deploy-bundles/manager-conversation-stream.ts`, and `.deploy-bundles/manifest.txt` — regenerate deploy artifacts from the verified source graph.

Tests to update:

- `src/settings-screen.test.tsx`
- `src/features/team/TeamFirstRunScreen.test.tsx`
- `src/features/team/TeamRolePicker.test.tsx`
- `src/features/team/YourTeamPanel.test.tsx`
- `src/features/team/AcceptTeamInvitation.test.tsx`
- `src/features/team/TeamJoinRoute.test.tsx`
- `src/front-door-auth.test.tsx`
- `src/team-invitation-pr3.test.ts`
- `src/team-invitation-email.test.ts`
- `src/production-app-shell.test.tsx`
- `src/design-system/workspace-tabs.test.tsx` only if shared tab assertions need adjustment.
- `src/manager-output-recovery.test.ts`
- `src/openai-manager-conversation-function.test.ts`
- `src/manager-conversation-stream.test.ts`
- `src/manager-team-assignment.test.ts`
- `src/manager-team-today.test.ts`
- `src/mission-genesis-persistence-contract.test.ts`
- `src/manager-review-task-result-function.test.ts`
- `src/manager-task-quality.test.ts`
- `src/manager-emergency-reliability-hotfix.test.ts`
- `src/today-permission-action.test.ts`
- `src/manager-released-catalog-policy.test.ts`
- `src/chartmetric-track-enrichment-function.test.ts`
- `src/paddle-backend-contract.test.ts`
- `src/paid-workspace-setup-function.test.ts`
- `src/manager-production-stabilization-contract.test.ts`

## Implementation tasks

### Task 1: Lock the identity and invitation contracts

**Files:**
- Modify: `src/types/workspaceTeam.ts`
- Modify: `src/features/team/TeamJoinRoute.tsx`
- Create: `supabase/migrations/20260908130000_team_invitation_preview_email.sql`
- Modify: `supabase/functions/preview-team-invitation/index.ts`
- Test: `src/team-invitation-pr3.test.ts`

- [ ] **Step 1: Write failing contract assertions.** Assert that an invitation preview contains `teamName`, `artistName`, `invitedEmail`, optional `operatingTitle`, responsibility tags, and expiry; assert that the preview never contains an invitation token, account ID, or workspace ID.
- [ ] **Step 2: Add the database preview field.** Create an additive migration that replaces the existing function definition and returns `invitedEmail` from the pending invitation row. Do not edit the already-applied historical migration. Preserve token-hash-only lookup, expiry/status checks, service-role execution, and safe error behavior.
- [ ] **Step 3: Normalize the Edge response.** Read `row.invitedEmail`, trim/lowercase it, validate the same email shape used by invitation creation, and return it as `invitedEmail`. Reject an incomplete row with the existing unavailable response.
- [ ] **Step 4: Update TypeScript types and fixture previews.** Add `invitedEmail: string` to `TeamInvitationPreview` and update every test fixture with the target email.
- [ ] **Step 5: Run the focused contract tests.** Run `npx vitest run src/team-invitation-pr3.test.ts src/features/team/TeamJoinRoute.test.tsx --environment jsdom --pool=vmThreads`; expected result is PASS.
- [ ] **Step 6: Commit the contract slice.** Run `git diff --check`, then commit with `feat: expose invite identity context`.

### Task 2: Build the shared team/artist identity presentation

**Files:**
- Create: `src/design-system/workspaceIdentity.tsx`
- Modify: `src/design-system/components.tsx`
- Modify: `src/app/ProductionApp.tsx`
- Modify: `src/features/team/YourTeamPanel.tsx`
- Test: `src/production-app-shell.test.tsx`
- Test: `src/design-system/workspace-identity.test.tsx`

- [ ] **Step 1: Write the identity component tests.** Verify team-plan output uses team name as primary text and artist name as secondary text; verify solo output uses the artist desk fallback; verify missing team capability renders a neutral loading/fallback state instead of a false company name.
- [ ] **Step 2: Create the shared presentation.** Export compact variants for shell and page headers. The component accepts `teamName: string | null`, `artistName: string`, `isTeamPlan: boolean`, and an optional count label. It must not infer an industry role from access role.
- [ ] **Step 3: Update `DeskRail`.** Render Ordersounds branding followed by the team name and `artistName · Artist` in Team plan; keep the artist desk label for solo. Avoid rendering the literal “Artist desk” as the Team name.
- [ ] **Step 4: Update `MobileChrome`.** Accept the same identity props and show the team/artist context above the active page title without adding a second navigation control.
- [ ] **Step 5: Pass stable data from `ProductionApp`.** Pass `teamCapability?.teamName`, `workspace?.artistName`, and the known Team-plan state. Do not reset an already loaded identity during settings navigation; keep the capability read authoritative.
- [ ] **Step 6: Replace `TeamHeading` internals.** Use the shared page variant in `YourTeamPanel`, with the team name as heading and the artist as secondary context.
- [ ] **Step 7: Run shell and identity tests.** Run `npx vitest run src/production-app-shell.test.tsx src/design-system/workspace-identity.test.tsx --environment jsdom --pool=vmThreads`; expected result is PASS.
- [ ] **Step 8: Commit the shell slice.** Commit with `feat: establish team and artist identity surfaces`.

### Task 3: Rebuild Settings around Account, Artist, and Team

**Files:**
- Modify: `src/features/settings/SettingsScreen.tsx`
- Modify: `src/app/ProductionApp.tsx`
- Modify: `src/settings-screen.test.tsx`

- [ ] **Step 1: Write failing settings assertions.** For Team plan, assert tab order `Account`, `Artist`, `Team`, `Preferences`, `Billing`, default selection `Account`, the signed-in display name, and the team/artist identity. For solo, assert the Team tab is absent and the order is `Account`, `Artist`, `Preferences`, `Billing`.
- [ ] **Step 2: Add the signed-in user prop.** Pass `accountUser: ProductionUser` into `SettingsScreen`; use `displayName` from auth metadata and email from the same user. Do not use `profile.name` as the person’s name.
- [ ] **Step 3: Rename the artist surface.** Rename the tab and internal heading from `Profile` to `Artist`. Keep the existing artist profile fields and persistence service unchanged.
- [ ] **Step 4: Update Account.** Show a quiet `Name` row before `Email`, then existing password/session controls. The name is display-only in this scope because the current auth adapter has no complete user-profile mutation path; do not create a partial second persistence system.
- [ ] **Step 5: Reorder and gate tabs.** Set the default tab to `account`, use the exact order above, keep Team visible only for an entitled `team_6` capability, and return to Account if a Team capability disappears.
- [ ] **Step 6: Pass Team context into billing.** Make the Billing heading/access summary identify the current team name when Team plan is active, while retaining the current owner-only billing controls.
- [ ] **Step 7: Run settings tests.** Run `npx vitest run src/settings-screen.test.tsx --environment jsdom --pool=vmThreads`; expected result is PASS.
- [ ] **Step 8: Commit the settings slice.** Commit with `feat: separate account artist and team settings`.

### Task 4: Simplify setup and responsibility capture

**Files:**
- Modify: `src/features/team/TeamFirstRunScreen.tsx`
- Modify: `src/features/team/TeamRolePicker.tsx`
- Modify: `src/features/team/MemberResponsibilitiesForm.tsx`
- Modify: `src/features/team/teamRolePresets.ts`
- Test: `src/features/team/TeamFirstRunScreen.test.tsx`
- Test: `src/features/team/TeamRolePicker.test.tsx`
- Test: `src/features/team/MemberResponsibilitiesForm.test.tsx`

- [ ] **Step 1: Add failing UX assertions.** Verify there are no long setup subtitles or noisy progress labels, the owner can choose `Team / house coordinator` or `Artist / performer` independently of access ownership, three responsibility slots appear, the first slot is required, and additional slots appear only after `Add responsibility`.
- [ ] **Step 2: Preserve the music role catalog.** Keep the existing music-industry presets for team/house lead, artist, manager, label/company, A&R, producer, songwriter, marketing, PR, content/social, DSP/distribution, rights/business affairs, finance/operations, recording/engineering, and Other. Rename only copy that implies ownership is artistic.
- [ ] **Step 3: Make labels context-aware.** `TeamRolePicker` accepts title labels for owner, invitee, and member editing. Use `Your role` only for the current user; use `Their role` for invitation; use `Role for <name>` for member editing. Remove the filler paragraph from `MemberResponsibilitiesForm`.
- [ ] **Step 4: Keep the responsibility contract compact.** Render exactly three slots initially, permit empty second and third slots, deduplicate/trim tags, cap at 12, and reveal more through the existing add action. Preserve the current 80-character title and 48-character tag validation.
- [ ] **Step 5: Simplify the final setup step.** After the first-run mutation succeeds, show the team identity and only `Invite people` and `Skip for now`. Do not display a second roster or a full invite form in the setup page.
- [ ] **Step 6: Run focused role/setup tests.** Run `npx vitest run src/features/team/TeamFirstRunScreen.test.tsx src/features/team/TeamRolePicker.test.tsx src/features/team/MemberResponsibilitiesForm.test.tsx --environment jsdom --pool=vmThreads`; expected result is PASS.
- [ ] **Step 7: Commit the setup slice.** Commit with `refactor: simplify team role setup`.

### Task 5: Replace the inline invite form with one shared dialog

**Files:**
- Create: `src/features/team/TeamInviteDialog.tsx`
- Test: `src/features/team/TeamInviteDialog.test.tsx`
- Modify: `src/features/team/YourTeamPanel.tsx`
- Modify: `src/features/team/TeamFirstRunScreen.tsx`
- Test: `src/features/team/YourTeamPanel.test.tsx`

- [ ] **Step 1: Write dialog behavior tests.** Assert that opening focuses the email field, role details are hidden initially, only one primary action is visible, Escape/cancel closes without changing page scroll, and the dialog exposes `role="dialog"` with an accessible name.
- [ ] **Step 2: Implement the Radix dialog shell.** Use `Dialog.Root`, `Dialog.Portal`, `Dialog.Overlay`, `Dialog.Content`, `Dialog.Title`, and `Dialog.Description`. On desktop use a compact 360–440px content width; on mobile use a bottom-sheet layout with internal scrolling.
- [ ] **Step 3: Implement the invite form state.** Accept `teamName`, `artistName`, seat availability, `artistWorkspaceId`, and the invite mutation callback. Ask for email first. Do not render a name field. Keep role details optional and collapsed.
- [ ] **Step 4: Wire role details.** When `Add role details` is chosen, show `Their role` and three responsibility slots using the shared picker. Keep `Send invitation` disabled only while pending or when no seat is available; preserve the existing service validation/error mapping.
- [ ] **Step 5: Implement delivery results.** Sent state says `Invitation sent to <email>` and offers `Done` plus optional `Invite another`; failed state says `Invite created, but the email did not send` and makes `Copy invite link` primary. Never fabricate a link when the mutation fails.
- [ ] **Step 6: Refactor `YourTeamPanel`.** Remove inline invite form state/rendering. Keep the Invite action in the People header, update roster/invitation/seat state after success, and keep pending invitations collapsed below People.
- [ ] **Step 7: Reuse the dialog in first run.** `Invite people` opens the same dialog. On completion, close the dialog and let `Continue to Desk` or `Skip for now` finish the setup. Preserve the current invitation mutation and link behavior.
- [ ] **Step 8: Test owner/member and seat behavior.** Assert members cannot open the dialog, full seats show one concise unavailable sentence, pending invitations remain below the roster, and settings scroll position is not changed.
- [ ] **Step 9: Run focused invite tests.** Run `npx vitest run src/features/team/TeamInviteDialog.test.tsx src/features/team/YourTeamPanel.test.tsx src/features/team/TeamFirstRunScreen.test.tsx --environment jsdom --pool=vmThreads`; expected result is PASS.
- [ ] **Step 10: Commit the invite UI slice.** Commit with `feat: make team invitations compact and focused`.

### Task 6: Make `/join` an invite-specific authentication handoff

**Files:**
- Modify: `src/features/onboarding/FrontDoorAuth.tsx`
- Modify: `src/features/team/TeamJoinRoute.tsx`
- Modify: `src/features/team/AcceptTeamInvitation.tsx`
- Test: `src/front-door-auth.test.tsx`
- Test: `src/features/team/AcceptTeamInvitation.test.tsx`
- Test: `src/features/team/TeamJoinRoute.test.tsx`

- [ ] **Step 1: Write failing auth assertions.** With an invitation, assert the screen defaults to account creation, the invited email is prefilled and read-only, the user name field is present only for account creation, and switching to sign-in retains the locked email and shows only password plus the small mode link.
- [ ] **Step 2: Extend invitation auth context.** Pass `preview.invitedEmail` and the token-preserving redirect URL from `TeamJoinRoute` into `FrontDoorAuthScreen`.
- [ ] **Step 3: Implement invitation-specific copy.** Replace the generic invitation card with compact team/artist/role context. Do not show “Your invitation stays here while you authenticate,” “Desk knows you as,” or duplicate role labels.
- [ ] **Step 4: Lock the email field.** Use a read-only field for invitation email so it remains visible and keyboard-readable but cannot be changed. Keep generic non-invitation auth behavior unchanged.
- [ ] **Step 5: Start invite auth directly.** Once the token preview is ready and the session is unauthenticated, render `FrontDoorAuthScreen` immediately. Remove the extra `Sign in` landing state from `AcceptTeamInvitation` for unauthenticated users.
- [ ] **Step 6: Preserve new-account verification.** Keep `emailRedirectTo` pointed back to the invite URL, retain the token in session storage, and show only the existing confirmation message when Supabase returns no session.
- [ ] **Step 7: Auto-accept and redirect.** When authentication produces a verified session, let `AcceptTeamInvitation` call `acceptInvitation` once, persist `ACTIVE_WORKSPACE_STORAGE_KEY`, and replace the location with `/?view=labelHQ`. Remove the intermediate `MemberArrival` page.
- [ ] **Step 8: Preserve safe failure paths.** Keep expired/revoked, wrong-account, conflict, and unavailable messages distinct. Never let a failed acceptance redirect into a generic workspace.
- [ ] **Step 9: Run auth tests.** Run `npx vitest run src/front-door-auth.test.tsx src/features/team/AcceptTeamInvitation.test.tsx src/features/team/TeamJoinRoute.test.tsx --environment jsdom --pool=vmThreads`; expected result is PASS.
- [ ] **Step 10: Commit the auth slice.** Commit with `feat: make invitation authentication direct`.

### Task 7: Align invitation email and server contracts

**Files:**
- Modify: `supabase/functions/_shared/teamInvitationEmail.ts`
- Modify: `src/team-invitation-email.test.ts`
- Modify: `src/team-invitation-pr3.test.ts`
- Modify: `supabase/functions/preview-team-invitation/index.ts` if Task 1 tests expose a normalization gap.

- [ ] **Step 1: Write copy assertions.** Assert the email subject uses the team name, the body identifies the artist as secondary context, role/responsibility details are included only when present, and the raw token is never included outside the join URL.
- [ ] **Step 2: Simplify the email.** Use the same direct hierarchy as the app: team name, `For <artist>`, optional role/responsibilities, `Join team`, and a quiet expiry/link fallback. Do not add invitee-name placeholders.
- [ ] **Step 3: Run email and server tests.** Run `npx vitest run src/team-invitation-email.test.ts src/team-invitation-pr3.test.ts --environment jsdom --pool=vmThreads`; expected result is PASS.
- [ ] **Step 4: Commit the contract slice.** Commit with `refactor: align team invitation copy`.

### Task 8: Make detailed Manager requests durable and retry-safe

**Files:**
- Create: `supabase/migrations/20260908140000_manager_conversation_turn_reliability.sql`
- Modify: `src/types/cleanProduction.ts`
- Modify: `src/services/productionSupabase.ts`
- Modify: `src/features/manager/ManagerConversationV2.tsx`
- Modify: `src/services/managerConversationStream.ts` only if the event contract needs normalization
- Modify: `supabase/functions/manager-conversation/index.ts`
- Modify: `supabase/functions/manager-conversation-stream/index.ts`
- Modify: `supabase/functions/_shared/manager-conversation/context.ts`
- Modify: `supabase/functions/_shared/manager-conversation/turnContract.ts`
- Modify: `supabase/functions/_shared/missionGraphPersistence.ts`
- Test: `src/manager-output-recovery.test.ts`
- Test: `src/openai-manager-conversation-function.test.ts`
- Test: `src/manager-conversation-stream.test.ts`
- Test: `src/production-supabase-service.test.ts`

- [ ] **Step 1: Reproduce the reported failure contract.** Add a detailed month-plan fixture and assert that the request creates one bounded mission graph, that malformed/truncated output creates no partial authoritative graph, and that the internal failure record retains the original error, phase, request ID, run ID, and safe public message.
- [ ] **Step 2: Add one logical request identity.** Generate a request ID once per user send, send it in the body and request header to both Manager endpoints, persist it as the run idempotency key, and retain the full retry envelope including conversation/task IDs, context request ID, context answers, focused music subject, and attachments.
- [ ] **Step 3: Make retries replay-safe.** On the same request ID, return the committed result, report the existing in-progress run, or resume the failed run without inserting duplicate artist/Manager messages, missions, Tasks, drafts, actions, or usage rows. Keep `retryMessageId` as a compatibility input while the new request identity becomes authoritative.
- [ ] **Step 4: Add the durable finalization boundary.** In the additive migration, add only the missing request/message uniqueness structures and a service-role-only `finalize_manager_conversation_v2` (or equivalent existing finalizer extension). Lock the run and current plan version, verify the complete account/workspace/artist/conversation scope, commit the accepted graph and conversation result idempotently, and make stale replays return the committed result. Do not edit historical migrations or reopen authenticated write grants.
- [ ] **Step 5: Keep the output bounded and honest.** Preserve the strict JSON schema, 4–8 milestone plan scope, 3–6 executable steps per human Task, one constrained repair attempt for recoverable output errors, and the rule that Manager research/drafting stays internal. A response that cannot fit or validate must produce a retryable failure, never a guessed subset or a success-shaped draft.
- [ ] **Step 6: Align streaming and non-streaming paths.** Both endpoints must share context construction, validation, finalization, error classification, and retry behavior. The stream may show progress/tool events, but it must emit `assistant.delta` and `conversation.completed` only from committed records; a disconnect after commit must not be recorded as a failed Manager run.
- [ ] **Step 7: Make the error UI useful and compact.** Keep the conversation/draft state intact when verified, show one safe failure sentence plus `Retry`, and retain the trace reference for support without exposing provider or database details. Retry must resend the original structured envelope, not only the visible text.
- [ ] **Step 8: Run the focused reliability tests.** Run `npx vitest run src/manager-output-recovery.test.ts src/openai-manager-conversation-function.test.ts src/manager-conversation-stream.test.ts src/production-supabase-service.test.ts --environment jsdom --pool=vmThreads`; expected result is PASS.
- [ ] **Step 9: Commit the Manager reliability slice.** Commit with `fix: make Manager detailed plans durable`.

### Task 9: Make Manager assignment genuinely team-aware

**Files:**
- Modify: `supabase/functions/_shared/taskAssignment.ts`
- Modify: `supabase/functions/_shared/managerHumanTaskGenerationContract.ts`
- Modify: `supabase/functions/_shared/openaiManagerConversationLegacy.ts`
- Modify: `supabase/functions/_shared/missionGraphPersistence.ts`
- Modify: `supabase/functions/manager-conversation/index.ts`
- Modify: `supabase/functions/manager-conversation-stream/index.ts`
- Modify: `supabase/functions/mission-genesis/index.ts`
- Modify: `supabase/functions/manager-review-task-result/index.ts`
- Modify: `src/features/team/TaskAssigneeControl.tsx` only if the compact control needs the final assignment state
- Test: `src/manager-team-assignment.test.ts`
- Test: `src/features/team/TaskAssigneeControl.test.tsx`
- Test: `src/manager-team-today.test.ts`
- Test: `src/openai-manager-conversation-function.test.ts`
- Test: `src/mission-genesis-persistence-contract.test.ts`
- Test: `src/manager-review-task-result-function.test.ts`

- [ ] **Step 1: Write the assignment matrix tests.** Cover solo, one-person Team, multi-person Team with a clear responsibility match, multi-person Team with ambiguity, removed/foreign IDs, and Manager/system work. Assert that no assignment question or picker appears when one human is the only possible assignee.
- [ ] **Step 2: Put canonical team context in every Manager packet.** Include the current team identity and bounded active roster in conversation, Mission Genesis, and task-result review context. Mark names, titles, and tags as untrusted data and never treat them as instructions.
- [ ] **Step 3: Make structured assignment explicit.** Require `assigneeUserId` and a bounded `assignmentReason` for human Tasks when a roster is available. The Manager chooses only a current roster ID by matching the concrete work to responsibilities; it uses null only when the match is genuinely ambiguous. `manager_work` always remains unassigned.
- [ ] **Step 4: Enforce the same result at the server boundary.** Route a one-person workspace through the single-person fallback, validate multi-person proposals against active membership and account scope, clear invalid proposals, and persist the assignment source/reason with the task. Never infer Artist from Owner and never let assignment grant approval or administration rights.
- [ ] **Step 5: Apply the policy to creation and updates.** Use the shared normalizer in Manager conversation, Mission Genesis, task-result follow-ups, and replanning. A task update must preserve or recompute assignment against the current roster; removal or reassignment must invalidate stale writes and reminders.
- [ ] **Step 6: Keep the UI subordinate to the agent.** Preserve the compact `TaskAssigneeControl` only for multi-person owner review/correction. Hide it for one-person work and Manager work; show `Needs owner` only for a genuinely ambiguous multi-person task.
- [ ] **Step 7: Run assignment tests.** Run `npx vitest run src/manager-team-assignment.test.ts src/features/team/TaskAssigneeControl.test.tsx src/manager-team-today.test.ts src/openai-manager-conversation-function.test.ts src/mission-genesis-persistence-contract.test.ts src/manager-review-task-result-function.test.ts --environment jsdom --pool=vmThreads`; expected result is PASS.
- [ ] **Step 8: Commit the assignment slice.** Commit with `fix: route Manager work from team responsibilities`.

### Task 10: Close the adjacent known production failure classes

**Files:**
- Modify: `supabase/functions/generate-todays-brief/index.ts`
- Modify: `supabase/functions/manager-permission-action/index.ts`
- Modify: `src/services/todayPermissionAction.ts`
- Modify: `supabase/functions/_shared/managerHumanTaskGenerationContract.ts`
- Modify: `supabase/functions/_shared/managerTaskQuality.ts`
- Modify: `supabase/functions/manager-review-task-result/index.ts`
- Modify: `supabase/functions/_shared/managerReleasedCatalogPolicy.ts`
- Modify: `supabase/functions/manager-career-watch/index.ts`
- Modify: `supabase/functions/manager-career-watch-dispatcher/index.ts`
- Modify: `supabase/functions/chartmetric-track-enrichment/index.ts`
- Modify: `supabase/functions/paddle-process-webhooks/index.ts`
- Modify: `supabase/functions/paid-workspace-setup/index.ts`
- Modify: `supabase/functions/_shared/appError.ts`
- Test: `src/manager-emergency-reliability-hotfix.test.ts`
- Test: `src/openai-manager-conversation-function.test.ts`
- Test: `src/manager-task-quality.test.ts`
- Test: `src/manager-review-task-result-function.test.ts`
- Test: `src/today-permission-action.test.ts`
- Test: `src/manager-released-catalog-policy.test.ts`
- Test: `src/chartmetric-track-enrichment-function.test.ts`
- Test: `src/paddle-backend-contract.test.ts`
- Test: `src/paid-workspace-setup-function.test.ts`
- Test: `src/manager-production-stabilization-contract.test.ts`

- [ ] **Step 1: Turn the known failures into a regression matrix.** Reproduce the original Manager error, Today’s Brief permission failure, unbound decision approval, invalid generated Task, released-catalog contradiction, malformed Career Watch output, wrapper-error loss, duplicate evidence write, and billing replay case from retained logs/fixtures. Record each failure’s phase and expected recovery.
- [ ] **Step 2: Preserve service-owned write boundaries.** Keep authentication, membership, entitlement, and permitted reads on the authenticated client; perform service-owned synthesis/finalizer mutations with the service client or service-only RPC. Do not solve permission errors by granting broad table writes.
- [ ] **Step 3: Separate decision from execution permissions.** Route unbound planning decisions to an idempotent decision resolver that cannot execute external effects. Keep executable approvals immutable, target-bound, and permission-gated; parse the actual Edge response so the user sees the safe reason.
- [ ] **Step 4: Enforce output and lifecycle contracts before persistence.** Keep the shared minimum-step validator/schema in parity, reject impossible Manager-owned human Tasks, isolate invalid optional follow-ups without failing the primary review, and reject generic pre-release asset work for released/catalog music unless the exact correction or dependency is requested.
- [ ] **Step 5: Quarantine unreliable background work.** Malformed or absent Career Watch output must fail the run, retain the provider/parser diagnostic, avoid creating work, and not keep spending capacity until the schedule is explicitly re-enabled. Duplicate evidence and replayed billing events must be idempotent.
- [ ] **Step 6: Preserve diagnostics.** Normalize native, string, PostgREST, provider, and structured errors into an internal record containing phase, fingerprint, request/run IDs, and domain references; return only a safe actionable message to the UI.
- [ ] **Step 7: Run the adjacent failure suites.** Run `npx vitest run src/manager-emergency-reliability-hotfix.test.ts src/manager-task-quality.test.ts src/manager-review-task-result-function.test.ts src/today-permission-action.test.ts src/manager-released-catalog-policy.test.ts src/chartmetric-track-enrichment-function.test.ts src/paddle-backend-contract.test.ts src/paid-workspace-setup-function.test.ts src/manager-production-stabilization-contract.test.ts --environment jsdom --pool=vmThreads`; expected result is PASS.
- [ ] **Step 8: Commit the adjacent reliability slice.** Commit with `fix: close Manager production failure boundaries`.

### Task 11: Full verification and handoff

**Files:**
- Modify: `docs/operations/team-release-evidence.md` only when the verification results are available.
- Modify: `docs/operations/manager-reliability-evidence.md` with the exact results, timestamps, fingerprints, and controlled smoke evidence.

- [ ] **Step 1: Run all focused UI, Manager, assignment, and invitation tests.** Run:

```powershell
npx vitest run `
  src/settings-screen.test.tsx `
  src/production-app-shell.test.tsx `
  src/design-system/workspace-identity.test.tsx `
  src/features/team/TeamFirstRunScreen.test.tsx `
  src/features/team/TeamRolePicker.test.tsx `
  src/features/team/MemberResponsibilitiesForm.test.tsx `
  src/features/team/TeamInviteDialog.test.tsx `
  src/features/team/YourTeamPanel.test.tsx `
  src/features/team/AcceptTeamInvitation.test.tsx `
  src/features/team/TeamJoinRoute.test.tsx `
  src/front-door-auth.test.tsx `
  src/team-invitation-email.test.ts `
  src/team-invitation-pr3.test.ts `
  src/manager-output-recovery.test.ts `
  src/manager-conversation-stream.test.ts `
  src/manager-team-assignment.test.ts `
  src/manager-team-today.test.ts `
  src/manager-task-quality.test.ts `
  src/manager-review-task-result-function.test.ts `
  src/manager-emergency-reliability-hotfix.test.ts `
  src/today-permission-action.test.ts `
  src/manager-released-catalog-policy.test.ts `
  src/chartmetric-track-enrichment-function.test.ts `
  src/paddle-backend-contract.test.ts `
  src/paid-workspace-setup-function.test.ts `
  --environment jsdom --pool=vmThreads
```

Expected result: all focused tests pass.

- [ ] **Step 2: Run the full suite.** Run `npm test`. Expected result: no failures; record the exact passed/skipped counts.
- [ ] **Step 3: Build production assets.** Run `npm run build`. Expected result: Vite completes successfully; existing bundle-size warnings may remain but are not failures.
- [ ] **Step 4: Check formatting and every changed Edge import graph.** Run `git diff --check` and `deno check` for the changed invitation, account-team, Manager conversation, Manager review, Today’s Brief, permission, Career Watch, Chartmetric, and billing Edge entrypoints plus their shared imports.
- [ ] **Step 5: Run source and database evidence checks.** Run `node scripts/test-team-database.mjs --source-only`, apply the new migrations to a fresh disposable database when Docker is available, verify grants/indexes/RPC signatures, and record `BLOCKED` rather than inferring PASS when the database is unavailable.
- [ ] **Step 6: Inspect behavior boundaries.** Confirm the final diff does not alter billing prices, artist discovery, invitation token hashing, DB-first invitation ordering, external-action permission boundaries, or multi-workspace behavior. Confirm every changed deploy bundle matches source and `.deploy-bundles/manifest.txt`.
- [ ] **Step 7: Run the controlled product flows.** Verify solo setup, Team setup as a non-artist owner, settings identity/tab order, team-name shell surfaces, optional invite/skip, compact settings invite dialog, locked-email create-account and sign-in paths, direct invite acceptance, multi-person responsibility-based assignment, one-person assignment hiding, detailed month-plan creation, retry, and no-duplicate records.
- [ ] **Step 8: Inspect production error evidence.** Query recent `app_error_events`, Manager runs, usage events, and mission/task records for the original failure fingerprints and the controlled reproduction. Confirm the real internal cause is retained, the user message is safe, and no new occurrence was introduced.
- [ ] **Step 9: Run the production environment check.** Run `npm run env:check:production` and record the result separately from the test/build/database result.
- [ ] **Step 10: Commit the verified implementation.** Stage only the implementation, migrations, tests, deploy bundles, and relevant evidence documentation, then commit with `fix: clarify team identity and invitation flow`.
- [ ] **Step 11: Push only after verification.** Confirm `git status --short` is clean, `git log -1 --oneline` is the expected commit, and push the current `main` branch to `origin/main` as requested.

## Acceptance checklist

- [ ] Team/company name is visible in desktop sidebar, mobile chrome, Team settings, invitation dialog, invitation email/join auth, and billing context.
- [ ] Artist name remains the managed creative identity and is not replaced by team name inside work surfaces.
- [ ] Signed-in person name appears in Account settings and is distinct from artist name.
- [ ] Settings tabs are `Account`, `Artist`, `Team`, `Preferences`, `Billing` for Team plan and omit Team for solo plan.
- [ ] Owner/member access labels are separate from operating titles and responsibilities.
- [ ] First run captures team name, current user role, and responsibilities before offering optional invites.
- [ ] Three responsibility slots are visible by default; more require an explicit add action.
- [ ] Invite composer is a dialog/bottom sheet, never an off-screen appended form.
- [ ] Inviter enters email only; invitee enters their own name.
- [ ] Invitee email is prefilled and locked in both create-account and sign-in modes.
- [ ] New invitees create an account; existing invitees can sign in; both paths retain the invitation token.
- [ ] Successful acceptance opens Desk directly with no workspace chooser or redundant arrival page.
- [ ] Failed email delivery remains recoverable through Copy invite link; failed invitation creation never produces a fake link.
- [ ] No new long explanatory copy, duplicate cards, or unnecessary controls are introduced.
- [ ] Manager context includes the current team roster and responsibilities for conversation, Mission Genesis, and task-result follow-ups.
- [ ] Solo and one-person Team work routes automatically to the only human and hides assignment UI; multi-person work is responsibility-aware and safe when ambiguous.
- [ ] Manager-owned work never receives a human assignee, and human assignment never grants approval or administration authority.
- [ ] A detailed month request creates one bounded 4–8 milestone mission with executable 3–6 step Tasks, not an unbounded or truncated dump.
- [ ] Manager retries are idempotent, preserve structured context, create no duplicate durable work, and do not show uncommitted completion.
- [ ] Known Today, permission, task-contract, lifecycle, background, telemetry, evidence, and billing-replay failures have regression coverage and retained evidence.
