import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeAppError } from "../supabase/functions/_shared/appError";

function edgeSource(name: string) {
  return readFileSync(join(process.cwd(), "supabase", "functions", name, "index.ts"), "utf8");
}

function sharedSource(name: string) {
  return readFileSync(join(process.cwd(), "supabase", "functions", "_shared", name), "utf8");
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

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

  it("keeps the complete Video One stage vocabulary and correlation fields in central rows", () => {
    const stages = [
      "subject_resolution",
      "release_assessment",
      "mission_read",
      "opportunity_search",
      "source_inspection",
      "contact_verification",
      "opportunity_persistence",
      "document_generation",
      "document_persistence",
      "share_package_creation",
      "reschedule_preview",
      "reschedule_approval",
      "schedule_recalculation",
      "realtime_refresh",
      "receipt_render",
    ];
    const ids = {
      accountId: "11111111-1111-4111-8111-111111111111",
      artistWorkspaceId: "22222222-2222-4222-8222-222222222222",
      artistId: "33333333-3333-4333-8333-333333333333",
      conversationId: "44444444-4444-4444-8444-444444444444",
      managerRunId: "55555555-5555-4555-8555-555555555555",
      missionId: "66666666-6666-4666-8666-666666666666",
      taskId: "77777777-7777-4777-8777-777777777777",
      musicItemId: "88888888-8888-4888-8888-888888888888",
      releasePlanId: "99999999-9999-4999-8999-999999999999",
      requestId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      opportunityId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      documentId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      traceId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    };
    vi.stubGlobal("Deno", {
      env: {
        get: (name: string) => ({ APP_ENVIRONMENT: "test", APP_RELEASE: "video-one-test" })[name],
      },
    });

    for (const stage of stages) {
      const row = normalizeAppError(new Error(`unexpected ${stage}`), {
        functionName: "manager-conversation-stream",
        operation: "video_one_release_success",
        source: "edge",
        requestId: ids.requestId,
        traceId: ids.traceId,
        accountId: ids.accountId,
        artistWorkspaceId: ids.artistWorkspaceId,
        artistId: ids.artistId,
        provider: "openai",
        providerRequestId: "provider-request-1",
        refs: {
          conversation_id: ids.conversationId,
          manager_run_id: ids.managerRunId,
          mission_id: ids.missionId,
          task_id: ids.taskId,
          music_item_id: ids.musicItemId,
          stage,
          attempt: 2,
        },
        context: {
          releasePlanId: ids.releasePlanId,
          releaseRequestId: ids.requestId,
          opportunityId: ids.opportunityId,
          documentId: ids.documentId,
          idempotency_key: "release-approval:attempt-2",
          prompt: "private prompt body",
          lyrics: "private lyrics",
          document_body: "private document body",
          access_token: "private access token",
          cookie: "private cookie",
          signed_url: "https://storage.example.test/file?token=private&expires=123",
        },
      });

      expect(row).toMatchObject({
        environment: "test",
        release_version: "video-one-test",
        account_id: ids.accountId,
        artist_workspace_id: ids.artistWorkspaceId,
        artist_id: ids.artistId,
        conversation_id: ids.conversationId,
        manager_run_id: ids.managerRunId,
        mission_id: ids.missionId,
        task_id: ids.taskId,
        music_item_id: ids.musicItemId,
        request_id: ids.requestId,
        trace_id: ids.traceId,
        provider_request_id: "provider-request-1",
        attempt: 2,
        stage,
      });
      expect(row.context).toMatchObject({
        releasePlanId: ids.releasePlanId,
        releaseRequestId: ids.requestId,
        opportunityId: ids.opportunityId,
        documentId: ids.documentId,
        idempotency_key: "release-approval:attempt-2",
      });
      const serialized = JSON.stringify(row);
      for (const secret of ["private prompt body", "private lyrics", "private document body", "private access token", "private cookie", "token=private"]) {
        expect(serialized).not.toContain(secret);
      }
      expect(serialized).toContain("[REDACTED]");
    }
  });

  it("keeps release-success, opportunity, and reschedule failures on the central capture path", () => {
    const stream = edgeSource("manager-conversation-stream");
    const planChange = edgeSource("release-plan-change");
    const toolExecutor = sharedSource(join("manager-conversation", "toolExecutor.ts"));

    expect(stream).toContain('operation: isOpportunityTool(name) ? "release_opportunity_tool" : "release_success_tool"');
    expect(stream).toContain('operation: "release_success_artifact_persistence"');
    expect(stream).toContain("stage: isOpportunityTool(name) ? opportunityToolStage(name) : name");
    expect(planChange).toContain('stage = action === "approve" ? "reschedule_approval" : "reschedule_preview"');
    expect(planChange).toContain("captureAppError(error");
    expect(toolExecutor).toContain('operation: "release_opportunity_workflow"');
    expect(toolExecutor).toContain('"opportunity_search"');
    expect(toolExecutor).toContain('"contact_verification"');
    expect(toolExecutor).toContain('"opportunity_persistence"');
  });

  it("captures handled browser release failures and receipt rendering with stage correlation", () => {
    const productionApp = readFileSync(join(process.cwd(), "src", "app", "ProductionApp.tsx"), "utf8");
    const artifact = readFileSync(join(process.cwd(), "src", "features", "manager", "ReleaseSuccessArtifact.tsx"), "utf8");
    const browserCapture = edgeSource("capture-browser-error");
    expect(productionApp).toContain("reportBrowserServiceError(refreshError");
    expect(productionApp).toContain('stage: "realtime_refresh"');
    expect(productionApp).toContain('stage: "reschedule_approval"');
    expect(artifact).toContain('stage: "receipt_render"');
    expect(browserCapture).toContain("refs: { stage:");
  });
});
