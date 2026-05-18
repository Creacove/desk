import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AiLabelPrototype from "./pages/AiLabelPrototype";

const enterLabelHq = () => {
  render(<AiLabelPrototype />);
  fireEvent.click(screen.getByRole("button", { name: /continue to artist context/i }));
  fireEvent.click(screen.getByRole("button", { name: /enter label hq/i }));
};

beforeEach(() => {
  Object.defineProperty(window, "scrollTo", { configurable: true, value: vi.fn() });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AiLabelPrototype Label HQ operating room", () => {
  it("exposes a mobile app shell with bottom navigation while keeping the desktop rail for larger screens", () => {
    enterLabelHq();

    const desktopRail = screen.getByRole("navigation", { name: /record label navigation/i });
    expect(desktopRail).toHaveClass("hidden", "lg:flex");

    const mobileTopBar = screen.getByTestId("mobile-app-topbar");
    expect(mobileTopBar).toHaveClass("lg:hidden");
    expect(mobileTopBar).toHaveTextContent(/ordersounds/i);
    expect(mobileTopBar).toHaveTextContent(/label hq/i);

    const mobileNav = screen.getByRole("navigation", { name: /mobile label navigation/i });
    expect(mobileNav).toHaveClass("lg:hidden");
    expect(screen.getByRole("button", { name: /^hq$/i })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^missions$/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /^manager$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^team$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^profile$/i })).toBeInTheDocument();
  }, 15000);

  it("keeps the core Label HQ workflow reachable in the mobile density layout", () => {
    enterLabelHq();

    expect(screen.getByTestId("mobile-priority-stack")).toBeInTheDocument();
    expect(screen.getByTestId("mobile-priority-stack")).toHaveTextContent(/needs attention/i);
    expect(screen.getByTestId("mobile-priority-stack")).toHaveTextContent(/active missions/i);
    expect(screen.getByTestId("mobile-team-strip")).toBeInTheDocument();
    expect(screen.getByTestId("mobile-team-strip")).toHaveTextContent(/team readiness/i);
    expect(screen.getByText(/today's brief/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /talk to manager/i })).toBeInTheDocument();
  });

  it("routes Label HQ strip signals to the right work surfaces", () => {
    enterLabelHq();
    fireEvent.click(screen.getByRole("button", { name: /open active missions/i }));
    expect(screen.getByRole("heading", { name: /^missions\.?$/i })).toBeInTheDocument();

    cleanup();
    enterLabelHq();
    fireEvent.click(screen.getByRole("button", { name: /open blocked rights task/i }));
    expect(screen.getByRole("heading", { name: /^release tasks\.?$/i })).toBeInTheDocument();

    cleanup();
    enterLabelHq();
    fireEvent.click(screen.getByRole("button", { name: /open next task/i }));
    expect(screen.getByRole("heading", { name: /^release tasks\.?$/i })).toBeInTheDocument();

    cleanup();
    enterLabelHq();
    fireEvent.click(screen.getByRole("button", { name: /open artist profile/i }));
    expect(screen.getByText(/artist identity/i)).toBeInTheDocument();
  }, 15000);

  it("uses compact mobile drill-down patterns for team, missions, tasks, and checkpoints", () => {
    enterLabelHq();

    fireEvent.click(screen.getByRole("button", { name: /^team$/i }));
    expect(screen.getByTestId("mobile-staff-roster")).toBeInTheDocument();
    expect(screen.getByTestId("mobile-staff-roster")).toHaveTextContent(/helps with/i);
    fireEvent.click(screen.getByRole("button", { name: /marketing lead/i }));
    expect(screen.getByText(/what this specialist needs/i)).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: /^missions$/i }).at(-1)!);
    expect(screen.getByTestId("mobile-mission-switcher")).toBeInTheDocument();
    expect(screen.getByTestId("mobile-mission-tabs")).toHaveTextContent(/tasks/i);
    expect(screen.getByTestId("mobile-mission-tabs")).toHaveTextContent(/checkpoints/i);
    expect(
      screen.getByTestId("mobile-mission-tabs").compareDocumentPosition(screen.getByText(/manager check-in/i)),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    fireEvent.click(screen.getAllByText(/^tasks$/i)[0].closest("button")!);
    expect(screen.getByTestId("mobile-task-stepper")).toBeInTheDocument();
    expect(screen.getByTestId("mobile-task-stepper")).toHaveTextContent(/release strategy/i);
    expect(screen.getAllByText(/checkpoint link/i).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /back/i }));
    fireEvent.click(screen.getAllByText(/^checkpoints$/i)[0].closest("button")!);
    expect(screen.getByTestId("mobile-checkpoint-list")).toBeInTheDocument();
    expect(screen.getByTestId("mobile-selected-checkpoint-detail")).toHaveTextContent(/manager recommendation/i);
    expect(screen.getByTestId("checkpoint-inspector")).toHaveTextContent(/manager recommendation/i);
  }, 15000);

  it("captures Artist Direction as long-form setup context without crowding Label HQ", () => {
    render(<AiLabelPrototype />);
    fireEvent.click(screen.getByRole("button", { name: /continue to artist context/i }));

    const direction = "Build Sable Day into a credible late-night R&B artist with real audience proof, careful release timing, and a team that protects the songs before chasing scale.";
    const directionField = screen.getByRole("textbox", { name: /artist direction/i });
    expect(directionField.tagName.toLowerCase()).toBe("textarea");
    fireEvent.change(directionField, { target: { value: direction } });
    fireEvent.click(screen.getByRole("button", { name: /enter label hq/i }));

    expect(screen.queryByText(direction)).not.toBeInTheDocument();
    expect(screen.getAllByText(/night bus/i).length).toBeGreaterThan(0);
  });

  it("makes Label HQ the operating room and keeps Manager Office focused on conversation", () => {
    enterLabelHq();

    expect(screen.getByRole("heading", { name: /^label hq$/i })).toBeInTheDocument();
    expect(screen.getByText(/label read/i)).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: /record label navigation/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^label hq$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^staff$/i })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^missions$/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /^settings$/i })).toBeInTheDocument();
    expect(screen.queryByText(/notifications/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^manager$/i })).toBeInTheDocument();
    expect(screen.queryByText(/^evidence$/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^review$/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/artist profile/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/operating dashboard/i)).not.toBeInTheDocument();
    expect(screen.getByText(/today's brief/i)).toBeInTheDocument();
    expect(screen.getByText(/momentum is durably building/i)).toBeInTheDocument();
    expect(screen.getByText(/The current release plan is stronger because the Manager refused/i)).toBeInTheDocument();
    expect(screen.getByText(/today's directive/i)).toBeInTheDocument();
    expect(screen.getByText(/focus/i)).toBeInTheDocument();
    expect(screen.getAllByText(/active missions/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/needs attention/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/manager read/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/next move/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/label staff/i)).toBeInTheDocument();
    expect(screen.getByText(/sync & deals/i)).toBeInTheDocument();
    expect(screen.getByText(/finance\/rights/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText(/view supporting evidence/i).closest("button")!);
    expect(screen.getByText(/evidence file/i)).toBeInTheDocument();
    expect(screen.getByText(/Private saves/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /close/i }));

    fireEvent.click(screen.getByText(/talk to manager/i).closest("button")!);

    expect(screen.getByText(/manager office/i)).toBeInTheDocument();
    expect(screen.getByText(/manager briefing/i)).toBeInTheDocument();
    expect(screen.getByText(/context needed/i)).toBeInTheDocument();
    expect(screen.getByText(/Manager needs these answers before making decisions/i)).toBeInTheDocument();
    expect(screen.getByText(/question list/i)).toBeInTheDocument();
    expect(screen.getByText(/active question/i)).toBeInTheDocument();
    expect(screen.queryByText(/manager directive/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/conversation history/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/current focus/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/flagged for you/i)).not.toBeInTheDocument();
  }, 15000);

  it("keeps Label HQ sidebar actions wired to durable prototype surfaces", () => {
    enterLabelHq();

    fireEvent.click(screen.getAllByRole("button", { name: /^missions$/i })[0]);
    expect(screen.getByRole("heading", { name: /^missions\.?$/i })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: /record label navigation/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^label hq$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^staff$/i })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^missions$/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /^settings$/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^settings$/i }));
    expect(screen.getByText(/artist identity/i)).toBeInTheDocument();
    expect(screen.getByText(/artist direction/i)).toBeInTheDocument();
    expect(screen.getByText(/current focus/i)).toBeInTheDocument();
    expect(screen.getByText(/connected channels/i)).toBeInTheDocument();
    expect(screen.getByText(/private data needed/i)).toBeInTheDocument();

    const settingsDirection = screen.getByRole("textbox", { name: /artist direction/i });
    const updatedDirection = "Spend the next quarter proving the Night Bus world, building direct fan demand, and only scaling spend when rights, content, and save data are clean.";
    fireEvent.change(settingsDirection, { target: { value: updatedDirection } });

    fireEvent.click(screen.getByRole("button", { name: /^label hq$/i }));
    expect(screen.queryByText(updatedDirection)).not.toBeInTheDocument();
    expect(screen.getAllByText(/night bus/i).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText(/talk to manager/i).closest("button")!);
    expect(screen.getByText(/manager office/i)).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: /record label navigation/i })).toBeInTheDocument();
  }, 15000);

  it("opens Staff as a durable sidebar destination and routes agents from there", () => {
    enterLabelHq();

    fireEvent.click(screen.getByRole("button", { name: /^staff$/i }));
    expect(screen.getByRole("heading", { name: /^artist team$/i })).toBeInTheDocument();
    expect(screen.getByText(/people around the artist/i)).toBeInTheDocument();
    expect(screen.getByText(/^5$/i)).toBeInTheDocument();
    expect(screen.getByText(/^1$/i)).toBeInTheDocument();
    expect(screen.getByText(/^4$/i)).toBeInTheDocument();
    expect(screen.getAllByText(/what they can help with/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/missing proof/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/needs context/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /^staff$/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /ai manager/i }));
    expect(screen.getByText(/manager office/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^staff$/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^staff$/i }));
    fireEvent.click(screen.getByRole("button", { name: /marketing lead/i }));
    expect(screen.getAllByRole("heading", { name: /marketing lead/i }).length).toBeGreaterThan(0);
    expect(screen.getByText(/what this specialist needs/i)).toBeInTheDocument();
    expect(screen.getByText(/missing proof/i)).toBeInTheDocument();
    expect(screen.getByText(/connected proof/i)).toBeInTheDocument();
    expect(screen.getByText(/what the manager can prepare/i)).toBeInTheDocument();
    expect(screen.getByText(/content analytics/i)).toBeInTheDocument();
    expect(screen.getByText(/campaign history/i)).toBeInTheDocument();
    expect(screen.queryByText(/this agent is locked/i)).not.toBeInTheDocument();
  }, 10000);

  it("shows compact agent source readiness inside agent rooms", () => {
    enterLabelHq();

    fireEvent.click(screen.getByRole("button", { name: /finance\/rights/i }));
    expect(screen.getByText(/what this specialist needs/i)).toBeInTheDocument();
    expect(screen.getByText(/royalty statements/i)).toBeInTheDocument();
    expect(screen.getByText(/split sheets/i)).toBeInTheDocument();
    expect(screen.getByText(/optional context/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /upload files/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /back/i }));
    fireEvent.click(screen.getByRole("button", { name: /sync & deals/i }));
    expect(screen.getByText(/rights clarity/i)).toBeInTheDocument();
    expect(screen.getByText(/pitch assets/i)).toBeInTheDocument();
  });

  it("makes notes helpful release-room communication and records mission memory", () => {
    enterLabelHq();
    fireEvent.click(screen.getByRole("button", { name: /release night bus on june 12/i }));

    fireEvent.click(screen.getAllByText(/^notes$/i)[0].closest("button")!);
    expect(screen.getByText(/Manager -> Marketing Lead/i)).toBeInTheDocument();
    expect(screen.getByText(/Creator seeding request/i)).toBeInTheDocument();
    expect(screen.getByText(/Build the creator target list around night-drive/i)).toBeInTheDocument();
    expect(screen.getByText(/Press angle and EPK request/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Evidence used:/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Resulting change:/i).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /approve for use/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^export$/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/^Message$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Linked mission$/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /back/i }));
    fireEvent.click(screen.getAllByText(/^memory$/i)[0].closest("button")!);
    expect(screen.getAllByText(/Mission memory/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/living recap of the mission/i)).toBeInTheDocument();
    expect(screen.getByText(/original request/i)).toBeInTheDocument();
    expect(screen.getAllByText(/I want to drop a new song next week/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/task status summary/i)).toBeInTheDocument();
    expect(screen.getByText(/checkpoint status summary/i)).toBeInTheDocument();
    expect(screen.getByText(/agent notes that changed the mission/i)).toBeInTheDocument();
    expect(screen.getByText(/decisions already made/i)).toBeInTheDocument();
    expect(screen.getByText(/blockers and missing evidence/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Manager moved the target from next Friday to Friday, June 12, 2026/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Mission log/i)).toBeInTheDocument();
    expect(screen.getByText(/task_result_added/i)).toBeInTheDocument();
    expect(screen.getByText(/recommendation_changed/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Current state$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Evidence used$/i)).not.toBeInTheDocument();
  }, 10000);

  it("keeps recent conversations as Manager threads after context is ready", () => {
    enterLabelHq();
    fireEvent.click(screen.getByRole("button", { name: /talk to manager/i }));

    while (screen.queryByRole("button", { name: /next question|submit context/i })) {
      fireEvent.click(screen.getByRole("button", { name: /use suggested context/i }));
      const saveButton = screen.queryByRole("button", { name: /next question|submit context/i });
      if (saveButton) fireEvent.click(saveButton);
    }

    expect(screen.getByText(/context synchronized/i)).toBeInTheDocument();
    expect(screen.getByText(/manager directive/i)).toBeInTheDocument();
    expect(screen.getByText(/conversation history/i)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /release plan/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /rights blocker/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /night bus release planning/i }));

    expect(screen.getByText(/direct message/i)).toBeInTheDocument();
    expect(screen.getAllByText(/night bus release planning/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/I want to drop a new song next week/i)).toBeInTheDocument();
    expect(screen.getByText(/Release Night Bus on June 12/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /open created mission/i }));
    expect(screen.getByText(/Mission overview/i)).toBeInTheDocument();
    expect(screen.getByText(/Manager check-in/i)).toBeInTheDocument();
  }, 10000);

  it("shows the release mission feedback loop from task reviews into checkpoints and mission memory", () => {
    enterLabelHq();

    fireEvent.click(screen.getByRole("button", { name: /release night bus on june 12/i }));

    expect(screen.getByText(/Mission overview/i)).toBeInTheDocument();
    expect(screen.getByTestId("mission-command-bar")).toBeInTheDocument();
    expect(screen.getByTestId("mission-surface-rail")).toBeInTheDocument();
    expect(screen.getAllByText(/Needs attention/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Rights & Metadata Gate/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Manager call/i)).toBeInTheDocument();
    expect(screen.getByText(/manager check-in/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /resume mission/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^archive$/i })).not.toBeInTheDocument();
    expect(screen.getByText(/manager recommendation/i)).toBeInTheDocument();
    expect(screen.getByText(/Move the release to Friday, June 12, 2026/i)).toBeInTheDocument();
    expect(screen.getByText(/what changed/i)).toBeInTheDocument();
    expect(screen.getByText(/preserved the Spotify pitch window/i)).toBeInTheDocument();
    expect(screen.queryByText(/what you need to do next/i)).not.toBeInTheDocument();
    expect(screen.getByText(/next task created/i)).toBeInTheDocument();
    expect(screen.getAllByText(/^tasks$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^checkpoints$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^notes$/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^memory$/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Mission Profile/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/full log/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByText(/^tasks$/i)[0].closest("button")!);
    expect(screen.getByText(/Release tasks/i)).toBeInTheDocument();
    expect(screen.getByText(/Checkpoint path/i)).toBeInTheDocument();
    expect(screen.getByTestId("task-checkpoint-chain-release-strategy")).toHaveAttribute("aria-current", "true");
    expect(screen.getByTestId("task-checkpoint-section-release-strategy")).toHaveAttribute("data-active", "true");
    expect(screen.getAllByText(/Clears when/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/needed to clear/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Rights & Metadata Gate/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/DSP & Playlist Gate/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Creator Seeding Gate/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Confirm split sheet/i)).toBeInTheDocument();
    expect(screen.getByText(/Submit Spotify for Artists pitch/i)).toBeInTheDocument();
    expect(screen.getByText(/Build TikTok creator target list/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Unlocks checkpoint/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Risk if late/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Checkpoint link/i).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByTestId("task-checkpoint-chain-dsp-playlist"));
    expect(screen.getByTestId("task-checkpoint-chain-dsp-playlist")).toHaveAttribute("aria-current", "true");
    expect(screen.getByTestId("task-checkpoint-section-dsp-playlist")).toHaveAttribute("data-active", "true");
    expect(screen.queryByText(/track saves, clicks, follows/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: /mark done/i })[3]);

    expect(screen.getAllByText(/Manager review/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Pitch submitted Monday with story, genre, mood, marketing plan/i)).toBeInTheDocument();
    expect(screen.getByText(/DSP gate improved/i)).toBeInTheDocument();
    expect(screen.getByText(/Prepare independent curator outreach using the same positioning/i)).toBeInTheDocument();
    expect(screen.getByText(/Confirm split sheet/i)).toBeInTheDocument();
    expect(screen.getByText(/Rights gate failed/i)).toBeInTheDocument();
    expect(screen.getByText(/Create urgent split approval task/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /back/i }));
    fireEvent.click(screen.getAllByText(/^checkpoints$/i)[0].closest("button")!);

    expect(screen.getByText(/mission checkpoints/i)).toBeInTheDocument();
    expect(screen.getByText(/Mission progress map/i)).toBeInTheDocument();
    expect(screen.getByText(/Reusable checkpoint model/i)).toBeInTheDocument();
    expect(screen.getByTestId("checkpoint-command-strip")).toBeInTheDocument();
    expect(screen.getByTestId("checkpoint-scroll-region")).toHaveClass("lg:max-h-[calc(100vh-245px)]");
    expect(screen.getByTestId("checkpoint-inspector")).toHaveClass("lg:sticky");
    expect(screen.getAllByText(/Checkpoint path/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Now viewing/i)).toBeInTheDocument();
    expect(screen.getByText(/progress map/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Required task results/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Release is not safe to ship until split approval is written/i)).toBeInTheDocument();
    expect(screen.getByText(/Proceed only after split approval/i)).toBeInTheDocument();
    expect(screen.getByText(/Move date/i)).toBeInTheDocument();
    expect(screen.queryByText(/You do not need to track this manually/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/AI-owned release readiness reviews/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId("checkpoint-summary-rail")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /DSP & Playlist Gate/i }));
    expect(screen.getByTestId("checkpoint-ledger-dsp-playlist")).toHaveAttribute("aria-current", "true");
    expect(screen.getByText(/Continue to independent curator outreach/i)).toBeInTheDocument();
    expect(screen.getByText(/Spotify pitch task strengthens the mission/i)).toBeInTheDocument();
    expect(screen.queryByText(/budget task state/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /approve cap/i })).not.toBeInTheDocument();
  }, 15000);
});
