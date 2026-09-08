import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf8");
const manager = read("supabase", "functions", "manager-conversation", "index.ts");
const stream = read("supabase", "functions", "manager-conversation-stream", "index.ts");
const shared = read("supabase", "functions", "_shared", "managerConversationReliability.ts");
const migration = read("supabase", "migrations", "20260908140000_manager_conversation_turn_reliability.sql");
const client = read("src", "services", "productionSupabase.ts");
const app = read("src", "app", "ProductionApp.tsx");
const graph = read("supabase", "functions", "_shared", "missionGraphPersistence.ts");

describe("Manager conversation turn reliability", () => {
  it("carries one request identity through both clients and both edge endpoints", () => {
    expect(client).toContain('"x-request-id": input.requestId');
    expect(client).toContain("requestId: input.requestId");
    expect(app).toContain("createClientRequestId()");
    expect(app).toContain("lastArtistMessage.requestId");
    for (const source of [manager, stream]) {
      expect(source).toContain("requestId?: string");
      expect(source).toContain("normalizeManagerConversationRequestId");
      expect(source).toContain("input.requestId");
      expect(source).toContain('"x-request-id"');
    }
  });

  it("stores the complete retry envelope and makes the run replay-safe", () => {
    for (const column of ["request_id uuid", "request_payload jsonb", "result_payload jsonb"]) {
      expect(migration).toContain(`add column if not exists ${column}`);
    }
    expect(migration).toContain("manager_conversation_request_unique_idx");
    expect(migration).toContain("conversation_messages_request_unique_idx");
    expect(shared).toContain("managerConversationRequestPayload");
    expect(shared).toContain("idempotency_key");
    for (const source of [manager, stream]) {
      expect(source).toContain("managerConversationRequestPayload(input)");
      expect(source).toContain("findManagerConversationRun");
      expect(source).toContain("status === \"completed\"");
      expect(source).toContain("managerConversationRunIsActive");
      expect(source).not.toContain('.from("manager_run_actions").upsert');
      expect(source).toContain("const actionKey =");
      expect(source).toContain('.eq("action_key", actionKey)');
      expect(source).toContain("if (error && !isUniqueViolation(error)) throw error;");
      expect(source).toContain("function isUniqueViolation");
    }
    expect(shared).toContain("resumeManagerConversationRun");
    expect(shared).toContain("attempt_count: Number(run.attempt_count ?? 0) + 1");
    expect(shared).toContain('status: "running"');
  });

  it("returns diagnostic identity with a failed Manager request", () => {
    expect(manager).toContain("requestId: input?.requestId");
    expect(manager).toContain("runId");
    expect(stream).toContain("requestId: input?.requestId");
    expect(stream).toContain("runId");
  });

  it("makes mission graph writes safe to resume after a partial failure", () => {
    expect(graph).toContain("created_from_run_id");
    expect(graph).toContain("generated_from_run_id");
    expect(graph).toContain("findExistingMission");
    expect(graph).toContain("findExistingPlan");
    expect(graph).toContain("if (error && !isUniqueViolation(error)) throw error;");
    expect(graph).toContain("dedupe_key");
  });
});
