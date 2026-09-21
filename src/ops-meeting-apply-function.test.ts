import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf8");

describe("Ops meeting apply boundary", () => {
  it("supports explicit apply/decline with operator re-authentication and replay", () => {
    const source = read("supabase", "functions", "ops-meeting-apply", "index.ts");
    expect(source).toContain("requireOperatorWorkspaceAccess");
    expect(source).toContain('decision: "apply" | "decline"');
    expect(source).toContain('sourceType: "ops_meeting"');
    expect(source).toContain("persistManagerMissionGraphDecisions");
    expect(source).toContain("meeting_applied");
    expect(source).toContain("meeting_declined");
    expect(source).toContain("finalize_ops_meeting_processing_v1");
    expect(source).toContain("created_from_run_id");
    expect(source).toContain("source_type: \"ops_meeting\"");
    expect(source).toContain("finalizeOnFailure");
    expect(source).toContain('"failed", sanitizeError(error)');
  });

  it("does not auto-apply from processing and keeps decline free of Desk writes", () => {
    const source = read("supabase", "functions", "ops-meeting-process", "index.ts");
    const review = read("src", "app", "OpsMeetingReview.tsx");
    expect(source).toContain("review_ready");
    expect(review).toContain("Apply changes");
    expect(review).toContain("Decline");
    expect(review).toContain("Transcript context");
    expect(review).toContain("Nothing changes in Desk until you apply it");
  });
});
