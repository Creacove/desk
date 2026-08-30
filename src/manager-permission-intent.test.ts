import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

const managerConversation = read("supabase/functions/_shared/openaiManagerConversation.ts");
const explicitIntentMigration = read("supabase/migrations/20260829081000_manager_explicit_split_action_intent.sql");
const candidateMigration = read("supabase/migrations/20260829081100_manager_external_action_candidates.sql");
const actionRunner = read("supabase/functions/manager-action-intent-runner/index.ts");
const workflowRecovery = read("supabase/functions/workflow-recovery/index.ts");
const permissionAction = read("supabase/functions/manager-permission-action/index.ts");
const actionReliability = read("supabase/migrations/20260829200600_manager_action_reliability.sql");

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

  it("uses persisted typed intent, never split readiness, as the permission producer boundary", () => {
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

  it("separates canonical readiness wake-up from AI Manager authorization", () => {
    expect(candidateMigration).toContain("create table if not exists public.manager_action_candidates");
    expect(candidateMigration).toContain("queue_split_confirmation_manager_candidate_v1");
    expect(candidateMigration).toContain("canonicalReady");
    expect(candidateMigration).toContain("This candidate does not authorize sending email");
    expect(candidateMigration).toContain("manager-action-candidate-recovery");
    expect(candidateMigration).not.toContain("perform public.prepare_split_confirmation_manager_permission_v1");
  });

  it("uses one bounded AI decision over server-built candidates", () => {
    expect(actionRunner).toContain('decision: "prepare" | "hold"');
    expect(actionRunner).toContain("candidateWasConstructedAndValidatedByServer");
    expect(actionRunner).toContain("canonicalReadinessIsNotAuthorization");
    expect(actionRunner).toContain("modelMustNotSupplyExecutableTargetIds");
    expect(actionRunner).toContain('db.rpc("persist_manager_action_candidate_intent_v1"');
    expect(actionReliability).toContain("'prepare_split_confirmations_for_approval','focused_music_item','pending',false");
    expect(actionRunner).toContain("claimRuntimeAdmission");
    expect(actionRunner).toContain('operationKey: "external_action_decision"');
    expect(actionRunner).toContain("fetchProviderWithTimeout");
  });

  it("makes candidate completion lease-owned so stale workers cannot win", () => {
    expect(actionReliability).toContain("lease_token uuid");
    expect(actionReliability).toContain("complete_manager_action_candidate_v2");
    expect(actionReliability).toContain("candidate.lease_token=p_lease_token");
    expect(actionReliability).toContain("persist_manager_action_candidate_intent_v1");
    expect(actionRunner).toContain("candidate.lease_token");
    expect(actionRunner).toContain("p_lease_token: candidate.lease_token");
    expect(actionRunner).toContain('db.rpc("persist_manager_action_candidate_intent_v1"');
  });

  it("terminalizes abandoned provider outcomes as indeterminate without retrying", () => {
    expect(actionReliability).toContain("recover_stale_manager_action_executions_v1");
    expect(actionReliability).toContain("status='claimed'");
    expect(actionReliability).toContain("fail_manager_action_execution_v1");
    expect(actionReliability).toContain("true");
    expect(actionReliability).toContain("manager-external-action-recovery");
    expect(permissionAction).toContain("fetchProviderWithTimeout");
  });

  it("re-reads durable action state after the AFTER trigger settles", () => {
    expect(actionRunner).toContain("RETURNING does not promise visibility");
    expect(actionRunner).toContain('.select("id").single()');
    expect(actionRunner).toContain('.select("id,status,target_type,target_id,result_payload,error")');
    expect(actionRunner).toContain('["prepared", "replayed"]');
  });

  it("routes DB wake-ups through the hardened recovery gateway", () => {
    expect(workflowRecovery).toContain('"external_action_decision"');
    expect(workflowRecovery).toContain('"manager-action-intent-runner"');
    expect(workflowRecovery).toContain("candidateId");
    expect(workflowRecovery).toContain("Authorization: `Bearer ${serviceRoleKey}`");
  });
});
