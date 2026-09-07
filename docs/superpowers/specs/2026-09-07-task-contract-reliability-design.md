# Task Contract Reliability Design

## Goal

Make every model-authored Task obey one compact contract, prevent optional generated work from failing primary requests, simplify Task actions, deduplicate Chartmetric evidence, and preserve the valid billing fixes on top of `origin/main`.

## Contract

One shared contract owns the minimum step count and the instructions used by every Task-authoring model path. Any deterministic rejection rule over model-generated fields must be stated in those instructions. Security, authorization, and persistence invariants remain server-only.

Visible mission Tasks may be `human_action` or `collaborative_draft`. `manager_work` stays in Manager/checkpoint output. `review_approval` is created only by runtime code after a ready immutable artifact exists. Every visible human Task has at least three distinct ordered steps, purpose, completion result, Manager responsibility, human responsibility, and a supported consequence of delay.

## Failure isolation

Invalid optional follow-up Tasks are removed before persistence and recorded as limitations; they do not fail an otherwise valid Manager reply or completed Task review. Invalid mission creation remains atomic and fails before any mission rows are written.

## Task actions

The Task sheet exposes one state-aware primary action: `Start task`, `Finish task`, `Continue task`, `Work with Manager`, or `Review draft`. `Move it` becomes `Do later` before scheduling and `Change timing` afterward. Completed and Manager-owned states show status rather than action buttons. Starting changes state only and uses no AI call.

## Evidence and billing

Chartmetric evidence rows are deduplicated with the same identity fields as the database unique index before insertion. Billing reconciliation retains `origin/main` Team-plan behavior while adding the initial-transaction replay guard and explicit PostgREST relationship selection from the recovery work.

## Baseline and verification

Implementation starts from the fast-forwarded `origin/main`. Regression tests reproduce every production payload, followed by the focused suites, full Vitest suite, production build, deploy-bundle regeneration, deployment, exact-prompt smoke tests, and telemetry verification.
