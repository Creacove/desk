# Music Manager Read v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the legacy song/project Ask Manager path with one durable backend workflow that refreshes Chartmetric evidence when required, generates a conversation-quality Manager Read v2, survives page refreshes, and removes all unused v1 output fields.

**Architecture:** `generate-music-summary` becomes an idempotent backend coordinator. It creates or reuses a subject-scoped `manager_synthesis_runs` row, returns `202 + runId`, and finishes Chartmetric refresh, Manager Intelligence context construction, one bounded OpenAI generation, validation, and atomic output activation in `EdgeRuntime.waitUntil`. Music loaders recover run state from the database and render only `music-manager-read-v2` outputs.

**Tech Stack:** React 18, TypeScript, Vitest/jsdom, Supabase Postgres/RLS, Supabase Edge Functions/Deno, OpenAI Responses API, Chartmetric normalization, Tailwind CSS.

---

## Scope and file map

Create:

- `supabase/migrations/20260727000100_music_manager_read_v2.sql` — subject-scoped run identity, active-run uniqueness, atomic v2 output activation.
- `supabase/functions/_shared/openaiMusicManagerRead.ts` — v2 type, JSON Schema, prompt, parser, semantic validation, repair instructions.
- `supabase/functions/_shared/music-manager-read/workflow.ts` — small dependency-injected workflow enforcing stage order and failure boundaries.
- `src/music-manager-read-v2-schema.test.ts` — migration contract.
- `src/music-manager-read-v2-workflow.test.ts` — workflow order and failure tests.

Replace:

- `supabase/functions/_shared/openaiManagerRead.ts` — delete after all imports move to `openaiMusicManagerRead.ts`.

Modify:

- `supabase/functions/generate-music-summary/index.ts` — durable 202 coordinator, server-side freshness check, bounded OpenAI request, v2 persistence and usage.
- `supabase/functions/chartmetric-track-enrichment/index.ts` — remove Manager Read handoff.
- `supabase/functions/chartmetric-project-enrichment/index.ts` — remove Manager Read handoff.
- `supabase/functions/generate-todays-brief/index.ts` — track returned music read run IDs and finalize setup substage from terminal run status.
- `src/types/cleanProduction.ts` — add v2 view model and runtime statuses; remove flat legacy read fields.
- `src/types/productionApp.ts` — replace legacy generated-read shape; include run rows in the Music library.
- `src/services/productionSupabase.ts` — load v2 outputs and subject runs, start backend jobs, remove client Chartmetric orchestration.
- `src/services/fixtureRepositories.ts` — provide v2 fixtures and async start semantics.
- `src/features/music/MusicScreens.tsx` — render v2 and poll durable active state.
- `src/app/ProductionApp.tsx` — stop waiting for setup music reads before entering the app.
- `src/openai-music-summary-function.test.ts` — replace legacy prompt/source assertions with v2 contract tests.
- `src/chartmetric-track-enrichment-function.test.ts` — assert no OpenAI handoff.
- `src/chartmetric-project-enrichment-function.test.ts` — assert no OpenAI handoff.
- `src/production-supabase-service.test.ts` — loader, idempotent start-response, run-state projection, v1 hiding.
- `src/production-app-shell.test.tsx` — v2 rendering, polling, refresh recovery and failure states.
- `src/openai-todays-brief-function.test.ts` — setup run-ID finalization.
- `src/paid-workspace-setup-function.test.ts` — setup remains complete while music reads continue.

Do not modify Manager Conversation, Mission Genesis, billing, catalog import, rights, files, splits, or the Strategic Intelligence Packet generator.

---

### Task 1: Add durable subject-run identity and atomic output activation

**Files:**

- Create: `supabase/migrations/20260727000100_music_manager_read_v2.sql`
- Create: `src/music-manager-read-v2-schema.test.ts`

- [ ] **Step 1: Write the failing migration contract test**

Create `src/music-manager-read-v2-schema.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase", "migrations", "20260727000100_music_manager_read_v2.sql"),
  "utf8",
);

describe("Music Manager Read v2 schema", () => {
  it("adds subject identity to durable Manager runs", () => {
    expect(migration).toContain("add column if not exists subject_type text");
    expect(migration).toContain("add column if not exists subject_id uuid");
  });

  it("prevents duplicate active v2 reads for one subject", () => {
    expect(migration).toContain("manager_synthesis_runs_active_music_read_v2_idx");
    expect(migration).toContain("classification = 'music_manager_read_v2'");
    expect(migration).toContain("status in ('queued', 'running')");
    expect(migration).toContain("where subject_id is not null");
  });

  it("activates a staged v2 output transactionally", () => {
    expect(migration).toContain("activate_music_manager_read_v2");
    expect(migration).toContain("schema_version <> 'music-manager-read-v2'");
    expect(migration).toContain("for update");
    expect(migration).toContain("supersedes_output_id = previous_output_id");
    expect(migration).toContain("grant execute");
  });
});
```

- [ ] **Step 2: Run the schema test and verify it fails**

Run:

```powershell
npm test -- src/music-manager-read-v2-schema.test.ts
```

Expected: FAIL because `20260727000100_music_manager_read_v2.sql` does not exist.

- [ ] **Step 3: Add the additive migration**

Create `supabase/migrations/20260727000100_music_manager_read_v2.sql`:

```sql
alter table public.manager_synthesis_runs
  add column if not exists subject_type text,
  add column if not exists subject_id uuid;

create index if not exists manager_synthesis_runs_music_subject_idx
on public.manager_synthesis_runs (
  account_id,
  artist_workspace_id,
  artist_id,
  classification,
  subject_type,
  subject_id,
  created_at desc
);

create unique index if not exists manager_synthesis_runs_active_music_read_v2_idx
on public.manager_synthesis_runs (
  account_id,
  artist_workspace_id,
  artist_id,
  classification,
  subject_type,
  subject_id
)
where subject_id is not null
  and classification = 'music_manager_read_v2'
  and status in ('queued', 'running');

create or replace function public.activate_music_manager_read_v2(target_output_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  next_output public.manager_outputs%rowtype;
  previous_output_id uuid;
begin
  select *
  into next_output
  from public.manager_outputs
  where id = target_output_id
  for update;

  if not found then
    raise exception 'Manager output was not found.';
  end if;

  if next_output.schema_version <> 'music-manager-read-v2' then
    raise exception 'Only Music Manager Read v2 outputs can be activated.';
  end if;

  if next_output.output_type not in ('song_manager_read', 'project_manager_read') then
    raise exception 'Output is not a Music Manager Read.';
  end if;

  select id
  into previous_output_id
  from public.manager_outputs
  where artist_workspace_id = next_output.artist_workspace_id
    and output_type = next_output.output_type
    and subject_type = next_output.subject_type
    and subject_id = next_output.subject_id
    and is_current = true
    and id <> next_output.id
  order by created_at desc
  limit 1
  for update;

  update public.manager_outputs
  set is_current = false
  where artist_workspace_id = next_output.artist_workspace_id
    and output_type = next_output.output_type
    and subject_type = next_output.subject_type
    and subject_id = next_output.subject_id
    and is_current = true
    and id <> next_output.id;

  update public.manager_outputs
  set
    is_current = true,
    supersedes_output_id = previous_output_id
  where id = next_output.id;

  return next_output.id;
end;
$$;

grant execute on function public.activate_music_manager_read_v2(uuid)
to authenticated, service_role;
```

- [ ] **Step 4: Run the schema contract test**

Run:

```powershell
npm test -- src/music-manager-read-v2-schema.test.ts
```

Expected: PASS.

- [ ] **Step 5: Verify the migration in local Supabase**

Run:

```powershell
npx supabase db reset
```

Expected: all migrations apply without SQL errors.

Then run:

```powershell
npx supabase db lint
```

Expected: no new errors from `20260727000100_music_manager_read_v2.sql`.

- [ ] **Step 6: Commit the schema**

```powershell
git add -- supabase/migrations/20260727000100_music_manager_read_v2.sql src/music-manager-read-v2-schema.test.ts
git commit -m "feat: add durable music manager read runs"
```

---

### Task 2: Replace the legacy OpenAI output contract

**Files:**

- Create: `supabase/functions/_shared/openaiMusicManagerRead.ts`
- Modify: `src/openai-music-summary-function.test.ts`
- Delete later in this task: `supabase/functions/_shared/openaiManagerRead.ts`

- [ ] **Step 1: Replace the legacy test file with the v2 contract tests**

Replace `src/openai-music-summary-function.test.ts` with behavior tests built around these imports and fixtures. The endpoint source-contract tests are added back in Task 5 after the endpoint has a v2 contract:

```ts
import {
  MUSIC_MANAGER_READ_SCHEMA_VERSION,
  buildMusicManagerReadInstructions,
  buildMusicManagerReadRepairInstructions,
  parseMusicManagerReadOutput,
  validateMusicManagerReadOutput,
} from "../supabase/functions/_shared/openaiMusicManagerRead";

const evidenceIds = new Set(["ev-streams", "ev-tiktok", "ev-market"]);
const validRead = {
  position: "Jam is the clearest public-pressure record in the current catalog.",
  managementRole: "Lead attention asset",
  body:
    "Jam is carrying the strongest aligned public response in the current catalog. Its recent streams, short-form reach, and Lagos response point to the same record rather than three disconnected spikes. That agreement matters because the song is not relying on one isolated platform event; several public behaviors are reinforcing the same management conclusion.\n\nThe role for Jam is to lead a focused validation cycle, not to justify a broad campaign by itself. The current numbers show attention and discovery pressure, but they do not yet prove that the wider fanbase has become durable or that equal spend across every market would be efficient.\n\nI would use Jam to test whether this attention can become repeatable audience behavior before widening spend. Keep the next move concentrated on the record, audience behavior, and Lagos lane that already agree, then change course only if the next reporting window breaks that alignment.",
  decision: "Make Jam the lead validation record for the next focused audience test.",
  avoid: "Do not spread equal campaign weight across weaker catalog records.",
  watch: "Watch whether Lagos response and repeat public discovery remain aligned over the next reporting window.",
  confidence: "high",
  confidenceReason: "Three current evidence families agree on the same song and market direction.",
  signals: [
    { label: "Recent streams", value: "5.2M", meaning: "Current listening pressure", evidenceIds: ["ev-streams"] },
    { label: "Top TikTok clip", value: "19M", meaning: "Short-form discovery scale", evidenceIds: ["ev-tiktok"] },
    { label: "Lagos rank", value: "#14", meaning: "A market lane worth testing", evidenceIds: ["ev-market"] },
  ],
  evidenceIds: ["ev-streams", "ev-tiktok", "ev-market"],
};

it("parses the complete v2 contract", () => {
  expect(MUSIC_MANAGER_READ_SCHEMA_VERSION).toBe("music-manager-read-v2");
  expect(parseMusicManagerReadOutput(validRead)).toEqual(validRead);
});

it("contains none of the removed legacy output keys", () => {
  for (const key of [
    "headline",
    "situationLine",
    "nextMove",
    "watchNext",
    "generationState",
    "whatMatters",
    "doNotDoYet",
    "missingProof",
    "evidenceIdsUsed",
    "sourcePanelNote",
    "sourceLine",
    "snapshotSummary",
    "intelligenceSnapshot",
    "claimAudit",
  ]) {
    expect(JSON.stringify(validRead)).not.toContain(`"${key}"`);
  }
});

it("rejects unknown evidence IDs and a substituted subject", () => {
  expect(validateMusicManagerReadOutput(validRead, {
    subjectType: "music_item",
    subjectTitle: "Jam",
    allowedEvidenceIds: evidenceIds,
  })).toEqual([]);

  expect(validateMusicManagerReadOutput(
    {
      ...validRead,
      position: "Night Bus is the strongest record.",
      evidenceIds: ["invented-id"],
    },
    {
      subjectType: "music_item",
      subjectTitle: "Jam",
      allowedEvidenceIds: evidenceIds,
    },
  )).toEqual(expect.arrayContaining([
    expect.stringContaining('position must name "Jam"'),
    expect.stringContaining('unknown evidence ID "invented-id"'),
  ]));
});

it("rejects provider leakage and repeated decision fields", () => {
  const violations = validateMusicManagerReadOutput(
    {
      ...validRead,
      body: "Chartmetric API says Jam is working.",
      avoid: validRead.decision,
      watch: validRead.decision,
    },
    {
      subjectType: "music_item",
      subjectTitle: "Jam",
      allowedEvidenceIds: evidenceIds,
    },
  );

  expect(violations).toEqual(expect.arrayContaining([
    expect.stringContaining("internal or provider terminology"),
    expect.stringContaining("decision, avoid, and watch must be distinct"),
  ]));
});

it("builds a focused repair instruction from exact violations", () => {
  expect(buildMusicManagerReadRepairInstructions([
    'position must name "Jam"',
    'unknown evidence ID "invented-id"',
  ])).toContain('position must name "Jam"');
});

it("keeps the prompt focused on management judgment and prompt-owned formatting", () => {
  const prompt = buildMusicManagerReadInstructions("music_item", "");
  expect(prompt).toContain("senior Manager");
  expect(prompt).toContain("two or three natural paragraphs");
  expect(prompt).toContain("5.2M");
  expect(prompt).toContain("decision, avoid, and watch");
  expect(prompt).toContain("Do not substitute a comparison");
  expect(prompt).not.toContain("sourceLine must be exactly");
});
```

Remove every test for `checkSourceLine`, `stripBannedVisibleMusicTerms`, and legacy array fields.

- [ ] **Step 2: Run the contract tests and verify they fail**

Run:

```powershell
npm test -- src/openai-music-summary-function.test.ts
```

Expected: FAIL because `openaiMusicManagerRead.ts` and its v2 exports do not exist.

- [ ] **Step 3: Create the v2 type, strict schema and parser**

Create `supabase/functions/_shared/openaiMusicManagerRead.ts` with these public exports:

```ts
export const MUSIC_MANAGER_READ_SCHEMA_VERSION = "music-manager-read-v2";

export type MusicManagerReadSubjectType = "music_item" | "music_project";

export type MusicManagerReadV2 = {
  position: string;
  managementRole: string;
  body: string;
  decision: string;
  avoid: string;
  watch: string;
  confidence: "low" | "medium" | "high";
  confidenceReason: string;
  signals: Array<{
    label: string;
    value: string;
    meaning: string;
    evidenceIds: string[];
  }>;
  evidenceIds: string[];
};

export const musicManagerReadJsonSchema = {
  name: "music_manager_read_v2",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "position",
      "managementRole",
      "body",
      "decision",
      "avoid",
      "watch",
      "confidence",
      "confidenceReason",
      "signals",
      "evidenceIds",
    ],
    properties: {
      position: { type: "string", maxLength: 220 },
      managementRole: { type: "string", maxLength: 100 },
      body: { type: "string", maxLength: 2400 },
      decision: { type: "string", maxLength: 260 },
      avoid: { type: "string", maxLength: 260 },
      watch: { type: "string", maxLength: 260 },
      confidence: { type: "string", enum: ["low", "medium", "high"] },
      confidenceReason: { type: "string", maxLength: 260 },
      signals: {
        type: "array",
        minItems: 3,
        maxItems: 6,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["label", "value", "meaning", "evidenceIds"],
          properties: {
            label: { type: "string", maxLength: 56 },
            value: { type: "string", maxLength: 18 },
            meaning: { type: "string", maxLength: 120 },
            evidenceIds: { type: "array", items: { type: "string" } },
          },
        },
      },
      evidenceIds: { type: "array", items: { type: "string" } },
    },
  },
} as const;
```

Implement `parseMusicManagerReadOutput` by requiring every string, accepting only the three confidence values, requiring three to six signal objects, trimming strings, and deduplicating evidence IDs. Do not accept or copy unknown properties.

- [ ] **Step 4: Add semantic validation without prose rewriting**

Add:

```ts
type ValidationContext = {
  subjectType: MusicManagerReadSubjectType;
  subjectTitle: string;
  allowedEvidenceIds: Set<string>;
};

const forbiddenVisibleTerms =
  /\b(openai|chatgpt|model|provider|api|database|prompt|chartmetric|evidence row|third-party)\b/i;

export function validateMusicManagerReadOutput(
  output: MusicManagerReadV2,
  context: ValidationContext,
): string[] {
  const violations: string[] = [];
  const visible = [
    output.position,
    output.managementRole,
    output.body,
    output.decision,
    output.avoid,
    output.watch,
    output.confidenceReason,
    ...output.signals.flatMap((signal) => [signal.label, signal.value, signal.meaning]),
  ].join("\n");

  if (!output.position.toLocaleLowerCase().includes(context.subjectTitle.toLocaleLowerCase())) {
    violations.push(`position must name "${context.subjectTitle}"`);
  }
  if (forbiddenVisibleTerms.test(visible)) {
    violations.push("visible output contains internal or provider terminology");
  }

  const normalizedDecisions = [output.decision, output.avoid, output.watch]
    .map((value) => value.toLocaleLowerCase().match(/[a-z0-9]+/g) ?? []);
  const meaningfullySame = (left: string[], right: string[]) => {
    const leftSet = new Set(left);
    const rightSet = new Set(right);
    const shared = [...leftSet].filter((token) => rightSet.has(token)).length;
    return shared / Math.max(1, Math.min(leftSet.size, rightSet.size)) >= 0.8;
  };
  if (
    meaningfullySame(normalizedDecisions[0], normalizedDecisions[1]) ||
    meaningfullySame(normalizedDecisions[0], normalizedDecisions[2]) ||
    meaningfullySame(normalizedDecisions[1], normalizedDecisions[2])
  ) {
    violations.push("decision, avoid, and watch must be distinct");
  }

  const ids = [
    ...output.evidenceIds,
    ...output.signals.flatMap((signal) => signal.evidenceIds),
  ];
  for (const id of new Set(ids)) {
    if (!context.allowedEvidenceIds.has(id)) {
      violations.push(`unknown evidence ID "${id}"`);
    }
  }

  const bodyWords = output.body.split(/\s+/).filter(Boolean).length;
  if (bodyWords < 120 || bodyWords > 320) {
    violations.push("body must contain 120 to 320 words");
  }

  return violations;
}
```

Add `buildMusicManagerReadRepairInstructions(violations)` that embeds the exact violations and explicitly preserves already-valid content.

- [ ] **Step 5: Add the approved prompt**

Implement `buildMusicManagerReadInstructions(subjectType, playbookInstructions)` as one lean instruction list covering:

```text
Role: the artist's senior Manager.
Outcome: current position, management role, grounded interpretation, decision, avoid, watch and calibrated confidence.
Composition: conclusion first; two or three natural paragraphs; plain, direct English.
Specificity: exact subject, artist, markets, comparisons and numbers from context.
Reasoning: distinguish attention, discovery, conversion and durable fandom.
Formatting: compact K/M/#/% values in signals.
Boundary: no missions, tasks, fake commitments, providers or internal mechanics.
Subject rule: never replace the requested subject with a stronger comparison.
Project rule: reason across the release and identify carrying tracks when supported.
Evidence rule: use only supplied evidence IDs and never print IDs in visible text.
```

State each instruction once. Append non-empty playbook instructions once.

- [ ] **Step 6: Run the v2 contract tests**

Run:

```powershell
npm test -- src/openai-music-summary-function.test.ts
```

Expected: all v2 contract tests in the replaced file PASS.

- [ ] **Step 7: Commit the v2 contract**

```powershell
git add -- supabase/functions/_shared/openaiMusicManagerRead.ts src/openai-music-summary-function.test.ts
git commit -m "feat: define music manager read v2 contract"
```

Do not delete `openaiManagerRead.ts` until the endpoint import moves in Task 5.

---

### Task 3: Make Chartmetric enrichment evidence-only

**Files:**

- Modify: `supabase/functions/chartmetric-track-enrichment/index.ts`
- Modify: `supabase/functions/chartmetric-project-enrichment/index.ts`
- Modify: `src/chartmetric-track-enrichment-function.test.ts`
- Modify: `src/chartmetric-project-enrichment-function.test.ts`

- [ ] **Step 1: Reverse the tests that currently enforce the duplicate handoff**

Replace each “hands off to the Manager Read generator” test with:

```ts
it("finishes after normalized evidence without invoking OpenAI or Manager Read generation", () => {
  expect(functionSource).not.toContain("invokeManagerReadGeneration");
  expect(functionSource).not.toContain("generate-music-summary");
  expect(functionSource).not.toContain("music_manager_read_handoff_failed");
  expect(functionSource).not.toContain("manager_read_status");
});
```

Keep the existing assertions proving snapshot creation precedes evidence normalization.

- [ ] **Step 2: Run both enrichment tests and verify they fail**

Run:

```powershell
npm test -- src/chartmetric-track-enrichment-function.test.ts src/chartmetric-project-enrichment-function.test.ts
```

Expected: FAIL because both functions still invoke `generate-music-summary`.

- [ ] **Step 3: Remove the track enrichment handoff**

In `chartmetric-track-enrichment/index.ts`:

- remove `invokeManagerReadGeneration`;
- remove `managerReadResult`;
- remove `music_manager_read_handoff_failed`;
- remove `manager_read_status` from completion payloads/events;
- return the enrichment status, evidence count, snapshot/job IDs and provider request count only.

The success response must retain this shape:

```ts
return json({
  status: completedStatus,
  sourceSyncJobId: jobId,
  snapshotId,
  evidenceItemCount: evidenceItems.length,
  providerRequestCount: requestCount,
  supplementalErrors,
});
```

- [ ] **Step 4: Remove the project enrichment handoff**

Apply the identical boundary to `chartmetric-project-enrichment/index.ts`. Its success response remains enrichment-only:

```ts
return json({
  status: completedStatus,
  sourceSyncJobId: jobId,
  snapshotId,
  evidenceItemCount: evidenceItems.length,
  providerRequestCount: requestCount,
  supplementalErrors,
});
```

- [ ] **Step 5: Run Chartmetric tests**

Run:

```powershell
npm test -- src/chartmetric-client.test.ts src/chartmetric-evidence.test.ts src/chartmetric-track-enrichment-function.test.ts src/chartmetric-project-enrichment-function.test.ts
```

Expected: all selected tests PASS.

- [ ] **Step 6: Commit the enrichment boundary**

```powershell
git add -- supabase/functions/chartmetric-track-enrichment/index.ts supabase/functions/chartmetric-project-enrichment/index.ts src/chartmetric-track-enrichment-function.test.ts src/chartmetric-project-enrichment-function.test.ts
git commit -m "fix: make chartmetric enrichment evidence only"
```

---

### Task 4: Add a testable Manager Read workflow

**Files:**

- Create: `supabase/functions/_shared/music-manager-read/workflow.ts`
- Create: `src/music-manager-read-v2-workflow.test.ts`

- [ ] **Step 1: Write workflow order and failure tests**

Create `src/music-manager-read-v2-workflow.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import {
  runMusicManagerReadWorkflow,
  type EnrichmentResult,
} from "../supabase/functions/_shared/music-manager-read/workflow";

function dependencies(evidenceState: "fresh" | "missing" | "stale" = "fresh") {
  const order: string[] = [];
  const deps = {
    markStep: vi.fn(async (step: string, status: string) => { order.push(`${step}:${status}`); }),
    inspectEvidence: vi.fn(async () => ({ state: evidenceState })),
    enrichEvidence: vi.fn(async (): Promise<EnrichmentResult> => ({ status: "completed" })),
    buildContext: vi.fn(async () => ({ subjectTitle: "Jam" })),
    generateInitial: vi.fn(async () => ({
      outputText: "{}",
      usage: { input_tokens: 100, output_tokens: 50 },
      responseId: "resp-1",
    })),
    validateAndRepair: vi.fn(async () => ({
      output: { position: "Jam is the current lead record." },
      usage: { input_tokens: 100, output_tokens: 50 },
      responseId: "resp-1",
      requestCount: 1,
    })),
    stageOutput: vi.fn(async () => "output-1"),
    activateOutput: vi.fn(async () => undefined),
    complete: vi.fn(async () => undefined),
  };
  return { deps, order };
}

describe("Music Manager Read v2 workflow", () => {
  it("skips Chartmetric when evidence is fresh", async () => {
    const { deps } = dependencies("fresh");
    await runMusicManagerReadWorkflow(deps);
    expect(deps.enrichEvidence).not.toHaveBeenCalled();
    expect(deps.generateInitial).toHaveBeenCalledOnce();
    expect(deps.validateAndRepair).toHaveBeenCalledOnce();
    expect(deps.activateOutput).toHaveBeenCalledWith("output-1");
  });

  it.each(["missing", "stale"] as const)(
    "refreshes and reloads %s evidence before generation",
    async (state) => {
      const { deps } = dependencies(state);
      await runMusicManagerReadWorkflow(deps);
      expect(deps.enrichEvidence).toHaveBeenCalledOnce();
      expect(deps.inspectEvidence).toHaveBeenCalledTimes(2);
      expect(deps.enrichEvidence.mock.invocationCallOrder[0])
        .toBeLessThan(deps.buildContext.mock.invocationCallOrder[0]);
    },
  );

  it("does not call OpenAI after a hard enrichment failure", async () => {
    const { deps } = dependencies("stale");
    deps.enrichEvidence.mockResolvedValue({ status: "failed" as const });
    await expect(runMusicManagerReadWorkflow(deps)).rejects.toThrow("Chartmetric evidence refresh failed");
    expect(deps.generateInitial).not.toHaveBeenCalled();
  });

  it("preserves unresolved identity as a limited context path", async () => {
    const { deps } = dependencies("missing");
    deps.enrichEvidence.mockResolvedValue({ status: "unresolved" as const });
    await runMusicManagerReadWorkflow(deps);
    expect(deps.generateInitial).toHaveBeenCalledOnce();
  });

  it("never activates a staged output when generation fails", async () => {
    const { deps } = dependencies("fresh");
    deps.generateInitial.mockRejectedValue(new Error("OpenAI unavailable"));
    await expect(runMusicManagerReadWorkflow(deps)).rejects.toThrow("OpenAI unavailable");
    expect(deps.stageOutput).not.toHaveBeenCalled();
    expect(deps.activateOutput).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the workflow test and verify it fails**

Run:

```powershell
npm test -- src/music-manager-read-v2-workflow.test.ts
```

Expected: FAIL because the workflow module does not exist.

- [ ] **Step 3: Implement the small workflow state machine**

Create `supabase/functions/_shared/music-manager-read/workflow.ts`:

```ts
export type EvidenceInspection = { state: "fresh" | "missing" | "stale" };
export type EnrichmentResult = {
  status: "completed" | "completed_with_limits" | "unresolved" | "failed";
};

export type MusicManagerReadWorkflowDependencies<Context, Output> = {
  markStep(step: string, status: "running" | "completed" | "completed_with_limits" | "failed"): Promise<void>;
  inspectEvidence(): Promise<EvidenceInspection>;
  enrichEvidence(): Promise<EnrichmentResult>;
  buildContext(): Promise<Context>;
  generateInitial(context: Context): Promise<{
    outputText: string;
    usage: Record<string, unknown>;
    responseId: string;
  }>;
  validateAndRepair(context: Context, initial: {
    outputText: string;
    usage: Record<string, unknown>;
    responseId: string;
  }): Promise<{
    output: Output;
    usage: Record<string, unknown>;
    responseId: string;
    requestCount: number;
  }>;
  stageOutput(output: Output): Promise<string>;
  activateOutput(outputId: string): Promise<void>;
  complete(result: {
    output: Output;
    usage: Record<string, unknown>;
    responseId: string;
    requestCount: number;
    outputId: string;
    completedWithLimits: boolean;
  }): Promise<void>;
};

export async function runMusicManagerReadWorkflow<Context, Output>(
  deps: MusicManagerReadWorkflowDependencies<Context, Output>,
) {
  const runStep = async <Value>(step: string, operation: () => Promise<Value>) => {
    await deps.markStep(step, "running");
    try {
      const value = await operation();
      await deps.markStep(step, "completed");
      return value;
    } catch (error) {
      await deps.markStep(step, "failed");
      throw error;
    }
  };

  await deps.markStep("evidence_check", "running");
  let evidence = await deps.inspectEvidence();
  let completedWithLimits = false;

  if (evidence.state !== "fresh") {
    await deps.markStep("chartmetric_enrichment", "running");
    const enrichment = await deps.enrichEvidence();
    if (enrichment.status === "failed") {
      await deps.markStep("chartmetric_enrichment", "failed");
      throw new Error("Chartmetric evidence refresh failed.");
    }
    completedWithLimits =
      enrichment.status === "completed_with_limits" || enrichment.status === "unresolved";
    await deps.markStep(
      "chartmetric_enrichment",
      completedWithLimits ? "completed_with_limits" : "completed",
    );
    evidence = await deps.inspectEvidence();
  }
  await deps.markStep("evidence_check", evidence.state === "fresh" ? "completed" : "completed_with_limits");

  const context = await runStep("context_build", deps.buildContext);
  const initial = await runStep("manager_synthesis", () => deps.generateInitial(context));
  const generated = await runStep(
    "output_validation",
    () => deps.validateAndRepair(context, initial),
  );
  const outputId = await runStep("output_activation", async () => {
    const stagedId = await deps.stageOutput(generated.output);
    await deps.activateOutput(stagedId);
    return stagedId;
  });

  const result = { ...generated, outputId, completedWithLimits };
  await deps.complete(result);
  return result;
}
```

- [ ] **Step 4: Run workflow tests**

Run:

```powershell
npm test -- src/music-manager-read-v2-workflow.test.ts
```

Expected: all workflow tests PASS.

- [ ] **Step 5: Commit the workflow**

```powershell
git add -- supabase/functions/_shared/music-manager-read/workflow.ts src/music-manager-read-v2-workflow.test.ts
git commit -m "feat: add bounded music manager read workflow"
```

---

### Task 5: Convert `generate-music-summary` into the durable v2 coordinator

**Files:**

- Modify: `supabase/functions/generate-music-summary/index.ts`
- Modify: `src/openai-music-summary-function.test.ts`
- Delete: `supabase/functions/_shared/openaiManagerRead.ts`

- [ ] **Step 1: Add endpoint contract tests**

Add assertions to `src/openai-music-summary-function.test.ts`:

```ts
it("returns a durable processing response before background work", () => {
  expect(functionSource).toContain('classification: "music_manager_read_v2"');
  expect(functionSource).toContain("subject_type: input.subjectType");
  expect(functionSource).toContain("subject_id: input.subjectId");
  expect(functionSource).toContain("scheduleMusicManagerRead");
  expect(functionSource).toContain('return json({ status: "processing", runId }, 202)');
});

it("owns Chartmetric freshness before OpenAI", () => {
  expect(functionSource).toContain("inspectChartmetricEvidence");
  expect(functionSource).toContain("invokeChartmetricEnrichment");
  expect(functionSource).toContain("runMusicManagerReadWorkflow");
  expect(functionSource).not.toContain("callOpenAIManagerReadWithRetry");
  expect(functionSource).not.toContain("const maxAttempts = 4");
});

it("uses the conversation-quality model route and bounded Responses request", () => {
  expect(functionSource).toContain('Deno.env.get("OPENAI_MANAGER_READ_MODEL")');
  expect(functionSource).toContain('Deno.env.get("OPENAI_MANAGER_REASONING_MODEL")');
  expect(functionSource).toContain('"gpt-5.6-luna"');
  expect(functionSource).toContain('reasoning: { effort: "medium" }');
  expect(functionSource).toContain("musicManagerReadJsonSchema");
  expect(functionSource).toContain("requestCount: 2");
  expect(functionSource).not.toContain("MAX_RETRIES = 2");
});

it("persists v2 as non-current before transactional activation", () => {
  expect(functionSource).toContain('schema_version: MUSIC_MANAGER_READ_SCHEMA_VERSION');
  expect(functionSource).toContain("is_current: false");
  expect(functionSource).toContain('rpc("activate_music_manager_read_v2"');
});
```

- [ ] **Step 2: Run the endpoint test and verify it fails**

Run:

```powershell
npm test -- src/openai-music-summary-function.test.ts
```

Expected: FAIL on the new 202, v2 routing and activation assertions.

- [ ] **Step 3: Change the request handler to create or reuse a durable run**

Keep existing auth, membership, service-role and entitlement checks.

Before inserting a run:

1. mark stale active v2 runs older than five minutes `failed`;
2. select an active run for the exact workspace/subject;
3. return `{ status: "processing", runId }` when found;
4. insert a queued run with `classification`, `subject_type`, and `subject_id`;
5. on a unique-index race, reselect and return the winner.

The inserted row must include:

```ts
{
  account_id: input.accountId,
  artist_workspace_id: input.artistWorkspaceId,
  artist_id: input.artistId,
  trigger_type: "evidence_triggered",
  status: "queued",
  classification: "music_manager_read_v2",
  subject_type: input.subjectType,
  subject_id: input.subjectId,
  context_payload: {
    subjectType: input.subjectType,
    subjectId: input.subjectId,
  },
  steps_payload: [{ step: "queued", status: "completed" }],
}
```

- [ ] **Step 4: Schedule the background workflow**

Add:

```ts
function scheduleMusicManagerRead(task: Promise<void>) {
  const runtime = (globalThis as {
    EdgeRuntime?: { waitUntil?: (promise: Promise<unknown>) => void };
  }).EdgeRuntime;
  if (typeof runtime?.waitUntil === "function") {
    runtime.waitUntil(task);
    return;
  }
  task.catch((error) => console.error("Music Manager Read v2 failed:", error));
}
```

Set the run to `running`, create one usage event, call `runMusicManagerReadWorkflow`, and catch terminal errors inside the background task so both run and usage rows are completed as `failed`.

- [ ] **Step 5: Implement backend evidence freshness and enrichment**

Use a single constant:

```ts
const CHARTMETRIC_EVIDENCE_FRESH_MS = 24 * 60 * 60 * 1000;
```

`inspectChartmetricEvidence` queries the newest Chartmetric `evidence_items.created_at` for the exact subject and returns:

- `missing` when absent;
- `fresh` when age is at most 24 hours;
- `stale` otherwise.

`invokeChartmetricEnrichment` calls:

- `chartmetric-track-enrichment` with `musicItemId` for `music_item`;
- `chartmetric-project-enrichment` with `musicProjectId` for `music_project`.

Use the service-role authorization and exact workspace identifiers. Parse only `completed`, `completed_with_limits`, `unresolved`, and `failed`.

- [ ] **Step 6: Build the compact v2 context**

Retain the existing subject, identifiers, evidence, related records, artist profile and tracklist loaders. Expand the latest packet projection to include:

```ts
{
  managerIntelligencePacketId: packet.id,
  profileProjection: packet.profile_projection_json,
  strategicDiagnosis: packet.strategic_diagnosis_json,
  targetAssetRead: selected target from packet.asset_reads_json,
  comparisonAssetReads: up to three other relevant asset reads,
  marketReads: up to four relevant packet.market_reads_json entries,
  missionDirection: packet.mission_seed_json,
  doNotDo: packet.do_not_do_json,
}
```

Remove `sourcePanelInstruction`, legacy output terminology and unbounded packet copies. Keep a 45,000-character serialized input ceiling.

- [ ] **Step 7: Implement the globally bounded OpenAI request**

Use:

```ts
{
  model:
    Deno.env.get("OPENAI_MANAGER_READ_MODEL") ||
    Deno.env.get("OPENAI_MANAGER_REASONING_MODEL") ||
    Deno.env.get("OPENAI_SUMMARY_MODEL") ||
    "gpt-5.6-luna",
  reasoning: { effort: "medium" },
  store: false,
  max_output_tokens: 6000,
  instructions,
  input: JSON.stringify(context),
  text: {
    verbosity: "medium",
    format: { type: "json_schema", ...musicManagerReadJsonSchema },
  },
}
```

Request once. Parse and semantically validate. Only when parsing or semantic validation fails, request once more with `buildMusicManagerReadRepairInstructions`, the invalid output, and validation failures. Merge both usage objects exactly as Mission Genesis does and return `requestCount: 2`. Provider/network failure does not start an independent outer retry loop.

Include up to 500 characters of the provider error body in the persisted error message.

- [ ] **Step 8: Stage, activate and project v2 output**

Insert the v2 row with:

```ts
{
  source_packet_id: context.managerIntelligencePacketId ?? null,
  output_type: input.subjectType === "music_item" ? "song_manager_read" : "project_manager_read",
  subject_type: input.subjectType,
  subject_id: input.subjectId,
  summary: output.position,
  primary_recommendation_json: {
    decision: output.decision,
    watch: output.watch,
  },
  avoid_json: [output.avoid],
  confidence_json: {
    level: output.confidence,
    reason: output.confidenceReason,
  },
  supporting_evidence_json: output.evidenceIds.map((id) => ({ id })),
  render_json: output,
  schema_version: MUSIC_MANAGER_READ_SCHEMA_VERSION,
  created_from_run_id: runId,
  is_current: false,
}
```

Then call:

```ts
await db.rpc("activate_music_manager_read_v2", {
  target_output_id: outputId,
});
```

Complete the run with `completed` or `completed_with_limits`, and update usage with real request count, input/output/cached/reasoning tokens and completion time.

- [ ] **Step 9: Delete the legacy prompt module**

After the endpoint imports only `openaiMusicManagerRead.ts`, delete:

```text
supabase/functions/_shared/openaiManagerRead.ts
```

Verify no source import remains:

```powershell
rg -n "openaiManagerRead|callOpenAIManagerReadWithRetry|stripBannedVisibleMusicTerms" src supabase
```

Expected: no matches outside historical documentation.

- [ ] **Step 10: Run endpoint and workflow tests**

Run:

```powershell
npm test -- src/openai-music-summary-function.test.ts src/music-manager-read-v2-workflow.test.ts src/music-manager-read-v2-schema.test.ts
```

Expected: all selected tests PASS.

- [ ] **Step 11: Commit the backend coordinator**

```powershell
git add -- supabase/functions/generate-music-summary/index.ts supabase/functions/_shared/openaiMusicManagerRead.ts supabase/functions/_shared/music-manager-read/workflow.ts src/openai-music-summary-function.test.ts
git add -u -- supabase/functions/_shared/openaiManagerRead.ts
git commit -m "feat: make music manager reads durable and intelligent"
```

---

### Task 6: Replace frontend legacy types and load durable run state

**Files:**

- Modify: `src/types/cleanProduction.ts`
- Modify: `src/types/productionApp.ts`
- Modify: `src/services/productionSupabase.ts`
- Modify: `src/services/fixtureRepositories.ts`
- Modify: `src/production-supabase-service.test.ts`

- [ ] **Step 1: Write service tests for v2-only loading and run-state recovery**

Add fixtures containing:

```ts
const v2Render = {
  position: "Jam is the current lead validation record.",
  managementRole: "Lead attention asset",
  body: "Jam has aligned public pressure across the current evidence...",
  decision: "Use Jam for the next focused validation test.",
  avoid: "Do not spread spend equally across the catalog.",
  watch: "Watch whether Lagos discovery remains aligned.",
  confidence: "high",
  confidenceReason: "Three current evidence families agree.",
  signals: [
    { label: "Recent streams", value: "5.2M", meaning: "Current listening pressure", evidenceIds: ["ev-1"] },
    { label: "TikTok", value: "19M", meaning: "Short-form discovery scale", evidenceIds: ["ev-2"] },
    { label: "Lagos", value: "#14", meaning: "A market lane worth testing", evidenceIds: ["ev-3"] },
  ],
  evidenceIds: ["ev-1", "ev-2", "ev-3"],
};
```

Test:

- v2 current output maps to `managerReadStatus: "fresh"`;
- v1-only current output maps to `"stale"` with no rendered read;
- active run plus no v2 maps to `"running"`;
- active run plus v2 maps to `"refreshing"`;
- newest failed run plus no v2 maps to `"failed"`;
- newest failed run after a v2 maps to `"refresh_failed"` and retains the read;
- repository start calls only `generate-music-summary`, never Chartmetric;
- `{ status: "processing", runId }` is accepted and followed by a library reload.

Use the existing `createMutableSupabaseClient` helper and assert:

```ts
expect(invoked).toEqual(["generate-music-summary"]);
expect(result.managerReadRunId).toBe("run-1");
expect(result.managerReadStatus).toBe("running");
```

- [ ] **Step 2: Run the service tests and verify they fail**

Run:

```powershell
npm test -- src/production-supabase-service.test.ts
```

Expected: new v2 and run-state assertions FAIL.

- [ ] **Step 3: Replace the clean production view model**

Add:

```ts
export type MusicManagerReadViewModel = {
  position: string;
  managementRole: string;
  body: string;
  decision: string;
  avoid: string;
  watch: string;
  confidence: "low" | "medium" | "high";
  confidenceReason: string;
  signals: Array<{
    label: string;
    value: string;
    meaning: string;
    evidenceIds: string[];
  }>;
  evidenceIds: string[];
};

export type MusicManagerReadStatus =
  | "not_generated"
  | "stale"
  | "running"
  | "refreshing"
  | "fresh"
  | "failed"
  | "refresh_failed";
```

In `MusicObjectViewModel`, replace all flat generated-read fields with:

```ts
managerRead?: MusicManagerReadViewModel;
managerReadStatus: MusicManagerReadStatus;
managerReadRunId?: string;
managerReadError?: string;
```

Change `MusicRepository`:

```ts
startManagerRead(
  subjectId: string,
  subjectType: "music_item" | "music_project",
): Promise<MusicObjectViewModel>;
```

Remove `generateMusicSummary`.

- [ ] **Step 4: Replace production library types**

In `src/types/productionApp.ts`, replace both legacy `generatedManagerRead` shapes with:

```ts
managerRead?: MusicManagerReadViewModel;
managerReadStatus: MusicManagerReadStatus;
managerReadRunId?: string;
managerReadError?: string;
```

Add:

```ts
export type ProductionMusicManagerRun = {
  id: string;
  subjectType: "music_item" | "music_project";
  subjectId: string;
  status: "queued" | "running" | "completed" | "completed_with_limits" | "failed" | "cancelled";
  error?: string;
  createdAt: string;
  completedAt?: string;
};
```

Include `managerRuns: ProductionMusicManagerRun[]` in `ProductionMusicLibrary`.

- [ ] **Step 5: Query v2 outputs and recent subject runs**

Extend the manager output select with `schema_version`.

Add a parallel query:

```ts
const { data: managerRunRows, error: managerRunError } = await client
  .from("manager_synthesis_runs")
  .select("id,subject_type,subject_id,status,error,created_at,completed_at")
  .eq("artist_workspace_id", workspace.artistWorkspaceId)
  .eq("classification", "music_manager_read_v2")
  .in("subject_type", ["music_item", "music_project"])
  .order("created_at", { ascending: false })
  .limit(200);
```

Throw `managerRunError` and pass rows into `mapMusicLibrary`.

- [ ] **Step 6: Add a strict v2 loader and state resolver**

Replace `readGeneratedManagerReadPayload`, `acceptedGeneratedManagerRead`, legacy snapshot parsing and merge helpers with:

```ts
function readMusicManagerReadV2(row: ManagerOutputRow | undefined): MusicManagerReadViewModel | undefined {
  if (!row || row.schema_version !== "music-manager-read-v2") return undefined;
  return parseMusicManagerReadViewModel(row.render_json);
}

function resolveMusicManagerReadStatus(
  read: MusicManagerReadViewModel | undefined,
  outputCreatedAt: string | undefined,
  latestRun: ManagerSynthesisRunRow | undefined,
  hasLegacyCurrentOutput: boolean,
): MusicManagerReadStatus {
  if (latestRun?.status === "queued" || latestRun?.status === "running") {
    return read ? "refreshing" : "running";
  }
  if (
    latestRun?.status === "failed" &&
    (!outputCreatedAt || new Date(latestRun.created_at).getTime() > new Date(outputCreatedAt).getTime())
  ) {
    return read ? "refresh_failed" : "failed";
  }
  if (read) return "fresh";
  if (hasLegacyCurrentOutput) return "stale";
  return "not_generated";
}
```

The parser must reject partial v2 payloads rather than filling them with fallback copy.

- [ ] **Step 7: Replace client orchestration with one backend start**

Implement `startManagerRead`:

```ts
async startManagerRead(subjectId, subjectType) {
  const subjectLabel = subjectType === "music_project" ? "Project" : "Song";
  const { data, error } = await client.functions.invoke("generate-music-summary", {
    body: {
      accountId: workspace.accountId,
      artistWorkspaceId: workspace.artistWorkspaceId,
      artistId: workspace.artistId,
      subjectType,
      subjectId,
    },
  });
  if (error) {
    await throwFunctionInvokeError(error, `${subjectLabel} Manager Read could not start.`);
  }
  const payload = data as { status?: unknown; runId?: unknown } | null;
  if (payload?.status !== "processing" || typeof payload.runId !== "string") {
    throw new Error(`${subjectLabel} Manager Read returned an invalid run response.`);
  }

  const library = await musicLibraryLoader.loadMusicLibrary(workspace);
  const updated = musicViewModelsFromLibrary(library).find((item) => item.id === subjectId);
  if (!updated) throw new Error(`${subjectLabel} could not be reloaded after starting the Manager Read.`);
  return updated;
}
```

Delete the frontend evidence-presence check and both direct Chartmetric function calls.

- [ ] **Step 8: Update fixture repositories**

Replace fixture `generateMusicSummary` with `startManagerRead`. Return the same fixture object with:

```ts
managerReadStatus: "running",
managerReadRunId: `fixture-music-read-${subjectId}`,
```

Update fixture Music objects to the v2 nested read contract and remove the deleted flat fields.

- [ ] **Step 9: Run service and type consumers**

Run:

```powershell
npm test -- src/production-supabase-service.test.ts
npm run build
```

Expected: service tests PASS and TypeScript production build succeeds.

- [ ] **Step 10: Commit frontend data contracts**

```powershell
git add -- src/types/cleanProduction.ts src/types/productionApp.ts src/services/productionSupabase.ts src/services/fixtureRepositories.ts src/production-supabase-service.test.ts
git commit -m "feat: load durable music manager read v2 state"
```

---

### Task 7: Render Manager Read v2 and recover polling after refresh

**Files:**

- Modify: `src/features/music/MusicScreens.tsx`
- Modify: `src/production-app-shell.test.tsx`

- [ ] **Step 1: Write UI tests for all durable states**

In `src/production-app-shell.test.tsx`, add one song and one project with complete v2 reads. Assert each detail room renders:

```ts
expect(songRoom).toHaveTextContent("Lead attention asset");
expect(songRoom).toHaveTextContent("Decision");
expect(songRoom).toHaveTextContent("Avoid");
expect(songRoom).toHaveTextContent("Watch");
expect(songRoom).toHaveTextContent("Three current evidence families agree");
expect(songRoom).toHaveTextContent("5.2M");
expect(songRoom).toHaveTextContent("Current listening pressure");
```

Add state tests:

```ts
it.each([
  ["not_generated", "Ask Manager for a read"],
  ["stale", "Refresh Manager Read"],
  ["running", "Manager is reading"],
  ["failed", "Retry Manager Read"],
] as const)("renders %s song read state", (status, label) => {
  // Render the existing Music test harness with managerReadStatus: status.
  expect(within(screen.getByTestId("music-song-detail"))).toHaveTextContent(label);
});
```

Add a refresh test where `managerReadStatus: "refreshing"` retains the previous body. Add a failed-refresh test where `"refresh_failed"` retains the body and shows a safe error.

Add a polling test using fake timers:

```ts
vi.useFakeTimers();
await act(async () => {
  vi.advanceTimersByTime(2000);
});
expect(onMusicChanged).toHaveBeenCalled();
```

After rerendering with `fresh`, advance timers again and assert the call count does not increase.

- [ ] **Step 2: Run UI tests and verify they fail**

Run:

```powershell
npm test -- src/production-app-shell.test.tsx
```

Expected: new v2 layout and polling assertions FAIL.

- [ ] **Step 3: Remove local generated-read shadow state**

Delete `generatedReads` and `setGeneratedReads`. Derive displayed songs/projects and selection directly from the `music` prop.

Change the click handler:

```ts
async function startManagerRead(
  subjectId: string,
  subjectType: "music_item" | "music_project",
) {
  try {
    setBriefError(null);
    setBriefPending(true);
    await musicRepository.startManagerRead(subjectId, subjectType);
    await onMusicChanged();
  } catch (error) {
    setBriefError(readErrorMessage(error, "Manager Read could not start."));
  } finally {
    setBriefPending(false);
  }
}
```

- [ ] **Step 4: Add durable polling**

Add an effect scoped to the selected subject:

```ts
useEffect(() => {
  if (
    selected?.managerReadStatus !== "running" &&
    selected?.managerReadStatus !== "refreshing"
  ) return;

  let cancelled = false;
  const poll = async () => {
    if (!cancelled) await onMusicChanged();
  };
  const timer = window.setInterval(() => void poll(), 2000);
  return () => {
    cancelled = true;
    window.clearInterval(timer);
  };
}, [selected?.id, selected?.managerReadStatus, onMusicChanged]);
```

The effect naturally resumes after remount because status comes from the database.

- [ ] **Step 5: Replace the song and project read layouts**

For each detail surface:

- show `managerRead.position` as the read heading;
- show `managementRole` as the role label;
- render `signals` in the existing intelligence grid using `label`, `value`, and `meaning`;
- render `body` with `whitespace-pre-line`;
- render three concise sections labeled `Decision`, `Avoid`, and `Watch`;
- show `confidence` and `confidenceReason`;
- retain the previous v2 content while status is `refreshing` or `refresh_failed`;
- never render v1 fields or fallback generated prose.

Use runtime status labels:

```ts
function managerReadStatusLabel(status: MusicManagerReadStatus) {
  if (status === "fresh") return "Current read";
  if (status === "running") return "Manager is reading";
  if (status === "refreshing") return "Refreshing";
  if (status === "refresh_failed") return "Refresh failed";
  if (status === "failed") return "Read failed";
  if (status === "stale") return "Refresh required";
  return "Not generated";
}
```

- [ ] **Step 6: Run UI tests and build**

Run:

```powershell
npm test -- src/production-app-shell.test.tsx
npm run build
```

Expected: UI tests PASS and build succeeds.

- [ ] **Step 7: Commit the Music UI**

```powershell
git add -- src/features/music/MusicScreens.tsx src/production-app-shell.test.tsx
git commit -m "feat: render and recover music manager read v2"
```

---

### Task 8: Keep new-account setup non-blocking while tracking real read completion

**Files:**

- Modify: `supabase/functions/generate-todays-brief/index.ts`
- Modify: `src/app/ProductionApp.tsx`
- Modify: `src/openai-todays-brief-function.test.ts`
- Modify: `src/paid-workspace-setup-function.test.ts`
- Modify: `src/production-app-shell.test.tsx`

- [ ] **Step 1: Write setup backend tests**

In `src/openai-todays-brief-function.test.ts`, assert:

```ts
expect(functionSource).toContain("readMusicManagerReadRunId");
expect(functionSource).toContain("waitForSetupMusicReadRuns");
expect(functionSource).toContain('status: failures.length ? "completed_with_limits" : "completed"');
expect(functionSource).not.toContain("const results = await dispatchSetupMusicReadsConcurrently");
```

The final assertion should be replaced by an order assertion proving dispatch returns run IDs before the terminal poll:

```ts
const dispatchIndex = functionSource.indexOf("dispatchSetupMusicReadsConcurrently");
const waitIndex = functionSource.indexOf("waitForSetupMusicReadRuns");
expect(waitIndex).toBeGreaterThan(dispatchIndex);
```

In `src/paid-workspace-setup-function.test.ts`, retain and strengthen the existing rule:

```ts
expect(source).toContain('status: "completed"');
expect(source).toContain('music_reads: {');
expect(source).toContain('status: hasMusicReadTargets ? "running" : "completed"');
```

This proves workspace activation does not wait for subject reads.

- [ ] **Step 2: Write the frontend non-blocking setup test**

In `src/production-app-shell.test.tsx`, assert that completing Today’s Brief opens Label HQ without waiting for resolved Music reads. The test repository returns music items with `managerReadStatus: "running"`.

Expected assertion:

```ts
expect(await screen.findByTestId("desk-hq")).toBeInTheDocument();
expect(repositories.music.loadMusic).not.toHaveBeenCalledTimes(6);
```

- [ ] **Step 3: Run setup tests and verify they fail**

Run:

```powershell
npm test -- src/openai-todays-brief-function.test.ts src/paid-workspace-setup-function.test.ts src/production-app-shell.test.tsx
```

Expected: new run-ID polling and non-blocking frontend assertions FAIL.

- [ ] **Step 4: Make setup dispatch return run IDs**

Change `dispatchSetupMusicRead` to parse:

```ts
const payload = await response.json();
if (!isRecord(payload) || payload.status !== "processing" || typeof payload.runId !== "string") {
  throw new Error(`Setup music Manager Read ${target.subjectType}:${target.subjectId} returned an invalid run.`);
}
return { target, runId: payload.runId };
```

`dispatchSetupMusicReadsConcurrently` returns successful `{ target, runId }` entries and dispatch failures separately.

- [ ] **Step 5: Poll terminal run state before closing the setup substage**

Add:

```ts
async function waitForSetupMusicReadRuns(
  db: any,
  dispatched: Array<{ target: SetupMusicReadTarget; runId: string }>,
) {
  const pending = new Map(dispatched.map((item) => [item.runId, item.target]));
  const failures: Array<{ target: SetupMusicReadTarget; error: string }> = [];

  for (let attempt = 0; attempt < 45 && pending.size; attempt += 1) {
    const { data, error } = await db
      .from("manager_synthesis_runs")
      .select("id,status,error")
      .in("id", [...pending.keys()]);
    if (error) throw error;

    for (const row of data ?? []) {
      if (row.status === "completed" || row.status === "completed_with_limits") {
        pending.delete(row.id);
      } else if (row.status === "failed" || row.status === "cancelled") {
        failures.push({
          target: pending.get(row.id)!,
          error: readString(row.error) ?? "Music Manager Read failed.",
        });
        pending.delete(row.id);
      }
    }
    if (pending.size) await delay(2000);
  }

  for (const [runId, target] of pending) {
    failures.push({ target, error: `Music Manager Read ${runId} is still processing.` });
  }
  return failures;
}
```

Combine dispatch failures and terminal failures before updating `workspace_setup_runs.stage_status.music_reads`.

- [ ] **Step 6: Stop blocking the frontend setup transition**

In `src/app/ProductionApp.tsx`, remove:

```ts
await refreshSetupMusicReadTargets(setupMusicReadTargetsFromGenerationResult(setupGeneration));
```

Delete `refreshSetupMusicReadTargets` and its six-attempt polling helper if it has no remaining call sites. The workspace enters Label HQ immediately after the setup brief succeeds.

- [ ] **Step 7: Run setup tests**

Run:

```powershell
npm test -- src/openai-todays-brief-function.test.ts src/paid-workspace-setup-function.test.ts src/production-app-shell.test.tsx
```

Expected: setup tests PASS.

- [ ] **Step 8: Commit setup integration**

```powershell
git add -- supabase/functions/generate-todays-brief/index.ts src/app/ProductionApp.tsx src/openai-todays-brief-function.test.ts src/paid-workspace-setup-function.test.ts src/production-app-shell.test.tsx
git commit -m "fix: track background music reads without blocking setup"
```

---

### Task 9: Run cross-product regression and remove all live legacy references

**Files:**

- Modify only files identified by failing tests or the legacy-reference scan.

- [ ] **Step 1: Scan live source for removed fields and duplicate orchestration**

Run:

```powershell
rg -n --hidden --glob '!node_modules' --glob '!docs/**' "whatMatters|doNotDoYet|missingProof|evidenceIdsUsed|sourcePanelNote|snapshotSummary|intelligenceSnapshot|generationState|callOpenAIManagerReadWithRetry|invokeManagerReadGeneration" src supabase
```

Expected: no live Music Manager Read v1 references. References belonging exclusively to Today’s Brief are allowed only for `snapshotSummary`, `intelligenceSnapshot`, and its own claim audit.

Run:

```powershell
rg -n "generateMusicSummary|managerReadState|situationLine|watchNext" src
```

Expected: no production Music Manager Read call sites or runtime state using the old names. Any separate prototype-only type must not import `MusicObjectViewModel`.

- [ ] **Step 2: Run the focused backend suite**

Run:

```powershell
npm test -- src/music-manager-read-v2-schema.test.ts src/music-manager-read-v2-workflow.test.ts src/openai-music-summary-function.test.ts src/chartmetric-client.test.ts src/chartmetric-evidence.test.ts src/chartmetric-track-enrichment-function.test.ts src/chartmetric-project-enrichment-function.test.ts src/openai-todays-brief-function.test.ts src/paid-workspace-setup-function.test.ts
```

Expected: all selected tests PASS.

- [ ] **Step 3: Run the focused product suite**

Run:

```powershell
npm test -- src/production-supabase-service.test.ts src/production-app-shell.test.tsx src/supabase-client.test.ts
```

Expected: all selected tests PASS.

- [ ] **Step 4: Run the complete suite**

Run:

```powershell
npm test
```

Expected: the full Vitest suite passes with zero failed tests.

- [ ] **Step 5: Run the production build**

Run:

```powershell
npm run build
```

Expected: Vite completes the production build successfully.

- [ ] **Step 6: Re-run migration verification**

Run:

```powershell
npx supabase db reset
npx supabase db lint
```

Expected: reset succeeds and lint reports no new migration errors.

- [ ] **Step 7: Review the final diff for scope**

Run:

```powershell
git status --short
git diff --stat
git diff --check
```

Expected:

- no uncommitted generated files;
- no whitespace errors;
- no changes to Manager Conversation, Mission Genesis, billing, catalog import, rights, files, or splits.

- [ ] **Step 8: Commit any test-driven cleanup**

If Task 9 required cleanup, stage the explicit paths printed by `git status --short`. For example, if only the Music types and service required cleanup:

```powershell
git add -- src/types/cleanProduction.ts src/services/productionSupabase.ts
git commit -m "test: complete music manager read v2 regression coverage"
```

If no cleanup was required, do not create an empty commit.

---

### Task 10: Deploy in safe order and run production smoke tests

**Files:**

- No source edits unless a smoke test exposes a reproducible defect; return to the relevant test-first task before patching.

- [ ] **Step 1: Record the pre-deploy baseline**

Capture:

- current frontend deployment/version;
- current `generate-music-summary`, `generate-todays-brief`, Chartmetric track and project function deployments;
- count of active legacy Music Manager Read runs;
- count of current v1 song/project outputs;
- one controlled test workspace, song and project ID.

Use read-only Supabase queries and save the values in the deployment task notes, not in the repository.

- [ ] **Step 2: Apply the additive migration**

Run:

```powershell
npx supabase db push --linked
```

Expected: migration `20260727000100_music_manager_read_v2.sql` is applied successfully.

Verify with read-only SQL:

```sql
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'manager_synthesis_runs'
  and column_name in ('subject_type', 'subject_id');
```

Expected: two rows.

- [ ] **Step 3: Deploy enrichment-only Chartmetric functions**

Run:

```powershell
npx supabase functions deploy chartmetric-track-enrichment chartmetric-project-enrichment --project-ref bbwbxmnanccwottrmkqu --use-api
```

Expected: both functions deploy successfully. Invoke each once in the controlled workspace and verify its response contains enrichment data but no `manager_read_status`. Verify no OpenAI usage event is created by either invocation.

- [ ] **Step 4: Deploy the setup-aware Today’s Brief function**

Run:

```powershell
npx supabase functions deploy generate-todays-brief --project-ref bbwbxmnanccwottrmkqu --use-api
```

Expected: the function deploys successfully. Do not run a paid setup smoke until the v2 Manager Read backend is deployed.

- [ ] **Step 5: Deploy the v2 Manager Read backend**

Run:

```powershell
npx supabase functions deploy generate-music-summary --project-ref bbwbxmnanccwottrmkqu --use-api
```

Expected: the function deploys successfully. Invoke one controlled song. Expected immediate response:

```json
{ "status": "processing", "runId": "a real UUID returned by the function" }
```

Poll the corresponding run until terminal and verify one current `music-manager-read-v2` output.

- [ ] **Step 6: Deploy the frontend**

Deploy the production build containing the v2 loader, UI and polling:

```powershell
npm run build
npx netlify deploy --prod --dir=dist
```

Expected: Netlify returns the production deployment URL. Open the controlled workspace and verify the current v2 output renders.

- [ ] **Step 7: Execute the production smoke matrix**

Verify:

1. fresh-evidence song skips Chartmetric and produces one OpenAI request;
2. stale/missing-evidence song runs Chartmetric before OpenAI;
3. project read uses tracklist and project-level judgment;
4. browser refresh during generation recovers `Manager is reading...`;
5. duplicate click/request returns the same run ID;
6. a request for a controlled nonexistent subject reaches `failed` without affecting the prior valid subject read; provider-failure injection remains in local automated tests and does not require changing production secrets;
7. new-account setup enters Label HQ after Today’s Brief while music reads remain background work;
8. Manager Conversation can retrieve the completed v2 output through `query_manager_outputs`.

- [ ] **Step 8: Check production database invariants**

Run read-only queries confirming:

```sql
select subject_type, subject_id, count(*)
from public.manager_synthesis_runs
where classification = 'music_manager_read_v2'
  and status in ('queued', 'running')
group by subject_type, subject_id
having count(*) > 1;
```

Expected: zero rows.

```sql
select id, subject_type, subject_id, status, started_at
from public.manager_synthesis_runs
where classification = 'music_manager_read_v2'
  and status in ('queued', 'running')
  and started_at < now() - interval '5 minutes';
```

Expected: zero rows after stale reconciliation.

```sql
select subject_type, subject_id, count(*)
from public.manager_outputs
where schema_version = 'music-manager-read-v2'
  and is_current = true
group by subject_type, subject_id
having count(*) > 1;
```

Expected: zero rows.

Check tested usage rows: `provider_request_count` is normally one and never exceeds two.

- [ ] **Step 9: Monitor and close the release**

For the initial production window, inspect:

- function failures;
- active runs older than five minutes;
- OpenAI request counts;
- setup `music_reads` substages;
- frontend error reports.

If a production defect appears, reproduce it with a failing automated test before changing code. Roll back the frontend and `generate-music-summary` deployment together if the defect affects the core read path; the additive database migration can remain.

---

## Final definition of done

- Chartmetric enrichment never calls OpenAI.
- One subject has at most one active Manager Read v2 run.
- Browser refresh does not interrupt or lose the operation.
- OpenAI uses the Manager Conversation model route and medium reasoning.
- One generation uses one provider request normally and two at absolute maximum.
- Only the v2 contract is parsed and rendered.
- Legacy v1 outputs are hidden and require refresh.
- A failed refresh preserves the previous successful v2 read.
- Today’s Brief unlocks a new account without waiting for song/project reads.
- Setup accurately tracks background music-read completion.
- Manager Conversation can retrieve the new output through existing `manager_outputs`.
- Targeted tests, full tests, production build, database reset/lint, local smoke and production smoke all pass.
