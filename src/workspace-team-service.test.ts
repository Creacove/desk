import { describe, expect, it, vi } from "vitest";
import { createWorkspaceTeamService } from "./services/workspaceTeamService";

describe("workspace team service", () => {
  it("uses scoped read RPCs and the single mutation endpoint", async () => {
    const client = {
      rpc: vi.fn(async (name: string) => ({ data: name.includes("roster") ? { scope: {}, members: [], loadedAt: new Date().toISOString() } : { enabled: true }, error: null })),
      functions: { invoke: vi.fn(async () => ({ data: { ok: true }, error: null })) },
    };
    const service = createWorkspaceTeamService(client);
    await service.loadRoster("22222222-2222-4222-8222-222222222222");
    await service.loadCapability("22222222-2222-4222-8222-222222222222");
    await service.removeMember("22222222-2222-4222-8222-222222222222", "33333333-3333-4333-8333-333333333333");
    expect(client.rpc).toHaveBeenNthCalledWith(1, "get_workspace_roster_v1", { p_artist_workspace_id: "22222222-2222-4222-8222-222222222222" });
    expect(client.rpc).toHaveBeenNthCalledWith(2, "get_workspace_team_capability_v1", { p_artist_workspace_id: "22222222-2222-4222-8222-222222222222" });
    expect(client.functions.invoke).toHaveBeenCalledWith("account-team", { body: { action: "remove_member", artistWorkspaceId: "22222222-2222-4222-8222-222222222222", memberUserId: "33333333-3333-4333-8333-333333333333" } });
  });

  it("does not hide server failures", async () => {
    const service = createWorkspaceTeamService({ rpc: vi.fn(async () => ({ data: null, error: { message: "denied" } })), functions: { invoke: vi.fn() } });
    await expect(service.loadRoster("22222222-2222-4222-8222-222222222222")).rejects.toThrow("denied");
  });

  it.each([
    ["TEAM_GONE", "This invitation has expired or was revoked."],
    ["TEAM_FORBIDDEN", "This invitation belongs to another verified email."],
    ["TEAM_CONFLICT", "No Team seat is available."],
  ])("preserves structured %s function errors for invitation UI handling", async (code, message) => {
    const context = new Response(JSON.stringify({ code, error: message }), {
      status: code === "TEAM_GONE" ? 410 : code === "TEAM_FORBIDDEN" ? 403 : 409,
      headers: { "content-type": "application/json" },
    });
    const service = createWorkspaceTeamService({
      rpc: vi.fn(),
      functions: { invoke: vi.fn(async () => ({ data: null, error: { message: "Edge Function returned a non-2xx status code", context } })) },
    });

    await expect(service.acceptInvitation("A".repeat(43))).rejects.toMatchObject({ code, message });
  });
});
