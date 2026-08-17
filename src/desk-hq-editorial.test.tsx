import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DeskHQScreen } from "./features/desk/DeskHQ";
import { productionFixtureData } from "./services/fixtureRepositories";

afterEach(cleanup);

function renderHome() {
  render(
    <DeskHQScreen
      profile={productionFixtureData.profile}
      todayBrief={productionFixtureData.todayBrief}
      todayBriefError={null}
      attention={productionFixtureData.attention}
      movement={productionFixtureData.movement}
      agents={productionFixtureData.agents}
      missions={productionFixtureData.missions}
      music={productionFixtureData.music}
      onNavigate={vi.fn()}
      onManager={vi.fn()}
      onOpenMission={vi.fn()}
      onLockedAgent={vi.fn()}
      onDrawer={vi.fn()}
      onOpenMusicFocus={vi.fn()}
      onAskManager={vi.fn()}
      activityCount={3}
      onOpenActivityCenter={vi.fn()}
    />,
  );
}

describe("Home editorial presentation", () => {
  it("uses Home as the visible first-page language", () => {
    renderHome();

    expect(screen.getAllByRole("heading", { name: "Home" })).toHaveLength(1);
    expect(screen.queryByText("Desk HQ")).not.toBeInTheDocument();
    expect(screen.getAllByText("Artist workspace")).toHaveLength(1);
  });

  it("presents desktop signals as one flat evidence rail rather than metric cards", () => {
    renderHome();

    const rail = screen.getByTestId("desk-signal-metric-strip");
    expect(rail).toHaveClass("border-y", "divide-x", "divide-foreground/8");
    within(rail).getAllByTestId("desk-signal-metric-card").forEach((metric) => {
      expect(metric).not.toHaveClass("rounded-[14px]", "border", "shadow");
    });
  });

  it("keeps mobile metrics in the same flat information system", () => {
    renderHome();

    const grid = screen.getByTestId("desk-mobile-metrics-grid");
    expect(grid).toHaveClass("border-y", "border-foreground/8");
    expect(grid).not.toHaveClass("rounded-[14px]");
    screen.getAllByTestId("desk-mobile-metric-card").forEach((metric) => {
      expect(metric.className).not.toMatch(/bg-(violet|teal|rose|blue)-500/);
    });
  });

  it("keeps Manager's Read as one continuous four-part editorial sequence", () => {
    renderHome();

    const read = screen.getByTestId("desk-desktop-manager-read");
    expect(read).toHaveClass("divide-y", "border-y");
    const segments = screen.getAllByTestId("desk-manager-read-segment");
    expect(segments).toHaveLength(4);
    segments.forEach((segment) => {
      expect(segment).not.toHaveClass("rounded-[14px]", "border");
    });
  });

  it("keeps the Home brief focused without evidence CTAs", () => {
    renderHome();

    const desktopBrief = screen.getByTestId("desk-editorial-brief");
    expect(within(desktopBrief).queryByRole("button", { name: "View evidence" })).not.toBeInTheDocument();

    const mobileBrief = screen.getByTestId("desk-mobile-command-surface");
    expect(within(mobileBrief).queryByRole("button", { name: "View evidence" })).not.toBeInTheDocument();
  });

  it("gives attention and missions dedicated places without card soup", () => {
    renderHome();

    expect(screen.getAllByText("Right now")).toHaveLength(2);
    expect(screen.getAllByText("Missions").length).toBeGreaterThanOrEqual(2);
    screen.getAllByTestId("desk-focus-mission-card").forEach((mission) => {
      expect(mission.className).not.toMatch(/rounded|shadow/);
    });
  });

  it("keeps the Manager entry point present on both responsive surfaces", () => {
    renderHome();

    expect(screen.getByRole("form", { name: "Ask your manager" })).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "Ask your manager on mobile" })).toBeInTheDocument();
  });
});
