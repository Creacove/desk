# Team tab and invitation implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the cluttered Team tab with a roster-first role-picker flow and make invitation email outcomes explicit and recoverable.

**Architecture:** Reuse the existing Team RPCs, invitation token, and Settings styling. Introduce one shared role-preset module consumed by first-run setup, invitation, and member editing; keep invitation creation DB-first and expose delivery status through the existing service boundary.

**Tech Stack:** React + TypeScript, Tailwind utility classes, Vitest Testing Library, Supabase Edge Functions, Deno.

---

### Task 1: Establish the shared role model

**Files:**
- Create: `src/features/team/teamRolePresets.ts`
- Modify: `src/features/team/TeamFirstRunScreen.tsx`
- Test: `src/features/team/TeamFirstRunScreen.test.tsx`

- [ ] **Step 1: Add the shared preset constants and helpers.** Export `TEAM_ROLE_PRESETS`, `TeamRolePreset`, `findTeamRolePreset`, and `parseResponsibilityTags`. Preserve the existing seven labels and exact default tag values currently used by first-run setup.
- [ ] **Step 2: Replace the first-run screen’s local role list and tag parser with the shared exports.** Keep its request payload as `operatingTitle: string | null` and `responsibilityTags: string[]`.
- [ ] **Step 3: Update focused tests to assert that selecting a preset fills the title and tags and that `Other` leaves custom fields editable.**
- [ ] **Step 4: Run `npx vitest run src/features/team/TeamFirstRunScreen.test.tsx --environment jsdom --pool=vmThreads` and confirm it passes.

### Task 2: Add a reusable role picker and simplify member editing

**Files:**
- Create: `src/features/team/TeamRolePicker.tsx`
- Modify: `src/features/team/MemberResponsibilitiesForm.tsx`
- Modify: `src/features/team/YourTeamPanel.tsx`
- Test: `src/features/team/YourTeamPanel.test.tsx`

- [ ] **Step 1: Write component tests for preset selection, chip removal, custom title entry, and save payload shape.** Select `DSP & Distribution` and assert title `DSP & Distribution` plus its four tags; remove one tag and assert only the remaining tags are submitted.
- [ ] **Step 2: Implement `TeamRolePicker` with a labelled group of buttons for presets, a chip list for responsibilities, and a custom title/input shown for `Other`.** Accept `value: TeamResponsibilities`, `onChange`, and `disabled`; emit trimmed, deduplicated tags capped at 12.
- [ ] **Step 3: Replace `MemberResponsibilitiesForm` free-text fields with `TeamRolePicker`, retaining Save/Cancel and existing validation limits.**
- [ ] **Step 4: Update `YourTeamPanel` edit state to store `TeamResponsibilities` values and render the shared picker.**
- [ ] **Step 5: Run the focused panel tests and verify the member remains read-only for non-owners.

### Task 3: Redesign the Team panel around the roster

**Files:**
- Modify: `src/features/team/YourTeamPanel.tsx`
- Test: `src/features/team/YourTeamPanel.test.tsx`

- [ ] **Step 1: Replace the seat-summary grid and explanatory copy with the header count, roster, and a single owner-only `Invite teammate` action.** Keep the current loading, load-error, owner protection, remove confirmation, and retry behavior.
- [ ] **Step 2: Put the invitation form behind the primary action and order fields email → role preset → responsibilities.** Use `Send invitation` as the submit label and disable it when the six-person capacity is occupied/reserved.
- [ ] **Step 3: Keep pending invitations below the roster only when `pendingInvitations.length > 0`; label actions `Resend` and `Revoke` while retaining the current rotate/revoke service calls.
- [ ] **Step 4: Make delivery result copy truthful: sent shows `Invitation sent`; failed shows `Invite created, but the email didn’t send`; both show Copy invite link when a token is returned. Add an `aria-live="polite"` result region.
- [ ] **Step 5: Update tests to assert the new hierarchy, absence of Occupied/Reserved cards, preset autofill, six-seat disablement, and both email statuses.
- [ ] **Step 6: Run `npx vitest run src/features/team/YourTeamPanel.test.tsx --environment jsdom --pool=vmThreads`.

### Task 4: Lock structured error transport and invitation delivery behavior

**Files:**
- Modify: `src/services/workspaceTeamService.ts`
- Modify: `src/account-team-function.test.ts`
- Modify: `src/team-invitation-pr3.test.ts`
- Test: `src/workspace-team-service.test.ts`

- [ ] **Step 1: Add service tests where `functions.invoke` returns a Response-like JSON body containing `code` and `error`; assert the thrown Error has both `message` and the structured `code`.
- [ ] **Step 2: Ensure `unwrap` handles Supabase’s `{ error: { message, context } }` shape and a direct Response-like context without consuming the body twice. Keep the existing safe fallback message.
- [ ] **Step 3: Add handler assertions for DB mutation before email, `emailStatus: "sent"`, and `emailStatus: "failed"` with a usable token; do not make a network call.
- [ ] **Step 4: Run the focused service/handler tests.

### Task 5: Verify and package the change

**Files:**
- Modify: `docs/operations/team-release-evidence.md` only if an actual check result is available.

- [ ] **Step 1: Run `npm test`.
- [ ] **Step 2: Run `npm run build`.
- [ ] **Step 3: Run `git diff --check`.
- [ ] **Step 4: Run `deno check supabase/functions/account-team/index.ts supabase/functions/_shared/accountTeamHandler.ts supabase/functions/_shared/transactionalEmail.ts supabase/functions/preview-team-invitation/index.ts`.
- [ ] **Step 5: Inspect the final diff for unchanged billing, migration, artist discovery, and setup paths; commit the implementation with `git add src supabase docs && git commit -m "refine team roster and invitation flow"`.
