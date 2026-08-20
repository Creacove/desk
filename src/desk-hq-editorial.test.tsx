import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DeskHQScreen } from "./features/desk/DeskHQ";
import { productionFixtureData } from "./services/fixtureRepositories";
import type { TodayBriefViewModel } from "./types/cleanProduction";

afterEach(cleanup);

type HomeOverrides = Partial<ComponentProps<typeof DeskHQScreen>>;

function renderHome(overrides: HomeOverrides = {}) {
  const props: ComponentProps<typeof DeskHQScreen> = {
    profile: productionFixtureData.profile,
    todayBrief: productionFixtureData.todayBrief,
    todayBriefError: null,
    attention: productionFixtureData.attention,
    movement: productionFixtureData.movement,
    agents: productionFixtureData.agents,
    missions: productionFixtureData.missions,
    music: productionFixtureData.music,
    onNavigate: vi.fn(),
    onManager: vi.fn(),
    onOpenMission: vi.fn(),
    onLockedAgent: vi.fn(),
    onDrawer: vi.fn(),
    onOpenMusicFocus: vi.fn(),
    onAskManager: vi.fn(),
    activityCount: 3,
    onOpenActivityCenter: vi.fn(),
    briefPending: false,
    onRefreshBrief: vi.fn(),
    ...overrides,
  };
  return { ...render(<DeskHQScreen {...props} />), props };
}

function diverseBrief(): TodayBriefViewModel {
  return {
    ...productionFixtureData.todayBrief,
    intelligenceSnapshot: [
      {
        title: "Spotify audience",
        insight: "Spotify remains the largest audience source.",
        metrics: [
          { label: "Monthly listeners", value: "428K", context: "last 28 days", evidenceIds: ["sp-1"] },
          { label: "Followers", value: "96K", context: "current", evidenceIds: ["sp-2"] },
          { label: "Playlist reach", value: "1.8M", context: "last 28 days", evidenceIds: ["sp-3"] },
        ],
      },
      {
        title: "TikTok audience",
        insight: "Short-form response is growing.",
        metrics: [{ label: "Followers", value: "312K", context: "current", evidenceIds: ["tt-1"] }],
      },
      {
        title: "Shazam demand",
        insight: "Recognition is rising.",
        metrics: [{ label: "Shazam count", value: "18.4K", context: "90 days", evidenceIds: ["sh-1"] }],
      },
      {
        title: "YouTube audience",
        insight: "Video reach is material.",
        metrics: [{ label: "Views", value: "2.1M", context: "90 days", evidenceIds: ["yt-1"] }],
      },
    ],
  };
}

describe("Home premium briefing", () => {
  it("uses the shared Home workspace language without duplicating responsive content", () => {
    renderHome();

    expect(screen.getAllByRole("heading", { name: "Home" })).toHaveLength(1);
    expect(screen.getAllByRole("form", { name: "Work with Manager" })).toHaveLength(1);
    expect(screen.queryByText("Desk HQ")).not.toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Work with Manager on mobile" })).not.toBeInTheDocument();
  });

  it("keeps the Activity action comfortably tappable", () => {
    renderHome();

    expect(screen.getByRole("button", { name: "Open Activity Center, 3 unread" })).toHaveClass("min-h-11");
  });

  it("renders only meaningful Right Now work and preserves the existing destinations", () => {
    const onNavigate = vi.fn();
    const onDrawer = vi.fn();
    renderHome({ onNavigate, onDrawer });

    const rightNow = screen.getByTestId("desk-right-now");
    expect(within(rightNow).getAllByRole("button")).toHaveLength(2);

    fireEvent.click(within(rightNow).getByRole("button", { name: "Open Split approval" }));
    expect(onNavigate).toHaveBeenCalledWith("missionsWorkspace");

    fireEvent.click(within(rightNow).getByRole("button", { name: "Open Distributor package" }));
    expect(onDrawer).toHaveBeenCalledWith("evidence");
  });

  it("removes Right Now entirely when there is nothing actionable", () => {
    renderHome({ attention: [] });
    expect(screen.queryByTestId("desk-right-now")).not.toBeInTheDocument();
  });

  it("prioritizes strong metrics while using platform diversity as the tie-breaker", () => {
    renderHome({ todayBrief: diverseBrief() });

    const rail = screen.getByTestId("desk-signal-metric-strip");
    expect(within(rail).getByText("Spotify monthly listeners")).toBeInTheDocument();
    expect(within(rail).getByText("TikTok followers")).toBeInTheDocument();
    expect(within(rail).getByText("Shazams")).toBeInTheDocument();
    expect(within(rail).getByText("YouTube views")).toBeInTheDocument();
    expect(within(rail).queryByText("Spotify followers")).not.toBeInTheDocument();
    expect(within(rail).getAllByTestId("desk-signal-metric")).toHaveLength(4);
  });

  it("never pads Manager's Read with fabricated strategy copy", () => {
    renderHome({
      todayBrief: {
        ...productionFixtureData.todayBrief,
        managerRead: "One real operating read from Manager.",
        managerEvidenceReads: undefined,
      },
    });

    const read = screen.getByTestId("desk-manager-read");
    expect(within(read).getAllByTestId("desk-manager-read-segment")).toHaveLength(1);
    expect(within(read).getByText("One real operating read from Manager.")).toBeInTheDocument();
    expect(screen.queryByText(/compiling for this section/i)).not.toBeInTheDocument();
  });

  it("centers Manager's Read in one rail without a first-row padding exception", () => {
    renderHome();

    const managerRead = screen.getByTestId("desk-manager-read");
    const rail = screen.getByTestId("desk-manager-read-grid");
    const segments = within(rail).getAllByTestId("desk-manager-read-segment");
    const firstSegment = segments[0];

    expect({
      centeredRail: managerRead.classList.contains("os-briefing-rail") && managerRead.classList.contains("mx-auto"),
      singleColumn: rail.classList.contains("grid-cols-1") && !rail.classList.contains("lg:grid-cols-2"),
      firstRowPaddingException: firstSegment.classList.contains("lg:first:pl-0"),
    }).toEqual({
      centeredRail: true,
      singleColumn: true,
      firstRowPaddingException: false,
    });
    expect(managerRead).toHaveAttribute("aria-labelledby", "desk-manager-read-title");
    expect(within(managerRead).getByRole("heading", { name: "Manager's Read" })).toHaveAttribute("id", "desk-manager-read-title");
    expect(within(managerRead).getByRole("button", { name: "Evidence" })).toHaveClass("min-h-11");
  });

  it("keeps Manager's Read metadata separate from readable body copy", () => {
    renderHome();

    const rail = screen.getByTestId("desk-manager-read-grid");
    const segments = within(rail).getAllByTestId("desk-manager-read-segment");
    const segmentClassNames = segments.map((segment) => segment.className);
    const firstSegment = segments[0];
    const metadata = within(firstSegment).getByTestId("desk-manager-read-metadata");
    const body = within(firstSegment).getByTestId("desk-manager-read-body");

    expect(new Set(segmentClassNames).size).toBe(1);
    expect(firstSegment).toHaveClass("px-5", "py-5", "sm:px-7", "sm:py-7");
    expect(firstSegment).toHaveClass("grid-cols-1", "sm:grid-cols-[9rem_minmax(0,1fr)]");
    expect(metadata).toHaveClass("grid-cols-1", "sm:grid-cols-[2.25rem_minmax(0,1fr)]");
    expect(within(metadata).getByTestId("desk-manager-read-number")).toHaveTextContent("01");
    expect(within(metadata).getByTestId("desk-manager-read-label")).toBeInTheDocument();
    expect(within(metadata).queryByTestId("desk-manager-read-body")).not.toBeInTheDocument();
    expect(firstSegment.children[0]).toBe(metadata);
    expect(firstSegment.children[1]).toBe(body);
  });

  it("refreshes only on explicit action and keeps the current brief visible during pending or failure", () => {
    const onRefreshBrief = vi.fn();
    const first = renderHome({ onRefreshBrief });

    expect(onRefreshBrief).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Refresh Today's Brief" }));
    expect(onRefreshBrief).toHaveBeenCalledTimes(1);

    first.rerender(
      <DeskHQScreen
        {...first.props}
        briefPending
        todayBriefError={null}
        onRefreshBrief={onRefreshBrief}
      />,
    );
    expect(screen.getByRole("button", { name: "Refreshing Today's Brief" })).toBeDisabled();
    expect(screen.getByText(productionFixtureData.todayBrief.headlineRead)).toBeInTheDocument();

    first.rerender(
      <DeskHQScreen
        {...first.props}
        briefPending={false}
        todayBriefError="Upstream generation failed"
        onRefreshBrief={onRefreshBrief}
      />,
    );
    expect(screen.getByTestId("desk-brief-refresh-error")).toHaveTextContent("Couldn't refresh");
    expect(screen.getByText(productionFixtureData.todayBrief.headlineRead)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRefreshBrief).toHaveBeenCalledTimes(2);
  });
});
