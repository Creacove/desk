import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DeskRail, MobileChrome } from "./design-system/components";
import { MissionsWorkspace } from "./features/missions/MissionScreens";
import type { MissionViewModel } from "./types/cleanProduction";

afterEach(cleanup);

describe("simplified mission navigation", () => {
  it("shows a capped active mission badge in desktop and mobile navigation", () => {
    const { rerender } = render(<DeskRail active="missions" activeMissionCount={12} onNavigate={vi.fn()} />);
    expect(screen.getByTestId("desktop-mission-count")).toHaveTextContent("9+");

    rerender(<MobileChrome active="missions" title="Missions" activeMissionCount={3} onNavigate={vi.fn()} />);
    expect(screen.getByTestId("mobile-mission-count")).toHaveTextContent("3");
  });

  it("hides mission badges when there are no active missions", () => {
    const { rerender } = render(<DeskRail active="labelHQ" activeMissionCount={0} onNavigate={vi.fn()} />);
    expect(screen.queryByTestId("desktop-mission-count")).not.toBeInTheDocument();

    rerender(<MobileChrome active="labelHQ" title="Desk HQ" activeMissionCount={0} onNavigate={vi.fn()} />);
    expect(screen.queryByTestId("mobile-mission-count")).not.toBeInTheDocument();
  });
});

describe("simplified mission room", () => {
  it("shows the objective once with four focused tabs and no command-bar duplication", () => {
    renderMission("pulse");

    expect(screen.getAllByText("Define the artist's 90-day position")).toHaveLength(1);
    expect(screen.queryByText("What is happening")).not.toBeInTheDocument();
    expect(screen.queryByText("Mission recap")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Notes" })).not.toBeInTheDocument();
    expect(within(screen.getByTestId("mission-surface-rail")).getAllByRole("button")).toHaveLength(4);
    expect(screen.getByRole("button", { name: /^Activity/ })).toBeInTheDocument();
    expect(screen.getByText("Executive summary")).toBeInTheDocument();
    expect(screen.getByText("Next required action")).toBeInTheDocument();
  });

  it("keeps only one task expanded at a time", () => {
    renderMission("tasks");

    expect(screen.getByRole("button", { name: /Collapse Draft positioning thesis/i })).toBeInTheDocument();
    expect(screen.getByText(/Review artist portfolio/)).toBeInTheDocument();
    expect(screen.queryByText("Interview five listeners")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Expand Run listener interviews/i }));
    expect(screen.getByText(/Interview five listeners/)).toBeInTheDocument();
    expect(screen.queryByText(/Review artist portfolio/)).not.toBeInTheDocument();
  });

  it("updates the review pane when a checkpoint is selected", () => {
    renderMission("checkpoints");

    fireEvent.click(screen.getByRole("button", { name: /Market validation/i }));
    expect(screen.getByTestId("checkpoint-inspector")).toHaveTextContent("Market validation");
    expect(screen.getByTestId("checkpoint-inspector")).toHaveTextContent("Listener response is promising");
    expect(screen.getByText("Task audits")).toBeInTheDocument();
  });

  it("combines agent notes and mission changes into one concise activity feed", () => {
    renderMission("activity");

    const feed = screen.getByTestId("mission-activity-feed");
    expect(within(feed).getByText("A&R → Manager")).toBeInTheDocument();
    expect(within(feed).getByText("Positioning direction confirmed.")).toBeInTheDocument();
    expect(within(feed).getByText("Checkpoint updated")).toBeInTheDocument();
    expect(within(feed).getByText("Market validation opened.")).toBeInTheDocument();
    expect(screen.queryByText("Why it matters:")).not.toBeInTheDocument();
  });
});

function renderMission(tab: "pulse" | "tasks" | "checkpoints" | "activity") {
  return render(
    <MissionsWorkspace
      missions={[mission()]}
      selectedMissionId="mission-1"
      onSelectMission={vi.fn()}
      onCreateFirstMission={vi.fn()}
      firstMissionPending={false}
      onApproveTask={vi.fn(async () => undefined)}
      onCompleteTask={vi.fn(async () => undefined)}
      onDrawer={vi.fn()}
      openRoomRequestKey={1}
      openRoomTab={tab}
    />,
  );
}

function mission(): MissionViewModel {
  return {
    id: "mission-1",
    title: "Define the artist's 90-day position",
    status: "active",
    progress: 40,
    review: "The positioning thesis is focused and ready for validation.",
    summary: "Build a clear position, validate it with listeners, then commit the campaign.",
    recommendation: "Use the thesis to guide a small validation sprint before scaling.",
    musicSubject: "Artist",
    nextTask: "Finish the positioning draft",
    checkpoints: [
      {
        id: "checkpoint-1", phase: 1, title: "Positioning thesis", status: "Ready for AI review",
        question: "Is the position clear?", requiredTaskIds: ["task-1"], dependsOnCheckpointIds: [], unlocks: ["Market validation"],
        blockedReason: "", dependencyImpact: "", watchedSignals: [], decisionRule: "The thesis must be specific.",
        recommendation: "Approve the thesis.", resultSummary: "The thesis is specific and actionable.", nextAction: "Approve the thesis",
      },
      {
        id: "checkpoint-2", phase: 2, title: "Market validation", status: "Watching signal",
        question: "Does the market respond?", requiredTaskIds: ["task-2"], dependsOnCheckpointIds: ["checkpoint-1"], unlocks: [],
        blockedReason: "", dependencyImpact: "", watchedSignals: [], decisionRule: "At least three listeners must respond positively.",
        recommendation: "Continue the test.", resultSummary: "Listener response is promising.", nextAction: "Complete interviews",
      },
    ],
    tasks: [
      {
        id: "task-1", checkpointId: "checkpoint-1", title: "Draft positioning thesis", owner: "Manager", deadline: "This week",
        approvalState: "active", purpose: "Create the campaign's decision filter.", steps: ["Review artist portfolio", "Write the thesis"],
        evidenceIds: [], dependency: "", riskIfLate: "Validation starts without a clear position.",
      },
      {
        id: "task-2", checkpointId: "checkpoint-2", title: "Run listener interviews", owner: "A&R", deadline: "Next week",
        approvalState: "active", purpose: "Validate the position with real listeners.", steps: ["Interview five listeners", "Summarize responses"],
        evidenceIds: [], dependency: "", riskIfLate: "The campaign scales without validation.",
        result: { status: "pending", userNote: "Interviews started.", interpretation: "Early response supports the thesis.", missionEffect: "Validation is underway." },
      },
    ],
    notes: [{
      id: "note-1", route: "A&R → Manager", subject: "Positioning", message: "Positioning direction confirmed.", status: "filed",
      sourceBasis: "Artist review", recommendedAction: "Proceed", resultingChange: "Thesis approved", briefType: "handoff",
    }],
    events: [{ type: "Checkpoint updated", actor: "Manager", summary: "Market validation opened." }],
  };
}
