import { describe, expect, it } from "vitest";
import { enterDeskWithProgressiveTransition } from "../src/features/onboarding/setup-presentation/setupPresentationTransition";

describe("setup presentation final transition", () => {
  it("enters immediately when View Transitions are unavailable", () => {
    const original = (document as Document & { startViewTransition?: unknown }).startViewTransition;
    delete (document as Document & { startViewTransition?: unknown }).startViewTransition;
    let calls = 0;
    expect(enterDeskWithProgressiveTransition(() => { calls += 1; })).toBe("immediate");
    expect(calls).toBe(1);
    (document as Document & { startViewTransition?: unknown }).startViewTransition = original;
  });

  it("uses the browser transition when supported and still enters exactly once", () => {
    const original = (document as Document & { startViewTransition?: unknown }).startViewTransition;
    (document as Document & { startViewTransition?: (callback: () => void) => void }).startViewTransition = (callback) => callback();
    let calls = 0;
    expect(enterDeskWithProgressiveTransition(() => { calls += 1; })).toBe("view-transition");
    expect(calls).toBe(1);
    (document as Document & { startViewTransition?: unknown }).startViewTransition = original;
  });

  it("falls back safely if the transition API throws before entering", () => {
    const original = (document as Document & { startViewTransition?: unknown }).startViewTransition;
    (document as Document & { startViewTransition?: () => void }).startViewTransition = () => { throw new Error("unsupported"); };
    let calls = 0;
    expect(enterDeskWithProgressiveTransition(() => { calls += 1; })).toBe("immediate");
    expect(calls).toBe(1);
    (document as Document & { startViewTransition?: unknown }).startViewTransition = original;
  });
});
