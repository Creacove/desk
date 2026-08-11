import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function edgeSource(name: string) {
  return readFileSync(join(process.cwd(), "supabase", "functions", name, "index.ts"), "utf8");
}

describe("high-fidelity central error capture", () => {
  it("records the original Manager exception and corrects usage failure bookkeeping", () => {
    for (const name of ["manager-conversation", "manager-conversation-stream"]) {
      const source = edgeSource(name);
      expect(source).toContain('from "../_shared/appError.ts"');
      expect(source).toContain("captureAppError(error");
      expect(source).toContain("failure_reason: errorMessage");
      expect(source).not.toContain('from("ai_run_usage_events").update({ status: "failed", error: errorMessage');
      expect(source).toContain('operation: "generate_reply"');
      expect(source).toContain("usage_event_id: usageId");
    }
  });

  it("keeps discovery diagnostics internal while returning only the safe projection", () => {
    const source = edgeSource("manager-artist-discovery");
    expect(source).toContain("captureAppError(error");
    expect(source).toContain('operation: "discover_artist"');
    expect(source).not.toContain("rawError }, 500");
    expect(source).not.toContain("rawError, // TEMP");
  });

  it("captures setup, mission, and brief failures with workflow references", () => {
    const setup = edgeSource("paid-workspace-setup");
    expect(setup).toContain("captureAppError(error");
    expect(setup).toContain('operation: "orchestrate_setup"');
    expect(setup).toContain("setup_run_id: setupRun?.id");

    const mission = edgeSource("mission-genesis");
    expect(mission).toContain("captureAppError(error");
    expect(mission).toContain('operation: "generate_mission"');
    expect(mission).toContain("manager_run_id: runId");

    const brief = edgeSource("generate-todays-brief");
    expect(brief).toContain("captureAppError(error");
    expect(brief).toContain('operation: "generate_todays_brief"');
    expect(brief).toContain("manager_run_id: args.runId");
  });

  it("captures recovery, billing, and music worker failures at their durable row", () => {
    const recovery = edgeSource("workflow-recovery");
    expect(recovery).toContain("captureAppError(dispatchError");
    expect(recovery).toContain('operation: "dispatch_recovery"');

    const paddle = edgeSource("paddle-process-webhooks");
    expect(paddle).toContain("captureAppError(processingError");
    expect(paddle).toContain("billing_event_id: event.id");

    const audio = edgeSource("music-audio-analysis-worker");
    expect(audio).toContain("captureAppError(error");
    expect(audio).toContain('operation: "analyze_audio"');

    const refresh = edgeSource("music-manager-read-refresh-worker");
    expect(refresh).toContain("captureAppError(error");
    expect(refresh).toContain('operation: "refresh_music_manager_reads"');
  });
});
