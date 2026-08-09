# Song Release Operations Hardening Implementation Plan

1. Add app-level navigation regressions proving release receipt routing and tab persistence through music refreshes.
2. Add upload progress contracts for the repository and accessible modal states.
3. Add Manager context contracts for focused assets, recent activity, rights, and analysis state.
4. Add splits UI tests for awaited persistence, full-allocation locking, single-action hierarchy, and Rights-tab persistence.
5. Add database contracts for allocation bounds and service-role confirmation access.
6. Implement one-shot music navigation intent and preserve active tabs across repository refreshes.
7. Thread upload progress from TUS through the repository to the modal; keep canonical refresh and errors in context.
8. Link upload events to the song's active mission and immediately invoke the existing analysis worker when configured.
9. Enrich focused Manager context and require an exact subject read after claimed song changes.
10. Simplify Rights, await mutations, enforce remaining allocation, and move confirmation state changes behind the server command.
11. Repair public confirmation grants/configuration and improve edge-function error visibility.
12. Run focused and full tests, production build, migration dry-run, then deploy database, affected Edge Functions, and Netlify.
13. QA the logged-in desktop and narrow viewport flows plus a temporary valid public confirmation token; remove only test-created rows.
