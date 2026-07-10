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

  it("loads submitted task documents before asking the Manager to review completion", () => {
    expect(functionSource).toContain("documentIds?: string[]");
    expect(functionSource).toContain('"documents"');
    expect(functionSource).toContain('"document_versions"');
    expect(functionSource).toContain('"artifact_links"');
    expect(functionSource).toContain("submittedDocuments");
    expect(functionSource).toContain("missingRequiredDeliverable");
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
