import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseOperatorWorkspaceRoute } from "./app/OperatorWorkspaceRoute";

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf8");

describe("operator workspace routing", () => {
  it("keeps customer root routing separate from the explicit operator path", () => {
    expect(parseOperatorWorkspaceRoute("/")).toEqual(null);
    expect(parseOperatorWorkspaceRoute("/admin/workspaces")).toEqual({ kind: "list" });
    expect(parseOperatorWorkspaceRoute("/admin/workspaces/71000000-0000-0000-0000-000000000031")).toEqual({
      kind: "workspace",
      artistWorkspaceId: "71000000-0000-0000-0000-000000000031",
    });
  });

  it("uses the operator loader only for an explicit target and does not touch the customer preference", () => {
    const app = read("src", "app", "ProductionApp.tsx");
    const loader = read("src", "services", "productionSupabase.ts");
    expect(app).toContain("loadWorkspaceById");
    expect(app).toContain("accessContext?.mode === \"operator\"");
    const operatorLoader = loader.slice(loader.indexOf("export function createOperatorWorkspaceLoader"));
    expect(operatorLoader).toContain('client.functions.invoke("operator-workspaces"');
    expect(operatorLoader).not.toContain("ordersounds.workspace.active");
  });

  it("keeps route navigation outside the auth session and rejects missing or tampered targets", () => {
    const route = read("src", "app", "OperatorWorkspaceRoute.tsx");
    const auth = read("supabase", "functions", "_shared", "operatorAuthorization.ts");
    expect(route).toContain("history.pushState");
    expect(route).toContain("signOut");
    expect(auth).toContain("targetWorkspaceId");
    expect(auth).toContain("isUuid(targetWorkspaceId)");
    expect(auth).toContain("Operator workspace access is not available.");
  });

  it("offers the same workspace search from the normal Desk entry only after the operator gateway succeeds", () => {
    const app = read("src", "app", "ProductionApp.tsx");
    const main = read("src", "main.tsx");
    expect(app).toContain("listOperatorWorkspaces");
    expect(app).toContain('status === "operator-list"');
    expect(app).toContain("OperatorWorkspacePicker");
    expect(app).toContain("window.location.assign");
    expect(main).toContain("operatorWorkspaceRoute");
    expect(app).toContain("loadActiveWorkspace");
    expect(app.indexOf("listOperatorWorkspaces")).toBeLessThan(app.lastIndexOf("if (paymentReturnReference)"));
  });
});
