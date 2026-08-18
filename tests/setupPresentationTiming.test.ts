import { describe, expect, it } from "vitest";
import type { SetupPresentationSnapshot } from "../src/types/setupPresentation";
import { setupPresentationTiming } from "../src/features/onboarding/setup-presentation/setupPresentationTiming";

const snapshot: SetupPresentationSnapshot = {
  version: 1,
  observedAt: "2026-08-18T08:00:00.000Z",
  setup: {
    status: "running",
    phase: "discovery",
    startedAt: "2026-08-18T07:58:00.000Z",
    phaseStartedAt: "2026-08-18T08:00:00.000Z",
  },
};

describe("setup presentation long-running language", () => {
  it("stays quiet while active work is still within the normal window", () => {
    expect(setupPresentationTiming(snapshot, Date.parse("2026-08-18T08:00:30.000Z"))).toMatchObject({ level: "normal", canLeave: false });
  });

  it("reassures without pretending to know a completion percentage", () => {
    expect(setupPresentationTiming(snapshot, Date.parse("2026-08-18T08:00:50.000Z"))).toMatchObject({
      level: "reassure",
      message: "Desk is still checking signals before it gives you a read.",
      canLeave: false,
    });
  });

  it("explains autonomy after 90 seconds of the current phase", () => {
    expect(setupPresentationTiming(snapshot, Date.parse("2026-08-18T08:01:31.000Z"))).toMatchObject({
      level: "extended",
      message: "This is taking a little longer. Your work is saved — you can leave this tab and come back.",
      canLeave: true,
    });
  });

  it("uses phaseStartedAt instead of total setup age", () => {
    const timing = setupPresentationTiming(snapshot, Date.parse("2026-08-18T08:00:30.000Z"));
    expect(timing.elapsedMs).toBe(30_000);
  });

  it("does not use total setup age for a later phase before that phase has a persisted start", () => {
    const timing = setupPresentationTiming({
      ...snapshot,
      setup: { ...snapshot.setup, phaseStartedAt: undefined },
    }, Date.parse("2026-08-18T08:02:00.000Z"));
    expect(timing).toMatchObject({ level: "normal", elapsedMs: 0 });
  });

  it("can use setup start time for the first catalogue phase", () => {
    const timing = setupPresentationTiming({
      ...snapshot,
      setup: { ...snapshot.setup, phase: "catalogue", phaseStartedAt: undefined, startedAt: "2026-08-18T08:00:00.000Z" },
    }, Date.parse("2026-08-18T08:00:50.000Z"));
    expect(timing.level).toBe("reassure");
  });

  it("never shows long-running language after setup is complete", () => {
    expect(setupPresentationTiming({
      ...snapshot,
      setup: { ...snapshot.setup, status: "completed", phase: "ready" },
    }, Date.parse("2026-08-18T08:05:00.000Z"))).toMatchObject({ level: "normal", elapsedMs: 0 });
  });
});
