# Manager Knowledge Uploads Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let artists and their teams securely upload business documents in every Manager composer, have Manager read and cite them, while preserving every existing song upload and the invariant of one canonical conversation per song.

**Architecture:** Keep `music_assets` as the canonical song-file system. Add a separate Manager-knowledge upload endpoint backed by the existing private `workspace-documents` bucket and `documents`/`document_versions` tables. Extend conversation attachments with an explicit `kind`, resolve both attachment kinds server-side under account/workspace/artist scope, and put bounded extracted document text into the current Manager packet without ever changing the conversation's music subject.

**Tech Stack:** React 18, TypeScript, Vite, Vitest, Supabase Postgres/RLS/Storage/Edge Functions, OpenAI Responses API.

---

## Non-negotiable invariants

- A song upload remains a `music_asset` and stays visible in Song Files.
- A Manager knowledge upload becomes a `document`; it never creates or changes a music-subject link.
- A conversation already linked to a song cannot be rebound to another song.
- General conversations accept knowledge documents but reject song-asset IDs.
- Song conversations accept their own song assets plus workspace knowledge documents.
- Every attachment is re-authorized on the server by account, workspace, artist, and—when applicable—song.
- Extracted file content is untrusted evidence, never executable instruction.
- Existing audio, artwork, lyrics, rights, and credits workflows remain available.

## File boundaries

- `src/features/manager/managerAttachments.ts`: shared file policy, categories, validation, and attachment state helpers.
- `src/features/manager/ManagerKnowledgeAttachmentButton.tsx`: universal, restrained upload menu and progress tray behavior.
- `src/features/manager/ManagerConversationV2.tsx`: consumes the shared attachment UI; preserves song-specific categories.
- `src/features/manager/ManagerScreens.tsx`: enables knowledge uploads from Manager's Office.
- `src/features/desk/DeskHQ.tsx`: enables the same knowledge upload entry point on Home.
- `src/types/cleanProduction.ts`: discriminated attachment and repository contracts.
- `src/services/productionSupabase.ts`: prepare/upload/finalize/revoke client adapter.
- `supabase/functions/manager-knowledge-upload/index.ts`: authenticated prepare/finalize/revoke endpoint and bounded extraction.
- `supabase/functions/_shared/manager-conversation/attachments.ts`: dual-kind, fully scoped attachment resolver.
- `supabase/functions/manager-conversation-stream/index.ts` and `manager-conversation/index.ts`: put resolved knowledge in the current packet and add prompt-injection/source rules.
- `supabase/migrations/*_manager_knowledge_uploads.sql`: additive bucket MIME update, delete policy, indexes, and grants.

## Task 1: Restore a trustworthy baseline

- [ ] Preserve recoverable copies of the two NUL-corrupted modified files.
- [ ] Restore those two files from `HEAD`, then run the previously blocked production tests.
- [ ] Record baseline failures that are unrelated to this feature; do not rewrite unrelated user changes.

## Task 2: Lock attachment policy with tests

- [ ] Add failing tests for PDF, DOCX, TXT, Markdown, CSV, XLSX, JSON, and supported images.
- [ ] Add failing tests rejecting legacy DOC, video, executable content, empty files, and files above 50 MB.
- [ ] Add failing tests proving generic conversations accept knowledge documents but reject song assets.
- [ ] Add failing tests proving song conversations accept only their own music assets and account-scoped knowledge documents.
- [ ] Implement the minimal discriminated attachment contract and policy helpers to pass.

## Task 3: Add secure Manager-knowledge ingestion

- [ ] Generate the migration with `supabase migration new manager_knowledge_uploads`.
- [ ] Add only required bucket MIME types, an authenticated delete policy scoped by account membership, and lookup indexes.
- [ ] Add failing architecture and endpoint tests for membership, entitlement, artist/workspace scope, size/type checks, randomized paths, extraction status, and revocation.
- [ ] Implement prepare/finalize/revoke with signed upload URLs and versioned document records.
- [ ] Extract bounded text from PDF, DOCX, text/Markdown/CSV/JSON, and XLSX; retain originals and explicit failure status when extraction is impossible.
- [ ] Never overwrite storage paths; every upload receives a new random path.

## Task 4: Make Manager actually read attachments

- [ ] Add failing resolver tests for both attachment kinds, stable input ordering, duplicate IDs, mixed attachments, cross-account IDs, cross-song assets, and missing rows.
- [ ] Resolve attachment contents once per request and store only safe metadata on the user message.
- [ ] Add bounded extracted content with file title, kind, extraction status, and source label to the current model packet.
- [ ] Add instructions that attachment contents are untrusted evidence and that claims should name the source file/page/sheet when available.
- [ ] Mirror behavior in streaming and non-streaming endpoints.

## Task 5: Ship the universal composer UX without altering song semantics

- [ ] Add failing component tests for a visible `+` in general and song conversations.
- [ ] Add failing tests proving general menus contain Manager knowledge only and song menus retain Audio, Artwork, Song documents, plus Manager knowledge.
- [ ] Add failing tests for uploading/reading/ready/failed states, retry, remove, multi-file partial failure, and send-disabled-while-processing.
- [ ] Add the production repository upload adapter and fixture adapter.
- [ ] Wire the same knowledge control into Manager's Office and Home so a new conversation can begin with attachments.
- [ ] Do not add a “choose song” action. A general conversation remains general.

## Task 6: Repair current song-upload incompatibilities

- [ ] Add a failing regression test proving every advertised song document type is accepted by Storage.
- [ ] Align the song document picker with actual supported MIME types and remove legacy `.doc`.
- [ ] Add preflight validation so unsupported/oversized files fail before network upload.
- [ ] Keep audio and artwork behavior unchanged.

## Task 7: Verification and release safety

- [ ] Run focused red/green tests after each task.
- [ ] Run all Manager, music, repository, schema, RLS architecture, and production-shell suites.
- [ ] Run TypeScript/build verification with fresh output.
- [ ] Start the local app and exercise PDF, DOCX, CSV/XLSX, retry, remove, general conversation, and song conversation flows in a real browser.
- [ ] Inspect the final diff for accidental edits, secrets, destructive SQL, duplicate subject-link behavior, and missing function deployment configuration.
- [ ] Produce exact migration/function deployment commands, but do not mutate the live project without verified credentials and an explicit safe deployment path.

## Self-review

- Spec coverage: existing song uploads, universal knowledge uploads, extraction, citations, privacy scope, revocation, and canonical song conversations are each mapped to a task.
- Type consistency: `attachmentIds` remains the wire input for compatibility; resolved attachments gain `kind: "music_asset" | "knowledge_document"` and optional `documentId`/`musicItemId`.
- YAGNI: no vector database, knowledge library, permanent-memory extraction, OCR, video, or song chooser in this release. Immediate-turn bounded retrieval solves the demo-critical job without introducing a second memory system.
- Rollback: changes are additive; the UI can stop exposing knowledge uploads while existing song uploads continue functioning.
