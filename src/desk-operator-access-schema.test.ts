import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = join(process.cwd(), "supabase", "migrations");
const migrationNames = readdirSync(migrationsDir).filter((name) =>
  /_(desk_operator_access|ops_meeting_handoff)\.sql$/i.test(name),
);
const migrationSql = migrationNames.map((name) => readFileSync(join(migrationsDir, name), "utf8")).join("\n");
const identifierMigration = readFileSync(join(migrationsDir, "20260921023800_operator_workspace_identifiers.sql"), "utf8");

describe("Desk operator access schema contract", () => {
  it("creates the kill switch, workspace guard, audit trail, and meeting workflow boundary", () => {
    expect(migrationNames).toHaveLength(2);
    for (const name of migrationNames) expect(existsSync(join(migrationsDir, name))).toBe(true);

    for (const required of [
      "operator_workspace_events",
      "private.operator_access_config",
      "private.can_operator_access_workspace",
      "ops_meeting_ingestion_v1",
      "claim_ops_meeting_processing_v1",
      "finalize_ops_meeting_processing_v1",
      "ops_meeting_processing_is_service_role_only",
    ]) {
      expect(migrationSql).toContain(required);
    }
  });

  it("keeps operator access separate from customer membership and entitlement truth", () => {
    for (const forbidden of [
      /insert into public\.account_memberships/i,
      /update public\.account_memberships/i,
      /isoperator.*has_active_workspace_entitlement/i,
      /email.*(?:like|similar to).*ordersounds/i,
      /alter policy[\s\S]+is_account_member/i,
    ]) {
      expect(migrationSql).not.toMatch(forbidden);
    }
  });

  it("keeps workspace search identifiable by member and case contact email", () => {
    expect(identifierMigration).toContain("account_member_emails");
    expect(identifierMigration).toContain("contact_emails");
    expect(identifierMigration).toContain("person.email ilike");
    expect(identifierMigration).toContain("case_row.primary_contact_email ilike");
  });
});
