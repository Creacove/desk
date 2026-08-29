import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { projectTodayExecution, type TodayRuntimePacket } from "./features/desk/todayProjection";

const NOW = "2026-08-29T10:00:00.000Z";

describe("Today runtime projection", () => {
  it("puts a decision-changing Manager question ahead of unrelated ready work", () => {
    const projection = projectTodayExecution(packet({
      missions: [mission("odaeshi", "Odaeshi", 5), mission("catalog", "Catalog cleanup", 2)],
      tasks: [task("catalog-task", "catalog", { title: "Confirm catalog metadata" })],
      questions: [question("q1", "odaeshi")],
    }));

    expect(projection.primary?.kind).toBe("question");
    expect(projection.primary?.missionId).toBe("odaeshi");
    expect(projection.primary?.cta).toBe("answer");
    expect(projection.primary?.questionKey).toBe("car_access");
    expect(projection.primary?.answerKind).toBe("single_select");
    expect(projection.headline).toContain("Desk needs one thing for Odaeshi");
  });

  it("keeps real deadline work above ordinary ready work", () => {
    const projection = projectTodayExecution(packet({
      missions: [mission("release", "Release", 3), mission("content", "Content", 4)],
      tasks: [
        task("release-task", "release", { title: "Approve distributor delivery", deadline: "2026-08-29T18:00:00.000Z" }),
        task("content-task", "content", { title: "Record next content test", priority: 10 }),
      ],
    }));

    expect(projection.primary?.id).toBe("release-task");
    expect(projection.primary?.priorityTier).toBe(1);
  });

  it("preserves in-progress continuity ahead of ordinary ready work", () => {
    const projection = projectTodayExecution(packet({
      missions: [mission("a", "A", 3), mission("b", "B", 3)],
      tasks: [
        task("started", "a", { status: "in_progress", title: "Finish what you started" }),
        task("ready", "b", { status: "open", title: "Another ready task", priority: 50 }),
      ],
    }));

    expect(projection.primary?.id).toBe("started");
    expect(projection.primary?.cta).toBe("continue");
  });

  it("never surfaces Manager-owned machine work as artist work", () => {
    const projection = projectTodayExecution(packet({
      missions: [mission("m1", "Mission", 1)],
      tasks: [task("manager-analysis", "m1", { ownerRole: "Manager", workMode: "manager_work", title: "Analyze response" })],
      checkpoints: [{
        id: "watch",
        missionId: "m1",
        title: "Audience response",
        status: "watching_signal",
      }],
    }));

    expect(projection.primary).toBeUndefined();
    expect(projection.watches).toHaveLength(1);
    expect(projection.watches[0].kind).toBe("watch");
  });

  it("ignores work from a superseded plan", () => {
    const active = mission("m1", "Mission", 1, "plan-new");
    const projection = projectTodayExecution(packet({
      missions: [active],
      tasks: [
        task("old", "m1", { planVersionId: "plan-old", title: "Old route task" }),
        task("new", "m1", { planVersionId: "plan-new", title: "Current route task" }),
      ],
    }));

    expect(projection.primary?.id).toBe("new");
    expect(projection.supporting.some((item) => item.id === "old")).toBe(false);
  });

  it("does not surface human work before its real availability window", () => {
    const projection = projectTodayExecution(packet({
      missions: [mission("m1", "Mission", 1)],
      tasks: [task("future", "m1", { availableFrom: "2026-08-30T10:00:00.000Z" })],
    }));

    expect(projection.primary).toBeUndefined();
  });

  it("turns blocked human work into a Resolve action", () => {
    const projection = projectTodayExecution(packet({
      missions: [mission("m1", "Odaeshi", 1)],
      tasks: [task("blocked", "m1", { status: "blocked", dependency: "Daniel cannot make the shoot." })],
    }));

    expect(projection.primary?.id).toBe("blocked");
    expect(projection.primary?.cta).toBe("resolve");
    expect(projection.primary?.whyNow).toContain("Daniel");
  });

  it("projects a task approval as a Review action when there is no separate permission request", () => {
    const projection = projectTodayExecution(packet({
      missions: [mission("m1", "Odaeshi", 1)],
      tasks: [task("approval", "m1", { status: "needs_approval", approvalState: "needs_approval" })],
    }));

    expect(projection.primary?.kind).toBe("permission");
    expect(projection.primary?.cta).toBe("review");
  });

  it("does not show a watch as competing work for a Mission that already needs the artist", () => {
    const projection = projectTodayExecution(packet({
      missions: [mission("m1", "Odaeshi", 1)],
      tasks: [task("human", "m1")],
      checkpoints: [{ id: "watch", missionId: "m1", title: "Response", status: "watching_signal" }],
    }));

    expect(projection.primary?.id).toBe("human");
    expect(projection.watches).toHaveLength(0);
  });

  it("is deterministic for the same current-state packet", () => {
    const input = packet({
      missions: [mission("m2", "Second", 2), mission("m1", "First", 2)],
      tasks: [task("b", "m2"), task("a", "m1")],
    });

    expect(projectTodayExecution(input)).toEqual(projectTodayExecution(input));
  });

  it("loads Today through bounded Supabase reads and never invokes an AI function on render", () => {
    const source = read("src/services/todayExecutionSupabase.ts");
    expect(source).toContain('.from("missions")');
    expect(source).toContain('.from("tasks")');
    expect(source).toContain('.from("manager_question_requests")');
    expect(source).toContain('.from("permission_requests")');
    expect(source).not.toContain("functions.invoke");
    expect(source).not.toContain("openai");
  });

  it("answers the canonical Manager question only after a user action", () => {
    const action = read("src/services/todayQuestionAction.ts");
    const ui = read("src/features/desk/TodayRuntimeExecution.tsx");
    expect(action).toContain('client.functions.invoke("manager-conversation"');
    expect(action).toContain("contextRequestId: item.contextRequestId");
    expect(action).toContain("contextAnswers: [{ questionKey: item.questionKey, answer: cleanAnswer }]");
    expect(ui).toContain("GuidedContextQuestion");
    expect(ui).toContain("answerTodayManagerQuestion");
    expect(ui).toContain("await onResolved()");
  });

  it("wires Home to the runtime projection instead of the old per-Mission Today list", () => {
    const home = read("src/features/desk/DeskHQ.tsx");
    expect(home).toContain("<TodayRuntimeExecution");
    expect(home).toContain("onManager={onManager}");
    expect(home).not.toContain("function TodayExecution(");
    expect(home).not.toContain("getNextArtistTask(tasks, checkpoints, [])");
  });
});

function packet(overrides: Partial<TodayRuntimePacket>): TodayRuntimePacket {
  return {
    now: NOW,
    missions: [],
    tasks: [],
    checkpoints: [],
    questions: [],
    permissions: [],
    ...overrides,
  };
}

function mission(id: string, title: string, priority: number, activePlanVersionId = "plan-1") {
  return {
    id,
    title,
    status: "active",
    priority,
    activePlanVersionId,
    createdAt: "2026-08-01T00:00:00.000Z",
  };
}

function task(id: string, missionId: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    missionId,
    planVersionId: "plan-1",
    checkpointId: `${missionId}-checkpoint`,
    title: "Do the next thing",
    status: "open",
    ownerRole: "Artist",
    workMode: "artist_action",
    purpose: "This is the next ready human action.",
    priority: 0,
    approvalState: "not_required",
    createdAt: "2026-08-20T00:00:00.000Z",
    ...overrides,
  } as TodayRuntimePacket["tasks"][number];
}

function question(id: string, missionId: string): TodayRuntimePacket["questions"][number] {
  return {
    id,
    missionId,
    conversationId: "conversation-1",
    contextRequestId: `world-model:${id}`,
    questionKey: "car_access",
    status: "pending",
    question: "Can you get access to a parked car this week?",
    reason: "The first Odaeshi concept changes depending on this access.",
    answerKind: "single_select",
    options: ["Yes", "No"],
    expiresAt: "2026-09-01T10:00:00.000Z",
  };
}

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}