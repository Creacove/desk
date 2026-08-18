import { describe, expect, it } from "vitest";
import { setupPresentationPollDelay } from "../src/features/onboarding/setup-presentation/setupPresentationPolling";
import type { SetupPresentationSnapshot } from "../src/types/setupPresentation";

const base: SetupPresentationSnapshot = {
  version: 1,
  observedAt: "2026-08-18T08:00:00.000Z",
  setup: { status: "running", phase: "discovery", phaseStartedAt: "2026-08-18T08:00:00.000Z" },
};

describe("setup presentation polling", () => {
  it("starts responsive, then becomes cheaper as the phase runs longer", () => {
    expect(setupPresentationPollDelay(base, Date.parse("2026-08-18T08:00:20.000Z"))).toBe(3_000);
    expect(setupPresentationPollDelay(base, Date.parse("2026-08-18T08:01:10.000Z"))).toBe(5_000);
    expect(setupPresentationPollDelay(base, Date.parse("2026-08-18T08:02:10.000Z"))).toBe(8_000);
  });

  it("does not inherit total setup age for a later phase before its start is persisted", () => {
    expect(setupPresentationPollDelay({
      ...base,
      setup: { ...base.setup, startedAt: "2026-08-18T07:55:00.000Z", phaseStartedAt: undefined },
    }, Date.parse("2026-08-18T08:02:10.000Z"))).toBe(3_000);
  });
});
