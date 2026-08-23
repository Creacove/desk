import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createActiveRunFallback } from "./services/activeRunFallback";

describe("createActiveRunFallback", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("waits for a pending check to settle before scheduling the next backoff", async () => {
    let release: ((result: "active") => void) | undefined;
    const check = vi.fn(() => new Promise<"active">((resolve) => {
      release = resolve;
    }));
    const fallback = createActiveRunFallback({
      delaysMs: [5_000, 10_000],
      deadlineMs: 60_000,
      isVisible: () => true,
      isOnline: () => true,
      check,
      onTerminal: vi.fn(),
    });

    fallback.start();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(check).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(30_000);
    expect(check).toHaveBeenCalledTimes(1);

    release?.("active");
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(9_999);
    expect(check).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(check).toHaveBeenCalledTimes(2);
  });

  it("progresses through delays and caps at the final delay", async () => {
    const check = vi.fn(async () => "active" as const);
    const fallback = createActiveRunFallback({
      delaysMs: [5_000, 10_000, 20_000, 30_000],
      deadlineMs: 180_000,
      isVisible: () => true,
      isOnline: () => true,
      check,
      onTerminal: vi.fn(),
    });

    fallback.start();
    await vi.advanceTimersByTimeAsync(4_999);
    expect(check).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(check).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(check).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(check).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(check).toHaveBeenCalledTimes(4);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(check).toHaveBeenCalledTimes(5);
  });

  it("pauses without traffic while hidden or offline and resumes with one immediate check", async () => {
    let visible = false;
    let online = true;
    let release: ((result: "active") => void) | undefined;
    const check = vi.fn(() => new Promise<"active">((resolve) => {
      release = resolve;
    }));
    const fallback = createActiveRunFallback({
      delaysMs: [5_000],
      deadlineMs: 60_000,
      isVisible: () => visible,
      isOnline: () => online,
      check,
      onTerminal: vi.fn(),
    });

    fallback.start();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(check).not.toHaveBeenCalled();

    visible = true;
    online = false;
    fallback.resume();
    expect(check).not.toHaveBeenCalled();

    online = true;
    fallback.resume();
    fallback.resume();
    expect(check).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(30_000);
    fallback.resume();
    expect(check).toHaveBeenCalledTimes(1);

    release?.("active");
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(check).toHaveBeenCalledTimes(2);
  });

  it("keeps a wake-up scheduled when a visibility resume event is missed", async () => {
    let visible = false;
    const check = vi.fn(async () => "active" as const);
    const fallback = createActiveRunFallback({
      delaysMs: [5_000],
      deadlineMs: 60_000,
      isVisible: () => visible,
      isOnline: () => true,
      check,
      onTerminal: vi.fn(),
    });

    fallback.start();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(check).not.toHaveBeenCalled();

    visible = true;
    await vi.advanceTimersByTimeAsync(4_999);
    expect(check).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(check).toHaveBeenCalledTimes(1);
  });

  it("calls onTerminal exactly once and stops future work", async () => {
    const onTerminal = vi.fn();
    const check = vi.fn(async () => "terminal" as const);
    const fallback = createActiveRunFallback({
      delaysMs: [1_000],
      deadlineMs: 30_000,
      isVisible: () => true,
      isOnline: () => true,
      check,
      onTerminal,
    });

    fallback.start();
    await vi.advanceTimersByTimeAsync(1_000);
    fallback.resume();
    await vi.advanceTimersByTimeAsync(30_000);

    expect(check).toHaveBeenCalledTimes(1);
    expect(onTerminal).toHaveBeenCalledTimes(1);
  });

  it("stops at its deadline and stop clears pending work", async () => {
    const deadlineCheck = vi.fn(async () => "active" as const);
    const deadlineFallback = createActiveRunFallback({
      delaysMs: [2_000],
      deadlineMs: 5_000,
      isVisible: () => true,
      isOnline: () => true,
      check: deadlineCheck,
      onTerminal: vi.fn(),
    });
    deadlineFallback.start();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(deadlineCheck).toHaveBeenCalledTimes(2);

    const stoppedCheck = vi.fn(async () => "active" as const);
    const stoppedFallback = createActiveRunFallback({
      delaysMs: [1_000],
      deadlineMs: 10_000,
      isVisible: () => true,
      isOnline: () => true,
      check: stoppedCheck,
      onTerminal: vi.fn(),
    });
    stoppedFallback.start();
    stoppedFallback.stop();
    await vi.advanceTimersByTimeAsync(10_000);
    stoppedFallback.resume();
    expect(stoppedCheck).not.toHaveBeenCalled();
  });

  it("reports errors and schedules a bounded retry only after rejection settles", async () => {
    let reject: ((error: Error) => void) | undefined;
    const check = vi.fn()
      .mockImplementationOnce(() => new Promise<"active">((_resolve, rejectPromise) => {
        reject = rejectPromise;
      }))
      .mockResolvedValue("active");
    const onError = vi.fn();
    const fallback = createActiveRunFallback({
      delaysMs: [1_000, 2_000],
      deadlineMs: 20_000,
      isVisible: () => true,
      isOnline: () => true,
      check,
      onTerminal: vi.fn(),
      onError,
    });

    fallback.start();
    await vi.advanceTimersByTimeAsync(1_000);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(check).toHaveBeenCalledTimes(1);

    const error = new Error("temporary");
    reject?.(error);
    await Promise.resolve();
    expect(onError).toHaveBeenCalledWith(error);
    await vi.advanceTimersByTimeAsync(1_999);
    expect(check).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(check).toHaveBeenCalledTimes(2);
  });

  it("rejects empty, non-positive, or non-finite timing configuration", () => {
    const base = {
      isVisible: () => true,
      isOnline: () => true,
      check: async () => "active" as const,
      onTerminal: vi.fn(),
    };

    expect(() => createActiveRunFallback({ ...base, delaysMs: [], deadlineMs: 1_000 })).toThrow(/delays/i);
    expect(() => createActiveRunFallback({ ...base, delaysMs: [0], deadlineMs: 1_000 })).toThrow(/delays/i);
    expect(() => createActiveRunFallback({ ...base, delaysMs: [Number.POSITIVE_INFINITY], deadlineMs: 1_000 })).toThrow(/delays/i);
    expect(() => createActiveRunFallback({ ...base, delaysMs: [1_000], deadlineMs: 0 })).toThrow(/deadline/i);
  });
});
