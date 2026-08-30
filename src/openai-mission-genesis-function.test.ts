import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MISSION_GENESIS_PACKET_VERSION,
  MISSION_GENESIS_PROMPT_VERSION,
  buildMissionGenesisInstructions,
  buildMissionGenesisRepairInstructions,
  parseMissionGenesisOutput,
} from "../supabase/functions/_shared/openaiMissionGenesis";

const functionSource = readFileSync(join(process.cwd(), "supabase", "functions", "mission-genesis", "index.ts"), "utf8");

describe("Mission Genesis grounding contract", () => {
  it("separates frozen evidence, user context, persisted state, inference, and limitations", () => {
    const prompt = buildMissionGenesisInstructions("initial");
    for (const boundary of ["VERIFIED_EVIDENCE", "USER_CONTEXT", "PERSISTED_WORKSPACE_STATE", "PERMITTED_INFERENCE", "MISSING_OR_STALE_INFORMATION"]) {
      expect(prompt).toContain(boundary);
    }
    expect(prompt).toContain(MISSION_GENESIS_PROMPT_VERSION);
    expect(MISSION_GENESIS_PACKET_VERSION).toBe("mission-genesis-packet-v2");
    expect(prompt).toContain("must not become a sourced workspace fact");
  });

  it("persists prompt, packet, and output schema versions on the durable run", () => {
    expect(functionSource).toContain("promptVersion: MISSION_GENESIS_PROMPT_VERSION");
    expect(functionSource).toContain("packetVersion: MISSION_GENESIS_PACKET_VERSION");
    expect(functionSource).toContain("schemaVersion: MISSION_GENESIS_SCHEMA_VERSION");
    expect(functionSource).toContain("buildMissionGenesisModelInput");
  });
});
const graphPersistenceSource = readFileSync(join(process.cwd(), "supabase", "functions", "_shared", "missionGraphPersistence.ts"), "utf8");
const finalizerMigration = readFileSync(join(
  process.cwd(), "supabase", "migrations", "20260728000400_todays_brief_and_mission_finalizers.sql",
), "utf8");
const autonomousCheckpointMigrationPath = join(
  process.cwd(), "supabase", "migrations", "20260803000100_autonomous_checkpoint_work.sql",
);
const autonomousCheckpointMigration = existsSync(autonomousCheckpointMigrationPath)
  ? readFileSync(autonomousCheckpointMigrationPath, "utf8")
  : "";
const taskWorkModeMigrationPath = join(
  process.cwd(), "supabase", "migrations", "20260803000200_task_work_modes.sql",
);
const taskWorkModeMigration = existsSync(taskWorkModeMigrationPath)
  ? readFileSync(taskWorkModeMigrationPath, "utf8")
  : "";
const serviceRoleGrantMigrationPath = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260620000100_mission_genesis_service_role_grants.sql",
);

const packet = {
  artist: { id: "artist-1", name: "Nova Vale", stage: "developing", goals: ["Build a durable London audience"] },
  evidence: [
    { id: "evidence-london", label: "London monthly listeners", value: "42,000", confidence: "medium", limitation: "Public listener signal only" },
  ],
  music: [{ id: "song-midnight", title: "After Midnight", lifecycleStage: "released" }],
  memory: [{ id: "memory-budget", kind: "constraint", content: "Use no more than $5,000 before explicit approval." }],
  existingMissions: [],
};

const blaqbonezPacket = {
  artist: { id: "artist-blaqbonez", name: "Blaqbonez", stage: "established", goals: ["Strengthen artist-level leverage from Chanel"] },
  evidence: [
    { id: "ev-chanel", label: "Chanel (feat. Asake)", value: "public attention", confidence: "medium", limitation: "Does not prove Blaqbonez-level attachment" },
    { id: "ev-public-identity", label: "Blaqbonez public identity", value: "humor, confidence, rap roots", confidence: "low", limitation: "Public web context only" },
    { id: "ev-nigeria", label: "Nigeria market signal", value: "Lagos affinity", confidence: "medium", limitation: "Market signal only" },
  ],
  music: [{ id: "song-chanel", title: "Chanel (feat. Asake)", lifecycleStage: "released" }],
  managerIntelligence: {
    managerIntelligenceMissionSeed: {
      mission_implications: [
        {
          career_condition: "feature_leverage_moment",
          why_it_matters: "The feature can raise Blaqbonez's mainstream perception if the campaign centers him, but it can become Asake-led.",
          best_mission_families: ["Collaboration Strategy", "Artist Identity", "Catalog Song Asset", "PR Narrative"],
          bad_mission_families: ["Generic TikTok Conversion", "Smart URL Setup"],
          possible_missions: ["Turn the Asake feature into Blaqbonez-owned leverage", "Build Blaqbonez's next collaborator map"],
        },
      ],
      do_not_generate_missions_for: ["generic creator pilot", "smart URL mission", "highest-track push"],
    },
  },
  memory: [
    {
      id: "memory-guardrail",
      kind: "mission_guardrail",
      content: "Do not let features become bigger than artist identity. Do not make every mission a creator pilot.",
    },
  ],
  existingMissions: [],
};

function activeOutput() {
  return {
    outcome: "activate_mission",
    confidence: "medium",
    stage: { label: "developing", reason: "Nova Vale has a real London signal around After Midnight, but repeat behavior is not yet proven." },
    decisionSummary: "Organize a London proof loop around After Midnight before any scale decision.",
    reasons: ["London is the strongest saved audience signal and the artist wants durable audience growth."],
    evidenceNeeded: [],
    existingMissionId: "",
    questions: [],
    mission: {
      title: "Prove After Midnight can retain Nova Vale's London audience",
      objective: "Determine whether London listeners around After Midnight return, engage, or enter an owned audience path before approving scale.",
      reason: "The saved London listener signal is material but does not yet prove repeat behavior.",
      summary: "A 30-day London validation mission tied to After Midnight, the artist's audience goal, and the $5,000 approval boundary.",
      patternName: "Audience validation",
      currentRecommendation: "Run the lowest-cost London proof loop first and hold scale spend until the review checkpoint.",
      changeConditions: ["A stronger market signal overtakes London.", "The artist changes the 90-day goal."],
      timeline: "30 days",
      sourceRefs: ["evidence-london", "song-midnight", "memory-budget"],
    },
    checkpoints: [
      {
        key: "london_return_signal",
        title: "London return signal",
        question: "Does After Midnight produce repeat or owned-audience behavior in London?",
        decisionRule: "Continue only if the agreed return or capture signal improves during the review window.",
        managerRead: "London is the strongest available signal, but the packet does not yet prove repeat behavior.",
        nextAction: "Record the agreed London response baseline after the next low-risk test.",
        requiredEvidence: ["A dated London response or capture measure"],
        missingEvidence: [],
        sourceRefs: ["evidence-london", "song-midnight"],
      },
    ],
    tasks: [
      {
        title: "Report the London listening-session response for After Midnight",
        ownerRole: "Artist / team",
        workMode: "artist_action",
        primaryCheckpointKey: "london_return_signal",
        purpose: "Give the Manager an observable London response that is not already available in the packet.",
        steps: [
          "Run the agreed low-risk London listening session for After Midnight.",
          "Record how many invited listeners attended and how they responded to the artist, not only the song.",
          "Report the dated outcome to the Manager for checkpoint review.",
        ],
        evidenceNeeded: ["Current London response baseline"],
        completionExpectation: "A dated baseline and one agreed review metric are saved.",
        riskIfLate: "The team cannot distinguish movement from noise.",
        sourceRefs: ["evidence-london", "song-midnight"],
      },
    ],
    permissionRequests: [],
  };
}

function blaqbonezMixedOutput() {
  return {
    outcome: "activate_mission",
    confidence: "medium",
    stage: { label: "Feature leverage", reason: "Chanel has attention, but Blaqbonez needs artist-level leverage from the Asake feature." },
    decisionSummary: "Define a career thesis and launch a Nigeria creator pilot around Chanel.",
    reasons: ["Chanel is moving and Nigeria is the home market."],
    evidenceNeeded: [],
    existingMissionId: "",
    questions: [],
    mission: {
      title: "Career North Star: Nigeria-first content-led scale using Chanel",
      objective: "Produce a 150-200 word career thesis, assign team owners, and select a 6-week Nigeria creator-led validation pilot using Chanel.",
      reason: "Chanel has enough attention to justify a creator-led pilot after a signed career thesis.",
      summary: "A mixed mission combining Blaqbonez career thesis, do-not-do alignment, team ops, and creator pilot execution.",
      patternName: "Career Architecture / North Star",
      currentRecommendation: "Use Chanel as the test asset for Nigeria creator-led validation.",
      changeConditions: ["Artist rejects the thesis.", "Chanel attention decays."],
      timeline: "6 weeks",
      sourceRefs: ["ev-chanel", "ev-public-identity", "ev-nigeria", "memory-guardrail"],
    },
    checkpoints: [
      {
        key: "career_thesis_signed",
        title: "Career thesis exists and is artist-signed",
        question: "Is the Career Thesis specific enough to guide which opportunities to accept, defer, or reject?",
        decisionRule: "Pass only if the signed thesis can decide accept, reject, delay, or pursue.",
        managerRead: "Blaqbonez needs one clear 90-day position before the feature moment expands the opportunity set.",
        nextAction: "Approve the 90-day position and its do-not-do rules.",
        requiredEvidence: ["Signed career thesis"],
        missingEvidence: [],
        sourceRefs: ["ev-public-identity", "memory-guardrail"],
      },
      {
        key: "creator_pilot_fits_budget",
        title: "Next career unlock improves leverage and fits budget",
        question: "Does the Nigeria creator-led market test improve leverage within budget?",
        decisionRule: "Pass only if the pilot budget and KPIs are approved.",
        managerRead: "The proposed creator pilot is not ready until its budget and success boundary are explicit.",
        nextAction: "Approve or reject the bounded pilot plan.",
        requiredEvidence: ["Pilot budget", "Creator shortlist"],
        missingEvidence: [],
        sourceRefs: ["ev-chanel", "ev-nigeria"],
      },
    ],
    tasks: [
      {
        title: "Draft Career Thesis (Manager)",
        ownerRole: "Manager",
        primaryCheckpointKey: "career_thesis_signed",
        purpose: "Convert artist goal into a tight North Star.",
        steps: [
          "Pull artist profile, explicit goals, and budget context from the packet.",
          "Reference evidence ids in mission.sourceRefs.",
          "Send the thesis and rationale to the artist for written sign-off.",
        ],
        evidenceNeeded: ["Signed career thesis"],
        completionExpectation: "Career thesis exists and is signed.",
        riskIfLate: "Team lacks alignment.",
        sourceRefs: ["ev-public-identity", "memory-guardrail"],
      },
      {
        title: "Team Ops - Assign Owners and Approval Flow",
        ownerRole: "Manager",
        primaryCheckpointKey: "career_thesis_signed",
        purpose: "Ensure every task has a clear owner.",
        steps: [
          "Assign owners for Marketing, Rights/Finance, and Creative.",
          "Populate the permissionRequests queue.",
        ],
        evidenceNeeded: ["Owner list"],
        completionExpectation: "Approval flow exists.",
        riskIfLate: "Execution stalls.",
        sourceRefs: ["memory-guardrail"],
      },
      {
        title: "Select Next Career Unlock - Nigeria Creator-Led Market Test",
        ownerRole: "Marketing",
        primaryCheckpointKey: "creator_pilot_fits_budget",
        purpose: "Turn the thesis into a measurable creator pilot.",
        steps: [
          "Design a 6-week pilot with Shazam uplift and playlist-add proxy KPIs.",
          "Build a 30-creator shortlist with Chanel timestamps.",
        ],
        evidenceNeeded: ["Pilot plan"],
        completionExpectation: "Pilot plan is approved.",
        riskIfLate: "Missed window to capture attention trend.",
        sourceRefs: ["ev-chanel", "ev-nigeria"],
      },
    ],
    permissionRequests: [],
    missionCandidates: [],
  };
}

describe("OpenAI Mission Genesis", () => {
  it("grants the server-side workflow access to every packet and mission graph table it uses", () => {
    expect(existsSync(serviceRoleGrantMigrationPath)).toBe(true);

    const migration = readFileSync(serviceRoleGrantMigrationPath, "utf8");
    for (const table of [
      "artist_profiles",
      "artist_workspaces",
      "evidence_items",
      "music_items",
      "music_projects",
      "source_connections",
      "agent_reports",
    ]) {
      expect(migration).toMatch(new RegExp(`grant select on public\\.${table} to service_role`, "i"));
    }

    for (const table of [
      "manager_synthesis_runs",
      "ai_run_usage_events",
      "manager_run_actions",
      "missions",
    ]) {
      expect(migration).toMatch(new RegExp(`grant select, insert, update on public\\.${table} to service_role`, "i"));
    }

    for (const table of [
      "mission_plan_versions",
      "checkpoints",
      "tasks",
      "manager_context_questions",
      "memory_entries",
    ]) {
      expect(migration).toMatch(new RegExp(`grant select, insert on public\\.${table} to service_role`, "i"));
    }

    for (const table of [
      "mission_plan_checkpoints",
      "permission_requests",
      "manager_context_answers",
      "operating_events",
    ]) {
      expect(migration).toMatch(new RegExp(`grant insert on public\\.${table} to service_role`, "i"));
    }
  });

  it("builds the complete artist packet server-side and gives OpenAI sole authorship of the decision and plan", () => {
    expect(functionSource).toContain("Deno.serve");
    expect(functionSource).toContain("auth.getUser()");
    expect(functionSource).toContain("is_account_member");
    for (const table of ["artist_profiles", "music_items", "music_projects", "evidence_items", "memory_entries", "agent_reports", "missions"]) {
      expect(functionSource).toContain(`selectMany(db, "${table}"`);
    }
    expect(functionSource).toContain("/v1/responses");
    expect(functionSource).toContain("missionGenesisJsonSchema");
    expect(functionSource).toContain('.rpc("finalize_mission_genesis_v2"');
    expect(finalizerMigration).toContain("public.manager_run_actions");
    expect(functionSource).toContain("ai_run_usage_events");
    expect(functionSource).not.toContain("runMissionGenesisDecision");
    expect(functionSource).not.toContain("draftMissionPlan");
  });

  it("runs the OpenAI synthesis in a background task so the request does not hit the 150 second idle timeout", () => {
    expect(functionSource).toContain("scheduleMissionGenesisBackgroundRun");
    expect(functionSource).toContain("EdgeRuntime");
    expect(functionSource).toContain('status: "processing"');
    expect(functionSource).toContain("runId");
    expect(functionSource).toContain("202");
  });

  it("claims an idempotent run before continuation answers or memories are written", () => {
    expect(functionSource).toContain("requestKey");
    expect(functionSource).toContain("hashMissionGenesisAnswerBatch");
    expect(functionSource).toContain('workflow_version: "mission-genesis-v2"');
    expect(functionSource).toContain("claimManagerSynthesisRun");
    expect(functionSource.indexOf("claimManagerSynthesisRun")).toBeLessThan(functionSource.indexOf("persistContextAnswers"));
    expect(functionSource).toContain("mission_genesis_continue_v2");
    expect(functionSource).toContain("idempotency_key");
  });

  it("finishes the validated mission graph through one lease-owned replay-safe transaction", () => {
    expect(functionSource).toContain('.rpc("finalize_mission_genesis_v2"');
    expect(functionSource).not.toContain("await persistDecision(");
    expect(finalizerMigration).toContain("finalize_mission_genesis_v2");
    expect(finalizerMigration).toContain("run_row.lease_token is distinct from current_lease_token");
    expect(finalizerMigration).toContain("Conflicting Mission Genesis finalizer replay");
    for (const table of [
      "manager_run_actions", "missions", "mission_plan_versions", "checkpoints", "tasks", "task_steps",
      "permission_requests", "manager_context_questions", "operating_events", "ai_run_usage_events",
    ]) expect(finalizerMigration).toContain(`public.${table}`);
    expect(finalizerMigration).toContain("action_key = 'mission-genesis-result'");
    expect(finalizerMigration).toContain("to service_role");
  });

  it("persists checkpoint-specific reads and starts no-task checkpoints in watching state", () => {
    expect(graphPersistenceSource).toContain("recommendation: checkpoint.managerRead");
    expect(graphPersistenceSource).toContain("next_action: checkpoint.nextAction");
    expect(graphPersistenceSource).toContain('status: hasBlockingTask ? "waiting" : "watching_signal"');

    expect(existsSync(autonomousCheckpointMigrationPath)).toBe(true);
    expect(autonomousCheckpointMigration).toContain("create or replace function public._apply_mission_genesis_graph_v2");
    expect(autonomousCheckpointMigration).toContain("checkpoint ->> 'managerRead'");
    expect(autonomousCheckpointMigration).toContain("checkpoint ->> 'nextAction'");
    expect(autonomousCheckpointMigration).toContain("'watching_signal'");
  });

  it("persists task participation modes and derives checkpoint waiting state from blocking work", () => {
    expect(graphPersistenceSource).toContain('work_mode: "manager_work"');
    expect(graphPersistenceSource).toContain("await activateHumanTask");
    expect(graphPersistenceSource).toContain("deadline: normalizedDeadline(task.deadline)");
    expect(graphPersistenceSource).toContain('task.workMode !== "manager_work"');
    expect(graphPersistenceSource).not.toContain('task.ownerRole.trim().toLowerCase() !== "manager"');

    expect(existsSync(taskWorkModeMigrationPath)).toBe(true);
    expect(taskWorkModeMigration).toContain("add column if not exists work_mode text");
    expect(taskWorkModeMigration).toContain("tasks_work_mode_check");
    expect(taskWorkModeMigration).toContain("'artist_action', 'collaborative', 'manager_work'");
    expect(taskWorkModeMigration).toContain("completion_mode = 'manager_draft'");
    expect(taskWorkModeMigration).toContain("new.work_mode <> 'manager_work'");
  });

  it("loads the latest Manager Intelligence packet as the strategic source for mission generation", () => {
    expect(functionSource).toContain('selectMany(db, "manager_intelligence_packets"');
    expect(functionSource).toContain("buildManagerIntelligenceMissionContext");
    expect(functionSource).toContain("managerIntelligenceProfileProjection");
    expect(functionSource).toContain("managerIntelligenceMissionSeed");
    expect(functionSource).toContain("managerIntelligenceDomainReads");
    expect(functionSource).toContain("managerIntelligencePublicContext");
    expect(functionSource).toContain("managerIntelligenceOpenDecisions");
    expect(functionSource).toContain("managerIntelligenceDoNotDo");
    expect(functionSource).toContain("profile_projection_json");
    expect(functionSource).toContain("mission_seed_json");
    expect(functionSource).toContain("domain_reads_json");
    expect(functionSource).toContain("public_context_json");
    expect(functionSource).toContain("open_decisions_json");
    expect(functionSource).toContain("do_not_do_json");
    expect(functionSource).toContain("asset_reads_json");
    expect(functionSource).toContain("market_reads_json");
    expect(functionSource).toContain("getMissionPatternRegistry");
    expect(functionSource).toContain("selectMissionPatternsForPacket");
    expect(functionSource).toContain("missionPatternRegistry");
    expect(functionSource).toContain("recommendedMissionPatterns");
  });

  it("keeps Mission Genesis edge packets bounded instead of duplicating raw intelligence payloads", () => {
    expect(functionSource).toContain("MISSION_GENESIS_PACKET_LIMITS");
    expect(functionSource).toContain("owner_role,work_mode,status");
    expect(functionSource).toContain("evidence: 36");
    expect(functionSource).toContain("musicItems: 24");
    expect(functionSource).toContain("tasks: 24");
    expect(functionSource).toContain("stringLength: 420");
    expect(functionSource).toContain("buildManagerIntelligenceMissionContext");
    expect(functionSource).toContain("buildMissionEvidenceContext");
    expect(functionSource).toContain("context_payload: buildMissionGenesisRunAudit");
    expect(functionSource).not.toContain("managerIntelligence,");
    expect(functionSource).not.toContain("managerIntelligenceProfileProjection,");
    expect(functionSource).not.toContain("managerIntelligenceAssetReads:");
    expect(functionSource).not.toContain("managerIntelligenceMarketReads:");
    expect(functionSource).not.toContain("rawRef: row.raw_ref");
    expect(functionSource).not.toContain("latestManagerIntelligencePacket,");
    expect(functionSource).not.toContain("supporting_evidence_json");
    expect(functionSource).not.toContain("context_payload: { mode: input.mode, packet");
  });

  it("does not persist provider-branded checkpoint rationale into mission records", () => {
    expect(functionSource).not.toContain("Authored by OpenAI Mission Genesis");
    expect(graphPersistenceSource).not.toContain("Authored by OpenAI Mission Genesis");
    expect(graphPersistenceSource).toContain("Manager-authored checkpoint grounded in packet refs");
  });

  it("prompts for artist-specific reasoning and all-at-once context questions", () => {
    const initial = buildMissionGenesisInstructions("initial");
    const continuation = buildMissionGenesisInstructions("continuation");

    expect(initial).toContain("Use first-principles artist management judgment");
    expect(initial).toContain("If the mission, checkpoints, or tasks could apply to any random artist");
    expect(initial).toContain("Ask at most one decision-changing user question at a time");
    expect(initial).toContain("Do not create a mission merely because this workflow was invoked");
    expect(initial).toContain("missionPatternRegistry");
    expect(initial).toContain("at most two relevant patterns");
    expect(initial).toContain("If no listed pattern fits");
    expect(initial).toContain("careerConditionDiagnosis");
    expect(initial).toContain("Mission Judge");
    expect(initial).toContain("Do not recommend smart URLs, TikTok conversion, creator pilots, saves, follows, or playlist pushes");
    expect(continuation).toContain("must not ask another round of context questions");
  });

  it("asks OpenAI to repair an invalid structured decision once without creating a local fallback", () => {
    const repair = buildMissionGenesisRepairInstructions(
      "initial",
      "Mission Genesis returned questions for an outcome that does not accept context.",
    );

    expect(repair).toContain("correct your prior structured decision");
    expect(repair).toContain("returned questions for an outcome that does not accept context");
    expect(repair).toContain("Do not replace it with generic work");
    expect(functionSource).toContain("buildMissionGenesisRepairInstructions");
    expect(functionSource).toContain("invalidOutput");
    expect(functionSource).toContain("requestCount: 2");
  });

  it("does not use the safe parser in the production Mission Genesis path after OpenAI repair fails", () => {
    expect(functionSource).not.toContain("parseMissionGenesisOutputSafe");
    expect(functionSource).toContain("throw secondError");
  });

  it("accepts a grounded personalized mission graph", () => {
    const parsed = parseMissionGenesisOutput(activeOutput(), packet, "initial");
    expect(parsed.mission.title).toContain("After Midnight");
    expect(parsed.tasks[0].primaryCheckpointKey).toBe("london_return_signal");
    expect(parsed.tasks[0].workMode).toBe("artist_action");
    const prompt = buildMissionGenesisInstructions("initial");
    expect(prompt).toContain("workMode");
    expect(prompt).not.toContain("at least one checkpoint and at least one task");
  });

  it("accepts a useful checkpoint with a Manager read and no artist task", () => {
    const output = activeOutput() as any;
    output.checkpoints[0].managerRead = "London attention is credible, but the packet does not yet prove repeat artist attachment.";
    output.checkpoints[0].nextAction = "Nothing needed from the artist; keep watching repeat listening and profile movement.";
    output.tasks = [];

    const parsed = parseMissionGenesisOutput(output, packet, "initial");

    expect(parsed.tasks).toEqual([]);
    expect(parsed.checkpoints[0]).toMatchObject({
      managerRead: expect.stringContaining("does not yet prove"),
      nextAction: expect.stringContaining("Nothing needed"),
    });
  });

  it("rejects Manager analysis disguised as a visible task", () => {
    const output = activeOutput() as any;
    output.checkpoints[0].managerRead = "The existing packet supports a cautious hold.";
    output.checkpoints[0].nextAction = "Nothing needed from the artist.";
    output.tasks[0] = {
      ...output.tasks[0],
      ownerRole: "Manager",
      completionMode: "evidence",
      title: "Validate whether attention becomes artist leverage",
      steps: ["Review stream and playlist evidence.", "Issue a continue, pause, or scale recommendation."],
    };

    expect(() => parseMissionGenesisOutput(output, packet, "initial")).toThrow(/Manager analysis.*checkpoint read/i);
  });

  it("rejects a generated upload gate", () => {
    const output = activeOutput() as any;
    output.checkpoints[0].managerRead = "Proceed with limited confidence from available evidence.";
    output.checkpoints[0].nextAction = "Continue the low-risk validation path.";
    output.tasks[0] = { ...output.tasks[0], ownerRole: "Artist / team", completionMode: "evidence" };

    expect(() => parseMissionGenesisOutput(output, packet, "initial")).toThrow(/uploads.*optional/i);
  });

  it("supports multiple mission candidates in one Manager-authored decision", () => {
    const first = activeOutput();
    const second = activeOutput();
    second.mission.title = "Build Nova Vale's London rights-safe live proof around After Midnight";
    second.mission.objective = "Validate whether After Midnight can create a rights-safe London live and creator proof loop without exceeding the $5,000 approval boundary.";
    second.mission.reason = "London has enough signal for a second management workstream, but the budget memory requires a bounded proof loop.";
    second.mission.summary = "A second candidate mission focused on live-market proof, creator capture, and budget discipline.";
    second.mission.patternName = "City live-market validation";
    second.mission.currentRecommendation = "Hold broad spend and test a London live proof path before scale.";
    second.mission.sourceRefs = ["evidence-london", "song-midnight", "memory-budget"];
    second.checkpoints[0].key = "london_live_proof";
    second.checkpoints[0].title = "London live proof";
    second.checkpoints[0].question = "Does After Midnight show enough London live or creator capture proof to justify expansion?";
    second.tasks[0].primaryCheckpointKey = "london_live_proof";
    second.tasks[0].title = "Map London live and creator proof for After Midnight";

    const parsed = parseMissionGenesisOutput({
      ...first,
      missionCandidates: [
        {
          key: "audience_validation",
          outcome: "activate_mission",
          confidence: "medium",
          reasons: first.reasons,
          evidenceNeeded: [],
          questions: [],
          mission: first.mission,
          checkpoints: first.checkpoints,
          tasks: first.tasks,
          permissionRequests: [],
        },
        {
          key: "live_market_validation",
          outcome: "candidate_needs_context",
          confidence: "medium",
          reasons: second.reasons,
          evidenceNeeded: [],
          questions: [
            {
              key: "london_live_owner",
              question: "Who can own the London live proof loop for After Midnight?",
              reason: "Owner capacity decides whether this second candidate should activate.",
              answerKind: "short_text",
              options: [],
            },
          ],
          mission: second.mission,
          checkpoints: [],
          tasks: [],
          permissionRequests: [],
        },
      ],
    }, packet, "initial");

    expect(parsed.missionCandidates).toHaveLength(2);
    expect(parsed.missionCandidates.map((candidate) => candidate.key)).toEqual(["audience_validation", "live_market_validation"]);
    expect(parsed.missionCandidates[0].outcome).toBe("activate_mission");
    expect(parsed.missionCandidates[1].outcome).toBe("candidate_needs_context");
  });

  it("does not fail an activated mission when candidate-context questions leak into top-level questions", () => {
    const activated = activeOutput();
    const contextCandidate = activeOutput();
    contextCandidate.mission.title = "Scope Nova Vale's London live proof before committing After Midnight spend";
    contextCandidate.mission.objective = "Decide whether Nova Vale has the owner capacity and budget boundary to test After Midnight in London live rooms.";
    contextCandidate.mission.reason = "London is a strong signal, but live execution depends on user-controlled owner capacity.";
    contextCandidate.mission.summary = "A context-gated candidate around London live proof, After Midnight, and the $5,000 approval boundary.";
    contextCandidate.mission.patternName = "City live-market validation";
    contextCandidate.mission.currentRecommendation = "Ask for owner and budget context before creating live-market tasks.";
    contextCandidate.mission.sourceRefs = ["evidence-london", "song-midnight", "memory-budget"];

    const leakedQuestions = [
      {
        key: "london_live_owner",
        question: "Who can own Nova Vale's London live proof loop for After Midnight?",
        reason: "Owner capacity decides whether this second candidate should activate.",
        answerKind: "short_text" as const,
        options: [],
      },
    ];

    const parsed = parseMissionGenesisOutput({
      ...activated,
      questions: leakedQuestions,
      missionCandidates: [
        {
          key: "audience_validation",
          outcome: "activate_mission",
          confidence: "medium",
          reasons: activated.reasons,
          evidenceNeeded: [],
          questions: [],
          mission: activated.mission,
          checkpoints: activated.checkpoints,
          tasks: activated.tasks,
          permissionRequests: [],
        },
        {
          key: "live_market_context",
          outcome: "candidate_needs_context",
          confidence: "medium",
          reasons: contextCandidate.reasons,
          evidenceNeeded: [],
          questions: [],
          mission: contextCandidate.mission,
          checkpoints: [],
          tasks: [],
          permissionRequests: [],
        },
      ],
    }, packet, "initial");

    expect(parsed.outcome).toBe("activate_mission");
    expect(parsed.questions).toEqual([]);
    expect(parsed.mission.title).toContain("After Midnight");
    expect(parsed.missionCandidates[1].questions).toHaveLength(1);
  });

  it("accepts a mission candidate when the legacy top-level mission fields are empty", () => {
    const candidate = activeOutput();
    candidate.outcome = "candidate_needs_context";
    candidate.questions = [
      {
        key: "london_owner",
        question: "Who can own Nova Vale's London proof loop for After Midnight?",
        reason: "Owner capacity decides whether this mission should activate.",
        answerKind: "short_text",
        options: [],
      },
    ];
    candidate.checkpoints = [];
    candidate.tasks = [];
    candidate.permissionRequests = [];

    const parsed = parseMissionGenesisOutput({
      outcome: "candidate_needs_context",
      confidence: "medium",
      stage: candidate.stage,
      decisionSummary: "The Manager needs context before activating Nova Vale's London proof loop.",
      reasons: candidate.reasons,
      evidenceNeeded: [],
      existingMissionId: "",
      questions: [],
      mission: {
        title: "",
        objective: "",
        reason: "",
        summary: "",
        patternName: "",
        currentRecommendation: "",
        changeConditions: [],
        timeline: "",
        sourceRefs: [],
      },
      checkpoints: [],
      tasks: [],
      permissionRequests: [],
      missionCandidates: [
        {
          key: "london_proof_context",
          outcome: "candidate_needs_context",
          confidence: "medium",
          reasons: candidate.reasons,
          evidenceNeeded: [],
          questions: candidate.questions,
          mission: candidate.mission,
          checkpoints: [],
          tasks: [],
          permissionRequests: [],
        },
      ],
    }, packet, "initial");

    expect(parsed.mission.objective).toContain("London listeners");
    expect(parsed.questions).toHaveLength(1);
    expect(parsed.missionCandidates[0].key).toBe("london_proof_context");
  });

  it("persists multiple mission candidates instead of dropping every candidate after the first", () => {
    expect(functionSource).toContain('.rpc("finalize_mission_genesis_v2"');
    expect(finalizerMigration).toContain("for candidate in select value from jsonb_array_elements(result_output -> 'missionCandidates') loop");
    expect(finalizerMigration).toContain("mission_ids := mission_ids || coalesce(candidate_result -> 'missionIds'");
    expect(finalizerMigration).toContain("activated_ids := activated_ids || coalesce(candidate_result -> 'activatedMissionIds'");
    expect(finalizerMigration).toContain("candidate_ids := candidate_ids || coalesce(candidate_result -> 'candidateMissionIds'");
    expect(functionSource).toContain("missionIds");
    expect(functionSource).toContain("activatedMissionIds");
    expect(functionSource).toContain("candidateMissionIds");
    expect(functionSource).toContain("primaryMissionId");
  });

  it("rejects the canned audience mission instead of persisting it", () => {
    const output = activeOutput();
    output.mission.title = "Test whether current attention is becoming repeatable audience behavior";
    expect(() => parseMissionGenesisOutput(output, packet, "initial")).toThrow(/generic or retired Mission Genesis copy/i);
  });

  it("rejects invented source references and orphaned tasks", () => {
    const invented = activeOutput();
    invented.mission.sourceRefs = ["not-in-packet"];
    expect(() => parseMissionGenesisOutput(invented, packet, "initial")).toThrow(/source reference/i);

    const orphaned = activeOutput();
    orphaned.tasks[0].primaryCheckpointKey = "missing_checkpoint";
    expect(() => parseMissionGenesisOutput(orphaned, packet, "initial")).toThrow(/checkpoint/i);
  });

  it("rejects a generic plan even when it cites real packet ids", () => {
    const generic = activeOutput();
    generic.mission.title = "Build a stronger audience foundation";
    generic.mission.objective = "Create a repeatable process for audience growth.";
    generic.mission.reason = "Audience growth is valuable for the artist.";
    generic.mission.summary = "A focused audience growth objective with clear review points.";
    generic.checkpoints[0].title = "Audience review";
    generic.checkpoints[0].question = "Is audience growth improving?";
    generic.tasks[0].title = "Define the audience baseline";
    generic.tasks[0].purpose = "Create a baseline for future comparison.";

    expect(() => parseMissionGenesisOutput(generic, packet, "initial")).toThrow(/artist-specific anchor/i);
  });

  it("rejects the current Blaqbonez mission because it mixes career thesis, team ops, and creator pilot work", () => {
    expect(() => parseMissionGenesisOutput(blaqbonezMixedOutput(), blaqbonezPacket, "initial")).toThrow(/mixed career-management objectives/i);
  });

  it("rejects system-facing task steps from visible mission tasks", () => {
    const output = activeOutput();
    output.tasks[0].steps = [
      "Pull artist profile and explicit goals from the packet.",
      "Reference evidence ids in mission.sourceRefs.",
      "Populate permissionRequests queue for approval.",
    ];

    expect(() => parseMissionGenesisOutput(output, packet, "initial")).toThrow(/system support/i);
  });

  it("rejects source-completeness busywork and keeps uploads optional even when a decision is high stakes", () => {
    const output = activeOutput() as any;
    output.mission.title = "Upload Nova Vale private analytics for After Midnight";
    output.mission.objective = "Collect Spotify for Artists and smart-link data for After Midnight before the Manager makes any new recommendation.";
    output.mission.reason = "Private analytics would improve confidence, but the output does not name a specific blocked decision.";
    output.mission.summary = "A data-source completeness mission for Nova Vale and After Midnight.";
    output.mission.patternName = "Data / Source Completeness";
    output.mission.currentRecommendation = "Upload private analytics before the Manager decides anything else.";
    output.mission.timeline = "1 week";
    output.checkpoints = [
      {
        key: "private_source_uploaded",
        title: "Private analytics uploaded",
        question: "Are the private analytics available?",
        decisionRule: "Pass if the source is uploaded; otherwise wait.",
        managerRead: "Public London evidence is available, while private save and return data remain unavailable.",
        nextAction: "Use a conservative spend decision unless the team chooses to add private context.",
        requiredEvidence: ["Spotify for Artists export"],
        missingEvidence: ["Spotify for Artists export"],
        sourceRefs: ["evidence-london", "song-midnight"],
      },
    ];
    output.tasks = [
      {
        title: "Upload Spotify for Artists export for After Midnight",
        ownerRole: "Manager",
        primaryCheckpointKey: "private_source_uploaded",
        purpose: "Add private analytics to improve Manager confidence.",
        steps: [
          "Export Spotify for Artists data for After Midnight.",
          "Upload the export to the workspace.",
        ],
        evidenceNeeded: ["Spotify for Artists export"],
        completionExpectation: "The export is uploaded.",
        completionMode: "evidence",
        riskIfLate: "Manager confidence remains limited.",
        sourceRefs: ["evidence-london", "song-midnight"],
      },
    ];

    expect(() => parseMissionGenesisOutput(output, packet, "initial")).toThrow(/source-completeness mission/i);

    output.mission.objective = "Upload Spotify for Artists and smart-link proof for After Midnight so the team can decide whether to approve the $5,000 London validation spend.";
    output.mission.reason = "The $5,000 London validation spend is blocked until the team can compare public London signal against private save or smart-link proof.";
    output.mission.currentRecommendation = "Request the source upload only because the London spend approval decision is blocked by missing proof.";
    output.checkpoints[0].question = "Is the missing source strong enough to approve or reject the $5,000 London validation spend?";
    output.checkpoints[0].decisionRule = "Approve the spend only if the uploaded source confirms save, return, or smart-link proof; otherwise reject or revise the spend plan.";
    output.tasks[0].ownerRole = "Artist / team";
    output.tasks[0].purpose = "Produce the missing proof needed for the $5,000 London spend approval decision.";
    output.tasks[0].completionExpectation = "The Manager can approve, reject, or revise the $5,000 London spend decision from the uploaded proof.";

    expect(() => parseMissionGenesisOutput(output, packet, "initial")).toThrow(/uploads.*optional/i);
  });

  it("accepts split Blaqbonez missions for positioning and Asake-feature leverage", () => {
    const positioning = blaqbonezMixedOutput();
    positioning.mission.title = "Define Blaqbonez's 90-day career position";
    positioning.mission.objective = "Decide whether Blaqbonez should build toward rap authority, mainstream crossover, personality-led fan ownership, or market expansion over the next 90 days.";
    positioning.mission.reason = "The public identity read shows humor, confidence, and rap roots, while Chanel creates a new mainstream feature-leverage moment.";
    positioning.mission.summary = "A focused Artist Identity mission to decide what Blaqbonez should be known for in this phase before spend scales.";
    positioning.mission.patternName = "Artist Identity";
    positioning.mission.currentRecommendation = "Get artist/team sign-off on a 90-day positioning thesis before approving creator spend.";
    positioning.checkpoints = [
      {
        key: "positioning_thesis_decides",
        title: "90-day position decides real opportunities",
        question: "Can Blaqbonez's 90-day thesis clearly decide what to accept, reject, delay, or pursue?",
        decisionRule: "Pass only if the thesis chooses between rap authority, mainstream crossover, personality-led ownership, and market expansion with accept/reject examples.",
        managerRead: "The current identity evidence supports a clear positioning choice before Chanel activity scales.",
        nextAction: "Approve one 90-day position and its accept/reject examples.",
        requiredEvidence: ["Signed 90-day positioning thesis"],
        missingEvidence: [],
        sourceRefs: ["ev-public-identity", "memory-guardrail"],
      },
    ];
    positioning.tasks = [
      {
        title: "Approve Blaqbonez's 90-day positioning thesis",
        ownerRole: "Artist / team",
        primaryCheckpointKey: "positioning_thesis_decides",
        purpose: "Give the team a decision rule before scaling Chanel activity.",
        steps: [
          "Review the Manager's 90-day thesis across rap authority, mainstream crossover, personality-led ownership, and market expansion.",
          "Choose the position that best matches Blaqbonez's intent and current opportunity set.",
          "Approve the position and its three accept and three reject examples.",
        ],
        evidenceNeeded: ["Signed 90-day positioning thesis"],
        completionExpectation: "The team has a signed position that governs Chanel and the next opportunities.",
        riskIfLate: "Chanel activity may scale without strengthening Blaqbonez's artist identity.",
        sourceRefs: ["ev-public-identity", "memory-guardrail"],
      },
    ];

    const leverage = blaqbonezMixedOutput();
    leverage.mission.title = "Turn the Asake feature into Blaqbonez-owned leverage";
    leverage.mission.objective = "Use Chanel (feat. Asake) to strengthen Blaqbonez's artist-level perception instead of only growing the track's short-term traction.";
    leverage.mission.reason = "The Asake feature can raise mainstream perception, but the mission must prevent the campaign from becoming Asake-led or song-led.";
    leverage.mission.summary = "A focused Collaboration Strategy mission that centers Blaqbonez in Chanel, routes attention into catalog/fan ownership, and defines the next collaborator map.";
    leverage.mission.patternName = "Collaboration Strategy";
    leverage.mission.currentRecommendation = "Frame Chanel content, press, and catalog routing around Blaqbonez-owned leverage before broad spend.";
    leverage.checkpoints = [
      {
        key: "feature_builds_blaqbonez",
        title: "Feature attention strengthens Blaqbonez",
        question: "Is Chanel growth increasing Blaqbonez's profile, catalog movement, or fan language rather than only the song or Asake?",
        decisionRule: "Continue only if review evidence shows Blaqbonez-level attachment; otherwise stop scaling spend and reframe around artist identity.",
        managerRead: "Chanel has attention, but the packet does not yet prove that the attention belongs to Blaqbonez rather than the song or feature.",
        nextAction: "Approve the artist-centered narrative before any broader spend.",
        requiredEvidence: ["Attachment read separating Blaqbonez, Asake, hook, beat, humor, verse, and vibe"],
        missingEvidence: [],
        sourceRefs: ["ev-chanel", "ev-public-identity"],
      },
    ];
    leverage.tasks = [
      {
        title: "Approve the Blaqbonez-centered Chanel narrative",
        ownerRole: "Artist / team",
        primaryCheckpointKey: "feature_builds_blaqbonez",
        purpose: "Separate Blaqbonez-owned leverage from Asake-led or song-only attention.",
        steps: [
          "Review the Manager's read of what public responses attach to in Chanel.",
          "Choose the narrative angle that keeps Blaqbonez at the center of the record.",
          "Approve the narrative before the team uses it in content, press, or catalog routing.",
        ],
        evidenceNeeded: ["Feature attachment map"],
        completionExpectation: "The team knows whether Chanel is building Blaqbonez-level leverage.",
        riskIfLate: "The feature can grow while Blaqbonez's artist identity stays flat.",
        sourceRefs: ["ev-chanel", "ev-public-identity"],
      },
    ];

    const parsed = parseMissionGenesisOutput({
      ...blaqbonezMixedOutput(),
      missionCandidates: [
        {
          key: "blaqbonez_positioning",
          outcome: "activate_mission",
          confidence: "medium",
          reasons: positioning.reasons,
          evidenceNeeded: [],
          questions: [],
          mission: positioning.mission,
          checkpoints: positioning.checkpoints,
          tasks: positioning.tasks,
          permissionRequests: [],
        },
        {
          key: "asake_feature_leverage",
          outcome: "activate_mission",
          confidence: "medium",
          reasons: leverage.reasons,
          evidenceNeeded: [],
          questions: [],
          mission: leverage.mission,
          checkpoints: leverage.checkpoints,
          tasks: leverage.tasks,
          permissionRequests: [],
        },
      ],
    }, blaqbonezPacket, "initial");

    expect(parsed.missionCandidates.map((candidate) => candidate.mission.title)).toEqual([
      "Define Blaqbonez's 90-day career position",
      "Turn the Asake feature into Blaqbonez-owned leverage",
    ]);
  });

  it("rejects another question loop after the user answers the first batch", () => {
    const output = activeOutput();
    output.outcome = "candidate_needs_context";
    output.questions = [{ key: "more_context", question: "Anything else?", reason: "More context", answerKind: "short_text", options: [] }];
    expect(() => parseMissionGenesisOutput(output, packet, "continuation")).toThrow(/another round/i);
  });

  it("fails closed instead of auto-inventing missing mission work", () => {
    const candidate = activeOutput();
    candidate.outcome = "candidate_needs_context";
    candidate.questions = [
      {
        key: "london_owner",
        question: "Who can own the London proof loop for After Midnight?",
        reason: "Owner capacity decides whether the mission should activate.",
        answerKind: "short_text",
        options: [],
      },
    ];
    candidate.checkpoints = [];
    candidate.tasks = [];
    candidate.permissionRequests = [];

    expect(parseMissionGenesisOutput(candidate, packet, "initial").questions.map((question) => question.key)).toEqual(["london_owner"]);

    const activeWithoutPlan = activeOutput();
    activeWithoutPlan.checkpoints = [];
    activeWithoutPlan.tasks = [];
    expect(() => parseMissionGenesisOutput(activeWithoutPlan, packet, "initial")).toThrow(/requires at least one checkpoint/i);
  });

  it("rejects update_existing_mission if it lacks checkpoints, tasks, or mission identity", () => {
    const packetWithMission = {
      ...packet,
      existingMissions: [{ id: "mission-existing-1" }],
    };

    // 1. Missing checkpoints/tasks
    const thinUpdate = activeOutput();
    thinUpdate.outcome = "update_existing_mission";
    thinUpdate.existingMissionId = "mission-existing-1";
    thinUpdate.checkpoints = [];
    thinUpdate.tasks = [];
    expect(() => parseMissionGenesisOutput(thinUpdate, packetWithMission, "initial")).toThrow(/requires a complete revised plan/i);

    // 2. Missing title (assertMissionIdentity failure)
    const missingTitle = activeOutput();
    missingTitle.outcome = "update_existing_mission";
    missingTitle.existingMissionId = "mission-existing-1";
    missingTitle.mission.title = "";
    missingTitle.mission.objective = "Determine whether London listeners around After Midnight return, engage, or enter an owned audience path before approving scale for Nova Vale.";
    expect(() => parseMissionGenesisOutput(missingTitle, packetWithMission, "initial")).toThrow(/missing mission.title/i);

    // 3. Grounded update with a full plan parses successfully
    const validUpdate = activeOutput();
    validUpdate.outcome = "update_existing_mission";
    validUpdate.existingMissionId = "mission-existing-1";
    const parsed = parseMissionGenesisOutput(validUpdate, packetWithMission, "initial");
    expect(parsed.outcome).toBe("update_existing_mission");
    expect(parsed.existingMissionId).toBe("mission-existing-1");
    expect(parsed.mission.title).toContain("After Midnight");
  });
});
