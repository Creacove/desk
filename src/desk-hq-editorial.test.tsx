import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DeskHQScreen } from "./features/desk/DeskHQ";
import { productionFixtureData } from "./services/fixtureRepositories";

afterEach(cleanup);

function renderDeskHQ() {
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
    />,
  );
}

describe("Desk HQ editorial presentation", () => {
  it("presents desktop signals as one restrained evidence rail", () => {
    renderDeskHQ();

    const rail = screen.getByTestId("desk-signal-metric-strip");
    expect(rail).toHaveClass("divide-x", "divide-foreground/8");
    within(rail).getAllByTestId("desk-signal-metric-card").forEach((metric) => {
      expect(metric.className).not.toMatch(/bg-(violet|teal|rose|blue)-500/);
      expect(metric).not.toHaveClass("rounded-[14px]", "border");
    });
  });

  it("keeps mobile metrics together without four competing color cards", () => {
    renderDeskHQ();

    const grid = screen.getByTestId("desk-mobile-metrics-grid");
    expect(grid).toHaveClass("overflow-hidden", "rounded-[14px]", "border");
    screen.getAllByTestId("desk-mobile-metric-card").forEach((metric) => {
      expect(metric.className).not.toMatch(/bg-(violet|teal|rose|blue)-500/);
    });
  });

  it("renders Manager's Read as one continuous numbered editorial sequence", () => {
    renderDeskHQ();

    const read = screen.getByTestId("desk-desktop-manager-read");
    expect(read).toHaveClass("divide-y", "divide-foreground/8");
    const segments = screen.getAllByTestId("desk-manager-read-segment");
    expect(segments).toHaveLength(4);
    segments.forEach((segment) => {
      expect(segment).not.toHaveClass("rounded-[14px]", "border");
    });
  });
});
