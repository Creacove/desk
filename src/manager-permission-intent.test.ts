import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

const managerConversation = read("supabase/functions/_shared/openaiManagerConversation.ts");
const explicitIntentMigration = read("supabase/migrations/20260829081000_manager_explicit_split_action_intent.sql");

describe("Manager external-action intent boundary", () => {
  it("frontloads the exact split-confirmation preparation command before generation", () => {
    expect(managerConversation).toContain("Manager executable-action intent protocol");
    expect(managerConversation).toContain("prepare_split_confirmations_for_approval");
    expect(managerConversation).toContain("targetType focused_music_item");
    expect(managerConversation).toContain("approvalRequired false");
    expect(managerConversation).toContain("NEVER sends email");
    expect(managerConversation).toContain("The server derives all executable targets from canonical workspace state");
    expect(managerConversation).toContain("execution receipt records a real provider outcome");
  });

  it("uses persisted typed intent, never split readiness, as the producer boundary", () => {
    expect(explicitIntentMigration).toContain("drop trigger if exists produce_split_permission_from_split");
    expect(explicitIntentMigration).toContain("drop trigger if exists produce_split_permission_from_contributor");
    expect(explicitIntentMigration).toContain("drop trigger if exists produce_split_permission_from_task");
    expect(explicitIntentMigration).toContain("drop trigger if exists produce_split_permission_from_mission");
    expect(explicitIntentMigration).toContain("drop function if exists public.maybe_prepare_split_confirmation_permission_v1(uuid)");
    expect(explicitIntentMigration).toContain("new.action_type = 'prepare_split_confirmations_for_approval'");
    expect(explicitIntentMigration).toContain("run_row.context_payload #>> '{scope,musicSubject,id}'");
    expect(explicitIntentMigration).toContain("pg_advisory_xact_lock");
    expect(explicitIntentMigration).toContain("exact_effect_already_has_permission");
  });

  it("keeps preparation failure isolated from the Manager turn", () => {
    expect(explicitIntentMigration).toContain("exception when others");
    expect(explicitIntentMigration).toContain("A Manager automation failure must never");
    expect(explicitIntentMigration).toContain("set status = 'failed'");
  });
});
