import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf8");

describe("operator workspace gateway", () => {
  it("re-authenticates every request and keeps the authorization boundary exact", () => {
    const authorization = read("supabase", "functions", "_shared", "operatorAuthorization.ts");
    expect(authorization).toContain("auth.getUser()");
    expect(authorization).toContain("ordersounds_operators");
    expect(authorization).toContain("operator_access_enabled_v1");
    expect(authorization).toContain("artist_workspaces");
    expect(authorization).toContain("targetWorkspaceId");
    expect(authorization).toContain("401");
    expect(authorization).toContain("403");
    expect(authorization).not.toContain("account_memberships");
    expect(authorization).not.toContain("billing_");
  });

  it("supports only bounded list/load actions and never returns customer permissions", () => {
    const functionSource = read("supabase", "functions", "operator-workspaces", "index.ts");
    expect(functionSource).toContain('action: "list"');
    expect(functionSource).toContain('action: "load"');
    expect(functionSource).toContain("MAX_OPERATOR_WORKSPACES = 25");
    expect(functionSource).toContain("slice(0, MAX_OPERATOR_WORKSPACES)");
    expect(functionSource).toContain("account_memberships");
    expect(functionSource).toContain("memberEmails");
    expect(functionSource).toContain("accessMode: \"operator\"");
    expect(functionSource).toContain("workspace_opened");
    expect(functionSource).not.toContain("has_active_workspace_entitlement");
    expect(functionSource).not.toContain("return { billing_subscriptions");
  });
});
