import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";

import { MissionsWorkspace } from "./features/missions/MissionScreens";
import type { MissionViewModel } from "./types/cleanProduction";

beforeEach(() => {
  Object.defineProperty(window, "scrollTo", { configurable: true, writable: true, value: vi.fn() });
});
afterEach(cleanup);

describe("mission task execution", () => {
  it("keeps evidence optional and lets the artist complete without uploading", async () => {
    const onCompleteTask = vi.fn(async () => undefined);
    renderMission(missionWithThesis(), { onCompleteTask, openTaskId: "task-thesis" });

    const dialog = screen.getByRole("dialog", { name: "Provide 90-day thesis" });
    expect(within(dialog).getByText("Optional context")).toBeInTheDocument();
    expect(within(dialog).getByText("90-day thesis")).toBeInTheDocument();
    expect(within(dialog).getByText("Optional file")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Mark complete" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Mark complete" }));

    await waitFor(() => expect(onCompleteTask).toHaveBeenCalledWith("task-thesis", "completed", "", [], undefined));
  });

  it("passes an optional uploaded document into completion when supplied", async () => {
    const onCompleteTask = vi.fn(async () => undefined);
    const onUploadTaskDeliverable = vi.fn(async () => ({
      id: "task-thesis-deliverable",
      title: "90-day thesis",
      status: "uploaded" as const,
      documentId: "doc-thesis-1",
      fileName: "thesis.pdf",
      validationSummary: "Ready for Manager review.",
    }));

    renderMission(missionWithThesis(), { onCompleteTask, onUploadTaskDeliverable, openTaskId: "task-thesis" });

    fireEvent.change(screen.getByLabelText("Upload optional context for Provide 90-day thesis"), {
      target: { files: [new File(["positioning"], "thesis.pdf", { type: "application/pdf" })] },
    });

    await waitFor(() => expect(onUploadTaskDeliverable).toHaveBeenCalledWith("task-thesis", expect.objectContaining({
      title: "90-day thesis",
      file: expect.any(File),
    })));
    expect(await screen.findByText("thesis.pdf")).toBeInTheDocument();

    const dialog = screen.getByRole("dialog", { name: "Provide 90-day thesis" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Mark complete" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Mark complete" }));

    await waitFor(() => expect(onCompleteTask).toHaveBeenCalledWith("task-thesis", "completed", "", ["doc-thesis-1"], undefined));
  });

  it("shows Manager-owned work without turning it into artist action", () => {
    const mission = missionWithThesis();
    mission.tasks![0] = {
      ...mission.tasks![0],
      owner: "Manager",
      workMode: "manager_work",
      title: "Review discovery and artist-attachment evidence",
    };

    renderMission(mission, { openTaskId: "task-thesis" });

    const dialog = screen.getByRole("dialog", { name: "Review discovery and artist-attachment evidence" });
    expect(within(dialog).getByText("Manager is handling this.")).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Mark complete" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Work with Manager" })).not.toBeInTheDocument();
  });

  it("routes a Manager-draft task into the existing Manager conversation", () => {
    const onWorkWithManager = vi.fn();
    const mission = missionWithThesis();
    mission.tasks![0] = { ...mission.tasks![0], completionMode: "manager_draft", deliverableTitle: "90-day positioning plan" };

    renderMission(mission, { onWorkWithManager, openTaskId: "task-thesis" });

    fireEvent.click(screen.getByRole("button", { name: "Work with Manager" }));
    expect(onWorkWithManager).toHaveBeenCalledWith("task-thesis");
    expect(screen.queryByText("Required file")).not.toBeInTheDocument();
  });

  it("renders a saved Manager draft as a readable document", () => {
    const mission = missionWithThesis();
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

    renderMission(mission, { openTaskId: "task-thesis" });

    const dialog = screen.getByRole("dialog", { name: "Provide 90-day thesis" });
    expect(within(dialog).getByText("Current Manager draft")).toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "Position" })).toBeInTheDocument();
    expect(within(dialog).getByText("Lagos")).toHaveClass("font-bold");
    expect(within(dialog).queryByText(/## Position/)).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Submit for review" })).toBeEnabled();
  });

  it("closes Manager review submission immediately and shows pending state on the task", async () => {
    let resolveReview: (() => void) | undefined;
    const onCompleteTask = vi.fn(() => new Promise<void>((resolve) => { resolveReview = resolve; }));
    const mission = missionWithManagerDraft();

    renderMission(mission, { onCompleteTask, openTaskId: "task-thesis" });

    const dialog = screen.getByRole("dialog", { name: "Provide 90-day thesis" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Submit for review" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Submit for review" }));

    await waitFor(() => expect(onCompleteTask).toHaveBeenCalledWith("task-thesis", "completed", "", [], "draft-thesis-1"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("Manager reviewing")).toBeInTheDocument();

    resolveReview?.();
    await waitFor(() => expect(screen.queryByText("Manager reviewing")).not.toBeInTheDocument());
  });

  it("keeps a failed review attached to the exact task and retryable", async () => {
    const mission = missionWithManagerDraft();
    renderMission(mission, {
      onCompleteTask: vi.fn(async () => { throw new Error("Manager is unavailable"); }),
      openTaskId: "task-thesis",
    });

    const dialog = screen.getByRole("dialog", { name: "Provide 90-day thesis" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Submit for review" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Submit for review" }));

    expect(await screen.findByText("Review failed · Tap to retry")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Provide 90-day thesis/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Manager is unavailable");
    expect(screen.getByRole("button", { name: "Submit for review" })).toBeEnabled();
  });

  it("returns revised Manager work to the Manager instead of submitting a stale draft", () => {
    const onWorkWithManager = vi.fn();
    const mission = missionWithManagerDraft();
    mission.tasks![0] = {
      ...mission.tasks![0],
      managerDraft: { ...mission.tasks![0].managerDraft!, status: "needs_revision" },
      result: { status: "revised", summary: "Add a clearer validation plan.", userNote: "", interpretation: "", missionEffect: "", followUp: "" },
    };

    renderMission(mission, { onWorkWithManager, openTaskId: "task-thesis" });

    fireEvent.click(screen.getByRole("button", { name: "Continue with Manager" }));
    expect(onWorkWithManager).toHaveBeenCalledWith("task-thesis");
    expect(screen.queryByRole("button", { name: "Submit for review" })).not.toBeInTheDocument();
  });

  it("keeps completed collaborative work readable with steps and result", () => {
    const mission = missionWithManagerDraft();
    mission.tasks![0] = {
      ...mission.tasks![0],
      steps: ["Review the proposed thesis", "Confirm the audience priority"],
      result: {
        status: "completed",
        summary: "The artist approved the career thesis.",
        userNote: "Approved.",
        interpretation: "The direction is specific enough.",
        missionEffect: "Opportunity filtering can begin.",
        followUp: "Use the thesis in the next checkpoint.",
      },
    };

    renderMission(mission, { openTaskId: "task-thesis" });

    const dialog = screen.getByRole("dialog", { name: "Provide 90-day thesis" });
    expect(within(dialog).getByText("Review the proposed thesis")).toBeInTheDocument();
    expect(within(dialog).getByText("The artist approved the career thesis.")).toBeInTheDocument();
    expect(within(dialog).getByText("Use the thesis in the next checkpoint.")).toBeInTheDocument();
    expect(within(dialog).getByText("Done")).toBeInTheDocument();
  });
});

function renderMission(
  mission: MissionViewModel,
  overrides: Partial<ComponentProps<typeof MissionsWorkspace>> = {},
) {
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
      {...overrides}
    />,
  );
}

function missionWithManagerDraft() {
  const mission = missionWithThesis();
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
  return mission;
}

function missionWithThesis(): MissionViewModel {
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
        id: "checkpoint-1", phase: 1, title: "Positioning proof", status: "Waiting on tasks",
        question: "Does the mission have the written positioning thesis?", requiredTaskIds: ["task-thesis"], dependsOnCheckpointIds: [], unlocks: [],
        blockedReason: "", dependencyImpact: "Manager review waits for the written thesis.", watchedSignals: [],
        decisionRule: "Review the submitted thesis before clearing this stage.", recommendation: "Wait for the thesis.", rationale: "",
        managerRead: "Wait for the thesis.", nextAction: "Provide 90-day thesis",
      },
    ],
    tasks: [
      {
        id: "task-thesis", checkpointId: "checkpoint-1", title: "Provide 90-day thesis", owner: "Artist", deadline: "Next review",
        approvalState: "active", purpose: "Submit the written 90-day artist positioning thesis for Manager approval.",
        steps: ["Write the thesis", "Add the document if useful", "Submit it for Manager review"], evidenceIds: ["90-day thesis"],
        completionMode: "evidence", deliverableTitle: "90-day thesis", dependency: "Manager review", riskIfLate: "The mission cannot move forward.",
      },
    ],
    notes: [],
    events: [],
  };
}
