import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SetupPresentationFeed, SetupPresentationSnapshot } from "../../../types/setupPresentation";
import ManagerWorkingFile from "./ManagerWorkingFile";

const runId = "11111111-1111-4111-8111-111111111111";

function feed(findings: SetupPresentationFeed["findings"]): SetupPresentationFeed {
  return {
    version: 2,
    observedAt: "2026-08-23T10:00:10.000Z",
    setup: {
      runId,
      artistWorkspaceId: "22222222-2222-4222-8222-222222222222",
      status: "running",
      phase: "discovery",
      startedAt: "2026-08-23T10:00:00.000Z",
      updatedAt: "2026-08-23T10:00:10.000Z",
    },
    artist: { name: "Teni", genres: ["Afrobeats", "Afropop"] },
    findings,
    projection: { bounded: true, maxFindings: 32, omittedMalformed: 0 },
  };
}

function finding(overrides: Partial<SetupPresentationFeed["findings"][number]> = {}): SetupPresentationFeed["findings"][number] {
  return {
    id: "finding-1",
    dedupeKey: "fact:1",
    revision: "1",
    persistedAt: "2026-08-23T10:00:01.000Z",
    phase: "catalogue",
    kind: "catalogue",
    destination: "catalogue",
    platform: "spotify",
    title: "Tracks",
    value: "28",
    detail: "Catalogue connected",
    ...overrides,
  };
}

function snapshot(nextFeed: SetupPresentationFeed): SetupPresentationSnapshot {
  return {
    version: 1,
    observedAt: nextFeed.observedAt,
    feed: nextFeed,
    setup: {
      status: nextFeed.setup.status,
      phase: nextFeed.setup.phase,
      startedAt: nextFeed.setup.startedAt,
      updatedAt: nextFeed.setup.updatedAt,
    },
    artist: nextFeed.artist,
  };
}

describe("ManagerWorkingFile", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("makes the working file the protagonist and lands findings in FIFO order", () => {
    vi.useFakeTimers();
    const current = feed([
      finding(),
      finding({
        id: "finding-2",
        dedupeKey: "audience:monthly-listeners",
        persistedAt: "2026-08-23T10:00:02.000Z",
        phase: "discovery",
        kind: "audience",
        destination: "audience",
        title: "Monthly listeners",
        value: "4.8M",
        detail: "Spotify audience",
      }),
    ]);
    render(<ManagerWorkingFile snapshot={snapshot(current)} />);

    expect(screen.getByTestId("manager-working-file")).toBeTruthy();
    expect(screen.getByTestId("manager-file-active-finding").textContent).toContain("28");
    expect(screen.getByTestId("manager-file-phase").textContent).toContain("Finding the signals that matter");

    act(() => vi.advanceTimersByTime(600));
    expect(screen.getByTestId("manager-file-active-finding").getAttribute("data-motion-phase")).toBe("landing");
    act(() => vi.advanceTimersByTime(220));
    expect(screen.getByTestId("manager-file-active-finding").textContent).toContain("4.8M");
    expect(screen.getByTestId("manager-file-settled").textContent).toContain("Tracks");
  });

  it("keeps platform wording user-facing and never renders an internal vendor", () => {
    const current = feed([finding({ detail: "Spotify catalogue" })]);
    render(<ManagerWorkingFile snapshot={snapshot(current)} />);
    expect(screen.getByTestId("manager-file-active-finding").textContent).toContain("Spotify catalogue");
    expect(screen.queryByText(/chartmetric/i)).toBeNull();
    expect(screen.queryByText(/manager_discovery_tool/i)).toBeNull();
  });

  it("falls back to a monogram when artwork fails without blocking the finding", () => {
    const current = feed([finding({ artwork: { url: "https://cdn.example.com/cover.jpg", alt: "No Days Off" } })]);
    render(<ManagerWorkingFile snapshot={snapshot(current)} />);
    fireEvent.error(screen.getByTestId("manager-file-active-artwork"));
    expect(screen.getByTestId("manager-file-artwork-fallback").textContent).toContain("N");
  });

  it("shows a truthful waiting state when no finding has arrived", () => {
    render(<ManagerWorkingFile snapshot={snapshot(feed([]))} />);
    expect(screen.getByTestId("manager-file-waiting").textContent).toContain("Waiting for the next confirmed finding");
    expect(screen.getByTestId("manager-working-file").getAttribute("data-reduced-motion")).toBe("false");
  });
});
