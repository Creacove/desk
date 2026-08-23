import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SetupPresentationFinding } from "../../../types/setupPresentation";
import {
  SETUP_PRESENTATION_LANDING_MS,
  useSetupPresentationQueue,
} from "./useSetupPresentationQueue";

function finding(index: number): SetupPresentationFinding {
  return {
    id: `finding-${index}`,
    dedupeKey: `fact:${index}`,
    revision: "1",
    persistedAt: `2026-08-23T10:00:0${index}.000Z`,
    phase: "discovery",
    kind: "audience",
    destination: "audience",
    platform: "spotify",
    title: `Finding ${index}`,
    value: String(index),
  };
}

describe("useSetupPresentationQueue", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("plays the initial feed FIFO, holds each finding for the dwell, and advances after landing", () => {
    vi.useFakeTimers();
    const findings = [finding(1), finding(2), finding(3)];
    const rendered = renderHook(() => useSetupPresentationQueue({
      sourceKey: "run-1",
      findings,
      status: "running",
      reducedMotion: false,
    }));

    expect(rendered.result.current.active?.id).toBe("finding-1");
    expect(rendered.result.current.state.phase).toBe("holding");

    act(() => vi.advanceTimersByTime(599));
    expect(rendered.result.current.active?.id).toBe("finding-1");
    expect(rendered.result.current.state.phase).toBe("holding");

    act(() => vi.advanceTimersByTime(1));
    expect(rendered.result.current.state.phase).toBe("landing");
    expect(rendered.result.current.active?.id).toBe("finding-1");

    act(() => vi.advanceTimersByTime(SETUP_PRESENTATION_LANDING_MS));
    expect(rendered.result.current.active?.id).toBe("finding-2");
    expect(rendered.result.current.state.phase).toBe("holding");
    expect(rendered.result.current.settled.map((item) => item.id)).toEqual(["finding-1"]);
  });

  it("keeps a lone finding visible until another finding arrives", () => {
    vi.useFakeTimers();
    const rendered = renderHook(({ findings }) => useSetupPresentationQueue({
      sourceKey: "run-1",
      findings,
      status: "running",
      reducedMotion: false,
    }), { initialProps: { findings: [finding(1)] } });

    act(() => vi.advanceTimersByTime(10_000));
    expect(rendered.result.current.active?.id).toBe("finding-1");
    expect(rendered.result.current.state.phase).toBe("holding");

    rendered.rerender({ findings: [finding(1), finding(2)] });
    act(() => vi.advanceTimersByTime(599));
    expect(rendered.result.current.active?.id).toBe("finding-1");
    act(() => vi.advanceTimersByTime(1));
    expect(rendered.result.current.state.phase).toBe("landing");
    act(() => vi.advanceTimersByTime(SETUP_PRESENTATION_LANDING_MS));
    expect(rendered.result.current.active?.id).toBe("finding-2");
  });

  it("pauses while hidden and resumes without draining the queue", () => {
    vi.useFakeTimers();
    const originalVisibility = document.visibilityState;
    const rendered = renderHook(() => useSetupPresentationQueue({
      sourceKey: "run-1",
      findings: [finding(1), finding(2)],
      status: "running",
      reducedMotion: false,
    }));

    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    act(() => vi.advanceTimersByTime(10_000));
    expect(rendered.result.current.state.phase).toBe("paused");
    expect(rendered.result.current.active?.id).toBe("finding-1");

    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    act(() => vi.advanceTimersByTime(599));
    expect(rendered.result.current.active?.id).toBe("finding-1");
    act(() => vi.advanceTimersByTime(1));
    expect(rendered.result.current.state.phase).toBe("landing");
    act(() => vi.advanceTimersByTime(SETUP_PRESENTATION_LANDING_MS));
    expect(rendered.result.current.active?.id).toBe("finding-2");

    Object.defineProperty(document, "visibilityState", { configurable: true, value: originalVisibility });
  });

  it("stops immediately when setup reaches a terminal state", () => {
    vi.useFakeTimers();
    const rendered = renderHook(({ status }) => useSetupPresentationQueue({
      sourceKey: "run-1",
      findings: [finding(1), finding(2)],
      status,
      reducedMotion: false,
    }), { initialProps: { status: "running" as const } });

    rendered.rerender({ status: "completed" });
    expect(rendered.result.current.active).toBeNull();
    expect(rendered.result.current.state.phase).toBe("stopped");
    expect(rendered.result.current.state.pending).toEqual([]);
  });

  it("does not spend a landing duration when reduced motion is requested", () => {
    vi.useFakeTimers();
    const rendered = renderHook(() => useSetupPresentationQueue({
      sourceKey: "run-1",
      findings: [finding(1), finding(2)],
      status: "running",
      reducedMotion: true,
    }));

    act(() => vi.advanceTimersByTime(600));
    expect(rendered.result.current.state.phase).toBe("landing");
    act(() => vi.runOnlyPendingTimers());
    expect(rendered.result.current.active?.id).toBe("finding-2");
  });
});
