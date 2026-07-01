import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildManagerConversationInstructions,
  managerConversationJsonSchema,
  parseManagerConversationOutput,
} from "../supabase/functions/_shared/openaiManagerConversation";
import { getPlaybooksInstructions } from "../supabase/functions/_shared/manager-intelligence/playbooks/playbookDefinitions";

const functionPath = join(process.cwd(), "supabase", "functions", "manager-conversation", "index.ts");
const functionSource = existsSync(functionPath) ? readFileSync(functionPath, "utf8") : "";
const streamFunctionPath = join(process.cwd(), "supabase", "functions", "manager-conversation-stream", "index.ts");
const streamFunctionSource = existsSync(streamFunctionPath) ? readFileSync(streamFunctionPath, "utf8") : "";
const graphPersistencePath = join(process.cwd(), "supabase", "functions", "_shared", "missionGraphPersistence.ts");
const graphPersistenceSource = existsSync(graphPersistencePath) ? readFileSync(graphPersistencePath, "utf8") : "";
const serviceRoleGrantMigrationPath = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260626000100_manager_conversation_service_role_grants.sql",
);

describe("OpenAI Manager Conversation Router", () => {
  it("has a deployed Edge Function contract for authenticated Manager chat routing", () => {
    expect(existsSync(functionPath)).toBe(true);
    expect(functionSource).toContain("Deno.serve");
    expect(functionSource).toContain("auth.getUser()");
    expect(functionSource).toContain("is_account_member");
    expect(functionSource).toContain("/v1/responses");
    expect(functionSource).toContain("managerConversationJsonSchema");
    expect(functionSource).toContain("buildManagerConversationPacket");
    expect(functionSource).toContain("conversation_messages");
    expect(functionSource).toContain("manager_synthesis_runs");
    expect(functionSource).toContain("manager_run_actions");
    expect(functionSource).toContain("memory_entries");
    expect(functionSource).not.toContain("InvestigationScreen");
  });

  it("adds a streaming Manager conversation Edge Function for agent-console chat UX", () => {
    expect(existsSync(streamFunctionPath)).toBe(true);
    expect(streamFunctionSource).toContain("Deno.serve");
    expect(streamFunctionSource).toContain("ReadableStream");
    expect(streamFunctionSource).toContain("text/event-stream");
    expect(streamFunctionSource).toContain("conversation.started");
    expect(streamFunctionSource).toContain("run.step");
    expect(streamFunctionSource).toContain("assistant.delta");
    expect(streamFunctionSource).toContain("artifact.changed");
    expect(streamFunctionSource).toContain("conversation.completed");
    expect(streamFunctionSource).toContain("manager_synthesis_runs");
    expect(streamFunctionSource).toContain("conversation_messages");
    expect(streamFunctionSource).toContain("manager_run_actions");
    expect(streamFunctionSource).toContain("memory_entries");
  });

  it("persists Manager mission graph decisions through the full mission plan writer before chat artifacts are emitted", () => {
    expect(streamFunctionSource).toContain("persistManagerMissionGraphDecisions");
    expect(graphPersistenceSource).toContain("missionGraphDecisions");
    expect(graphPersistenceSource).toContain("mission_plan_versions");
    expect(graphPersistenceSource).toContain("mission_plan_checkpoints");
    expect(graphPersistenceSource).toContain("permission_requests");
    expect(graphPersistenceSource).toContain("parentMissionId");
    expect(streamFunctionSource.indexOf("persistManagerMissionGraphDecisions")).toBeLessThan(streamFunctionSource.indexOf("artifact.changed"));
    expect(streamFunctionSource).not.toContain("insertManagerCheckpoint");
    expect(streamFunctionSource).not.toContain("insertManagerTask");
    expect(functionSource).toContain("persistManagerMissionGraphDecisions");
    expect(functionSource).not.toContain("insertManagerCheckpoint");
    expect(functionSource).not.toContain("insertManagerTask");
  });

  it("persists durable decision packages as manager_outputs instead of static Manager Office UI", () => {
    expect(functionSource).toContain("persistDecisionPackageOutput");
    expect(streamFunctionSource).toContain("persistDecisionPackageOutput");
    expect(functionSource).toContain('from("manager_outputs")');
    expect(streamFunctionSource).toContain('from("manager_outputs")');
    expect(functionSource).toContain('output_type: "decision_package"');
    expect(streamFunctionSource).toContain('output_type: "decision_package"');
  });

  it("loads the workspace context needed for a real Manager answer", () => {
    for (const table of [
      "artist_profiles",
      "evidence_items",
      "music_items",
      "music_projects",
      "memory_entries",
      "agent_reports",
      "missions",
      "tasks",
      "conversation_messages",
      "manager_intelligence_packets",
    ]) {
      expect(functionSource).toContain(`selectMany(db, "${table}"`);
    }
  });

  it("grants the server-side router access to conversation, run, action, and memory tables", () => {
    expect(existsSync(serviceRoleGrantMigrationPath)).toBe(true);
    const migration = readFileSync(serviceRoleGrantMigrationPath, "utf8");

    for (const table of [
      "artist_profiles",
      "evidence_items",
      "music_items",
      "music_projects",
      "memory_entries",
      "agent_reports",
      "missions",
      "tasks",
      "manager_intelligence_packets",
      "conversations",
      "conversation_messages",
    ]) {
      expect(migration).toMatch(new RegExp(`grant select on public\\.${table} to service_role`, "i"));
    }

    for (const table of ["conversations", "conversation_messages", "manager_synthesis_runs", "manager_run_actions", "memory_entries", "ai_run_usage_events", "missions", "mission_plan_versions", "mission_plan_checkpoints", "checkpoints", "tasks", "task_steps", "permission_requests", "operating_events"]) {
      expect(migration).toMatch(new RegExp(`grant select, insert, update on public\\.${table} to service_role`, "i"));
    }
  });

  it("prompts Manager chat as a synthesis router, not a generic assistant or evidence-read section", () => {
    const instructions = buildManagerConversationInstructions();

    expect(instructions).toContain("Manager Conversation Router");
    expect(instructions).toContain("prototype-style manager office");
    expect(instructions).toContain("Use the supplied Manager Intelligence packet");
    expect(instructions).toContain("Do not create a separate evidence-read section");
    expect(instructions).toContain("createdWork");
    expect(instructions).not.toContain("OpenAI");
  });

  it("injects clean active playbook lenses into Manager chat instructions", () => {
    const playbookInstructions = getPlaybooksInstructions(["cultural_expansion", "no_engine"]);
    const instructions = buildManagerConversationInstructions(playbookInstructions);

    expect(playbookInstructions).toContain("Cultural Expansion");
    expect(playbookInstructions).toContain("No Engine");
    expect(playbookInstructions).toContain("artist's cultural home base");
    expect(playbookInstructions).not.toContain("â");
    expect(instructions).toContain("ACTIVE MANAGEMENT LENSES");
    expect(instructions).toContain("A useful manager says no.");
  });

  it("loads active playbooks from the latest Manager Intelligence packet in both chat functions", () => {
    expect(functionSource).toContain("internal_only_json");
    expect(streamFunctionSource).toContain("internal_only_json");
    expect(functionSource).toContain("getPlaybooksInstructions");
    expect(streamFunctionSource).toContain("getPlaybooksInstructions");
    expect(functionSource).toContain("latestManagerIntelligencePacket?.internal_only_json");
    expect(streamFunctionSource).toContain("latestManagerIntelligencePacket?.internal_only_json");
  });

  it("uses the shared stateful Manager agent loop instead of one stateless bulk-context model call", () => {
    for (const source of [functionSource, streamFunctionSource]) {
      expect(source).toContain("runManagerAgentLoop");
      expect(source).toContain("executeManagerConversationTool");
      expect(source).toContain("loadPreviousOpenAIResponseId");
      expect(source).toContain("openaiResponseId");
      expect(source).not.toContain('selectMany(db, "evidence_items", "id,source,source_kind,evidence_type,subject_type,subject_id,subject_label,metric_name,metric_value,metric_unit,freshness,confidence,provenance,limitation,raw_ref", input, 240)');
      expect(source).not.toContain('selectMany(db, "music_items", "id,title,item_type,lifecycle_stage,released_at,source_kind,source_limit,metadata", input, 120)');
      expect(source).not.toContain('selectMany(db, "tasks", "id,mission_id,primary_checkpoint_id,title,owner_role,status,purpose,evidence_needed,completion_expectation,risk_if_late", input, 160)');
    }
  });

  it("parses structured Manager conversation output and keeps created work normalized", () => {
    expect(managerConversationJsonSchema.name).toBe("manager_conversation_router_v1");

    const output = parseManagerConversationOutput(JSON.stringify({
      actionPolicy: "answer_only",
      topic: "Budget validation",
      summary: "Manager recommends a capped proof loop.",
      status: "Manager responded",
      confidence: "medium",
      classification: "budget_validation",
      responseBody: "Run a capped proof loop before scaling spend.",
      evidenceIds: ["evidence-1"],
      limitations: ["Private saves are missing."],
      createdWork: [
        {
          type: "music_item",
          title: "North Star",
          body: "Created a music item shell.",
          id: "",
          parentMissionId: "",
          status: "created",
        },
      ],
      missionGraphDecisions: [],
      contextQuestions: [],
      proposedActions: [],
      durableMemory: ["The artist wants to keep spend under $5,000 without approval."],
    }));

    expect(output.createdWork[0]).toEqual({
      type: "music_item",
      title: "North Star",
      body: "Created a music item shell.",
      id: "",
      parentMissionId: "",
      status: "created",
    });
    expect(output.missionGraphDecisions).toEqual([]);
    expect(output.contextQuestions).toEqual([]);
    expect(output.responseBody).toContain("capped proof loop");
    expect(output.actionPolicy).toBe("answer_only");
  });

  it("requires an explicit action policy before Manager conversation writes are applied", () => {
    const schema = managerConversationJsonSchema.schema;
    expect(schema.required).toContain("actionPolicy");
    expect(schema.properties).toHaveProperty("actionPolicy");

    const decisionOutput = parseManagerConversationOutput(JSON.stringify({
      actionPolicy: "create_decision_package",
      topic: "Spend decision",
      summary: "Manager recommends a proof package before spend.",
      status: "Manager responded",
      confidence: "medium",
      classification: "decision_request",
      responseBody: "Create a decision package before approving scale spend.",
      evidenceIds: ["evidence-1"],
      limitations: ["Spend result proof is missing."],
      createdWork: [],
      missionGraphDecisions: [],
      contextQuestions: [],
      proposedActions: [],
      durableMemory: ["Scale spend needs proof first."],
    }));

    expect(decisionOutput.actionPolicy).toBe("create_decision_package");

    expect(() => parseManagerConversationOutput(JSON.stringify({
      topic: "Spend decision",
      summary: "Manager recommends a proof package before spend.",
      status: "Manager responded",
      confidence: "medium",
      classification: "decision_request",
      responseBody: "Create a decision package before approving scale spend.",
      evidenceIds: ["evidence-1"],
      limitations: [],
      createdWork: [],
      missionGraphDecisions: [],
      contextQuestions: [],
      proposedActions: [],
      durableMemory: [],
    }))).toThrow(/actionPolicy/i);
  });

  it("parses full mission graph decisions for Manager mission writes", () => {
    const output = parseManagerConversationOutput(JSON.stringify({
      actionPolicy: "create_mission",
      topic: "Audience mission",
      summary: "Manager will create mission work.",
      status: "Manager responded",
      confidence: "high",
      classification: "mission_creation",
      responseBody: "I created the mission graph.",
      evidenceIds: ["ev-city", "song-focus"],
      limitations: [],
      createdWork: [],
      missionGraphDecisions: [
        {
          outcome: "activate_mission",
          confidence: "high",
          decisionSummary: "Validate the city-led audience before scale.",
          existingMissionId: "",
          reasons: ["The city signal is credible but needs repeat behavior proof."],
          evidenceNeeded: [],
          mission: {
            title: "Prove North Star can hold the London audience",
            objective: "Determine whether London listeners around North Star return or enter an owned audience path before scale spend.",
            reason: "London is the strongest saved public signal, but repeat behavior is still unproven.",
            summary: "A 30-day audience validation mission tied to North Star and London listener proof.",
            patternName: "focus_asset_selection",
            currentRecommendation: "Run the lowest-cost proof loop before committing scale spend.",
            changeConditions: ["Another asset overtakes North Star.", "Private saves prove a different priority."],
            timeline: "30 days",
            sourceRefs: ["ev-city", "song-focus"],
          },
          checkpoints: [
            {
              key: "london_return_signal",
              title: "London return signal",
              question: "Does North Star produce repeat or owned-audience behavior in London?",
              decisionRule: "Continue only if the agreed return or capture signal improves during the review window.",
              requiredEvidence: ["Dated London response baseline"],
              missingEvidence: [],
              sourceRefs: ["ev-city", "song-focus"],
            },
          ],
          tasks: [
            {
              title: "Define the London return-behavior baseline",
              ownerRole: "Manager",
              primaryCheckpointKey: "london_return_signal",
              purpose: "Create the baseline needed to judge whether attention is becoming durable.",
              steps: ["Pull London streaming data for the last 30 days.", "Record the baseline and review threshold."],
              evidenceNeeded: ["London baseline"],
              completionExpectation: "A dated baseline and review threshold are saved.",
              riskIfLate: "The team cannot distinguish movement from noise.",
              sourceRefs: ["ev-city", "song-focus"],
            },
          ],
          permissionRequests: [],
        },
      ],
      contextQuestions: [],
      proposedActions: [],
      durableMemory: [],
    }));

    expect(output.missionGraphDecisions).toHaveLength(1);
    expect(output.missionGraphDecisions[0]).toMatchObject({
      outcome: "activate_mission",
      mission: { title: "Prove North Star can hold the London audience" },
      checkpoints: [expect.objectContaining({ key: "london_return_signal" })],
      tasks: [expect.objectContaining({ primaryCheckpointKey: "london_return_signal" })],
    });
  });

  it("parses Manager context questions without creating mission graph work", () => {
    const output = parseManagerConversationOutput(JSON.stringify({
      actionPolicy: "create_mission",
      topic: "Mission context",
      summary: "Manager needs user-controlled context before creating work.",
      status: "Manager needs context",
      confidence: "medium",
      classification: "mission_context_request",
      responseBody: "I need these answers before I create the mission.",
      evidenceIds: ["ev-city"],
      limitations: ["Budget boundary is missing."],
      createdWork: [],
      missionGraphDecisions: [],
      contextQuestions: [
        {
          key: "budget_boundary",
          question: "What budget should the Manager protect before asking for approval?",
          reason: "Spend limits change the mission tasks and permission boundary.",
          answerKind: "money_range",
          options: [],
        },
      ],
      proposedActions: [],
      durableMemory: [],
    }));

    expect(output.missionGraphDecisions).toEqual([]);
    expect(output.contextQuestions).toEqual([
      expect.objectContaining({
        key: "budget_boundary",
        answerKind: "money_range",
      }),
    ]);
  });

  it("rejects old lightweight Manager work operations for mission and task writes", () => {
    expect(() => parseManagerConversationOutput(JSON.stringify({
      actionPolicy: "create_mission",
      topic: "Audience mission",
      summary: "Manager will create mission work.",
      status: "Manager responded",
      confidence: "high",
      classification: "mission_creation",
      responseBody: "I created the mission and first task.",
      evidenceIds: [],
      limitations: [],
      createdWork: [],
      workOperations: [
        {
          operation: "create_task",
          missionId: "mission-existing",
          taskId: "",
          title: "Confirm city proof",
          body: "Attach the first task.",
          objective: "",
          checkpointTitle: "Audience proof",
          checkpointQuestion: "Is there enough demand to scale?",
          taskPurpose: "Verify city-level signal.",
          ownerRole: "Manager",
          deadline: "2026-07-05",
          priority: 2,
          evidenceNeeded: ["city saves"],
          taskSteps: ["Pull city data", "Summarize decision"],
        },
      ],
      missionGraphDecisions: [],
      contextQuestions: [],
      proposedActions: [],
      durableMemory: [],
    }))).toThrow(/missionGraphDecisions/i);
  });
});
