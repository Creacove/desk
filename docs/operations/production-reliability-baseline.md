# Production reliability baseline

Measured on 2026-07-28 in `Africa/Lagos` (`UTC+01:00`) from the isolated
`codex/production-reliability-live-workspace` worktree at `be55b17`.

This baseline is intentionally read-only. No migration was applied, no Edge
Function was deployed or invoked, and no production workflow or data was
created. Secrets and local environment values are not included.

## Cost guardrails

These are internal intervention thresholds, not Supabase plan limits:

| Meter | Internal threshold |
| --- | ---: |
| Egress | 2.5 GB per billing period |
| Database size | 300 MB |
| Edge Function invocations | 100,000 per billing period |
| Realtime messages | 250,000 per billing period |
| Peak Realtime connections | 100 |
| Repeating idle REST or Edge Function requests | 0 |

## Repository state

### Isolated worktree

Command:

```text
git status --short
```

Result: exit 0 with no output. The isolated worktree was clean before this
document was created.

### Main worktree

The main worktree was inspected read-only to preserve its pre-existing user
change:

```text
git status --short
 M deno.lock
```

`deno.lock` was not read, copied, modified, staged, or committed by this task.

### Recent history

Command:

```text
git log -12 --oneline
```

Output:

```text
be55b17 docs: plan production reliability implementation
0b7c166 docs: design production reliability and live workspace
d26dfc6 refactor: render one complete music manager read
aaaceaa fix: track setup manager reads to terminal state
af0f24d migrate: simplify current music manager reads
8b1843d feat: integrate durable manager read generation
fc36380 feat: add exact manager read metric projection
c7051fb refactor: simplify music manager read model contract
851b995 docs: plan single-surface manager read implementation
09cadd2 docs: preserve manager read prompt quality
3be8bf6 docs: define single-surface music manager read
32e94fe fix: use Sparkles icon for first read, RotateCcw for retry, RefreshCw for refresh on song and project buttons
```

## Linked Supabase inventory

### Migration inventory

Command:

```text
npx supabase migration list --linked
```

Result: exit 1 after 18.9 seconds.

```json
{"_tag":"Error","error":{"code":"LegacyProjectNotLinkedError","message":"Cannot find project ref. Have you run supabase link?"}}
```

Status: **NOT COLLECTED**. The isolated worktree does not contain the ignored
Supabase link metadata from the main worktree. The metadata was not copied
because this task must leave only this tracked document changed and must not
copy local project state into the branch.

Reproduction protocol:

1. In a trusted local checkout already linked to project
   `bbwbxmnanccwottrmkqu`, confirm `supabase/.temp/project-ref` points to that
   project without displaying credentials.
2. Run `npx supabase migration list --linked`.
3. Record the command time, exit code, and the complete local/remote migration
   table. Do not run `db push`, `migration repair`, `link`, or any mutation as
   part of the measurement.

### Edge Function inventory

Command:

```text
npx supabase functions list --project-ref bbwbxmnanccwottrmkqu
```

Result: exit 0 after 19.4 seconds. The command returned 35 functions, all with
status `ACTIVE`:

| Function | Version |
| --- | ---: |
| `spotify-catalog-bootstrap` | 76 |
| `spotify-artist-search` | 57 |
| `connect-spotify-artist` | 59 |
| `send-split-confirmations` | 58 |
| `confirm-split` | 57 |
| `load-split-confirmation` | 56 |
| `chartmetric-resolve-artist` | 62 |
| `chartmetric-track-enrichment` | 70 |
| `chartmetric-artist-enrichment` | 66 |
| `chartmetric-project-enrichment` | 66 |
| `generate-music-summary` | 88 |
| `generate-todays-brief` | 79 |
| `mission-genesis` | 64 |
| `manager-conversation` | 44 |
| `refresh-public-context` | 38 |
| `manager-conversation-stream` | 40 |
| `manager-review-task-result` | 37 |
| `manager-artist-discovery` | 41 |
| `spotify-catalog-search` | 31 |
| `spotify-import-selection` | 31 |
| `billing-status` | 35 |
| `paystack-initialize-checkout` | 28 |
| `paystack-webhook` | 32 |
| `spotify-catalog-preview` | 24 |
| `paid-workspace-setup` | 35 |
| `create-beta-invite-batch` | 20 |
| `redeem-private-beta-code` | 19 |
| `send-account-welcome` | 19 |
| `billing-pricing-config` | 19 |
| `paddle-create-checkout` | 16 |
| `paddle-webhook` | 16 |
| `paddle-process-webhooks` | 17 |
| `paddle-customer-portal` | 16 |
| `paystack-ensure-catalog` | 10 |
| `task-document-upload` | 3 |

The raw CLI response also contained function IDs, timestamps, entrypoint paths,
and deployment hashes. Those volatile fields are omitted here; function slug,
status, and version are the deployment-drift signals this baseline needs.

## Supabase organization usage

Measurement attempted at 2026-07-28T18:07+01:00.

| Meter | Current billing-period value |
| --- | --- |
| Egress | **NOT COLLECTED** |
| Database size | **NOT COLLECTED** |
| Edge Function invocations | **NOT COLLECTED** |
| Realtime messages | **NOT COLLECTED** |
| Peak Realtime connections | **NOT COLLECTED** |

Reason: the available browser session had no open authenticated Supabase tab.
A read-only attempt to open the Supabase dashboard timed out before navigation,
so authentication and the organization scope could not be verified. No login
flow, cookie/session inspection, credential request, or alternate account was
attempted.

Reproduction protocol:

1. Sign in to the Supabase Dashboard using the authorized production account.
2. Open the organization that owns project `bbwbxmnanccwottrmkqu`, then open
   **Organization → Usage**.
3. Select the current billing period. Record the exact local timestamp, billing
   period boundaries, and displayed values for egress, database size, Edge
   Function invocations, Realtime messages, and peak Realtime connections.
4. Compare each value with the internal thresholds above. Store a screenshot
   only in the approved private operational evidence location; do not commit
   organization identifiers, billing details, or account data to this repo.
5. Repeat before and after each rollout phase using the same billing-period
   scope.

## Production browser network baseline

### Passive idle measurements

| Scenario | Duration | REST requests / bytes | Edge requests / bytes | WebSocket messages / bytes |
| --- | ---: | --- | --- | --- |
| Visible production workspace tab | 5 minutes | **NOT COLLECTED** | **NOT COLLECTED** | **NOT COLLECTED** |
| Hidden production workspace tab | 5 minutes | **NOT COLLECTED** | **NOT COLLECTED** | **NOT COLLECTED** |

Reason: an authenticated production workspace tab existed, but the available
safe browser-control surface did not expose a complete network-request,
transferred-byte, and WebSocket-frame recording. A partial resource-timing
sample would omit WebSocket messages and could evict older entries, so it would
not be an auditable baseline. The tab was not reloaded or interacted with.

Reproduction protocol:

1. Use an authorized production test account with no running setup, Manager
   Read, Mission Genesis, import, or enrichment job.
2. Open a stable workspace route, wait for its initial load to settle, then open
   Chrome DevTools **Network**. Keep the browser's normal cache behavior.
3. Clear the network log at `T0`, leave the app visible and untouched for
   exactly five minutes, then stop recording.
4. Record request count and transferred bytes for entries whose URLs contain
   `/rest/v1/` and `/functions/v1/`. Separately record WebSocket frame count and
   payload bytes for the Supabase Realtime connection. Record unexpected
   request URLs and their cadence.
5. Clear the log, switch to another tab so the workspace becomes hidden, leave
   it untouched for exactly five minutes, return, and record the same fields.
6. Do not commit a HAR because it can contain authorization headers, query
   values, and user data. Store it only in an approved private evidence
   location after sanitization.
7. Pass condition after the cost-control phase: no repeating idle REST or Edge
   Function requests in either window. A persistent Realtime connection and
   sparse keepalive traffic must be recorded separately from application
   events.

### Workflow measurements

The following measurements are **DEFERRED** because initiating them would
create production work and could consume paid AI or enrichment capacity:

- Manager Read from request through terminal result and live notification
- Paid workspace setup from discovery through completion/recovery
- Mission Genesis from request through terminal result and live notification

Safe reproduction protocol:

1. Schedule a controlled production smoke-test window with explicit budget
   approval and dedicated test records that can be identified and cleaned up.
2. Confirm no equivalent workflow is already running before triggering
   anything.
3. Start a fresh Network recording immediately before one intentional trigger.
4. Record the workflow correlation/request ID, start time, terminal time,
   terminal status, count and bytes for `/rest/v1/`, `/functions/v1/`, and
   Realtime frames, and the delay between terminal persistence and visible UI
   update.
5. Navigate away and back without reloading to verify the in-progress state is
   durable. After completion, verify the result and Activity Center update
   appear without a full-page reload.
6. Trigger each workflow at most once. Stop if duplicate jobs, unbounded
   requests, or a missing terminal state appears. Do not retry until the
   recorded job state has been inspected.

## Verification baseline

All commands below ran from the isolated worktree. The focused tests loaded the
existing root `.env` through Node's `--env-file` option without printing its
contents.

### Focused Vitest suites

Command:

```text
node --env-file=C:\Users\USER\Desktop\ai-record-label-prototype\.env node_modules\vitest\vitest.mjs run src\production-supabase-service.test.ts src\production-app-shell.test.tsx src\openai-music-summary-function.test.ts src\music-manager-read-v2-workflow.test.ts src\openai-todays-brief-function.test.ts src\openai-mission-genesis-function.test.ts src\paid-workspace-setup-function.test.ts --environment jsdom --pool vmThreads --reporter dot
```

Result: exit 0 after 223.3 seconds.

```text
Test Files  7 passed (7)
Tests       292 passed | 5 skipped (297)
Duration    218.77s (transform 12.10s, setup 489ms, collect 24.95s, tests 196.52s, environment 18.96s, prepare 26.23s)
```

The controller also reported a pre-task full-suite run of 68 passing test files,
653 passing tests, and 5 skipped tests. That result is contextual evidence, not
re-measured by this task.

### Production build

Command:

```text
npm run build
```

Result: exit 0 after 71.5 seconds; Vite reported `✓ built in 53.24s`.

```text
dist/index.html                   0.76 kB
dist/assets/index-CvqeDN9e.css  115.24 kB
dist/assets/index-CQyRH5zR.js    60.64 kB
dist/assets/index-DRsX9xxo.js   990.04 kB

(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
```

The 990.04 kB application chunk warning is part of the pre-change baseline; it
was not fixed in this documentation-only task.

### Deno Edge Function checks

Each command exited 0:

```text
npx deno check --no-lock supabase\functions\generate-music-summary\index.ts
Check supabase/functions/generate-music-summary/index.ts

npx deno check --no-lock supabase\functions\generate-todays-brief\index.ts
Check supabase/functions/generate-todays-brief/index.ts

npx deno check --no-lock supabase\functions\mission-genesis\index.ts
Check supabase/functions/mission-genesis/index.ts

npx deno check --no-lock supabase\functions\paid-workspace-setup\index.ts
Check supabase/functions/paid-workspace-setup/index.ts
```

Observed wall times were 45.1s, 46.9s, 46.1s, and 42.2s respectively.

## Baseline interpretation

- The focused regression surface, production build, and requested Deno checks
  are green before implementation.
- The build already emits one large-chunk warning; later work must not present
  that warning as a new regression.
- The deployed Edge Function inventory is captured, but linked migration drift
  remains unmeasured until the linked-checkout protocol is run.
- Cost and production-network values remain explicitly unknown. No rollout
  should claim an egress/compute reduction until the deferred measurements are
  collected using the protocols above.
