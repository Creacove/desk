import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = join(process.cwd(), "supabase", "migrations");
const migrationName = readdirSync(migrationsDir).find((name) => name.endsWith("_ordersounds_ops_control_plane.sql"));
const migrationPath = migrationName ? join(migrationsDir, migrationName) : "";

describe("OrderSounds Ops control-plane database contract", () => {
  it("defines the shared operator allow-list and operational tables", () => {
    expect(migrationName).toBeTruthy();
    expect(existsSync(migrationPath)).toBe(true);
    const sql = readFileSync(migrationPath, "utf8");

    for (const table of ["ordersounds_operators", "ops_cases", "ops_meetings", "ops_followups", "ops_activity"]) {
      expect(sql).toMatch(new RegExp(`create table public\\.${table}\\b`, "i"));
      expect(sql).toMatch(new RegExp(`alter table public\\.${table} enable row level security`, "i"));
    }

    for (const status of ["unprocessed", "processing", "processed", "failed"]) {
      expect(sql).toContain(`'${status}'`);
    }
    for (const stage of ["new", "qualifying", "meeting", "activation", "active", "closed"]) {
      expect(sql).toContain(`'${stage}'`);
    }
    for (const fn of ["list_ops_today_v1", "list_ops_linkable_workspaces_v1", "link_ops_case_workspace_v1"]) {
      expect(sql).toMatch(new RegExp(`function public\\.${fn}\\b`, "i"));
    }
  });

  it("keeps Ops isolated from customer authorization and secrets", () => {
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toMatch(/revoke all on table[\s\S]+from anon/i);
    expect(sql).toMatch(/insert into storage\.buckets[\s\S]+ops-music[\s\S]+false/i);
    expect(sql).toMatch(/before update or delete[\s\S]+raise exception/i);
    expect(sql).not.toMatch(/alter table public\.account_memberships/i);
    expect(sql).not.toMatch(/has_active_workspace_entitlement/i);
    expect(sql).not.toMatch(/create table public\.today_tasks/i);
  });

  it("qualifies the Ops Today item key inside its RETURN QUERY", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toMatch(/select\s+items\.item_key[\s\S]+from\s+items/i);
    expect(sql).toMatch(/order by\s+items\.priority,\s+items\.due_at\s+nulls last,\s+lower\(items\.display_name\),\s+items\.item_key/i);
  });
});
