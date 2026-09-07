import { describe, expect, it } from "vitest";
import {
  normalizeMissionTask,
  type MissionTaskInput,
} from "../supabase/functions/_shared/missionTaskContract";

function task(overrides: Partial<MissionTaskInput> = {}): MissionTaskInput {
  return {
    title: "Choose the next release direction",
    purpose: "Choose one direction for the next release.",
    steps: ["Read the direction", "Check that it fits", "Save the decision"],
    ownerRole: "Artist",
    workMode: "artist_action",
    completionMode: "result_note",
    ...overrides,
  };
}

describe("mission task contract", () => {
  it("requires an explicit intent and never infers it from title copy", () => {
    expect(() => normalizeMissionTask(task({ title: "Approve the artist direction" }))).toThrow(/intent/i);
  });

  it("requires a target for review tasks", () => {
    expect(() => normalizeMissionTask(task({ intent: "review_approval", completionMode: "result_note" }))).toThrow(/review target/i);
  });

  it("requires an immutable target version for review tasks", () => {
    expect(() => normalizeMissionTask(task({
      intent: "review_approval",
      completionMode: "approval",
      readiness: "ready",
      reviewTarget: { artifactType: "manager_output", artifactId: "draft-1", status: "ready_for_review" },
    }))).toThrow(/version/i);
  });

  it("accepts a ready review target without reading its title", () => {
    const normalized = normalizeMissionTask(task({
      title: "Approve anything",
      intent: "review_approval",
      completionMode: "approval",
      readiness: "ready",
      reviewTarget: { artifactType: "manager_output", artifactId: "draft-1", versionId: "draft-1", status: "ready_for_review" },
    }));

    expect(normalized.intent).toBe("review_approval");
  });

  it("allows a collaborative draft without a review target", () => {
    const normalized = normalizeMissionTask(task({
      intent: "collaborative_draft",
      workMode: "collaborative",
      completionMode: "manager_draft",
    }));

    expect(normalized.intent).toBe("collaborative_draft");
    expect(normalized.readiness).toBe("preparing");
  });

  it("allows an ordinary human action without a review target", () => {
    const normalized = normalizeMissionTask(task({ intent: "human_action" }));

    expect(normalized.intent).toBe("human_action");
    expect(normalized.readiness).toBe("ready");
  });

  it("requires manager_draft completion for collaborative drafts", () => {
    expect(() => normalizeMissionTask(task({ intent: "collaborative_draft", workMode: "collaborative" }))).toThrow(/manager_draft/i);
  });

  it("does not allow approval completion to bypass the review intent", () => {
    expect(() => normalizeMissionTask(task({ intent: "human_action", completionMode: "approval" }))).toThrow(/review_approval|versioned review target/i);
  });
});
