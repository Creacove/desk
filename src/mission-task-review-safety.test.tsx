import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MissionsWorkspace } from "./features/missions/MissionScreens";
import { getNextArtistTask } from "./features/missions/missionModel";
import type { MissionTaskViewModel, MissionViewModel } from "./types/cleanProduction";

afterEach(cleanup);

describe("mission review task safety", () => {
  it("keeps a review task non-actionable while its draft is preparing", () => {
    renderMission(reviewTask({ readiness: "preparing", reviewTarget: undefined }));

    const dialog = screen.getByRole("dialog", { name: "Review your artist direction" });
    expect(within(dialog).getByText("Review not ready yet")).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Start" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Already done" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Review draft" })).not.toBeInTheDocument();
  });

  it("offers review only when the task has a ready versioned draft", () => {
    renderMission(reviewTask({
      readiness: "ready",
      reviewTarget: {
        artifactType: "manager_output",
        artifactId: "draft-1",
        versionId: "draft-1",
        status: "ready_for_review",
      },
      managerDraft: {
        id: "draft-1",
        title: "Artist direction",
        summary: "Choose the direction that sounds like you.",
        status: "draft",
      },
    }));

    const dialog = screen.getByRole("dialog", { name: "Review your artist direction" });
    expect(within(dialog).getByText("Artist direction")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Review draft" })).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Start" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Already done" })).not.toBeInTheDocument();
  });

  it("routes a revision back to the Manager without offering approval", () => {
    const onWorkWithManager = vi.fn();
    renderMission(reviewTask({
      intent: "collaborative_draft",
      readiness: "needs_revision",
      completionMode: "manager_draft",
      reviewTarget: undefined,
      managerDraft: undefined,
    }), { onWorkWithManager });

    const dialog = screen.getByRole("dialog", { name: "Review your artist direction" });
    expect(within(dialog).getByRole("button", { name: "Work with Manager" })).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
  });

  it("lets a collaborative task start with Manager while its draft is pending", () => {
    const onWorkWithManager = vi.fn();
    renderMission(reviewTask({
      intent: "collaborative_draft",
      readiness: "preparing",
      completionMode: "manager_draft",
      reviewTarget: undefined,
      managerDraft: undefined,
    }), { onWorkWithManager });

    const dialog = screen.getByRole("dialog", { name: "Review your artist direction" });
    expect(within(dialog).getByRole("button", { name: "Work with Manager" })).toBeInTheDocument();
    expect(within(dialog).queryByTestId("mission-task-preparing")).not.toBeInTheDocument();
  });

  it("keeps a pending collaborative task as the next artist move", () => {
    const mission = reviewTask({
      intent: "collaborative_draft",
      readiness: "preparing",
      completionMode: "manager_draft",
      reviewTarget: undefined,
      managerDraft: undefined,
    });

    expect(getNextArtistTask(mission.tasks ?? [], mission.checkpoints ?? [], [])?.id).toBe("review-task");
  });
});

function renderMission(mission: MissionViewModel, overrides: Partial<React.ComponentProps<typeof MissionsWorkspace>> = {}) {
  return render(
    <MissionsWorkspace
      missions={[mission]}
      selectedMissionId={mission.id}
      onSelectMission={vi.fn()}
      onCreateFirstMission={vi.fn()}
      onOpenManager={vi.fn()}
      firstMissionPending={false}
      onApproveTask={vi.fn(async () => undefined)}
      onCompleteTask={vi.fn(async () => undefined)}
      onDrawer={vi.fn()}
      openRoomRequestKey={1}
      openRoomTab="tasks"
      openTaskId="review-task"
      {...overrides}
    />,
  );
}

function reviewTask(overrides: Partial<MissionTaskViewModel>): MissionViewModel {
  return {
    id: "mission-review",
    title: "Find the artist's next clear direction",
    status: "active",
    progress: 5,
    review: "Artist direction",
    summary: "The Manager is preparing a direction for you to review.",
    recommendation: "Review the direction when it is ready.",
    musicSubject: "Artist",
    nextTask: "Review your artist direction",
    checkpoints: [{
      id: "checkpoint-review",
      phase: 1,
      title: "Artist direction",
      status: "Waiting on tasks",
      question: "Does this direction sound like the artist?",
      requiredTaskIds: ["review-task"],
      dependsOnCheckpointIds: [],
      unlocks: [],
      blockedReason: "",
      dependencyImpact: "The next step waits for this review.",
      watchedSignals: [],
      decisionRule: "Continue when the artist approves the direction.",
      recommendation: "Review the direction.",
      rationale: "The Manager needs the artist's read.",
      managerRead: "The Manager is preparing the draft.",
      nextAction: "Review the direction when ready.",
    }],
    tasks: [{
      id: "review-task",
      checkpointId: "checkpoint-review",
      title: "Review your artist direction",
      owner: "Artist",
      deadline: "Next review",
      approvalState: "needs approval",
      intent: "review_approval",
      readiness: "preparing",
      purpose: "Check whether this direction sounds like you.",
      steps: ["Read the draft", "Approve it or ask for one change"],
      evidenceIds: [],
      workMode: "artist_action",
      completionMode: "approval",
      dependency: "Manager draft",
      riskIfLate: "The next step waits for your read.",
      ...overrides,
    }],
    notes: [],
    events: [],
  };
}
