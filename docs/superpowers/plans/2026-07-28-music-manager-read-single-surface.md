# Music Manager Read Single-Surface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve the successful Antigravity Manager Read quality while replacing its over-structured visible contract with one evidence-led prose read, exact backend-owned metrics, safe errors, and truthful non-blocking setup tracking.

**Architecture:** Keep the existing durable `music_manager_read_v2` run, Chartmetric-before-OpenAI workflow, bounded one-repair Responses API path, atomic activation RPC, and Music polling states. Split the OpenAI generation contract from the persisted UI contract: OpenAI writes `position`, `managementRole`, `body`, and selects supplied evidence IDs; backend code expands selected metric IDs into exact canonical metrics before persistence. Convert existing current v2 outputs transactionally, then make setup finalization capture exact run IDs and wait only for their terminal database states without blocking workspace entry.

**Tech Stack:** React 18, TypeScript, Vitest/jsdom, Supabase Edge Functions/Deno, PostgreSQL migrations/RPC, OpenAI Responses API Structured Outputs.

---

## File Map

- Create `supabase/functions/_shared/musicManagerReadEvidence.ts`: safe evidence projection, metric-candidate construction, deterministic labels/values, and selected-metric resolution.
- Create `supabase/functions/_shared/musicManagerReadErrors.ts`: typed internal failures and stable persisted/public error mappings.
- Modify `supabase/functions/_shared/openaiMusicManagerRead.ts`: lean model output schema, preserved/improved Antigravity prompt, semantic validation, and persisted read types.
- Modify `supabase/functions/generate-music-summary/index.ts`: load safe evidence fields, build candidates, resolve exact metrics, persist the final contract, and sanitize errors.
- Create `supabase/migrations/20260728000100_music_manager_read_single_surface.sql`: idempotent conversion of transitional v2 output JSON and obsolete projections.
- Modify `supabase/functions/generate-todays-brief/index.ts`: capture returned run IDs, poll exact scoped rows to terminal status, and persist truthful setup results.
- Modify `supabase/functions/paid-workspace-setup/index.ts`: merge setup stage state without overwriting a terminal music-read result.
- Modify `src/types/cleanProduction.ts`: final visible read and metric types.
- Modify `src/services/productionSupabase.ts`: strict final-v2 parser with no transitional adapter.
- Modify `src/features/music/MusicScreens.tsx`: render exact metrics and prose without client rewriting.
- Modify `src/openai-music-summary-function.test.ts`: model contract, prompt-quality, metric, persistence, and safe-error coverage.
- Create `src/music-manager-read-evidence.test.ts`: deterministic evidence projection and metric formatting tests.
- Create `src/music-manager-read-errors.test.ts`: safe failure-code and message tests.
- Modify `src/music-manager-read-v2-schema.test.ts`: migration conversion and idempotency contract.
- Modify `src/openai-todays-brief-function.test.ts` and `src/paid-workspace-setup-function.test.ts`: setup run-ID and terminal-state regression coverage.
- Modify `src/production-supabase-service.test.ts` and `src/production-app-shell.test.tsx`: strict loader and single-surface UI coverage.

## Task 1: Define the Lean Model Contract and Preserve Prompt Quality

**Files:**
- Modify: `supabase/functions/_shared/openaiMusicManagerRead.ts`
- Modify: `src/openai-music-summary-function.test.ts`

- [ ] **Step 1: Write failing contract tests**

Replace the fixture type and assertions so the model output contains exactly:

```ts
const validOutput: MusicManagerReadModelOutput = {
  position: "Jam is the clearest lead-attention record in the current release picture.",
  managementRole: "Lead attention asset",
  body,
  metricEvidenceIds: ["ev-streams", "ev-tiktok", "ev-market"],
  evidenceIds: ["ev-streams", "ev-tiktok", "ev-market"],
};
```

Add assertions that:

```ts
expect(Object.keys(musicManagerReadJsonSchema.schema.properties)).toEqual([
  "position", "managementRole", "body", "metricEvidenceIds", "evidenceIds",
]);
expect(prompt).toContain("experienced A&R and music business operator");
expect(prompt).toContain("skeptical of vanity metrics");
expect(prompt).toContain("Let the data dictate");
expect(prompt).toContain("current stage and current goal");
expect(prompt).toContain("Interpret direction, not just scale");
expect(prompt).toContain("concrete move");
expect(prompt).toContain("wrong move");
expect(prompt).toContain("condition that would change");
expect(prompt).not.toMatch(/confidenceReason|signal meaning|Return the full music_manager_read_v2 schema/);
```

Add separate song/project assertions proving project prompts contain `project`, `release`, and `tracklist` language and do not contain `this song`, while song prompts do not instruct release-level reasoning.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
npm test -- src/openai-music-summary-function.test.ts --reporter=dot
```

Expected: failures show the old decision/avoid/watch/confidence/signals keys and song-specific project prompt.

- [ ] **Step 3: Implement the minimal contract and prompt revision**

Define:

```ts
export type MusicManagerReadModelOutput = {
  position: string;
  managementRole: string;
  body: string;
  metricEvidenceIds: string[];
  evidenceIds: string[];
};

export type MusicManagerReadV2 = {
  position: string;
  managementRole: string;
  body: string;
  metrics: Array<{ label: string; value: string; evidenceId: string }>;
  evidenceIds: string[];
};
```

Use shared constants for schema and semantic limits:

```ts
export const MUSIC_MANAGER_READ_LIMITS = {
  positionChars: 220,
  managementRoleChars: 160,
  bodyChars: 2400,
  bodyMinWords: 140,
  bodyMaxWords: 280,
  metricMinItems: 1,
  metricMaxItems: 5,
  evidenceMaxItems: 24,
} as const;
```

Retain the Antigravity persona, anti-template, stage/goal, trajectory, asset-role, and exact-evidence language. Parameterize `subjectNoun`, `subjectPhrase`, and project-only tracklist guidance. Replace field-specific decision/avoid/watch instructions with one body instruction:

```ts
`In ${subjectPhrase}'s Manager's Read, naturally weave together the current judgment, the concrete next move, the attractive but wrong move, and the observable condition that would materially change the judgment. Do not label these as separate sections.`
```

Replace model-written signal instructions with selection instructions for supplied `metricCandidates` IDs. Keep one initial generation plus one repair.

- [ ] **Step 4: Verify GREEN**

Run the focused test again. Expected: all contract and prompt assertions pass.

- [ ] **Step 5: Commit**

```powershell
git add -- supabase/functions/_shared/openaiMusicManagerRead.ts src/openai-music-summary-function.test.ts
git commit -m "refactor: simplify music manager read model contract"
```

## Task 2: Build Safe Evidence and Exact Metric Candidates

**Files:**
- Create: `supabase/functions/_shared/musicManagerReadEvidence.ts`
- Create: `src/music-manager-read-evidence.test.ts`

- [ ] **Step 1: Write failing evidence tests**

Cover representative rows:

```ts
const rows = [
  evidence("streams", "spotify_trailing_7d_streams", 1_234_567, "streams", "trailing 7d"),
  evidence("rank", "chartmetric_country_rank_nigeria", 14, "rank", "current"),
  evidence("trend", "spotify_stream_trend_growing", 24.5, "percent_change", "trailing 28d"),
  evidence("tiktok", "tiktok_video_creates_total", 18_400, "video_creates", "lifetime"),
];

expect(projectMusicManagerReadEvidence(rows).metricCandidates).toEqual([
  expect.objectContaining({ id: "streams", label: "Spotify streams (7d)", value: "1.23M" }),
  expect.objectContaining({ id: "rank", label: "Nigeria rank", value: "#14" }),
  expect.objectContaining({ id: "trend", label: "Spotify stream trend (28d)", value: "+24.5%" }),
  expect.objectContaining({ id: "tiktok", label: "TikTok video creates", value: "18.4K" }),
]);
```

Assert safe reasoning evidence retains normalized `metricUnit`, `freshness`, and a bounded `limitationState`, but excludes `source`, `source_kind`, `provenance`, `raw_ref`, raw limitation text, and provider error text. Assert unsupported text/identifier metrics are not visible candidates.

Assert `resolveSelectedManagerReadMetrics` preserves model order, rejects unknown IDs, removes duplicates only through validation rather than silently, and never accepts a candidate not present in the exact subject/context set.

- [ ] **Step 2: Run and verify RED**

```powershell
npm test -- src/music-manager-read-evidence.test.ts --reporter=dot
```

Expected: module-not-found failure for the new shared evidence module.

- [ ] **Step 3: Implement deterministic projection**

Export:

```ts
export type MusicManagerMetricCandidate = {
  id: string;
  label: string;
  value: string;
  subjectId: string;
  subjectLabel: string;
  timeframe?: string;
};

export function projectMusicManagerReadEvidence(rows: Array<Record<string, unknown>>): {
  reasoningEvidence: Array<Record<string, unknown>>;
  metricCandidates: MusicManagerMetricCandidate[];
};

export function resolveSelectedManagerReadMetrics(
  selectedIds: string[],
  candidates: MusicManagerMetricCandidate[],
): MusicManagerReadV2["metrics"];
```

Implement a bounded metric-name dictionary plus safe fallbacks, compact number formatting, rank and percentage handling, and normalized freshness/limitation enums. Do not pass raw diagnostic strings through the projection.

- [ ] **Step 4: Verify GREEN**

Run the evidence test and the existing Chartmetric evidence suite:

```powershell
npm test -- src/music-manager-read-evidence.test.ts src/chartmetric-evidence.test.ts --reporter=dot
```

- [ ] **Step 5: Commit**

```powershell
git add -- supabase/functions/_shared/musicManagerReadEvidence.ts src/music-manager-read-evidence.test.ts
git commit -m "feat: add exact manager read metric projection"
```

## Task 3: Integrate the Final Read Contract and Safe Errors

**Files:**
- Create: `supabase/functions/_shared/musicManagerReadErrors.ts`
- Create: `src/music-manager-read-errors.test.ts`
- Modify: `supabase/functions/generate-music-summary/index.ts`
- Modify: `src/openai-music-summary-function.test.ts`

- [ ] **Step 1: Write failing integration assertions**

Require `loadEvidence` and `loadRelatedEvidence` to select `metric_unit`, `freshness`, and `limitation`; require `projectMusicManagerReadEvidence`; require model context to contain `reasoningEvidence` and `metricCandidates`; and require staging to persist:

```ts
primary_recommendation_json: { managerRead: output.body },
avoid_json: [],
confidence_json: {},
supporting_evidence_json: output.evidenceIds.map((id) => ({ id })),
render_json: output,
```

Add negative assertions for `output.decision`, `output.avoid`, `output.watch`, `output.confidence`, `confidenceReason`, and raw OpenAI response bodies in thrown/persisted errors.

In `src/music-manager-read-errors.test.ts`, add pure safe-error assertions for stable codes/messages:

```ts
expect(publicManagerReadFailure("openai_http", 429)).toEqual({
  code: "manager_read_temporarily_unavailable",
  message: "Manager Read is temporarily unavailable. Try again shortly.",
});
```

- [ ] **Step 2: Run and verify RED**

```powershell
npm test -- src/openai-music-summary-function.test.ts src/music-manager-read-errors.test.ts --reporter=dot
```

- [ ] **Step 3: Implement context, resolution, persistence, and safe failures**

Extend `ManagerReadContext` with `metricCandidates` and `allowedMetricEvidenceIds`. After model validation, resolve selected IDs into exact metrics and pass the final `MusicManagerReadV2` to staging.

Create a typed internal error with a safe public projection, then replace:

```ts
const body = (await response.text()).slice(0, 500);
throw new Error(`OpenAI Music Manager Read request failed (${response.status}): ${body}`);
```

with bounded internal logging and a typed internal failure whose persisted/public mapping is stable. Keep provider status/response ID only in restricted log metadata. Ensure endpoint catches never return arbitrary `describeError` output for internal/config/database failures.

- [ ] **Step 4: Verify GREEN and Deno-check**

```powershell
npm test -- src/openai-music-summary-function.test.ts src/music-manager-read-evidence.test.ts src/music-manager-read-errors.test.ts src/music-manager-read-v2-workflow.test.ts --reporter=dot
npx deno check --no-lock supabase/functions/generate-music-summary/index.ts
```

- [ ] **Step 5: Commit**

```powershell
git add -- supabase/functions/_shared/musicManagerReadErrors.ts supabase/functions/generate-music-summary/index.ts src/music-manager-read-errors.test.ts src/openai-music-summary-function.test.ts
git commit -m "fix: persist exact single-surface manager reads"
```

## Task 4: Convert Existing Current Reads Transactionally

**Files:**
- Create: `supabase/migrations/20260728000100_music_manager_read_single_surface.sql`
- Modify: `src/music-manager-read-v2-schema.test.ts`

- [ ] **Step 1: Write failing migration contract tests**

Assert the migration:

```ts
expect(sql).toContain("jsonb_array_elements");
expect(sql).toContain("with ordinality");
expect(sql).toContain("jsonb_build_object('label'");
expect(sql).toContain("'managerRead', render_json->>'body'");
expect(sql).toContain("avoid_json = '[]'::jsonb");
expect(sql).toContain("confidence_json = '{}'::jsonb");
expect(sql).toMatch(/where schema_version = 'music-manager-read-v2'/i);
expect(sql).toMatch(/render_json \? 'signals'/i);
expect(sql).toMatch(/render_json \? 'decision'/i);
```

Require identity, lineage, current state, and timestamps to remain absent from the `SET` clause. Require a second-run guard (`render_json ? 'signals'`) for idempotency.

- [ ] **Step 2: Run and verify RED**

```powershell
npm test -- src/music-manager-read-v2-schema.test.ts --reporter=dot
```

- [ ] **Step 3: Write the additive conversion migration**

Use one scoped `UPDATE public.manager_outputs` that:

```sql
set render_json = jsonb_build_object(
      'position', render_json->'position',
      'managementRole', render_json->'managementRole',
      'body', render_json->'body',
      'metrics', coalesce(converted.metrics, '[]'::jsonb),
      'evidenceIds', render_json->'evidenceIds'
    ),
    primary_recommendation_json = jsonb_build_object('managerRead', render_json->>'body'),
    avoid_json = '[]'::jsonb,
    confidence_json = '{}'::jsonb
```

Build `converted.metrics` from old signals in original order, using label, value, and the first non-empty evidence ID. Rebuild supporting evidence from root IDs. Scope only exact transitional v2 rows and preserve all identity/state columns.

- [ ] **Step 4: Verify GREEN and migration ordering**

```powershell
npm test -- src/music-manager-read-v2-schema.test.ts src/schema-manager-intelligence.test.ts --reporter=dot
npx supabase migration list --linked
```

Do not push the migration remotely in this task.

- [ ] **Step 5: Commit**

```powershell
git add -- supabase/migrations/20260728000100_music_manager_read_single_surface.sql src/music-manager-read-v2-schema.test.ts
git commit -m "migrate: simplify current music manager reads"
```

## Task 5: Make Setup Music-Read Completion Truthful

**Files:**
- Modify: `supabase/functions/generate-todays-brief/index.ts`
- Modify: `supabase/functions/paid-workspace-setup/index.ts`
- Modify: `src/openai-todays-brief-function.test.ts`
- Modify: `src/paid-workspace-setup-function.test.ts`

- [ ] **Step 1: Write failing setup lifecycle tests**

Replace dispatch-only assertions with assertions requiring:

```ts
expect(briefSource).toContain("readSetupMusicManagerRunId");
expect(briefSource).toContain("waitForSetupMusicReadRuns");
expect(briefSource).toContain('.eq("account_id", input.accountId)');
expect(briefSource).toContain('.eq("artist_workspace_id", input.artistWorkspaceId)');
expect(briefSource).toContain('.eq("artist_id", input.artistId)');
expect(briefSource).toContain('.eq("classification", "music_manager_read_v2")');
expect(briefSource).toContain('.in("id", runIds)');
expect(briefSource).toContain('"completed_with_limits"');
```

Require the dispatch helper to parse `{status:"processing",runId}` and reject an HTTP 202 with a missing/invalid run ID. Require the finalizer to persist `run_id` per target, count terminal failures/timeouts, and never mark completed from HTTP fulfillment alone.

For paid setup, require a merge helper that preserves existing `music_reads.status` when it is already `completed` or `completed_with_limits`.

- [ ] **Step 2: Run and verify RED**

```powershell
npm test -- src/openai-todays-brief-function.test.ts src/paid-workspace-setup-function.test.ts --reporter=dot
```

- [ ] **Step 3: Implement exact run tracking and bounded terminal polling**

Make dispatch return:

```ts
type SetupMusicReadDispatch = {
  target: SetupMusicReadTarget;
  runId: string;
};
```

Parse response JSON and require `status === "processing"` plus a non-empty run ID. Persist dispatched run IDs in `stage_status.music_reads.targets` before waiting.

Poll only exact run IDs with all ownership and classification filters. Use a two-second interval and a bounded three-minute deadline. Terminal statuses are `completed`, `completed_with_limits`, `failed`, and `cancelled`. Mark all-success `completed`; any dispatch failure, run failure, missing scoped run, or timeout becomes `completed_with_limits` with safe per-target failure codes. Never change the parent setup access status.

In `paid-workspace-setup`, read the latest stage immediately before its completion update and merge `music_reads`; do not replace a terminal value with `running`.

- [ ] **Step 4: Verify GREEN and Deno-check**

```powershell
npm test -- src/openai-todays-brief-function.test.ts src/paid-workspace-setup-function.test.ts src/production-app-shell.test.tsx --reporter=dot
npx deno check --no-lock supabase/functions/generate-todays-brief/index.ts supabase/functions/paid-workspace-setup/index.ts
```

- [ ] **Step 5: Commit**

```powershell
git add -- supabase/functions/generate-todays-brief/index.ts supabase/functions/paid-workspace-setup/index.ts src/openai-todays-brief-function.test.ts src/paid-workspace-setup-function.test.ts
git commit -m "fix: track setup manager reads to terminal state"
```

## Task 6: Load and Render Only the Single Manager's Read

**Files:**
- Modify: `src/types/cleanProduction.ts`
- Modify: `src/services/productionSupabase.ts`
- Modify: `src/features/music/MusicScreens.tsx`
- Modify: `src/production-supabase-service.test.ts`
- Modify: `src/production-app-shell.test.tsx`

- [ ] **Step 1: Write failing loader and UI tests**

Change fixtures to:

```ts
const musicManagerReadV2 = {
  position: "Jam is the clearest lead-attention record.",
  managementRole: "Lead attention asset",
  body,
  metrics: [
    { label: "Spotify streams (7d)", value: "1.23M", evidenceId: "ev-streams" },
    { label: "TikTok video creates", value: "18.4K", evidenceId: "ev-tiktok" },
    { label: "Nigeria rank", value: "#14", evidenceId: "ev-market" },
  ],
  evidenceIds: ["ev-streams", "ev-tiktok", "ev-market"],
};
```

Assert song and project rooms show position, role, exact metric labels/values, and complete body. Assert they do not show separate `Decision`, `Avoid`, `Watch`, `Confidence`, or signal-meaning text. Add a fixture value containing punctuation and a role whose final word could previously trigger the cleanup regex; assert the structurally valid persisted strings render unchanged. Semantic metric validation remains a pre-persistence backend responsibility.

- [ ] **Step 2: Run and verify RED**

```powershell
npm test -- src/production-supabase-service.test.ts src/production-app-shell.test.tsx --reporter=dot
```

- [ ] **Step 3: Implement strict final-v2 loading and rendering**

Change `MusicManagerReadViewModel` to `position`, `managementRole`, `body`, `metrics`, and internal `evidenceIds`. Update `parseMusicManagerReadViewModel` to require only those exact keys and each metric's exact `label`, `value`, and `evidenceId` keys.

Delete `formatCleanManagementRole` and `formatCleanSignalValue`. Render `read.metrics` in the existing compact strip and render `read.body` below it. Do not add cards, headings, or separate judgment sections.

- [ ] **Step 4: Verify GREEN**

```powershell
npm test -- src/production-supabase-service.test.ts src/production-app-shell.test.tsx --reporter=dot
```

- [ ] **Step 5: Commit**

```powershell
git add -- src/types/cleanProduction.ts src/services/productionSupabase.ts src/features/music/MusicScreens.tsx src/production-supabase-service.test.ts src/production-app-shell.test.tsx
git commit -m "refactor: render one complete music manager read"
```

## Task 7: Remove Obsolete Runtime References and Verify the Whole Product

**Files:**
- Modify only files revealed by the scoped legacy scan, if any

- [ ] **Step 1: Scan for obsolete live contract references**

```powershell
rg -n "confidenceReason|read\.confidence|read\.decision|read\.avoid|read\.watch|read\.signals|output\.decision|output\.avoid|output\.watch|output\.confidence" src supabase/functions --glob '!**/*.md'
```

Expected: no Music Manager Read runtime references; unrelated Mission or Conversation decision/confidence fields remain untouched.

- [ ] **Step 2: Run focused verification**

```powershell
npm test -- src/openai-music-summary-function.test.ts src/music-manager-read-evidence.test.ts src/music-manager-read-errors.test.ts src/music-manager-read-v2-workflow.test.ts src/music-manager-read-v2-schema.test.ts src/openai-todays-brief-function.test.ts src/paid-workspace-setup-function.test.ts src/production-supabase-service.test.ts src/production-app-shell.test.tsx --reporter=dot
```

Expected: all targeted tests pass.

- [ ] **Step 3: Run full verification**

```powershell
npm test -- --reporter=dot
npm run build
npx deno check --no-lock supabase/functions/generate-music-summary/index.ts supabase/functions/generate-todays-brief/index.ts supabase/functions/paid-workspace-setup/index.ts
npx supabase db lint --linked --level error
git diff --check
git status --short
```

Expected: tests, build, Deno checks, and database lint exit 0; only the known Vite large-chunk warning may remain; worktree contains only intentional changes.

- [ ] **Step 4: Review requirement coverage**

Check each acceptance criterion in `docs/superpowers/specs/2026-07-28-music-manager-read-single-surface-design.md` against code and tests. Confirm no production deployment, migration push, or function deployment occurred.

- [ ] **Step 5: Request code review**

Invoke `superpowers:requesting-code-review` against the branch diff from `32e94fe` to `HEAD`. Address Critical and Important findings with new failing tests before implementation changes.

## Production Handoff

Do not deploy from this plan automatically. Present:

1. exact migration and Edge Function deployment order;
2. test/build/check evidence;
3. scoped production smoke queries for setup runs, manager synthesis runs, usage events, and current outputs;
4. rollback approach that preserves prior output lineage;
5. an explicit request for production deployment approval.
