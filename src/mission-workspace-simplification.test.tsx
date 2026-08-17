import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";

import { DeskRail, MobileChrome } from "./design-system/components";
import { MissionsWorkspace } from "./features/missions/MissionScreens";
import type { MissionViewModel } from "./types/cleanProduction";

beforeEach(() => {
  Object.defineProperty(window, "scrollTo", { configurable: true, writable: true, value: vi.fn() });
});

afterEach(cleanup);

describe("mission navigation", () => {
  it("keeps active mission counts compact in desktop and mobile navigation", () => {
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

describe("mobile-first mission workspace", () => {
  it("prioritizes missions that need the user and keeps completed work collapsed", () => {
    const completed = mission();
    completed.id = "mission-complete";
    completed.title = "Finish release setup";
    completed.status = "complete";
    completed.tasks = completed.tasks?.map((task) => ({
      ...task,
      result: { status: "completed", summary: "Done", userNote: "", interpretation: "", missionEffect: "", followUp: "" },
    }));

    renderWorkspace({ missions: [mission(), completed] });

    expect(screen.getByRole("heading", { name: "Needs you" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Define the artist's 90-day position/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Completed 1/i })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Finish release setup")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Completed 1/i }));
    expect(screen.getByText("Finish release setup")).toBeInTheDocument();
    expect(screen.queryByText("Active Missions")).not.toBeInTheDocument();
  });

  it("opens a mission into only Work and Updates while preserving room transitions", () => {
    const onRoomModeChange = vi.fn();
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);

    renderWorkspace({ onRoomModeChange });
    fireEvent.click(screen.getByRole("button", { name: /Define the artist's 90-day position/i }));

    expect(onRoomModeChange).toHaveBeenLastCalledWith(true);
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, left: 0, behavior: "auto" });
    expect(screen.getByRole("heading", { name: "Define the artist's 90-day position" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Work/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Updates/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Pulse/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Checkpoints/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Activity/ })).not.toBeInTheDocument();
    expect(screen.getByText("The path from here")).toBeInTheDocument();
    expect(screen.queryByText("Executive summary")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Back to Missions" }));
    expect(onRoomModeChange).toHaveBeenLastCalledWith(false);
  });

  it("keeps future-stage work visible but non-actionable until its dependency clears", () => {
    renderMission();

    const futureStage = screen.getByTestId("task-group-checkpoint-2");
    fireEvent.click(within(futureStage).getByRole("button", { name: /Market validation/i }));

    expect(within(futureStage).getAllByText("Starts after Positioning thesis").length).toBeGreaterThan(0);
    expect(within(futureStage).getByRole("button", { name: /Run listener interviews/i })).toBeDisabled();
    expect(within(futureStage).getByText("Not available yet")).toBeInTheDocument();
  });

  it("opens the exact task as a focused sheet instead of expanding a dashboard card", () => {
    renderMission("tasks", mission(), "task-1");

    const dialog = screen.getByRole("dialog", { name: "Draft positioning thesis" });
    expect(within(dialog).getByText("What to do")).toBeInTheDocument();
    expect(within(dialog).getByText("Review artist portfolio")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Add result" })).toBeInTheDocument();
    expect(screen.queryByText("Why it matters:")).not.toBeInTheDocument();
  });

  it("maps legacy activity deep-links into a concise Updates surface", () => {
    renderMission("activity");

    expect(screen.getByRole("heading", { name: "What changed" })).toBeInTheDocument();
    expect(screen.getByText("Positioning direction confirmed.")).toBeInTheDocument();
    expect(screen.getByText("Market validation opened.")).toBeInTheDocument();
    expect(screen.queryByText("Mission record")).not.toBeInTheDocument();
  });

  it("keeps a linked song compact and routes back to its Song Room", () => {
    const linked = mission();
    linked.musicSubject = "Night Bus";
    linked.subjectType = "music_item";
    linked.subjectId = "song-night-bus";
    const onOpenMusicSubject = vi.fn();

    renderWorkspace({ missions: [linked], openRoomRequestKey: 1, onOpenMusicSubject });

    const attachment = screen.getByTestId("linked-song-attachment");
    fireEvent.click(within(attachment).getByRole("button", { name: "Open song Night Bus" }));
    expect(onOpenMusicSubject).toHaveBeenCalledWith({ id: "song-night-bus", title: "Night Bus", type: "music_item" });
  });

  it("respects explicit empty backend arrays instead of inventing fallback work", () => {
    const empty = mission();
    empty.tasks = [];
    empty.checkpoints = [];
    empty.notes = [];
    empty.events = [];

    renderMission("tasks", empty);

    expect(screen.getByText("Nothing needs you right now.")).toBeInTheDocument();
    expect(screen.queryByText("Review the Manager recommendation")).not.toBeInTheDocument();
    expect(screen.queryByText("Manager update")).not.toBeInTheDocument();
  });
});

function renderWorkspace(overrides: Partial<ComponentProps<typeof MissionsWorkspace>> = {}) {
  const props: ComponentProps<typeof MissionsWorkspace> = {
    missions: [mission()],
    selectedMissionId: "mission-1",
    onSelectMission: vi.fn(),
    onCreateFirstMission: vi.fn(),
    onOpenManager: vi.fn(),
    firstMissionPending: false,
    onApproveTask: vi.fn(async () => undefined),
    onCompleteTask: vi.fn(async () => undefined),
    onDrawer: vi.fn(),
    ...overrides,
  };
  return render(<MissionsWorkspace {...props} />);
}

function renderMission(
  tab: "pulse" | "tasks" | "checkpoints" | "activity" = "tasks",
  selectedMission = mission(),
  openTaskId?: string,
) {
  return renderWorkspace({ missions: [selectedMission], openRoomRequestKey: 1, openRoomTab: tab, openTaskId });
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
        id: "checkpoint-1", phase: 1, title: "Positioning thesis", status: "Waiting on tasks",
        question: "Is the position clear?", requiredTaskIds: ["task-1"], dependsOnCheckpointIds: [], unlocks: ["Market validation"],
        blockedReason: "", dependencyImpact: "", watchedSignals: [], decisionRule: "The thesis must be specific.",
        recommendation: "Approve the thesis.", rationale: "A defined position keeps validation focused.", managerRead: "", nextAction: "Draft the thesis",
      },
      {
        id: "checkpoint-2", phase: 2, title: "Market validation", status: "Waiting on tasks",
        question: "Does the market respond?", requiredTaskIds: ["task-2"], dependsOnCheckpointIds: ["checkpoint-1"], unlocks: [],
        blockedReason: "", dependencyImpact: "Wait for positioning.", watchedSignals: [], decisionRule: "At least three listeners must respond positively.",
        recommendation: "Continue the test.", rationale: "Listener interviews test whether the position travels.", managerRead: "", nextAction: "Prepare the audience test",
      },
    ],
    tasks: [
      {
        id: "task-1", checkpointId: "checkpoint-1", title: "Draft positioning thesis", owner: "Artist", deadline: "Today",
        approvalState: "active", purpose: "Create the campaign's decision filter.", steps: ["Review artist portfolio", "Write the thesis"],
        evidenceIds: [], dependency: "", riskIfLate: "Validation starts without a clear position.",
      },
      {
        id: "task-2", checkpointId: "checkpoint-2", title: "Run listener interviews", owner: "A&R", deadline: "Next week",
        approvalState: "active", purpose: "Validate the position with real listeners.", steps: ["Interview five listeners", "Summarize responses"],
        evidenceIds: [], dependency: "Positioning thesis", riskIfLate: "The campaign scales without validation.",
      },
    ],
    notes: [{
      id: "note-1", route: "A&R → Manager", subject: "Positioning", message: "Positioning direction confirmed.", status: "filed",
      sourceBasis: "Artist review", recommendedAction: "Proceed", resultingChange: "Thesis approved", briefType: "handoff",
    }],
    events: [{ type: "Checkpoint updated", actor: "Manager", summary: "Market validation opened." }],
  };
}
