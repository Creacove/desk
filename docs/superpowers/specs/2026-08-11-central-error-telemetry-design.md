# Central Error Telemetry Design

## Purpose

Create one database table that contains the complete useful diagnostic record for application failures. This table is the operational interface for Codex investigations: when asked what failed, Codex queries it directly, identifies the affected account and code path, and proceeds to the relevant fix without reconstructing evidence across unrelated tables and transient browser state.

This release does not build an admin page, dashboard, action register, scheduled review, or email notification system. Those can be added later against the same table without changing the capture architecture.

## Scope

Record failures from every application boundary:

- browser and frontend service calls;
- paid and private-beta setup;
- Manager conversation and streaming routes;
- Manager discovery and Today's Brief;
- mission creation and task review;
- Spotify, Chartmetric, catalog import, and music reads;
- checkout, billing status, and payment webhooks;
- uploads, audio analysis, split confirmation, public sharing, and email delivery;
- recovery jobs, queues, and scheduled workers;
- failure-bookkeeping operations themselves.

Expected validation, authentication, authorization, not-found, user cancellation, and successful fallback responses are not application errors unless they expose an invariant, configuration, security, or availability problem. Every unexpected 5xx, provider/database failure, terminal workflow failure, and failed persistence attempt is recorded.

## Existing-table reuse decision

The schema and linked production database were audited before choosing a table. There is no existing application-wide error table. Error information is currently split across workflow-specific columns in `workspace_setup_runs`, `manager_synthesis_runs`, `manager_run_actions`, `agent_runs`, `source_sync_jobs`, `ai_run_usage_events`, billing records, email records, and upload metadata.

`operating_events` is the existing table most likely to be mistaken for a central error log. It must not be repurposed for internal diagnostics:

- it is the customer-facing workspace activity and live-sync event bus;
- authenticated account members have read and insert access to it;
- the browser subscribes to every new workspace event and uses the stream to refresh application state;
- `account_id`, `artist_workspace_id`, and `artist_id` are mandatory, so it cannot record signup, authentication, checkout, configuration, or early-setup failures that occur before those records exist;
- its shared writer deliberately removes internal request/response bodies and limits product-event payloads, which is the opposite of the diagnostic fidelity required here.

The linked production table currently contains approximately 5,333 product events and occupies about 5.2 MB. Adding stack traces, provider failures, and internal context to this customer-visible stream would create an access-control problem and would also distort the application's activity semantics.

`ai_run_usage_events` is also not reusable as the central table because it requires an AI workflow, run type, operation, account, workspace, and artist. It cannot represent browser, authentication, billing, storage, database, email, or pre-workspace failures.

Therefore the minimal safe design is one focused service-role-only error table. This is not a parallel workflow system: existing domain error/status columns remain authoritative, and the new row links to them. The implementation reuses the existing request-ID utility, account/workspace identifiers, run IDs, operating-event IDs, provider parsers, and error fields rather than creating duplicate identity, workflow, or activity tables.

## One-table data model

Add one service-role-only table named `app_error_events`. It is the only new application table in this design.

### Identity and time

- `id uuid primary key default gen_random_uuid()`;
- `occurred_at timestamptz not null default now()`;
- `environment text not null`;
- `release_version text`;
- `severity text not null` with `warning`, `error`, or `critical`;
- `status text not null default 'open'` with `open`, `investigating`, or `resolved`;
- `resolved_at timestamptz`, `resolution_note text`, and `fixed_release text`.

### Exact code location

- `source text not null`: `client`, `edge`, `worker`, `database`, or `provider`;
- `function_name text`;
- `operation text not null`;
- `route text`;
- `error_class text`;
- `error_code text`;
- `fingerprint text not null`.

### Full useful diagnostics

- `error_message text not null`: the real internal error message, not the generic customer-facing projection;
- `error_details jsonb not null default '{}'::jsonb`: structured Supabase/provider fields, nested causes, response error object, retry metadata, and bookkeeping diagnostics;
- `stack_trace text`;
- `public_message text`: the separate safe message returned to the customer;
- `context jsonb not null default '{}'::jsonb`: bounded operational state needed to reproduce the failure.

The logger preserves Supabase `code`, `message`, `details`, `hint`, and status; OpenAI `error.type`, `error.code`, `error.param`, provider message, HTTP status, and `x-request-id`; Spotify retry timing; Chartmetric phase/status/rate-limit information; storage and fetch error causes; and nested JavaScript `cause` chains.

### Account and workspace identity

- `user_id uuid`;
- `account_email text`;
- `account_id uuid`;
- `artist_workspace_id uuid`;
- `artist_id uuid`.

For authenticated requests, the Edge boundary passes the authenticated user ID and email. For background work with an account ID but no request user, the capture helper resolves the active account owner/admin-support user through `account_memberships` and `users` and stores the email snapshot. If no account can be resolved, the identifiers remain null rather than inventing ownership.

### Request and provider correlation

- `trace_id uuid`;
- `request_id uuid`;
- `parent_error_event_id uuid`;
- `provider text`;
- `provider_request_id text`;
- `http_status integer`;
- `provider_status integer`;
- `latency_ms integer`.

Every inbound application request accepts a valid `x-request-id` or creates one, returns it in the response, forwards it to child Edge/provider requests, and stores it in the error row. The browser keeps one trace ID through a user operation, including setup polling and retries.

### Workflow correlation

- `setup_run_id uuid`;
- `manager_run_id uuid`;
- `source_sync_job_id uuid`;
- `usage_event_id uuid`;
- `billing_event_id uuid`;
- `operating_event_id uuid`;
- `conversation_id uuid`;
- `mission_id uuid`;
- `task_id uuid`;
- `music_item_id uuid`;
- `music_project_id uuid`;
- `stage text`;
- `attempt integer`.

These columns let Codex move directly from an error row to the precise operational record without broad database research.

## Diagnostic fidelity and credential scrubbing

The implementation stores the real diagnostic. It does not replace it with generic wording or remove useful provider/database information.

Before persistence, it removes only credential and high-risk payload material:

- authorization/cookie headers, passwords, API keys, access/refresh tokens, beta codes, and checkout correlation tokens;
- card/payment credentials and raw webhook payloads;
- signed storage URLs and raw uploaded file contents;
- complete prompts, lyrics, and private document bodies.

Account email is intentionally retained because it is required for diagnosis and has been explicitly authorized. Provider error messages, codes, details, hints, request IDs, stack frames, function names, and safe response-error objects are retained.

To protect the free database from pathological payloads without destroying normal errors, limits are generous and explicit:

- `error_message`: 8 KB;
- `stack_trace`: 32 KB;
- `error_details`: 32 KB serialized;
- `context`: 16 KB serialized.

When a value exceeds a limit, the row records the original byte length and the fact that truncation occurred.

## Capture contract

Add one shared `captureAppError()` helper used by Edge Functions and workers. It:

1. normalizes unknown JavaScript and Supabase errors;
2. extracts nested/provider fields before credential scrubbing;
3. enriches account email and workflow correlation when the database is available;
4. inserts one `app_error_events` row and checks the returned `{ error }`;
5. emits the same structured diagnostic to `console.error`;
6. never throws or masks the original failure;
7. returns the event ID and a customer-safe projection containing a short support reference.

Add one narrowly validated authenticated Edge endpoint for browser-only failures. It derives the user identity from the session, accepts fixed operation codes and bounded context, and does not accept arbitrary identity fields from the browser.

The frontend service wrapper preserves status, structured failure data, request ID, and central event reference instead of creating a new message-only `Error`. A global error boundary and `unhandledrejection` handler capture failures that occur outside normal service calls.

## Relationship to existing error fields

Existing workflow columns remain operational truth:

- `workspace_setup_runs.last_error` and `stage_status`;
- `manager_synthesis_runs.error`;
- `source_sync_jobs.error`;
- `ai_run_usage_events.failure_reason`;
- billing, email, upload, and worker status fields.

They continue to receive the correct operational update. The central row records the occurrence and links to them. Every update checks Supabase's returned `{ error }`; a failed bookkeeping write creates a separate `bookkeeping_failed` central event.

`operating_events` remains the product activity/live-sync stream. When a failure is part of an existing workflow event, `app_error_events.operating_event_id` links to it; otherwise it stays null. Internal error payloads are never copied into the customer-visible event.

The implementation must also:

- change both Manager conversation failure writers from nonexistent `ai_run_usage_events.error` to `failure_reason`;
- remove the temporary discovery `rawError` customer response;
- stop overwriting useful catalog/setup errors with generic messages;
- capture OpenAI request IDs on failure;
- preserve setup and recovery failure chronology instead of relying on one mutable `last_error`.

## Database-unavailable limitation

No table inside the same Postgres database can accept a row while that database is unavailable. In that specific condition, `captureAppError()` emits the complete credential-scrubbed structured event to Supabase runtime logs using the same request/trace ID. If a browser request receives the failure, the frontend retains the bounded event temporarily and retries central persistence after connectivity returns.

Background failures that occur during a total database outage remain in structured runtime logs and cannot be truthfully guaranteed to exist in the table until an external logging system is introduced. This limitation is explicit rather than hidden behind a false success claim.

## Access and retention

- RLS is enabled with no anonymous or authenticated table policies.
- Only the service role can insert, read, update, or delete rows.
- Codex queries the linked production database directly when asked for an error review.
- Normal errors expire after 30 days; critical errors expire after 90 days.
- One daily bounded cleanup removes expired rows.
- Resolved status and resolution notes live on the same row; no second action or incident table is introduced.

## Testing and acceptance

- Schema tests verify the one-table contract, indexes, RLS, service-role grants, and retention fields.
- Unit tests verify exact provider/Supabase extraction, nested causes, account email enrichment, credential scrubbing, size limits, and fingerprints.
- Failure-in-failure tests prove a logging insert failure does not mask the original error and still emits the structured console event.
- Contract tests require every Edge entrypoint, worker, and the frontend service boundary to use central capture.
- End-to-end tests generate controlled failures in setup, Manager conversation, mission creation, billing/provider handling, and a worker and confirm that all appear in `app_error_events` with the correct email, function, operation, real diagnostic, trace, and workflow reference.
- Production acceptance queries the central table directly and traces each controlled error to its precise code path and operational row without consulting unrelated tables.

## Explicit non-goals

- No admin or production-health page.
- No email alerting or scheduled review task.
- No `ops_action_items` or separate incident table.
- No PostHog/Sentry error mirror in this release.
- No storage of successful requests.
