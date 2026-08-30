import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const functionPath = join(process.cwd(), "supabase", "functions", "manager-review-task-result", "index.ts");
const functionSource = existsSync(functionPath) ? readFileSync(functionPath, "utf8") : "";
const serviceRoleGrantMigrationPath = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260628000100_manager_review_task_result_service_role_grants.sql",
);
const workspaceDocumentsMigrationPath = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260710000100_workspace_documents.sql",
);

describe("Manager task-result review function", () => {
  it("defines an authenticated Edge Function that reviews task results through Manager synthesis", () => {
    expect(existsSync(functionPath)).toBe(true);
    expect(functionSource).toContain("Deno.serve");
    expect(functionSource).toContain("auth.getUser()");
    expect(functionSource).toContain("is_account_member");
    expect(functionSource).toContain("/v1/responses");
    expect(functionSource).toContain("task_results");
    expect(functionSource).toContain("task_state_events");
    expect(functionSource).toContain("checkpoints");
    expect(functionSource).toContain("memory_entries");
    expect(functionSource).toContain("operating_events");
    expect(functionSource).toContain("manager_outputs");
    expect(functionSource).toContain('output_type: "review_read"');
  });

  it("uses submitted task documents as optional review context without gating completion", () => {
    expect(functionSource).toContain("documentIds?: string[]");
    expect(functionSource).toContain('"documents"');
    expect(functionSource).toContain('"document_versions"');
    expect(functionSource).toContain('"artifact_links"');
    expect(functionSource).toContain("submittedDocuments");
    expect(functionSource).toContain("Optional documents can raise confidence");
    expect(functionSource).toContain("submittedDocumentsAreOptionalContext: true");
    expect(functionSource).not.toContain("This task requires a submitted document");
    expect(functionSource).not.toContain("requiredTaskDeliverablesMustBeSubmittedBeforeCompletion: true");
  });

  it("publishes a task review as live mission activity and preserves the Manager's valid checkpoint decision", () => {
    expect(functionSource).toContain('display_mode: "activity"');
    expect(functionSource).toContain('refresh_scope: ["missions", "activity"]');
    expect(functionSource).toContain("resolveCheckpointStatus");
    expect(functionSource).toContain("isBlockingMissionTask");
    expect(functionSource).toContain("isBlockingMissionTask(task)");
    expect(functionSource).toContain("work_mode");
    expect(functionSource).toContain("allCheckpointTasksCompleted");
    expect(functionSource).toContain('if (modelStatus === "met" && !allCheckpointTasksCompleted) return "ready_for_manager_check";');
    expect(functionSource).toContain("return modelStatus;");
  });

  it("stores a complete checkpoint evaluation so the artist can see the decision, impact, next action, and real blocking reason", () => {
    expect(functionSource).toContain("status: checkpointStatus,");
    expect(functionSource).toContain("recommendation: review.checkpointRecommendation,");
    expect(functionSource).toContain("dependency_impact: review.checkpointEffect,");
    expect(functionSource).toContain("next_action: review.recommendedFollowUp,");
    expect(functionSource).toContain('blocked_reason: checkpointStatus === "needs_revision" || checkpointStatus === "blocked"');
    expect(functionSource).toContain("? review.checkpointEffect : null,");
    expect(functionSource).toContain("updated_at: now,");
  });

  it("directs the Manager to make a final checkpoint decision after all required task work is complete", () => {
    expect(functionSource).toContain("After the final required task, choose met, needs_revision, or watching_signal and explain the decision through checkpointRecommendation.");
  });

  it("requires every generated human follow-up to carry the full execution contract before persistence", () => {
    for (const field of [
      "workMode",
      "completionExpectation",
      "completionMode",
      "managerResponsibility",
      "userResponsibility",
      "riskIfLate",
      "estimatedMinutes",
    ]) {
      expect(functionSource).toContain(`\"${field}\"`);
    }
    expect(functionSource).toContain('steps: { type: "array", minItems: 2');
    expect(functionSource).toContain("Desk must complete the Manager responsibility itself");
    expect(functionSource).toContain("preflightReviewContinuation");
    expect(functionSource).toContain('rpc("assert_generated_human_task_execution_contract_v1"');
    expect(functionSource).toContain('failureStage = "validate_review_continuation"');
  });

  it("reviews the canonical Song Room package instead of requiring the upload to be reattached to the task", () => {
    expect(functionSource).toContain("loadTaskMusicPackage");
    expect(functionSource).toContain('from("music_assets")');
    expect(functionSource).toContain('from("uploaded_files")');
    expect(functionSource).toContain("canonicalMusicPackage");
    expect(functionSource).toContain("An uploaded or processed canonical Song Room asset is valid evidence");
    expect(functionSource).toContain("Do not require the artist to reattach");
  });

  it("rejects terminal plan tasks before spending a Manager review run", () => {
    expect(functionSource).toContain("assertTaskCanBeReviewed(task)");
    expect(functionSource).toContain('task.status === "superseded"');
    expect(functionSource).toContain("This task belongs to an earlier mission plan");
  });

  it("captures the original review failure with task and run correlation", () => {
    expect(functionSource).toContain('import { captureAppError } from "../_shared/appError.ts"');
    expect(functionSource).toContain("markErrorCaptured");
    expect(functionSource).toContain('operation: "review_task_result"');
    expect(functionSource).toContain("manager_run_id: runId");
    expect(functionSource).toContain("usage_event_id: usageId");
    expect(functionSource).toContain("task_id: input?.taskId");
    expect(functionSource).toContain("errorEventId");
  });

  it("has service-role access to the mission graph and review write tables", () => {
    expect(existsSync(serviceRoleGrantMigrationPath)).toBe(true);
    expect(existsSync(workspaceDocumentsMigrationPath)).toBe(true);
    const migration = [
      readFileSync(serviceRoleGrantMigrationPath, "utf8"),
      readFileSync(workspaceDocumentsMigrationPath, "utf8"),
    ].join("\n");

    for (const table of [
      "artist_workspaces",
      "artist_profiles",
      "manager_intelligence_packets",
      "missions",
      "checkpoints",
      "tasks",
      "task_steps",
      "task_results",
      "memory_entries",
      "operating_events",
    ]) {
      expect(migration).toMatch(new RegExp(`grant select on public\\.${table} to service_role`, "i"));
    }

    for (const table of ["documents", "document_versions", "document_validation_results", "artifact_links"]) {
      expect(migration).toMatch(new RegExp(`grant select(?:, insert, update, delete)? on public\\.${table} to (?:authenticated, )?service_role`, "i"));
    }

    for (const table of [
      "manager_synthesis_runs",
      "manager_outputs",
      "task_state_events",
      "task_results",
      "memory_entries",
      "operating_events",
      "ai_run_usage_events",
    ]) {
      expect(migration).toMatch(new RegExp(`grant select, insert, update on public\\.${table} to service_role`, "i"));
    }
  });
});
