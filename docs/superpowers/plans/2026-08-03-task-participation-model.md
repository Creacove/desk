# Task Participation Model Implementation Plan

**Goal:** Restore all legacy mission work and make participation/blocking explicit across generation, persistence, review, and UI.

## 1. Regression tests first

- Update the production projection test to require exact Manager drafts and completed work to remain visible.
- Add UI coverage for actionable counts, Manager-work actions, completed details, and explicit empty arrays.
- Update review-function source contracts to classify by `work_mode`, not owner.
- Add Mission Genesis and Manager Conversation source-contract tests for `workMode`.
- Run each focused test and confirm it fails for the production behavior being fixed.

## 2. Shared domain contract

- Add `MissionTaskWorkMode` and `workMode` to the frontend model.
- Add a small fallback classifier using persisted mode, completion mode, owner, and user responsibility.
- Use the same rules in Edge Function persistence/review code.

## 3. Additive migration

- Add nullable `tasks.work_mode` with a three-value constraint.
- Backfill legacy rows in priority order without changing historical status or related records.
- Update the SQL Mission Genesis finalizer to persist mode and calculate checkpoint status from blocking work.

## 4. Projection and UI

- Stop filtering Manager-owned rows.
- Map every task with its work mode and derive required task ids from blocking modes.
- Treat `tasks: []` as authoritative so no phantom fallback is created.
- Count only incomplete blocking work in badges.
- Render Manager work as visible, non-actionable context while preserving expandable task content.

## 5. Generation and review paths

- Require and parse `workMode` in Mission Genesis.
- Require and normalize `workMode` in Manager Conversation.
- Validate completion-mode pairings and reject new required evidence/upload tasks.
- Persist `work_mode` in both graph writers.
- Calculate checkpoint completion using blocking modes.

## 6. Verification and deployment

- Run focused mission/task tests, then the full test suite and production build.
- Run `git diff --check` and inspect migration/function scope.
- Commit and push `main`.
- Apply the database migration, deploy affected functions, and deploy the frontend through the repository’s production path.
- Query the live affected mission to confirm all three legacy tasks remain visible with the correct modes.

