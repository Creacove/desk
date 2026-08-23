import { describe, expect, it } from "vitest";
import type { SetupPresentationFinding } from "../../../types/setupPresentation";
import {
  MAX_KNOWN_FINDINGS,
  MAX_SETTLED_FINDINGS,
  SETUP_PRESENTATION_MIN_DWELL_MS,
  createSetupPresentationQueueState,
  getCollapsedSettledCount,
  getVisibleSettledFindings,
  setupPresentationQueueReducer,
} from "./setupPresentationQueue";

function finding(index: number, overrides: Partial<SetupPresentationFinding> = {}): SetupPresentationFinding {
  return {
    id: `finding-${index}`,
    dedupeKey: `fact:${index}`,
    revision: "1",
    persistedAt: `2026-08-23T10:00:${String(index).padStart(2, "0")}.000Z`,
    phase: "discovery",
    kind: "audience",
    destination: "audience",
    platform: "spotify",
    title: `Finding ${index}`,
    value: String(index),
    ...overrides,
  };
}

function ingest(
  state: ReturnType<typeof createSetupPresentationQueueState>,
  findings: SetupPresentationFinding[],
  nowMs = 0,
) {
  return setupPresentationQueueReducer(state, {
    type: "ingest",
    sourceKey: "run-1",
    findings,
    nowMs,
  });
}

describe("setup presentation FIFO queue", () => {
  it("sorts the initial catch-up feed oldest-first and keeps later ingestion response-ordered", () => {
    let state = createSetupPresentationQueueState("run-1");
    state = ingest(state, [finding(3), finding(1), finding(2)]);
    expect(state.active?.id).toBe("finding-1");
    expect(state.pending.map((item) => item.id)).toEqual(["finding-2", "finding-3"]);

    state = ingest(state, [finding(5), finding(4)], 100);
    expect(state.pending.map((item) => item.id)).toEqual(["finding-2", "finding-3", "finding-5", "finding-4"]);
  });

  it("keeps one finding pinned without a timer-driving transition", () => {
    let state = ingest(createSetupPresentationQueueState("run-1"), [finding(1)], 0);
    state = setupPresentationQueueReducer(state, {
      type: "dwell_elapsed",
      nowMs: SETUP_PRESENTATION_MIN_DWELL_MS + 1_000,
      generation: state.generation,
    });
    expect(state.phase).toBe("holding");
    expect(state.active?.id).toBe("finding-1");
    expect(state.pending).toHaveLength(0);
  });

  it("does not land before 600ms, then requires explicit landing completion", () => {
    let state = ingest(createSetupPresentationQueueState("run-1"), [finding(1), finding(2)], 100);
    state = setupPresentationQueueReducer(state, {
      type: "dwell_elapsed",
      nowMs: 100 + SETUP_PRESENTATION_MIN_DWELL_MS - 1,
      generation: state.generation,
    });
    expect(state.phase).toBe("holding");
    state = setupPresentationQueueReducer(state, {
      type: "dwell_elapsed",
      nowMs: 100 + SETUP_PRESENTATION_MIN_DWELL_MS,
      generation: state.generation,
    });
    expect(state.phase).toBe("landing");
    expect(state.active?.id).toBe("finding-1");

    state = setupPresentationQueueReducer(state, {
      type: "landing_complete",
      nowMs: 900,
      generation: state.generation,
    });
    expect(state.phase).toBe("holding");
    expect(state.active?.id).toBe("finding-2");
    expect(state.settled.map((item) => item.id)).toEqual(["finding-1"]);
  });

  it("merges newer revisions in place and ignores stale revisions", () => {
    let state = ingest(createSetupPresentationQueueState("run-1"), [finding(1), finding(2)]);
    state = ingest(state, [finding(2, { revision: "3", value: "new" }), finding(1, { revision: "0", value: "old" })], 20);
    expect(state.pending[0]).toMatchObject({ id: "finding-2", revision: "3", value: "new" });
    expect(state.active).toMatchObject({ id: "finding-1", revision: "1", value: "1" });
  });

  it("rejects conflicting IDs and duplicate revisions without re-playing them", () => {
    let state = ingest(createSetupPresentationQueueState("run-1"), [finding(1)]);
    state = ingest(state, [
      finding(1, { dedupeKey: "different", revision: "9" }),
      finding(1, { revision: "1" }),
      finding(2),
    ], 20);
    expect(state.active?.id).toBe("finding-1");
    expect(state.pending.map((item) => item.id)).toEqual(["finding-2"]);
  });

  it("pauses hidden playback and resumes without draining the queue", () => {
    let state = ingest(createSetupPresentationQueueState("run-1"), [finding(1), finding(2)], 0);
    state = setupPresentationQueueReducer(state, { type: "pause", nowMs: 400 });
    expect(state.phase).toBe("paused");
    state = setupPresentationQueueReducer(state, { type: "dwell_elapsed", nowMs: 2_000, generation: state.generation });
    expect(state.phase).toBe("paused");
    state = setupPresentationQueueReducer(state, { type: "resume", nowMs: 2_000 });
    expect(state.phase).toBe("holding");
    state = setupPresentationQueueReducer(state, {
      type: "dwell_elapsed",
      nowMs: 2_000 + SETUP_PRESENTATION_MIN_DWELL_MS - 1,
      generation: state.generation,
    });
    expect(state.phase).toBe("holding");
  });

  it("resets on a new source and ignores stale generations", () => {
    let state = ingest(createSetupPresentationQueueState("run-1"), [finding(1), finding(2)]);
    const oldGeneration = state.generation;
    state = setupPresentationQueueReducer(state, {
      type: "ingest",
      sourceKey: "run-2",
      findings: [finding(9)],
      nowMs: 10,
    });
    expect(state.active?.id).toBe("finding-9");
    expect(state.pending).toHaveLength(0);
    state = setupPresentationQueueReducer(state, {
      type: "dwell_elapsed",
      nowMs: 10 + SETUP_PRESENTATION_MIN_DWELL_MS,
      generation: oldGeneration,
    });
    expect(state.phase).toBe("holding");
  });

  it("bounds settled history and the known registry", () => {
    let state = createSetupPresentationQueueState("run-1");
    const all = Array.from({ length: MAX_KNOWN_FINDINGS + 10 }, (_, index) => finding(index + 1));
    state = ingest(state, all, 0);
    for (let index = 0; index < all.length - 1; index += 1) {
      state = setupPresentationQueueReducer(state, {
        type: "dwell_elapsed",
        nowMs: 1_000 + index * 1_000,
        generation: state.generation,
      });
      if (state.phase === "landing") {
        state = setupPresentationQueueReducer(state, {
          type: "landing_complete",
          nowMs: 1_000 + index * 1_000 + 300,
          generation: state.generation,
        });
      }
    }
    expect(Object.keys(state.known)).toHaveLength(MAX_KNOWN_FINDINGS);
    expect(state.settled.length).toBeLessThanOrEqual(MAX_SETTLED_FINDINGS);
    expect(getVisibleSettledFindings(state)).toEqual(state.settled.slice(-MAX_SETTLED_FINDINGS));
    expect(getCollapsedSettledCount(state)).toBeGreaterThanOrEqual(0);
  });

  it("stop is terminal and clears retained queue data", () => {
    let state = ingest(createSetupPresentationQueueState("run-1"), [finding(1), finding(2)]);
    state = setupPresentationQueueReducer(state, { type: "stop" });
    expect(state.phase).toBe("stopped");
    expect(state.active).toBeNull();
    expect(state.pending).toEqual([]);
    expect(state.settled).toEqual([]);
    expect(state.known).toEqual({});
    const stopped = setupPresentationQueueReducer(state, {
      type: "ingest",
      sourceKey: "run-1",
      findings: [finding(3)],
      nowMs: 100,
    });
    expect(stopped).toEqual(state);
  });

  it("can restart after a terminal stop when setup is retried", () => {
    let state = ingest(createSetupPresentationQueueState("run-1"), [finding(1)]);
    state = setupPresentationQueueReducer(state, { type: "stop" });
    state = setupPresentationQueueReducer(state, {
      type: "restart",
      sourceKey: "run-1",
      findings: [finding(2)],
      nowMs: 100,
    });
    expect(state.phase).toBe("holding");
    expect(state.active?.id).toBe("finding-2");
  });
});
