import { afterEach, describe, expect, it, vi } from "vitest";
import { runFrontDoorTransition } from "../src/features/onboarding/frontDoorTransition";

const originalDocument = globalThis.document;
const originalWindow = globalThis.window;

afterEach(() => {
  Object.defineProperty(globalThis, "document", { configurable: true, value: originalDocument });
  Object.defineProperty(globalThis, "window", { configurable: true, value: originalWindow });
});

describe("front-door view transitions", () => {
  it("changes immediately when the browser does not support view transitions", () => {
    const change = vi.fn();
    Object.defineProperty(globalThis, "window", { configurable: true, value: { matchMedia: () => ({ matches: false }) } });
    Object.defineProperty(globalThis, "document", { configurable: true, value: {} });
    expect(runFrontDoorTransition(change)).toBe("immediate");
    expect(change).toHaveBeenCalledTimes(1);
  });

  it("uses the browser transition when supported", () => {
    const change = vi.fn();
    Object.defineProperty(globalThis, "window", { configurable: true, value: { matchMedia: () => ({ matches: false }) } });
    Object.defineProperty(globalThis, "document", { configurable: true, value: { startViewTransition(callback: () => void) { callback(); } } });
    expect(runFrontDoorTransition(change)).toBe("view-transition");
    expect(change).toHaveBeenCalledTimes(1);
  });

  it("falls back exactly once if the browser transition throws", () => {
    const change = vi.fn();
    Object.defineProperty(globalThis, "window", { configurable: true, value: { matchMedia: () => ({ matches: false }) } });
    Object.defineProperty(globalThis, "document", { configurable: true, value: { startViewTransition() { throw new Error("transition failed"); } } });
    expect(runFrontDoorTransition(change)).toBe("immediate");
    expect(change).toHaveBeenCalledTimes(1);
  });

  it("respects reduced motion", () => {
    const change = vi.fn();
    Object.defineProperty(globalThis, "window", { configurable: true, value: { matchMedia: () => ({ matches: true }) } });
    Object.defineProperty(globalThis, "document", { configurable: true, value: { startViewTransition(callback: () => void) { callback(); } } });
    expect(runFrontDoorTransition(change)).toBe("immediate");
    expect(change).toHaveBeenCalledTimes(1);
  });
});
