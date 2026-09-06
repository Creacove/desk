import { describe, expect, it, vi } from "vitest";
import { createWorkspaceTeamService } from "./services/workspaceTeamService";

describe("workspace team first-run service", () => {
  it("completes first-run through the scoped RPC and returns capability state", async () => {
    const capability = {
      accountId: "11111111-1111-4111-8111-111111111111",
      artistWorkspaceId: "22222222-2222-4222-8222-222222222222",
      artistId: "33333333-3333-4333-8333-333333333333",
      planKey: "team_6" as const,
      enabled: true,
      entitled: true,
      source: "pilot" as const,
      seatLimit: 6 as const,
      occupiedSeats: 1,
      reservedSeats: 0,
      endsAt: null,
      firstRunCompletedAt: "2026-09-06T10:00:00.000Z",
    };
    const client = {
      rpc: vi.fn(async () => ({ data: capability, error: null })),
      functions: { invoke: vi.fn() },
    };
    const service = createWorkspaceTeamService(client);

    await expect(service.completeFirstRun({
      artistWorkspaceId: capability.artistWorkspaceId,
      teamName: "North Star Records",
      operatingTitle: "Founder / artist",
      responsibilityTags: ["direction", "approvals"],
    })).resolves.toEqual(capability);

    expect(client.rpc).toHaveBeenCalledWith("complete_team_first_run_v1", {
      p_artist_workspace_id: capability.artistWorkspaceId,
      p_team_name: "North Star Records",
      p_operating_title: "Founder / artist",
      p_responsibility_tags: ["direction", "approvals"],
    });
  });
});
