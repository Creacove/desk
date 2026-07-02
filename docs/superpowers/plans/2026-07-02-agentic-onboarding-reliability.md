# Agentic Onboarding Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the reliability of the old onboarding enrichment path while keeping the new manager-agent discovery loop, then make gathered evidence visibly improve setup and brief outputs.

**Architecture:** The application owns deterministic ingestion contracts: identifier resolution, cache lookup, paid-call guards, snapshot persistence, evidence persistence, and failure visibility. The manager agent can choose focus assets and synthesize strategy, but it must call tools with stable contracts and briefs must be generated only from persisted, auditable evidence.

**Tech Stack:** Supabase Edge Functions, Deno, TypeScript, OpenAI Responses API tools, Vitest, Supabase JS.

---

### Task 1: Lock Discovery Tool Contracts

**Files:**
- Modify: `src/manager-artist-discovery-function.test.ts`
- Modify: `supabase/functions/_shared/manager-agent/discoveryTools.ts`
- Modify: `supabase/functions/manager-artist-discovery/index.ts`

- [ ] Add tests proving Chartmetric `get-ids` parsing accepts the old working shapes: `cm_track`, `cm_album`, `chartmetric_id`, `id`, and `chartmetric_ids[0]`.
- [ ] Add tests proving `musicItemId` and `musicProjectId` are valid standalone tool inputs because the tools resolve stored identifiers from `music_identifiers`.
- [ ] Add tests proving `write_strategic_memory` only exposes DB-valid memory scopes and defaults to `artist`.
- [ ] Implement the smallest discovery tool changes needed to satisfy those tests.
- [ ] Verify with `npm test -- src/manager-artist-discovery-function.test.ts`.

### Task 2: Make Tool Events Operationally Honest

**Files:**
- Modify: `src/manager-agent-loop.test.ts`
- Modify: `supabase/functions/_shared/manager-conversation/agentLoop.ts`
- Modify: `supabase/functions/manager-artist-discovery/index.ts`

- [ ] Add tests proving completed tool summaries include `status`, `evidenceCount`, `snapshotId`, `memoryId`, or `evidenceId` when present.
- [ ] Add tests proving non-`Error` thrown values surface their useful message instead of generic `Tool failed.`.
- [ ] Make manager discovery fail the run when local tools failed, so setup does not generate a confident brief after broken enrichment.
- [ ] Verify with `npm test -- src/manager-agent-loop.test.ts src/manager-artist-discovery-function.test.ts`.

### Task 3: Use Persisted Evidence in Brief Inputs

**Files:**
- Modify: `src/manager-intelligence-packet-builder.test.ts`
- Modify: `supabase/functions/_shared/manager-intelligence/packet/strategicIntelligencePacket.ts`
- Modify: `supabase/functions/_shared/manager-intelligence/brief/briefPacketProjection.ts`

- [ ] Add tests proving track score/popularity evidence becomes `trackScoreReads`.
- [ ] Add tests proving public web evidence becomes `managerEvidenceReads`.
- [ ] Implement the packet and projection changes without fake evidence IDs.
- [ ] Verify with `npm test -- src/manager-intelligence-packet-builder.test.ts`.

### Task 4: Tighten Brief Quality Gates

**Files:**
- Modify: `supabase/functions/_shared/openaiTodaysBrief.ts`
- Modify: `supabase/functions/_shared/openaiManagerRead.ts`
- Modify: `supabase/functions/generate-todays-brief/index.ts`
- Modify: `supabase/functions/generate-music-summary/index.ts`

- [ ] Update instructions so setup/daily/song/project outputs must lead with artist-specific facts from `managerEvidenceReads`, public context, and track/project KPIs.
- [ ] Remove fallback outputs that persist fabricated evidence IDs such as `working-catalog-scope` and `source-packet` as if they were real evidence.
- [ ] When there is insufficient evidence, persist an honest limited output instead of a generic confident brief.
- [ ] Verify with focused brief/music summary tests.

### Task 5: Verify and Deploy

**Files:**
- All modified edge functions and tests.

- [ ] Run focused Vitest suites for discovery, agent loop, packet builder, today's brief, music summary, bootstrap, and production Supabase service.
- [ ] Run Deno checks for modified edge functions.
- [ ] Run full `npm test`.
- [ ] Run `npm run build`.
- [ ] Deploy only after the local checks pass.
- [ ] Verify deployed functions with safe `OPTIONS` calls and do not rerun paid Chartmetric setup without explicit approval.
