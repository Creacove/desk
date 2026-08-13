import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = join(process.cwd(), "supabase", "migrations", "20260812000200_release_opportunities.sql");

describe("release opportunity records", () => {
  it("defines one scoped table for playlist and press candidates", () => {
    expect(existsSync(migrationPath)).toBe(true);
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toMatch(/create table public\.release_opportunities/i);
    expect(sql).toMatch(/account_id uuid not null/i);
    expect(sql).toMatch(/artist_workspace_id uuid not null/i);
    expect(sql).toMatch(/artist_id uuid not null/i);
    expect(sql).toMatch(/music_item_id uuid not null/i);
    expect(sql).toMatch(/mission_id uuid/i);
    expect(sql).toMatch(/opportunity_type text not null/i);
    expect(sql).toMatch(/target_name text not null/i);
    expect(sql).toMatch(/platform text/i);
    expect(sql).toMatch(/source_url text not null/i);
    expect(sql).toMatch(/contact_kind text/i);
    expect(sql).toMatch(/public_contact_value text/i);
    expect(sql).toMatch(/public_contact_source_url text/i);
    expect(sql).toMatch(/contact_verified_at timestamptz/i);
    expect(sql).toMatch(/fit_json jsonb not null/i);
    expect(sql).toMatch(/evidence_json jsonb not null/i);
    expect(sql).toMatch(/confidence text not null/i);
    expect(sql).toMatch(/limitations_json jsonb not null/i);
    expect(sql).toMatch(/safety_state text not null/i);
    expect(sql).toMatch(/requirements_json jsonb not null/i);
    expect(sql).toMatch(/package_json jsonb not null/i);
    expect(sql).toMatch(/pitch_document_id uuid/i);
    expect(sql).toMatch(/manager_output_id uuid/i);
    expect(sql).toMatch(/dedupe_key text not null/i);
    expect(sql).toMatch(/status text not null/i);
    expect(sql).toMatch(/manual_outcome text/i);
    expect(sql).toMatch(/created_at timestamptz not null/i);
    expect(sql).toMatch(/updated_at timestamptz not null/i);
  });

  it("constrains workflow states, dedupes per song, and uses scoped RLS", () => {
    expect(existsSync(migrationPath)).toBe(true);
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toMatch(/opportunity_type in \('playlist',\s*'press'\)/i);
    expect(sql).toMatch(/contact_kind is null or contact_kind in \('email',\s*'submission_form',\s*'contact_page'\)/i);
    expect(sql).toMatch(/status in \('watch',\s*'shortlisted',\s*'approved',\s*'submitted_manually',\s*'replied',\s*'accepted',\s*'declined',\s*'skipped'\)/i);
    expect(sql).toMatch(/safety_state in \('clear',\s*'caution',\s*'excluded'\)/i);
    expect(sql).toMatch(/unique \(music_item_id, opportunity_type, dedupe_key\)/i);
    expect(sql).toMatch(/alter table public\.release_opportunities enable row level security/i);
    expect(sql).toMatch(/is_account_member\(account_id\)/i);
    expect(sql).toMatch(/grant select.*release_opportunities.*authenticated/i);
    expect(sql).toMatch(/grant .*release_opportunities.*service_role/i);
  });

  it("does not create a private contacts table or an email/send outbox", () => {
    expect(existsSync(migrationPath)).toBe(true);
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).not.toMatch(/create table[^;]*(contacts|contact_outbox|send_outbox|email_outbox)/i);
    expect(sql).not.toMatch(/create table[^;]*(email_sends|submissions)/i);
    expect(sql).not.toMatch(/send_email|send_submission|outbox/i);
  });
});
