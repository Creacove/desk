import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  "supabase/migrations/20260812000100_release_success_foundation.sql",
  "utf8",
);

describe("release success foundation schema", () => {
  it("adds one operational release plan per song without changing provider dates", () => {
    expect(sql).toMatch(/create table public\.music_release_plans/i);
    expect(sql).toMatch(/music_item_id uuid not null unique/i);
    expect(sql).toMatch(/approved_release_date date/i);
    expect(sql).toMatch(/revision bigint not null default 0/i);
    expect(sql).not.toMatch(/update public\.music_items set planned_release_date/i);
  });

  it("models approval and explicit schedule bindings", () => {
    expect(sql).toMatch(/create table public\.release_date_change_requests/i);
    expect(sql).toMatch(/expected_plan_revision bigint not null/i);
    expect(sql).toMatch(/preview_hash text not null/i);
    expect(sql).toMatch(/idempotency_key text not null/i);
    expect(sql).toMatch(/create table public\.release_task_schedule_bindings/i);
    expect(sql).toMatch(/offset_days integer not null/i);
    expect(sql).toMatch(/active boolean not null default true/i);
  });

  it("provides scoped proposal and atomic approval RPCs", () => {
    expect(sql).toMatch(/create or replace function public\.propose_release_date_change/i);
    expect(sql).toMatch(/create or replace function public\.approve_release_date_change/i);
    expect(sql).toMatch(/for update/i);
    expect(sql).toMatch(/expected_plan_revision/i);
    expect(sql).toMatch(/release_plan_changed/i);
    expect(sql).toMatch(/release_plan_stale/i);
    expect(sql).toMatch(/release_request_expired/i);
    expect(sql).toMatch(/release_request_not_pending/i);
    expect(sql).toMatch(/release_already_live/i);
    expect(sql).toMatch(/requestId/);
    expect(sql).toMatch(/previousRevision/);
    expect(sql).toMatch(/nextDeadline/);
  });

  it("keeps tables account-scoped and protected", () => {
    expect(sql).toMatch(/enable row level security/gi);
    expect(sql).toMatch(/artist_workspace_id uuid not null/gi);
    expect(sql).toMatch(/grant execute on function public\.approve_release_date_change/gi);
  });
});
