import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf8");

describe("Ops meeting processing boundary", () => {
  it("re-authenticates, checks the exact link, claims one run, and only writes review state", () => {
    const source = read("supabase", "functions", "ops-meeting-process", "index.ts");
    expect(source).toContain("requireOperatorWorkspaceAccess");
    expect(source).toContain("loadOpsMeetingContext");
    expect(source).toContain("claim_ops_meeting_processing_v1");
    expect(source).toContain("ops_meeting_ingestion_v1");
    expect(source).toContain("meeting_processed_for_review");
    expect(source).toContain("finalize_ops_meeting_processing_v1");
    expect(source).toContain("preflightManagerMissionGraphTasks");
    expect(source).not.toContain("persistManagerMissionGraphDecisions");
    expect(source).not.toContain('from("missions").insert');
    expect(source).not.toContain('from("tasks").insert');
    expect(source).not.toContain('from("memory_entries").insert');
  });

  it("bounds transcript and packet data and excludes it from audit metadata", () => {
    const packet = read("supabase", "functions", "_shared", "opsMeetingPacket.ts");
    const source = read("supabase", "functions", "ops-meeting-process", "index.ts");
    expect(packet).toContain("MAX_TRANSCRIPT_CHARS");
    expect(packet).toContain("currentMissions");
    expect(packet).toContain("evidence");
    expect(source).toContain("metadata");
    expect(source).not.toContain("metadata: { transcript");
  });
});
