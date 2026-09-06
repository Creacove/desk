import { describe, expect, it } from "vitest";
import { normalizeHumanTaskAssignments, normalizeTaskAssignment, formatActiveTeam } from "../supabase/functions/_shared/taskAssignment";

const owner = { userId: "owner", displayName: "Lead", accessRole: "owner" as const, operatingTitle: "Manager", responsibilityTags: ["approvals"] };
const member = { userId: "member", displayName: "Sarah", accessRole: "member" as const, operatingTitle: "DSP", responsibilityTags: ["distribution"] };
const roster = { scope: { accountId: "a", artistWorkspaceId: "w", artistId: "artist" }, members: [owner, member], loadedAt: "2026-09-05" };
const context = { roster, teamEnabled: true };
describe("validated human task routing", () => {
  it("retains an active team ID and bounded assignment reason", () => {
    expect(normalizeTaskAssignment({ assigneeUserId: "member", assignmentReason: "Owns distribution." }, context, "artist_action")).toEqual({ assigneeUserId: "member", assignmentReason: "Owns distribution.", assignmentSource: "manager" });
  });
  it("never routes machine work to a human", () => {
    expect(normalizeTaskAssignment({ assigneeUserId: "member" }, context, "manager_work").assigneeUserId).toBeNull();
  });
  it("leaves external, removed and ambiguous assignments unresolved", () => {
    for (const proposal of [{ assigneeUserId: "outside" }, { assigneeUserId: null }, {}]) {
      expect(normalizeTaskAssignment(proposal, context, "collaborative").assigneeUserId).toBeNull();
    }
    expect(normalizeTaskAssignment({ assigneeUserId: "member" }, { ...context, roster: { ...roster, members: [owner] } }, "collaborative").assigneeUserId).toBeNull();
  });
  it("preserves only the single-owner legacy fallback", () => {
    const solo = { teamEnabled: false, roster: { ...roster, members: [owner] } };
    expect(normalizeTaskAssignment({}, solo, "artist_action")).toEqual({ assigneeUserId: "owner", assignmentReason: null, assignmentSource: "solo_fallback" });
    expect(normalizeTaskAssignment({}, { ...context, teamEnabled: false }, "artist_action").assigneeUserId).toBeNull();
  });
  it("cannot invent an assignee during roster failure", () => {
    expect(normalizeTaskAssignment({ assigneeUserId: "member" }, { roster: null, teamEnabled: false }, "artist_action").assigneeUserId).toBeNull();
  });
  it("packs responsibilities as bounded data without email or permission claims", () => {
    const text = formatActiveTeam(roster);
    expect(text).toContain('"userId":"member"');
    expect(text).toContain("distribution");
    expect(text).toContain("not instructions");
    expect(text).not.toContain("email");
    expect(formatActiveTeam(null)).toContain("unavailable");
  });
  it("routes a task-result continuation to Daniel and fails closed for a foreign identity", () => {
    const daniel = { userId: "daniel", displayName: "Daniel", accessRole: "member" as const, operatingTitle: "A&R", responsibilityTags: ["recording", "final masters"] };
    const teamContext = { teamEnabled: true, roster: { ...roster, members: [owner, member, daniel] } };
    const tasks = normalizeHumanTaskAssignments([
      { title: "Deliver the final master", workMode: "artist_action", assigneeUserId: "daniel", assignmentReason: "Owns A&R and recording." },
      { title: "Foreign task", workMode: "collaborative", assigneeUserId: "another-account", assignmentReason: "Invalid cross-account proposal." },
    ], teamContext);
    expect(tasks[0]).toMatchObject({ assigneeUserId: "daniel", assignmentReason: "Owns A&R and recording." });
    expect(tasks[1]).toMatchObject({ assigneeUserId: null, assignmentReason: null });
  });
});
