import { describe, expect, it } from "vitest";
import { assertSetupPresentationSnapshot } from "../src/services/setupPresentation";

const minimal = {
  version: 1,
  observedAt: "2026-08-18T08:00:00.000Z",
  setup: { status: "running", phase: "catalogue" },
};

describe("setup presentation client contract", () => {
  it("accepts a minimal valid snapshot", () => {
    expect(assertSetupPresentationSnapshot(minimal)).toEqual(minimal);
  });

  it("rejects an invalid catalogue state instead of letting bad data reach the UI", () => {
    expect(() => assertSetupPresentationSnapshot({
      ...minimal,
      catalogue: { state: "done", covers: [] },
    })).toThrow("invalid catalogue state");
  });

  it("rejects an invalid Manager state", () => {
    expect(() => assertSetupPresentationSnapshot({
      ...minimal,
      manager: { state: "thinking" },
    })).toThrow("invalid Manager state");
  });
});
