# Minimal Setup and Beta Loading Design

## Goal

Make onboarding feel clear and active without filling the setup or paywall surfaces with explanatory copy.

## Approved experience

### Workspace setup

- Keep the heading `Preparing your workspace`.
- Keep the five persisted stage rows because they communicate real progress.
- Remove the active-state paragraph about the Manager and closing the page.
- Keep actual failure information and the Retry action when setup fails.
- Keep the ready state concise and factual.

### Beta access on the paywall

- Keep paid checkout as the primary action.
- Rename the secondary entry point to `Use beta code`.
- When opened, show only an accessible `Beta code` field and the activation button.
- Remove the form heading, invitation explanation, and complimentary-access paragraph.
- While beta redemption is running, disable the form and show a spinning progress icon beside `Activating` inside the button.
- Keep backend errors visible in the existing paywall error area.

## Scope

This is a frontend-only copy and interaction change. It does not alter checkout, entitlement, redemption, or setup workflow behavior.

## Verification

Component tests must prove that active setup no longer renders the removed sentence, the beta form is minimal, and beta redemption exposes an accessible loading indicator until its promise settles.
