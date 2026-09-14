import { afterEach, describe, expect, it, vi } from "vitest";
import { runFrontDoorTransition } from "./features/onboarding/frontDoorTransition";

describe("front-door view transitions", () => {
  afterEach(() => {
    Reflect.deleteProperty(document, "startViewTransition");
  });

  it("handles skipped transition promises while applying the screen change once", () => {
    const readyCatch = vi.fn();
    const updateCatch = vi.fn();
    const finishedCatch = vi.fn();
    const change = vi.fn();
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      value: vi.fn((callback: () => void) => {
        callback();
        return {
          ready: { catch: readyCatch },
          updateCallbackDone: { catch: updateCatch },
          finished: { catch: finishedCatch },
        };
      }),
    });

    expect(runFrontDoorTransition(change)).toBe("view-transition");
    expect(change).toHaveBeenCalledTimes(1);
    expect(readyCatch).toHaveBeenCalledTimes(1);
    expect(updateCatch).toHaveBeenCalledTimes(1);
    expect(finishedCatch).toHaveBeenCalledTimes(1);
  });
});
