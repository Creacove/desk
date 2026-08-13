import { describe, expect, it } from "vitest";
import { applyReleaseOffset, createSchedulePreview, hashSchedulePreview, previewScheduleChange } from "../supabase/functions/_shared/release-success/schedule";

describe("release success schedule", () => {
  it("applies offsets using UTC calendar dates", () => {
    expect(applyReleaseOffset("2026-09-09", -12)).toBe("2026-08-28");
    expect(applyReleaseOffset("2028-03-01", -1)).toBe("2028-02-29");
  });

  it("moves only active release-bound open tasks", () => {
    const preview = previewScheduleChange({
      currentReleaseDate: "2026-08-26",
      proposedReleaseDate: "2026-09-09",
      expectedRevision: 3,
      bindings: [
        { taskId: "bound-open", title: "Distributor delivery", deadline: "2026-08-14T00:00:00.000Z", offsetDays: -12, scheduleMode: "release_bound", taskStatus: "open" },
        { taskId: "fixed", title: "Photography booking", deadline: "2026-08-18T00:00:00.000Z", offsetDays: -8, scheduleMode: "fixed", taskStatus: "open" },
        { taskId: "manual", title: "Manual commitment", deadline: "2026-08-19T00:00:00.000Z", offsetDays: -7, scheduleMode: "manual", taskStatus: "open" },
        { taskId: "completed", title: "Completed task", deadline: "2026-08-20T00:00:00.000Z", offsetDays: -6, scheduleMode: "release_bound", taskStatus: "completed" },
        { taskId: "archived", title: "Archived task", deadline: "2026-08-21T00:00:00.000Z", offsetDays: -5, scheduleMode: "release_bound", taskStatus: "archived" },
      ],
    });
    expect(preview.changes.map((item) => item.taskId)).toEqual(["bound-open"]);
    expect(preview.changes[0].to).toBe("2026-08-28");
    expect(preview.preserved.map((item) => item.taskId)).toEqual(["archived", "completed", "fixed", "manual"]);
  });

  it("produces a stable hash and a hash-bearing preview", async () => {
    const preview = previewScheduleChange({ currentReleaseDate: "2026-08-26", proposedReleaseDate: "2026-09-09", expectedRevision: 1, bindings: [] });
    expect(await hashSchedulePreview(preview)).toMatch(/^[a-f0-9]{64}$/);
    const withHash = await createSchedulePreview({ currentReleaseDate: "2026-08-26", proposedReleaseDate: "2026-09-09", expectedRevision: 1, bindings: [] });
    expect(withHash.previewHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects impossible calendar dates", () => {
    expect(() => applyReleaseOffset("2026-02-30", 1)).toThrow(/Invalid ISO date/);
  });
});
