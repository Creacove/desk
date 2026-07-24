import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf8");

describe("Manager intelligence V1 architecture", () => {
  it("adds explicit, backward-compatible task completion contracts", () => {
    const migrationPath = join(
      process.cwd(),
      "supabase",
      "migrations",
      "20260723000100_manager_intelligence_v1.sql",
    );
    expect(existsSync(migrationPath)).toBe(true);
    const migration = readFileSync(migrationPath, "utf8");

    for (const column of [
      "completion_mode",
      "deliverable_title",
      "deliverable_requirements",
      "manager_responsibility",
      "user_responsibility",
      "submitted_manager_output_id",
      "submitted_by_user_id",
    ]) {
      expect(migration).toContain(column);
    }
    expect(migration).toContain("'task_draft'");
    expect(migration).toContain("finalize_task_document_upload");
  });

  it("moves task document upload into a signed prepare/finalize edge workflow", () => {
    const uploadFunctionPath = join(process.cwd(), "supabase", "functions", "task-document-upload", "index.ts");
    expect(existsSync(uploadFunctionPath)).toBe(true);
    const uploadFunction = readFileSync(uploadFunctionPath, "utf8");
    const repository = read("src", "services", "productionSupabase.ts");

    expect(uploadFunction).toContain('action === "prepare"');
    expect(uploadFunction).toContain('action === "finalize"');
    expect(uploadFunction).toContain("createSignedUploadUrl");
    expect(uploadFunction).toContain("finalize_task_document_upload");
    expect(uploadFunction).toContain("UNSUPPORTED_FILE_TYPE");
    expect(repository).toContain('functions.invoke("task-document-upload"');
    expect(repository).toContain("uploadToSignedUrl");
  });

  it("keeps task work inside Manager chat and persists versioned task drafts", () => {
    for (const functionName of ["manager-conversation", "manager-conversation-stream"]) {
      const source = read("supabase", "functions", functionName, "index.ts");
      expect(source).toContain("taskId?: string");
      expect(source).toContain("ensureTaskConversation");
      expect(source).toContain("persistTaskDraftOutput");
      expect(source).toContain('output_type: "task_draft"');
      expect(source).toContain('reasoningEffort: "high"');
      expect(source).toContain("selectConversationHistory");
    }
  });

  it("qualifies and deduplicates durable memory instead of saving free-form strings blindly", () => {
    const memory = read("supabase", "functions", "_shared", "manager-conversation", "memory.ts");
    expect(memory).toContain("qualifyManagerMemoryCandidates");
    expect(memory).toContain("supersedes_memory_entry_id");
    expect(memory).toContain("durable_preference");
    expect(memory).toContain("durable_constraint");
  });

  it("reviews exact manager draft versions and can return a revision without completing the task", () => {
    const review = read("supabase", "functions", "manager-review-task-result", "index.ts");
    expect(review).toContain("managerOutputId");
    expect(review).toContain("submitted_manager_output_id");
    expect(review).toContain('"needs_revision"');
    expect(review).toContain('status: "in_progress"');
    expect(review).toContain('reasoning: { effort: "high" }');
  });
});
