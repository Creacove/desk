import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Manager artifact visual hierarchy", () => {
  it("renders created work as scannable typed objects rather than anonymous text rows", () => {
    const manager = readFileSync("src/features/manager/ManagerScreensLegacy.tsx", "utf8");

    for (const kind of ["document", "mission", "task", "song"] as const) {
      expect(manager).toContain(`data-artifact-kind="${kind}"`);
      expect(manager).toContain(`kind="${kind}"`);
    }
    expect(manager).toContain('data-testid={`manager-artifact-icon-${kind}`}');
    expect(manager).toContain('updated={group.mission.status === "updated"}');
    expect(manager).toContain('updated={group.tasks.some((task) => task.status === "updated")}');
    expect(manager).toContain('rounded-[14px] border border-foreground/[0.08] bg-foreground/[0.012]');
    expect(manager).toContain('View package');
  });
});
