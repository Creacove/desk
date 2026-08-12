import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  "supabase/migrations/20260812000100_release_success_foundation.sql",
  "utf8",
);

describe("release success RPC transaction contract", () => {
  it("locks every mutable row and verifies the scoped authenticated owner", () => {
    expect(sql).toMatch(/release_date_change_requests[\s\S]*for update/i);
    expect(sql).toMatch(/music_release_plans[\s\S]*for update/i);
    expect(sql).toMatch(/music_items[\s\S]*for update/i);
    expect(sql).toMatch(/tasks[\s\S]*for update of task/i);
    expect(sql).toMatch(/account_memberships/);
    expect(sql).toMatch(/p_requested_by|p_approved_by/);
  });

  it("rejects stale, expired, non-pending, live, and preview-mismatched requests with stable codes", () => {
    for (const code of [
      "release_plan_stale",
      "release_request_expired",
      "release_request_not_pending",
      "release_already_live",
      "release_preview_mismatch",
      "release_schedule_stale",
    ]) {
      expect(sql).toContain(code);
    }
    expect(sql).toMatch(/preview_json\s*->>\s*'fromDate'/i);
    expect(sql).toMatch(/preview_json\s*->>\s*'proposedDate'/i);
    expect(sql).toMatch(/preview_json\s*->>\s*'previewHash'/i);
    expect(sql).toMatch(/expected_plan_revision/);
  });

  it("moves only active release-bound open work and preserves completed or archived work", () => {
    expect(sql).toMatch(/binding\.active/i);
    expect(sql).toMatch(/task\.status::text\s+in\s*\(['"]open['"]/i);
    expect(sql).toMatch(/task_status\s+in\s*\(['"]completed['"].*['"]archived['"]/is);
    expect(sql).toMatch(/release_task_schedule_bindings/);
    expect(sql).toMatch(/offset_days/);
  });

  it("commits one receipt, one permission transition, and one operating event with retry identity", () => {
    expect(sql).toMatch(/insert into public\.operating_events[\s\S]*release_plan_changed/i);
    expect(sql).toMatch(/update public\.permission_requests[\s\S]*status = 'approved'/i);
    expect(sql).toMatch(/result_json\s*=\s*jsonb_build_object/i);
    expect(sql).toMatch(/on conflict\s*\(account_id, idempotency_key\)\s*do nothing/i);
    expect(sql).toMatch(/return v_request\.result_json|return \(select result_json/i);
    expect(sql).toMatch(/release_idempotency_conflict/);
  });

  it("does not swallow exceptions, so transaction failures roll back partial state", () => {
    expect(sql).toMatch(/raise exception 'release_/i);
    expect(sql).not.toMatch(/exception\s+when\s+others[\s\S]*return/i);
  });
});
