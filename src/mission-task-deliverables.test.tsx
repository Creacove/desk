import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MissionsWorkspace } from "./features/missions/MissionScreens";
import type { MissionViewModel } from "./types/cleanProduction";

beforeEach(() => {
  Object.defineProperty(window, "scrollTo", { configurable: true, writable: true, value: vi.fn() });
});
afterEach(cleanup);

describe("mission task deliverables", () => {
  it("keeps required documents in the task flow and passes uploaded document ids into completion", async () => {
    const onCompleteTask = vi.fn(async () => undefined);
    const onUploadTaskDeliverable = vi.fn(async () => ({
      id: "deliverable-thesis",
      title: "90-day thesis",
      status: "uploaded" as const,
      documentId: "doc-thesis-1",
      fileName: "thesis.pdf",
      validationSummary: "Ready for Manager review.",
    }));

    render(
      <MissionsWorkspace
        missions={[missionWithRequiredThesis()]}
        selectedMissionId="mission-1"
        onSelectMission={() => undefined}
        onCreateFirstMission={() => undefined}
        onOpenManager={() => undefined}
        firstMissionPending={false}
        onApproveTask={async () => undefined}
        onCompleteTask={onCompleteTask}
        onUploadTaskDeliverable={onUploadTaskDeliverable}
        onDrawer={() => undefined}
        openRoomRequestKey={1}
        openRoomTab="tasks"
      />,
    );

    expect(screen.getByText("Deliverable")).toBeInTheDocument();
    expect(screen.getByText("90-day thesis")).toBeInTheDocument();
    expect(screen.getByText("Missing")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit evidence" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Upload deliverable for Provide 90-day thesis"), {
      target: {
        files: [new File(["positioning"], "thesis.pdf", { type: "application/pdf" })],
      },
    });

    await waitFor(() => expect(onUploadTaskDeliverable).toHaveBeenCalledWith("task-thesis", expect.objectContaining({
      title: "90-day thesis",
      file: expect.any(File),
    })));

    expect(await screen.findByText("thesis.pdf")).toBeInTheDocument();
    expect(screen.getByText("Uploaded")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Submit evidence" }));
    const reviewBox = screen.getByRole("dialog", { name: "Mark \u201cProvide 90-day thesis\u201d as done" });
    expect(screen.queryByTestId("task-completion-panel-task-thesis")).not.toBeInTheDocument();
    fireEvent.change(within(reviewBox).getByLabelText("Task result note"), {
      target: { value: "Uploaded the 90-day thesis for Manager review." },
    });
    fireEvent.click(within(reviewBox).getByRole("button", { name: "Confirm done" }));

    await waitFor(() => expect(onCompleteTask).toHaveBeenCalledWith(
      "task-thesis",
      "completed",
      "Uploaded the 90-day thesis for Manager review.",
      ["doc-thesis-1"],
      undefined,
    ));
  });

  it("routes a manager-draft task into the existing Manager chat without requiring an upload", () => {
    const onWorkWithManager = vi.fn();
    const mission = missionWithRequiredThesis();
    mission.tasks![0] = {
      ...mission.tasks![0],
      completionMode: "manager_draft",
      deliverableTitle: "90-day positioning plan",
      deliverableRequirements: [
        "State the positioning choice.",
        "Name the next three validation moves.",
      ],
      managerResponsibility: "Draft and revise the plan with workspace context.",
      userResponsibility: "Confirm the direction and any hard constraints.",
      completionExpectation: "A usable plan the artist can approve in chat.",
    };

    render(
      <MissionsWorkspace
        missions={[mission]}
        selectedMissionId="mission-1"
        onSelectMission={() => undefined}
        onCreateFirstMission={() => undefined}
        onOpenManager={() => undefined}
        onWorkWithManager={onWorkWithManager}
        firstMissionPending={false}
        onApproveTask={async () => undefined}
        onCompleteTask={async () => undefined}
        onUploadTaskDeliverable={async () => {
          throw new Error("manager draft tasks must not upload");
        }}
        onDrawer={() => undefined}
        openRoomRequestKey={1}
        openRoomTab="tasks"
      />,
    );

    expect(screen.queryByText("Deliverable")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark done" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Work with Manager" }));
    expect(onWorkWithManager).toHaveBeenCalledWith("task-thesis");
    expect(screen.queryByText("Manager drafts:")).not.toBeInTheDocument();
    expect(screen.queryByText("You confirm:")).not.toBeInTheDocument();
  });

  it("shows the saved Manager draft before offering submission for review", () => {
    const mission = missionWithRequiredThesis();
    mission.tasks![0] = {
      ...mission.tasks![0],
      completionMode: "manager_draft",
      managerDraft: {
        id: "draft-thesis-1",
        title: "90-day positioning plan",
        summary: "Choose Lagos as the first proof market, then measure repeat listening.",
        status: "draft",
      },
    };

    render(
      <MissionsWorkspace
        missions={[mission]}
        selectedMissionId="mission-1"
        onSelectMission={() => undefined}
        onCreateFirstMission={() => undefined}
        onOpenManager={() => undefined}
        firstMissionPending={false}
        onApproveTask={async () => undefined}
        onCompleteTask={async () => undefined}
        onDrawer={() => undefined}
        openRoomRequestKey={1}
        openRoomTab="tasks"
      />,
    );

    expect(screen.getByText("90-day positioning plan")).toBeInTheDocument();
    expect(screen.getByText("Choose Lagos as the first proof market, then measure repeat listening.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit for review" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Work with Manager" })).not.toBeInTheDocument();
  });

  it("presents a saved Manager draft as a readable document instead of raw markdown", () => {
    const mission = missionWithRequiredThesis();
    mission.tasks![0] = {
      ...mission.tasks![0],
      completionMode: "manager_draft",
      managerDraft: {
        id: "draft-thesis-1",
        title: "90-day positioning plan",
        summary: "## Position\nChoose **Lagos** as the proof market.\n\n- Test repeat listening\n- Review the response",
        status: "draft",
      },
    };

    render(
      <MissionsWorkspace
        missions={[mission]}
        selectedMissionId="mission-1"
        onSelectMission={() => undefined}
        onCreateFirstMission={() => undefined}
        onOpenManager={() => undefined}
        firstMissionPending={false}
        onApproveTask={async () => undefined}
        onCompleteTask={async () => undefined}
        onDrawer={() => undefined}
        openRoomRequestKey={1}
        openRoomTab="tasks"
      />,
    );

    expect(screen.getByText("Current Manager draft")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Position" })).toBeInTheDocument();
    expect(screen.getByText("Lagos")).toHaveClass("font-bold");
    expect(screen.queryByText(/## Position/)).not.toBeInTheDocument();
    expect(screen.queryByText("Task 1")).not.toBeInTheDocument();
  });

  it("returns a revised Manager draft to the Manager instead of allowing stale submission", () => {
    const onWorkWithManager = vi.fn();
    const mission = missionWithRequiredThesis();
    mission.tasks![0] = {
      ...mission.tasks![0],
      completionMode: "manager_draft",
      managerDraft: { id: "draft-thesis-1", title: "90-day positioning plan", summary: "Revise the market rationale.", status: "needs_revision" },
      result: { status: "revised", summary: "Add a clearer validation plan.", userNote: "", interpretation: "", missionEffect: "", followUp: "" },
    };

    render(
      <MissionsWorkspace
        missions={[mission]}
        selectedMissionId="mission-1"
        onSelectMission={() => undefined}
        onCreateFirstMission={() => undefined}
        onOpenManager={() => undefined}
        onWorkWithManager={onWorkWithManager}
        firstMissionPending={false}
        onApproveTask={async () => undefined}
        onCompleteTask={async () => undefined}
        onDrawer={() => undefined}
        openRoomRequestKey={1}
        openRoomTab="tasks"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Continue with Manager" }));
    expect(onWorkWithManager).toHaveBeenCalledWith("task-thesis");
    expect(screen.queryByRole("button", { name: "Submit for review" })).not.toBeInTheDocument();
  });

  it("opens the exact task room when returning from Manager work", async () => {
    render(
      <MissionsWorkspace
        missions={[missionWithRequiredThesis()]}
        selectedMissionId="mission-1"
        onSelectMission={() => undefined}
        onCreateFirstMission={() => undefined}
        onOpenManager={() => undefined}
        firstMissionPending={false}
        onApproveTask={async () => undefined}
        onCompleteTask={async () => undefined}
        onUploadTaskDeliverable={async () => ({
          id: "deliverable-thesis",
          title: "90-day thesis",
          status: "uploaded",
        })}
        onDrawer={() => undefined}
        openRoomRequestKey={1}
        openRoomTab="tasks"
        openTaskId="task-thesis"
      />,
    );

    expect(await screen.findByTestId("task-group-checkpoint-1")).toBeInTheDocument();
    expect(screen.getByText("Provide 90-day thesis")).toBeInTheDocument();
    expect(screen.queryByTestId("missions-desktop-list")).not.toBeInTheDocument();
  });
});

function missionWithRequiredThesis(): MissionViewModel {
  return {
    id: "mission-1",
    title: "Define 90-day artist position",
    status: "active",
    progress: 5,
    review: "Thesis gate",
    summary: "Manager is waiting for the written thesis.",
    recommendation: "Provide the thesis before the checkpoint can clear.",
    musicSubject: "Artist",
    nextTask: "Provide 90-day thesis",
    checkpoints: [
      {
        id: "checkpoint-1",
        phase: 1,
        title: "Positioning proof",
        status: "Waiting on tasks",
        question: "Does the mission have the written positioning thesis?",
        requiredTaskIds: ["task-thesis"],
        dependsOnCheckpointIds: [],
        unlocks: [],
        blockedReason: "",
        dependencyImpact: "Manager review waits for the written thesis.",
        watchedSignals: [],
        decisionRule: "Do not clear without a submitted thesis document.",
        recommendation: "Wait for the thesis.",
        rationale: "",
        managerRead: "Wait for the thesis.",
        nextAction: "Provide 90-day thesis",
      },
    ],
    tasks: [
      {
        id: "task-thesis",
        checkpointId: "checkpoint-1",
        title: "Provide 90-day thesis",
        owner: "Artist",
        deadline: "Next review",
        approvalState: "active",
        purpose: "Submit the written 90-day artist positioning thesis for Manager approval.",
        steps: ["Write the thesis", "Upload the document", "Submit it for Manager review"],
        evidenceIds: ["90-day thesis"],
        dependency: "Manager needs the document before checkpoint review.",
        riskIfLate: "The mission cannot move forward without the written thesis.",
      },
    ],
  };
}
