import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MissionsWorkspace } from "./features/missions/MissionScreens";
import type { MissionGenesisResultViewModel, MissionViewModel } from "./types/cleanProduction";

const emptyGenesis: MissionGenesisResultViewModel | null = null;

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
        missionGenesisResult={emptyGenesis}
        missionGenesisPending={false}
        missionGenesisError={null}
        onSelectMission={() => undefined}
        onRunMissionGenesis={() => undefined}
        onOpenMissionGenesisQuestions={() => undefined}
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
    expect(screen.getByRole("button", { name: "Mark done" })).toBeDisabled();

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

    fireEvent.click(screen.getByRole("button", { name: "Mark done" }));
    const reviewBox = screen.getByTestId("task-completion-panel-task-thesis");
    fireEvent.change(within(reviewBox).getByLabelText("Task result note"), {
      target: { value: "Uploaded the 90-day thesis for Manager review." },
    });
    fireEvent.click(within(reviewBox).getByRole("button", { name: "Confirm done" }));

    await waitFor(() => expect(onCompleteTask).toHaveBeenCalledWith(
      "task-thesis",
      "completed",
      "Uploaded the 90-day thesis for Manager review.",
      ["doc-thesis-1"],
    ));
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
        resultSummary: "",
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
