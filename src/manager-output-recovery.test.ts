import { describe, expect, it, vi } from "vitest";
import {
  managerConversationOutputTokenBudget,
  parseManagerConversationOutput,
} from "../supabase/functions/_shared/openaiManagerConversation";
import {
  isRecoverableManagerOutputError,
  runManagerAgentLoop,
} from "../supabase/functions/_shared/manager-conversation/agentLoop";
import { preflightManagerMissionGraphTasks } from "../supabase/functions/_shared/missionGraphPersistence";

const exactRequest = "can you create a day to day mission for content, for everything i need to do to get this song blowing, make it very detailed";

function missionOutput(steps: string[]) {
  return JSON.stringify({
    topic: "Content mission",
    summary: "A bounded content validation route.",
    status: "Manager responded",
    confidence: "high",
    classification: "mission_creation",
    actionPolicy: "create_mission",
    responseBody: "I prepared a focused content mission with a clear daily sequence.",
    evidenceIds: [],
    limitations: [],
    createdWork: [],
    contextQuestions: [],
    proposedActions: [],
    durableMemory: [],
    missionGraphDecisions: [{
      outcome: "activate_mission",
      confidence: "high",
      decisionSummary: "Validate a repeatable content route before scaling.",
      evidenceNeeded: [],
      existingMissionId: "",
      reasons: ["The request needs executable sequencing, not generic promotion advice."],
      mission: {
        title: "Build a repeatable content route",
        objective: "Test a focused content system and decide whether to continue, refine, pause, or scale.",
        reason: "The artist asked for a day-by-day content route.",
        summary: "A bounded content validation mission.",
        patternName: "creator_content_validation",
        currentRecommendation: "Start with the smallest repeatable test and review response before scaling.",
        changeConditions: ["Meaningful response fails to improve."],
        timeline: "14 days",
        sourceRefs: [],
      },
      checkpoints: [{
        key: "content_signal",
        title: "Content response signal",
        question: "Does the content produce meaningful audience response?",
        decisionRule: "Continue only when the agreed response signal improves.",
        managerRead: "Response is not yet proven.",
        nextAction: "Review the dated content results.",
        requiredEvidence: ["Dated response result"],
        missingEvidence: [],
        sourceRefs: [],
      }],
      tasks: [{
        title: "Publish the first content test",
        scheduleKey: "",
        ownerRole: "Artist",
        workMode: "artist_action",
        primaryCheckpointKey: "content_signal",
        purpose: "Run one prepared content test and return an observable result.",
        steps,
        evidenceNeeded: ["A dated post link and observed response"],
        completionExpectation: "The prepared piece is posted and the dated result is reported to Desk.",
        completionMode: "result_note",
        deliverableTitle: "First content test result",
        deliverableRequirements: [],
        managerResponsibility: "Review the result and decide the next test.",
        userResponsibility: "Record and publish the prepared piece, then report the result.",
        riskIfLate: "The learning window slips and response cannot be compared.",
        deadline: "",
        sourceRefs: [],
      }],
      permissionRequests: [],
    }],
  });
}

describe("Manager structured-output recovery", () => {
  it("allocates a larger bounded response budget only for explicit detailed mission requests", () => {
    expect(managerConversationOutputTokenBudget(exactRequest)).toBe(12000);
    expect(managerConversationOutputTokenBudget("What should I focus on this week?")).toBe(6000);
  });

  it("does not silently drop an orphaned mission task from an otherwise valid response", () => {
    const malformed = JSON.parse(missionOutput([
      "Use the prepared hook and record the vertical piece in one take.",
      "Publish it with the agreed caption, then record the link and first response signal.",
    ])) as Record<string, any>;
    malformed.missionGraphDecisions[0].tasks[0].primaryCheckpointKey = "missing-checkpoint";
    expect(() => parseManagerConversationOutput(JSON.stringify(malformed))).toThrow(/mission graph/i);
    expect(isRecoverableManagerOutputError(new Error("Manager conversation mission graph contains an invalid task."))).toBe(true);
  });

  it("repairs the exact detailed-mission request after an incomplete task graph instead of returning a generic failure", async () => {
    const requests: Array<Record<string, unknown>> = [];
    const invalid = missionOutput(["Publish the prepared test."]);
    const valid = missionOutput([
      "Use the prepared hook and record the vertical piece in one take.",
      "Publish it with the agreed caption, then record the link and first response signal.",
    ]);
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      requests.push(body);
      return new Response(JSON.stringify({
        id: `response-${requests.length}`,
        output_text: requests.length === 1 ? invalid : valid,
        usage: { input_tokens: 10, output_tokens: 10 },
      }), { status: 200, headers: { "content-type": "application/json" } });
    });

    const result = await runManagerAgentLoop({
      endpoint: "https://example.test/responses",
      apiKey: "test-key",
      model: "test-model",
      instructions: "Manager",
      context: { userMessage: exactRequest },
      tools: [],
      jsonSchema: { name: "manager", schema: { type: "object" } },
      fetchImpl: fetchImpl as unknown as typeof fetch,
      executeTool: vi.fn(),
      validateOutputText: (outputText) => parseManagerConversationOutput(outputText),
      outputRepairAttempts: 1,
    });

    expect(result.outputText).toBe(valid);
    expect(requests).toHaveLength(2);
    expect((requests[1].previous_response_id as string)).toBe("response-1");
    expect(requests[1].tools).toEqual([]);
    expect(JSON.stringify(requests[1].input)).toMatch(/complete|two distinct|execution steps/i);
  });

  it("repairs truncated JSON before the conversation runtime can persist or present the turn", async () => {
    const requests: Array<Record<string, unknown>> = [];
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      requests.push(body);
      return new Response(JSON.stringify({
        id: `response-${requests.length}`,
        output_text: requests.length === 1 ? '{"topic":"Content mission","responseBody":"truncated' : missionOutput([
          "Record the prepared vertical piece using the agreed hook.",
          "Publish it and return the link plus the first response signal.",
        ]),
      }), { status: 200 });
    });

    const result = await runManagerAgentLoop({
      endpoint: "https://example.test/responses",
      apiKey: "test-key",
      model: "test-model",
      instructions: "Manager",
      context: { userMessage: exactRequest },
      tools: [],
      jsonSchema: { name: "manager", schema: { type: "object" } },
      fetchImpl: fetchImpl as unknown as typeof fetch,
      executeTool: vi.fn(),
      validateOutputText: (outputText) => parseManagerConversationOutput(outputText),
      outputRepairAttempts: 1,
    });

    expect(result.outputText).toContain('"missionGraphDecisions"');
    expect(requests).toHaveLength(2);
    expect(requests[1].tools).toEqual([]);
  });

  it("repairs a content mission that passes JSON parsing but fails the database execution contract", async () => {
    const requests: Array<Record<string, unknown>> = [];
    const invalid = missionOutput([
      "Set up a vertical phone shot and frame the video.",
      "Open with a hook and say the first line, then publish the post.",
    ]);
    const valid = missionOutput([
      "Set up a vertical 9:16 phone shot in a quiet room and frame the opening visual.",
      "Open with the hook, say the first line, and show the song moment on screen.",
      "Record the creator action in one take, then trim the dead space and add the caption.",
      "Publish the finished post with a clear CTA to listen, save the song, or share it, then record the link.",
    ]);
    const db = {
      rpc: vi.fn(async (_name: string, args: Record<string, unknown>) => {
        const task = args.p_task as Record<string, unknown>;
        const steps = Array.isArray(args.p_steps) ? args.p_steps as string[] : [];
        const execution = Object.values(task).concat(steps).join(" ").toLowerCase();
        const isContent = /content.{0,30}(video|piece|test|post|series)|\b(video|videos|tiktok|reel|short-form|ugc|film|filming|shoot|shooting|carousel|social video)\b/.test(execution);
        if (steps.filter((step) => typeof step === "string" && step.trim()).length < 2) {
          return { error: { message: "generated_human_task_contract:at_least_two_execution_steps_required" } };
        }
        if (isContent && steps.length < 4) {
          return { error: { message: "generated_human_task_contract:content_requires_at_least_four_execution_steps" } };
        }
        return { error: null };
      }),
    };
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      requests.push(body);
      return new Response(JSON.stringify({
        id: "response-" + requests.length,
        output_text: requests.length === 1 ? invalid : valid,
      }), { status: 200 });
    });

    const result = await runManagerAgentLoop({
      endpoint: "https://example.test/responses",
      apiKey: "test-key",
      model: "test-model",
      instructions: "Manager",
      context: { userMessage: exactRequest },
      tools: [],
      jsonSchema: { name: "manager", schema: { type: "object" } },
      fetchImpl: fetchImpl as unknown as typeof fetch,
      executeTool: vi.fn(),
      validateOutputText: async (outputText) => {
        const output = parseManagerConversationOutput(outputText);
        await preflightManagerMissionGraphTasks(db, "run-1", output);
      },
      shouldRepairOutputError: isRecoverableManagerOutputError,
      outputRepairAttempts: 1,
    });

    expect(result.outputText).toBe(valid);
    expect(requests).toHaveLength(2);
    expect(db.rpc).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(requests[1].input)).toMatch(/complete|four|execution contract/i);
  });

  it("does not retry a validator infrastructure failure as if it were malformed model output", async () => {
    const requests: Array<Record<string, unknown>> = [];
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      requests.push(JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>);
      return new Response(JSON.stringify({ id: "response-1", output_text: missionOutput([
        "Record the prepared piece.",
        "Publish it and return the link.",
      ]) }), { status: 200 });
    });

    await expect(runManagerAgentLoop({
      endpoint: "https://example.test/responses",
      apiKey: "test-key",
      model: "test-model",
      instructions: "Manager",
      context: { userMessage: exactRequest },
      tools: [],
      jsonSchema: { name: "manager", schema: { type: "object" } },
      fetchImpl: fetchImpl as unknown as typeof fetch,
      executeTool: vi.fn(),
      validateOutputText: () => {
        throw new Error("fetch failed while contacting the database");
      },
      shouldRepairOutputError: isRecoverableManagerOutputError,
      outputRepairAttempts: 1,
    })).rejects.toThrow("fetch failed while contacting the database");
    expect(requests).toHaveLength(1);
  });

  it("still gets a bounded repair turn after the last permitted tool call", async () => {
    const requests: Array<Record<string, unknown>> = [];
    const valid = missionOutput([
      "Use the prepared hook and record the vertical piece in one take.",
      "Publish it with the agreed caption, then record the link and first response signal.",
    ]);
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      requests.push(body);
      const output = requests.length === 1
        ? [{ type: "function_call", call_id: "call-1", name: "query_active_missions", arguments: "{}" }]
        : requests.length === 2
          ? [{ type: "message", content: [{ type: "output_text", text: '{"topic":"broken' }] }]
          : [];
      return new Response(JSON.stringify({
        id: "response-" + requests.length,
        output,
        output_text: requests.length === 3 ? valid : undefined,
      }), { status: 200 });
    });

    const result = await runManagerAgentLoop({
      endpoint: "https://example.test/responses",
      apiKey: "test-key",
      model: "test-model",
      instructions: "Manager",
      context: { userMessage: exactRequest },
      tools: [{ type: "function", name: "query_active_missions", description: "Read missions.", strict: true, parameters: { type: "object" } }],
      jsonSchema: { name: "manager", schema: { type: "object" } },
      maxToolCalls: 1,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      executeTool: vi.fn(async () => ({ missions: [] })),
      validateOutputText: (outputText) => parseManagerConversationOutput(outputText),
      outputRepairAttempts: 1,
    });

    expect(result.outputText).toBe(valid);
    expect(requests).toHaveLength(3);
    expect(requests[2].tools).toEqual([]);
  });
});
