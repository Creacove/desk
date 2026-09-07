import { describe, expect, it } from "vitest";

import { getTaskLifecycleLabel } from "./features/missions/missionModel";
import type { MissionTaskViewModel } from "./types/cleanProduction";

const task = (readiness: MissionTaskViewModel["readiness"] = "ready") => ({ readiness }) as MissionTaskViewModel;

describe("mission task lifecycle labels", () => {
  it("names the next action from the task state", () => {
    expect(getTaskLifecycleLabel(task(), false, false)).toBe("Start task");
    expect(getTaskLifecycleLabel(task(), true, false)).toBe("Finish task");
    expect(getTaskLifecycleLabel(task("needs_revision"), false, false)).toBe("Continue task");
    expect(getTaskLifecycleLabel(task(), true, true)).toBe("Completed");
  });
});
