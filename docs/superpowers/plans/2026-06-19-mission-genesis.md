# Mission Genesis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a data-derived Mission Genesis system that decides whether an artist deserves a new mission, asks compact context questions when needed, and creates personalized mission plans without hard-coded release assumptions.

**Architecture:** Mission Genesis is a Manager synthesis workflow, not a template picker. It builds an Artist Operating Packet, classifies artist stage and strategic pressures, generates mission candidates, applies worthiness gates, asks bounded context questions when confidence is not high enough, and only activates missions that are personalized, evidenced, and useful. Candidate missions may exist as controlled draft/candidate records, but they must not appear as active operating work until the missing context is answered and activation gates pass.

## Production Architecture Correction

The deterministic classifier, pressure detector, and mission plan writer described later in this original implementation plan are retired and must not be restored to production. They proved the storage workflow but cannot provide the artist-specific intelligence required by the product.

The production contract is now agentic-first:

1. An authenticated Supabase Edge Function assembles the complete Artist Operating Packet from profile, music, evidence, memory, source state, existing work, and specialist agent reports.
2. OpenAI receives that packet and is the sole author of the stage read, worthiness decision, context questions, mission, checkpoints, tasks, timeline, source references, and permission requests.
3. Local code performs authorization, strict schema validation, evidence-reference validation, duplicate/graph safety checks, and database persistence. It does not select a pressure or draft work.
4. Context questions are asked once as a complete batch. Answers are saved to durable memory and sent back to OpenAI with the full refreshed packet for the final decision.
5. A failed model call or invalid model result is shown as an error. No fallback mission, sample mission, template, or placeholder is created.
6. `no_mission` and `request_evidence` create no active work and render `Mission was not created` with the actual reasoning or evidence gap.

Authoritative implementation files:

- `supabase/functions/mission-genesis/index.ts`
- `supabase/functions/_shared/openaiMissionGenesis.ts`
- `src/services/productionSupabase.ts`

**Tech Stack:** React, TypeScript, Supabase, Postgres RLS, Vitest, existing `ProductionApp` repository abstraction, existing mission/task/checkpoint schema.

---

## Product Standard

This feature is designed for a $1,000/month artist-management product and future enterprise acquisition conversations. The product must not behave like a generic checklist app. It must behave like a management intelligence layer that can explain:

- why a mission exists
- why now
- why this artist gets this mission instead of another artist
- what data supports the recommendation
- what context is missing
- what questions were asked
- what answers became durable memory
- what the mission will not do without permission
- what would change the recommendation
- what each task is supposed to prove
- what each checkpoint decides

The system must know when **not** to create a mission.

## Core Architectural Decision

Context questions should create or attach to a **mission candidate**, not an active mission.

Reasoning:

- A pre-mission gate with no stored candidate loses the Manager's reasoning and makes the system feel like a form.
- An active mission created before context is answered pollutes the workspace with work the Manager is not confident enough to recommend.
- A candidate mission record preserves the detected pressure, possible pattern composition, missing context, evidence limits, and why the Manager paused.
- The candidate can be hidden from the normal active mission list or shown in a controlled "Mission Genesis" review state.
- Existing schema already supports `missions.status = 'candidate'`, `manager_synthesis_runs.context_payload`, `manager_context_answers`, `memory_entries`, and `operating_events`.

So the lifecycle is:

```text
Manager run
  -> artist operating packet
  -> candidate pressures
  -> mission candidate when useful but incomplete
  -> compact context questions
  -> saved answers and memory
  -> second worthiness check
  -> activate mission or decline with reason
```

## Non-Negotiable Principles

- No hard-coded release mission.
- No default mission just because setup completed.
- No generic same-mission-for-every-artist behavior.
- No mission without a stated management pressure.
- No task that is not tied to a checkpoint question.
- No checkpoint that is just a renamed checklist section.
- No external/public/spend/legal/financial action without permission.
- No visible dynamic claim without source, memory, evidence, limitation, or run provenance.
- Agent reports can recommend; only Manager synthesis creates or changes missions.
- User answers become operating context or memory, not automatically source-backed factual evidence.

## Existing App Contracts To Reuse

Read these before implementation:

- `docs/workflows/mission-pattern-contract.md`
- `docs/workflows/mission-creation-and-update.md`
- `docs/workflows/task-result-and-checkpoint-update.md`
- `docs/workflows/prototype-data-lineage-contract.md`
- `docs/workflows/workflow-schema-write-contract.md`
- `docs/workflows/daily-brief-generation.md`
- `docs/workflows/memory-and-learning-contract.md`
- `docs/workflows/schema-relationship-contract.md`

Use existing tables:

- `artist_profiles`
- `music_items`
- `music_projects`
- `music_project_items`
- `music_assets`
- `music_splits`
- `music_distribution_packages`
- `evidence_items`
- `source_snapshots`
- `source_connections`
- `memory_entries`
- `manager_synthesis_runs`
- `manager_run_actions`
- `manager_context_questions`
- `manager_context_answers`
- `agent_reports`
- `agent_notes`
- `missions`
- `mission_subject_links`
- `mission_patterns`
- `mission_pattern_versions`
- `mission_plan_versions`
- `mission_plan_checkpoints`
- `checkpoints`
- `tasks`
- `task_results`
- `checkpoint_state_events`
- `checkpoint_results`
- `reviews`
- `permission_requests`
- `operating_events`
- `ai_run_usage_events`

Do not add schema until the existing schema is proven insufficient.

## The Mission Genesis Mental Model

Mission Genesis answers one question:

> "Given this artist's operating reality, is there a durable management objective worth organizing now?"

The system should return one of five outcomes:

1. **Activate Mission**
   The objective is valuable, personalized, sufficiently supported, not duplicated, and ready to organize.

2. **Create Candidate And Ask Context**
   The objective is probably valuable, but missing user-controlled context changes the recommendation.

3. **Request Evidence Or Source**
   The system lacks proof that cannot be answered by user preference alone.

4. **Update Existing Mission**
   The pressure belongs inside an active mission rather than creating a new mission.

5. **No Mission**
   The signal is not durable, not valuable enough, already covered, too weak, or misaligned.

## Artist Operating Packet

Create a service-layer packet assembled from source-of-truth records. This packet is the foundation of personalization.

Required sections:

```ts
type ArtistOperatingPacket = {
  artist: {
    id: string;
    name: string;
    stage: ArtistStage;
    stageReason: string;
    goals: string[];
    genreContext: string[];
    marketContext: string[];
    positioning: string[];
    constraints: string[];
    doNotDo: string[];
  };
  budget: {
    posture: "unknown" | "none" | "low" | "moderate" | "serious" | "enterprise";
    statedAmount?: number;
    currency?: string;
    source: "profile" | "memory" | "context_answer" | "unknown";
    confidence: "high" | "medium" | "low" | "unknown";
  };
  team: {
    capacity: "unknown" | "solo" | "small_team" | "label_team" | "full_team";
    availableRoles: string[];
    constraints: string[];
  };
  music: {
    songs: Array<{
      id: string;
      title: string;
      lifecycleStage: string;
      readiness: string;
      blockers: string[];
      evidenceSignals: string[];
    }>;
    projects: Array<{
      id: string;
      title: string;
      projectType: string;
      lifecycleStage: string;
      trackCount: number;
      blockers: string[];
      evidenceSignals: string[];
    }>;
  };
  audience: {
    chartmetricScore?: number;
    momentumSignals: string[];
    geographySignals: string[];
    platformSignals: string[];
    sourceLimitations: string[];
  };
  business: {
    rightsRisks: string[];
    metadataRisks: string[];
    distributionRisks: string[];
    revenueSignals: string[];
  };
  memory: {
    durableContext: string[];
    priorDecisions: string[];
    rejectedMoves: string[];
    activeConstraints: string[];
  };
  existingMissions: Array<{
    id: string;
    title: string;
    objective: string;
    status: string;
    patternName?: string;
  }>;
  recentAgentInputs: Array<{
    id: string;
    agentKey: string;
    summary: string;
    confidence: string;
    limitations: string[];
  }>;
  sourceConfidence: {
    strong: string[];
    weak: string[];
    missing: string[];
    stale: string[];
  };
};
```

## Artist Stage Classifier

The stage classifier must be explainable. It should use data, not vibes.

Supported stages:

- `foundation`: profile/catalog/source basics are incomplete or artist has little operating history.
- `developing`: some releases and signals exist, but repeatable audience behavior is not proven.
- `emerging`: visible momentum exists, but the system must still test focus, market, spend, rights, and capacity.
- `breakout`: strong market/platform signals suggest expansion or scaling decisions.
- `established`: significant catalog/audience/leverage exists; work shifts toward portfolio, partnerships, revenue, risk, and team coordination.
- `catalog_legacy`: catalog exploitation, revenue investigation, metadata cleanup, sync, and rights work dominate.

Stage inputs:

- Chartmetric score and trajectory where available
- catalog size
- release recency
- source coverage
- geography signals
- platform signals
- audience consistency
- revenue/business records
- team capacity
- memory and stated goals

The classifier output must include:

```ts
type ArtistStageResult = {
  stage: ArtistStage;
  confidence: "high" | "medium" | "low";
  reasons: string[];
  limitations: string[];
};
```

## Mission Pressure Detection

Mission pressures are not missions. They are candidate reasons to investigate.

Pressure categories:

- `career_architecture`: long-term direction, leverage, sequencing, artist values.
- `positioning`: story, lane, audience thesis, public language, brand posture.
- `focus_asset`: song/project choice, creative asset, catalog focus.
- `release_readiness`: timing, distribution, pitch, content runway, launch readiness.
- `rights_business`: splits, ownership, metadata, statements, legal/financial risk.
- `audience_development`: repeat behavior, direct fan capture, community, comments.
- `market_expansion`: country, city, diaspora, language, scene, cultural bridge.
- `campaign_operations`: content, creator seeding, paid/organic tests, iteration.
- `touring_live`: city demand, routing, venues, promoters, show risk.
- `sync_deals_partnerships`: pitch readiness, brand fit, rights clarity, deal risk.
- `budget_allocation`: spend, hold, test, scale, ROI proxy.
- `data_source_completeness`: missing sources blocking decision quality.
- `team_operations`: owners, capacity, approvals, recurring work.
- `reputation_wellbeing`: public risk, burnout, conflict, sensitive decisions.
- `revenue_investigation`: payouts, royalties, statements, catalog income.

Each pressure should include:

```ts
type MissionPressure = {
  pressureKey: string;
  category: string;
  title: string;
  whyNow: string;
  artistStageFit: string;
  supportingSignals: string[];
  missingContext: string[];
  missingEvidence: string[];
  risksIfIgnored: string[];
  likelyPatterns: string[];
  estimatedTimeline: {
    minDays: number;
    maxDays: number;
    reason: string;
  };
  confidence: "high" | "medium" | "low";
};
```

## Mission Worthiness Gates

Every candidate pressure must pass these gates before becoming an active mission.

### Gate 1: Durable Objective

Pass if the pressure can be stated as a durable management objective that may require multiple actions or review points.

Fail examples:

- one-off notification
- simple answer
- generic advice
- weak signal with no decision attached

### Gate 2: Artist Fit

Pass if the pressure fits the artist's stage, goals, identity, constraints, and memory.

Fail examples:

- recommending paid expansion to a foundation artist with no budget or signal
- recommending a beginner proof-loop to an established artist with stronger business problems
- recommending public positioning that violates a remembered do-not-do rule

### Gate 3: Evidence And Context Sufficiency

Pass if the system has enough data to define the first checkpoint.

If missing source proof, return `request_evidence`.

If missing user-controlled context, create `candidate_needs_context`.

### Gate 4: Coordination Need

Pass if the work needs tasks, checkpoints, dependencies, permissions, review, memory, or multiple roles.

Fail if it should be a single suggested action.

### Gate 5: Duplicate And Overlap

Pass if no active mission already owns the objective.

If overlap exists, return `update_existing_mission`.

### Gate 6: Value And Timing

Pass if the mission can create leverage, reduce risk, unlock a decision, protect the artist, or make material progress within a realistic timeline.

Fail if the timing is wrong, budget/capacity makes it unrealistic, or the mission is lower priority than existing active work.

### Gate 7: Permission Boundary

Pass if internal organization can proceed without pretending external/spend/legal/public approval already exists.

If external action is needed, create permission requests inside the plan; do not execute.

## Context Question Policy

The Manager may ask compact context questions when missing answers would materially change the mission.

Rules:

- Ask 2-5 questions.
- Ask all required questions at once.
- Do not turn every gate into a chat.
- Do not ask questions already answered in profile, memory, source data, or recent conversations.
- Do not ask broad lazy questions.
- Each question must map to a mission decision.
- Each answer must be saved to `manager_context_answers`.
- Durable answers must create or link to `memory_entries`.
- The candidate must record which gates are blocked by missing context.

Good questions:

- "What is the artist optimizing for over the next 90 days: audience growth, revenue, industry leverage, market entry, catalog value, or creative reset?"
- "What budget range can the Manager safely plan around before asking for explicit spend approval?"
- "Can timing move, or is there a fixed public, distributor, contractual, or partner deadline?"
- "Who can actually execute work this month: artist only, small team, label team, or external vendors?"
- "Are there public moves, markets, brands, content styles, or deal types the artist does not want?"

Bad questions:

- "Tell me more about the artist."
- "What are your goals?"
- "What genre are you?"
- "Do you want marketing?"
- "Should I create a mission?"

## Mission Candidate Behavior

When a pressure is promising but context is missing:

- create `manager_synthesis_runs` row with `classification = 'mission_genesis_candidate_needs_context'`
- create a `missions` row with `status = 'candidate'`
- store candidate reasoning in mission fields and run `context_payload`
- create an `operating_events` row with `event_type = 'mission_candidate_created'`
- return compact context questions to the UI
- keep candidate out of active mission counts

Candidate mission fields:

- `title`: candidate title in management language
- `objective`: the possible durable objective
- `reason`: why the Manager paused instead of activating
- `status`: `candidate`
- `summary`: candidate read
- `pattern_name`: composed or primary pattern label
- `pattern_confidence`: current confidence
- `originating_trigger`: `manual_mission_genesis`, `daily_operating_run`, `agent_report`, `task_result`, or `source_change`
- `required_evidence`: source-backed proof needed
- `missing_evidence`: proof gaps
- `current_recommendation`: "Answer context questions before activation" or equivalent
- `change_conditions`: conditions that would activate, decline, or change the candidate

After answers:

- save answers to `manager_context_answers`
- write memory entries for durable answers
- rerun worthiness gates
- either activate the mission, convert candidate to declined/archived, or request evidence

## Mission Activation Behavior

When a mission is activated:

- update or create `missions` with `status = 'active'`
- create `mission_plan_versions` with `status = 'active'`
- create `checkpoints`
- create `mission_plan_checkpoints`
- create `tasks`
- create `permission_requests` when needed
- create `memory_entries`
- create `operating_events`
- create `manager_run_actions`
- write `ai_run_usage_events` for billable AI/provider/tool work

The mission must include:

- objective
- why now
- artist-stage fit
- pattern composition
- supporting signals
- missing evidence
- compact timeline
- current recommendation
- checkpoints as questions
- tasks under checkpoints
- permission boundaries
- review cadence
- success state
- blockage state
- change conditions

## Timeline Policy

The Manager must not default to 7-day plans.

Timeline depends on:

- artist stage
- mission category
- source availability
- release or business deadline
- budget
- team capacity
- rights/legal risk
- dependency count
- review cadence

Default ranges:

- source completeness: 1-14 days
- rights cleanup: 3-30 days
- focus asset validation: 14-45 days
- release readiness: 14-60 days
- content validation: 14-45 days
- campaign review: 7-30 days
- market expansion: 45-120 days
- touring validation: 30-180 days
- revenue investigation: 14-60 days
- positioning/career architecture: 14-45 days for thesis, 90-365 days for execution
- breakout architecture: 90-365 days
- established artist portfolio/partnership strategy: 30-180 days

Generated timelines must explain why.

## Files To Create Or Modify

### Create

- `src/services/missionGenesis/artistOperatingPacket.ts`
  - Builds `ArtistOperatingPacket` from repository data.

- `src/services/missionGenesis/artistStage.ts`
  - Classifies artist stage with reasons and limitations.

- `src/services/missionGenesis/pressureDetection.ts`
  - Detects candidate management pressures from packet.

- `src/services/missionGenesis/worthinessGates.ts`
  - Applies mission-worthiness gates and returns outcome.

- `src/services/missionGenesis/contextQuestions.ts`
  - Generates compact context questions from blocked gates.

- `src/services/missionGenesis/missionPlanDraft.ts`
  - Converts an approved pressure into mission/checkpoint/task/permission write models.

- `src/services/missionGenesis/types.ts`
  - Owns Mission Genesis types.

- `src/services/missionGenesis/index.ts`
  - Public service entrypoint.

- `src/mission-genesis.test.ts`
  - Unit tests for packet, stage, pressure, gates, questions, and generated mission plan.

### Modify

- `src/types/cleanProduction.ts`
  - Add Mission Genesis repository methods and view models.

- `src/services/productionSupabase.ts`
  - Add production Mission Genesis read/write methods using existing tables.

- `src/services/fixtureRepositories.ts`
  - Add fixture Mission Genesis behavior for demo/dev.

- `src/app/ProductionApp.tsx`
  - Add a dev/demo action to run Mission Genesis and display candidate/context/created mission result.

- `src/features/missions/MissionScreens.tsx`
  - Exclude candidate missions from active mission list by default; optionally expose candidate state through a controlled review panel.

- `src/production-app-shell.test.tsx`
  - Add integration coverage for the Mission Genesis demo path.

- `src/production-supabase-service.test.ts`
  - Add repository write/read mapping tests.

## Task 1: Define Mission Genesis Types

**Files:**
- Create: `src/services/missionGenesis/types.ts`
- Test: `src/mission-genesis.test.ts`

- [ ] **Step 1: Write failing type-driven tests**

Create `src/mission-genesis.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { classifyArtistStage } from "./services/missionGenesis/artistStage";
import { applyMissionWorthinessGates } from "./services/missionGenesis/worthinessGates";
import type { ArtistOperatingPacket, MissionPressure } from "./services/missionGenesis/types";

function basePacket(overrides: Partial<ArtistOperatingPacket> = {}): ArtistOperatingPacket {
  return {
    artist: {
      id: "artist-1",
      name: "Test Artist",
      stage: "developing",
      stageReason: "Some released music and early public signals exist.",
      goals: ["Build repeatable audience proof"],
      genreContext: ["Alt-pop"],
      marketContext: ["Lagos"],
      positioning: ["Left-field but accessible"],
      constraints: [],
      doNotDo: [],
    },
    budget: {
      posture: "unknown",
      source: "unknown",
      confidence: "unknown",
    },
    team: {
      capacity: "solo",
      availableRoles: ["artist"],
      constraints: ["No dedicated campaign team confirmed"],
    },
    music: {
      songs: [],
      projects: [],
    },
    audience: {
      momentumSignals: [],
      geographySignals: [],
      platformSignals: [],
      sourceLimitations: [],
    },
    business: {
      rightsRisks: [],
      metadataRisks: [],
      distributionRisks: [],
      revenueSignals: [],
    },
    memory: {
      durableContext: [],
      priorDecisions: [],
      rejectedMoves: [],
      activeConstraints: [],
    },
    existingMissions: [],
    recentAgentInputs: [],
    sourceConfidence: {
      strong: [],
      weak: [],
      missing: [],
      stale: [],
    },
    ...overrides,
  };
}

describe("Mission Genesis", () => {
  it("classifies a foundation artist when source and catalog context are weak", () => {
    const result = classifyArtistStage(basePacket({
      artist: {
        ...basePacket().artist,
        goals: [],
      },
      sourceConfidence: {
        strong: [],
        weak: [],
        missing: ["streaming analytics", "artist goal", "team capacity"],
        stale: [],
      },
    }));

    expect(result.stage).toBe("foundation");
    expect(result.reasons.join(" ")).toContain("missing");
  });

  it("requires compact context instead of activating a valuable but under-specified pressure", () => {
    const pressure: MissionPressure = {
      pressureKey: "market-expansion-london",
      category: "market_expansion",
      title: "Validate whether London deserves focused operating attention",
      whyNow: "Audience geography shows London movement, but intent and budget are unclear.",
      artistStageFit: "Market validation fits a developing artist if the team can run a scoped test.",
      supportingSignals: ["London appears in audience geography"],
      missingContext: ["90-day goal", "budget range", "team capacity"],
      missingEvidence: [],
      risksIfIgnored: ["The team may spend against a weak or misaligned market read."],
      likelyPatterns: ["Market Expansion", "Audience Development"],
      estimatedTimeline: {
        minDays: 30,
        maxDays: 90,
        reason: "Market validation needs enough time to test signal quality and review response.",
      },
      confidence: "medium",
    };

    const result = applyMissionWorthinessGates(basePacket(), pressure);

    expect(result.outcome).toBe("candidate_needs_context");
    expect(result.questionsNeeded.length).toBeGreaterThan(0);
    expect(result.activate).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/mission-genesis.test.ts
```

Expected: fail because `missionGenesis` modules do not exist.

- [ ] **Step 3: Add shared types**

Create `src/services/missionGenesis/types.ts`:

```ts
export type ArtistStage = "foundation" | "developing" | "emerging" | "breakout" | "established" | "catalog_legacy";

export type Confidence = "high" | "medium" | "low" | "unknown";

export type ArtistOperatingPacket = {
  artist: {
    id: string;
    name: string;
    stage: ArtistStage;
    stageReason: string;
    goals: string[];
    genreContext: string[];
    marketContext: string[];
    positioning: string[];
    constraints: string[];
    doNotDo: string[];
  };
  budget: {
    posture: "unknown" | "none" | "low" | "moderate" | "serious" | "enterprise";
    statedAmount?: number;
    currency?: string;
    source: "profile" | "memory" | "context_answer" | "unknown";
    confidence: Confidence;
  };
  team: {
    capacity: "unknown" | "solo" | "small_team" | "label_team" | "full_team";
    availableRoles: string[];
    constraints: string[];
  };
  music: {
    songs: Array<{
      id: string;
      title: string;
      lifecycleStage: string;
      readiness: string;
      blockers: string[];
      evidenceSignals: string[];
    }>;
    projects: Array<{
      id: string;
      title: string;
      projectType: string;
      lifecycleStage: string;
      trackCount: number;
      blockers: string[];
      evidenceSignals: string[];
    }>;
  };
  audience: {
    chartmetricScore?: number;
    momentumSignals: string[];
    geographySignals: string[];
    platformSignals: string[];
    sourceLimitations: string[];
  };
  business: {
    rightsRisks: string[];
    metadataRisks: string[];
    distributionRisks: string[];
    revenueSignals: string[];
  };
  memory: {
    durableContext: string[];
    priorDecisions: string[];
    rejectedMoves: string[];
    activeConstraints: string[];
  };
  existingMissions: Array<{
    id: string;
    title: string;
    objective: string;
    status: string;
    patternName?: string;
  }>;
  recentAgentInputs: Array<{
    id: string;
    agentKey: string;
    summary: string;
    confidence: string;
    limitations: string[];
  }>;
  sourceConfidence: {
    strong: string[];
    weak: string[];
    missing: string[];
    stale: string[];
  };
};

export type ArtistStageResult = {
  stage: ArtistStage;
  confidence: Confidence;
  reasons: string[];
  limitations: string[];
};

export type MissionPressure = {
  pressureKey: string;
  category:
    | "career_architecture"
    | "positioning"
    | "focus_asset"
    | "release_readiness"
    | "rights_business"
    | "audience_development"
    | "market_expansion"
    | "campaign_operations"
    | "touring_live"
    | "sync_deals_partnerships"
    | "budget_allocation"
    | "data_source_completeness"
    | "team_operations"
    | "reputation_wellbeing"
    | "revenue_investigation";
  title: string;
  whyNow: string;
  artistStageFit: string;
  supportingSignals: string[];
  missingContext: string[];
  missingEvidence: string[];
  risksIfIgnored: string[];
  likelyPatterns: string[];
  estimatedTimeline: {
    minDays: number;
    maxDays: number;
    reason: string;
  };
  confidence: Exclude<Confidence, "unknown">;
};

export type ContextQuestion = {
  key: string;
  question: string;
  reason: string;
  answerKind: "short_text" | "single_select" | "multi_select" | "money_range";
  options?: string[];
  memoryKind: "goal" | "constraint" | "preference" | "risk" | "operating_context";
};

export type MissionWorthinessResult = {
  outcome: "activate_mission" | "candidate_needs_context" | "request_evidence" | "update_existing_mission" | "no_mission";
  activate: boolean;
  reasons: string[];
  blockedGates: string[];
  questionsNeeded: ContextQuestion[];
  evidenceNeeded: string[];
  existingMissionId?: string;
};
```

- [ ] **Step 4: Commit**

```bash
git add src/mission-genesis.test.ts src/services/missionGenesis/types.ts
git commit -m "test: define mission genesis contracts"
```

## Task 2: Implement Artist Stage Classification

**Files:**
- Create: `src/services/missionGenesis/artistStage.ts`
- Test: `src/mission-genesis.test.ts`

- [ ] **Step 1: Add classifier implementation**

Create `src/services/missionGenesis/artistStage.ts`:

```ts
import type { ArtistOperatingPacket, ArtistStageResult } from "./types";

export function classifyArtistStage(packet: ArtistOperatingPacket): ArtistStageResult {
  const reasons: string[] = [];
  const limitations: string[] = [];
  const catalogCount = packet.music.songs.length + packet.music.projects.length;
  const strongSignalCount =
    packet.audience.momentumSignals.length +
    packet.audience.geographySignals.length +
    packet.audience.platformSignals.length +
    packet.sourceConfidence.strong.length;
  const missingCriticalContext = packet.sourceConfidence.missing.filter((item) =>
    /goal|stream|analytics|budget|team|source|catalog|rights/i.test(item),
  );

  if (catalogCount === 0 || missingCriticalContext.length >= 3) {
    reasons.push("The artist still has missing operating context or insufficient mapped catalog.");
    return {
      stage: "foundation",
      confidence: missingCriticalContext.length >= 3 ? "high" : "medium",
      reasons,
      limitations: missingCriticalContext,
    };
  }

  if (packet.audience.chartmetricScore && packet.audience.chartmetricScore >= 750 && strongSignalCount >= 4) {
    reasons.push("The artist has strong audience and platform signals that can support expansion decisions.");
    return {
      stage: "breakout",
      confidence: "medium",
      reasons,
      limitations,
    };
  }

  if (packet.audience.chartmetricScore && packet.audience.chartmetricScore >= 600 && strongSignalCount >= 3) {
    reasons.push("The artist has visible momentum, but operating proof still needs structured review.");
    return {
      stage: "emerging",
      confidence: "medium",
      reasons,
      limitations,
    };
  }

  if (catalogCount >= 20 && packet.business.revenueSignals.length > 0) {
    reasons.push("The artist has enough catalog and business signal for catalog or established-artist management work.");
    return {
      stage: "established",
      confidence: "medium",
      reasons,
      limitations,
    };
  }

  reasons.push("The artist has some operating material, but repeatable audience or business leverage is not yet proven.");
  return {
    stage: "developing",
    confidence: "medium",
    reasons,
    limitations,
  };
}
```

- [ ] **Step 2: Run test**

```bash
npm test -- src/mission-genesis.test.ts
```

Expected: fails only because `worthinessGates` is missing.

- [ ] **Step 3: Commit**

```bash
git add src/services/missionGenesis/artistStage.ts src/mission-genesis.test.ts
git commit -m "feat: classify artist operating stage"
```

## Task 3: Implement Context Question Generation And Worthiness Gates

**Files:**
- Create: `src/services/missionGenesis/contextQuestions.ts`
- Create: `src/services/missionGenesis/worthinessGates.ts`
- Test: `src/mission-genesis.test.ts`

- [ ] **Step 1: Add context question generator**

Create `src/services/missionGenesis/contextQuestions.ts`:

```ts
import type { ContextQuestion } from "./types";

export function questionsForMissingContext(missingContext: string[]): ContextQuestion[] {
  const questions: ContextQuestion[] = [];
  const normalized = missingContext.map((item) => item.toLowerCase());

  if (normalized.some((item) => item.includes("90-day") || item.includes("goal") || item.includes("priority"))) {
    questions.push({
      key: "mission_90_day_goal",
      question: "What should the Manager optimize for over the next 90 days?",
      reason: "The mission changes depending on whether the artist needs audience growth, revenue, industry leverage, market entry, catalog value, or creative reset.",
      answerKind: "single_select",
      options: ["Audience growth", "Revenue", "Industry leverage", "Market entry", "Catalog value", "Creative reset"],
      memoryKind: "goal",
    });
  }

  if (normalized.some((item) => item.includes("budget") || item.includes("spend"))) {
    questions.push({
      key: "mission_budget_range",
      question: "What budget range can the Manager plan around before asking for explicit spend approval?",
      reason: "Budget posture controls whether the mission should recommend proof gathering, capped tests, or larger coordinated work.",
      answerKind: "money_range",
      memoryKind: "operating_context",
    });
  }

  if (normalized.some((item) => item.includes("team") || item.includes("capacity") || item.includes("owner"))) {
    questions.push({
      key: "mission_team_capacity",
      question: "Who can actually execute work this month?",
      reason: "The mission timeline and task ownership must match real capacity.",
      answerKind: "single_select",
      options: ["Artist only", "Small team", "Label team", "External vendors available", "Unknown"],
      memoryKind: "constraint",
    });
  }

  if (normalized.some((item) => item.includes("timing") || item.includes("deadline") || item.includes("date"))) {
    questions.push({
      key: "mission_timing_boundary",
      question: "Is timing flexible, or is there a fixed public, distributor, contractual, or partner deadline?",
      reason: "Fixed timing changes what can be safely recommended and which checkpoints must happen first.",
      answerKind: "single_select",
      options: ["Flexible", "Public date fixed", "Distributor deadline fixed", "Contract or partner deadline fixed", "Unknown"],
      memoryKind: "constraint",
    });
  }

  if (normalized.some((item) => item.includes("avoid") || item.includes("boundary") || item.includes("positioning"))) {
    questions.push({
      key: "mission_do_not_do",
      question: "Are there moves, markets, brands, content styles, or deal types the artist does not want right now?",
      reason: "The Manager should not create work that violates artist identity or remembered boundaries.",
      answerKind: "short_text",
      memoryKind: "preference",
    });
  }

  return questions.slice(0, 5);
}
```

- [ ] **Step 2: Add worthiness gates**

Create `src/services/missionGenesis/worthinessGates.ts`:

```ts
import { questionsForMissingContext } from "./contextQuestions";
import type { ArtistOperatingPacket, MissionPressure, MissionWorthinessResult } from "./types";

export function applyMissionWorthinessGates(
  packet: ArtistOperatingPacket,
  pressure: MissionPressure,
): MissionWorthinessResult {
  const reasons: string[] = [];
  const blockedGates: string[] = [];

  if (!pressure.title || !pressure.whyNow || pressure.supportingSignals.length === 0) {
    return {
      outcome: "no_mission",
      activate: false,
      reasons: ["The pressure does not have enough specific signal to become durable managed work."],
      blockedGates: ["durable_objective"],
      questionsNeeded: [],
      evidenceNeeded: [],
    };
  }

  const duplicate = packet.existingMissions.find((mission) =>
    sameObjectiveFamily(mission.objective, pressure.title) || sameObjectiveFamily(mission.title, pressure.title),
  );

  if (duplicate && duplicate.status === "active") {
    return {
      outcome: "update_existing_mission",
      activate: false,
      reasons: [`An active mission already appears to cover this pressure: ${duplicate.title}.`],
      blockedGates: ["duplicate_overlap"],
      questionsNeeded: [],
      evidenceNeeded: [],
      existingMissionId: duplicate.id,
    };
  }

  if (pressure.missingEvidence.length > 0 && pressure.supportingSignals.length < 2) {
    return {
      outcome: "request_evidence",
      activate: false,
      reasons: ["The pressure may matter, but source-backed proof is too weak to define a useful first checkpoint."],
      blockedGates: ["evidence_sufficiency"],
      questionsNeeded: [],
      evidenceNeeded: pressure.missingEvidence,
    };
  }

  const questionsNeeded = questionsForMissingContext(pressure.missingContext);

  if (questionsNeeded.length > 0) {
    return {
      outcome: "candidate_needs_context",
      activate: false,
      reasons: ["The pressure is promising, but user-controlled context could materially change the mission plan."],
      blockedGates: ["context_sufficiency"],
      questionsNeeded,
      evidenceNeeded: pressure.missingEvidence,
    };
  }

  if (!stageCanSupportPressure(packet, pressure)) {
    return {
      outcome: "no_mission",
      activate: false,
      reasons: ["The pressure does not fit the artist's current stage, constraints, or operating capacity."],
      blockedGates: ["artist_fit"],
      questionsNeeded: [],
      evidenceNeeded: [],
    };
  }

  reasons.push("The pressure is durable, artist-specific, evidenced enough to start, and not covered by an active mission.");

  return {
    outcome: "activate_mission",
    activate: true,
    reasons,
    blockedGates: [],
    questionsNeeded: [],
    evidenceNeeded: pressure.missingEvidence,
  };
}

function sameObjectiveFamily(left: string, right: string) {
  const leftTokens = tokenSet(left);
  const rightTokens = tokenSet(right);
  const overlap = [...leftTokens].filter((token) => rightTokens.has(token));
  return overlap.length >= 3;
}

function tokenSet(value: string) {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 3),
  );
}

function stageCanSupportPressure(packet: ArtistOperatingPacket, pressure: MissionPressure) {
  if (packet.artist.stage === "foundation") {
    return ["data_source_completeness", "career_architecture", "positioning", "rights_business", "focus_asset"].includes(pressure.category);
  }

  if (packet.artist.stage === "catalog_legacy") {
    return ["revenue_investigation", "rights_business", "sync_deals_partnerships", "data_source_completeness", "campaign_operations"].includes(pressure.category);
  }

  return true;
}
```

- [ ] **Step 3: Run tests**

```bash
npm test -- src/mission-genesis.test.ts
```

Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add src/services/missionGenesis/contextQuestions.ts src/services/missionGenesis/worthinessGates.ts src/mission-genesis.test.ts
git commit -m "feat: gate mission candidates with context questions"
```

## Task 4: Implement Pressure Detection Without Release Bias

**Files:**
- Create: `src/services/missionGenesis/pressureDetection.ts`
- Test: `src/mission-genesis.test.ts`

- [ ] **Step 1: Add tests for non-release pressures**

Append to `src/mission-genesis.test.ts`:

```ts
import { detectMissionPressures } from "./services/missionGenesis/pressureDetection";

describe("Mission pressure detection", () => {
  it("detects a source completeness pressure before inventing strategic missions for weak packets", () => {
    const pressures = detectMissionPressures(basePacket({
      sourceConfidence: {
        strong: [],
        weak: [],
        missing: ["streaming analytics", "budget posture", "team capacity", "artist goal"],
        stale: [],
      },
    }));

    expect(pressures[0].category).toBe("data_source_completeness");
    expect(pressures[0].title).toContain("source");
  });

  it("detects market expansion when geography signal exists but requires context", () => {
    const pressures = detectMissionPressures(basePacket({
      audience: {
        momentumSignals: ["Monthly listeners increased"],
        geographySignals: ["London audience is rising"],
        platformSignals: [],
        sourceLimitations: [],
      },
    }));

    expect(pressures.some((pressure) => pressure.category === "market_expansion")).toBe(true);
  });
});
```

- [ ] **Step 2: Implement pressure detection**

Create `src/services/missionGenesis/pressureDetection.ts`:

```ts
import type { ArtistOperatingPacket, MissionPressure } from "./types";

export function detectMissionPressures(packet: ArtistOperatingPacket): MissionPressure[] {
  const pressures: MissionPressure[] = [];

  if (packet.sourceConfidence.missing.length >= 3) {
    pressures.push({
      pressureKey: "source-completeness-foundation",
      category: "data_source_completeness",
      title: "Resolve source and context gaps before higher-stakes management work",
      whyNow: "The Manager is missing enough operating context that strategic missions could become generic or unsafe.",
      artistStageFit: "Source completeness is appropriate when proof, goals, budget, or team capacity are missing.",
      supportingSignals: packet.sourceConfidence.missing.map((item) => `Missing: ${item}`),
      missingContext: packet.sourceConfidence.missing.filter((item) => /goal|budget|team|capacity/i.test(item)),
      missingEvidence: packet.sourceConfidence.missing.filter((item) => !/goal|budget|team|capacity/i.test(item)),
      risksIfIgnored: ["The app may recommend work that does not fit the artist or cannot be executed."],
      likelyPatterns: ["Data / Source Completeness", "Career Architecture"],
      estimatedTimeline: {
        minDays: 1,
        maxDays: 14,
        reason: "Source and context setup should be short, but external exports or team answers may take longer than one session.",
      },
      confidence: "high",
    });
  }

  if (packet.audience.geographySignals.length > 0 && packet.artist.stage !== "foundation") {
    pressures.push({
      pressureKey: "market-expansion-signal",
      category: "market_expansion",
      title: "Validate whether a rising market deserves focused operating attention",
      whyNow: "Geography signal exists, but the Manager needs to verify whether it aligns with artist goals, budget, and capacity.",
      artistStageFit: "Market validation fits developing, emerging, breakout, and established artists when audience geography is source-backed.",
      supportingSignals: packet.audience.geographySignals,
      missingContext: missing(packet, ["90-day goal", "budget range", "team capacity"]),
      missingEvidence: packet.sourceConfidence.weak.includes("geography") ? ["strong geography-capable source"] : [],
      risksIfIgnored: ["The team may miss a real market opening or spend against a weak geographic signal."],
      likelyPatterns: ["Market Expansion", "Audience Development", "Budget Allocation"],
      estimatedTimeline: {
        minDays: 45,
        maxDays: 120,
        reason: "Market validation needs enough time to test content, audience quality, and conversion before scaling.",
      },
      confidence: "medium",
    });
  }

  if (packet.business.rightsRisks.length > 0) {
    pressures.push({
      pressureKey: "rights-business-risk",
      category: "rights_business",
      title: "Clear rights and business risks blocking safer artist operations",
      whyNow: "Rights or metadata risk can block distribution, sync, revenue, partnerships, and public commitments.",
      artistStageFit: "Rights cleanup is valuable at every artist stage when business risk affects decisions.",
      supportingSignals: packet.business.rightsRisks,
      missingContext: [],
      missingEvidence: packet.business.rightsRisks,
      risksIfIgnored: ["The artist may make public or commercial moves without enough business safety."],
      likelyPatterns: ["Rights Cleanup", "Data / Source Completeness"],
      estimatedTimeline: {
        minDays: 3,
        maxDays: 30,
        reason: "Rights cleanup depends on collaborator response, documents, and confirmation records.",
      },
      confidence: "medium",
    });
  }

  if (packet.audience.momentumSignals.length > 0 && packet.artist.stage !== "foundation") {
    pressures.push({
      pressureKey: "audience-development-signal",
      category: "audience_development",
      title: "Test whether current attention is becoming repeatable audience behavior",
      whyNow: "Momentum exists, but the Manager must determine whether it is durable enough to shape operating work.",
      artistStageFit: "Audience development fits artists with early or growing public signal.",
      supportingSignals: packet.audience.momentumSignals,
      missingContext: missing(packet, ["90-day goal", "budget range"]),
      missingEvidence: packet.sourceConfidence.missing.filter((item) => /smart|conversion|save|fan|email|link/i.test(item)),
      risksIfIgnored: ["The team may mistake attention for fandom or fail to capture real demand."],
      likelyPatterns: ["Audience Development", "Creator / Content Validation"],
      estimatedTimeline: {
        minDays: 14,
        maxDays: 45,
        reason: "Audience validation needs a short testing window plus reviewable signal.",
      },
      confidence: "medium",
    });
  }

  return pressures.sort((a, b) => scorePressure(b) - scorePressure(a));
}

function missing(packet: ArtistOperatingPacket, items: string[]) {
  return items.filter((item) => {
    if (/goal/i.test(item)) return packet.artist.goals.length === 0;
    if (/budget/i.test(item)) return packet.budget.posture === "unknown";
    if (/team|capacity/i.test(item)) return packet.team.capacity === "unknown";
    return false;
  });
}

function scorePressure(pressure: MissionPressure) {
  return pressure.supportingSignals.length * 2 - pressure.missingEvidence.length - pressure.missingContext.length;
}
```

- [ ] **Step 3: Run tests**

```bash
npm test -- src/mission-genesis.test.ts
```

Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add src/services/missionGenesis/pressureDetection.ts src/mission-genesis.test.ts
git commit -m "feat: detect data-derived mission pressures"
```

## Task 5: Build Mission Plan Drafts From Any Pressure

**Files:**
- Create: `src/services/missionGenesis/missionPlanDraft.ts`
- Test: `src/mission-genesis.test.ts`

- [ ] **Step 1: Add test for generic checkpoint/task generation**

Append to `src/mission-genesis.test.ts`:

```ts
import { draftMissionPlan } from "./services/missionGenesis/missionPlanDraft";

describe("Mission plan drafting", () => {
  it("turns a market expansion pressure into checkpoint questions and tasks without release assumptions", () => {
    const pressure: MissionPressure = {
      pressureKey: "market-expansion-london",
      category: "market_expansion",
      title: "Validate whether London deserves focused operating attention",
      whyNow: "London geography signal appears in the audience packet.",
      artistStageFit: "Market validation fits this developing artist if scoped to proof.",
      supportingSignals: ["London audience is rising"],
      missingContext: [],
      missingEvidence: ["smart-link geography"],
      risksIfIgnored: ["The team may miss a market opening."],
      likelyPatterns: ["Market Expansion", "Audience Development"],
      estimatedTimeline: {
        minDays: 45,
        maxDays: 120,
        reason: "Market validation needs enough time to test signal quality.",
      },
      confidence: "medium",
    };

    const draft = draftMissionPlan(basePacket(), pressure);

    expect(draft.mission.title).toContain("London");
    expect(draft.checkpoints[0].question).toContain("real enough");
    expect(draft.tasks.some((task) => task.title.toLowerCase().includes("geography"))).toBe(true);
    expect(draft.tasks.every((task) => task.primaryCheckpointKey)).toBe(true);
  });
});
```

- [ ] **Step 2: Implement mission plan draft**

Create `src/services/missionGenesis/missionPlanDraft.ts`:

```ts
import type { ArtistOperatingPacket, MissionPressure } from "./types";

export type MissionPlanDraft = {
  mission: {
    title: string;
    objective: string;
    reason: string;
    summary: string;
    patternName: string;
    currentRecommendation: string;
    changeConditions: string[];
    timeline: string;
  };
  checkpoints: Array<{
    key: string;
    title: string;
    question: string;
    decisionRule: string;
    requiredEvidence: string[];
    missingEvidence: string[];
  }>;
  tasks: Array<{
    title: string;
    ownerRole: string;
    primaryCheckpointKey: string;
    purpose: string;
    evidenceNeeded: string[];
    completionExpectation: string;
    riskIfLate: string;
  }>;
  permissionRequests: Array<{
    title: string;
    requestType: "spend" | "external_contact" | "submission" | "public_action" | "legal_financial";
    body: string;
    risk: string;
  }>;
};

export function draftMissionPlan(packet: ArtistOperatingPacket, pressure: MissionPressure): MissionPlanDraft {
  if (pressure.category === "market_expansion") {
    return marketExpansionDraft(packet, pressure);
  }

  if (pressure.category === "data_source_completeness") {
    return sourceCompletenessDraft(packet, pressure);
  }

  if (pressure.category === "rights_business") {
    return rightsBusinessDraft(packet, pressure);
  }

  return genericDraft(packet, pressure);
}

function marketExpansionDraft(packet: ArtistOperatingPacket, pressure: MissionPressure): MissionPlanDraft {
  return {
    mission: baseMission(packet, pressure, "Market Expansion + Audience Development"),
    checkpoints: [
      {
        key: "market_signal_quality",
        title: "Market signal quality",
        question: "Is this market signal real enough to deserve focused operating attention?",
        decisionRule: "Proceed only if source-backed geography or audience evidence supports more than passive attention.",
        requiredEvidence: ["geography-capable audience source", "platform or conversion signal"],
        missingEvidence: pressure.missingEvidence,
      },
      {
        key: "artist_fit_and_positioning",
        title: "Artist fit and positioning",
        question: "Does this market fit the artist's identity, goals, language, culture, and current positioning?",
        decisionRule: "Proceed only if the market test does not flatten the artist or violate remembered boundaries.",
        requiredEvidence: ["artist goal", "positioning memory", "market context"],
        missingEvidence: pressure.missingContext,
      },
      {
        key: "test_design",
        title: "Scoped market test",
        question: "What is the smallest credible test that can prove whether the market deserves more work?",
        decisionRule: "Do not scale spend or external commitments until the test has reviewable signal.",
        requiredEvidence: ["budget posture", "team capacity", "test result"],
        missingEvidence: [],
      },
    ],
    tasks: [
      {
        title: "Verify geography signal quality",
        ownerRole: "Manager",
        primaryCheckpointKey: "market_signal_quality",
        purpose: "Confirm whether the market signal is source-backed and current enough to influence strategy.",
        evidenceNeeded: ["geography-capable audience source"],
        completionExpectation: "A short read on whether the market signal is strong, weak, stale, or unsupported.",
        riskIfLate: "The team may spend time or money around a market that is not actually moving.",
      },
      {
        title: "Define the market test boundary",
        ownerRole: "Manager",
        primaryCheckpointKey: "test_design",
        purpose: "Scope the market test to the artist's budget, team capacity, and positioning.",
        evidenceNeeded: ["budget answer", "team capacity answer", "artist positioning memory"],
        completionExpectation: "A test plan with timeline, owner, proof target, and stop/scale rule.",
        riskIfLate: "The mission may become vague expansion work instead of a controlled proof loop.",
      },
    ],
    permissionRequests: [],
  };
}

function sourceCompletenessDraft(packet: ArtistOperatingPacket, pressure: MissionPressure): MissionPlanDraft {
  return {
    mission: baseMission(packet, pressure, "Data / Source Completeness"),
    checkpoints: [
      {
        key: "critical_context",
        title: "Critical context",
        question: "Does the Manager have enough artist-controlled context to avoid generic missions?",
        decisionRule: "Proceed when goal, budget, team capacity, and key constraints are known or explicitly marked unknown.",
        requiredEvidence: ["artist goal", "budget posture", "team capacity"],
        missingEvidence: pressure.missingContext,
      },
      {
        key: "source_readiness",
        title: "Source readiness",
        question: "Are the required sources connected or uploaded for the next useful management decision?",
        decisionRule: "Proceed when the missing source list is either resolved or converted into explicit limitations.",
        requiredEvidence: pressure.missingEvidence,
        missingEvidence: pressure.missingEvidence,
      },
    ],
    tasks: pressure.missingEvidence.map((source) => ({
      title: `Connect or upload ${source}`,
      ownerRole: "Artist team",
      primaryCheckpointKey: "source_readiness",
      purpose: `Give the Manager enough proof to avoid making generic recommendations about ${source}.`,
      evidenceNeeded: [source],
      completionExpectation: "Source is connected, uploaded, or explicitly marked unavailable.",
      riskIfLate: "Mission creation may stay limited to context gathering and low-confidence recommendations.",
    })),
    permissionRequests: [],
  };
}

function rightsBusinessDraft(packet: ArtistOperatingPacket, pressure: MissionPressure): MissionPlanDraft {
  return {
    mission: baseMission(packet, pressure, "Rights / Business Affairs"),
    checkpoints: [
      {
        key: "rights_risk",
        title: "Rights risk",
        question: "Is ownership, split, metadata, or document risk blocking safer artist operations?",
        decisionRule: "Do not recommend public, commercial, sync, or distribution action until the relevant risk is resolved or explicitly accepted.",
        requiredEvidence: ["split confirmation", "ownership note", "metadata state"],
        missingEvidence: pressure.missingEvidence,
      },
    ],
    tasks: pressure.supportingSignals.map((risk) => ({
      title: `Resolve ${risk}`,
      ownerRole: "Finance/Rights",
      primaryCheckpointKey: "rights_risk",
      purpose: "Reduce business risk before the artist makes higher-stakes moves.",
      evidenceNeeded: [risk],
      completionExpectation: "Risk is confirmed resolved, blocked, or escalated for human/legal review.",
      riskIfLate: "The artist may make public or commercial decisions with unresolved business exposure.",
    })),
    permissionRequests: [
      {
        title: "Human review required before legal or financial conclusion",
        requestType: "legal_financial",
        body: "The Manager can organize evidence and risks, but cannot make binding legal or financial conclusions without approval.",
        risk: "Incorrect rights or finance certainty can expose the artist and team.",
      },
    ],
  };
}

function genericDraft(packet: ArtistOperatingPacket, pressure: MissionPressure): MissionPlanDraft {
  return {
    mission: baseMission(packet, pressure, pressure.likelyPatterns.join(" + ") || "Ad hoc management mission"),
    checkpoints: [
      {
        key: "objective_quality",
        title: "Objective quality",
        question: "Is this objective specific, timely, and aligned enough to organize work?",
        decisionRule: "Proceed only if the objective can produce a clear next action and review rule.",
        requiredEvidence: pressure.supportingSignals,
        missingEvidence: [...pressure.missingContext, ...pressure.missingEvidence],
      },
    ],
    tasks: [
      {
        title: "Prepare first Manager read",
        ownerRole: "Manager",
        primaryCheckpointKey: "objective_quality",
        purpose: "Turn the detected pressure into a concrete operating read with limits.",
        evidenceNeeded: pressure.supportingSignals,
        completionExpectation: "A Manager read that states next action, limitation, and review rule.",
        riskIfLate: "The mission may remain abstract instead of becoming useful work.",
      },
    ],
    permissionRequests: [],
  };
}

function baseMission(packet: ArtistOperatingPacket, pressure: MissionPressure, patternName: string) {
  return {
    title: pressure.title,
    objective: `${pressure.title} for ${packet.artist.name}.`,
    reason: pressure.whyNow,
    summary: `${pressure.artistStageFit} ${pressure.risksIfIgnored[0] ?? ""}`.trim(),
    patternName,
    currentRecommendation: "Organize the work internally, preserve evidence limits, and request permission before external or spend-sensitive action.",
    changeConditions: [
      ...pressure.risksIfIgnored,
      "New source evidence changes confidence.",
      "Artist goal, budget, team capacity, or permission boundary changes.",
    ],
    timeline: `${pressure.estimatedTimeline.minDays}-${pressure.estimatedTimeline.maxDays} days: ${pressure.estimatedTimeline.reason}`,
  };
}
```

- [ ] **Step 3: Run tests**

```bash
npm test -- src/mission-genesis.test.ts
```

Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add src/services/missionGenesis/missionPlanDraft.ts src/mission-genesis.test.ts
git commit -m "feat: draft mission plans from management pressures"
```

## Task 6: Add Public Mission Genesis Entrypoint

**Files:**
- Create: `src/services/missionGenesis/index.ts`
- Test: `src/mission-genesis.test.ts`

- [ ] **Step 1: Add orchestration test**

Append to `src/mission-genesis.test.ts`:

```ts
import { runMissionGenesis } from "./services/missionGenesis";

describe("Mission Genesis orchestration", () => {
  it("returns a candidate with questions when the best pressure needs context", () => {
    const result = runMissionGenesis(basePacket({
      audience: {
        momentumSignals: ["Monthly listeners increased"],
        geographySignals: ["London audience is rising"],
        platformSignals: [],
        sourceLimitations: [],
      },
      budget: {
        posture: "unknown",
        source: "unknown",
        confidence: "unknown",
      },
      team: {
        capacity: "unknown",
        availableRoles: [],
        constraints: [],
      },
    }));

    expect(result.outcome).toBe("candidate_needs_context");
    expect(result.questions.length).toBeGreaterThan(0);
    expect(result.candidate?.title).toContain("market");
  });
});
```

- [ ] **Step 2: Implement orchestration**

Create `src/services/missionGenesis/index.ts`:

```ts
import { classifyArtistStage } from "./artistStage";
import { detectMissionPressures } from "./pressureDetection";
import { applyMissionWorthinessGates } from "./worthinessGates";
import { draftMissionPlan, type MissionPlanDraft } from "./missionPlanDraft";
import type { ArtistOperatingPacket, ContextQuestion, MissionPressure, MissionWorthinessResult } from "./types";

export type MissionGenesisResult = {
  outcome: MissionWorthinessResult["outcome"];
  stage: ReturnType<typeof classifyArtistStage>;
  pressure?: MissionPressure;
  candidate?: MissionPlanDraft["mission"];
  draft?: MissionPlanDraft;
  questions: ContextQuestion[];
  evidenceNeeded: string[];
  reasons: string[];
};

export function runMissionGenesis(packet: ArtistOperatingPacket): MissionGenesisResult {
  const stage = classifyArtistStage(packet);
  const stagedPacket: ArtistOperatingPacket = {
    ...packet,
    artist: {
      ...packet.artist,
      stage: stage.stage,
      stageReason: stage.reasons.join(" "),
    },
  };
  const pressures = detectMissionPressures(stagedPacket);
  const pressure = pressures[0];

  if (!pressure) {
    return {
      outcome: "no_mission",
      stage,
      questions: [],
      evidenceNeeded: [],
      reasons: ["No durable management pressure was strong enough to create or candidate a mission."],
    };
  }

  const worthiness = applyMissionWorthinessGates(stagedPacket, pressure);

  if (worthiness.outcome === "activate_mission") {
    const draft = draftMissionPlan(stagedPacket, pressure);
    return {
      outcome: "activate_mission",
      stage,
      pressure,
      draft,
      questions: [],
      evidenceNeeded: worthiness.evidenceNeeded,
      reasons: worthiness.reasons,
    };
  }

  if (worthiness.outcome === "candidate_needs_context") {
    const draft = draftMissionPlan(stagedPacket, pressure);
    return {
      outcome: "candidate_needs_context",
      stage,
      pressure,
      candidate: draft.mission,
      questions: worthiness.questionsNeeded,
      evidenceNeeded: worthiness.evidenceNeeded,
      reasons: worthiness.reasons,
    };
  }

  return {
    outcome: worthiness.outcome,
    stage,
    pressure,
    questions: worthiness.questionsNeeded,
    evidenceNeeded: worthiness.evidenceNeeded,
    reasons: worthiness.reasons,
  };
}
```

- [ ] **Step 3: Run tests**

```bash
npm test -- src/mission-genesis.test.ts
```

Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add src/services/missionGenesis/index.ts src/mission-genesis.test.ts
git commit -m "feat: orchestrate mission genesis decisions"
```

## Task 7: Wire Repository Contracts

**Files:**
- Modify: `src/types/cleanProduction.ts`
- Modify: `src/services/fixtureRepositories.ts`
- Modify: `src/services/productionSupabase.ts`
- Test: `src/production-supabase-service.test.ts`

- [ ] **Step 1: Add repository types**

Modify `src/types/cleanProduction.ts`:

```ts
export type MissionGenesisQuestionViewModel = {
  key: string;
  question: string;
  reason: string;
  answerKind: "short_text" | "single_select" | "multi_select" | "money_range";
  options?: string[];
};

export type MissionGenesisResultViewModel = {
  outcome: "activate_mission" | "candidate_needs_context" | "request_evidence" | "update_existing_mission" | "no_mission";
  title: string;
  body: string;
  reasons: string[];
  questions: MissionGenesisQuestionViewModel[];
  evidenceNeeded: string[];
  candidateMissionId?: string;
  activatedMissionId?: string;
};

export type MissionGenesisRepository = {
  runMissionGenesis(): Promise<MissionGenesisResultViewModel>;
  answerMissionGenesisContext(input: {
    candidateMissionId: string;
    answers: Array<{ questionKey: string; answer: string }>;
  }): Promise<MissionGenesisResultViewModel>;
};
```

Add `missionGenesis: MissionGenesisRepository;` to `CleanProductionRepositories`.

- [ ] **Step 2: Add fixture repository behavior**

Modify `src/services/fixtureRepositories.ts` so `createFixtureRepositories()` returns `missionGenesis`.

Use fixture behavior:

```ts
missionGenesis: {
  async runMissionGenesis() {
    return {
      outcome: "candidate_needs_context",
      title: "Mission candidate needs context",
      body: "The Manager found a possible audience or market operating pressure, but needs budget, goal, and team capacity before activating mission work.",
      reasons: ["Context could materially change the mission plan."],
      questions: [
        {
          key: "mission_90_day_goal",
          question: "What should the Manager optimize for over the next 90 days?",
          reason: "The mission changes depending on whether the artist needs audience growth, revenue, industry leverage, market entry, catalog value, or creative reset.",
          answerKind: "single_select",
          options: ["Audience growth", "Revenue", "Industry leverage", "Market entry", "Catalog value", "Creative reset"],
        },
        {
          key: "mission_budget_range",
          question: "What budget range can the Manager plan around before asking for explicit spend approval?",
          reason: "Budget posture controls whether the mission recommends proof gathering, capped tests, or larger coordinated work.",
          answerKind: "money_range",
        },
        {
          key: "mission_team_capacity",
          question: "Who can actually execute work this month?",
          reason: "The mission timeline and task ownership must match real capacity.",
          answerKind: "single_select",
          options: ["Artist only", "Small team", "Label team", "External vendors available", "Unknown"],
        },
      ],
      evidenceNeeded: [],
      candidateMissionId: "candidate-fixture-1",
    };
  },
  async answerMissionGenesisContext() {
    return {
      outcome: "activate_mission",
      title: "Mission activated",
      body: "The Manager used the new context to activate a personalized operating mission with checkpoint questions and tasks.",
      reasons: ["The candidate now has enough context to create useful managed work."],
      questions: [],
      evidenceNeeded: [],
      activatedMissionId: "mission-fixture-1",
    };
  },
},
```

- [ ] **Step 3: Add production repository stub backed by existing tables**

Modify `src/services/productionSupabase.ts`:

- `runMissionGenesis()` should initially:
  - insert `manager_synthesis_runs`
  - build a packet from currently loaded profile/music/evidence/missions enough for V1
  - call `runMissionGenesis(packet)`
  - insert candidate mission if outcome is `candidate_needs_context`
  - return view model

- `answerMissionGenesisContext()` should:
  - insert `manager_context_answers`
  - insert `memory_entries` for durable context
  - insert `operating_events`
  - update candidate mission recommendation
  - return an activation-ready result

Do not activate mission records in this task unless tests cover checkpoint/task writes.

- [ ] **Step 4: Add repository tests**

Add tests to `src/production-supabase-service.test.ts` that assert:

- `runMissionGenesis()` inserts `manager_synthesis_runs`
- candidate outcome inserts `missions.status = candidate`
- context answers insert `manager_context_answers`
- durable answers insert `memory_entries`

- [ ] **Step 5: Run tests**

```bash
npm test -- src/production-supabase-service.test.ts src/mission-genesis.test.ts
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add src/types/cleanProduction.ts src/services/fixtureRepositories.ts src/services/productionSupabase.ts src/production-supabase-service.test.ts
git commit -m "feat: add mission genesis repository contract"
```

## Task 8: Add Demo UI Entry Point

**Files:**
- Modify: `src/app/ProductionApp.tsx`
- Modify: `src/features/missions/MissionScreens.tsx`
- Test: `src/production-app-shell.test.tsx`

- [ ] **Step 1: Add integration test**

Add test to `src/production-app-shell.test.tsx`:

```ts
it("runs Mission Genesis, asks compact context questions, and activates after answers", async () => {
  renderProductionAppWithFixtures();

  await userEvent.click(screen.getByRole("button", { name: /missions/i }));
  await userEvent.click(screen.getByRole("button", { name: /run mission genesis/i }));

  expect(await screen.findByText(/mission candidate needs context/i)).toBeInTheDocument();
  expect(screen.getByText(/what should the manager optimize/i)).toBeInTheDocument();

  await userEvent.selectOptions(screen.getByLabelText(/what should the manager optimize/i), "Audience growth");
  await userEvent.type(screen.getByLabelText(/budget range/i), "5000");
  await userEvent.selectOptions(screen.getByLabelText(/who can actually execute/i), "Small team");
  await userEvent.click(screen.getByRole("button", { name: /continue mission genesis/i }));

  expect(await screen.findByText(/mission activated/i)).toBeInTheDocument();
});
```

Adjust helper names to match existing test utilities in the file.

- [ ] **Step 2: Add UI state in `ProductionApp`**

Add state:

```ts
const [missionGenesisResult, setMissionGenesisResult] = useState<MissionGenesisResultViewModel | null>(null);
const [missionGenesisAnswers, setMissionGenesisAnswers] = useState<Record<string, string>>({});
const [isRunningMissionGenesis, setIsRunningMissionGenesis] = useState(false);
```

Add handlers:

```ts
async function runMissionGenesis() {
  setIsRunningMissionGenesis(true);
  try {
    const result = await repositories.missionGenesis.runMissionGenesis();
    setMissionGenesisResult(result);
    setMissionGenesisAnswers({});
  } finally {
    setIsRunningMissionGenesis(false);
  }
}

async function submitMissionGenesisAnswers() {
  if (!missionGenesisResult?.candidateMissionId) return;
  setIsRunningMissionGenesis(true);
  try {
    const result = await repositories.missionGenesis.answerMissionGenesisContext({
      candidateMissionId: missionGenesisResult.candidateMissionId,
      answers: missionGenesisResult.questions.map((question) => ({
        questionKey: question.key,
        answer: missionGenesisAnswers[question.key] ?? "",
      })),
    });
    setMissionGenesisResult(result);
    const nextMissions = await repositories.missions.loadMissions();
    setMissions(nextMissions);
  } finally {
    setIsRunningMissionGenesis(false);
  }
}
```

Pass these props to `MissionsWorkspace`.

- [ ] **Step 3: Add Mission Genesis panel to Missions screen**

Modify `src/features/missions/MissionScreens.tsx` to accept:

```ts
missionGenesisResult: MissionGenesisResultViewModel | null;
missionGenesisAnswers: Record<string, string>;
isRunningMissionGenesis: boolean;
onRunMissionGenesis: () => void;
onMissionGenesisAnswerChange: (key: string, value: string) => void;
onSubmitMissionGenesisAnswers: () => void;
```

Render a top panel:

- button: `Run Mission Genesis`
- candidate/result title and body
- reasons
- questions if present
- submit button: `Continue Mission Genesis`

Keep candidates separate from active missions.

- [ ] **Step 4: Run tests**

```bash
npm test -- src/production-app-shell.test.tsx
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/ProductionApp.tsx src/features/missions/MissionScreens.tsx src/production-app-shell.test.tsx
git commit -m "feat: expose mission genesis demo flow"
```

## Task 9: Activate Missions With Checkpoints And Tasks

**Files:**
- Modify: `src/services/productionSupabase.ts`
- Modify: `src/features/missions/MissionScreens.tsx`
- Test: `src/production-supabase-service.test.ts`
- Test: `src/production-app-shell.test.tsx`

- [ ] **Step 1: Add repository tests for activation writes**

Assert `answerMissionGenesisContext()` can:

- update candidate `missions.status` to `active`
- create `mission_plan_versions.status = active`
- create `checkpoints`
- create `mission_plan_checkpoints`
- create `tasks`
- create `operating_events`
- create `memory_entries`

- [ ] **Step 2: Implement activation writer**

In `productionSupabase.ts`, convert `MissionPlanDraft` into table writes:

```ts
missions.status = "active";
mission_plan_versions.version = 1;
mission_plan_versions.status = "active";
checkpoints.status = "waiting";
tasks.status = "proposed";
tasks.approval_state = "not_required";
```

Every task must have:

- `mission_id`
- `mission_plan_version_id`
- `primary_checkpoint_id`
- `purpose`
- `evidence_needed`
- `completion_expectation`
- `risk_if_late`

- [ ] **Step 3: Extend mission read model**

Modify mission loading to include:

- active plan
- checkpoints
- tasks
- candidate exclusion from active list

If the current `MissionViewModel` is too small, extend it with optional arrays:

```ts
checkpoints?: Array<{
  id: string;
  title: string;
  question: string;
  status: string;
  recommendation?: string;
}>;
tasks?: Array<{
  id: string;
  title: string;
  status: string;
  ownerRole?: string;
  checkpointId?: string;
  purpose?: string;
}>;
```

- [ ] **Step 4: Render dynamic tasks/checkpoints**

Update `MissionScreens.tsx`:

- Tasks panel reads `selected.tasks`.
- Checkpoints panel reads `selected.checkpoints`.
- Empty states are management-language, not setup copy.
- Remove hard-coded release tasks/checkpoints.

- [ ] **Step 5: Run focused tests**

```bash
npm test -- src/production-supabase-service.test.ts src/production-app-shell.test.tsx
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add src/services/productionSupabase.ts src/features/missions/MissionScreens.tsx src/types/cleanProduction.ts src/production-supabase-service.test.ts src/production-app-shell.test.tsx
git commit -m "feat: activate mission genesis plans"
```

## Task 10: Add Task Result And Checkpoint Review Loop

**Files:**
- Modify: `src/types/cleanProduction.ts`
- Modify: `src/services/productionSupabase.ts`
- Modify: `src/features/missions/MissionScreens.tsx`
- Test: `src/production-supabase-service.test.ts`
- Test: `src/production-app-shell.test.tsx`

- [ ] **Step 1: Add repository methods**

Add to `MissionRepository`:

```ts
approveTask(taskId: string): Promise<void>;
completeTask(taskId: string, input: { status: "completed" | "blocked"; note: string }): Promise<MissionViewModel>;
```

- [ ] **Step 2: Add service tests**

Assert completing a task:

- writes `task_state_events`
- writes `task_results`
- updates linked checkpoint status
- writes `operating_events`
- writes `memory_entries`
- returns refreshed mission view model

- [ ] **Step 3: Implement conservative checkpoint update**

Initial deterministic logic:

- If task result is `blocked`, linked checkpoint becomes `needs_revision`.
- If all tasks under checkpoint are completed, checkpoint becomes `ready_for_review`.
- If no task change affects enough proof, checkpoint remains `waiting`.

Do not claim checkpoint is `met` without a review result.

- [ ] **Step 4: Render task actions**

Tasks panel:

- `Approve` button when approval needed.
- `Mark done` with note.
- `Mark blocked` with note.
- Show Manager interpretation after task result.

- [ ] **Step 5: Run tests**

```bash
npm test -- src/production-supabase-service.test.ts src/production-app-shell.test.tsx
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add src/types/cleanProduction.ts src/services/productionSupabase.ts src/features/missions/MissionScreens.tsx src/production-supabase-service.test.ts src/production-app-shell.test.tsx
git commit -m "feat: interpret task results into checkpoint state"
```

## Verification

Run:

```bash
npm test
```

Expected:

- all existing tests pass
- new Mission Genesis unit tests pass
- production service tests pass
- production app shell tests pass

Manual demo path:

1. Start app.
2. Complete setup or use existing workspace.
3. Open Missions.
4. Click `Run Mission Genesis`.
5. Confirm candidate/context/evidence/no-mission outcome.
6. Answer compact questions if shown.
7. Continue Mission Genesis.
8. Confirm active mission is created only after gates pass.
9. Open mission.
10. Confirm tasks are grouped under checkpoint questions.
11. Complete or block a task.
12. Confirm checkpoint and mission state update.

## Success Criteria

- The system can produce a non-release mission from artist data.
- The system can decline to create a mission.
- The system can create a candidate and ask compact questions.
- Context answers become durable memory.
- Active mission creation is evidence/context gated.
- Active missions contain checkpoint questions and tasks.
- Candidate missions do not pollute active mission counts.
- No hard-coded release task/checkpoint remains in production mission UI.
- Mission timelines are realistic and category-dependent.
- Every generated mission/task/checkpoint has a provenance path through run/action/event records.

## Self-Review

- Spec coverage: The plan covers data-derived mission creation, candidate context gates, memory, agent-input boundaries, no release bias, realistic timelines, and task/checkpoint loops.
- Placeholder scan: No task depends on an unspecified "do the right thing" step. Complex production mapping is explicitly scoped to existing schema and tested through repository tests.
- Type consistency: Mission Genesis types are introduced in Task 1 and reused by subsequent modules.
- Scope check: This is large but still one subsystem: Mission Genesis. Future specialized AI prompt/provider work should be a separate plan after deterministic scaffolding works.
