# Conversational Release QA Hardening Design

## Outcome

The chat-created release workspace must remain coherent after creation, navigation, and reload. The Manager should hand the artist directly to the next required action, and every persisted label must render cleanly.

## Approved scope

1. Keep the existing atomic `create_conversational_song_workspace_v2` command and the two-turn title/stage intake.
2. Make mission list summaries include the persisted open task so Desk HQ and Missions never show `0 open tasks` or `No next task selected` for a newly created release mission.
3. Keep the persistent song subject button opening the song overview, but make the completion receipt use an `Add files` action that opens the song room on Files.
4. Let Manager conversation headings render their persisted topic without automatic punctuation.
5. Repair the production function definition and any persisted conversational release topics damaged by the earlier Windows text-decoding path. The repair migration must use ASCII code points so it is safe under any deployment encoding.

## Boundaries

- No new release wizard, dashboard, mission graph, or separate chat flow.
- No change to manual Catalog creation.
- No automatic upload, scheduling, or release submission.
- Existing non-release music links continue opening Overview.

## Verification

- Regression tests fail before each code change and pass afterward.
- Full Vitest suite, Vite production build, Deno checks, and diff checks pass.
- Production database migration and both Manager functions are redeployed.
- Netlify production is redeployed.
- The existing logged-in Chrome workspace is used to verify desktop and mobile release handoffs, persistence, and idempotency.
- Controlled `QA Release Flow 0808` artifacts are removed after verification.
