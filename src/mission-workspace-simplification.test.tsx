import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DeskRail, MobileChrome } from "./design-system/components";
import { MissionsWorkspace } from "./features/missions/MissionScreens";
import type { MissionViewModel } from "./types/cleanProduction";

beforeEach(() => {
  Object.defineProperty(window, "scrollTo", { configurable: true, writable: true, value: vi.fn() });
});

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
  it("reports room transitions, resets scroll, and contains the mission title", () => {
    const onRoomModeChange = vi.fn();
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);

    render(
      <MissionsWorkspace
        missions={[mission()]}
        selectedMissionId="mission-1"
        onSelectMission={vi.fn()}
        onCreateFirstMission={vi.fn()}
        onOpenManager={vi.fn()}
        firstMissionPending={false}
        onApproveTask={vi.fn(async () => undefined)}
        onCompleteTask={vi.fn(async () => undefined)}
        onDrawer={vi.fn()}
        onRoomModeChange={onRoomModeChange}
      />,
    );

    expect(onRoomModeChange).toHaveBeenLastCalledWith(false);
    fireEvent.click(screen.getAllByRole("button", { name: /Define the artist's 90-day position/i })[0]);

    expect(onRoomModeChange).toHaveBeenLastCalledWith(true);
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, left: 0, behavior: "auto" });
    expect(screen.getByRole("heading", { name: "Define the artist's 90-day position" })).toHaveClass(
      "min-w-0",
      "max-w-full",
      "break-words",
      "[overflow-wrap:anywhere]",
    );

    fireEvent.click(screen.getByRole("button", { name: "Back to Missions" }));
    expect(onRoomModeChange).toHaveBeenLastCalledWith(false);
  });

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

  it("keeps mission progress compact beneath the title", () => {
    renderMission("pulse");

    expect(screen.getByTestId("mission-command-bar")).toHaveClass("pb-1", "pt-1");
    expect(screen.getByTestId("mission-title-progress")).toHaveClass("gap-3");
    expect(screen.getByTestId("mission-progress-summary")).toHaveClass(
      "grid",
      "grid-cols-[auto_minmax(0,1fr)]",
      "items-center",
    );
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

  it("expands checkpoint reviews inline on mobile and preserves desktop master-detail", () => {
    renderMission("checkpoints");

    expect(screen.getByTestId("checkpoint-accordion")).toHaveClass("xl:hidden");
    expect(screen.getByTestId("checkpoint-workspace-grid")).toHaveClass("hidden", "xl:grid");

    const toggle = screen.getByTestId("checkpoint-accordion-toggle-checkpoint-2");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    const expandedCheckpoint = screen.getByTestId("checkpoint-accordion-item-checkpoint-2");
    expect(within(expandedCheckpoint).getByText("Listener response is promising.")).toBeInTheDocument();
    expect(within(expandedCheckpoint).getByText("Run listener interviews")).toBeInTheDocument();
  });

  it("combines agent notes and mission changes into one concise activity feed", () => {
    renderMission("activity");

    const surface = screen.getByTestId("mission-activity-surface");
    expect(surface).toHaveClass("surface-elevated", "rounded-[22px]", "overflow-hidden");
    expect(within(surface).getByText("2 updates")).toBeInTheDocument();
    expect(within(surface).getAllByTestId("mission-activity-item")).toHaveLength(2);
    const feed = screen.getByTestId("mission-activity-feed");
    expect(within(feed).getByText("A&R → Manager")).toBeInTheDocument();
    expect(within(feed).getByText("Positioning direction confirmed.")).toBeInTheDocument();
    expect(within(feed).getByText("Checkpoint updated")).toBeInTheDocument();
    expect(within(feed).getByText("Market validation opened.")).toBeInTheDocument();
    expect(screen.queryByText("Why it matters:")).not.toBeInTheDocument();
  });

  it("keeps the empty activity state inside the activity surface", () => {
    const emptyMission = mission();
    emptyMission.notes = [];
    emptyMission.events = [];
    renderMission("activity", emptyMission);

    const surface = screen.getByTestId("mission-activity-surface");
    expect(within(surface).getByText("0 updates")).toBeInTheDocument();
    expect(within(surface).getByText("No mission activity yet.")).toBeInTheDocument();
  });
});

function renderMission(tab: "pulse" | "tasks" | "checkpoints" | "activity", selectedMission = mission()) {
  return render(
    <MissionsWorkspace
      missions={[selectedMission]}
      selectedMissionId="mission-1"
      onSelectMission={vi.fn()}
      onCreateFirstMission={vi.fn()}
      onOpenManager={vi.fn()}
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
