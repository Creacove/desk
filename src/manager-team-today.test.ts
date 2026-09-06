import { describe, expect, it } from "vitest";
import { projectTodayExecution, type TodayRuntimePacket } from "./features/desk/todayProjection";

const base: TodayRuntimePacket = {
  now: "2026-09-05T12:00:00Z",
  viewer: { userId: "sarah", accessRole: "member" },
  missions: [{ id: "m", title: "Release", status: "active", priority: 1, activePlanVersionId: "p" }],
  checkpoints: [], questions: [], permissions: [],
  tasks: [
    { id: "dsp", missionId: "m", planVersionId: "p", title: "Deliver DSP pitch", status: "open", workMode: "artist_action", assigneeUserId: "sarah", priority: 1 },
    { id: "press", missionId: "m", planVersionId: "p", title: "Prepare press handoff", status: "open", workMode: "artist_action", assigneeUserId: "favour", priority: 1 },
    { id: "ownerless", missionId: "m", planVersionId: "p", title: "Choose a live owner", status: "open", workMode: "artist_action", assigneeUserId: null, priority: 1 },
  ],
};

describe("team Today projection", () => {
  it("keeps the viewer's work personal and exposes teammate/unassigned work separately", () => {
    const sarah = projectTodayExecution(base);
    expect(sarah.primary?.id).toBe("dsp");
    expect(sarah.team.map((item) => item.id)).toEqual(["press"]);
    expect(sarah.unassigned.map((item) => item.id)).toEqual(["ownerless"]);
  });

  it("shows permissions only to owners", () => {
    const packet = { ...base, tasks: [], permissions: [{ id: "approve", missionId: "m", requestType: "external_send", title: "Approve send", status: "pending" }] };
    expect(projectTodayExecution(packet).primary).toBeUndefined();
    expect(projectTodayExecution({ ...packet, viewer: { userId: "owner", accessRole: "owner" } }).primary?.id).toBe("approve");
  });
});
