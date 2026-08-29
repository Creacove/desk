import { describe, expect, it } from "vitest";
import { buildReminderDrafts, buildReminderSummary } from "../supabase/functions/_shared/reminders";

describe("Manager reminder cadence", () => {
  const now = new Date("2026-08-29T09:00:00.000Z");
  const task = {
    available_from: "2026-08-29T10:00:00.000Z",
    deadline: "2026-08-29T18:00:00.000Z",
  };

  it("keeps light reminders intentionally sparse", () => {
    const drafts = buildReminderDrafts(task, "light", now);
    expect(drafts.map((item) => item.kind)).toEqual(["due_soon"]);
  });

  it("gives standard management a start, deadline and one overdue follow-up", () => {
    const drafts = buildReminderDrafts(task, "standard", now);
    expect(drafts.map((item) => item.kind)).toEqual(["task_start", "due_soon", "due_now", "overdue"]);
  });

  it("adds a check-in when the artist asks Desk to stay on them", () => {
    const drafts = buildReminderDrafts(task, "stay_on_me", now);
    expect(drafts.map((item) => item.kind)).toEqual(["task_start", "check_in", "due_soon", "due_now", "overdue"]);
  });

  it("writes reminders like a manager instead of a generic notification", () => {
    expect(buildReminderSummary("due_now", {
      taskTitle: "Record the first Odaeshi Tough Skin story",
      estimatedMinutes: 25,
      riskIfLate: "Tomorrow's response test will move.",
    })).toContain("Tomorrow's response test will move");

    expect(buildReminderSummary("task_start", {
      taskTitle: "Record the first Odaeshi Tough Skin story",
      estimatedMinutes: 25,
    })).toContain("25 min");
  });
});
