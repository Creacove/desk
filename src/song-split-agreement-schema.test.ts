import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260909100000_song_split_agreements.sql",
);
const smokePath = join(
  process.cwd(),
  "supabase",
  "tests",
  "song_split_agreement_smoke.sql",
);

describe("song split agreement database contract", () => {
  it("defines the normalized agreement and evidence entities", () => {
    expect(existsSync(migrationPath)).toBe(true);
    const sql = readFileSync(migrationPath, "utf8");

    for (const table of [
      "split_agreements",
      "split_agreement_versions",
      "split_agreement_participants",
      "split_signature_requests",
      "split_signatures",
      "split_agreement_events",
      "split_agreement_artifacts",
    ]) {
      expect(sql).toMatch(new RegExp(`create table public\\.${table}\\b`, "i"));
    }

    for (const status of [
      "draft",
      "ready_for_signature",
      "locking",
      "ready_to_send",
      "sent_for_signature",
      "partially_signed",
      "correction_requested",
      "finalizing",
      "finalizing_failed",
      "executed",
      "voided",
      "superseded",
      "disputed",
      "expired",
    ]) expect(sql).toContain(`'${status}'`);

    for (const status of [
      "not_invited",
      "sent",
      "delivered",
      "opened",
      "verified",
      "signed",
      "failed",
      "expired",
      "revoked",
      "superseded",
    ]) expect(sql).toContain(`'${status}'`);

    for (const event of [
      "draft_changed",
      "version_locked",
      "signature_requests_sent",
      "delivery_failed",
      "request_opened",
      "otp_verified",
      "correction_requested",
      "signature_submitted",
      "reminder_sent",
      "agreement_voided",
      "finalization_started",
      "finalization_failed",
      "agreement_executed",
      "artifact_downloaded",
      "version_discarded",
      "dispute_opened",
    ]) expect(sql).toContain(`'${event}'`);
  });

  it("freezes canonical signing data and stores only hashed capabilities", () => {
    const sql = readFileSync(migrationPath, "utf8");

    for (const column of [
      "canonical_snapshot jsonb not null",
      "metadata jsonb not null",
      "terms_version text not null",
      "consent_version text not null",
      "document_id text not null",
      "pre_signature_pdf_asset_id uuid",
      "pre_signature_sha256 text",
      "final_pdf_asset_id uuid",
      "final_pdf_sha256 text",
      "execution_certificate_asset_id uuid",
      "evidence_manifest_asset_id uuid",
      "coordinator_participant_id uuid",
      "coordinator_signature_required boolean not null default true",
      "capability_token_hash text not null",
      "otp_hash text",
      "signature_vector_asset_id uuid",
      "rendered_signature_image_asset_id uuid",
      "pre_signature_document_hash text not null",
      "signature_asset_hash text not null",
      "accepted_consent_text text not null",
      "hashed_ip text not null",
      "hashed_user_agent text not null",
    ]) expect(sql).toContain(column);

    expect(sql).toMatch(/document_id text not null[\s\S]+OS-SA-\[0-9\]\{4\}-\[0-9\]\{6\}/i);
    expect(sql).toMatch(/unique[\s\S]+idempotency_key/i);
    expect(sql).toMatch(/unique[\s\S]+receipt_id/i);
    expect(sql).toMatch(/immutable|prevent.*(?:update|delete)/i);
    expect(sql).not.toMatch(/\b(?:capability_token|confirmation_token|otp|token)\s+text\s+not null\s+default/i);
    expect(sql).not.toMatch(/update\s+public\.music_splits\s+set/i);
    expect(sql).not.toMatch(/update\s+public\.music_split_contributors\s+set/i);
  });

  it("uses private storage, workspace-member reads, and service-only mutations", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toMatch(/insert into storage\.buckets[\s\S]+values\s*\(\s*'split-agreement-artifacts'\s*,\s*'split-agreement-artifacts'\s*,\s*false/i);
    expect(sql).toMatch(/alter table public\.(?:split_agreements|split_agreement_versions|split_signatures) enable row level security/i);
    expect(sql).toMatch(/public\.is_account_member\(account_id\)/i);
    expect(sql).toMatch(/revoke all[\s\S]+from public, anon, authenticated/i);
    expect(sql).toMatch(/grant all[\s\S]+to service_role/i);
    expect(sql).toMatch(/grant select[\s\S]+to authenticated/i);
    expect(sql).toMatch(/security definer[\s\S]+set search_path = public(?:, extensions)?/i);

    expect(sql).toMatch(/foreign key\s*\(id,\s*coordinator_participant_id\)[\s\S]+references\s+public\.split_agreement_participants\s*\(version_id,\s*id\)/i);
    expect(sql).toMatch(/split_agreement_versions_immutable_guard\s+before update or delete/i);
    expect(sql).toMatch(/split_agreement_participants_immutable_guard[\s\S]+before insert or update or delete/i);
    expect(sql).toMatch(/_split_agreement_participant_immutable_guard[\s\S]+if TG_OP\s*=\s*'DELETE' then[\s\S]+return old[\s\S]+return new/i);
    expect(sql).toMatch(/revoke all on table public\.split_agreements,[\s\S]+public\.split_signature_requests,[\s\S]+from public, anon, authenticated/i);
    expect(sql).toMatch(/grant select\s*\([^)]*version_id[^)]*\)[\s\S]+to authenticated/i);
    expect(sql).toMatch(/capability_token_hash[\s\S]+otp_hash[\s\S]+revoke select/i);
    expect(sql).toMatch(/unique\s*\(document_id\)/i);
    expect(sql).toMatch(/old\.locked_at is not null[\s\S]+new\.status\s*=\s*'draft'/i);
    expect(sql).toMatch(/new\.locked_at is distinct from old\.locked_at/i);
    const transitionGuard = sql.match(
      /create or replace function public\._split_agreement_version_transition_guard\(\)[\s\S]+?create or replace function public\._split_agreement_immutable_version_guard/i,
    )?.[0] ?? "";
    expect(transitionGuard).not.toContain("'expired'");
    expect(sql).toMatch(/if\s+new\.status\s*=\s*'executed'[\s\S]+final_pdf_asset_id[\s\S]+execution_certificate_asset_id[\s\S]+evidence_manifest_asset_id/i);
    expect(sql).toMatch(/final_pdf_sha256[\s\S]+execution_certificate_sha256[\s\S]+evidence_manifest_sha256/i);
    expect(sql).toMatch(/jsonb_array_length\(p_canonical_snapshot\s*->\s*'participants'\)\s*=\s*0/i);
    expect(sql).toMatch(/workTitle[\s\S]+recordingTitle[\s\S]+agreementDate[\s\S]+dateCreated[\s\S]+releaseScheduledOrReleased/i);
    for (const share of ["performing", "mechanical", "neighbouring"]) {
      expect(sql).toMatch(new RegExp(`v_${share}_total\\s*<>\\s*100`, "i"));
    }
    expect(sql).toMatch(/signatureRequired[\s\S]+positive participant share requires a signature/i);
    expect(sql).toMatch(/coordinatorParticipantId[\s\S]+externalCoordinatorName[\s\S]+externalCoordinatorEmail[\s\S]+externalCoordinatorAuthority/i);
    expect(sql).toMatch(/p_idempotency_key[\s\S]+lock idempotency key is required/i);
    expect(sql).toMatch(/p_idempotency_key[\s\S]+invalidation idempotency key is required/i);
    expect(sql).toMatch(/lock_idempotency_key[\s\S]+unique/i);
    expect(sql).toMatch(/unique\s*\(version_id,\s*idempotency_key\)/i);
    expect(sql).toMatch(/p_printed_signer_name[\s\S]+v_participant\.legal_name/i);
    expect(sql).toMatch(/p_signing_authority[\s\S]+v_participant\.signing_authority/i);
    expect(sql).toMatch(/external_coordinator_name[\s\S]+p_printed_signer_name/i);
    expect(sql).toMatch(/split_agreement_scope_guard/i);
    expect(sql).toMatch(/split_signatures_scope_guard/i);
    expect(sql).toMatch(/split_agreement_events_scope_guard/i);
    expect(sql).toMatch(/foreign key\s*\(version_id,\s*participant_id\)[\s\S]+references\s+public\.split_agreement_participants/i);
    expect(sql).toMatch(/create policy split_agreement_artifacts_storage_service/i);
    expect(sql).toMatch(/storage\.objects[\s\S]+split-agreement-artifacts[\s\S]+split_part\(name,\s*'\/',\s*1\)[\s\S]+36/i);

    for (const rpc of [
      "lock_split_agreement_version_v1",
      "invalidate_split_signature_requests_v1",
      "submit_split_signature_v1",
      "can_finalize_split_agreement_v1",
    ]) {
      expect(sql).toContain(`function public.${rpc}`);
      expect(sql).toMatch(new RegExp(`revoke all[\\s\\S]+function public\\.${rpc}`, "i"));
      expect(sql).toMatch(new RegExp(`grant execute on function public\\.${rpc}[\\s\\S]+to service_role`, "i"));
    }

    expect(sql).toMatch(/p_kind\s*=\s*'participant'[\s\S]+p_signature_request_id is null/i);
    expect(sql).toMatch(/kind\s*=\s*'participant'\s+or signature_request_id is null/i);
    expect(sql).toMatch(/v_version\.coordinator_participant_id is not null[\s\S]+p_participant_id is null/i);
    expect(sql).toMatch(/v_request\.status\s*<>\s*'verified'/i);
    expect(sql).toMatch(/v_version\.status\s+not in\s*\('ready_to_send',\s*'sent_for_signature',\s*'partially_signed'\)/i);
    expect(sql).toMatch(/p_idempotency_key[\s\S]+p_version_id[\s\S]+p_participant_id[\s\S]+p_signature_request_id/i);
    expect(sql).toMatch(/v_required_count\s*=\s*0[\s\S]+canFinalize/i);
    expect(sql).toMatch(/final_pdf_artifact[\s\S]+execution_certificate_artifact[\s\S]+evidence_manifest_artifact/i);
  });

  it("keeps the smoke fixture aligned with the submitted RPC signature and retries", () => {
    const smoke = readFileSync(smokePath, "utf8");

    expect(smoke).toContain(
      "public.submit_split_signature_v1(uuid,uuid,uuid,text,public.split_signature_kind,uuid,uuid,text,text,public.split_agreement_signing_authority,text,text,text,text,text,text,text,text,text,text,text)",
    );
    expect(smoke).not.toContain(
      "public.submit_split_signature_v1(uuid,uuid,uuid,text,public.split_signature_kind,uuid,uuid,uuid,",
    );
    expect(smoke).toMatch(/lock_split_agreement_version_v1\([\s\S]+,\s*'smoke-lock'/i);
    expect(smoke).toMatch(/invalidate_split_signature_requests_v1\([\s\S]+,\s*'smoke-invalidate'/i);
    expect(smoke).toMatch(/lock_split_agreement_version_v1\([\s\S]+repeat\('a',\s*64\)/i);
    expect(smoke).toMatch(/submit_split_signature_v1\([\s\S]+repeat\('[0-9a-f]',\s*64\)/i);
    expect(smoke).toMatch(/same key|original receipt|more than one evidence row/i);
  });
});
